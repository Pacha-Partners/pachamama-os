import { cn } from '@/lib/utils';

/**
 * Squelette — la forme de ce qui n'est pas encore arrivé.
 *
 * POURQUOI PAS UN TOURNIQUET. Un spinner dit « attendez » et rien d'autre : la
 * page reste vide, puis saute quand le contenu tombe. Un squelette dit « il y
 * aura trois lignes de texte ici et une carte là », réserve la place exacte, et
 * le contenu s'y substitue sans déplacer ce qui est autour. Sur un portail où
 * l'on charge sept mille candidatures, ce saut de mise en page est la première
 * chose qu'on remarque.
 *
 * TOUS LES SQUELETTES SONT `aria-hidden`, SANS EXCEPTION. Un lecteur d'écran
 * n'a rien à faire d'une barre grise, et les annoncer une par une produirait un
 * bavardage inutilisable. C'est au conteneur qui possède l'état de chargement
 * d'annoncer « chargement en cours » dans une région vivante — `Tableau` le
 * fait, et tout écran qui pose des squelettes doit le faire aussi. Un squelette
 * muet posé sur une page muette est un écran vide pour qui n'y voit pas.
 *
 * LA PULSATION est `animate-pulse` de Tailwind, doublée d'un
 * `motion-reduce:animate-none` explicite. La couche `base` d'`app.css` réduit
 * déjà toutes les animations à 0,01 ms sous `prefers-reduced-motion` — ce qui
 * les fige à une opacité arbitraire. Le `animate-none` les arrête proprement,
 * à pleine opacité.
 *
 * LES LARGEURS SONT INÉGALES, et c'est le point. Une pile de barres identiques
 * lit comme un motif de chargement générique ; des longueurs variées lisent
 * comme du texte. La dernière ligne d'un paragraphe est toujours plus courte.
 */

const SOCLE = 'block animate-pulse rounded-[var(--r-xs)] bg-[var(--encre-100)] motion-reduce:animate-none';

export type FormeSquelette = 'bloc' | 'texte' | 'cercle';

/**
 * La brique. Tout le reste de ce fichier l'assemble.
 *
 * `texte` prend la hauteur d'une ligne de `t-body` (19px) et un rayon plein :
 * un rectangle à angles vifs ne ressemble pas à du texte. `cercle` sert les
 * avatars, où la forme est l'information — un carré gris à la place d'un rond
 * annoncerait la mauvaise chose.
 */
export function Squelette({
  forme = 'bloc',
  largeur,
  hauteur,
  className,
}: {
  forme?: FormeSquelette;
  /** Nombre de pixels, ou toute longueur CSS (`'60%'`). */
  largeur?: number | string;
  hauteur?: number | string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ width: largeur, height: hauteur }}
      className={cn(
        SOCLE,
        forme === 'texte' && 'h-[0.75rem] rounded-[var(--r-full)]',
        forme === 'cercle' && 'aspect-square rounded-[var(--r-full)]',
        forme === 'bloc' && 'h-4',
        className,
      )}
    />
  );
}

/**
 * Un paragraphe en attente. La dernière ligne est courte — c'est ce détail qui
 * fait lire la pile comme du texte plutôt que comme un tableau.
 */
export function SqueletteTexte({
  lignes = 3,
  className,
}: {
  lignes?: number;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lignes }, (_, i) => (
        <Squelette
          key={i}
          forme="texte"
          largeur={i === lignes - 1 ? '55%' : ['100%', '92%', '97%'][i % 3]}
        />
      ))}
    </span>
  );
}

/**
 * Une carte en attente : la vignette, deux lignes de titre, un paragraphe.
 *
 * Le cadre reprend le régime « travail » de `Carte` — filet fin, pas d'ombre.
 * Un squelette qui porterait l'ombre rétro annoncerait une carte d'accroche,
 * et le contenu réel démentirait la promesse.
 */
export function SqueletteCarte({
  avecVignette = true,
  lignes = 2,
  className,
}: {
  avecVignette?: boolean;
  lignes?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex flex-col gap-4 rounded-[var(--r-md)] border border-[var(--encre-100)] bg-[var(--fond-carte)] p-4',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {avecVignette && <Squelette forme="cercle" largeur={42} />}
        <div className="flex flex-1 flex-col gap-2">
          <Squelette forme="texte" largeur="48%" />
          <Squelette forme="texte" largeur="30%" />
        </div>
      </div>
      <SqueletteTexte lignes={lignes} />
    </div>
  );
}

/**
 * Une ligne de tableau en attente, hors d'un `<table>`.
 *
 * `Tableau` porte déjà sa propre ligne de squelette, parce qu'elle doit être un
 * `<tr>` réel pour que les colonnes s'alignent. Celle-ci sert les listes
 * tabulaires qui ne passent pas par le composant — un panneau latéral, une
 * pile de lignes en `flex`.
 */
export function SqueletteLigneTableau({
  colonnes = 4,
  densite = 'normale',
  className,
}: {
  colonnes?: number;
  densite?: 'normale' | 'compacte';
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex items-center gap-3 border-b border-[var(--encre-050)] px-3',
        densite === 'compacte' ? 'h-[var(--h-ligne-compacte)]' : 'h-[var(--h-ligne)]',
        className,
      )}
    >
      {Array.from({ length: colonnes }, (_, i) => (
        <span key={i} className="flex-1">
          <Squelette forme="texte" largeur={`${[70, 45, 60, 35, 55][i % 5]}%`} />
        </span>
      ))}
    </div>
  );
}
