'use client';

import { Checkbox as CaseBase } from '@base-ui/react/checkbox';
import { Radio as RadioBase } from '@base-ui/react/radio';
import { RadioGroup as GroupeRadioBase } from '@base-ui/react/radio-group';
import { Switch as InterrupteurBase } from '@base-ui/react/switch';
import { Check } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/lib/utils';
import { MessageErreur } from './Champ';

/**
 * CASES À COCHER, BOUTONS RADIO, INTERRUPTEUR.
 *
 * Trois contrôles, un seul vocabulaire graphique : 20px de côté, bordure noire
 * de 2px, et le NOIR comme couleur de sélection. Le Figma est constant là-dessus
 * — la case cochée est noire (Figma.md:57952), le point du radio est noir
 * (Figma.md:20853). C'est la règle du DS : la couleur d'action est le noir, les
 * teintes de verticale ne signalent jamais un état.
 *
 * COTES RELEVÉES
 *   Case, Default     20×20, fond #FFFFFF, bordure 2px #000, rayon 4px  :57866
 *   Case, Hover       bordure 2px #5D6979, drop-shadow 0 0 3px 25%      :57905
 *   Case, Checked     fond #000, bordure 2px #000, coche blanche        :57930
 *   Radio, Resting    cercle 20×20, bordure 2px #000                    :20774
 *   Radio, Hover      bordure 2px #5D6979                               :20799
 *   Radio, Selected   + point noir en retrait de 25% (soit 10×10)        :20825
 *   Groupe radio      rangée, gouttière 8px ; titre en ligne,            :20861
 *                     options espacées de 16px
 *
 * POURQUOI @base-ui ET PAS UN <input> NU
 * Le comportement clavier d'un groupe radio (flèches qui déplacent la sélection,
 * un seul arrêt de tabulation pour tout le groupe) et la liaison libellé/contrôle
 * sont exactement ce qu'on écrit mal à la main. `@base-ui/react` le fait ; on ne
 * fournit que le vêtement.
 *
 * CE QUI N'EST PAS DANS LE FIGMA — à lire avant de s'en servir
 * · L'INTERRUPTEUR n'existe pas. Recherché comme composant (`Switch`, `Toggle`,
 *   `Bascule`) : rien. Seules deux icônes `icon-toggle-left` / `icon-toggle-right`
 *   (Figma.md:55368, :55400), qui sont des glyphes, pas un contrôle.
 *   `Interrupteur` ci-dessous est DÉRIVÉ du vocabulaire des cases, pas relevé.
 * · L'état indéterminé d'une case n'est pas dans le Figma : non implémenté.
 * · L'état désactivé des cases et des radios n'est pas dans le Figma non plus. On
 *   y applique le traitement du champ texte désactivé (fond #E7E6EB, bordure
 *   #DEE3ED — Figma.md:17644), faute de mieux et par cohérence de famille.
 */

/* ── La case, en tant que dessin ────────────────────────────────────────────── */

/**
 * `CaseVisuelle` — la case à cocher réduite à son dessin, sans contrôle.
 *
 * Elle existe pour les listes d'options des déroulants : là, c'est l'élément de
 * liste qui porte la sémantique (`role="option"`, `aria-selected`), et y glisser
 * une vraie case à cocher créerait deux contrôles imbriqués — un piège au clavier
 * et une double annonce au lecteur d'écran. On ne montre donc que la carrosserie.
 * Figma.md:15442 (élément de liste multisélection), :18020 (état sélectionné).
 */
export function CaseVisuelle({ cochee, className }: { cochee?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-[var(--r-xs)] border-2 border-black',
        cochee ? 'bg-black text-white' : 'bg-white',
        className,
      )}
    >
      {cochee && <Check className="size-4" strokeWidth={3} />}
    </span>
  );
}

/* ── Case à cocher ─────────────────────────────────────────────────────────── */

export type ProprietesCase = {
  libelle?: React.ReactNode;
  erreur?: string;
  className?: string;
} & Omit<CaseBase.Root.Props, 'className' | 'render' | 'children' | 'indeterminate'>;

/**
 * Case — case à cocher avec son libellé.
 *
 * Le libellé est cliquable parce qu'il EST le `<label>` du contrôle : sur une
 * cible de 20px, c'est ce qui rend la case utilisable à la souris.
 */
export function Case({ libelle, erreur, className, id: idFourni, ...reste }: ProprietesCase) {
  const idAuto = useId();
  const id = idFourni ?? idAuto;
  const idErreur = `${id}-erreur`;

  const boite = (
    <CaseBase.Root
      id={id}
      aria-invalid={erreur ? true : undefined}
      aria-describedby={erreur ? idErreur : undefined}
      className={cn(
        // Figma.md:57893 — 20×20, fond blanc, bordure 2px noire, rayon 4px.
        'flex size-5 shrink-0 items-center justify-center rounded-[var(--r-xs)] border-2 border-black bg-white',
        // Figma.md:57922 — au survol la bordure grise et l'ombre douce apparaît.
        'not-data-disabled:hover:border-[var(--encre-600)] not-data-disabled:hover:shadow-[var(--ombre-douce)]',
        // Figma.md:57952 — cochée : fond noir, coche blanche.
        'data-checked:bg-black data-checked:text-white',
        'data-disabled:cursor-not-allowed data-disabled:border-[#dee3ed] data-disabled:bg-[var(--encre-100)]',
        erreur && 'border-[#ff2626]',
        className,
      )}
      {...reste}
    >
      <CaseBase.Indicator className="flex items-center justify-center">
        {/* Figma.md:57983 — la coche est une forme blanche de 15×11 dans 20×20. */}
        <Check aria-hidden="true" className="size-4" strokeWidth={3} />
      </CaseBase.Indicator>
    </CaseBase.Root>
  );

  if (!libelle) return boite;

  return (
    <div className="flex flex-col gap-1">
      {/* Gouttière 8px entre la case et son libellé. Figma.md:20945 */}
      <label htmlFor={id} className="flex items-center gap-2">
        {boite}
        <span className="t-body text-black">{libelle}</span>
      </label>
      {erreur && <MessageErreur id={idErreur}>{erreur}</MessageErreur>}
    </div>
  );
}

/**
 * GroupeCases — un titre, puis des cases empilées.
 *
 * `fieldset`/`legend` plutôt qu'un `<div>` + titre : c'est ce qui fait annoncer
 * « Contrats, groupe » avant la première case au lieu de trois cases orphelines.
 * Le Figma ne montre pas ce groupe — il ne montre un titre en ligne que pour les
 * radios (:20861). L'empilement vertical est donc notre décision de mise en page.
 */
export function GroupeCases({
  libelle,
  erreur,
  className,
  children,
}: {
  libelle?: string;
  erreur?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const idErreur = `${id}-erreur`;
  return (
    <fieldset
      className={cn('flex flex-col gap-2', className)}
      aria-describedby={erreur ? idErreur : undefined}
    >
      {/* `Title` — Caption/Bold noir, gouttière 4px avant le contenu. Figma.md:20897 */}
      {libelle && <legend className="t-caption-bold mb-1 text-black">{libelle}</legend>}
      {children}
      {erreur && <MessageErreur id={idErreur}>{erreur}</MessageErreur>}
    </fieldset>
  );
}

/* ── Bouton radio ──────────────────────────────────────────────────────────── */

export type ProprietesRadio = {
  libelle: React.ReactNode;
  valeur: string;
  className?: string;
} & Omit<RadioBase.Root.Props, 'value' | 'className' | 'render' | 'children'>;

/**
 * Radio — un bouton radio et son libellé. À placer dans un `GroupeRadio`.
 * Figma.md:20957 pour le contrôle, :20993 pour le libellé.
 */
export function Radio({ libelle, valeur, className, ...reste }: ProprietesRadio) {
  const id = useId();
  return (
    // Gouttière 8px entre le radio et son libellé. Figma.md:20945
    <label htmlFor={id} className={cn('flex items-center gap-2', className)}>
      <RadioBase.Root
        id={id}
        value={valeur}
        className={cn(
          // Figma.md:20796 — cercle 20×20, bordure 2px noire.
          'flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white',
          // Figma.md:20822 — au survol, bordure grise.
          'not-data-disabled:hover:border-[var(--encre-600)]',
          'data-disabled:cursor-not-allowed data-disabled:border-[#dee3ed] data-disabled:bg-[var(--encre-100)]',
        )}
        {...reste}
      >
        {/* Figma.md:20853 — point en retrait de 25% de chaque côté : 10px dans 20px. */}
        <RadioBase.Indicator className="size-2.5 rounded-full bg-black data-unchecked:hidden" />
      </RadioBase.Root>
      <span className="t-body text-black">{libelle}</span>
    </label>
  );
}

export type ProprietesGroupeRadio = {
  libelle?: string;
  /** `'ligne'` est la disposition du Figma. Voir le commentaire ci-dessous. */
  disposition?: 'ligne' | 'colonne';
  erreur?: string;
  requis?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<GroupeRadioBase.Props, 'className' | 'render' | 'required' | 'children'>;

/**
 * GroupeRadio — `Input / radio button` du Figma (:20861).
 *
 * Le Figma dispose le titre EN LIGNE avec les options (rangée, gouttière 8px,
 * hauteur totale 20px), options espacées de 16px entre elles (:20926). C'est la
 * disposition `'ligne'`, la seule attestée. `'colonne'` est fourni pour les
 * libellés longs, où la rangée déborderait : c'est une décision de mise en page,
 * pas une variante inventée du composant.
 *
 * Le titre est un `<span>` relié par `aria-labelledby`, et non un `<label>` :
 * un `<label>` doit désigner UN contrôle, et il y en a ici plusieurs.
 */
export function GroupeRadio({
  libelle,
  disposition = 'ligne',
  erreur,
  requis,
  className,
  children,
  ...reste
}: ProprietesGroupeRadio) {
  const id = useId();
  const idTitre = `${id}-titre`;
  const idErreur = `${id}-erreur`;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div
        className={
          disposition === 'ligne'
            ? 'flex flex-wrap items-center gap-2'
            : 'flex flex-col items-start gap-1'
        }
      >
        {/* `Title of radiobutton` — Caption/Bold noir. Figma.md:20897 */}
        {libelle && (
          <span id={idTitre} className="t-caption-bold shrink-0 text-black">
            {libelle}
          </span>
        )}
        <GroupeRadioBase
          required={requis}
          aria-labelledby={libelle ? idTitre : undefined}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur ? idErreur : undefined}
          // Gouttière de 16px entre deux options. Figma.md:20926
          className={
            disposition === 'ligne' ? 'flex flex-wrap items-center gap-4' : 'flex flex-col gap-2'
          }
          {...reste}
        >
          {children}
        </GroupeRadioBase>
      </div>
      {erreur && <MessageErreur id={idErreur}>{erreur}</MessageErreur>}
    </div>
  );
}

/* ── Interrupteur ──────────────────────────────────────────────────────────── */

export type ProprietesInterrupteur = {
  libelle?: React.ReactNode;
  className?: string;
} & Omit<InterrupteurBase.Root.Props, 'className' | 'render' | 'children'>;

/**
 * Interrupteur — DÉRIVÉ, PAS RELEVÉ.
 *
 * Le Figma de l'application ne contient aucun interrupteur (voir l'en-tête de
 * fichier). Ce composant emprunte donc tout au vocabulaire des cases : hauteur
 * 20px, bordure noire de 2px, noir pour l'état actif, blanc pour le curseur.
 * Aucune de ses cotes n'est opposable au Figma — si le designer en produit un,
 * c'est ce fichier qui doit céder.
 *
 * Un interrupteur applique son effet immédiatement, contrairement à une case qui
 * attend la validation du formulaire. Ne l'utilise que dans ce cas-là.
 */
export function Interrupteur({
  libelle,
  className,
  id: idFourni,
  ...reste
}: ProprietesInterrupteur) {
  const idAuto = useId();
  const id = idFourni ?? idAuto;

  const bascule = (
    <InterrupteurBase.Root
      id={id}
      className={cn(
        'box-border flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-black p-[2px]',
        'data-unchecked:bg-white data-checked:bg-black',
        'not-data-disabled:hover:border-[var(--encre-600)] not-data-disabled:hover:shadow-[var(--ombre-douce)]',
        'data-disabled:cursor-not-allowed data-disabled:border-[#dee3ed] data-disabled:bg-[var(--encre-100)]',
        className,
      )}
      {...reste}
    >
      <InterrupteurBase.Thumb
        className={cn(
          'size-3 rounded-full',
          'data-unchecked:translate-x-0 data-unchecked:bg-black',
          'data-checked:translate-x-4 data-checked:bg-white',
        )}
      />
    </InterrupteurBase.Root>
  );

  if (!libelle) return bascule;

  return (
    <label htmlFor={id} className="flex items-center gap-2">
      {bascule}
      <span className="t-body text-black">{libelle}</span>
    </label>
  );
}
