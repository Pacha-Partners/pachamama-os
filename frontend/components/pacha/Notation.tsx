import { cn } from '@/lib/utils';

/**
 * Notation — la note d'un candidat. Ce n'est PAS un système d'étoiles.
 *
 * Le Figma croise deux axes : `Rating={Bad, Good, Excellent, Undefined}` ×
 * `Size={Small, Medium}`, soit huit variantes (Figma.md:24177 à 24460). Le
 * relevé donne une échelle EMOJI, pas une échelle graduée :
 *
 *   Bad        👎   Figma.md:24420
 *   Good       👍   Figma.md:24258
 *   Excellent  🔥   Figma.md:24177
 *   Undefined  👀   Figma.md:24339
 *
 * Deux composants distincts se superposent dans le fichier, et il faut les
 * garder distincts :
 *
 *   `Rating icon`     le glyphe seul, 10px en Small / 14px en Medium
 *                     Figma.md:24158
 *   `Candidate rating` le glyphe DANS une pastille ronde blanche — 18px en
 *                     Small, 22px en Medium, padding 4px, rayon plein, ni
 *                     bordure ni ombre. Figma.md:24521, 24535, 24583
 *
 * En contexte, la pastille est posée en badge sur l'avatar (`left: -4px;
 * top: -6px`, Figma.md:24759) : le blanc y sert de détachement contre la photo.
 * Sur une carte blanche, elle devient invisible — d'où `pastille={false}`, qui
 * rend le glyphe nu (le composant `Rating icon` du Figma).
 *
 * `Number screened` (Figma.md:29550), cité comme piste, n'appartient pas à ce
 * composant : c'est une tuile de KPI de tableau de bord (chiffre en Title/H2,
 * 178×61) — hors périmètre.
 *
 * ACCESSIBILITÉ — la note est une information critique et un emoji n'est pas un
 * mot. L'emoji est donc `aria-hidden`, et le sens est porté par un texte
 * `sr-only`. `Undefined` n'est pas une absence : c'est « pas encore évalué », un
 * état qui se dit.
 */

export type Note = 'mauvais' | 'bon' | 'excellent' | 'indefini';

const emojis: Record<Note, string> = {
  mauvais: '👎', // Rating=Bad
  bon: '👍', // Rating=Good
  excellent: '🔥', // Rating=Excellent
  indefini: '👀', // Rating=Undefined
};

/** Le texte qui porte réellement l'information. */
const libelles: Record<Note, string> = {
  mauvais: 'Note : mauvais',
  bon: 'Note : bon',
  excellent: 'Note : excellent',
  indefini: 'Non évalué',
};

/**
 * Cotes de la pastille. Figma.md:24531 (Small 18px) et 24593 (Medium 22px),
 * padding 4px, `border-radius: 100000px` (Figma.md:24535) → --r-full.
 */
const pastilles = {
  sm: 'size-[18px] p-1',
  md: 'size-[22px] p-1',
} as const;

/**
 * Cotes du glyphe. Le Small est en 10px/12px : c'est la classe `t-micro-hl`
 * (graisse 500 relevée dans le Figma, Figma.md:24204).
 *
 * ÉCART FIDÈLE : en Medium, trois notes sur quatre sont en 14px, graisse 400
 * (Figma.md:24245-24246), mais `Undefined` est en 12px (Figma.md:24408). Le glyphe 👀
 * est plus large que les trois autres — la réduction est intentionnelle, je la
 * garde plutôt que de l'uniformiser.
 */
const glyphes: Record<'sm' | 'md', Record<Note, string>> = {
  sm: { mauvais: 't-micro-hl', bon: 't-micro-hl', excellent: 't-micro-hl', indefini: 't-micro-hl' },
  md: { mauvais: 't-body', bon: 't-body', excellent: 't-body', indefini: 't-caption' },
};

export function Notation({
  note,
  taille = 'md',
  pastille = true,
  className,
}: {
  note: Note;
  taille?: 'sm' | 'md';
  /** `false` rend le composant `Rating icon` : le glyphe sans sa pastille. */
  pastille?: boolean;
  className?: string;
}) {
  const glyphe = (
    <>
      <span aria-hidden="true" className={cn('leading-none', glyphes[taille][note])}>
        {emojis[note]}
      </span>
      <span className="sr-only">{libelles[note]}</span>
    </>
  );

  if (!pastille) {
    return <span className={cn('inline-grid place-items-center', className)}>{glyphe}</span>;
  }

  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-[var(--r-full)] bg-white',
        pastilles[taille],
        className,
      )}
    >
      {glyphe}
    </span>
  );
}
