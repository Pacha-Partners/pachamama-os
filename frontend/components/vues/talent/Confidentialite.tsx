'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { Carte } from '@/components/pacha/Carte';
import { Interrupteur } from '@/components/pacha/Cases';
import { Dialogue, DialogueConfirmation } from '@/components/pacha/Dialogue';
import { Icone } from '@/components/pacha/Icone';
import { useToasts } from '@/components/pacha/Toast';
import { ZoneTexte } from '@/components/pacha/ZoneTexte';
import { Precision } from '@/components/vues/talent/atomes';
import { useNonce } from '@/components/vues/talent/nonce';
import {
  dateLongue,
  DONNEES_DETENUES,
  USAGES_EXCLUS,
  type FicheTalent,
} from '@/lib/domaine/talent';
import { demanderMaSuppression, enregistrerMonConsentement } from '@/lib/talent/actions';

/**
 * MES DONNÉES — consentement, export, suppression, visibilité.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * QUATRE GESTES, ET LEURS PORTÉES SONT TRÈS DIFFÉRENTES
 * ─────────────────────────────────────────────────────────────────────────
 *   1. **le consentement** — `consentement_donne_le`. Écrite ou remise à NULL.
 *      Réversible, immédiat, sans conséquence sur les données.
 *   2. **l'export** — un GET vers `/talent/donnees`. Aucune écriture de fond,
 *      mais une trace : `api.exporter_mes_donnees` journalise, parce qu'un
 *      export est la preuve d'avoir honoré une demande d'accès.
 *   3. **la demande de suppression** — une DEMANDE. Elle écrit une ligne dans
 *      `app.demande_suppression` et bascule `actif = false`. **Elle n'efface
 *      rien** : vérifié par le harnais de base, la fiche et ses candidatures
 *      sont intactes après l'appel.
 *   4. **la visibilité au marché** — c'est `actif`, et le seul chemin qui
 *      l'écrit est la demande de suppression. Il n'existe **aucune fonction
 *      `api.*` pour se remettre sur le marché** : l'écran le dit au lieu de
 *      proposer un interrupteur qui ne reviendrait pas.
 *
 * ⚠ LA TROISIÈME NE PROMET PAS CE QU'ELLE NE FAIT PAS. Écrire « supprimer mon
 * compte » sur un bouton qui ouvre un ticket serait le mensonge le plus grave
 * de cet écran. Le libellé est donc « Demander la suppression », le dialogue
 * décrit exactement ce qui se passe, et le message de retour le redit.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ CE N'EST PAS UNE MENTION LÉGALE, ET L'ÉCRAN LE DIT
 * ─────────────────────────────────────────────────────────────────────────
 * D-07 déclare le cadrage RGPD **bloquant avant toute mise en production** et
 * non instruit : base légale des profils issus du seul ATS, statut du
 * fournisseur, politique de rétention, registre des traitements. Ce que
 * `USAGES_DONNEES` décrit, c'est ce que l'application FAIT, tel que mesuré
 * dans le modèle — pas ce que le cabinet s'engage à faire. La distinction est
 * écrite à l'écran, en bas, sans être noyée.
 */
export function Confidentialite({ fiche }: { fiche: FicheTalent }) {
  const router = useRouter();
  const { annoncer } = useToasts();
  const [enCours, demarrer] = useTransition();
  const [nonce, renouvelerNonce] = useNonce();

  const [motif, setMotif] = useState('');
  const [ouvertConsentement, setOuvertConsentement] = useState(false);
  const [ouvertSuppression, setOuvertSuppression] = useState(false);

  const aConsenti = Boolean(fiche.consentementDonneLe);
  const retire = fiche.actif === false;

  function basculerConsentement(donne: boolean) {
    demarrer(async () => {
      const r = await enregistrerMonConsentement({ donne, nonce });
      setOuvertConsentement(false);
      if (r.ok) {
        renouvelerNonce();
        annoncer({ titre: r.message, ton: 'succes' });
        router.refresh();
      } else {
        annoncer({
          titre: 'Votre choix n’a pas été enregistré',
          description: r.erreur,
          ton: 'echec',
          duree: 0,
        });
      }
    });
  }

  function demanderSuppression() {
    demarrer(async () => {
      const r = await demanderMaSuppression({ motif, confirme: true, nonce });
      setOuvertSuppression(false);
      if (r.ok) {
        setMotif('');
        renouvelerNonce();
        annoncer({ titre: r.message, ton: 'succes', duree: 0 });
        router.refresh();
      } else {
        annoncer({
          titre: 'Votre demande n’a pas été transmise',
          description: r.erreur,
          ton: 'echec',
          duree: 0,
        });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-start gap-5">
      {/* ═══════════════════════ les réglages et l'inventaire ═══════════ */}
      <div className="flex min-w-0 flex-[5_1_560px] flex-col gap-5">
        {retire && (
          <Carte regime="travail" className="flex flex-col gap-1.5 bg-[var(--fond-inerte)] p-5">
            <h2 className="t-h3">Votre dossier est retiré du marché</h2>
            <p className="t-body max-w-[64ch] text-[var(--encre-700)]">
              Nous ne vous présentons plus à nos clients. Vos process en cours continuent,
              puisque le dossier est déjà parti, et rien n’a été effacé.
            </p>
          </Carte>
        )}

        {/* ⚠ UN SEUL RÉGLAGE, PAS TROIS. Le wireframe en proposait trois :
            l'envoi aux clients, les propositions de postes, les offres par
            courriel. Mesuré sur `api.ma_fiche` — 40 colonnes — il n'en existe
            qu'UNE, `consentement_donne_le`. Les deux autres interrupteurs
            n'auraient rien commandé : ils auraient basculé, affiché un état, et
            n'auraient été lus par personne. La section garde son titre au
            pluriel de nature, prête pour le jour où le modèle en portera
            d'autres. */}
        <Carte regime="travail" className="flex flex-col gap-4 p-5">
          <h2 className="t-h3">Ce que vous autorisez</h2>
          <div className="flex items-start justify-between gap-5 border-t border-[var(--encre-050)] pt-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span id="reglage-presentation" className="t-body-hl text-black">
                Ma fiche peut être envoyée à des clients
              </span>
              {/* La légende dit la CONSÉQUENCE, pas une reformulation du
                  libellé. « Rendre ma fiche visible » n'aurait rien appris. */}
              <span className="t-caption max-w-[62ch] text-[var(--encre-600)]">
                Sans cela, nous ne pouvons vous présenter sur aucune offre.
                {aConsenti && fiche.consentementDonneLe
                  ? ` Autorisé depuis le ${dateLongue(fiche.consentementDonneLe)}.`
                  : ''}
              </span>
            </div>
            {/* ⚠ LA BASCULE EST DISSYMÉTRIQUE, ET C'EST VOULU. Donner son
                accord ne coûte rien et s'applique tout de suite ; le retirer
                arrête toute présentation, et cette conséquence mérite d'être
                lue avant d'être subie. On ne confirme donc que dans un sens. */}
            <Interrupteur
              aria-labelledby="reglage-presentation"
              checked={aConsenti}
              disabled={enCours}
              onCheckedChange={(v) => (v ? basculerConsentement(true) : setOuvertConsentement(true))}
              className="mt-1"
            />
          </div>
        </Carte>

        <Carte regime="travail" className="flex flex-col gap-4 p-5">
          <h2 className="t-h3">Ce que Pachamama détient</h2>
          <dl className="m-0 flex flex-col">
            {DONNEES_DETENUES.map((d) => (
              <div
                key={d.quoi}
                className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-[var(--encre-050)] py-3"
              >
                <dt className="t-body-hl min-w-0 flex-[1_1_220px] text-black">{d.quoi}</dt>
                <dd className="t-caption m-0 flex-[1_1_280px] text-[var(--encre-600)]">
                  {d.portee}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-2 border-t border-[var(--encre-100)] pt-4">
            <Precision>{USAGES_EXCLUS}</Precision>
            {/* ⚠ CETTE PAGE N'EST PAS UNE MENTION LÉGALE, ET ELLE LE DIT.
                Elle décrit un fonctionnement mesuré dans le modèle, pas un
                engagement du cabinet. Le wireframe donnait des durées de
                conservation — « deux ans », « trois ans, obligation légale » —
                qui n'existent nulle part : les écrire aurait transformé cette
                page en politique de confidentialité inventée. */}
            <Precision>
              Cette page décrit le fonctionnement de l’application, pas une politique de
              confidentialité&nbsp;: celle-ci est en cours de rédaction, et portera les durées de
              conservation.
            </Precision>
          </div>
        </Carte>
      </div>

      {/* ══════════════════════════ les deux actes ══════════════════════ */}
      <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
        <Carte regime="travail" className="flex flex-col gap-3 p-5">
          <h2 className="t-h3">Emporter vos données</h2>
          <p className="t-body text-[var(--encre-600)]">
            Votre fiche, vos attentes, votre parcours et vos candidatures avec leur étape. Ni nos
            notes internes, ni notre appréciation.
          </p>
          {/* ⚠ UN VRAI LIEN, ET NON UN BOUTON QUI APPELLE UNE ACTION.
              Un téléchargement lancé par un script est bloqué dans plusieurs
              contextes, et une Server Action ne peut pas poser d'en-tête
              `Content-Disposition`. Un GET vers un Route Handler fonctionne
              partout — y compris sans JavaScript.

              Le fichier part TOUT DE SUITE. Le wireframe décrivait une demande
              différée : « prêt sous 24 heures », « vous recevrez le lien par
              courriel, valable sept jours ». Rien de tout cela n'existe, et
              l'annoncer ferait attendre un courriel qui ne viendrait jamais. */}
          <Bouton
            href="/talent/donnees"
            apparence="contour"
            taille="sm"
            iconeAvant={<Icone nom="icon-download" />}
            className="w-fit"
          >
            Télécharger mes données (JSON)
          </Bouton>
          <Precision>Format JSON, téléchargé immédiatement. Chaque export laisse une trace datée.</Precision>
        </Carte>

        {/* Le filet noir marque la seule action irréversible du portail. */}
        <Carte regime="contour" className="flex flex-col gap-3 bg-[var(--fond-page)] p-5">
          <h2 className="t-h3">Demander la suppression</h2>
          {retire ? (
            <>
              <p className="t-body text-[var(--encre-700)]">
                Votre demande est enregistrée et notre équipe la traite.
              </p>
              {/* On dit le vrai chemin plutôt que de proposer un geste que rien
                  n'exécute : aucune fonction `api.*` ne remet une fiche sur le
                  marché. */}
              <Precision>
                La remise en ligne se fait de notre côté&nbsp;: écrivez-le à votre interlocuteur.
              </Precision>
            </>
          ) : (
            <>
              {/* ⚠ « DEMANDER », JAMAIS « SUPPRIMER MON COMPTE ».
                  La fonction de base porte ce commentaire : « Enregistre une
                  demande de suppression et bascule actif = false. N'EFFACE
                  RIEN : la cascade héritée de Bubble détruirait candidatures,
                  notes et contacts. » Le wireframe écrivait « Votre fiche, vos
                  process et vos échanges sont effacés. Cette action ne se
                  défait pas. » — le mensonge le plus grave que cet écran
                  pouvait porter. */}
              <p className="t-body text-[var(--encre-700)]">
                Votre dossier est retiré du marché <strong>tout de suite</strong>, et votre demande
                part à notre équipe, qui la traite et vous répond. Vos données ne sont pas effacées
                à cet instant.
              </p>
              <Bouton
                apparence="contour"
                taille="sm"
                disabled={enCours}
                onClick={() => setOuvertSuppression(true)}
                iconeAvant={<Icone nom="icon-trash" />}
                className="w-fit"
              >
                Demander la suppression
              </Bouton>
              <Precision>
                Une seule demande à la fois. Vos candidatures en cours ne sont pas annulées.
              </Precision>
            </>
          )}
        </Carte>
      </aside>

      <DialogueConfirmation
        ouvert={ouvertConsentement}
        onOuvertureChange={setOuvertConsentement}
        enCours={enCours}
        titre="Retirer votre accord ?"
        message="Nous arrêterons de vous présenter. Vos candidatures en cours ne sont pas annulées."
        libelleConfirmation="Retirer mon accord"
        onConfirmer={() => basculerConsentement(false)}
      />

      {/* ⚠ LE MOTIF EST DEMANDÉ DANS LE DIALOGUE, PAS DANS LA CARTE.
          Il y vivait, et une zone de texte de trois lignes dans une colonne de
          320px tenait mal. Surtout, on demande « pourquoi ? » au moment où la
          personne confirme — pas avant qu'elle ait décidé. */}
      <Dialogue
        ouvert={ouvertSuppression}
        onOuvertureChange={setOuvertSuppression}
        titre="Demander la suppression de votre dossier ?"
        description="Deux choses vont se passer, et une seule est immédiate."
        actions={
          <>
            <Bouton
              apparence="contour"
              taille="sm"
              onClick={() => setOuvertSuppression(false)}
              disabled={enCours}
            >
              Annuler
            </Bouton>
            <Bouton apparence="plein" taille="sm" onClick={demanderSuppression} disabled={enCours}>
              {enCours ? 'Envoi…' : 'Transmettre ma demande'}
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="t-body text-black">
            <strong>Votre dossier est retiré du marché tout de suite</strong>, et votre demande de
            suppression est transmise à notre équipe, qui la traite et vous répond. Vos données ne
            sont pas effacées à cet instant.
          </p>
          <ZoneTexte
            libelle="Voulez-vous nous dire pourquoi ?"
            aide="Facultatif."
            lignes={3}
            maxLength={5000}
            value={motif}
            onChange={(e) => setMotif(e.currentTarget.value)}
            disabled={enCours}
          />
        </div>
      </Dialogue>
    </div>
  );
}
