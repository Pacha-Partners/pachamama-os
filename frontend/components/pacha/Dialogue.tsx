'use client';

import { Dialog } from '@base-ui/react/dialog';
import { useRef } from 'react';

import { Bouton } from './Bouton';
import { BoutonIcone } from './BoutonIcone';
import { Icone } from './Icone';
import { cn } from '@/lib/utils';

/**
 * Dialogue — la surface modale du desktop.
 *
 * `Feuille` existe déjà, et c'est un BOTTOM SHEET MOBILE : elle monte du bas,
 * n'a de rayon que sur ses coins hauts, et son commentaire d'en-tête dit
 * explicitement qu'elle n'existe qu'en mobile parce qu'en desktop les mêmes
 * choix se font dans une liste ancrée à son champ. `Dialogue` est l'autre
 * moitié du besoin : ce qui doit INTERROMPRE — une confirmation, un formulaire
 * court, un aperçu qu'on referme.
 *
 * LES PARTIS PRIS DE `Feuille` SONT REPRIS TELS QUELS, parce qu'ils ne sont pas
 * des goûts mais des corrections de bogues mesurés :
 *
 * · `data-[closed]:hidden` — LA FERMETURE NE DÉPEND JAMAIS D'UNE ANIMATION.
 *   Base UI laisse la surface montée après la fermeture et attend un
 *   `transitionend` pour la démonter. Un `transitionend` peut ne jamais
 *   arriver (onglet en arrière-plan, moteur qui saute l'animation) : le
 *   dialogue resterait alors par-dessus la page, ou invisible mais interactif.
 * · `finalFocus` — À FOURNIR dès que le dialogue n'est pas ouvert par un
 *   `Dialog.Trigger`. Sans référence, le focus retombe sur le corps du
 *   document, et la tabulation suivante repart du haut de la page.
 * · L'entrée peut être animée sans risque : si la transition ne s'exécute pas,
 *   le dialogue apparaît d'un coup, ce qui reste un état correct.
 *
 * TROIS LARGEURS, pas plus. Elles vivent dans `app.css` §8 bis
 * (`--largeur-dialogue-sm/md/lg`) et sont bornées par la mesure du texte, pas
 * par des paliers d'écran. Un dialogue n'est jamais plein écran : il doit
 * laisser voir ce qu'il interrompt, sinon c'est une page.
 */

export type TailleDialogue = 'sm' | 'md' | 'lg';

const LARGEURS: Record<TailleDialogue, string> = {
  sm: 'max-w-[var(--largeur-dialogue-sm)]',
  md: 'max-w-[var(--largeur-dialogue-md)]',
  lg: 'max-w-[var(--largeur-dialogue-lg)]',
};

export type ProprietesDialogue = {
  titre: string;
  /**
   * Une phrase sous le titre, rendue en `Dialog.Description` : Base UI la lie
   * au dialogue par `aria-describedby`, donc elle est annoncée à l'ouverture,
   * avant que le lecteur n'explore le contenu.
   */
  description?: string;
  ouvert: boolean;
  onOuvertureChange: (ouvert: boolean) => void;
  /** Le pied. Une rangée de `Bouton`, alignée à droite. */
  actions?: React.ReactNode;
  taille?: TailleDialogue;
  /** L'élément qui reprend le focus à la fermeture. Voir le commentaire d'en-tête. */
  focusFinal?: React.RefObject<HTMLElement | null>;
  /**
   * L'élément qui reçoit le focus à l'ouverture. Par défaut Base UI focalise le
   * dialogue. À renseigner quand le premier geste attendu est une saisie.
   */
  focusInitial?: React.RefObject<HTMLElement | null>;
  /** Masque la croix. Réservé aux dialogues dont la sortie passe par une action. */
  sansFermeture?: boolean;
  children?: React.ReactNode;
  className?: string;
};

export function Dialogue({
  titre,
  description,
  ouvert,
  onOuvertureChange,
  actions,
  taille = 'md',
  focusFinal,
  focusInitial,
  sansFermeture = false,
  children,
  className,
}: ProprietesDialogue) {
  return (
    <Dialog.Root open={ouvert} onOpenChange={onOuvertureChange}>
      <Dialog.Portal>
        <VoileDialogue />
        <Dialog.Popup
          finalFocus={focusFinal}
          initialFocus={focusInitial}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4',
            LARGEURS[taille],
            // `--r-lg` : « modales, panneaux » (app.css §5). Régime de surface
            // « accroche » — filet noir 2px et ombre rétro : c'est ce que le
            // système réserve à ce qui se regarde, et un dialogue ne fait que ça.
            'rounded-[var(--r-lg)] border-2 border-black bg-[var(--fond-carte)] p-6 shadow-[var(--ombre-6)]',
            // Le dialogue ne dépasse jamais l'écran ; c'est son CORPS qui
            // défile, pour que titre et actions restent atteignables.
            'max-h-[calc(100dvh-4rem)]',
            'focus:outline-none',
            'data-[closed]:hidden',
            'transition-[transform,opacity] duration-150 ease-out',
            'data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0',
            'motion-reduce:transition-none motion-reduce:data-[starting-style]:scale-100',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <Dialog.Title className="t-h3">{titre}</Dialog.Title>
              {description && (
                <Dialog.Description className="t-body text-[var(--encre-600)]">
                  {description}
                </Dialog.Description>
              )}
            </div>
            {!sansFermeture && (
              // `BoutonIcone type="supprimer"` EST la croix du système
              // (Figma.md:12609). `-m-2 p-2` élargit la cible à 40px sans
              // déplacer le glyphe ni décaler le titre.
              <Dialog.Close
                render={
                  <BoutonIcone
                    type="supprimer"
                    taille="lg"
                    libelle="Fermer"
                    className="-m-2 box-content shrink-0 p-2"
                  />
                }
              />
            )}
          </div>

          {children && <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>}

          {actions && <div className="flex items-center justify-end gap-3">{actions}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Le voile, commun aux deux variantes. Même règle de fermeture que la feuille. */
function VoileDialogue() {
  return (
    <Dialog.Backdrop
      className={cn(
        'fixed inset-0 z-50 bg-black/50',
        'data-[closed]:hidden',
        'transition-opacity duration-150',
        'data-[starting-style]:opacity-0',
        'motion-reduce:transition-none',
      )}
    />
  );
}

/**
 * DialogueConfirmation — « êtes-vous sûr ? », en mieux.
 *
 * QUATRE RÈGLES, chacune contre une erreur courante :
 *
 * 1. LE BOUTON NOMME L'ACTE. « Supprimer la note », pas « OK ». Un lecteur
 *    d'écran annonce les boutons hors contexte quand on tabule : « OK » et
 *    « Annuler » côte à côte ne disent rien de ce qu'on est en train de faire.
 *    D'où `libelleConfirmation`, obligatoire.
 *
 * 2. LE FOCUS PART SUR « ANNULER » quand l'action est destructive. Le geste
 *    réflexe — Entrée — doit alors être celui qui ne casse rien. Sur une
 *    confirmation anodine, le focus part sur l'action : c'est l'inverse, et
 *    c'est voulu.
 *
 * 3. `role="alertdialog"`. Base UI rend `role="dialog"`, correct pour un
 *    formulaire, insuffisant ici : `alertdialog` fait annoncer le message
 *    immédiatement, sans attendre que l'utilisateur explore la surface.
 *
 * 4. LE DESTRUCTIF NE SE SIGNALE PAS PAR LA COULEUR DU BOUTON. La règle dure du
 *    système est que la couleur d'action est le noir ; peindre un bouton en
 *    rouge introduirait une seconde couleur d'action et laisserait le daltonien
 *    sans indice. Le signal passe donc par trois choses redondantes : le
 *    triangle d'alerte, le filet `--marker-red` le long du message, et le
 *    libellé du bouton qui nomme la perte.
 */
export function DialogueConfirmation({
  titre,
  message,
  libelleConfirmation,
  libelleAnnulation = 'Annuler',
  destructif = false,
  ouvert,
  onOuvertureChange,
  onConfirmer,
  enCours = false,
  focusFinal,
}: {
  titre: string;
  /** Ce qui va se passer, et ce qui sera perdu. Une ou deux phrases. */
  message: React.ReactNode;
  /** Le libellé du bouton d'action. DOIT nommer l'acte. */
  libelleConfirmation: string;
  libelleAnnulation?: string;
  /** L'action détruit quelque chose d'irrécupérable. Change le focus initial. */
  destructif?: boolean;
  ouvert: boolean;
  onOuvertureChange: (ouvert: boolean) => void;
  onConfirmer: () => void;
  /** L'action est en cours : les deux boutons se figent. */
  enCours?: boolean;
  focusFinal?: React.RefObject<HTMLElement | null>;
}) {
  const refAnnuler = useRef<HTMLButtonElement>(null);
  const refConfirmer = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root open={ouvert} onOpenChange={onOuvertureChange}>
      <Dialog.Portal>
        <VoileDialogue />
        <Dialog.Popup
          role="alertdialog"
          finalFocus={focusFinal}
          initialFocus={destructif ? refAnnuler : refConfirmer}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4',
            LARGEURS.sm,
            'rounded-[var(--r-lg)] border-2 border-black bg-[var(--fond-carte)] p-6 shadow-[var(--ombre-6)]',
            'focus:outline-none',
            'data-[closed]:hidden',
            'transition-[transform,opacity] duration-150 ease-out',
            'data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0',
            'motion-reduce:transition-none motion-reduce:data-[starting-style]:scale-100',
          )}
        >
          <div className="flex items-start gap-3">
            {destructif && (
              <Icone
                nom="icon-alert-triangle"
                className="mt-0.5 size-5 shrink-0 text-[var(--marker-red)]"
              />
            )}
            <div className="flex min-w-0 flex-col gap-1.5">
              <Dialog.Title className="t-h3">{titre}</Dialog.Title>
              <Dialog.Description
                className={cn(
                  't-body text-black',
                  destructif && 'border-l-2 border-[var(--marker-red)] pl-3',
                )}
                render={<div />}
              >
                {message}
              </Dialog.Description>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Bouton
              ref={refAnnuler}
              apparence="contour"
              taille="md"
              disabled={enCours}
              onClick={() => onOuvertureChange(false)}
            >
              {libelleAnnulation}
            </Bouton>
            <Bouton
              ref={refConfirmer}
              apparence="plein"
              taille="md"
              disabled={enCours}
              onClick={onConfirmer}
            >
              {libelleConfirmation}
            </Bouton>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
