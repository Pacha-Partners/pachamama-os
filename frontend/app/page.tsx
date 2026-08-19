import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Carte } from '@/components/pacha/Carte';
import { FormeEtoiles } from '@/components/pacha/Illustration';
import { LogoComplet } from '@/components/pacha/Logo';
import { Titre } from '@/components/pacha/Titre';
import { FormulaireConnexion } from '@/components/vues/FormulaireConnexion';
import { VERSION_DEPLOYEE } from '@/lib/config';
import { rolesDe, utilisateurCourant } from '@/lib/session';

export const metadata = {
  title: 'Pachamama OS · connexion',
  description:
    "Système d’information du collectif Pachamama : une base de talents unifiée, trois portails et un agent de sourcing.",
};

/**
 * Racine de l’application : l’écran de connexion.
 *
 * Un utilisateur identifié n’a rien à faire ici — il est orienté vers SON
 * portail. Le rôle est lu dans `app_metadata`, contrôlé côté serveur, et jamais
 * dans `user_metadata` que l’utilisateur peut modifier lui-même.
 *
 * Pour tout le monde d’autre, cette page a deux fonctions à tenir en même temps,
 * et c’est ce qui dicte sa mise en page en deux colonnes : offrir la connexion
 * réelle à ceux qui ont un compte, et expliquer à un évaluateur pourquoi il n’en
 * recevra pas — puis l’envoyer là où il peut réellement voir le produit.
 */
export default async function Racine() {
  const utilisateur = await utilisateurCourant();

  if (utilisateur) {
    const roles = rolesDe(utilisateur);
    if (roles.includes('admin')) redirect('/backoffice');
    if (roles.includes('recruteur')) redirect('/recruteur');
    if (roles.includes('entreprise')) redirect('/entreprise');
    redirect('/talent');
  }

  return (
    <main id="contenu" className="min-h-dvh">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-6 py-10 md:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-16">
        {/* ---------------------------------------------- colonne de présentation */}
        <section className="flex flex-col">
          <LogoComplet className="h-7 w-auto text-black" />

          <div className="relative mt-10">
            <FormeEtoiles
              aria-hidden="true"
              className="pointer-events-none absolute -top-6 right-0 hidden h-20 w-20 text-[var(--violet-200)] lg:block"
            />
            <Titre niveau={1} descriptif="Faire du vivier de talents" impact="le moteur du cabinet" />
            <p className="t-body mt-4 max-w-[52ch] text-[var(--encre-600)]">
              Une base de talents unifiée, trois portails qui s’y adossent, et un agent
              de sourcing qui travaille sur la base entière. La donnée d’abord : on ne
              branche pas un moteur de rapprochement sur deux bases qui se contredisent.
            </p>
          </div>

          {/* ------------------------------------- l’avertissement sur les données */}
          <Carte
            regime="accroche"
            className="mt-10 flex flex-col gap-4 border-2 bg-[var(--people-100)] p-5"
          >
            <div className="flex items-start gap-2">
              <span aria-hidden="true" className="text-lg leading-none">
                🔒
              </span>
              <div>
                <h2 className="t-h3">Découvrir l’application</h2>
                <p className="t-caption mt-2 text-black">
                  Pachamama OS s’appuie sur une base qui réunit{' '}
                  <strong className="t-caption-bold">30&nbsp;829 profils de candidats réels</strong>
                  {' '}: coordonnées, prétentions, notes prises par les recruteurs. Protéger
                  ces données fait partie du projet : les accès à la base ne sont donc pas
                  diffusés, et le code livré documente les variables d’environnement
                  attendues sans leurs valeurs.
                </p>
                <p className="t-caption mt-2 text-black">
                  Une <strong className="t-caption-bold">version de démonstration</strong>{' '}
                  est prévue pour cela : les mêmes écrans et les mêmes composants,
                  alimentés par des données fictives. Aucun compte n’est nécessaire.
                </p>
              </div>
            </div>

            {/* Lien ABSOLU vers la version déployée, et non vers une route
                locale : cette copie du code est un instantané figé au rendu,
                tandis que la version en ligne continue d'évoluer. Envoyer le
                lecteur vers l'application qui fonctionne vaut mieux que vers
                un écran local qui n'est pas encore terminé. */}
            <a
              href={VERSION_DEPLOYEE}
              className="t-body-hl inline-flex items-center justify-center gap-2 rounded-[var(--r-sm)] border-2 border-black bg-black px-4 py-2.5 text-white shadow-[var(--ombre-3)] transition-shadow hover:shadow-[var(--ombre-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              Accéder à la version de démonstration
              <span aria-hidden="true">→</span>
            </a>
          </Carte>

          <p className="t-caption mt-6 text-[var(--encre-600)]">
            <Link
              href="/design-system"
              className="t-body-hl inline-flex items-center gap-1.5 text-black underline decoration-2 underline-offset-2 hover:decoration-[var(--violet-500)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              <span aria-hidden="true">🎨</span> Voir le design system
            </Link>
            <span className="mt-1 block">
              Les 25 composants de l’interface, chacun dans tous ses états, avec les
              règles qui les gouvernent. Consultable sans compte.
            </span>
          </p>
        </section>

        {/* --------------------------------------------- colonne de connexion */}
        <section aria-labelledby="titre-connexion" className="lg:pt-20">
          <Carte regime="accroche" className="border-2 p-6 md:p-8">
            <h2 id="titre-connexion" className="t-h2">
              Connexion
            </h2>
            <p className="t-caption mt-1 mb-6 text-[var(--encre-500)]">
              Réservée aux talents suivis par le cabinet, aux entreprises clientes et aux
              recruteurs.
            </p>
            <FormulaireConnexion versionDeployee={VERSION_DEPLOYEE} />
          </Carte>

          <p className="t-caption mt-4 text-[var(--encre-500)]">
            L’autorisation ne vit pas dans ce formulaire : elle vit dans les policies
            PostgreSQL. Un compte connecté ne voit que ce que la base l’autorise à voir,
            et non ce que l’interface accepte de lui afficher.
          </p>
        </section>
      </div>

      <footer className="mx-auto max-w-[1180px] border-t border-[var(--encre-100)] px-6 py-6 md:px-8">
        <p className="t-caption text-[var(--encre-500)]">
          Pachamama OS · projet annuel, Bachelor Data &amp; Business Intelligence.
        </p>
      </footer>
    </main>
  );
}
