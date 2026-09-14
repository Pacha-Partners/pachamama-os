#!/usr/bin/env python3
"""Rend au projet de développement les VRAIES valeurs, lues en production.

    PYTHONPATH=backend/api/src backend/api/.venv/bin/python \
        backend/database/anonymisation/restaurer_reel.py             # simulation
        ... restaurer_reel.py --appliquer                             # écriture
        ... restaurer_reel.py --appliquer --tables candidat,user      # un essai

POURQUOI CE PROGRAMME EXISTE — décision du dirigeant, 08/09/2026.
Le dev est une capture des données réelles à un instant t. On travaille sur de
vraies données ; ce qui remontera un jour vers le live, c'est la logique et le
schéma, jamais les lignes. La pseudonymisation du dev est donc levée, et ce
programme est l'inverse exact de `peupler_dev.py` : il relit la production et
réécrit dans le dev les 125 colonnes que la classification avait altérées.

Il ne passe PAS par `peupler_dev.py`, qui reste juste dans son mode anonymisé
et dont le contrôle de fuite (peupler_dev.py:323) lèverait ici à la première
ligne — c'est précisément son travail.

Le seul garde-fou qui compte est repris tel quel de `peupler_dev.py:70` et
s'exécute en PREMIER : la production n'est que lue, jamais écrite.

TROIS DÉCISIONS PRISES, ET LEUR RAISON
1. `pivot.sync_etat` et `pivot.sync_run` sont EXCLUS par défaut. Leurs douze
   colonnes n'ont pas été altérées pour protéger une identité, mais pour que le
   dev n'hérite pas de l'avancement de la production. La classification est
   explicite sur `sync_etat.curseur` : « la colonne la plus dangereuse à
   recopier de tout le schéma ». Recopier ce curseur ferait croire au
   connecteur du dev qu'il a déjà synchronisé jusqu'au filigrane de la prod, et
   il sauterait en silence tous les enregistrements de l'intervalle. `--avec-sync`
   force la copie ; ne l'utiliser qu'en sachant ce qu'on répare.
2. Seules les lignes présentes DES DEUX CÔTÉS sont restaurées. La production a
   continué d'écrire depuis la capture du 25/08/2026 : ses lignes en trop ne
   sont pas insérées, le dev est une capture, pas un miroir vivant. Les lignes
   qui n'existent que dans le dev (supprimées en prod depuis) gardent leurs
   valeurs fictives — le rapport les compte, table par table.
3. `pivot.talent_source` est un cas à part : sa clé primaire contient
   `external_id`, lui-même substitué dans le dev. La clé ne permet donc PAS
   d'apparier les deux côtés. Le programme mesure si `(talent_id, source)` est
   unique de part et d'autre ; si ça ne l'est pas, il ne touche pas à la table
   et le dit, plutôt que d'inventer un appariement.

COMMENT IL ÉCRIT
Par lots d'upsert, pas ligne à ligne : 240 000 PATCH seraient interminables.
PostgREST accepte `Prefer: resolution=merge-duplicates` avec
`?on_conflict=<clé>` — un POST de 500 objets met à jour les colonnes présentes
dans la charge utile et laisse les autres intactes.

Piège mesuré : `ON CONFLICT DO UPDATE` construit d'abord un tuple candidat, donc
toute colonne NOT NULL sans valeur par défaut doit figurer dans la charge utile
même si on ne veut pas la modifier. Cette liste n'est PAS codée en dur : elle
est lue au démarrage dans le spec OpenAPI du dev (`GET /rest/v1/`, champ
`required` moins les colonnes qui portent un `default`). Le programme reste donc
juste si le schéma bouge. Ces colonnes de remplissage sont reprises de la valeur
ACTUELLE DU DEV, jamais de la production : on restaure ce qui a été altéré, on
ne rapatrie pas au passage les mises à jour de la prod sur le reste.

Le programme est idempotent : une ligne dont toutes les colonnes altérées valent
déjà la valeur réelle n'est pas réécrite, et une seconde exécution le dit.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
from pathlib import Path
from typing import Any

ICI = Path(__file__).resolve().parent
RACINE = ICI.parents[2]
sys.path.insert(0, str(RACINE / "backend" / "api" / "src"))

from pachamama_api.connecteurs import commun  # noqa: E402

CLASSIFICATION = json.loads((ICI / "classification.json").read_text())
ORDRE = json.loads((ICI / "ordre_chargement.json").read_text())

LOT_ECRITURE = 500
TOUCHE = ("SUBSTITUER", "VIDER", "GENERALISER", "REINITIALISER")

# Voir la décision 1 de l'en-tête. Ces deux tables portent l'avancement de la
# synchro, pas une identité : les recopier ferait sauter des enregistrements.
EXCLUES_PAR_DEFAUT = {("pivot", "sync_etat"), ("pivot", "sync_run")}


# --------------------------------------------------------------------- accès
def acces_dev() -> tuple[str, str]:
    """URL et clé de service du projet de développement, depuis .env.local.

    Recopié de `peupler_dev.py` à dessein : le dé-anonymiseur ne doit pas
    dépendre de l'anonymiseur, dont le contrôle de fuite est l'inverse du sien.
    """
    env: dict[str, str] = {}
    for candidat in (RACINE / ".env.local", RACINE / ".env"):
        if candidat.exists():
            for ligne in candidat.read_text().splitlines():
                ligne = ligne.strip()
                if ligne and not ligne.startswith("#") and "=" in ligne:
                    cle, valeur = ligne.split("=", 1)
                    env.setdefault(cle.strip(), valeur.strip().strip("\"'"))
    url = env.get("SUPABASE_DEV_URL", "")
    cle = env.get("SUPABASE_DEV_SERVICE_ROLE_KEY", "")
    if not url or not cle:
        raise commun.Incident(
            "SUPABASE_DEV_URL ou SUPABASE_DEV_SERVICE_ROLE_KEY absente de .env.local"
        )
    return url.rstrip("/"), cle


def garde_fou(dev: tuple[str, str]) -> None:
    """Refuser d'écrire ailleurs que dans le projet de développement.

    Identique à `peupler_dev.py:70`. C'est la première instruction exécutée.
    """
    prod_url, _ = commun.acces_supabase()
    if dev[0].rstrip("/") == prod_url.rstrip("/"):
        raise commun.Incident(
            "REFUS : la cible est le projet de PRODUCTION. "
            "SUPABASE_DEV_URL doit désigner un autre projet."
        )
    if not dev[0].startswith("https://"):
        raise commun.Incident(f"REFUS : cible non chiffrée ({dev[0]})")


# ------------------------------------------------------------------- schéma
def cles_primaires(brut: str) -> list[str]:
    """« id » ou « (talent_id, source, external_id) » -> liste de colonnes."""
    return [c.strip() for c in brut.strip().strip("()").split(",") if c.strip()]


def spec_dev(dev: tuple[str, str], profil: str) -> dict[str, dict[str, Any]]:
    """Les colonnes NOT NULL sans valeur par défaut, lues dans le spec OpenAPI.

    `required` liste les colonnes NOT NULL ; celles qui portent un `default`
    n'ont pas besoin d'être fournies, PostgreSQL les remplit. La différence est
    exactement l'ensemble qu'`ON CONFLICT DO UPDATE` exige dans la charge utile.
    """
    corps, _ = commun.appeler("", profil=profil, acces=dev)
    if not isinstance(corps, dict) or "definitions" not in corps:
        raise commun.Incident(f"le spec OpenAPI du profil {profil} est illisible")
    sortie: dict[str, dict[str, Any]] = {}
    for table, definition in corps["definitions"].items():
        props = definition.get("properties", {}) or {}
        requis = set(definition.get("required", []) or [])
        sortie[table] = {
            "colonnes": set(props),
            "obligatoires": {c for c in requis if "default" not in (props.get(c) or {})},
        }
    return sortie


def perimetre(args) -> list[dict[str, Any]]:
    """Les tables à restaurer, dans l'ordre de chargement, avec leurs colonnes."""
    par_nom = {
        (t["schema"], t["table"]): t
        for t in CLASSIFICATION["tables"]
        if any(c["traitement"] in TOUCHE for c in t["colonnes"])
    }
    ordonnees = [
        par_nom[tuple(q.split(".", 1))]
        for q in ORDRE["ordre"]
        if tuple(q.split(".", 1)) in par_nom
    ]
    ordonnees += [t for t in par_nom.values() if t not in ordonnees]

    choisies = []
    for t in ordonnees:
        cle = (t["schema"], t["table"])
        if cle in EXCLUES_PAR_DEFAUT and not args.avec_sync:
            continue
        if args.tables and t["table"] not in args.tables and f"{t['schema']}.{t['table']}" not in args.tables:
            continue
        choisies.append(t)
    return choisies


# ------------------------------------------------------------------ lecture
def lire(acces, schema: str, table: str, colonnes: list[str], tri: str) -> list[dict]:
    return commun.lire_tout(
        f"{table}?select={','.join(colonnes)}", tri=tri, profil=schema, acces=acces
    )


def indexer(lignes: list[dict], pk: list[str]) -> dict[tuple, dict]:
    return {tuple(ligne[c] for c in pk): ligne for ligne in lignes}


def paire_unique(lignes: list[dict]) -> bool:
    """`(talent_id, source)` distingue-t-il bien chaque ligne ?"""
    return len({(x["talent_id"], x["source"]) for x in lignes}) == len(lignes)


# ------------------------------------------------------------------ écriture
def ecrire(dev, schema: str, table: str, pk: list[str], charge: list[dict]) -> None:
    """Upsert par lots. Toute erreur est remontée avec le corps du serveur :
    un lot refusé en silence est exactement la perte que ce dépôt traque."""
    for debut in range(0, len(charge), LOT_ECRITURE):
        lot = charge[debut : debut + LOT_ECRITURE]
        try:
            commun.appeler(
                f"{table}?on_conflict={','.join(pk)}",
                methode="POST",
                profil=schema,
                corps=lot,
                prefer="resolution=merge-duplicates,return=minimal",
                acces=dev,
            )
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:600]
            raise commun.Incident(
                f"{schema}.{table} : lot {debut}-{debut + len(lot)} refusé "
                f"(HTTP {e.code}) — {detail}"
            ) from e


# ----------------------------------------------------------------- une table
def restaurer(t: dict, prod, dev, specs, appliquer: bool) -> dict[str, Any]:
    schema, table = t["schema"], t["table"]
    pk = cles_primaires(t["cle_primaire"])
    alterees = [c["nom"] for c in t["colonnes"] if c["traitement"] in TOUCHE]
    spec = specs[schema].get(table)
    if spec is None:
        raise commun.Incident(f"{schema}.{table} absente du spec OpenAPI du dev")
    remplissage = sorted(spec["obligatoires"] - set(pk) - set(alterees))

    r: dict[str, Any] = {
        "table": f"{schema}.{table}", "live": 0, "dev": 0, "appariees": 0,
        "ecrites": 0, "live_seul": 0, "dev_seul": 0, "note": "",
    }

    # Décision 3 : la clé de talent_source contient une colonne substituée, elle
    # ne peut donc pas servir à apparier. On mesure le repli avant de s'en servir.
    apparier_sur = pk
    if (schema, table) == ("pivot", "talent_source"):
        cols = ["talent_id", "source", "external_id"]
        lignes_prod = lire(prod, schema, table, cols, "talent_id")
        lignes_dev = lire(dev, schema, table, cols, "talent_id")
        r["live"], r["dev"] = len(lignes_prod), len(lignes_dev)
        if not (paire_unique(lignes_prod) and paire_unique(lignes_dev)):
            r["note"] = (
                "NON RESTAURÉE : la clé primaire contient external_id, qui est "
                "substitué, et (talent_id, source) n'est pas unique "
                f"({len(lignes_prod)} lignes prod pour "
                f"{len({(x['talent_id'], x['source']) for x in lignes_prod})} paires ; "
                f"{len(lignes_dev)} lignes dev pour "
                f"{len({(x['talent_id'], x['source']) for x in lignes_dev})} paires). "
                "Aucun appariement fiable — rien n'est écrit."
            )
            return r
        apparier_sur = ["talent_id", "source"]

    colonnes_prod = sorted(set(pk) | set(alterees) | set(apparier_sur))
    colonnes_dev = sorted(set(colonnes_prod) | set(remplissage))
    lignes_prod = lire(prod, schema, table, colonnes_prod, pk[0])
    lignes_dev = lire(dev, schema, table, colonnes_dev, pk[0])
    r["live"], r["dev"] = len(lignes_prod), len(lignes_dev)

    index_prod = indexer(lignes_prod, apparier_sur)
    index_dev = indexer(lignes_dev, apparier_sur)
    communes = set(index_prod) & set(index_dev)
    r["appariees"] = len(communes)
    r["live_seul"] = len(index_prod) - len(communes)
    r["dev_seul"] = len(index_dev) - len(communes)

    charge = []
    for cle in communes:
        vraie, actuelle = index_prod[cle], index_dev[cle]
        if all(vraie.get(c) == actuelle.get(c) for c in alterees):
            continue  # déjà restaurée : ne rien réécrire
        objet = {c: actuelle[c] for c in pk}
        objet.update({c: actuelle.get(c) for c in remplissage})
        objet.update({c: vraie.get(c) for c in alterees})
        charge.append(objet)

    r["ecrites"] = len(charge)
    if charge and appliquer:
        ecrire(dev, schema, table, pk, charge)
    return r


# ---------------------------------------------------------------------- main
def main() -> int:
    a = argparse.ArgumentParser(description=__doc__)
    a.add_argument("--appliquer", action="store_true", help="écrire (sinon simulation)")
    a.add_argument("--tables", default="", help="liste de tables, séparées par des virgules")
    a.add_argument("--avec-sync", action="store_true",
                   help="restaurer AUSSI pivot.sync_etat et pivot.sync_run — "
                        "recopie le curseur de la prod, la synchro du dev sautera "
                        "alors tout l'intervalle non synchronisé")
    args = a.parse_args()
    args.tables = {x.strip() for x in args.tables.split(",") if x.strip()}

    dev = acces_dev()
    garde_fou(dev)  # PREMIÈRE instruction utile : jamais d'écriture en production
    prod = commun.acces_supabase()
    commun.verifier_analyseur_dates()

    print(f"production (lecture seule) {prod[0]}")
    print(f"développement (cible)      {dev[0]}")
    print("SIMULATION — rien ne sera écrit (--appliquer pour écrire)\n"
          if not args.appliquer else "ÉCRITURE\n")

    specs = {p: spec_dev(dev, p) for p in ("public", "pivot")}
    tables = perimetre(args)
    if not tables:
        raise commun.Incident("aucune table dans le périmètre")
    if not args.avec_sync:
        print("pivot.sync_etat et pivot.sync_run exclus : leur curseur ferait "
              "sauter des enregistrements à la synchro du dev (--avec-sync pour forcer)\n")

    entete = (f"{'table':28} {'live':>7} {'dev':>7} {'apparié':>8} "
              f"{'écrit':>7} {'live seul':>10} {'dev seul':>9}")
    print(entete)
    print("-" * len(entete))

    rapports, echecs = [], []
    for t in tables:
        try:
            r = restaurer(t, prod, dev, specs, args.appliquer)
        except commun.Incident as e:
            echecs.append(f"{t['schema']}.{t['table']} : {e}")
            print(f"{t['schema'] + '.' + t['table']:28} ÉCHEC — {e}")
            continue
        rapports.append(r)
        print(f"{r['table']:28} {r['live']:7} {r['dev']:7} {r['appariees']:8} "
              f"{r['ecrites']:7} {r['live_seul']:10} {r['dev_seul']:9}"
              + ("   <-- " + r["note"][:60] if r["note"] else ""))

    total_ecrit = sum(r["ecrites"] for r in rapports)
    print("-" * len(entete))
    print(f"{'TOTAL':28} {sum(r['live'] for r in rapports):7} "
          f"{sum(r['dev'] for r in rapports):7} "
          f"{sum(r['appariees'] for r in rapports):8} {total_ecrit:7} "
          f"{sum(r['live_seul'] for r in rapports):10} "
          f"{sum(r['dev_seul'] for r in rapports):9}\n")

    for r in rapports:
        if r["note"]:
            print(f"   {r['table']} — {r['note']}\n")

    dev_seul = sum(r["dev_seul"] for r in rapports)
    if dev_seul:
        print(f"   {dev_seul} lignes n'existent que dans le dev (supprimées en "
              "production depuis la capture) : elles GARDENT leurs valeurs fictives.")
    live_seul = sum(r["live_seul"] for r in rapports)
    if live_seul:
        print(f"   {live_seul} lignes n'existent qu'en production (créées depuis la "
              "capture) : elles ne sont PAS insérées, le dev reste une capture.")

    if total_ecrit == 0 and not echecs:
        print("\nRien à écrire : toutes les lignes appariées portent déjà la vraie "
              "valeur. La restauration est faite.")
    elif not args.appliquer:
        print(f"\n{total_ecrit} lignes seraient réécrites. Relancer avec --appliquer.")
    else:
        print(f"\n{total_ecrit} lignes réécrites.")

    if echecs:
        print(f"\n{len(echecs)} TABLE(S) EN ÉCHEC :")
        for e in echecs:
            print("   " + e)
        return 2
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except commun.Incident as e:
        print(f"\nARRÊT : {e}", file=sys.stderr)
        raise SystemExit(2) from e
