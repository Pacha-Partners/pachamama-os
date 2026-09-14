import { cn } from '@/lib/utils';

/**
 * Decor — les grandes taches de fond de la marque.
 *
 * À NE PAS CONFONDRE AVEC `Illustration.tsx`, et c'est pour cette raison
 * qu'elles vivent dans un fichier séparé plutôt que d'allonger la liste des 34
 * formes. Ce sont deux familles opposées :
 *
 *   Illustration   petite, dans le flux, accompagne un titre ou un état vide,
 *                  et prend la couleur du texte qui l'entoure.
 *   Decor          grande, HORS du flux, derrière tout le contenu, dans une
 *                  teinte crème unique. Elle ne se lit pas, elle installe.
 *
 * Les tracés viennent de `public/Assets/decor/` — sources de vérité si une
 * forme doit être redessinée. Deux propriétés de ces exports méritent d'être
 * connues avant d'y toucher :
 *
 * 1. LE TRACÉ DÉBORDE VOLONTAIREMENT DE SON viewBox. La bande va de x=-323 à
 *    x=686 pour un viewBox large de 686 ; le croissant descend à y=686 pour un
 *    viewBox haut de 400. Ce n'est pas une erreur d'export : Figma a cadré la
 *    portion visible et laissé le reste être coupé par le viewport SVG. Il ne
 *    faut donc NI recadrer le viewBox sur le tracé, NI « corriger » les
 *    coordonnées négatives — on perdrait l'échancrure qui fait la forme.
 *
 * 2. LE `fill` D'ORIGINE (#FFF8E5) EST REMPLACÉ PAR `currentColor`. Un décor
 *    figé dans une couleur ne sert qu'une page ; celui-ci prend la teinte de
 *    `color`, dont la valeur de marque est le jeton `--fond-decor`. C'est la
 *    même règle que pour les 34 illustrations, et pour la même raison.
 *
 * CADRAGE — LA SEULE COUPE ADMISE EST LE BORD DE L'ÉCRAN. C'est la règle qui
 * commande les deux réglages ci-dessous, et elle vient d'un défaut observé : le
 * croissant n'apparaissait pas comme une forme mais comme un bloc tranché au
 * carré, trait droit horizontal en haut et en bas, en plein milieu de la page.
 * Ces traits étaient les bords de son propre `<svg>`.
 *
 *   `overflow-visible` — un `<svg>` rogne son contenu par défaut. Or ces tracés
 *   débordent VOLONTAIREMENT de leur viewBox (voir le point 1 ci-dessus) : les
 *   laisser rogner par la boîte, c'est couper la forme à un endroit arbitraire.
 *   En les laissant déborder, la seule chose qui les coupe encore est
 *   l'`overflow-hidden` de `FondDecor`, lequel épouse exactement le viewport.
 *
 *   `meet`, et non `slice` — `slice` agrandit la forme jusqu'à COUVRIR sa
 *   boîte. Tant que le `<svg>` rognait, cela restait sans conséquence ; sans
 *   rognage, c'est ingérable : sur un écran étroit et haut, `slice` se cale sur
 *   la hauteur et la bande envahissait la totalité d'un écran de téléphone.
 *   Mesuré. `meet` met la forme à l'échelle pour TENIR dans sa boîte, ce qui
 *   reste prévisible quelle que soit la proportion du viewport. Ni l'un ni
 *   l'autre ne déforme ; seul `none` déformerait, et il reste proscrit.
 *
 * Composants purs, sans état : ils restent côté serveur.
 */

type ProprietesDecor = {
  /** Position, cote et teinte. Le décor ne décide d'aucune des trois. */
  className?: string;
};

/**
 * DecorBandeOblique — `ACARTA` dans le Figma.
 *
 * Une bande qui traverse en diagonale, du haut-gauche vers le bas-droite. Sur
 * le job board elle est ancrée au coin supérieur gauche et déborde des deux
 * côtés.
 */
export function DecorBandeOblique({ className }: ProprietesDecor) {
  return (
    <svg
      viewBox="0 0 686 569"
      fill="none"
      // `xMinYMin` ancre le coin haut-gauche : c'est de là que la bande entre
      // dans l'écran, et son extrémité gauche (x=-323) est coupée par le bord
      // du viewport. `meet` garantit que sa pointe de droite, qui tombe pile
      // sur x=686, reste entière — en `slice` elle était tranchée net.
      preserveAspectRatio="xMinYMin meet"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn('pointer-events-none select-none overflow-visible', className)}
    >
      <path
        d="M-323 258.375L-122.455 -141.999L685.936 448.224L625.773 568.337L-323 258.375Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * DecorCroissant — `Ellipse 3` dans le Figma.
 *
 * Un arc épais, ouvert vers le bas-droite. Sur le job board il occupe la moitié
 * droite et sort par le bas.
 */
export function DecorCroissant({ className }: ProprietesDecor) {
  return (
    <svg
      viewBox="0 0 490 400"
      fill="none"
      // `xMaxYMid meet` : ancré à droite, centré en hauteur — il entre par le
      // bord droit de l'écran. Son arc et sa corde plongent sous le bord bas,
      // si bien que seule la courbe reste visible : c'est ce débordement, et
      // non un recadrage, qui lui donne sa forme.
      preserveAspectRatio="xMaxYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn('pointer-events-none select-none overflow-visible', className)}
    >
      <path
        d="M83.5165 686.341C15.8682 594.111 -12.3714 478.786 5.01021 365.735C22.3918 252.684 83.9708 151.169 176.2 83.5202C268.43 15.8718 383.755 -12.3677 496.806 5.01392C609.857 22.3955 711.373 83.9744 779.021 176.204L83.5165 686.341Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ── Le fond de marque ────────────────────────────────────────────────────── */

/**
 * FondDecor — les deux taches posées derrière un écran.
 *
 * TROIS DÉCISIONS, ET LEURS RAISONS.
 *
 * 1. `fixed`, PAS `absolute`. Un décor de fond ne défile pas : il reste où il
 *    est pendant que le contenu passe devant. En `absolute` il appartenait au
 *    flux du document et remontait avec le défilement, ce qui trahissait
 *    immédiatement qu'il s'agissait d'images posées et non d'un fond.
 *
 *    Cela suppose qu'aucun ancêtre ne porte `transform`, `filter` ni
 *    `contain` — l'un d'eux ferait de lui le référent du `fixed` et le décor
 *    se remettrait à défiler. Vérifié sur la chaîne actuelle : `<body>` →
 *    `<main>` → conteneur de page n'en portent aucun.
 *
 * 2. DES COTES RELATIVES À LA FENÊTRE, pas les pixels du calque. Le Figma
 *    dimensionne sur un cadre de 1347 px ; reprendre 686 px tels quels donnait
 *    une tache qui rétrécissait à vue d'œil à mesure que l'écran grandissait.
 *    Les proportions, elles, sont bien celles du calque : la bande occupait
 *    51 % de la largeur et 71 % de la hauteur, le croissant 36 % et 50 %.
 *
 * 3. `-z-10` ET NON UN FOND SÉPARÉ. Posé en enfant du conteneur qui porte la
 *    couleur de fond, un élément à z-index négatif est peint APRÈS ce fond mais
 *    AVANT le contenu — exactement la couche voulue. Le décor doit donc rester
 *    dans ce conteneur ; sorti au niveau du corps de page, la couleur opaque de
 *    l'écran le recouvrirait.
 *
 * L'`overflow-hidden` lui appartient, et il porte désormais tout le cadrage :
 * les deux `<svg>` ne rognent plus rien, donc c'est CE bord-ci — qui épouse le
 * viewport — qui coupe les formes. Sans lui, leurs débordements voulus
 * créeraient en plus des barres de défilement.
 */
export function FondDecor({
  ancrage = 'ecran',
  className,
}: ProprietesDecor & {
  /**
   * Sur quoi le décor est calé.
   *
   * `ecran` (défaut) — `fixed` sur le viewport : le décor du fond de page.
   *
   * `conteneur` — `absolute` dans le parent positionné. Prévu pour un seul
   * usage : une barre figée en haut d'écran, qui est opaque et masquerait donc
   * la portion de décor passant derrière elle. Elle en reçoit sa propre copie,
   * et les deux se raccordent SANS calage à faire — à condition que la boîte du
   * parent affleure le coin haut-gauche du viewport, ce qui est le cas d'une
   * barre `sticky top-0` débordée jusqu'aux bords. Les deux copies partagent
   * alors la même origine, et les cotes des formes sont en `vw`/`vh`, donc
   * relatives au viewport dans les deux cas. Le raccord tient à tout niveau de
   * défilement, la barre restant elle aussi collée au haut de l'écran.
   */
  ancrage?: 'ecran' | 'conteneur';
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none -z-10 overflow-hidden text-[var(--fond-decor)]',
        ancrage === 'ecran' ? 'fixed inset-0' : 'absolute inset-0',
        className,
      )}
    >
      <DecorBandeOblique className="absolute top-0 left-0 h-[71vh] w-[51vw]" />
      <DecorCroissant className="absolute top-[33vh] right-0 h-[50vh] w-[36vw]" />
    </div>
  );
}
