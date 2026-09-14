'use client';

import { Icone } from './Icone';
import { cn } from '@/lib/utils';

/**
 * Etapes — le fil d'un formulaire en plusieurs temps.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * D'OÙ IL VIENT
 * ─────────────────────────────────────────────────────────────────────────
 * `components/vues/entreprise/FormulaireBrief.tsx:476` en porte un, fait main,
 * qui marche. On en reprend les quatre décisions justes, telles quelles :
 *
 * · **une `<ol>` de boutons**, pas une rangée de `<div>` : le fil ne montre pas
 *   l'avancement, il permet de REVENIR, et revenir est un acte ;
 * · **`aria-current="step"`** sur l'étape en cours — c'est l'attribut prévu
 *   pour exactement ça, et rien d'autre n'annonce « vous êtes ici » ;
 * · **un préfixe `sr-only` « Étape 2 sur 4 : »** devant le libellé, parce que
 *   la position dans le fil est une information visuelle que le chiffre seul,
 *   collé au libellé, ne rend pas (« 2 Le cadre » n'est pas une phrase) ;
 * · **l'inatteignable est un bouton `disabled`**, pas un bouton muet : on ne
 *   saute pas à l'étape 4 avant d'avoir rempli l'étape 1, et l'état doit se
 *   voir ET se sentir au clavier.
 *
 * Ce qu'on lui ajoute : l'étape franchie porte une COCHE à la place de son
 * numéro (le numéro d'une étape terminée n'apprend plus rien, la coche si),
 * l'état d'erreur, la disposition en colonne, et le sous-libellé.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TROIS ÉTATS, ET C'EST UNE HIÉRARCHIE, PAS UNE PALETTE
 * ─────────────────────────────────────────────────────────────────────────
 *   franchie  fond violet 050, coche noire      — faite, on peut y retourner
 *   en cours  fond noir, texte blanc            — ici
 *   à venir   fond inerte, texte gris           — pas encore
 *
 * L'étape en cours est la seule pleine : c'est le contraste qui la désigne, pas
 * une teinte. Le violet des étapes franchies est celui de l'interactif du
 * système — il dit « cliquable », ce qui est précisément ce qui les distingue
 * des étapes à venir.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ERREUR NE SE PEINT PAS EN ROUGE, ELLE S'ÉCRIT
 * ─────────────────────────────────────────────────────────────────────────
 * `erreur: true` sur une étape ajoute un pictogramme d'alerte ET un
 * « — à corriger » réservé au lecteur d'écran. Une bordure rouge seule répète
 * la faute du champ sans message : invisible pour un daltonien, muette pour un
 * lecteur d'écran. Le rouge reste sur le trait, jamais seul.
 *
 * ⚠ CE N'EST PAS `Onglets`. Un fil d'étapes est SÉQUENTIEL et son but est
 * d'être quitté par le bout ; des onglets sont latéraux et permanents. Les
 * confondre donnerait des flèches ← → qui feraient sauter d'étape sans valider
 * la précédente. Aucun `role="tablist"` ici, donc, et c'est délibéré : le fil
 * est une liste de liens vers des parties du même formulaire.
 *
 * ⚠ IL NE PORTE AUCUN CONTENU. `Etapes` dessine le fil ; c'est l'écran qui rend
 * le panneau de l'étape courante. Le composant ne sait pas ce qu'il y a dans
 * une étape, et n'a aucune raison de le savoir.
 */

export type EtapeFil = {
  cle: string;
  libelle: string;
  /** Une ligne sous le libellé, en disposition colonne. Ignorée en ligne. */
  detail?: string;
  /**
   * Cette étape est-elle atteignable au clic ? Par défaut, toute étape d'indice
   * inférieur ou égal à l'étape courante l'est — on revient en arrière
   * librement, on n'avance pas sans avoir rempli.
   */
  atteignable?: boolean;
  /** L'étape porte un champ à corriger. */
  erreur?: boolean;
};

export type ProprietesEtapes = {
  etapes: readonly EtapeFil[];
  /** Indice de l'étape en cours, à partir de 0. */
  courante: number;
  /**
   * Absent, le fil devient un simple indicateur : plus aucun bouton, donc plus
   * rien de focalisable. C'est le bon mode pour un récapitulatif.
   */
  onAller?: (indice: number) => void;
  /** Ce que ce fil découpe. « Ouvrir un poste ». Porté par l'`<ol>`. */
  libelle: string;
  disposition?: 'ligne' | 'colonne';
  className?: string;
};

/** L'état d'une étape, déduit une seule fois pour que rien ne diverge. */
type Etat = 'franchie' | 'courante' | 'a-venir';

export function Etapes({
  etapes,
  courante,
  onAller,
  libelle,
  disposition = 'ligne',
  className,
}: ProprietesEtapes) {
  const total = etapes.length;

  return (
    <ol
      aria-label={libelle}
      className={cn(
        disposition === 'ligne'
          ? 'flex flex-wrap items-center gap-2'
          : 'flex flex-col gap-1',
        className,
      )}
    >
      {etapes.map((etape, i) => {
        const etat: Etat = i === courante ? 'courante' : i < courante ? 'franchie' : 'a-venir';
        const atteignable = etape.atteignable ?? i <= courante;
        const cliquable = onAller !== undefined && atteignable && etat !== 'courante';
        const dernier = i === total - 1;

        const mot =
          etat === 'franchie'
            ? 'franchie'
            : etat === 'courante'
              ? 'en cours'
              : atteignable
                ? 'à venir'
                : 'à venir, pas encore accessible';

        // La phrase annoncée est écrite d'UN SEUL TENANT, et le libellé visible
        // est masqué aux lecteurs d'écran.
        //
        // ⚠ POURQUOI PAS TROIS MORCEAUX (préfixe sr-only + libellé visible +
        // suffixe sr-only), qui était la première version. Le calcul du nom
        // accessible (accname) ÉLAGUE les blancs de bord de chaque nœud avant
        // de les concaténer : un séparateur placé en fin de « Étape 1 sur 3 : »
        // disparaît, et le nom devient « Étape 1 sur 3 :Le poste— franchie ».
        // Un blanc réapparaît quand le nœud n'est pas `display: inline` — ce
        // qui est le cas de `sr-only`, positionné en absolu donc blockifié —
        // mais faire dépendre une phrase annoncée d'une règle CSS de mise en
        // page est un pari : il suffit qu'un jour `sr-only` change de recette
        // pour que tous les libellés se recollent, sans que rien ne le montre à
        // l'écran. Vérifié : la version en trois morceaux échoue dès que le CSS
        // n'est pas là. Un seul nœud de texte ne peut pas se recoller.
        //
        // Le prix est le libellé écrit deux fois dans le DOM. La commande
        // vocale continue de fonctionner : « Le poste » est contenu dans le nom.
        const contenu = (
          <>
            <Pastille indice={i} etat={etat} erreur={etape.erreur} />
            <span className={cn('flex min-w-0 flex-col', disposition === 'ligne' && 'items-start')}>
              <span className="sr-only">
                {[
                  `Étape ${i + 1} sur ${total} : ${etape.libelle}`,
                  // Le détail n'est visible qu'en colonne, mais il est ANNONCÉ
                  // dès qu'il existe : le laisser dehors ferait entendre moins
                  // que ce que l'écran montre.
                  etape.detail,
                  mot,
                  etape.erreur ? 'à corriger' : null,
                ]
                  .filter(Boolean)
                  .join(' — ')}
              </span>
              <span aria-hidden="true" className="truncate">
                {etape.libelle}
              </span>
              {disposition === 'colonne' && etape.detail && (
                <span
                  aria-hidden="true"
                  className={cn(
                    't-caption truncate',
                    // Sur le fond noir de l'étape en cours, `encre-200` mesure
                    // 9:1 — un jeton du système, pas un blanc à demi opaque.
                    etat === 'courante' ? 'text-[var(--encre-200)]' : 'text-[var(--encre-500)]',
                  )}
                >
                  {etape.detail}
                </span>
              )}
            </span>
          </>
        );

        const habit = cn(
          't-caption-hl flex items-center gap-2 rounded-[var(--r-full)] px-3 py-1.5',
          disposition === 'colonne' && 'w-full justify-start rounded-[var(--r-md)] py-2',
          etat === 'courante' && 'bg-black text-white',
          etat === 'franchie' && 'bg-[var(--violet-050)] text-black',
          etat === 'a-venir' && 'bg-[var(--fond-inerte)] text-[var(--encre-500)]',
          // Le survol n'existe que là où le clic existe.
          cliquable && 'hover:bg-[var(--violet-100)]',
          // Le gris d'inaccessibilité ne s'applique qu'aux étapes À VENIR :
          // posé sur l'étape en cours (fond noir), il donnerait du gris clair
          // sur noir, et l'appelant qui écrit `atteignable: false` sur une
          // étape franchie effacerait le texte de sa propre pastille.
          !atteignable && etat === 'a-venir' && 'text-[var(--encre-300)]',
          'transition-colors duration-150',
        );

        return (
          <li
            key={etape.cle}
            className={cn(
              'flex min-w-0 items-center gap-2',
              disposition === 'colonne' && 'w-full',
            )}
          >
            {onAller ? (
              <button
                type="button"
                onClick={() => atteignable && onAller(i)}
                disabled={!atteignable}
                aria-current={etat === 'courante' ? 'step' : undefined}
                className={cn(
                  habit,
                  'min-w-0 disabled:cursor-not-allowed',
                  'focus-visible:outline-2 focus-visible:outline-offset-2',
                  'focus-visible:outline-[var(--focus-anneau)]',
                )}
              >
                {contenu}
              </button>
            ) : (
              <span
                aria-current={etat === 'courante' ? 'step' : undefined}
                className={cn(habit, 'min-w-0')}
              >
                {contenu}
              </span>
            )}

            {/* Le chevron de liaison. Décoratif : la séquence est déjà portée
                par l'`<ol>` et par « Étape 2 sur 4 ». En colonne, la pile
                suffit — un chevron vertical n'ajouterait qu'un caractère. */}
            {disposition === 'ligne' && !dernier && (
              <span aria-hidden="true" className="t-body text-[var(--encre-300)]">
                ›
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * La pastille numérotée.
 *
 * Elle N'EST PAS le composant `PastilleNombre` réclamé par
 * `docs/ds-jetons-manquants-lot1.md` §4 : celui-là est un disque plein de 24px
 * appartenant au jeu d'icônes, employé dans le corps du texte. Celle-ci est une
 * pièce interne du fil, de 20px, dont la couleur suit l'état de son étape. Les
 * fondre reviendrait à faire dépendre une icône de marque d'un état de
 * formulaire. Signalé au rapport ; `PastilleNombre` reste à construire.
 *
 * `aria-hidden` sans réserve : le numéro est déjà dans « Étape 2 sur 4 », la
 * coche est déjà dans « — franchie », l'alerte est déjà dans « — à corriger ».
 */
function Pastille({ indice, etat, erreur }: { indice: number; etat: Etat; erreur?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-[var(--r-full)]',
        't-micro-bold',
        etat === 'courante' && 'bg-white text-black',
        etat === 'franchie' && 'bg-black text-white',
        etat === 'a-venir' && 'border border-[var(--encre-300)] text-[var(--encre-500)]',
        erreur && 'border-2 border-[#ff2626]',
      )}
    >
      {erreur ? (
        <Icone nom="icon-alert-triangle" className="size-3" />
      ) : etat === 'franchie' ? (
        <Icone nom="icon-check" className="size-3" />
      ) : (
        indice + 1
      )}
    </span>
  );
}
