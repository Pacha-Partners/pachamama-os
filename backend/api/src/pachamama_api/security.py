"""Verification des jetons et identite de l'appelant.

DEUX REGLES NON NEGOCIABLES

1. On ne fait JAMAIS confiance a un jeton non verifie. La verification se fait
   par la cle PUBLIQUE du fournisseur d'identite (JWKS, ES256) : il n'y a donc
   aucun secret a distribuer, et la rotation des cles est prise en charge en
   amont. Un secret partage (HS256) reste accepte en repli pour les projets qui
   n'ont pas bascule.

2. On ne lit JAMAIS une autorisation depuis une zone que l'utilisateur peut
   modifier. Le fournisseur expose deux espaces de metadonnees : `user_metadata`,
   que l'utilisateur modifie lui-meme, et `app_metadata`, modifiable seulement
   cote serveur. Le role et le locataire se lisent donc exclusivement dans
   `app_metadata` — s'y tromper offrirait une elevation de privilege.
"""

from __future__ import annotations

from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import reglages

_schema = HTTPBearer(auto_error=False)

# Le client JWKS met les cles en cache : sans cela, chaque requete entrainerait
# un appel reseau au fournisseur d'identite.
_jwks: jwt.PyJWKClient | None = None


def _client_jwks() -> jwt.PyJWKClient | None:
    global _jwks
    if _jwks is not None:
        return _jwks
    url = reglages().url_jwks
    if not url:
        return None
    _jwks = jwt.PyJWKClient(url, cache_keys=True, lifespan=3600)
    return _jwks


def _decode(jeton: str) -> dict[str, Any]:
    """Verifie et decode un jeton — JWKS d'abord, secret partage en repli."""
    r = reglages()
    client = _client_jwks()
    if client is not None:
        cle = client.get_signing_key_from_jwt(jeton)
        return dict(
            jwt.decode(
                jeton,
                cle.key,
                algorithms=["ES256", "RS256"],
                audience=r.jwt_audience,
                options={"require": ["exp", "sub"]},
            )
        )
    if r.jwt_secret:
        return dict(
            jwt.decode(
                jeton,
                r.jwt_secret,
                algorithms=["HS256"],
                audience=r.jwt_audience,
                options={"require": ["exp", "sub"]},
            )
        )
    raise RuntimeError("Aucun moyen de verification configure (ni JWKS, ni secret)")


class Appelant:
    """L'identite verifiee de celui qui appelle."""

    def __init__(self, claims: dict[str, Any]) -> None:
        self.claims = claims
        self.id: str = str(claims.get("sub", ""))
        app_meta = claims.get("app_metadata") or {}
        # Lecture volontairement restreinte a app_metadata : `user_metadata`
        # est modifiable par l'utilisateur, s'y fier serait une elevation de
        # privilege offerte.
        self.roles: list[str] = list(app_meta.get("roles") or [])
        self.entreprise_id: str | None = app_meta.get("entreprise_id")

    def a_role(self, *attendus: str) -> bool:
        return any(r in self.roles for r in attendus)


async def appelant(
    identifiants: Annotated[HTTPAuthorizationCredentials | None, Depends(_schema)],
) -> Appelant:
    """Dependance FastAPI : verifie le jeton et rend l'identite de l'appelant."""
    if identifiants is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jeton absent",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        # Signature, expiration et audience sont verifiees. Sans cela, un jeton
        # forge passerait.
        claims = _decode(identifiants.credentials)
    except (jwt.PyJWTError, jwt.PyJWKClientError) as e:
        # Message unique : ne pas indiquer si le jeton est expire, mal signe ou
        # mal forme — c'est de l'information offerte a un attaquant.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jeton invalide",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    return Appelant(claims)


def exige_role(*attendus: str) -> Any:
    """Fabrique une dependance qui exige l'un des roles donnes."""

    async def _verifie(qui: Annotated[Appelant, Depends(appelant)]) -> Appelant:
        if not qui.a_role(*attendus):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")
        return qui

    return _verifie
