'use client';

import { Progress } from '@base-ui/react/progress';

import { cn } from '@/lib/utils';

/**
 * Jauge — l'avancement d'une chose, barre plus chiffre.
 *
 * DEUX BESOINS, UN SEUL COMPOSANT. Le portail talent en a deux usages qui ont
 * l'air différents et sont la même mesure : la COMPLÉTUDE d'une fiche
 * (`api.ma_fiche.score_completude`, un pourcentage) et l'AVANCEMENT d'un
 * téléversement (des octets sur un total). Les séparer donnerait deux dessins
 * pour une même grandeur, et l'écran choisirait au hasard.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE CHIFFRE N'EST PAS OPTIONNEL, ET C'EST LA DÉCISION CENTRALE
 * ─────────────────────────────────────────────────────────────────────────
 * Il n'y a pas de variante « barre seule ». Une barre est une longueur : pour
 * la lire il faut voir, comparer, et estimer — trois choses qu'une part des
 * gens ne peut pas faire d'un coup d'œil, et qu'aucune ne fait avec précision.
 * « 62 % » se lit. La prop `chiffre` choisit donc entre deux ÉCRITURES
 * (« 62 % » ou « 4 / 7 »), jamais entre écrire et ne pas écrire. Si un écran
 * veut la barre sans le chiffre, c'est le signe qu'il lui faut un `Squelette`
 * ou rien du tout, pas une jauge amputée.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEUX FORMES : CONTINUE ET SEGMENTÉE
 * ─────────────────────────────────────────────────────────────────────────
 * · **Continue** (défaut) : une piste, un remplissage proportionnel. C'est la
 *   forme d'une grandeur continue — un pourcentage de complétude, des octets
 *   envoyés. Elle passe par `Progress.Indicator`, qui pose la largeur en ligne.
 * · **Segmentée** (`segments={n}`) : n blocs, dont les premiers sont pleins.
 *   C'est la forme d'un DÉNOMBREMENT — « 4 étapes franchies sur 7 ». Une barre
 *   continue à 57 % mentirait sur la nature de la chose : on ne franchit pas
 *   0,57 étape. La variante segmentée n'emploie PAS `Progress.Indicator` : ses
 *   blocs sont dessinés un par un, et l'accessibilité reste portée par
 *   `Progress.Root`, qui écrit `aria-valuenow` / `min` / `max` / `valuetext`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA COULEUR NE PORTE RIEN
 * ─────────────────────────────────────────────────────────────────────────
 * Le remplissage est NOIR par défaut, comme le trait de l'onglet actif : la
 * règle du système est que la couleur ne signale pas. `ton` existe pour les cas
 * où la jauge DOUBLE un statut déjà écrit ailleurs sur l'écran (un dossier en
 * échec, une candidature aboutie) — jamais pour l'annoncer toute seule. Aucune
 * information n'est perdue si l'on ignore `ton` : le chiffre est là.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'INDÉTERMINÉ EST UN ÉTAT, PAS UN ZÉRO
 * ─────────────────────────────────────────────────────────────────────────
 * `valeur={null}` dit « ça avance, on ne sait pas de combien » — le cas d'un
 * téléversement dont le serveur ne renvoie pas la progression. Base UI met
 * alors `aria-valuenow` à rien et pose `data-indeterminate` ; la jauge rend une
 * bande qui balaye la piste, et le chiffre est remplacé par « en cours… ».
 * Rendre 0 % à la place serait faux : 0 % dit « rien n'est parti ».
 * Sous `prefers-reduced-motion`, le balayage s'arrête et la bande reste posée.
 */

export type TonJauge = 'defaut' | 'positif' | 'attente' | 'echec';

export type ProprietesJauge = {
  /**
   * La valeur atteinte, entre 0 et `max`. `null` = indéterminé.
   * Une valeur hors bornes est ramenée dans les bornes : une jauge à 112 %
   * n'existe pas, et déborder du cadre est un bug d'affichage, pas une info.
   */
  valeur: number | null;
  /** Le total. Défaut : 100, donc `valeur` se lit directement en pourcentage. */
  max?: number;
  /** Ce que la jauge mesure. Relié à la barre par `Progress.Label`. */
  libelle?: React.ReactNode;
  /**
   * Découpe la piste en n blocs pleins ou vides, au lieu d'un remplissage
   * continu. À employer quand la grandeur se compte (des étapes, des pièces
   * fournies), pas quand elle se mesure.
   */
  segments?: number;
  /**
   * Comment le nombre s'écrit à côté de la barre.
   * `pourcentage` → « 62 % » · `fraction` → « 4 / 7 ».
   * Il n'y a pas de troisième valeur : voir l'en-tête.
   */
  chiffre?: 'pourcentage' | 'fraction';
  taille?: 'sm' | 'md';
  ton?: TonJauge;
  /**
   * Une ligne sous la barre. C'est la place de ce qui MANQUE — « il reste le
   * CV et la photo » — parce qu'un pourcentage seul ne dit pas quoi faire.
   */
  detail?: React.ReactNode;
  className?: string;
};

/** Le remplissage. Noir par défaut ; les trois autres doublent un statut. */
const FONDS: Record<TonJauge, string> = {
  defaut: 'bg-black',
  positif: 'bg-[var(--statut-positif)]',
  attente: 'bg-[var(--statut-attente)]',
  echec: 'bg-[var(--statut-echec)]',
};

const HAUTEURS: Record<'sm' | 'md', string> = {
  sm: 'h-[var(--h-jauge-sm)]',
  md: 'h-[var(--h-jauge-md)]',
};

export function Jauge({
  valeur,
  max = 100,
  libelle,
  segments,
  chiffre = 'pourcentage',
  taille = 'md',
  ton = 'defaut',
  detail,
  className,
}: ProprietesJauge) {
  // Bornage. `max <= 0` rendrait une division par zéro ; on retombe sur 100,
  // qui est la seule valeur par défaut qui ait un sens pour un pourcentage.
  const total = max > 0 ? max : 100;
  const borne = valeur === null ? null : Math.min(Math.max(valeur, 0), total);
  const indetermine = borne === null;
  const part = indetermine ? 0 : borne / total;
  const pourcentage = Math.round(part * 100);

  // Le texte du chiffre, et le texte annoncé. Les deux disent la même chose,
  // mais pas de la même façon : « 4 / 7 » se lit d'un coup d'œil et s'annonce
  // « quatre barre oblique sept », ce qui n'est pas une phrase — même arbitrage
  // que le compteur de `ZoneTexte`.
  const texteVu = indetermine
    ? 'en cours…'
    : chiffre === 'fraction'
      ? `${borne} / ${total}`
      : `${pourcentage} %`;

  const texteDit = indetermine
    ? 'en cours, avancement inconnu'
    : chiffre === 'fraction'
      ? `${borne} sur ${total}`
      : `${pourcentage} pour cent`;

  const nombreSegments = segments && segments > 0 ? Math.floor(segments) : null;
  // Le nombre de blocs pleins. `Math.round` et non `floor` : à 4 sur 7, la part
  // vaut 0,571 et sept blocs donnent 4,0 — mais avec un `max` qui n'est pas le
  // nombre de segments (une complétude de 62 % sur 5 blocs), arrondir au plus
  // proche est la lecture juste.
  const pleins = nombreSegments === null ? 0 : Math.round(part * nombreSegments);

  return (
    <Progress.Root
      value={borne}
      max={total}
      getAriaValueText={() => texteDit}
      className={cn('flex w-full flex-col gap-1.5', className)}
    >
      {/* Le libellé et le chiffre sur la même ligne, le chiffre à droite. La
          barre est ainsi encadrée par ce qui la nomme et par ce qui la lit.
          La rangée existe même sans libellé : le chiffre, lui, est toujours là,
          et `justify-between` le garde à droite grâce au `<span/>` vide. */}
      <div className="flex items-baseline justify-between gap-3">
        {libelle !== undefined ? (
          <Progress.Label className="t-caption-bold text-black">{libelle}</Progress.Label>
        ) : (
          <span />
        )}
        {/* `aria-hidden` : la valeur est déjà dans `aria-valuetext` de la
            racine. L'annoncer deux fois ferait « 62 pour cent, 62 % ». */}
        <span aria-hidden="true" className="t-caption-hl shrink-0 text-black">
          {texteVu}
        </span>
      </div>

      <Progress.Track
        className={cn(
          'relative w-full overflow-hidden',
          HAUTEURS[taille],
          // La piste segmentée n'a ni fond ni rayon d'ensemble : ses blocs
          // portent l'un et l'autre, sinon les gouttières laisseraient voir une
          // bande grise continue derrière eux.
          nombreSegments === null
            ? 'rounded-[var(--r-full)] bg-[var(--encre-100)]'
            : 'flex gap-1 bg-transparent',
        )}
      >
        {nombreSegments === null ? (
          <>
            <Progress.Indicator
              className={cn(
                'absolute top-0 rounded-[var(--r-full)]',
                FONDS[ton],
                'transition-[width] duration-300 ease-out motion-reduce:transition-none',
                // L'indéterminé n'a pas de largeur à poser : Base UI rend un
                // style vide, donc la bande est dessinée séparément ci-dessous.
                'data-indeterminate:hidden',
              )}
            />
            {indetermine && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-0 h-full w-1/3 rounded-[var(--r-full)]',
                  FONDS[ton],
                  'animate-[jauge-balayage_1.4s_ease-in-out_infinite]',
                  // Le balayage s'arrête et la bande reste visible, posée au
                  // départ de la piste : une piste vide dirait « rien ne se
                  // passe » à qui a désactivé les animations.
                  'motion-reduce:animate-none',
                )}
              />
            )}
          </>
        ) : (
          Array.from({ length: nombreSegments }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={cn(
                'h-full flex-1 rounded-[var(--r-xs)]',
                i < pleins ? FONDS[ton] : 'bg-[var(--encre-100)]',
                'transition-colors duration-150 motion-reduce:transition-none',
              )}
            />
          ))
        )}
      </Progress.Track>

      {detail && <p className="t-caption text-[var(--encre-600)]">{detail}</p>}
    </Progress.Root>
  );
}
