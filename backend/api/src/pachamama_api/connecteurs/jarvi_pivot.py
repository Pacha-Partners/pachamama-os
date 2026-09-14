"""Connecteur Jarvi -> pivot.

Le symetrique de `app_pivot`, avec UNE difference qui change tout : ici Jarvi est
MAITRE sur l'identite. La matrice de preseance de la tache 3 lui donne prenom,
nom, localisation et employeur ; l'app ne fait que combler les vides. Le
connecteur app respecte cette regle en s'abstenant ; celui-ci l'applique en
imposant — et journalise l'ecart quand il ecrase une valeur venue de l'app.

Le rapprochement est TRIVIAL, et c'est mesure
---------------------------------------------
`talent_source.external_id` des dores de source 'jarvi' est EXACTEMENT l'`id`
de l'API — memes UUID, caractere pour caractere, verifie le 24/08/2026. Le
rapprochement se fait donc par cette cle, sans cascade, pour les profils deja
connus. La cascade du moteur ne sert qu'aux NOUVEAUX profils, qui peuvent
correspondre a un dore cree par l'app.

Ce qu'il ne fait pas
--------------------
Il n'ecrit RIEN chez Jarvi. La decision d'architecture est l'ingestion seule.
Et il ne supprime rien : un profil qui cesse d'etre talent chez Jarvi n'est pas
efface du pivot — il est compte et signale, parce qu'une suppression demande une
decision, pas un effet de bord.

Usage
-----
  python -m pachamama_api.connecteurs.jarvi_pivot                # simulation
  python -m pachamama_api.connecteurs.jarvi_pivot --appliquer    # ecrit
  python -m pachamama_api.connecteurs.jarvi_pivot --plein        # ignore le curseur
  python -m pachamama_api.connecteurs.jarvi_pivot --budget=200   # borne les requetes
"""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from typing import Any

from pachamama_api.connecteurs import jarvi, moteur
from pachamama_api.connecteurs.commun import (
    Incident,
    appeler,
    dossier_artefacts,
    echapper,
    lire_tout,
    moins_une_ms,
    verifier_analyseur_dates,
)

SOURCE = "ats"  # le nom de la ligne dans pivot.sync_etat


def _arg(prefixe: str) -> str | None:
    for a in sys.argv[1:]:
        if a.startswith(prefixe):
            return a.split("=", 1)[1]
    return None


def cles_jarvi(profil: dict[str, Any]) -> set[str]:
    """Les cles de rapprochement d'un profil Jarvi, dans le vocabulaire du moteur.

    Symetrique de `moteur.akeys_from_mirror`, mais sur les champs de l'API :
    `profileUrl` pour le slug, `emailAddresses` pour les emails. Le meme
    garde-fou s'applique — seul un chemin /in/<slug> est accepte, et les emails
    generiques sont exclus des cles.
    """
    cles: set[str] = set()
    slug = moteur.nli(profil.get("profileUrl") or profil.get("publicIdentifier"))
    if moteur.slug_utilisable(slug):
        cles.add("s:" + str(slug))
    for entree in profil.get("emailAddresses") or []:
        brut = entree.get("email") if isinstance(entree, dict) else entree
        courriel = moteur.nemail(brut)
        if courriel and not moteur.is_generic(courriel):
            cles.add("e:" + courriel)
    return cles


def identite(profil: dict[str, Any]) -> dict[str, Any]:
    """Les quatre champs dont Jarvi est maitre, extraits de l'API."""
    lieux = profil.get("locations") or []
    premier = lieux[0] if lieux else {}
    localisation = premier.get("name") if isinstance(premier, dict) else premier
    poste = profil.get("lastPosition") or {}
    societe = poste.get("companyName") if isinstance(poste, dict) else None
    return {
        "prenom": moteur.txt(profil.get("firstName")),
        "nom": moteur.txt(profil.get("lastName")),
        "localisation": moteur.txt(localisation),
        "employeur_actuel": moteur.txt(societe),
    }


def main() -> None:
    verifier_analyseur_dates()
    appliquer = "--appliquer" in sys.argv
    plein = "--plein" in sys.argv
    budget = int(_arg("--budget=") or 0) or None
    debut = datetime.now(UTC)
    run_id = "jarvi-" + debut.strftime("%Y%m%dT%H%M%SZ")
    print(
        f"# Connecteur Jarvi -> pivot   {'(ECRITURE)' if appliquer else '(SIMULATION)'}"
        f"{' [PLEIN]' if plein else ''}\n"
    )

    # Contre-epreuve des filtres AVANT tout : un filtre `where` non compris est
    # ignore en silence et rend un resultat plausible.
    print("1. Verification des filtres Jarvi")
    v = jarvi.verifier_filtres()
    print(f"   {v['total']} profils · {v['talents']} talents · filtres verifies\n")

    etats = lire_tout(f"sync_etat?select=*&source=eq.{SOURCE}", "source.asc", profil="pivot")
    if not etats:
        raise Incident(f"pivot.sync_etat n'a pas de ligne '{SOURCE}' — lancer la migration 03")
    etat = etats[0]
    curseur = None if plein else etat.get("curseur")
    print(f"2. Curseur {SOURCE} : {curseur or '(vierge — lecture complete)'}\n")

    print("3. Index des dores existants")
    liens = lire_tout(
        "talent_source?select=talent_id,source,external_id", "talent_id.asc", profil="pivot"
    )
    par_jarvi = {x["external_id"]: x["talent_id"] for x in liens if x["source"] == "jarvi"}
    talents_pivot = {
        t["talent_id"]: t
        for t in lire_tout(
            "talent?select=talent_id,type_fusion,prenom,prenom_src,nom,nom_src,"
            "localisation,localisation_src,employeur_actuel,employeur_src,url_linkedin,headline",
            "talent_id.asc",
            profil="pivot",
        )
    }
    # Index de cascade, pour les NOUVEAUX profils seulement.
    cle_vers_dore: dict[str, str] = {}
    ambigues: set[str] = set()

    def poser(cle: str, tid: str) -> None:
        if cle in ambigues:
            return
        if cle in cle_vers_dore and cle_vers_dore[cle] != tid:
            ambigues.add(cle)
            cle_vers_dore.pop(cle, None)
        else:
            cle_vers_dore[cle] = tid

    for tid, t in talents_pivot.items():
        slug = moteur.nli(t.get("url_linkedin"))
        if moteur.slug_utilisable(slug):
            poser("s:" + str(slug), tid)
    for e in lire_tout("email?select=talent_id,email,generique", "talent_id.asc", profil="pivot"):
        courriel = moteur.nemail(e.get("email"))
        if courriel and not e.get("generique") and not moteur.is_generic(courriel):
            poser("e:" + courriel, tid=e["talent_id"])
    sequence = max(
        (int(t[1:]) for t in talents_pivot if t.startswith("T") and t[1:].isdigit()), default=0
    )
    print(
        f"   {len(talents_pivot)} dores · {len(par_jarvi)} deja lies a Jarvi · "
        f"{len(cle_vers_dore)} cles · {len(ambigues)} ambigue(s) neutralisee(s)\n"
    )

    st = dict.fromkeys(("lus", "maj", "lien", "creation", "conflits", "ambigu", "inchange"), 0)
    patchs: dict[str, dict[str, Any]] = {}
    creations: list[dict[str, Any]] = []
    nouveaux_liens: list[dict[str, Any]] = []
    conflits: list[dict[str, Any]] = []
    ambigus: list[str] = []
    max_maj = curseur

    print("4. Lecture et rapprochement")
    for profil in jarvi.talents(depuis=curseur, budget=budget):
        st["lus"] += 1
        maj = profil.get("updatedAt")
        if maj and (max_maj is None or maj > max_maj):
            max_maj = maj
        ident = identite(profil)

        tid = par_jarvi.get(profil["id"])
        if tid is None:
            # Profil inconnu de Jarvi cote pivot : la cascade peut le rattacher a
            # un dore cree par l'app.
            cibles = {cle_vers_dore[c] for c in cles_jarvi(profil) if c in cle_vers_dore}
            if any(c in ambigues for c in cles_jarvi(profil)) or len(cibles) > 1:
                st["ambigu"] += 1
                ambigus.append(profil["id"])
                continue
            if len(cibles) == 1:
                tid = next(iter(cibles))
                nouveaux_liens.append(
                    {"talent_id": tid, "source": "jarvi", "external_id": profil["id"]}
                )
                if talents_pivot.get(tid, {}).get("type_fusion") == "app_only":
                    patchs.setdefault(tid, {})["type_fusion"] = "merged"
                st["lien"] += 1
            else:
                sequence += 1
                tid = f"T{sequence:06d}"
                creations.append(
                    {
                        "talent_id": tid,
                        "type_fusion": "jarvi_only",
                        "prenom": ident["prenom"],
                        "prenom_src": "jarvi" if ident["prenom"] else None,
                        "nom": ident["nom"],
                        "nom_src": "jarvi" if ident["nom"] else None,
                        "localisation": ident["localisation"],
                        "localisation_src": "jarvi" if ident["localisation"] else None,
                        "employeur_actuel": ident["employeur_actuel"],
                        "employeur_src": "jarvi" if ident["employeur_actuel"] else None,
                        "url_linkedin": moteur.txt(profil.get("profileUrl")),
                        "headline": moteur.txt(profil.get("headline")),
                    }
                )
                nouveaux_liens.append(
                    {"talent_id": tid, "source": "jarvi", "external_id": profil["id"]}
                )
                talents_pivot[tid] = {"type_fusion": "jarvi_only"}
                par_jarvi[profil["id"]] = tid
                st["creation"] += 1
                continue

        # Dore connu : PRESEANCE JARVI. On impose, et on journalise ce qu'on ecarte.
        dore = talents_pivot.get(tid, {})
        patch: dict[str, Any] = {}
        for champ in moteur.IDENT:
            valeur = ident[champ]
            if not moteur.nonempty(valeur):
                continue
            courant = dore.get(champ)
            provenance = dore.get(moteur.SRC[champ])
            if not moteur.nonempty(courant):
                patch[champ] = valeur
                patch[moteur.SRC[champ]] = "jarvi"
            elif moteur.meme_valeur(courant, valeur):
                continue
            elif provenance == "app":
                # Jarvi est maitre : on ecrase, et l'ecart part au journal.
                patch[champ] = valeur
                patch[moteur.SRC[champ]] = "jarvi"
                conflits.append(
                    {
                        "talent_id": tid,
                        "champ": champ,
                        "valeur_retenue": str(valeur),
                        "source_retenue": "jarvi",
                        "valeur_ecartee": str(courant),
                        "source_ecartee": "app",
                        "regle": "matrice",
                        "run_id": run_id,
                    }
                )
                st["conflits"] += 1
            else:
                patch[champ] = valeur  # meme source, valeur plus recente
        if not moteur.nonempty(dore.get("url_linkedin")) and profil.get("profileUrl"):
            patch["url_linkedin"] = moteur.txt(profil.get("profileUrl"))
        if not moteur.nonempty(dore.get("headline")) and profil.get("headline"):
            patch["headline"] = moteur.txt(profil.get("headline"))
        if patch:
            patchs.setdefault(tid, {}).update(patch)
            st["maj"] += 1
        else:
            st["inchange"] += 1

    print("\n5. Ce que le run " + ("fait" if appliquer else "ferait"))
    for k in ("lus", "creation", "lien", "maj", "inchange", "conflits", "ambigu"):
        print(f"   {k:<12} {st[k]}")
    nouveau_curseur = moins_une_ms(max_maj) if max_maj else curseur
    print(f"   nouveau curseur -> {nouveau_curseur or '(inchange)'}")
    if ambigus:
        print(f"   ambigus sautes : {', '.join(ambigus[:5])}{' …' if len(ambigus) > 5 else ''}")

    if not appliquer:
        print("\nSIMULATION : aucune ecriture. Relancer avec --appliquer.")
        return

    # Manifeste de rollback AVANT la premiere ecriture.
    manifeste = {
        "run_id": run_id,
        "curseur_avant": curseur,
        "created_talent_ids": [c["talent_id"] for c in creations],
        "linked_talent_source": [
            [x["talent_id"], x["external_id"]]
            for x in nouveaux_liens
            if x["talent_id"] not in {c["talent_id"] for c in creations}
        ],
        "patched_talent_avant": {
            tid: talents_pivot[tid]
            for tid in patchs
            if tid not in {c["talent_id"] for c in creations}
        },
        "emails_ajoutes": [],
        "phones_ajoutes": [],
    }
    chemin = dossier_artefacts() / f"ROLLBACK_jarvi_{run_id}.json"
    chemin.write_text(json.dumps(manifeste, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nmanifeste de rollback : {chemin.name}")

    try:
        for i in range(0, len(creations), 200):
            # Pas de merge-duplicates : talent_id est la cle primaire, une
            # collision doit etre bruyante et non un ecrasement silencieux.
            appeler(
                "talent",
                "POST",
                profil="pivot",
                prefer="return=minimal",
                corps=creations[i : i + 200],
            )
        for i in range(0, len(nouveaux_liens), 200):
            appeler(
                "talent_source",
                "POST",
                profil="pivot",
                prefer="return=minimal,resolution=ignore-duplicates",
                corps=nouveaux_liens[i : i + 200],
            )
        for tid, patch in patchs.items():
            appeler(
                f"talent?talent_id=eq.{echapper(tid)}",
                "PATCH",
                profil="pivot",
                prefer="return=minimal",
                corps=patch,
            )
        for i in range(0, len(conflits), 200):
            appeler(
                "conflit",
                "POST",
                profil="pivot",
                prefer="return=minimal",
                corps=conflits[i : i + 200],
            )
    except Exception as err:
        # REGLE 1 : ne jamais avancer le curseur sur exception.
        appeler(
            f"sync_etat?source=eq.{SOURCE}",
            "PATCH",
            profil="pivot",
            prefer="return=minimal",
            corps={
                "statut": "erreur",
                "termine_le": datetime.now(UTC).isoformat(),
                "message_erreur": str(err)[:300],
                "runs_total": (etat.get("runs_total") or 0) + 1,
            },
        )
        raise Incident(f"ECHEC : {err}. Curseur NON avance, manifeste {chemin.name}") from err

    # REGLE 2 : reculer d'1 ms sur succes.
    appeler(
        f"sync_etat?source=eq.{SOURCE}",
        "PATCH",
        profil="pivot",
        prefer="return=minimal",
        corps={
            "curseur": nouveau_curseur,
            "statut": "ok",
            "termine_le": datetime.now(UTC).isoformat(),
            "message_erreur": None,
            "volume_dernier_run": st["lus"],
            "runs_total": (etat.get("runs_total") or 0) + 1,
        },
    )
    appeler(
        "sync_run",
        "POST",
        profil="pivot",
        prefer="return=minimal",
        corps=[
            {
                "run_id": run_id,
                "source": SOURCE,
                "statut": "ok",
                "demarre_le": debut.isoformat(),
                "termine_le": datetime.now(UTC).isoformat(),
                "attendus": st["lus"],
                "lus": st["lus"],
                "talents_crees": st["creation"],
                "talents_majs": st["maj"] + st["lien"],
                "conflits": st["conflits"],
                "curseur_avant": curseur,
                "curseur_apres": nouveau_curseur,
                "message": f"{len(ambigus)} ambigu(s)" if ambigus else None,
            }
        ],
    )
    print(f"\n✅ ecrit. curseur {SOURCE} -> {nouveau_curseur}")


if __name__ == "__main__":
    main()
