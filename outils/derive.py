#!/usr/bin/env python3
"""Mesurer ce qui sépare le miroir Bubble du modèle `core`, à un instant donné.

    python3 outils/derive.py dev            # mesure le projet de développement
    python3 outils/derive.py live           # mesure la production
    python3 outils/derive.py live --json    # la même chose, pour un script
    python3 outils/derive.py live --contre var/derive/live-20260914.json

POURQUOI CET OUTIL EXISTE
─────────────────────────
`core` n'est pas une vue : la reprise y MATÉRIALISE des copies du miroir
`public`, et **aucun déclencheur ne relie les deux** — mesuré, zéro trigger.
Les insertions portent toutes `on conflict (id) do nothing` avec un identifiant
déterministe (`uuid_generate_v5`). Conséquence, et c'est tout le sujet :

    une fiche NOUVELLE dans Bubble   → rattrapée en rejouant la reprise
    une fiche MODIFIÉE dans Bubble   → JAMAIS rattrapée
    une fiche SUPPRIMÉE dans Bubble  → jamais rattrapée

Un `core` rempli en septembre et basculé en décembre porterait donc trois mois
de valeurs périmées, qu'aucune ré-exécution ne réparerait. La décision « quand
remplir, quand basculer » ne se prend donc pas au jugé : elle se prend en
regardant un écart. Cet outil rend cet écart.

CE QU'IL NE FAIT PAS
────────────────────
Il n'écrit rien, nulle part. Le garde est dans le code : toute requête qui ne
commence pas par `select` est refusée avant d'être envoyée, et l'appel passe en
`read_only`. C'est volontairement redondant — un outil qu'on lance sur la
production doit être incapable de la modifier, pas seulement censé ne pas le
faire.

COMMENT ON L'ÉTEND
──────────────────
Deux listes, et rien d'autre à toucher :
  · `VOLUMES`   — les couples (table du miroir, table de `core`) à comparer ;
  · `CONTROLES` — les défauts de donnée qui BLOQUENT la reprise ou qui la font
    perdre des lignes, avec leur requête et leur seuil.

Ajouter un contrôle, c'est ajouter une ligne. Le jour où une contrainte nouvelle
casse la reprise, elle a sa place ici — c'est ce qui évite de redécouvrir le
même défaut deux fois.

AUTHENTIFICATION
────────────────
`SUPABASE_ACCESS_TOKEN` si la variable existe (c'est le cas en CI), sinon le
trousseau macOS, où `supabase login` l'a rangé. Aucun mot de passe de base n'est
nécessaire — mesuré le 14/09 : le CLI et l'API de gestion se contentent du jeton.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
PROJETS = RACINE / "env" / "projets.env"
ARCHIVE = RACINE / "var" / "derive"

API = "https://api.supabase.com/v1/projects/{ref}/database/query"

# ── Le garde. Il est ici, avant tout le reste, parce que c'est lui qui rend
#    cet outil lançable sur la production sans réfléchir deux fois.
MOTS_INTERDITS = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|"
    r"comment|refresh|call|do)\b",
    re.I,
)


class Refus(Exception):
    """Une requête qui n'est pas une lecture. Elle ne part pas."""


def sql(ref: str, requete: str) -> list[dict]:
    q = " ".join(requete.split())
    if not q.lower().startswith("select"):
        raise Refus(f"la requête ne commence pas par select : {q[:60]}")
    if MOTS_INTERDITS.search(q):
        raise Refus(f"mot-clé d'écriture détecté : {q[:60]}")

    corps = json.dumps({"query": q, "read_only": True}).encode()
    requete_http = urllib.request.Request(
        API.format(ref=ref),
        data=corps,
        headers={"Authorization": f"Bearer {jeton()}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(requete_http, timeout=60) as reponse:
            return json.loads(reponse.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"API Supabase {e.code} : {e.read()[:300].decode(errors='replace')}")


_JETON: str | None = None


def jeton() -> str:
    """Le jeton d'accès. Variable d'environnement d'abord — c'est ce que la CI
    fournit — puis le trousseau macOS, où `supabase login` l'a rangé."""
    global _JETON
    if _JETON:
        return _JETON
    _JETON = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
    if not _JETON:
        try:
            _JETON = subprocess.run(
                ["security", "find-generic-password", "-s", "Supabase CLI", "-a", "supabase", "-w"],
                capture_output=True, text=True, check=True,
            ).stdout.strip()
        except (subprocess.CalledProcessError, FileNotFoundError):
            raise SystemExit(
                "Aucun jeton. Posez SUPABASE_ACCESS_TOKEN, ou lancez `supabase login`.\n"
                "(Sur macOS, le trousseau demande une autorisation : il faut une session "
                "interactive la première fois.)"
            )
    return _JETON


def ref_du_projet(cible: str) -> str:
    if not PROJETS.exists():
        raise SystemExit(f"introuvable : {PROJETS}")
    cle = {"dev": "PACHA_DEV_REF", "live": "PACHA_LIVE_REF"}[cible]
    for ligne in PROJETS.read_text().splitlines():
        if ligne.startswith(cle + "="):
            return ligne.split("=", 1)[1].strip().strip("\"'")
    raise SystemExit(f"{cle} absent de {PROJETS}")


# ══════════════════════════════════════════════════════════════════════════
#  CE QU'ON MESURE — les deux listes à étendre
# ══════════════════════════════════════════════════════════════════════════

# (libellé, table du miroir, table de core). La comparaison ne prétend PAS que
# les deux nombres doivent être égaux : la reprise fusionne, écarte et
# déduplique. L'écart est une MESURE, pas un verdict — c'est sa VARIATION d'une
# mesure à l'autre qui parle.
VOLUMES = [
    ("fiches talent",  "public.candidat",   "core.fiche_talent"),
    ("entreprises",    "public.entreprise", "core.entreprise"),
    ("mandats",        "public.mandat",     "core.mandat"),
    ("candidatures",   "public.process",    "core.candidature"),
    ("notes",          "public.note",       "core.note"),
    ("analyses",       "public.analyse",    "core.analyse"),
]


class Controle:
    """Un défaut de donnée connu, sa requête, et ce qu'il coûte.

    `bloquant` distingue deux natures, et la distinction compte le jour du
    déploiement : un contrôle bloquant ARRÊTE la reprise en cours de route et
    laisse `core` à moitié peuplé ; un contrôle non bloquant fait seulement
    perdre des lignes, que `reprise.controle` déclare.
    """

    def __init__(self, cle: str, libelle: str, requete: str, bloquant: bool, quoi_faire: str):
        self.cle, self.libelle, self.requete = cle, libelle, requete
        self.bloquant, self.quoi_faire = bloquant, quoi_faire


CONTROLES = [
    Controle(
        "email_non_valide",
        "fiches dont le courriel n'en est pas un",
        # `fiche_email_arobase` exige une arobase en position > 1. Deux lignes
        # sur 7 219 portaient un nom et une URL LinkedIn (mesuré le 14/09) :
        # la reprise s'arrête dessus, à la 23ᵉ migration.
        "select count(*)::int as n from public.candidat "
        "where coalesce(email_perso,'') <> '' and position('@' in email_perso) <= 1",
        bloquant=True,
        quoi_faire="corriger la fiche dans Bubble, ou vider le champ",
    ),
    Controle(
        "salaire_inverse",
        "mandats dont le salaire minimum dépasse le maximum",
        # `mandat_salaire_ordre`, posée NOT VALID. Ces mandats ne bloquent pas :
        # la reprise les écarte et le déclare — mais ils partent SANS AGENT.
        # ⚠ `salaire_min` / `salaire_max` sur le MIROIR, pas `…_ke`. Ces
        # dernières sont les colonnes de `core.mandat`, après conversion en
        # milliers d'euros. Les confondre rend « sans objet » au lieu du
        # compte — un contrôle muet est pire qu'un contrôle absent.
        "select count(*)::int as n from public.mandat "
        "where salaire_min is not null and salaire_max is not null "
        "and salaire_min > salaire_max",
        bloquant=False,
        quoi_faire="corriger la fourchette dans Bubble — sinon le mandat part sans agent",
    ),
    Controle(
        "contact_sans_identite",
        "contacts sans nom, prénom ni courriel dans le miroir",
        "select count(*)::int as n from public.equipe "
        "where coalesce(nom,'') = '' and coalesce(prenom,'') = '' and coalesce(email,'') = ''",
        bloquant=False,
        quoi_faire="ces contacts sont écartés — `contact_identifiable` les refuse",
    ),
]


# ══════════════════════════════════════════════════════════════════════════
#  La mesure
# ══════════════════════════════════════════════════════════════════════════

def compter(ref: str, table: str) -> int | None:
    """Le nombre de lignes, ou `None` si la table n'existe pas encore — c'est le
    cas de tout `core` sur une production où la reprise n'a pas tourné, et ce
    n'est pas une erreur."""
    schema, nom = table.split(".", 1)
    existe = sql(ref, f"select count(*)::int as n from information_schema.tables "
                      f"where table_schema = '{schema}' and table_name = '{nom}'")
    if not existe or existe[0]["n"] == 0:
        return None
    return sql(ref, f"select count(*)::int as n from {table}")[0]["n"]


def mesurer(cible: str) -> dict:
    ref = ref_du_projet(cible)

    mig = sql(ref, "select count(*)::int as n, max(version) as derniere "
                   "from supabase_migrations.schema_migrations")[0]
    locales = sorted(p.name[:14] for p in (RACINE / "supabase" / "migrations").glob("*.sql"))
    appliquees = {x["version"] for x in
                  sql(ref, "select version from supabase_migrations.schema_migrations")}

    volumes = []
    for libelle, source, cible_table in VOLUMES:
        volumes.append({
            "libelle": libelle,
            "miroir": compter(ref, source),
            "core": compter(ref, cible_table),
        })

    controles = []
    for c in CONTROLES:
        try:
            n = sql(ref, c.requete)[0]["n"]
        except SystemExit:
            n = None  # table ou colonne absente : le contrôle est sans objet ici
        controles.append({
            "cle": c.cle, "libelle": c.libelle, "n": n,
            "bloquant": c.bloquant, "quoi_faire": c.quoi_faire,
        })

    return {
        "quand": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "cible": cible,
        "projet": ref,
        "migrations": {
            "dans_le_depot": len(locales),
            "appliquees": mig["n"],
            "en_attente": [v for v in locales if v not in appliquees],
            "derniere": mig["derniere"],
        },
        "volumes": volumes,
        "controles": controles,
    }


# ══════════════════════════════════════════════════════════════════════════
#  Le rendu
# ══════════════════════════════════════════════════════════════════════════

def nombre(n: int | None) -> str:
    return "—" if n is None else f"{n:,}".replace(",", " ")


def ecart(a: int | None, b: int | None) -> str:
    if a is None or b is None:
        return ""
    d = b - a
    return "" if d == 0 else f"{d:+}"


def afficher(m: dict, precedent: dict | None) -> None:
    mg = m["migrations"]
    print(f"\n  {m['cible'].upper()} · {m['projet']} · {m['quand']}")
    print(f"\n  ── Migrations ──")
    print(f"     {mg['appliquees']} appliquées sur {mg['dans_le_depot']} · "
          f"{len(mg['en_attente'])} en attente"
          + (f" (de {mg['en_attente'][0]} à {mg['en_attente'][-1]})" if mg["en_attente"] else ""))

    print(f"\n  ── Volumes ──")
    print(f"     {'':<18}{'miroir':>10}{'core':>10}   {'depuis la dernière mesure':>0}")
    avant = {v["libelle"]: v for v in precedent["volumes"]} if precedent else {}
    for v in m["volumes"]:
        a = avant.get(v["libelle"], {})
        variation = ""
        if a:
            dm, dc = ecart(a.get("miroir"), v["miroir"]), ecart(a.get("core"), v["core"])
            if dm or dc:
                variation = f"   miroir {dm or '='} · core {dc or '='}"
        print(f"     {v['libelle']:<18}{nombre(v['miroir']):>10}{nombre(v['core']):>10}{variation}")

    print(f"\n  ── Contrôles ──")
    for c in m["controles"]:
        if c["n"] is None:
            etat, marque = "sans objet", " "
        elif c["n"] == 0:
            etat, marque = "aucun", "✔"
        else:
            etat = f"{c['n']}"
            marque = "⛔" if c["bloquant"] else "⚠"
        print(f"     {marque} {c['libelle']:<52} {etat}")
        if c["n"]:
            print(f"        → {c['quoi_faire']}")

    bloquants = sum(1 for c in m["controles"] if c["bloquant"] and c["n"])
    print()
    if bloquants:
        print(f"  ⛔ {bloquants} contrôle(s) BLOQUANT(S) : la reprise s'arrêterait en chemin.")
    elif mg["en_attente"]:
        print(f"  ✔ Aucun blocage connu. {len(mg['en_attente'])} migration(s) prêtes à être appliquées.")
    else:
        print("  ✔ Aucun blocage, aucune migration en attente.")
    print()


def main() -> int:
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("cible", choices=["dev", "live"])
    a.add_argument("--json", action="store_true", help="rendre la mesure brute")
    a.add_argument("--contre", metavar="FICHIER", help="comparer à une mesure précédente")
    a.add_argument("--archiver", action="store_true",
                   help=f"écrire la mesure dans {ARCHIVE.relative_to(RACINE)}/")
    args = a.parse_args()

    m = mesurer(args.cible)

    if args.json:
        print(json.dumps(m, indent=1, ensure_ascii=False))
    else:
        precedent = json.loads(Path(args.contre).read_text()) if args.contre else None
        afficher(m, precedent)

    if args.archiver:
        ARCHIVE.mkdir(parents=True, exist_ok=True)
        f = ARCHIVE / f"{args.cible}-{m['quand'][:10].replace('-','')}-{m['quand'][11:19].replace(':','')}.json"
        f.write_text(json.dumps(m, indent=1, ensure_ascii=False))
        print(f"  mesure archivée : {f.relative_to(RACINE)}\n")

    # Le code de sortie sert aux scripts : 1 s'il existe un blocage.
    return 1 if any(c["bloquant"] and c["n"] for c in m["controles"]) else 0


if __name__ == "__main__":
    sys.exit(main())
