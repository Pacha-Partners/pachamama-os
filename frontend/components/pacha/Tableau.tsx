'use client';

import {
  createColumnHelper,
  createSortedRowModel,
  type Row,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef } from 'react';

import { EtatVide } from './EtatVide';
import { Icone } from './Icone';
import { cn } from '@/lib/utils';

/**
 * Tableau — la grille de données de l'applicatif.
 *
 * IL N'EXISTE PAS DANS LE FIGMA. Le design system relevé couvre le job board :
 * des cartes, des tags, un pipeline. Pas une seule balise `<table>` dans tout le
 * dépôt avant ce fichier. Ce composant est donc ASSEMBLÉ à partir de ce que le
 * système fournit déjà — l'échelle `.t-*`, la rampe encre, les deux hauteurs de
 * ligne d'`app.css` (`--h-ligne` 44 et `--h-ligne-compacte` 36, §8), le régime
 * de surface « travail » de `Carte` — et rien d'autre n'est inventé. Les seuls
 * choix sans source sont l'espacement horizontal des cellules et l'épaisseur du
 * filet de l'en-tête ; ils sont consignés au rapport.
 *
 * POURQUOI TANSTACK TABLE PLUTÔT QU'UN `Array.sort`. `@tanstack/react-table` v9
 * et `@tanstack/react-virtual` étaient déjà dans le `package.json`, importés
 * nulle part. Le tri d'une colonne, seul, tiendrait en dix lignes ; ce que la
 * bibliothèque apporte ici, c'est le MODÈLE DE LIGNES — la même mécanique
 * accueillera demain le filtrage, la sélection, le groupement, sans que la
 * signature de ce composant bouge. La v9 enregistre ses fonctionnalités une par
 * une (`tableFeatures`) : on ne paie que le tri.
 *
 * CE QUE LE COMPOSANT NE FAIT PAS, volontairement : pas de redimensionnement de
 * colonne à la souris, pas de colonnes figées, pas de sélection de lignes, pas
 * de tri multi-colonnes. Chacune est une fonctionnalité TanStack à activer le
 * jour où un écran la demande — les ajouter « au cas où » aurait figé une API
 * que personne n'a encore éprouvée.
 *
 * UN AVERTISSEMENT DE LINT SUBSISTE, ET IL EST ASSUMÉ.
 * `react-hooks/incompatible-library` signale que `useVirtualizer` renvoie des
 * fonctions que le compilateur React ne peut pas mémoïser sans risque de vue
 * périmée — il renonce donc à mémoïser tout ce composant. C'est un manque à
 * gagner de performance, pas un défaut de correction, et le seul moyen de
 * l'éviter serait de retirer la virtualisation. Sur 7 236 candidatures, le
 * calcul est vite fait.
 *
 * SÉMANTIQUE. `<table>` réel, avec `<caption>` masquée visuellement : un lecteur
 * d'écran annonce alors « tableau, N lignes, M colonnes » et sait de quoi le
 * tableau parle. Une grille de `<div>` ne donne ni l'un ni l'autre. Le tri est
 * porté par `aria-sort` sur le `<th>` — l'indicateur dessiné n'est qu'un
 * doublon visuel de cette information.
 */

/* ── Le modèle de lignes ────────────────────────────────────────────────────
   Déclaré au niveau du module, jamais dans le rendu : la v9 rebâtit tout le
   pipeline dès que la référence de `features` change.                       */

const FONCTIONNALITES = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

type Fonctionnalites = typeof FONCTIONNALITES;

/**
 * TanStack contraint sa donnée de ligne à `Record<string, any> | Array<any>`.
 * Une `interface` TypeScript ne satisfait pas cette contrainte (les interfaces
 * n'ont pas d'index implicite, contrairement aux alias de type) : contraindre
 * `L` de la même façon interdirait la moitié des modèles du dépôt. On garde
 * donc un `L` libre côté public, et on ne convertit qu'aux TROIS points de
 * contact avec la bibliothèque — l'accesseur, la cellule, l'identité de ligne.
 */
type LigneBrute = Record<string, unknown>;

/** Ce qu'une colonne sait comparer. Volontairement étroit. */
export type ValeurTri = string | number | boolean | Date | null | undefined;

/**
 * Le comparateur unique, passé en `sortFn` de chaque colonne.
 *
 * TanStack propose des comparateurs prêts (`sortFn_alphanumeric`…), mais ils
 * s'enregistrent dans un registre typé et travaillent sur des valeurs brutes.
 * Ici la valeur triée est déjà normalisée par `triSur` : le comparateur n'a
 * qu'à faire trois choses, et il vaut mieux qu'elles soient lisibles.
 *
 * · `null` et `undefined` tombent toujours en fin de liste, dans les deux sens.
 *   Une valeur absente n'est ni la plus grande ni la plus petite : elle est
 *   hors échelle, et la remonter en tête d'un tri croissant ferait croire à un
 *   minimum.
 * · Les chaînes se comparent avec `localeCompare` en français, `numeric: true` :
 *   sans lui, « Poste 10 » passe avant « Poste 2 », et « Éric » après « Zoé ».
 * · Les dates et les booléens passent par leur valeur numérique.
 */
function comparerValeurs(
  ligneA: Row<Fonctionnalites, LigneBrute>,
  ligneB: Row<Fonctionnalites, LigneBrute>,
  idColonne: string,
): number {
  const a = ligneA.getValue<ValeurTri>(idColonne);
  const b = ligneB.getValue<ValeurTri>(idColonne);

  const aVide = a === null || a === undefined || a === '';
  const bVide = b === null || b === undefined || b === '';
  if (aVide && bVide) return 0;
  // Le signe est fixe : TanStack inverse le résultat en tri décroissant, donc
  // renvoyer un signe fixe est bien ce qui garde les vides en bas des DEUX sens.
  if (aVide) return 1;
  if (bVide) return -1;

  if (a instanceof Date || b instanceof Date) {
    return Number(a instanceof Date ? a.getTime() : a) - Number(b instanceof Date ? b.getTime() : b);
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);

  return String(a).localeCompare(String(b), 'fr', { numeric: true, sensitivity: 'base' });
}

/* ── L'API publique ─────────────────────────────────────────────────────────*/

export type AlignementColonne = 'gauche' | 'centre' | 'droite';

export type ColonneTableau<L> = {
  /** Identifiant stable. Sert de clé React et d'identifiant de tri. */
  cle: string;
  /** Le contenu de l'en-tête. Une chaîne le plus souvent. */
  entete: React.ReactNode;
  /**
   * Le nom accessible de la colonne, quand `entete` n'est pas du texte (une
   * icône, une case à cocher). Sans lui, l'en-tête serait muet.
   */
  enteteAccessible?: string;
  /** Le contenu de la cellule, pour une ligne donnée. */
  cellule: (ligne: L) => React.ReactNode;
  /**
   * La valeur sur laquelle trier. SA PRÉSENCE REND LA COLONNE TRIABLE : un
   * en-tête ne devient cliquable que si l'on sait comparer ce qu'il y a
   * dessous. Une colonne d'actions ou de badges n'en a pas, et c'est normal.
   */
  triSur?: (ligne: L) => ValeurTri;
  /** Largeur fixe en pixels. Sans elle, la colonne se partage le reste. */
  largeur?: number;
  /** Le chiffre s'aligne à droite, le texte à gauche. Défaut : gauche. */
  alignement?: AlignementColonne;
  /** Masque la colonne sous `md`. Pour les colonnes de confort. */
  masquerEnMobile?: boolean;
};

export type SensTri = 'asc' | 'desc';

export type ProprietesTableau<L> = {
  colonnes: readonly ColonneTableau<L>[];
  lignes: readonly L[];
  /** L'identité d'une ligne. Jamais l'index : le tri le déplace. */
  cleDeLigne: (ligne: L) => string;
  /**
   * Ce que le tableau contient, en une phrase. Rendu en `<caption>` masquée.
   * Obligatoire : un tableau sans légende oblige le lecteur d'écran à deviner.
   */
  legende: string;
  /** 44px (défaut) ou 36px — `--h-ligne` / `--h-ligne-compacte`. */
  densite?: 'normale' | 'compacte';
  /** Tri initial. Le tableau gère ensuite son état seul. */
  triInitial?: { cle: string; sens: SensTri };
  /** Prévenu à chaque changement de tri, pour le journaliser ou le persister. */
  onTriChange?: (tri: { cle: string; sens: SensTri } | null) => void;
  /**
   * Rend les lignes activables. Exige `libelleLigne` : une ligne focalisable
   * qui ne se nomme pas est un piège au clavier.
   */
  onLigneActivee?: (ligne: L) => void;
  /** Le nom accessible d'une ligne activable. « Ouvrir la candidature #012 ». */
  libelleLigne?: (ligne: L) => string;
  /** La ligne en surbrillance — celle dont le panneau de détail est ouvert. */
  ligneActive?: (ligne: L) => boolean;
  /** Affiche des lignes de squelette à la place du contenu. */
  chargement?: boolean;
  /** Nombre de lignes de squelette. Défaut : 6. */
  lignesSquelette?: number;
  /** Ce qui s'affiche quand `lignes` est vide. Défaut : un `EtatVide` générique. */
  etatVide?: React.ReactNode;
  /**
   * Le rendu d'une ligne EN ÉCRAN ÉTROIT, quand le tableau n'a plus de sens.
   *
   * ⚠ POURQUOI `masquerEnMobile` NE SUFFIT PAS. Replier des colonnes garde une
   * grille, et une grille garde des largeurs : sur un tableau de neuf colonnes
   * réduit à trois, l'intitulé — ce qu'on vient précisément lire — tombe à
   * quatre-vingt-dix pixels et se tronque. L'en-tête, lui, ne repère plus rien
   * puisqu'il ne reste que trois libellés au-dessus de lignes qui ne s'alignent
   * plus sur les colonnes annoncées.
   *
   * Quand cette fonction est fournie, le tableau cède sous `md` la place à une
   * liste de cartes : chaque ligne se plie sur deux niveaux au lieu de
   * rétrécir. Les deux rendus ne cohabitent jamais — `hidden` retire du flux ET
   * de l'arbre d'accessibilité, un lecteur d'écran n'en voit donc qu'un.
   *
   * ⚠ LE TRI DISPARAÎT AVEC L'EN-TÊTE. C'est assumé : trier tient à des
   * en-têtes cliquables, et il n'y en a plus. Le tri INITIAL, lui, est
   * conservé, puisque l'ordre des lignes est celui du tableau.
   */
  carteMobile?: (ligne: L) => React.ReactNode;
  /**
   * Hauteur de la zone visible, en pixels. Sa présence ACTIVE LA
   * VIRTUALISATION : seules les lignes à l'écran sont montées. À réserver aux
   * listes de plus de quelques centaines de lignes — en dessous, le coût de la
   * mesure dépasse le gain, et le tableau perd la recherche du navigateur
   * (Cmd+F ne trouve que ce qui est monté).
   */
  hauteurVisible?: number;
  className?: string;
};

/* ── Recettes de classes ────────────────────────────────────────────────────*/

const ALIGNEMENTS: Record<AlignementColonne, string> = {
  gauche: 'text-left',
  centre: 'text-center',
  droite: 'text-right',
};

/** Le retrait horizontal d'une cellule. Sans source : choix, consigné. */
const RETRAIT_CELLULE = 'px-3';

export function Tableau<L>({
  colonnes,
  lignes,
  cleDeLigne,
  legende,
  densite = 'normale',
  triInitial,
  onTriChange,
  onLigneActivee,
  libelleLigne,
  ligneActive,
  chargement = false,
  lignesSquelette = 6,
  etatVide,
  carteMobile,
  hauteurVisible,
  className,
}: ProprietesTableau<L>) {
  const hauteurLigne = densite === 'compacte' ? 36 : 44;

  const colonnesTable = useMemo(() => {
    const aide = createColumnHelper<Fonctionnalites, LigneBrute>();
    return colonnes.map((colonne) =>
      aide.accessor(
        // Le type de retour est forcé à `unknown` : sans lui, TanStack infère
        // `ValeurTri` comme paramètre de colonne, et le tableau de colonnes
        // n'est plus assignable à `ColumnDef<…, unknown>[]` qu'attend `useTable`.
        (ligne: LigneBrute): unknown => (colonne.triSur ? colonne.triSur(ligne as unknown as L) : null),
        {
          id: colonne.cle,
          header: () => colonne.entete,
          cell: (contexte) => colonne.cellule(contexte.row.original as unknown as L),
          enableSorting: Boolean(colonne.triSur),
          sortFn: comparerValeurs,
        },
      ),
    );
  }, [colonnes]);

  const donnees = useMemo(() => lignes as readonly LigneBrute[] as LigneBrute[], [lignes]);

  const table = useTable({
    features: FONCTIONNALITES,
    columns: colonnesTable,
    data: donnees,
    getRowId: (ligne: LigneBrute) => cleDeLigne(ligne as unknown as L),
    initialState: triInitial
      ? { sorting: [{ id: triInitial.cle, desc: triInitial.sens === 'desc' }] }
      : undefined,
  });

  /* Le rappel de tri est posté depuis un effet, pas depuis `onSortingChange`.
     La v9 passe à ce rappel soit une valeur, soit une fonction de mise à jour,
     et lui confier le rappel obligerait à résoudre la seconde en lisant l'état
     courant — c'est-à-dire à dupliquer ici la logique de la bibliothèque. Lire
     l'état APRÈS coup dit la même chose, sans risque de divergence. */
  const tri = table.state.sorting;
  const empreinteTri = tri[0] ? `${tri[0].id}:${tri[0].desc ? 'desc' : 'asc'}` : '';
  const derniereEmpreinte = useRef(empreinteTri);
  useEffect(() => {
    // La garde est dans l'effet et non dans ses dépendances : `onTriChange` est
    // presque toujours une fonction fléchée écrite à l'appel, donc de référence
    // neuve à chaque rendu. Sans la garde, l'effet la rappellerait à chaque
    // rendu du parent alors que le tri n'a pas bougé.
    if (derniereEmpreinte.current === empreinteTri) return;
    derniereEmpreinte.current = empreinteTri;
    const [cle, sens] = empreinteTri.split(':');
    onTriChange?.(cle ? { cle, sens: sens as SensTri } : null);
  }, [empreinteTri, onTriChange]);

  const lignesRendues = table.getRowModel().rows;
  const vide = !chargement && lignesRendues.length === 0;

  /* La virtualisation, par lignes d'espacement. Elle garde un `<table>` réel :
     positionner les lignes en absolu casserait l'alignement des colonnes, que
     le moteur de table calcule sur l'ensemble du `<tbody>`. Deux `<tr>` de
     hauteur variable encadrent la fenêtre visible et poussent le contenu à sa
     place — la barre de défilement reste exacte, la mise en page tient. */
  const conteneurRef = useRef<HTMLDivElement>(null);
  const virtualise = hauteurVisible !== undefined && !chargement && lignesRendues.length > 0;
  const virtualiseur = useVirtualizer({
    count: virtualise ? lignesRendues.length : 0,
    getScrollElement: () => conteneurRef.current,
    estimateSize: () => hauteurLigne,
    overscan: 10,
  });
  const fenetre = virtualiseur.getVirtualItems();
  const espaceAvant = virtualise && fenetre.length > 0 ? fenetre[0].start : 0;
  const espaceApres =
    virtualise && fenetre.length > 0
      ? virtualiseur.getTotalSize() - fenetre[fenetre.length - 1].end
      : 0;
  const aRendre = virtualise ? fenetre.map((v) => lignesRendues[v.index]) : lignesRendues;
  const premierIndex = virtualise && fenetre.length > 0 ? fenetre[0].index : 0;

  return (
    <div className={cn('w-full', className)}>
      {/* La liste de cartes, sous `md` seulement. Elle n'existe que si l'appelant
          a dit comment plier une ligne ; sinon le tableau garde son comportement
          d'origine, colonnes repliées comprises. */}
      {carteMobile && !vide && !chargement && (
        <ul className="flex flex-col overflow-hidden rounded-[var(--r-md)] border border-[var(--encre-100)] bg-[var(--fond-carte)] md:hidden">
          {/* ⚠ `.original`, ET C'EST TOUT L'ENJEU DE CETTE LIGNE.
              `getRowModel().rows` rend des LIGNES DE TANSTACK — un objet
              `{ id, index, original, … }` — et non la donnée de l'appelant. Le
              corps du tableau le sait (ses cellules lisent `row.original`) ;
              cette liste ne le savait pas, et passait la ligne TanStack à
              `carteMobile`. Résultat en production, sous 768px : « Statut
              inconnu » et « undefined présentés » sur CHAQUE carte du tableau
              de bord, plus une clé React « undefined » partagée par toutes.
              La clé vient de `ligne.id`, que TanStack calcule déjà avec
              `getRowId` — donc avec `cleDeLigne`. */}
          {lignesRendues.map((ligne) => (
            <li key={ligne.id} className="border-t border-[var(--encre-050)] first:border-t-0">
              {carteMobile(ligne.original as unknown as L)}
            </li>
          ))}
        </ul>
      )}
      <div
        ref={conteneurRef}
        className={cn(
          'w-full overflow-auto rounded-[var(--r-md)] border border-[var(--encre-100)] bg-[var(--fond-carte)]',
          carteMobile && !vide && !chargement && 'hidden md:block',
        )}
        style={hauteurVisible !== undefined ? { maxHeight: hauteurVisible } : undefined}
      >
        <table
          className="w-full border-collapse"
          // Quand la liste est virtualisée, le DOM ne contient plus toutes les
          // lignes : sans ces deux attributs, un lecteur d'écran annoncerait
          // « 20 lignes » sur un tableau qui en compte 7 000.
          aria-rowcount={virtualise ? lignesRendues.length + 1 : undefined}
        >
          <caption className="sr-only">{legende}</caption>

          <thead className="sticky top-0 z-10 bg-[var(--fond-carte)]">
            {table.getHeaderGroups().map((groupe) => (
              <tr key={groupe.id} aria-rowindex={virtualise ? 1 : undefined}>
                {groupe.headers.map((entete) => {
                  const colonne = colonnes.find((c) => c.cle === entete.column.id);
                  const sens = entete.column.getIsSorted();
                  const triable = entete.column.getCanSort();
                  return (
                    <th
                      key={entete.id}
                      scope="col"
                      aria-sort={
                        !triable ? undefined : sens === 'asc' ? 'ascending' : sens === 'desc' ? 'descending' : 'none'
                      }
                      style={colonne?.largeur ? { width: colonne.largeur } : undefined}
                      className={cn(
                        'h-[var(--h-entete-tableau)] border-b border-[var(--encre-100)]',
                        RETRAIT_CELLULE,
                        't-caption-bold whitespace-nowrap text-[var(--encre-600)]',
                        ALIGNEMENTS[colonne?.alignement ?? 'gauche'],
                        colonne?.masquerEnMobile && 'hidden md:table-cell',
                      )}
                    >
                      {entete.isPlaceholder ? null : triable ? (
                        <button
                          type="button"
                          onClick={entete.column.getToggleSortingHandler()}
                          className={cn(
                            'group -mx-1 inline-flex max-w-full items-center gap-1 rounded-[var(--r-xs)] px-1 py-0.5',
                            'hover:bg-[var(--violet-050)]',
                            colonne?.alignement === 'droite' && 'flex-row-reverse',
                          )}
                        >
                          <span className="truncate">
                            <table.FlexRender header={entete} />
                          </span>
                          <IndicateurTri sens={sens} />
                          {/* Le tri est déjà porté par `aria-sort` sur le <th>.
                              Ce qui manque au bouton, c'est ce que le CLIC va
                              faire — l'état actuel ne le dit pas. */}
                          <span className="sr-only">
                            {colonne?.enteteAccessible ? `${colonne.enteteAccessible}. ` : ''}
                            {sens === 'asc' ? 'Trier par ordre décroissant' : 'Trier par ordre croissant'}
                          </span>
                        </button>
                      ) : (
                        <span className="truncate">
                          {colonne?.enteteAccessible ? (
                            <span className="sr-only">{colonne.enteteAccessible}</span>
                          ) : null}
                          <table.FlexRender header={entete} />
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {chargement &&
              Array.from({ length: lignesSquelette }, (_, i) => (
                <LigneSquelette key={i} colonnes={colonnes} hauteur={hauteurLigne} />
              ))}

            {!chargement && espaceAvant > 0 && (
              <tr aria-hidden="true" style={{ height: espaceAvant }} />
            )}

            {!chargement &&
              aRendre.map((ligne, position) => {
                const donnee = ligne.original as unknown as L;
                const activable = Boolean(onLigneActivee);
                const active = ligneActive?.(donnee) ?? false;
                return (
                  <tr
                    key={ligne.id}
                    aria-rowindex={virtualise ? premierIndex + position + 2 : undefined}
                    // LA LIGNE ACTIVABLE EST UN COMPROMIS, ASSUMÉ. La solution
                    // pleinement conforme serait de mettre un <a> ou un
                    // <button> dans la première cellule et de laisser la ligne
                    // inerte. Mais un tableau de pilotage se parcourt à la
                    // souris, et exiger de viser une cellule précise le rendrait
                    // pénible. On rend donc la ligne focalisable, on la nomme
                    // (`aria-label`), et on câble Entrée et Espace — sans quoi
                    // elle serait atteignable au clavier mais inutilisable.
                    tabIndex={activable ? 0 : undefined}
                    aria-label={activable ? libelleLigne?.(donnee) : undefined}
                    onClick={activable ? () => onLigneActivee?.(donnee) : undefined}
                    onKeyDown={
                      activable
                        ? (evenement) => {
                            if (evenement.key !== 'Enter' && evenement.key !== ' ') return;
                            // Espace fait défiler la page par défaut : sur une
                            // ligne focalisée, ce défilement remplacerait
                            // l'activation attendue.
                            evenement.preventDefault();
                            onLigneActivee?.(donnee);
                          }
                        : undefined
                    }
                    className={cn(
                      'border-b border-[var(--encre-050)] last:border-b-0',
                      active && 'bg-[var(--violet-050)]',
                      activable && 'hover:bg-[var(--violet-050)]',
                      // L'anneau global d'app.css est un `outline` : sur une
                      // ligne de tableau il est rogné par `overflow: auto` du
                      // conteneur. Le décalage négatif le ramène à l'intérieur.
                      activable && 'focus-visible:outline-offset-[-2px]',
                    )}
                  >
                    {ligne.getAllCells().map((cellule) => {
                      const colonne = colonnes.find((c) => c.cle === cellule.column.id);
                      return (
                        <td
                          key={cellule.id}
                          style={{ height: hauteurLigne }}
                          className={cn(
                            RETRAIT_CELLULE,
                            't-body text-black',
                            ALIGNEMENTS[colonne?.alignement ?? 'gauche'],
                            colonne?.masquerEnMobile && 'hidden md:table-cell',
                          )}
                        >
                          <table.FlexRender cell={cellule} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

            {!chargement && espaceApres > 0 && (
              <tr aria-hidden="true" style={{ height: espaceApres }} />
            )}
          </tbody>
        </table>

        {vide &&
          (etatVide ?? (
            <EtatVide
              titre="Aucune ligne à afficher"
              description="Il n’y a rien ici pour le moment. Si vous venez de filtrer, élargissez vos critères."
            />
          ))}
      </div>

      {/* L'état de chargement doit s'ENTENDRE, pas seulement se voir : les
          squelettes sont muets par construction. */}
      <p role="status" aria-live="polite" className="sr-only">
        {chargement ? `Chargement de ${legende.toLowerCase()}` : ''}
      </p>
    </div>
  );
}

/**
 * L'indicateur de tri.
 *
 * Trois états, et le troisième compte : au repos, la flèche reste dessinée mais
 * en `--encre-200`, révélée au survol. Sans elle, rien ne dit qu'une colonne est
 * triable avant de l'avoir cliquée. Purement décoratif — `aria-sort` porte
 * l'information sur le `<th>`.
 */
function IndicateurTri({ sens }: { sens: false | 'asc' | 'desc' }) {
  return (
    <Icone
      nom={sens === 'desc' ? 'icon-arrow-down' : 'icon-arrow-up'}
      className={cn(
        'size-3.5 shrink-0',
        sens ? 'text-black' : 'text-transparent group-hover:text-[var(--encre-300)]',
      )}
    />
  );
}

/**
 * Une ligne de chargement. Un bloc gris par colonne, de largeur inégale : des
 * barres toutes identiques lisent comme un motif, pas comme du texte à venir.
 * Le tableau garde ainsi sa hauteur pendant le chargement — la page ne saute
 * pas quand les vraies lignes arrivent.
 */
function LigneSquelette<L>({
  colonnes,
  hauteur,
}: {
  colonnes: readonly ColonneTableau<L>[];
  hauteur: number;
}) {
  return (
    <tr aria-hidden="true" className="border-b border-[var(--encre-050)] last:border-b-0">
      {colonnes.map((colonne, i) => (
        <td
          key={colonne.cle}
          style={{ height: hauteur }}
          className={cn(RETRAIT_CELLULE, colonne.masquerEnMobile && 'hidden md:table-cell')}
        >
          <span
            className="block h-3 animate-pulse rounded-[var(--r-xs)] bg-[var(--encre-100)] motion-reduce:animate-none"
            style={{ width: `${[70, 45, 60, 35, 55][i % 5]}%` }}
          />
        </td>
      ))}
    </tr>
  );
}
