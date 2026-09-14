'use client';

import { Tabs } from '@base-ui/react/tabs';

import { cn } from '@/lib/utils';

/**
 * Onglets — un jeu de vues alternatives sur la même page.
 *
 * SUR LA PRIMITIVE `tabs` DE BASE UI, jamais sur des `role="tablist"` posés à la
 * main. La différence n'est pas cosmétique : un vrai fil d'onglets répond aux
 * flèches ← →, à Début et Fin, saute les onglets désactivés, boucle en bout de
 * course, lie chaque onglet à son panneau par `aria-controls` / `aria-labelledby`
 * et retire les panneaux inactifs de l'ordre de tabulation. Le fil bricolé de
 * `components/vues/EspaceEntreprise.tsx:90` ne fait rien de tout cela : il pose
 * les rôles, et un lecteur d'écran annonce alors « onglet 1 sur 7 » sur des
 * boutons que les flèches ne parcourent pas.
 *
 * CE N'EST PAS `SelecteurVue`. Celui-ci bascule entre deux REPRÉSENTATIONS du
 * même contenu (cartes / kanban) et n'a pas de panneaux ; `Onglets` change le
 * CONTENU affiché. Deux gestes proches, deux composants distincts — les fondre
 * donnerait un composant qui ment sur la moitié de ses usages.
 *
 * QUAND NE PAS S'EN SERVIR : quand chaque vue mérite son URL. Un onglet perdu au
 * rechargement, c'est un lien qu'on ne peut pas partager. Au-delà de deux ou
 * trois vues durables, préférer des routes et une navigation secondaire.
 *
 * DEUX APPARENCES, ET ELLES NE SE CHOISISSENT PAS AU GOÛT.
 * `souligne` (défaut) est la barre classique : un trait noir glissant sous
 * l'onglet actif, posée sur un filet qui sépare la barre du contenu. Elle dit
 * « ce qui suit est une section de cette page ».
 * `pastille` rend les onglets en chips pleines, sans filet ni indicateur. Elle
 * sert quand la barre n'est pas au-dessus du contenu mais DANS l'en-tête, à
 * côté du titre — le filet y couperait l'en-tête en deux, et l'indicateur
 * glisserait sous des formes qui portent déjà leur état par leur fond. C'est
 * la forme que le portail entreprise emploie partout ailleurs pour deux
 * filtres exclusifs, et la reprendre ici évite deux grammaires pour un même
 * geste.
 *
 * ⚠ Une pastille d'onglet reste un ONGLET : elle garde les flèches, le lien
 * `aria-controls` vers son panneau, et la sortie des panneaux inactifs de
 * l'ordre de tabulation. C'est exactement ce qu'on perd en posant des
 * `TagAction` dans un `role="tablist"` écrit à la main.
 *
 * DESSIN. Le Figma ne contient aucun composant d'onglets : la barre est
 * assemblée. Le parti pris suit la règle du système — la couleur ne signale
 * pas — donc l'onglet actif se distingue par son POIDS (texte noir contre gris)
 * et par un trait noir de 2px sous lui, jamais par une teinte. Le trait est un
 * `Tabs.Indicator` : il glisse d'un onglet à l'autre en lisant les variables
 * `--active-tab-left` / `--active-tab-width` que Base UI met à jour, et il
 * reste immobile sous `prefers-reduced-motion`.
 */

export function Onglets({
  valeur,
  valeurParDefaut,
  onChangement,
  children,
  className,
}: {
  /** Onglet actif. Fournir aussi `onChangement` pour piloter de l'extérieur. */
  valeur?: string;
  /** Onglet actif au montage, quand le composant s'administre lui-même. */
  valeurParDefaut?: string;
  onChangement?: (valeur: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tabs.Root
      value={valeur}
      defaultValue={valeurParDefaut}
      onValueChange={(v) => onChangement?.(String(v))}
      className={cn('flex w-full flex-col', className)}
    >
      {children}
    </Tabs.Root>
  );
}

/**
 * La barre. `activateOnFocus={false}` : au clavier, les flèches DÉPLACENT le
 * focus sans changer de vue, et c'est Entrée ou Espace qui valide. C'est le
 * comportement à retenir dès qu'un panneau coûte cher à afficher — ici chaque
 * panneau peut déclencher une requête, et traverser sept onglets pour atteindre
 * le dernier en lancerait sept.
 */
export type ApparenceOnglets = 'souligne' | 'pastille';

export function ListeOnglets({
  libelle,
  apparence = 'souligne',
  children,
  className,
}: {
  /** Ce que ce jeu d'onglets découpe. « Vos postes ouverts ». */
  libelle: string;
  apparence?: ApparenceOnglets;
  children: React.ReactNode;
  className?: string;
}) {
  const pastille = apparence === 'pastille';
  return (
    <Tabs.List
      aria-label={libelle}
      activateOnFocus={false}
      className={cn(
        'relative flex',
        pastille
          ? // Les pastilles passent à la ligne au lieu de défiler : elles sont
            // courtes, et une barre de défilement dans un en-tête se remarque
            // plus que deux lignes de chips.
            'flex-wrap items-center gap-2'
          : cn(
              'items-stretch gap-1 overflow-x-auto border-b border-[var(--encre-100)]',
              // La barre déborde plutôt que de comprimer ses onglets : un
              // intitulé de poste tronqué à trois lettres ne sert personne.
              // `defilement-discret` masque la barre système — le débord en
              // pleine étiquette suffit à dire qu'il en reste.
              'defilement-discret',
            ),
        className,
      )}
    >
      {children}
      {/* Pas d'indicateur sous des pastilles : leur fond EST l'indicateur, et
          un trait glissant sous des formes arrondies se lit comme un défaut. */}
      {!pastille && (
      <Tabs.Indicator
        className={cn(
          'absolute bottom-0 left-0 z-10 h-0.5 bg-black',
          // Base UI publie la position de l'onglet actif dans ces deux
          // variables ; l'indicateur n'a qu'à s'y poser.
          'w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)]',
          'transition-[translate,width] duration-150 ease-out',
          'motion-reduce:transition-none',
        )}
      />
      )}
    </Tabs.List>
  );
}

/**
 * Un onglet.
 *
 * `compteur` est rendu à côté du libellé — « Candidatures 24 ». Le nombre est
 * dans le même bouton et non dans une pastille séparée, pour qu'il soit annoncé
 * avec le nom de l'onglet : « Candidatures, 24, onglet 2 sur 4 ».
 */
export function Onglet({
  valeur,
  compteur,
  desactive,
  apparence = 'souligne',
  children,
  className,
}: {
  valeur: string;
  compteur?: number;
  desactive?: boolean;
  /** À accorder avec celle de `ListeOnglets` — les deux dessinent la même barre. */
  apparence?: ApparenceOnglets;
  children: React.ReactNode;
  className?: string;
}) {
  const pastille = apparence === 'pastille';
  return (
    <Tabs.Tab
      value={valeur}
      disabled={desactive}
      className={cn(
        'group flex shrink-0 items-center gap-2 whitespace-nowrap',
        'transition-colors duration-150',
        pastille
          ? cn(
              // Les mêmes cotes que `TagAction`, dont c'est le dessin : 35px de
              // haut, rayon moyen, retrait de 8px, corps de texte régulier.
              'h-[var(--h-statut)] items-center rounded-[var(--r-md)] px-2 t-body',
              'bg-[var(--violet-050)] text-black',
              'hover:bg-[var(--violet-200)] hover:shadow-[var(--ombre-douce)]',
              'data-[active]:bg-[var(--violet-900)] data-[active]:text-white',
              'data-[active]:hover:bg-[var(--violet-900)] data-[active]:hover:shadow-none',
              'data-[disabled]:cursor-not-allowed data-[disabled]:bg-[var(--encre-050)] data-[disabled]:text-[var(--encre-300)]',
            )
          : cn(
              'items-center px-3 pb-2.5 pt-2',
              't-body-hl text-[var(--encre-500)]',
              'hover:text-black',
              // `data-active` est l'attribut que Base UI pose sur l'onglet
              // sélectionné (TabsTabDataAttributes.active). L'onglet actif se
              // distingue par le POIDS et le noir, jamais par une teinte.
              'data-[active]:font-bold data-[active]:text-black',
              'data-[disabled]:cursor-not-allowed data-[disabled]:text-[var(--encre-300)] data-[disabled]:hover:text-[var(--encre-300)]',
            ),
        className,
      )}
    >
      {children}
      {compteur !== undefined && (
        <span
          className={cn(
            'inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--r-full)] px-1.5',
            't-micro-bold',
            'bg-[var(--encre-050)] text-[var(--encre-600)]',
            pastille
              // Sur une pastille active le fond est `--violet-900` : un
              // compteur en `--violet-100` y disparaîtrait presque.
              ? 'group-data-[active]:bg-white group-data-[active]:text-black'
              : 'group-data-[active]:bg-[var(--violet-100)]',
          )}
        >
          {compteur}
        </span>
      )}
    </Tabs.Tab>
  );
}

/**
 * Le panneau d'un onglet.
 *
 * `keepMounted` est laissé à `false` par défaut : un panneau démonté ne
 * conserve pas ce qu'on y avait saisi. Le passer à `true` sur un panneau qui
 * porte un formulaire est presque toujours le bon geste — sur un panneau qui
 * charge une liste de sept mille lignes, presque jamais.
 */
export function PanneauOnglet({
  valeur,
  garderMonte,
  children,
  className,
}: {
  valeur: string;
  garderMonte?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tabs.Panel
      value={valeur}
      keepMounted={garderMonte}
      className={cn('pt-6 focus-visible:outline-offset-4', className)}
    >
      {children}
    </Tabs.Panel>
  );
}
