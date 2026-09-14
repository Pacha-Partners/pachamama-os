'use client';

import { Menu as MenuBase } from '@base-ui/react/menu';

import { Icone, type NomIcone } from './Icone';
import { ELEMENT_LISTE, PANNEAU_DEROULANT } from './Selecteur';
import { cn } from '@/lib/utils';

/**
 * MenuActions — le menu « … » d'une ligne, d'un en-tête, d'une carte.
 *
 * ⚠ FAUX AMI : `Menu.tsx` DU MÊME DOSSIER EST LA NAVIGATION LATÉRALE, un
 * panneau de 180px à filet noir. Ce fichier-ci n'a rien à voir avec lui, ne
 * l'importe pas et ne le remplace pas. Le nom est proche parce que le français
 * n'en a pas deux ; le contenu est sans rapport.
 *
 * SUR LA PRIMITIVE `menu` DE BASE UI. Un menu d'actions correct fait beaucoup
 * plus que s'ouvrir : il piège le focus, se parcourt aux flèches, accepte la
 * saisie du premier caractère, se ferme à Échap en rendant le focus au
 * déclencheur, se replace quand il n'y a plus de place en bas de l'écran, et
 * porte les rôles `menu` / `menuitem` qu'un lecteur d'écran attend. Écrit à la
 * main, il en manquerait la moitié — et c'est ce qu'on trouve dans la plupart
 * des dépôts.
 *
 * LE PANNEAU RÉUTILISE LES RECETTES DU SÉLECTEUR. `PANNEAU_DEROULANT` et
 * `ELEMENT_LISTE` sont exportés par `Selecteur.tsx` et relevés du Figma
 * (bordure noire 2px, rayon 8, survol `--violet-050`, actif `--violet-100`) :
 * un menu d'actions qui ne leur ressemblerait pas donnerait deux vocabulaires
 * de surface flottante pour la même app. Seule la largeur est redéfinie —
 * `PANNEAU_DEROULANT` se cale sur la largeur du déclencheur, ce qui donnerait
 * ici un panneau de 24px.
 *
 * LE DÉCLENCHEUR PAR DÉFAUT N'EST PAS UN `BoutonIcone`. Les huit `Type` de
 * `BoutonIcone` sont relevés un par un du Figma, et l'ellipse n'en fait pas
 * partie : y ajouter une neuvième valeur inventée salirait une table dont
 * toute la valeur est d'être fidèle. Le bouton est donc dessiné ici, dans la
 * MÊME rampe violette que `BoutonIcone` (repos `--violet-300`, survol
 * `--violet-700`, pressé `--violet-900`), pour que les deux se ressemblent
 * sans que l'un mente sur sa source.
 *
 * LE DESTRUCTIF NE SE PEINT PAS EN ROUGE. La règle du système est que le texte
 * est noir et que la couleur ne signale rien seule. Un item destructif se
 * reconnaît à son libellé — qui doit nommer la perte — et à son icône, seule
 * pièce autorisée à porter `--marker-red` puisqu'elle ne se lit pas.
 */

export type ActionMenu = {
  cle: string;
  /** Ce que l'action fait. « Retirer du process », pas « Retirer ». */
  libelle: string;
  icone?: NomIcone;
  onSelection?: () => void;
  /** Rend un lien plutôt qu'un bouton. Pour une vraie navigation. */
  href?: string;
  desactive?: boolean;
  /** L'action détruit quelque chose. Change l'icône de couleur, rien d'autre. */
  destructive?: boolean;
  /** Pose un filet au-dessus de cet item. Pour isoler le geste dangereux. */
  separateurAvant?: boolean;
};

export function MenuActions({
  actions,
  libelle = 'Actions',
  declencheur,
  alignement = 'end',
  className,
}: {
  actions: readonly ActionMenu[];
  /**
   * Le nom accessible du déclencheur. À PRÉCISER dès qu'il y a plus d'un menu
   * sur l'écran : vingt boutons nommés « Actions » dans une liste de vingt
   * lignes ne permettent pas de savoir sur quelle ligne on se trouve.
   * « Actions sur la candidature #012 ».
   */
  libelle?: string;
  /** Un déclencheur sur mesure. Doit être un élément focalisable. */
  declencheur?: React.ReactElement;
  /** Le bord du déclencheur sur lequel le panneau s'aligne. */
  alignement?: 'start' | 'center' | 'end';
  className?: string;
}) {
  return (
    <MenuBase.Root>
      <MenuBase.Trigger
        render={declencheur ?? <BoutonEllipse />}
        aria-label={declencheur ? undefined : libelle}
      />
      <MenuBase.Portal>
        <MenuBase.Positioner side="bottom" align={alignement} sideOffset={4} className="z-50">
          <MenuBase.Popup
            className={cn(
              PANNEAU_DEROULANT,
              // Le panneau se dimensionne sur SON contenu, pas sur un
              // déclencheur de 24px de large.
              'max-h-none w-auto min-w-[200px] max-w-[280px]',
              'data-[closed]:hidden',
              className,
            )}
          >
            <div className="flex flex-col gap-0.5 p-1">
              {actions.map((action) => (
                <div key={action.cle} className="contents">
                  {action.separateurAvant && (
                    <span
                      aria-hidden="true"
                      className="my-1 block h-px bg-[var(--encre-100)]"
                    />
                  )}
                  <ItemAction action={action} />
                </div>
              ))}
            </div>
          </MenuBase.Popup>
        </MenuBase.Positioner>
      </MenuBase.Portal>
    </MenuBase.Root>
  );
}

function ItemAction({ action }: { action: ActionMenu }) {
  const contenu = (
    <>
      {action.icone && (
        <Icone
          nom={action.icone}
          className={cn(
            'size-4 shrink-0',
            action.destructive ? 'text-[var(--marker-red)]' : 'text-[var(--encre-600)]',
          )}
        />
      )}
      <span className="truncate">{action.libelle}</span>
    </>
  );

  const classes = cn(ELEMENT_LISTE, 'min-h-[35px] gap-2.5 px-2 py-1.5');

  // Un lien reste un lien : le clic du milieu, « ouvrir dans un onglet » et le
  // survol qui montre la cible en dépendent. `MenuBase.LinkItem` rend un <a>
  // tout en gardant la mécanique clavier du menu.
  if (action.href && !action.desactive) {
    return (
      <MenuBase.LinkItem href={action.href} className={classes}>
        {contenu}
      </MenuBase.LinkItem>
    );
  }

  return (
    <MenuBase.Item
      disabled={action.desactive}
      onClick={action.onSelection}
      className={classes}
    >
      {contenu}
    </MenuBase.Item>
  );
}

/**
 * L'ellipse. Cote 24px comme `BoutonIcone taille="lg"`, glyphe 20px, rayon
 * `--r-xs` — les cotes du bouton icône du Figma, appliquées à un glyphe qui
 * n'y figure pas.
 */
function BoutonEllipse(props: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-[var(--r-xs)] p-0.5',
        'text-[var(--violet-300)] hover:text-[var(--violet-700)] active:text-[var(--violet-900)]',
        'data-[popup-open]:text-[var(--violet-900)]',
        'transition-colors duration-150',
        props.className,
      )}
    >
      <Icone nom="icon-more-horizontal" className="size-5" />
    </button>
  );
}
