import { TableauDeBord } from '@/components/vues/talent/TableauDeBord';
import { SansFiche } from '@/components/vues/talent/SansFiche';
import { completudeDe } from '@/lib/domaine/talent';
import {
  ficheTableauDeBord,
  mesCandidatures,
  monInterlocuteur,
} from '@/lib/talent/lectures';

export const metadata = { title: 'Mon espace' };

/**
 * MON ESPACE — la page d'accueil du talent.
 *
 * Elle REMPLACE la coquille `exigerVue('talent'); return null;` du jalon 2, et
 * elle remplace `components/vues/EspaceTalent.tsx`, la maquette branchée sur
 * `lib/demo/talent.ts`. Cette maquette reste en place et sert la démonstration
 * publique (`app/demo/talent`), qui n'a ni session ni base : elle n'est pas
 * supprimée, elle n'est plus le chemin réel.
 *
 * ⚠ AUCUN IMPORT DE `lib/demo` ICI. C'est la règle du dépôt pour une route
 * privée, et elle a une raison mesurable : la maquette porte des candidats et
 * des entreprises inventés, qu'un écran connecté ne doit jamais mélanger à la
 * donnée réelle.
 *
 * `force-dynamic` : cet écran montre l'état d'un dossier qui bouge. Un rendu
 * mis en cache afficherait une étape périmée, ce qui est exactement ce qu'une
 * personne vient vérifier ici.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TROIS LECTURES EN PARALLÈLE, ET UNE SEULE REQUÊTE POUR LA FICHE
 * ─────────────────────────────────────────────────────────────────────────
 * `ficheTableauDeBord` demande l'union de `COLONNES_ENTETE` et de
 * `COLONNES_COMPLETUDE` : deux lectures mémoïsées séparées feraient deux
 * allers-retours pour deux jeux qui se recouvrent.
 *
 * ⚠ CE QUI FRANCHIT LA FRONTIÈRE (D-15) : `completudeDe` est appelée ICI, sur
 * le serveur, et seul son RÉSULTAT — un score et des libellés — descend dans
 * le composant. L'adresse électronique, le téléphone et le chemin du CV, qui
 * portent le patronyme dans 81 % des cas mesurés en phase 1, restent sur le
 * serveur. La fiche transmise au composant est réduite à ses colonnes d'en-tête.
 */
export const dynamic = 'force-dynamic';

export default async function Vue() {
  const [fiche, candidatures, interlocuteur] = await Promise.all([
    ficheTableauDeBord(),
    mesCandidatures(),
    monInterlocuteur(),
  ]);

  if (!fiche) return <SansFiche objet="votre dossier candidat" />;

  return (
    <TableauDeBord
      // On ne passe QUE les colonnes d'en-tête, reconstruites explicitement :
      // transmettre `fiche` entière ferait descendre les 21 colonnes du calcul
      // de complétude dans la charge utile RSC.
      fiche={{
        id: fiche.id,
        prenom: fiche.prenom,
        actif: fiche.actif,
        consentementDonneLe: fiche.consentementDonneLe,
      }}
      completude={completudeDe(fiche)}
      candidatures={candidatures}
      interlocuteur={interlocuteur}
    />
  );
}
