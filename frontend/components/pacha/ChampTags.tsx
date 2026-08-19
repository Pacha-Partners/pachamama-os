'use client';

import { Combobox } from '@base-ui/react/combobox';
import { Select } from '@base-ui/react/select';
import { X } from 'lucide-react';
import { useCallback, useId, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { CaseVisuelle } from './Cases';
import {
  CHAMP_BOITIER,
  CHAMP_SUBSTITUT_SAISIE,
  CHAMP_VALEUR,
  CadreChamp,
  MessageErreur,
} from './Champ';
import {
  ELEMENT_LISTE,
  LISTE_DEROULANTE,
  PANNEAU_DEROULANT,
  type Option,
} from './Selecteur';

/**
 * LE SYSTÈME DE TAGS — `Input / tags` (Figma.md:18733).
 *
 * ┌─ NOTE DU DESIGNER, RECOPIÉE DU FIGMA (:21582) ────────────────────────────┐
 * │ « Note: the multiple choice dropdown input should be used only if the tag  │
 * │   system is not working in this specific case. »                          │
 * └───────────────────────────────────────────────────────────────────────────┘
 * C'est ICI que se fait le choix multiple par défaut. `SelecteurMulti` est le
 * recours, pas l'inverse. La raison est visible dans la maquette : les puces
 * montrent tous les choix possibles d'un coup, et l'état de chacun ; un déroulant
 * replié cache les deux.
 *
 * ANATOMIE DE `Input / tags` (:18733)
 *   colonne, gouttière 4px
 *   ├─ `Title of tags`   Caption/Bold noir                        :18770
 *   └─ `Tags`            rangée qui passe à la ligne, gouttière 8px :18792
 *       ├─ `Tag action` × n   puces à bascule                      :18814
 *       └─ `Tag "other"`      la puce qui ouvre le reste           :19158
 *
 * ÉTATS DE LA PUCE — `Tag action`, axe `State`
 *   Default    fond #F8F5FF, rayon 8px, retrait 8px, hauteur 35px   :18603
 *   Hover      fond #CCB8FF + ombre douce                           :18646
 *   Selected   fond #371B7E, texte BLANC                            :18690
 *
 * Le texte blanc sur violet 900 est la seconde et dernière exception à « le texte
 * est toujours noir » — et elle est écrite noir sur blanc dans le Figma à la
 * ligne :18724. On ne l'étend pas ailleurs.
 *
 * ÉTATS DE LA PUCE « AUTRE » — `Tag "other"`
 *   Closed     26×35, fond #F8F5FF, texte #371B7E                   :21503
 *   Opened     29×35, fond #371B7E, texte #FFFFFF, panneau dessous  :21098
 *   Le panneau (:21178) est celui du déroulant multisélection : 223px de large,
 *   156px de haut, bordure 2px noire, options à case à cocher de 36px (:21221).
 *
 * DEUX COMPOSANTS, DEUX BESOINS
 *   `ChampTags`  la famille du Figma : un jeu d'options connu, toutes visibles.
 *   `SaisieTags` un champ à chips avec filtre au clavier, pour les listes de
 *                centaines d'entrées (compétences, entreprises) qu'on ne peut pas
 *                étaler en puces. Sa mécanique n'est pas dans le Figma ; son
 *                habillage, si — voir son propre commentaire.
 */

/* ── Petit utilitaire d'état ───────────────────────────────────────────────── */

/**
 * Laisse le composant fonctionner piloté (`valeurs` fourni) ou autonome.
 * Sans ça, un simple spécimen doit câbler un `useState` pour voir une puce
 * s'allumer, et on finit par ne jamais tester le composant.
 */
function useSelection<V extends string>(
  valeurs: V[] | undefined,
  onChangement: ((v: V[]) => void) | undefined,
  parDefaut: V[],
): [V[], (v: V[]) => void] {
  const [interne, setInterne] = useState<V[]>(parDefaut);
  const pilote = valeurs !== undefined;
  const courant = pilote ? valeurs : interne;
  const changer = useCallback(
    (v: V[]) => {
      if (!pilote) setInterne(v);
      onChangement?.(v);
    },
    [pilote, onChangement],
  );
  return [courant, changer];
}

/* ── La puce à bascule ─────────────────────────────────────────────────────── */

/**
 * PuceChoix — `Tag action`, axe `State` (:18603, :18646, :18690).
 *
 * Un vrai `<button>` avec `aria-pressed` : c'est une bascule, pas un lien. Le
 * survol est une pseudo-classe ; seul « sélectionné » est une prop, parce que
 * seul lui vient de l'état de l'application.
 *
 * Ce n'est pas le `TagAction` de `Tag.tsx` (LOT 3) : celui-ci a trois niveaux
 * d'appui et une bordure, celle-ci a un état binaire et pas de bordure. Deux
 * objets différents qui portent le même nom dans le Figma — on garde la puce de
 * champ ici, avec le champ auquel elle appartient.
 */
export function PuceChoix({
  selectionnee,
  desactive,
  className,
  children,
  ...reste
}: {
  selectionnee?: boolean;
  desactive?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed' | 'disabled'>) {
  return (
    <button
      type="button"
      aria-pressed={selectionnee}
      disabled={desactive}
      className={cn(
        // :18610 — retrait 8px, gouttière 8px, hauteur 35px, rayon 8px (:18617).
        'inline-flex h-[35px] items-center gap-2 rounded-[var(--r-md)] px-2',
        't-body',
        selectionnee
          ? // :18703 — fond violet 900, texte blanc.
            'bg-[var(--violet-900)] text-white'
          : // :18616 — fond violet 050, texte noir.
            'bg-[var(--violet-050)] text-black',
        // :18659 — au survol, violet 200 et ombre douce.
        'enabled:hover:bg-[var(--violet-200)] enabled:hover:text-black',
        'enabled:hover:shadow-[var(--ombre-douce)]',
        'disabled:cursor-not-allowed disabled:bg-[var(--encre-100)] disabled:text-[var(--encre-300)]',
        className,
      )}
      {...reste}
    >
      {children}
    </button>
  );
}

/* ── Le champ de tags ─────────────────────────────────────────────────────── */

export type ProprietesChampTags<V extends string = string> = {
  libelle?: string;
  options: readonly Option<V>[];
  valeurs?: V[];
  valeursParDefaut?: V[];
  onChangement?: (valeurs: V[]) => void;
  /**
   * Combien d'options s'affichent en puces. Au-delà, elles passent derrière la
   * puce « autre ». Le Figma en montre huit plus la puce « autre » (:18792) ;
   * ce n'est pas une contrainte du composant, mais c'est son intention.
   */
  visibles?: number;
  erreur?: string;
  aide?: string;
  desactive?: boolean;
  className?: string;
};

/**
 * ChampTags — `Input / tags` (:18733).
 *
 * Le clavier : chaque puce est un bouton, donc atteignable par tabulation et
 * basculable par Entrée ou Espace, sans une ligne de gestion d'événement. La
 * puce « autre » ouvre un `Select` multisélection de `@base-ui/react`, qui
 * apporte flèches, Début/Fin, Échap, clic extérieur et `aria-expanded`.
 */
export function ChampTags<V extends string = string>({
  libelle,
  options,
  valeurs,
  valeursParDefaut = [],
  onChangement,
  visibles = 8,
  erreur,
  aide,
  desactive,
  className,
}: ProprietesChampTags<V>) {
  const id = useId();
  const idTitre = `${id}-titre`;
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;
  const [choix, setChoix] = useSelection(valeurs, onChangement, valeursParDefaut);

  const enPuces = options.slice(0, visibles);
  const enTrop = options.slice(visibles);

  const basculer = (v: V) =>
    setChoix(choix.includes(v) ? choix.filter((x) => x !== v) : [...choix, v]);

  // Le titre est un `<span>` relié par `aria-labelledby`, jamais un `<label>` :
  // un `<label>` doit désigner UN contrôle, et il y en a ici autant que de puces.
  return (
    <div className={cn('flex w-full flex-col gap-1', className)}>
      {/* `Title of tags` — Caption/Bold noir. Figma.md:18770 */}
      {libelle && (
        <span id={idTitre} className="t-caption-bold text-black">
          {libelle}
        </span>
      )}

      {/* `Tags` — rangée qui passe à la ligne, gouttière 8px. Figma.md:18792 */}
      <div
        role="group"
        aria-labelledby={libelle ? idTitre : undefined}
        aria-describedby={
          [erreur ? idErreur : null, aide && !erreur ? idAide : null].filter(Boolean).join(' ') ||
          undefined
        }
        className="flex flex-wrap items-start gap-2"
      >
        {enPuces.map((o) => (
          <PuceChoix
            key={o.valeur}
            selectionnee={choix.includes(o.valeur)}
            desactive={desactive || o.desactive}
            onClick={() => basculer(o.valeur)}
          >
            {o.libelle}
          </PuceChoix>
        ))}

        {enTrop.length > 0 && (
          <PuceAutre options={enTrop} choix={choix} onBasculer={basculer} desactive={desactive} />
        )}
      </div>

      {aide && !erreur && (
        <p id={idAide} className="t-caption text-[var(--encre-500)]">
          {aide}
        </p>
      )}
      {erreur && <MessageErreur id={idErreur}>{erreur}</MessageErreur>}
    </div>
  );
}

/**
 * PuceAutre — `Tag "other"` (:21503 fermée, :21098 ouverte).
 *
 * Le glyphe : le Figma exporte les NOMS de couches, pas leur contenu, et la
 * couche de texte s'appelle « Tag ». On ne sait donc que sa largeur — 10px
 * fermée, 13px ouverte, soit un caractère unique. On met « + », et l'inversion
 * de fond suffit à dire que c'est ouvert. Le libellé accessible, lui, est écrit
 * en clair : une puce d'un seul caractère est muette sans lui.
 */
function PuceAutre<V extends string>({
  options,
  choix,
  onBasculer,
  desactive,
}: {
  options: readonly Option<V>[];
  choix: V[];
  onBasculer: (v: V) => void;
  desactive?: boolean;
}) {
  const selectionnees = options.filter((o) => choix.includes(o.valeur)).map((o) => o.valeur);

  return (
    <Select.Root<V, true>
      multiple
      value={selectionnees}
      onValueChange={(nouvelles) => {
        // On ne touche qu'aux valeurs de CE panneau : celles des puces visibles
        // restent sous le contrôle de leur propre bouton.
        const ajoutees = nouvelles.filter((v) => !selectionnees.includes(v));
        const retirees = selectionnees.filter((v) => !nouvelles.includes(v));
        [...ajoutees, ...retirees].forEach(onBasculer);
      }}
      disabled={desactive}
    >
      <Select.Trigger
        aria-label={`Afficher les ${options.length} autres options`}
        className={cn(
          // :21552 — 26×35, retrait 8px, rayon 8px, fond violet 050, texte violet 900.
          'inline-flex h-[35px] items-center justify-center rounded-[var(--r-md)] px-2',
          't-body bg-[var(--violet-050)] text-[var(--violet-900)]',
          // :21148 — ouverte : fond violet 900, texte blanc.
          'data-popup-open:bg-[var(--violet-900)] data-popup-open:text-white',
          'enabled:hover:bg-[var(--violet-200)] enabled:hover:text-black',
          'enabled:hover:shadow-[var(--ombre-douce)]',
          'disabled:cursor-not-allowed disabled:bg-[var(--encre-100)] disabled:text-[var(--encre-300)]',
        )}
      >
        <span aria-hidden="true">+</span>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner
          side="bottom"
          align="start"
          sideOffset={4}
          alignItemWithTrigger={false}
          className="z-50"
        >
          {/* Le panneau de la puce « autre » fait 223px, pas la largeur de son
              déclencheur de 26px — la puce est trop petite pour l'ancrer.
              Figma.md:21178 */}
          <Select.Popup className={cn(PANNEAU_DEROULANT, 'w-[223px]')}>
            <Select.List className={LISTE_DEROULANTE}>
              {options.map((o) => (
                <Select.Item
                  key={o.valeur}
                  value={o.valeur}
                  disabled={o.desactive}
                  // :21221 — retrait 8px, gouttière 8px, hauteur 36px.
                  className={cn(ELEMENT_LISTE, 'h-9 gap-2 px-2')}
                >
                  <span className="relative flex size-5 shrink-0 items-center justify-center">
                    <CaseVisuelle />
                    <Select.ItemIndicator className="absolute inset-0">
                      <CaseVisuelle cochee />
                    </Select.ItemIndicator>
                  </span>
                  <Select.ItemText className="truncate">{o.libelle}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

/* ── La saisie filtrante à chips ──────────────────────────────────────────── */

export type ProprietesSaisieTags<V extends string = string> = {
  libelle?: string;
  options: readonly Option<V>[];
  valeurs?: V[];
  valeursParDefaut?: V[];
  onChangement?: (valeurs: V[]) => void;
  /** Recopié du Figma tel quel, accent manquant compris. Figma.md:16900 */
  substitut?: string;
  /** Message quand le filtre ne laisse rien. Absent du Figma. */
  texteVide?: string;
  erreur?: string;
  aide?: string;
  desactive?: boolean;
  requis?: boolean;
  nom?: string;
  className?: string;
};

/**
 * SaisieTags — un champ à chips qu'on filtre au clavier.
 *
 * CE QUI VIENT DU FIGMA
 *   le boîtier, ses états et ses cotes            → `Champ`
 *   les chips à l'intérieur du champ, violet 050,
 *   rayon 8px, retrait 4px, hauteur 27px           :14659
 *   le boîtier qui grandit à 80px sur deux rangées :14619
 *   le panneau et ses options                      :14991, :21221
 *   la croix de fermeture de 12px                  :18211
 *
 * CE QUI N'EN VIENT PAS, et qu'il faut savoir
 *   La SAISIE FILTRANTE. Aucune variante du Figma ne montre de texte tapé dans un
 *   champ multisélection. On l'ajoute parce que le produit a des listes de
 *   plusieurs centaines d'entrées (compétences, entreprises) qu'aucune des trois
 *   familles relevées ne peut présenter : `ChampTags` les étalerait sur dix
 *   rangées, `SelecteurMulti` obligerait à défiler à l'aveugle. C'est un ajout
 *   assumé, pas un relevé — consigné au rapport.
 *   Le message de liste vide, également absent, est paramétrable.
 *
 * `Combobox` de `@base-ui/react` fournit la mécanique : filtre par `Intl.Collator`
 * (donc « developpeur » trouve « développeur »), navigation aux flèches, Retour
 * arrière qui retire la dernière chip, Échap qui referme.
 */
export function SaisieTags<V extends string = string>({
  libelle,
  options,
  valeurs,
  valeursParDefaut = [],
  onChangement,
  substitut = 'Ecrire ici...',
  texteVide = 'Aucun résultat',
  erreur,
  aide,
  desactive,
  requis,
  nom,
  className,
}: ProprietesSaisieTags<V>) {
  const id = useId();
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;
  const decrit = [erreur ? idErreur : null, aide && !erreur ? idAide : null]
    .filter(Boolean)
    .join(' ');

  const [choix, setChoix] = useSelection(valeurs, onChangement, valeursParDefaut);
  const filtre = Combobox.useFilter({ sensitivity: 'base' });

  const libelleDe = useCallback(
    (v: V) => options.find((o) => o.valeur === v)?.libelle ?? v,
    [options],
  );
  // Les éléments sont les VALEURS, pas des objets : `Combobox` compare par
  // `Object.is` et n'expose pas `isItemEqualToValue`, donc deux objets recréés à
  // chaque rendu ne se reconnaîtraient jamais. La liste est mémoïsée pour la même
  // raison — son identité sert de clé au filtre interne.
  const elements = useMemo(() => options.map((o) => o.valeur), [options]);

  return (
    <CadreChamp id={id} libelle={libelle} erreur={erreur} aide={aide} className={className}>
      <Combobox.Root<V, true>
        multiple
        items={elements}
        // Le filtre porte sur le LIBELLÉ, pas sur la valeur technique.
        filter={(v, requete) => filtre.contains(libelleDe(v as V), requete)}
        value={choix}
        onValueChange={(v) => setChoix(v)}
        disabled={desactive}
        required={requis}
        name={nom}
      >
        {/* `Combobox.Chips` devient le boîtier : c'est lui qui reçoit le clic et
            donne le focus à la saisie. Il grandit avec les chips (:14619). */}
        {/* `:enabled` ne s'applique qu'aux contrôles : sur ce conteneur, les états
            survol et désactivé s'écrivent donc en clair, pas avec les recettes
            `CHAMP_SURVOL` / `CHAMP_DESACTIVE` de `Champ`. Mêmes valeurs. */}
        <Combobox.Chips
          className={cn(
            CHAMP_BOITIER,
            'h-auto min-h-[var(--h-champ)] flex-wrap gap-2.5 py-1.5',
            !desactive && [
              // :14020 — survol : bordure 2px #5D6979 + ombre douce.
              'hover:border-2 hover:border-[var(--encre-600)] hover:px-[7px]',
              'hover:shadow-[var(--ombre-douce)]',
              // :14171 — focus : bordure 2px noire + ombre douce. Le focus est
              // sur la saisie à l'intérieur, d'où `has-[:focus-visible]`.
              'has-[:focus-visible]:border-2 has-[:focus-visible]:border-black',
              'has-[:focus-visible]:px-[7px] has-[:focus-visible]:shadow-[var(--ombre-douce)]',
            ],
            // :17518 — erreur : bordure rouge, et elle ne cède ni au survol ni
            // au focus, parce que c'est elle qui porte l'information.
            erreur && [
              'border-[#ff2626] hover:border-[#ff2626] has-[:focus-visible]:border-[#ff2626]',
              'hover:border-2 has-[:focus-visible]:border-2',
            ],
            // :17644 — désactivé : fond #E7E6EB, bordure #DEE3ED.
            desactive && 'cursor-not-allowed border-[#dee3ed] bg-[var(--encre-100)]',
          )}
        >
          <Combobox.Value>
            {(v: V[]) =>
              v.map((valeur) => (
                <Combobox.Chip
                  key={valeur}
                  // :14659 — retrait 4px, fond violet 050, rayon 8px, hauteur 27px.
                  className="inline-flex h-[27px] items-center gap-1 rounded-[var(--r-md)] bg-[var(--violet-050)] p-1 t-body text-black"
                >
                  {libelleDe(valeur)}
                  {/* La croix de 12px du tag du Figma (:18211). Les chips du
                      champ n'en ont pas dans la maquette : sans elle, un tag
                      posé par erreur ne s'enlève qu'au Retour arrière. */}
                  <Combobox.ChipRemove
                    aria-label={`Retirer ${libelleDe(valeur)}`}
                    className="flex size-3 items-center justify-center text-black opacity-60 hover:opacity-100"
                  >
                    <X aria-hidden="true" className="size-3" />
                  </Combobox.ChipRemove>
                </Combobox.Chip>
              ))
            }
          </Combobox.Value>
          <Combobox.Input
            id={id}
            placeholder={choix.length === 0 ? substitut : undefined}
            aria-invalid={erreur ? true : undefined}
            aria-describedby={decrit || undefined}
            aria-required={requis || undefined}
            className={cn(
              'min-w-24 flex-1 bg-transparent outline-none',
              CHAMP_VALEUR,
              CHAMP_SUBSTITUT_SAISIE,
              erreur && 'placeholder:text-[var(--encre-250)]',
            )}
          />
        </Combobox.Chips>

        <Combobox.Portal>
          <Combobox.Positioner side="bottom" align="start" sideOffset={4} className="z-50">
            <Combobox.Popup className={PANNEAU_DEROULANT}>
              <Combobox.Empty className="t-body px-3 py-2 text-[var(--encre-500)]">
                {texteVide}
              </Combobox.Empty>
              <Combobox.List className={LISTE_DEROULANTE}>
                {(valeur: V) => (
                  <Combobox.Item
                    key={valeur}
                    value={valeur}
                    // :21221 — retrait 8px, gouttière 8px, hauteur 36px.
                    className={cn(ELEMENT_LISTE, 'h-9 gap-2 px-2')}
                  >
                    <span className="relative flex size-5 shrink-0 items-center justify-center">
                      <CaseVisuelle />
                      <Combobox.ItemIndicator className="absolute inset-0">
                        <CaseVisuelle cochee />
                      </Combobox.ItemIndicator>
                    </span>
                    <span className="truncate">{libelleDe(valeur)}</span>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </CadreChamp>
  );
}
