"""Briques partagees par les connecteurs.

Chaque fonction de ce module existe parce qu'un incident l'a rendue
necessaire. Les commentaires disent lequel : sans cela, la prochaine personne
les simplifiera de bonne foi et refera la meme perte.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ReglagesConnecteurs(BaseSettings):
    """Configuration propre aux connecteurs.

    Volontairement SEPAREE de celle de l'API : un connecteur parle a PostgREST
    en HTTP, il n'ouvre aucune connexion PostgreSQL. Lui imposer `database_url`
    l'empecherait de demarrer pour une variable qu'il n'utilise jamais.
    Les deux lisent les memes fichiers, chacune ne declare que ses besoins.
    """

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    supabase_url: str | None = Field(default=None, description="URL du projet Supabase")
    supabase_service_role_key: str | None = Field(
        default=None, description="Cle service_role — connecteurs uniquement, jamais le navigateur"
    )

    # Jarvi : API REST v2. La documentation est explicite sur la portee des cles —
    # « The public key may only create profiles and applications; every other
    # route needs the private key. » C'est donc la cle PRIVEE, en-tete X-API-KEY.
    jarvi_api_key: str | None = Field(default=None, description="Cle PRIVEE Jarvi")
    # Mesuré le 24/08/2026 : « api.jarvi.tech » ne résout pas. L'adresse réelle,
    # celle que donne la documentation, est functions.prod.jarvi.tech.
    jarvi_api_base: str = Field(default="https://functions.prod.jarvi.tech/v1/public-api/rest/v2")


@lru_cache
def reglages() -> ReglagesConnecteurs:
    return ReglagesConnecteurs()


# PostgREST plafonne le nombre de lignes rendues QUEL QUE SOIT le `limit`
# demande, sans erreur : verifie en production, `limit=100000` rend 1000 lignes
# et `Content-Range: 0-999/25123`. Demander plus que ce plafond est donc inutile
# et dangereux : la reponse est tronquee en silence.
LOT = 1000


# Les artefacts (manifestes de rollback, sauvegardes) ne vont PAS dans l'arbre
# des sources. Ils sont datés, volumineux, et parfois porteurs de donnees
# personnelles. `var/` est ignore par git.
def dossier_artefacts() -> Path:
    chemin = Path(os.environ.get("PACHA_ARTEFACTS", "var/connecteurs"))
    chemin.mkdir(parents=True, exist_ok=True)
    return chemin


class Incident(Exception):
    """Tout ce qui empeche de conclure. Ne jamais avaler : un connecteur qui
    conclut sur une lecture douteuse est la forme exacte des pertes
    silencieuses de ce projet."""


def acces_supabase() -> tuple[str, str]:
    """URL et cle service_role, depuis la configuration — jamais un `.env`
    reparse a la main."""
    r = reglages()
    if not r.supabase_url:
        raise Incident("SUPABASE_URL absente de la configuration")
    if not r.supabase_service_role_key:
        raise Incident(
            "SUPABASE_SERVICE_ROLE_KEY absente : un connecteur ne peut pas "
            "tourner sans elle (il ecrit sous la securite au niveau ligne)"
        )
    return r.supabase_url.rstrip("/"), r.supabase_service_role_key


# --------------------------------------------------------------- dates
_FRACTION = re.compile(r"\.(\d{1,6})")


class DateIllisible:
    """Sentinelle pour une date non analysable.

    Deux `DateIllisible` ne sont JAMAIS egales. Sans cela, deux dates
    illisibles des deux cotes d'une comparaison se compareraient egales et
    masqueraient un ecart reel.
    """

    __slots__ = ("brut",)

    def __init__(self, brut: str) -> None:
        self.brut = brut

    def __eq__(self, autre: object) -> bool:
        return False

    def __ne__(self, autre: object) -> bool:
        return True

    __hash__ = None  # type: ignore[assignment]


def analyser_date(valeur: str | None) -> datetime | DateIllisible | None:
    """Analyse une date ISO en tolerant les fractions de seconde tronquees.

    PostgREST supprime les zeros de fin (« .34+00:00 ») et
    `datetime.fromisoformat` n'accepte, avant Python 3.11, que 3 ou 6
    decimales. Un analyseur naif a annonce 4 150 fiches perimees inexistantes
    sur ce projet le 20/08/2026.
    """
    if valeur is None:
        return None
    texte = _FRACTION.sub(
        lambda m: "." + m.group(1).ljust(6, "0"), valeur.replace("Z", "+00:00"), count=1
    )
    try:
        return datetime.fromisoformat(texte).astimezone(UTC)
    except (ValueError, AttributeError):
        return DateIllisible(valeur)


def verifier_analyseur_dates() -> None:
    """Refuse de produire un chiffre si l'analyseur ne se comporte pas comme
    prevu. Un instrument doit prouver qu'il fonctionne avant de conclure."""
    equivalents = [
        ("2024-11-27T16:05:20.340Z", "2024-11-27T16:05:20.34+00:00"),
        ("2024-09-10T07:10:50.400Z", "2024-09-10T07:10:50.4+00:00"),
        ("2026-07-08T09:31:14.819Z", "2026-07-08T09:31:14.819+00:00"),
        ("2026-07-08T09:31:00.000Z", "2026-07-08T09:31:00+00:00"),
    ]
    for a, b in equivalents:
        if isinstance(analyser_date(a), DateIllisible) or analyser_date(a) != analyser_date(b):
            raise Incident(f"analyseur de dates casse sur {a} / {b}")
    if analyser_date("2026-06-04T09:10:44.041Z") == analyser_date(
        "2026-06-04T09:10:44.041593+00:00"
    ):
        raise Incident("analyseur de dates trop laxiste : deux instants distincts confondus")
    if analyser_date("pas-une-date") == analyser_date("pas-une-date-non-plus"):
        raise Incident("sentinelle cassee : deux dates illisibles se comparent egales")


def moins_une_ms(iso: str) -> str:
    """Recule d'une milliseconde.

    La contrainte de la source est un `>` STRICT : sans ce recul, la fiche
    portant exactement la date du curseur est exclue, ainsi que tous ses
    ex aequo. Regle payee par une perte reelle.
    """
    d = analyser_date(iso)
    if not isinstance(d, datetime):
        return iso
    d = d - timedelta(milliseconds=1)
    return d.strftime("%Y-%m-%dT%H:%M:%S.") + f"{d.microsecond // 1000:03d}Z"


# --------------------------------------------------------------- HTTP
def appeler(
    chemin: str,
    methode: str = "GET",
    profil: str | None = "pivot",
    corps: Any = None,
    prefer: str | None = None,
    acces: tuple[str, str] | None = None,
) -> tuple[Any, str | None]:
    """Un appel PostgREST. Rend le corps et l'en-tete Content-Range.

    `acces` permet de viser un AUTRE projet Supabase que celui de la
    configuration — l'environnement de developpement, en pratique. Il est
    facultatif et sans effet sur les appelants existants. La logique HTTP,
    la pagination et le recoupement des totaux restent ecrits une seule fois :
    une lecture PostgREST correcte a coute assez cher pour ne pas etre
    recopiee ailleurs.
    """
    base, cle = acces or acces_supabase()
    entetes = {"apikey": cle, "Authorization": f"Bearer {cle}"}
    if profil:
        entetes["Accept-Profile"] = entetes["Content-Profile"] = profil
    if prefer:
        entetes["Prefer"] = prefer
    donnees = None
    if corps is not None:
        entetes["Content-Type"] = "application/json"
        donnees = json.dumps(corps).encode()
    requete = urllib.request.Request(  # noqa: S310 — URL construite, pas d'entree utilisateur
        f"{base}/rest/v1/{chemin}", data=donnees, headers=entetes, method=methode
    )
    with urllib.request.urlopen(requete, timeout=240) as reponse:  # noqa: S310
        brut = reponse.read()
        plage = reponse.headers.get("Content-Range")
    return (json.loads(brut) if brut else None), plage


def total(
    chemin: str, profil: str | None = "pivot", acces: tuple[str, str] | None = None
) -> int:
    separateur = "&" if "?" in chemin else "?"
    _, plage = appeler(
        f"{chemin}{separateur}limit=1", profil=profil, prefer="count=exact", acces=acces
    )
    if not plage or "/" not in plage:
        raise Incident(f"{chemin} : le serveur n'annonce aucun total")
    return int(plage.rsplit("/", 1)[1])


def lire_tout(
    chemin: str,
    tri: str,
    profil: str | None = "pivot",
    essais: int = 4,
    acces: tuple[str, str] | None = None,
) -> list[dict[str, Any]]:
    """Lecture paginee, encadree par deux comptages.

    Deux pieges distincts, qu'il faut savoir separer :

    1. TRONCATURE SILENCIEUSE. PostgREST plafonne a 1000 lignes quel que soit
       le `limit` demande, sans erreur. Sans recoupement, on raisonnerait sur
       un echantillon en croyant tenir la table entiere.
    2. TABLE EN MOUVEMENT. Le sync ecrit en continu, et une lecture longue
       voit donc le total changer. Un simple « lignes lues != total annonce »
       confondrait ce cas avec le precedent.

    On les distingue en encadrant la lecture par deux comptages : si le total
    a bouge, la table a mute et on relit ; s'il est stable mais que le compte
    ne tombe pas juste, c'est une troncature et on refuse de conclure.
    """
    separateur = "&" if "?" in chemin else "?"
    for _ in range(essais):
        avant = total(chemin, profil, acces=acces)
        lignes: list[dict[str, Any]] = []
        decalage = 0
        while True:
            page, _ = appeler(
                f"{chemin}{separateur}order={tri}&limit={LOT}&offset={decalage}",
                profil=profil,
                acces=acces,
            )
            if not page:
                break
            lignes += page
            if len(page) < LOT:
                break
            decalage += LOT
        if total(chemin, profil, acces=acces) != avant:
            continue  # la table a mute pendant la lecture : on relit
        if len(lignes) != avant:
            raise Incident(
                f"{chemin} : {len(lignes)} lignes lues pour {avant} annoncees, "
                "total stable — lecture tronquee, refus de conclure"
            )
        return lignes
    raise Incident(f"{chemin} : la table bouge trop pour etre lue de facon coherente")


def echapper(valeur: object) -> str:
    return urllib.parse.quote(str(valeur))
