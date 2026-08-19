import { EspaceTalent } from '@/components/vues/EspaceTalent';
import { TALENT } from '@/lib/demo/talent';

export const metadata = { title: 'Espace talent' };

/**
 * Route authentifiée de l'espace talent.
 *
 * Elle rend le MÊME composant que `/demo/talent` : une seule implémentation de
 * vue, deux sources de données. C'est ici, et nulle part ailleurs, que l'appel à
 * l'API viendra remplacer la fixture — la vue n'aura pas à changer d'une ligne.
 */
export default function Talent() {
  // TODO — point de branchement de l'API : `await recupererTalent(utilisateur.id)`.
  return (
    <main id="contenu">
      <EspaceTalent {...TALENT} />
    </main>
  );
}
