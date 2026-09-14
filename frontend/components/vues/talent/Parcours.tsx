'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Carte } from '@/components/pacha/Carte';
import { FriseParcours, type EntreeParcours } from '@/components/pacha/FriseParcours';
import { useToasts } from '@/components/pacha/Toast';
import { Precision } from '@/components/vues/talent/atomes';
import { useNonce } from '@/components/vues/talent/nonce';
import { planDeSynchronisation, versEntreeFrise, type PosteTalent } from '@/lib/domaine/talent';
import { ajouterMonPoste, majMonPoste, supprimerMonPoste } from '@/lib/talent/actions';

/**
 * MON PARCOURS — la frise d'expériences.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ `core.fiche_talent_poste` EST VIDE : 0 LIGNE, AUCUNE SOURCE
 * ─────────────────────────────────────────────────────────────────────────
 * Ce n'est pas une reprise dont l'import aurait échoué, c'est une saisie
 * NEUVE : la table n'a jamais reçu de données et rien dans le miroir Bubble ne
 * lui correspond. L'écran vide doit donc INVITER, pas s'excuser —
 * `FriseParcours` porte déjà cet état vide, et la page ajoute la phrase qui
 * dit pourquoi il n'y a rien.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TROIS FONCTIONS DERRIÈRE UN SEUL `onChangement`
 * ─────────────────────────────────────────────────────────────────────────
 * `FriseParcours` rend le TABLEAU COMPLET à chaque geste ; la base offre trois
 * fonctions distinctes. Le calcul « quel verbe pour quelle ligne » ne vit PAS
 * ici : il est dans `planDeSynchronisation`, côté domaine, en pur, et il est
 * testé (`lib/domaine/talent.test.ts`). C'est la pièce la plus risquée de
 * l'écran — s'y tromper crée un doublon silencieux — et une pièce risquée n'a
 * rien à faire dans le corps d'un composant, où personne ne la relit.
 *
 * Ce fichier ne fait donc plus qu'EXÉCUTER le plan, dans l'ordre : les retraits
 * d'abord, pour qu'un remplacement ne cohabite pas avec la ligne qu'il
 * remplace.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ LE PIÈGE QUE CETTE RESYNCHRONISATION ÉVITE
 * ─────────────────────────────────────────────────────────────────────────
 * L'état local est optimiste : la frise montre le changement avant que le
 * serveur ne réponde. Après un ajout réussi, la ligne existe en base avec un
 * VRAI uuid, alors que l'état local porte encore la clé temporaire. Garder cet
 * état local ferait traiter la première modification de cette ligne comme un
 * nouvel ajout — donc **un doublon silencieux**.
 *
 * On resynchronise donc sur la donnée du serveur dès qu'elle change, par la
 * comparaison d'une signature (le patron « ajuster l'état quand les props
 * changent » de React, qui converge parce que la signature est une chaîne).
 * `router.refresh()` après chaque écriture fournit cette donnée.
 */
export function Parcours({ postes }: { postes: PosteTalent[] }) {
  const router = useRouter();
  const { annoncer } = useToasts();
  /*
   * ⚠ ON N'EXPLOITE PAS `enCours`, ET C'EST UN CHOIX EXPLIQUÉ PLUS BAS :
   * passer la frise en lecture le temps d'un aller-retour démonterait le
   * formulaire d'édition, donc la saisie en cours. L'état optimiste montre
   * déjà le résultat, et un échec le reprend. On ne nomme donc pas la valeur.
   */
  const [, demarrer] = useTransition();
  const [nonce, renouvelerNonce] = useNonce();

  /**
   * ⚠ UNE LIGNE SANS DATE DE DÉBUT EST ÉCARTÉE, ET LE DIRE VAUT MIEUX QUE LA
   * MASQUER. `core.fiche_talent_poste.debut_le` est nullable, alors que
   * `FriseParcours` exige une année de début — une période sans début n'est pas
   * une période. `versEntreeFrise` rend `null` dans ce cas plutôt que de
   * replier sur l'année courante, ce qui inventerait une date. La table étant
   * vide aujourd'hui, ce cas ne peut venir que d'une écriture future.
   */
  const depart = useMemo(
    () => postes.map(versEntreeFrise).filter((e): e is EntreeParcours => e !== null),
    [postes],
  );
  const ecartes = postes.length - depart.length;

  const signature = useMemo(() => JSON.stringify(postes), [postes]);
  const [connue, setConnue] = useState(signature);
  const [entrees, setEntrees] = useState<EntreeParcours[]>(depart);

  if (signature !== connue) {
    setConnue(signature);
    setEntrees(depart);
  }

  function appliquer(nouvelles: EntreeParcours[]) {
    const avant = entrees;
    setEntrees(nouvelles);

    const plan = planDeSynchronisation(avant, nouvelles);
    if (plan.retraits.length + plan.ajouts.length + plan.majs.length === 0) return;

    demarrer(async () => {
      for (const posteId of plan.retraits) {
        const r = await supprimerMonPoste({ posteId, nonce });
        if (!r.ok) return echouer(r.erreur, avant);
      }
      for (const { entree, rang } of plan.ajouts) {
        const r = await ajouterMonPoste(chargeDe(entree, rang, nonce));
        if (!r.ok) return echouer(r.erreur, avant);
      }
      for (const { entree, posteId, rang } of plan.majs) {
        const r = await majMonPoste({ ...chargeDe(entree, rang, nonce), posteId });
        if (!r.ok) return echouer(r.erreur, avant);
      }

      renouvelerNonce();
      annoncer({ titre: 'Votre parcours est enregistré.', ton: 'succes' });
      // La resynchronisation passe par ici : le serveur rend les VRAIS uuid.
      router.refresh();
    });
  }

  /** On remet l'écran dans l'état d'avant : le serveur, lui, n'a pas bougé. */
  function echouer(message: string, avant: EntreeParcours[]) {
    setEntrees(avant);
    annoncer({
      titre: 'Votre parcours n’a pas été enregistré',
      description: message,
      ton: 'echec',
      duree: 0,
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Carte regime="travail" className="flex flex-col gap-5 p-5">
        {/* La note part sur la MÊME ligne que le titre, poussée à droite : elle
            énonce une règle de saisie, pas un sous-titre de section. Posée
            dessous, elle se lisait comme la description du bloc et repoussait la
            frise d'une ligne. Elle repasse dessous quand la largeur manque. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="t-h3">Vos expériences</h3>
          <Precision>
            {entrees.length === 0
              ? // ⚠ ON DIT POURQUOI C'EST VIDE. Un écran vide sans explication
                // laisse croire à un import raté ; ici, il n'y a jamais rien eu
                // à importer.
                'Ajoutez vos postes, du plus récent au plus ancien.'
              : 'Le plus récent en tête. Le mois est facultatif.'}
          </Precision>
        </div>

        <FriseParcours
          entrees={entrees}
          onChangement={appliquer}
          // ⚠ PAS DE `lectureSeule={enCours}` : passer la frise en lecture le
          // temps d'un aller-retour démonterait le formulaire d'édition, donc
          // la saisie en cours. L'état optimiste montre déjà le résultat, et
          // un échec le reprend.
          anneeMin={1970}
        />
      </Carte>

      {/* ⚠ UN BLOC, PAS UNE NOTE EN PIED DE CARTE. Ces expériences existent en
          base et n'apparaissent nulle part : c'est un écart entre ce que la
          personne voit et ce que le cabinet détient, et il appelle un geste —
          en parler à son interlocuteur. Posé en gris sous la carte, il se
          lisait comme une mention légale. */}
      {ecartes > 0 && (
        <Carte regime="travail" className="bg-[var(--fond-page)] p-4">
          <p className="t-body text-black">
            {ecartes} expérience{ecartes > 1 ? 's ne sont' : ' n’est'} pas affichée
            {ecartes > 1 ? 's' : ''} : {ecartes > 1 ? 'elles n’ont' : 'elle n’a'} pas de date de
            début. Dites-le à votre interlocuteur Pachamama, il peut corriger.
          </p>
        </Carte>
      )}

    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   La charge d'une écriture
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ `ordre` SUIT L'ORDRE DE SAISIE, PAS L'ORDRE AFFICHÉ.
 *
 * `FriseParcours` est explicite : « `onChangement` garde l'ordre de saisie, et
 * c'est à l'écran de décider ce qu'il en fait » — c'est elle qui TRIE pour
 * l'affichage, le plus récent d'abord. On enregistre donc le rang tel qu'elle
 * nous le rend, ce qui garde la base et le composant d'accord même après un
 * retrait au milieu.
 */
function chargeDe(e: EntreeParcours, rang: number, nonce: string) {
  return {
    intitule: e.intitule,
    employeur: e.employeur,
    anneeDebut: e.anneeDebut,
    moisDebut: e.moisDebut ?? null,
    anneeFin: e.anneeFin ?? null,
    moisFin: e.moisFin ?? null,
    enCours: Boolean(e.enPoste),
    description: e.description ?? '',
    ordre: rang,
    nonce,
  };
}
