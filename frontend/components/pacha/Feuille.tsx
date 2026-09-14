"use client";

import { Dialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import { BoutonIcone } from "./BoutonIcone";

/**
 * Feuille — la surface modale qui monte du bas de l'écran.
 *
 * ELLE N'EXISTE QU'EN MOBILE, et c'est une contrainte de conception, pas une
 * limite d'implémentation : en desktop les mêmes choix se font dans une liste
 * déroulante ancrée à son champ, qui laisse la page visible. Une feuille qui
 * couvre tout l'écran pour cocher trois cases y serait une régression.
 *
 * Cotes relevées sur `docs/Figma-css/Job_board_mobile.md`, calque « Modal » :
 * fond blanc, rayon 16px sur les DEUX COINS HAUTS seulement — elle est collée
 * au bas de l'écran et n'a donc pas de coins bas —, rembourrage 16px,
 * gouttière 16px, et `justify-content: space-between` qui plaque les actions en
 * bas quelle que soit la hauteur du contenu. Le voile est `rgba(0,0,0,0.5)`.
 *
 * `max-h-[85dvh]` n'est pas au Figma, qui fige la feuille à 453px pour une
 * liste de quatre univers. Une liste plus longue — les contrats, demain les
 * métiers — dépasserait l'écran et emporterait les boutons avec elle. La
 * hauteur est donc bornée et c'est la LISTE qui défile, jamais le pied.
 *
 * `dvh` et non `vh` : sur mobile la barre d'adresse se rétracte au défilement,
 * et `vh` fige la hauteur sur l'état déployé — la feuille dépassait alors du
 * bas de l'écran d'exactement la hauteur de cette barre.
 */
export function Feuille({
  titre,
  ouverte,
  onOuvertureChange,
  actions,
  focusFinal,
  children,
  className,
}: {
  /** Le titre, en Title/H3 centré — `Univers` sur la maquette. */
  titre: string;
  ouverte: boolean;
  onOuvertureChange: (ouverte: boolean) => void;
  /** Le pied : les boutons, plaqués en bas. Rangée en `space-between`. */
  actions?: React.ReactNode;
  /**
   * L'élément qui reprend le focus à la fermeture.
   *
   * À FOURNIR DÈS QUE LA FEUILLE N'EST PAS OUVERTE PAR UN `Dialog.Trigger`.
   * Base UI rend le focus à la référence qu'il connaît ; ouverte par un bouton
   * quelconque, il n'en a aucune, et le focus retombe sur le corps du document.
   * Au clavier, la tabulation suivante repart alors du haut de la page — le
   * lecteur perd sa place, sans rien pour le prévenir.
   */
  focusFinal?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={ouverte} onOpenChange={onOuvertureChange}>
      <Dialog.Portal>
        {/* Le voile — `rgba(0,0,0,0.5)` au Figma. Il ferme la feuille au clic,
            ce que Base UI câble seul. */}
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/50",
            // Même règle que la feuille : c'est l'état, pas l'animation, qui
            // décide de la disparition. Un voile resté en place bloquerait
            // toute la page.
            "data-[closed]:hidden",
            "transition-opacity duration-200",
            "data-[starting-style]:opacity-0",
            "motion-reduce:transition-none",
          )}
        />

        <Dialog.Popup
          finalFocus={focusFinal}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full flex-col justify-between gap-4",
            // `--r-lg`, « modales, panneaux » (app.css:98) — mappé sur
            // `rounded-xl`. Écrire `rounded-t-2xl` court-circuitait l'échelle
            // du design system pour retomber par hasard sur la même valeur.
            "rounded-t-xl bg-[var(--fond-carte)] p-4",
            // La zone sûre du bas : sur un téléphone à encoche, `bottom-0`
            // place la rangée d'actions sous la barre d'accueil du système.
            "pb-[calc(--spacing(4)+env(safe-area-inset-bottom))]",
            // Le Figma fige la feuille à 453px. C'est à la fois un plancher et
            // un plafond : sans le plancher, une liste de deux options donne
            // une feuille écrasée que rien ne distingue d'un bandeau. On garde
            // donc les deux, en bornant le plancher pour qu'il ne dépasse
            // jamais le plafond sur un petit écran.
            "max-h-[85dvh] min-h-[min(453px,85dvh)]",
            // Elle est faite pour un écran étroit — 320px au Figma. La borne
            // évite qu'un usage en desktop, ne serait-ce que la vitrine, ne
            // l'étire sur 1440px et ne donne à voir autre chose que le
            // composant. En mobile elle n'a aucun effet.
            "max-w-[520px]",
            "focus:outline-none",
            // LA FERMETURE NE DÉPEND PAS DE L'ANIMATION, et c'est délibéré.
            // Base UI laisse la surface montée après la fermeture, marque
            // `data-closed` / `data-ending-style`, et attend un `transitionend`
            // pour la démonter. Tant qu'aucune règle ne la masque, une feuille
            // fermée reste donc affichée : mesuré, `display: flex` et
            // `opacity: 1` après « Enregistrer ».
            //
            // On ne confie pas cette disparition à une transition de sortie.
            // Un `transitionend` peut ne jamais arriver — onglet en arrière-plan,
            // surface non composée, moteur qui saute l'animation — et la feuille
            // resterait alors ouverte par-dessus la page, ou pire, invisible
            // mais interactive. `data-closed:hidden` la ferme dans tous les cas.
            "data-[closed]:hidden",
            // L'ENTRÉE, elle, peut être animée sans risque : elle ne conditionne
            // rien. Le glissement vient du bas, le bord dont la feuille est
            // solidaire. Si la transition ne s'exécute pas, la feuille apparaît
            // simplement d'un coup — ce qui reste un état correct.
            "transition-[transform,opacity] duration-200 ease-out",
            "data-[starting-style]:translate-y-full data-[starting-style]:opacity-0",
            // Un mouvement de 271px imposé à qui a demandé moins d'animation est
            // exactement ce que ce réglage système existe pour éviter.
            "motion-reduce:transition-none motion-reduce:data-[starting-style]:translate-y-0",
            className,
          )}
        >
          <div className="flex min-h-0 flex-col gap-4">
            {/* Le titre est centré sur la LARGEUR DE LA FEUILLE, et la croix
                se superpose à droite plutôt que de partager une rangée avec
                lui : en `justify-between`, un titre long aurait poussé la croix
                hors de l'écran, et un titre court l'aurait décentré. */}
            <div className="relative flex items-center justify-center">
              <Dialog.Title className="t-h3">{titre}</Dialog.Title>
              {/* `BoutonIcone type="supprimer"` EST l'`icon-x` du Figma
                  (BoutonIcone.tsx:60, Figma.md:12609). Redessiner la croix à
                  la main aurait créé une seconde vérité sur un glyphe que le
                  design system possède déjà.

                  `-m-2 p-2` élargit la cible tactile à 40px sans déplacer le
                  glyphe : à 24px il tenait tout juste le minimum de la règle
                  2.5.8, ce qui est peu pour le pouce d'une main qui tient le
                  téléphone. La marge négative annule l'encombrement, donc le
                  titre reste centré sur la feuille. */}
              <Dialog.Close
                render={
                  <BoutonIcone
                    type="supprimer"
                    taille="lg"
                    libelle="Fermer"
                    className="absolute right-0 -m-2 box-content p-2"
                  />
                }
              />
            </div>

            {/* C'est ce bloc qui défile, pas la feuille : le pied doit rester
                atteignable même sur une liste de trente options. */}
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </div>

          {actions && (
            <div className="flex items-start justify-between gap-4">
              {actions}
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
