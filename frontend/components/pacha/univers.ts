/**
 * LES QUATRE VERTICALES, ET LEURS TEINTES.
 *
 * CE FICHIER N'A PAS DE DIRECTIVE `'use client'`, et c'est sa raison d'être.
 *
 * Ces valeurs vivaient dans `Tag.tsx`, qui est un composant client. Un
 * composant SERVEUR qui en importait la table recevait une référence client à
 * la place de l'objet : l'indexer rendait `undefined`, sans la moindre erreur.
 * Mesuré sur la fiche d'offre — la carte de l'agent restait blanche alors que
 * la fonction rendait bien `bg-[var(--product-200)]` en test unitaire. Une
 * donnée partagée de part et d'autre de la frontière doit vivre hors d'elle.
 *
 * `Tag.tsx` les réexporte, pour que les appelants existants ne changent pas.
 */

export type Univers = "people" | "product" | "tech" | "sales";

/**
 * Le fond d'un tag de verticale, et celui de la carte d'agent sur la fiche
 * d'offre — annoté sur la maquette, qui montre les quatre déclinaisons.
 *
 * Deux de ces teintes n'ont pas de jeton : consigné dans
 * docs/ds-jetons-manquants-lot3.md. `tech` prend `--violet-100`, la rampe
 * interactive, parce que le Figma le dit — c'est le seul tag de verticale
 * peint avec elle.
 *
 * Contraste : toutes ces teintes sont claires, le texte noir y passe AAA.
 */
export const fondsUnivers: Record<Univers, string> = {
  product: "bg-[var(--product-200)]",
  tech: "bg-[var(--violet-100)]",
  people: "bg-[#fffbf0]",
  sales: "bg-[#ccf5e6]",
};

export const libellesUnivers: Record<Univers, string> = {
  product: "Product",
  tech: "Tech",
  people: "People",
  sales: "Sales",
};

/**
 * Le fond de la CARTE D'AGENT, sur la fiche d'offre.
 *
 * Ce n'est PAS la teinte des tags. Le Figma donne `#FFE8E0` pour la vue
 * Product (Job_board_détails.md:1698) — soit `--product-100`, un cran plus
 * clair que le `--product-200` du tag. La différence se voit : une surface de
 * 240px ne porte pas la même teinte qu'une pastille de 20.
 *
 * L'export CSS ne couvre que la vue Product ; les trois autres déclinaisons
 * n'existent que dans l'image de la maquette. Elles ne sont pas devinées ici,
 * elles sont prises au MÊME CRAN de la palette de marque — `--people-100`,
 * `--tech-100`, `--revenue-100` — ce qui est la seule extrapolation défendable.
 *
 * `sales` prend la rampe `revenue` : c'est ainsi que la palette de marque
 * nomme cette verticale (styles/brand/colors.css).
 */
export const fondsAgentUnivers: Record<Univers, string> = {
  product: "bg-[var(--product-100)]",
  tech: "bg-[var(--tech-100)]",
  people: "bg-[var(--people-100)]",
  sales: "bg-[var(--revenue-100)]",
};

/**
 * La couleur des INTITULÉS de section, sur la fiche d'offre — « Contexte »,
 * « Ambition », « Infos rémunération »…
 *
 * Elle suit l'univers du job. Le Figma la donne en `#FF8F66` sur une vue
 * Product (Job_board_détails.md:190), soit `--product-500` : c'est donc le cran
 * 500 de la verticale, et non une couleur fixe. J'avais codé l'orange en dur,
 * ce qui donnait un titre Product sur un job Tech.
 *
 * RÉSERVE DE LISIBILITÉ, mesurée sur fond blanc : le cran 500 est clair sur
 * deux verticales. `--people-500` (#ffe94a) et `--revenue-500` (#7ae7bf) tombent
 * sous le seuil de contraste, et la palette de marque ne propose rien de plus
 * sombre — 500 est son extrême. Le respect de la maquette et la lisibilité
 * s'opposent ici ; le choix est consigné plutôt que tranché en silence.
 */
export const titresUnivers: Record<Univers, string> = {
  product: "text-[var(--product-500)]",
  tech: "text-[var(--tech-500)]",
  people: "text-[var(--people-500)]",
  sales: "text-[var(--revenue-500)]",
};

/**
 * Le fond de l'ENCART D'ANONYMAT, sur la fiche d'une offre anonyme.
 *
 * Il suit l'univers du job, comme la carte de l'agent et les intitulés de
 * section — l'anonymat masque le client, pas la verticale du poste.
 *
 * Cran 200, et non 100 : la maquette donne `#ffd2c2` pour une vue Product,
 * soit exactement `--product-200`. La carte de l'agent, elle, est au cran 100
 * (`#FFE8E0`). Deux surfaces, deux crans, chacun ancré sur une valeur relevée
 * et non déduite de l'autre.
 */
export const fondsEncartUnivers: Record<Univers, string> = {
  product: "bg-[var(--product-200)]",
  tech: "bg-[var(--tech-200)]",
  people: "bg-[var(--people-200)]",
  sales: "bg-[var(--revenue-200)]",
};

/**
 * La forme décorative de la carte d'agent — le calque `Ellipse 3` du Figma
 * (Job_board_détails.md:1698), un disque de 409 × 472 pivoté de -150° et
 * débordant de la carte, qui la coupe.
 *
 * Cran 300 : la maquette donne `#FFBCA3` sur la vue Product, soit
 * `--product-300` (#ffbca4) au chiffre près. Trois crans coexistent donc sur
 * cette seule carte — 100 pour son fond, 300 pour cette forme, et le 200 sert
 * ailleurs à l'encart d'anonymat. Chacun est relevé, aucun n'est déduit.
 */
export const formesAgentUnivers: Record<Univers, string> = {
  product: "bg-[var(--product-300)]",
  tech: "bg-[var(--tech-300)]",
  people: "bg-[var(--people-300)]",
  sales: "bg-[var(--revenue-300)]",
};
