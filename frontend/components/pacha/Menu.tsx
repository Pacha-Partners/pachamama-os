'use client';

import Link from 'next/link';

import { Icone } from './Icone';
import { Monogramme } from './Logo';
import { cn } from '@/lib/utils';

/**
 * Menu — le panneau de navigation latéral.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DEUX SOURCES FIGMA, ET ELLES NE DISENT PAS LA MÊME CHOSE
 * ────────────────────────────────────────────────────────────────────────────
 * 1. Le jeu de variantes `Variant={Black, White} × State={Default, Hover,
 *    Selected}` (Figma.md:34732, 34797, 34863, 34929, 34994, 35060) — la planche
 *    de composant.
 * 2. Les menus réellement posés dans l'app, `User=Admin` (Figma.md:33606) et
 *    `User=Talent` (Figma.md:34252) — l'application du composant.
 *
 * Sur la couleur du libellé au repos, elles se contredisent : la planche donne
 * `#371B7E` pour le thème Black (Figma.md:34985) et `#FFFFFF` pour le thème White
 * (Figma.md:34788), tandis que TOUS les items en contexte sont en `#000000`
 * (Figma.md:33813, 33878, 33984, 34049, 34154, 34218, 34419, 34483…). On suit le
 * contexte pour le repos et le survol — c'est l'état appliqué, et il rejoint la
 * règle dure « le texte est toujours noir » — et la planche pour l'état
 * sélectionné, seul endroit où elle apporte une information que le contexte n'a
 * pas (aucun item n'y est sélectionné).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * L'ÉTAT SÉLECTIONNÉ ÉCHOUE AU CONTRASTE, ET C'EST LE FIGMA QUI LE DIT
 * ────────────────────────────────────────────────────────────────────────────
 * Le fond sélectionné est `#8657FF` = `--violet-500` dans les deux thèmes
 * (Figma.md:34879 et Figma.md:35076). Les libellés prescrits par-dessus :
 *
 *   thème « noir »  `--violet-900` #371B7E sur violet-500 → **2,98:1**  ÉCHEC AA
 *   thème « blanc » blanc          #FFFFFF sur violet-500 → **4,36:1**  ÉCHEC AA
 *
 * Pour mémoire, du NOIR sur violet-500 mesure 4,82:1 et passe AA. La règle §6 du
 * cahier des charges annonçait « blanc sur violet 500 » comme l'exception
 * légitime : la mesure dit le contraire, c'est le noir qui passe. On implémente
 * quand même la prescription du Figma, sans la corriger en douce — mais elle est
 * signalée ici et dans le rapport. Le repli accessible, si l'arbitrage est
 * tranché en faveur du contraste, est `--violet-700` en fond (blanc dessus :
 * 8,91:1) ou du texte noir sur `--violet-500`.
 *
 * Le survol, lui, est sain dans le thème « noir » : `--violet-100` #E9E0FF
 * (Figma.md:35010), noir dessus 18,9:1. Il ne l'est pas dans le thème « blanc » :
 * `--violet-200` #CCB8FF (Figma.md:34813) avec du blanc dessus mesure 1,77:1.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE THÈME « BLANC » N'A PAS DE PANNEAU
 * ────────────────────────────────────────────────────────────────────────────
 * Le Figma ne dessine qu'un seul panneau, blanc (Figma.md:33616). Des libellés
 * blancs y seraient invisibles : `variante="blanc"` suppose donc une surface
 * sombre fournie par l'appelant (`className="bg-black border-white"`). Je
 * n'invente pas ce panneau — il n'existe nulle part dans l'export.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DEUX PROFILS DE NAVIGATION
 * ────────────────────────────────────────────────────────────────────────────
 * `utilisateur="admin"` (Figma.md:33606) : trois groupes titrés — `Database`
 * (Figma.md:33734), `Jobs` (Figma.md:33905), `Mandats` (Figma.md:34075) — deux
 * entrées chacun, `gap: 24px` entre groupes (Figma.md:33702) et `gap: 4px` dans
 * un groupe (Figma.md:33722).
 * `utilisateur="talent"` (Figma.md:34252) : une liste plate de cinq entrées, sans
 * titre, `gap: 8px` (Figma.md:34348).
 *
 * Les libellés d'entrée ne sont pas récupérables : Figma nomme un calque de texte
 * d'après son premier contenu, et les dix calques s'appellent tous « Les
 * offres » alors que leurs largeurs diffèrent (52 → 104px). Seuls les titres de
 * groupe sont littéraux.
 */

export type VarianteMenu = 'noir' | 'blanc' | 'discret';

type ThemeItem = { repos: string; survol: string; selectionne: string };

const themes: Record<VarianteMenu, ThemeItem> = {
  // Thème « noir » : libellé noir en contexte, fond de survol violet 100.
  noir: {
    repos: 'text-black', // Figma.md:33813 — #000000 en contexte
    survol: 'hover:bg-[var(--violet-100)]', // Figma.md:35010 — #E9E0FF
    // Figma.md:35076 (fond #8657FF) + Figma.md:35113 (texte #371B7E) → 2,98:1,
    // échec AA. Le noir sur ce même fond donne 4,82:1 et passe. Écart assumé.
    selectionne: 'bg-[var(--violet-500)] text-black',
  },
  /**
   * Thème « discret » : pour un index DANS une page, pas pour une destination.
   *
   * ⚠ POURQUOI UNE TROISIÈME VARIANTE PLUTÔT QUE RÉEMPLOYER « noir ».
   * Les deux premières marquent la sélection en `--violet-500` plein, qui est
   * la marque du portail courant dans la barre latérale. Une navigation par
   * ancres — les sections de « Ma fiche » — vit À CÔTÉ de cette barre, à 190px :
   * reprendre le violet plein posait deux « vous êtes ici » de même intensité
   * sur le même écran, et l'œil ne savait plus lequel répondait à « où suis-je
   * dans l'application ». Le violet pâle dit « où suis-je dans la page », ce qui
   * est une autre question.
   */
  discret: {
    repos: 'text-[var(--encre-600)]',
    survol: 'hover:bg-[var(--violet-100)] hover:text-black',
    selectionne: 'bg-[var(--violet-050)] text-black',
  },
  // Thème « blanc » : libellé blanc, à réserver à une surface sombre.
  blanc: {
    repos: 'text-white', // Figma.md:34788 — #FFFFFF
    survol: 'hover:bg-[var(--violet-200)]', // Figma.md:34813 — #CCB8FF
    // Figma.md:34879 (fond #8657FF) + Figma.md:34916 (texte #FFFFFF) → 4,36:1,
    // échec AA. Le noir sur ce même fond donne 4,82:1 et passe. Écart assumé,
    // et cohérent avec la règle dure : le texte est toujours noir.
    selectionne: 'bg-[var(--violet-500)] text-black',
  },
};

/**
 * ElementMenu — l'entrée de navigation.
 *
 * Cotes : ligne, `padding: 8px 4px`, `gap: 8px`, hauteur 35, rayon 4
 * (Figma.md:33756-33772). Les 35px ne sont pas réglés à la main : 8 + 19 (la
 * hauteur de ligne de `t-body-hl`) + 8 = 35. Le jeton `--h-menu-item` vaut 31px
 * et contredit les douze relevés du Figma ; signalé dans les jetons manquants.
 *
 * Le libellé est en `Body/Highlight` (Host Grotesk 500, 14/19 — Figma.md:33804)
 * et l'emoji en `Body/Bold` (Figma.md:33782). L'emoji est décoratif :
 * `aria-hidden`, le sens est dans le libellé.
 *
 * `aria-current="page"` marque l'entrée active pour les aides techniques — sans
 * lui, l'état sélectionné n'existe qu'en couleur, ce que la règle « une
 * information critique n'est jamais portée par la seule couleur » interdit.
 */
/**
 * L'entrée de menu accepte un ÉMOJI ou une ICÔNE, jamais les deux.
 *
 * Le Figma dessine des émojis, et c'est resté le cas par défaut. Mais un
 * appelant qui compose sa propre liste — le sélecteur de vue des écrans
 * connectés — a besoin d'icônes Lucide : à cette taille les émojis rendent
 * inégalement d'une plateforme à l'autre, et ils ne suivent pas la couleur du
 * texte. Le type est une union fermée plutôt que deux props facultatives :
 * une entrée sans aucun visuel, ou avec les deux, ne compile pas.
 */
/**
 * Un émoji, une icône, ou RIEN — et le troisième cas est arrivé après les deux
 * autres.
 *
 * La règle d'origine exigeait un visuel par entrée, ce qui vaut pour la barre
 * latérale : cinq destinations qu'on reconnaît de loin, et une gouttière
 * d'icônes qui aligne les libellés. Un index de sections dans une page n'a rien
 * à reconnaître de loin — il tient dans le champ de lecture, ses libellés sont
 * des phrases, et trois icônes inventées pour satisfaire un type y ajouteraient
 * du bruit sans rien nommer. La gouttière disparaît avec le visuel.
 */
type VisuelElementMenu =
  | { emoji: string; icone?: never }
  | { icone: React.ReactNode; emoji?: never }
  | { emoji?: never; icone?: never };

export function ElementMenu({
  emoji,
  icone,
  libelle,
  href,
  actif,
  desactive,
  variante = 'noir',
}: {
  libelle: string;
  href: string;
  actif?: boolean;
  desactive?: boolean;
  variante?: VarianteMenu;
} & VisuelElementMenu) {
  const theme = themes[variante];
  const visuel = icone ?? emoji;
  const contenu = (
    <>
      {visuel !== undefined && (
        <span aria-hidden="true" className="t-body-bold flex w-5 shrink-0 justify-center">
          {visuel}
        </span>
      )}
      <span className="t-body-hl truncate">{libelle}</span>
    </>
  );
  const classes = cn(
    'flex min-h-[35px] items-center gap-2 rounded-[var(--r-xs)] px-1 py-2', // Figma.md:33762
    desactive
      ? 'cursor-not-allowed text-[var(--encre-300)]'
      : actif
        ? theme.selectionne
        : cn(theme.repos, theme.survol),
  );

  if (desactive) {
    return (
      <li>
        <span className={classes} aria-disabled="true">
          {contenu}
        </span>
      </li>
    );
  }
  return (
    <li>
      <Link href={href} className={classes} aria-current={actif ? 'page' : undefined}>
        {contenu}
      </Link>
    </li>
  );
}

export function Menu({
  sections,
  cheminActif,
  utilisateur = 'admin',
  variante = 'noir',
  onDeconnexion,
  className,
}: {
  sections: {
    titre?: string;
    // Élargi au même `VisuelElementMenu` que `ElementMenu` : une entrée porte
    // un émoji OU une icône, jamais les deux, jamais aucun. Ajout purement
    // additif — le rendu ne change pas, `{...e}` transmettait déjà `icone`.
    entrees: ({ libelle: string; href: string; desactive?: boolean } & VisuelElementMenu)[];
  }[];
  cheminActif?: string;
  /** `admin` = groupes titrés (Figma.md:33606) ; `talent` = liste plate (Figma.md:34252). */
  utilisateur?: 'admin' | 'talent';
  variante?: VarianteMenu;
  onDeconnexion?: () => void;
  className?: string;
}) {
  return (
    <nav
      aria-label="Navigation principale"
      className={cn(
        // Figma.md:33606 — 180×830, padding 16px 8px, bordure noire 2px, rayon 16.
        // `pb-[43px]` réserve la place du bouton de déconnexion posé en absolu :
        // 19px de marge basse + 24px d'icône.
        'relative flex w-[180px] flex-col px-2 pb-[43px] pt-4',
        'rounded-[var(--r-lg)] border-2 border-black bg-white',
        utilisateur === 'talent' ? 'gap-[73px]' : 'gap-12', // Figma.md:34259 / 33613
        className,
      )}
    >
      {/* Figma.md:33631 — le cadre `Logo` mesure 164×29.79 parce qu'il est étiré
          (`align-self: stretch`), mais le MOT est masqué : la couche `pachamama`
          porte `visibility: hidden` dans les deux seules occurrences de
          l'application (Figma.md:33648 et Figma.md:34294). Les seuls tracés
          visibles vont de `left: 0%` à `right: 83.42%` (Figma.md:33667, 33681),
          soit 16,58 % de 164px = 27,2px de large sur 29,79 de haut — un rapport
          de 0,913, celui du monogramme (viewBox 30/33 = 0,909). L'application
          n'affiche donc que le « P ». La troisième et dernière occurrence du
          mot-symbole (Figma.md:60130) est dans la planche du composant logo, pas
          dans un écran.
          L'encre du monogramme suit `currentColor` et son papier
          `--logo-papier` : une surface sombre (`variante="blanc"`) doit donc
          poser elle-même la teinte du logo. */}
      <Monogramme taille="grand" className="h-[29.79px]" />

      <div className={cn('flex flex-col', utilisateur === 'talent' ? 'gap-2' : 'gap-6')}>
        {sections.map((s, i) => (
          <div key={s.titre ?? `section-${i}`} className="flex flex-col gap-1">
            {s.titre && (
              // Figma.md:33734 — `Title/H3` Bricolage Grotesque 700 18/22, #AB8AFF.
              // `--violet-300` sur blanc mesure 2,69:1 : ce titre échoue AA. Le
              // Figma le prescrit, on l'applique et on le signale ; `--violet-700`
              // (8,91:1) serait le repli.
              <p className="t-h3 px-1 text-[var(--violet-300)]">{s.titre}</p>
            )}
            <ul className="flex flex-col gap-1">
              {s.entrees.map((e) => (
                <ElementMenu
                  key={e.href}
                  {...e}
                  variante={variante}
                  actif={cheminActif === e.href}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Figma.md:34225 — `icon-log-out` 24×24, centré, `bottom: 19px`. Le Figma
          ne montre aucun libellé : le contrôle est donc icône seule, ce qui rend
          `aria-label` obligatoire. */}
      <button
        type="button"
        onClick={onDeconnexion}
        aria-label="Se déconnecter"
        className={cn(
          'absolute bottom-[19px] left-1/2 -translate-x-1/2',
          'grid size-6 place-items-center rounded-[var(--r-xs)]',
          variante === 'blanc' ? 'text-white' : 'text-black',
        )}
      >
        <Icone nom="icon-log-out" className="size-6" />
      </button>
    </nav>
  );
}
