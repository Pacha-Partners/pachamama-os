import type { Etape } from '@/components/pacha/StatutProcess';
import type { Contrat, Univers } from '@/components/pacha/Tag';

/**
 * Données de démonstration du portail entreprise.
 *
 * ── LA CONTRAINTE QUI GOUVERNE CE FICHIER ────────────────────────────────────
 *
 * Le client suit ses candidats **sans jamais voir leur identité**. C'est une
 * promesse contractuelle du cabinet, pas un réglage d'affichage.
 *
 * Ce fichier ne contient donc **aucune identité** : ni nom, ni prénom, ni
 * adresse, ni téléphone, ni URL de profil, ni photo, ni employeur actuel. Ce
 * n'est pas une omission de circonstance — c'est la garantie la plus forte
 * qu'on puisse offrir. Une vue ne peut pas divulguer ce que sa donnée ne porte
 * pas, et aucune régression future ne pourra faire fuiter un champ absent.
 *
 * En production, cette contrainte est tenue un niveau plus bas encore : la
 * politique de sécurité PostgreSQL empêche un compte entreprise de LIRE les
 * colonnes d'identité. L'interface n'est que la seconde ligne de défense.
 *
 * Un talent est donc désigné par une **référence anonyme stable** — le client
 * peut en parler au cabinet sans ambiguïté — et qualifié par ses seuls
 * attributs professionnels.
 */

/**
 * Les étapes visibles par un client, et elles ne sont pas les onze.
 *
 * « To contact », « Contacted » et « Screen by Pachamama » sont des étapes
 * INTERNES : c'est le travail de sourcing et de qualification que le cabinet
 * mène avant de présenter qui que ce soit. Les exposer au client reviendrait à
 * lui montrer des personnes qui n'ont encore rien accepté, et à lui laisser
 * croire qu'un vivier de contacts vaut un vivier de candidats.
 *
 * Le client entre dans le process au **send-out** : le moment où le cabinet
 * lui présente quelqu'un et engage sa recommandation.
 */
export const ETAPES_CLIENT: Etape[] = [
  'send-out-violet',
  'interview-1',
  'interview-2',
  'interview-finale',
  'recrute',
  'ko',
];

export type CandidatAnonyme = {
  /** Référence stable, partageable avec le cabinet. Jamais un nom. */
  reference: string;
  etape: Etape;
  seniorite: string;
  univers: Univers;
  experience: string;
  expertises: string[];
  pretentions: string;
  localisation: string;
  modeDeTravail: string;
  disponibilite: string;
  /** Avis du cabinet, pas une note automatique. */
  avisCabinet: 'excellent' | 'bon' | 'mauvais' | 'indefini';
  prochaineEcheance?: string;
  /** Ce que le cabinet a écrit au client pour justifier la présentation. */
  argumentaire?: string;
};

export type MandatClient = {
  id: string;
  poste: string;
  univers: Univers;
  contrat: Contrat;
  ouvertLe: string;
  candidats: CandidatAnonyme[];
};

export type DonneesEntreprise = {
  client: { nom: string; secteur: string; interlocuteur: string };
  mandats: MandatClient[];
};

export const ENTREPRISE: DonneesEntreprise = {
  client: {
    nom: 'Ardenne Labs',
    secteur: 'Logiciel de traitement de données · 45 personnes',
    // Fonction, pas identité : c'est un rôle côté client, et le nommer
    // n'apporterait rien à la démonstration.
    interlocuteur: 'Direction technique',
  },
  mandats: [
    {
      id: 'em-plateforme',
      poste: 'Engineering Manager — Plateforme',
      univers: 'tech',
      contrat: 'cdi',
      ouvertLe: '02/07/2026',
      candidats: [
        {
          reference: 'Profil A-204',
          etape: 'interview-finale',
          seniorite: 'Senior',
          univers: 'tech',
          experience: '11 ans, dont 4 en encadrement',
          expertises: ['Go', 'PostgreSQL', 'observabilité', 'management de proximité'],
          pretentions: '82 – 88 K',
          localisation: 'Lyon',
          modeDeTravail: 'Hybride, 2 jours sur site',
          disponibilite: 'Sous un mois',
          avisCabinet: 'excellent',
          prochaineEcheance: '24/08/2026',
          argumentaire:
            'A déjà mené la reprise d’un socle de traitement qui avait dépassé son architecture : c’est exactement votre sujet. Cherche un poste où le management ne coupe pas du code, ce que votre définition à 30 % de contribution technique satisfait.',
        },
        {
          reference: 'Profil A-217',
          etape: 'interview-2',
          seniorite: 'Senior',
          univers: 'tech',
          experience: '9 ans, dont 3 en encadrement',
          expertises: ['Go', 'Kubernetes', 'fiabilité'],
          pretentions: '78 – 85 K',
          localisation: 'Paris, mobile sur Lyon',
          modeDeTravail: 'Hybride',
          disponibilite: 'Deux mois de préavis',
          avisCabinet: 'bon',
          prochaineEcheance: '26/08/2026',
          argumentaire:
            'Profil plus infrastructure que produit. À creuser sur l’appétence au management, qui est récente.',
        },
        {
          reference: 'Profil A-231',
          etape: 'send-out-violet',
          seniorite: 'Senior',
          univers: 'tech',
          experience: '13 ans, dont 6 en encadrement',
          expertises: ['Go', 'Rust', 'architecture distribuée'],
          pretentions: '90 – 95 K',
          localisation: 'Full remote souhaité',
          modeDeTravail: 'Full remote',
          disponibilite: 'Immédiate',
          avisCabinet: 'bon',
          argumentaire:
            'Le plus expérimenté des trois, mais deux écarts à arbitrer de votre côté : la fourchette dépasse la vôtre de 5 K, et le full remote se heurte à vos deux jours sur site.',
        },
        {
          reference: 'Profil A-188',
          etape: 'ko',
          seniorite: 'Confirmé',
          univers: 'tech',
          experience: '7 ans, dont 1 en encadrement',
          expertises: ['Go', 'PostgreSQL'],
          pretentions: '70 – 75 K',
          localisation: 'Lyon',
          modeDeTravail: 'Hybride',
          disponibilite: 'Immédiate',
          avisCabinet: 'indefini',
          argumentaire:
            'Retiré du process à sa demande : a accepté une autre proposition pendant l’instruction.',
        },
      ],
    },
    {
      id: 'data-engineer',
      poste: 'Data Engineer — Plateforme',
      univers: 'tech',
      contrat: 'cdi',
      ouvertLe: '28/07/2026',
      candidats: [
        {
          reference: 'Profil B-092',
          etape: 'interview-1',
          seniorite: 'Confirmé',
          univers: 'tech',
          experience: '6 ans',
          expertises: ['Python', 'Airflow', 'dbt', 'réconciliation de données'],
          pretentions: '62 – 68 K',
          localisation: 'Lyon',
          modeDeTravail: 'Full remote possible',
          disponibilite: 'Sous six semaines',
          avisCabinet: 'excellent',
          prochaineEcheance: '25/08/2026',
          argumentaire:
            'A construit une base de référence unique à partir de quatre systèmes qui ne se parlaient pas. Le sujet de la qualité de donnée lui est familier, pas théorique.',
        },
        {
          reference: 'Profil B-104',
          etape: 'send-out-violet',
          seniorite: 'Confirmé',
          univers: 'tech',
          experience: '5 ans',
          expertises: ['Python', 'Spark', 'Snowflake'],
          pretentions: '58 – 64 K',
          localisation: 'Nantes',
          modeDeTravail: 'Full remote',
          disponibilite: 'Immédiate',
          avisCabinet: 'bon',
          argumentaire:
            'Solide sur le volume, moins exposé aux sujets de qualité. Bon second choix.',
        },
      ],
    },
    {
      id: 'product-designer',
      poste: 'Product Designer',
      univers: 'product',
      contrat: 'freelance',
      ouvertLe: '11/08/2026',
      candidats: [],
    },
  ],
};
