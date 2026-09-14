'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { Carte } from '@/components/pacha/Carte';
import { Dialogue, DialogueConfirmation } from '@/components/pacha/Dialogue';
import { Icone } from '@/components/pacha/Icone';
import { Selecteur } from '@/components/pacha/Selecteur';
import { useToasts } from '@/components/pacha/Toast';
import { ZoneTexte } from '@/components/pacha/ZoneTexte';
import { useNonce } from '@/components/vues/entreprise/nonce';
import { MOTIFS_REFUS_CLIENT } from '@/lib/domaine/entreprise';
import { deciderCandidature } from '@/lib/entreprise/actions';
import { cn } from '@/lib/utils';

/**
 * LA DÉCISION DU CLIENT SUR UN PROFIL PRÉSENTÉ.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TROIS SENS, ET ILS NE FONT PAS LA MÊME CHOSE
 * ─────────────────────────────────────────────────────────────────────────
 * `api.decider_candidature` applique la règle du ticket, et l'écran doit la
 * DIRE plutôt que la laisser deviner :
 *
 *   valide            → n'avance RIEN. C'est un signal, pas une transition :
 *                       après un send-out validé, c'est le client qui décide
 *                       de la suite et il le dira par « entretien demandé ».
 *   entretien_demande → passe à « Premier entretien », mais UNIQUEMENT depuis
 *                       le send-out. Ailleurs, la décision est enregistrée et
 *                       l'étape ne bouge pas.
 *   refuse            → passe à « Écarté·e par vos soins », avec un motif
 *                       obligatoire pris dans le registre `client`.
 *
 * Les trois écrivent, dans une seule transaction : une ligne dans
 * `app.decision_client`, une note visible des deux côtés, et — quand il y a
 * transition — une ligne dans `app.transition_etape`. Rien de tout cela n'est
 * fait ici : la fonction s'en charge, sous la RLS de l'appelant.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE REFUS EST LE SEUL GESTE QUI PERD QUELQUE CHOSE
 * ─────────────────────────────────────────────────────────────────────────
 * Il sort le candidat du process et l'étape est terminale : plus aucune
 * décision n'est possible ensuite, la base le refuse. Il est donc traité comme
 * destructif — filet `--marker-red`, triangle d'alerte, libellé qui nomme la
 * perte —, et JAMAIS par un bouton rouge : la couleur d'action du système est
 * le noir, et un daltonien ne verrait rien du tout.
 */
export function ActionsDecision({
  candidatureId,
  reference,
  etapeCode,
  estTerminale,
  estKo,
}: {
  candidatureId: string;
  reference: string;
  etapeCode: string | null;
  estTerminale: boolean;
  estKo: boolean;
}) {
  const router = useRouter();
  const { annoncer } = useToasts();
  const [enCours, demarrer] = useTransition();

  const [valideOuvert, setValideOuvert] = useState(false);
  const [entretienOuvert, setEntretienOuvert] = useState(false);
  const [refusOuvert, setRefusOuvert] = useState(false);

  const [motif, setMotif] = useState<string | null>(null);
  const [erreurMotif, setErreurMotif] = useState<string | undefined>();
  const [commentaire, setCommentaire] = useState('');

  const [nonce, renouvelerNonce] = useNonce();

  const boutonValider = useRef<HTMLButtonElement>(null);
  const boutonEntretien = useRef<HTMLButtonElement>(null);
  const boutonRefuser = useRef<HTMLButtonElement>(null);

  if (estTerminale) return <ProcessClos estKo={estKo} />;

  function decider(
    sens: 'valide' | 'entretien_demande' | 'refuse',
    fermer: () => void,
    extra?: { motif?: string | null; commentaire?: string },
  ) {
    demarrer(async () => {
      const r = await deciderCandidature({
        candidatureId,
        sens,
        motif: extra?.motif ?? null,
        commentaire: extra?.commentaire ?? null,
        nonce,
      });
      if (r.ok) {
        annoncer({ titre: r.message, ton: 'succes' });
        fermer();
        setMotif(null);
        setCommentaire('');
        setErreurMotif(undefined);
        renouvelerNonce();
        router.refresh();
      } else {
        annoncer({
          titre: 'La décision n’a pas été enregistrée',
          description: r.erreur,
          ton: 'echec',
          // Un échec ne s'efface pas tout seul : l'utilisateur doit pouvoir
          // relire ce que la base lui reproche avant de recommencer.
          duree: 0,
        });
      }
    });
  }

  function lancerRefus() {
    if (!motif) {
      setErreurMotif('Choisissez un motif : c’est ce que nous transmettons au candidat.');
      return;
    }
    decider('refuse', () => setRefusOuvert(false), { motif, commentaire });
  }

  const auSendOut = etapeCode === 'send_out';

  return (
    <Carte regime="accroche" className="flex flex-col gap-3 p-4">
      <p className="t-titre-hl text-black">Votre décision</p>
      <div className="flex flex-col gap-2 pt-1">
        <Bouton
          ref={boutonValider}
          apparence="plein"
          onClick={() => setValideOuvert(true)}
          disabled={enCours}
          iconeAvant={<Icone nom="icon-thumbs-up" />}
          className="w-full"
        >
          Ce profil m’intéresse
        </Bouton>
        <Bouton
          ref={boutonEntretien}
          apparence="contour-ombre"
          onClick={() => setEntretienOuvert(true)}
          disabled={enCours}
          iconeAvant={<Icone nom="icon-calendar" />}
          className="w-full"
        >
          Demander un entretien
        </Bouton>
        <Bouton
          ref={boutonRefuser}
          apparence="contour"
          onClick={() => setRefusOuvert(true)}
          disabled={enCours}
          iconeAvant={<Icone nom="icon-x-circle" />}
          className="w-full"
        >
          Écarter ce profil
        </Bouton>
      </div>

      {/* ── « Ce profil m'intéresse » ─────────────────────────────────────── */}
      <DialogueConfirmation
        titre={`Valider ${reference} ?`}
        message={
          <>
            Vous nous dites que le profil vous convient. <strong>L’étape ne change pas</strong> :
            nous poursuivons avec le candidat et nous revenons vers vous. Quand vous voudrez le
            rencontrer, demandez un entretien.
          </>
        }
        libelleConfirmation="Valider ce profil"
        ouvert={valideOuvert}
        onOuvertureChange={setValideOuvert}
        onConfirmer={() => decider('valide', () => setValideOuvert(false))}
        enCours={enCours}
        focusFinal={boutonValider}
      />

      {/* ── « Demander un entretien » ─────────────────────────────────────── */}
      <DialogueConfirmation
        titre={`Demander un entretien avec ${reference} ?`}
        message={
          auSendOut ? (
            <>Nous organisons l’entretien. Le dossier passe à<strong> « Premier entretien »</strong>.
            </>
          ) : (
            <>Nous prenons contact. Le dossier est déjà plus loin :<strong>son étape ne changera pas</strong>, votre demande est
              enregistrée et transmise à votre agent.
            </>
          )
        }
        libelleConfirmation="Demander l’entretien"
        ouvert={entretienOuvert}
        onOuvertureChange={setEntretienOuvert}
        onConfirmer={() => decider('entretien_demande', () => setEntretienOuvert(false))}
        enCours={enCours}
        focusFinal={boutonEntretien}
      />

      {/* ── « Écarter ce profil » ─────────────────────────────────────────── */}
      <Dialogue
        titre={`Écarter ${reference}`}
        ouvert={refusOuvert}
        onOuvertureChange={setRefusOuvert}
        focusFinal={boutonRefuser}
        actions={
          <>
            <Bouton apparence="contour" onClick={() => setRefusOuvert(false)} disabled={enCours}>
              Annuler
            </Bouton>
            <Bouton apparence="plein" onClick={lancerRefus} disabled={enCours}>
              {enCours ? 'Enregistrement…' : 'Écarter définitivement'}
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {/* La même grammaire visuelle que `DialogueConfirmation` en mode
              destructif : triangle + filet rouge + libellé qui nomme la perte.
              Le rouge est sur le FILET et l'ICÔNE, jamais sur un bouton. */}
          <div
            className={cn(
              'flex items-start gap-3 border-l-2 pl-3',
              'border-[var(--marker-red)]',
            )}
          >
            <Icone
              nom="icon-alert-triangle"
              className="mt-0.5 size-5 shrink-0 text-[var(--marker-red)]"
            />
            <p className="t-body text-black">Le candidat sort du process. Cette décision ne se reprend pas depuis votre espace.</p>
          </div>

          <Selecteur
            libelle="Pourquoi ce profil ne convient pas"
            requis
            substitut="Choisir un motif"
            options={MOTIFS_REFUS_CLIENT.map((m) => ({ valeur: m.code, libelle: m.libelle }))}
            valeur={motif}
            onChangement={(v) => {
              setMotif(v);
              setErreurMotif(undefined);
            }}
            erreur={erreurMotif}
          />

          <ZoneTexte
            libelle="Ce que vous voulez ajouter"
            aide="Facultatif, transmis à votre agent."
            value={commentaire}
            onChange={(e) => setCommentaire(e.currentTarget.value)}
            maxLength={5000}
            lignes={4}
          />
        </div>
      </Dialogue>
    </Carte>
  );
}

/**
 * Le dossier est clos : on n'affiche PAS trois boutons désactivés.
 *
 * Un bouton grisé promet une action que l'on pourrait débloquer ; ici il n'y a
 * rien à débloquer, la base refuse toute décision sur une étape terminale. On
 * dit ce qui s'est passé, et à qui s'adresser.
 */
function ProcessClos({ estKo }: { estKo: boolean }) {
  return (
    <Carte regime="travail" className="flex flex-col gap-2 p-4">
      <p className="t-titre-hl flex items-center gap-2 text-black">
        <Icone
          nom={estKo ? 'icon-x-circle' : 'icon-check-circle'}
          className="size-4 text-[var(--encre-600)]"
        />
        {estKo ? 'Ce profil est sorti du process' : 'Ce recrutement est abouti'}
      </p>
      <p className="t-caption text-[var(--encre-600)]">
        {estKo
          ? 'Il n’y a plus de décision à prendre sur ce dossier. Votre Account Manager peut le rouvrir si votre besoin a changé.'
          : 'Le candidat a été recruté. Le dossier reste consultable, et sa facturation apparaît dans votre espace « Contrat & factures ».'}
      </p>
    </Carte>
  );
}
