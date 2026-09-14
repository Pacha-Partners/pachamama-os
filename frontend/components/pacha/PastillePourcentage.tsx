import { cn } from '@/lib/utils';

/**
 * PastillePourcentage — la répartition d'un poste, axe par axe.
 *
 * `Percentage block` du Figma de la fiche d'offre
 * (docs/Figma-css/Job_board_détails.md:3417) : un libellé au-dessus, un disque
 * chiffré en dessous, gouttière 6px.
 *
 * Le disque fait 66px, filet noir de 1.5px, ombre rétro -3px — c'est
 * `--ombre-3`, la même que les boutons et les cartes ; la signature de marque
 * s'applique ici à un cercle, pas à un rectangle, et rien d'autre ne change.
 * Le libellé est en `--encre-500`, le chiffre en display gras.
 *
 * ZÉRO EST UNE VALEUR, PAS UNE ABSENCE. Un poste à « 0% Management » dit
 * quelque chose de précis, et la maquette l'affiche. C'est au domaine de
 * décider si le bloc entier existe — `scorecardDe` rend `null` quand les cinq
 * axes sont vides ; ce composant, lui, affiche toujours ce qu'on lui donne.
 *
 * Le filet de 1.5px n'a pas de jeton : l'échelle du design system s'arrête à
 * 1px et 2px. Consigné plutôt que remplacé par un voisin — un cercle de 66px
 * ne porte pas le même filet qu'une carte.
 */
export function PastillePourcentage({
  libelle,
  pourcentage,
  className,
}: {
  libelle: string;
  /** Un entier de 0 à 100. Affiché tel quel, suffixé d'un `%`. */
  pourcentage: number;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-1.5', className)}>
      <span className="t-body-hl text-center text-[var(--encre-500)]">{libelle}</span>
      <span
        className={cn(
          'flex size-[66px] shrink-0 items-center justify-center rounded-full',
          'border-[1.5px] border-black bg-[var(--fond-carte)]',
          'shadow-[var(--ombre-3)]',
          't-h3',
        )}
      >
        {pourcentage}%
      </span>
    </div>
  );
}
