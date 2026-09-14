import { Bouton } from '@/components/pacha/Bouton';
import { EtatVide } from '@/components/pacha/EtatVide';
import { FormeCourbe } from '@/components/pacha/Illustration';

export const metadata = { title: 'Poste introuvable' };

/**
 * Le 404 d'un poste.
 *
 * IL DIT LA MÊME CHOSE POUR « CE POSTE N'EXISTE PAS » ET POUR « CE POSTE N'EST
 * PAS LE VÔTRE », et c'est délibéré. `api.mandat_client` est cloisonnée par
 * entreprise : distinguer les deux réponses apprendrait à un curieux qu'un
 * identifiant existe chez quelqu'un d'autre. Le texte est donc écrit pour
 * couvrir les deux sans mentir sur aucun.
 */
export default function Introuvable() {
  return (
    <div className="mx-auto w-full max-w-[1180px] pt-2">
      <EtatVide
        titre="Ce poste n’est pas dans votre espace"
        description="Lien ancien, ou poste d’un autre compte."
        illustration={<FormeCourbe />}
        action={
          <Bouton href="/entreprise" apparence="plein">
            Revenir à vos postes
          </Bouton>
        }
      />
    </div>
  );
}
