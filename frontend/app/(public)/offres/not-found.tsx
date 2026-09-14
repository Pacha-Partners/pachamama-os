import { Bouton } from '@/components/pacha/Bouton';
import { EtatVide } from '@/components/pacha/EtatVide';
import { FormeCourbe } from '@/components/pacha/Illustration';

export const metadata = { title: 'Offre introuvable | Pachamama', robots: { index: false } };

/**
 * Le 404 du job board — il couvre `/offres/[id]`, qui appelle `notFound()`.
 *
 * ⚠ DEUX CAUSES, ET LA SECONDE EST LA FRÉQUENTE. `api.offre_detail` ne rend que
 * les mandats portant un acte de publication non retiré : sur les 533 mandats,
 * douze. Un lien vers une offre DÉPUBLIÉE rend donc zéro ligne, exactement
 * comme un identifiant inventé — et c'est voulu, une offre retirée doit
 * disparaître et non rester atteignable par son lien.
 *
 * Le texte doit donc couvrir les deux sans accuser le visiteur : « pourvu ou
 * retiré » est la formulation honnête, et elle dit quoi faire ensuite. Un
 * simple « page introuvable » enverrait chercher une faute dans un lien qui
 * était bon la semaine dernière.
 *
 * `robots: { index: false }` : le job board est la seule vue indexée du
 * produit, et une offre retirée ne doit pas y laisser une page morte.
 */
export default function Introuvable() {
  return (
    <main id="contenu" className="min-h-dvh bg-[var(--fond-page)] p-4 md:p-8">
      <div className="mx-auto w-full max-w-[720px] pt-10">
        <EtatVide
          titre="Cette offre n’est plus en ligne"
          description="Elle a été pourvue, ou le poste a été retiré. Nos autres offres ouvertes sont sur le job board — et si celle-ci vous intéressait, dites-le nous : nous ouvrons régulièrement des postes proches."
          illustration={<FormeCourbe />}
          action={
            <Bouton href="/offres" apparence="plein">
              Voir les offres ouvertes
            </Bouton>
          }
        />
      </div>
    </main>
  );
}
