"""Sondes de sante.

Deux sondes distinctes, et la distinction compte : `/sante` dit si le processus
repond, `/sante/base` dit si la base repond. Les confondre ferait redemarrer
l'API a chaque hoquet de la base, ce qui n'aide personne.
"""

from typing import Any

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from ..config import reglages
from ..db import connexion_service

routeur = APIRouter(tags=["sante"])


@routeur.get("/sante")
async def sante() -> dict[str, Any]:
    """Le processus repond. Ne touche pas la base."""
    return {"etat": "ok", "environnement": reglages().environnement}


@routeur.get("/sante/base")
async def sante_base() -> JSONResponse:
    """La base repond, et le schema du pivot est visible."""
    try:
        async with connexion_service() as c:
            talents = await c.fetchval("SELECT count(*) FROM talent")
        return JSONResponse({"etat": "ok", "talents": talents})
    except Exception as e:  # la sonde doit rapporter l"état, jamais propager
        return JSONResponse(
            {"etat": "degrade", "detail": type(e).__name__},
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
