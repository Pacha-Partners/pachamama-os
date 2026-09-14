'use client';

import { useState } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { Carte } from '@/components/pacha/Carte';
import { EtatVide } from '@/components/pacha/EtatVide';
import { FormeEtoiles } from '@/components/pacha/Illustration';
import { TagAction } from '@/components/pacha/Tag';
import { CandidatureSpontanee } from '@/components/vues/talent/CandidatureSpontanee';
import { ListeCandidatures } from '@/components/vues/talent/ListeCandidatures';
import { repartirCandidatures, type CandidatureTalent } from '@/lib/domaine/talent';

type Volet = 'cours' | 'closes';

/**
 * MES PROCESS — la totalité des candidatures, et de quoi s'y retrouver.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI UN ÉCRAN À PART, ALORS QUE LE TABLEAU DE BORD LES LISTAIT DÉJÀ
 * ─────────────────────────────────────────────────────────────────────────
 * Il les listait TOUTES, en cours et closes, à la suite. Sur un compte qui
 * cumule six process, la page d'accueil devenait un listing, et l'aperçu — la
 * complétude, l'accord, l'interlocuteur — passait au-dessus de la ligne de
 * flottaison. « Mon espace » garde un aperçu ; le suivi vit ici.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ DES PASTILLES `TagAction`, ET NON LE COMPOSANT `Onglets`
 * ─────────────────────────────────────────────────────────────────────────
 * C'est le choix du wireframe, et il est juste pour une raison de fond : il n'y
 * a QU'UNE liste ici, et deux façons de la filtrer. `Onglets` sert des panneaux
 * de contenus DIFFÉRENTS — une fiche d'un côté, un historique de l'autre — et
 * apporte alors ce qu'il faut : `aria-controls`, navigation aux flèches, un
 * panneau maintenu monté. Deux filtres exclusifs sur un même ensemble sont un
 * sélecteur segmenté, et le système en a l'atome.
 *
 * Le compte va DANS le libellé — « En cours · 2 » — au lieu d'une pastille de
 * comptage accolée : sur deux entrées seulement, la pastille ajoutait une
 * troisième forme à lire par onglet.
 *
 * `role="group"` et non `role="tablist"` : un `tablist` exige des enfants
 * `role="tab"` liés à des panneaux, et `TagAction` rend un `<button
 * aria-pressed>`. Le déclarer tablist produirait une structure invalide que les
 * lecteurs d'écran annonceraient de travers.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ AUCUNE PRÉCISION SUR LES CLOSES (D-02)
 * ─────────────────────────────────────────────────────────────────────────
 * Le registre talent replie les trois issues KO sur « Candidature close ». Dire
 * ici « écarté par le client » plutôt que « écarté par Pachamama » exposerait
 * sans aider. L'écran n'ajoute donc rien de sa part.
 */
export function MesProcess({ candidatures }: { candidatures: CandidatureTalent[] }) {
  const { enCours, closes } = repartirCandidatures(candidatures);

  // Le volet d'ouverture suit ce que la personne a : ouvrir sur « en cours »
  // quand il n'y en a aucun montrerait un panneau vide alors que des process
  // existent.
  const [volet, setVolet] = useState<Volet>(
    enCours.length > 0 || closes.length === 0 ? 'cours' : 'closes',
  );

  /* ─────────────────────────────────────── aucun process : l'écran entier */
  if (candidatures.length === 0) {
    return (
      // ⚠ NI PASTILLES NI RANGÉE D'ACTIONS. Les deux issues sont DANS l'état
      // vide ; les proposer aussi en haut d'écran les offrirait deux fois à
      // deux endroits, pour une page qui n'a rien d'autre à montrer.
      <Carte regime="travail" className="p-2">
        <EtatVide
          titre="Aucun process pour l’instant"
          description="Dès que vous postulez, le suivi s’affiche ici."
          illustration={<FormeEtoiles />}
          action={
            // DEUX ISSUES, PARCE QU'IL Y A DEUX SITUATIONS : soit une des offres
            // publiées convient, soit aucune — et dans le second cas, la seule
            // façon d'entrer dans le pipeline depuis cet espace est la
            // candidature spontanée. Ici c'est « voir les offres » qui prime :
            // il y en a douze de publiées, et se manifester sans offre n'a de
            // sens qu'une fois qu'on a constaté qu'aucune ne convient.
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Bouton href="/talent/offres" apparence="plein">
                Voir les offres ouvertes
              </Bouton>
              <CandidatureSpontanee apparence="contour" />
            </div>
          }
        />
      </Carte>
    );
  }

  const surCours = volet === 'cours';
  const liste = surCours ? enCours : closes;

  return (
    <div className="flex flex-col gap-5">
      {/* Les deux façons d'entrer dans le pipeline valent pour les DEUX volets :
          elles sont posées au niveau de l'écran, et non dans un panneau, pour ne
          pas être répétées. Ici, se manifester sans offre est la voie
          principale — on arrive sur un suivi qu'on trouve trop court. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Bouton href="/talent/offres" apparence="contour">
          Voir les offres ouvertes
        </Bouton>
        <CandidatureSpontanee apparence="plein" />
      </div>

      <div role="group" aria-label="Filtrer vos process" className="flex flex-wrap gap-2">
        <TagAction actif={surCours} onClick={() => setVolet('cours')}>
          En cours · {enCours.length}
        </TagAction>
        <TagAction actif={!surCours} onClick={() => setVolet('closes')}>
          Closes · {closes.length}
        </TagAction>
      </div>

      {liste.length > 0 ? (
        <ListeCandidatures candidatures={liste} />
      ) : (
        /* ⚠ UN PANNEAU VIDE N'EST PAS UN ÉCRAN VIDE. Il y a des process, ils
           sont simplement dans l'autre volet : la carte y renvoie au lieu de
           laisser un blanc, et ne repropose pas les deux issues. */
        <Carte regime="travail" className="flex min-h-[120px] items-center p-5">
          <p className="t-body text-[var(--encre-600)]">
            {surCours
              ? 'Aucun process en cours. Vos process clos sont dans l’autre volet.'
              : 'Aucun process clos.'}
          </p>
        </Carte>
      )}
    </div>
  );
}
