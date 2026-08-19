import type { Contrat, Univers } from '@/components/pacha/Tag';

/**
 * Offres de démonstration.
 *
 * Toutes les entreprises citées sont INVENTÉES. Aucun client réel du cabinet
 * n'apparaît ici, et les offres à `client: null` reproduisent le cas réel des
 * mandats sous anonymat : le client ne veut pas être nommé publiquement, et
 * l'interface doit l'assumer plutôt que d'afficher un vide.
 *
 * Ce fichier est une SOURCE, pas une vue : les composants de `components/vues/`
 * reçoivent ces données en props et n'importent jamais ce module. Le jour où
 * l'API existe, on change la source sans toucher aux vues.
 */
export type Offre = {
  id: string;
  poste: string;
  univers: Univers;
  contrat: Contrat;
  salaire: string;
  localisation: string;
  modeDeTravail: string;
  client: { nom: string } | null;
  exclusivite: boolean;
  motsCles: { emoji?: string; libelle: string }[];
  description: string;
  equipe: string;
  process: string;
  stack: string;
  publiee: string;
};

export const OFFRES: Offre[] = [
  {
    id: 'founding-product-designer',
    poste: 'Founding Product Designer',
    univers: 'product',
    contrat: 'freelance',
    salaire: '50 – 55 K',
    localisation: 'Paris, Lyon ou Nantes',
    modeDeTravail: 'Hybride',
    client: null,
    exclusivite: true,
    motsCles: [
      { emoji: '🐓', libelle: 'Boîte FR' },
      { emoji: '✌️', libelle: 'Cible user sympa' },
    ],
    description:
      'Première recrue design d’une équipe produit de six personnes. Le poste couvre la recherche, la conception et le design system — il n’y a rien avant vous, tout est à poser.',
    equipe: '6 personnes, dont 3 ingénieurs et un product manager',
    process: '4 étapes, 3 semaines',
    stack: 'Figma, Linear, Notion',
    publiee: '2026-08-12',
  },
  {
    id: 'senior-backend-go',
    poste: 'Senior Backend Engineer (Go)',
    univers: 'tech',
    contrat: 'cdi',
    salaire: '65 – 78 K',
    localisation: 'Lyon',
    modeDeTravail: 'Remote partiel — 2 jours sur site',
    client: { nom: 'Ardenne Labs' },
    exclusivite: false,
    motsCles: [
      { emoji: '⚙️', libelle: 'Forte culture technique' },
      { emoji: '📈', libelle: 'Série A' },
    ],
    description:
      'Reprise en main d’un socle de traitement de données qui a dépassé son architecture d’origine. Le sujet est la fiabilité : idempotence, reprise sur incident, observabilité.',
    equipe: '9 ingénieurs, deux escouades',
    process: '3 étapes, dont un échange technique sans exercice chronométré',
    stack: 'Go, PostgreSQL, NATS, Kubernetes',
    publiee: '2026-08-14',
  },
  {
    id: 'head-of-sales',
    poste: 'Head of Sales',
    univers: 'sales',
    contrat: 'cdi',
    salaire: '70 – 90 K + variable',
    localisation: 'Paris',
    modeDeTravail: 'Sur site',
    client: { nom: 'Perenne' },
    exclusivite: true,
    motsCles: [
      { emoji: '🚀', libelle: 'Première embauche commerciale' },
      { emoji: '🤝', libelle: 'Vente conseil' },
    ],
    description:
      'Structurer une fonction commerciale qui repose aujourd’hui entièrement sur les fondateurs. Le premier chantier est le processus, pas le volume.',
    equipe: 'À construire : deux recrutements prévus la première année',
    process: '4 étapes, dont une mise en situation',
    stack: 'HubSpot, Modjo',
    publiee: '2026-08-08',
  },
  {
    id: 'product-manager-data',
    poste: 'Product Manager — Data',
    univers: 'product',
    contrat: 'cdi',
    salaire: '58 – 70 K',
    localisation: 'Nantes',
    modeDeTravail: 'Remote majoritaire',
    client: null,
    exclusivite: false,
    motsCles: [{ emoji: '📊', libelle: 'Produit à forte composante data' }],
    description:
      'Porter une brique d’analyse utilisée par les équipes internes et exposée aux clients. Le poste suppose d’être à l’aise avec un modèle de données, pas seulement avec une feuille de route.',
    equipe: '4 personnes, rattachement au CPO',
    process: '3 étapes',
    stack: 'dbt, Metabase, Snowflake',
    publiee: '2026-08-15',
  },
  {
    id: 'staff-frontend',
    poste: 'Staff Frontend Engineer',
    univers: 'tech',
    contrat: 'freelance',
    salaire: '600 – 750 € / jour',
    localisation: 'Remote (France)',
    modeDeTravail: 'Full remote',
    client: { nom: 'Rivage' },
    exclusivite: false,
    motsCles: [
      { emoji: '♿', libelle: 'Accessibilité au cahier des charges' },
      { emoji: '🧪', libelle: 'Tests pris au sérieux' },
    ],
    description:
      'Mission de six mois pour refondre une interface de gestion utilisée quotidiennement par des opérateurs. Contrainte structurante : l’accessibilité est un critère de recette, pas une intention.',
    equipe: '5 ingénieurs front, un designer',
    process: '2 étapes',
    stack: 'TypeScript, React, Tailwind, Playwright',
    publiee: '2026-08-16',
  },
  {
    id: 'account-executive-mid-market',
    poste: 'Account Executive — Mid-Market',
    univers: 'sales',
    contrat: 'cdi',
    salaire: '45 K + 25 K variable',
    localisation: 'Bordeaux',
    modeDeTravail: 'Hybride',
    client: { nom: 'Cortalis' },
    exclusivite: false,
    motsCles: [{ emoji: '🎯', libelle: 'Cycle court' }],
    description:
      'Cycle de vente de six à dix semaines sur un logiciel métier déjà installé. Le portefeuille existe, il s’agit de l’étendre.',
    equipe: '7 commerciaux, un sales ops',
    process: '3 étapes',
    stack: 'Salesforce, Gong',
    publiee: '2026-08-05',
  },
  {
    id: 'lead-people-ops',
    poste: 'Lead People Ops',
    univers: 'people',
    contrat: 'cdi',
    salaire: '55 – 62 K',
    localisation: 'Paris',
    modeDeTravail: 'Hybride',
    client: null,
    exclusivite: true,
    motsCles: [
      { emoji: '🌱', libelle: 'Croissance maîtrisée' },
      { emoji: '📜', libelle: 'Sujets de conformité' },
    ],
    description:
      'Structurer les processus RH d’une entreprise passée de 20 à 80 personnes en deux ans, sans ajouter de bureaucratie.',
    equipe: '2 personnes, rattachement direct à la direction',
    process: '3 étapes',
    stack: 'Payfit, Lucca',
    publiee: '2026-08-11',
  },
  {
    id: 'data-engineer-plateforme',
    poste: 'Data Engineer — Plateforme',
    univers: 'tech',
    contrat: 'cdi',
    salaire: '55 – 68 K',
    localisation: 'Lyon ou remote',
    modeDeTravail: 'Full remote possible',
    client: { nom: 'Ombelle' },
    exclusivite: false,
    motsCles: [{ emoji: '🔁', libelle: 'Réconciliation de données' }],
    description:
      'Construire les pipelines qui alimentent une base de référence unique à partir de quatre systèmes qui ne se parlent pas. Le sujet central est la qualité, pas le volume.',
    equipe: '3 data engineers, un analytics engineer',
    process: '3 étapes',
    stack: 'Python, Airflow, PostgreSQL, dbt',
    publiee: '2026-08-17',
  },
  {
    id: 'designer-produit-senior',
    poste: 'Designer Produit Senior',
    univers: 'product',
    contrat: 'freelance',
    salaire: '500 – 600 € / jour',
    localisation: 'Paris',
    modeDeTravail: 'Hybride',
    client: { nom: 'Sillage' },
    exclusivite: false,
    motsCles: [{ emoji: '🎨', libelle: 'Design system à reprendre' }],
    description:
      'Mission de quatre mois pour remettre d’aplomb un design system qui a dérivé : trois polices de substitution, deux rouges d’erreur et des rayons incohérents.',
    equipe: '2 designers, 12 ingénieurs',
    process: '2 étapes',
    stack: 'Figma, Storybook',
    publiee: '2026-08-13',
  },
  {
    id: 'sdr-bilingue',
    poste: 'Sales Development Representative bilingue',
    univers: 'sales',
    contrat: 'cdi',
    salaire: '38 K + 12 K variable',
    localisation: 'Lyon',
    modeDeTravail: 'Hybride',
    client: null,
    exclusivite: false,
    motsCles: [{ emoji: '🇬🇧', libelle: 'Marché UK' }],
    description:
      'Ouvrir le marché britannique depuis Lyon. Poste de création, avec un accompagnement commercial structuré.',
    equipe: '4 SDR, un manager',
    process: '3 étapes',
    stack: 'HubSpot, Lemlist',
    publiee: '2026-08-07',
  },
  {
    id: 'engineering-manager',
    poste: 'Engineering Manager',
    univers: 'tech',
    contrat: 'cdi',
    salaire: '75 – 88 K',
    localisation: 'Paris ou Nantes',
    modeDeTravail: 'Hybride',
    client: { nom: 'Ardenne Labs' },
    exclusivite: true,
    motsCles: [
      { emoji: '🧭', libelle: 'Management de proximité' },
      { emoji: '🛠️', libelle: 'Reste technique' },
    ],
    description:
      'Encadrer deux escouades sans quitter le code. Le poste est explicitement défini comme 30 % de contribution technique.',
    equipe: '9 ingénieurs répartis en deux escouades',
    process: '4 étapes',
    stack: 'Go, TypeScript, PostgreSQL',
    publiee: '2026-08-10',
  },
  {
    id: 'talent-acquisition-manager',
    poste: 'Talent Acquisition Manager',
    univers: 'people',
    contrat: 'cdi',
    salaire: '48 – 56 K',
    localisation: 'Remote (France)',
    modeDeTravail: 'Full remote',
    client: { nom: 'Perenne' },
    exclusivite: false,
    motsCles: [{ emoji: '📚', libelle: 'Recrutement technique' }],
    description:
      'Internaliser le recrutement technique aujourd’hui entièrement délégué. Objectif de la première année : un processus tenable, pas un volume record.',
    equipe: '1 personne au départ, rattachée aux People Ops',
    process: '3 étapes',
    stack: 'Ashby, LinkedIn Recruiter',
    publiee: '2026-08-09',
  },
];

export const UNIVERS: { cle: Univers; libelle: string }[] = [
  { cle: 'product', libelle: 'Product' },
  { cle: 'tech', libelle: 'Tech' },
  { cle: 'sales', libelle: 'Sales' },
  { cle: 'people', libelle: 'People' },
];

export const LOCALISATIONS = ['Paris', 'Lyon', 'Nantes', 'Bordeaux', 'Remote'];

/** Filtrage — volontairement une fonction pure, testable sans rendu. */
export function filtrer(
  offres: Offre[],
  f: { univers?: string; contrat?: string; lieu?: string; q?: string },
): Offre[] {
  return offres.filter((o) => {
    if (f.univers && o.univers !== f.univers) return false;
    if (f.contrat && o.contrat !== f.contrat) return false;
    if (f.lieu && !o.localisation.toLowerCase().includes(f.lieu.toLowerCase())) return false;
    if (f.q && !o.poste.toLowerCase().includes(f.q.toLowerCase())) return false;
    return true;
  });
}
