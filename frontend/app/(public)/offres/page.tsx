import { EST_VERSION_EN_LIGNE, VERSION_DEPLOYEE } from '@/lib/config';
import { redirect } from 'next/navigation';
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
  // Instantané figé : cette vue n'est pas encore présentable. On renvoie vers
  // l'application en ligne plutôt que de montrer un écran incomplet.
  if (!EST_VERSION_EN_LIGNE) redirect(VERSION_DEPLOYEE);

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
