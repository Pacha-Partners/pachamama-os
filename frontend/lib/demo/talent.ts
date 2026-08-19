import type { Etape } from '@/components/pacha/StatutProcess';

/** Données fictives. Aucun candidat ni client réel — voir `BandeauDemo`. */
export type DonneesTalent = {
  identite: { prenom: string; nom: string; ville: string; poste: string; seniorite: string; univers: string; anglais: string };
  qualification: { complete: boolean; manquant: string[] };
  attentes: { remuneration: string; contrats: string[]; mobilite: string; disponibilite: string; modeDeTravail: string };
  candidatures: { id: string; poste: string; entreprise: string | null; etape: Etape; prochaine?: string }[];
  suggestions: { id: string; poste: string; entreprise: string | null; salaire: string; lieu: string; dejaCandidate: boolean }[];
};

export const TALENT: DonneesTalent = {
  identite: {
    prenom: 'Camille', nom: 'Rivoire', ville: 'Lyon',
    poste: 'Senior Product Manager', seniorite: 'Senior (7 ans)',
    univers: 'Product', anglais: 'Courant (C1)',
  },
  qualification: {
    complete: false,
    manquant: ['Fourchette de rémunération souhaitée', 'CV à jour (le dernier date de 14 mois)'],
  },
  attentes: {
    remuneration: '65 – 75 K',
    contrats: ['CDI', 'Freelance'],
    mobilite: 'Lyon et Paris, deux jours par semaine maximum',
    disponibilite: 'Sous deux mois',
    modeDeTravail: 'Hybride',
  },
  candidatures: [
    { id: 'c1', poste: 'Product Manager — Data', entreprise: null, etape: 'interview-2', prochaine: '22/08/2026' },
    { id: 'c2', poste: 'Lead Product', entreprise: 'Ombelle', etape: 'send-out-violet', prochaine: '25/08/2026' },
    { id: 'c3', poste: 'Senior PM Plateforme', entreprise: 'Ardenne Labs', etape: 'screen-pachamama' },
    { id: 'c4', poste: 'Head of Product', entreprise: 'Sillage', etape: 'ko' },
  ],
  suggestions: [
    { id: 'product-manager-data', poste: 'Product Manager — Data', entreprise: null, salaire: '58 – 70 K', lieu: 'Nantes', dejaCandidate: true },
    { id: 'founding-product-designer', poste: 'Founding Product Designer', entreprise: null, salaire: '50 – 55 K', lieu: 'Paris, Lyon ou Nantes', dejaCandidate: false },
  ],
};
