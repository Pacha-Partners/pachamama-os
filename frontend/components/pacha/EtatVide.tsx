import { cn } from '@/lib/utils';

/**
 * EtatVide — le composant que le Figma ne contient PAS.
 *
 * Il faut le dire d'emblée, parce que c'est la seule chose honnête à écrire ici :
 * j'ai cherché un état vide dans le Figma et il n'y en a aucun. Le calque
 * `Empty container` (Figma.md:973, 1051, 4125, 4203) est un faux ami — c'est la
 * case VIDE du calendrier, un rectangle de 22×24 sans contenu qui bouche les
 * jours hors du mois. Aucun `Empty state`, aucun « Aucun résultat », aucune
 * illustration d'état vide ne figure dans l'export.
 *
 * Ce composant n'a donc AUCUNE cote relevée. Il est assemblé à partir de ce que
 * le design system fournit déjà — échelle typographique, `Bouton`, `Illustration`
 * — et son espacement est un choix, pas un relevé. Consigné comme tel dans
 * ds-jetons-manquants-lot5.md ; à confronter au Figma dès qu'un écran vide y sera
 * dessiné.
 *
 * CE QU'UN ÉTAT VIDE DOIT FAIRE. Un écran vide qui dit seulement « vide » laisse
 * l'utilisateur se demander s'il a mal cherché ou si l'outil est cassé. D'où la
 * structure imposée : un titre qui nomme ce qui manque, une phrase qui dit
 * pourquoi, et — quand il y a quelque chose à faire — une action. `action` est
 * optionnelle parce qu'un résultat de recherche vide n'a pas d'action : effacer
 * le filtre appartient au filtre.
 *
 * L'illustration se passe en `ReactNode` plutôt qu'en nom de forme : les formes
 * disponibles (`Property 1={Sparkles, Stars, 2 lines round, Graph…}`,
 * Figma.md:58459+) appartiennent au lot 1 et je ne veux pas figer ici un nom de
 * forme que je n'ai pas vu typé. L'appelant écrit donc
 * `illustration={<Illustration forme="…" />}`.
 */
export function EtatVide({
  titre,
  description,
  illustration,
  action,
  className,
}: {
  /** Ce qui manque, nommé. « Aucune offre pour ce mandat », pas « Vide ». */
  titre: string;
  /** Pourquoi c'est vide, et ce qui se passera ensuite. */
  description?: string;
  /** `<Illustration forme="…" />` du lot 1. Purement décoratif. */
  illustration?: React.ReactNode;
  /** Un `<Bouton>` du lot 3, quand il y a une suite à donner. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-10 text-center',
        className,
      )}
    >
      {illustration && (
        // Décorative : le sens est déjà dans le titre juste en dessous. Si le
        // lot 1 lui passe un `titre`, elle redeviendra annoncée — d'où le
        // `aria-hidden` porté par l'enveloppe et non par l'illustration.
        <span aria-hidden="true" className="[&>*]:size-16">
          {illustration}
        </span>
      )}
      <p className="t-h3 text-black">{titre}</p>
      {description && (
        <p className="t-body max-w-[46ch] text-[var(--encre-600)]">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
