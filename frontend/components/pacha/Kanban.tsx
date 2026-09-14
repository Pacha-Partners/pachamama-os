'use client';

import { useId } from 'react';

import { CompteurStatut } from './StatutProcess';
import { EtatVide } from './EtatVide';
import { MenuActions } from './MenuActions';
import { Squelette } from './Squelette';
import { cn } from '@/lib/utils';

/**
 * Kanban — le pipeline en colonnes.
 *
 * LE GLISSER-DÉPOSER EST HORS PÉRIMÈTRE, ET C'EST ÉCRIT ICI POUR QU'ON NE LE
 * CHERCHE PAS. Le portail Entreprise est en LECTURE : le client regarde où en
 * sont ses candidats, il ne les déplace pas. Aucune dépendance de DnD n'est
 * ajoutée, aucun `draggable` n'est posé. La prop `onDeplacer` existe pour que la
 * signature soit déjà la bonne le jour où le portail interne l'exigera, et parce
 * qu'elle permet dès aujourd'hui de câbler L'ALTERNATIVE CLAVIER — qui, elle,
 * n'attend pas.
 *
 * L'ALTERNATIVE CLAVIER N'EST PAS UN LOT DE RATTRAPAGE. Un tableau kanban où le
 * seul moyen de bouger une carte est de la traîner à la souris est inutilisable
 * au clavier, et le rustinage a posteriori donne toujours un second chemin
 * bancal. Ici, quand `onDeplacer` est fourni, chaque carte reçoit un menu
 * « Déplacer vers… » listant les autres colonnes : c'est un chemin complet, il
 * marche à la souris comme au clavier, et le glisser-déposer viendra plus tard
 * s'y ajouter comme un raccourci — jamais comme le seul chemin.
 *
 * CE QUI EST COMPOSÉ, NON RÉÉCRIT : `CompteurStatut` pour le décompte de
 * l'en-tête (« Candidat.e.s : 2 », relevé du Figma), `EtatVide` pour une colonne
 * sans carte, `Squelette` pour le chargement, `MenuActions` pour le déplacement.
 * Les cartes elles-mêmes sont passées en `ReactNode` : c'est l'écran qui décide
 * si une colonne porte des `CarteCandidat`, des `CarteTalent` ou autre chose. Le
 * kanban tient les colonnes, il ne dessine pas leur contenu.
 *
 * LA PASTILLE DE COULEUR EST UNE DONNÉE, PAS UN JETON. `ref.etape_process` porte
 * la couleur de chaque étape en base : la peindre depuis une table figée ici
 * ferait diverger l'écran de la référence dès le premier ajout d'étape. Elle
 * arrive donc en chaîne CSS, appliquée en style en ligne. Elle est décorative —
 * le libellé de la colonne porte le sens.
 *
 * SÉMANTIQUE : une `<ol>` de colonnes, chacune une `<section>` nommée par son
 * `<h3>`, chacune contenant une `<ul>` de cartes. Un lecteur d'écran annonce
 * alors « Interview 1, section », puis « liste, 3 éléments ». Une grille de
 * `<div>` ne donne ni le nom ni le compte.
 */

export type CarteKanban = {
  cle: string;
  contenu: React.ReactNode;
  /** Le nom de la carte, pour le menu de déplacement. « Candidature #012 ». */
  libelle?: string;
};

export type ColonneKanban = {
  cle: string;
  libelle: string;
  /**
   * Couleur de la pastille — `ref.etape_process.couleur`, une chaîne CSS.
   * Absente ⇒ pas de pastille, ce qui vaut mieux qu'un gris par défaut qui
   * ressemblerait à une étape désactivée.
   */
  couleur?: string;
  /**
   * Le décompte affiché. Absent ⇒ le nombre de cartes de la colonne. À
   * renseigner quand la colonne est paginée : « 3 cartes affichées » sur une
   * étape qui en compte 240 serait un mensonge.
   */
  nombre?: number;
  cartes: readonly CarteKanban[];
};

export function Kanban({
  colonnes,
  onDeplacer,
  chargement = false,
  titreColonneVide = 'Personne à cette étape',
  ajustement = 'cote',
  className,
}: {
  colonnes: readonly ColonneKanban[];
  /**
   * Déplacer une carte. NON BRANCHÉE AU GLISSER-DÉPOSER — voir le commentaire
   * d'en-tête. Sa présence active le menu « Déplacer vers… » de chaque carte.
   */
  onDeplacer?: (deplacement: {
    cleCarte: string;
    deColonne: string;
    versColonne: string;
  }) => void;
  chargement?: boolean;
  titreColonneVide?: string;
  /**
   * Comment les colonnes occupent la largeur.
   *
   * `cote` (défaut) — la cote du Figma, 288px par colonne, et le rail défile
   * horizontalement. C'est ce qu'il faut quand les colonnes sont peu nombreuses
   * ou qu'une carte porte beaucoup de contenu.
   *
   * `egales` — les colonnes se partagent la largeur disponible, sans
   * défilement. ⚠ POURQUOI CETTE OPTION EXISTE : à six colonnes, la cote fixe
   * demande plus de 1 780px. Sur l'écran d'un poste, où le kanban vit dans une
   * colonne d'environ 800px, on n'en voyait que deux et demie — et un kanban
   * qu'on doit faire défiler pour compter ses étapes a perdu sa raison d'être,
   * qui est de montrer une RÉPARTITION d'un coup d'œil.
   *
   * La contrepartie est assumée : les colonnes deviennent étroites, donc les
   * cartes doivent l'être aussi. Trois lignes au plus.
   */
  ajustement?: 'cote' | 'egales';
  className?: string;
}) {
  const prefixe = useId();

  return (
    <ol
      className={cn(
        'flex items-start',
        ajustement === 'egales'
          ? // Les colonnes se PARTAGENT la largeur disponible. Gouttière réduite
            // à 8px : à six colonnes, 16px de gap coûtent 80px de contenu.
            'gap-2'
          : // La barre de défilement reste VISIBLE ici, contrairement à la
            // rangée de filtres du job board : une colonne coupée net au bord
            // de l'écran ne dit pas qu'il en reste six derrière.
            'gap-4 overflow-x-auto pb-2',
        className,
      )}
    >
      {colonnes.map((colonne) => {
        const idTitre = `${prefixe}-${colonne.cle}`;
        const nombre = colonne.nombre ?? colonne.cartes.length;
        const autresColonnes = colonnes.filter((c) => c.cle !== colonne.cle);

        return (
          <li key={colonne.cle} className={ajustement === 'egales' ? 'min-w-0 flex-1' : 'shrink-0'}>
            <section
              aria-labelledby={idTitre}
              className={cn(
                'flex flex-col gap-3',
                ajustement === 'egales' ? 'w-full min-w-0' : 'w-[var(--largeur-colonne-kanban)]',
                // ⚠ LA COLONNE PERD SA BOÎTE EN MODE `egales`, ET IL LE FAUT.
                // Le cadre gris coûte 24px de rembourrage sur une colonne qui
                // en fait 125 : un cinquième de la largeur pour un contour qui
                // n'apporte rien, les cartes portant déjà le leur. Le filet
                // sous l'en-tête suffit à délimiter la colonne.
                ajustement === 'egales'
                  ? ''
                  : 'rounded-[var(--r-md)] border border-[var(--encre-100)] bg-[var(--fond-inerte)] p-3',
              )}
            >
              <header
                className={cn(
                  'flex flex-col gap-0.5',
                  ajustement === 'egales' && 'gap-1 border-b border-[var(--encre-100)] pb-2',
                )}
              >
                <div className="flex items-start gap-2">
                  {/* ⚠ PAS DE PASTILLE DE COULEUR EN COLONNES ÉGALES. Elle
                      coûte 18px sur une colonne de 125, et surtout la couleur
                      d'étape est DÉJÀ portée par la pastille de chaque
                      candidature partout ailleurs dans le portail. Six points
                      colorés alignés en tête de kanban ajoutent du bruit sans
                      rien nommer que le libellé ne dise déjà. */}
                  {ajustement !== 'egales' && colonne.couleur && (
                    <span
                      aria-hidden="true"
                      style={{ background: colonne.couleur }}
                      className="size-2.5 shrink-0 rounded-[var(--r-full)] border border-black"

                    />
                  )}
                  {/* ⚠ LE LIBELLÉ SE REPLIE AU LIEU DE SE TRONQUER, en colonnes
                      égales. « Deuxième entretien » ne tient pas sur 125px :
                      tronqué, il devenait « Deuxième ent… » et ne distinguait
                      plus la deuxième de la première. La hauteur minimale aligne
                      les en-têtes entre elles, qu'ils tiennent sur une ou deux
                      lignes. */}
                  <h3
                    id={idTitre}
                    className={cn(
                      'min-w-0 text-black',
                      ajustement === 'egales'
                        ? 't-caption-hl min-h-8'
                        : 't-body-bold truncate',
                    )}
                  >
                    {colonne.libelle}
                  </h3>
                </div>
                {ajustement === 'egales' ? (
                  // Le chiffre nu : « Candidat.e.s : 3 » répété six fois de
                  // suite fait six fois le même mot pour six nombres.
                  <p className="t-caption text-[var(--encre-600)]">{nombre}</p>
                ) : (
                  <CompteurStatut nombre={nombre} />
                )}
              </header>

              {chargement ? (
                <div className="flex flex-col gap-2">
                  <Squelette hauteur={92} className="rounded-[var(--r-md)]" />
                  <Squelette hauteur={92} className="rounded-[var(--r-md)]" />
                </div>
              ) : colonne.cartes.length === 0 ? (
                ajustement === 'egales' ? (
                  // ⚠ UNE LIGNE GRISE, PAS UN `EtatVide`.
                  // Le composant d'état vide centre son titre en gros et prend
                  // toute la hauteur de la colonne : sur un kanban à six
                  // colonnes dont quatre sont vides, « Personne à cette étape »
                  // écrivait quatre fois en grand et écrasait les candidats
                  // qu'on venait voir. Un mot en gris suffit à dire le vide.
                  <p className="t-caption px-0.5 py-2 text-[var(--encre-400)]">
                    {titreColonneVide}
                  </p>
                ) : (
                  <EtatVide titre={titreColonneVide} className="px-2 py-6" />
                )
              ) : (
                <ul className="flex flex-col gap-2">
                  {colonne.cartes.map((carte) => (
                    <li key={carte.cle} className="relative">
                      {carte.contenu}
                      {onDeplacer && autresColonnes.length > 0 && (
                        <div className="absolute right-2 top-2">
                          <MenuActions
                            libelle={
                              carte.libelle
                                ? `Déplacer ${carte.libelle}`
                                : 'Déplacer cette carte'
                            }
                            actions={autresColonnes.map((cible) => ({
                              cle: cible.cle,
                              libelle: `Déplacer vers ${cible.libelle}`,
                              onSelection: () =>
                                onDeplacer({
                                  cleCarte: carte.cle,
                                  deColonne: colonne.cle,
                                  versColonne: cible.cle,
                                }),
                            }))}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </li>
        );
      })}
    </ol>
  );
}
