'use client';

import { cn } from '@/lib/utils';

/**
 * Bouton — les 24 variantes du Figma, ramenées à deux palettes et deux cotes.
 *
 * Le composant Figma croise trois axes : `Size={Small, Medium}` ×
 * `State={Default, Hover, Disabled}` × `color={Default, Lila, Main, White}`
 * (Figma.md:4648 à 6154). J'ai relevé les quatre couleurs une par une, et le
 * relevé dit quelque chose que la nomenclature cache : **l'axe `color` ne
 * produit que deux apparences réelles**.
 *
 *   color=Default  fond #000000, texte #FFFFFF, sans bordure   Figma.md:4648
 *   color=Main     fond #000000, texte #FFFFFF, sans bordure   Figma.md:4776
 *   color=Lila     fond #FFFFFF, bordure 1px #000000, texte #000000  Figma.md:4904
 *   color=White    fond #FFFFFF, bordure 1px #000000, texte #000000  Figma.md:5038
 *
 * Default ≡ Main et Lila ≡ White, au caractère près, dans les six blocs CSS.
 * Aucune des quatre valeurs n'introduit de violet ni de couleur de verticale :
 * ce sont des noms de rôle laissés dans le fichier, pas des teintes. La règle
 * dure du DS est donc respectée par le Figma lui-même — la couleur d'action est
 * le noir, et rien d'autre ne signale un geste.
 *
 * L'axe `color` est exposé quand même (prop `couleur`), parce que les autres
 * écrans le nomment et qu'un jour les quatre valeurs pourront diverger sans
 * casser les appels. Mais c'est `apparence` qui reste l'axe utile : elle
 * porte le RÉGIME D'OMBRE, que l'axe `color` ne décrit pas.
 *
 * ÉTAT DE SURVOL — deux mécaniques distinctes, relevées séparément :
 *   plein   : le fond passe à rgba(45,43,49,0.75)          Figma.md:5188, 5252
 *   contour : le fond ne bouge pas, l'OMBRE RÉTRO APPARAÎT Figma.md:5448, 5516
 *             -2px en Small, -3px en Medium — c'est une cote d'échelle, pas un
 *             enfoncement : au repos le bouton contour n'a AUCUNE ombre.
 *
 * `State=Hover` est un état CSS (`hover:`), `State=Disabled` passe par
 * l'attribut `disabled` — ni l'un ni l'autre n'est une prop.
 */

/** Les trois premières valeurs sont contractuelles (brief §8). */
export type ApparenceBouton = 'plein' | 'contour' | 'contour-ombre' | 'presse' | 'inerte';

/** L'axe `color` du Figma, tel quel. */
export type CouleurBouton = 'defaut' | 'main' | 'lila' | 'blanc';

export type TailleBouton = 'sm' | 'md';

/**
 * Chaque couleur retombe sur l'une des deux familles visuelles réellement
 * dessinées. Le tableau est plat exprès : le jour où `Main` divergera de
 * `Default` dans le Figma, c'est ici, et nulle part ailleurs, qu'on l'écrira.
 */
const familleDeCouleur: Record<CouleurBouton, 'noir' | 'blanc'> = {
  defaut: 'noir', // Figma.md:4648 — background: #000000
  main: 'noir', // Figma.md:4776 — background: #000000, identique à Default
  lila: 'blanc', // Figma.md:4904 — background: #FFFFFF, border 1px #000000
  blanc: 'blanc', // Figma.md:5038 — identique à Lila
};

/* Le fond de survol du bouton plein n'a pas de jeton : c'est --encre-700
   (#2d2b31) à 75 % d'opacité, et l'opacité n'est pas dans la rampe.
   Consigné dans docs/ds-jetons-manquants-lot3.md.
   Ce survol est appliqué séparément de la palette : en CSS, un `<button>`
   désactivé continue de matcher `:hover`, donc l'inclure dans `familles`
   ferait clignoter un bouton inerte. */
const SURVOL_PLEIN = 'hover:bg-[rgba(45,43,49,0.75)]'; // Figma.md:5188

const familles = {
  noir: cn(
    'bg-black text-white border-0',
    '[&_svg]:text-white', // Figma.md:4688 — Vector du bouton plein : #FFFFFF
  ),
  blanc: cn(
    'bg-white text-black border border-black',
    '[&_svg]:text-black', // Figma.md:4947 — Vector du bouton contour : #000000
  ),
} as const;

/**
 * Le régime d'ombre. `contour` porte l'ombre AU SURVOL, comme le Figma ;
 * `contour-ombre` la porte AU REPOS — ce cas n'existe pas dans le composant
 * Button du Figma, mais c'est le régime « accroche » du DS, et le Figma le
 * montre ailleurs (tag à -3px, Figma.md:36992). Les deux lots qui importent
 * `contour-ombre` attendent ce comportement : je le garde.
 */
const ombres = {
  sm: { survol: 'hover:shadow-[var(--ombre-2)]', repos: 'shadow-[var(--ombre-2)]' }, // Figma.md:5448
  md: { survol: 'hover:shadow-[var(--ombre-3)]', repos: 'shadow-[var(--ombre-3)]' }, // Figma.md:5516
} as const;

/**
 * Cotes relevées : hauteur fixe, padding serré, rayon 6px.
 * Le rayon est 6px sur les 24 variantes (`border-radius: 6px`, Figma.md:4665) —
 * soit exactement `--r-sm`.
 * Il ne faut PAS lire ici le `--r-controle: 5px` : les 35 occurrences de
 * `border-radius: 5px` du fichier sont toutes précédées de
 * `border: 1px dashed` — ce sont les cadres pointillés que Figma dessine
 * autour d'un jeu de variantes, pas les contrôles. Vérifié : 35/35.
 *
 * Typographie : le Figma dit Montserrat 500, police absente de la charte
 * (reliquat d'une génération antérieure du fichier, même phénomène qu'Abhaya
 * Libre — arbitrage déjà acté dans app.css). Graisse 500 → classes `-hl`.
 * Le Figma donne 12px/15px et 14px/17px ; nos classes portent 12/16 et 14/19.
 * Sans effet : le bouton est un flex à hauteur fixe, centré.
 */
const tailles = {
  // Figma.md:4655 — padding: 6px; gap: 4px; height: 32px; font-size: 12px
  sm: 'h-8 px-1.5 gap-1 t-caption-hl rounded-[var(--r-sm)]',
  // Figma.md:4719 — padding: 10px 8px; gap: 4px; height: 40px; font-size: 14px
  md: 'h-10 px-2 gap-1 t-body-hl rounded-[var(--r-sm)]',
} as const;

/**
 * Désactivé — une seule apparence pour les quatre couleurs.
 * fond #E7E6EB = --encre-100, texte #2D2B31 = --encre-700 (Figma.md:5716).
 *
 * ÉCART ASSUMÉ : en Small, les variantes Lila et White gardent une bordure
 * 1px #738296 (= --encre-500, Figma.md:5847) ; en Medium, les mêmes variantes
 * n'ont plus de bordure du tout (Figma.md:6090). C'est une incohérence du
 * fichier, pas une intention : je garde la bordure aux deux tailles pour les
 * familles à contour, faute de quoi un bouton désactivé changerait de
 * structure en changeant de taille.
 */
const inerte = cn(
  'bg-[var(--encre-100)] text-[var(--encre-700)] cursor-not-allowed',
  '[&_svg]:text-[var(--encre-700)]', // Figma.md:5740 — Vector: #2D2B31
  'shadow-none',
);

/**
 * `presse` n'est PAS dans le Figma : le composant Button n'a pas d'état
 * Clicked (seuls le bouton icône et le tag action en ont un). Je la conserve
 * parce que le spécimen du DS l'appelle, et je l'ancre sur la seule preuve
 * disponible : #2D2B31 opaque, soit le fond de survol sans son alpha.
 */
const presse = 'bg-[var(--encre-700)] text-white border-0 [&_svg]:text-white';

export function Bouton({
  apparence = 'plein',
  couleur,
  taille = 'md',
  iconeAvant,
  iconeApres,
  className,
  disabled,
  children,
  type = 'button',
  ...reste
}: React.ComponentProps<'button'> & {
  /* Union fermée : un `(string & {})` laisserait passer une faute de frappe
     (`'contour-ombré'`) qui compilerait et rendrait silencieusement un bouton
     plein. Le typage est le seul garde-fou de ce composant. */
  apparence?: ApparenceBouton;
  couleur?: CouleurBouton;
  taille?: TailleBouton;
  iconeAvant?: React.ReactNode;
  iconeApres?: React.ReactNode;
}) {
  // Une apparence inconnue retombe sur l'action principale plutôt que de ne
  // rien peindre : le contrat autorise `string`, on ne casse pas l'appelant.
  const app: ApparenceBouton = ([
    'plein',
    'contour',
    'contour-ombre',
    'presse',
    'inerte',
  ] as const).includes(apparence as ApparenceBouton)
    ? (apparence as ApparenceBouton)
    : 'plein';

  const aContour = app === 'contour' || app === 'contour-ombre';
  // `couleur` gouverne la palette quand elle est donnée ; sinon l'apparence la
  // déduit. `apparence` garde toujours la main sur le régime d'ombre.
  const famille = couleur ? familleDeCouleur[couleur] : aContour ? 'blanc' : 'noir';
  const desactive = disabled || app === 'inerte';

  return (
    <button
      type={type}
      disabled={desactive}
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap',
        // Le DS ne définit aucun langage de mouvement : on transitionne la
        // couleur et l'ombre, rien qui déplace le bouton.
        'transition-[background-color,box-shadow] duration-150',
        tailles[taille],
        desactive
          ? cn(familles[famille], inerte, famille === 'blanc' && 'border-[var(--encre-500)]')
          : app === 'presse'
            ? presse
            : cn(
                familles[famille],
                famille === 'noir' && SURVOL_PLEIN,
                app === 'contour' && ombres[taille].survol,
                app === 'contour-ombre' && ombres[taille].repos,
              ),
        className,
      )}
      {...reste}
    >
      {iconeAvant && <SlotIcone>{iconeAvant}</SlotIcone>}
      {children}
      {iconeApres && <SlotIcone>{iconeApres}</SlotIcone>}
    </button>
  );
}

/**
 * L'emplacement d'icône fait 20px, le glyphe 14px (Figma.md:4670 et 4683 :
 * `Icons` 20×20 contenant un `Vector` 14×14). Sans ce gabarit, une icône
 * Lucide arrive en 24px et fait grandir un bouton de 32px de haut.
 */
function SlotIcone({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center [&_svg]:size-3.5">
      {children}
    </span>
  );
}
