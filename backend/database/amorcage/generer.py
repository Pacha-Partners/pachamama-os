#!/usr/bin/env python3
"""Génère le SQL d'amorçage des référentiels depuis la production.

Produit trois choses, dans cet ordre :
  1. les 13 tables de ref (dont 2 RECONSTRUITES, leur source étant détruite) ;
  2. ref.libelle — la présentation des 28 types énumérés ;
  3. ref.correspondance — la trace « ce libellé Bubble est devenu ce code »,
     qui rend la reprise vérifiable et qui est la seule preuve d'audit une
     fois Bubble éteint.

Le script LIT la production et n'y écrit jamais.
"""
import json
import os
import re
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from slug import separer_emoji, slug, slug_unique  # noqa: E402

U = os.environ["PACHA_LIVE_URL"]
K = os.environ["PACHA_LIVE_SERVICE_ROLE_KEY"]


def lire(table, select="*", ordre=None):
    out, pas, debut = [], 1000, 0
    while True:
        url = f"{U}/rest/v1/{table}?select={select}"
        if ordre:
            url += f"&order={ordre}"
        req = urllib.request.Request(url)
        for k, v in {"apikey": K, "Authorization": f"Bearer {K}",
                     "Range": f"{debut}-{debut + pas - 1}"}.items():
            req.add_header(k, v)
        lot = json.load(urllib.request.urlopen(req))
        out += lot
        if len(lot) < pas:
            return out
        debut += pas


def sql(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


CORRESP = []   # (referentiel, libelle_miroir, code_cible, origine, occurrences)


def noter(ref, libelle, code, origine="referentiel", occ=None):
    CORRESP.append((ref, libelle, code, origine, occ))


lignes = []
w = lignes.append

w("-- =====================================================================")
w("-- AMORÇAGE DES RÉFÉRENTIELS — généré par backend/database/amorcage/generer.py")
w("-- Ne pas éditer à la main : régénérer.")
w("-- =====================================================================")
w("")

# ── 1. ref.univers ───────────────────────────────────────────────────
w("-- ref.univers")
vus = set()
for r in lire("ref_univers", ordre="sort_order.asc"):
    c = slug_unique(r["value"], vus)
    noter("ref_univers", r["value"], c)
    w("insert into ref.univers (code, libelle_fr, couleur_primaire, couleur_secondaire, "
      "logo_url, logo_mini_url, talent_card_url, est_ouvert, ordre) values (%s, %s, %s, %s, %s, %s, %s, %s, %s);"
      % (sql(c), sql(r["value"]), sql(r.get("color")), sql(r.get("secondary_color")),
         sql(r.get("logo_url")), sql(r.get("logo_mini_url")), sql(r.get("talent_card_url")),
         sql(bool(r.get("is_live"))), sql(r.get("sort_order") or 0)))
w("")

# ── 2. référentiels simples (code + libellé + ordre) ────────────────
for table, cible in (("ref_metier", "ref.metier"), ("ref_expertise", "ref.expertise"),
                     ("ref_secteur", "ref.secteur"), ("ref_criteres", "ref.critere")):
    w(f"-- {cible}")
    vus = set()
    for r in lire(table, ordre="sort_order.asc"):
        c = slug_unique(r["value"], vus)
        noter(table, r["value"], c)
        colonnes = "code, libelle_fr, ordre"
        valeurs = f"{sql(c)}, {sql(r['value'])}, {sql(r.get('sort_order') or 0)}"
        if cible in ("ref.metier", "ref.expertise"):
            colonnes += ", origine"
            valeurs += ", 'referentiel'"
        w(f"insert into {cible} ({colonnes}) values ({valeurs});")
    w("")

# ── 3. ref.maturite_produit (codes a–e) ─────────────────────────────
w("-- ref.maturite_produit")
for r in lire("ref_maturite_produit", ordre="sort_order.asc"):
    c = str(r["value"]).strip().lower()
    noter("ref_maturite_produit", r["value"], c)
    w("insert into ref.maturite_produit (code, libelle_fr, image_url, ordre) values (%s, %s, %s, %s);"
      % (sql(c), sql(r["value"]), sql(r.get("image_url")), sql(r.get("sort_order") or 0)))
w("")

# ── 4. ref.statut_contrat (emoji séparé) ────────────────────────────
w("-- ref.statut_contrat")
vus = set()
for r in lire("ref_contract_status", ordre="sort_order.asc"):
    emoji, libelle = separer_emoji(r["value"])
    c = slug_unique(r["value"], vus)
    noter("ref_contract_status", r["value"], c)
    w("insert into ref.statut_contrat (code, libelle_fr, emoji, couleur, signature_requise, ordre) "
      "values (%s, %s, %s, %s, %s, %s);"
      % (sql(c), sql(libelle), sql(emoji), sql(r.get("couleur")),
         sql(bool(r.get("signature_required"))), sql(r.get("sort_order") or 0)))
w("")

# ── 5. ref.evenement_note — le type se DÉDUIT du préfixe du code ────
w("-- ref.evenement_note — note_event_type est vide au miroir : le type est")
w("-- déduit du préfixe du code, ce que la contrainte CHECK exige de toute façon.")
TYPES = ("contract", "info", "archive", "task", "team")
for r in lire("ref_note_event", ordre="sort_order.asc"):
    code = str(r["value"])
    if code == "archive":
        typ = "archive"
    else:
        typ = next((t for t in TYPES if code.startswith(t + "_")), None)
    if typ is None:
        w(f"-- IGNORÉ, préfixe non reconnu : {code}")
        continue
    noter("ref_note_event", r["value"], code)
    w("insert into ref.evenement_note (code, type_evenement, libelle_fr, ordre) values (%s, %s, %s, %s);"
      % (sql(code), sql(typ), sql(r.get("note_event_text")), sql(r.get("sort_order") or 0)))
w("")

# ── 6. ref.type_tache — l'événement se déduit aussi du préfixe ──────
w("-- ref.type_tache — task_event est vide au miroir (0/12) : déduit du préfixe.")
EVTS = ("mandate_clo_free", "mandate_clo_cdi")
for r in lire("ref_task_type", ordre="sort_order.asc"):
    code = str(r["value"])
    evt = next((e for e in EVTS if code.startswith(e + "_")), None)
    if evt is None:
        w(f"-- IGNORÉ, préfixe non reconnu : {code}")
        continue
    noter("ref_task_type", r["value"], code)
    w("insert into ref.type_tache (code, gabarit_texte, est_admin, delai_relatif_jours, "
      "ancre, evenement, ordre) values (%s, %s, %s, %s, %s, %s, %s);"
      % (sql(code), sql(r.get("task_text") or ""), sql(bool(r.get("is_admin"))),
         sql(r.get("relative_time") or 0), sql(r.get("task_anchor")), sql(evt),
         sql(r.get("sort_order") or 0)))
w("")

print("généré : %d lignes SQL, %d correspondances" % (len(lignes), len(CORRESP)))
open(os.path.join(os.path.dirname(__file__), "_partie1.sql"), "w", encoding="utf-8").write("\n".join(lignes))
json.dump(CORRESP, open(os.path.join(os.path.dirname(__file__), "_corresp.json"), "w"),
          ensure_ascii=False, indent=1)
