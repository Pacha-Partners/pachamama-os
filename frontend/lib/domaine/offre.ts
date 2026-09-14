import type { Univers } from '@/components/pacha/Tag';

/**
 * LE JOB BOARD — la donnée et ses règles.
 *
 * Une seule source : la vue `api.offre_publique`. Elle est la seule surface
 * exposée au réseau, et elle est bâtie pour ne jamais laisser passer le nom
 * d'un client sur une offre anonyme — mesuré, 11 des 12 titres de mandat
 * contiennent la raison sociale, d'où un intitulé recalculé depuis le métier.
 *
 * Les libellés d'affichage (« CDI », « Hybride ») traversent la vue plutôt que
 * d'être recopiés ici : `ref` n'est pas un schéma exposé, et une seconde table
 * de correspondance dans le front divergerait au premier ajout de valeur.
 */

export type Offre = {
  id: string;
  intitule: string;
  universCode: string | null;
  univers: string | null;
  metier: string | null;
  /** `null` = offre anonyme. Ce n'est pas un champ vide : c'est une promesse. */
  entreprise: string | null;
  contrat: string | null;
  contratLibelle: string | null;
  management: string | null;
  managementLibelle: string | null;
  exclusivitePachamama: boolean;
  salaireMinKe: number | null;
  salaireMaxKe: number | null;
  tjmMinEur: number | null;
  tjmMaxEur: number | null;
  salaireAffiche: string | null;
  localisation: string | null;
  remoteLibelle: string | null;
  publieLe: string | null;
};

/** Les colonnes lues. Énumérées, jamais `*` : la vue peut grandir, pas la page. */
export const COLONNES_OFFRE = [
  'id',
  'intitule',
  'univers_code',
  'univers',
  'metier',
  'entreprise',
  'contrat',
  'contrat_libelle',
  'management',
  'management_libelle',
  'exclusivite_pachamama',
  'salaire_min_ke',
  'salaire_max_ke',
  'tjm_min_eur',
  'tjm_max_eur',
  'salaire_affiche',
  'localisation',
  'remote_libelle',
  'publie_le',
].join(',');

type LigneOffre = Record<string, unknown>;

export function versOffre(l: LigneOffre): Offre {
  const nombre = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const texte = (v: unknown) => (v === null || v === undefined ? null : String(v));
  return {
    id: String(l.id),
    intitule: String(l.intitule ?? 'Poste à pourvoir'),
    universCode: texte(l.univers_code),
    univers: texte(l.univers),
    metier: texte(l.metier),
    entreprise: texte(l.entreprise),
    contrat: texte(l.contrat),
    contratLibelle: texte(l.contrat_libelle),
    management: texte(l.management),
    managementLibelle: texte(l.management_libelle),
    exclusivitePachamama: Boolean(l.exclusivite_pachamama),
    salaireMinKe: nombre(l.salaire_min_ke),
    salaireMaxKe: nombre(l.salaire_max_ke),
    tjmMinEur: nombre(l.tjm_min_eur),
    tjmMaxEur: nombre(l.tjm_max_eur),
    salaireAffiche: texte(l.salaire_affiche),
    localisation: texte(l.localisation),
    remoteLibelle: texte(l.remote_libelle),
    publieLe: texte(l.publie_le),
  };
}

/* ── Mise en forme ────────────────────────────────────────────────────────── */

/**
 * « 50-55 K » sur la maquette. Deux unités cohabitent dans le modèle et ne se
 * mélangent jamais : le salaire annuel est en K€, le TJM en euros par jour. La
 * confusion entre les deux a déjà coûté un facteur mille sur les commissions,
 * d'où les suffixes explicites.
 */
/**
 * Le paramètre est STRUCTUREL et non `Offre` : la fiche d'offre appelle la même
 * fonction sans être une `Offre`, et lui faire porter un cast aurait mis deux
 * types en présence là où une seule règle doit s'appliquer. Le libellé du
 * salaire doit être identique sur la carte et sur la fiche.
 */
export type SourceSalaire = Pick<
  Offre,
  'salaireAffiche' | 'salaireMinKe' | 'salaireMaxKe' | 'tjmMinEur' | 'tjmMaxEur'
>;

export function formaterSalaire(o: SourceSalaire): string | undefined {
  if (o.salaireAffiche) return o.salaireAffiche;
  const plage = (a: number | null, b: number | null, unite: string) => {
    if (a == null && b == null) return undefined;
    if (a != null && b != null && a !== b) return `${fmt(a)}-${fmt(b)} ${unite}`;
    return `${fmt((a ?? b) as number)} ${unite}`;
  };
  return plage(o.salaireMinKe, o.salaireMaxKe, 'K') ?? plage(o.tjmMinEur, o.tjmMaxEur, '€/j');
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(1))));

/**
 * La teinte du tag d'univers. Le design system n'en colore que quatre — People,
 * Product, Tech, Sales — alors que le référentiel en compte huit. Mesuré sur
 * les 533 mandats : seuls Product (269), Tech (132), Sales (40),
 * People & Finance (13) et Marketing (5) sont employés ; design, data et
 * finance n'ont aucun mandat.
 *
 * Quatre des cinq se rangent sous une verticale. « Marketing » n'en a pas : il
 * prend la teinte la plus neutre et garde son propre libellé, la couleur étant
 * décorative et ne portant jamais de sens à elle seule.
 */
export function teinteUnivers(code: string | null): Univers {
  switch (code) {
    case 'product':
      return 'product';
    case 'tech':
    case 'data':
    case 'design':
      return 'tech';
    case 'sales':
      return 'sales';
    default:
      return 'people';
  }
}

/* ── Les règles de la page, telles qu'annotées sur la maquette ────────────── */

export type Filtres = { univers: string[]; contrat: string[]; management: string[] };

export const FILTRES_VIDES: Filtres = { univers: [], contrat: [], management: [] };

/** Un axe vide ne filtre rien ; sinon l'offre doit appartenir aux choix faits. */
export function filtrer(offres: Offre[], f: Filtres): Offre[] {
  const retient = (choix: string[], valeur: string | null) =>
    choix.length === 0 || (valeur !== null && choix.includes(valeur));
  return offres.filter(
    (o) =>
      retient(f.univers, o.universCode) &&
      retient(f.contrat, o.contrat) &&
      retient(f.management, o.management),
  );
}

/**
 * « Les petits nouveaux » = les 3 offres les plus récentes, et la catégorie
 * SUIT LES FILTRES : les trois plus récentes *parmi celles qui les respectent*.
 * « Tous les jobs (N) » montre le reste, et N les compte sans ces trois-là.
 *
 * Le tri est décroissant sur la date de publication — la plus récente d'abord,
 * la plus ancienne en dernier.
 */
export function repartir(offres: Offre[]): { nouveaux: Offre[]; autres: Offre[] } {
  const tri = [...offres].sort(
    (a, b) => (b.publieLe ?? '').localeCompare(a.publieLe ?? ''),
  );
  return { nouveaux: tri.slice(0, 3), autres: tri.slice(3) };
}

/**
 * Les options d'un filtre viennent des offres RÉELLEMENT publiées, pas du
 * référentiel. Un job board qui propose de filtrer sur un univers sans offre
 * tend un piège : le visiteur coche, l'écran se vide, et il en conclut que le
 * site est cassé. Aujourd'hui l'univers donne Tech, Product et Sales.
 */
export function optionsDepuis(
  offres: Offre[],
  code: (o: Offre) => string | null,
  libelle: (o: Offre) => string | null,
): { valeur: string; libelle: string }[] {
  const vues = new Map<string, string>();
  for (const o of offres) {
    const c = code(o);
    if (c && !vues.has(c)) vues.set(c, libelle(o) ?? c);
  }
  return [...vues].map(([valeur, lib]) => ({ valeur, libelle: lib }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));
}
