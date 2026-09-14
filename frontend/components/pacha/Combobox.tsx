'use client';

import { Combobox as ComboboxBase } from '@base-ui/react/combobox';
import { Check, ChevronDown, X } from 'lucide-react';
import { useCallback, useId, useMemo } from 'react';

import {
  CadreChamp,
  CHAMP_BOITIER,
  CHAMP_SUBSTITUT_SAISIE,
  CHAMP_VALEUR,
} from './Champ';
import {
  ELEMENT_LISTE,
  LISTE_DEROULANTE,
  PANNEAU_DEROULANT,
  type Option,
} from './Selecteur';
import { cn } from '@/lib/utils';

/**
 * Combobox — une liste longue, une seule valeur, qu'on trouve en tapant.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE TROU QU'IL BOUCHE, ET LA MESURE QUI LE PROUVE
 * ─────────────────────────────────────────────────────────────────────────
 * `ref.metier` compte **238 entrées**. Les trois façons de les présenter avec
 * l'existant échouent, chacune d'une manière différente :
 *
 * · `Selecteur` ouvre un panneau de 156px de haut, soit quatre lignes visibles
 *   sur deux cent trente-huit. On fait défiler à l'aveugle.
 * · `ChampTags` étalerait deux cent trente-huit puces.
 * · `SaisieTags` filtre au clavier — c'est le bon geste — mais il est
 *   **multiple par construction** : il rend un tableau, affiche des chips, et
 *   `Retour arrière` y retire la dernière valeur. Le forcer à une seule valeur
 *   demanderait de lui mentir sur son contrat à chaque appel.
 *
 * Ce fichier est donc `SaisieTags` moins le multiple : la même primitive
 * `combobox` de Base UI, le même filtre par `Intl.Collator` (« developpeur »
 * trouve « développeur », « ingenieur » trouve « ingénieur »), le même boîtier
 * `Champ`, le même panneau que `Selecteur` — mais un `<input>` unique qui porte
 * le libellé de la valeur choisie, et une croix pour l'effacer.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES ÉLÉMENTS SONT LES VALEURS, PAS DES OBJETS
 * ─────────────────────────────────────────────────────────────────────────
 * Même piège que dans `SaisieTags`, et même parade : `Combobox` compare ses
 * éléments par `Object.is`. Un tableau d'objets `{ valeur, libelle }` recréé à
 * chaque rendu ne se reconnaîtrait jamais lui-même, et la valeur sélectionnée
 * cesserait d'être cochée au premier redessin. On lui donne donc les chaînes,
 * et `itemToStringLabel` traduit la chaîne en libellé — c'est ce libellé, et
 * non le code technique, qui s'affiche dans le champ et sur lequel porte le
 * filtre. La liste est mémoïsée : son identité sert de clé au filtre interne.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PAS DE BASCULE MOBILE VERS `Feuille`, ET C'EST RAISONNÉ
 * ─────────────────────────────────────────────────────────────────────────
 * `Selecteur` ouvre une feuille modale sous `md`, parce qu'un panneau ancré de
 * quatre lignes est inutilisable au pouce. Ici l'interaction est déjà la bonne
 * sur mobile : le clavier logiciel s'ouvre, on tape trois lettres, la liste
 * fond à cinq entrées. La feuille n'apporterait qu'un écran de plus entre
 * l'intention et le résultat. Décision consignée ; à revoir si l'usage la
 * dément.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEUX RÉGLAGES QUI COMPTENT
 * ─────────────────────────────────────────────────────────────────────────
 * · **`limite`** borne le nombre d'options RENDUES (100 par défaut). Sans elle,
 *   ouvrir le panneau à vide monte 238 nœuds d'un coup. Le filtre travaille
 *   toujours sur la liste entière : on ne coupe que l'affichage.
 * · **`autoHighlight` reste à `false`.** Surligner la première correspondance
 *   fait valider par mégarde à la touche Entrée le métier qui se trouvait en
 *   tête, au lieu de celui qu'on allait choisir. Sur un champ dont les entrées
 *   se ressemblent (« Product Manager », « Product Marketing Manager »), c'est
 *   une erreur qu'on ne remarque pas.
 *
 * ⚠ CE N'EST PAS UN CHAMP LIBRE. La valeur rendue appartient forcément à
 * `options` : hors de la liste, le champ se vide à la fermeture. Pour laisser
 * écrire n'importe quoi, il faut un `Champ` — et une colonne qui l'accepte.
 */

export type ProprietesCombobox<V extends string = string> = {
  libelle?: string;
  options: readonly Option<V>[];
  /** La valeur choisie. `null` = aucune. */
  valeur?: V | null;
  valeurParDefaut?: V | null;
  onChangement?: (valeur: V | null) => void;
  /** Texte substitut du champ vide. « Rechercher un métier ». */
  substitut?: string;
  /** Message quand le filtre ne laisse rien. */
  texteVide?: string;
  erreur?: string;
  aide?: string;
  desactive?: boolean;
  requis?: boolean;
  /** Nom du champ pour l'envoi de formulaire. */
  nom?: string;
  /** Nombre maximum d'options rendues. Défaut : 100. */
  limite?: number;
  className?: string;
};

export function Combobox<V extends string = string>({
  libelle,
  options,
  valeur,
  valeurParDefaut = null,
  onChangement,
  substitut = 'Rechercher…',
  texteVide = 'Aucun résultat',
  erreur,
  aide,
  desactive,
  requis,
  nom,
  limite = 100,
  className,
}: ProprietesCombobox<V>) {
  const id = useId();
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;
  const decrit = [erreur ? idErreur : null, aide && !erreur ? idAide : null]
    .filter(Boolean)
    .join(' ');

  const filtre = ComboboxBase.useFilter({ sensitivity: 'base' });

  const libelleDe = useCallback(
    (v: V) => options.find((o) => o.valeur === v)?.libelle ?? v,
    [options],
  );
  const elements = useMemo(() => options.map((o) => o.valeur), [options]);
  const desactivees = useMemo(
    () => new Set(options.filter((o) => o.desactive).map((o) => o.valeur)),
    [options],
  );

  return (
    <CadreChamp id={id} libelle={libelle} erreur={erreur} aide={aide} className={className}>
      <ComboboxBase.Root<V, false>
        items={elements}
        itemToStringLabel={libelleDe}
        // Le filtre porte sur le LIBELLÉ, jamais sur le code technique : taper
        // « produit » doit trouver « Product Manager », pas échouer parce que
        // la valeur stockée est `product_manager`.
        filter={(v, requete) => filtre.contains(libelleDe(v as V), requete)}
        value={valeur}
        defaultValue={valeurParDefaut}
        onValueChange={(v) => onChangement?.(v)}
        limit={limite}
        autoHighlight={false}
        disabled={desactive}
        required={requis}
        name={nom}
        // Le panneau s'ouvre au clic dans le champ, pas seulement à la frappe :
        // sans cela, rien n'indique qu'une liste existe derrière ce champ.
        openOnInputClick
      >
        {/* `ComboboxBase.InputGroup` devient le boîtier. Comme pour
            `NumberField.Group` et `Combobox.Chips`, `:enabled` ne s'applique pas
            à un `<div>` : les états sont réécrits en clair, avec exactement les
            valeurs de `CHAMP_SURVOL` / `CHAMP_FOCUS` / `CHAMP_DESACTIVE`. */}
        <ComboboxBase.InputGroup
          className={cn(
            CHAMP_BOITIER,
            'gap-1',
            !desactive && [
              'hover:border-2 hover:border-[var(--encre-600)] hover:px-[7px]',
              'hover:shadow-[var(--ombre-douce)]',
              'has-[:focus-visible]:border-2 has-[:focus-visible]:border-black',
              'has-[:focus-visible]:px-[7px] has-[:focus-visible]:shadow-[var(--ombre-douce)]',
            ],
            erreur && [
              'border-[#ff2626] hover:border-[#ff2626] has-[:focus-visible]:border-[#ff2626]',
              'hover:border-2 has-[:focus-visible]:border-2',
            ],
            desactive && 'cursor-not-allowed border-[#dee3ed] bg-[var(--encre-100)]',
          )}
        >
          <ComboboxBase.Input
            id={id}
            placeholder={substitut}
            aria-invalid={erreur ? true : undefined}
            aria-describedby={decrit || undefined}
            aria-required={requis || undefined}
            className={cn(
              'min-w-0 flex-1 bg-transparent outline-none',
              CHAMP_VALEUR,
              CHAMP_SUBSTITUT_SAISIE,
              'disabled:cursor-not-allowed disabled:text-[var(--encre-250)]',
              erreur && 'placeholder:text-[var(--encre-250)]',
            )}
          />

          {/* La croix n'apparaît que lorsqu'il y a quelque chose à effacer :
              Base UI la démonte tant que le champ est vide.
              ⚠ Elle porte `tabindex="-1"` — c'est Base UI qui le pose, et c'est
              cohérent : ce n'est pas le SEUL chemin de retour à « aucune
              valeur ». Vérifié au clavier : vider le champ remet la valeur à
              `null` (`onChangement` reçoit bien `null`, et l'entrée cachée du
              formulaire se vide). La croix est donc un raccourci à la souris,
              pas une porte réservée. */}
          <ComboboxBase.Clear
            aria-label="Effacer la sélection"
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded-[var(--r-xs)]',
              'text-[var(--encre-500)] hover:text-black',
              'focus-visible:outline-2 focus-visible:outline-offset-1',
              'focus-visible:outline-[var(--focus-anneau)]',
            )}
          >
            <X aria-hidden="true" className="size-4" />
          </ComboboxBase.Clear>

          {/* Le chevron reprend celui de `Selecteur` : 20px, noir au repos,
              gris clair désactivé. C'est lui qui dit « ce champ cache une
              liste ».

              ⚠ PAS `ComboboxBase.Icon`, contrairement au `Select.Icon` de
              `Selecteur`. Celui-là est une pièce du sélecteur, sans laquelle
              le contexte manque ; `Combobox.Icon` n'apporte RIEN d'autre
              qu'un `aria-hidden` et des enfants par défaut — le caractère
              « ▼ ». Passé en `render`, il glissait donc un nœud de texte
              « ▼ » À L'INTÉRIEUR du `<svg>` de Lucide (relevé dans le DOM
              rendu). Invisible, parce qu'un texte nu dans un SVG ne se peint
              pas hors d'un `<text>` — mais c'est du bruit, et une version
              future pourrait le peindre. Une icône décorative suffit. */}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-5 shrink-0 text-black',
              desactive && 'text-[var(--encre-300)]',
            )}
          />
        </ComboboxBase.InputGroup>

        <ComboboxBase.Portal>
          <ComboboxBase.Positioner side="bottom" align="start" sideOffset={4} className="z-50">
            {/* Le panneau de `Selecteur`, mais plus haut : ses 156px valent
                quatre lignes, ce qui est le bon format pour une liste fermée de
                cinq options et le mauvais pour un résultat de recherche. */}
            <ComboboxBase.Popup
              className={cn(PANNEAU_DEROULANT, 'max-h-[var(--h-panneau-recherche)]')}
            >
              <ComboboxBase.Empty className="t-body px-3 py-2 text-[var(--encre-500)]">
                {texteVide}
              </ComboboxBase.Empty>
              <ComboboxBase.List className={LISTE_DEROULANTE}>
                {(v: V) => (
                  <ComboboxBase.Item
                    key={v}
                    value={v}
                    disabled={desactivees.has(v)}
                    className={cn(ELEMENT_LISTE, 'h-9 gap-2 px-2')}
                  >
                    <span className="min-w-0 flex-1 truncate">{libelleDe(v)}</span>
                    {/* Une coche, pas une case : le choix est unique, et une
                        case à cocher promettrait qu'on peut en prendre deux. */}
                    <ComboboxBase.ItemIndicator className="flex shrink-0">
                      <Check aria-hidden="true" className="size-4 text-black" />
                    </ComboboxBase.ItemIndicator>
                  </ComboboxBase.Item>
                )}
              </ComboboxBase.List>
            </ComboboxBase.Popup>
          </ComboboxBase.Positioner>
        </ComboboxBase.Portal>
      </ComboboxBase.Root>
    </CadreChamp>
  );
}
