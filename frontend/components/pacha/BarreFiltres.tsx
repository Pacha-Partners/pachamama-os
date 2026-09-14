'use client';

import { useId } from 'react';

import { Bouton } from './Bouton';
import { TagInfo, TagUnivers, type Univers } from './Tag';
import { cn } from '@/lib/utils';

/**
 * BarreFiltres — le conteneur des filtres, le rappel de ce qui est coché, et
 * « tout effacer ».
 *
 * ELLE NE CONTIENT AUCUN CONTRÔLE. Les briques existent déjà et sont complètes :
 * `TagAction` (puce à bascule), `Selecteur`, `SelecteurMulti`, `SelecteurUnivers`,
 * `ChampTags`, `SaisieTags`, `Champ recherche`. Ce qui manquait, c'est le
 * CADRE : la rangée qui les tient, la ligne qui rappelle les critères actifs, le
 * compte de résultats, et le bouton qui remet tout à zéro. `children` reçoit
 * donc les contrôles tels que l'écran les compose — ce composant ne décide pas
 * lesquels.
 *
 * CE QU'ELLE REMPLACE. `components/vues/PageJobs.tsx:433` porte un `TagsChoisis`
 * fait main, dont le commentaire explique qu'il réécrit la croix de retrait
 * parce que « doter `TagInfo` d'un `onRetirer` est une modification du design
 * system ». Le raisonnement est juste ; la conséquence — chaque page réécrivant
 * sa croix — ne l'est pas. Le système possède désormais ce patron une fois, en
 * COMPOSANT `TagInfo` plutôt qu'en le modifiant : la croix est un enfant du tag,
 * pas une prop du tag.
 *
 * LE RAPPEL DES FILTRES EST UNE RÉGION VIVANTE. Cocher un filtre ne déplace pas
 * le focus : sans annonce, un utilisateur au clavier ne sait pas que sa liste
 * vient de passer de 533 à 12 lignes. Le compte de résultats est donc en
 * `aria-live="polite"`, et lui seul.
 *
 * LA GARDE DU VIDE EST ICI, pas chez l'appelant — même raisonnement que dans
 * `PageJobs` : portée par le parent, elle disparaît à la première extraction, et
 * il reste un conteneur `flex` vide qui porte quand même la gouttière de sa
 * colonne.
 */

export type FiltreActif = {
  /** Identifiant unique du critère coché. Souvent `${axe}-${valeur}`. */
  cle: string;
  /** Ce que le critère dit, en clair. « CDI », « Lyon », « Tech ». */
  libelle: string;
  /**
   * L'axe, pour l'annonce : « Retirer le filtre Contrat : CDI ». Sans lui,
   * vingt croix se nomment toutes « Retirer le filtre Lyon ».
   */
  axe?: string;
  /**
   * Le critère EST une verticale : il prend alors la couleur de la verticale
   * et le `TagUnivers` du système, qui sait déjà se retirer lui-même. Pour tout
   * le reste, la puce est neutre — peindre un contrat en jaune People
   * brouillerait la frontière entre verticale et interface.
   */
  univers?: Univers;
  onRetirer: () => void;
};

export function BarreFiltres({
  children,
  actifs = [],
  onToutEffacer,
  resultats,
  libelleResultats = 'résultat',
  chargement = false,
  className,
}: {
  /** Les contrôles de filtre, composés par l'écran. */
  children?: React.ReactNode;
  /** Les critères cochés, rappelés en puces retirables. */
  actifs?: readonly FiltreActif[];
  /** Absent ⇒ pas de bouton « Tout effacer ». */
  onToutEffacer?: () => void;
  /** Le nombre de lignes après filtrage. Annoncé poliment à chaque changement. */
  resultats?: number;
  /** Le nom de ce qu'on compte, au SINGULIER. Le pluriel est ajouté ici. */
  libelleResultats?: string;
  /** Le compte est en cours de recalcul : on ne l'annonce pas encore. */
  chargement?: boolean;
  className?: string;
}) {
  // Identifiant local et non littéral : deux barres de filtres sur la même page
  // — une par onglet, par exemple — partageraient sinon le même `id`, et le
  // second groupe serait rattaché au titre du premier.
  const idTitreActifs = useId();

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {children && (
        <div className="flex flex-wrap items-end gap-3">{children}</div>
      )}

      {actifs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Le groupe est nommé : sans cela, la rangée de puces s'annonce comme
              une suite de boutons sans rapport les uns avec les autres. */}
          <span className="sr-only" id={idTitreActifs}>
            Filtres actifs
          </span>
          <ul aria-labelledby={idTitreActifs} className="flex flex-wrap items-center gap-2">
            {actifs.map((filtre) => (
              <li key={filtre.cle}>
                <PuceFiltre filtre={filtre} />
              </li>
            ))}
          </ul>

          {onToutEffacer && (
            <Bouton apparence="contour" taille="sm" onClick={onToutEffacer}>
              Tout effacer
            </Bouton>
          )}
        </div>
      )}

      {resultats !== undefined && (
        <p aria-live="polite" aria-atomic="true" className="t-caption text-[var(--encre-600)]">
          {chargement
            ? 'Calcul en cours…'
            : `${resultats.toLocaleString('fr-FR')} ${libelleResultats}${resultats > 1 ? 's' : ''}`}
        </p>
      )}
    </div>
  );
}

/**
 * Une puce de filtre coché, retirable.
 *
 * Deux rendus, un seul contrat. Sur une verticale, `TagUnivers` fait le travail
 * en entier : il porte la teinte et sait déjà se retirer. Partout ailleurs, la
 * puce est un `TagInfo` du système DANS LEQUEL on pose un bouton de retrait —
 * on compose, on ne redessine pas. C'est exactement ce que faisait `PageJobs`,
 * à ceci près que ça vit désormais à un seul endroit.
 */
export function PuceFiltre({ filtre }: { filtre: FiltreActif }) {
  const nomAccessible = filtre.axe
    ? `Retirer le filtre ${filtre.axe} : ${filtre.libelle}`
    : `Retirer le filtre ${filtre.libelle}`;

  if (filtre.univers) {
    return (
      <TagUnivers univers={filtre.univers} onRetirer={filtre.onRetirer}>
        {filtre.libelle}
      </TagUnivers>
    );
  }

  return (
    <TagInfo regime="travail">
      <span className="flex items-center gap-2">
        {filtre.libelle}
        <button
          type="button"
          onClick={filtre.onRetirer}
          className="rounded-[var(--r-full)] leading-none text-black hover:text-[var(--encre-600)]"
        >
          <span aria-hidden="true">✕</span>
          <span className="sr-only">{nomAccessible}</span>
        </button>
      </span>
    </TagInfo>
  );
}
