#!/usr/bin/env python3
"""Le cap — l'état de l'activité, en une commande.

    python3 outils/cap.py live
    python3 outils/cap.py live --archiver
    python3 outils/cap.py live --contre var/cap/live-20260923-0900.json

Un seul chiffre commande : les mandats ouverts qui n'ont reçu AUCUNE
candidature. Mesuré sur 346 mandats fermés en 24 mois :

    servi dans les 30 j     313 mandats   50,2 % gagnés
    servi après 30 j          9 mandats   44,4 % gagnés
    jamais servi             24 mandats    4,2 % gagnés

Un mandat servi a douze fois plus de chances d'aboutir. Et le retard ne tue
presque pas — c'est l'absence qui tue. Le seuil porte donc sur « zéro », pas
sur « en retard ».

Lecture seule stricte : le garde de derive.py refuse tout ce qui n'est pas un
select. Lançable sur la production sans réfléchir deux fois.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from derive import sql, ref_du_projet, RACINE  # noqa: E402

ARCHIVE = RACINE / "var" / "cap"
SEUIL = 8  # au-dessus, aucun autre chantier ne s'ouvre

# Le miroir ne stocke qu'un libellé avec emoji ; la référence les sépare.
# Ce rapprochement couvre 7 623 candidatures sur 7 653, zéro non-apparié.
# Le coalesce n'est pas décoratif : push_candidature a un emoji nul.
ETAPE = ("left join ref.etape_process r "
         "on p.etape = coalesce(r.emoji || ' ', '') || r.libelle_interne")

R = {
"cap": f"""
select count(*) filter (where n = 0)::int                         as muets,
       count(*)::int                                              as ouverts,
       count(*) filter (where n = 0 and age > 30)::int            as muets_30j,
       coalesce(sum(age) filter (where n = 0), 0)::int            as jours_perdus,
       coalesce(percentile_cont(0.5) within group (order by age)
                filter (where n = 0), 0)::int                     as age_muet,
       coalesce(percentile_cont(0.5) within group (order by age)
                filter (where n > 0), 0)::int                     as age_servi
from (select m.id, (current_date - m.created_at::date) as age, count(p.id) as n
      from public.mandat m
      left join public.process p on p.mandat_id = m.id
      where m.statut in ('En cours', 'Nouveau')
      group by m.id, m.created_at) t
""",
# Le garde-fou. On éteint un muet en trois minutes avec une candidature
# faible : cette ligne est le seul endroit où la triche se verrait.
# Elle se calcule sur les dossiers ARBITRÉS — la version naïve rend 8,6 %.
"client": f"""
select count(*)::int                                              as arbitres,
       count(*) filter (where r.code = 'hired')::int              as recrutes,
       round(100.0 * count(*) filter (where r.code = 'hired')
             / nullif(count(*), 0), 1)                            as taux
from public.process p {ETAPE}
where r.code in ('hired', 'ko_by_client', 'ko_by_candidat')
  and p.created_at >= now() - interval '90 days'
""",
"placements": f"""
select count(*)::int                                              as places,
       coalesce(percentile_cont(0.5) within group
         (order by extract(epoch from (p.date_update_etape - m.created_at))
                   / 86400.0), 0)::int                            as delai
from public.process p {ETAPE}
join public.mandat m on m.id = p.mandat_id
where r.code = 'hired' and p.date_update_etape >= now() - interval '90 days'
""",
"vivier": """
select (select count(*) from pivot.talent)::int                   as total,
       count(*)::int                                              as adressables
from pivot.talent t
join pivot.attentes a on a.talent_id = t.talent_id
where coalesce(a.metier_vise, '') <> ''
  and coalesce(t.localisation, '') <> ''
  and coalesce(a.salaire_souhaite, a.salaire_min,
               a.tjm_souhaite, a.tjm_min) is not null
""",
# Le seul indicateur qui nomme une cause et non un symptôme.
"orphelins": """
select count(*) filter (where personne_en_charge_id is null)::int as orphelins
from public.mandat where statut in ('En cours', 'Nouveau')
""",
# Le jour où n8n s'arrête, tous les autres chiffres restent plausibles et
# faux. Cette ligne est la seule qui le dira.
"flux": """
select (select max(created_at)::date from public.process)::text   as derniere,
       (select count(*) from public.process
        where created_at >= now() - interval '7 days')::int        as cand_7j,
       (select count(*) from public.mandat
        where created_at >= now() - interval '30 days')::int       as mandats_30j
""",
}


def mesurer(cible: str) -> dict:
    ref = ref_du_projet(cible)
    m = {"cible": cible, "le": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    for nom, requete in R.items():
        m[nom] = sql(ref, requete)[0]
    return m


def delta(a, b, inverse=False) -> str:
    """inverse=True quand baisser est bon."""
    if b is None:
        return ""
    d = a - b
    if d == 0:
        return "   ="
    bon = (d < 0) if inverse else (d > 0)
    return f"  {'+' if d > 0 else ''}{d}{'' if bon else ' ⚠'}"


def afficher(m: dict, p: dict | None) -> None:
    c, cl, pl, v, o, f = (m["cap"], m["client"], m["placements"],
                          m["vivier"], m["orphelins"], m["flux"])
    pc = p["cap"] if p else {}
    quand = m["le"][:16].replace("T", " ")
    ecart = f" · contre le {p['le'][:10]}" if p else ""

    print(f"\n  {m['cible'].upper()} · {quand} UTC{ecart}\n")
    print("  ── LE CAP " + "─" * 46)
    print(f"     Mandats ouverts SANS aucune candidature    "
          f"{c['muets']:>3} / {c['ouverts']}"
          f"{delta(c['muets'], pc.get('muets'), inverse=True)}")
    print(f"     dont ouverts depuis plus de 30 jours       {c['muets_30j']:>3}"
          f"{delta(c['muets_30j'], pc.get('muets_30j'), inverse=True)}")
    print(f"     Jours-mandat immobilisés                   {c['jours_perdus']:>3}"
          f"{delta(c['jours_perdus'], pc.get('jours_perdus'), inverse=True)}")
    print(f"     Âge médian : muet {c['age_muet']} j   ·   servi {c['age_servi']} j")

    print("\n  ── GARDE-FOUS " + "─" * 42)
    ok = "✔" if cl["taux"] and float(cl["taux"]) >= 18 else "⚠"
    print(f"     {ok} Aboutissement après présentation client  "
          f"{cl['taux']} %   plancher 18 %   ({cl['arbitres']} arbitrés, 90 j)")
    print(f"     · Placements sur 90 jours                  "
          f"{pl['places']:>3}     délai médian {pl['delai']} j")
    pct = round(100.0 * v["adressables"] / v["total"], 1)
    print(f"     ⚠ Vivier adressable du pivot             "
          f"{pct} %     {v['adressables']} / {v['total']}")
    print(f"     · Mandats ouverts sans personne en charge  "
          f"{o['orphelins']:>3} / {c['ouverts']}")

    print("\n  ── LE FLUX EST-IL VIVANT " + "─" * 31)
    print(f"     dernière candidature {f['derniere']} · "
          f"{f['cand_7j']} sur 7 j · {f['mandats_30j']} mandats sur 30 j")

    print("\n  ── CE QUE ÇA DÉCIDE " + "─" * 36)
    if c["muets"] > SEUIL:
        print(f"     {c['muets']} muets sur {c['ouverts']} : le chantier ouvert reste")
        print(f"     « éteindre les muets ». Aucun autre ne s'ouvre au-dessus de {SEUIL}.")
    else:
        print(f"     {c['muets']} muets, sous le seuil de {SEUIL}.")
        print("     Le chantier suivant de CHANTIER.md peut s'ouvrir.")
    print()


def main() -> int:
    a = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("cible", choices=["dev", "live"])
    a.add_argument("--json", action="store_true", help="rendre la mesure brute")
    a.add_argument("--contre", metavar="FICHIER", help="comparer à une mesure précédente")
    a.add_argument("--archiver", action="store_true", help="garder la mesure")
    args = a.parse_args()

    m = mesurer(args.cible)
    if args.json:
        print(json.dumps(m, indent=2, ensure_ascii=False))
        return 0

    precedent = json.loads(Path(args.contre).read_text()) if args.contre else None
    afficher(m, precedent)

    if args.archiver:
        ARCHIVE.mkdir(parents=True, exist_ok=True)
        nom = ARCHIVE / f"{args.cible}-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}.json"
        nom.write_text(json.dumps(m, indent=2, ensure_ascii=False))
        print(f"  mesure archivée : {nom.relative_to(RACINE)}\n")

    return 1 if m["cap"]["muets"] > SEUIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
