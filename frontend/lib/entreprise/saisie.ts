import { createHash } from 'node:crypto';
import { z } from 'zod';

/**
 * LES RÈGLES DE SAISIE DU PORTAIL ENTREPRISE, séparées des Server Actions.
 *
 * ELLES VIVAIENT DANS `actions.ts`, ET ELLES N'Y ÉTAIENT PAS ÉPROUVABLES : un
 * module `'use server'` ne peut exporter que des fonctions asynchrones — pas un
 * schéma, pas une constante. Les schémas étaient donc hors de portée d'un test
 * unitaire, alors que c'est exactement la couche qui décide si « 55000 » part
 * dans un champ libellé en milliers d'euros, et si une chaîne vide efface une
 * colonne.
 *
 * Les sortir d'un cran les rend testables (`saisie.test.ts`), et réutilisables
 * le jour où un formulaire voudra valider avant l'envoi. Ce module ne doit
 * jamais devenir « la » validation, seulement la première : celle qui compte
 * est dans les fonctions `api.*`, et derrière elles dans les contraintes de
 * PostgreSQL.
 */

/** `<nonce>-<empreinte>` — voir l'en-tête du fichier. */
export function cleIdempotence(nonce: string, charge: unknown): string {
  const empreinte = createHash('sha1').update(JSON.stringify(charge)).digest('hex').slice(0, 16);
  const propre = nonce.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'sans-nonce';
  return `${propre}-${empreinte}`;
}

/**
 * Un texte de formulaire, rendu tel que la base l'attend.
 *
 * ⚠ LE CONTRAT DES FONCTIONS « maj_ » : elles enregistrent un FORMULAIRE
 * ENTIER, et un argument nul EFFACE la valeur. Une chaîne vide doit donc
 * devenir `null` — sinon on écrirait `''` là où la colonne portait `NULL`, ce
 * que le journal comptabiliserait comme un changement à chaque envoi.
 */
export const optionnel = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

/**
 * Un nombre saisi dans un champ texte.
 *
 * ⚠ `.optional()` EST OBLIGATOIRE, ET NON DÉCORATIF. La première version
 * écrivait `z.union([z.string(), z.number(), z.null(), z.undefined()])`, ce qui
 * accepte bien `undefined` quand on parse la valeur SEULE — mais pas quand la
 * CLÉ MANQUE dans l'objet : zod v4 lit l'optionalité sur le schéma lui-même, et
 * une union qui contient `z.undefined()` n'est pas un schéma optionnel. Tout
 * formulaire envoyé sans son champ « nombre d'employés » était donc refusé par
 * « expected nonoptional, received undefined » — c'est-à-dire, en pratique, la
 * totalité des enregistrements de fiche entreprise et de brief. Trouvé par
 * `saisie.test.ts`, pas à la relecture.
 *
 * La virgule décimale est acceptée : c'est ce qu'on tape sur un clavier
 * français, et `Number('62,5')` rend NaN.
 */
export const nombreOptionnel = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const t = typeof v === 'string' ? v.trim().replace(',', '.') : v;
    if (t === '') return null;
    const n = Number(t);
    // Une saisie illisible est REFUSÉE, pas effacée. Rendre `null` ici faisait
    // disparaître l'effectif de l'entreprise quand on tapait « douze » : une
    // perte de donnée silencieuse, le pire mode d'échec d'un formulaire.
    if (!Number.isFinite(n)) return Number.NaN;
    return n;
  })
  .refine((n) => n === null || Number.isFinite(n), 'Un nombre est attendu.');

export const uuid = z.string().uuid('Identifiant invalide.');
export const nonce = z.string().min(1).max(80);

/* ══════════════════════════════════════════════════════════════════════════
   Décider d'un candidat présenté
   ══════════════════════════════════════════════════════════════════════════ */

export const SCHEMA_DECISION = z
  .object({
    candidatureId: uuid,
    sens: z.enum(['valide', 'entretien_demande', 'refuse']),
    motif: optionnel,
    commentaire: optionnel,
    nonce,
  })
  .refine((v) => v.sens !== 'refuse' || Boolean(v.motif), {
    message: 'Un refus demande un motif.',
    path: ['motif'],
  })
  .refine((v) => v.sens === 'refuse' || !v.motif, {
    message: 'Le motif ne s’emploie qu’avec un refus.',
    path: ['motif'],
  });

export type ChargeDecision = z.input<typeof SCHEMA_DECISION>;

/* ══════════════════════════════════════════════════════════════════════════
   Commenter une candidature
   ══════════════════════════════════════════════════════════════════════════ */

export const SCHEMA_COMMENTAIRE = z.object({
  candidatureId: uuid,
  commentaire: z
    .string()
    .trim()
    .min(1, 'Un commentaire vide n’est pas un commentaire.')
    .max(5000, 'Un commentaire tient en 5 000 caractères.'),
  nonce,
});

export type ChargeCommentaire = z.input<typeof SCHEMA_COMMENTAIRE>;

/* ══════════════════════════════════════════════════════════════════════════
   La vitrine de l'entreprise
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les règles de saisie sont ALIGNÉES sur celles de `api.maj_entreprise` après
 * son correctif du 12/09, pas sur ce qu'on aimerait que la donnée soit.
 * Mesuré sur les 851 entreprises : `site_web` est un domaine nu 133 fois sur
 * 259, `logo_url` protocole-relatif 275 fois sur 363, et `video_url` est un
 * identifiant YouTube nu sur ses 47 lignes remplies — jamais une URL. Exiger
 * `https://` ici referait exactement le défaut que la migration a réparé : un
 * client incapable d'enregistrer sa propre fiche sans y toucher.
 */
export const SCHEMA_ENTREPRISE = z.object({
  description: optionnel.pipe(
    z.string().max(10000, 'La présentation tient en 10 000 caractères.').nullable(),
  ),
  fondateur: optionnel,
  serieFinancement: optionnel,
  siteWeb: optionnel.pipe(
    z
      .string()
      .refine((v) => !/\s/.test(v) && v.includes('.'), 'Une adresse sans espace, avec un point.')
      .nullable(),
  ),
  siret: optionnel.pipe(
    z
      .string()
      .transform((v) => v.replace(/\s/g, ''))
      // 32 des 851 entreprises portent un SIREN à 9 chiffres, pas un SIRET :
      // exiger 14 empêchait ces clients d'enregistrer la moindre modification
      // de leur fiche, sur un champ qu'ils n'avaient pas touché. Mesuré.
      .refine(
        (v) => /^[0-9]{9}$/.test(v) || /^[0-9]{14}$/.test(v),
        'Un SIREN compte 9 chiffres, un SIRET 14.',
      )
      .nullable(),
  ),
  videoUrl: optionnel.pipe(
    z
      .string()
      .refine(
        (v) => !/\s/.test(v) && (/^(https?:)?\/\//i.test(v) || /^[A-Za-z0-9_-]{8,64}$/.test(v)),
        'Une URL de vidéo, ou l’identifiant YouTube seul.',
      )
      .nullable(),
  ),
  logoUrl: optionnel.pipe(
    z
      .string()
      .refine(
        (v) => !/\s/.test(v) && /^(https?:)?\/\/|^\//i.test(v),
        'Une adresse d’image, commençant par http(s):// ou /.',
      )
      .nullable(),
  ),
  localisation: optionnel,
  nbEmployes: nombreOptionnel,
  nbTechs: nombreOptionnel,
  nonce,
});

export type ChargeEntreprise = z.input<typeof SCHEMA_ENTREPRISE>;

/* ══════════════════════════════════════════════════════════════════════════
   Le produit
   ══════════════════════════════════════════════════════════════════════════ */

export const SCHEMA_PRODUIT = z.object({
  produitId: uuid,
  description: optionnel,
  texteAnnonce: optionnel,
  /**
   * La maturité est renvoyée TELLE QUELLE par le formulaire, jamais modifiée.
   * `api.maj_produit` enregistre ses trois colonnes en bloc : ne pas la
   * transmettre l'effacerait. Le référentiel `ref.maturite_produit` n'étant pas
   * exposé au réseau, l'écran ne peut pas en proposer d'autre — il conserve
   * donc la valeur en place et le dit.
   */
  maturiteCode: optionnel,
  nonce,
});

export type ChargeProduit = z.input<typeof SCHEMA_PRODUIT>;

/* ══════════════════════════════════════════════════════════════════════════
   Les coordonnées de facturation
   ══════════════════════════════════════════════════════════════════════════ */

export const SCHEMA_FACTURATION = z.object({
  emailFacturation: optionnel.pipe(
    z.string().email('Ce n’est pas une adresse électronique.').nullable(),
  ),
  raisonSociale: optionnel,
  ligne1: optionnel,
  ligne2: optionnel,
  codePostal: optionnel,
  ville: optionnel,
  pays: optionnel,
  nonce,
});

export type ChargeFacturation = z.input<typeof SCHEMA_FACTURATION>;

/* ══════════════════════════════════════════════════════════════════════════
   Le brief d'un poste
   ══════════════════════════════════════════════════════════════════════════ */

export const listeCourte = z
  .array(z.string().trim().min(1))
  .max(20, 'Vingt éléments au plus.')
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

export const SCHEMA_BRIEF = z
  .object({
    titre: z
      .string()
      .trim()
      .min(3, 'L’intitulé du poste est obligatoire.')
      .max(200, 'L’intitulé tient en 200 caractères.'),
    metierCode: optionnel,
    universCode: optionnel,
    contrat: z
      .enum(['cdi', 'freelance', 'entrepreneur'])
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    salaireMinKe: nombreOptionnel,
    salaireMaxKe: nombreOptionnel,
    tjmMinEur: nombreOptionnel,
    tjmMaxEur: nombreOptionnel,
    experienceMinAnnees: nombreOptionnel,
    missions: optionnel,
    remoteInfos: optionnel,
    localisation: optionnel,
    mustHave: listeCourte,
    niceToHave: listeCourte,
    nonce,
  })
  // Les mêmes bornes que `app.controler_brief`, redites ici pour que l'écran
  // arrête la faute AVANT l'aller-retour. La base reste l'arbitre : ces règles
  // sont un confort de saisie, pas une garantie.
  .refine((v) => v.salaireMinKe === null || (v.salaireMinKe >= 0 && v.salaireMinKe <= 1000), {
    message: 'Le salaire s’exprime en MILLIERS d’euros : 65 pour 65 000 €.',
    path: ['salaireMinKe'],
  })
  .refine((v) => v.salaireMaxKe === null || (v.salaireMaxKe >= 0 && v.salaireMaxKe <= 1000), {
    message: 'Le salaire s’exprime en MILLIERS d’euros : 80 pour 80 000 €.',
    path: ['salaireMaxKe'],
  })
  .refine(
    (v) => v.salaireMinKe === null || v.salaireMaxKe === null || v.salaireMinKe <= v.salaireMaxKe,
    { message: 'Le minimum dépasse le maximum.', path: ['salaireMaxKe'] },
  )
  .refine((v) => v.tjmMinEur === null || (v.tjmMinEur >= 0 && v.tjmMinEur <= 10000), {
    message: 'Le TJM s’exprime en euros par jour.',
    path: ['tjmMinEur'],
  })
  .refine((v) => v.tjmMaxEur === null || (v.tjmMaxEur >= 0 && v.tjmMaxEur <= 10000), {
    message: 'Le TJM s’exprime en euros par jour.',
    path: ['tjmMaxEur'],
  })
  .refine((v) => v.tjmMinEur === null || v.tjmMaxEur === null || v.tjmMinEur <= v.tjmMaxEur, {
    message: 'Le minimum dépasse le maximum.',
    path: ['tjmMaxEur'],
  })
  .refine(
    (v) =>
      v.experienceMinAnnees === null ||
      (Number.isInteger(v.experienceMinAnnees) &&
        v.experienceMinAnnees >= 0 &&
        v.experienceMinAnnees <= 50),
    { message: 'Un nombre entier d’années, de 0 à 50.', path: ['experienceMinAnnees'] },
  );

export type ChargeBrief = z.input<typeof SCHEMA_BRIEF>;

/**
 * Conservé sans appelant, et c'est délibéré : `api.maj_mandat` existe côté
 * base, et le jour où une vue rendra les cinq colonnes de fond du brief au
 * portail, l'action se réécrit en trois lignes. Un schéma n'expose rien — à la
 * différence d'une Server Action, qui publie un point d'entrée POST.
 */
export const SCHEMA_MAJ_MANDAT = z.object({ mandatId: uuid });

export const SCHEMA_PAUSE = z.object({ mandatId: uuid, nonce });

export const SCHEMA_CLOTURE = z.object({
  mandatId: uuid,
  motif: optionnel.pipe(z.string().max(2000, 'Le motif tient en 2 000 caractères.').nullable()),
  nonce,
});

/* ══════════════════════════════════════════════════════════════════════════
   Mes propres informations
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le prénom et le nom sont EXIGÉS, contrairement à presque tout le reste de ce
 * fichier. Ce sont les deux seules valeurs dont l'absence casse un affichage :
 * la coquille des écrans connectés compose le nom visible à partir d'elles, et
 * un nom vide s'y lit comme un défaut. `core.contact_client` ne pose pourtant
 * pas de NOT NULL dessus — c'est un choix de la reprise, mesuré sur les 524
 * contacts, et on ne le contredit pas en base ; on l'exige au formulaire.
 *
 * L'adresse n'est pas dans ce schéma, et n'y sera pas : c'est l'identité
 * d'authentification. La changer est un autre acte que corriger son nom.
 */
export const SCHEMA_MON_COMPTE = z.object({
  prenom: z.string().trim().min(1, 'Votre prénom est attendu.').max(120),
  nom: z.string().trim().min(1, 'Votre nom est attendu.').max(120),
  description: optionnel,
  photoUrl: optionnel.pipe(
    z
      .string()
      .refine(
        (v) => !/\s/.test(v) && (/^(https?:)?\/\//i.test(v) || v.startsWith('/')),
        'Une adresse d’image : http://, https://, //hôte ou /chemin.',
      )
      .nullable(),
  ),
  metierCode: optionnel,
  nonce,
});

export type ChargeMonCompte = z.input<typeof SCHEMA_MON_COMPTE>;

/* ══════════════════════════════════════════════════════════════════════════
   8. Le dépôt de la photo
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le plafond du seau `documents-entreprise`, redit ici. 2 Mo.
 *
 * ⚠ IL EST REDIT, PAS DÉDUIT. Le seau porte la même valeur (migration
 * `20260913230000`) et c'est lui la barrière ultime — mesuré sur son jumeau du
 * talent, un dépassement rend 413 même en contournant l'écran. Celle-ci sert à
 * deux choses que le seau ne peut pas faire : l'ANNONCER avant le choix, dans
 * l'aide du champ, et refuser le fichier sans consommer l'aller-retour.
 *
 * Deux mégaoctets et non dix : il n'y a ici qu'un avatar de 56 px de côté.
 */
export const TAILLE_MAX_PHOTO_OCTETS = 2 * 1024 * 1024;

/** Les trois formats d'image que le navigateur sait afficher partout. */
export const TYPES_PHOTO = ['image/jpeg', 'image/png', 'image/webp'] as const;
