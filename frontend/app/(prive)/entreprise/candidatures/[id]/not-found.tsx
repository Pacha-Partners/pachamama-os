import { Bouton } from '@/components/pacha/Bouton';
import { EtatVide } from '@/components/pacha/EtatVide';
import { FormeCourbe } from '@/components/pacha/Illustration';

export const metadata = { title: 'Profil introuvable' };

/**
 * Le 404 d'un profil.
 *
 * DEUX CAUSES, UN SEUL TEXTE, et il faut qu'il couvre les deux honnêtement :
 * soit la candidature n'existe pas, soit elle ne vous a jamais été présentée.
 * Le second cas est LE cas fréquent — six étapes sur quatorze sont visibles du
 * client, et un profil écarté avant le send-out n'apparaît nulle part de votre
 * côté. Renvoyer « introuvable » sans l'expliquer laisserait croire à une
 * perte de données.
 */
export default function Introuvable() {
  return (
    <div className="mx-auto w-full max-w-[1180px] pt-2">
      <EtatVide
        titre="Ce profil n’est pas dans votre espace"
        description="Lien ancien, ou profil qui ne vous a pas été présenté."
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
