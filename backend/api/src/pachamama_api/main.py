"""Point d'entree de l'API d'acces neutre.

Le principe verrouille du projet : le pivot est le maitre unique, l'ATS et
l'application en sont les producteurs, et personne n'ecrit en direct. Cette API
est donc le seul chemin d'ecriture — c'est la qu'un jour la preseance
s'appliquera et que l'audit se journalisera.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import reglages
from .db import fermer_pool, ouvrir_pool
from .routes import sante, talents


@asynccontextmanager
async def cycle_de_vie(app: FastAPI) -> AsyncIterator[None]:
    """Le pool s'ouvre au demarrage et se ferme proprement a l'arret."""
    await ouvrir_pool()
    yield
    await fermer_pool()


def creer_app() -> FastAPI:
    r = reglages()
    app = FastAPI(
        title="Pachamama OS — API d'acces",
        version="0.1.0",
        description=(
            "API neutre d'acces a la base talent unifiee. Les lectures sont "
            "servies sous Row Level Security, avec le jeton de l'appelant."
        ),
        lifespan=cycle_de_vie,
        # La documentation interactive reste ouverte hors production seulement.
        docs_url="/docs" if r.environnement != "production" else None,
        redoc_url=None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=r.origines_autorisees,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.include_router(sante.routeur)
    app.include_router(talents.routeur)
    return app


app = creer_app()
