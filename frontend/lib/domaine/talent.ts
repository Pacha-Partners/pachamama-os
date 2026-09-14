import type { EntreeParcours } from '@/components/pacha/FriseParcours';
import { formaterSalaire } from '@/lib/domaine/offre';
import {
  cheminDepot,
  cheminDepose,
  nomLisible,
  SEAU_TALENT,
  seauDe,
  valeurDeposee,
} from '@/lib/domaine/stockage';
import {
  dateCourte,
  dateLongue,
  decouperEtape,
  montantKe,
  montantTjm,
  urlMedia,
} from '@/lib/domaine/entreprise';

/**
 * LE DOMAINE DE L'ESPACE TALENT — la donnée, ses règles, et rien d'autre.
 *
 * Même parti pris que `lib/domaine/entreprise.ts` : un jeu de colonnes par
 * USAGE, un convertisseur qui nomme la forme, et zéro décision de sécurité
 * ici. Le cloisonnement est déjà fait par PostgreSQL au moment où la ligne
 * arrive — les vues `api.ma_*` portent `api.a_portail('talent')` dans leur
 * WHERE et sont filtrées sur `api.ma_fiche_talent()`. Refaire ce filtrage en
 * TypeScript ne protégerait rien : les vues sont interrogeables directement au
 * réseau.
 *
 * ⚠ CE MODULE EST PARTAGÉ SERVEUR/CLIENT. Il n'importe ni `next/headers`, ni le
 * client Supabase, ni `node:crypto` — les formulaires en ont besoin pour
 * afficher, les Server Components pour convertir après la lecture.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI IL IMPORTE SIX FONCTIONS DE `domaine/entreprise.ts`
 * ─────────────────────────────────────────────────────────────────────────
 * `dateLongue`, `dateCourte`, `montantKe`, `montantTjm`, `urlMedia` et
 * `decouperEtape` ne portent RIEN d'entreprise : ce sont les règles d'écriture
 * françaises du projet (« 12 septembre 2026 », « 65 K€ », le préfixe `https:`
 * sur les URL protocole-relatives héritées de Bubble, la séparation de l'emoji
 * et du libellé d'étape). Les recopier ici donnerait deux vérités qui
 * divergeraient au premier ajustement — le projet a déjà payé ce prix avec les
 * trois référentiels recopiés en dur à la clôture de la phase 1.
 *
 * Elles mériteraient un `lib/domaine/commun.ts`. Les y déplacer imposerait de
 * réécrire les imports du portail entreprise, qui est livré, vérifié et hors de
 * mon périmètre : on importe donc, sans rien déplacer. Le jour où un troisième
 * portail les demandera, l'extraction deviendra le bon geste.
 */

type Ligne = Record<string, unknown>;

const texte = (v: unknown): string | null =>
  v === null || v === undefined || v === '' ? null : String(v);
const nombre = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);
const booleen = (v: unknown): boolean | null =>
  v === null || v === undefined ? null : Boolean(v);
const liste = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => x !== null && x !== undefined).map(String) : [];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un identifiant malformé est un 404, pas une erreur 400 de PostgREST. */
export function estUuid(valeur: string): boolean {
  return UUID.test(valeur);
}

export { dateCourte, dateLongue, montantKe, montantTjm, urlMedia };

/* ══════════════════════════════════════════════════════════════════════════
   1. Le niveau d'anglais — cinq libellés recopiés, et pourquoi
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ `api.ma_fiche.niveau_anglais` REND LE CODE BRUT — `courant_occasionnel`.
 *
 * Mesuré le 09/09 sur les 7 023 fiches actives : 3 910 sans valeur, puis
 * `courant_occasionnel` 1 562, `courant_quotidien` 1 246, `ecrit_seulement`
 * 210, `bon_niveau_non_quotidien` 59, `aucun` 36. Les libellés français vivent
 * dans `ref.libelle` au domaine `niveau_anglais`, et **`api.mon_referentiel`
 * ne publie pas ce domaine** : ses dix vocabulaires sont métier, univers,
 * metier_univers, secteur, critère, expertise, contrat, remote, motif_retrait
 * et étape. Il n'existe donc aucun moyen, depuis le serveur Next, de lire ces
 * cinq libellés.
 *
 * Les cinq lignes sont RECOPIÉES DE LA BASE, relevées le 09/09 sur
 * `ref.libelle where domaine = 'niveau_anglais' and actif`. C'est le même
 * manque que `ETAPES_CLIENT` et `MOTIFS_REFUS_CLIENT` du portail entreprise, et
 * il se réglera de la même façon : en ajoutant `niveau_anglais` à
 * `api.mon_referentiel`. Une copie ne se tient jamais à jour.
 *
 * Le talent NE PEUT PAS modifier ce champ — il n'est dans aucune liste blanche
 * de `api.maj_ma_fiche`, et aucun GRANT par colonne ne le couvre. L'écran
 * l'affiche donc en lecture, avec la phrase qui dit à qui s'adresser.
 */
const NIVEAUX_ANGLAIS: Record<string, string> = {
  aucun: 'Ne maîtrise pas',
  ecrit_seulement: 'Maîtrise à l’écrit seulement',
  courant_occasionnel: 'Bon niveau écrit et oral dans un contexte pro',
  courant_quotidien: 'Natif ou top niveau écrit et oral',
  bon_niveau_non_quotidien: 'Bon niveau global mais pas au quotidien',
};

export function libelleAnglais(code: string | null): string | null {
  if (!code) return null;
  // Un code inconnu est rendu TEL QUEL plutôt que masqué : mieux vaut un
  // libellé laid qu'une information disparue, et le voir à l'écran est ce qui
  // fera ajouter la ligne au référentiel.
  return NIVEAUX_ANGLAIS[code] ?? code;
}

/* ══════════════════════════════════════════════════════════════════════════
   2. Les documents : ce qui est dans notre stockage, ce qui vient d'ailleurs
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * LA CONVENTION DE CHEMIN VIT DANS `lib/domaine/stockage.ts`.
 *
 * Elle y a été extraite le jour où le portail entreprise a eu besoin de la
 * même — il dépose la photo d'un contact client dans `documents-entreprise`.
 * Ce module en garde les noms d'origine pour ne déplacer aucun appelant : ce
 * sont les mêmes fonctions, liées au seau du talent.
 *
 * ⚠ Le seau est PRIVÉ. Une valeur reconnue ici n'est PAS affichable
 * directement : elle doit passer par `lib/stockage.ts`, qui la signe.
 */
export const SEAU_DOCUMENTS = SEAU_TALENT;

export function estObjetStocke(valeur: string | null): boolean {
  return seauDe(valeur) === SEAU_TALENT;
}

/** Le chemin dans le seau, ou `null` si la valeur n'en vient pas. */
export function cheminObjet(valeur: string | null): string | null {
  return estObjetStocke(valeur) ? cheminDepose(valeur) : null;
}

/** `/documents-talent/<fiche>/<nature>/<fichier>` — l'inverse de `cheminObjet`. */
export function valeurStockee(chemin: string): string {
  return valeurDeposee(SEAU_TALENT, chemin);
}

export type NatureDocument = 'cv' | 'photo' | 'portfolio';

export function nomDepot(ficheId: string, nature: NatureDocument, nomOrigine: string): string {
  return cheminDepot(ficheId, nature, nomOrigine);
}

export { nomLisible };


/* ══════════════════════════════════════════════════════════════════════════
   3. `api.ma_fiche` — quatre jeux de colonnes, un par écran
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ POURQUOI QUATRE LISTES ET NON UNE (décision D-15).
 *
 * Next sérialise dans la page la charge utile RSC de tout ce qui franchit la
 * frontière serveur → client. Une liste unique de 40 colonnes ferait voyager
 * l'adresse électronique, le téléphone et le chemin du CV — donc le patronyme,
 * mesuré à 81 % des `cv_url` en phase 1 — sur l'écran des attentes, qui n'en
 * affiche aucun. Ne pas afficher ne protège rien ; ne pas demander, si.
 *
 * `id` est dans les quatre : c'est la clé de tout le reste, et le talent lit sa
 * propre fiche.
 */

/**
 * L'en-tête de l'espace : qui je suis, et l'état de mon dossier.
 *
 * ⚠ PAS DE `photo_url`, ET C'EST UN TEST QUI L'A TROUVÉ. Elle y était, et
 * l'en-tête du tableau de bord n'affiche pas d'avatar : une colonne
 * sélectionnée et jamais rendue, c'est-à-dire exactement la faute de D-15. Le
 * chemin d'une photo Bubble porte le même genre de nom de fichier que celui
 * d'un CV — la retirer coûte un avatar qu'on n'affichait pas, et évite
 * d'envoyer un nom de personne dans une charge utile pour rien.
 *
 * À rouvrir le jour où l'écran montrera un portrait : il faudra alors la
 * SIGNER (`lib/stockage.ts`), la valeur brute n'étant pas affichable
 * pour un objet de notre seau privé.
 */
export const COLONNES_ENTETE = ['id', 'prenom', 'actif', 'consentement_donne_le'];

/**
 * Ce que lit le CALCUL DE COMPLÉTUDE, et rien de plus.
 *
 * Ces colonnes ne traversent PAS la frontière client : le tableau de bord les
 * lit dans un Server Component, appelle `completudeDe`, et ne transmet que le
 * résultat — un nombre et une liste de libellés. Les valeurs elles-mêmes
 * restent sur le serveur.
 */
export const COLONNES_COMPLETUDE = [
  'id',
  'prenom',
  'nom',
  'email_personnel',
  'telephone',
  'url_linkedin',
  'localisation_texte',
  'cv_url',
  'photo_url',
  'attentes_metier_code',
  'attentes_salaire_min_ke',
  'attentes_salaire_max_ke',
  'attentes_tjm_min_eur',
  'attentes_tjm_max_eur',
  'attentes_disponibilite_texte',
  'attentes_description',
  'contrats_souhaites',
  'remote_souhaites',
  'criteres_codes',
  'expertises_codes',
  'secteurs_vises_codes',
];

/** Identité, coordonnées, documents — l'écran « Mon profil ». */
export const COLONNES_PROFIL = [
  'id',
  'prenom',
  'nom',
  'email_personnel',
  'telephone',
  'url_linkedin',
  'localisation_texte',
  'cv_url',
  'photo_url',
  'portfolio_url',
  'cv_depose_le',
  'niveau_anglais',
  'modifie_par_le_talent_le',
];

/** Le job rêvé — l'écran « Mes attentes ». Aucune coordonnée, aucun document. */
export const COLONNES_ATTENTES = [
  'id',
  'recherche_active',
  'attentes_metier_code',
  'attentes_univers_code',
  'attentes_salaire_min_ke',
  'attentes_salaire_max_ke',
  'attentes_tjm_min_eur',
  'attentes_tjm_max_eur',
  'attentes_disponibilite_texte',
  'attentes_localisation_texte',
  'attentes_description',
  'contrats_souhaites',
  'remote_souhaites',
  'secteurs_vises_codes',
  'secteurs_nogo_codes',
  'criteres_codes',
  'expertises_codes',
  'modifie_par_le_talent_le',
];

/** L'écran « Mes données ». Ni identité, ni attentes : des états, des dates. */
export const COLONNES_CONFIDENTIALITE = [
  'id',
  'actif',
  'recherche_active',
  'consentement_donne_le',
  'modifie_par_le_talent_le',
  'cv_depose_le',
];

/**
 * Une fiche, telle que les écrans la lisent.
 *
 * Toutes les propriétés sont optionnelles PARCE QUE les jeux de colonnes sont
 * partiels : demander `COLONNES_ATTENTES` ne rend pas `prenom`. Un type par
 * jeu aurait été plus strict et plus juste ; il aurait aussi imposé quatre
 * convertisseurs qui se recopient. Le compromis est assumé, et il tient parce
 * que chaque écran sait ce qu'il a demandé.
 */
export type FicheTalent = {
  id: string;
  prenom?: string | null;
  nom?: string | null;
  emailPersonnel?: string | null;
  telephone?: string | null;
  urlLinkedin?: string | null;
  localisationTexte?: string | null;
  cvUrl?: string | null;
  photoUrl?: string | null;
  portfolioUrl?: string | null;
  cvDeposeLe?: string | null;
  niveauAnglais?: string | null;
  rechercheActive?: boolean | null;
  attentesMetierCode?: string | null;
  attentesUniversCode?: string | null;
  attentesSalaireMinKe?: number | null;
  attentesSalaireMaxKe?: number | null;
  attentesTjmMinEur?: number | null;
  attentesTjmMaxEur?: number | null;
  attentesDisponibiliteTexte?: string | null;
  attentesLocalisationTexte?: string | null;
  attentesDescription?: string | null;
  contratsSouhaites?: string[];
  remoteSouhaites?: string[];
  secteursVisesCodes?: string[];
  secteursNogoCodes?: string[];
  criteresCodes?: string[];
  expertisesCodes?: string[];
  actif?: boolean | null;
  consentementDonneLe?: string | null;
  modifieParLeTalentLe?: string | null;
};

export function versFiche(l: Ligne): FicheTalent {
  // Une colonne NON DEMANDÉE est `undefined`, et `liste` en fait un tableau
  // vide : c'est exactement ce qu'il faut, un écran qui n'a pas demandé les
  // secteurs ne doit pas les croire renseignés ni planter en les lisant.
  const a = (cle: string) => liste(l[cle]);
  return {
    id: String(l.id),
    prenom: texte(l.prenom),
    nom: texte(l.nom),
    emailPersonnel: texte(l.email_personnel),
    telephone: texte(l.telephone),
    urlLinkedin: texte(l.url_linkedin),
    localisationTexte: texte(l.localisation_texte),
    cvUrl: texte(l.cv_url),
    photoUrl: texte(l.photo_url),
    portfolioUrl: texte(l.portfolio_url),
    cvDeposeLe: texte(l.cv_depose_le),
    niveauAnglais: texte(l.niveau_anglais),
    rechercheActive: booleen(l.recherche_active),
    attentesMetierCode: texte(l.attentes_metier_code),
    attentesUniversCode: texte(l.attentes_univers_code),
    attentesSalaireMinKe: nombre(l.attentes_salaire_min_ke),
    attentesSalaireMaxKe: nombre(l.attentes_salaire_max_ke),
    attentesTjmMinEur: nombre(l.attentes_tjm_min_eur),
    attentesTjmMaxEur: nombre(l.attentes_tjm_max_eur),
    attentesDisponibiliteTexte: texte(l.attentes_disponibilite_texte),
    attentesLocalisationTexte: texte(l.attentes_localisation_texte),
    attentesDescription: texte(l.attentes_description),
    contratsSouhaites: a('contrats_souhaites'),
    remoteSouhaites: a('remote_souhaites'),
    secteursVisesCodes: a('secteurs_vises_codes'),
    secteursNogoCodes: a('secteurs_nogo_codes'),
    criteresCodes: a('criteres_codes'),
    expertisesCodes: a('expertises_codes'),
    actif: booleen(l.actif),
    consentementDonneLe: texte(l.consentement_donne_le),
    modifieParLeTalentLe: texte(l.modifie_par_le_talent_le),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   4. La complétude — calculée ici, faute de source en base
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ `score_completude` ET `champs_manquants` SONT VIDES. MESURÉ.
 *
 *     select count(*), count(score_completude), count(champs_manquants)
 *       from core.fiche_talent where actif;
 *     → 7 023 |  0  |  0
 *
 * Le brief demande « la complétude du profil en tête avec la Jauge et des
 * invitations ciblées tirées de `champs_manquants` ». La colonne existe, elle
 * est projetée par la vue, et **elle ne porte aucune valeur sur aucune fiche**.
 * S'appuyer dessus aurait donné une jauge indéterminée et zéro invitation sur
 * les 7 023 comptes : un écran qui a l'air cassé parce que la donnée qu'il
 * attend n'a jamais été écrite. C'est exactement la faute de D-17 — une règle
 * écrite d'après ce qu'on croit que la donnée contient.
 *
 * (`fiche_complete`, elle, porte de la valeur : 3 355 vrais sur 7 023. Mais
 * c'est un booléen hérité du miroir : il dit « oui/non » sans dire de quoi, et
 * il ne peut donc ni graduer une jauge ni nommer une invitation.)
 *
 * On calcule donc ici, à partir des colonnes que le talent PEUT remplir, et on
 * fait mieux que la colonne absente : chaque manque nomme l'écran qui le
 * répare. Le jour où `champs_manquants` sera écrite en base, cette fonction est
 * ce qu'il faudra supprimer.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PAS DE PONDÉRATION, ET C'EST UN CHOIX
 * ─────────────────────────────────────────────────────────────────────────
 * Un score pondéré donnerait un chiffre que personne ne peut recalculer de
 * tête, donc que personne ne peut contester. Ici : le nombre de champs remplis
 * sur le nombre de champs attendus. Quinze champs, un point chacun.
 *
 * LE CONSENTEMENT N'EN FAIT PAS PARTIE. Ce n'est pas un champ incomplet, c'est
 * une autorisation absente — et les deux appellent des mots très différents.
 * Il a son propre bloc sur le tableau de bord.
 */
export type ManqueTalent = {
  /** Ce qui manque, écrit à la deuxième personne. « Votre CV ». */
  libelle: string;
  /** L'ancre de la section qui le répare, sur « Ma fiche ». */
  href: string;
  /** Le nom de cette section, pour grouper les invitations. */
  ecran: 'Qui vous êtes' | 'Ce que vous avez fait' | 'Ce que vous cherchez';
  /**
   * Sans celui-ci, le cabinet ne peut RIEN faire — voir `BLOQUANTS`.
   *
   * La hiérarchie existait déjà, mais elle ne vivait que dans le tri de
   * `manquantsPrioritaires` : l'écran affichait les deux en tête sans pouvoir
   * dire pourquoi ils y étaient. Le drapeau la rend nommable.
   */
  bloquant: boolean;
};

/**
 * Les deux manques sans lesquels le cabinet ne peut littéralement rien faire :
 * le CV est le document transmis au client, le métier visé est ce qui rattache
 * la personne à un mandat. L'ordre de ce tableau est celui de leur priorité
 * d'affichage — il sert à la fois de drapeau et de tri.
 */
const BLOQUANTS: readonly string[] = ['Votre CV', 'Le métier que vous visez'];

export type Completude = {
  /** Entier de 0 à 100. */
  score: number;
  remplis: number;
  attendus: number;
  manquants: ManqueTalent[];
};

const rempli = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  return Boolean(v);
};

export function completudeDe(f: FicheTalent): Completude {
  // `bloquant` est DÉRIVÉ de `BLOQUANTS` à la sortie, il ne se déclare donc pas
  // ici : l'inscrire sur chaque entrée ouvrirait deux sources pour un même fait.
  const attendus: (Omit<ManqueTalent, 'bloquant'> & { present: boolean })[] = [
    { libelle: 'Votre prénom', href: '/talent/fiche#qui-vous-etes', ecran: 'Qui vous êtes', present: rempli(f.prenom) },
    { libelle: 'Votre nom', href: '/talent/fiche#qui-vous-etes', ecran: 'Qui vous êtes', present: rempli(f.nom) },
    {
      libelle: 'Votre adresse électronique',
      href: '/talent/fiche#qui-vous-etes',
      ecran: 'Qui vous êtes',
      present: rempli(f.emailPersonnel),
    },
    {
      libelle: 'Votre téléphone',
      href: '/talent/fiche#qui-vous-etes',
      ecran: 'Qui vous êtes',
      present: rempli(f.telephone),
    },
    {
      libelle: 'Où vous êtes basé·e',
      href: '/talent/fiche#qui-vous-etes',
      ecran: 'Qui vous êtes',
      present: rempli(f.localisationTexte),
    },
    {
      libelle: 'Votre profil LinkedIn',
      href: '/talent/fiche#qui-vous-etes',
      ecran: 'Qui vous êtes',
      present: rempli(f.urlLinkedin),
    },
    // Le CV est le document que le cabinet transmet au client : sans lui, rien
    // ne part. Il compte pour un point comme les autres, mais l'écran le met en
    // tête de ses invitations — voir `manquantsPrioritaires`.
    {
      libelle: 'Votre CV',
      href: '/talent/fiche#ce-que-vous-avez-fait',
      ecran: 'Ce que vous avez fait',
      present: rempli(f.cvUrl),
    },
    { libelle: 'Votre photo', href: '/talent/fiche#qui-vous-etes', ecran: 'Qui vous êtes', present: rempli(f.photoUrl) },
    {
      libelle: 'Le métier que vous visez',
      href: '/talent/fiche#ce-que-vous-cherchez',
      ecran: 'Ce que vous cherchez',
      present: rempli(f.attentesMetierCode),
    },
    {
      libelle: 'Vos prétentions',
      href: '/talent/fiche#ce-que-vous-cherchez',
      ecran: 'Ce que vous cherchez',
      // Salaire OU TJM : un freelance n'a pas de salaire annuel, et exiger les
      // deux aurait plafonné sa complétude sans qu'il puisse rien y faire.
      present:
        rempli(f.attentesSalaireMinKe) ||
        rempli(f.attentesSalaireMaxKe) ||
        rempli(f.attentesTjmMinEur) ||
        rempli(f.attentesTjmMaxEur),
    },
    {
      libelle: 'Les contrats qui vous intéressent',
      href: '/talent/fiche#ce-que-vous-cherchez',
      ecran: 'Ce que vous cherchez',
      present: rempli(f.contratsSouhaites),
    },
    {
      libelle: 'Le rythme de télétravail que vous cherchez',
      href: '/talent/fiche#ce-que-vous-cherchez',
      ecran: 'Ce que vous cherchez',
      present: rempli(f.remoteSouhaites),
    },
    {
      libelle: 'Votre disponibilité',
      href: '/talent/fiche#ce-que-vous-cherchez',
      ecran: 'Ce que vous cherchez',
      present: rempli(f.attentesDisponibiliteTexte),
    },
    {
      libelle: 'Ce que vous cherchez, en vos mots',
      href: '/talent/fiche#ce-que-vous-cherchez',
      ecran: 'Ce que vous cherchez',
      present: rempli(f.attentesDescription),
    },
    {
      libelle: 'Vos expertises',
      href: '/talent/fiche#ce-que-vous-cherchez',
      ecran: 'Ce que vous cherchez',
      present: rempli(f.expertisesCodes),
    },
  ];

  const remplis = attendus.filter((c) => c.present).length;
  return {
    score: Math.round((remplis / attendus.length) * 100),
    remplis,
    attendus: attendus.length,
    manquants: attendus
      .filter((c) => !c.present)
      .map(({ libelle, href, ecran }) => ({
        libelle,
        href,
        ecran,
        bloquant: BLOQUANTS.includes(libelle),
      })),
  };
}

/**
 * Les trois manques à montrer d'abord.
 *
 * Le CV et le métier visé passent devant : ce sont les deux seuls sans lesquels
 * le cabinet ne peut littéralement rien faire — l'un est le document transmis
 * au client, l'autre est ce qui rattache la personne à un mandat. Le reste suit
 * l'ordre de la fiche.
 */
export function manquantsPrioritaires(c: Completude, combien = 3): ManqueTalent[] {
  // Le rang dans `BLOQUANTS` EST le poids : le CV passe devant le métier visé,
  // et tout le reste suit dans l'ordre de la fiche. Une seule table décide donc
  // du drapeau et du tri — elles ne peuvent plus diverger.
  const poids = (m: ManqueTalent) => {
    const rang = BLOQUANTS.indexOf(m.libelle);
    return rang === -1 ? BLOQUANTS.length : rang;
  };
  return [...c.manquants].sort((a, b) => poids(a) - poids(b)).slice(0, combien);
}

/* ══════════════════════════════════════════════════════════════════════════
   5. `api.ma_candidature` — la liste
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Dix colonnes sur les quatorze de la vue.
 *
 * Laissées de côté : `mandat_id` (la liste renvoie sur la candidature, pas sur
 * le mandat), `etape_ordre` (l'ordre d'affichage est celui du dernier
 * mouvement, pas celui du process) et `date_prochaine_echeance` — mesurée
 * NULLE sur les 7 236 candidatures, donc une colonne qui ne dirait rien.
 *
 * ⚠ `etape_code` N'EST PAS DEMANDÉE, ET C'EST LE POINT DE CETTE LISTE.
 * `api.ma_candidature` projette `etape` dans le REGISTRE TALENT, qui collapse
 * délibérément quatorze étapes internes en huit phrases (D-02) : `ko`,
 * `ko_by_pachamama` et `ko_by_client` disent tous les trois « Candidature
 * close », précisément pour ne pas dire QUI a fermé. Le code, lui, le dit —
 * mesuré sur le compte de test, quatre de ses six candidatures portent
 * `ko_by_pachamama`. Aucun écran talent ne lisait cette valeur : elle était
 * demandée, elle traversait la frontière serveur, et elle ne rendait rien.
 * C'est D-15 mot pour mot — « ne pas afficher ne protège rien ; ne pas
 * demander, si ». Les seuls lecteurs de `etapeCode` sont les écrans
 * ENTREPRISE, qui la tirent de `api.candidature_client`.
 *
 * `etape_couleur` EST demandée : c'est `ref.etape_process.couleur_pastille`,
 * et c'est elle qui distingue d'un coup d'œil un profil transmis d'une
 * candidature close dans une liste de six lignes. Une pastille grise partout
 * obligerait à lire chaque libellé pour retrouver la ligne qui a bougé. Elle
 * ne trahit pas le registre : les trois « Candidature close » partagent la
 * même couleur.
 *
 * ⚠ `poste` EST LE LIBELLÉ PUBLIC, jamais le titre interne : `api.ma_candidature`
 * ne construit pas `titre` (D-06). `entreprise` est NULL sur une offre anonyme,
 * et c'est la vue qui le décide, pas cet écran — 5 des 6 candidatures du compte
 * de test sont dans ce cas.
 */
export const COLONNES_CANDIDATURE = [
  'id',
  'poste',
  'entreprise',
  'etape',
  'etape_couleur',
  'est_ko',
  'est_terminale',
  'date_entree_pipeline',
  'date_dernier_changement_etape',
  'retire_par_talent_le',
];

export type CandidatureTalent = {
  id: string;
  poste: string;
  /** `null` = offre anonyme. L'écran écrit « Entreprise confidentielle ». */
  entreprise: string | null;
  /** Le libellé du REGISTRE TALENT, emoji compris. « 👌 Profil transmis au client ». */
  etape: string | null;
  /** `ref.etape_process.couleur_pastille`. Absente ⇒ pastille neutre. */
  etapeCouleur: string | null;
  estKo: boolean;
  estTerminale: boolean;
  entreeLe: string | null;
  changeeLe: string | null;
  retireeLe: string | null;
};

export function versCandidature(l: Ligne): CandidatureTalent {
  return {
    id: String(l.id),
    poste: texte(l.poste) ?? 'Poste',
    entreprise: texte(l.entreprise),
    etape: texte(l.etape),
    etapeCouleur: texte(l.etape_couleur),
    estKo: Boolean(l.est_ko),
    estTerminale: Boolean(l.est_terminale),
    entreeLe: texte(l.date_entree_pipeline),
    changeeLe: texte(l.date_dernier_changement_etape),
    retireeLe: texte(l.retire_par_talent_le),
  };
}

/** Le nom d'une entreprise, ou ce qu'on en dit quand l'offre est anonyme. */
export const ENTREPRISE_CONFIDENTIELLE = 'Entreprise confidentielle';

export function nomEntreprise(valeur: string | null): string {
  return valeur ?? ENTREPRISE_CONFIDENTIELLE;
}

/**
 * En cours d'un côté, closes de l'autre.
 *
 * `est_terminale` est la vérité de la base : elle couvre les recrutements
 * aboutis comme les candidatures closes. On ne recalcule rien à partir de
 * `est_ko`, qui dirait « close » d'un « Recruté·e ».
 *
 * L'ordre : le dernier mouvement d'abord. Ce que quelqu'un vient voir sur cet
 * écran, c'est ce qui a bougé.
 */
export function repartirCandidatures(candidatures: readonly CandidatureTalent[]): {
  enCours: CandidatureTalent[];
  closes: CandidatureTalent[];
} {
  const parDate = (a: CandidatureTalent, b: CandidatureTalent) => {
    const ta = new Date(a.changeeLe ?? a.entreeLe ?? 0).getTime() || 0;
    const tb = new Date(b.changeeLe ?? b.entreeLe ?? 0).getTime() || 0;
    return tb - ta;
  };
  return {
    enCours: candidatures.filter((c) => !c.estTerminale).sort(parDate),
    closes: candidatures.filter((c) => c.estTerminale).sort(parDate),
  };
}

/** L'emoji d'un côté, le libellé de l'autre — l'emoji est décoratif. */
export function etapeLisible(etape: string | null): { emoji: string | null; libelle: string } {
  return decouperEtape(etape);
}

/* ══════════════════════════════════════════════════════════════════════════
   6. `api.ma_candidature_detail` — le détail
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Vingt-six colonnes sur les quarante-et-une de la vue.
 *
 * ⚠ CE QUE LA VUE NE CONSTRUIT PAS, ET QU'ON NE PEUT DONC PAS FUIR :
 * `argumentaire_client`, les six colonnes de jugement de la candidature, la
 * qualification cabinet. Le harnais de base le prouve colonne par colonne — 24
 * refus sur 24, par `select=<colonne>` et non par recherche dans le texte
 * (leçon D-16). Ici, on n'en demande simplement aucune.
 *
 * Laissées de côté parmi celles qui sont disponibles : `reference_pseudonyme`
 * (c'est le nom d'emprunt sous lequel le CLIENT voit la personne ; le lui
 * montrer n'apprend rien et expose une mécanique interne), `etape_ordre`,
 * `est_spontanee` — déductible de `mandat_id` nul —, `mandat_univers`, et les
 * quatre bornes numériques de salaire, puisque `mandat_salaire_affiche` porte
 * déjà la phrase du job board.
 *
 * ⚠ `etape_code` EST ÉCARTÉE POUR LA MÊME RAISON QUE SUR LA LISTE : elle porte
 * le registre INTERNE que `etape` collapse exprès (D-02), et aucun écran talent
 * ne la lisait. Voir le commentaire de `COLONNES_CANDIDATURE`.
 *
 * ⚠ `entreprise_logo` EST ÉCARTÉE : ce commentaire disait déjà la laisser de
 * côté, mais la liste la demandait quand même — et rien ne la rendait. Le logo
 * du client n'apparaît sur aucun écran de candidature ; le jour où il y sera,
 * il faudra le redemander ici en le disant.
 */
export const COLONNES_CANDIDATURE_DETAIL = [
  'id',
  'mandat_id',
  'poste',
  'entreprise',
  'est_anonyme',
  'etape',
  'etape_couleur',
  // ⚠ `etape_ordre` ENTRE, `etape_code` RESTE DEHORS. L'ordre situe le process
  // sur la frise des cinq étapes ; le code, lui, distingue `ko_by_client` de
  // `ko_by_pachamama` et dirait donc QUI a fermé (D-02). L'ordre suffit, parce
  // que les cinq issues partagent la même dernière marche : « Décision ».
  'etape_ordre',
  'est_ko',
  'est_terminale',
  'date_entree_pipeline',
  // `date_entree_pipeline` n'est renseignée que sur 1 candidature sur 7
  // (mesuré) ; `cree_le` l'est toujours. Sans ce repli, la première marche de
  // la frise n'aurait pas de date dans six cas sur sept.
  'cree_le',
  'date_dernier_changement_etape',
  'presente_le',
  'retire_par_talent_le',
  'motif_retrait_libelle',
  'agent_prenom',
  'agent_nom',
  'agent_photo',
  'agent_fonction',
  // L'équipe DU MANDAT. Mesuré : la fiche porte un agent référent sur 42,2 %
  // des candidatures, le mandat porte un recruteur sur 89,1 %. C'est lui qui
  // fait avancer le process, et c'est lui qu'on nomme en premier.
  'recruteur_prenom',
  'recruteur_nom',
  'recruteur_photo',
  'recruteur_fonction',
  'recruteur_2_prenom',
  'recruteur_2_nom',
  'recruteur_2_photo',
  'recruteur_2_fonction',
  'mandat_am_prenom',
  'mandat_am_nom',
  'mandat_am_photo',
  'mandat_am_fonction',
  'mandat_missions',
  'mandat_pour_toi',
  'mandat_pas_pour_toi',
  // ⚠ LES DEUX COLONNES « AFFICHE » SONT VIDES : 0 sur 7, mesuré. L'écran ne
  // demandait qu'elles, donc « Rémunération » et « Télétravail » rendaient un
  // tiret sur TOUTES les candidatures. Les colonnes nourries sont les brutes —
  // salaire min/max sur 6, remote sur 4 — et `formaterSalaire` sait déjà
  // replier l'affiché sur elles ; c'est ce que fait le job board.
  'mandat_remote_affiche',
  'mandat_remote',
  'mandat_salaire_affiche',
  'mandat_salaire_min_ke',
  'mandat_salaire_max_ke',
  'mandat_tjm_min_eur',
  'mandat_tjm_max_eur',
  'mandat_contrat',
  'mandat_univers',
  'mandat_localisation',
  'offre_encore_publiee',
];

/** Une personne de l'équipe Pachamama attachée au mandat. */
export type MembreEquipe = {
  nom: string;
  photo: string | null;
  fonction: string | null;
  /** Ce que cette personne fait sur CE process, pas son titre. */
  role: 'Recrutement' | 'Account Manager';
};

/**
 * L'ÉQUIPE DU MANDAT, DÉDUPLIQUÉE ET ORDONNÉE.
 *
 * Les recruteurs d'abord : mesuré, ce sont eux qui font avancer le process, et
 * le mandat en porte un neuf fois sur dix quand il ne porte un Account Manager
 * que trois fois sur quatre.
 *
 * ⚠ LA DÉDUPLICATION N'EST PAS COSMÉTIQUE. Une même personne est souvent à la
 * fois recruteur et AM du mandat — mesuré sur le compte de test : deux
 * candidatures sur six. Sans elle, la carte afficherait deux fois le même
 * visage sous deux étiquettes, ce qui donne l'air d'une équipe de deux.
 */
function equipeDuMandat(l: Ligne): MembreEquipe[] {
  const candidats: [string | null, string | null, string | null, string | null, MembreEquipe['role']][] = [
    [texte(l.recruteur_prenom), texte(l.recruteur_nom), texte(l.recruteur_photo), texte(l.recruteur_fonction), 'Recrutement'],
    [texte(l.recruteur_2_prenom), texte(l.recruteur_2_nom), texte(l.recruteur_2_photo), texte(l.recruteur_2_fonction), 'Recrutement'],
    [texte(l.mandat_am_prenom), texte(l.mandat_am_nom), texte(l.mandat_am_photo), texte(l.mandat_am_fonction), 'Account Manager'],
  ];
  const vus = new Set<string>();
  const equipe: MembreEquipe[] = [];
  for (const [prenom, nom, photo, fonction, role] of candidats) {
    const complet = [prenom, nom].filter(Boolean).join(' ').trim();
    if (!complet || vus.has(complet.toLowerCase())) continue;
    vus.add(complet.toLowerCase());
    equipe.push({ nom: complet, photo, fonction, role });
  }
  return equipe;
}

export type CandidatureDetail = {
  id: string;
  mandatId: string | null;
  poste: string;
  entreprise: string | null;
  estAnonyme: boolean;
  etape: string | null;
  etapeCouleur: string | null;
  estKo: boolean;
  estTerminale: boolean;
  entreeLe: string | null;
  changeeLe: string | null;
  presenteLe: string | null;
  retireeLe: string | null;
  motifRetrait: string | null;
  agentPrenom: string | null;
  agentNom: string | null;
  agentPhoto: string | null;
  agentFonction: string | null;
  /** L'équipe du MANDAT, dans l'ordre où l'écran la nomme. */
  equipe: MembreEquipe[];
  missions: string | null;
  pourToi: string | null;
  pasPourToi: string | null;
  remote: string | null;
  salaire: string | null;
  contrat: string | null;
  univers: string | null;
  localisation: string | null;
  /** Rang de l'étape dans le pipeline interne, de 1 à 14. Jamais son code. */
  etapeOrdre: number | null;
  offreEncorePubliee: boolean;
};

export function versCandidatureDetail(l: Ligne): CandidatureDetail {
  return {
    id: String(l.id),
    mandatId: texte(l.mandat_id),
    poste: texte(l.poste) ?? 'Poste',
    entreprise: texte(l.entreprise),
    estAnonyme: Boolean(l.est_anonyme),
    etape: texte(l.etape),
    etapeCouleur: texte(l.etape_couleur),
    estKo: Boolean(l.est_ko),
    estTerminale: Boolean(l.est_terminale),
    // `date_entree_pipeline` est vide six fois sur sept ; `cree_le` ne l'est
    // jamais. Le dépôt a eu lieu dans les deux cas — la frise a besoin de sa
    // première date.
    entreeLe: texte(l.date_entree_pipeline) ?? texte(l.cree_le),
    changeeLe: texte(l.date_dernier_changement_etape),
    presenteLe: texte(l.presente_le),
    retireeLe: texte(l.retire_par_talent_le),
    motifRetrait: texte(l.motif_retrait_libelle),
    agentPrenom: texte(l.agent_prenom),
    agentNom: texte(l.agent_nom),
    agentPhoto: texte(l.agent_photo),
    agentFonction: texte(l.agent_fonction),
    equipe: equipeDuMandat(l),
    missions: texte(l.mandat_missions),
    pourToi: texte(l.mandat_pour_toi),
    pasPourToi: texte(l.mandat_pas_pour_toi),
    remote: texte(l.mandat_remote_affiche) ?? texte(l.mandat_remote),
    // Le repli du job board, à l'identique : l'affiché s'il existe, sinon la
    // fourchette brute, sinon le TJM. Sans lui, la ligne était vide sept fois
    // sur sept.
    salaire:
      formaterSalaire({
        salaireAffiche: texte(l.mandat_salaire_affiche),
        salaireMinKe: nombre(l.mandat_salaire_min_ke),
        salaireMaxKe: nombre(l.mandat_salaire_max_ke),
        tjmMinEur: nombre(l.mandat_tjm_min_eur),
        tjmMaxEur: nombre(l.mandat_tjm_max_eur),
      }) ?? null,
    contrat: texte(l.mandat_contrat),
    univers: texte(l.mandat_univers),
    localisation: texte(l.mandat_localisation),
    etapeOrdre: nombre(l.etape_ordre),
    offreEncorePubliee: Boolean(l.offre_encore_publiee),
  };
}

/** Le nom de l'interlocuteur, tel qu'on l'écrit. */
export function nomAgent(c: Pick<CandidatureDetail, 'agentPrenom' | 'agentNom'>): string | null {
  const complet = [c.agentPrenom, c.agentNom].filter(Boolean).join(' ').trim();
  return complet.length > 0 ? complet : null;
}

/* ══════════════════════════════════════════════════════════════════════════
   La frise du process, vue du talent
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * QUATORZE ÉTAPES INTERNES, CINQ MARCHES MONTRÉES.
 *
 * Le pipeline relevé dans `ref.etape_process` compte quatorze rangs :
 *
 *    1 to_contact          5 screen_pachamama    10 hired
 *    2 contacted           6 send_out            11 ko
 *    3 applicant           7 interview_1         12 ko_by_pachamama
 *    4 push_candidature    8 interview_2         13 ko_by_client
 *                          9 final_interview     14 ko_by_candidat
 *
 * Les quatre premiers sont des colonnes d'entrée du CRM des recruteurs : ils
 * disent comment la candidature est arrivée, ce qui ne regarde pas le candidat
 * et ne l'informe de rien. Les trois entretiens client se lisent comme une
 * seule phase — on sait combien on en a passés, on ne sait jamais combien il en
 * reste. Et les cinq issues tiennent sur une marche unique.
 *
 * ⚠ C'EST CE DERNIER REGROUPEMENT QUI FAIT TENIR D-02. `hired`, `ko`,
 * `ko_by_pachamama`, `ko_by_client` et `ko_by_candidat` partagent la marche
 * « Décision ». Une frise qui aurait donné une marche par issue aurait dit, par
 * sa seule géométrie, laquelle s'est produite — donc qui a fermé — alors même
 * que le libellé se garde bien de le nommer.
 *
 * Le rang suffit à situer : on n'a jamais besoin du code, et le code ne franchit
 * donc pas la frontière serveur/client.
 */
export const ETAPES_FRISE = [
  'Candidature déposée',
  'Entretien Pachamama',
  'Dossier transmis au client',
  'Entretiens client',
  'Décision',
] as const;

/** Le rang interne le plus BAS de chaque marche. */
const SEUILS = [1, 5, 6, 7, 10] as const;

/** Sur quelle marche se trouve un rang interne. Hors bornes ⇒ la première. */
function marcheDe(ordre: number | null): number {
  if (ordre == null) return 0;
  let m = 0;
  for (let i = 0; i < SEUILS.length; i += 1) if (ordre >= SEUILS[i]) m = i;
  return m;
}

export type MarcheFrise = {
  libelle: string;
  /** Franchie. */
  faite: boolean;
  /** Là où on en est, process vivant. */
  courante: boolean;
  /** Là où le process s'est arrêté — close ou retirée. */
  arret: boolean;
  /** Pas encore atteinte. */
  aVenir: boolean;
  /**
   * La date qui qualifie cette marche, quand elle existe.
   *
   * ⚠ IL N'Y EN A QUE TROIS DANS LE MODÈLE, et le wireframe en dessinait une
   * par marche. `presente_le` est NULLE sur les 7 candidatures mesurées, et
   * aucune colonne ne date un entretien. On ne date donc que ce qu'on sait : le
   * dépôt, le dernier mouvement, et le retrait. Les autres marches portent leur
   * libellé seul — ce qui est honnête, là où « Transmis le — » ne le serait pas.
   */
  sousLigne: string | null;
};

/**
 * L'état de chaque marche pour une candidature.
 *
 * Trois modes, et un seul dessin par mode :
 *   · vivante — tout ce qui précède est fait, la marche atteinte est courante ;
 *   · recrutée — TOUT est fait, y compris « Décision » ;
 *   · arrêtée — la marche atteinte porte un arrêt, et la suite reste vide.
 *
 * Une candidature close s'arrête sur « Décision » (rang ≥ 10), une candidature
 * retirée aussi. C'est voulu : la marche où le process s'interrompt est la
 * décision elle-même, et ne pas remonter plus haut évite de laisser croire
 * qu'un entretien a eu lieu quand il n'y en a pas eu.
 */
export function friseDe(c: {
  etapeOrdre: number | null;
  estKo: boolean;
  estTerminale: boolean;
  entreeLe: string | null;
  changeeLe: string | null;
  retireeLe: string | null;
}): MarcheFrise[] {
  const atteinte = marcheDe(c.etapeOrdre);
  const recrute = !c.estKo && (c.etapeOrdre ?? 0) >= 10;
  const arrete = c.estKo || Boolean(c.retireeLe);

  const sousLignes: (string | null)[] = [null, null, null, null, null];
  if (c.entreeLe) sousLignes[0] = `Déposée le ${dateLongue(c.entreeLe)}`;
  if (c.retireeLe) {
    sousLignes[atteinte] = `Retirée par vous le ${dateLongue(c.retireeLe)}`;
  } else if (c.changeeLe && atteinte > 0) {
    sousLignes[atteinte] = `${arrete ? 'Close le' : 'Dernier mouvement le'} ${dateLongue(c.changeeLe)}`;
  }

  return ETAPES_FRISE.map((libelle, i) => {
    const faite = recrute ? true : i < atteinte;
    const courante = !recrute && !arrete && i === atteinte;
    const arret = arrete && i === atteinte;
    const aVenir = !faite && !courante && !arret;
    return { libelle, faite, courante, arret, aVenir, sousLigne: aVenir ? null : sousLignes[i] };
  });
}

/**
 * Un retrait n'est possible que sur une candidature VIVANTE.
 *
 * `api.retirer_ma_candidature` refuse une candidature déjà close en 23514
 * (« cette candidature est déjà close … : il n'y a rien à retirer »). L'écran
 * n'offre donc pas le geste : proposer un bouton dont on sait qu'il sera refusé
 * est une promesse qu'on ne tient pas.
 */
export function retraitPossible(c: Pick<CandidatureDetail, 'estTerminale' | 'retireeLe'>): boolean {
  return !c.estTerminale && !c.retireeLe;
}

/* ══════════════════════════════════════════════════════════════════════════
   7. `api.ma_note_partagee` — ce que le cabinet me partage
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ CETTE VUE REND ZÉRO LIGNE, ET CE N'EST PAS UN DÉFAUT.
 *
 * Mesuré : `core.note where visible_talent` = **0** sur 45 685 notes. D-04 a
 * refusé le backfill — ces notes ont été écrites sans que personne envisage
 * qu'un candidat les lise, et les ouvrir rétroactivement serait la pire des
 * décisions silencieuses. Le fil démarre donc vide sur tout dossier antérieur
 * au 09/09, et l'écran doit le DIRE plutôt que sembler cassé.
 */
export const COLONNES_NOTE = [
  'id',
  'commentaire',
  'ecrite_le',
  'auteur',
  'auteur_est_moi',
  'evenement',
  'est_automatique',
];

export type NoteTalent = {
  id: string;
  commentaire: string;
  ecriteLe: string | null;
  auteur: string;
  deMoi: boolean;
  evenement: string | null;
  automatique: boolean;
};

export function versNote(l: Ligne): NoteTalent {
  return {
    id: String(l.id),
    commentaire: texte(l.commentaire) ?? '',
    ecriteLe: texte(l.ecrite_le),
    auteur: texte(l.auteur) ?? 'Pachamama',
    deMoi: Boolean(l.auteur_est_moi),
    evenement: texte(l.evenement),
    automatique: Boolean(l.est_automatique),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   8. `api.mes_postes` — la frise d'expériences
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ `core.fiche_talent_poste` EST VIDE — 0 ligne, aucune source.
 *
 * La frise n'est PAS une reprise : c'est une saisie neuve. L'écran vide doit
 * inviter à saisir, jamais laisser croire qu'un import a échoué.
 *
 * `origine` et `fiche_talent_id` ne sont pas demandées : la première ne
 * regarde pas la personne, la seconde est déjà connue.
 */
export const COLONNES_POSTE = [
  'id',
  'intitule',
  'entreprise_nom',
  'debut_le',
  'fin_le',
  'en_cours',
  'description',
  'ordre',
];

export type PosteTalent = {
  id: string;
  intitule: string;
  employeur: string;
  debutLe: string | null;
  finLe: string | null;
  enCours: boolean;
  description: string | null;
  ordre: number | null;
};

export function versPoste(l: Ligne): PosteTalent {
  return {
    id: String(l.id),
    intitule: texte(l.intitule) ?? '',
    employeur: texte(l.entreprise_nom) ?? '',
    debutLe: texte(l.debut_le),
    finLe: texte(l.fin_le),
    enCours: Boolean(l.en_cours),
    description: texte(l.description),
    ordre: nombre(l.ordre),
  };
}

/**
 * DEUX FORMES POUR UNE MÊME PÉRIODE, et il faut traduire entre elles.
 *
 * La base porte deux `date` (`debut_le`, `fin_le`). `FriseParcours` du design
 * system porte une année OBLIGATOIRE et un mois FACULTATIF — parce que
 * personne ne se souvient du jour où il a pris un poste, et qu'un sélecteur de
 * jour force à inventer. Le jour est donc posé au 1er du mois à l'aller, et
 * ignoré au retour.
 *
 * `anneeDebut` est obligatoire côté frise : une ligne de base sans `debut_le`
 * — possible, la colonne est nullable — replierait sur l'année courante et
 * mentirait. On la range plutôt en `null` et l'appelant l'écarte.
 *
 * ⚠ LE TYPE DE RETOUR EST CELUI DU COMPOSANT, importé en `import type`. Un
 * import de type est effacé à la compilation : il ne fait donc PAS entrer
 * `FriseParcours.tsx` — qui porte `'use client'` — dans le graphe serveur. Le
 * recopier ici donnerait deux formes à tenir d'accord, et la première
 * divergence se verrait à l'exécution, pas au typage.
 */
export function versEntreeFrise(p: PosteTalent): EntreeParcours | null {
  const debut = p.debutLe ? new Date(p.debutLe) : null;
  if (!debut || Number.isNaN(debut.getTime())) return null;
  const fin = p.finLe ? new Date(p.finLe) : null;
  const finValide = fin && !Number.isNaN(fin.getTime()) ? fin : null;
  return {
    cle: p.id,
    employeur: p.employeur,
    intitule: p.intitule,
    anneeDebut: debut.getUTCFullYear(),
    moisDebut: debut.getUTCMonth() + 1,
    anneeFin: finValide ? finValide.getUTCFullYear() : null,
    moisFin: finValide ? finValide.getUTCMonth() + 1 : null,
    enPoste: p.enCours,
    description: p.description ?? '',
  };
}

/** `2019`, `3` → `2019-03-01`. Le 1er du mois : voir `versEntreeFrise`. */
export function versDateIso(annee: number, mois?: number | null): string {
  const m = String(mois && mois >= 1 && mois <= 12 ? mois : 1).padStart(2, '0');
  return `${String(annee).padStart(4, '0')}-${m}-01`;
}

/* ── Le plan de synchronisation de la frise ───────────────────────────────── */

/**
 * ⚠ LA PIÈCE LA PLUS RISQUÉE DE L'ÉCRAN « MON PARCOURS », ISOLÉE POUR ÊTRE
 * ÉPROUVÉE.
 *
 * `FriseParcours` rend le TABLEAU COMPLET à chaque validation, ajout ou
 * retrait — c'est son contrat, et il est juste pour un composant qui ne connaît
 * pas la base. Mais la base offre trois fonctions distinctes :
 * `ajouter_mon_poste`, `maj_mon_poste`, `supprimer_mon_poste`. Il faut donc
 * différencier, et le composant nous en donne le moyen sans le savoir :
 *
 *   · une entrée dont la clé est un uuid vient de `api.mes_postes` ;
 *   · une entrée neuve porte la clé que le composant fabrique,
 *     `<useId>-<horodatage>` (`FriseParcours.tsx:294`) — jamais un uuid.
 *
 * ⚠ LE DÉFAUT QUE CETTE FONCTION EXISTE POUR NE PAS COMMETTRE : traiter une
 * entrée déjà enregistrée comme un ajout crée un DOUBLON SILENCIEUX. Le cas
 * arrive dès qu'on garde un état local optimiste après un ajout — la ligne
 * existe alors en base avec un vrai uuid tandis que l'écran porte encore la clé
 * temporaire. C'est pour cela que le calcul vit ici, en pur, et qu'il est
 * testé : dans le corps d'un composant, il n'aurait été relu par personne.
 *
 * Elle ne décide RIEN d'autre que « quel verbe pour quelle ligne ». Ce que la
 * base accepte reste l'affaire des fonctions `api.*`.
 */
export type EntreeSynchronisable = EntreeParcours;

export type PlanSynchronisation = {
  /** Les identifiants à supprimer, dans l'ordre où ils étaient affichés. */
  retraits: string[];
  /** Les entrées à créer, avec leur rang d'affichage. */
  ajouts: { entree: EntreeParcours; rang: number }[];
  /** Les entrées existantes à réécrire, avec leur identifiant et leur rang. */
  majs: { entree: EntreeParcours; posteId: string; rang: number }[];
};

/** Deux entrées identiques n'appellent PAS d'écriture. Voir `planDeSynchronisation`. */
export function entreesIdentiques(a: EntreeParcours, b: EntreeParcours): boolean {
  const norme = (e: EntreeParcours) =>
    [
      e.intitule.trim(),
      e.employeur.trim(),
      e.anneeDebut,
      e.moisDebut ?? '',
      e.anneeFin ?? '',
      e.moisFin ?? '',
      e.enPoste ? '1' : '0',
      (e.description ?? '').trim(),
    ].join('|');
  return norme(a) === norme(b);
}

export function planDeSynchronisation(
  avant: readonly EntreeParcours[],
  apres: readonly EntreeParcours[],
): PlanSynchronisation {
  const connues = new Map<string, { entree: EntreeParcours; rang: number }>();
  avant.forEach((e, rang) => {
    if (estUuid(e.cle)) connues.set(e.cle, { entree: e, rang });
  });
  const restantes = new Set(apres.map((e) => e.cle));

  const plan: PlanSynchronisation = { retraits: [], ajouts: [], majs: [] };

  for (const [cle] of connues) {
    if (!restantes.has(cle)) plan.retraits.push(cle);
  }

  apres.forEach((entree, rang) => {
    const connue = connues.get(entree.cle);
    if (!connue) {
      plan.ajouts.push({ entree, rang });
      return;
    }
    // ⚠ LE RANG COMPTE AUTANT QUE LE CONTENU : `ordre` le suit, donc déplacer
    // une ligne est une modification. Sans cette comparaison, retirer une
    // entrée laisserait les suivantes avec un `ordre` périmé — et la frise et
    // la base ne raconteraient plus la même histoire.
    if (entreesIdentiques(connue.entree, entree) && connue.rang === rang) return;
    plan.majs.push({ entree, posteId: entree.cle, rang });
  });

  return plan;
}

/* ══════════════════════════════════════════════════════════════════════════
   9. `api.mon_referentiel` — les vocabulaires
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les dix vocabulaires que la vue publie, et leur volume mesuré le 09/09 :
 * métier 255 · univers 8 · metier_univers 361 · secteur 52 · critère 32 ·
 * expertise 33 · contrat 3 · remote 4 · motif_retrait 7 · étape 14.
 * **769 lignes en tout.**
 *
 * ⚠ ON NE LES CHARGE JAMAIS TOUS. Chaque écran demande les siens, par
 * `in.(…)` : la liste franchit la frontière serveur → client (les `Combobox` et
 * `ChampTags` sont des composants clients), donc 769 lignes inutiles seraient
 * 769 lignes dans le HTML servi. C'est encore D-15, par la porte du
 * référentiel.
 */
export type Referentiel =
  | 'metier'
  | 'univers'
  | 'metier_univers'
  | 'secteur'
  | 'critere'
  | 'expertise'
  | 'contrat'
  | 'remote'
  | 'motif_retrait'
  | 'etape';

export const COLONNES_REFERENTIEL = ['referentiel', 'code', 'libelle', 'ordre'];

export type EntreeReferentiel = { referentiel: string; code: string; libelle: string; ordre: number | null };

export function versEntreeReferentiel(l: Ligne): EntreeReferentiel {
  return {
    referentiel: String(l.referentiel),
    code: String(l.code),
    libelle: texte(l.libelle) ?? String(l.code),
    ordre: nombre(l.ordre),
  };
}

/** `{ metier: [...], univers: [...] }` — groupé une fois, côté serveur. */
export function grouperReferentiel(
  entrees: readonly EntreeReferentiel[],
): Record<string, { valeur: string; libelle: string }[]> {
  const par: Record<string, { valeur: string; libelle: string }[]> = {};
  for (const e of entrees) {
    (par[e.referentiel] ??= []).push({ valeur: e.code, libelle: e.libelle });
  }
  // `ordre` est nul sur une partie des vocabulaires (mesuré sur `ref.metier`) :
  // le tri SQL le range en dernier, et on retombe alors sur l'alphabet français
  // — le seul ordre qu'une liste de 255 métiers puisse offrir à qui cherche.
  for (const cle of Object.keys(par)) {
    par[cle].sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));
  }
  return par;
}

/** Le libellé d'un code, ou le code lui-même — jamais rien. */
export function libelleDe(
  options: readonly { valeur: string; libelle: string }[],
  code: string | null,
): string | null {
  if (!code) return null;
  return options.find((o) => o.valeur === code)?.libelle ?? code;
}

/** Les libellés d'une liste de codes, dans l'ordre des options. */
export function libellesDe(
  options: readonly { valeur: string; libelle: string }[],
  codes: readonly string[],
): string[] {
  const vus = new Set(codes);
  const connus = options.filter((o) => vus.has(o.valeur)).map((o) => o.libelle);
  const inconnus = codes.filter((c) => !options.some((o) => o.valeur === c));
  return [...connus, ...inconnus];
}

/* ══════════════════════════════════════════════════════════════════════════
   10. Ce que Pachamama fait des données — écrit une fois, lu par deux écrans
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * CE QUE LE CABINET DÉTIENT, PAR NATURE DE DONNÉE.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UNE PORTÉE, PAS UNE DURÉE — ET C'EST LA SEULE CHOSE QU'ON SACHE DIRE
 * ─────────────────────────────────────────────────────────────────────────
 * Le wireframe donnait une durée de conservation par ligne : « deux ans après
 * le dernier mouvement », « trois ans, obligation légale ». **Aucune de ces
 * durées n'existe** — ni dans le modèle, ni dans un document du cabinet. Les
 * écrire serait publier une politique de conservation inventée, dont une ligne
 * invoquerait une obligation légale qu'on n'a pas vérifiée. C'est le genre de
 * phrase qu'un candidat opposera un jour au cabinet.
 *
 * On dit donc ce qu'on SAIT : qui voit quoi. C'est la question que la personne
 * vient réellement poser, et la réponse est mesurable dans le modèle.
 *
 * ⚠ LES NOTES D'ENTRETIEN SONT NOMMÉES. C'est la donnée que les candidats ne
 * soupçonnent pas — 45 685 notes en base — et la taire serait le seul vrai
 * manquement de cet écran. On dit aussi ce qui en sort : `visible_talent` est
 * à zéro sur les 45 685, donc rien n'a jamais été partagé, et le libellé le
 * présente comme une possibilité et non comme un usage.
 */
export const DONNEES_DETENUES: readonly { quoi: string; portee: string }[] = [
  {
    quoi: 'Votre fiche, votre CV et votre parcours',
    portee:
      'Transmis à une entreprise cliente au moment où nous vous présentons pour un poste, et à elle seule.',
  },
  {
    quoi: 'Vos coordonnées : adresse électronique, téléphone, profil LinkedIn',
    portee: 'Jamais transmises à un client : on vous joint par le cabinet.',
  },
  {
    quoi: 'Vos candidatures et leur étape',
    portee:
      'L’historique des postes auxquels vous avez été présenté·e, et où en est chacun d’eux.',
  },
  {
    quoi: 'Les notes de vos entretiens',
    portee:
      'Internes. Votre interlocuteur peut choisir de vous en partager une : elle apparaît alors sur le process concerné.',
  },
];

/** Ce que le cabinet ne fait PAS de ces données. Vrai, et vérifiable. */
export const USAGES_EXCLUS =
  'Nous ne vendons ni ne louons ces informations, et nous ne les publions nulle part.';

/* ══════════════════════════════════════════════════════════════════════════
   11. Le retour d'une candidature déposée
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * `api.postuler` rend un `jsonb`. On ne lit que `candidature_id` : c'est ce qui
 * permet d'envoyer la personne sur SA candidature juste après l'avoir déposée,
 * plutôt que de la laisser sur l'offre en se demandant si ça a marché.
 */
export function candidatureIdDe(charge: unknown): string | null {
  if (!charge || typeof charge !== 'object') return null;
  const brut = (charge as Record<string, unknown>).candidature_id;
  return typeof brut === 'string' && estUuid(brut) ? brut : null;
}
