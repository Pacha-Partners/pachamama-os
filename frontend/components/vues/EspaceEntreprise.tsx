'use client';

import { useState } from 'react';
import { Bouton } from '@/components/pacha/Bouton';
import { Carte, InfoLigne } from '@/components/pacha/Carte';
import { Divider } from '@/components/pacha/Divider';
import { EtatVide } from '@/components/pacha/EtatVide';
import { Icone } from '@/components/pacha/Icone';
import { Notation } from '@/components/pacha/Notation';
import { StatutProcess, TuileCompteur } from '@/components/pacha/StatutProcess';
import { TagContrat, TagInfo, TagUnivers } from '@/components/pacha/Tag';
import { Titre } from '@/components/pacha/Titre';
import { ETAPES_CLIENT, type CandidatAnonyme, type DonneesEntreprise } from '@/lib/demo/entreprise';
import { cn } from '@/lib/utils';

/**
 * Le portail entreprise : le suivi ANONYMISÉ des candidats d'un client.
 *
 * Trois principes gouvernent cette vue, et le premier est contractuel.
 *
 * 1. **Aucune identité, jamais.** Le client suit ses candidats sans voir qui ils
 *    sont. Ce n'est pas un masquage appliqué à l'affichage : les données reçues
 *    ne PORTENT pas d'identité, et en production la politique de sécurité
 *    PostgreSQL empêche un compte entreprise de lire ces colonnes. L'interface
 *    est la seconde ligne de défense, pas la première.
 *
 * 2. **Le client ne voit pas les onze étapes.** Il entre dans le process au
 *    send-out. Le sourcing et la qualification restent le travail du cabinet.
 *
 * 3. **Ce qui est décoratif reste décoratif.** Les cartes de candidat sont en
 *    régime « travail » : elles se parcourent par dizaines, donc pas d'ombre
 *    rétro. Celle-ci est réservée à ce qui se regarde.
 */
export function EspaceEntreprise({ client, mandats }: DonneesEntreprise) {
  const [mandatActif, setMandatActif] = useState(mandats[0]?.id ?? '');
  const mandat = mandats.find((m) => m.id === mandatActif) ?? mandats[0];

  const enProcess = mandats.reduce(
    (n, m) => n + m.candidats.filter((c) => c.etape !== 'ko' && c.etape !== 'recrute').length,
    0,
  );
  const echeances = mandats
    .flatMap((m) => m.candidats.map((c) => c.prochaineEcheance))
    .filter((d): d is string => Boolean(d))
    .sort((a, b) => a.split('/').reverse().join('').localeCompare(b.split('/').reverse().join('')));

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10 md:px-8">
      {/* ------------------------------------------------------ en-tête client */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Titre niveau={1} descriptif="Vos recrutements chez" impact={client.nom} />
          <p className="t-caption mt-2 text-[var(--encre-600)]">
            {client.secteur} · interlocuteur : {client.interlocuteur}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <TuileCompteur nombre={mandats.filter((m) => m.candidats.length > 0).length} libelle="Postes en cours d’instruction" />
        <TuileCompteur nombre={enProcess} libelle="Candidat·es dans vos process" />
        <TuileCompteur
          nombre={echeances.length}
          libelle={echeances.length > 0 ? `Prochaine échéance le ${echeances[0]}` : 'Aucune échéance planifiée'}
        />
      </div>

      {/* --------------------------------------- la note qui explique l'anonymat */}
      <Carte regime="travail" className="mt-8 flex items-start gap-3 bg-[var(--violet-050)] p-4">
        <span aria-hidden="true" className="text-lg leading-none">
          🔒
        </span>
        <div>
          <p className="t-body-hl text-black">Pourquoi vous ne voyez pas les noms</p>
          <p className="t-caption mt-1 text-black">
            Les candidat·es que nous vous présentons restent anonymes jusqu’à ce qu’ils et
            elles acceptent d’être mis en relation avec vous. C’est un engagement que nous
            prenons envers eux, et c’est aussi ce qui nous permet de vous proposer des
            profils qui ne sont pas en recherche active. Chaque référence est stable :
            vous pouvez nous en parler sans ambiguïté.
          </p>
        </div>
      </Carte>

      {/* ------------------------------------------------------- vos mandats */}
      <section aria-labelledby="mandats" className="mt-10">
        <h2 id="mandats" className="t-h2">
          Vos postes ouverts
        </h2>
        <ul className="mt-4 flex flex-col gap-2" role="tablist" aria-label="Vos postes ouverts">
          {mandats.map((m) => {
            const actif = m.id === mandat?.id;
            const visibles = m.candidats.filter((c) => ETAPES_CLIENT.includes(c.etape));
            return (
              <li key={m.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={actif}
                  onClick={() => setMandatActif(m.id)}
                  className={cn(
                    'flex w-full flex-wrap items-center gap-3 rounded-[var(--r-md)] border p-4 text-left transition-shadow',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black',
                    actif
                      ? 'border-2 border-black bg-white shadow-[var(--ombre-3)]'
                      : 'border-[var(--encre-200)] bg-white hover:border-black',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="t-body-bold block text-black">{m.poste}</span>
                    <span className="t-caption text-[var(--encre-500)]">
                      Ouvert le {m.ouvertLe}
                    </span>
                  </span>
                  <TagUnivers univers={m.univers} />
                  <TagContrat contrat={m.contrat} />
                  <span className="t-caption-hl whitespace-nowrap text-black">
                    {visibles.length === 0
                      ? 'Sourcing en cours'
                      : `${visibles.length} candidat·e${visibles.length > 1 ? 's' : ''}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ------------------------------------------------------- le pipeline */}
      {mandat && (
        <section aria-labelledby="pipeline" className="mt-10">
          <h2 id="pipeline" className="t-h2">
            {mandat.poste}
          </h2>
          <p className="t-caption mt-1 mb-5 text-[var(--encre-600)]">
            Vous entrez dans le process au moment où nous vous présentons quelqu’un. Les
            étapes de sourcing et de qualification qui précèdent restent de notre côté.
          </p>
          <Pipeline candidats={mandat.candidats} />
        </section>
      )}
    </div>
  );
}

/** Les candidats groupés par étape, dans l'ordre du process côté client. */
function Pipeline({ candidats }: { candidats: CandidatAnonyme[] }) {
  const visibles = candidats.filter((c) => ETAPES_CLIENT.includes(c.etape));

  if (visibles.length === 0) {
    return (
      <EtatVide
        titre="Sourcing en cours"
        description="Nous qualifions les profils avant de vous les présenter. Vous verrez apparaître ici les candidat·es dès le premier send-out."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {ETAPES_CLIENT.map((etape) => {
        const lot = visibles.filter((c) => c.etape === etape);
        if (lot.length === 0) return null;
        return (
          <div key={etape}>
            <div className="mb-3 flex items-center gap-3">
              <StatutProcess etape={etape} />
              <span className="t-caption text-[var(--encre-500)]">
                {lot.length} candidat·e{lot.length > 1 ? 's' : ''}
              </span>
            </div>
            <ul className="grid gap-4 lg:grid-cols-2">
              {lot.map((c) => (
                <li key={c.reference} className="flex">
                  <CarteAnonyme candidat={c} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/**
 * La carte d'un candidat anonyme.
 *
 * Elle est composée à partir de `Carte` plutôt que de `CarteCandidat`, et c'est
 * délibéré : `CarteCandidat` exige un `nom` et calcule des initiales. Lui passer
 * une référence fonctionnerait, mais on installerait dans le code l'idée qu'une
 * référence anonyme est un nom — et c'est exactement la confusion qui, un jour,
 * fait afficher le vrai. La contrainte métier prime sur la commodité.
 */
function CarteAnonyme({ candidat: c }: { candidat: CandidatAnonyme }) {
  const retire = c.etape === 'ko';
  return (
    <Carte
      regime="travail"
      className={cn('flex w-full flex-col gap-3 p-4', retire && 'opacity-70')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="t-body-bold text-black">{c.reference}</p>
          <p className="t-caption text-[var(--encre-500)]">
            {c.seniorite} · {c.experience}
          </p>
        </div>
        {/* L'avis est celui du cabinet, pas un score automatique : le libellé
            textuel accompagne la pastille, une note ne peut pas reposer sur une
            seule couleur ni sur un seul emoji. */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Notation note={c.avisCabinet} taille="sm" />
          <span className="t-caption text-[var(--encre-500)]">Avis Pachamama</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {c.expertises.map((e) => (
          <TagInfo key={e}>{e}</TagInfo>
        ))}
      </div>

      <Divider />

      <div className="flex flex-col gap-1.5">
        <InfoLigne emoji="💸" libelle="Prétentions" valeur={c.pretentions} />
        <InfoLigne emoji="📍" libelle="Localisation" valeur={c.localisation} />
        <InfoLigne emoji="💻" libelle="Mode de travail" valeur={c.modeDeTravail} />
        <InfoLigne emoji="🗓" libelle="Disponibilité" valeur={c.disponibilite} />
      </div>

      {c.argumentaire && (
        <p className="t-caption rounded-[var(--r-sm)] bg-[var(--violet-050)] px-3 py-2 text-black">
          <span className="t-caption-bold">Notre lecture — </span>
          {c.argumentaire}
        </p>
      )}

      {c.prochaineEcheance && (
        <p className="t-caption-hl text-black">
          <span aria-hidden="true">🗓 </span>
          <span className="sr-only">Prochaine échéance : </span>
          Prochaine étape le {c.prochaineEcheance}
        </p>
      )}

      {retire ? (
        <p className="t-caption flex items-center gap-1.5 text-[var(--encre-600)]">
          <Icone nom="icon-x-circle" className="size-3.5" />
          Ce profil n’est plus dans le process.
        </p>
      ) : (
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Bouton apparence="contour" taille="sm" disabled>
            Donner un retour
          </Bouton>
          <Bouton apparence="contour" taille="sm" disabled>
            Demander un entretien
          </Bouton>
          <p className="t-caption w-full text-[var(--encre-500)]">
            Ces actions passeront par l’API, qui n’est pas encore branchée : rien n’est
            envoyé depuis cet écran.
          </p>
        </div>
      )}
    </Carte>
  );
}
