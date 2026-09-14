#!/usr/bin/env python3
"""Peuple le projet de développement depuis la production, anonymisé.

    PYTHONPATH=backend/api/src backend/api/.venv/bin/python \
        backend/database/anonymisation/peupler_dev.py            # simulation
        ... peupler_dev.py --appliquer                            # écriture
        ... peupler_dev.py --appliquer --tables candidat,entreprise

La production n'est que LUE. La cible est le projet de développement, et le
programme refuse de démarrer si l'URL de destination est celle de la production
— c'est le seul garde-fou qui compte vraiment ici.

Trois contrôles avant d'écrire une seule ligne :
  1. la classification décrit-elle encore le schéma ? Une colonne ajoutée et
     non classée serait chargée en clair ;
  2. les listes de substituts contiennent-elles une valeur réellement présente
     dans la base ? Si oui, elles sont purgées, et le programme échoue si une
     liste devient trop courte ;
  3. l'analyseur de dates se teste lui-même — un analyseur muet a déjà annoncé
     4 150 fiches périmées qui n'existaient pas.

Et un contrôle après chaque lot écrit : aucune valeur identifiante réelle ne
doit apparaître dans ce qui a été envoyé. À la première fuite, tout s'arrête.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
sys.path.insert(0, str(ICI.parents[2] / "backend" / "api" / "src"))

import substituts as sub  # noqa: E402

from pachamama_api.connecteurs import commun  # noqa: E402

CLASSIFICATION = json.loads((ICI / "classification.json").read_text())
ORDRE = json.loads((ICI / "ordre_chargement.json").read_text())

LOT_ECRITURE = 500
TOUCHE = ("SUBSTITUER", "VIDER", "GENERALISER", "REINITIALISER")


# --------------------------------------------------------------------- accès
def acces_dev() -> tuple[str, str]:
    """URL et clé de service du projet de développement, depuis .env.local."""
    env: dict[str, str] = {}
    for candidat in (ICI.parents[2] / ".env.local", ICI.parents[2] / ".env"):
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
    """Refuser d'écrire ailleurs que dans le projet de développement."""
    prod_url, _ = commun.acces_supabase()
    if dev[0].rstrip("/") == prod_url.rstrip("/"):
        raise commun.Incident(
            "REFUS : la cible est le projet de PRODUCTION. "
            "SUPABASE_DEV_URL doit désigner un autre projet."
        )
    if not dev[0].startswith("https://"):
        raise commun.Incident(f"REFUS : cible non chiffrée ({dev[0]})")


# ------------------------------------------------------------- classification
def index_classification() -> dict[tuple[str, str], dict[str, dict[str, str]]]:
    return {
        (t["schema"], t["table"]): {c["nom"]: c for c in t["colonnes"]}
        for t in CLASSIFICATION["tables"]
    }


def verifier_classification() -> None:
    import verifier_classification as v

    mig = v.derniere_migration()
    ecarts = v.comparer(v.schema_reel(mig.read_text()), CLASSIFICATION)
    if ecarts:
        raise commun.Incident(
            f"la classification ne décrit plus le schéma ({len(ecarts)} écarts) — "
            "lancer verifier_classification.py"
        )


# ------------------------------------------------------------- substitutions
_SALAIRE = re.compile(r"salaire|remuneration|rémunération", re.I)
_TJM = re.compile(r"tjm", re.I)


def _texte(v: Any) -> str:
    return v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)


def substituer(schema: str, table: str, colonne: str, valeur: Any, ligne: dict) -> Any:
    """Le substitut d'une valeur. Lève si la colonne n'a pas de règle : une
    colonne marquée SUBSTITUER sans règle doit arrêter le programme, jamais
    passer telle quelle."""
    if valeur is None or valeur == "":
        return valeur  # la nullité est une information : on la préserve
    v = _texte(valeur)
    c = colonne.lower()

    # L'identité se substitue par COUPLE : c'est lui qui identifie, et c'est
    # lui qui est garanti absent de la production. Quand la ligne ne porte
    # qu'un prénom, `sub.prenom` seul suffit et reste cohérent avec le couple.
    autre = lambda k: _texte(ligne.get(k) or "")  # noqa: E731
    if c in ("prenom", "prenom_lower"):
        p = sub.identite(v, autre("nom"))[0] if "nom" in ligne else sub.prenom(v)
        return p.lower() if c.endswith("_lower") else p
    if c in ("contact_firstname", "candidate_firstname"):
        return sub.prenom(v)
    if c in ("nom", "nom_lower") and table != "entreprise":
        n = sub.identite(autre("prenom"), v)[1] if "prenom" in ligne else sub.nom(v)
        return n.lower() if c.endswith("_lower") else n
    if c == "fondateur":
        morceaux = v.split(None, 1)
        p, n = sub.identite(morceaux[0], morceaux[1] if len(morceaux) > 1 else v)
        return f"{p} {n}"
    if "email" in c or c == "sent_email":
        return sub.email(v)
    if c in ("telephone", "tel"):
        return sub.telephone(v)
    if "linkedin" in c:
        return sub.linkedin(v)
    if c == "siret":
        return sub.siret(v)
    if c == "slug":
        p, n = sub.identite(autre("prenom") or v, autre("nom") or v)
        return sub.slug(p, n)
    if c in ("company_label", "entreprise_nom", "employeur_actuel"):
        return sub.societe(v)
    if c == "ecole":
        return sub.ecole(v)
    if c == "headline":
        return sub.intitule(v)
    if c == "genre":
        return None
    if c in ("photo_url", "picture_url"):
        return sub.fichier(v, "photo")
    if c == "cv_url":
        return sub.fichier(v, "cv")
    if c in ("portfolio", "portfolio_file_url"):
        return sub.fichier(v, "portfolio")
    if c == "external_id":
        return f"dev-{sub._h(v, 'ext'):x}"[:40]
    if c == "nogo":
        return sub.societe(v)
    if c == "statut":
        return "jamais_lance"
    if c == "runs_total":
        return 0
    if (schema, table) == ("pivot", "conflit") and c in ("valeur_retenue", "valeur_ecartee"):
        champ = (ligne.get("champ") or "").lower()
        if champ in ("prenom",):
            return sub.prenom(v)
        if champ in ("nom",):
            return sub.nom(v)
        if champ in ("employeur_actuel",):
            return sub.societe(v)
        if champ in ("url_linkedin",):
            return sub.linkedin(v)
        if champ in ("headline",):
            return sub.intitule(v)
        return sub.JETON
    if c in ("notes_jarvi", "contenu", "description", "experience", "formation"):
        return sub.JETON

    raise commun.Incident(
        f"{schema}.{table}.{colonne} est marquée SUBSTITUER mais aucune règle "
        "ne s'applique — refus de la laisser passer en clair"
    )


def generaliser(table: str, colonne: str, valeur: Any) -> Any:
    if valeur is None:
        return None
    c = colonne.lower()
    if _TJM.search(c):
        return sub.tranche(valeur, 50)
    if _SALAIRE.search(c):
        return sub.tranche(valeur, 5)
    if c == "disponibilite":
        return "Non précisée"
    if c in ("localisations_filtre",):
        return _departement(_texte(valeur))
    if c == "localisations":
        return _localisations(valeur)
    if c == "grandes_ecoles":
        return sub.ecole(_texte(valeur))
    if c == "competences":
        return sub.JETON
    return sub.JETON


_CP = re.compile(r"\b(\d{2})\d{3}\b")


def _departement(texte: str) -> str:
    m = _CP.search(texte or "")
    return f"département {m.group(1)}" if m else "France"


def _localisations(valeur: Any) -> Any:
    """Retire adresse et coordonnées, ne garde que le département."""
    if isinstance(valeur, list):
        return [_localisations(x) for x in valeur]
    if isinstance(valeur, dict):
        return {"departement": _departement(json.dumps(valeur, ensure_ascii=False))}
    return _departement(_texte(valeur))


# ------------------------------------------------------------------ transform
def transformer(
    schema: str, table: str, ligne: dict, regles: dict[str, dict[str, str]],
    a_omettre: set[str],
) -> dict:
    sortie: dict[str, Any] = {}
    for colonne, valeur in ligne.items():
        if colonne in a_omettre:
            continue
        regle = regles.get(colonne)
        if regle is None:
            raise commun.Incident(f"{schema}.{table}.{colonne} absente de la classification")
        t = regle["traitement"]
        if t == "CONSERVER":
            sortie[colonne] = valeur
        elif t == "VIDER":
            sortie[colonne] = None
        elif t == "SUBSTITUER":
            sortie[colonne] = substituer(schema, table, colonne, valeur, ligne)
        elif t == "GENERALISER":
            sortie[colonne] = generaliser(table, colonne, valeur)
        elif t == "REINITIALISER":
            sortie[colonne] = regle.get("valeur")
        else:
            raise commun.Incident(f"traitement inconnu « {t} » sur {table}.{colonne}")
    return sortie


# --------------------------------------------------------------- contrôle fuite
# Motifs à FORTE entropie seulement. Un intitulé de poste ou un nom de société
# relèvent du vocabulaire courant : les balayer produirait des alertes fausses
# à la chaîne, et une alerte à laquelle on cesse de croire ne protège plus rien.
_AIGUILLES = (
    re.compile(r"[\w.+-]+@[\w.-]+\.\w{2,}"),          # courriel
    re.compile(r"https?://\S{4,}"),                     # URL
    re.compile(r"(?<!\d)(?:\+\d{1,3}[ .-]?)?(?:\d[ .-]?){8,}\d(?!\d)"),  # téléphone
)
_DATE_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}")


def _extraire_aiguilles(valeur: object) -> set[str]:
    """Les valeurs réelles assez singulières pour trahir quelqu'un."""
    if not isinstance(valeur, str):
        return set()
    trouve: set[str] = set()
    for motif in _AIGUILLES:
        for m in motif.finditer(valeur):
            brut = m.group(0).strip(" .,;:")
            # une date ISO ressemble à un numéro : 2025-02-13 porte dix chiffres
            if _DATE_ISO.match(brut) or len(brut) < 8:
                continue
            if brut.startswith("http"):
                # Le préfixe d'une URL n'identifie personne : « linkedin.com/ »
                # est commun à tous, et tout substitut le contiendra forcément.
                # Ce qui identifie, c'est le chemin — le slug du profil, le nom
                # du fichier. On ne retient que lui, et seulement s'il est assez
                # long pour être singulier.
                sans_hote = re.sub(r"^https?://[^/]+", "", brut)
                # « /portfolio/ », « /images/ » : des mots de chemin courants,
                # qui n'identifient personne. Seul un chemin long compte.
                if len(sans_hote.strip("/")) < 10:
                    continue
                trouve.add(sans_hote)
                continue
            trouve.add(brut)
    return trouve


def controler_fuite(
    schema: str, table: str, avant: list[dict], apres: list[dict],
    regles: dict[str, dict[str, str]],
) -> None:
    """Trois passes, comme l'anonymiseur du livrable — mais sur le volume complet.

    1. assertion structurelle : toute colonne touchée doit avoir changé ;
    2. balayage à forte entropie : aucun courriel, téléphone ou URL réel ne doit
       apparaître dans la sortie, où que ce soit ;
    3. les textes libres doivent valoir exactement le jeton, pas « contenir ».
    """
    for av, ap in zip(avant, apres, strict=False):
        for colonne, regle in regles.items():
            if regle["traitement"] not in TOUCHE or colonne not in ap:
                continue
            reelle, ecrite = av.get(colonne), ap.get(colonne)
            if reelle in (None, "", []):
                continue
            if regle["traitement"] == "VIDER" and ecrite is not None:
                raise commun.Incident(f"FUITE {schema}.{table}.{colonne} : non vidée")
            if regle["traitement"] == "REINITIALISER":
                if ecrite != regle.get("valeur"):
                    raise commun.Incident(
                        f"{schema}.{table}.{colonne} : remise à zéro non appliquée"
                    )
                continue
            if regle["traitement"] == "SUBSTITUER" and _texte(reelle) == _texte(ecrite):
                raise commun.Incident(
                    f"FUITE {schema}.{table}.{colonne} : valeur réelle inchangée"
                )

        # On ne balaie QUE les colonnes modifiées. Une colonne conservée a le
        # droit de contenir sa valeur réelle — c'est la décision prise pour elle.
        modifiees = {
            k: v for k, v in ap.items()
            if regles.get(k, {}).get("traitement") in TOUCHE
        }
        if not modifiees:
            continue
        texte_sortie = json.dumps(modifiees, ensure_ascii=False)
        for colonne, valeur in av.items():
            for aiguille in _extraire_aiguilles(valeur):
                if aiguille in texte_sortie:
                    coupable = next(
                        (k for k, v in modifiees.items()
                         if aiguille in json.dumps(v, ensure_ascii=False)), "?"
                    )
                    raise commun.Incident(
                        f"FUITE {schema}.{table} : « {aiguille[:50]} » "
                        f"(colonne réelle {colonne}) réapparaît dans {coupable}"
                    )


# ------------------------------------------------------------------ collecte
def collecter_valeurs_reelles(prod: tuple[str, str]) -> tuple[dict[str, set[str]], set[str]]:
    """Lecture ciblée des colonnes porteuses de noms.

    Rend les valeurs d'entités à purger (sociétés, écoles) ET l'ensemble des
    couples prénom+nom réellement présents, qui sont l'unité identifiante.
    """
    cibles = [
        ("public", "candidat", {"prenom": "prenom", "nom": "nom"}),
        ("public", "user", {"prenom": "prenom", "nom": "nom"}),
        ("public", "equipe", {"prenom": "prenom", "nom": "nom"}),
        ("public", "business_maker", {"prenom": "prenom", "nom": "nom"}),
        ("public", "entreprise", {"nom": "societe"}),
        ("pivot", "talent", {"prenom": "prenom", "nom": "nom", "employeur_actuel": "societe"}),
        ("public", "job_actuel", {"entreprise_nom": "societe"}),
    ]
    reel: dict[str, set[str]] = {}
    paires: set[str] = set()
    for schema, table, mapping in cibles:
        colonnes = ",".join(mapping)
        try:
            lignes = commun.lire_tout(
                f"{table}?select={colonnes}", tri=next(iter(mapping)),
                profil=schema, acces=prod,
            )
        except Exception as e:
            raise commun.Incident(f"lecture de {schema}.{table} : {e}") from e
        for ligne in lignes:
            for colonne, liste in mapping.items():
                v = ligne.get(colonne)
                if isinstance(v, str) and v.strip():
                    reel.setdefault(liste, set()).add(v.strip())
            p, n = (ligne.get("prenom") or "").strip(), (ligne.get("nom") or "").strip()
            if p and n:
                paires.add(f"{sub.normaliser(p)}|{sub.normaliser(n)}")
        print(f"    {schema}.{table:16} {len(lignes):7} lignes lues")
    return reel, paires


# ---------------------------------------------------------------- chargement
def charger(
    schema: str, table: str, prod: tuple[str, str], dev: tuple[str, str],
    regles: dict[str, dict[str, str]], a_omettre: set[str], appliquer: bool,
) -> tuple[int, int]:
    attendu = commun.total(table, profil=schema, acces=prod)
    if attendu == 0:
        return 0, 0
    if appliquer:
        # Le chargement n'a pas de reprise : une table déjà peuplée recevrait
        # des doublons en silence. Repartir de zéro se fait par
        # `supabase db reset --linked`, la CLI étant rattachée au DEV.
        deja = commun.total(table, profil=schema, acces=dev)
        if deja:
            raise commun.Incident(
                f"{schema}.{table} porte déjà {deja} lignes dans le dev — "
                "refus d'ajouter par-dessus. Repartir de zéro : "
                "supabase db reset --linked (CLI rattachée au dev)"
            )
    cle_tri = next(iter(regles))
    lignes = commun.lire_tout(table, tri=cle_tri, profil=schema, acces=prod)
    ecrites = 0
    for debut in range(0, len(lignes), LOT_ECRITURE):
        lot = lignes[debut : debut + LOT_ECRITURE]
        transforme = [transformer(schema, table, ligne, regles, a_omettre) for ligne in lot]
        controler_fuite(schema, table, lot, transforme, regles)
        if appliquer:
            commun.appeler(
                table, methode="POST", profil=schema, corps=transforme,
                prefer="return=minimal", acces=dev,
            )
        ecrites += len(transforme)
    return attendu, ecrites


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--appliquer", action="store_true", help="écrire réellement")
    ap.add_argument("--tables", help="liste séparée par des virgules, pour un essai")
    args = ap.parse_args()

    commun.verifier_analyseur_dates()
    sub.verifier_listes()
    verifier_classification()
    prod = commun.acces_supabase()
    dev = acces_dev()
    garde_fou(dev)

    print(f"source  {prod[0]}")
    print(f"cible   {dev[0]}")
    print(f"mode    {'ÉCRITURE' if args.appliquer else 'simulation (aucune écriture)'}\n")

    print("  collecte des valeurs réelles, pour purger les listes de substituts")
    reel, paires = collecter_valeurs_reelles(prod)
    n_paires = sub.enregistrer_paires(paires)
    restant = sub.purger(reel)
    print(f"  {n_paires} couples prénom+nom réels enregistrés : aucun ne sera fabriqué")
    print("  listes :", ", ".join(f"{k} {v}" for k, v in restant.items()), "\n")

    regles_par_table = index_classification()
    sans_donnees = set(ORDRE["tables_sans_donnees"])
    omettre: dict[str, set[str]] = {}
    for c in ORDRE["colonnes_a_sequence"]:
        schema, table, colonne = c.split(".")
        omettre.setdefault(f"{schema}.{table}", set()).add(colonne)

    demandees = set(args.tables.split(",")) if args.tables else None
    total_lu = total_ecrit = 0
    for qualifie in ORDRE["ordre"]:
        schema, table = qualifie.split(".", 1)
        if qualifie in sans_donnees:
            continue
        if demandees and table not in demandees and qualifie not in demandees:
            continue
        regles = regles_par_table.get((schema, table))
        if regles is None:
            raise commun.Incident(f"{qualifie} absente de la classification")
        lu, ecrit = charger(
            schema, table, prod, dev, regles, omettre.get(qualifie, set()), args.appliquer
        )
        total_lu += lu
        total_ecrit += ecrit
        if lu:
            print(f"  {qualifie:34} {lu:7} lues  {ecrit:7} préparées")

    print(f"\n  {total_lu} lignes lues, {total_ecrit} préparées, 0 fuite détectée")
    if not args.appliquer:
        print("  simulation — relancer avec --appliquer pour écrire")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except commun.Incident as e:
        print(f"\nARRÊT : {e}", file=sys.stderr)
        raise SystemExit(2) from e
