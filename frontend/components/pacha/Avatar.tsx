'use client';

import { Avatar as AvatarBase } from '@base-ui/react/avatar';

import { cn } from '@/lib/utils';

/**
 * Avatar — la photo de quelqu'un, et son repli quand il n'y en a pas.
 *
 * TAILLES RELEVÉES (le Figma n'a pas d'échelle nommée, il a quatre usages) :
 *   30  `Candidate picture` / `Candidate image` — ligne de tableau (Figma.md:24709, 24729)
 *   38  bloc « User » de l'en-tête (Figma.md:11705)
 *   42  `Agent name` — l'agent qui suit le dossier (Figma.md:16311)
 *   56  `Client Image` — carte client (Figma.md:6733)
 *
 * FORMES. Le Figma est net et contre-intuitif : les photos de candidat et de
 * client sont CARRÉES, sans rayon, cerclées d'un filet `1px solid #E7E6EB`
 * (Figma.md:24736, 6741) ; seule la photo d'agent est ronde
 * (`border-radius: 218px` sur un carré de 42 — Figma.md:16316, autrement dit un
 * cercle). Le filet gris n'est pas décoratif : sur une photo claire, il empêche
 * l'image de fondre dans la ligne blanche. La photo de l'en-tête, elle, n'a ni
 * filet ni rayon (Figma.md:11705) — d'où la prop `bordure`.
 *
 * REPLI. Une URL de photo casse : compte supprimé, CDN indisponible, lien
 * expiré. `Avatar.Image` / `Avatar.Fallback` de Base UI suivent l'état réel du
 * chargement et basculent sur les initiales à l'échec — un `<img>` nu afficherait
 * l'icône d'image brisée du navigateur et, surtout, garderait sa boîte : la mise
 * en page ne bouge pas ici parce que la taille est portée par le conteneur, pas
 * par l'image.
 *
 * ACCESSIBILITÉ. `alt=""` par défaut, volontairement : l'avatar accompagne
 * presque toujours le nom écrit à côté (voir `AvatarNom`). Le décrire une
 * seconde fois ferait dire « Marion Darnet Marion Darnet » à un lecteur d'écran.
 * `alt` reste disponible pour le cas rare de l'avatar seul.
 */
const tailles = {
  30: 'size-[30px]',
  38: 'size-[38px]',
  42: 'size-[42px]',
  56: 'size-[56px]',
} as const;

export type TailleAvatar = keyof typeof tailles;

export function Avatar({
  nom,
  src,
  taille = 30,
  forme = 'carre',
  bordure = true,
  alt = '',
  className,
}: {
  /** Sert aux initiales du repli. Toujours requis, même avec une photo. */
  nom: string;
  src?: string | null;
  taille?: TailleAvatar;
  forme?: 'carre' | 'rond';
  /** Le filet `1px --encre-100` du Figma. Faux pour l'avatar de l'en-tête. */
  bordure?: boolean;
  /** Vide par défaut : l'avatar est décoratif à côté du nom en texte. */
  alt?: string;
  className?: string;
}) {
  return (
    <AvatarBase.Root
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden bg-white',
        tailles[taille],
        forme === 'rond' ? 'rounded-[var(--r-full)]' : '', // Figma.md:16316 — border-radius: 218px
        bordure && 'border border-[var(--encre-100)]', // Figma.md:24736 — 1px solid #E7E6EB
        className,
      )}
    >
      {src ? <AvatarBase.Image src={src} alt={alt} className="size-full object-cover" /> : null}
      <AvatarBase.Fallback
        // `t-caption-bold` = Caption/Bold du Figma. Les initiales sont du texte
        // noir sur violet clair : `--violet-100` est le fond de survol du DS, le
        // plus clair de la rampe qui reste visible sur blanc (noir dessus : 18,9).
        className="t-caption-bold grid size-full place-items-center bg-[var(--violet-100)] text-black"
      >
        {initiales(nom)}
      </AvatarBase.Fallback>
    </AvatarBase.Root>
  );
}

/**
 * AvatarNom — la composition `Agent name` du Figma (Figma.md:16286).
 *
 * Conteneur : ligne, `padding: 4px`, `gap: 10px`, rayon 4 (Figma.md:16288-16297).
 * Le nom est en `Body/Bold` noir (Figma.md:16325-16334) : c'est le nom qui porte
 * l'information, l'avatar n'est qu'un repère visuel — d'où `alt=""`.
 */
export function AvatarNom({
  nom,
  src,
  taille = 42,
  forme = 'rond',
  className,
}: {
  nom: string;
  src?: string | null;
  taille?: TailleAvatar;
  forme?: 'carre' | 'rond';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2.5 rounded-[var(--r-xs)] p-1', // Figma.md:16288 — padding 4, gap 10, radius 4
        className,
      )}
    >
      <Avatar nom={nom} src={src} taille={taille} forme={forme} bordure={forme === 'carre'} />
      <span className="t-body-bold truncate text-black">{nom}</span>
    </span>
  );
}

/**
 * Deux initiales au plus. On coupe sur les espaces et les traits d'union, sinon
 * « Jean-Luc Picard » donnerait « JP » au lieu de « JL » — et les noms composés
 * sont fréquents dans la base.
 */
export function initiales(nom: string): string {
  const mots = nom.trim().split(/[\s-]+/).filter(Boolean);
  if (mots.length === 0) return '?';
  return mots
    .slice(0, 2)
    .map((m) => [...m][0]?.toUpperCase() ?? '')
    .join('');
}
