"""Lecture des talents — et le motif d'acces que tout le reste suivra.

Ce module est volontairement minimal : les features des quatre vues viendront
ensuite. Ce qu'il fixe, c'est le motif — chaque lecture passe par
`connexion_utilisateur`, donc sous Row Level Security.
"""

from typing import Annotated, Any, Final

from fastapi import APIRouter, Depends, Query

from ..db import connexion_utilisateur
from ..security import Appelant, appelant

routeur = APIRouter(prefix="/talents", tags=["talents"])

# Catalogue FIGE des filtres autorises. Un fragment SQL ne peut venir que
# d'ici : la cle est un nom de parametre d'API, la valeur un predicat ecrit a
# la main. Aucune chaine issue de la requete HTTP n'atteint jamais le SQL —
# seules des VALEURS liees le font. C'est ce qui rend la construction
# dynamique ci-dessous structurellement sure, et non simplement « prudente ».
_FILTRES: Final[dict[str, str]] = {
    "recherche": (
        "(nom ILIKE {p} OR prenom ILIKE {p} OR employeur_actuel ILIKE {p} OR headline ILIKE {p})"
    ),
    "univers": "univers = {p}",
    "qualifie": "est_qualifie IS TRUE",
    "fusion": "type_fusion = {p}",
}
_TRIS: Final[dict[str, str]] = {
    "nom": "nom ASC NULLS LAST",
    "recent": "talent_id DESC",
}


@routeur.get("")
async def lister(
    qui: Annotated[Appelant, Depends(appelant)],
    recherche: Annotated[str | None, Query(max_length=120)] = None,
    univers: Annotated[str | None, Query(max_length=60)] = None,
    fusion: Annotated[str | None, Query(pattern="^(merged|jarvi_only|app_only)$")] = None,
    qualifie: Annotated[bool, Query()] = False,
    tri: Annotated[str, Query(pattern="^(nom|recent)$")] = "nom",
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    par_page: Annotated[int, Query(ge=1, le=100)] = 25,
) -> dict[str, Any]:
    """Liste paginee et filtree EN BASE.

    Le filtrage ne se fait jamais en memoire : sur 30 000 lignes, rapatrier pour
    filtrer couterait des secondes et de la bande passante. Les index poses au
    schema — trigram sur les noms, b-tree sur les filtres — servent exactement
    ces predicats.
    """
    fragments: list[str] = []
    valeurs: list[Any] = []

    def ajoute(nom_filtre: str, valeur: Any = None) -> None:
        """Ajoute un predicat du catalogue, en liant sa valeur s'il en attend une."""
        modele = _FILTRES[nom_filtre]
        if valeur is None:
            fragments.append(modele)
            return
        valeurs.append(valeur)
        fragments.append(modele.format(p=f"${len(valeurs)}"))

    if recherche:
        ajoute("recherche", f"%{recherche}%")
    if univers:
        ajoute("univers", univers)
    if fusion:
        ajoute("fusion", fusion)
    if qualifie:
        ajoute("qualifie")

    ou = f"WHERE {' AND '.join(fragments)}" if fragments else ""
    ordre = _TRIS[tri]
    # Les deux seules interpolations sont `ou` et `ordre`, tous deux issus des
    # catalogues figes ci-dessus. S608 est donc un faux positif ici.
    requete_total = f"SELECT count(*) FROM talent_recherche {ou}"  # noqa: S608
    requete_page = (
        f"SELECT * FROM talent_recherche {ou} ORDER BY {ordre}"  # noqa: S608
        f" LIMIT ${len(valeurs) + 1} OFFSET ${len(valeurs) + 2}"
    )

    async with connexion_utilisateur(qui.claims) as c:
        total = await c.fetchval(requete_total, *valeurs)
        lignes = await c.fetch(requete_page, *valeurs, par_page, (page - 1) * par_page)

    return {
        "total": total,
        "page": page,
        "par_page": par_page,
        "resultats": [dict(ligne) for ligne in lignes],
    }
