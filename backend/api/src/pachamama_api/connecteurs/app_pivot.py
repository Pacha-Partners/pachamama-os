#!/usr/bin/env python3
"""
Connecteur miroir → pivot, source « app ».

Ce que c'est
------------
Le premier run du moteur d'inclusion en régime CONTINU, pas un script jetable.
Il fait passer chaque fiche `candidat` modifiée depuis le dernier curseur du
MIROIR (Supabase) au PIVOT, en la rapprochant des dorés déjà en base — sans tout
reclusteriser. C'est ce qui rend le pivot « courant » plutôt qu'instantané.

Il lit le MIROIR, pas l'API Bubble : c'est la décision d'architecture (une couche
de protection entre les sources et le pivot). Le moteur de build initial
(t4_build_pivot_v1.py), lui, lisait un export + l'API ; ce connecteur reprend ses
CLÉS de rapprochement à l'identique — slug LinkedIn et email perso non générique —
pour ne pas rapprocher autrement que lui.

Ce qu'il fait, par fiche `candidat`
-----------------------------------
  • external_id déjà lié (talent_source app) → MISE À JOUR avec préséance,
    conflits journalisés.
  • sinon, rapprochement en cascade (mêmes clés) contre les dorés existants :
      - une clé correspond          → LIAISON à ce doré (fusion), préséance.
      - aucune clé                  → CRÉATION d'un doré app_only.

Préséance (matrice tâche 3)
---------------------------
Jarvi gagne l'identité (prénom, nom, localisation, employeur). L'app ne réécrit
un de ces champs QUE s'il est vide côté doré ; s'il vient de Jarvi et que l'app
diverge, Jarvi est retenu et l'écart est JOURNALISÉ dans pivot.conflit.
Règle d'écriture concurrente retenue : l'horodatage source le plus récent gagne ;
on rejette plus ancien que l'état courant (ici garanti par le curseur, qui ne
traite jamais une fiche antérieure à lui).

Discipline de curseur — 4 règles, chacune payée par un incident réel
--------------------------------------------------------------------
  1. le curseur n'avance JAMAIS sur exception ;
  2. il recule d'1 ms sur succès (le « > » strict exclut les ex æquo) ;
  3. le total est lu AVANT, et la lecture refuse de conclure si elle est
     tronquée ou si la table a bougé (PostgREST plafonne à 1000 en silence) ;
  4. pagination déterministe (updated_at, id).

Sûreté
------
DRY-RUN par défaut : calcule tout, n'écrit rien. `--appliquer` pour écrire.
Idempotent : rejouer un run ne duplique ni ne régresse rien.

Usage
-----
  python -m pachamama_api.connecteurs.app_pivot              # simulation
  python -m pachamama_api.connecteurs.app_pivot --appliquer  # écrit dans le pivot
  python -m pachamama_api.connecteurs.app_pivot --plein      # ignore le curseur
"""

import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime, timedelta

from pachamama_api.connecteurs.commun import acces_supabase, dossier_artefacts

# La configuration vient de config.py (pydantic-settings, qui lit .env puis
# .env.local). Plus aucun fichier .env reparse a la main : une seule facon
# d'obtenir un secret dans tout le projet.
SUPA, CLE = acces_supabase()

LOT = 1000
APPLIQUER = "--appliquer" in sys.argv
PLEIN = "--plein" in sys.argv
LIMITE = next((int(a.split("=")[1]) for a in sys.argv if a.startswith("--limite=")), None)

# --- helpers de normalisation, gardés IDENTIQUES à t4_build_pivot_v1.py:16-31 ---
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


# Une clé d'identité doit être une VRAIE identité. Vérifié le 24/08/2026 :
# candidat.linkedin contient 53 valeurs poubelle utilisées comme clé — « linkedin.com »,
# « test », « bit.ly/… », des noms tapés à la main — et trois dorés ont fusionné des
# personnes DISTINCTES à cause d'elles. On n'accepte qu'un chemin /in/<slug>.
# Coût mesuré : 98 % des slugs le sont déjà ; les rejetés sont tous des déchets.
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


# ------------------------------------------------------------------ accès
class Incident(Exception):
    pass


def http(chemin, methode="GET", profil=None, corps=None, prefer=None, plage=None):
    h = {"apikey": CLE, "Authorization": f"Bearer {CLE}"}
    if profil:
        h["Accept-Profile"] = h["Content-Profile"] = profil
    if prefer:
        h["Prefer"] = prefer
    if plage:
        h["Range"] = plage
    data = None
    if corps is not None:
        h["Content-Type"] = "application/json"
        data = json.dumps(corps).encode()

    # interne, jamais depuis une entrée utilisateur. Le schéma est toujours https.
    req = urllib.request.Request(  # noqa: S310
        f"{SUPA}/rest/v1/{chemin}", data=data, headers=h, method=methode
    )
    with urllib.request.urlopen(req, timeout=240) as r:  # noqa: S310
        b = r.read()
        return (json.loads(b) if b else None), r.headers.get("Content-Range")


def total(chemin, profil=None):
    sep = "&" if "?" in chemin else "?"
    _, cr = http(f"{chemin}{sep}limit=1", profil=profil, prefer="count=exact")
    if not cr or "/" not in cr:
        raise Incident(f"{chemin} : aucun total annoncé")
    return int(cr.rsplit("/", 1)[1])


def lire_tout(chemin, tri, profil=None):
    """Lecture paginée, encadrée par deux comptages : distingue une troncature
    (PostgREST plafonne à 1000 en silence) d'une table qui bouge (le sync écrit)."""
    sep = "&" if "?" in chemin else "?"
    for _ in range(4):
        avant = total(chemin, profil)
        out, off = [], 0
        while True:
            page, _ = http(f"{chemin}{sep}order={tri}&limit={LOT}&offset={off}", profil=profil)
            if not page:
                break
            out += page
            if len(page) < LOT:
                break
            off += LOT
        if total(chemin, profil) != avant:
            continue  # a bougé : on relit
        if len(out) != avant:
            raise Incident(f"{chemin} : {len(out)} lues / {avant} annoncées — tronqué")
        return out
    raise Incident(f"{chemin} : bouge trop pour une lecture cohérente")


def minus1ms(iso):
    m = re.sub(r"\.(\d{1,6})", lambda x: "." + x.group(1).ljust(6, "0"), iso.replace("Z", "+00:00"))
    d = datetime.fromisoformat(m).astimezone(UTC) - timedelta(milliseconds=1)
    return d.strftime("%Y-%m-%dT%H:%M:%S.") + f"{d.microsecond // 1000:03d}Z"


# ------------------------------------------------------------------ index doré
IDENT = ["prenom", "nom", "localisation", "employeur_actuel"]  # champs à préséance Jarvi
SRC = {
    "prenom": "prenom_src",
    "nom": "nom_src",
    "localisation": "localisation_src",
    "employeur_actuel": "employeur_src",
}


def charger_index():
    """Clé de rapprochement → talent_id, à partir des dorés EXISTANTS.
    Une clé qui pointerait deux dorés est une ambiguïté : on la neutralise
    (rapprochement refusé) plutôt que de fusionner à l'aveugle."""
    talents = {
        t["talent_id"]: t
        for t in lire_tout(
            "talent?select=talent_id,type_fusion,prenom,prenom_src,nom,nom_src,"
            "localisation,localisation_src,employeur_actuel,employeur_src,url_linkedin,cv_url",
            "talent_id.asc",
            profil="pivot",
        )
    }
    liens = lire_tout(
        "talent_source?select=talent_id,source,external_id", "talent_id.asc", profil="pivot"
    )
    app_ext = {x["external_id"]: x["talent_id"] for x in liens if x["source"] == "app"}
    emails = lire_tout("email?select=talent_id,email,generique", "talent_id.asc", profil="pivot")

    cle2t, ambigues = {}, set()

    def poser(k, tid):
        if k in ambigues:
            return
        if k in cle2t and cle2t[k] != tid:
            ambigues.add(k)
            cle2t.pop(k, None)
        else:
            cle2t[k] = tid

    for t in talents.values():
        sl = nli(t.get("url_linkedin"))
        if slug_utilisable(sl):
            poser("s:" + sl, t["talent_id"])
    for e in emails:
        if not e.get("generique") and e.get("email") and not is_generic(e["email"]):
            poser("e:" + e["email"], e["talent_id"])
    maxseq = 0
    for tid in talents:
        m = re.fullmatch(r"T(\d+)", tid or "")
        if m:
            maxseq = max(maxseq, int(m.group(1)))
    return talents, app_ext, cle2t, ambigues, maxseq


def emails_phones_talent():
    e = {}
    for x in lire_tout("email?select=talent_id,email", "talent_id.asc", profil="pivot"):
        e.setdefault(x["talent_id"], set()).add(x["email"])
    p = {}
    for x in lire_tout("phone?select=talent_id,tel", "talent_id.asc", profil="pivot"):
        p.setdefault(x["talent_id"], set()).add(x["tel"])
    return e, p


# ------------------------------------------------------------------ run
def main():
    horod = datetime.now(UTC)
    run_id = "app-" + horod.strftime("%Y%m%dT%H%M%SZ")
    print(
        f"# Connecteur app → pivot   {'(DRY-RUN)' if not APPLIQUER else '(ÉCRITURE)'}"
        f"{' [PLEIN]' if PLEIN else ''}\n"
    )

    etat = (http("sync_etat?select=*&source=eq.app", profil="pivot")[0] or [None])[0]
    if etat is None:
        sys.exit("pivot.sync_etat n'a pas de ligne 'app'. Lancer correctif 03 d'abord.")
    curseur = None if PLEIN else etat.get("curseur")
    print(f"curseur app : {curseur or '(vierge — premier run, toutes les fiches)'}\n")

    print("1. Index des dorés existants")
    talents, app_ext, cle2t, ambigues, maxseq = charger_index()
    em_t, ph_t = emails_phones_talent()
    # Conflits déjà journalisés : on ne réinscrit pas un conflit identique.
    # Rend pivot.conflit idempotent (un rejeu --plein ne duplique plus), et garde
    # le journal lisible : une ligne par divergence non résolue, pas mille répétitions.
    conflits_vus = set()
    for x in lire_tout(
        "conflit?select=talent_id,champ,valeur_ecartee", "conflit_id.asc", profil="pivot"
    ):
        conflits_vus.add((x["talent_id"], x["champ"], x.get("valeur_ecartee")))
    print(
        f"   {len(talents)} dorés · {len(app_ext)} déjà liés à l'app · "
        f"{len(cle2t)} clés · {len(ambigues)} clé(s) ambiguë(s) neutralisée(s)\n"
    )

    print("2. Fiches candidat du miroir à traiter")
    filt = "" if curseur is None else f"&updated_at=gt.{urllib.parse.quote(curseur)}"
    cands = lire_tout(
        f"candidat?select=id,linkedin,email_perso,telephone,prenom,nom,localisations_filtre,"
        f"metier_actuel,cv_url,univers,niveau_anglais,est_qualifie,updated_at{filt}",
        "updated_at.asc,id.asc",
        profil="public",
    )
    if LIMITE is not None:
        cands = cands[:LIMITE]
        print(f"   {len(cands)} fiche(s) [BORNÉ à {LIMITE} pour test d'écriture]\n")
    else:
        print(f"   {len(cands)} fiche(s)\n")
    if not cands:
        print("Rien à traiter : le pivot est déjà à jour pour la source app.")
        return

    # emploi actuel (nom d'entreprise) via job_actuel du miroir
    # job_actuel.entreprise_nom contient un IDENTIFIANT Bubble dans ~69 % des cas
    # (le mapper du miroir a stocké l'id là où un nom est attendu). On le résout
    # contre la table entreprise : sans cela le pivot reçoit des identifiants en
    # guise de nom d'employeur, et le journal des conflits devient illisible.
    _EST_ID = re.compile(r"^\d{10,}x\d+$")
    ent_nom = {
        e["id"]: e.get("nom")
        for e in lire_tout("entreprise?select=id,nom", "id.asc", profil="public")
    }

    def _employeur(v):
        if not nonempty(v):
            return None
        t = str(v).strip()
        if _EST_ID.fullmatch(t):
            return ent_nom.get(t)  # None si l'id ne résout pas : on n'invente pas
        return t

    jac = {
        j["candidat_id"]: _employeur(j.get("entreprise_nom"))
        for j in lire_tout(
            "job_actuel?select=candidat_id,entreprise_nom", "candidat_id.asc", profil="public"
        )
        if j.get("candidat_id")
    }

    # PASSE 2 — attentes (← job_rêve) et qualif (← candidat). Champs absents du
    # miroir laissés nuls (contrats/remotes/secteurs/nogo pour attentes ;
    # product/profil/expertises/background pour qualif) : on n'invente pas.
    jr_by = {}
    for j in lire_tout(
        "job_reve?select=candidat_id,metier,univers,salaire,salaire_maximum,"
        "tjm_minimum,tjm_maximum,disponibilite,description",
        "candidat_id.asc",
        profil="public",
    ):
        cid = j.get("candidat_id")
        if not cid:
            continue
        score = sum(
            1 for k in ("metier", "salaire", "disponibilite", "description") if nonempty(j.get(k))
        )
        if cid not in jr_by or score > jr_by[cid][0]:
            jr_by[cid] = (score, j)
    jr_by = {k: v[1] for k, v in jr_by.items()}
    att_exist = {
        x["talent_id"]: x
        for x in lire_tout(
            "attentes?select=talent_id,metier_vise,univers_vise,salaire_min,salaire_souhaite,"
            "tjm_min,tjm_souhaite,disponibilite,description",
            "talent_id.asc",
            profil="pivot",
        )
    }
    qual_exist = {
        x["talent_id"]: x
        for x in lire_tout(
            "qualification?select=talent_id,univers,anglais,niveau_qualifie",
            "talent_id.asc",
            profil="pivot",
        )
    }

    # RÈGLE D'ÉCRITURE CONCURRENTE — la plus récente gagne.
    # Une même personne peut exister en double dans l'app (deux candidats liés au
    # même doré), avec des valeurs qui se contredisent. Sans arbitrage, chacune
    # écrase l'autre à chaque run : churn perpétuel. On désigne donc, par doré,
    # la fiche app au updated_at le plus grand comme SEULE autorité sur l'identité ;
    # les autres ne versent que leurs emails/téléphones (union, idempotente).
    autorite = {}  # talent_id -> external_id gagnant
    for _c in cands:
        _t = app_ext.get(_c["id"])
        if _t is None:
            continue
        _u = _c.get("updated_at") or ""
        if _t not in autorite or _u > autorite[_t][0]:
            autorite[_t] = (_u, _c["id"])

    st = {
        "maj": 0,
        "lien": 0,
        "creation": 0,
        "conflits": 0,
        "emails+": 0,
        "phones+": 0,
        "ambigu_saute": 0,
        "attentes+": 0,
        "qualif+": 0,
    }
    ambigus, conflits, patchs_talent, inserts_talent, inserts_src, inserts_email, inserts_phone = (
        [],
        [],
        [],
        [],
        [],
        [],
        [],
    )
    resolu = {}  # external_id -> talent_id résolu (pour la passe 2)
    seq = maxseq
    max_updated = curseur

    def val_app(c):
        return {
            "prenom": c.get("prenom"),
            "nom": c.get("nom"),
            "localisation": c.get("localisations_filtre"),
            "employeur_actuel": jac.get(c["id"]),
            "url_linkedin": c.get("linkedin"),
            "cv_url": c.get("cv_url"),
        }

    def preseance(tid, dore, c):
        """Applique l'app sur un doré existant. Jarvi garde l'identité ; l'app ne
        comble que le vide, et toute divergence sur un champ tenu par Jarvi est
        journalisée. Renvoie le dict de PATCH (peut être vide)."""
        av = val_app(c)
        patch = {}
        for champ in IDENT:
            src = dore.get(SRC[champ])
            cur = dore.get(champ)
            app = av[champ]
            if not nonempty(app):
                continue
            if not nonempty(cur):
                patch[champ] = app
                patch[SRC[champ]] = "app"
            elif src == "jarvi":
                if not meme_valeur(cur, app):
                    _ck = (tid, champ, str(app))
                    if _ck not in conflits_vus:
                        conflits.append(
                            {
                                "talent_id": tid,
                                "champ": champ,
                                "valeur_retenue": str(cur),
                                "source_retenue": "jarvi",
                                "valeur_ecartee": str(app),
                                "source_ecartee": "app",
                                "regle": "matrice",
                                "run_id": run_id,
                            }
                        )
                        conflits_vus.add(_ck)
                        st["conflits"] += 1
            elif src == "app":
                if not meme_valeur(cur, app):
                    patch[champ] = app  # même source, valeur plus récente
        if not nonempty(dore.get("url_linkedin")) and nonempty(av["url_linkedin"]):
            patch["url_linkedin"] = av["url_linkedin"]
        if not nonempty(dore.get("cv_url")) and nonempty(av["cv_url"]):
            patch["cv_url"] = av["cv_url"]
        return patch

    def ajouter_contacts(tid, c):
        em = nemail(c.get("email_perso"))
        if em and em not in em_t.get(tid, set()):
            inserts_email.append(
                {"talent_id": tid, "email": em, "source": "app", "generique": is_generic(em)}
            )
            em_t.setdefault(tid, set()).add(em)
            st["emails+"] += 1
        ph = nphone(c.get("telephone"))
        if ph and ph not in ph_t.get(tid, set()):
            inserts_phone.append({"talent_id": tid, "tel": ph, "source": "app"})
            ph_t.setdefault(tid, set()).add(ph)
            st["phones+"] += 1

    def num(v):
        try:
            return float(str(v).replace(",", ".")) if nonempty(v) else None
        except ValueError:
            return None

    def txt(v):
        return str(v).strip() if nonempty(v) else None

    ATT_CH = [
        "metier_vise",
        "univers_vise",
        "salaire_min",
        "salaire_souhaite",
        "tjm_min",
        "tjm_souhaite",
        "disponibilite",
        "description",
    ]
    QUAL_CH = ["univers", "anglais", "niveau_qualifie"]

    def build_attentes(tid, jr):
        if not jr:
            return None
        a2 = {
            "talent_id": tid,
            "metier_vise": txt(jr.get("metier")),
            "univers_vise": txt(jr.get("univers")),
            "salaire_min": num(jr.get("salaire")),
            "salaire_souhaite": num(jr.get("salaire_maximum")),
            "tjm_min": num(jr.get("tjm_minimum")),
            "tjm_souhaite": num(jr.get("tjm_maximum")),
            "disponibilite": txt(jr.get("disponibilite")),
            "description": txt(jr.get("description")),
        }
        return a2 if any(a2[k] is not None for k in ATT_CH) else None

    def build_qualif(tid, c):
        eq = c.get("est_qualifie")
        q2 = {
            "talent_id": tid,
            "univers": txt(c.get("univers")),
            "anglais": txt(c.get("niveau_anglais")),
            "niveau_qualifie": ("oui" if eq is True else "non" if eq is False else None),
        }
        return q2 if any(q2[k] is not None for k in QUAL_CH) else None

    def meme_row(desir, exist, champs):
        if exist is None:
            return False
        for k in champs:
            dv, ev = desir.get(k), exist.get(k)
            if isinstance(dv, float) or isinstance(ev, float):
                if (dv is None) != (ev is None):
                    return False
                try:
                    if dv is not None and float(dv) != float(ev):
                        return False
                except (TypeError, ValueError):
                    return False
            else:
                if (dv if nonempty(dv) else None) != (ev if nonempty(ev) else None):
                    return False
        return True

    for c in cands:
        if c.get("updated_at") and (max_updated is None or c["updated_at"] > max_updated):
            max_updated = c["updated_at"]
        ext = c["id"]
        av = val_app(c)

        if ext in app_ext:  # déjà lié → mise à jour
            tid = app_ext[ext]
            resolu[ext] = tid
            gagnant = autorite.get(tid, (None, ext))[1] == ext
            patch = preseance(tid, talents[tid], c) if gagnant else {}
            if patch:
                patchs_talent.append((tid, patch))
                st["maj"] += 1
            ajouter_contacts(tid, c)
            continue

        ks = akeys_from_mirror(c)
        cibles = {cle2t[k] for k in ks if k in cle2t}
        touchees_ambigues = any(k in ambigues for k in ks)
        if len(cibles) == 1:  # rapprochement → liaison
            tid = next(iter(cibles))
            resolu[ext] = tid
            inserts_src.append({"talent_id": tid, "source": "app", "external_id": ext})
            app_ext[ext] = tid
            if talents[tid].get("type_fusion") == "jarvi_only":
                patchs_talent.append((tid, {"type_fusion": "merged"}))
            patch = preseance(tid, talents[tid], c)
            if patch:
                patchs_talent.append((tid, patch))
            ajouter_contacts(tid, c)
            st["lien"] += 1
        elif len(cibles) > 1 or touchees_ambigues:  # ambigu → on ne devine pas
            # pivot.conflit.talent_id est NOT NULL : une ambiguité n'a PAS de doré,
            # elle n'a donc pas sa place dans ce journal. On la compte, on retient
            # l'external_id, et on la trace dans le message du run — jamais un
            # rapprochement deviné.
            st["ambigu_saute"] += 1
            ambigus.append(ext)
        else:  # aucune clé → création
            seq += 1
            tid = f"T{seq:06d}"
            inserts_talent.append(
                {
                    "talent_id": tid,
                    "type_fusion": "app_only",
                    "prenom": av["prenom"],
                    "prenom_src": "app" if nonempty(av["prenom"]) else None,
                    "nom": av["nom"],
                    "nom_src": "app" if nonempty(av["nom"]) else None,
                    "localisation": av["localisation"],
                    "localisation_src": "app" if nonempty(av["localisation"]) else None,
                    "employeur_actuel": av["employeur_actuel"],
                    "employeur_src": "app" if nonempty(av["employeur_actuel"]) else None,
                    "url_linkedin": av["url_linkedin"],
                    "cv_url": av["cv_url"],
                }
            )
            inserts_src.append({"talent_id": tid, "source": "app", "external_id": ext})
            talents[tid] = {"type_fusion": "app_only"}
            app_ext[ext] = tid
            resolu[ext] = tid
            ajouter_contacts(tid, c)
            st["creation"] += 1

    # ---- PASSE 2 : attentes + qualif, autorité = fiche app la plus récente par doré ----
    autor2 = {}
    for c in cands:
        tid = resolu.get(c["id"])
        if not tid:
            continue
        u = c.get("updated_at") or ""
        if tid not in autor2 or u > autor2[tid][0]:
            autor2[tid] = (u, c)
    inserts_attentes, inserts_qualif = [], []
    attentes_avant, qualif_avant = {}, {}
    _cree = {r["talent_id"] for r in inserts_talent}
    for tid, (_, c) in autor2.items():
        a2 = build_attentes(tid, jr_by.get(c["id"]))
        if a2 and not meme_row(a2, att_exist.get(tid), ATT_CH):
            inserts_attentes.append(a2)
            st["attentes+"] += 1
            if tid not in _cree:
                attentes_avant[tid] = att_exist.get(tid)
        q2 = build_qualif(tid, c)
        if q2 and not meme_row(q2, qual_exist.get(tid), QUAL_CH):
            inserts_qualif.append(q2)
            st["qualif+"] += 1
            if tid not in _cree:
                qualif_avant[tid] = qual_exist.get(tid)

    print("3. Ce que le run ferait" if not APPLIQUER else "3. Ce que le run fait")
    for k in [
        "maj",
        "lien",
        "creation",
        "conflits",
        "ambigu_saute",
        "emails+",
        "phones+",
        "attentes+",
        "qualif+",
    ]:
        print(f"   {k:<14} {st[k]}")
    print(f"   nouveau curseur → {minus1ms(max_updated) if max_updated else '(inchangé)'}\n")

    if os.environ.get("DUMP_PAYLOADS"):
        fusion = {}
        for tid, patch in patchs_talent:
            fusion.setdefault(tid, {}).update(patch)
        nouveau = minus1ms(max_updated) if max_updated else curseur
        with open(os.environ["DUMP_PAYLOADS"], "w", encoding="utf-8") as sortie:
            sortie.write(
                json.dumps(
                    {
                        "talent": inserts_talent,
                        "talent_source": inserts_src,
                        "email": inserts_email,
                        "phone": inserts_phone,
                        "conflit": conflits,
                        "attentes": inserts_attentes,
                        "qualification": inserts_qualif,
                        "talent_PATCH": [{"talent_id": t, **pt} for t, pt in fusion.items()],
                        "sync_etat_PATCH": [
                            {
                                "curseur": nouveau,
                                "statut": "ok",
                                "message_erreur": None,
                                "volume_dernier_run": len(cands),
                                "runs_total": etat["runs_total"] + 1,
                                "termine_le": "2026-01-01T00:00:00Z",
                            }
                        ],
                        "sync_run": [
                            {
                                "run_id": run_id,
                                "source": "app",
                                "statut": "ok",
                                "termine_le": "2026-01-01T00:00:00Z",
                                "attendus": len(cands),
                                "lus": len(cands),
                                "talents_crees": st["creation"],
                                "talents_majs": st["maj"] + st["lien"],
                                "conflits": st["conflits"],
                                "curseur_avant": curseur,
                                "curseur_apres": nouveau,
                                "message": None,
                            }
                        ],
                    },
                    ensure_ascii=False,
                )
            )
        print(f"payloads vidés dans {os.environ['DUMP_PAYLOADS']}")
    if not APPLIQUER:
        print("DRY-RUN : aucune écriture. Relancer avec --appliquer pour écrire.")
        return

    # ---- manifeste de rollback : de quoi tout défaire ----
    # Écrit AVANT la première écriture. Il porte l'état d'avant de chaque doré
    # modifié, les créations et les liaisons, plus le curseur précédent.
    fusion = {}
    for tid, patch in patchs_talent:
        fusion.setdefault(tid, {}).update(patch)
    created_ids = [r["talent_id"] for r in inserts_talent]
    created_set = set(created_ids)
    linked_pairs = [
        [r["talent_id"], r["external_id"]] for r in inserts_src if r["talent_id"] not in created_set
    ]
    manifeste = {
        "run_id": run_id,
        "curseur_avant": curseur,
        "created_talent_ids": created_ids,
        "linked_talent_source": linked_pairs,
        "patched_talent_avant": {tid: talents[tid] for tid in fusion if tid not in created_set},
        "emails_ajoutes": [[e["talent_id"], e["email"]] for e in inserts_email],
        "phones_ajoutes": [[p_["talent_id"], p_["tel"]] for p_ in inserts_phone],
        "attentes_avant": attentes_avant,
        "qualif_avant": qualif_avant,
    }
    chemin_manif = str(dossier_artefacts() / f"ROLLBACK_connecteur_{run_id}.json")
    with open(chemin_manif, "w", encoding="utf-8") as sortie:
        sortie.write(json.dumps(manifeste, ensure_ascii=False, indent=1))
    print(f"manifeste de rollback : {os.path.basename(chemin_manif)}")

    # ---- écritures, dans l'ordre des dépendances FK ----
    try:
        for i in range(0, len(inserts_talent), 500):
            # PAS de merge-duplicates : talent_id est la CLÉ PRIMAIRE. Une collision
            # doit lever un 409 bruyant, jamais écraser en silence (le curseur ne
            # bougera pas, cf. règle 1, et le run suivant réallouera proprement).
            http(
                "talent",
                "POST",
                profil="pivot",
                prefer="return=minimal",
                corps=inserts_talent[i : i + 500],
            )
        for i in range(0, len(inserts_src), 500):
            http(
                "talent_source",
                "POST",
                profil="pivot",
                prefer="return=minimal,resolution=ignore-duplicates",
                corps=inserts_src[i : i + 500],
            )
        for tid, patch in fusion.items():
            http(
                f"talent?talent_id=eq.{urllib.parse.quote(tid)}",
                "PATCH",
                profil="pivot",
                prefer="return=minimal",
                corps=patch,
            )
        for i in range(0, len(inserts_email), 500):
            http(
                "email",
                "POST",
                profil="pivot",
                prefer="return=minimal,resolution=ignore-duplicates",
                corps=inserts_email[i : i + 500],
            )
        for i in range(0, len(inserts_phone), 500):
            http(
                "phone",
                "POST",
                profil="pivot",
                prefer="return=minimal,resolution=ignore-duplicates",
                corps=inserts_phone[i : i + 500],
            )
        for i in range(0, len(inserts_attentes), 500):
            http(
                "attentes",
                "POST",
                profil="pivot",
                prefer="return=minimal,resolution=merge-duplicates",
                corps=inserts_attentes[i : i + 500],
            )
        for i in range(0, len(inserts_qualif), 500):
            http(
                "qualification",
                "POST",
                profil="pivot",
                prefer="return=minimal,resolution=merge-duplicates",
                corps=inserts_qualif[i : i + 500],
            )
        for i in range(0, len(conflits), 500):
            http(
                "conflit",
                "POST",
                profil="pivot",
                prefer="return=minimal",
                corps=conflits[i : i + 500],
            )
    except urllib.error.HTTPError as e:
        # RÈGLE 1 : ne pas avancer le curseur sur exception.
        http(
            "sync_etat?source=eq.app",
            "PATCH",
            profil="pivot",
            prefer="return=minimal",
            corps={
                "statut": "erreur",
                "termine_le": datetime.now(UTC).isoformat(),
                "message_erreur": f"HTTP {e.code} {e.read().decode()[:200]}",
                "runs_total": etat["runs_total"] + 1,
            },
        )
        http(
            "sync_run",
            "POST",
            profil="pivot",
            prefer="return=minimal",
            corps=[
                {
                    "run_id": run_id,
                    "source": "app",
                    "statut": "erreur",
                    "termine_le": datetime.now(UTC).isoformat(),
                    "attendus": len(cands),
                    "lus": len(cands),
                    "curseur_avant": curseur,
                    "message": str(e)[:200],
                }
            ],
        )
        sys.exit(f"ÉCHEC : {e}. Curseur NON avancé (règle 1).")

    # RÈGLE 2 : reculer d'1 ms sur succès.
    nouveau = minus1ms(max_updated) if max_updated else curseur
    http(
        "sync_etat?source=eq.app",
        "PATCH",
        profil="pivot",
        prefer="return=minimal",
        corps={
            "curseur": nouveau,
            "statut": "ok",
            "termine_le": datetime.now(UTC).isoformat(),
            "message_erreur": None,
            "volume_dernier_run": len(cands),
            "runs_total": etat["runs_total"] + 1,
        },
    )
    http(
        "sync_run",
        "POST",
        profil="pivot",
        prefer="return=minimal",
        corps=[
            {
                "run_id": run_id,
                "source": "app",
                "statut": "ok",
                "termine_le": datetime.now(UTC).isoformat(),
                "attendus": len(cands),
                "lus": len(cands),
                "talents_crees": st["creation"],
                "talents_majs": st["maj"] + st["lien"],
                "conflits": st["conflits"],
                "curseur_avant": curseur,
                "curseur_apres": nouveau,
                "message": (
                    f"{len(ambigus)} rapprochement(s) ambigu(s) saute(s): " + ",".join(ambigus[:20])
                )
                if ambigus
                else None,
            }
        ],
    )
    print(f"\n✅ écrit. curseur app → {nouveau}")


if __name__ == "__main__":
    try:
        main()
    except Incident as e:
        sys.exit(f"LECTURE INTERROMPUE : {e}\nRien n'a été écrit ; le curseur n'a pas bougé.")
