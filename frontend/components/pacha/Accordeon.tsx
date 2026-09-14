'use client';

import { Accordion } from '@base-ui/react/accordion';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Accordeon — replier ce qui est long, sans le cacher.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QU'IL SERT
 * ─────────────────────────────────────────────────────────────────────────
 * Une fiche talent, c'est trente-sept colonnes : identité, coordonnées,
 * attentes, expertises, secteurs visés, secteurs no-go, critères. Étalées, ces
 * sept familles font un formulaire de trois écrans où personne ne trouve rien.
 * Repliées, elles font une table des matières qu'on ouvre là où on a quelque
 * chose à dire.
 *
 * ⚠ QUAND NE PAS S'EN SERVIR. Si le contenu doit être LU (une offre, un
 * récapitulatif avant envoi), il ne se replie pas : on ne relit pas ce qu'on ne
 * voit pas, et un récapitulatif plié ne récapitule rien. L'accordéon sert la
 * SAISIE et la CONSULTATION CIBLÉE, pas la lecture.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SUR LA PRIMITIVE `accordion` DE BASE UI
 * ─────────────────────────────────────────────────────────────────────────
 * Elle apporte ce qu'un `<details>` stylé ne donne pas : le lien
 * `aria-controls` / `aria-labelledby` entre en-tête et panneau, `aria-expanded`
 * tenu à jour, l'ouverture unique ou multiple, et — décisif ici —
 * `hiddenUntilFound`, qui laisse la RECHERCHE DU NAVIGATEUR (Ctrl+F) trouver
 * un mot dans un panneau replié et l'ouvrir toute seule. Sur une fiche de
 * trente-sept champs, c'est la différence entre « je ne le trouve pas » et
 * « il était dans Attentes ».
 *
 * `hiddenUntilFound` est donc ACTIVÉ PAR DÉFAUT. Le prix est que les panneaux
 * restent dans le DOM : sur une liste de deux cents sections lourdes, passer
 * `chercheDansLesReplis={false}` les démonte.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * OUVERTURE MULTIPLE PAR DÉFAUT, ET C'EST UN CHOIX
 * ─────────────────────────────────────────────────────────────────────────
 * Base UI ouvre une seule section à la fois par défaut ; on inverse. Refermer
 * la section qu'on vient de remplir pour en ouvrir une autre fait perdre le fil
 * de ce qu'on a déjà répondu, et sur un formulaire de saisie de soi c'est
 * exactement ce qu'il ne faut pas. `multiple={false}` reste disponible pour une
 * FAQ, où l'exclusivité est le bon geste.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ANIMATION D'OUVERTURE
 * ─────────────────────────────────────────────────────────────────────────
 * Base UI publie la hauteur mesurée du panneau dans `--accordion-panel-height`.
 * La transition va de `0` à cette variable, jamais à `auto` — une transition
 * vers `auto` ne s'anime pas. Elle est coupée sous `prefers-reduced-motion`,
 * et le contenu est alors simplement là ou pas là.
 *
 * Le DS ne définit aucun langage de mouvement : 150 ms, la seule durée du
 * système, celle des transitions de couleur et d'ombre.
 */

export function Accordeon({
  valeur,
  valeurParDefaut,
  onChangement,
  multiple = true,
  chercheDansLesReplis = true,
  desactive,
  children,
  className,
}: {
  /** Les clés des sections ouvertes. Fournir aussi `onChangement` pour piloter. */
  valeur?: string[];
  /** Les sections ouvertes au montage, quand l'accordéon s'administre lui-même. */
  valeurParDefaut?: string[];
  onChangement?: (valeur: string[]) => void;
  /** Plusieurs sections ouvertes en même temps. Défaut : oui, voir l'en-tête. */
  multiple?: boolean;
  /** Laisse Ctrl+F trouver et ouvrir un panneau replié. Défaut : oui. */
  chercheDansLesReplis?: boolean;
  desactive?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Accordion.Root<string>
      value={valeur}
      defaultValue={valeurParDefaut}
      onValueChange={(v) => onChangement?.(v)}
      multiple={multiple}
      hiddenUntilFound={chercheDansLesReplis}
      disabled={desactive}
      className={cn(
        // Un filet entre les sections, aucun autour : l'accordéon se pose dans
        // une `Carte` qui porte déjà son cadre. Un double trait ferait un
        // liseré de 2px là où le système n'en veut qu'un.
        'flex w-full flex-col divide-y divide-[var(--encre-100)]',
        className,
      )}
    >
      {children}
    </Accordion.Root>
  );
}

/**
 * Une section.
 *
 * `resume` est la ligne qui vaut le pli : « 4 secteurs choisis », « aucune
 * attente renseignée ». C'est elle qui permet de décider s'il faut ouvrir, et
 * sans elle un accordéon n'est qu'une liste de titres muets qu'il faut tous
 * déplier pour savoir où l'on en est. Elle reste visible en position ouverte —
 * la faire disparaître à l'ouverture ferait sauter la mise en page.
 *
 * `niveauTitre` existe parce qu'un accordéon ne vit pas toujours à la même
 * profondeur : dans une `Carte` sous un `<h2>`, ses en-têtes sont des `<h3>`.
 * Un niveau faux casse le plan du document, qui est le sommaire des lecteurs
 * d'écran.
 */
export function SectionAccordeon({
  valeur,
  titre,
  resume,
  compteur,
  desactive,
  niveauTitre = 3,
  children,
  className,
}: {
  valeur: string;
  titre: React.ReactNode;
  /** L'état de la section, lisible sans l'ouvrir. « 4 secteurs choisis ». */
  resume?: React.ReactNode;
  /** Un nombre à droite du titre — des éléments, des champs manquants. */
  compteur?: number;
  desactive?: boolean;
  niveauTitre?: 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}) {
  const Titre = `h${niveauTitre}` as 'h2' | 'h3' | 'h4';

  return (
    <Accordion.Item value={valeur} disabled={desactive} className={cn('group', className)}>
      <Accordion.Header render={<Titre />} className="m-0">
        <Accordion.Trigger
          className={cn(
            'flex w-full items-center gap-3 py-3 text-left',
            't-titre-hl text-black',
            'hover:text-[var(--violet-700)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2',
            'focus-visible:outline-[var(--focus-anneau)]',
            'data-disabled:cursor-not-allowed data-disabled:text-[var(--encre-300)]',
            'data-disabled:hover:text-[var(--encre-300)]',
            'transition-colors duration-150',
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate">{titre}</span>
            {resume !== undefined && (
              <span className="t-caption font-normal text-[var(--encre-500)]">{resume}</span>
            )}
          </span>

          {compteur !== undefined && (
            <span
              className={cn(
                'inline-flex h-5 min-w-5 shrink-0 items-center justify-center px-1.5',
                'rounded-[var(--r-full)] t-micro-bold',
                'bg-[var(--encre-050)] text-[var(--encre-600)]',
                'group-data-open:bg-[var(--violet-100)]',
              )}
            >
              {compteur}
            </span>
          )}

          {/* Le chevron pivote plutôt que de changer de glyphe : deux dessins
              pour deux états feraient clignoter la ligne à chaque ouverture. */}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-5 shrink-0 text-black',
              'transition-transform duration-150 motion-reduce:transition-none',
              'group-data-open:rotate-180',
              'group-data-disabled:text-[var(--encre-300)]',
            )}
          />
        </Accordion.Trigger>
      </Accordion.Header>

      <Accordion.Panel
        className={cn(
          'overflow-hidden',
          'h-[var(--accordion-panel-height)]',
          'data-[starting-style]:h-0 data-[ending-style]:h-0',
          'transition-[height] duration-150 ease-out motion-reduce:transition-none',
        )}
      >
        <div className="pb-4">{children}</div>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
