'use client';

import { NumberField } from '@base-ui/react/number-field';
import { useId } from 'react';

import {
  CadreChamp,
  CHAMP_BOITIER,
  CHAMP_SUBSTITUT_SAISIE,
  CHAMP_VALEUR,
} from './Champ';
import { Icone } from './Icone';
import { cn } from '@/lib/utils';

/**
 * ChampNombre — une quantité, avec son unité écrite dans le champ.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI PAS UN `<Champ type="number">`
 * ─────────────────────────────────────────────────────────────────────────
 * Trois raisons mesurables, pas une préférence :
 *
 * 1. **La virgule.** Sur un clavier français on tape « 62,5 ». Un
 *    `<input type="number">` natif refuse la virgule dans la plupart des
 *    navigateurs : la valeur devient vide, sans message, et l'utilisateur voit
 *    son chiffre disparaître. `NumberField` de Base UI analyse la saisie avec
 *    `Intl.NumberFormat` et la locale qu'on lui donne — « 62,5 » ET « 62.5 »
 *    donnent 62,5, parce que les deux séparateurs restent frappables.
 * 2. **L'unité.** Un salaire s'écrit « 62 K€ », un TJM « 650 €/j », une
 *    expérience « 8 ans ». L'unité appartient au champ, pas au libellé au-dessus.
 * 3. **La molette.** Un `<input type="number">` natif change de valeur quand on
 *    fait défiler la page au-dessus de lui. `allowWheelScrub` reste à `false` :
 *    personne n'a jamais voulu modifier un salaire en scrollant.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ANATOMIE EST CELLE DE `Champ`, IMPORTÉE ET NON RECOPIÉE
 * ─────────────────────────────────────────────────────────────────────────
 * Comme `ZoneTexte` avant lui, ce fichier importe `CHAMP_BOITIER`,
 * `CHAMP_VALEUR`, `CHAMP_SUBSTITUT_SAISIE` et le `CadreChamp` commun. Une seule
 * différence de mise en œuvre : le boîtier n'est plus l'`<input>` mais le
 * `NumberField.Group`, un `<div>`. Or `:enabled` ne s'applique qu'aux contrôles.
 * Les états survol / focus / désactivé sont donc réécrits en clair ici, sur le
 * conteneur, AVEC LES MÊMES VALEURS — c'est le montage que `SaisieTags` a déjà
 * dû faire pour `Combobox.Chips` (ChampTags.tsx:426). Le focus se détecte par
 * `has-[:focus-visible]`, puisqu'il vit sur l'input à l'intérieur.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'UNITÉ EST ÉCRITE DEUX FOIS, ET C'EST VOULU
 * ─────────────────────────────────────────────────────────────────────────
 * Une fois **à l'écran**, dans le boîtier, en gris, `aria-hidden`. Une fois
 * **dans le nom accessible**, via un `sr-only` ajouté au libellé : le champ
 * s'annonce « Salaire minimum en K€ » alors que l'étiquette affiche « Salaire
 * minimum ». Sans cela, un lecteur d'écran entend « Salaire minimum, 62 » et
 * rien ne dit si c'est 62 000 € ou 62 €. La commande vocale continue de trouver
 * le champ en disant son libellé visible, qui est un préfixe du nom complet.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TROIS ARBITRAGES SUR LE FORMAT
 * ─────────────────────────────────────────────────────────────────────────
 * · **Pas de séparateur de milliers** (`useGrouping: false`). En `fr-FR` c'est
 *   une espace fine insécable (U+202F) : invisible, non frappable au clavier,
 *   et catastrophique au copier-coller vers un tableur. Les grandeurs du modèle
 *   (K€, €/j, années) tiennent toutes à trois chiffres.
 * · **`decimales` vaut 0 par défaut.** Les neuf champs de salaire du modèle sont
 *   en K€ entiers depuis l'harmonisation ; autoriser des décimales partout
 *   inviterait à ressaisir des euros dans un champ qui compte des milliers.
 * · **Pas de bornage silencieux à la frappe** (`allowOutOfRange`). Base UI
 *   ramène par défaut la valeur tapée dans `[min, max]` à la sortie du champ.
 *   Cette correction muette transforme une faute de frappe en donnée
 *   plausible ; ici la valeur hors bornes reste telle quelle, `aria-invalid`
 *   est posé, et c'est l'écran qui décide du message. Les boutons + / − et les
 *   flèches, eux, restent bornés : là, le geste EST la contrainte.
 */

export type ProprietesChampNombre = {
  libelle?: string;
  /** Message d'erreur. Sa présence met le champ en état d'erreur. */
  erreur?: string;
  /**
   * Met le champ en état d'erreur SANS écrire de message sous lui.
   *
   * Le cas unique et légitime : le champ appartient à un groupe dont le message
   * est rendu une seule fois pour l'ensemble — c'est ce que fait
   * `ChampFourchette`. Employé seul, il produirait une bordure rouge muette,
   * ce que le système refuse partout ailleurs. Alors : `invalide` va toujours
   * avec un `decritPar` qui pointe vers le message du groupe.
   */
  invalide?: boolean;
  /** Texte d'aide sous le champ. Masqué quand une erreur s'affiche. */
  aide?: string;
  requis?: boolean;
  /** L'unité affichée dans le boîtier : « K€ », « €/j », « ans », « %ge ». */
  unite?: string;
  /** La valeur. `null` = le champ est vide, ce qui n'est pas zéro. */
  valeur?: number | null;
  valeurParDefaut?: number;
  onChangement?: (valeur: number | null) => void;
  /** Appelé plus tard : à la sortie du champ, au relâchement d'un bouton. */
  onValide?: (valeur: number | null) => void;
  min?: number;
  max?: number;
  /** Le pas des flèches et des boutons. Défaut : 1. */
  pas?: number;
  /** Décimales autorisées. 0 = entier. Défaut : 0. */
  decimales?: number;
  substitut?: string;
  /** Les boutons − / +. Défaut : oui. À couper sur un champ de grande amplitude. */
  boutons?: boolean;
  desactive?: boolean;
  lectureSeule?: boolean;
  /** Nom du champ pour l'envoi de formulaire. */
  nom?: string;
  /** Identifiants supplémentaires à annoncer — sert à `ChampFourchette`. */
  decritPar?: string;
  className?: string;
};

/**
 * Les états du boîtier, réécrits sur un `<div>` faute de `:enabled`.
 * Mêmes valeurs que `CHAMP_SURVOL` / `CHAMP_FOCUS` / `CHAMP_DESACTIVE`.
 */
function classesBoitier(erreur: boolean, inerte: boolean) {
  return cn(
    CHAMP_BOITIER,
    'gap-1',
    !inerte && [
      'hover:border-2 hover:border-[var(--encre-600)] hover:px-[7px]',
      'hover:shadow-[var(--ombre-douce)]',
      'has-[:focus-visible]:border-2 has-[:focus-visible]:border-black',
      'has-[:focus-visible]:px-[7px] has-[:focus-visible]:shadow-[var(--ombre-douce)]',
    ],
    erreur && [
      'border-[#ff2626] hover:border-[#ff2626] has-[:focus-visible]:border-[#ff2626]',
      'hover:border-2 has-[:focus-visible]:border-2',
    ],
    inerte && 'cursor-not-allowed border-[#dee3ed] bg-[var(--encre-100)] shadow-none',
  );
}

/** Les deux boutons de pas. Sans fond, sur la rampe violette, comme `BoutonIcone`. */
const PAS_BOUTON = cn(
  'flex size-5 shrink-0 items-center justify-center rounded-[var(--r-xs)]',
  'text-black',
  'enabled:hover:bg-[var(--violet-050)] enabled:hover:text-[var(--violet-700)]',
  'enabled:active:bg-[var(--violet-100)]',
  'disabled:cursor-not-allowed disabled:text-[var(--encre-300)]',
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-anneau)]',
);

export function ChampNombre({
  libelle,
  erreur,
  invalide,
  aide,
  requis,
  unite,
  valeur,
  valeurParDefaut,
  onChangement,
  onValide,
  min,
  max,
  pas = 1,
  decimales = 0,
  substitut,
  boutons = true,
  desactive,
  lectureSeule,
  nom,
  decritPar,
  className,
}: ProprietesChampNombre) {
  const id = useId();
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;
  const inerte = Boolean(desactive);
  // La bordure rouge et `aria-invalid` suivent l'ÉTAT ; le message, lui, ne
  // s'écrit que s'il y en a un. Les deux se recouvrent presque toujours, sauf
  // quand un groupe porte le message pour ses membres.
  const enErreur = Boolean(erreur) || Boolean(invalide);

  const decrit = [
    erreur ? idErreur : null,
    aide && !erreur ? idAide : null,
    decritPar ?? null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <CadreChamp
      id={id}
      libelle={
        libelle === undefined ? undefined : !unite ? (
          libelle
        ) : (
          <>
            {/* Le nom annoncé est écrit d'UN SEUL TENANT, le visible est masqué
                aux lecteurs d'écran. Un `<span className="sr-only"> en K€</span>`
                accolé au libellé ne marche PAS : le calcul du nom accessible
                élague les blancs de bord de chaque nœud, et le champ s'annonce
                « Salaire minimumen K€ » (mesuré). Le remède ne peut pas être un
                blanc de plus — il serait élagué lui aussi. */}
            <span className="sr-only">
              {libelle} en {unite}
            </span>
            <span aria-hidden="true">{libelle}</span>
          </>
        )
      }
      erreur={erreur}
      aide={aide}
      className={className}
    >
      <NumberField.Root
        id={id}
        value={valeur}
        defaultValue={valeurParDefaut}
        onValueChange={(v) => onChangement?.(v)}
        onValueCommitted={(v) => onValide?.(v)}
        min={min}
        max={max}
        step={pas}
        // La saisie hors bornes n'est PAS ramenée en silence ; le pas l'est.
        allowOutOfRange
        allowWheelScrub={false}
        disabled={inerte}
        readOnly={lectureSeule}
        required={requis}
        name={nom}
        // La locale décide du séparateur décimal accepté ET affiché. Sans elle,
        // Base UI prendrait celle du navigateur : un poste réglé en anglais
        // afficherait « 62.5 » à un utilisateur qui a tapé « 62,5 ».
        locale="fr-FR"
        format={{ maximumFractionDigits: decimales, useGrouping: false }}
        className="w-full"
      >
        <NumberField.Group className={classesBoitier(enErreur, inerte)}>
          {boutons && (
            <NumberField.Decrement aria-label="Diminuer" className={PAS_BOUTON}>
              <Icone nom="icon-minus" className="size-4" />
            </NumberField.Decrement>
          )}

          <NumberField.Input
            placeholder={substitut}
            aria-required={requis || undefined}
            aria-invalid={enErreur ? true : undefined}
            aria-describedby={decrit || undefined}
            // `inputMode` est posé par Base UI (`numeric` / `decimal`) : il
            // ouvre le bon clavier sur mobile, et on ne le surcharge pas.
            className={cn(
              'min-w-0 flex-1 bg-transparent text-right outline-none',
              CHAMP_VALEUR,
              CHAMP_SUBSTITUT_SAISIE,
              'disabled:cursor-not-allowed disabled:text-[var(--encre-250)]',
              enErreur && 'placeholder:text-[var(--encre-250)]',
              // Le nombre est aligné à droite quand il y a une unité — chiffres
              // et unité forment alors un bloc — et à gauche sans unité, comme
              // tous les autres champs du système.
              !unite && 'text-left',
            )}
          />

          {unite && (
            // `aria-hidden` : l'unité est déjà dans le nom accessible du champ.
            <span aria-hidden="true" className="t-body shrink-0 text-[var(--encre-500)]">
              {unite}
            </span>
          )}

          {boutons && (
            <NumberField.Increment aria-label="Augmenter" className={PAS_BOUTON}>
              <Icone nom="icon-plus" className="size-4" />
            </NumberField.Increment>
          )}
        </NumberField.Group>
      </NumberField.Root>
    </CadreChamp>
  );
}
