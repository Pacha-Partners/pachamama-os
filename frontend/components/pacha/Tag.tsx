'use client';

import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Les tags — quatre familles, quatre cotes DIFFÉRENTES, et c'est le point.
 *
 * Ma première version leur donnait une base commune (27px, padding 4/8). Le
 * relevé la démonte : le Figma dessine trois hauteurs et deux ombres.
 *
 *   TagUnivers   27px · padding 4px 8px · ombre -1px noire · fond de verticale
 *                Figma.md:58136, 58218, 58299, 58381
 *   TagContrat   22px · padding 3px 7px · ombre -1px noire OU GRISE · 12px
 *                Figma.md:47056 à 47667
 *   TagInfo      35px · padding 8px    · ombre -2px noire · fond blanc
 *                Figma.md:58059
 *   TagAction    35px · padding 8px    · SANS ombre ni bordure · fond violet
 *                Figma.md:18616, 18659, 18703
 *
 * Aligner ces quatre-là dans le même groupe ne marche pas, et le Figma ne le
 * fait jamais : ils vivent dans des zones différentes de l'écran.
 *
 * Le rayon est 8px partout (`border-radius: 8px` = --r-md) pour les trois
 * premiers ; TagAction aussi. Ce n'est PAS 5px : les 35 occurrences de
 * `border-radius: 5px` du fichier sont toutes précédées de `border: 1px dashed`
 * (vérifié 35/35) — ce sont les cadres de jeu de variantes de Figma.
 *
 * Le texte est noir partout, sans exception, et l'emoji est décoratif.
 */

/* ─────────────────────────────────  Retrait  ───────────────────────────────── */

/**
 * La croix de retrait. Le Figma la nomme `Close` : 12×12, glyphe 7,5px, noir
 * plein (Figma.md:58170 à 58200). En `Light mode`, elle passe au gris comme le
 * reste du tag (Figma.md:47410).
 *
 * Elle vient de `lucide-react` et non du `Icone` du LOT 1, volontairement :
 * Tag.tsx est importé par trois autres lots, autant lui épargner une
 * dépendance de plus.
 */
function BoutonRetirer({
  onClick,
  libelle,
  attenue,
}: {
  onClick: () => void;
  libelle: string;
  attenue?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Retirer ${libelle}`}
      className={cn(
        'relative grid size-3 shrink-0 place-items-center',
        // Cible tactile élargie sans toucher au flux : le tag garde sa cote.
        "after:absolute after:-inset-1.5 after:content-['']",
        attenue ? 'text-[var(--encre-300)]' : 'text-black',
      )}
    >
      <X className="size-3" strokeWidth={2.5} aria-hidden="true" />
    </button>
  );
}

/* ─────────────────────────────────  Univers  ───────────────────────────────── */

export type Univers = 'people' | 'product' | 'tech' | 'sales';

/**
 * Le fond porte la verticale, le texte reste noir. Les quatre teintes du Figma,
 * relevées une par une — et deux d'entre elles ne tombent pas exactement sur un
 * jeton de marque :
 *
 *   Product #FFD2C2 = --product-200            exact      Figma.md:58136
 *   Tech    #E9E0FF = --violet-100             exact      Figma.md:58218
 *   People  #FFFBF0 = aucun jeton de verticale (= --fond-entete)  Figma.md:58299
 *   Sales   #CCF5E6 ≈ --revenue-200 (#CAF5E5), 2 unités d'écart   Figma.md:58381
 *
 * Le cas Tech mérite un mot : le Figma prend le violet d'INTERFACE, pas le
 * --tech-200 de la marque (#DED1FF). Les deux teintes sont proches mais
 * distinctes. Le Figma gouvernant l'interface, je pose --violet-100 — en notant
 * que c'est le seul tag de verticale peint avec la rampe interactive.
 *
 * Contraste : toutes ces teintes sont claires, le texte noir y passe AAA.
 */
const fondsUnivers: Record<Univers, string> = {
  product: 'bg-[var(--product-200)]',
  tech: 'bg-[var(--violet-100)]',
  people: 'bg-[#fffbf0]', // sans jeton — consigné dans docs/ds-jetons-manquants-lot3.md
  sales: 'bg-[#ccf5e6]', // sans jeton exact — idem
};

const libellesUnivers: Record<Univers, string> = {
  product: 'Product',
  tech: 'Tech',
  people: 'People',
  sales: 'Sales',
};

/**
 * TagUnivers. À noter : dans le Figma, les quatre variantes portent le MÊME
 * texte de remplissage (`🐓 Boîte FR`) — le libellé est donc libre, seule la
 * teinte est liée à l'univers. D'où `children` en option, qui l'emporte sur le
 * libellé par défaut.
 */
export function TagUnivers({
  univers,
  onRetirer,
  children,
  className,
}: {
  univers: Univers;
  onRetirer?: () => void;
  children?: React.ReactNode;
  className?: string;
}) {
  const libelle = children ?? libellesUnivers[univers];
  return (
    <span
      className={cn(
        // Figma.md:58130 — padding 4px 8px, gap 4px, height 27px
        'inline-flex h-[var(--h-tag)] items-center gap-1 px-2 py-1',
        'rounded-[var(--r-md)] border border-black shadow-[var(--ombre-1)]',
        't-body-hl text-black', // Body/Highlight, 14px/500 — Figma.md:58156
        'whitespace-nowrap',
        fondsUnivers[univers],
        className,
      )}
    >
      {libelle}
      {onRetirer && (
        <BoutonRetirer onClick={onRetirer} libelle={libellesUnivers[univers]} />
      )}
    </span>
  );
}

/* ─────────────────────────────────  Contrat  ───────────────────────────────── */

/**
 * Type OUVERT à dessein. Le Figma ne dessine que CDI et Freelance
 * (Figma.md:47056 et 47413), alors que les données de l'app portent d'autres
 * contrats (régie, stage, alternance…). Fermer l'union obligerait à inventer
 * une teinte par contrat — interdit. Les valeurs hors Figma sont donc rendues
 * en NEUTRE : fond blanc, bordure noire, pas d'emoji, libellé tel quel.
 */
export type Contrat = 'cdi' | 'freelance' | (string & {});

/** L'emoji fait partie du vocabulaire de marque, et il est décoratif. */
const emojisContrat: Record<string, string> = {
  cdi: '🤝', // Figma.md:47099
  freelance: '⚡', // Figma.md:47456
};

const libellesContrat: Record<string, string> = {
  cdi: 'CDI', // Figma.md:47120
  freelance: 'Freelance', // Figma.md:47477
};

/**
 * Le fond de l'état `Focus=True`. C'EST LÀ, et nulle part ailleurs, que le
 * contrat prend une couleur :
 *
 *   CDI       #FFE8E0 ≈ --product-100 (#FFE9E1), 1 unité d'écart  Figma.md:47189
 *   Freelance #E9E0FF = --violet-100                              Figma.md:47546
 *
 * Ma version précédente peignait le freelance en violet EN PERMANENCE, via une
 * bordure --violet-300. C'était faux sur deux points : le Figma laisse le tag
 * blanc à bordure noire au repos (Figma.md:47070), et la couleur n'apparaît
 * qu'au focus. En revanche l'intuition « freelance = violet » est confirmée par
 * les jetons de marque : `--freelance: var(--tech-500)` et
 * `--freelance-light: var(--tech-light)` (styles/brand/colors.css:75-76). Le
 * violet du focus freelance est donc bien la teinte du contrat, pas un hasard.
 *
 * Attention au faux ami : `Focus` ne veut pas dire « focus clavier ». C'est un
 * état métier — le contrat visé, mis en avant. Le focus clavier reste l'anneau
 * global d'app.css.
 */
const fondsFocus: Record<string, string> = {
  cdi: 'bg-[#ffe8e0]', // sans jeton exact — consigné
  freelance: 'bg-[var(--violet-100)]',
};

export function TagContrat({
  contrat,
  focus,
  attenue,
  onRetirer,
  className,
  /** Alias historique de `attenue`, conservé pour ne casser aucun appel. */
  desactive,
}: {
  contrat: Contrat;
  /** `Focus=True` du Figma : le contrat visé, souligné par un fond teinté. */
  focus?: boolean;
  /** `Light mode=True` du Figma : le tag s'efface, tout passe en gris. */
  attenue?: boolean;
  onRetirer?: () => void;
  className?: string;
  desactive?: boolean;
}) {
  const cle = contrat.toLowerCase();
  const connu = cle in libellesContrat;
  const libelle = libellesContrat[cle] ?? contrat;
  const emoji = emojisContrat[cle];
  const efface = attenue ?? desactive ?? false;

  return (
    <span
      className={cn(
        // Figma.md:47064 — padding 3px 7px, gap 4px, height 22px, rayon 8px
        'inline-flex h-[22px] items-center gap-1 px-[7px] py-[3px]',
        'rounded-[var(--r-md)] border',
        't-caption-hl whitespace-nowrap', // Caption/Highlight 12px/500 — Figma.md:47128
        efface
          ? // Light mode=True : bordure, ombre, texte ET croix en #A8B1BD.
            // L'ombre grise a son jeton : --ombre-1-grise. Figma.md:47309-47310
            'border-[var(--encre-300)] bg-white text-[var(--encre-300)] shadow-[var(--ombre-1-grise)]'
          : 'border-black text-black shadow-[var(--ombre-1)]', // Figma.md:47071-47072
        // Le fond : blanc au repos, teinté au focus. Un contrat inconnu du
        // Figma reste blanc même en focus — on n'invente pas sa teinte.
        !efface && (focus ? (fondsFocus[cle] ?? 'bg-white') : 'bg-white'),
        className,
      )}
    >
      {connu && emoji && <span aria-hidden="true">{emoji}</span>}
      {libelle}
      {onRetirer && <BoutonRetirer onClick={onRetirer} libelle={libelle} attenue={efface} />}
    </span>
  );
}

/* ──────────────────────────────────  Info  ─────────────────────────────────── */

/**
 * TagInfo — le composant `Tag information` (Figma.md:58059) : fond blanc,
 * bordure noire, ombre -2px, 35px de haut, padding 8px, gap 8px.
 *
 * Le fichier se contredit sur l'ombre : le composant nommé porte -2px 2px
 * (Figma.md:58077), ses instances posées sur les écrans portent -3px 3px
 * (Figma.md:36992, 42711, 43716, 44845). Le composant nommé fait foi ; la
 * variante -3px est accessible par `regime='accroche'` pour les cartes.
 *
 * Libellés relevés dans le Figma, emoji inclus : « 🐓 Boîte FR »,
 * « ✌️ Cible user sympa », « ✅️ Qualifié.e », « 🤝 », « 👀 ». L'emoji est
 * décoratif : il double une information déjà portée par le texte.
 */
export function TagInfo({
  emoji,
  regime = 'travail',
  children,
  className,
}: {
  emoji?: string;
  /** `travail` = ombre -2px (le composant nommé) · `accroche` = -3px (les cartes). */
  regime?: 'travail' | 'accroche';
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        // Figma.md:58068 — padding 8px, gap 8px, height 35px
        'inline-flex h-[var(--h-statut)] items-center gap-2 px-2',
        'rounded-[var(--r-md)] border border-black bg-white',
        regime === 'accroche' ? 'shadow-[var(--ombre-3)]' : 'shadow-[var(--ombre-2)]',
        't-body text-black', // Body/Regular 14px/400 — Figma.md:58090
        'whitespace-nowrap',
        className,
      )}
    >
      {emoji && <span aria-hidden="true">{emoji}</span>}
      {children}
    </span>
  );
}

/* ─────────────────────────────────  Action  ────────────────────────────────── */

/**
 * TagAction — le composant `Tag action` (Figma.md:18584).
 *
 * Axe réel relevé : `State={Default, Hover, Selected}`. Il n'y a PAS d'axe
 * `Color` ici : les seules variantes `Color={Main, Lila, Purple}` du fichier
 * appartiennent à `Button lateral opening` (Figma.md:47945 à 48350), un autre
 * composant. Vérifié : 6 occurrences de `Color=`, toutes dans ce bloc-là.
 *
 *   Default  fond #F8F5FF = --violet-050, texte noir            Figma.md:18616
 *   Hover    fond #CCB8FF = --violet-200 + ombre douce, noir    Figma.md:18659
 *   Selected fond #371B7E = --violet-900, TEXTE BLANC           Figma.md:18703
 *
 * Deux remarques d'accessibilité, mesurées :
 * · Le fond de survol --violet-200 en texte noir est confortable.
 * · L'état sélectionné est la seule exception connue au « texte toujours noir »
 *   dans ce lot. Elle tient : blanc sur #371B7E est très contrasté (fond très
 *   sombre), là où blanc sur --violet-500 échouerait AA (4,36). Le Figma ne
 *   prescrit jamais ce dernier cas ici.
 *
 * Ni bordure ni ombre rétro : c'est un contrôle de filtre, régime « travail ».
 */
export function TagAction({
  actif,
  appui,
  className,
  children,
  ...reste
}: React.ComponentProps<'button'> & {
  /** `State=Selected` du Figma. */
  actif?: boolean;
  /**
   * Ancien axe à trois niveaux, conservé pour ne casser aucun appel existant.
   * Le Figma n'a que deux états au repos : `fort` devient l'état sélectionné,
   * `faible` et `moyen` retombent sur Default — le niveau intermédiaire était
   * le survol, qui n'est pas un état persistant.
   */
  appui?: 'faible' | 'moyen' | 'fort';
}) {
  const selectionne = actif ?? appui === 'fort';
  return (
    <button
      type="button"
      aria-pressed={selectionne}
      className={cn(
        // Figma.md:18610 — padding 8px, gap 8px, height 35px, rayon 8px
        'inline-flex h-[var(--h-statut)] items-center gap-2 rounded-[var(--r-md)] px-2',
        't-body whitespace-nowrap', // Body/Regular 14px — Figma.md:18634
        'transition-colors duration-150',
        selectionne
          ? 'bg-[var(--violet-900)] text-white'
          : cn(
              'bg-[var(--violet-050)] text-black',
              // L'ombre douce du survol n'est pas une ombre rétro : c'est de
              // l'élévation, et app.css autorise le flou dans ce seul cas.
              'hover:bg-[var(--violet-200)] hover:shadow-[var(--ombre-douce)]',
            ),
        className,
      )}
      {...reste}
    >
      {children}
    </button>
  );
}
