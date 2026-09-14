"""Le moteur d'inclusion : normalisation, cles de rapprochement, preseance.

UNE SEULE definition de la cascade, pour tous les connecteurs.

Pourquoi ce module existe
-------------------------
La meme logique a ete ecrite trois fois : dans le script de construction de
juillet, dans le connecteur app, et dans son portage JavaScript pour n8n. Le
resultat s'est vu : le bug de la colonne `employeur_actuel_src` existait dans
la version Python et pas dans la version JavaScript, parce qu'il n'avait ete
corrige que d'un cote. Une regle metier ecrite deux fois est une regle qui
divergera.

Les fonctions ci-dessous sont reprises MOT POUR MOT de `app_pivot.py`, ou elles
ont ete eprouvees en production. Elles ne doivent pas etre « ameliorees » sans
mesure : chaque detail y est paye par un incident.
"""

from __future__ import annotations

import re
import unicodedata

GENERIC = {
    "contact",
    "info",
    "hello",
    "bonjour",
    "rh",
    "recrutement",
    "recruitment",
    "jobs",
    "job",
    "hr",
    "admin",
    "team",
    "sales",
    "support",
    "noreply",
    "no-reply",
    "contactez",
    "direction",
    "compta",
}


def nonempty(v):
    return v is not None and str(v).strip() != "" and v != [] and v != {}


def nemail(e):
    e = (e or "").strip().lower()
    return e if "@" in e and "." in e else None


def is_generic(e):
    return e.split("@")[0] in GENERIC


def nphone(p):
    d = re.sub(r"\D", "", str(p or ""))
    return d[-9:] if len(d) >= 9 else None


def nli(u):
    if not u:
        return None
    s = str(u).strip().lower().split("?")[0]
    m = re.search(r"/in/([^/]+)", s)
    if m:
        return "in:" + m.group(1).strip("/")
    s = re.sub(r"^https?://", "", s)
    s = re.sub(r"^www\.", "", s)
    return s.rstrip("/") or None


def sa(x):  # strip accents — gardé identique à t4_build_pivot_v1.py:18
    return "".join(
        c for c in unicodedata.normalize("NFD", str(x)) if unicodedata.category(c) != "Mn"
    )


def meme_valeur(a, b):
    """Deux valeurs sont-elles la MÊME, aux différences cosmétiques près ?
    Sinon on journaliserait des conflits sur « András » vs « Andras » ou
    « Paris, France, Paris, France » vs « Paris, France » — du bruit qui rend
    le journal des conflits inutile. On compare accents ôtés, casse repliée,
    segments (séparés par virgule) dédupliqués en gardant l'ordre."""

    def norm(v):
        t = re.sub(r"\s+", " ", sa(v).lower()).strip()
        seg, vus = [], set()
        for p in (x.strip() for x in t.split(",")):
            if p and p not in vus:
                vus.add(p)
                seg.append(p)
        return ", ".join(seg)

    return norm(a) == norm(b)


# Une cle d'identite doit etre une VRAIE identite. Verifie le 24/08/2026 :
# candidat.linkedin contient 53 valeurs poubelle utilisees comme cle —
# « linkedin.com », « test », des noms tapes a la main — et trois dores ont
# fusionne des PERSONNES DISTINCTES a cause d'elles. On n'accepte qu'un
# chemin /in/<slug>. Cout mesure : 98 % des slugs le sont deja.
_SLUG_OK = re.compile(r"^in:[a-z0-9\-_%.]{4,}$")


def slug_utilisable(s):
    return bool(s) and bool(_SLUG_OK.fullmatch(s))


def akeys_from_mirror(c):
    """Mêmes clés que t4 akeys(), sur les colonnes du miroir (linkedin, email_perso)."""
    ks = set()
    sl = nli(c.get("linkedin"))
    if slug_utilisable(sl):
        ks.add("s:" + sl)
    em = nemail(c.get("email_perso"))
    if em and not is_generic(em):
        ks.add("e:" + em)
    return ks


def num(v):
    try:
        return float(str(v).replace(",", ".")) if nonempty(v) else None
    except ValueError:
        return None


def txt(v):
    return str(v).strip() if nonempty(v) else None


# Champs dont Jarvi est maitre. Le connecteur app ne les ecrase pas ; le
# connecteur Jarvi, lui, les impose. La colonne de provenance n'est PAS
# « <champ>_src » pour employeur_actuel : c'est « employeur_src ». Piege
# paye deux fois — une fois a l'ecriture, une fois a la lecture.
IDENT = ["prenom", "nom", "localisation", "employeur_actuel"]

SRC = {
    "prenom": "prenom_src",
    "nom": "nom_src",
    "localisation": "localisation_src",
    "employeur_actuel": "employeur_src",
}
