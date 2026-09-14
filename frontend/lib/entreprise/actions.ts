'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type {
  ChargeBrief,
  ChargeCommentaire,
  ChargeDecision,
  ChargeEntreprise,
  ChargeFacturation,
  ChargeMonCompte,
  ChargeProduit,
} from '@/lib/entreprise/saisie';
import {
  cleIdempotence,
  SCHEMA_BRIEF,
  SCHEMA_CLOTURE,
  SCHEMA_COMMENTAIRE,
  SCHEMA_DECISION,
  SCHEMA_ENTREPRISE,
  SCHEMA_FACTURATION,
  SCHEMA_MON_COMPTE,
  SCHEMA_PAUSE,
  SCHEMA_PRODUIT,
  TAILLE_MAX_PHOTO_OCTETS,
  TYPES_PHOTO,
} from '@/lib/entreprise/saisie';
import { cheminDepot, SEAU_ENTREPRISE, valeurDeposee } from '@/lib/domaine/stockage';
import { deposer, signer } from '@/lib/stockage';
import { clientServeur } from '@/lib/supabase/serveur';

/**
 * LES ÉCRITURES DU PORTAIL ENTREPRISE.
 *
 * Chaque action appelle UNE fonction `api.*` déclarée `security invoker`
 * (décision D-01, ADR 0005). Aucune écriture directe sur une table, jamais :
 * c'est la fonction qui valide, qui n'écrit que des colonnes nommées, qui
 * inscrit une ligne par champ changé dans `app.journal_ecriture` et qui honore
 * `app.idempotence`. Le jeton de l'utilisateur voyage avec l'appel, donc la RLS
 * s'applique À L'INTÉRIEUR de la fonction — le cloisonnement ne dépend pas de
 * ce que cette Server Action croit faire.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA CLÉ D'IDEMPOTENCE, ET POURQUOI ELLE EST COMPOSÉE
 * ─────────────────────────────────────────────────────────────────────────
 * `app.idempotence_rejeu` REFUSE une clé déjà posée avec une charge
 * différente : réutiliser une clé fixe par formulaire ferait échouer le second
 * enregistrement dès qu'un caractère change. Et une clé tirée au hasard à
 * chaque envoi ne dédoublonne rien du tout.
 *
 * La clé est donc `<nonce du formulaire>-<empreinte de la charge>` :
 *   · même formulaire, même charge  → même clé → rejeu propre, même résultat,
 *     aucune seconde écriture. C'est le double-clic.
 *   · même formulaire, charge modifiée → clé différente → vraie écriture.
 *   · formulaire remonté (navigation) → nonce neuf → un envoi identique
 *     volontaire passe.
 * Le nonce est produit par le composant client au montage et renouvelé après
 * chaque succès.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUI REMONTE À L'ÉCRAN EN CAS D'ÉCHEC
 * ─────────────────────────────────────────────────────────────────────────
 * Les messages des fonctions d'écriture sont écrits en français et destinés à
 * l'utilisateur (« le mandat est en statut “termine” : il n'est modifiable que
 * tant qu'il est “nouveau”. Passez par votre Account Manager. »). On les
 * transmet TELS QUELS, mais seulement pour les codes d'erreur que ces fonctions
 * lèvent délibérément. Tout autre code — une panne, une contrainte inattendue —
 * rend un message générique et part dans le journal du serveur : le corps d'une
 * erreur PostgreSQL peut porter des noms de colonnes et des valeurs.
 */

export type Retour =
  | { ok: true; message: string }
  | { ok: false; erreur: string; champ?: string };

/** Les codes que les fonctions `api.*` lèvent volontairement, message compris. */
const CODES_METIER = new Set([
  '22001', // trop long
  '22003', // hors bornes
  '22004', // argument obligatoire manquant
  '22023', // valeur invalide
  '23503', // référence inconnue (motif, métier, univers, maturité)
  '23505', // déjà fait (mandat déjà en pause)
  '23514', // règle métier (refus sans motif, candidature close…)
  '21000', // plusieurs entreprises rattachées
  '42501', // hors de votre périmètre
  'P0001', // raise exception sans errcode explicite
]);

type ErreurPg = { message?: string; code?: string; details?: string };

function traduire(erreur: ErreurPg | null, contexte: string): string {
  if (!erreur) return 'L’enregistrement a échoué.';
  const code = erreur.code ?? '';
  if (CODES_METIER.has(code) && erreur.message) return erreur.message;
  console.error(`[entreprise/${contexte}] ${code} — ${erreur.message ?? 'sans message'}`);
  return 'L’enregistrement a échoué de notre côté. Réessayez dans un instant ; si cela persiste, prévenez votre Account Manager.';
}

async function appeler(
  fonction: string,
  arguments_: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const supabase = await clientServeur();
  const { error } = await supabase.schema('api').rpc(fonction, arguments_);
  if (error) return { ok: false, erreur: traduire(error as ErreurPg, fonction) };
  return { ok: true };
}

const ACCUSES: Record<string, string> = {
  valide: 'Profil validé. Votre Account Manager en est informé.',
  entretien_demande: 'Entretien demandé. Nous organisons la suite avec le candidat.',
  refuse: 'Profil écarté, motif enregistré.',
};

export async function deciderCandidature(charge: ChargeDecision): Promise<Retour> {
  const lu = SCHEMA_DECISION.safeParse(charge);
  if (!lu.success) {
    const premier = lu.error.issues[0];
    return { ok: false, erreur: premier.message, champ: String(premier.path[0] ?? '') };
  }
  const v = lu.data;

  const arguments_ = {
    p_candidature_id: v.candidatureId,
    p_sens: v.sens,
    p_motif_ko_code: v.motif,
    p_commentaire: v.commentaire,
  };
  const resultat = await appeler('decider_candidature', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(v.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  // La décision peut faire AVANCER l'étape (`entretien_demande` depuis
  // send-out, `refuse` vers ko_by_client) : le tableau de bord et le pipeline
  // du mandat changent tous les deux, pas seulement cette fiche.
  revalidatePath('/entreprise', 'layout');
  return { ok: true, message: ACCUSES[v.sens] };
}

export async function commenterCandidature(charge: ChargeCommentaire): Promise<Retour> {
  const lu = SCHEMA_COMMENTAIRE.safeParse(charge);
  if (!lu.success) return { ok: false, erreur: lu.error.issues[0].message };
  const v = lu.data;

  const arguments_ = { p_candidature_id: v.candidatureId, p_commentaire: v.commentaire };
  const resultat = await appeler('commenter_candidature', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(v.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  revalidatePath(`/entreprise/candidatures/${v.candidatureId}`);
  return { ok: true, message: 'Commentaire publié. Votre équipe Pachamama le voit.' };
}

export async function majEntreprise(charge: ChargeEntreprise): Promise<Retour> {
  const lu = SCHEMA_ENTREPRISE.safeParse(charge);
  if (!lu.success) {
    const premier = lu.error.issues[0];
    return { ok: false, erreur: premier.message, champ: String(premier.path[0] ?? '') };
  }
  const v = lu.data;

  const arguments_ = {
    p_description: v.description,
    p_fondateur: v.fondateur,
    p_serie_financement: v.serieFinancement,
    p_site_web: v.siteWeb,
    p_siret: v.siret,
    p_video_url: v.videoUrl,
    p_logo_url: v.logoUrl,
    p_localisation_texte: v.localisation,
    p_nb_employes: v.nbEmployes,
    p_nb_techs: v.nbTechs,
  };
  const resultat = await appeler('maj_entreprise', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(v.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  revalidatePath('/entreprise/profil');
  return { ok: true, message: 'Fiche entreprise enregistrée.' };
}

export async function majProduit(charge: ChargeProduit): Promise<Retour> {
  const lu = SCHEMA_PRODUIT.safeParse(charge);
  if (!lu.success) return { ok: false, erreur: lu.error.issues[0].message };
  const v = lu.data;

  const arguments_ = {
    p_produit_id: v.produitId,
    p_description: v.description,
    p_texte_annonce: v.texteAnnonce,
    p_maturite_code: v.maturiteCode,
  };
  const resultat = await appeler('maj_produit', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(v.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  revalidatePath('/entreprise/profil');
  return { ok: true, message: 'Produit enregistré.' };
}

export async function majFacturation(charge: ChargeFacturation): Promise<Retour> {
  const lu = SCHEMA_FACTURATION.safeParse(charge);
  if (!lu.success) {
    const premier = lu.error.issues[0];
    return { ok: false, erreur: premier.message, champ: String(premier.path[0] ?? '') };
  }
  const v = lu.data;

  // `adresse_facturation` est un `jsonb` sans forme imposée, et vide sur les
  // 851 lignes du dev. On pose une forme : quatre clés d'adresse postale
  // française. Un objet dont TOUTES les clés sont vides devient `null` — un
  // `{}` en base se relirait comme « il y a une adresse », et il n'y en a pas.
  const adresse = {
    ligne1: v.ligne1,
    ligne2: v.ligne2,
    code_postal: v.codePostal,
    ville: v.ville,
    pays: v.pays,
  };
  const vide = Object.values(adresse).every((x) => x === null);

  const arguments_ = {
    p_email_facturation: v.emailFacturation,
    p_raison_sociale_facturation: v.raisonSociale,
    p_adresse_facturation: vide ? null : adresse,
  };
  const resultat = await appeler('maj_facturation', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(v.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  revalidatePath('/entreprise/facturation');
  return { ok: true, message: 'Coordonnées de facturation enregistrées.' };
}

/* ══════════════════════════════════════════════════════════════════════════
   6. Ouvrir un poste, et le modifier tant qu'il est « nouveau »
   ══════════════════════════════════════════════════════════════════════════ */

function argumentsBrief(v: z.output<typeof SCHEMA_BRIEF>) {
  return {
    p_titre: v.titre,
    p_metier_code: v.metierCode,
    p_univers_code: v.universCode,
    p_contrat: v.contrat,
    p_salaire_min_ke: v.salaireMinKe,
    p_salaire_max_ke: v.salaireMaxKe,
    p_tjm_min_eur: v.tjmMinEur,
    p_tjm_max_eur: v.tjmMaxEur,
    p_experience_min_annees: v.experienceMinAnnees,
    p_missions: v.missions,
    p_remote_infos: v.remoteInfos,
    p_localisation: v.localisation,
    p_must_have: v.mustHave,
    p_nice_to_have: v.niceToHave,
  };
}

/**
 * Le mandat naît en statut `nouveau`, sans publication et sans validation :
 * `valide_par_am_le` reste nul et aucun droit ne permet de l'écrire. La
 * validation est un acte interne. L'écran le dit avant l'envoi ET après.
 *
 * ⚠ IL N'Y A PAS DE `majMandat` ICI, alors que `api.maj_mandat` existe et
 * qu'elle est faite pour le client. Deux raisons, dans cet ordre :
 *
 *   · elle serait INUTILISABLE sans risque. La fonction enregistre un
 *     formulaire entier ; `api.mandat_client` ne projette pas `missions`,
 *     `remote_infos`, `experience_min_annees`, `must_have` ni `nice_to_have` ;
 *     un écran de reprise ne pourrait pas les pré-remplir et les effacerait au
 *     premier enregistrement. Détaillé dans `ActionsMandat.tsx`.
 *   · un module `'use server'` publie un point d'entrée POST pour CHACUN de
 *     ses exports. Une action que rien n'appelle reste appelable : on ne la
 *     laisse pas traîner en attendant son écran.
 *
 * À rouvrir le jour où une vue rendra les cinq colonnes manquantes.
 */
export async function creerMandat(charge: ChargeBrief): Promise<Retour & { mandatId?: string }> {
  const lu = SCHEMA_BRIEF.safeParse(charge);
  if (!lu.success) {
    const premier = lu.error.issues[0];
    return { ok: false, erreur: premier.message, champ: String(premier.path[0] ?? '') };
  }
  const arguments_ = argumentsBrief(lu.data);

  const supabase = await clientServeur();
  const { data, error } = await supabase.schema('api').rpc('creer_mandat', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(lu.data.nonce, arguments_),
  });
  if (error) return { ok: false, erreur: traduire(error as ErreurPg, 'creer_mandat') };

  const mandatId =
    data && typeof data === 'object' && 'mandat_id' in data
      ? String((data as Record<string, unknown>).mandat_id)
      : undefined;

  revalidatePath('/entreprise', 'layout');
  return {
    ok: true,
    message: 'Brief transmis. Votre Account Manager le valide avant l’ouverture du sourcing.',
    mandatId,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   7. Mettre en pause, demander la clôture
   ══════════════════════════════════════════════════════════════════════════ */

export async function mettreEnPause(charge: z.input<typeof SCHEMA_PAUSE>): Promise<Retour> {
  const lu = SCHEMA_PAUSE.safeParse(charge);
  if (!lu.success) return { ok: false, erreur: lu.error.issues[0].message };

  const arguments_ = { p_mandat_id: lu.data.mandatId };
  const resultat = await appeler('mettre_en_pause_mandat', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(lu.data.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  revalidatePath('/entreprise', 'layout');
  return { ok: true, message: 'Poste mis en pause. Le sourcing s’arrête, rien n’est perdu.' };
}

export async function demanderCloture(charge: z.input<typeof SCHEMA_CLOTURE>): Promise<Retour> {
  const lu = SCHEMA_CLOTURE.safeParse(charge);
  if (!lu.success) return { ok: false, erreur: lu.error.issues[0].message };

  const arguments_ = { p_mandat_id: lu.data.mandatId, p_motif: lu.data.motif };
  const resultat = await appeler('demander_cloture_mandat', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(lu.data.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  revalidatePath('/entreprise', 'layout');
  return {
    ok: true,
    message: 'Demande de clôture transmise. Votre Account Manager la traite et vous répond.',
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   7. Mes propres informations
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Corriger son nom, sa fonction, sa photo.
 *
 * `revalidatePath('/entreprise', 'layout')` et non la seule page : le nom est
 * affiché par la COQUILLE, qui enveloppe tous les écrans du portail. Revalider
 * la page seule laisserait l'ancien nom en haut à droite jusqu'à la prochaine
 * navigation complète — le genre d'incohérence qui fait douter de
 * l'enregistrement alors qu'il a bien eu lieu.
 */
export async function majMonCompte(charge: ChargeMonCompte): Promise<Retour> {
  const lu = SCHEMA_MON_COMPTE.safeParse(charge);
  if (!lu.success) {
    const premier = lu.error.issues[0];
    return { ok: false, erreur: premier.message, champ: String(premier.path[0] ?? '') };
  }
  const v = lu.data;

  const arguments_ = {
    p_prenom: v.prenom,
    p_nom: v.nom,
    p_description: v.description,
    p_photo_url: v.photoUrl,
    p_metier_code: v.metierCode,
  };
  const resultat = await appeler('maj_mon_compte', {
    ...arguments_,
    p_cle_idempotence: cleIdempotence(v.nonce, arguments_),
  });
  if (!resultat.ok) return resultat;

  revalidatePath('/entreprise', 'layout');
  return { ok: true, message: 'Vos informations sont enregistrées.' };
}

/**
 * LE DÉPÔT DE LA PHOTO, et ce qu'il ne fait PAS.
 *
 * Il dépose dans le seau et rend la valeur à poser dans le formulaire, plus une
 * URL signée pour l'aperçu immédiat. **Il n'écrit pas la fiche** :
 * `api.maj_mon_compte` enregistre le formulaire ENTIER — un argument nul efface
 * la colonne — donc l'écrire ici imposerait de lui transmettre les quatre
 * autres champs, ou de les effacer. Le fichier arrive dans le formulaire, et
 * c'est « Enregistrer » qui le rattache au compte.
 *
 * ⚠ DETTE ASSUMÉE ET DITE, la même que côté talent : une photo déposée puis
 * abandonnée (on quitte la page sans enregistrer) reste dans le seau sans que
 * rien ne la référence. La supprimer automatiquement demanderait de distinguer
 * « abandonnée » de « en cours de saisie », ce que le serveur ne sait pas. Un
 * balayage des objets non référencés est le bon geste, et il appartient à un
 * travail d'administration, pas à cet écran.
 *
 * Une `FormData` et non une charge JSON : c'est la seule façon de faire
 * traverser un `File` jusqu'à une Server Action.
 */
export async function deposerPhotoCompte(
  donnees: FormData,
): Promise<
  { ok: true; valeur: string; nom: string; apercu: string | null } | { ok: false; erreur: string }
> {
  const fichier = donnees.get('fichier');
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, erreur: 'Aucun fichier reçu.' };
  }

  // ⚠ LES CONTRAINTES SONT REVÉRIFIÉES ICI. `Televersement` les tient déjà côté
  // navigateur — un fichier refusé n'appelle pas `onFichier` — mais un garde
  // d'interface n'est pas un garde : une Server Action est un point d'entrée
  // POST, appelable sans passer par l'écran.
  if (fichier.size > TAILLE_MAX_PHOTO_OCTETS) {
    return { ok: false, erreur: 'Cette image dépasse 2 Mo. Réduisez-la et réessayez.' };
  }
  if (!(TYPES_PHOTO as readonly string[]).includes(fichier.type)) {
    return { ok: false, erreur: 'Une image JPEG, PNG ou WebP.' };
  }

  // ⚠ L'IDENTIFIANT DE LA FICHE EST LU ICI, PAS REÇU DU CLIENT. Le premier
  // dossier du chemin est exactement ce que la policy compare à
  // `api.mon_contact_client()` ; une valeur venue du navigateur serait une
  // valeur qu'on n'a pas vérifiée. La policy le refuserait — c'est le sens même
  // de son `with check` — mais mieux vaut ne pas le tenter.
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .schema('api')
    .from('mon_compte')
    .select('id')
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error || !data?.id) {
    return {
      ok: false,
      erreur: 'Votre compte n’est rattaché à aucune fiche de contact : le dépôt est impossible.',
    };
  }

  const chemin = cheminDepot(data.id, 'photo', fichier.name);
  const depot = await deposer(SEAU_ENTREPRISE, chemin, fichier);
  if (!depot.ok) return depot;

  const valeur = valeurDeposee(SEAU_ENTREPRISE, chemin);
  // L'aperçu est signé tout de suite : le seau est privé, donc la valeur brute
  // n'est pas affichable, et l'écran doit montrer CE QUI VIENT D'ÊTRE DÉPOSÉ
  // sans attendre l'enregistrement ni un rechargement de la page.
  return { ok: true, valeur, nom: fichier.name, apercu: await signer(valeur) };
}

/**
 * LE DÉPÔT DU LOGO — le même geste que la photo, sur une autre clé.
 *
 * ⚠ LE CHEMIN PORTE L'IDENTIFIANT DE L'ENTREPRISE, PAS CELUI DE LA PERSONNE.
 * Un logo appartient à l'entreprise, que plusieurs contacts partagent : le
 * ranger sous l'identifiant de celui qui l'a déposé l'aurait rendu illisible à
 * ses collègues et irremplaçable après son départ. La policy le sait
 * (`api.dossier_entreprise_permis`, migration `20260913240000`) et n'admet
 * `logo/` que sous une entreprise de `api.mes_entreprises()`.
 *
 * Comme pour la photo : on dépose, on rend la valeur, **on n'écrit pas la
 * fiche**. `api.maj_entreprise` enregistre ses dix colonnes en bloc.
 */
export async function deposerLogo(
  donnees: FormData,
): Promise<
  { ok: true; valeur: string; nom: string; apercu: string | null } | { ok: false; erreur: string }
> {
  const fichier = donnees.get('fichier');
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, erreur: 'Aucun fichier reçu.' };
  }
  if (fichier.size > TAILLE_MAX_PHOTO_OCTETS) {
    return { ok: false, erreur: 'Ce logo dépasse 2 Mo. Réduisez-le et réessayez.' };
  }
  if (!(TYPES_PHOTO as readonly string[]).includes(fichier.type)) {
    // Le SVG est nommé dans le refus parce que c'est CE format qu'on vient
    // déposer pour un logo, et qu'un « format non accepté » muet enverrait
    // chercher une faute ailleurs. Le motif est dit : un SVG est exécutable.
    return {
      ok: false,
      erreur:
        fichier.type === 'image/svg+xml'
          ? 'Le SVG n’est pas accepté : c’est un document exécutable. Un PNG à fond transparent convient.'
          : 'Une image JPEG, PNG ou WebP.',
    };
  }

  // L'identifiant est LU ICI. C'est celui que la policy compare à
  // `api.mes_entreprises()` ; une valeur venue du navigateur serait une valeur
  // qu'on n'a pas vérifiée.
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .schema('api')
    .from('mon_entreprise')
    .select('id')
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error || !data?.id) {
    return {
      ok: false,
      erreur: 'Votre compte n’est rattaché à aucune entreprise : le dépôt est impossible.',
    };
  }

  const chemin = cheminDepot(data.id, 'logo', fichier.name);
  const depot = await deposer(SEAU_ENTREPRISE, chemin, fichier);
  if (!depot.ok) return depot;

  const valeur = valeurDeposee(SEAU_ENTREPRISE, chemin);
  return { ok: true, valeur, nom: fichier.name, apercu: await signer(valeur) };
}
