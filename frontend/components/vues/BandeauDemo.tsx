import Link from 'next/link';

/**
 * Bandeau de démonstration.
 *
 * Les trois portails privés sont derrière authentification, et leur donnée est
 * cloisonnée au niveau de la base par des policies PostgreSQL — pas par une
 * condition dans le code applicatif. Les rendre publics reviendrait à défaire
 * précisément ce qui les protège.
 *
 * Ces routes de démonstration rendent donc les MÊMES composants de vue que les
 * routes privées, alimentés par des données fictives. C'est ce qui permet de
 * montrer l'interface sans distribuer d'identifiants ni exposer la donnée
 * réelle.
 *
 * Le bandeau n'est pas une précaution juridique : il évite qu'un visiteur prenne
 * des chiffres inventés pour des chiffres du cabinet. Il est donc affirmatif et
 * placé avant le contenu, pas relégué en pied de page.
 */
export function BandeauDemo({ vue }: { vue: string }) {
  return (
    <div
      role="note"
      className="border-b-2 border-black bg-[var(--people-200)] px-6 py-3 md:px-8"
    >
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-3 gap-y-1">
        <span className="t-caption-bold shrink-0 rounded-[var(--r-sm)] border border-black bg-white px-2 py-0.5">
          Démonstration
        </span>
        <p className="t-caption text-black">
          {vue} — <strong className="t-caption-bold">données fictives</strong>. La version
          authentifiée lit la base réelle, cloisonnée par entreprise au niveau de PostgreSQL.
        </p>
        <Link href="/" className="t-caption-hl ml-auto shrink-0 underline">
          Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}
