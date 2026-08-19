"""Configuration, lue dans l'environnement — jamais codee en dur."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Reglages(BaseSettings):
    """Reglages de l'application.

    Les secrets viennent de l'environnement. Aucune valeur par defaut n'est
    fournie pour eux : l'application doit refuser de demarrer plutot que de
    tourner avec un secret vide.
    """

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Base de donnees -------------------------------------------------
    # ⚠️ Port 6543 = pooler en mode transaction, obligatoire pour une API
    # concurrente. Voir db.py pour le piege des prepared statements.
    database_url: str = Field(
        ...,
        description="URL PostgreSQL, port 6543 (pooler transaction)",
    )
    db_schema: str = Field(default="pivot", description="Schema de la base talent")

    # --- Verification des jetons ----------------------------------------
    # Deux voies, par ordre de preference :
    #
    #   1. JWKS (asymetrique, ES256). La cle de verification est PUBLIQUE : rien
    #      a distribuer, rien a garder secret, et la rotation des cles est prise
    #      en charge par le fournisseur. C'est la voie retenue.
    #   2. Secret partage (HS256), voie historique. Conservee en repli pour les
    #      projets qui n'ont pas encore bascule en asymetrique.
    #
    # Dans les deux cas, un jeton non verifie n'est jamais exploite.
    supabase_url: str | None = Field(
        default=None, description="URL du projet, pour deduire le JWKS"
    )
    jwks_url: str | None = Field(default=None, description="URL du JWKS (deduite si absente)")
    jwt_secret: str | None = Field(default=None, description="Secret HS256, repli historique")
    jwt_audience: str = Field(default="authenticated")

    @property
    def url_jwks(self) -> str | None:
        """L'URL du JWKS, explicite ou deduite de l'URL du projet."""
        if self.jwks_url:
            return self.jwks_url
        if self.supabase_url:
            return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        return None

    # --- Divers ----------------------------------------------------------
    environnement: str = Field(default="developpement")
    origines_autorisees: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])


@lru_cache
def reglages() -> Reglages:
    """Instance unique, mise en cache : la configuration ne change pas a chaud."""
    return Reglages()  # type: ignore[call-arg]
