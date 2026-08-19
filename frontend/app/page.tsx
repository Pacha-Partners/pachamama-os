import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Carte } from '@/components/pacha/Carte';
import { FormeEtoiles } from '@/components/pacha/Illustration';
import { LogoComplet } from '@/components/pacha/Logo';
import { Titre, TitreSection } from '@/components/pacha/Titre';
import { rolesDe, utilisateurCourant } from '@/lib/session';

export const metadata = {
  title: 'Pachamama OS',
  description:
    "Le système d’information du collectif Pachamama : une base de talents unifiée, trois portails et un agent de sourcing.",
};

/**
 * Racine de l’application.
 *
 * Deux comportements, selon qu’un utilisateur est identifié ou non :
 *
 * — identifié, il est orienté vers SON portail. Le rôle est lu dans
 *   `app_metadata`, contrôlé côté serveur, et jamais dans `user_metadata` que
 *   l’utilisateur peut modifier lui-même ;
 * — anonyme, il voit cette page. C’est le changement par rapport à la version
 *   précédente, qui le redirigeait vers l’écran de connexion : une adresse
 *   publique qui n’affiche qu’un formulaire de connexion n’apprend rien à un
 *   visiteur, et le Job Board, lui, est destiné à être public et indexé.
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
    <main id="contenu" className="mx-auto max-w-[1000px] px-6 py-16 md:px-8">
      <header className="flex items-center justify-between gap-4">
        <LogoComplet className="h-7 w-auto text-black" />
        <Link
          href="/connexion"
          className="t-caption-hl rounded-[var(--r-sm)] border border-black px-3 py-2 hover:bg-[var(--violet-050)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        >
          Se connecter
        </Link>
      </header>

      <div className="relative mt-16">
        {/* Export NOMMÉ, pas `Illustration` : l’accès dynamique embarque les
            34 formes (119 Ko de tracés) même pour un seul ornement. Ici la
            forme est connue à l’écriture, donc elle est tree-shakable — 905 o. */}
        <FormeEtoiles className="pointer-events-none absolute -top-8 right-0 hidden h-24 w-24 text-[var(--violet-200)] md:block" />
        <Titre
          niveau={1}
          descriptif="Faire du vivier de talents"
          impact="le moteur du cabinet"
        />
        <p className="t-body mt-5 max-w-[58ch] text-[var(--encre-600)]">
          Pachamama est un collectif de recruteurs spécialisés Product, Tech et Sales.
          Sa valeur tient à la relation qu’il entretient avec les talents — et cette
          relation vivait jusqu’ici dans les têtes, et dans deux bases qui s’ignoraient.
          Pachamama OS la transforme en actif exploitable.
        </p>
      </div>

      <section aria-labelledby="etapes" className="mt-16">
        <h2 id="etapes" className="t-h2">
          Trois étapes, une seule dépendance
        </h2>
        <p className="t-body mt-3 max-w-[58ch] text-[var(--encre-600)]">
          L’ordre n’est pas une préférence, c’est une contrainte : on ne branche pas un
          moteur de rapprochement sur deux bases qui se contredisent, il hériterait de
          leurs contradictions et produirait des recommandations fausses avec assurance.
        </p>

        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          <Etape
            rang="01"
            titre="La base de talents unifiée"
            statut="réalisé"
            texte="Un enregistrement unique par personne, alimenté par les deux sources, où chaque champ conserve la trace de sa provenance. 30 829 enregistrements dorés, réconciliés et audités."
          />
          <Etape
            rang="02"
            titre="Les portails"
            statut="en cours"
            texte="Un Job Board public, un espace talent, un suivi anonymisé pour les entreprises clientes. Le design system est en place et vérifiable."
          />
          <Etape
            rang="03"
            titre="Le Chasseur de Talents"
            statut="conçu"
            texte="Un agent qui cible et qualifie sur la base entière, par rapprochement sémantique. Il propose, le recruteur décide."
          />
        </ol>
      </section>

      <section aria-labelledby="voir" className="mt-16">
        <h2 id="voir" className="t-h2">
          Ce qui est visible aujourd’hui
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <LienCarte
            href="/offres"
            titre="Le Job Board"
            texte="Les offres ouvertes, filtrables et accessibles sans compte. C’est la seule vue destinée à être indexée."
          />
          <LienCarte
            href="/design-system"
            titre="Le design system"
            texte="Chaque composant dans chacun de ses états, avec les règles qui le gouvernent. Un design system qu’on ne peut pas regarder n’est pas vérifiable."
          />
        </div>
        <p className="t-caption mt-6 text-[var(--encre-500)]">
          Les espaces talent, entreprise et recruteur sont derrière authentification :
          leur donnée est cloisonnée au niveau de la base, pas par une condition dans le
          code.
        </p>
      </section>

      <footer className="mt-20 border-t border-[var(--encre-100)] pt-6">
        <p className="t-caption text-[var(--encre-500)]">
          Pachamama OS — projet annuel, Bachelor Data &amp; Business Intelligence.
        </p>
      </footer>
    </main>
  );
}

/** Une étape, avec son statut réel — jamais « livré » pour ce qui ne l’est pas. */
function Etape({
  rang,
  titre,
  statut,
  texte,
}: {
  rang: string;
  titre: string;
  statut: 'réalisé' | 'en cours' | 'conçu';
  texte: string;
}) {
  // Le statut est porté par du TEXTE, et la couleur ne fait que le doubler :
  // une information d’avancement lisible du seul œil valide ne serait pas une
  // information.
  const teinte =
    statut === 'réalisé'
      ? 'bg-[var(--revenue-200)]'
      : statut === 'en cours'
        ? 'bg-[var(--people-200)]'
        : 'bg-[var(--encre-100)]';
  return (
    <li>
      <Carte regime="accroche" className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="t-caption-bold text-[var(--encre-400)]">{rang}</span>
          <span className={`t-caption-hl rounded-[var(--r-full)] px-2 py-0.5 text-black ${teinte}`}>
            {statut}
          </span>
        </div>
        <TitreSection>{titre}</TitreSection>
        <p className="t-caption text-[var(--encre-600)]">{texte}</p>
      </Carte>
    </li>
  );
}

function LienCarte({ href, titre, texte }: { href: string; titre: string; texte: string }) {
  return (
    <Link
      href={href}
      className="group rounded-[var(--r-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
    >
      <Carte regime="accroche" survol className="flex h-full flex-col gap-2 p-5">
        <div className="flex items-center gap-2">
          <TitreSection>{titre}</TitreSection>
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </div>
        <p className="t-caption text-[var(--encre-600)]">{texte}</p>
      </Carte>
    </Link>
  );
}
