import { notFound, redirect } from 'next/navigation';
import { FicheOffre } from '@/components/vues/FicheOffre';
import { EST_VERSION_EN_LIGNE, VERSION_DEPLOYEE } from '@/lib/config';
import { OFFRES } from '@/lib/demo/offres';

/**
 * Prérendu de toutes les fiches : elles sont indexables, donc statiques.
 *
 * Sauf dans l'instantané livré, où la liste est vide À DESSEIN. Une page
 * prérendue est servie telle quelle, sans exécuter le corps du composant : la
 * garde de redirection ne s'y appliquerait pas et les fiches resteraient
 * accessibles. Ne rien prérendre rend la route dynamique, et la garde reprend
 * la main.
 */
export function generateStaticParams() {
  if (!EST_VERSION_EN_LIGNE) return [];
  return OFFRES.map((o) => ({ id: o.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offre = OFFRES.find((o) => o.id === id);
  if (!offre) return { title: 'Offre introuvable' };
  const chez = offre.client ? `chez ${offre.client.nom}` : '(entreprise anonyme)';
  return {
    title: `${offre.poste} ${chez} | Pachamama`,
    description: offre.description.slice(0, 155),
    robots: { index: true, follow: true },
  };
}

export default async function Fiche({ params }: { params: Promise<{ id: string }> }) {
  // La garde vit ICI, dans le composant, et non dans `generateMetadata` : un
  // `redirect()` placé dans la génération des métadonnées ne redirige pas la
  // réponse. C'est l'erreur que j'avais commise, et elle laissait les fiches
  // accessibles alors que la vérification annonçait le contraire.
  if (!EST_VERSION_EN_LIGNE) redirect(VERSION_DEPLOYEE);

  const { id } = await params;
  const offre = OFFRES.find((o) => o.id === id);
  if (!offre) notFound();
  return (
    <main id="contenu">
      <FicheOffre offre={offre} />
    </main>
  );
}
