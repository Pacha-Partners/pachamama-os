#!/usr/bin/env python3
"""Amorçage du schéma config depuis la production.

Oublié lors du premier amorçage, qui ne couvrait que ref. Les huit tables
de config ont pourtant des sources au miroir — sauf config.integration,
qui est légitimement vide (A_CREER, aucune source).
"""
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from slug import separer_emoji, slug, slug_unique  # noqa: E402

U = os.environ["PACHA_LIVE_URL"]
K = os.environ["PACHA_LIVE_SERVICE_ROLE_KEY"]


def lire(table, ordre=None):
    url = f"{U}/rest/v1/{table}?select=*" + (f"&order={ordre}" if ordre else "")
    req = urllib.request.Request(url)
    for k, v in {"apikey": K, "Authorization": f"Bearer {K}", "Range": "0-999"}.items():
        req.add_header(k, v)
    return json.load(urllib.request.urlopen(req))


def sql(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


L, C = [], []
w = L.append

w("-- ── config.branding — SINGLETON")
for r in lire("ref_app_branding"):
    c = slug(r["value"])
    C.append(("ref_app_branding", r["value"], c))
    w("insert into config.branding (cle, libelle, logo_url, logo_mini_url, background_image_url, "
      "background_asset1_url, background_asset2_url, police, site_web) values (%s,%s,%s,%s,%s,%s,%s,%s,%s);"
      % (sql(c), sql(r["value"]), sql(r.get("logo_url")), sql(r.get("logo_mini_url")),
         sql(r.get("background_image")), sql(r.get("background_asset1")),
         sql(r.get("background_asset2")), sql(r.get("police")), sql(r.get("web_site"))))

w("\n-- ── config.asset")
vus = set()
for r in lire("ref_image", ordre="sort_order.asc"):
    c = slug_unique(r["value"], vus)
    C.append(("ref_image", r["value"], c))
    w("insert into config.asset (cle, url, description) values (%s,%s,%s);"
      % (sql(c), sql(r.get("file_url")), sql("Repris de public.ref_image")))

w("\n-- ── config.parametre — l'interrupteur de redirection des e-mails")
vus = set()
for r in lire("ref_email_config", ordre="sort_order.asc"):
    c = slug_unique(r["value"], vus)
    C.append(("ref_email_config", r["value"], c))
    w("insert into config.parametre (cle, valeur, description, sensible) values (%s,%s,%s,true);"
      % (sql(c), sql(r.get("email_adresses")),
         sql("Adresse de redirection des envois en test. Sensible : l'anonymisation de la dev doit la trouver.")))

w("\n-- ── config.canal_notification — les 2 canaux Slack, SANS leurs webhooks")
vus = set()
for r in lire("ref_slack_channel", ordre="sort_order.asc"):
    c = slug_unique(r["value"], vus)
    C.append(("ref_slack_channel", r["value"], c))
    w("insert into config.canal_notification (code, libelle) values (%s,%s);" % (sql(c), sql(r["value"])))

w("\n-- ── config.modele_email — cree_par_compte_id reste nul : app.compte est vide")
for r in lire("email_template"):
    C.append(("email_template", r.get("label") or r["id"], r["id"]))
    w("insert into config.modele_email (bubble_id, libelle, objet, corps, jeton_agent_prenom, "
      "jeton_agent_nom, jeton_entreprise_nom, jeton_talent_prenom, jeton_personnalise) "
      "values (%s,%s,%s,%s,%s,%s,%s,%s,%s);"
      % (sql(r["id"]), sql(r.get("label") or "(sans libellé)"), sql(r.get("subject")),
         sql(r.get("body") or ""), sql(bool(r.get("is_agent_firstname"))),
         sql(bool(r.get("is_agent_lastname"))), sql(bool(r.get("is_company_name"))),
         sql(bool(r.get("is_firstname"))), sql(bool(r.get("is_custom")))))

w("\n-- ── config.sendgrid_template, et l'éclatement de la chaîne à pipe")
STATUT = {"En cours": "en_cours", "Closé": "close_pachamama", "Nouveau": "nouveau",
          "Terminé": "termine", "Closé par Pachamama": "close_pachamama"}
n_liaison = 0
vus = set()
for r in lire("ref_sendgrid_template", ordre="sort_order.asc"):
    emoji, libelle = separer_emoji(r["value"])
    c = slug_unique(r["value"], vus)
    C.append(("ref_sendgrid_template", r["value"], c))
    w("insert into config.sendgrid_template (code, libelle_fr, emoji, template_id, ordre) "
      "values (%s,%s,%s,%s,%s);"
      % (sql(c), sql(libelle), sql(emoji), sql(r["id_sendgrid"]), sql(r.get("sort_order") or 0)))
    for morceau in str(r.get("visible_pour_mandat") or "").split("|"):
        morceau = morceau.strip()
        if not morceau:
            continue
        st = STATUT.get(morceau)
        if st is None:
            w(f"-- ⚠ statut non reconnu dans la chaîne à pipe : {morceau}")
            continue
        n_liaison += 1
        w("insert into config.sendgrid_template_statut_mandat (sendgrid_template_id, statut) "
          "select id, %s from config.sendgrid_template where code = %s;" % (sql(st), sql(c)))

w("\n-- ── la correspondance de ces transformations")
for ref, lib, code in C:
    w("insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine) "
      "values (%s,%s,%s,'referentiel') on conflict (referentiel, libelle_miroir) do nothing;"
      % (sql(ref), sql(lib), sql(code)))

open(os.path.join(os.path.dirname(__file__), "_config.sql"), "w", encoding="utf-8").write("\n".join(L))
print("config : %d insertions · %d liaisons de gabarit · %d correspondances"
      % (sum(1 for x in L if x.startswith("insert")), n_liaison, len(C)))
