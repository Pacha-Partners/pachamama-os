'use client';

import { cn } from '@/lib/utils';

/**
 * Liste / ListeItem — la ligne de liste générique, celle des panneaux et des
 * listes d'options.
 *
 * COTES DU FIGMA. Le conteneur `List items` est une colonne de `padding: 4px`,
 * `gap: 8px` (Figma.md:15014-15022). Chaque `List item` est une ligne de
 * `padding: 8px`, `gap: 10px`, hauteur 35, rayon 4 (Figma.md:15034-15050). L'état
 * sélectionné n'est pas une variante nommée : dans le Figma, le premier item
 * porte `background: #F8F5FF` et les trois autres rien (Figma.md:15048 contre
 * Figma.md:15092). #F8F5FF est `--violet-050`, décrit dans app.css comme le
 * « fond de zone active très léger » — la lecture tient.
 *
 * Le libellé est en `Body/Regular` noir (Figma.md:15060-15069). Le Figma l'écrit
 * en 'Abhaya Libre', une substitution accidentelle déjà arbitrée par app.css :
 * Host Grotesk partout, donc `t-body`.
 *
 * RÉGIME DE SURFACE. Une liste, ça se parcourt : régime « travail ». Pas de
 * bordure noire, pas d'ombre rétro, un fond de sélection très pâle. C'est
 * exactement ce que dit le Figma, et c'est ce qui permet d'empiler trente lignes
 * sans que l'écran devienne un damier.
 *
 * SÉMANTIQUE. `<ul>` / `<li>` : un lecteur d'écran annonce alors « liste, 4
 * éléments », ce qu'une pile de `<div>` ne fait pas. Quand `onClic` est fourni, la
 * ligne devient un vrai `<button>` porteur de `aria-pressed` — c'est la bonne
 * sémantique pour une ligne qu'on active ou désactive.
 *
 * Ce composant n'est PAS une liste déroulante : une `listbox` ou une `combobox`
 * (curseur roulant, `aria-activedescendant`, filtrage) appartient au lot des
 * champs et doit s'appuyer sur `Select`/`Combobox` de Base UI. Utiliser `Liste`
 * pour ça donnerait une liste d'options muette au clavier.
 */
export function Liste({
  children,
  className,
  ...reste
}: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn(
        'flex flex-col gap-2 p-1', // Figma.md:15020 — gap 8, padding 4
        className,
      )}
      {...reste}
    >
      {children}
    </ul>
  );
}

export function ListeItem({
  selectionne,
  onClic,
  desactive,
  children,
  className,
}: {
  selectionne?: boolean;
  onClic?: () => void;
  desactive?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const contenu = cn(
    'flex w-full items-center gap-2.5 px-2 py-2 text-left', // Figma.md:15040 — padding 8, gap 10
    'min-h-[35px] rounded-[var(--r-xs)]', // Figma.md:15045 — height 35, radius 4
    't-body text-black',
    selectionne && 'bg-[var(--violet-050)]', // Figma.md:15048 — #F8F5FF
    !selectionne && !desactive && onClic && 'hover:bg-[var(--violet-050)]',
    desactive && 'cursor-not-allowed text-[var(--encre-300)]',
    className,
  );

  if (!onClic) {
    return <li className={contenu}>{children}</li>;
  }
  return (
    // `display: contents` casserait l'annonce de la liste sur certaines aides
    // techniques : on garde un <li> réel, sans style, et le bouton s'étire.
    <li>
      <button
        type="button"
        onClick={onClic}
        disabled={desactive}
        aria-pressed={selectionne}
        className={contenu}
      >
        {children}
      </button>
    </li>
  );
}

/**
 * ItemContenuCarte — la ligne de détail d'une carte (`Card content Item`).
 *
 * Cotes : ligne, `padding: 4px`, `gap: 10px`, rayon 4, hauteur 23
 * (Figma.md:6875-6890). Texte en 12/15 demi-gras → `t-caption-hl`.
 *
 * Le Figma donne deux teintes à ce texte selon le rôle de la ligne :
 * `#5022C3` = `--violet-700` pour une mention mise en avant
 * (« Open to work… », Figma.md:6903) et `#ADABB3` = `--encre-250` pour une
 * précision secondaire (« Prétentions : 90K - 180K », Figma.md:6944). D'où
 * `ton`, qui nomme les deux rôles plutôt que les deux couleurs.
 *
 * `--violet-700` sur blanc mesure 8,91:1 — c'est la seule teinte de la rampe
 * violette qui porte du texte sans réserve.
 */
export function ItemContenuCarte({
  ton = 'secondaire',
  children,
  className,
}: {
  ton?: 'mise-en-avant' | 'secondaire';
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        't-caption-hl flex items-start gap-2.5 rounded-[var(--r-xs)] p-1', // Figma.md:6877 — padding 4, gap 10, radius 4
        ton === 'mise-en-avant'
          ? 'text-[var(--violet-700)]' // Figma.md:6903 — #5022C3
          : 'text-[var(--encre-250)]', // Figma.md:6944 — #ADABB3
        className,
      )}
    >
      {children}
    </p>
  );
}
