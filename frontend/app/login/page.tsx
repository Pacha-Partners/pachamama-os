import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Carte } from '@/components/pacha/Carte';
import { Icone } from '@/components/pacha/Icone';
import { FormeEtoiles } from '@/components/pacha/Illustration';
import { LogoComplet } from '@/components/pacha/Logo';
import { Titre } from '@/components/pacha/Titre';
import { PanneauAuthentification } from '@/components/vues/PanneauAuthentification';
import { moiCourant, vueParDefaut } from '@/lib/acces';
import { cheminInterne } from '@/lib/suite';
import { utilisateurCourant } from '@/lib/session';

export const metadata = {
  title: 'Pachamama OS · connexion',
  description:
    'Se connecter à Pachamama OS, ou créer un compte candidat ou entreprise.',
};

/**
 * `/login` — la porte de l'application.
 *
 * C'est ici qu'aboutit quiconque ouvre le lien sans être connecté : la racine
 * et `/connexion` y renvoient, et le garde des routes privées aussi. Une seule
 * page à tenir, une seule à corriger.
 *
 * Un utilisateur identifié n'a rien à y faire — il part vers SA première vue,
 * décidée par `api.moi`, donc par `app.acces`. **Sauf s'il porte une `suite`** :
 * quelqu'un qui vient de cliquer « Postuler » sur une offre doit revenir SUR
 * l'offre, pas atterrir sur son tableau de bord. Voir `cheminInterne`.
 *
 * TROISIÈME CAS, et il est réel : authentifié, mais AUCUN compte ne porte cet
 * `auth_id`. C'est ce qui arrive à une inscription dont l'adresse n'a rencontré
 * personne dans le modèle. Rediriger cette session serait une boucle ; on
 * l'accueille donc ici, avec un mot qui dit ce qui manque et de quoi ressortir.
 *
 * La mise en page vient de la maquette : présentation à gauche, carte
 * d'authentification à droite, empilées sous `lg`.
 */
/**
 * Le lien d'une « porte » — le titre cliquable d'une des deux cartes
 * consultables sans compte. Écrit une seule fois : deux recettes jumelles
 * divergent au premier ajustement, et le soulignement est ici la seule chose
 * qui dit que c'est un lien.
 */
const LIEN_PORTE =
  't-h3 inline-flex w-fit items-center gap-2 text-black underline decoration-2 underline-offset-4 ' +
  'hover:decoration-[var(--violet-500)] focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-black';

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const suite = cheminInterne(params.suite);

  const moi = await moiCourant();
  // Déjà connecté ET porteur d'une destination : on y va directement. C'est le
  // cas de quelqu'un qui clique « Postuler » avec une session encore ouverte.
  if (moi) redirect(suite ?? vueParDefaut(moi) ?? '/talent');

  const sansAcces = Boolean(await utilisateurCourant());

  return (
    <main id="contenu" className="min-h-dvh">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-6 py-10 md:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-16">
        {/* ------------------------------------------- la colonne de présentation */}
        <section className="flex flex-col">
          <LogoComplet className="h-7 w-auto text-black" />

          <div className="relative mt-10">
            <FormeEtoiles
              aria-hidden="true"
              className="pointer-events-none absolute -top-6 right-0 hidden h-20 w-20 text-[var(--violet-200)] lg:block"
            />
            <Titre
              niveau={1}
              descriptif={suite ? 'Connectez-vous pour' : 'Faire du vivier de talents'}
              impact={suite ? 'poursuivre' : 'le moteur du collectif'}
            />
            <p className="t-body mt-4 max-w-[52ch] text-[var(--encre-600)]">
              {suite
                ? // On DIT ce qui se passera après, parce que la personne est
                  // arrivée ici au milieu d'un geste — cliquer « Postuler » — et
                  // qu'un écran de connexion muet lui ferait croire qu'elle
                  // l'a perdu.
                  'Vous reviendrez exactement là où vous étiez : votre candidature n’est pas perdue, il nous manque seulement de savoir qui vous êtes.'
                : 'Une base de talents unifiée, trois portails qui s’y adossent, et un agent de sourcing qui travaille sur la base entière. La donnée d’abord : on ne branche pas un moteur de rapprochement sur deux bases qui se contredisent.'}
            </p>
          </div>

          {/* ──────────────────────────────────────────────────────────────
              LES DEUX PORTES QUI NE DEMANDENT PAS DE COMPTE

              Le job board d'abord : c'est ce que vient chercher la plupart des
              gens qui atterrissent ici, et rien ne le disait — un écran de
              connexion sans issue renvoie chercher l'adresse du site ailleurs.
              Il est PUBLIC pour de vrai : `api.offre_publique` répond à la clé
              anonyme (12 offres mesurées le 14/09), et c'est seulement au
              moment de postuler qu'on demande qui vous êtes — le retour se
              fait alors sur l'offre, par `suite`.

              Le design system ensuite : la pièce qu'on montre pour juger
              l'interface, et elle n'expose aucune donnée.

              ⚠ DES ICÔNES LUCIDE, PLUS L'ÉMOJI. La carte du design system
              portait un 🎨. Deux cartes jumelles doivent se ressembler, et le
              système a le composant — un émoji rend différemment sur chaque
              plateforme et n'hérite ni de la couleur ni de la graisse du
              texte à côté duquel il est posé.
              ────────────────────────────────────────────────────────────── */}
          <div className="mt-10 flex flex-col gap-4">
            <Carte regime="travail" className="flex flex-col gap-3 p-5">
              <Link href="/offres" className={LIEN_PORTE}>
                <Icone nom="icon-briefcase" className="size-5 shrink-0" />
                Voir les offres
              </Link>
              <p className="t-body text-[var(--encre-600)]">
                Les postes ouverts par le collectif, en Product, Tech et Sales, en CDI
                comme en freelance. Consultable sans compte : c’est au moment de
                postuler qu’on vous demande qui vous êtes.
              </p>
            </Carte>

            <Carte regime="travail" className="flex flex-col gap-3 p-5">
              <Link href="/design-system" className={LIEN_PORTE}>
                <Icone nom="icon-component" className="size-5 shrink-0" />
                Voir le design system
              </Link>
              <p className="t-body text-[var(--encre-600)]">
                Les 28 composants de l’interface, chacun dans tous ses états, avec les
                règles qui les gouvernent. Consultable sans compte.
              </p>
            </Carte>
          </div>

        </section>

        {/* ----------------------------------------- la carte d'authentification */}
        <section className="lg:pt-20">
          <Carte regime="accroche" rayon="lg" className="p-6 md:p-8">
            <PanneauAuthentification sansAcces={sansAcces} suite={suite} />
          </Carte>
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
