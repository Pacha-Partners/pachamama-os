import { EspaceEntreprise } from '@/components/vues/EspaceEntreprise';
import { ENTREPRISE } from '@/lib/demo/entreprise';

export const metadata = { title: 'Vos recrutements' };

/**
 * Route authentifiée du portail entreprise.
 *
 * Elle rend le MÊME composant que `/demo/entreprise` : une seule implémentation
 * de vue, deux sources de données. C'est ici, et nulle part ailleurs, que
 * l'appel à l'API remplacera la fixture — la vue n'aura pas à changer.
 *
 * Rappel de sécurité pour qui reprendra ce fichier : l'anonymat ne se garantit
 * pas ici. Il se garantit par la politique de sécurité PostgreSQL, qui empêche
 * un compte entreprise de LIRE les colonnes d'identité. Le jour où l'API est
 * branchée, c'est la policy qu'il faut écrire — pas un filtre dans ce composant.
 */
export default function Entreprise() {
  // TODO — branchement API : `await recupererPortailEntreprise(utilisateur)`.
  return (
    <main id="contenu">
      <EspaceEntreprise {...ENTREPRISE} />
    </main>
  );
}
