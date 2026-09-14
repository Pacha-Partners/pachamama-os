'use client';

import { useId } from 'react';

import {
  CadreChamp,
  CHAMP_BOITIER,
  CHAMP_DESACTIVE,
  CHAMP_ERREUR,
  CHAMP_FOCUS,
  CHAMP_SUBSTITUT_SAISIE,
  CHAMP_SURVOL,
  CHAMP_VALEUR,
} from './Champ';
import { cn } from '@/lib/utils';

/**
 * ZoneTexte — le `<textarea>` qui manquait à la famille `Champ`.
 *
 * `Champ.tsx` n'expose qu'un `<input>`. Or un ATS est fait de texte long :
 * l'argumentaire client d'une candidature, une note d'entretien, un motif de KO.
 * Faute de composant, chacun de ces écrans allait redessiner sa propre boîte —
 * et le design system aurait eu deux vérités sur la couleur d'une bordure de
 * focus.
 *
 * L'ANATOMIE EST CELLE DE `Champ`, REPRISE SANS LA RECOPIER. Les sept recettes
 * de classes de `Champ.tsx` sont exportées précisément pour ça, et elles sont
 * importées ici telles quelles : `CHAMP_BOITIER`, `CHAMP_SURVOL`, `CHAMP_FOCUS`,
 * `CHAMP_ERREUR`, `CHAMP_DESACTIVE`, `CHAMP_VALEUR`, `CHAMP_SUBSTITUT_SAISIE`.
 * Le jour où la bordure de survol change dans `Champ.tsx`, elle change ici sans
 * qu'on y touche. Le cadre libellé / contrôle / erreur est le `CadreChamp`
 * commun, donc `aria-describedby`, `aria-invalid` et la gouttière de 4px se
 * comportent exactement comme sur un champ texte.
 *
 * TROIS AJUSTEMENTS, et seulement trois, tous imposés par le passage d'une
 * ligne à plusieurs :
 *
 * · la hauteur fixe `--h-champ` devient un plancher (`min-h`), et la boîte
 *   `flex` centrée du champ texte redevient un `block` — un `<textarea>` n'a
 *   pas d'enfant à disposer, et son contenu doit partir du HAUT de la boîte ;
 * · le retrait vertical existe, alors que le champ texte n'en a pas besoin, et
 *   il suit la même compensation que le retrait horizontal de `Champ` : 8px
 *   avec une bordure de 1px, 7px avec une bordure de 2px, pour que le texte ne
 *   saute pas d'un pixel sous le curseur ;
 * · `resize-y` seulement. Le redimensionnement horizontal casse la mise en page
 *   des colonnes, et `resize: none` prive d'un réglage utile sur un long texte.
 *
 * LE COMPTEUR DE CARACTÈRES N'EST PAS UNE RÉGION VIVANTE. Le relire à chaque
 * frappe rendrait la saisie inutilisable au lecteur d'écran. Il est rattaché au
 * champ par `aria-describedby` : il est donc annoncé à la prise de focus
 * — « il reste 500 caractères » — et consultable ensuite à la demande. Le seul
 * moment où il s'annonce tout seul est le dépassement, qui est une erreur.
 */

export type ProprietesZoneTexte = {
  libelle?: string;
  /** Message d'erreur. Sa présence met la zone en état d'erreur. */
  erreur?: string;
  /** Texte d'aide sous la zone. Masqué quand une erreur s'affiche. */
  aide?: string;
  requis?: boolean;
  /** Nombre de lignes visibles au repos. Défaut : 4. */
  lignes?: number;
  /**
   * Affiche « 128 / 500 » sous la zone. Sans `maxLength`, affiche le seul
   * compte — utile sur un champ dont la longueur compte sans être bornée.
   */
  compteur?: boolean;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'>;

/**
 * Le boîtier multiligne : `CHAMP_BOITIER` dont on relâche la hauteur.
 * `block` remplace le `flex` du champ texte — une boîte flex sur un `<textarea>`
 * n'a aucun enfant à disposer et perturbe le rendu du curseur sur certains
 * moteurs. Le reste (bordure, rayon, fond, retrait horizontal) est intact.
 */
export const ZONE_TEXTE_BOITIER = cn(
  CHAMP_BOITIER,
  'block h-auto min-h-[var(--h-champ)] py-2',
);

export function ZoneTexte({
  libelle,
  erreur,
  aide,
  requis,
  lignes = 4,
  compteur = false,
  className,
  id: idFourni,
  disabled,
  maxLength,
  value,
  defaultValue,
  ...reste
}: ProprietesZoneTexte) {
  const idAuto = useId();
  const id = idFourni ?? idAuto;
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;
  const idCompteur = `${id}-compteur`;

  // Le compteur suit la valeur pilotée quand il y en a une, et retombe sur la
  // valeur initiale sinon. Il n'introduit PAS d'état : une zone de texte non
  // pilotée dont le compteur serait piloté aurait deux sources de vérité.
  const texte = String(value ?? defaultValue ?? '');
  const nombre = texte.length;
  const depasse = maxLength !== undefined && nombre > maxLength;

  // Le dépassement EST une erreur : il doit produire un vrai message, sinon
  // `aria-describedby` pointerait vers un identifiant qui n'existe pas.
  const messageErreur =
    erreur ??
    (depasse && maxLength !== undefined
      ? `${nombre - maxLength} caractère${nombre - maxLength > 1 ? 's' : ''} de trop.`
      : undefined);

  const decrit = [
    messageErreur ? idErreur : null,
    aide && !messageErreur ? idAide : null,
    compteur ? idCompteur : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <CadreChamp
      id={id}
      libelle={libelle}
      erreur={messageErreur}
      aide={aide}
      className={className}
    >
      <textarea
        id={id}
        rows={lignes}
        disabled={disabled}
        required={requis}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        aria-required={requis || undefined}
        aria-invalid={messageErreur ? true : undefined}
        aria-describedby={decrit || undefined}
        className={cn(
          ZONE_TEXTE_BOITIER,
          CHAMP_VALEUR,
          CHAMP_SUBSTITUT_SAISIE,
          CHAMP_SURVOL,
          // La compensation verticale double celle que `CHAMP_SURVOL` et
          // `CHAMP_FOCUS` appliquent déjà à l'horizontale : 1+8 = 2+7.
          'enabled:hover:py-[7px]',
          CHAMP_FOCUS,
          'enabled:focus:py-[7px]',
          CHAMP_DESACTIVE,
          'resize-y',
          // Barre de défilement fine, teinte #ADABB3 — la même que celle des
          // panneaux déroulants (Selecteur.tsx, Figma.md:15244).
          '[scrollbar-color:var(--encre-250)_transparent] [scrollbar-width:thin]',
          messageErreur && CHAMP_ERREUR,
          messageErreur && 'placeholder:text-[var(--encre-250)]',
        )}
        {...reste}
      />

      {compteur && (
        <p
          id={idCompteur}
          className={cn(
            't-caption self-end',
            depasse ? 'text-black' : 'text-[var(--encre-500)]',
          )}
        >
          {maxLength === undefined ? (
            `${nombre} caractère${nombre > 1 ? 's' : ''}`
          ) : (
            <>
              <span aria-hidden="true">
                {nombre} / {maxLength}
              </span>
              {/* Écrit deux fois : le rapport « 128 / 500 » se lit d'un coup
                  d'œil mais s'annonce « cent vingt-huit barre oblique cinq
                  cents », ce qui n'est pas une phrase. */}
              <span className="sr-only">
                {depasse
                  ? `${nombre - maxLength} caractères de trop, sur ${maxLength} autorisés`
                  : `${nombre} caractères saisis sur ${maxLength} autorisés`}
              </span>
            </>
          )}
        </p>
      )}
    </CadreChamp>
  );
}
