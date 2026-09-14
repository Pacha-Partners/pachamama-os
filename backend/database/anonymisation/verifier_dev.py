#!/usr/bin/env python3
"""Contrôle le projet de développement contre la production. LECTURE SEULE.

    PYTHONPATH=backend/api/src backend/api/.venv/bin/python \
        backend/database/anonymisation/verifier_dev.py
        ... verifier_dev.py --complet     # + liens, nullité, fourchettes, vues
        ... verifier_dev.py --anonymat    # + la recherche de vraies valeurs

LA RECHERCHE DE VRAIES VALEURS NE TOURNE PLUS PAR DÉFAUT — 08/09/2026.
Sur décision du dirigeant, la pseudonymisation du dev a été levée : le dev est
une capture de données RÉELLES à un instant t (voir
`backend/database/anonymisation/restaurer_reel.py`). Le contrôle 1 cherche des
valeurs de production dans le dev et compte chaque trouvaille comme une fuite :
il en signalerait maintenant environ 480, toutes attendues. Un contrôle qui
échoue toujours cesse d'être lu, et emporte les autres avec lui — il est donc
passé en opt-in. `--anonymat` le rallume, pour le jour où le dev sera repeuplé
en mode anonymisé par `peupler_dev.py`, où il redevient l'essentiel.

Les autres contrôles gardent toute leur valeur, et c'est pour eux que ce
programme existe encore.

1. **Le dev contient-il des vraies valeurs ?** (`--anonymat` seulement)
   On prend des valeurs réelles en production et on les cherche dans le dev. Un
   résultat vide ne prouve rien en soi : un témoin vérifie d'abord que la
   recherche rend bien des lignes.
2. **Le dev est-il complet ?** Comptage table par table. Un écart sur une table
   alimentée par la synchro est normal — la production a continué d'écrire.
3. **Le dev est-il exploitable ?** Le nombre de valeurs distinctes. Une base
   plate ne prouve rien sur un écran qui filtre ou regroupe.
Et avec `--complet` : l'intégrité des 52 liens que la base ne contrôle pas, la
nullité, l'ordre des fourchettes de salaire, la réponse des vues du pivot.

Sortie 0 si tout va, 2 si un manque est trouvé.
"""

from __future__ import annotations

import json
import sys
import urllib.parse
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
sys.path.insert(0, str(ICI.parents[2] / "backend" / "api" / "src"))

import substituts as sub  # noqa: E402

from pachamama_api.connecteurs import commun  # noqa: E402

ORDRE = json.loads((ICI / "ordre_chargement.json").read_text())
CLASSIFICATION = json.loads((ICI / "classification.json").read_text())
LIENS = [
    tuple(x) for x in json.loads((ICI / "liens_non_declares.json").read_text())
    # une table qui « se référence elle-même » par sa propre clé primaire est un
    # faux positif de la détection par nom de colonne
    if x[2] != f"{x[1]}_id" or x[1] != x[3]
]

# Fourchettes dont l'ordre doit survivre à la généralisation par tranches.
FOURCHETTES = [
    ("public", "candidat", "salaire_min_souhait", "salaire_max_souhait"),
    ("public", "candidat", "tjm_min_souhait", "tjm_max_souhait"),
    ("public", "job_reve", "salaire", "salaire_maximum"),
    ("public", "job_reve", "tjm_minimum", "tjm_maximum"),
    ("public", "process", "salaire_minimum", "salaire_souhaite"),
]

VUES_PIVOT = ["talent_recherche", "qa_completude", "qa_sans_contact",
              "qa_multi_source", "qa_emails_generiques", "qa_preseance_suspecte",
              "qa_sans_identite"]

# Colonnes dont une valeur réelle ne doit JAMAIS se retrouver dans le dev.
# NB : on ne sonde PAS un prénom seul, et ce n'est pas un relâchement.
# L'engagement du programme porte sur le COUPLE prénom+nom, seule unité qui
# identifie quelqu'un. La production porte 6 915 prénoms distincts pour 30 000
# personnes : purger les prénoms n'en laisserait que 6 sur 119, et un prénom
# isolé ne désigne personne. Le couple, lui, est vérifié par `sonder_couples`.
SONDES = [
    ("public", "candidat", "nom"),
    ("public", "candidat", "email_perso"),
    ("public", "candidat", "telephone"),
    ("public", "candidat", "linkedin"),
    ("public", "user", "nom"),
    ("public", "equipe", "email"),
    ("public", "business_maker", "email"),
    ("pivot", "talent", "nom"),
    ("pivot", "talent", "url_linkedin"),
    ("pivot", "talent", "employeur_actuel"),
    ("pivot", "email", "email"),
    ("pivot", "phone", "tel"),
]

VARIETE = [
    ("pivot", "talent", ["prenom", "nom"], "talent_id", "couples prénom+nom"),
    ("pivot", "talent", ["employeur_actuel"], "talent_id", "employeurs"),
    ("pivot", "talent", ["headline"], "talent_id", "intitulés"),
    ("public", "candidat", ["email_perso"], "id", "courriels de candidat"),
]

PAR_SONDE = 40


def acces_dev() -> tuple[str, str]:
    env: dict[str, str] = {}
    for f in (ICI.parents[2] / ".env.local", ICI.parents[2] / ".env"):
        if f.exists():
            for ligne in f.read_text().splitlines():
                ligne = ligne.strip()
                if ligne and not ligne.startswith("#") and "=" in ligne:
                    k, v = ligne.split("=", 1)
                    env.setdefault(k.strip(), v.strip().strip("\"'"))
    url, cle = env.get("SUPABASE_DEV_URL", ""), env.get("SUPABASE_DEV_SERVICE_ROLE_KEY", "")
    if not url or not cle:
        raise commun.Incident("SUPABASE_DEV_URL / SUPABASE_DEV_SERVICE_ROLE_KEY absentes")
    return url.rstrip("/"), cle


def distincts(acces, schema, table, colonnes, tri) -> tuple[int, int]:
    lignes = commun.lire_tout(
        f"{table}?select={','.join(colonnes)}", tri=tri, profil=schema, acces=acces
    )
    vus = {
        "|".join(sub.normaliser(str(ligne.get(c) or "")) for c in colonnes)
        for ligne in lignes
    }
    vus.discard("|".join([""] * len(colonnes)))
    return len(lignes), len(vus)


def sonder_couples(prod, dev, combien: int = 200) -> list[str]:
    """Aucun couple prénom+nom réel ne doit exister dans le dev.

    C'est l'engagement précis du programme, et donc le seul contrôle qui a du
    sens : ni le prénom ni le nom pris séparément ne sont garantis absents —
    ils sont trop peu distinctifs pour l'être, et le mesurer a montré qu'exiger
    leur absence rendait toute substitution plausible impossible.
    """
    reels, _ = commun.appeler(
        f"talent?select=prenom,nom&prenom=not.is.null&nom=not.is.null&limit={combien}",
        profil="pivot", acces=prod,
    )
    fuites = []
    for r in reels:
        p, n = urllib.parse.quote(r["prenom"], safe=""), urllib.parse.quote(r["nom"], safe="")
        res, _ = commun.appeler(
            f"talent?select=talent_id&prenom=eq.{p}&nom=eq.{n}&limit=1",
            profil="pivot", acces=dev,
        )
        if res:
            fuites.append(f"{r['prenom']} {r['nom']}")
    print(f"   couples prénom+nom : {len(reels)} cherchés -> "
          f"{'aucun' if not fuites else 'FUITE : ' + ', '.join(fuites[:3])}")
    return fuites


def colonne(acces, schema, table, col) -> list:
    lignes = commun.lire_tout(
        f"{table}?select={col}", tri=col, profil=schema, acces=acces)
    return [ligne.get(col) for ligne in lignes]


def orphelins(acces, cache: dict, schema, table, col, cible) -> int:
    """Combien de valeurs pointent sur une ligne qui n'existe pas."""
    cle = (schema, cible)
    if cle not in cache:
        cache[cle] = set(colonne(acces, schema, cible, "id"))
    connus = cache[cle]
    return sum(1 for v in colonne(acces, schema, table, col) if v is not None and v not in connus)


def controler_integrite(prod, dev, echecs: list[str]) -> None:
    """Les 52 liens que la base ne contrôle pas.

    Beaucoup de colonnes *_id n'ont aucune contrainte de clé étrangère : un
    chargement dans le mauvais ordre, ou une substitution mal placée, aurait
    cassé ces liens SANS que PostgreSQL bronche. C'est donc le seul contrôle
    qui puisse l'établir — et il compare au réel, parce que la production
    porte déjà des orphelins qu'il ne faut pas confondre avec une casse.
    """
    print("4. LES LIENS QUE LA BASE NE CONTRÔLE PAS\n")
    cp: dict = {}
    cd: dict = {}
    pires = []
    for schema, table, col, cible in LIENS:
        op = orphelins(prod, cp, schema, table, col, cible)
        od = orphelins(dev, cd, schema, table, col, cible)
        if od != op:
            pires.append(f"{schema}.{table}.{col} -> {cible} : prod {op}, dev {od}")
    print(f"   {len(LIENS)} liens vérifiés")
    if pires:
        for x in pires:
            print("      " + x)
        echecs.extend(f"lien cassé par le chargement : {x}" for x in pires)
    else:
        print("   aucun écart : le dev porte exactement les mêmes orphelins que la production\n")


def controler_nullite(prod, dev, echecs: list[str], derive: dict[str, int]) -> None:
    """La nullité est une information : `qa_completude` compte les CV manquants."""
    print("5. LA NULLITÉ EST-ELLE PRÉSERVÉE ?\n")
    surveillees = [
        ("pivot", "talent", c) for c in
        ("prenom", "nom", "headline", "url_linkedin", "employeur_actuel", "cv_url")
    ] + [("public", "candidat", c) for c in ("telephone", "linkedin", "email_perso", "photo_url")]
    ecarts = []
    for schema, table, col in surveillees:
        tp = commun.total(f"{table}?{col}=is.null", profil=schema, acces=prod)
        td = commun.total(f"{table}?{col}=is.null", profil=schema, acces=dev)
        toleré = abs(derive.get(f"{schema}.{table}", 0))
        ecart = abs(tp - td)
        marque = "" if ecart == 0 else (
            f"   (dérive, ±{toleré} lignes)" if ecart <= toleré else "   <-- ÉCART RÉEL")
        print(f"   {schema}.{table}.{col:18} nuls : prod {tp:6}  dev {td:6}{marque}")
        if ecart > toleré:
            ecarts.append(
                f"{schema}.{table}.{col} : {tp} nuls en prod, {td} dans le dev — "
                f"écart de {ecart} pour une dérive de {toleré} lignes")
    echecs.extend(f"nullité non préservée — {e}" for e in ecarts)
    print()


def inversees(acces, schema: str, table: str, bas: str, haut: str) -> int:
    """Combien de lignes ont bas > haut.

    PostgREST ne sait pas comparer deux COLONNES entre elles : un filtre `gt.`
    attend une valeur littérale, pas un nom de colonne — il rend 400. On lit
    donc les deux colonnes et on compare ici.
    """
    lignes = commun.lire_tout(
        f"{table}?select={bas},{haut}&{bas}=not.is.null&{haut}=not.is.null",
        tri=bas, profil=schema, acces=acces,
    )
    return sum(1 for x in lignes if x[bas] > x[haut])


def controler_fourchettes(prod, dev, echecs: list[str]) -> None:
    """La généralisation par tranches doit préserver l'ordre : min <= max.

    `tranche` arrondit au pas inférieur, ce qui préserve l'ordre en théorie.
    On le vérifie sur les données, parce qu'une théorie ne compte pas les lignes.
    La production porte déjà des fourchettes inversées : on compare, on n'exige
    pas zéro.
    """
    print("6. LES FOURCHETTES RESTENT-ELLES DANS L'ORDRE ?\n")
    for schema, table, bas, haut in FOURCHETTES:
        n_prod = inversees(prod, schema, table, bas, haut)
        n_dev = inversees(dev, schema, table, bas, haut)
        marque = "" if n_dev <= n_prod else "   <-- l'ordre a été cassé"
        print(f"   {table}.{bas} > {haut:22} prod {n_prod:5}   dev {n_dev:5}{marque}")
        if n_dev > n_prod:
            echecs.append(
                f"{table} : {n_dev} fourchettes inversées dans le dev contre "
                f"{n_prod} en production — la mise en tranches a cassé l'ordre"
            )
    print()


def controler_vues(dev, echecs: list[str]) -> None:
    print("7. LES VUES DU PIVOT RÉPONDENT-ELLES ?\n")
    for vue in VUES_PIVOT:
        try:
            n = commun.total(vue, profil="pivot", acces=dev)
            print(f"   pivot.{vue:24} {n:6} lignes")
        except Exception as e:
            print(f"   pivot.{vue:24} ÉCHEC : {e}")
            echecs.append(f"la vue pivot.{vue} ne répond pas")
    print()


def controler_anonymat(prod, dev, echecs: list[str]) -> None:
    """La recherche de vraies valeurs — hors service depuis la levée du 08/09/2026.

    Conservée intacte, et sortie du chemin par défaut : elle redevient le
    contrôle le plus important le jour où `peupler_dev.py` repeuple un dev
    anonymisé, et il serait absurde de la réécrire ce jour-là.
    """
    print("1. LE DEV CONTIENT-IL DES VRAIES VALEURS ?\n")
    temoin, _ = commun.appeler("candidat?select=nom&limit=3", profil="public", acces=dev)
    if not temoin:
        raise commun.Incident(
            "le témoin ne rend aucune ligne : la recherche dans le dev ne fonctionne "
            "pas, et un résultat vide ne prouverait donc rien"
        )
    print(f"   témoin : la recherche rend bien des lignes ({len(temoin)})\n")

    cherchees = trouvees = 0
    for schema, table, colonne in SONDES:
        reels, _ = commun.appeler(
            f"{table}?select={colonne}&{colonne}=not.is.null&limit={PAR_SONDE * 2}",
            profil=schema, acces=prod,
        )
        valeurs = [r[colonne] for r in reels if r.get(colonne)][:PAR_SONDE]
        fuites = []
        for v in valeurs:
            q = urllib.parse.quote(str(v), safe="")
            res, _ = commun.appeler(
                f"{table}?select={colonne}&{colonne}=eq.{q}&limit=1", profil=schema, acces=dev
            )
            if res:
                fuites.append(v)
        cherchees += len(valeurs)
        trouvees += len(fuites)
        etat = "aucune" if not fuites else "FUITE : " + ", ".join(str(x)[:28] for x in fuites[:3])
        print(f"   {schema}.{table}.{colonne:16} {len(valeurs):3} cherchées -> {etat}")
        if fuites:
            echecs.append(f"{schema}.{table}.{colonne} : {len(fuites)} vraies valeurs retrouvées")
    couples = sonder_couples(prod, dev)
    cherchees += 200
    trouvees += len(couples)
    if couples:
        echecs.append(f"{len(couples)} couples prénom+nom réels retrouvés dans le dev")
    print(f"\n   {cherchees} vraies valeurs cherchées, {trouvees} retrouvées\n")


def main() -> int:
    prod, dev = commun.acces_supabase(), acces_dev()
    if prod[0].rstrip("/") == dev[0].rstrip("/"):
        raise commun.Incident("production et dev désignent le même projet")
    echecs: list[str] = []

    if "--anonymat" in sys.argv:
        controler_anonymat(prod, dev, echecs)
    else:
        print("1. LE DEV CONTIENT-IL DES VRAIES VALEURS ?\n")
        print("   SAUTÉ. Depuis le 08/09/2026 la pseudonymisation du dev est levée : le")
        print("   dev porte des données personnelles réelles, par décision du dirigeant.")
        print("   Ce contrôle signalerait donc ~480 fuites, toutes attendues.")
        print("   `--anonymat` le rallume — utile après un repeuplement anonymisé.\n")

    derive: dict[str, int] = {}
    print("2. LE DEV EST-IL COMPLET ?\n")
    print("   Le dev est un instantané ; la synchro n8n écrit dans la production")
    print("   toutes les 15 minutes. Un écart n'est donc pas une casse tant que le")
    print("   dev n'a pas PLUS de lignes, et qu'aucune table peuplée n'est vide.\n")
    sans = set(ORDRE["tables_sans_donnees"])
    tp = td = 0
    ecarts = []
    for qualifie in ORDRE["ordre"]:
        schema, table = qualifie.split(".", 1)
        p = commun.total(table, profil=schema, acces=prod)
        d = commun.total(table, profil=schema, acces=dev)
        if qualifie in sans:
            if d:
                echecs.append(f"{qualifie} : {d} lignes alors qu'elle ne doit pas être chargée")
            continue
        tp += p
        td += d
        if p != d:
            derive[qualifie] = p - d
            ecarts.append(f"{qualifie:34} prod {p:6}  dev {d:6}  ({d - p:+})")
        if p and not d:
            echecs.append(f"{qualifie} : peuplée en production, vide dans le dev")
        elif d > p:
            echecs.append(
                f"{qualifie} : le dev porte {d - p} lignes de PLUS que la production — "
                "la dérive ne peut pas expliquer cela")
    print(f"   production {tp}   dev {td}   dérive {td - tp:+} lignes")
    print(f"   tables ayant dérivé : {len(ecarts)}")
    for e in ecarts[:15]:
        print("      " + e)
    print()

    print("3. LE DEV EST-IL EXPLOITABLE ?\n")
    for schema, table, colonnes, tri, titre in VARIETE:
        _, dp = distincts(prod, schema, table, colonnes, tri)
        _nd, dd = distincts(dev, schema, table, colonnes, tri)
        part = 100 * dd / dp if dp else 0
        alerte = "  <-- trop plat" if part < 10 else ""
        print(f"   {titre:24} production {dp:6} distincts   dev {dd:6}  ({part:5.1f} %){alerte}")
        if part < 10:
            echecs.append(f"{titre} : {dd} valeurs distinctes seulement ({part:.1f} % du réel)")
    print()

    if "--complet" in sys.argv:
        controler_integrite(prod, dev, echecs)
        controler_nullite(prod, dev, echecs, derive)
        controler_fourchettes(prod, dev, echecs)
        controler_vues(dev, echecs)
    else:
        print("   (--complet ajoute l'intégrité des liens, la nullité, les "
              "fourchettes et les vues)\n")

    if echecs:
        print(f"{len(echecs)} PROBLÈME(S) :")
        for e in echecs:
            print("   " + e)
        return 2
    print("Aucun problème : comptes conformes, variété suffisante"
          + (", aucune vraie valeur retrouvée." if "--anonymat" in sys.argv
             else " (anonymat non contrôlé — le dev porte des données réelles)."))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except commun.Incident as e:
        print(f"\nARRÊT : {e}", file=sys.stderr)
        raise SystemExit(2) from e
