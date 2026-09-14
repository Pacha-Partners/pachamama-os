import { MesProcess } from '@/components/vues/talent/MesProcess';
import { SansFiche } from '@/components/vues/talent/SansFiche';
import { CadreEcran, EnteteEcran } from '@/components/vues/talent/atomes';
import { ficheEntete, mesCandidatures } from '@/lib/talent/lectures';

export const metadata = { title: 'Mes process' };
export const dynamic = 'force-dynamic';

/**
 * MES PROCESS — le suivi complet des candidatures.
 *
 * Le tableau de bord les listait toutes ; il n'en garde qu'un aperçu. Ici, les
 * deux ensembles au complet, séparés par onglet.
 *
 * `ficheEntete` est lue pour distinguer « pas de fiche » — le compte n'est pas
 * rattaché à un dossier candidat — de « fiche sans process ». Sans elle, un
 * compte non rattaché verrait une invitation à postuler qu'il ne pourrait pas
 * honorer.
 */
export default async function Vue() {
  const [fiche, candidatures] = await Promise.all([ficheEntete(), mesCandidatures()]);
  if (!fiche) return <SansFiche objet="votre dossier candidat" />;

  return (
    <CadreEcran>
      <EnteteEcran descriptif="Vos" impact="process" />
      <MesProcess candidatures={candidatures} />
    </CadreEcran>
  );
}
