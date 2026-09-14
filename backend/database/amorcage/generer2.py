#!/usr/bin/env python3
"""Deuxième partie de l'amorçage : les référentiels RECONSTRUITS, les
jonctions, la table de présentation des énumérés, et la correspondance.
"""
import collections
import json
import os
import re
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from slug import separer_emoji, slug, slug_unique  # noqa: E402

U = os.environ["PACHA_LIVE_URL"]
K = os.environ["PACHA_LIVE_SERVICE_ROLE_KEY"]
ICI = os.path.dirname(__file__)


def lire(table, select="*", ordre=None):
    out, pas, debut = [], 1000, 0
    while True:
        url = f"{U}/rest/v1/{table}?select={select}" + (f"&order={ordre}" if ordre else "")
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


CORRESP = json.load(open(os.path.join(ICI, "_corresp.json"), encoding="utf-8"))
lignes = []
w = lignes.append

# ── ref.tag_job — RECONSTRUIT, la source est détruite ───────────────
w("-- ref.tag_job — RECONSTRUIT depuis l'usage : public.ref_tag_job est détruit")
w("-- (74 lignes d'un caractère). Vocabulaire tiré des 833 lignes de mandat_tag_job.")
usage = collections.Counter(r["tag_job"] for r in lire("mandat_tag_job", "tag_job") if r.get("tag_job"))
vus = set()
for ordre, (val, n) in enumerate(usage.most_common(), start=1):
    emoji, libelle = separer_emoji(val)
    c = slug_unique(val, vus)
    CORRESP.append(["mandat_tag_job", val, c, "hors_referentiel", n])
    w("insert into ref.tag_job (code, libelle_fr, emoji, ordre, origine) values (%s, %s, %s, %s, 'hors_referentiel');"
      % (sql(c), sql(libelle), sql(emoji), sql(ordre)))
w("")

# ── ref.etape_process — RECONSTRUIT lui aussi ───────────────────────
w("-- ref.etape_process — RECONSTRUIT depuis public.process.etape :")
w("-- public.ref_process_etape est détruit (70 lignes d'un caractère), et avec lui")
w("-- l'ordre, les couleurs, les libellés publics et 4 des 5 drapeaux.")
w("-- ⚠ L'ORDRE CI-DESSOUS EST PROPOSÉ, PAS MESURÉ : c'est l'entonnoir de")
w("-- recrutement usuel. À confirmer par le métier avant d'ouvrir le kanban.")
ORDRE_PROPOSE = [
    "📩 To contact", "📨 Contacted", "⚡️ Applicant", "Push Candidature",
    "🎤 Screen Pachamama", "👌 Send-out", "🎤 Interview 1", "🎤 Interview 2",
    "🎙️ Final interview", "🙌 Hired",
    "🙅🏻‍♀️ KO", "🙅🏻‍♀️ KO by Pachamama", "🙅🏻‍♀️ KO by client", "🙅🏻‍♀️ KO by candidat",
]
etapes = collections.Counter(r["etape"] for r in lire("process", "etape") if r.get("etape"))
inconnues = [v for v in etapes if v not in ORDRE_PROPOSE]
if inconnues:
    w("-- ⚠ valeurs vues en données mais absentes de l'ordre proposé : %s" % inconnues)
vus = set()
for ordre, val in enumerate([v for v in ORDRE_PROPOSE if v in etapes] + inconnues, start=1):
    emoji, libelle = separer_emoji(val)
    c = slug_unique(val, vus)
    est_ko = libelle.upper().startswith("KO")
    est_term = est_ko or libelle.lower() == "hired"
    CORRESP.append(["process.etape", val, c, "hors_referentiel", etapes[val]])
    w("insert into ref.etape_process (code, libelle_interne, emoji, est_ko, est_terminale, ordre) "
      "values (%s, %s, %s, %s, %s, %s);"
      % (sql(c), sql(libelle), sql(emoji), sql(est_ko), sql(est_term), sql(ordre)))
w("")

# ── les deux jonctions ──────────────────────────────────────────────
w("-- ref.metier_univers et ref.expertise_univers")
for table, cible, ca, cb, ra, rb in (
        ("ref_metier_univers", "ref.metier_univers", "metier_value", "univers_value", "metier", "univers"),
        ("ref_expertise_univers", "ref.expertise_univers", "expertise_value", "univers_value", "expertise", "univers")):
    # On réutilise le code RÉELLEMENT attribué par la partie 1, via
    # ref.correspondance — recalculer un slug ici rouvrirait la porte aux
    # divergences entre la table et sa jonction.
    codes = {(c[0], c[1]): c[2] for c in CORRESP}
    src_a = {"metier": "ref_metier", "expertise": "ref_expertise"}[ra]
    perdues = 0
    for r in lire(table):
        a, b = r.get(ca), r.get(cb)
        if not a or not b:
            continue
        ca_code, cb_code = codes.get((src_a, a)), codes.get(("ref_univers", b))
        if not ca_code or not cb_code:
            perdues += 1
            w(f"-- ⚠ NON RÉSOLU : {a} × {b}")
            continue
        w("insert into %s (%s_id, univers_id) select a.id, u.id from ref.%s a, ref.univers u "
          "where a.code = %s and u.code = %s on conflict do nothing;"
          % (cible, ra, ra, sql(ca_code), sql(cb_code)))
    if perdues:
        w(f"-- ⚠ {perdues} paires non résolues sur {table}")
w("")

# ── ref.libelle — la présentation des 28 énumérés ───────────────────
w("-- ref.libelle — présentation des 28 types énumérés, jointe par (domaine, code)")
mig = open(os.path.join(ICI, "..", "..", "..", "supabase", "migrations",
                        "20260828093000_schema_ref.sql"), encoding="utf-8").read()
enums = {m.group(1): re.findall(r"'([^']+)'", m.group(2))
         for m in re.finditer(r"create type ref\.(\w+)\s+as enum \(([^)]*)\);", mig, re.S)}
SOURCE = {
    "background_talent": "ref_background", "cible_produit": "ref_cible",
    "type_entreprise": "ref_company_type", "type_apporteur": "ref_apporteur_affaires",
    "source_marketing": "ref_source_marketing", "type_contrat": "ref_contrat",
    "type_contributeur": "ref_contributor_type", "emoji_statut": "ref_emoji",
    "fonction_utilisateur": "ref_fonction", "genre": "ref_gender", "langue": "ref_language",
    "statut_mandat": "ref_mandate_status", "visibilite_mandat": "ref_mandate_visibility",
    "mindset_talent": "ref_mindset", "niveau_analyse": "ref_niveau_analyse",
    "niveau_anglais": "ref_niveau_anglais", "type_note_event": "ref_note_event_type",
    "type_produit_xp": "ref_product", "type_produit_entreprise": "ref_product_type",
    "profil_talent": "ref_profile", "rythme_remote": "ref_remote",
    "role_utilisateur": "ref_role", "statut_relation": "ref_statut_candidat",
    "form_concurrence": "ref_form_41", "form_provenance": "ref_form_42",
    "formule_mission": "ref_formule", "ancre_tache": "ref_task_anchor",
    "evenement_tache": "ref_task_event",
}
COULEUR = ("color", "status_color", "couleur")
LABEL = ("label_fr", "status_admin_label", "full_display", "candidat_display", "label")
n_libelle = 0
for domaine, table in SOURCE.items():
    src = lire(table, ordre="sort_order.asc")
    labels = enums.get(domaine, [])
    for i, r in enumerate(src):
        if i >= len(labels):
            break
        code = labels[i]
        emoji, libelle = separer_emoji(r["value"])
        fr = next((r[c] for c in LABEL if r.get(c)), None) or libelle
        couleur = next((r[c] for c in COULEUR if r.get(c)), None)
        est_recr = None
        if table == "ref_role":
            est_recr = "recruiter" in str(r.get("role_category") or "").lower()
        actif = r.get("is_active")
        libelles = {"fr": fr}
        if r.get("label_en"):
            libelles["en"] = r["label_en"]
        CORRESP.append([table, r["value"], code, "referentiel", None])
        w("insert into ref.libelle (domaine, code, libelles, emoji, couleur, ordre, actif, est_recruteur) "
          "values (%s, %s, %s::jsonb, %s, %s, %s, %s, %s);"
          % (sql(domaine), sql(code), sql(json.dumps(libelles, ensure_ascii=False)),
             sql(emoji), sql(couleur), sql(r.get("sort_order") or i + 1),
             sql(True if actif is None else bool(actif)), sql(est_recr)))
        n_libelle += 1
    # les valeurs ajoutées au-delà de la source (orphelines mesurées, ajouts métier)
    for j, code in enumerate(labels[len(src):], start=len(src) + 1):
        w("insert into ref.libelle (domaine, code, libelles, ordre, actif) "
          "values (%s, %s, %s::jsonb, %s, true);  -- hors référentiel source"
          % (sql(domaine), sql(code), sql(json.dumps({"fr": code.replace("_", " ").capitalize()},
                                                     ensure_ascii=False)), sql(j)))
        n_libelle += 1
w("")

# ── ref.correspondance ──────────────────────────────────────────────
w("-- ref.correspondance — la preuve d'audit de chaque transformation")
for ref, lib, code, origine, occ in CORRESP:
    w("insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) "
      "values (%s, %s, %s, %s, %s) on conflict (referentiel, libelle_miroir) do nothing;"
      % (sql(ref), sql(lib), sql(code), sql(origine), sql(occ)))

open(os.path.join(ICI, "_partie2.sql"), "w", encoding="utf-8").write("\n".join(lignes))
print("partie 2 : %d lignes · ref.libelle %d · correspondances %d" % (len(lignes), n_libelle, len(CORRESP)))
