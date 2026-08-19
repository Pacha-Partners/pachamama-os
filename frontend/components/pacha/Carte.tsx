import { cn } from '@/lib/utils';

/**
 * Carte — deux régimes, et la distinction est structurante.
 *
 * L'ombre rétro décalée est la signature de la marque. Posée sur chaque ligne
 * d'un tableau de 30 000 talents, elle rendrait l'écran illisible. Le design
 * system prévoit lui-même une ombre douce pour la « data UI / dashboard ». On
 * formalise donc la frontière :
 *
 *   accroche  ce qui se REGARDE : carte d'offre, en-tête de fiche, mise en avant
 *   travail   ce qui se PARCOURT : lignes, panneaux, listes
 *
 * Choisir « accroche » pour une ligne de tableau, ou « travail » pour une carte
 * d'offre, c'est perdre la marque dans un cas et la lisibilité dans l'autre.
 *
 * Deux axes ont été ajoutés après relevé du Figma, sans rien retirer :
 *
 * · `rayon` — le fichier montre deux rayons de surface et pas un. 8px domine
 *   (carte d'offre Figma.md:36038, carte candidat :24681, carte kanban :6665),
 *   16px est réservé aux cartes destinées au talent (Figma.md:21727, :22084,
 *   :22541). Ce n'est pas un caprice : la carte vue par un candidat est plus
 *   ronde que celle vue par un recruteur.
 *
 * · `survol` — la carte d'offre du Figma NE porte PAS d'ombre au repos ; elle
 *   la gagne au survol, et à -6px (Figma.md:37208), pas à -3px. L'ombre est
 *   donc une réponse au geste, pas un attribut de la surface. On l'expose en
 *   option plutôt que de changer le comportement de `accroche`, dont d'autres
 *   lots dépendent.
 */
export function Carte({
  regime = 'travail',
  rayon = 'md',
  survol = false,
  className,
  children,
  ...reste
}: {
  regime?: 'accroche' | 'travail';
  /** 8px par défaut ; 16px pour les surfaces vues par le talent. */
  rayon?: 'md' | 'lg';
  /** Ajoute l'ombre rétro -6px au survol et au focus clavier. */
  survol?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-[var(--fond-carte)]',
        rayon === 'lg' ? 'rounded-[var(--r-lg)]' : 'rounded-[var(--r-md)]',
        regime === 'accroche'
          ? 'border-2 border-black shadow-[var(--ombre-3)]'
          : 'border border-[var(--encre-100)]',
        // Figma.md:37208 — l'ombre du survol est à -6px, sans flou.
        survol &&
          'shadow-none transition-shadow duration-150 hover:shadow-[var(--ombre-6)] focus-within:shadow-[var(--ombre-6)]',
        className,
      )}
      {...reste}
    >
      {children}
    </div>
  );
}

/**
 * InfoLigne — la ligne libellé / valeur des cartes d'offre.
 *
 * Le libellé est gris et porte l'emoji, la valeur est noire et en gras. Ce
 * contraste-là fait tout le travail : sur une carte parcourue en une seconde,
 * l'œil saute aux valeurs et ignore les libellés.
 *
 * Cotes relevées sur `Salaire` / `Localisation` / `Mode de travail`
 * (Figma.md:35450-35555) : gap 16px entre le groupe libellé et la valeur, gap
 * 4px entre l'emoji et le libellé, libellé en Body/Regular #738296, valeur en
 * Body/Bold noir. Ce sont des tailles de corps (14px), pas des légendes.
 */
export function InfoLigne({
  emoji,
  libelle,
  valeur,
  className,
}: {
  emoji?: string;
  libelle: string;
  valeur: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline gap-4', className)}>
      {/* Figma.md:35510 gap 4px · :35494 couleur #738296 */}
      <span className="t-body flex shrink-0 items-baseline gap-1 text-[var(--encre-500)]">
        {emoji && <span aria-hidden="true">{emoji}</span>}
        {libelle}
      </span>
      {/* Figma.md:35597 Body/Bold noir */}
      <span className="t-body-bold text-black">{valeur}</span>
    </div>
  );
}

/**
 * Encart — la carte noire de précisions (grille libellé / valeur).
 * Reprise telle quelle du design system : libellés en majuscules gris clair,
 * valeurs en blanc Bricolage SemiBold. Texte seulement, aucun graphique.
 */
export function Encart({
  entrees,
  className,
}: {
  entrees: { libelle: string; valeur: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-4 rounded-[var(--radius-card)] bg-black p-6 text-white',
        className,
      )}
    >
      {entrees.map((e) => (
        <div key={e.libelle}>
          <dt className="t-caption uppercase tracking-wide text-[var(--encre-300)]">{e.libelle}</dt>
          <dd className="mt-0.5 font-[family-name:var(--font-display)] font-semibold">{e.valeur}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * EnteteContenu — le calque `Heading Content` du Figma.
 *
 * L'en-tête d'une carte de personne : une vignette carrée à gauche, un bloc de
 * titre à droite, alignés au centre (Figma.md:6712-6730 — row, gap 8px,
 * hauteur 56px). C'est le seul endroit où une carte de travail accepte une
 * image : partout ailleurs, la donnée passe avant l'illustration.
 */
export function EnteteContenu({
  vignette,
  children,
  className,
}: {
  vignette?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {vignette}
      <div className="flex min-w-0 flex-col items-start">{children}</div>
    </div>
  );
}

/**
 * ContenuCarte / LigneContenu — les calques `Card content` et `Card content Item`.
 *
 * Une pile de faits très serrée : gap 2px entre les lignes (Figma.md:6861), et
 * chaque ligne est un bloc à rayon 4px (Figma.md:6887) pour pouvoir se teinter
 * au survol sans bouger le texte. Le padding de la ligne varie selon le
 * contexte — 4px dans la carte de recherche (Figma.md:6881), 0 dans la carte
 * candidat du kanban (Figma.md:25086), d'où `compact`.
 *
 * `LigneContenu` est un `<li>` : une pile de faits est une liste, et un lecteur
 * d'écran doit pouvoir en annoncer le nombre.
 */
export function ContenuCarte({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <ul className={cn('flex w-full flex-col gap-0.5', className)}>{children}</ul>;
}

export function LigneContenu({
  compact = false,
  children,
  className,
}: {
  /** Supprime le padding de 4px — la densité de la carte de kanban. */
  compact?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <li
      className={cn(
        'flex items-start gap-2.5 rounded-[var(--r-xs)]',
        compact ? 'p-0' : 'p-1',
        className,
      )}
    >
      {children}
    </li>
  );
}

/**
 * ZoneDefilante — le calque `Scrollbar` du Figma.
 *
 * Le fichier ne dessine pas une barre de défilement complète : il pose un
 * filet de 2px en #ADABB3 (Figma.md:15239, `Line 2`), le plus souvent en
 * `display: none` (Figma.md:15206) — donc visible seulement quand ça déborde.
 * C'est exactement le comportement natif d'`overflow: auto`, qu'on habille sans
 * le remplacer : réécrire un défilement en JS casserait la molette, le clavier
 * et le défilement inertiel.
 */
export function ZoneDefilante({
  children,
  className,
  ...reste
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'overflow-y-auto',
        // Filet de 2px en encre-250, sur les deux moteurs. Le fond reste
        // transparent : la barre ne doit pas dessiner de gouttière.
        '[scrollbar-color:var(--encre-250)_transparent] [scrollbar-width:thin]',
        '[&::-webkit-scrollbar]:w-[2px] [&::-webkit-scrollbar-thumb]:rounded-[var(--r-full)]',
        '[&::-webkit-scrollbar-thumb]:bg-[var(--encre-250)] [&::-webkit-scrollbar-track]:bg-transparent',
        className,
      )}
      {...reste}
    >
      {children}
    </div>
  );
}
