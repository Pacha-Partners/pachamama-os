#!/usr/bin/env python3
"""
Annule un run de connecteur_app_pivot.py à partir de son manifeste.

Défait, dans l'ordre inverse des dépendances :
  1. supprime les emails/téléphones ajoutés à des dorés PRÉEXISTANTS
     (ceux des dorés créés partiront par cascade en 4) ;
  2. restaure l'état d'avant de chaque doré modifié (PATCH) ;
  3. retire les liaisons talent_source ajoutées vers des dorés préexistants ;
  4. supprime les dorés créés (cascade → leurs source/email/phone/conflit) ;
  5. supprime les conflits et la ligne de run de ce run_id ;
  6. remet le curseur sync_etat à sa valeur d'avant.

Lecture seule par défaut. --appliquer pour exécuter.
Usage : python -m pachamama_api.connecteurs.annuler_run <manifeste.json> [--appliquer]
"""

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

from pachamama_api.connecteurs.commun import acces_supabase

SUPA, CLE = acces_supabase()
APPLIQUER = "--appliquer" in sys.argv
fichiers = [a for a in sys.argv[1:] if not a.startswith("--")]
if not fichiers:
    sys.exit("Donner le fichier manifeste ROLLBACK_connecteur_*.json")
with open(fichiers[0], encoding="utf-8") as manifeste:
    M = json.load(manifeste)


def http(chemin, methode="GET", corps=None):
    h = {
        "apikey": CLE,
        "Authorization": f"Bearer {CLE}",
        "Accept-Profile": "pivot",
        "Content-Profile": "pivot",
        "Prefer": "return=minimal",
    }
    data = None
    if corps is not None:
        h["Content-Type"] = "application/json"
        data = json.dumps(corps).encode()

    req = urllib.request.Request(  # noqa: S310
        f"{SUPA}/rest/v1/{chemin}", data=data, headers=h, method=methode
    )
    with urllib.request.urlopen(req, timeout=240) as r:  # noqa: S310
        return r.read()


q = urllib.parse.quote
run = M["run_id"]
print(f"# Annulation du run {run}   {'(EXÉCUTION)' if APPLIQUER else '(SIMULATION)'}\n")
plan = [
    (
        "emails ajoutés (dorés préexistants)",
        len([e for e in M["emails_ajoutes"] if e[0] not in set(M["created_talent_ids"])]),
    ),
    (
        "phones ajoutés (dorés préexistants)",
        len([p for p in M["phones_ajoutes"] if p[0] not in set(M["created_talent_ids"])]),
    ),
    ("dorés à restaurer (PATCH avant)", len(M["patched_talent_avant"])),
    ("liaisons talent_source à retirer", len(M["linked_talent_source"])),
    ("dorés créés à supprimer (cascade)", len(M["created_talent_ids"])),
    ("attentes à restaurer", len(M.get("attentes_avant", {}))),
    ("qualif à restaurer", len(M.get("qualif_avant", {}))),
    ("conflits + run à supprimer (run_id)", "par run_id"),
    ("curseur sync_etat à restaurer", M["curseur_avant"]),
]
for quoi, n in plan:
    print(f"   {quoi:<44} {n}")
if not APPLIQUER:
    print("\nSIMULATION : rien n'est modifié. Relancer avec --appliquer.")
    sys.exit(0)

created = set(M["created_talent_ids"])
# 1. emails/phones sur dorés préexistants
for tid, email in M["emails_ajoutes"]:
    if tid in created:
        continue
    http(f"email?talent_id=eq.{q(tid)}&email=eq.{q(email)}", "DELETE")
for tid, tel in M["phones_ajoutes"]:
    if tid in created:
        continue
    http(f"phone?talent_id=eq.{q(tid)}&tel=eq.{q(tel)}", "DELETE")
# 2. restaurer l'état d'avant des dorés modifiés
for tid, avant in M["patched_talent_avant"].items():
    corps = {k: v for k, v in avant.items() if k != "talent_id"}
    http(f"talent?talent_id=eq.{q(tid)}", "PATCH", corps=corps)
# 3. retirer les liaisons
for tid, ext in M["linked_talent_source"]:
    http(f"talent_source?talent_id=eq.{q(tid)}&source=eq.app&external_id=eq.{q(ext)}", "DELETE")
# 3b. attentes / qualif : restaurer l'avant (créés → partiront par cascade en 4)
for table, avant in [
    ("attentes", M.get("attentes_avant", {})),
    ("qualification", M.get("qualif_avant", {})),
]:
    for tid, prior in avant.items():
        if prior is None:
            http(f"{table}?talent_id=eq.{q(tid)}", "DELETE")
        else:
            corps = {k: v for k, v in prior.items() if k != "talent_id"}
            http(f"{table}?talent_id=eq.{q(tid)}", "PATCH", corps=corps)
# 4. supprimer les dorés créés (cascade)
for i in range(0, len(M["created_talent_ids"]), 100):
    lot = M["created_talent_ids"][i : i + 100]
    http(f"talent?talent_id=in.({','.join(q(x) for x in lot)})", "DELETE")
# 5. conflits + run
http(f"conflit?run_id=eq.{q(run)}", "DELETE")
http(f"sync_run?run_id=eq.{q(run)}", "DELETE")
# 6. curseur
http("sync_etat?source=eq.app", "PATCH", corps={"curseur": M["curseur_avant"], "statut": "ok"})
print("\n✅ run annulé. Le pivot est revenu à l'état d'avant.")
