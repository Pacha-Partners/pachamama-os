'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Infobulle — l'habillage Pachamama du `Tooltip` de shadcn.
 *
 * On n'écrit pas le comportement : `components/ui/tooltip.tsx` s'appuie sur
 * Base UI, qui gère déjà l'ouverture au survol ET au focus clavier, la fermeture
 * à Échap, le portail et le positionnement. Réécrire ça produirait une infobulle
 * qui ne s'ouvre qu'à la souris, c'est-à-dire une infobulle inaccessible.
 *
 * COTES DU FIGMA (Figma.md:21599) :
 *   contenu   `padding: 8px 12px`, `background: #101828`, `border-radius: 8px`
 *             (Figma.md:21615-21636)
 *   texte     `Caption/Bold` — Host Grotesk 700, 12/16, centré, blanc
 *             (Figma.md:21648-21660) → `t-caption-bold`
 *   flèche    12×12 tournée de 45°, même fond, rayon 1px (Figma.md:21686-21697)
 *   ombre     `0px 2px 8px -2px rgba(0,0,0,0.08)` (Figma.md:21609) — c'est
 *             exactement `--ombre-portee`. Ce flou n'enfreint pas la règle
 *             « l'ombre rétro n'est jamais floue » : l'ombre rétro est une
 *             signature de surface, celle-ci est une élévation d'élément
 *             flottant, et app.css l'a déjà arbitré ainsi.
 *
 * #101828 (« Gray/900 » du Figma) n'a pas de jeton : c'est un noir bleuté
 * étranger à l'échelle `--encre-*`. Consigné dans ds-jetons-manquants-lot5.md.
 *
 * ASTUCE D'HABILLAGE. La flèche est rendue à l'intérieur de `TooltipContent`,
 * qu'on n'a pas le droit de modifier, et elle est peinte avec `bg-foreground`.
 * On redéfinit donc `--foreground` et `--background` en style local sur le popup :
 * la flèche, qui en est un enfant, hérite de la variable et se teinte avec lui.
 * C'est ce qui permet de recolorer l'ensemble sans toucher au fichier shadcn.
 */
export function Infobulle({
  texte,
  cote = 'top',
  children,
  className,
}: {
  /** Le contenu de la bulle. Court : une bulle n'est pas une notice. */
  texte: React.ReactNode;
  cote?: 'top' | 'bottom' | 'left' | 'right';
  /**
   * L'élément déclencheur, en UN seul élément React. Il est utilisé tel quel
   * comme déclencheur (`render`) au lieu d'être enveloppé : envelopper dans un
   * `<span>` produirait une cible non focusable, ou un bouton dans un bouton.
   * Passe donc un élément déjà focusable — `<button>`, `<a>`, `<input>`.
   */
  children: React.ReactElement;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent
        side={cote}
        sideOffset={6}
        style={
          {
            // Recolore le popup ET sa flèche en une seule déclaration.
            '--foreground': '#101828', // Figma.md:21634 — Gray/900
            '--background': '#ffffff', // Figma.md:21659 — BW/White
          } as React.CSSProperties
        }
        className={cn(
          't-caption-bold text-center',
          'rounded-[var(--r-md)] px-3 py-2', // Figma.md:21622 — padding 8px 12px, rayon 8
          'shadow-[var(--ombre-portee)]', // Figma.md:21609 — Container/.elevation-2
          className,
        )}
      >
        {texte}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * À monter une fois, haut dans l'arbre. Base UI mutualise par ce fournisseur le
 * délai d'ouverture et le fait qu'une seule bulle soit ouverte à la fois.
 */
export { TooltipProvider as FournisseurInfobulle };
