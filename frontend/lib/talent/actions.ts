'use server';

import { revalidatePath } from 'next/cache';

import { candidatureIdDe, nomDepot, valeurStockee, versDateIso } from '@/lib/domaine/talent';
import { SEAU_TALENT } from '@/lib/domaine/stockage';
import {
  cleIdempotence,
  SCHEMA_ATTENTES,
  SCHEMA_CONSENTEMENT,
  SCHEMA_LISTE,
  SCHEMA_MAJ_POSTE,
  SCHEMA_POSTE,
  SCHEMA_POSTULER,
  SCHEMA_PROFIL,
  SCHEMA_RETRAIT,
  SCHEMA_SPONTANEE,
  SCHEMA_SUPPRESSION,
  SCHEMA_SUPPRIMER_POSTE,
  TAILLE_MAX_OCTETS,
  TYPES_CV,
  TYPES_IMAGE,
  type ChargeAttentes,
  type ChargeConsentement,
  type ChargeListe,
  type ChargeMajPoste,
  type ChargePoste,
  type ChargePostuler,
  type ChargeProfil,
  type ChargeRetrait,
  type ChargeSpontanee,
  type ChargeSuppression,
} from '@/lib/talent/saisie';
import { deposer } from '@/lib/stockage';
import { clientServeur } from '@/lib/supabase/serveur';

/**
 * LES ÉCRITURES DE L'ESPACE TALENT.
 *
 * Chaque action appelle UNE fonction `api.*` déclarée `security invoker`
 * (décision D-01, ADR 0005). Aucune écriture directe sur une table, jamais :
 * c'est la fonction qui valide, qui n'écrit que des colonnes nommées, qui
 * inscrit une ligne dans `app.journal_ecriture` et qui honore
 * `app.idempotence`. Le jeton de l'utilisateur voyage avec l'appel, donc la RLS
 * s'applique À L'INTÉRIEUR de la fonction.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TROIS ÉTAGES PROTÈGENT LA QUALIFICATION CABINET, ET AUCUN N'EST ICI
 * ─────────────────────────────────────────────────────────────────────────
 * `est_qualifie`, `statut_relation`, `agent_referent_id`, `seniorite`,
 * `emoji_statut`, `score_completude`, `resume_ia`, `mindset` — ce que le
 * cabinet porte SUR la personne — sont fermés par (1) la policy
 * `talent_maj_sa_fiche` qui choisit les lignes, (2) un GRANT UPDATE **par
 * colonne**, 34 sur 81, et (3) le déclencheur de frontière
 * `core.frontiere_declarative_fiche_talent`, liste blanche comparée en jsonb.
 * Ce module n'ajoute aucun quatrième étage et n'en a pas besoin : il ne
 * pourrait pas les écrire même s'il le voulait.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA CLÉ D'IDEMPOTENCE, ET POURQUOI ELLE EST COMPOSÉE
 * ─────────────────────────────────────────────────────────────────────────
 * `app.idempotence_rejeu` REFUSE une clé déjà posée avec une charge
 * différente, et rejoue le résultat quand la charge est identique. La clé est
 * donc `<nonce du formulaire>-<empreinte de la charge>` :
 *   · double-clic → même charge, même clé → rejeu propre, une seule écriture ;
 *   · correction → empreinte différente → vraie écriture ;
 *   · formulaire remonté → nonce neuf → un envoi identique volontaire passe.
 * Le nonce est produit par le composant client au montage et renouvelé après
 * chaque succès (`components/vues/talent/nonce.ts`).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUI REMONTE À L'ÉCRAN EN CAS D'ÉCHEC
 * ─────────────────────────────────────────────────────────────────────────
 * Les fonctions `api.*` de ce lot lèvent des messages écrits en français et
 * destinés à la personne (« un secteur ne peut pas être à la fois visé et
 * no-go : Blockchain — retirez-le de l'autre liste d'abord »). On les transmet
 * TELS QUELS, mais seulement pour les codes qu'elles lèvent délibérément. Tout
 * autre code rend un message générique et part dans le journal du serveur : le
 * corps d'une erreur PostgreSQL peut porter des noms de colonnes et des
 * valeurs.
 */

export type Retour =
  | { ok: true; message: string }
  | { ok: false; erreur: string; champ?: string };

/** Les codes que les fonctions `api.*` lèvent volontairement, message compris. */
const CODES_METIER = new Set([
  '22001', // trop long
  '22003', // hors bornes
  '22004', // argument obligatoire manquant (prénom, nom, motif)
  '22023', // valeur invalide (p_type inconnu)
  '23503', // référence inconnue (métier, univers, secteur, critère, motif…)
  '23505', // déjà fait (candidature en double, demande déjà ouverte)
  '23514', // règle métier (secteur visé ET no-go, candidature déjà close…)
  '21000', // plusieurs fiches rattachées à ce compte
  '42501', // hors de votre périmètre
  'P0001', // raise exception sans errcode explicite
]);

type ErreurPg = { message?: string; code?: string; details?: string };

function traduire(erreur: ErreurPg | null, contexte: string): string {
  if (!erreur) return 'L’enregistrement a échoué.';
  const code = erreur.code ?? '';
  if (CODES_METIER.has(code) && erreur.message) return erreur.message;
  console.error(`[talent/${contexte}] ${code} — ${erreur.message ?? 'sans message'}`);
  return 'L’enregistrement a échoué de notre côté. Réessayez dans un instant ; si cela persiste, dites-le à votre interlocuteur Pachamama.';
}

async function appeler(
  fonction: string,
  arguments_: Record<string, unknown>,
): Promise<{ ok: true; charge: unknown } | { ok: false; erreur: string }> {
  const supabase = await clientServeur();
  const { data, error } = await supabase.schema('api').rpc(fonction, arguments_);
  if (error) return { ok: false, erreur: traduire(error as ErreurPg, fonction) };
  return { ok: true, charge: data };
}

/**
 * Le premier problème de saisie, avec le champ qu'il concerne.
 *
 * `path` est typé `PropertyKey[]` par zod v4 — un segment peut être un
 * `symbol`. `String()` le rend lisible quoi qu'il arrive, et un `symbol` en
 * tête de chemin ne peut de toute façon pas nommer un champ de formulaire.
 */
function premierRefus(issues: readonly { message: string; path: readonly PropertyKey[] }[]): {
  ok: false;
  erreur: string;
  champ?: string;
} {
  const premier = issues[0];
  return { ok: false, erreur: premier.message, champ: String(premier.path[0] ?? '') };
}

/* ══════════════════════════════════════════════════════════════════════════
   1. Mon profil
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ LE FORMULAIRE EST ENVOYÉ ENTIER. `api.maj_ma_fiche` écrit ses NEUF colonnes
 * à chaque appel, et un argument nul EFFACE la valeur. Une action qui
 * n'enverrait que les champs modifiés viderait tous les autres — c'est le même
 * piège que `api.maj_entreprise` en phase 1, et le composant tient donc l'état
 * des neuf champs, initialisé sur la donnée lue.
 */
export async function majMonProfil(charge: ChargeProfil): Promise<Retour> {
  const lu = SCHEMA_PROFIL.safeParse(charge);
  if (!lu.success) return premierRefus(lu.error.issues);
  const v = lu.data;

  const arguments_ = {
    p_prenom: v.prenom,
    p_nom: v.nom,
    p_email_personnel: v.emailPersonnel,
    p_telephone: v.telephone,
    p_url_linkedin: v.urlLinkedin,
    p_localisation_texte: v.localisationTexte,
    p_photo_url: v.photoUrl,
    p_cv_url: v.cvUrl,
    p_portfolio_url: v.portfolioUrl,
  };
  const resultat = await appeler('maj_ma_fiche', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(v.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  // `layout` et non le seul chemin : le prénom et la photo titrent le tableau
  // de bord, et la complétude change dès qu'un champ est rempli.
  revalidatePath('/talent', 'layout');
  return { ok: true, message: 'Votre profil est enregistré.' };
}

/**
 * LE DÉPÔT D'UN FICHIER, et ce qu'il ne fait PAS.
 *
 * Il dépose dans le seau et rend la valeur à poser dans le champ. **Il n'écrit
 * pas la fiche** : `api.maj_ma_fiche` enregistre le formulaire entier, donc
 * l'écrire ici imposerait de lui transmettre les huit autres champs — ou de les
 * effacer. Le fichier arrive donc dans le formulaire, et c'est
 * « Enregistrer » qui le rattache à la fiche.
 *
 * ⚠ DETTE ASSUMÉE ET DITE : un fichier déposé puis abandonné (on quitte la page
 * sans enregistrer) reste dans le seau sans que rien ne le référence. Le
 * supprimer automatiquement demanderait de distinguer « abandonné » de « en
 * cours de saisie », ce que le serveur ne sait pas ; le supprimer au retrait du
 * champ effacerait un fichier que la personne voulait peut-être remettre. Un
 * balayage des objets non référencés est le bon geste, et il appartient à un
 * travail d'administration, pas à cet écran.
 *
 * Une `FormData` et non une charge JSON : c'est la seule façon de faire
 * traverser un `File` jusqu'à une Server Action.
 */
export async function deposerDocument(
  donnees: FormData,
): Promise<{ ok: true; valeur: string; nom: string } | { ok: false; erreur: string }> {
  const nature = String(donnees.get('nature') ?? '');
  const fichier = donnees.get('fichier');

  if (nature !== 'cv' && nature !== 'photo' && nature !== 'portfolio') {
    return { ok: false, erreur: 'Nature de document inconnue.' };
  }
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, erreur: 'Aucun fichier reçu.' };
  }

  // ⚠ LES CONTRAINTES SONT REVÉRIFIÉES ICI. `Televersement` les tient déjà côté
  // navigateur — un fichier refusé n'appelle pas `onFichier` — mais un garde
  // d'interface n'est pas un garde : une Server Action est un point d'entrée
  // POST, appelable sans passer par l'écran. Le seau, lui, est la barrière
  // ultime (mesuré : 413 et 415 même en contournant tout le reste).
  if (fichier.size > TAILLE_MAX_OCTETS) {
    return { ok: false, erreur: 'Ce fichier dépasse 10 Mo. Réduisez-le et réessayez.' };
  }
  const attendus: readonly string[] = nature === 'photo' ? TYPES_IMAGE : TYPES_CV;
  if (!attendus.includes(fichier.type)) {
    return {
      ok: false,
      erreur:
        nature === 'photo'
          ? 'Une image JPEG, PNG ou WebP.'
          : 'Un PDF, ou un document Word (.doc, .docx).',
    };
  }

  // L'identifiant de la fiche est lu ICI et non reçu du client : le chemin de
  // dépôt est ce que la policy compare à `api.ma_fiche_talent()`, et une valeur
  // venue du navigateur serait une valeur qu'on n'a pas vérifiée. La policy le
  // refuserait — mesuré, 403 RLS — mais mieux vaut ne pas le tenter.
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .schema('api')
    .from('ma_fiche')
    .select('id')
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error || !data?.id) {
    return {
      ok: false,
      erreur: 'Votre dossier n’est pas rattaché à une fiche : le dépôt est impossible.',
    };
  }

  const chemin = nomDepot(data.id, nature, fichier.name);
  const depot = await deposer(SEAU_TALENT, chemin, fichier);
  if (!depot.ok) return depot;

  return { ok: true, valeur: valeurStockee(chemin), nom: fichier.name };
}

/* ══════════════════════════════════════════════════════════════════════════
   2. Mes attentes
   ══════════════════════════════════════════════════════════════════════════ */

export async function majMesAttentes(charge: ChargeAttentes): Promise<Retour> {
  const lu = SCHEMA_ATTENTES.safeParse(charge);
  if (!lu.success) return premierRefus(lu.error.issues);
  const v = lu.data;

  const arguments_ = {
    p_metier_code: v.metierCode,
    p_univers_code: v.universCode,
    p_salaire_min_ke: v.salaireMinKe,
    p_salaire_max_ke: v.salaireMaxKe,
    p_tjm_min_eur: v.tjmMinEur,
    p_tjm_max_eur: v.tjmMaxEur,
    p_disponibilite_texte: v.disponibiliteTexte,
    p_localisation_texte: v.localisationTexte,
    p_description: v.description,
    p_recherche_active: v.rechercheActive,
  };
  const resultat = await appeler('maj_mes_attentes', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(v.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  revalidatePath('/talent', 'layout');
  return { ok: true, message: 'Vos attentes sont enregistrées.' };
}

const NOMS_LISTE: Record<string, string> = {
  secteur_vise: 'Secteurs visés',
  secteur_nogo: 'Secteurs à éviter',
  critere: 'Ce qui compte pour vous',
  contrat: 'Contrats visés',
  remote: 'Rythme de télétravail',
  expertise: 'Expertises',
};

/**
 * Une liste déclarative à la fois — c'est le contrat de `api.maj_mes_listes`.
 *
 * L'écran des attentes en porte six et les envoie SÉPARÉMENT, en séquence.
 * Conséquence dite à l'écran : si la quatrième échoue, les trois premières sont
 * enregistrées. Le message nomme alors la liste fautive, ce qui vaut mieux
 * qu'un « échec » global qui laisserait croire que rien n'est passé.
 *
 * ⚠ LE CAS QUI VA SE PRODUIRE : « un secteur ne peut pas être à la fois visé et
 * no-go ». Mesuré, 4 fiches actives sont dans cette situation aujourd'hui. Le
 * message de la base nomme le secteur, et l'ordre d'envoi de l'écran est donc
 * `secteur_nogo` AVANT `secteur_vise` — on retire avant d'ajouter, sinon la
 * première liste envoyée bute sur l'ancienne valeur de la seconde.
 */
export async function majMaListe(charge: ChargeListe): Promise<Retour> {
  const lu = SCHEMA_LISTE.safeParse(charge);
  if (!lu.success) return premierRefus(lu.error.issues);
  const v = lu.data;

  const arguments_ = { p_type: v.type, p_codes: v.codes };
  const resultat = await appeler('maj_mes_listes', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(v.nonce, arguments_),
  });
  if (!resultat.ok) {
    return { ok: false, erreur: `${NOMS_LISTE[v.type] ?? v.type} : ${resultat.erreur}` };
  }

  revalidatePath('/talent', 'layout');
  return { ok: true, message: `${NOMS_LISTE[v.type] ?? v.type} enregistré.` };
}

/* ══════════════════════════════════════════════════════════════════════════
   3. Postuler
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * `api.postuler` refuse trois cas, et les trois sont utiles à l'écran :
 * l'offre introuvable (42501), l'offre dépubliée entre-temps (23514 — une
 * offre retirée doit disparaître, pas rester candidatable par son lien), et la
 * candidature en double (23514, nommant la candidature existante).
 *
 * On rend `candidatureId` pour envoyer la personne sur SA candidature juste
 * après, plutôt que de la laisser sur l'offre à se demander si ça a marché.
 */
export async function postuler(
  charge: ChargePostuler,
): Promise<Retour & { candidatureId?: string }> {
  const lu = SCHEMA_POSTULER.safeParse(charge);
  if (!lu.success) return premierRefus(lu.error.issues);
  const v = lu.data;

  const arguments_ = { p_mandat_id: v.mandatId, p_message: v.message };
  const resultat = await appeler('postuler', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(v.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  revalidatePath('/talent', 'layout');
  revalidatePath(`/offres/${v.mandatId}`);
  return {
    ok: true,
    message: 'Votre candidature est déposée. Nous revenons vers vous.',
    candidatureId: candidatureIdDe(resultat.charge) ?? undefined,
  };
}

/**
 * La candidature SPONTANÉE — sans offre.
 *
 * Elle refuse d'en ouvrir une seconde tant que la première est vivante (23514,
 * en nommant la candidature existante).
 *
 * Son geste est dans `components/vues/talent/CandidatureSpontanee.tsx`, monté
 * sur l'état VIDE du tableau de bord — c'est là que la question se pose, et
 * nulle part ailleurs. Un module `'use server'` publiant un point d'entrée POST
 * par export, une action sans écran resterait appelable : ou bien elle a son
 * geste, ou bien elle n'a pas à être exportée (le raisonnement de phase 1 sur
 * `api.maj_mandat`).
 */
export async function candidatureSpontanee(
  charge: ChargeSpontanee,
): Promise<Retour & { candidatureId?: string }> {
  const lu = SCHEMA_SPONTANEE.safeParse(charge);
  if (!lu.success) return premierRefus(lu.error.issues);
  const v = lu.data;

  const arguments_ = { p_message: v.message };
  const resultat = await appeler('candidature_spontanee', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(v.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  revalidatePath('/talent', 'layout');
  return {
    ok: true,
    message: 'Votre candidature spontanée est enregistrée.',
    candidatureId: candidatureIdDe(resultat.charge) ?? undefined,
  };
}

/**
 * ⚠ LE MOTIF EST OBLIGATOIRE, et le retrait n'est pas réversible depuis cet
 * espace : `api.retirer_ma_candidature` pose l'étape `ko_by_candidat`, écrit
 * `retire_par_talent_le`, et rien dans l'API ne sait revenir en arrière. Le
 * dialogue de confirmation le dit avant, et le message le redit après.
 */
export async function retirerMaCandidature(charge: ChargeRetrait): Promise<Retour> {
  const lu = SCHEMA_RETRAIT.safeParse(charge);
  if (!lu.success) return premierRefus(lu.error.issues);
  const v = lu.data;

  const arguments_ = {
    p_candidature_id: v.candidatureId,
    p_motif_code: v.motifCode,
    p_commentaire: v.commentaire,
  };
  const resultat = await appeler('retirer_ma_candidature', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(v.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  revalidatePath('/talent', 'layout');
  return {
    ok: true,
    message: 'Votre candidature est retirée. Votre interlocuteur Pachamama en est informé.',
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   4. Mon parcours
   ══════════════════════════════════════════════════════════════════════════ */

function argumentsPoste(v: {
  intitule: string;
  employeur: string | null;
  anneeDebut: number;
  moisDebut: number | null;
  anneeFin: number | null;
  moisFin: number | null;
  enCours: boolean;
  description: string | null;
  ordre: number | null;
}) {
  return {
    p_intitule: v.intitule,
    p_entreprise_nom: v.employeur,
    p_debut_le: versDateIso(v.anneeDebut, v.moisDebut),
    // Une fin absente reste absente : c'est la période ouverte, et `en_cours`
    // dit si c'est parce qu'on y est encore.
    p_fin_le: v.anneeFin === null ? null : versDateIso(v.anneeFin, v.moisFin ?? 12),
    p_en_cours: v.enCours,
    p_description: v.description,
    p_ordre: v.ordre,
  };
}

export async function ajouterMonPoste(charge: ChargePoste): Promise<Retour> {
  const lu = SCHEMA_POSTE.safeParse(charge);
  if (!lu.success) return premierRefus(lu.error.issues);

  const arguments_ = argumentsPoste(lu.data);
  const resultat = await appeler('ajouter_mon_poste', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(lu.data.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  revalidatePath('/talent/fiche');
  return { ok: true, message: 'Expérience ajoutée.' };
}

export async function majMonPoste(charge: ChargeMajPoste): Promise<Retour> {
  const lu = SCHEMA_MAJ_POSTE.safeParse(charge);
  if (!lu.success) return premierRefus(lu.error.issues);

  const arguments_ = { p_poste_id: lu.data.posteId, ...argumentsPoste(lu.data) };
  const resultat = await appeler('maj_mon_poste', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(lu.data.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  revalidatePath('/talent/fiche');
  return { ok: true, message: 'Expérience enregistrée.' };
}

export async function supprimerMonPoste(charge: {
  posteId: string;
  nonce: string;
}): Promise<Retour> {
  const lu = SCHEMA_SUPPRIMER_POSTE.safeParse(charge);
  if (!lu.success) return premierRefus(lu.error.issues);

  const arguments_ = { p_poste_id: lu.data.posteId };
  const resultat = await appeler('supprimer_mon_poste', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(lu.data.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  revalidatePath('/talent/fiche');
  return { ok: true, message: 'Expérience retirée.' };
}

/* ══════════════════════════════════════════════════════════════════════════
   5. Mes données
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * LE CONSENTEMENT.
 *
 * `consentement_donne_le` existe depuis la reprise et **n'a jamais été
 * écrite** : c'est ce que D-07 annonçait de construire, et c'est l'unique
 * chemin qui l'écrit. Le retirer repose la colonne à NULL — un consentement
 * qu'on ne peut pas retirer n'est pas un consentement.
 *
 * ⚠ CE N'EST PAS L'AUTORISATION D'OUVRIR LE PORTAIL. D-07 déclare le cadrage
 * RGPD bloquant avant toute mise en production, et il n'est pas instruit : base
 * légale, statut du fournisseur, rétention, registre des traitements. Le
 * mécanisme est prêt ; la décision d'ouvrir reste humaine.
 */
export async function enregistrerMonConsentement(
  charge: ChargeConsentement,
): Promise<Retour> {
  const lu = SCHEMA_CONSENTEMENT.safeParse(charge);
  if (!lu.success) return premierRefus(lu.error.issues);
  const v = lu.data;

  const arguments_ = { p_donne: v.donne };
  const resultat = await appeler('enregistrer_mon_consentement', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(v.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  revalidatePath('/talent', 'layout');
  return {
    ok: true,
    message: v.donne
      ? 'Consentement enregistré. Nous pouvons vous présenter à nos clients.'
      : 'Consentement retiré. Nous ne transmettrons plus votre dossier.',
  };
}

/**
 * LA DEMANDE DE SUPPRESSION — une demande, pas une suppression.
 *
 * `api.demander_ma_suppression` n'efface RIEN : elle écrit une ligne dans
 * `app.demande_suppression`, bascule `actif = false`, et journalise. Vérifié
 * par le harnais de base : après appel, la fiche et ses candidatures sont
 * intactes. L'écran doit le dire exactement comme cela — promettre un
 * effacement qui n'a pas lieu serait pire que ne rien promettre.
 *
 * Un index unique partiel garantit une seule demande ouverte : une seconde
 * demande revient en `23505`, avec son message.
 */
export async function demanderMaSuppression(charge: ChargeSuppression): Promise<Retour> {
  const lu = SCHEMA_SUPPRESSION.safeParse(charge);
  if (!lu.success) return premierRefus(lu.error.issues);
  const v = lu.data;

  const arguments_ = { p_motif: v.motif };
  const resultat = await appeler('demander_ma_suppression', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(v.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  revalidatePath('/talent', 'layout');
  return {
    ok: true,
    message:
      'Votre demande est transmise. Votre dossier est retiré du marché immédiatement ; nous vous répondons sur la suppression.',
  };
}

/**
 * ⚠ L'EXPORT NE PASSE PAS PAR ICI. Il est servi par
 * `app/(prive)/talent/donnees/route.ts`, un Route Handler.
 *
 * La raison est mesurable : le bac à sable du navigateur d'un aperçu bloque les
 * téléchargements lancés par un script, et une Server Action ne peut de toute
 * façon pas poser d'en-tête `Content-Disposition`. Un vrai GET avec ses
 * en-têtes est le seul moyen de rendre un fichier que la personne enregistre
 * réellement — et le seul qui marche aussi sans JavaScript.
 *
 * `api.exporter_mes_donnees()` est journalisée en `insert` sur l'entité
 * `rgpd.export` : `app.journal_ecriture` n'autorise que `insert|update|delete`,
 * donc l'export emprunte le vocabulaire de l'insertion. C'est un abus assumé
 * côté base, et il est commenté là-bas : un export mérite une trace, c'est la
 * preuve d'avoir honoré une demande d'accès.
 */
