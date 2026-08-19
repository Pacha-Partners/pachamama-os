'use client';

import { Search } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * LA FAMILLE DES CHAMPS — le boîtier commun, le champ texte, le champ recherche.
 *
 * Ce fichier porte l'anatomie que TOUS les champs partagent (`Champ`,
 * `Selecteur`, `ChampTags`), parce que le Figma la partage lui aussi : la couche
 * `Input / Search/Default` est réutilisée telle quelle dans `Input / text`,
 * `Input / search`, `Input / dropdown` et `Input / Agent select`. Un seul
 * boîtier, quatre usages. Les recettes de classes sont donc exportées : si un
 * jour la bordure change, elle change en un endroit.
 *
 * ANATOMIE (Figma.md:16775 pour `Input / text`)
 *   colonne, gouttière 4px
 *   ├─ Title      Caption/Bold 12/16, noir              Figma.md:16848
 *   └─ boîtier    36px, blanc, bordure noire 1px,       Figma.md:16872
 *                 rayon 8px, retrait 8px, gouttière 10px
 *
 * ÉTATS DU CHAMP TEXTE — relevés un par un, aucun deviné
 *   Resting / Filled=False   bordure 1px #000, texte substitut #A8B1BD   :16794
 *   Resting / Filled=True    bordure 1px #000, valeur noire              :17311
 *   Hover    / Filled=False  bordure 2px #5D6979 + ombre douce           :16921
 *   Focus    / Filled=False  bordure 2px #000   + ombre douce            :17051
 *   Focus    / Filled=True   idem, valeur noire                          :17181
 *   Error    / Filled=False  bordure 1px #FF2626, substitut #ADABB3      :17440
 *   Disabled / Filled=False  fond #E7E6EB, bordure 1px #DEE3ED           :17567
 *
 * `Filled` n'est PAS une prop : c'est l'état du DOM. Un champ est rempli quand
 * il a une valeur, et le CSS n'a rien à changer entre les deux (le Figma ne fait
 * varier que la couleur du texte, ce que `placeholder:` gère seul). De même
 * `Hover` et `Focus` sont des pseudo-classes, jamais des props — fabriquer une
 * prop `survol` rendrait le composant faux dès le premier vrai curseur.
 *
 * TROIS ARBITRAGES, assumés
 *
 * · Le retrait passe de 8px à 7px quand la bordure passe à 2px. Le Figma
 *   épaissit la bordure au survol et au focus ; appliqué tel quel, le texte
 *   sauterait d'un pixel sous le curseur. 1+8 = 2+7 : la boîte de contenu ne
 *   bouge plus, et la bordure reste au chiffre du Figma.
 *
 * · Le libellé reste NOIR dans tous les états. Le Figma le montre en #371B7E à
 *   l'erreur (:17494) et au désactivé (:17621), en #5D6979 au survol du
 *   déroulant (:13996) et en noir partout ailleurs — trois couleurs pour une
 *   même couche, c'est du bruit de maquette, pas une intention. La règle dure du
 *   DS tranche : le texte est noir.
 *
 * · Le message d'erreur existe en TEXTE. Le Figma ne prévoit qu'une bordure
 *   rouge (hauteur totale 56px = 16 + 4 + 36, aucune ligne pour un message).
 *   Une bordure rouge seule est invisible pour un daltonien et muette pour un
 *   lecteur d'écran : on ajoute la ligne, reliée par `aria-describedby`.
 *
 * · L'anneau de focus global d'`app.css` n'est PAS supprimé. Passer une bordure
 *   de 1 à 2px est un indicateur de focus trop faible pour être le seul.
 */

/* ── Recettes partagées ─────────────────────────────────────────────────────
   Importées par Selecteur.tsx et ChampTags.tsx. Ce sont des chaînes et non un
   composant, parce que le boîtier est tantôt un <input>, tantôt un <button>,
   tantôt un <div> : seul le vêtement est commun.                            */

/** Le boîtier au repos. Figma.md:16872 */
export const CHAMP_BOITIER =
  'box-border flex h-[var(--h-champ)] w-full items-center gap-2.5 ' +
  'rounded-[var(--r-md)] border border-black bg-white px-2';

/** Survol : bordure 2px #5D6979 (= --encre-600) + élévation douce. Figma.md:17000 */
export const CHAMP_SURVOL =
  'enabled:hover:border-2 enabled:hover:border-[var(--encre-600)] ' +
  'enabled:hover:px-[7px] enabled:hover:shadow-[var(--ombre-douce)]';

/** Focus : bordure 2px noire + élévation douce. Figma.md:17130 */
export const CHAMP_FOCUS =
  'enabled:focus:border-2 enabled:focus:border-black ' +
  'enabled:focus:px-[7px] enabled:focus:shadow-[var(--ombre-douce)]';

/**
 * Erreur : bordure rouge 1px, et elle ne bouge plus. Figma.md:17518
 * Le Figma ne décrit ni survol ni focus en erreur — on garde donc le rouge, qui
 * est l'information, plutôt que de le remplacer par le noir du focus.
 */
export const CHAMP_ERREUR =
  'border-[#ff2626] enabled:hover:border-[#ff2626] enabled:focus:border-[#ff2626] ' +
  'enabled:hover:border-2 enabled:focus:border-2';

/**
 * Désactivé : fond #E7E6EB (= --encre-100), bordure 1px #DEE3ED. Figma.md:17644
 * Le déroulant désactivé du Figma garde une bordure NOIRE (:13867) alors que le
 * champ texte la décolore. Deux traitements pour un même état : on retient le
 * décoloré, seul des deux à dire « inerte » sans le mot. Divergence signalée au
 * rapport.
 */
export const CHAMP_DESACTIVE =
  'disabled:cursor-not-allowed disabled:border-[#dee3ed] disabled:bg-[var(--encre-100)] ' +
  'disabled:text-[var(--encre-250)] disabled:shadow-none';

/** La valeur saisie : Body/Regular noir. Figma.md:17431 */
export const CHAMP_VALEUR = 't-body text-black';

/** Texte substitut d'un champ de saisie : #A8B1BD. Figma.md:16912 */
export const CHAMP_SUBSTITUT_SAISIE = 'placeholder:text-[var(--encre-300)]';

/** Texte substitut d'un déroulant (« Choisir des options ») : #738296. Figma.md:13604 */
export const CHAMP_SUBSTITUT_OPTIONS = 'text-[var(--encre-500)]';

/* ── Pièces communes ───────────────────────────────────────────────────────── */

/**
 * Le libellé — couche `Title` du Figma, Caption/Bold noir. Figma.md:16848
 * Toujours relié au champ par `htmlFor` : un libellé simplement posé au-dessus
 * n'existe pas pour un lecteur d'écran.
 */
export function Libelle({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn('t-caption-bold text-black', className)}>
      {children}
    </label>
  );
}

/**
 * Le message d'erreur — absent du Figma, exigé par l'accessibilité.
 *
 * Le texte est NOIR, pas rouge, pour deux raisons qui vont dans le même sens :
 * la règle dure du DS (le texte est noir, la couleur ne signale pas), et le
 * contraste — #FF2626 sur blanc donne 3,8:1, sous le seuil AA pour du 12px. Le
 * rouge reste sur la bordure, où il n'a pas à être lu.
 */
export function MessageErreur({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="t-caption-hl text-black">
      {children}
    </p>
  );
}

/**
 * L'ossature libellé / contrôle / erreur, partagée par tous les champs.
 * Gouttière 4px, relevée sur chaque variante du Figma (:16801, :13490, :15743).
 */
export function CadreChamp({
  id,
  libelle,
  erreur,
  aide,
  className,
  children,
}: {
  id?: string;
  libelle?: string;
  erreur?: string;
  aide?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex w-full flex-col gap-1', className)}>
      {libelle && <Libelle htmlFor={id}>{libelle}</Libelle>}
      {children}
      {aide && !erreur && (
        <p id={id ? `${id}-aide` : undefined} className="t-caption text-[var(--encre-500)]">
          {aide}
        </p>
      )}
      {erreur && <MessageErreur id={id ? `${id}-erreur` : 'erreur'}>{erreur}</MessageErreur>}
    </div>
  );
}

/* ── Le champ texte ────────────────────────────────────────────────────────── */

export type ProprietesChamp = {
  libelle?: string;
  /** Message d'erreur. Sa présence met le champ en état d'erreur. */
  erreur?: string;
  /** Texte d'aide sous le champ. Masqué quand une erreur s'affiche. */
  aide?: string;
  /** Variante recherche : loupe à droite. `Input / search`, Figma.md:11424 */
  recherche?: boolean;
  /** Rend la loupe cliquable. Sans ce rappel, elle reste décorative. */
  onRechercher?: () => void;
  requis?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Champ — saisie de texte, ou de recherche avec `recherche`.
 *
 * Le champ de recherche du Figma (`Input / search`, :12852) est le même boîtier,
 * plus un `Button icon` de 21px contenant une loupe de 17px, poussée à droite
 * par `justify-content: space-between` (:12941). La loupe est noire dans le
 * champ (:13041, :13239, :13437) — le triptyque violet #AB8AFF / #8657FF /
 * #371B7E de :11831 appartient au bouton-icône autonome, pas au champ.
 */
export function Champ({
  libelle,
  erreur,
  aide,
  recherche,
  onRechercher,
  requis,
  className,
  id: idFourni,
  disabled,
  ...reste
}: ProprietesChamp) {
  const idAuto = useId();
  const id = idFourni ?? idAuto;
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;

  const decrit = [erreur ? idErreur : null, aide && !erreur ? idAide : null]
    .filter(Boolean)
    .join(' ');

  return (
    <CadreChamp id={id} libelle={libelle} erreur={erreur} aide={aide} className={className}>
      <div className="relative w-full">
        <input
          id={id}
          disabled={disabled}
          required={requis}
          aria-required={requis || undefined}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit || undefined}
          className={cn(
            CHAMP_BOITIER,
            CHAMP_VALEUR,
            CHAMP_SUBSTITUT_SAISIE,
            CHAMP_SURVOL,
            CHAMP_FOCUS,
            CHAMP_DESACTIVE,
            // Le boîtier de recherche réserve la place de la loupe : 21px + la
            // gouttière de 10px du Figma (:12941).
            recherche && 'pr-[39px] enabled:hover:pr-[38px] enabled:focus:pr-[38px]',
            erreur && CHAMP_ERREUR,
            // Le substitut passe de #A8B1BD à #ADABB3 en erreur (:17558) comme
            // au désactivé (:17685).
            erreur && 'placeholder:text-[var(--encre-250)]',
          )}
          {...reste}
        />
        {recherche && <Loupe onRechercher={onRechercher} desactive={disabled} />}
      </div>
    </CadreChamp>
  );
}

/**
 * La loupe du champ de recherche — `Button icon` 21px, retrait 2px, rayon 4px,
 * loupe 17px. Figma.md:11532
 *
 * Bouton réel dès qu'il y a quelque chose à déclencher, icône décorative sinon :
 * un `<button>` sans effet est un piège au clavier.
 */
function Loupe({ onRechercher, desactive }: { onRechercher?: () => void; desactive?: boolean }) {
  const placement = 'absolute right-2 top-1/2 -translate-y-1/2';

  if (!onRechercher) {
    return (
      <Search
        aria-hidden="true"
        className={cn(
          placement,
          'pointer-events-none size-[17px]',
          desactive ? 'text-[var(--encre-300)]' : 'text-black',
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onRechercher}
      disabled={desactive}
      aria-label="Lancer la recherche"
      className={cn(
        placement,
        'flex size-[21px] items-center justify-center rounded-[var(--r-xs)] p-[2px]',
        'text-black enabled:hover:text-[var(--encre-600)] disabled:text-[var(--encre-300)]',
      )}
    >
      <Search aria-hidden="true" className="size-[17px]" />
    </button>
  );
}
