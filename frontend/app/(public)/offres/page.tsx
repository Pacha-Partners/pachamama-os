import { JobBoard } from '@/components/vues/JobBoard';
import { filtrer, LOCALISATIONS, OFFRES, UNIVERS } from '@/lib/demo/offres';

export const metadata = {
  title: 'Offres d’emploi — Product, Tech et Sales | Pachamama',
  description:
    'Les postes ouverts par le collectif Pachamama sur les univers Product, Tech et Sales, en CDI et en freelance.',
  // C'est la SEULE vue du produit destinée à être indexée : le reste est soit
  // privé, soit une démonstration à données fictives qu'il serait trompeur de
  // référencer.
  robots: { index: true, follow: true },
};

export default async function Offres({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const unique = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const filtres = {
    univers: unique(p.univers),
    contrat: unique(p.contrat),
    lieu: unique(p.lieu),
    q: unique(p.q),
  };

  return (
    <main id="contenu">
      <JobBoard
        offres={filtrer(OFFRES, filtres)}
        total={OFFRES.length}
        filtres={filtres}
        univers={UNIVERS}
        localisations={LOCALISATIONS}
      />
    </main>
  );
}
