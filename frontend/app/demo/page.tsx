import { EST_VERSION_EN_LIGNE, VERSION_DEPLOYEE } from '@/lib/config';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Carte } from '@/components/pacha/Carte';
import { LogoComplet } from '@/components/pacha/Logo';
import { Titre, TitreSection } from '@/components/pacha/Titre';

export const metadata = {
  title: 'Version de démonstration',
  robots: { index: false, follow: false },
};

/* Le portail entreprise et le Chasseur de Talents ne sont pas encore écrits :
   ils ne figurent pas ici. Une carte qui mène à une page absente dessert la
   démonstration plus qu'une liste courte. */
const VUES = [
  {
    href: '/demo/talent',
    emoji: '🙋',
    titre: 'Espace talent',
    texte:
      'Le candidat voit son profil, ses attentes, l’état de ses candidatures et l’étape où il en est dans chaque process.',
  },
  {
    href: '/offres',
    emoji: '📣',
    titre: 'Job Board public',
    texte:
      'Les offres ouvertes, filtrables, indexables. C’est la seule vue destinée aux moteurs de recherche — et elle n’est pas une démonstration : elle est réelle.',
  },
];

/**
 * Le point d’entrée de la version de démonstration.
 *
 * Il existe pour une raison précise : sans lui, un évaluateur devrait deviner
 * les adresses des trois vues. Une démonstration qu’on ne trouve pas ne
 * démontre rien.
 */
export default function Demo() {
  // Instantané figé : cette vue n'est pas encore présentable. On renvoie vers
  // l'application en ligne plutôt que de montrer un écran incomplet.
  if (!EST_VERSION_EN_LIGNE) redirect(VERSION_DEPLOYEE);

  return (
    <main id="contenu" className="mx-auto max-w-[1000px] px-6 py-12 md:px-8">
      <div className="flex items-center justify-between gap-4">
        <LogoComplet className="h-6 w-auto text-black" />
        <Link href="/" className="t-caption-hl underline">
          Retour à la connexion
        </Link>
      </div>

      <div className="mt-12">
        <Titre niveau={1} descriptif="La version" impact="de démonstration" />
        <p className="t-body mt-4 max-w-[62ch] text-[var(--encre-600)]">
          Ces écrans rendent{' '}
          <strong className="t-body-bold">les mêmes composants de vue</strong> que les
          portails authentifiés — une seule implémentation, deux sources de données. Ici,
          ils sont alimentés par des <strong className="t-body-bold">données fictives</strong>.
        </p>
        <p className="t-caption mt-3 max-w-[62ch] text-[var(--encre-500)]">
          Les portails réels sont derrière authentification et leur donnée est cloisonnée
          par des policies PostgreSQL, pas par une condition dans le code. Les rendre
          publics reviendrait à défaire précisément ce qui les protège : c’est pourquoi
          la démonstration passe par des données inventées plutôt que par une porte
          ouverte.
        </p>
      </div>

      <ul className="mt-10 grid gap-4 md:grid-cols-2">
        {VUES.map((v) => (
          <li key={v.href}>
            <Link
              href={v.href}
              className="group block h-full rounded-[var(--r-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              <Carte regime="accroche" survol className="flex h-full flex-col gap-2 p-5">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true">{v.emoji}</span>
                  <TitreSection>{v.titre}</TitreSection>
                  <span
                    aria-hidden="true"
                    className="ml-auto transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </div>
                <p className="t-caption text-[var(--encre-600)]">{v.texte}</p>
              </Carte>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
