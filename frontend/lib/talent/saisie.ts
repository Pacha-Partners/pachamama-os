import { z } from 'zod';

import { cleIdempotence, nombreOptionnel, optionnel } from '@/lib/entreprise/saisie';

/**
 * LES RÈGLES DE SAISIE DE L'ESPACE TALENT, séparées des Server Actions.
 *
 * Même raison qu'en phase 1 : un module `'use server'` ne peut exporter que des
 * fonctions asynchrones, donc un schéma qui y vit est hors de portée d'un test
 * unitaire — alors que c'est exactement la couche qui décide si une chaîne vide
 * efface une colonne. Sortis d'un cran, ils sont éprouvables (`saisie.test.ts`).
 *
 * Ce module ne doit jamais devenir « la » validation, seulement la première :
 * celle qui compte est dans les fonctions `api.*`, et derrière elles dans les
 * contraintes de PostgreSQL.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ MODULE DE SERVEUR — il importe `node:crypto` par ricochet
 * ─────────────────────────────────────────────────────────────────────────
 * `cleIdempotence` vient de `lib/entreprise/saisie.ts`, qui appelle
 * `createHash`. Aucun composant client ne doit donc importer ce fichier ; seul
 * `lib/talent/actions.ts` le fait, comme dans le portail entreprise.
 *
 * `optionnel` et `nombreOptionnel` sont réemployés tels quels. Le premier
 * transforme une chaîne vide en `null`, ce qu'exige le contrat « le formulaire
 * est enregistré ENTIER, un argument nul efface la valeur ». Le second refuse
 * une saisie illisible au lieu de l'effacer (D-18) et accepte la virgule
 * décimale, qui est ce qu'on tape sur un clavier français.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES RÈGLES SONT ALIGNÉES SUR CE QUE LA BASE ACCEPTE, ET MESURÉES
 * ─────────────────────────────────────────────────────────────────────────
 * Relevé le 09/09 sur les 7 023 fiches actives, et c'est ce relevé qui dicte
 * les règles d'URL ci-dessous :
 *
 *   · `cv_url` renseigné 3 926 fois, dont **3 926 en `//hôte/…`** et 0 en
 *     `http(s)://` ;
 *   · `photo_url` 3 429 fois, dont 3 337 en `//hôte/…` ;
 *   · `portfolio_url` 737 fois, dont **24 qui ne sont pas des URL** — « à
 *     présenter en visio (trop de NDA signés) », un lien avec son mot de passe
 *     entre parenthèses, deux liens dans la même case.
 *
 * Un `^https?://` — le défaut que la migration `20260912109000` a réparé pour
 * l'entreprise (D-17) — aurait empêché **100 %** des talents porteurs d'un CV
 * d'enregistrer leur fiche. Et imposer une forme d'URL au portfolio, ce serait
 * écrire une règle contre la donnée : il n'en porte aucune, seulement une
 * longueur.
 */

export { cleIdempotence };

export const uuid = z.string().uuid('Identifiant invalide.');
export const nonce = z.string().min(1).max(80);

/**
 * La règle d'URL de `api.maj_ma_fiche`, redite ici pour arrêter la faute avant
 * l'aller-retour : pas d'espace, et commence par `http://`, `https://`, `//`
 * ou `/`. Le dernier cas couvre nos propres objets stockés,
 * `/documents-talent/<fiche>/cv/…`.
 */
const FORME_URL = /^(https?:\/\/|\/\/|\/)/i;

const urlSouple = (message: string) =>
  optionnel.pipe(
    z
      .string()
      .max(2000, 'Cette adresse est trop longue.')
      .refine((v) => !/\s/.test(v) && FORME_URL.test(v), message)
      .nullable(),
  );

/* ══════════════════════════════════════════════════════════════════════════
   1. Mon profil — identité, coordonnées, documents
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ PRÉNOM ET NOM SONT EXIGÉS, ET CELA VA BLOQUER DES GENS.
 *
 * `api.maj_ma_fiche` lève `22004` sans eux, et c'est justifié : c'est sous ce
 * nom que le cabinet présente quelqu'un à un client (D-14). Mesuré : **51
 * fiches actives sans prénom et 56 sans nom**. Ces personnes ne pourront rien
 * enregistrer avant de les renseigner — la différence avec le blocage de D-17,
 * c'est que le champ fautif est sous leurs yeux, dans le premier bloc de
 * l'écran, avec son message.
 */
export const SCHEMA_PROFIL = z.object({
  prenom: z
    .string()
    .trim()
    .min(1, 'Votre prénom est obligatoire.')
    .max(120, 'Prénom et nom tiennent en 120 caractères.'),
  nom: z
    .string()
    .trim()
    .min(1, 'Votre nom est obligatoire.')
    .max(120, 'Prénom et nom tiennent en 120 caractères.'),
  emailPersonnel: optionnel.pipe(
    z.string().email('Ce n’est pas une adresse électronique.').nullable(),
  ),
  telephone: optionnel.pipe(
    z.string().max(40, 'Un numéro tient en 40 caractères.').nullable(),
  ),
  // Mesuré : 34 `url_linkedin` sont inutilisables — « ok », « t », « test »,
  // trois prénoms. La règle les refuse, délibérément : un lien qui ne mène
  // nulle part sur une fiche transmise à un client est pire que son absence.
  urlLinkedin: optionnel.pipe(
    z
      .string()
      .max(500, 'Cette adresse est trop longue.')
      .refine(
        (v) => !/\s/.test(v) && v.includes('.'),
        'Une adresse sans espace, avec un point — par exemple linkedin.com/in/votre-nom.',
      )
      .nullable(),
  ),
  localisationTexte: optionnel.pipe(
    z.string().max(300, 'Trois cents caractères au plus.').nullable(),
  ),
  photoUrl: urlSouple('Une adresse d’image. Déposez plutôt un fichier, c’est plus simple.'),
  cvUrl: urlSouple('Déposez plutôt un fichier.'),
  // AUCUNE règle de forme : voir l'en-tête. 24 des 737 valeurs sont de la prose,
  // et elles ont un sens pour la personne qui les a écrites.
  portfolioUrl: optionnel.pipe(
    z
      .string()
      .max(1000, 'Mille caractères au plus.')
      .nullable(),
  ),
  nonce,
});

export type ChargeProfil = z.input<typeof SCHEMA_PROFIL>;

/* ══════════════════════════════════════════════════════════════════════════
   2. Mes attentes
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les bornes sont celles d'`app.controler_attentes_talent`, redites pour que
 * l'écran arrête la faute avant l'aller-retour. La base reste l'arbitre.
 *
 * ⚠ POURQUOI `verifierFourchette` DU DESIGN SYSTEM N'EST PAS RÉEMPLOYÉE ICI,
 * alors que son commentaire dit qu'« une Server Action a le même besoin ».
 * `components/pacha/ChampFourchette.tsx` porte `'use client'` : un export
 * importé depuis un module serveur y devient une référence client, qui lève
 * dès qu'on l'appelle sur le serveur. L'intention de l'export est bonne, sa
 * réalisation ne peut pas la tenir sans sortir la fonction dans un module
 * neutre — ce qui toucherait un fichier du design system, hors de mon
 * périmètre. La règle est donc écrite ici, et le formulaire, lui, emploie bien
 * celle du composant : les deux disent la même chose et l'une des deux est
 * signalée comme le doublon.
 */
export const SCHEMA_ATTENTES = z
  .object({
    metierCode: optionnel,
    universCode: optionnel,
    salaireMinKe: nombreOptionnel,
    salaireMaxKe: nombreOptionnel,
    tjmMinEur: nombreOptionnel,
    tjmMaxEur: nombreOptionnel,
    disponibiliteTexte: optionnel.pipe(
      z.string().max(500, 'Cinq cents caractères au plus.').nullable(),
    ),
    localisationTexte: optionnel.pipe(
      z.string().max(500, 'Cinq cents caractères au plus.').nullable(),
    ),
    description: optionnel.pipe(
      z.string().max(10000, 'Dix mille caractères au plus.').nullable(),
    ),
    rechercheActive: z
      .boolean()
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    nonce,
  })
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
    { message: 'Le maximum ne peut pas être inférieur au minimum.', path: ['salaireMaxKe'] },
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
    message: 'Le maximum ne peut pas être inférieur au minimum.',
    path: ['tjmMaxEur'],
  });

export type ChargeAttentes = z.input<typeof SCHEMA_ATTENTES>;

/* ══════════════════════════════════════════════════════════════════════════
   3. Mes listes déclaratives
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les six types que `api.maj_mes_listes` accepte, énumérés à l'identique.
 *
 * ⚠ `fiche_talent_tag` N'EST PAS DANS CETTE LISTE, et ce n'est pas un oubli :
 * le tag est posé PAR le cabinet SUR la personne, la policy
 * `talent_ses_satellites` l'exclut délibérément des onze satellites, et aucun
 * `p_type` ne l'atteint côté base.
 */
export const TYPES_LISTE = [
  'secteur_vise',
  'secteur_nogo',
  'critere',
  'contrat',
  'remote',
  'expertise',
] as const;

export type TypeListe = (typeof TYPES_LISTE)[number];

export const SCHEMA_LISTE = z.object({
  type: z.enum(TYPES_LISTE),
  // 50 : le plafond de la fonction. Un tableau vide est LÉGITIME — c'est ainsi
  // qu'on vide une liste — donc pas de `min(1)`.
  codes: z
    .array(z.string().trim().min(1))
    .max(50, 'Cinquante éléments au plus.')
    .transform((v) => Array.from(new Set(v))),
  nonce,
});

export type ChargeListe = z.input<typeof SCHEMA_LISTE>;

/* ══════════════════════════════════════════════════════════════════════════
   4. Postuler, et se retirer
   ══════════════════════════════════════════════════════════════════════════ */

export const SCHEMA_POSTULER = z.object({
  mandatId: uuid,
  message: optionnel.pipe(
    z.string().max(5000, 'Cinq mille caractères au plus.').nullable(),
  ),
  nonce,
});

export type ChargePostuler = z.input<typeof SCHEMA_POSTULER>;

export const SCHEMA_SPONTANEE = z.object({
  message: optionnel.pipe(
    z.string().max(5000, 'Cinq mille caractères au plus.').nullable(),
  ),
  nonce,
});

export type ChargeSpontanee = z.input<typeof SCHEMA_SPONTANEE>;

/**
 * ⚠ LE MOTIF EST OBLIGATOIRE. `api.retirer_ma_candidature` lève `23514` sans
 * lui, et c'est le bon arbitrage : un retrait sans motif est une information
 * perdue pour le cabinet comme pour le client, et le référentiel
 * `motif_retrait` en propose sept — mesuré, catégorie `candidat` de
 * `ref.motif_ko`, tous actifs.
 */
export const SCHEMA_RETRAIT = z.object({
  candidatureId: uuid,
  motifCode: z.string().trim().min(1, 'Dites-nous pourquoi : le motif est obligatoire.'),
  commentaire: optionnel.pipe(
    z.string().max(5000, 'Cinq mille caractères au plus.').nullable(),
  ),
  nonce,
});

export type ChargeRetrait = z.input<typeof SCHEMA_RETRAIT>;

/* ══════════════════════════════════════════════════════════════════════════
   5. Mes données
   ══════════════════════════════════════════════════════════════════════════ */

export const SCHEMA_CONSENTEMENT = z.object({
  donne: z.boolean({ message: 'Un consentement se donne ou se retire, explicitement.' }),
  nonce,
});

export type ChargeConsentement = z.input<typeof SCHEMA_CONSENTEMENT>;

export const SCHEMA_SUPPRESSION = z.object({
  motif: optionnel.pipe(
    z.string().max(5000, 'Cinq mille caractères au plus.').nullable(),
  ),
  /**
   * LA CONFIRMATION EST DANS LA CHARGE, pas seulement dans la boîte de
   * dialogue. Une Server Action est un point d'entrée POST : elle est
   * appelable sans passer par l'écran, et une demande de suppression déclenchée
   * par accident se répare mal. Le formulaire doit donc dire OUI dans la
   * charge, et la fonction le vérifier.
   */
  confirme: z.literal(true, { message: 'Confirmez la demande pour qu’elle soit transmise.' }),
  nonce,
});

export type ChargeSuppression = z.input<typeof SCHEMA_SUPPRESSION>;

/* ══════════════════════════════════════════════════════════════════════════
   6. Mon parcours
   ══════════════════════════════════════════════════════════════════════════ */

const annee = z
  .number({ message: 'Une année est attendue.' })
  .int('Une année entière.')
  .min(1900, 'Après 1900.')
  // Bornée à l'année prochaine : on prend un poste avec quelques mois d'avance,
  // pas dix ans. `new Date()` est lue à la validation, côté serveur, ce qui est
  // le bon endroit — la borne suit le calendrier sans qu'on la remette à jour.
  .max(new Date().getUTCFullYear() + 1, 'Cette année n’est pas encore arrivée.');

const mois = z
  .number()
  .int()
  .min(1)
  .max(12)
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const CORPS_POSTE = {
  intitule: z
    .string()
    .trim()
    .min(1, 'L’intitulé du poste est obligatoire.')
    .max(200, 'Deux cents caractères au plus.'),
  employeur: optionnel.pipe(
    z.string().max(200, 'Deux cents caractères au plus.').nullable(),
  ),
  anneeDebut: annee,
  moisDebut: mois,
  anneeFin: annee.nullable().optional().transform((v) => v ?? null),
  moisFin: mois,
  enCours: z.boolean().optional().transform((v) => v ?? false),
  description: optionnel.pipe(
    z.string().max(5000, 'Cinq mille caractères au plus.').nullable(),
  ),
  ordre: z
    .number()
    .int()
    .min(0)
    .max(999)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  nonce,
};

/**
 * « En poste » et une date de fin sont EXCLUSIFS.
 *
 * `FriseParcours` du design system pose la question dans le bon sens — « fin
 * absente ≠ inconnue : case en poste » — mais rien ne l'empêche de laisser les
 * deux. Ici, les deux ensemble sont refusés : une période à la fois ouverte et
 * fermée n'a pas de sens, et la base enregistrerait la contradiction sans rien
 * dire.
 *
 * Les deux prédicats sont NOMMÉS et appliqués deux fois plutôt qu'enveloppés
 * dans une fonction générique : un `<T extends z.ZodTypeAny>` autour de
 * `.refine` fait perdre à zod le type de sortie de l'objet, et `z.input<>` ne
 * rend plus rien d'exploitable. Deux appels lisibles valent mieux qu'une
 * abstraction qui casse l'inférence.
 */
export type PeriodePoste = {
  enCours: boolean;
  anneeDebut: number;
  anneeFin: number | null;
  moisDebut: number | null;
  moisFin: number | null;
};

export function periodeSansContradiction(v: PeriodePoste): boolean {
  return !(v.enCours && v.anneeFin !== null);
}

export function finApresDebut(v: PeriodePoste): boolean {
  if (v.anneeFin === null) return true;
  if (v.anneeFin !== v.anneeDebut) return v.anneeFin > v.anneeDebut;
  return (v.moisFin ?? 12) >= (v.moisDebut ?? 1);
}

const MSG_CONTRADICTION = {
  message: 'Ou vous y êtes encore, ou la période a une fin — pas les deux.',
  path: ['anneeFin'] as const,
};
const MSG_FIN_AVANT = { message: 'La fin précède le début.', path: ['anneeFin'] as const };

export const SCHEMA_POSTE = z
  .object(CORPS_POSTE)
  .refine(periodeSansContradiction, { ...MSG_CONTRADICTION, path: ['anneeFin'] })
  .refine(finApresDebut, { ...MSG_FIN_AVANT, path: ['anneeFin'] });

export type ChargePoste = z.input<typeof SCHEMA_POSTE>;

export const SCHEMA_MAJ_POSTE = z
  .object({ ...CORPS_POSTE, posteId: uuid })
  .refine(periodeSansContradiction, { ...MSG_CONTRADICTION, path: ['anneeFin'] })
  .refine(finApresDebut, { ...MSG_FIN_AVANT, path: ['anneeFin'] });

export type ChargeMajPoste = z.input<typeof SCHEMA_MAJ_POSTE>;

export const SCHEMA_SUPPRIMER_POSTE = z.object({ posteId: uuid, nonce });

/* ══════════════════════════════════════════════════════════════════════════
   7. Le dépôt d'un document
   ══════════════════════════════════════════════════════════════════════════ */

/** Le plafond du seau `documents-talent`, redit ici. 10 Mo. */
export const TAILLE_MAX_OCTETS = 10 * 1024 * 1024;

/**
 * Les types acceptés, PAR NATURE de document.
 *
 * Ils sont un SOUS-ENSEMBLE de ce que le seau accepte : le seau autorise les
 * six types pour l'ensemble du dépôt — c'est une contrainte de stockage, elle
 * ne sait pas dans quel dossier on écrit — et c'est ici qu'on refuse un PDF
 * dans le champ « photo ». La contrainte du seau reste la barrière ultime :
 * mesuré, un `image/svg+xml` y est refusé en 415 même en contournant l'écran.
 */
export const TYPES_CV = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const TYPES_IMAGE = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const SCHEMA_DEPOT = z.object({
  nature: z.enum(['cv', 'photo', 'portfolio']),
  nonce,
});
