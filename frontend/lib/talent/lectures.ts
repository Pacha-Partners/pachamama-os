import { cache } from 'react';

import {
  COLONNES_ATTENTES,
  COLONNES_CANDIDATURE,
  COLONNES_CANDIDATURE_DETAIL,
  COLONNES_COMPLETUDE,
  COLONNES_CONFIDENTIALITE,
  COLONNES_ENTETE,
  COLONNES_NOTE,
  COLONNES_POSTE,
  COLONNES_PROFIL,
  COLONNES_REFERENTIEL,
  estUuid,
  grouperReferentiel,
  versCandidature,
  versCandidatureDetail,
  versEntreeReferentiel,
  versFiche,
  versNote,
  versPoste,
  type CandidatureDetail,
  type CandidatureTalent,
  type FicheTalent,
  type NoteTalent,
  type PosteTalent,
  type Referentiel,
} from '@/lib/domaine/talent';
import { clientServeur } from '@/lib/supabase/serveur';

/**
 * LES LECTURES DE L'ESPACE TALENT.
 *
 * ⚠ MODULE DE SERVEUR. Il ouvre un client Supabase porteur du cookie de
 * session, donc il traîne `next/headers` : l'importer depuis un composant
 * client fait échouer la compilation. Le paquet `server-only`, qui rendrait ce
 * garde explicite, n'est pas installé dans ce dépôt et je n'ajoute pas de
 * dépendance pour un commentaire.
 *
 * QUATRE RÈGLES, communes à toutes les fonctions du fichier — les trois du
 * portail entreprise, plus une :
 *
 * 1. **La clé publique, jamais celle de service.** Le jeton de l'utilisateur
 *    voyage jusqu'à PostgreSQL, donc `api.ma_fiche_talent()` résout par
 *    `auth.uid()` et les policies s'appliquent. Le cloisonnement est arbitré
 *    par le moteur, pas par un `if` d'ici.
 * 2. **Colonnes énumérées, jamais `select('*')`,** et un jeu par USAGE. Une
 *    colonne sélectionnée part dans le HTML même si rien ne l'affiche (D-15).
 *    Les quatre jeux de `api.ma_fiche` vivent dans `lib/domaine/talent.ts`.
 * 3. **Un réessai, et un seul.** La première connexion vers Supabase paie un
 *    coût d'établissement que les suivantes ne paient plus ; un échec unique
 *    n'est pas une panne.
 * 4. **On LÈVE plutôt que de rendre vide.** Un espace qui affiche « aucune
 *    candidature » alors que la base est injoignable est le pire des deux
 *    mondes : la personne croit son dossier perdu. La levée est rattrapée par
 *    le `error.tsx` de la route.
 *
 * `cache()` de React mémoïse par requête : le tableau de bord lit la fiche pour
 * son en-tête ET pour sa complétude, la lecture n'a lieu qu'une fois.
 */

type Ligne = Record<string, unknown>;
type Reponse = { data: unknown; error: { message: string } | null };
type Table = ReturnType<ReturnType<Awaited<ReturnType<typeof clientServeur>>['schema']>['from']>;

async function lire(
  vue: string,
  construire: (table: Table) => PromiseLike<Reponse>,
): Promise<Ligne[]> {
  const supabase = await clientServeur();
  const lancer = () => construire(supabase.schema('api').from(vue));

  let { data, error } = await lancer();
  if (error) {
    console.warn(`[talent] premier essai en échec sur api.${vue} : ${error.message}`);
    ({ data, error } = await lancer());
  }
  if (error) {
    console.error(`[talent] lecture impossible sur api.${vue} : ${error.message}`);
    throw new Error(`Les données de « ${vue} » sont momentanément indisponibles.`);
  }
  return Array.isArray(data) ? (data as Ligne[]) : [];
}

/* ══════════════════════════════════════════════════════════════════════════
   Ma fiche — un lecteur par écran
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ `api.ma_fiche` PEUT NE RIEN RENDRE, ET CE N'EST PAS UN 404.
 *
 * Trois causes, toutes réelles : le compte n'a pas de `fiche_talent_id` dans
 * `app.acces` ; son accès talent n'est plus actif (la garde de portail de
 * `20260913084000` — effet mesuré aujourd'hui : nul, 0 compte concerné) ; ou la
 * fiche a été désactivée après une demande de suppression. L'adresse est bonne,
 * la page existe, c'est le RATTACHEMENT qui manque. Les écrans rendent alors
 * une explication, jamais « page introuvable ».
 */
async function uneFiche(colonnes: readonly string[]): Promise<FicheTalent | null> {
  const lignes = await lire('ma_fiche', (q) => q.select(colonnes.join(',')).limit(1));
  return lignes[0] ? versFiche(lignes[0]) : null;
}

export const ficheEntete = cache(() => uneFiche(COLONNES_ENTETE));
export const ficheProfil = cache(() => uneFiche(COLONNES_PROFIL));
export const ficheAttentes = cache(() => uneFiche(COLONNES_ATTENTES));
export const ficheConfidentialite = cache(() => uneFiche(COLONNES_CONFIDENTIALITE));

/**
 * Les colonnes du CALCUL de complétude — elles ne franchissent pas la
 * frontière client.
 *
 * Le tableau de bord les lit, appelle `completudeDe`, et ne transmet que le
 * score et la liste des libellés manquants. Ni l'adresse, ni le téléphone, ni
 * le chemin du CV — donc ni le patronyme, mesuré dans 81 % des `cv_url` en
 * phase 1 — n'entrent dans la charge utile RSC.
 */
export const ficheCompletude = cache(() => uneFiche(COLONNES_COMPLETUDE));

/**
 * L'en-tête ET la complétude, en UNE requête.
 *
 * Deux appels mémoïsés séparés feraient deux allers-retours pour deux jeux de
 * colonnes qui se recouvrent. Le tableau de bord demande donc l'union, une
 * fois — et c'est le seul écran qui le fait, parce que c'est le seul qui a
 * besoin des deux.
 */
export const ficheTableauDeBord = cache(() =>
  uneFiche(Array.from(new Set([...COLONNES_ENTETE, ...COLONNES_COMPLETUDE]))),
);

/* ══════════════════════════════════════════════════════════════════════════
   Mes candidatures
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Toutes mes candidatures, le dernier mouvement d'abord.
 *
 * Le tri final est fait en TypeScript par `repartirCandidatures` — il faut
 * séparer les vivantes des closes avant d'ordonner, et `est_terminale` n'est
 * pas un axe de tri utile côté SQL. Celui-ci n'est qu'un ordre de départ
 * stable : deux lectures successives rendent la même liste.
 */
export const mesCandidatures = cache(async function mesCandidatures(): Promise<
  CandidatureTalent[]
> {
  const lignes = await lire('ma_candidature', (q) =>
    q
      .select(COLONNES_CANDIDATURE.join(','))
      .order('date_dernier_changement_etape', { ascending: false, nullsFirst: false })
      .order('date_entree_pipeline', { ascending: false, nullsFirst: false }),
  );
  return lignes.map(versCandidature);
});

export const uneCandidature = cache(async function uneCandidature(
  id: string,
): Promise<CandidatureDetail | null> {
  if (!estUuid(id)) return null;
  const lignes = await lire('ma_candidature_detail', (q) =>
    q.select(COLONNES_CANDIDATURE_DETAIL.join(',')).eq('id', id).limit(1),
  );
  return lignes[0] ? versCandidatureDetail(lignes[0]) : null;
});

/**
 * Les mandats auxquels j'ai DÉJÀ postulé, et l'identifiant de la candidature.
 *
 * Sert la fiche d'une offre PUBLIQUE : proposer « Postuler » à quelqu'un dont
 * la candidature est déjà dans le pipeline lui promet un geste que
 * `api.postuler` refusera (« vous avez déjà postulé à cette offre »). L'écran
 * affiche à la place un lien vers SA candidature — d'où le besoin des deux
 * identifiants.
 *
 * ⚠ DEUX COLONNES, ET DEUX SEULEMENT. C'est une lecture faite depuis une page
 * publique : tout ce qui est sélectionné part dans le HTML servi à un visiteur.
 * Ni poste, ni entreprise, ni étape — rien qui décrive un dossier (D-15).
 *
 * Un visiteur non identifié appelant cette lecture obtiendrait zéro ligne — la
 * vue est gardée par `api.a_portail('talent')` — mais la page ne l'appelle pas
 * dans ce cas : un aller-retour dont on connaît la réponse est un aller-retour
 * de trop.
 */
export const mesMandatsPostules = cache(async function mesMandatsPostules(): Promise<
  Map<string, string>
> {
  const lignes = await lire('ma_candidature', (q) => q.select('id, mandat_id'));
  const parMandat = new Map<string, string>();
  for (const l of lignes) {
    if (typeof l.mandat_id === 'string' && typeof l.id === 'string') {
      // Une candidature par mandat est la règle métier (`api.postuler` refuse
      // le doublon) ; 109 doublons historiques existent pourtant en base. On
      // garde la PREMIÈRE rencontrée plutôt que d'écraser : l'ordre de la vue
      // est stable, donc le lien affiché l'est aussi d'un rendu à l'autre.
      if (!parMandat.has(l.mandat_id)) parMandat.set(l.mandat_id, l.id);
    }
  }
  return parMandat;
});

/**
 * MON INTERLOCUTEUR PACHAMAMA.
 *
 * ⚠ AUCUNE VUE NE LE DONNE DIRECTEMENT, et c'est une vraie limite du modèle
 * exposé. `core.fiche_talent.agent_referent_id` existe — c'est même l'une des
 * colonnes de qualification que le talent n'a pas le droit d'écrire — mais
 * `api.ma_fiche` ne la projette pas, et aucune vue talent ne rend le
 * collaborateur référent de la personne.
 *
 * Ce qui EST disponible : `api.ma_candidature_detail` rend l'agent du mandat de
 * chaque candidature, par `talent_son_agent` (D-12). Mesuré sur le compte de
 * test : les 6 candidatures portent le même agent, prénom, nom, photo et
 * fonction renseignés. On prend donc l'agent de la candidature la plus
 * récemment bougée, ce qui est la meilleure approximation disponible de « qui
 * s'occupe de moi en ce moment ».
 *
 * QUATRE COLONNES, PAS VINGT-HUIT : c'est un jeu de colonnes à part, et non un
 * `uneCandidature()` dont on jetterait le reste. La vue porte les missions de
 * l'offre et les deux listes « pour toi / pas pour toi » — plusieurs milliers de
 * caractères qui n'ont rien à faire dans le HTML du tableau de bord.
 *
 * ⚠ PAS D'ADRESSE ÉLECTRONIQUE : la vue ne projette pas celle de l'agent, et
 * c'est cohérent avec la règle inverse du portail client (on joint quelqu'un
 * par le cabinet). La carte affiche donc un nom et un visage, et dit comment
 * l'échange se fait réellement. À rouvrir le jour où une vue rendra un canal
 * de contact.
 */
export const monInterlocuteur = cache(async function monInterlocuteur(): Promise<{
  prenom: string | null;
  nom: string | null;
  photo: string | null;
  fonction: string | null;
} | null> {
  const lignes = await lire('ma_candidature_detail', (q) =>
    q
      .select('agent_prenom, agent_nom, agent_photo, agent_fonction')
      .not('agent_prenom', 'is', null)
      .order('date_dernier_changement_etape', { ascending: false, nullsFirst: false })
      .limit(1),
  );
  const l = lignes[0];
  if (!l) return null;
  return {
    prenom: typeof l.agent_prenom === 'string' ? l.agent_prenom : null,
    nom: typeof l.agent_nom === 'string' ? l.agent_nom : null,
    photo: typeof l.agent_photo === 'string' ? l.agent_photo : null,
    fonction: typeof l.agent_fonction === 'string' ? l.agent_fonction : null,
  };
});

/* ══════════════════════════════════════════════════════════════════════════
   Les notes que le cabinet me partage
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ ZÉRO LIGNE EST L'ÉTAT NORMAL AUJOURD'HUI.
 * `core.note where visible_talent` = 0 sur 45 685 (D-04, aucun backfill).
 * L'écran le dit ; il ne le cache pas derrière une section absente.
 */
export const notesDeLaCandidature = cache(async function notesDeLaCandidature(
  candidatureId: string,
): Promise<NoteTalent[]> {
  if (!estUuid(candidatureId)) return [];
  const lignes = await lire('ma_note_partagee', (q) =>
    q
      .select(COLONNES_NOTE.join(','))
      .eq('candidature_id', candidatureId)
      .order('ecrite_le', { ascending: true, nullsFirst: true }),
  );
  return lignes.map(versNote);
});

/* ══════════════════════════════════════════════════════════════════════════
   Mon parcours
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ `core.fiche_talent_poste` EST VIDE — 0 ligne, aucune source. La frise est
 * une saisie NEUVE, pas une reprise : l'écran vide invite à saisir.
 *
 * L'ordre : `ordre` d'abord quand il est posé, puis la date de début
 * décroissante. `FriseParcours` retrie de son côté (le plus récent en tête) ;
 * ce tri-ci sert la stabilité d'affichage, pas la présentation.
 */
export const mesPostes = cache(async function mesPostes(): Promise<PosteTalent[]> {
  const lignes = await lire('mes_postes', (q) =>
    q
      .select(COLONNES_POSTE.join(','))
      .order('ordre', { ascending: true, nullsFirst: false })
      .order('debut_le', { ascending: false, nullsFirst: false }),
  );
  return lignes.map(versPoste);
});

/* ══════════════════════════════════════════════════════════════════════════
   Les référentiels
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les vocabulaires DEMANDÉS, et eux seuls.
 *
 * `api.mon_referentiel` porte 769 lignes (mesuré). Elles alimentent des
 * `Combobox` et des `ChampTags`, qui sont des composants CLIENTS : tout ce
 * qu'on lit ici finit dans le HTML servi. Charger les dix vocabulaires sur
 * l'écran des attentes, qui en emploie sept, enverrait 382 lignes inutiles —
 * dont les 361 de `metier_univers`, la plus grosse et la moins employée.
 * C'est D-15 par la porte du référentiel.
 *
 * ⚠ CETTE VUE EST GARDÉE `talent` SEULEMENT. Un compte entreprise en obtient
 * 0 ligne — mesuré. Ce n'est pas un défaut de cette lecture : c'est la garde
 * de la vue, et elle est volontaire.
 */
export const referentiels = cache(async function referentiels(
  ...demandes: Referentiel[]
): Promise<Record<string, { valeur: string; libelle: string }[]>> {
  if (demandes.length === 0) return {};
  const lignes = await lire('mon_referentiel', (q) =>
    q
      .select(COLONNES_REFERENTIEL.join(','))
      .in('referentiel', demandes)
      .order('referentiel')
      .order('ordre', { ascending: true, nullsFirst: false })
      .order('libelle'),
  );
  const groupes = grouperReferentiel(lignes.map(versEntreeReferentiel));
  // Un vocabulaire demandé mais vide doit exister comme tableau vide : sans
  // cela l'écran distinguerait mal « rien à proposer » de « je n'ai pas
  // demandé », et un `undefined` casserait un `Combobox` qui exige `options`.
  for (const d of demandes) groupes[d] ??= [];
  return groupes;
});
