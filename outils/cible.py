#!/usr/bin/env python3
"""Sur quel projet Supabase l'application est-elle branchée, et bascule.

    python3 outils/cible.py              # état des lieux et contrôles
    python3 outils/cible.py dev          # brancher l'application sur le dev
    python3 outils/cible.py live --je-sais-ce-que-je-fais

Le risque n'est pas de ne pas pouvoir basculer : c'est de basculer sans le
savoir, ou de croire qu'on lit le dev en écrivant dans la production. Cet outil
existe donc surtout pour la commande sans argument — celle qui répond.

Un seul endroit porte les accès aux deux projets : `env/projets.env`, ignoré par
git. Les fichiers de configuration des composants en sont DÉRIVÉS. Aucun
composant ne lit `env/projets.env` directement.

Ce qui est basculé :
    frontend/.env.local   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
    backend/api/.env      SUPABASE_URL   (sert à déduire le JWKS)

Ce qui n'est JAMAIS touché :
    .env.local (racine)   les connecteurs alimentent la PRODUCTION. Les faire
                          pointer ailleurs viderait le pivot de sa source.
    supabase/.temp        la CLI, qui se rattache par `supabase link`.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
PROJETS = RACINE / "env" / "projets.env"

# Fichier -> variables à réécrire, sous la forme (nom, suffixe dans projets.env)
GERES: dict[str, list[tuple[str, str]]] = {
    "frontend/.env.local": [
        ("NEXT_PUBLIC_SUPABASE_URL", "URL"),
        ("NEXT_PUBLIC_SUPABASE_ANON_KEY", "ANON_KEY"),
    ],
    "backend/api/.env": [("SUPABASE_URL", "URL")],
}

MARQUEUR = "# CIBLE ="


def lire_env(chemin: Path) -> dict[str, str]:
    valeurs: dict[str, str] = {}
    if not chemin.exists():
        return valeurs
    for ligne in chemin.read_text().splitlines():
        ligne = ligne.strip()
        if ligne and not ligne.startswith("#") and "=" in ligne:
            cle, valeur = ligne.split("=", 1)
            valeurs.setdefault(cle.strip(), valeur.strip().strip("\"'"))
    return valeurs


def projets() -> dict[str, dict[str, str]]:
    if not PROJETS.exists():
        raise SystemExit(f"{PROJETS} absent — impossible de savoir quels projets existent")
    brut = lire_env(PROJETS)
    sortie: dict[str, dict[str, str]] = {}
    for nom, prefixe in (("live", "PACHA_LIVE_"), ("dev", "PACHA_DEV_")):
        sortie[nom] = {
            "ref": brut.get(prefixe + "REF", ""),
            "URL": brut.get(prefixe + "URL", ""),
            "ANON_KEY": brut.get(prefixe + "ANON_KEY", ""),
            "SERVICE_ROLE_KEY": brut.get(prefixe + "SERVICE_ROLE_KEY", ""),
        }
        if not sortie[nom]["URL"]:
            raise SystemExit(f"{prefixe}URL absente de {PROJETS.name}")
    return sortie


def nommer(url: str, p: dict[str, dict[str, str]]) -> str:
    """Le nom du projet derrière une URL. « inconnu » est une réponse utile."""
    if not url:
        return "—"
    for nom, infos in p.items():
        if url.rstrip("/") == infos["URL"].rstrip("/"):
            return nom
    ref = re.sub(r"https?://([a-z0-9]+)\..*", r"\1", url)
    return f"INCONNU ({ref})"


# ------------------------------------------------------------------ bascule
def ecrire(chemin: Path, variables: list[tuple[str, str]], infos: dict[str, str],
           cible: str) -> list[str]:
    texte = chemin.read_text() if chemin.exists() else ""
    modifs = []
    for nom, champ in variables:
        valeur = infos[champ]
        motif = re.compile(rf"^{re.escape(nom)}=.*$", re.M)
        if motif.search(texte):
            avant = motif.search(texte).group(0)  # type: ignore[union-attr]
            if avant != f"{nom}={valeur}":
                modifs.append(nom)
            texte = motif.sub(f"{nom}={valeur}", texte)
        else:
            texte = texte.rstrip("\n") + f"\n{nom}={valeur}\n"
            modifs.append(nom)
    entete = f"{MARQUEUR} {cible}  ({infos['ref']})"
    texte = re.sub(rf"^{re.escape(MARQUEUR)}.*$\n?", "", texte, flags=re.M)
    texte = entete + "\n" + texte.lstrip("\n")
    chemin.write_text(texte)
    return modifs


def basculer(cible: str) -> None:
    p = projets()
    infos = p[cible]
    print(f"bascule vers « {cible} » — projet {infos['ref']}\n")
    for relatif, variables in GERES.items():
        chemin = RACINE / relatif
        modifs = ecrire(chemin, variables, infos, cible)
        etat = ", ".join(modifs) if modifs else "déjà à jour"
        print(f"  {relatif:24} {etat}")
    print(
        "\n  ⚠️  Next.js incorpore les variables NEXT_PUBLIC_* à la compilation :\n"
        "     redémarrer `npm run dev`, ou reconstruire, pour que ça prenne effet."
    )


# ------------------------------------------------------------------ contrôles
def joindre(url: str, cle: str, chemin: str, profil: str | None = None) -> str:
    entetes = {"apikey": cle, "Authorization": f"Bearer {cle}",
               "Prefer": "count=exact", "Range": "0-0"}
    if profil:
        entetes["Accept-Profile"] = profil
    requete = urllib.request.Request(  # noqa: S310 — URL construite
        f"{url.rstrip('/')}/rest/v1/{chemin}", headers=entetes, method="HEAD")
    try:
        with urllib.request.urlopen(requete, timeout=30) as reponse:  # noqa: S310
            plage = reponse.headers.get("Content-Range", "?")
            return plage.rsplit("/", 1)[-1]
    except urllib.error.HTTPError as e:
        return f"HTTP {e.code}"
    except OSError as e:
        return f"injoignable ({e.__class__.__name__})"


def joindre_auth(url: str, cle: str) -> str:
    """L'authentification est le SEUL usage actuel du client Supabase par le
    frontend. Vérifier que REST répond ne dit donc rien de ce dont il se sert."""
    requete = urllib.request.Request(  # noqa: S310 — URL construite
        f"{url.rstrip('/')}/auth/v1/settings",
        headers={"apikey": cle, "Authorization": f"Bearer {cle}"},
    )
    try:
        with urllib.request.urlopen(requete, timeout=30) as reponse:  # noqa: S310
            corps = json.loads(reponse.read() or "{}")
            actifs = [
                nom for nom, ouvert in (corps.get("external") or {}).items() if ouvert
            ]
            return "ok (" + ", ".join(sorted(actifs)[:3]) + ")" if actifs else "ok"
    except urllib.error.HTTPError as e:
        return f"HTTP {e.code}"
    except OSError as e:
        return f"injoignable ({e.__class__.__name__})"


def etat() -> int:
    p = projets()
    soucis: list[str] = []

    print("LES DEUX PROJETS\n")
    for nom, infos in p.items():
        print(f"  {nom:5} {infos['ref']}  {infos['URL']}")

    print("\nSUR QUOI CHAQUE MORCEAU EST BRANCHÉ\n")
    vues: dict[str, str] = {}
    for relatif, variables in GERES.items():
        valeurs = lire_env(RACINE / relatif)
        url = valeurs.get(variables[0][0], "")
        vues[relatif] = nommer(url, p)
        print(f"  {relatif:24} {vues[relatif]}")

    connecteurs = nommer(lire_env(RACINE / ".env.local").get("SUPABASE_URL", ""), p)
    print(f"  {'.env.local (connecteurs)':24} {connecteurs}")
    ref_cli = (RACINE / "supabase" / ".temp" / "project-ref")
    cli = ref_cli.read_text().strip() if ref_cli.exists() else "—"
    nom_cli = next((n for n, i in p.items() if i["ref"] == cli), f"INCONNU ({cli})")
    print(f"  {'CLI Supabase':24} {nom_cli}")

    print("\nCE QUI DOIT ÊTRE VRAI\n")

    cibles = set(vues.values())
    if len(cibles) > 1:
        soucis.append(
            "le frontend et l'API ne visent pas le même projet : le JWKS ne "
            "correspondrait pas et AUCUN jeton ne serait validé"
        )
        print("  ✗ frontend et API sur le même projet — non : " + ", ".join(sorted(cibles)))
    else:
        print(f"  ✓ frontend et API sur le même projet ({cibles.pop()})")

    if connecteurs != "live":
        soucis.append(
            f"les connecteurs visent « {connecteurs} » et non la production : "
            "le pivot cesserait d'être alimenté par sa vraie source"
        )
        print(f"  ✗ connecteurs sur la production — non, sur « {connecteurs} »")
    else:
        print("  ✓ connecteurs sur la production, comme il faut")

    inconnus = [v for v in [*list(vues.values()), connecteurs, nom_cli] if v.startswith("INCONNU")]
    if inconnus:
        soucis.append("un composant vise un projet absent de env/projets.env : " + ", ".join(inconnus))
        print("  ✗ tous les projets visés sont connus — non : " + ", ".join(inconnus))
    else:
        print("  ✓ tous les projets visés sont connus")

    print("\nLES DEUX BASES RÉPONDENT-ELLES ?\n")
    print(f"  {'projet':6} {'REST anon':>12} {'REST service':>14} {'auth':>16}"
          "   (lignes dans public.mandat)")
    for nom, infos in p.items():
        a = joindre(infos["URL"], infos["ANON_KEY"], "mandat")
        srv = joindre(infos["URL"], infos["SERVICE_ROLE_KEY"], "mandat")
        auth = joindre_auth(infos["URL"], infos["ANON_KEY"])
        print(f"  {nom:6} {a:>12} {srv:>14} {auth:>16}")
        if srv.startswith(("HTTP", "injoignable")):
            soucis.append(f"projet « {nom} » : la clé de service ne lit pas public.mandat ({srv})")
        if not auth.startswith("ok"):
            soucis.append(f"projet « {nom} » : l'authentification ne répond pas ({auth})")

    print()
    if soucis:
        print(f"{len(soucis)} PROBLÈME(S) :")
        for s in soucis:
            print("   " + s)
        return 2
    print("Tout est en ordre.")
    return 0


def main() -> int:
    args = sys.argv[1:]
    if not args:
        return etat()
    cible = args[0]
    if cible not in ("dev", "live"):
        print(f"cible inconnue « {cible} » — attendu : dev ou live", file=sys.stderr)
        return 2
    if cible == "live" and "--je-sais-ce-que-je-fais" not in args:
        print(
            "REFUS : brancher l'application locale sur la PRODUCTION demande\n"
            "        --je-sais-ce-que-je-fais.\n\n"
            "        Le dev porte la même structure et 369 730 lignes anonymisées.\n"
            "        Si le besoin est de lire une donnée réelle, une requête ciblée\n"
            "        avec la clé de service coûte moins cher que de brancher toute\n"
            "        l'application dessus.",
            file=sys.stderr,
        )
        return 2
    if cible == "live":
        print("⚠️  L'APPLICATION LOCALE VA LIRE LA PRODUCTION — 30 829 personnes réelles.\n")
    basculer(cible)
    print()
    return etat()


if __name__ == "__main__":
    raise SystemExit(main())
