import { notFound } from 'next/navigation';
import { FicheOffre } from '@/components/vues/FicheOffre';
import { OFFRES } from '@/lib/demo/offres';

/** Prérendu de toutes les fiches : elles sont indexables, donc statiques. */
export function generateStaticParams() {
  return OFFRES.map((o) => ({ id: o.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offre = OFFRES.find((o) => o.id === id);
  if (!offre) return { title: 'Offre introuvable' };
  const chez = offre.client ? `chez ${offre.client.nom}` : '— entreprise anonyme';
  return {
    title: `${offre.poste} ${chez} | Pachamama`,
    description: offre.description.slice(0, 155),
    robots: { index: true, follow: true },
  };
}

export default async function Fiche({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offre = OFFRES.find((o) => o.id === id);
  if (!offre) notFound();
  return (
    <main id="contenu">
      <FicheOffre offre={offre} />
    </main>
  );
}
