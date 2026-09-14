'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { Carte } from '@/components/pacha/Carte';
import { DialogueConfirmation } from '@/components/pacha/Dialogue';
import { Selecteur } from '@/components/pacha/Selecteur';
import { useToasts } from '@/components/pacha/Toast';
import { ZoneTexte } from '@/components/pacha/ZoneTexte';
import { useNonce } from '@/components/vues/talent/nonce';
import { retirerMaCandidature } from '@/lib/talent/actions';

/**
 * ME RETIRER D'UN PROCESS.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE MOTIF EST DEMANDÉ AVANT LA CONFIRMATION, PAS DEDANS
 * ─────────────────────────────────────────────────────────────────────────
 * `api.retirer_ma_candidature` lève `23514` sans motif (« un retrait exige un
 * motif »). Deux façons de le demander : dans le dialogue de confirmation, ou
 * avant lui. On choisit avant, et c'est un vrai arbitrage :
 *
 *   · un dialogue de confirmation doit poser UNE question à laquelle on répond
 *     oui ou non. Y glisser une liste déroulante obligatoire en fait un
 *     formulaire, et un formulaire dans un `alertdialog` est un piège au
 *     clavier — `DialogueConfirmation` place d'ailleurs son focus initial sur
 *     « Annuler » quand l'action est destructive, ce qui serait absurde si le
 *     premier geste attendu était de choisir un motif ;
 *   · et choisir son motif AVANT de confirmer, c'est comprendre ce qu'on
 *     confirme.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ LE RETRAIT N'EST PAS RÉVERSIBLE DEPUIS CET ESPACE
 * ─────────────────────────────────────────────────────────────────────────
 * La fonction pose l'étape `ko_by_candidat`, écrit `retire_par_talent_le` et
 * `motif_retrait`, et rien dans l'API ne sait revenir en arrière. Le dialogue
 * est donc `destructif` — triangle d'alerte, filet rouge, focus sur
 * « Annuler » — et son libellé nomme l'acte plutôt que d'écrire « Confirmer ».
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES SEPT MOTIFS VIENNENT DE LA BASE, PAS D'ICI
 * ─────────────────────────────────────────────────────────────────────────
 * `api.mon_referentiel` publie `motif_retrait` — la catégorie `candidat` de
 * `ref.motif_ko`, 7 lignes actives, mesuré. C'est la différence avec le portail
 * entreprise, où les sept motifs de catégorie `client` avaient dû être
 * RECOPIÉS en dur faute de vue exposée. Ici il n'y a rien à recopier, et donc
 * rien qui puisse diverger.
 */
export function ActionsRetrait({
  candidatureId,
  poste,
  motifs,
}: {
  candidatureId: string;
  poste: string;
  motifs: readonly { valeur: string; libelle: string }[];
}) {
  const router = useRouter();
  const { annoncer } = useToasts();
  const [enCours, demarrer] = useTransition();
  const [nonce, renouvelerNonce] = useNonce();

  const [motif, setMotif] = useState<string>('');
  const [commentaire, setCommentaire] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function retirer() {
    demarrer(async () => {
      const r = await retirerMaCandidature({
        candidatureId,
        motifCode: motif,
        commentaire,
        nonce,
      });
      if (r.ok) {
        setOuvert(false);
        setErreur(null);
        renouvelerNonce();
        annoncer({ titre: r.message, ton: 'succes' });
        router.refresh();
      } else {
        setOuvert(false);
        setErreur(r.erreur);
        annoncer({
          titre: 'Le retrait n’a pas été enregistré',
          description: r.erreur,
          ton: 'echec',
          duree: 0,
        });
      }
    });
  }

  return (
    <Carte regime="travail" className="flex flex-col gap-3 p-4">
      <div>
        <p className="t-caption text-[var(--encre-500)]">Me retirer de ce process</p>
      </div>

      <Selecteur
        libelle="Pourquoi vous retirez-vous ?"
        options={motifs}
        valeur={motif === '' ? null : motif}
        onChangement={(v) => {
          setMotif(v ?? '');
          setErreur(null);
        }}
        substitut="Choisissez un motif"
        erreur={erreur ?? undefined}
        // ⚠ SANS MOTIF, LA BASE REFUSE. Le champ est donc marqué requis à
        // l'écran, et le bouton reste désactivé — proposer un geste dont on
        // sait qu'il sera refusé est une promesse qu'on ne tient pas.
        requis
      />

      <ZoneTexte
        libelle="Voulez-vous préciser ?"
        aide="Facultatif."
        lignes={3}
        maxLength={5000}
        value={commentaire}
        onChange={(e) => setCommentaire(e.currentTarget.value)}
        disabled={enCours}
      />

      <Bouton
        apparence="contour"
        taille="sm"
        disabled={enCours || motif === ''}
        onClick={() => setOuvert(true)}
        className="w-fit"
      >
        Me retirer
      </Bouton>

      <DialogueConfirmation
        ouvert={ouvert}
        onOuvertureChange={setOuvert}
        destructif
        enCours={enCours}
        titre="Vous retirer de ce process ?"
        message={
          <>
            Nous informons {poste === '' ? 'le client' : 'le client de ce poste'} que vous vous
            retirez, et cette candidature se ferme. <strong>Ce geste ne s’annule pas depuis
            votre espace</strong>&nbsp;: pour revenir, il faudra en parler à votre interlocuteur.
          </>
        }
        libelleConfirmation="Me retirer de ce process"
        onConfirmer={retirer}
      />
    </Carte>
  );
}
