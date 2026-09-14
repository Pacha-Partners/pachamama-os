import { Bouton } from '@/components/pacha/Bouton';
import { Carte } from '@/components/pacha/Carte';
import { EtatVide } from '@/components/pacha/EtatVide';
import { FormeDoubleEllipse } from '@/components/pacha/Illustration';
import { CadreEcran, EnteteEcran } from '@/components/vues/talent/atomes';

/**
 * QUAND `api.ma_fiche` NE REND RIEN, CE N'EST PAS UN 404.
 *
 * Trois causes, toutes réelles :
 *
 *   · le compte porte l'accès `talent` mais aucune `fiche_talent_id` dans
 *     `app.acces` — l'équivalent des 341 comptes entreprise sans rattachement
 *     que la reprise a laissés ;
 *   · son accès talent n'est plus actif : `api.ma_fiche` porte depuis
 *     `20260913084000` une garde de portail en plus du filtre sur la fiche.
 *     Effet mesuré aujourd'hui : nul — 0 compte a une fiche sans accès talent
 *     actif — mais la garde est là et il faut savoir la lire ;
 *   · la fiche a été désactivée après une demande de suppression. Dans ce cas
 *     `actif` est faux mais la vue rend quand même la ligne : ce n'est donc PAS
 *     ce chemin-ci.
 *
 * L'adresse est bonne, la page existe, c'est le RATTACHEMENT qui manque. On
 * rend donc l'écran avec son explication, et non « page introuvable », qui
 * enverrait la personne chercher une faute dans son lien.
 */
export function SansFiche({ objet }: { objet: string }) {
  return (
    <CadreEcran>
      <EnteteEcran
        descriptif="Votre espace"
        impact="Pachamama"
        chapeau="Votre compte est bien reconnu, mais il n’est pas encore relié à un dossier candidat."
      />
      <Carte regime="travail" className="p-2">
        <EtatVide
          titre={`Nous n’avons pas encore ${objet}`}
          description="Votre accès existe, mais aucun dossier candidat n’y est rattaché. C’est une opération que nous faisons de notre côté : dites-le à la personne qui vous a ouvert cet accès, elle relie les deux en une minute."
          illustration={<FormeDoubleEllipse />}
          action={
            <Bouton href="/talent/offres" apparence="contour">
              Voir les offres en attendant
            </Bouton>
          }
        />
      </Carte>
    </CadreEcran>
  );
}
