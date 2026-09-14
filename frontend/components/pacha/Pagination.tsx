'use client';

import { useId } from 'react';

import { Bouton } from './Bouton';
import { Icone } from './Icone';
import { Selecteur } from './Selecteur';
import { cn } from '@/lib/utils';

/**
 * Pagination — « 1–25 sur 1 893 », précédent, suivant, taille de page.
 *
 * PAS DE PAGES NUMÉROTÉES, et c'est un choix. Sur 1 893 candidatures visibles
 * client, une rangée « 1 2 3 … 76 » propose 76 destinations dont aucune ne veut
 * rien dire : personne ne sait ce qu'il y a page 43. Ce qui sert vraiment, c'est
 * de savoir OÙ L'ON EST (le compte), d'avancer d'un cran, et de changer la
 * taille du lot pour arrêter de tourner les pages. Le jour où un écran a besoin
 * de sauter à une page précise, c'est un champ « aller à la page », pas une
 * rangée de numéros.
 *
 * CE QUE LE COMPTEUR DOIT DIRE À VOIX HAUTE. Après un clic sur « Suivant », la
 * page se recharge sous le curseur : pour qui n'y voit pas, rien n'a bougé. La
 * plage est donc dans une région `aria-live="polite"` — elle est relue à chaque
 * changement, et elle seule. Mettre toute la barre en `aria-live` relirait aussi
 * les libellés des boutons, à chaque fois.
 *
 * TROIS PIÈCES DU SYSTÈME, ZÉRO CONTRÔLE NEUF : `Bouton` pour les deux flèches,
 * `Selecteur` pour la taille de page, `Icone` pour les chevrons. Le sélecteur
 * porte son libellé AU-DESSUS (c'est l'anatomie de `CadreChamp`, partagée par
 * toute la famille des champs) : la rangée est donc alignée sur sa ligne de
 * base basse (`items-end`) plutôt que centrée, sans quoi le compteur flotterait
 * au milieu d'un contrôle à deux étages.
 */

export type ProprietesPagination = {
  /** Le nombre total d'éléments, toutes pages confondues. */
  total: number;
  /** La page courante, à partir de 1. */
  page: number;
  /** Le nombre d'éléments par page. */
  taille: number;
  onPageChange: (page: number) => void;
  /**
   * Les tailles proposées. Absent ⇒ pas de sélecteur : une liste qui n'a que
   * deux pages n'a pas besoin qu'on discute de sa granularité.
   */
  taillesDisponibles?: readonly number[];
  onTailleChange?: (taille: number) => void;
  /**
   * Ce qu'on compte, au pluriel et en minuscules. « candidatures », « mandats ».
   * Rendu dans « 1–25 sur 1 893 candidatures » — un nombre nu ne dit pas de quoi.
   */
  objets?: string;
  /** Désactive les deux flèches, le temps d'un chargement. */
  chargement?: boolean;
  className?: string;
};

/** Espace fine insécable entre les tranches de milliers. */
function formaterNombre(n: number): string {
  return n.toLocaleString('fr-FR');
}

export function Pagination({
  total,
  page,
  taille,
  onPageChange,
  taillesDisponibles,
  onTailleChange,
  objets,
  chargement = false,
  className,
}: ProprietesPagination) {
  const idPlage = useId();
  const pages = Math.max(1, Math.ceil(total / taille));
  // Une page hors bornes n'est pas un cas théorique : elle arrive dès qu'un
  // filtre réduit la liste alors qu'on était page 7. On borne l'affichage
  // plutôt que de montrer « 151–175 sur 12 ».
  const pageBornee = Math.min(Math.max(1, page), pages);
  const premier = total === 0 ? 0 : (pageBornee - 1) * taille + 1;
  const dernier = Math.min(pageBornee * taille, total);

  const plage =
    total === 0
      ? `Aucun résultat`
      : `${formaterNombre(premier)}–${formaterNombre(dernier)} sur ${formaterNombre(total)}${
          objets ? ` ${objets}` : ''
        }`;

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-wrap items-end justify-between gap-4', className)}
    >
      <p
        id={idPlage}
        aria-live="polite"
        // `aria-atomic` : la phrase se relit en entier. Sans lui, certains
        // lecteurs n'annoncent que les mots qui ont changé — « 26 51 » —, ce
        // qui est pire que le silence.
        aria-atomic="true"
        className="t-body-hl text-black"
      >
        {plage}
      </p>

      <div className="flex items-end gap-4">
        {taillesDisponibles && taillesDisponibles.length > 1 && (
          <Selecteur
            libelle="Par page"
            className="w-[104px]"
            options={taillesDisponibles.map((t) => ({ valeur: String(t), libelle: String(t) }))}
            valeur={String(taille)}
            onChangement={(v) => {
              if (!v) return;
              onTailleChange?.(Number(v));
              // Changer la taille depuis la page 7 renverrait sur une page qui
              // n'existe peut-être plus. On repart du début : c'est le seul
              // point de repère qui tienne quelle que soit la nouvelle taille.
              onPageChange(1);
            }}
            desactive={chargement || !onTailleChange}
          />
        )}

        <div className="flex items-center gap-2">
          <Bouton
            apparence="contour"
            taille="sm"
            disabled={chargement || pageBornee <= 1}
            onClick={() => onPageChange(pageBornee - 1)}
            iconeAvant={<Icone nom="icon-chevron-left" className="size-4" />}
          >
            Précédent
          </Bouton>
          <Bouton
            apparence="contour"
            taille="sm"
            disabled={chargement || pageBornee >= pages}
            onClick={() => onPageChange(pageBornee + 1)}
            iconeApres={<Icone nom="icon-chevron-right" className="size-4" />}
          >
            Suivant
          </Bouton>
          {/* Le rang de la page n'est pas affiché — il n'apporte rien à côté de
              la plage — mais il aide à se situer quand on navigue au clavier
              sans voir la liste changer. */}
          <span className="sr-only">
            Page {pageBornee} sur {pages}
          </span>
        </div>
      </div>
    </nav>
  );
}
