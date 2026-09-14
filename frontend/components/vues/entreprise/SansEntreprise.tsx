import { Bouton } from '@/components/pacha/Bouton';
import { EtatVide } from '@/components/pacha/EtatVide';
import { FormeCourbe } from '@/components/pacha/Illustration';
import { CadreEcran } from '@/components/vues/entreprise/atomes';

/**
 * LE COMPTE A L'ACCÈS « ENTREPRISE », MAIS AUCUNE FICHE N'Y EST RATTACHÉE.
 *
 * Ce n'est pas théorique : la reprise depuis Bubble a forcé `contact_client_id`
 * à NULL, et 341 utilisateurs sont dans cet état sur le dev. Un compte comme
 * celui-là lit zéro ligne sur TOUTES les vues du portail.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI CE N'EST PAS UN 404
 * ─────────────────────────────────────────────────────────────────────────
 * L'adresse est bonne, la page existe, l'utilisateur a le droit d'y être. Ce
 * qui manque, c'est un rattachement en base — un geste de NOTRE côté. Rendre
 * « page introuvable » enverrait quelqu'un chercher une faute dans son lien
 * pendant que le vrai correctif attend chez son Account Manager. Et un
 * formulaire vide, qui refuserait de s'enregistrer avec « aucune entreprise
 * n'est rattachée à ce compte », serait pire encore.
 *
 * On nomme donc la cause, on dit qui la répare, et on laisse une sortie.
 */
export function SansEntreprise({ objet }: { objet: string }) {
  return (
    <CadreEcran>
      <EtatVide
        titre="Votre compte n’est rattaché à aucune entreprise"
        description={`Nous ne pouvons pas afficher ${objet} tant que votre accès n’est pas relié à la fiche de votre société. C’est un rattachement à faire de notre côté, pas une manipulation de la vôtre : écrivez à votre Account Manager, l’opération prend quelques minutes.`}
        illustration={<FormeCourbe />}
        action={
          <Bouton href="/entreprise" apparence="plein">
            Revenir au tableau de bord
          </Bouton>
        }
      />
    </CadreEcran>
  );
}
