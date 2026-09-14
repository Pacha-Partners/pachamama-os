"""Client de lecture de l'API Jarvi.

Ce module ne fait qu'une chose : rendre les profils de Jarvi, exhaustivement et
sans y laisser entrer ce qui n'y a pas sa place. Il n'ecrit RIEN chez Jarvi —
la decision d'architecture est l'ingestion seule, jamais la restitution.

QUATRE PIEGES MESURES LE 24/08/2026, ET COUVERTS ICI
----------------------------------------------------
1. `limit` EST IGNORE. La documentation annonce « defaut 100, max 1000 ».
   Mesure : que l'on demande 1, 500 ou 1000, l'API rend TOUJOURS 100 lignes.
   Un connecteur qui demande 1000 croirait tenir dix fois plus que ce qu'il a.
   On demande donc 100, et on recoupe avec le `total` annonce.

2. `limit=1000` COMBINE A `orderBy` RENVOIE UNE ERREUR 500. En restant a 100 —
   le plafond reel de toute facon — le probleme n'existe pas.

3. UN FILTRE `where` NON COMPRIS EST IGNORE EN SILENCE, et rend un resultat
   plausible mais faux. Mesure : un operateur inexistant rend 9 783 lignes,
   `deletedAt _is_null` rend 36 507 (soit tout) que l'on demande true ou false.
   Tout filtre est donc VERIFIE par contre-epreuve avant d'etre exploite.

4. LE FILTRE `isTalent` FUIT. Mesure : 19 profils sur 2 000 franchissent
   `isTalent = true` en portant `isTalent = false` — des contacts purs. Environ
   1 %, soit ~250 contacts qui entreraient dans une base de talents. On filtre
   donc cote serveur pour reduire le volume, ET on revérifie chaque fiche.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

from pachamama_api.connecteurs.commun import Incident, dossier_artefacts, reglages

# Le plafond REEL, mesure. Ne pas augmenter : au-dela, l'API rend toujours 100
# et se met a echouer en 500 des qu'on ajoute un tri.
PAGE = 100

# LA LIMITE DE DEBIT, telle que Jarvi la formule :
#   « During business hours, your API usage is limited to 5 minutes of cumulative
#     execution time per hour. These limits only apply Monday to Friday, 07:00 to
#     18:00 UTC. Outside it — nights and weekends — no limit is enforced: that's
#     the ideal window for your batch jobs. »
# Cinq minutes a ~1360 ms par requete font environ 221 requetes par heure. Or une
# lecture complete en demande 268. Une lecture complete NE RENTRE DONC PAS dans
# une heure ouvree — mesure le 24/08/2026, en se faisant couper a la 130e page.
DEBUT_OUVRE = 7  # UTC
FIN_OUVRE = 18  # UTC
# Le budget est en TEMPS, pas en nombre d'appels — et le cout par appel VARIE :
# mesure le 24/08/2026, il est passe de 1342 a 1780 ms en une heure, soit un
# budget glissant de 224 a 169 requetes. Compter les requetes revient donc a
# parier sur une duree qu'on ne controle pas. On mesure le temps reellement
# consomme, et on s'arrete avant le mur.
SECONDES_PAR_HEURE = 300.0  # les 5 minutes annoncees
MARGE = 0.85  # on s'arrete a 85 %, pour ne pas frôler la limite
REQUETES_PAR_HEURE = 169  # estimation PRUDENTE, au cout par appel le plus eleve mesure

# Temps cumule consomme par ce processus, alimente par appeler().
temps_consomme = 0.0


def budget_restant() -> float:
    """Secondes de calcul encore disponibles avant la limite, marge incluse."""
    return SECONDES_PAR_HEURE * MARGE - temps_consomme


def heures_limitees(quand: datetime | None = None) -> bool:
    """La limite de debit s'applique-t-elle en ce moment ?"""
    maintenant = quand or datetime.now(UTC)
    return maintenant.weekday() < 5 and DEBUT_OUVRE <= maintenant.hour < FIN_OUVRE


# Seuls les talents entrent. Les contacts clients vivent dans la meme table chez
# Jarvi — 12 430 sur 36 507 — et n'ont rien a faire dans une base de talents.
FILTRE_TALENTS: dict[str, Any] = {"isTalent": {"_eq": True}}


def _base() -> tuple[str, str]:
    r = reglages()
    if not r.jarvi_api_key:
        raise Incident(
            "JARVI_API_KEY absente. Il faut la cle PRIVEE : la documentation dit "
            "« The public key may only create profiles and applications ; every "
            "other route needs the private key »."
        )
    return r.jarvi_api_base.rstrip("/"), r.jarvi_api_key


def appeler(chemin: str, **params: Any) -> dict[str, Any]:
    base, cle = _base()
    url = f"{base}/{chemin}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    global temps_consomme
    requete = urllib.request.Request(url, headers={"X-API-KEY": cle})  # noqa: S310
    depart = time.monotonic()
    try:
        with urllib.request.urlopen(requete, timeout=180) as reponse:  # noqa: S310
            contenu = json.loads(reponse.read())
        temps_consomme += time.monotonic() - depart
        return contenu
    except urllib.error.HTTPError as err:
        temps_consomme += time.monotonic() - depart
        detail = err.read()[:250].decode(errors="replace")
        if err.code == 429:
            # On ne devine pas le delai : l'API le donne. Et on dit quoi faire,
            # parce qu'un « 429 » seul laisse l'exploitant sans recours.
            attente = err.headers.get("Retry-After", "?")
            raise Incident(
                f"Jarvi : quota epuise, Retry-After = {attente} s. "
                f"La limite ne s'applique QUE du lundi au vendredi, 07:00-18:00 UTC — "
                f"une lecture complete doit tourner la nuit ou le week-end. {detail}"
            ) from err
        raise Incident(f"Jarvi {chemin} : HTTP {err.code} {detail}") from err
    except (urllib.error.URLError, TimeoutError, OSError) as err:
        temps_consomme += time.monotonic() - depart
        # L'URL est dans le message : une erreur de resolution DNS sur une base
        # mal configuree est indiscernable d'une panne reseau sans elle.
        raise Incident(
            f"Jarvi injoignable sur {url} — {type(err).__name__} : {err}. Verifier JARVI_API_BASE."
        ) from err


def compter(where: dict[str, Any] | None = None) -> int:
    """Nombre total annonce par l'API pour ce filtre."""
    params: dict[str, Any] = {"limit": 1}
    if where is not None:
        params["where"] = json.dumps(where)
    reponse = appeler("profiles", **params)
    total = reponse.get("total")
    if not isinstance(total, int):
        raise Incident("Jarvi : la reponse n'annonce aucun total exploitable")
    return total


def verifier_filtres() -> dict[str, int]:
    """Contre-epreuve des filtres, AVANT toute exploitation.

    Un filtre `where` non compris est ignore en silence et rend un resultat
    plausible. On refuse donc de travailler tant que trois faits ne sont pas
    etablis : le total sans filtre, un filtre qui restreint reellement, et un
    filtre impossible qui rend zero. Sans le dernier, un filtre inerte
    ressemblerait a un filtre qui marche.
    """
    tout = compter()
    talents = compter(FILTRE_TALENTS)
    impossible = compter({"firstName": {"_eq": "ZzQxJamaisUnPrenom"}})

    if talents >= tout:
        raise Incident(
            f"le filtre isTalent ne restreint rien ({talents} pour un total de {tout}) "
            "— il est probablement ignore, refus de continuer"
        )
    if impossible != 0:
        raise Incident(
            f"un filtre volontairement impossible rend {impossible} lignes au lieu de 0 "
            "— les filtres ne sont pas fiables, refus de continuer"
        )
    return {"total": tout, "talents": talents}


def _fichier_etat(nom: str) -> Any:
    return dossier_artefacts() / f"jarvi_lecture_{nom}.json"


def talents(
    depuis: str | None = None,
    reprendre: bool = True,
    budget: int | None = None,
) -> Iterator[dict[str, Any]]:
    """Tous les talents, page par page.

    Deux garde-fous :
    * le total est lu AVANT la lecture et recoupe a la fin ; une lecture qui
      n'atteint pas le compte annonce leve un incident au lieu de rendre un
      resultat partiel ;
    * chaque fiche est REVERIFIEE : `isTalent` doit valoir exactement True.
      Le filtre serveur fuit d'environ 1 %, mesure — s'y fier seul ferait
      entrer des contacts clients dans la base de talents.
    """
    ou = dict(FILTRE_TALENTS)
    if depuis:
        ou = {**ou, "updatedAt": {"_gt": depuis}}
    filtre = json.dumps(ou)
    attendu = compter(ou)
    pages_prevues = -(-attendu // PAGE)

    # Refuser plutot que de se faire couper au milieu. Une lecture interrompue
    # laisse un etat partiel et coute une heure d'attente.
    if heures_limitees() and pages_prevues > REQUETES_PAR_HEURE and budget is None:
        raise Incident(
            f"{attendu} profils a lire, soit {pages_prevues} requetes, alors que le budget "
            f"d'une heure ouvree est de ~{REQUETES_PAR_HEURE}. La limite ne s'applique que "
            f"du lundi au vendredi 07:00-18:00 UTC : lancer cette lecture la nuit ou le "
            f"week-end. Pour forcer un passage partiel, passer budget=<nb de requetes>."
        )

    nom = "complet" if not depuis else "incremental"
    etat = _fichier_etat(nom)
    decalage = 0
    if reprendre and etat.exists():
        try:
            precedent = json.loads(etat.read_text(encoding="utf-8"))
            if precedent.get("filtre") == filtre:
                decalage = int(precedent.get("offset", 0))
        except (ValueError, OSError):
            decalage = 0

    ordre = json.dumps({"createdAt": "asc"})  # tri fixe : pagination deterministe
    rendus = ecartes = requetes = 0

    while True:
        if budget is not None and requetes >= budget:
            break
        # On s'arrete AVANT le mur si la limite s'applique. Un arret propre laisse
        # un etat reprenable ; un 429 subi coute une heure d'attente.
        if heures_limitees() and budget_restant() < 3.0:
            break
        reponse = appeler("profiles", limit=PAGE, offset=decalage, orderBy=ordre, where=filtre)
        requetes += 1
        lot = reponse.get("data") or []
        if not lot:
            break
        for profil in lot:
            # La reverification, et non une confiance dans le filtre serveur :
            # il fuit d'environ 1 %, mesure sur 2 000 profils.
            if profil.get("isTalent") is not True or profil.get("deletedAt"):
                ecartes += 1
                continue
            rendus += 1
            yield profil
        decalage += len(lot)
        # L'ETAT EST ECRIT A CHAQUE PAGE. Sans cela, une coupure fait perdre tout
        # le travail : 10 000 profils lus puis perdus le 24/08, pour une heure
        # d'attente. Quand une page coute cher, on ne la relit pas deux fois.
        etat.write_text(
            json.dumps({"filtre": filtre, "offset": decalage, "lus": rendus + ecartes}),
            encoding="utf-8",
        )
        if decalage >= attendu:
            break

    lus = rendus + ecartes
    complet = budget is None or requetes < budget
    if complet and lus != attendu:
        raise Incident(
            f"lecture incomplete : {lus} profils lus pour {attendu} annonces "
            "— refus de conclure sur un jeu partiel"
        )
    if complet:
        etat.unlink(missing_ok=True)  # lecture terminee : plus rien a reprendre


def resume() -> str:
    """Un etat lisible de la source, sans rien ingerer."""
    v = verifier_filtres()
    contacts = compter({"isContact": {"_eq": True}})
    ouverts = compter({"isOpenToNewOpportunities": {"_eq": True}})
    pages = -(-v["talents"] // PAGE)
    limite = "ACTIVE (lecture complete refusee)" if heures_limitees() else "levee (lecture libre)"
    return (
        f"Jarvi : {v['total']} profils au total · {v['talents']} talents · "
        f"{contacts} contacts · {ouverts} ouverts aux opportunites\n"
        f"lecture complete : {pages} requetes · limite de debit : {limite}"
    )


if __name__ == "__main__":
    print(resume())
