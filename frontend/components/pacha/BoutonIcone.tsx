'use client';

import { Icone, type NomIcone } from './Icone';
import { cn } from '@/lib/utils';

/**
 * BoutonIcone — le composant `Button icon` du Figma (Figma.md:11812).
 *
 * Axes : `State={Resting, Hover, Clicked}` × `Type={Chevron, Delete, Edit,
 * Expand, Reduce, See, Send, search}` (Figma.md:11831 à 12808).
 *
 * CE QUE LE RELEVÉ APPREND — et qui contredit l'intuition « bouton » : il n'y a
 * ni fond, ni bordure, ni ombre. Les 24 blocs CSS ne font varier QUE la couleur
 * du glyphe, sur la rampe violette :
 *
 *   Resting  #AB8AFF = --violet-300   Figma.md:11871
 *   Hover    #5022C3 = --violet-700   Figma.md:12206
 *   Clicked  #371B7E = --violet-900   Figma.md:12239
 *
 * Exception unique, vérifiée bloc par bloc : `Type=search` a un survol à
 * #8657FF = --violet-500 (Figma.md:11928), plus clair que les sept autres. Une
 * icône de recherche vit dans un champ, pas dans une barre d'actions — le
 * survol y est moins appuyé. Je respecte l'écart au lieu de l'aplanir.
 *
 * C'est le seul endroit du DS où la couleur violette porte une action. Elle ne
 * contredit pas la règle « la couleur d'action est le noir » : le violet est la
 * couleur d'INTERFACE de l'app (rampe interactive d'app.css), pas une couleur
 * de verticale. Aucune verticale n'apparaît ici.
 *
 * ACCESSIBILITÉ — un bouton sans texte doit se nommer. `aria-label` a une
 * valeur par défaut en français pour chacun des huit types ; on peut la
 * remplacer, jamais la vider. Le carré dessiné fait 20px, sous le minimum de
 * 24px recommandé pour une cible tactile : la zone cliquable est étendue à 28px
 * par un pseudo-élément, ce qui ne déplace rien dans la mise en page.
 */

/** Les huit `Type` du Figma, nommés en français comme le reste du dépôt. */
export type TypeBoutonIcone =
  | 'chevron' // Type=Chevron    Figma.md:12246
  | 'supprimer' // Type=Delete   Figma.md:12588
  | 'modifier' // Type=Edit      Figma.md:12147
  | 'agrandir' // Type=Expand    Figma.md:12324
  | 'reduire' // Type=Reduce     Figma.md:12456
  | 'voir' // Type=See           Figma.md:12720
  | 'envoyer' // Type=Send       Figma.md:12032
  | 'rechercher'; // Type=search Figma.md:11831

/**
 * Le nom de la couche d'icône, quand le Figma le donne explicitement. Trois
 * types ne nomment pas leur glyphe (la couche s'appelle `Icon`, `Shape` ou
 * `Search`) : je prends alors le nom du jeu `icon-*` du même fichier, cité en
 * commentaire. Le glyphe est dessiné par le LOT 1, jamais ici.
 */
const iconeDeType: Record<TypeBoutonIcone, NomIcone> = {
  // Le Figma ne dit PAS la direction : `icon-chevron-down` et
  // `icon-chevron-up` ont une géométrie identique au pixel (Shape 14×8,
  // Figma.md:48551 et 48583), et la couche du bouton s'appelle juste `Shape`.
  // Je prends `-down` par défaut, et j'expose `direction` pour l'autre cas.
  chevron: 'icon-chevron-down',
  supprimer: 'icon-x', // nommé dans le Figma — Figma.md:12609
  modifier: 'icon-edit', // couche `Icon` 16×16 ; trois candidats existent dans
  // le fichier (icon-edit / -2 / -3, Figma.md:51111, 51143, 51175) et rien ne
  // permet de trancher. Je prends le nom nu.
  agrandir: 'icon-maximize-2', // nommé — Figma.md:12345
  reduire: 'icon-minimize-2', // nommé — Figma.md:12477
  voir: 'icon-eye', // nommé — Figma.md:12741
  envoyer: 'icon-send', // couche `Shape` ; nom relevé ailleurs — Figma.md:54386
  rechercher: 'icon-search', // couche `Search` ; nom relevé — Figma.md:54330
};

/** Les quatre directions existent dans le jeu d'icônes : Figma.md:48551, 48583,
 *  49703, 49735. */
const chevronDeDirection = {
  bas: 'icon-chevron-down',
  haut: 'icon-chevron-up',
  gauche: 'icon-chevron-left',
  droite: 'icon-chevron-right',
} satisfies Record<string, NomIcone>;

/** Libellés par défaut. Un bouton icône muet est un bouton cassé. */
const libelleDeType: Record<TypeBoutonIcone, string> = {
  chevron: 'Déplier',
  supprimer: 'Supprimer',
  modifier: 'Modifier',
  agrandir: 'Agrandir',
  reduire: 'Réduire',
  voir: 'Voir',
  envoyer: 'Envoyer',
  rechercher: 'Rechercher',
};

/**
 * Cotes. Le Figma en donne trois, pour huit types :
 *   20×20, padding 2px, rayon 4px  — Expand, Reduce, Delete, See (Figma.md:12329)
 *                                    et Edit, avec un glyphe de 16px (12160)
 *   21×21, padding 2px, rayon 4px  — search, glyphe 17px (Figma.md:11836)
 *   24×24                          — Chevron (12251) et Send (12032)
 *
 * Le 21px est une dérive d'un pixel : je le ramène à 20. Le 24px, lui, est une
 * vraie seconde cote, exposée par `taille='lg'`. Rayon 4px = --r-xs.
 *
 * Le fichier se contredit sur le glyphe : Expand/Reduce/Delete/See annoncent un
 * glyphe de 20px DANS un carré de 20px à padding 2px — impossible. Edit, seul,
 * est cohérent : glyphe 16px dans 20px (Figma.md:12160, 12172). Je retiens la
 * version cohérente : le padding gagne, le glyphe fait 16px en `md`, 20px en `lg`.
 */
const tailles = {
  md: 'size-5 rounded-[var(--r-xs)] p-0.5', // 20px — Figma.md:12329
  lg: 'size-6 rounded-[var(--r-xs)] p-0.5', // 24px — Figma.md:12251
} as const;

export function BoutonIcone({
  type,
  direction = 'bas',
  taille = 'md',
  libelle,
  className,
  ...reste
}: Omit<React.ComponentProps<'button'>, 'type' | 'children'> & {
  type: TypeBoutonIcone;
  /** Uniquement pour `type='chevron'` : le Figma ne tranche pas la direction. */
  direction?: 'bas' | 'haut' | 'gauche' | 'droite';
  taille?: keyof typeof tailles;
  /** Remplace le libellé par défaut. Ne peut pas être vide. */
  libelle?: string;
}) {
  const nom: NomIcone = type === 'chevron' ? chevronDeDirection[direction] : iconeDeType[type];

  return (
    <button
      type="button"
      aria-label={libelle || libelleDeType[type]}
      className={cn(
        'relative inline-grid shrink-0 place-items-center',
        // Cible tactile portée à 28px sans toucher au flux : le carré dessiné
        // reste à la cote du Figma.
        "after:absolute after:-inset-1 after:content-['']",
        'transition-colors duration-150',
        // Les trois états du Figma, dans l'ordre : repos, survol, enfoncé.
        // `enabled:` est nécessaire — en CSS un bouton désactivé matche encore
        // `:hover`, et le survol l'emporterait sur la couleur d'inertie.
        'text-[var(--violet-300)]', // Resting  #AB8AFF — Figma.md:11871
        type === 'rechercher'
          ? 'enabled:hover:text-[var(--violet-500)]' // survol de search #8657FF — Figma.md:11938
          : 'enabled:hover:text-[var(--violet-700)]', // Hover #5022C3 — Figma.md:12205
        'enabled:active:text-[var(--violet-900)]', // Clicked #371B7E — Figma.md:12238
        'disabled:cursor-not-allowed disabled:text-[var(--encre-200)]', // hors Figma, voir rapport
        tailles[taille],
        className,
      )}
      {...reste}
    >
      {/* Pas de `titre` : le nom du contrôle est déjà sur le bouton. */}
      <Icone nom={nom} className="size-full" />
    </button>
  );
}
