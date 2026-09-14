'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { Dialogue, DialogueConfirmation } from '@/components/pacha/Dialogue';
import { Icone } from '@/components/pacha/Icone';
import { useToasts } from '@/components/pacha/Toast';
import { ZoneTexte } from '@/components/pacha/ZoneTexte';
import { useNonce } from '@/components/vues/entreprise/nonce';
import { demanderCloture, mettreEnPause } from '@/lib/entreprise/actions';

/**
 * LES DEUX GESTES DU CLIENT SUR SON PROPRE MANDAT : suspendre, et demander la
 * clôture.
 *
 * AUCUN DES DEUX N'EST IRRÉVERSIBLE, ET AUCUN DES DEUX N'EST ANODIN.
 * · La pause écrit `statut = 'en_pause'` : le sourcing s'arrête, rien n'est
 *   perdu, et le cabinet peut reprendre. Une confirmation simple suffit.
 * · La clôture n'est qu'une DEMANDE : elle pose `cloture_demandee_le` et écrit
 *   une note visible du cabinet. Elle ne ferme pas le mandat — c'est l'Account
 *   Manager qui tranche. Le libellé du bouton doit le dire, sinon le client
 *   croit avoir fermé son poste alors qu'il a envoyé un message.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * IL N'Y A PAS DE « MODIFIER LE BRIEF », ET C'EST UN RETRAIT ASSUMÉ
 * ─────────────────────────────────────────────────────────────────────────
 * `api.maj_mandat` existe et autorise le client à reprendre son brief tant que
 * le mandat est en statut « nouveau ». Le bouton était écrit, puis retiré.
 *
 * La raison est le CONTRAT de cette fonction : elle enregistre un FORMULAIRE
 * ENTIER, et un argument nul efface la valeur. Or `api.mandat_client` ne
 * projette PAS les cinq colonnes de fond du brief — `missions`,
 * `remote_infos`, `experience_min_annees`, `must_have`, `nice_to_have`. Un
 * formulaire de reprise ne pourrait donc pas les pré-remplir, et le premier
 * enregistrement les VIDERAIT toutes, sans que le client ait vu ce qu'il perd.
 *
 * Tant qu'aucune vue ne rend ces colonnes au portail, la modification passe par
 * l'Account Manager — ce que la page dit en toutes lettres sur un mandat
 * « nouveau ». C'est moins bien qu'un formulaire ; c'est très supérieur à un
 * formulaire qui détruit.
 *
 * CE QUI N'EST PAS TESTÉ ICI, ET QUI L'EST EN BASE. `api.mandat_client` ne
 * projette ni `cloture_demandee_le` ni la liste des statuts qui autorisent une
 * pause : impossible de savoir depuis l'écran qu'une clôture a DÉJÀ été
 * demandée. Plutôt que de deviner, on laisse la fonction refuser — son message
 * est écrit pour l'utilisateur (« une clôture a déjà été demandée le
 * 12/09/2026 ») et arrive en toast d'échec. Griser un bouton sur une
 * supposition serait pire : le client ne saurait pas pourquoi.
 */
export function ActionsMandat({
  mandatId,
  statut,
  estClos,
}: {
  mandatId: string;
  statut: string | null;
  estClos: boolean;
}) {
  const router = useRouter();
  const { annoncer } = useToasts();
  const [enCours, demarrer] = useTransition();

  const [pauseOuverte, setPauseOuverte] = useState(false);
  const [clotureOuverte, setClotureOuverte] = useState(false);
  const [motif, setMotif] = useState('');

  const [noncePause, renouvelerPause] = useNonce();
  const [nonceCloture, renouvelerCloture] = useNonce();

  const boutonPause = useRef<HTMLButtonElement>(null);
  const boutonCloture = useRef<HTMLButtonElement>(null);

  // Un mandat clos ne se met pas en pause et ne se clôture pas deux fois. Le
  // seul cas qu'on grise, parce qu'il est LISIBLE dans la donnée qu'on a.
  if (estClos) return null;

  const dejaEnPause = statut === 'en_pause';

  function lancerPause() {
    demarrer(async () => {
      const r = await mettreEnPause({ mandatId, nonce: noncePause });
      if (r.ok) {
        annoncer({ titre: r.message, ton: 'succes' });
        setPauseOuverte(false);
        renouvelerPause();
        router.refresh();
      } else {
        annoncer({ titre: 'La mise en pause a été refusée', description: r.erreur, ton: 'echec' });
      }
    });
  }

  function lancerCloture() {
    demarrer(async () => {
      const r = await demanderCloture({ mandatId, motif, nonce: nonceCloture });
      if (r.ok) {
        annoncer({ titre: r.message, ton: 'succes' });
        setClotureOuverte(false);
        setMotif('');
        renouvelerCloture();
        router.refresh();
      } else {
        annoncer({ titre: 'La demande n’a pas abouti', description: r.erreur, ton: 'echec' });
      }
    });
  }

  return (
    <>
      {!dejaEnPause && (
        <Bouton
          ref={boutonPause}
          apparence="contour"
          onClick={() => setPauseOuverte(true)}
          disabled={enCours}
          iconeAvant={<Icone nom="icon-pause" />}
        >
          Mettre en pause
        </Bouton>
      )}

      <Bouton
        ref={boutonCloture}
        apparence="contour"
        onClick={() => setClotureOuverte(true)}
        disabled={enCours}
        iconeAvant={<Icone nom="icon-archive" />}
      >
        Demander la clôture
      </Bouton>

      <DialogueConfirmation
        titre="Mettre ce poste en pause ?"
        message="Nous arrêtons le sourcing et nous ne vous présenterons plus de profil tant que vous ne nous aurez pas dit de reprendre. Les candidats déjà en process restent en process, et rien n’est supprimé."
        libelleConfirmation="Mettre en pause"
        ouvert={pauseOuverte}
        onOuvertureChange={setPauseOuverte}
        onConfirmer={lancerPause}
        enCours={enCours}
        focusFinal={boutonPause}
      />

      <Dialogue
        titre="Demander la clôture de ce poste"
        description="Votre Account Manager traite la demande avant toute fermeture."
        ouvert={clotureOuverte}
        onOuvertureChange={setClotureOuverte}
        focusFinal={boutonCloture}
        actions={
          <>
            <Bouton
              apparence="contour"
              onClick={() => setClotureOuverte(false)}
              disabled={enCours}
            >
              Annuler
            </Bouton>
            <Bouton apparence="plein" onClick={lancerCloture} disabled={enCours}>
              {enCours ? 'Envoi…' : 'Envoyer la demande'}
            </Bouton>
          </>
        }
      >
        <ZoneTexte
          libelle="Pourquoi souhaitez-vous clôturer ?"
          aide="Facultatif."
          value={motif}
          onChange={(e) => setMotif(e.currentTarget.value)}
          maxLength={2000}
          compteur
          lignes={4}
        />
      </Dialogue>
    </>
  );
}
