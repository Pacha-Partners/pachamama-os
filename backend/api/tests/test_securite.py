"""Tests de securite du jeton — la partie ou une erreur coute le plus cher."""

import time

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from pachamama_api.security import Appelant, appelant

# 32 octets minimum : en dessous, la bibliotheque avertit a juste titre (RFC 7518).
SECRET = "secret-de-test-uniquement-32-octets-minimum"


def _jeton(**surcharges: object) -> str:
    charge = {
        "sub": "11111111-1111-1111-1111-111111111111",
        "aud": "authenticated",
        "exp": int(time.time()) + 600,
        "app_metadata": {"roles": ["recruteur"], "entreprise_id": "ent-1"},
    }
    charge.update(surcharges)
    return jwt.encode(charge, SECRET, algorithm="HS256")


def _cred(jeton: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=jeton)


@pytest.fixture(autouse=True)
def _env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", SECRET)
    monkeypatch.setenv("DATABASE_URL", "postgresql://x/y")
    from pachamama_api.config import reglages

    reglages.cache_clear()


async def test_jeton_valide_est_accepte() -> None:
    qui = await appelant(_cred(_jeton()))
    assert qui.id == "11111111-1111-1111-1111-111111111111"
    assert qui.a_role("recruteur")


async def test_jeton_absent_est_refuse() -> None:
    with pytest.raises(HTTPException) as e:
        await appelant(None)
    assert e.value.status_code == 401


async def test_jeton_mal_signe_est_refuse() -> None:
    faux = jwt.encode(
        {"sub": "x", "aud": "authenticated", "exp": int(time.time()) + 60},
        "mauvais-secret-mais-assez-long-32-octets",
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as e:
        await appelant(_cred(faux))
    assert e.value.status_code == 401


async def test_jeton_expire_est_refuse() -> None:
    with pytest.raises(HTTPException) as e:
        await appelant(_cred(_jeton(exp=int(time.time()) - 10)))
    assert e.value.status_code == 401


async def test_le_role_ne_se_lit_jamais_dans_user_metadata() -> None:
    """`user_metadata` est modifiable par l'utilisateur : s'y fier serait offrir
    une elevation de privilege. Le role ne doit venir que d'`app_metadata`."""
    jeton = _jeton(app_metadata={}, user_metadata={"roles": ["admin"]})
    qui = await appelant(_cred(jeton))
    assert qui.roles == []
    assert not qui.a_role("admin")


def test_appelant_sans_metadonnees_na_aucun_role() -> None:
    assert Appelant({"sub": "x"}).roles == []
