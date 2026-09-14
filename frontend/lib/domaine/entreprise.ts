import type { Univers } from '@/components/pacha/Tag';
import { teinteUnivers, type SourceSalaire, formaterSalaire } from './offre';

/**
 * LE DOMAINE DU PORTAIL ENTREPRISE — la donnée et ses règles.
 *
 * Même parti pris que `lib/domaine/offre.ts` et `lib/domaine/fiche.ts` : une
 * liste de colonnes par vue, un convertisseur qui nomme la forme, et zéro
 * décision de sécurité ici. Le cloisonnement est déjà fait par PostgreSQL au
 * moment où la ligne arrive — les vues `api.*` portent `api.a_portail(
 * 'entreprise')` dans leur WHERE et les policies de `core` font le reste.
 * Refaire ce filtrage en TypeScript ne protégerait rien : les vues sont
 * interrogeables directement au réseau.
 *
 * ⚠ CE MODULE EST PARTAGÉ SERVEUR/CLIENT. Il ne doit importer ni `next/headers`
 * ni le client Supabase — les formulaires en ont besoin pour valider avant
 * l'envoi, et les Server Components pour convertir après la lecture.
 */

/* ══════════════════════════════════════════════════════════════════════════
   1. Les étapes que le client voit
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * LES SIX ÉTAPES VISIBLES D'UN CLIENT, dans l'ordre du process (décision D-03).
 *
 * ⚠ CETTE LISTE EST UN DOUBLON DE `ref.etape_process`, ET C'EST UN MANQUE.
 * Le schéma `ref` n'est pas exposé à PostgREST — mesuré le 09/09 :
 * `Accept-Profile: ref` répond « Only the following schemas are exposed:
 * public, graphql_public, pivot, api ». Il n'existe donc AUCUN moyen, depuis
 * le navigateur ou le serveur Next, de lire le référentiel des étapes.
 *
 * Le kanban a pourtant besoin de ses six colonnes MÊME VIDES : une colonne
 * « Entretien final » qui n'apparaît que le jour où quelqu'un y arrive donne
 * un tableau qui change de forme sous l'utilisateur.
 *
 * Ce qui est écrit ici sert donc d'ossature, et la donnée réelle l'emporte
 * dès qu'une candidature porte l'étape : `fusionnerEtapes()` recouvre libellé
 * et couleur par ce que la vue rend.
 *
 * LES SIX LIGNES SONT RECOPIÉES DE LA BASE, PAS DÉDUITES. Relevé le 09/09 par
 * `supabase db query --linked` sur `ref.etape_process where visible_client` :
 * code, `ordre`, `libelle_client`, `couleur_pastille` et `emoji` coïncident
 * ligne pour ligne avec ce qui suit.
 *
 * À REMPLACER par une vue `api.etape_client` (code, libellé, ordre, couleur),
 * qui rendrait ce tableau inutile — et qui le tiendrait à jour tout seul, ce
 * qu'une copie ne fait jamais.
 */
export type EtapeClient = {
  code: string;
  /** Libellé sans son emoji. « Profil présenté ». */
  libelle: string;
  /** Chaîne CSS, telle que `ref.etape_process.couleur_pastille` la porte. */
  couleur: string | null;
  emoji: string | null;
};

export const ETAPES_CLIENT: readonly EtapeClient[] = [
  { code: 'send_out', libelle: 'Profil présenté', couleur: '#8657FF', emoji: '👌' },
  { code: 'interview_1', libelle: 'Premier entretien', couleur: '#FFEA4D', emoji: '🎤' },
  { code: 'interview_2', libelle: 'Deuxième entretien', couleur: '#FFEA4D', emoji: '🎤' },
  { code: 'final_interview', libelle: 'Entretien final', couleur: '#FFEA4D', emoji: '🎙️' },
  { code: 'hired', libelle: 'Recruté·e', couleur: '#79E6BE', emoji: '🙌' },
  { code: 'ko_by_client', libelle: 'Écarté·e par vos soins', couleur: '#F4728A', emoji: '🙅🏻‍♀️' },
];

/**
 * `api.candidature_client.etape` arrive avec son emoji collé au libellé —
 * « 👌 Profil présenté ». On les sépare, parce que le design system tient
 * l'emoji pour décoratif et le masque aux lecteurs d'écran : le sens est dans
 * le texte, jamais dans le pictogramme.
 *
 * La coupure se fait au PREMIER espace, et seulement si ce qui précède ne
 * contient aucune lettre. Sans cette garde, « Premier entretien » perdrait son
 * premier mot le jour où l'emoji disparaîtrait du registre.
 */
export function decouperEtape(etape: string | null): { emoji: string | null; libelle: string } {
  if (!etape) return { emoji: null, libelle: '—' };
  const espace = etape.indexOf(' ');
  if (espace <= 0) return { emoji: null, libelle: etape };
  const tete = etape.slice(0, espace);
  if (/\p{L}/u.test(tete)) return { emoji: null, libelle: etape };
  return { emoji: tete, libelle: etape.slice(espace + 1).trim() || etape };
}

/**
 * L'ossature des six colonnes, recouverte par ce que la donnée porte
 * réellement. Les candidatures fournies n'ont pas besoin d'être exhaustives :
 * une étape sans candidature garde son libellé d'ossature.
 */
export function fusionnerEtapes(
  candidatures: readonly { etapeCode: string | null; etape: string | null; etapeCouleur: string | null }[],
): EtapeClient[] {
  const mesure = new Map<string, { libelle: string; emoji: string | null; couleur: string | null }>();
  for (const c of candidatures) {
    if (!c.etapeCode || mesure.has(c.etapeCode)) continue;
    const { emoji, libelle } = decouperEtape(c.etape);
    mesure.set(c.etapeCode, { libelle, emoji, couleur: c.etapeCouleur });
  }
  return ETAPES_CLIENT.map((e) => {
    const vu = mesure.get(e.code);
    if (!vu) return e;
    return {
      code: e.code,
      libelle: vu.libelle || e.libelle,
      emoji: vu.emoji ?? e.emoji,
      couleur: vu.couleur ?? e.couleur,
    };
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   2. Les motifs de refus ouverts au client
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * LES SEPT MOTIFS DE CATÉGORIE `client` DE `ref.motif_ko`.
 *
 * ⚠ MÊME MANQUE QUE CI-DESSUS, ET IL EST PLUS GÊNANT ICI : `ref.motif_ko` est
 * lisible par `authenticated` en base, mais le schéma `ref` n'est pas exposé
 * au réseau. Le formulaire de refus ne peut donc pas lire son propre
 * référentiel.
 *
 * Les sept lignes sont recopiées de la base, vérifiées le 09/09 par
 * `supabase db query --linked` sur `ref.motif_ko where categorie = 'client' and
 * actif` : codes, libellés et ordre coïncident.
 *
 * `api.decider_candidature` revalide de toute façon le code côté base : une
 * divergence entre cette liste et le référentiel produit un refus explicite,
 * jamais une écriture silencieuse — c'est ce qui rend le doublon supportable en
 * attendant une vue `api.motif_ko_client`.
 */
export type MotifRefus = { code: string; libelle: string };

export const MOTIFS_REFUS_CLIENT: readonly MotifRefus[] = [
  { code: 'client_competences', libelle: 'Compétences jugées insuffisantes' },
  { code: 'client_seniorite', libelle: 'Séniorité jugée inadaptée' },
  { code: 'client_culture', libelle: 'Adéquation culturelle' },
  { code: 'client_remuneration', libelle: 'Désaccord sur la rémunération' },
  { code: 'client_profil_prefere', libelle: 'Un autre profil a été préféré' },
  { code: 'client_poste_pourvu', libelle: 'Poste pourvu autrement' },
  { code: 'client_poste_annule', libelle: 'Poste annulé ou gelé' },
];

/* ══════════════════════════════════════════════════════════════════════════
   3. Les univers
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Les huit verticales actives de `ref.univers`, DANS L'ORDRE DU RÉFÉRENTIEL.
 *
 * Relevées le 09/09 sur la base (`code`, `libelle_fr`, `ordre`). L'ordre n'est
 * pas alphabétique et ce n'est pas un oubli : c'est celui que le cabinet
 * emploie, Product et Tech en tête parce que ce sont 401 des 533 mandats.
 *
 * À noter, parce que c'est le genre de détail qui coûte une heure : le code de
 * la verticale People est `people_et_finance`, jamais `people` — une première
 * sonde sur `people` avait été refusée par `api.creer_mandat`.
 */
export const UNIVERS_MANDAT: readonly { code: string; libelle: string }[] = [
  { code: 'product', libelle: 'Product' },
  { code: 'tech', libelle: 'Tech' },
  { code: 'design', libelle: 'Design' },
  { code: 'data', libelle: 'Data' },
  { code: 'finance', libelle: 'Finance' },
  { code: 'people_et_finance', libelle: 'People & Finance' },
  { code: 'marketing', libelle: 'Marketing' },
  { code: 'sales', libelle: 'Sales' },
];

/**
 * La teinte du tag d'univers à partir du LIBELLÉ.
 *
 * Les vues du portail projettent le libellé (« Product »), pas le code, à la
 * différence du job board. On repasse en minuscules avant de confier la
 * décision à `teinteUnivers`, qui reste la seule règle de correspondance du
 * dépôt — la dupliquer ici en ferait diverger deux un jour.
 */
export function teinteDepuisLibelle(libelle: string | null): Univers {
  return teinteUnivers(libelle ? libelle.toLowerCase().replace(/ & /g, '_et_').replace(/\s+/g, '_') : null);
}

/**
 * Le code de métier, dérivé de son libellé.
 *
 * ⚠ CONVENTION DÉRIVÉE, PARCE QUE `ref.metier` N'EST PAS EXPOSÉ AU RÉSEAU.
 * Ses 255 entrées actives ne peuvent être ni listées ni interrogées depuis le
 * portail : la seule chose que le client puisse choisir sans rien inventer, ce
 * sont les métiers de SES PROPRES mandats — dont `api.mandat_client` rend le
 * libellé, mais jamais le code.
 *
 * LA RÈGLE A ÉTÉ VÉRIFIÉE, PAS SUPPOSÉE. Rejouée en SQL sur les 255 lignes du
 * référentiel le 09/09 : **255 codes sur 255** sont exactement ce que cette
 * fonction produit à partir de leur libellé.
 *
 * Une première version en donnait 243 sur 255. Les douze écarts tenaient tous
 * à la même chose — l'esperluette : « PR & Communication Manager » a pour code
 * `pr_et_communication_manager`, et non `pr_communication_manager`. D'où le
 * remplacement de `&` par « et » AVANT le passage au tiret bas. Les points
 * d'abréviation (« Data Eng. ») et les parenthèses (« (CMO) ») tombent déjà
 * d'eux-mêmes grâce au rognage des tirets bas de queue.
 *
 * Elle ne s'applique QU'À des libellés venus de la base. On ne fabrique jamais
 * un code à partir d'une saisie libre, le champ reste facultatif, et un code
 * refusé remonte le message de la base tel quel.
 */
export function codeMetier(libelle: string): string {
  return libelle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' et ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/* ══════════════════════════════════════════════════════════════════════════
   4. Le statut d'un mandat
   ══════════════════════════════════════════════════════════════════════════ */

export const STATUTS_MANDAT: Record<string, string> = {
  nouveau: 'Nouveau',
  en_cours: 'En cours',
  en_pause: 'En pause',
  reprise: 'Reprise',
  termine: 'Terminé',
  close_pachamama: 'Clos par Pachamama',
};

/**
 * Un mandat est CLOS quand il porte l'un des deux statuts de fin, et actif
 * dans tous les autres cas — `reprise` compris.
 *
 * La liste énumère les CLOS et non les actifs, à dessein : un statut nouveau
 * apparu en base tombera du côté « actif » et restera visible, là qu'une liste
 * d'actifs le ferait disparaître de l'écran sans un mot.
 */
const STATUTS_CLOS = new Set(['termine', 'close_pachamama']);

export function estClos(statut: string | null): boolean {
  return statut !== null && STATUTS_CLOS.has(statut);
}

export function libelleStatut(statut: string | null): string {
  if (!statut) return 'Statut inconnu';
  return STATUTS_MANDAT[statut] ?? statut.replace(/_/g, ' ');
}

/* ══════════════════════════════════════════════════════════════════════════
   5. Mise en forme
   ══════════════════════════════════════════════════════════════════════════ */

/** « 12 septembre 2026 ». Rend `null` sur une date absente ou illisible. */
export function dateLongue(valeur: string | null): string | null {
  if (!valeur) return null;
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** « 12/09/2026 ». Pour les colonnes de tableau, où la place manque. */
export function dateCourte(valeur: string | null): string | null {
  if (!valeur) return null;
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** La valeur triable d'une date : le temps epoch, ou `null` pour la ranger en bas. */
export function instantDe(valeur: string | null): number | null {
  if (!valeur) return null;
  const t = new Date(valeur).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * La plus proche des échéances À VENIR, ou `null`.
 *
 * Une échéance passée n'est pas « prochaine » : l'afficher comme telle ferait
 * croire à un rendez-vous qui n'a pas encore eu lieu, alors que le pipeline a
 * simplement pris du retard.
 *
 * ELLE VIT ICI, ET NON DANS LE CORPS DE LA PAGE, parce que `Date.now()` est
 * impure : appelée pendant le rendu, elle produit un résultat qui change d'un
 * rendu à l'autre, et le compilateur React refuse (`react-hooks/purity`). Une
 * fonction de domaine appelée par un Server Component `force-dynamic` est le
 * bon endroit — la page est de toute façon recalculée à chaque requête.
 */
export function prochaineEcheance(
  candidatures: readonly { echeanceLe: string | null }[],
  maintenant: number = Date.now(),
): string | null {
  let meilleure: number | null = null;
  for (const c of candidatures) {
    const t = instantDe(c.echeanceLe);
    if (t === null || t < maintenant) continue;
    if (meilleure === null || t < meilleure) meilleure = t;
  }
  return meilleure === null ? null : new Date(meilleure).toISOString();
}

/**
 * La fourchette d'un mandat. On délègue à `formaterSalaire`, la règle du job
 * board : salaire en K si présent, TJM en €/j sinon, rien du tout si les
 * quatre colonnes sont vides.
 */
export function fourchette(source: {
  salaireMinKe: number | null;
  salaireMaxKe: number | null;
  tjmMinEur: number | null;
  tjmMaxEur: number | null;
}): string | null {
  const arg: SourceSalaire = { salaireAffiche: null, ...source };
  return formaterSalaire(arg) ?? null;
}

/** « 25,3 K€ ». L'unité est dans le nom de la colonne côté base, pas à l'écran. */
export function montantKe(valeur: number | null): string | null {
  if (valeur === null || valeur === undefined) return null;
  return `${valeur.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} K€`;
}

/** « 850 € / jour ». */
export function montantTjm(valeur: number | null): string | null {
  if (valeur === null || valeur === undefined) return null;
  return `${valeur.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} € / jour`;
}

/**
 * Une URL de média utilisable dans un `src`.
 *
 * Mesuré sur les 851 entreprises : `logo_url` est protocole-relatif dans 275
 * cas sur 363 (`//…cdn.bubble.io/…`), séquelle de Bubble. Un `src` qui
 * commence par `//` fonctionne dans un navigateur mais pas partout ailleurs, et
 * le composant `Avatar` le passe tel quel. On préfixe donc, une fois, ici.
 */
export function urlMedia(valeur: string | null): string | null {
  if (!valeur) return null;
  const v = valeur.trim();
  if (!v) return null;
  if (v.startsWith('//')) return `https:${v}`;
  return v;
}

/**
 * Une adresse de site web cliquable.
 *
 * Mesuré : 133 des 259 `site_web` remplis sont des domaines nus
 * (« kiliba.com »). Un `href` sans schéma est interprété comme un chemin
 * RELATIF — le lien mène alors à `/entreprise/profil/kiliba.com`. C'est le
 * genre de défaut qu'on ne voit qu'en cliquant.
 */
export function urlSite(valeur: string | null): string | null {
  if (!valeur) return null;
  const v = valeur.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith('//')) return `https:${v}`;
  return `https://${v}`;
}

/**
 * La fonction d'un collaborateur, telle que `core.collaborateur.fonction` la
 * porte : un code technique (`career_agent`). Aucun référentiel de libellés
 * n'est exposé, donc on se contente de le rendre lisible — jamais de le
 * traduire au jugé, ce qui inventerait un vocabulaire que le cabinet n'emploie
 * pas.
 */
export function libelleFonction(code: string | null): string | null {
  if (!code) return null;
  return code
    .split('_')
    .filter(Boolean)
    .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1))
    .join(' ');
}

/**
 * L'adresse de facturation, stockée en `jsonb` libre.
 *
 * Aucune forme n'est imposée en base et les 851 lignes du dev l'ont toutes à
 * NULL : il n'y a donc rien à relever. On retient les quatre clés d'une adresse
 * postale française, et on rend le reste tel quel plutôt que de le perdre.
 */
export type AdresseFacturation = {
  ligne1?: string | null;
  ligne2?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  pays?: string | null;
};

export function adresseEnLignes(adresse: unknown): string[] {
  if (!adresse || typeof adresse !== 'object' || Array.isArray(adresse)) return [];
  const a = adresse as Record<string, unknown>;
  const texte = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const lignes = [
    texte(a.ligne1),
    texte(a.ligne2),
    [texte(a.code_postal), texte(a.ville)].filter(Boolean).join(' ') || null,
    texte(a.pays),
  ].filter((l): l is string => Boolean(l));
  return lignes;
}

/* ══════════════════════════════════════════════════════════════════════════
   6. Les formes lues — une liste de colonnes et un convertisseur par vue
   ══════════════════════════════════════════════════════════════════════════ */

type Ligne = Record<string, unknown>;

const texte = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
};
const nombre = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);
const liste = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String).filter((s) => s.trim() !== '') : [];

/* ── api.mandat_client ──────────────────────────────────────────────────── */

export const COLONNES_MANDAT = [
  'id',
  'intitule',
  'statut',
  'univers',
  'metier',
  'contrat',
  'salaire_min_ke',
  'salaire_max_ke',
  'tjm_min_eur',
  'tjm_max_eur',
  'localisation',
  'kickoff_le',
  'cree_le',
  'est_anonyme',
  'est_publie',
  'candidatures',
  'en_cours',
  'presentes',
  'agent_nom',
  'agent_photo',
  'agent_fonction',
  // D-26 : l'équipe entière, pas seulement le point d'entrée. Le recruteur est
  // renseigné sur 89 % des mandats, l'AM sur 75 % — le client voyait le champ
  // le MOINS rempli.
  'recruteur_nom',
  'recruteur_photo',
  'recruteur_fonction',
  'recruteur_2_nom',
  'recruteur_2_photo',
  'recruteur_2_fonction',
  // Le brief, rendu à l'entreprise qui l'a écrit. Ces trois textes venaient de
  // `api.offre_detail` — la vue du job board — donc l'écran ne les montrait que
  // sur un mandat PUBLIÉ : 2 sur 9, mesuré. Ils sont sur le mandat depuis
  // toujours ; la vue les projette maintenant.
  'missions',
  'pour_toi',
  'pas_pour_toi',
].join(',');

export type MandatClient = {
  id: string;
  intitule: string;
  statut: string | null;
  univers: string | null;
  metier: string | null;
  contrat: string | null;
  salaireMinKe: number | null;
  salaireMaxKe: number | null;
  tjmMinEur: number | null;
  tjmMaxEur: number | null;
  localisation: string | null;
  kickoffLe: string | null;
  creeLe: string | null;
  estAnonyme: boolean;
  estPublie: boolean;
  candidatures: number;
  enCours: number;
  presentes: number;
  agentNom: string | null;
  recruteurNom: string | null;
  recruteurPhoto: string | null;
  recruteurFonction: string | null;
  recruteur2Nom: string | null;
  recruteur2Photo: string | null;
  recruteur2Fonction: string | null;
  agentPhoto: string | null;
  agentFonction: string | null;
  /** Le brief écrit par le client. Présent que le poste soit publié ou non. */
  missions: string | null;
  pourToi: string | null;
  pasPourToi: string | null;
};

export function versMandat(l: Ligne): MandatClient {
  return {
    id: String(l.id),
    intitule: texte(l.intitule) ?? 'Poste sans intitulé',
    statut: texte(l.statut),
    univers: texte(l.univers),
    metier: texte(l.metier),
    contrat: texte(l.contrat),
    salaireMinKe: nombre(l.salaire_min_ke),
    salaireMaxKe: nombre(l.salaire_max_ke),
    tjmMinEur: nombre(l.tjm_min_eur),
    tjmMaxEur: nombre(l.tjm_max_eur),
    localisation: texte(l.localisation),
    kickoffLe: texte(l.kickoff_le),
    creeLe: texte(l.cree_le),
    estAnonyme: Boolean(l.est_anonyme),
    estPublie: Boolean(l.est_publie),
    candidatures: Number(l.candidatures ?? 0),
    enCours: Number(l.en_cours ?? 0),
    presentes: Number(l.presentes ?? 0),
    agentNom: texte(l.agent_nom),
    recruteurNom: texte(l.recruteur_nom),
    recruteurPhoto: urlMedia(texte(l.recruteur_photo)),
    recruteurFonction: texte(l.recruteur_fonction),
    recruteur2Nom: texte(l.recruteur_2_nom),
    recruteur2Photo: urlMedia(texte(l.recruteur_2_photo)),
    recruteur2Fonction: texte(l.recruteur_2_fonction),
    agentPhoto: urlMedia(texte(l.agent_photo)),
    agentFonction: texte(l.agent_fonction),
    missions: texte(l.missions),
    pourToi: texte(l.pour_toi),
    pasPourToi: texte(l.pas_pour_toi),
  };
}

/* ── api.candidature_client ─────────────────────────────────────────────── */

export const COLONNES_CANDIDATURE = [
  'id',
  'mandat_id',
  'reference_pseudonyme',
  'etape',
  'etape_code',
  'etape_ordre',
  'etape_couleur',
  'est_terminale',
  'est_ko',
  'argumentaire_client',
  'date_entree_pipeline',
  'date_dernier_changement_etape',
  'date_prochaine_echeance',
  'presente_le',
].join(',');

export type CandidatureClient = {
  id: string;
  mandatId: string | null;
  reference: string;
  etape: string | null;
  etapeCode: string | null;
  etapeOrdre: number | null;
  etapeCouleur: string | null;
  estTerminale: boolean;
  estKo: boolean;
  argumentaire: string | null;
  entreeLe: string | null;
  changementLe: string | null;
  echeanceLe: string | null;
  presenteLe: string | null;
};

export function versCandidature(l: Ligne): CandidatureClient {
  return {
    id: String(l.id),
    mandatId: texte(l.mandat_id),
    // `reference_pseudonyme` est NOT NULL depuis la reprise du 09/09, mais un
    // repli explicite vaut mieux qu'un « null » affiché : le client désigne un
    // candidat par cette référence au téléphone.
    reference: texte(l.reference_pseudonyme) ?? 'Sans référence',
    etape: texte(l.etape),
    etapeCode: texte(l.etape_code),
    etapeOrdre: nombre(l.etape_ordre),
    etapeCouleur: texte(l.etape_couleur),
    estTerminale: Boolean(l.est_terminale),
    estKo: Boolean(l.est_ko),
    argumentaire: texte(l.argumentaire_client),
    entreeLe: texte(l.date_entree_pipeline),
    changementLe: texte(l.date_dernier_changement_etape),
    echeanceLe: texte(l.date_prochaine_echeance),
    presenteLe: texte(l.presente_le),
  };
}

/* ── api.candidat_presente ──────────────────────────────────────────────── */

export const COLONNES_CANDIDAT = [
  'candidature_id',
  'mandat_id',
  'reference_pseudonyme',
  'argumentaire_client',
  'etape',
  'etape_code',
  'etape_ordre',
  'etape_couleur',
  'est_ko',
  'est_terminale',
  'date_entree_pipeline',
  'date_dernier_changement_etape',
  'date_prochaine_echeance',
  'presente_le',
  'prenom',
  'localisation_texte',
  'niveau_anglais',
  'poste_actuel_employeur',
  'metier_actuel',
  'univers',
  'expertises',
  'attentes_salaire_min_ke',
  'attentes_salaire_max_ke',
  'attentes_tjm_min_eur',
  'attentes_tjm_max_eur',
  'attentes_disponibilite_texte',
  'cv_url',
  'photo_url',
  // D-14 : la fiche d'un candidat PRÉSENTÉ porte son identité. La liste et le
  // kanban, eux, n'affichent que `reference_pseudonyme`.
  'nom',
  // D-21 : « plus de détails sur cette fiche, c'est important pour
  // l'entreprise ». Tout ce qui suit est FACTUEL et mesuré non vide.
  'portfolio_url',
  'annees_experience',
  'poste_actuel_depuis_le',
  'poste_actuel_contrat',
  'niveau_anglais_libelle',
  'attentes_metier',
  'attentes_univers',
  'attentes_localisation_texte',
  'attentes_description',
  'secteurs_experience',
  'secteurs_vises',
  'parcours_type',
  'profils',
  'produits_connus',
  'contrats_souhaites',
  'remotes_souhaites',
  'criteres',
].join(',');

/**
 * Les colonnes de la LISTE d'un pipeline. D-14 : la liste ne montre que la
 * référence, la fiche montre la personne.
 *
 * ⚠ CE N'EST PAS UNE OPTIMISATION, C'EST UNE MESURE DE CLOISONNEMENT.
 * Next sérialise dans le HTML la charge utile RSC de tout ce qui traverse la
 * frontière serveur → client. Une colonne SÉLECTIONNÉE mais JAMAIS RENDUE part
 * quand même dans la page : le harnais l'a prouvé en trouvant le nom de famille
 * dans le HTML de la liste, alors qu'aucun composant ne l'affichait. Ne pas
 * afficher ne protège rien ; ne pas demander, si.
 */
export const COLONNES_CANDIDAT_LISTE = [
  'candidature_id',
  'mandat_id',
  'reference_pseudonyme',
  'etape',
  'etape_code',
  'etape_ordre',
  'etape_couleur',
  'est_ko',
  'est_terminale',
  'date_entree_pipeline',
  'date_dernier_changement_etape',
  'date_prochaine_echeance',
  'presente_le',
  'localisation_texte',
  'metier_actuel',
  'univers',
  'attentes_salaire_min_ke',
  'attentes_salaire_max_ke',
  'attentes_tjm_min_eur',
  'attentes_tjm_max_eur',
].join(',');

export type CandidatPresente = CandidatureClient & {
  prenom: string | null;
  nom: string | null;
  localisation: string | null;
  niveauAnglais: string | null;
  posteActuel: string | null;
  metierActuel: string | null;
  univers: string | null;
  expertises: string[];
  attentesSalaireMinKe: number | null;
  attentesSalaireMaxKe: number | null;
  attentesTjmMinEur: number | null;
  attentesTjmMaxEur: number | null;
  disponibilite: string | null;
  cvUrl: string | null;
  photoUrl: string | null;
  portfolioUrl: string | null;
  anneesExperience: number | null;
  posteActuelDepuisLe: string | null;
  posteActuelContrat: string | null;
  niveauAnglaisLibelle: string | null;
  attentesMetier: string | null;
  attentesUnivers: string | null;
  attentesLocalisation: string | null;
  attentesDescription: string | null;
  secteursExperience: string[];
  secteursVises: string[];
  parcoursType: string[];
  profils: string[];
  produitsConnus: string[];
  contratsSouhaites: string[];
  remotesSouhaites: string[];
  criteres: string[];
};

/**
 * Le nom affichable d'un candidat présenté, ou sa référence à défaut.
 * D-14 : la fiche porte l'identité, la liste porte le pseudonyme. Une fiche
 * dont la fiche talent a été détachée (`ON DELETE SET NULL`) retombe donc sur
 * la référence — elle ne montre jamais « null ».
 */
export function nomAffichable(c: Pick<CandidatPresente, 'prenom' | 'nom' | 'reference'>): string {
  const complet = [c.prenom, c.nom].filter(Boolean).join(' ').trim();
  return complet || c.reference;
}

export function versCandidat(l: Ligne): CandidatPresente {
  return {
    ...versCandidature({ ...l, id: l.candidature_id }),
    prenom: texte(l.prenom),
    nom: texte(l.nom),
    localisation: texte(l.localisation_texte),
    niveauAnglais: texte(l.niveau_anglais),
    posteActuel: texte(l.poste_actuel_employeur),
    metierActuel: texte(l.metier_actuel),
    univers: texte(l.univers),
    expertises: liste(l.expertises),
    attentesSalaireMinKe: nombre(l.attentes_salaire_min_ke),
    attentesSalaireMaxKe: nombre(l.attentes_salaire_max_ke),
    attentesTjmMinEur: nombre(l.attentes_tjm_min_eur),
    attentesTjmMaxEur: nombre(l.attentes_tjm_max_eur),
    disponibilite: texte(l.attentes_disponibilite_texte),
    cvUrl: urlMedia(texte(l.cv_url)),
    photoUrl: urlMedia(texte(l.photo_url)),
    portfolioUrl: urlMedia(texte(l.portfolio_url)),
    anneesExperience: nombre(l.annees_experience),
    posteActuelDepuisLe: texte(l.poste_actuel_depuis_le),
    posteActuelContrat: texte(l.poste_actuel_contrat),
    niveauAnglaisLibelle: texte(l.niveau_anglais_libelle),
    attentesMetier: texte(l.attentes_metier),
    attentesUnivers: texte(l.attentes_univers),
    attentesLocalisation: texte(l.attentes_localisation_texte),
    attentesDescription: texte(l.attentes_description),
    secteursExperience: liste(l.secteurs_experience),
    secteursVises: liste(l.secteurs_vises),
    parcoursType: liste(l.parcours_type),
    profils: liste(l.profils),
    produitsConnus: liste(l.produits_connus),
    contratsSouhaites: liste(l.contrats_souhaites),
    remotesSouhaites: liste(l.remotes_souhaites),
    criteres: liste(l.criteres),
  };
}

/**
 * Le niveau d'anglais arrive en code (`courant_quotidien`). Comme pour la
 * fonction d'un collaborateur, on se contente de le rendre lisible.
 */
export function libelleNiveau(code: string | null): string | null {
  if (!code) return null;
  const lisible = code.replace(/_/g, ' ');
  return lisible.charAt(0).toUpperCase() + lisible.slice(1);
}

/* ── api.note_partagee ──────────────────────────────────────────────────── */

export const COLONNES_NOTE = [
  'id',
  'candidature_id',
  'mandat_id',
  'commentaire',
  'ecrite_le',
  'auteur',
  'auteur_est_client',
  'auteur_photo',
  'reference_pseudonyme',
  'evenement',
  'est_automatique',
].join(',');

export type NotePartagee = {
  id: string;
  candidatureId: string | null;
  mandatId: string | null;
  commentaire: string;
  ecriteLe: string | null;
  auteur: string;
  auteurEstClient: boolean;
  auteurPhoto: string | null;
  reference: string | null;
  evenement: string | null;
  estAutomatique: boolean;
};

export function versNote(l: Ligne): NotePartagee {
  return {
    id: String(l.id),
    candidatureId: texte(l.candidature_id),
    mandatId: texte(l.mandat_id),
    commentaire: typeof l.commentaire === 'string' ? l.commentaire : '',
    ecriteLe: texte(l.ecrite_le),
    // `auteur` n'est jamais NULL côté vue — repli « Pachamama » compris. On
    // garde tout de même un défaut : une colonne vide ferait afficher un fil
    // signé de rien du tout.
    auteur: texte(l.auteur) ?? 'Pachamama',
    auteurEstClient: Boolean(l.auteur_est_client),
    auteurPhoto: urlMedia(texte(l.auteur_photo)),
    reference: texte(l.reference_pseudonyme),
    evenement: texte(l.evenement),
    estAutomatique: Boolean(l.est_automatique),
  };
}

/* ── api.mon_entreprise ─────────────────────────────────────────────────── */

export const COLONNES_ENTREPRISE = [
  'id',
  'nom',
  'raison_sociale',
  'description',
  'fondateur',
  'serie_financement',
  'site_web',
  'siret',
  'video_url',
  'logo_url',
  'localisation_texte',
  'nb_employes',
  'nb_techs',
  'secteur',
  'type_produit',
  'type_entreprise',
  'statut_contrat_code',
  'statut_contrat',
  'success_fee_pct',
  'success_fee_abs_ke',
  'success_fee_est_absolu',
  'apport_affaires',
  'exclusivite',
  'duree_exclusivite_semaines',
  'nb_mois_garantie',
  'date_signature_contrat',
  'date_fin_contrat',
  'email_facturation',
  'raison_sociale_facturation',
  'adresse_facturation',
  'am_nom',
  'am_photo',
  'am_fonction',
  'am_email',
].join(',');

export type MonEntreprise = {
  id: string;
  nom: string;
  raisonSociale: string | null;
  description: string | null;
  fondateur: string | null;
  serieFinancement: string | null;
  siteWeb: string | null;
  siret: string | null;
  videoUrl: string | null;
  logoUrl: string | null;
  localisation: string | null;
  nbEmployes: number | null;
  nbTechs: number | null;
  secteur: string | null;
  typeProduit: string | null;
  typeEntreprise: string | null;
  statutContratCode: string | null;
  statutContrat: string | null;
  successFeePct: number | null;
  successFeeAbsKe: number | null;
  successFeeEstAbsolu: boolean;
  apportAffaires: boolean;
  exclusivite: boolean;
  dureeExclusiviteSemaines: number | null;
  nbMoisGarantie: number | null;
  signatureLe: string | null;
  finContratLe: string | null;
  emailFacturation: string | null;
  raisonSocialeFacturation: string | null;
  adresseFacturation: unknown;
  amNom: string | null;
  amPhoto: string | null;
  amFonction: string | null;
  amEmail: string | null;
};

/**
 * CE QUI MANQUE À LA FICHE — deux listes, et pourquoi deux.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ELLES NE S'ADRESSENT PAS AUX MÊMES GENS
 * ─────────────────────────────────────────────────────────────────────────
 * Une localisation absente coûte des candidatures ; un SIRET absent coûte une
 * facture. Mélanger les deux dans un « profil incomplet à 60 % » aurait donné
 * un chiffre qui ne dit pas quoi faire, et rangé « effectif technique » à côté
 * de « raison sociale » comme si c'était le même sujet.
 *
 * ⚠ CES LISTES SONT NOURRIES PAR LA MESURE, PAS PAR L'INTUITION. Relevé le
 * 13/09 sur le compte de test, `api.mon_entreprise` : `localisation_texte` et
 * `nb_techs` sont vides — exactement les deux lignes de la vitrine — et
 * `raison_sociale`, `siret`, `email_facturation`, `raison_sociale_facturation`
 * et `adresse_facturation` le sont toutes les cinq. Ce ne sont donc pas des
 * cartes décoratives : sur le seul compte qu'on puisse observer, elles portent
 * sept lignes réelles.
 *
 * `ancre` sert au lien : la carte ne dit pas seulement ce qui manque, elle
 * emmène au champ. Nulle sur les lignes qui se règlent ailleurs.
 */
export type ManqueFiche = {
  cle: string;
  libelle: string;
  /** L'identifiant du champ à atteindre, quand il est sur cet écran. */
  ancre?: string;
};

const vide = (v: unknown): boolean =>
  v === null || v === undefined || v === '' || (typeof v === 'object' && Object.keys(v as object).length === 0);

/** Ce qu'un candidat ne trouvera pas. Dans l'ordre où l'écran pose les champs. */
export function manquesVitrine(e: MonEntreprise): ManqueFiche[] {
  const lignes: ManqueFiche[] = [
    { cle: 'description', libelle: 'Votre présentation', ancre: 'champ-description' },
    { cle: 'fondateur', libelle: 'Fondateur ou fondatrice', ancre: 'champ-fondateur' },
    { cle: 'serieFinancement', libelle: 'Série de financement', ancre: 'champ-serie' },
    { cle: 'localisation', libelle: 'Localisation', ancre: 'champ-localisation' },
    { cle: 'siteWeb', libelle: 'Site web', ancre: 'champ-site' },
    { cle: 'nbEmployes', libelle: 'Effectif total', ancre: 'champ-effectif' },
    { cle: 'nbTechs', libelle: 'Effectif technique', ancre: 'champ-techs' },
    { cle: 'logoUrl', libelle: 'Logo', ancre: 'champ-logo' },
    { cle: 'videoUrl', libelle: 'Vidéo de présentation', ancre: 'champ-video' },
  ];
  return lignes.filter((l) => vide((e as unknown as Record<string, unknown>)[l.cle]));
}

/**
 * Ce qui manque au dossier administratif.
 *
 * ⚠ « Raison sociale » N'A PAS D'ANCRE. Elle est tenue par le cabinet et
 * n'apparaît dans aucune liste blanche d'écriture : un lien vers un champ qui
 * n'existe pas serait pire que pas de lien. Le bouton de la carte mène à
 * « Contrat et factures », où la raison sociale DE FACTURATION, elle, se règle.
 */
export function manquesFacturation(e: MonEntreprise): ManqueFiche[] {
  const lignes: ManqueFiche[] = [
    { cle: 'raisonSociale', libelle: 'Raison sociale' },
    { cle: 'siret', libelle: 'SIRET', ancre: 'champ-siret' },
    { cle: 'emailFacturation', libelle: 'Adresse de facturation électronique' },
    { cle: 'adresseFacturation', libelle: 'Adresse postale de facturation' },
  ];
  return lignes.filter((l) => vide((e as unknown as Record<string, unknown>)[l.cle]));
}

export function versEntreprise(l: Ligne): MonEntreprise {
  return {
    id: String(l.id),
    nom: texte(l.nom) ?? 'Votre entreprise',
    raisonSociale: texte(l.raison_sociale),
    description: texte(l.description),
    fondateur: texte(l.fondateur),
    serieFinancement: texte(l.serie_financement),
    siteWeb: texte(l.site_web),
    siret: texte(l.siret),
    videoUrl: texte(l.video_url),
    logoUrl: texte(l.logo_url),
    localisation: texte(l.localisation_texte),
    nbEmployes: nombre(l.nb_employes),
    nbTechs: nombre(l.nb_techs),
    secteur: texte(l.secteur),
    typeProduit: texte(l.type_produit),
    typeEntreprise: texte(l.type_entreprise),
    statutContratCode: texte(l.statut_contrat_code),
    statutContrat: texte(l.statut_contrat),
    successFeePct: nombre(l.success_fee_pct),
    successFeeAbsKe: nombre(l.success_fee_abs_ke),
    successFeeEstAbsolu: Boolean(l.success_fee_est_absolu),
    apportAffaires: Boolean(l.apport_affaires),
    exclusivite: Boolean(l.exclusivite),
    dureeExclusiviteSemaines: nombre(l.duree_exclusivite_semaines),
    nbMoisGarantie: nombre(l.nb_mois_garantie),
    signatureLe: texte(l.date_signature_contrat),
    finContratLe: texte(l.date_fin_contrat),
    emailFacturation: texte(l.email_facturation),
    raisonSocialeFacturation: texte(l.raison_sociale_facturation),
    adresseFacturation: l.adresse_facturation ?? null,
    amNom: texte(l.am_nom),
    amPhoto: urlMedia(texte(l.am_photo)),
    amFonction: texte(l.am_fonction),
    amEmail: texte(l.am_email),
  };
}

/* ── api.mon_produit ────────────────────────────────────────────────────── */

export const COLONNES_PRODUIT = [
  'id',
  'nom',
  'description',
  'texte_annonce',
  'maturite_code',
  'maturite',
  'maturite_image',
  'maj_le',
].join(',');

export type MonProduit = {
  id: string;
  nom: string | null;
  description: string | null;
  texteAnnonce: string | null;
  maturiteCode: string | null;
  maturite: string | null;
  maturiteImage: string | null;
  majLe: string | null;
};

export function versProduit(l: Ligne): MonProduit {
  return {
    id: String(l.id),
    nom: texte(l.nom),
    description: texte(l.description),
    texteAnnonce: texte(l.texte_annonce),
    maturiteCode: texte(l.maturite_code),
    maturite: texte(l.maturite),
    maturiteImage: urlMedia(texte(l.maturite_image)),
    majLe: texte(l.maj_le),
  };
}

/* ── api.ma_facturation ─────────────────────────────────────────────────── */

export const COLONNES_FACTURATION = [
  'id',
  'mandat_id',
  'mandat_intitule',
  'metier',
  'reference_pseudonyme',
  'contrat',
  'date_closing',
  'date_debut_mission',
  'date_fin_garantie',
  'date_fin_mission',
  'salaire_final_ke',
  'commission_ke',
  'tjm_facture_client_eur',
  'statut_paiement',
  'montant_remboursement_garantie_ke',
  'rembourse_le',
  'est_archive',
].join(',');

export type LignePlacement = {
  id: string;
  mandatId: string | null;
  mandatIntitule: string | null;
  metier: string | null;
  reference: string | null;
  contrat: string | null;
  closingLe: string | null;
  debutLe: string | null;
  finGarantieLe: string | null;
  finMissionLe: string | null;
  salaireFinalKe: number | null;
  commissionKe: number | null;
  tjmFactureEur: number | null;
  statutPaiement: string | null;
  remboursementKe: number | null;
  rembourseLe: string | null;
  estArchive: boolean;
};

export function versPlacement(l: Ligne): LignePlacement {
  return {
    id: String(l.id),
    mandatId: texte(l.mandat_id),
    mandatIntitule: texte(l.mandat_intitule),
    metier: texte(l.metier),
    reference: texte(l.reference_pseudonyme),
    contrat: texte(l.contrat),
    closingLe: texte(l.date_closing),
    debutLe: texte(l.date_debut_mission),
    finGarantieLe: texte(l.date_fin_garantie),
    finMissionLe: texte(l.date_fin_mission),
    salaireFinalKe: nombre(l.salaire_final_ke),
    commissionKe: nombre(l.commission_ke),
    tjmFactureEur: nombre(l.tjm_facture_client_eur),
    statutPaiement: texte(l.statut_paiement),
    remboursementKe: nombre(l.montant_remboursement_garantie_ke),
    rembourseLe: texte(l.rembourse_le),
    estArchive: Boolean(l.est_archive),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   La fiche en texte — par bloc, et en entier
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ UN SÉRIALISEUR PAR BLOC, ET LA FICHE ENTIÈRE LES COMPOSE.
 *
 * L'écran offre deux copies : celle de la fiche entière, au niveau du titre, et
 * celle de chaque bloc, au survol. Écrire deux fois la mise en texte des mêmes
 * champs garantirait qu'un jour l'une dise « Expérience : 9 ans » et l'autre
 * non. La fiche entière n'est donc rien d'autre que la suite des blocs.
 */
type Ajout = {
  ligne: (libelle: string, valeur: string | number | null | undefined) => void;
  liste: (libelle: string, valeurs: readonly string[]) => void;
  brut: (texte: string) => void;
};

function collecteur(): { lignes: string[] } & Ajout {
  const lignes: string[] = [];
  return {
    lignes,
    ligne: (libelle, valeur) => {
      if (valeur === null || valeur === undefined || valeur === '') return;
      lignes.push(`${libelle} : ${valeur}`);
    },
    liste: (libelle, valeurs) => {
      if (valeurs.length === 0) return;
      lignes.push(`${libelle} : ${valeurs.join(', ')}`);
    },
    brut: (texte) => lignes.push(texte),
  };
}

/** Qui est cette personne : le bloc « Le profil ». */
export function texteProfil(c: CandidatPresente): string {
  const { lignes, ligne, liste } = collecteur();
  ligne('Métier', c.metierActuel);
  ligne('Employeur actuel', c.posteActuel);
  ligne('Contrat actuel', c.posteActuelContrat);
  ligne('En poste depuis', c.posteActuelDepuisLe);
  ligne('Expérience', c.anneesExperience !== null ? `${c.anneesExperience} ans` : null);
  ligne('Localisation', c.localisation);
  ligne('Anglais', c.niveauAnglaisLibelle ?? c.niveauAnglais);
  liste('Expertises', c.expertises);
  liste('Secteurs connus', c.secteursExperience);
  liste('Type de parcours', c.parcoursType);
  liste('Profil', c.profils);
  liste('Produits connus', c.produitsConnus);
  return lignes.join('\n');
}

/** Ce qu'elle cherche : le bloc « Ce que cette personne recherche ». */
export function texteRecherche(c: CandidatPresente): string {
  const { lignes, ligne, liste } = collecteur();
  ligne('Poste visé', c.attentesMetier);
  ligne('Univers visé', c.attentesUnivers);
  ligne(
    'Rémunération souhaitée',
    fourchette({
      salaireMinKe: c.attentesSalaireMinKe,
      salaireMaxKe: c.attentesSalaireMaxKe,
      tjmMinEur: c.attentesTjmMinEur,
      tjmMaxEur: c.attentesTjmMaxEur,
    }),
  );
  liste('Contrats acceptés', c.contratsSouhaites);
  liste('Rythme de remote', c.remotesSouhaites);
  ligne('Localisation visée', c.attentesLocalisation);
  liste('Secteurs visés', c.secteursVises);
  liste('Critères', c.criteres);
  ligne('Disponibilité', c.disponibilite);
  ligne('En quelques mots', c.attentesDescription);
  return lignes.join('\n');
}

/** Les liens des documents. Vide quand il n'y en a aucun. */
export function textePieces(c: CandidatPresente): string {
  const { lignes, ligne } = collecteur();
  ligne('CV', c.cvUrl);
  ligne('Portfolio', c.portfolioUrl);
  return lignes.join('\n');
}

/**
 * LA FICHE ENTIÈRE : l'identité, puis les blocs, dans l'ordre de l'écran.
 *
 * ⚠ LE NOM N'APPARAÎT QUE S'IL EST COMMUNIQUÉ. Sinon c'est la référence qui
 * tient lieu d'identité — le texte collé dans un message à l'équipe de décision
 * ne peut pas nommer quelqu'un que l'écran ne nomme pas.
 */
export function ficheEnTexte(c: CandidatPresente): string {
  const identite = [c.prenom, c.nom].filter(Boolean).join(' ').trim();
  const blocs: string[] = [identite || c.reference];
  if (identite) blocs.push(`Référence de suivi : ${c.reference}`);

  const ajouter = (titre: string | null, corps: string) => {
    if (!corps) return;
    blocs.push('');
    if (titre) blocs.push(titre);
    blocs.push(corps);
  };

  ajouter(null, texteProfil(c));
  ajouter('— Ce que cette personne recherche —', texteRecherche(c));
  if (c.argumentaire) ajouter('— Notre lecture —', c.argumentaire);
  ajouter(null, textePieces(c));

  return blocs.join('\n').trim();
}

/* ── api.mon_compte ────────────────────────────────────────────────────────── */

/**
 * L'utilisateur connecté, côté client.
 *
 * `email` est là et n'est PAS modifiable : c'est l'identité d'authentification.
 * L'afficher est utile — on vérifie sous quel compte on est — la changer est un
 * autre acte, qui touche `auth.users`.
 */
export const COLONNES_MON_COMPTE = [
  'id',
  'prenom',
  'nom',
  'email',
  'description',
  'photo_url',
  'metier_code',
  'metier',
  'est_referent_entreprise',
  'entreprise',
].join(',');

export type MonCompte = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  description: string | null;
  photoUrl: string | null;
  metierCode: string | null;
  metier: string | null;
  estReferent: boolean;
  entreprise: string | null;
};

export function versMonCompte(l: Ligne): MonCompte {
  return {
    id: String(l.id),
    prenom: texte(l.prenom),
    nom: texte(l.nom),
    email: texte(l.email),
    description: texte(l.description),
    photoUrl: urlMedia(texte(l.photo_url)),
    metierCode: texte(l.metier_code),
    metier: texte(l.metier),
    estReferent: Boolean(l.est_referent_entreprise),
    entreprise: texte(l.entreprise),
  };
}
