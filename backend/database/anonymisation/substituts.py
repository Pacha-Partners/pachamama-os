"""Substitution déterministe, calculée sur la VALEUR réelle.

Deux principes, dont découle tout le reste.

**On hache la valeur, pas la ligne.** Le même prénom réel donne partout le même
prénom fictif. `candidat.prenom`, `user.prenom` et `nps_tracking.candidate_firstname`
restent donc cohérents pour une même personne sans qu'aucune jointure soit
nécessaire. L'anonymiseur du livrable Bachelor hache le `talent_id` : il ne peut
pas être cohérent d'une table à l'autre, et c'est la raison de ce module.

**Un substitut ne doit jamais être une vraie valeur.** Sinon le nom d'une
personne réelle réapparaît dans la base de développement, rattaché aux données
de quelqu'un d'autre. Les listes sont donc purgées des valeurs réellement
présentes, par `purger()`, avant toute substitution — et la purge échoue
bruyamment si une liste devient trop courte.

Le sel fixe la correspondance. Le changer régénère un jeu entièrement
différent ; le garder rend deux exécutions identiques.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata

SEL = "pachamama-dev-2026-08"

# En dessous de ce seuil, une liste ne porte plus assez de diversité pour que
# les substituts restent plausibles : on préfère échouer.
PLANCHER = 12

# --------------------------------------------------------------------- listes
PRENOMS = [
    "Adrien", "Agathe", "Alban", "Alice", "Aline", "Amaury", "Ambre", "Anouk",
    "Armand", "Aurore", "Baptiste", "Basile", "Bérénice", "Blaise", "Camille",
    "Capucine", "Célestin", "Chloé", "Clarisse", "Clément", "Colombe", "Corentin",
    "Cyprien", "Delphine", "Édouard", "Éléonore", "Élise", "Emmanuel", "Estelle",
    "Étienne", "Fabien", "Faustine", "Félix", "Flavie", "Florent", "Gabin",
    "Garance", "Gaspard", "Geneviève", "Grégoire", "Guillemette", "Hadrien",
    "Héloïse", "Hugo", "Ignace", "Inès", "Irène", "Isaure", "Jacinthe", "Jocelyn",
    "Joséphine", "Judicaël", "Juliette", "Kilian", "Laetitia", "Lancelot",
    "Léandre", "Léonie", "Loïc", "Louison", "Lucile", "Madeleine", "Manon",
    "Marceau", "Margaux", "Mathis", "Maud", "Maxence", "Mélanie", "Milo",
    "Mireille", "Nathanaël", "Noémie", "Océane", "Octave", "Olivier", "Oriane",
    "Pacôme", "Paulin", "Pénélope", "Philippine", "Quentin", "Raphaëlle", "Rémi",
    "Roxane", "Sacha", "Salomé", "Séverin", "Sibylle", "Sixtine", "Solène",
    "Stanislas", "Sylvain", "Tanguy", "Thaïs", "Théophile", "Tiphaine", "Tristan",
    "Ulysse", "Valentine", "Victoire", "Vincent", "Violette", "Xavier", "Yann",
    "Zélie", "Aubin", "Bastien", "Céleste", "Diane", "Edwige", "Firmin",
    "Gaétan", "Honorine", "Isidore", "Jonas", "Ludivine", "Melchior", "Nino",
]

NOMS = [
    "Abadie", "Alençon", "Andrieu", "Aubertin", "Aubry", "Bacquet", "Baradel",
    "Barrière", "Baudouin", "Bazin", "Belair", "Bernier", "Bertaud", "Beuzelin",
    "Blondeau", "Boissard", "Bonnefoy", "Bourgeat", "Bouvier", "Brenac",
    "Bricourt", "Cadiot", "Calmet", "Carpentier", "Cassagne", "Cazenave",
    "Chabrier", "Chaminade", "Chanteloup", "Charmet", "Chastel", "Clairval",
    "Colinet", "Combelle", "Cordonnier", "Coulange", "Courtois", "Crozat",
    "Dabadie", "Daguerre", "Dalibard", "Danglade", "Darrieux", "Dauvergne",
    "Delacour", "Delmotte", "Demange", "Descamps", "Desfossés", "Devaux",
    "Dorléac", "Drouhin", "Dubourg", "Duchesne", "Dufresne", "Dumesnil",
    "Duperré", "Durieux", "Eloy", "Emeriau", "Escande", "Estivals", "Fabrègue",
    "Falguière", "Farcy", "Faurie", "Ferrand", "Feuillet", "Flamant", "Fontenay",
    "Fourcade", "Fresnel", "Gaillac", "Galabert", "Garrigue", "Gaubert",
    "Gauvain", "Gendron", "Gerbaud", "Gilbault", "Godefroy", "Gonnet", "Gourdon",
    "Grandval", "Grimaldi", "Guerrier", "Guionnet", "Hamelin", "Haudry",
    "Hennequin", "Hersant", "Hourcade", "Huchet", "Isnard", "Jacquinot",
    "Jaubert", "Joffrin", "Jouanneau", "Labarthe", "Lacaze", "Lafleur",
    "Lagardère", "Lallier", "Lambourg", "Lamotte", "Langlois", "Lanoux",
    "Lardeau", "Lasserre", "Latour", "Lavigne", "Lebrun", "Lechantre",
    "Leconte", "Ledoux", "Lefranc", "Legrand", "Lemarchand", "Lenoir",
    "Lépine", "Lescure", "Lestrade", "Levasseur", "Lhermitte", "Loiseau",
    "Longchamp", "Mabille", "Maillard", "Malaurie", "Marcheteau", "Marsollier",
    "Mathurin", "Maugendre", "Ménard", "Mercadier", "Mérindol", "Meslier",
    "Monnier", "Montreuil", "Morvan", "Nadaud", "Nivelle", "Nogaret", "Ollivier",
    "Ordonneau", "Painchaud", "Palasse", "Parisot", "Pelletier", "Périgault",
    "Pestel", "Peyrelade", "Pichon", "Plessis", "Poilvet", "Pontcarral",
    "Prunier", "Quesnel", "Rabourdin", "Raffin", "Rambert", "Ravenel",
    "Regnault", "Rimbaud", "Rivoire", "Rocheteau", "Rondeau", "Rouvière",
    "Sabatier", "Saintonge", "Salvat", "Sauvage", "Ségalen", "Sénéchal",
    "Sorbier", "Taillefer", "Tessier", "Thibaudet", "Tourneur", "Trémoulet",
    "Vaillant", "Valmont", "Vasseur", "Verdier", "Vernier", "Vidalenc",
    "Villaret", "Voisenet", "Wattelier", "Ysoré",
]

SOCIETES = [
    "Altiva", "Ardenne Labs", "Bluemont", "Cadence Works", "Calypso Data",
    "Cormoran", "Corelia", "Delta Rive", "Ébène Systèmes", "Estuaire",
    "Farandole", "Ferrure", "Galuchat", "Halcyon", "Héliante", "Ibis Nord",
    "Kestrel", "Lauze", "Lumen Ouest", "Maribel", "Méandre", "Northwind",
    "Obsidienne", "Ovania", "Palissade", "Quartz Bleu", "Riveraine", "Sablier",
    "Sequoia Works", "Silène", "Solvea", "Sorgue", "Talweg", "Tramontane",
    "Trilex", "Ubac", "Vantis", "Verrière", "Volute", "Zéphyrine",
]

ECOLES = [
    "École de Commerce de Vireux", "Institut Barthès", "Université de Roquemaure",
    "École Supérieure de Cavaillac", "Institut Technique de Lauzerte",
    "École des Métiers de Brénac", "Université d'Availles", "Institut Serre-Chevrier",
    "École Polytechnique de Vaux-Rive", "Institut Marchandon", "École de Gestion d'Ombrée",
    "Université de Pierrefonds", "Institut Numérique de Callac", "École Sainte-Rive",
    "Institut d'Ingénierie de Vergèze", "École de Design de Malaucène",
]

# Les noms de société et les intitulés de poste ne sont pas puisés dans une
# liste courte mais COMPOSÉS. Mesuré le 25/08/2026 : la production porte 14 401
# employeurs et 12 458 intitulés distincts. Une liste de 40 sociétés ramenait
# le dev à 40 valeurs — soit 0,3 % de la variété réelle. Les écrans qui
# filtrent, regroupent ou complètent automatiquement par employeur n'auraient
# rien prouvé sur une base aussi plate.
QUALIFICATIFS = [
    "", "Digital", "Conseil", "Systèmes", "Partners", "Group", "Industries",
    "Solutions", "Technologies", "Labs", "Studio", "Services", "Capital",
    "Développement", "Ingénierie", "Data", "Santé", "Énergie", "Logistique",
    "Média", "Formation", "Mobilité", "Sécurité", "Réseaux", "Analytique",
]

FORMES = [
    "", "SAS", "SA", "Groupe", "France", "Europe", "International", "Innovation",
    "Ventures", "Holding", "Union", "Atlantique", "Rhône", "Nord", "Sud",
    "Ouest", "Est", "Île-de-France", "Occitanie", "Alliance",
]

NIVEAUX = [
    "", "Junior", "Senior", "Confirmé", "Lead", "Principal", "Adjoint",
    "Responsable", "Directeur", "Chargé",
]

FONCTIONS = [
    "Chef de projet", "Responsable produit", "Ingénieur logiciel",
    "Chargé de développement", "Consultant fonctionnel", "Analyste",
    "Responsable des opérations", "Directeur de mission", "Architecte",
    "Responsable commercial", "Chargé de clientèle", "Chef d'équipe",
    "Product Owner", "Business Analyst", "Développeur", "Designer",
    "Responsable partenariats", "Coordinateur", "Expert", "Auditeur",
    "Gestionnaire", "Administrateur", "Ingénieur d'études", "Conseiller",
    "Responsable de portefeuille",
]

DOMAINES = [
    "", "produit", "données", "marketing", "commercial", "technique",
    "ressources humaines", "finance", "opérations", "qualité", "achats",
    "juridique", "systèmes d'information", "logistique", "recherche",
    "international", "innovation", "conformité", "relation client",
    "transformation", "support",
]

INTITULES = FONCTIONS  # conservé pour compatibilité de nommage

# Plages réservées par l'ARCEP à la fiction : elles ne sont jamais attribuées,
# un appel n'atteindra donc jamais personne.
PLAGES_FICTIVES = ["0639 98", "0739 98", "0199 00", "0261 91", "0353 01", "0465 71", "0536 49"]

_LISTES = {
    "prenom": PRENOMS, "nom": NOMS, "societe": SOCIETES,
    "ecole": ECOLES, "intitule": INTITULES,
}


# ------------------------------------------------------------------ mécanique
class ListeTropCourte(Exception):
    """Une liste de substituts a trop maigri après purge des collisions."""


def _h(valeur: str, sel: str = "") -> int:
    """Entier stable dérivé de la valeur. SHA-256 tronqué à 16 chiffres hex."""
    brut = f"{SEL}|{sel}|{valeur}".encode()
    return int(hashlib.sha256(brut).hexdigest()[:16], 16)


def _pick(liste: list[str], valeur: str, sel: str) -> str:
    return liste[_h(valeur, sel) % len(liste)]


def _pick_autre(liste: list[str], valeur: str, sel: str) -> str:
    """Comme `_pick`, mais garantit un résultat DIFFÉRENT de l'entrée.

    Sans cela, « Clarisse » peut se substituer à « Clarisse » : le couple reste
    fictif, mais l'invariant « une valeur substituée diffère toujours de la
    vraie » tomberait, et le contrôle de fuite ne pourrait plus l'affirmer.
    Un contrôle assorti d'exceptions cesse vite d'être cru.
    """
    ref = normaliser(valeur)
    for essai in range(len(liste)):
        choix = _pick(liste, valeur, sel if essai == 0 else f"{sel}{essai}")
        if normaliser(choix) != ref:
            return choix
    raise ListeTropCourte(f"aucun substitut différent de « {valeur} » dans la liste « {sel} »")


def _sansaccent(texte: str) -> str:
    plat = unicodedata.normalize("NFKD", texte)
    return "".join(c for c in plat if not unicodedata.combining(c))


def normaliser(texte: str) -> str:
    """Forme de comparaison : minuscules, sans accent, sans ponctuation."""
    return re.sub(r"[^a-z0-9]+", "", _sansaccent(texte or "").lower())


class PaireIntrouvable(Exception):
    """Aucun couple libre trouvé après un nombre raisonnable d'essais."""


# Couples prénom+nom réellement présents en production, sous forme normalisée.
# Renseigné avant toute substitution par `enregistrer_paires()`.
_PAIRES_REELLES: set[str] = set()


def enregistrer_paires(paires: set[str]) -> int:
    """Les couples à ne jamais fabriquer.

    C'est le COUPLE qui identifie, pas ses moitiés. Mesuré en production le
    25/08/2026 : 6 915 prénoms et 22 038 noms distincts pour 30 890 couples.
    Purger les composants séparément ne laisserait que 6 prénoms sur 119 —
    avec trente mille personnes réelles, tout prénom français plausible est
    déjà présent. Purger les COUPLES écarte 59 combinaisons sur 22 610,
    soit 0,26 %. La contrainte juste est donc sur le couple.
    """
    _PAIRES_REELLES.clear()
    _PAIRES_REELLES.update(paires)
    return len(_PAIRES_REELLES)


def purger(valeurs_reelles: dict[str, set[str]]) -> dict[str, int]:
    """Retire des listes d'ENTITÉS tout substitut qui existe pour de vrai.

    Ne s'applique qu'aux sociétés, écoles et intitulés : une société fictive
    portant le nom d'un vrai client se lirait comme une vraie donnée. Les
    prénoms et les noms, eux, sont traités au niveau du couple — voir
    `enregistrer_paires`.
    """
    restant: dict[str, int] = {}
    for cle in ("societe", "ecole", "intitule"):
        liste = _LISTES[cle]
        interdits = {normaliser(v) for v in valeurs_reelles.get(cle, set())}
        garde = [s for s in liste if normaliser(s) not in interdits]
        if len(garde) < PLANCHER:
            raise ListeTropCourte(
                f"liste « {cle} » : {len(garde)} substituts après purge "
                f"(plancher {PLANCHER}) — en ajouter avant de continuer"
            )
        liste[:] = garde
        restant[cle] = len(garde)
    restant["prenom"] = len(PRENOMS)
    restant["nom"] = len(NOMS)
    return restant


# --------------------------------------------------------------- substitutions
def prenom(v: str) -> str:
    return _pick_autre(PRENOMS, v, "prenom")


def nom(v: str) -> str:
    return _pick_autre(NOMS, v, "nom")


def societe(v: str) -> str:
    """Nom composé : racine + qualificatif + forme. Environ 20 000 variantes,
    à comparer aux 14 401 employeurs distincts de la production."""
    morceaux = [
        _pick_autre(SOCIETES, v, "societe"),
        _pick(QUALIFICATIFS, v, "qualif"),
        _pick(FORMES, v, "forme"),
    ]
    compose = " ".join(m for m in morceaux if m)
    return compose if normaliser(compose) != normaliser(v) else f"{compose} Conseil"


def ecole(v: str) -> str:
    return _pick_autre(ECOLES, v, "ecole")


def intitule(v: str) -> str:
    """Intitulé composé : niveau + fonction + domaine. Environ 5 000 variantes."""
    niveau = _pick(NIVEAUX, v, "niveau")
    fonction = _pick_autre(FONCTIONS, v, "fonction")
    domaine = _pick(DOMAINES, v, "domaine")
    morceaux = [niveau, fonction.lower() if niveau else fonction]
    compose = " ".join(m for m in morceaux if m)
    if domaine:
        compose = f"{compose} {domaine}"
    return compose if normaliser(compose) != normaliser(v) else f"{compose} (adjoint)"


def identite(prenom_reel: str, nom_reel: str) -> tuple[str, str]:
    """Un couple prénom+nom fictif garanti absent de la production.

    Le prénom reste une fonction pure du prénom réel : une colonne qui ne porte
    qu'un prénom (`nps_tracking.candidate_firstname`) reste donc cohérente avec
    l'identité complète de la même personne. Seul le nom est resalé en cas de
    collision, ce qui préserve cette cohérence.
    """
    p = prenom(prenom_reel or "")
    for essai in range(64):
        n = _pick_autre(NOMS, nom_reel or "", "nom" if essai == 0 else f"nom-{essai}")
        if f"{normaliser(p)}|{normaliser(n)}" not in _PAIRES_REELLES:
            return p, n
    raise PaireIntrouvable(
        f"64 essais sans couple libre pour « {prenom_reel} {nom_reel} » — "
        "la liste de noms est trop courte face au volume réel"
    )


def _paire(v: str) -> tuple[str, str]:
    return prenom(v), nom(v)


def email(v: str) -> str:
    """`prenom.nom+empreinte@exemple.test` — lisible ET distinct.

    L'empreinte porte l'unicité : deux adresses réelles différentes donnent deux
    adresses fictives différentes, ce qui est exigé par la contrainte
    UNIQUE (talent_id, email) du pivot. Le domaine `.test` est réservé par la
    RFC 2606 : aucun courriel ne peut y aboutir, même par erreur de configuration.
    """
    p, n = _paire(v)
    empreinte = f"{_h(v, 'email'):x}"[:10]
    return f"{normaliser(p)}.{normaliser(n)}+{empreinte}@exemple.test"


def telephone(v: str) -> str:
    """Dix chiffres, dans une plage que l'ARCEP reserve a la fiction : un appel
    n'atteindra jamais personne, meme compose par erreur."""
    plage = PLAGES_FICTIVES[_h(v, "plage") % len(PLAGES_FICTIVES)].replace(" ", "")
    return f"{plage}{_h(v, 'tel') % 10000:04d}"


def linkedin(v: str) -> str:
    p, n = _paire(v)
    return f"https://www.linkedin.com/in/{normaliser(p)}-{normaliser(n)}-{_h(v, 'li') % 100000:05d}"


def fichier(v: str, genre: str) -> str:
    """URL factice. Le fichier réel n'est pas copié : il vit dans le Storage
    du projet de production, qui n'est pas dupliqué."""
    return f"https://exemple.test/{genre[:3]}-{_h(v, genre):x}"[:80]


def siret(v: str) -> str:
    """14 chiffres dont la clé de Luhn est valide, au cas où un écran la vérifie."""
    base = f"{_h(v, 'siret') % 10**13:013d}"
    somme = 0
    for i, c in enumerate(reversed(base)):
        n = int(c) * (2 if i % 2 == 0 else 1)
        somme += n - 9 if n > 9 else n
    return base + str((10 - somme % 10) % 10)


def slug(p: str, n: str) -> str:
    return f"{normaliser(p)}-{normaliser(n)}"


def tranche(valeur: float | int | None, pas: int) -> float | int | None:
    """Arrondit au pas inférieur. Préserve l'ordre : si a <= b avant, a <= b après."""
    if valeur is None:
        return None
    return (int(valeur) // pas) * pas


JETON = "[anonymisé pour l'environnement de développement]"


def verifier_listes() -> None:
    """Toutes les listes doivent rester en alphabet latin.

    Deux fois pendant l'écriture de ce module, des caractères cyrilliques puis
    des idéogrammes se sont glissés dans une liste. Un substitut illisible ne
    casse rien tout de suite : il ressort dans la base de développement des
    semaines plus tard, dans un écran, sans explication.
    """
    import unicodedata

    fautifs = [
        (nom_liste, valeur, c)
        for nom_liste, liste in (
            ("PRENOMS", PRENOMS), ("NOMS", NOMS), ("SOCIETES", SOCIETES),
            ("ECOLES", ECOLES), ("FONCTIONS", FONCTIONS), ("NIVEAUX", NIVEAUX),
            ("DOMAINES", DOMAINES), ("QUALIFICATIFS", QUALIFICATIFS),
            ("FORMES", FORMES),
        )
        for valeur in liste
        for c in valeur
        if c.isalpha() and "LATIN" not in unicodedata.name(c, "")
    ]
    if fautifs:
        details = ", ".join(f"{nl}: {v!r} ({c!r})" for nl, v, c in fautifs)
        raise ValueError(f"caractère non latin dans une liste de substituts — {details}")

    for nom_liste, liste in (("PRENOMS", PRENOMS), ("NOMS", NOMS), ("SOCIETES", SOCIETES)):
        if len(liste) != len(set(liste)):
            raise ValueError(f"doublon dans la liste {nom_liste}")
