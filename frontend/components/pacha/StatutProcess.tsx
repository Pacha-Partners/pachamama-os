import { cn } from '@/lib/utils';

/**
 * StatutProcess — les onze étapes du pipeline, relevées caractère pour caractère.
 *
 * Ce composant n'est pas décoratif : c'est le vocabulaire métier de Pachamama
 * rendu visible, et le moindre écart de libellé fait mentir un kanban. Emojis,
 * libellés, fonds et couleurs de texte viennent tous du jeu de variantes
 * `Property 1=…` du Figma (Figma.md:9336-9787). L'ordre du tableau est celui
 * des `top:` du fichier, c'est-à-dire l'ordre réel du pipeline.
 *
 * TROIS AVERTISSEMENTS, tous repris dans docs/ds-jetons-manquants-lot4.md :
 *
 * 1. Les fonds ne sont PAS ceux des jetons `--statut-*` de app.css. Deux
 *    coïncident (#FFEA4D = --statut-attente, #8657FF = --violet-500), deux non :
 *    le vert du Figma est #58D5A7 (et non #79E6BE) et le rouge #F47777 (et non
 *    #F4728A). On écrit donc les valeurs littérales, c'est le fichier qui fait foi.
 *
 * 2. Le Figma met du texte BLANC sur les quatre fonds saturés (lignes citées
 *    dans le tableau). C'est une entorse à la règle « le texte est toujours
 *    noir » : assumée sur le violet (exception connue de la charte), mais sur
 *    #58D5A7 et #F47777 le contraste tombe à 1,8:1 et 2,7:1 — sous le seuil AA.
 *    Le fichier fait foi donc on le suit ; passer ces deux-là en texte noir
 *    (11,5:1 et 7,8:1) est une décision de design, pas de code.
 *
 * 3. « Send Out » existe en deux exemplaires, vert et violet. Le Figma ne les
 *    distingue que par la couleur : aucun libellé, aucune annotation ne dit
 *    lequel est le send-out Pachamama et lequel celui du client. Les clés
 *    restent donc `send-out-vert` / `send-out-violet` — nommer l'un « client »
 *    serait inventer une sémantique absente du fichier. Position dans le
 *    pipeline : le vert précède le violet (top 224 puis top 275).
 *
 * L'emoji est stocké séparément du libellé pour pouvoir être masqué aux
 * lecteurs d'écran : le sens est porté par le texte, jamais par l'emoji seul.
 */
export const ETAPES = [
  'applicants',
  'a-contacter',
  'contacte',
  'screen-pachamama',
  'send-out-vert',
  'send-out-violet',
  'interview-1',
  'interview-2',
  'interview-finale',
  'recrute',
  'ko',
] as const;

export type Etape = (typeof ETAPES)[number];

type DefinitionEtape = {
  /** Décoratif : rendu en aria-hidden. */
  emoji: string;
  libelle: string;
  /** Classe de fond — valeur littérale du Figma, faute de jeton. */
  fond: string;
  /** Classe de couleur de texte — relevée, pas déduite. */
  texte: string;
};

export const ETAPES_PROCESS: Record<Etape, DefinitionEtape> = {
  'applicants':       { emoji: '⚡️', libelle: 'Applicants', fond: 'bg-[#8657FF]', texte: 'text-black' }, // Figma.md:9623 — fond :9638, texte :9655
  'a-contacter':      { emoji: '📩', libelle: 'To contact', fond: 'bg-[#FFEA4D]', texte: 'text-black' }, // Figma.md:9582 — fond :9597, texte :9614
  'contacte':         { emoji: '📨', libelle: 'Contacted', fond: 'bg-[#FFEA4D]', texte: 'text-black' }, // Figma.md:9541 — fond :9556, texte :9573
  'screen-pachamama': { emoji: '🎤', libelle: 'Screen by Pachamama', fond: 'bg-[#FFEA4D]', texte: 'text-black' }, // Figma.md:9500 — fond :9515, texte :9532
  'send-out-vert':    { emoji: '👌', libelle: 'Send Out', fond: 'bg-[#58D5A7]', texte: 'text-black' }, // Figma.md:9336 — fond :9351, texte :9368
  'send-out-violet':  { emoji: '👌', libelle: 'Send out', fond: 'bg-[#8657FF]', texte: 'text-black' }, // Figma.md:9459 — fond :9474, texte :9491
  'interview-1':      { emoji: '🎤', libelle: 'Interview 1', fond: 'bg-[#FFEA4D]', texte: 'text-black' }, // Figma.md:9746 — fond :9761, texte :9778
  'interview-2':      { emoji: '🎤', libelle: 'Interview 2', fond: 'bg-[#FFEA4D]', texte: 'text-black' }, // Figma.md:9418 — fond :9433, texte :9450
  'interview-finale': { emoji: '🎙', libelle: 'Final Interview', fond: 'bg-[#FFEA4D]', texte: 'text-black' }, // Figma.md:9705 — fond :9720, texte :9737
  'recrute':          { emoji: '🙌', libelle: 'Hired', fond: 'bg-[#58D5A7]', texte: 'text-black' }, // Figma.md:9664 — fond :9679, texte :9696
  'ko':               { emoji: '🙅🏻‍♀️', libelle: 'KO', fond: 'bg-[#F47777]', texte: 'text-black' }, // Figma.md:9377 — fond :9392, texte :9409
};

/**
 * La pastille pleine — la forme canonique du statut.
 *
 * Cotes du Figma : padding 8px, gap 8px, hauteur 35px, rayon complet, texte
 * Body/Highlight (Figma.md:9339-9366). 8 + 19 + 8 = 35 : la hauteur tombe juste.
 */
export function StatutProcess({
  etape,
  className,
  ...reste
}: { etape: Etape } & Omit<React.ComponentProps<'span'>, 'children'>) {
  const d = ETAPES_PROCESS[etape];
  return (
    <span
      className={cn(
        // Figma.md:9342 padding 8px · :9343 gap 8px · :9347 hauteur 35px · :9352 rayon complet
        'inline-flex h-[var(--h-statut)] items-center gap-2 rounded-[var(--r-full)] px-2',
        't-body-hl whitespace-nowrap',
        d.fond,
        d.texte,
        className,
      )}
      {...reste}
    >
      <span aria-hidden="true">{d.emoji}</span>
      {d.libelle}
    </span>
  );
}

/**
 * La forme TEXTUELLE du même statut — le calque `Interview status` du Figma.
 *
 * Sur une carte candidat, le statut n'est pas une pastille : c'est une ligne de
 * légende grise (Figma.md:25244-25281, « 🎤 Interview 1 » en Caption/Regular
 * #ADABB3). Même vocabulaire, autre régime de surface — d'où un composant
 * distinct plutôt qu'une prop `taille` sur la pastille, qui aurait laissé croire
 * que le fond coloré survit à la réduction.
 */
export function StatutTexte({ etape, className }: { etape: Etape; className?: string }) {
  const d = ETAPES_PROCESS[etape];
  return (
    <span className={cn('t-caption text-[var(--encre-250)]', className)}>
      <span aria-hidden="true">{d.emoji}</span> {d.libelle}
    </span>
  );
}

/**
 * CompteurStatut — « Candidat.e.s : 2 », l'en-tête de colonne du kanban.
 * Libellé et écriture inclusive recopiés du Figma (Figma.md:30243 et :31026).
 */
export function CompteurStatut({ nombre, className }: { nombre: number; className?: string }) {
  return (
    <p className={cn('t-caption text-[var(--encre-300)]', className)}>
      Candidat.e.s&nbsp;: {nombre}
    </p>
  );
}

/**
 * TuileCompteur — le chiffre d'un statut, en tuile de tableau de bord.
 *
 * Figma : `Number screened`, `Number send-out`, `Number interviews`,
 * `Number final interview` (Figma.md:29550, :29594, :29638, :29682) — fond
 * blanc, rayon 8, padding 16, chiffre en Title/H2.
 *
 * ÉCART ASSUMÉ : le Figma n'exporte que le chiffre, sans libellé. Un nombre nu
 * ne veut rien dire dans un tableau de bord, donc `libelle` est obligatoire et
 * visible. Le 🚨 reprend celui posé à côté du chiffre en Figma.md:29525.
 */
export function TuileCompteur({
  nombre,
  libelle,
  alerte,
  className,
}: {
  nombre: number;
  libelle: string;
  /** Signale un chiffre qui demande une action — le 🚨 du Figma. */
  alerte?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Figma.md:29557 padding 16px · :29563 fond blanc · :29564 rayon 8px · :29560 largeur 178px
        'flex min-w-[178px] flex-1 flex-col items-center justify-center gap-1 rounded-[var(--r-md)] bg-[var(--fond-carte)] p-4',
        className,
      )}
    >
      <span className="flex items-center gap-1">
        <span className="t-h2">{nombre}</span>
        {alerte && (
          <span className="t-h2">
            <span aria-hidden="true">🚨</span>
            <span className="sr-only">à traiter</span>
          </span>
        )}
      </span>
      <span className="t-caption text-center text-[var(--encre-500)]">{libelle}</span>
    </div>
  );
}
