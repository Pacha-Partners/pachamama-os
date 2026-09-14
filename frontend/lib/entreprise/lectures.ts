import { cache } from 'react';

import {
  COLONNES_CANDIDAT,
  COLONNES_CANDIDAT_LISTE,
  COLONNES_CANDIDATURE,
  COLONNES_ENTREPRISE,
  COLONNES_FACTURATION,
  COLONNES_MANDAT,
  COLONNES_MON_COMPTE,
  COLONNES_NOTE,
  COLONNES_PRODUIT,
  versCandidat,
  versCandidature,
  versEntreprise,
  versMandat,
  versMonCompte,
  versNote,
  versPlacement,
  versProduit,
  type CandidatPresente,
  type CandidatureClient,
  type MonCompte,
  type LignePlacement,
  type MandatClient,
  type MonEntreprise,
  type MonProduit,
  type NotePartagee,
} from '@/lib/domaine/entreprise';
import { COLONNES_FICHE, versFiche, type Fiche } from '@/lib/domaine/fiche';
import { clientServeur } from '@/lib/supabase/serveur';

/**
 * LES LECTURES DU PORTAIL ENTREPRISE.
 *
 * ⚠ MODULE DE SERVEUR. Il ouvre un client Supabase porteur du cookie de
 * session, donc il traîne `next/headers` : l'importer depuis un composant
 * client fait échouer la compilation. Le paquet `server-only`, qui rendrait ce
 * garde explicite, n'est pas installé dans ce dépôt et je n'ajoute pas de
 * dépendance pour un commentaire — la barrière existe déjà, elle est
 * simplement moins bavarde.
 *
 * TROIS RÈGLES, communes à toutes les fonctions du fichier :
 *
 * 1. **La clé publique, jamais celle de service.** Le jeton de l'utilisateur
 *    voyage jusqu'à PostgreSQL, donc les policies s'appliquent. Le
 *    cloisonnement inter-entreprises est arbitré par le moteur, pas par un
 *    `if` d'ici.
 * 2. **Colonnes énumérées, jamais `select('*')`.** Une colonne ajoutée en base
 *    ne doit pas se retrouver à l'écran sans que personne l'ait décidé — c'est
 *    la fuite `titre` de la décision D-06, par une autre porte.
 * 3. **Un réessai, et un seul.** Même parti pris que le job board : la première
 *    connexion vers Supabase paie un coût d'établissement que les suivantes ne
 *    paient plus, et un échec unique n'est pas une panne.
 *
 * `cache()` de React mémoïse par requête : une page qui lit l'entreprise dans
 * sa disposition ET dans son corps ne fait qu'un aller-retour.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un identifiant malformé est un 404, pas une erreur 400 de PostgREST. */
export function estUuid(valeur: string): boolean {
  return UUID.test(valeur);
}

type Ligne = Record<string, unknown>;
type Reponse = { data: unknown; error: { message: string } | null };
type Table = ReturnType<ReturnType<Awaited<ReturnType<typeof clientServeur>>['schema']>['from']>;

/**
 * Le tronc commun d'une lecture : une requête, un réessai, une erreur qui dit
 * quelle vue a lâché.
 *
 * On LÈVE plutôt que de rendre un tableau vide. Un portail qui affiche
 * « aucun mandat » alors que la base est injoignable est le pire des deux
 * mondes : l'utilisateur croit que ses postes ont disparu. La levée est
 * rattrapée par le `error.tsx` de la route, qui dit « le chargement a échoué ».
 *
 * Le transtypage final est le même que celui du job board : PostgREST rend un
 * type générique dès que la liste de colonnes est une chaîne, et ce sont les
 * convertisseurs de `lib/domaine/entreprise.ts` qui portent la vraie
 * connaissance de la forme.
 */
async function lire(vue: string, construire: (table: Table) => PromiseLike<Reponse>): Promise<Ligne[]> {
  const supabase = await clientServeur();
  const lancer = () => construire(supabase.schema('api').from(vue));

  let { data, error } = await lancer();
  if (error) {
    console.warn(`[entreprise] premier essai en échec sur api.${vue} : ${error.message}`);
    ({ data, error } = await lancer());
  }
  if (error) {
    console.error(`[entreprise] lecture impossible sur api.${vue} : ${error.message}`);
    throw new Error(`Les données de « ${vue} » sont momentanément indisponibles.`);
  }
  return Array.isArray(data) ? (data as Ligne[]) : [];
}

/* ══════════════════════════════════════════════════════════════════════════
   L'entreprise, son produit, sa facturation
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * MON entreprise.
 *
 * La vue peut en rendre plusieurs si un compte est rattaché à plusieurs
 * entreprises — `app.mon_entreprise_unique()` refuse justement d'écrire dans ce
 * cas. En lecture on prend la première et on ne s'en cache pas : les écrans
 * d'édition, eux, verront la fonction d'écriture lever un message explicite.
 * Aucun des comptes du dev n'est dans cette situation.
 */
export const monEntreprise = cache(async function monEntreprise(): Promise<MonEntreprise | null> {
  const lignes = await lire('mon_entreprise', (q) =>
    q.select(COLONNES_ENTREPRISE).order('nom').limit(1),
  );
  return lignes[0] ? versEntreprise(lignes[0]) : null;
});

export const monProduit = cache(async function monProduit(): Promise<MonProduit | null> {
  const lignes = await lire('mon_produit', (q) => q.select(COLONNES_PRODUIT).limit(1));
  return lignes[0] ? versProduit(lignes[0]) : null;
});

export const mesPlacements = cache(async function mesPlacements(): Promise<LignePlacement[]> {
  const lignes = await lire('ma_facturation', (q) =>
    q.select(COLONNES_FACTURATION).order('date_closing', { ascending: false, nullsFirst: false }),
  );
  return lignes.map(versPlacement);
});

/* ══════════════════════════════════════════════════════════════════════════
   Les mandats
   ══════════════════════════════════════════════════════════════════════════ */

export const mesMandats = cache(async function mesMandats(): Promise<MandatClient[]> {
  const lignes = await lire('mandat_client', (q) =>
    q
      .select(COLONNES_MANDAT)
      // Le plus récemment ouvert en tête : c'est le poste dont on parle.
      // `nullsFirst: false` parce que 2 mandats sur 533 n'ont pas de kickoff.
      .order('kickoff_le', { ascending: false, nullsFirst: false })
      .order('cree_le', { ascending: false, nullsFirst: false }),
  );
  return lignes.map(versMandat);
});

export const unMandat = cache(async function unMandat(id: string): Promise<MandatClient | null> {
  if (!estUuid(id)) return null;
  const lignes = await lire('mandat_client', (q) => q.select(COLONNES_MANDAT).eq('id', id).limit(1));
  return lignes[0] ? versMandat(lignes[0]) : null;
});

/**
 * Le registre PUBLIC d'un mandat — ce que le job board en montre.
 *
 * `api.offre_detail` ne rend que les mandats portant un acte de publication non
 * retiré : sur les 533 mandats, 12 seulement. Un mandat non publié rend donc
 * `null`, ce qui n'est pas une erreur mais l'état normal — l'écran affiche
 * alors le mandat sans son registre public, et le dit.
 */
export const registrePublic = cache(async function registrePublic(
  id: string,
): Promise<Fiche | null> {
  if (!estUuid(id)) return null;
  const lignes = await lire('offre_detail', (q) => q.select(COLONNES_FICHE).eq('id', id).limit(1));
  return lignes[0] ? versFiche(lignes[0]) : null;
});

/* ══════════════════════════════════════════════════════════════════════════
   Le pipeline
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les candidatures VISIBLES d'un mandat.
 *
 * « Visibles » n'est pas un filtre écrit ici : `api.candidature_client` ne
 * projette que les étapes `visible_client` (décision D-03, six étapes sur
 * quatorze). Mesuré le 09/09 : 1 893 candidatures sur 7 206, et la répartition
 * est très inégale d'un client à l'autre. Un mandat qui rend zéro ligne est un
 * état honnête de la donnée, pas un écran cassé — c'est à la vue de le dire.
 */
export const candidaturesDuMandat = cache(async function candidaturesDuMandat(
  mandatId: string,
): Promise<CandidatureClient[]> {
  if (!estUuid(mandatId)) return [];
  const lignes = await lire('candidature_client', (q) =>
    q
      .select(COLONNES_CANDIDATURE)
      .eq('mandat_id', mandatId)
      .order('etape_ordre', { ascending: true, nullsFirst: false })
      .order('reference_pseudonyme', { ascending: true }),
  );
  return lignes.map(versCandidature);
});

/** Toutes les candidatures visibles, tous mandats confondus. Sert les compteurs. */
export const toutesMesCandidatures = cache(async function toutesMesCandidatures(): Promise<
  CandidatureClient[]
> {
  const lignes = await lire('candidature_client', (q) =>
    q.select(COLONNES_CANDIDATURE).order('etape_ordre', { ascending: true, nullsFirst: false }),
  );
  return lignes.map(versCandidature);
});

/**
 * Les profils présentés d'un mandat — la vue enrichie.
 *
 * `api.candidat_presente` porte 28 colonnes contre 14 à `candidature_client` :
 * prénom, poste actuel, expertises, attentes. Les 22 colonnes interdites (nom,
 * courriel, téléphone, LinkedIn, qualification cabinet…) sont vérifiées
 * ABSENTES par le harnais `verifier:j3`. On l'emploie pour la fiche d'un
 * candidat ; la liste du pipeline se contente de la vue légère.
 */
export const candidatsDuMandat = cache(async function candidatsDuMandat(
  mandatId: string,
): Promise<CandidatPresente[]> {
  if (!estUuid(mandatId)) return [];
  const lignes = await lire('candidat_presente', (q) =>
    q
      // Jeu RÉDUIT : ni nom, ni prénom, ni CV, ni photo. Voir le commentaire de
      // COLONNES_CANDIDAT_LISTE — ce qu'on sélectionne part dans le HTML, même
      // sans être affiché.
      .select(COLONNES_CANDIDAT_LISTE)
      .eq('mandat_id', mandatId)
      .order('etape_ordre', { ascending: true, nullsFirst: false }),
  );
  return lignes.map(versCandidat);
});

export const unCandidat = cache(async function unCandidat(
  candidatureId: string,
): Promise<CandidatPresente | null> {
  if (!estUuid(candidatureId)) return null;
  const lignes = await lire('candidat_presente', (q) =>
    q.select(COLONNES_CANDIDAT).eq('candidature_id', candidatureId).limit(1),
  );
  return lignes[0] ? versCandidat(lignes[0]) : null;
});

/* ══════════════════════════════════════════════════════════════════════════
   Les notes partagées
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Le fil d'une candidature.
 *
 * `api.note_partagee` ne rend que les notes `visible_client = true`. Les 45 685
 * notes historiques sont restées internes (décision D-04, aucun backfill) : le
 * fil démarre donc vide sur tout dossier antérieur au 09/09, et se remplit des
 * décisions et commentaires écrits depuis. L'état vide est normal et l'écran
 * doit le dire.
 */
export const notesDeLaCandidature = cache(async function notesDeLaCandidature(
  candidatureId: string,
): Promise<NotePartagee[]> {
  if (!estUuid(candidatureId)) return [];
  const lignes = await lire('note_partagee', (q) =>
    q
      .select(COLONNES_NOTE)
      .eq('candidature_id', candidatureId)
      .order('ecrite_le', { ascending: true, nullsFirst: true }),
  );
  return lignes.map(versNote);
});

/** Les dernières notes partagées d'un mandat, pour la frise du détail. */
export const notesDuMandat = cache(async function notesDuMandat(
  mandatId: string,
  limite = 12,
): Promise<NotePartagee[]> {
  if (!estUuid(mandatId)) return [];
  const lignes = await lire('note_partagee', (q) =>
    q
      .select(COLONNES_NOTE)
      .eq('mandat_id', mandatId)
      .order('ecrite_le', { ascending: false, nullsFirst: false })
      .limit(limite),
  );
  return lignes.map(versNote);
});

/**
 * L'utilisateur connecté, côté client.
 *
 * `api.mon_compte` filtre sur `api.mon_contact_client()` : elle rend une ligne
 * ou aucune, jamais celle d'un collègue. Aucune ligne est un cas réel — les
 * comptes internes n'ont pas de fiche de contact client — et se traite comme
 * un `null`, pas comme une erreur.
 */
export const monCompte = cache(async function monCompte(): Promise<MonCompte | null> {
  const lignes = await lire('mon_compte', (q) => q.select(COLONNES_MON_COMPTE).limit(1));
  return lignes[0] ? versMonCompte(lignes[0]) : null;
});
