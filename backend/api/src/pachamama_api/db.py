"""Acces a PostgreSQL — et les deux pieges qu'il faut desamorcer.

PIEGE 1 — asyncpg et le pooler ne s'entendent pas
Le pooler Supabase en mode transaction change de connexion entre deux
requetes. Or asyncpg cree des *prepared statements* attaches a une session :
la nouvelle connexion ne les retrouve pas, et l'API tombe en
`DuplicatePreparedStatementError` des qu'une centaine de requetes arrivent en
rafale. Le correctif tient en trois reglages, poses ici une fois pour toutes :
port 6543, aucun cache d'instruction, et pas de pool cote client.

PIEGE 2 — la RLS est decorative si l'on utilise la cle de service
Cette cle contourne la Row Level Security. Une API qui s'en sert annule le
cloisonnement par entreprise, meme si les policies sont ecrites. Le motif
correct : ouvrir une transaction, y prendre le role applicatif et y injecter
les claims du jeton de l'utilisateur, puis laisser PostgreSQL arbitrer. C'est
`connexion_utilisateur()` ci-dessous.

La consequence est nette : une lecture pour le compte d'un utilisateur passe
TOUJOURS par `connexion_utilisateur`. `connexion_service` existe pour les
taches d'administration (migrations, ETL, audits) et doit rester rare.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import asyncpg
import asyncpg.pool

from .config import reglages

_pool: asyncpg.Pool[Any] | None = None


async def ouvrir_pool() -> asyncpg.Pool[Any]:
    """Cree le pool de connexions, avec les reglages qui evitent le piege 1."""
    global _pool
    if _pool is not None:
        return _pool
    r = reglages()
    _pool = await asyncpg.create_pool(
        dsn=r.database_url,
        min_size=0,
        max_size=10,
        # Le pooler fait deja le travail de mise en commun : un cache
        # d'instructions cote client entrerait en conflit avec lui.
        statement_cache_size=0,
        max_cached_statement_lifetime=0,
        max_inactive_connection_lifetime=30,
        # Le schema du pivot d'abord, puis public pour les extensions.
        server_settings={"search_path": f"{r.db_schema}, public, extensions"},
    )
    return _pool


async def fermer_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def connexion_utilisateur(
    claims: dict[str, Any],
) -> AsyncIterator[asyncpg.pool.PoolConnectionProxy[Any]]:
    """Connexion agissant POUR LE COMPTE d'un utilisateur, sous RLS.

    On prend le role applicatif et on injecte les claims verifies du jeton dans
    la session PostgreSQL. Les policies peuvent alors lire l'identite et le
    locataire depuis `request.jwt.claims` — c'est le moteur qui refuse une
    requete inter-locataire, pas le code applicatif.

    `SET LOCAL` limite la portee a la transaction : aucune fuite de contexte
    vers la requete suivante qui reutiliserait la meme connexion physique.
    """
    pool = await ouvrir_pool()
    async with pool.acquire() as connexion, connexion.transaction():
        await connexion.execute("SET LOCAL ROLE authenticated")
        await connexion.execute(
            "SELECT set_config('request.jwt.claims', $1, true)",
            json.dumps(claims, separators=(",", ":")),
        )
        yield connexion


@asynccontextmanager
async def connexion_service() -> AsyncIterator[asyncpg.pool.PoolConnectionProxy[Any]]:
    """Connexion d'administration, HORS RLS.

    Reservee aux traitements sans utilisateur : migrations, ETL, audits,
    sondes de sante. Tout usage pour servir une requete d'utilisateur est un
    defaut de conception — la RLS serait contournee.
    """
    pool = await ouvrir_pool()
    async with pool.acquire() as connexion:
        yield connexion
