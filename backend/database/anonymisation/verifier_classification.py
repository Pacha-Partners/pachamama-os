#!/usr/bin/env python3
"""Contrôle que classification.json décrit exactement le schéma réel, et
régénère README.md à partir d'elle.

Pourquoi ce script existe : la production a vécu six mois avec des fichiers qui
ne la décrivaient plus — 21 colonnes ajoutées à la main, jamais reversées.
Une classification qui liste les colonnes à protéger ne vaut que si elle est
comparée au schéma à chaque fois. Une colonne ajoutée demain et absente d'ici
est une fuite silencieuse : elle serait chargée telle quelle.

    python3 verifier_classification.py            # contrôle seul
    python3 verifier_classification.py --ecrire   # contrôle puis régénère README.md

Sortie 0 si tout concorde, 2 sinon.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
MIGRATIONS = ICI.parents[2] / "supabase" / "migrations"
CLASSIFICATION = ICI / "classification.json"
LISIBLE = ICI / "README.md"

TOUCHE = ("SUBSTITUER", "VIDER", "GENERALISER", "REINITIALISER")


def schema_reel(sql: str) -> dict[tuple[str, str], list[str]]:
    """Les colonnes déclarées par les CREATE TABLE du dump de production."""
    reel: dict[tuple[str, str], list[str]] = {}
    for sch, tab, corps in re.findall(
        r'CREATE TABLE IF NOT EXISTS "(\w+)"\."(\w+)" \((.*?)\n\);', sql, re.S
    ):
        reel[(sch, tab)] = re.findall(r'^\s+"([\w]+)"\s', corps, re.M)
    return reel


def derniere_migration() -> Path:
    fichiers = sorted(MIGRATIONS.glob("*_remote_schema.sql"))
    if not fichiers:
        raise SystemExit(f"Aucune migration *_remote_schema.sql dans {MIGRATIONS}")
    return fichiers[-1]


def comparer(reel, classif) -> list[str]:
    ecarts: list[str] = []
    vus: set[tuple[str, str]] = set()
    for t in classif["tables"]:
        cle = (t["schema"], t["table"])
        vus.add(cle)
        if cle not in reel:
            ecarts.append("table classée absente du schéma : {}.{}".format(*cle))
            continue
        attendues = set(reel[cle])
        classees = {c["nom"] for c in t["colonnes"]}
        for c in sorted(classees - attendues):
            ecarts.append("colonne classée inexistante : {}.{}.{}".format(*cle, c))
        for c in sorted(attendues - classees):
            ecarts.append("COLONNE NON CLASSÉE (serait chargée telle quelle) : {}.{}.{}".format(*cle, c))
    for cle in sorted(reel.keys() - vus):
        ecarts.append("TABLE NON CLASSÉE (serait chargée telle quelle) : {}.{}".format(*cle))
    return ecarts


def redaction(classif) -> str:
    lignes = [
        "# Anonymisation — ce qui est protégé, et ce qui ne l'est pas",
        "",
        "> Fichier **généré** par `verifier_classification.py --ecrire` à partir de",
        "> `classification.json`. Ne pas le modifier à la main : il serait aussitôt",
        "> écrasé, et surtout il cesserait de dire la vérité.",
        "",
        "> **08/09/2026 — la pseudonymisation du projet de développement est levée.**",
        "> Sur décision du dirigeant, le dev est une capture de données réelles à un",
        "> instant t : il porte désormais des données personnelles réelles.",
        "> `restaurer_reel.py` a réécrit dans le dev les valeurs lues en production.",
        "> Ce document ne décrit plus l'état du dev, mais le **mode anonymisé de",
        "> `peupler_dev.py`** — la protection qui s'appliquerait si le dev était",
        "> repeuplé par lui.",
        "",
        "## La règle",
        "",
        classif["regle"],
        "",
        "**Clé de substitution : {}.**".format(classif["cle_de_substitution"]),
        "",
        "Conséquence directe : `candidat.prenom`, `user.prenom` et",
        "`nps_tracking.candidate_firstname` reçoivent le même substitut pour la même",
        "personne, sans qu'aucune jointure soit nécessaire. C'est ce qui rend le jeu de",
        "développement cohérent d'un écran à l'autre.",
        "",
    ]
    total = sum(len(t["colonnes"]) for t in classif["tables"])
    par = {}
    for t in classif["tables"]:
        for c in t["colonnes"]:
            par[c["traitement"]] = par.get(c["traitement"], 0) + 1
    lignes += [
        "## Le compte",
        "",
        "| traitement | colonnes | part |",
        "|---|---:|---:|",
    ]
    for k in ("CONSERVER", "SUBSTITUER", "VIDER", "GENERALISER"):
        n = par.get(k, 0)
        lignes.append(f"| `{k}` | {n} | {100 * n / total:.1f} % |")
    lignes += [
        f"| **total** | **{total}** | |",
        "",
        f"Soit **{total - par.get('CONSERVER', 0)} colonnes touchées** sur {total}, "
        f"réparties dans {len(classif['tables'])} tables.",
        "",
        "## Le détail, table par table",
        "",
        "Seules les colonnes touchées sont listées. Toutes les autres sont conservées",
        "telles quelles — leur absence ici est donc une affirmation, pas un oubli.",
        "",
    ]
    for t in sorted(classif["tables"], key=lambda x: (x["schema"], x["table"])):
        touchees = [c for c in t["colonnes"] if c["traitement"] in TOUCHE]
        if not touchees:
            continue
        lignes += ["### `{}.{}`".format(t["schema"], t["table"]), "",
                   "| colonne | traitement | pourquoi |", "|---|---|---|"]
        for c in touchees:
            raison = (c["raison"] or c["contrainte"] or "").replace("|", "/").strip()
            lignes.append("| `{}` | {} | {} |".format(c["nom"], c["traitement"], raison))
        lignes.append("")
    lignes += [
        "## Ce que cette classification ne couvre pas",
        "",
        "**Le référentiel des comptes.** `auth.users` n'appartient à aucun des deux",
        "schémas et n'est pas chargé. Le projet de développement démarre donc sans aucun",
        "compte — c'est le travail du jalon 2 d'en créer.",
        "",
        "**Les fichiers.** Les URL de CV, de photo et de portfolio sont remplacées par",
        "des adresses factices, mais les fichiers eux-mêmes vivent dans le Storage du",
        "projet de production et ne sont pas copiés.",
        "",
        "**Les quasi-identifiants conservés.** Séniorité, expertises, secteurs et",
        "statut de process restent réels et rattachés à une même ligne. Sur un vivier de",
        "30 829 personnes, un profil rare reste recoupable. Il s'agit donc d'une",
        "**pseudonymisation**, pas d'une anonymisation au sens du RGPD, et il ne faut pas",
        "écrire le contraire.",
        "",
    ]
    return "\n".join(lignes) + "\n"


def main() -> int:
    mig = derniere_migration()
    reel = schema_reel(mig.read_text())
    classif = json.loads(CLASSIFICATION.read_text())

    print(f"schéma de référence : {mig.name}")
    print(f"  {len(reel)} tables, {sum(len(v) for v in reel.values())} colonnes")
    print(f"classification      : {CLASSIFICATION.name}")
    n_col = sum(len(t["colonnes"]) for t in classif["tables"])
    print(f"  {len(classif['tables'])} tables, {n_col} colonnes")

    ecarts = comparer(reel, classif)
    if ecarts:
        print(f"\n{len(ecarts)} ÉCART(S) — la classification ne décrit pas le schéma :")
        for e in ecarts[:40]:
            print("   " + e)
        if len(ecarts) > 40:
            print(f"   … et {len(ecarts) - 40} autres")
        return 2

    touchees = sum(1 for t in classif["tables"] for c in t["colonnes"]
                   if c["traitement"] in TOUCHE)
    print(f"\nAUCUN ÉCART. {touchees} colonnes touchées, {n_col - touchees} conservées.")

    if "--ecrire" in sys.argv:
        LISIBLE.write_text(redaction(classif))
        print(f"{LISIBLE.name} régénéré.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
