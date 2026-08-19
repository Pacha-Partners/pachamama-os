import { Separator } from '@base-ui/react/separator';

import { cn } from '@/lib/utils';

/**
 * Divider — le seul séparateur du Figma, et il est plus discret qu'on ne croit.
 *
 * Relevé 16 fois, toujours identique : un conteneur de hauteur 0 qui étire une
 * ligne de `1px solid #F1F0F5` sur toute la largeur disponible
 * (Figma.md:35394 pour le conteneur, Figma.md:35414 pour le trait). #F1F0F5 est
 * `--encre-050`, c'est-à-dire le gris de FOND de l'échelle, pas son gris de
 * bordure (`--encre-100`, #E7E6EB). Le Figma choisit donc délibérément le trait
 * le plus faible dont il dispose : dans une interface qui porte déjà des
 * bordures noires de 2px, un séparateur interne doit se faire oublier.
 *
 * Le composant ne porte AUCUNE marge : dans le Figma il est un enfant d'auto
 * layout et c'est le `gap` du parent qui l'espace (Figma.md:35405 `order: 1`).
 * Reproduire une marge ici doublerait l'espacement partout.
 *
 * Vertical : le Figma ne définit pas de variante verticale du composant, mais il
 * utilise deux fois un séparateur vertical à la main — `border-left: 1px solid
 * #F1F0F5` sur le bloc utilisateur de l'en-tête (Figma.md:11695) et un `Line 1`
 * de `1px solid #E7E6EB` haut de 24px dans le bascule Kanban/Dashboard
 * (Figma.md:8949). On retient la couleur du bloc utilisateur, qui est celle du
 * composant horizontal : un design system n'a pas deux gris de séparation.
 *
 * `Separator` de Base UI apporte `role="separator"` et `aria-orientation` — un
 * trait purement décoratif n'aurait pas besoin d'être annoncé, mais un
 * séparateur qui découpe une liste d'informations en groupes, si.
 */
export function Divider({
  orientation = 'horizontal',
  className,
}: {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}) {
  return (
    <Separator
      orientation={orientation}
      className={cn(
        'shrink-0 bg-[var(--encre-050)]', // Figma.md:35414 — 1px solid #F1F0F5
        orientation === 'horizontal'
          ? 'h-px w-full' // Figma.md:35402 — height: 0px, largeur étirée
          : 'w-px self-stretch', // Figma.md:11695 — border-left du bloc « User »
        className,
      )}
    />
  );
}
