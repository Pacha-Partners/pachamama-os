'use client';

import { Select } from '@base-ui/react/select';
import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/lib/utils';
import { CaseVisuelle } from './Cases';
import {
  CHAMP_BOITIER,
  CHAMP_DESACTIVE,
  CHAMP_ERREUR,
  CHAMP_SUBSTITUT_OPTIONS,
  CHAMP_SURVOL,
  CHAMP_VALEUR,
  CadreChamp,
} from './Champ';
import { TagUnivers, type Univers } from './Tag';

/**
 * LES MENUS DÉROULANTS — `Input / dropdown` (Figma.md:13464) et
 * `Input / Agent select` (Figma.md:15724).
 *
 * ┌─ NOTE DU DESIGNER, RECOPIÉE DU FIGMA (:21582) ────────────────────────────┐
 * │ « Note: the multiple choice dropdown input should be used only if the tag  │
 * │   system is not working in this specific case. »                          │
 * └───────────────────────────────────────────────────────────────────────────┘
 * Autrement dit : pour choisir PLUSIEURS valeurs, le système de tags
 * (`ChampTags`) est le choix par défaut, et `SelecteurMulti` le recours. La
 * raison est lisible dans la maquette : un déroulant multi replié n'affiche ses
 * choix qu'en pastilles tassées (`State=Filled, Multiselect=True`, :14544), alors
 * que les tags les montrent tous, retirables un par un. `SelecteurMulti` existe
 * pour les listes trop longues à étaler — pas pour trois contrats.
 *
 * LE DÉCLENCHEUR est le boîtier de `Champ` (même couche `Input / Search/Default`
 * réutilisée par le Figma), plus un chevron de 20px poussé à droite. Ses états
 * sont donc ceux de `Champ`, avec une addition : « ouvert » se peint comme
 * « focus » (bordure 2px noire + ombre douce), ce que le Figma confirme en
 * donnant à `State=Focus, Opened=Opened` (:14840) exactement le déclencheur de
 * `State=Focus, Opened=Closed` (:14093).
 *
 * LE PANNEAU (:14991) : 156px de haut au maximum, fond blanc, bordure 2px noire,
 * rayon 8px, retrait vertical 4px, posé 4px sous le déclencheur (gouttière de la
 * colonne parente, :14847). Il n'a PAS d'ombre — le Figma n'en donne qu'au
 * déclencheur. On ne lui en ajoute pas.
 *
 * QUATRE TYPES DE LISTE, tous relevés
 *   Simple dropdown   texte seul                              :19249
 *   Multiselect       case à cocher + texte                   :19504
 *   Univers           case à cocher + tag de verticale        :19827
 *   Picture dropdown  photo ronde de 42px + nom en gras       :20309
 *
 * POURQUOI @base-ui/react
 * Flèches, Entrée, Échap, Début/Fin, saisie au clavier pour atteindre une option,
 * fermeture au clic extérieur, `aria-expanded`, `aria-activedescendant`, retour
 * du focus au déclencheur : c'est une centaine de lignes de code de pièges, et
 * `Select` de `@base-ui/react` les tient déjà. On n'écrit ici que le vêtement.
 * Les composants shadcn de `components/ui/select.tsx` enveloppent la même
 * primitive, mais avec le thème shadcn (`border-input`, `bg-primary`…) qu'il
 * faudrait défaire classe par classe : on attaque la primitive directement.
 */

/* ── Types et recettes partagées ───────────────────────────────────────────── */

export type Option<V extends string = string> = {
  valeur: V;
  libelle: string;
  desactive?: boolean;
};

/** Une option de la liste `Univers` : le libellé est porté par le tag. Figma.md:19827 */
export type OptionUnivers = { valeur: Univers; libelle?: string; desactive?: boolean };

/** Une option de la liste `Picture dropdown` / `Agent select`. Figma.md:20309 */
export type OptionPersonne<V extends string = string> = {
  valeur: V;
  libelle: string;
  /** URL de la photo. Absente, les initiales prennent la place. */
  photo?: string;
  desactive?: boolean;
};

/** Le panneau ouvert. Figma.md:14991 */
export const PANNEAU_DEROULANT = cn(
  'box-border w-[var(--anchor-width)] max-h-[156px] overflow-y-auto',
  'rounded-[var(--r-md)] border-2 border-black bg-white py-1',
  // Barre de défilement fine, teinte #ADABB3. Figma.md:15244
  '[scrollbar-color:var(--encre-250)_transparent] [scrollbar-width:thin]',
);

/** La pile d'options à l'intérieur du panneau : retrait 4px, gouttière 8px. Figma.md:15020 */
export const LISTE_DEROULANTE = 'flex flex-col gap-2 p-1';

/**
 * Un élément de liste. Axes du Figma : `Resting` × `Multiselect` × `Type`,
 * onze combinaisons présentes (:17713 à :18422).
 *
 * `Default` n'a pas de fond, `Hover` prend #F8F5FF (:17768), `Clicked` prend
 * #E9E0FF (:17811), `Selected` reprend #F8F5FF (:18020). `Hover` est double ici :
 * la pseudo-classe pour la souris, `data-highlighted` pour le clavier — sans quoi
 * naviguer aux flèches ne montrerait rien.
 */
export const ELEMENT_LISTE = cn(
  'flex cursor-default items-center rounded-[var(--r-xs)] select-none outline-none',
  't-body text-black',
  'hover:bg-[var(--violet-050)] data-highlighted:bg-[var(--violet-050)]',
  'data-selected:bg-[var(--violet-050)]',
  'active:bg-[var(--violet-100)]',
  'data-disabled:cursor-not-allowed data-disabled:text-[var(--encre-300)] data-disabled:bg-transparent',
);

/* ── Le déclencheur ────────────────────────────────────────────────────────── */

/**
 * Les classes du déclencheur. « Ouvert » emprunte le vêtement du focus.
 * Figma.md:13561 (repos), :14020 (survol), :14171 (focus / ouvert).
 */
function classesDeclencheur(erreur?: boolean, pourTags?: boolean) {
  return cn(
    CHAMP_BOITIER,
    'justify-between text-left',
    CHAMP_VALEUR,
    CHAMP_SURVOL,
    // Focus clavier ET panneau ouvert : bordure 2px noire, retrait compensé à 7px.
    'enabled:focus-visible:border-2 enabled:focus-visible:border-black enabled:focus-visible:px-[7px]',
    'enabled:focus-visible:shadow-[var(--ombre-douce)]',
    'data-popup-open:border-2 data-popup-open:border-black data-popup-open:px-[7px]',
    'data-popup-open:shadow-[var(--ombre-douce)]',
    CHAMP_DESACTIVE,
    // `State=Filled for tags` (:14244) : le déclencheur se teinte de violet 050
    // pour dire « des choix ont été faits, et ils sont affichés en tags ailleurs
    // sur l'écran ». C'est le cas du déroulant qui alimente un `ChampTags`.
    pourTags && 'bg-[var(--violet-050)]',
    erreur && CHAMP_ERREUR,
    erreur && 'data-popup-open:border-[#ff2626] data-popup-open:border-2',
  );
}

/**
 * Le chevron. 20px, il suit la couleur de la bordure : noir au repos et au
 * focus (:13633, :14241), gris au survol (:14090), gris clair désactivé (:13939).
 */
function Chevron() {
  return (
    <Select.Icon
      render={
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-5 shrink-0 text-black',
            'group-hover/declencheur:text-[var(--encre-600)]',
            'group-disabled/declencheur:text-[var(--encre-300)]',
          )}
        />
      }
    />
  );
}

/**
 * Le texte substitut, gris #738296. Figma.md:13604
 * `Select.Value` porte `flex-1 min-w-0` partout : son <span> ne se laisse sinon
 * ni étirer ni rétrécir, et les pastilles d'une multisélection débordent au lieu
 * de passer à la ligne.
 */
function Substitut({ children }: { children: React.ReactNode }) {
  return <span className={cn(CHAMP_SUBSTITUT_OPTIONS, 'truncate')}>{children}</span>;
}

/* ── Sélecteur simple ─────────────────────────────────────────────────────── */

export type ProprietesSelecteur<V extends string = string> = {
  libelle?: string;
  options: readonly Option<V>[];
  valeur?: V | null;
  valeurParDefaut?: V | null;
  onChangement?: (valeur: V | null) => void;
  /** Recopié du Figma. Figma.md:13592 */
  substitut?: string;
  erreur?: string;
  aide?: string;
  desactive?: boolean;
  requis?: boolean;
  nom?: string;
  className?: string;
  /** Ouverture pilotée depuis l'extérieur. Sinon le composant s'en occupe. */
  ouvert?: boolean;
  onOuvertChange?: (ouvert: boolean) => void;
  /**
   * `State=Filled for tags` (Figma.md:14244) : le déclencheur se teinte de
   * violet 050 quand les valeurs choisies sont affichées en tags AILLEURS sur
   * l'écran (typiquement au-dessous, dans un `ChampTags`).
   */
  teinteTags?: boolean;
};

/**
 * Selecteur — `Dropdown simple=Simple dropdown` (:19249).
 * Axes couverts : `State` × `Opened`, `Multiselect=False`.
 */
export function Selecteur<V extends string = string>({
  libelle,
  options,
  valeur,
  valeurParDefaut,
  onChangement,
  substitut = 'Choisir des options',
  erreur,
  aide,
  desactive,
  requis,
  nom,
  className,
  ouvert,
  onOuvertChange,
  teinteTags,
}: ProprietesSelecteur<V>) {
  const id = useId();
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;
  const decrit = [erreur ? idErreur : null, aide && !erreur ? idAide : null]
    .filter(Boolean)
    .join(' ');

  return (
    <CadreChamp id={id} libelle={libelle} erreur={erreur} aide={aide} className={className}>
      <Select.Root<V, false>
        value={valeur}
        defaultValue={valeurParDefaut}
        onValueChange={(v) => onChangement?.(v)}
        disabled={desactive}
        required={requis}
        name={nom}
        open={ouvert}
        onOpenChange={onOuvertChange}
      >
        <Select.Trigger
          id={id}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit || undefined}
          aria-required={requis || undefined}
          className={cn(
            'group/declencheur',
            classesDeclencheur(Boolean(erreur), teinteTags),
          )}
        >
          <Select.Value className="min-w-0 flex-1">
            {(v: V | null) => {
              const choisie = options.find((o) => o.valeur === v);
              return choisie ? (
                <span className="truncate">{choisie.libelle}</span>
              ) : (
                <Substitut>{substitut}</Substitut>
              );
            }}
          </Select.Value>
          <Chevron />
        </Select.Trigger>

        <PanneauDeroulant>
          {options.map((o) => (
            <Select.Item
              key={o.valeur}
              value={o.valeur}
              disabled={o.desactive}
              // `Resting=* , Multiselect=False, Type=Text` : hauteur 35px,
              // retrait 8px, gouttière 10px. Figma.md:17713
              className={cn(ELEMENT_LISTE, 'h-[35px] gap-2.5 px-2')}
            >
              <Select.ItemText className="truncate">{o.libelle}</Select.ItemText>
            </Select.Item>
          ))}
        </PanneauDeroulant>
      </Select.Root>
    </CadreChamp>
  );
}

/* ── Sélecteur multiple ───────────────────────────────────────────────────── */

export type ProprietesSelecteurMulti<V extends string = string> = Omit<
  ProprietesSelecteur<V>,
  'valeur' | 'valeurParDefaut' | 'onChangement'
> & {
  valeurs?: V[];
  valeursParDefaut?: V[];
  onChangement?: (valeurs: V[]) => void;
  /**
   * Comment le déclencheur replié montre ce qui est choisi.
   * `'pastilles'` = `State=Filled, Multiselect=True` (:14544, quatre pastilles
   * violet 050 qui passent à la ligne) ; `'compte'` = une ligne de texte, pour
   * les sélections longues que le Figma ne montre pas repliées.
   */
  apparenceValeur?: 'pastilles' | 'compte';
};

/**
 * SelecteurMulti — `Dropdown simple=Multiselect` (:19504).
 *
 * À n'employer que si `ChampTags` ne convient pas : voir la note du designer en
 * tête de fichier.
 */
export function SelecteurMulti<V extends string = string>({
  libelle,
  options,
  valeurs,
  valeursParDefaut,
  onChangement,
  substitut = 'Choisir des options',
  apparenceValeur = 'pastilles',
  erreur,
  aide,
  desactive,
  requis,
  nom,
  className,
  ouvert,
  onOuvertChange,
  teinteTags,
}: ProprietesSelecteurMulti<V>) {
  const id = useId();
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;
  const decrit = [erreur ? idErreur : null, aide && !erreur ? idAide : null]
    .filter(Boolean)
    .join(' ');

  return (
    <CadreChamp id={id} libelle={libelle} erreur={erreur} aide={aide} className={className}>
      <Select.Root<V, true>
        multiple
        value={valeurs}
        defaultValue={valeursParDefaut}
        onValueChange={(v) => onChangement?.(v)}
        disabled={desactive}
        required={requis}
        name={nom}
        open={ouvert}
        onOpenChange={onOuvertChange}
      >
        <Select.Trigger
          id={id}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit || undefined}
          aria-required={requis || undefined}
          className={cn(
            'group/declencheur',
            classesDeclencheur(Boolean(erreur), teinteTags),
            // Le boîtier grandit avec les pastilles : 8 + 64 + 8 = 80px pour deux
            // rangées dans le Figma (:14619). On garde 36px comme plancher.
            apparenceValeur === 'pastilles' && 'h-auto min-h-[var(--h-champ)] py-2',
          )}
        >
          <Select.Value className="min-w-0 flex-1">
            {(v: V[] | null) => {
              const choisies = (v ?? []).map(
                (x) => options.find((o) => o.valeur === x)?.libelle ?? x,
              );
              if (choisies.length === 0) return <Substitut>{substitut}</Substitut>;
              if (apparenceValeur === 'compte') {
                return (
                  <span className="truncate">
                    {choisies.length} sélectionné{choisies.length > 1 ? 's' : ''}
                  </span>
                );
              }
              return (
                // `Answers` — rangée qui passe à la ligne, gouttière 10px. Figma.md:14632
                <span className="flex flex-1 flex-wrap items-center gap-2.5">
                  {choisies.map((libelleChoix) => (
                    <PastilleReponse key={libelleChoix}>{libelleChoix}</PastilleReponse>
                  ))}
                </span>
              );
            }}
          </Select.Value>
          <Chevron />
        </Select.Trigger>

        <PanneauDeroulant>
          {options.map((o) => (
            <Select.Item
              key={o.valeur}
              value={o.valeur}
              disabled={o.desactive}
              // `Resting=*, Multiselect=True, Type=Text` : hauteur 36px,
              // gouttière 8px. Figma.md:17841
              className={cn(ELEMENT_LISTE, 'h-9 gap-2 px-2')}
            >
              <CaseDeListe />
              <Select.ItemText className="truncate">{o.libelle}</Select.ItemText>
            </Select.Item>
          ))}
        </PanneauDeroulant>
      </Select.Root>
    </CadreChamp>
  );
}

/* ── Sélecteur d'univers ──────────────────────────────────────────────────── */

/**
 * SelecteurUnivers — `Dropdown simple=Univers` (:19827).
 *
 * Les options sont des tags de verticale. Le tag vient de `Tag.tsx` (LOT 3) : on
 * ne le redessine pas ici, sous peine d'avoir deux vérités sur la même pastille.
 * L'élément de liste passe en retrait 4px 8px pour laisser respirer un tag de
 * 27px dans une ligne de 35px (:18130).
 */
export function SelecteurUnivers({
  libelle,
  options,
  valeurs,
  valeursParDefaut,
  onChangement,
  substitut = 'Choisir des options',
  erreur,
  aide,
  desactive,
  requis,
  nom,
  className,
  ouvert,
  onOuvertChange,
  teinteTags,
}: Omit<ProprietesSelecteurMulti<Univers>, 'options' | 'apparenceValeur'> & {
  options: readonly OptionUnivers[];
}) {
  const id = useId();
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;
  const decrit = [erreur ? idErreur : null, aide && !erreur ? idAide : null]
    .filter(Boolean)
    .join(' ');

  return (
    <CadreChamp id={id} libelle={libelle} erreur={erreur} aide={aide} className={className}>
      <Select.Root<Univers, true>
        multiple
        value={valeurs}
        defaultValue={valeursParDefaut}
        onValueChange={(v) => onChangement?.(v)}
        disabled={desactive}
        required={requis}
        name={nom}
        open={ouvert}
        onOpenChange={onOuvertChange}
      >
        <Select.Trigger
          id={id}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit || undefined}
          aria-required={requis || undefined}
          className={cn(
            'group/declencheur',
            classesDeclencheur(Boolean(erreur), teinteTags),
            'h-auto min-h-[var(--h-champ)] py-2',
          )}
        >
          <Select.Value className="min-w-0 flex-1">
            {(v: Univers[] | null) =>
              (v ?? []).length === 0 ? (
                <Substitut>{substitut}</Substitut>
              ) : (
                <span className="flex flex-1 flex-wrap items-center gap-2">
                  {(v ?? []).map((u) => (
                    <TagUnivers key={u} univers={u} />
                  ))}
                </span>
              )
            }
          </Select.Value>
          <Chevron />
        </Select.Trigger>

        <PanneauDeroulant>
          {options.map((o) => (
            <Select.Item
              key={o.valeur}
              value={o.valeur}
              disabled={o.desactive}
              label={o.libelle ?? o.valeur}
              // `Resting=*, Multiselect=True, Type=Tag` : retrait 4px 8px,
              // gouttière 8px, hauteur 35px. Figma.md:18123
              className={cn(ELEMENT_LISTE, 'h-[35px] gap-2 px-2 py-1')}
            >
              <CaseDeListe />
              {/* Le nom lisible de la verticale est porté par le tag lui-même ;
                  `label` le redonne à la recherche au clavier de base-ui. */}
              <Select.ItemText render={<span />} className="flex items-center">
                <TagUnivers univers={o.valeur} />
              </Select.ItemText>
            </Select.Item>
          ))}
        </PanneauDeroulant>
      </Select.Root>
    </CadreChamp>
  );
}

/* ── Sélecteur de personne (photo) ────────────────────────────────────────── */

export type ProprietesSelecteurPersonne<V extends string = string> = {
  libelle?: string;
  options: readonly OptionPersonne<V>[];
  valeur?: V | null;
  valeurParDefaut?: V | null;
  onChangement?: (valeur: V | null) => void;
  /** Recopié du Figma. Figma.md:15864 */
  substitut?: string;
  erreur?: string;
  aide?: string;
  desactive?: boolean;
  requis?: boolean;
  nom?: string;
  className?: string;
  ouvert?: boolean;
  onOuvertChange?: (ouvert: boolean) => void;
};

/**
 * SelecteurPersonne — `Input / Agent select` (:15724) et
 * `Dropdown simple=Picture dropdown` (:20309), qui sont le même composant vu
 * replié puis déplié.
 *
 * Particularité relevée : une fois REMPLI, le déclencheur passe de 36px à 50px
 * pour loger la photo de 42px (:16273), et le nom passe en Body/Bold (:16325).
 * Tant qu'il est vide, il reste un déroulant de 36px avec son texte substitut
 * (:15864). Les deux hauteurs sont dans le Figma ; c'est bien un champ qui
 * grandit quand on le remplit.
 */
export function SelecteurPersonne<V extends string = string>({
  libelle,
  options,
  valeur,
  valeurParDefaut,
  onChangement,
  substitut = 'Choisir un.e agent.e',
  erreur,
  aide,
  desactive,
  requis,
  nom,
  className,
  ouvert,
  onOuvertChange,
}: ProprietesSelecteurPersonne<V>) {
  const id = useId();
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;
  const decrit = [erreur ? idErreur : null, aide && !erreur ? idAide : null]
    .filter(Boolean)
    .join(' ');

  return (
    <CadreChamp id={id} libelle={libelle} erreur={erreur} aide={aide} className={className}>
      <Select.Root<V, false>
        value={valeur}
        defaultValue={valeurParDefaut}
        onValueChange={(v) => onChangement?.(v)}
        disabled={desactive}
        required={requis}
        name={nom}
        open={ouvert}
        onOpenChange={onOuvertChange}
      >
        <Select.Trigger
          id={id}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit || undefined}
          aria-required={requis || undefined}
          className={cn(
            'group/declencheur',
            classesDeclencheur(Boolean(erreur)),
            // Vide, le boîtier fait 36px (:15806). Rempli, il fait 50px pour
            // loger la photo de 42px, et son retrait vertical tombe à 0
            // (`padding: 0px 8px`, :16269). On laisse donc la hauteur au contenu,
            // avec 36px comme plancher : c'est vrai que le champ soit piloté ou
            // non, là où un test sur `valeur` raterait le mode autonome.
            'h-auto min-h-[var(--h-champ)] py-0',
          )}
        >
          <Select.Value className="min-w-0 flex-1">
            {(v: V | null) => {
              const choisie = options.find((o) => o.valeur === v);
              if (!choisie) return <Substitut>{substitut}</Substitut>;
              return (
                // `Agent name` — retrait 4px, gouttière 10px. Figma.md:16292
                <span className="flex min-w-0 flex-1 items-center gap-2.5 p-1">
                  <AvatarOption nom={choisie.libelle} photo={choisie.photo} />
                  <span className="t-body-bold truncate text-black">{choisie.libelle}</span>
                </span>
              );
            }}
          </Select.Value>
          <Chevron />
        </Select.Trigger>

        {/* Le panneau photo a un retrait de 4px sur les quatre côtés, là où les
            trois autres n'en ont que verticalement. Figma.md:16522 */}
        <PanneauDeroulant className="p-1">
          {options.map((o) => (
            <Select.Item
              key={o.valeur}
              value={o.valeur}
              disabled={o.desactive}
              label={o.libelle}
              // `Agent name` — hauteur 50px, retrait 4px, gouttière 10px.
              // Figma.md:20585 (repos), :20641 (survol), :20698 (cliqué).
              className={cn(ELEMENT_LISTE, 'h-[50px] gap-2.5 p-1')}
            >
              <AvatarOption nom={o.libelle} photo={o.photo} />
              <Select.ItemText className="t-body-bold truncate text-black">
                {o.libelle}
              </Select.ItemText>
            </Select.Item>
          ))}
        </PanneauDeroulant>
      </Select.Root>
    </CadreChamp>
  );
}

/* ── Pièces communes ──────────────────────────────────────────────────────── */

/**
 * Le panneau, portail et positionnement compris.
 *
 * `alignItemWithTrigger={false}` : par défaut, `Select` de base-ui superpose
 * l'option choisie au déclencheur, à la manière d'un menu natif de macOS. Le
 * Figma pose le panneau SOUS le déclencheur, à 4px (:14847) — on désactive donc
 * l'alignement natif.
 */
function PanneauDeroulant({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Select.Portal>
      <Select.Positioner
        side="bottom"
        align="start"
        sideOffset={4}
        alignItemWithTrigger={false}
        className="z-50"
      >
        <Select.Popup className={cn(PANNEAU_DEROULANT, className)}>
          <Select.List className={LISTE_DEROULANTE}>{children}</Select.List>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  );
}

/**
 * La case d'un élément de liste multisélection.
 *
 * `Select.ItemIndicator` ne s'affiche que quand l'option est choisie : on peint
 * donc la case vide en dessous, et la case noire par-dessus. Ni l'une ni l'autre
 * n'est un contrôle — la sémantique est sur l'option (voir `CaseVisuelle`).
 * Figma.md:15472 (case vide), :18068 (case cochée noire).
 */
function CaseDeListe() {
  return (
    <span className="relative flex size-5 shrink-0 items-center justify-center">
      <CaseVisuelle />
      <Select.ItemIndicator className="absolute inset-0">
        <CaseVisuelle cochee />
      </Select.ItemIndicator>
    </span>
  );
}

/**
 * PastilleReponse — la pastille d'un choix dans un déclencheur multi replié.
 * Figma.md:14659 : retrait 4px, fond #F8F5FF, rayon 8px, hauteur 27px, texte noir.
 *
 * Ce n'est PAS un `Tag` de `Tag.tsx` : le Figma lui refuse la bordure noire et
 * l'ombre rétro que portent tous les tags. C'est un accusé de réception à
 * l'intérieur d'un champ, pas une étiquette de contenu — d'où sa place ici.
 */
export function PastilleReponse({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-[27px] items-center rounded-[var(--r-md)] bg-[var(--violet-050)] p-1',
        't-body text-black',
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * AvatarOption — photo ronde de 42px. Figma.md:16308
 *
 * Le repli est obligatoire : une photo manquante ne doit ni trouer la ligne ni
 * la faire sauter. On garde donc le disque de 42px, rempli des initiales sur
 * fond violet 050 — même surface, même rythme, quelle que soit la donnée.
 */
/* Renommé depuis `Avatar` : `components/pacha/Avatar.tsx` exporte déjà un
   composant de ce nom, avec une autre API (`src` et une échelle de cotes, un
   repli géré par la primitive). Deux `Avatar` dans un même design system, c'est
   une collision à l'import et un doute permanent sur lequel utiliser. Celui-ci
   est l'avatar d'une OPTION de liste déroulante : son nom le dit maintenant. */
export function AvatarOption({
  nom,
  photo,
  className,
}: {
  nom: string;
  photo?: string;
  className?: string;
}) {
  const initiales = nom
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      // L'image de fond plutôt qu'un <img> : le Figma décrit un remplissage
      // (`background: url(...)`), et un fond ne casse pas la mise en page quand
      // l'URL est morte — il ne montre alors que les initiales dessous.
      style={photo ? { backgroundImage: `url(${JSON.stringify(photo)})` } : undefined}
      className={cn(
        'flex size-[42px] shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-[var(--violet-050)] bg-cover bg-center',
        't-caption-bold text-black',
        className,
      )}
    >
      {/* Les initiales restent sous la photo : décoratives quand elle existe,
          seul repère quand elle manque. Le nom est toujours écrit à côté, donc
          rien n'est perdu pour un lecteur d'écran. */}
      <span aria-hidden="true" className={photo ? 'sr-only' : undefined}>
        {initiales}
      </span>
    </span>
  );
}
