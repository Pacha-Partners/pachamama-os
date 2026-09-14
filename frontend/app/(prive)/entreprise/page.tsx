import { Suspense } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { Carte } from '@/components/pacha/Carte';
import { Icone } from '@/components/pacha/Icone';
import { Squelette } from '@/components/pacha/Squelette';
import { TuileCompteur } from '@/components/pacha/StatutProcess';
import { CadreEcran, CarteInterlocuteur, EnteteEcran } from '@/components/vues/entreprise/atomes';
import { SqueletteTableau } from '@/components/vues/entreprise/squelettes';
import { TableauDeBord } from '@/components/vues/entreprise/TableauDeBord';
import { dateLongue, estClos, prochaineEcheance } from '@/lib/domaine/entreprise';
import { mesMandats, monEntreprise, toutesMesCandidatures } from '@/lib/entreprise/lectures';

export const metadata = { title: 'Tableau de bord' };

/**
 * LE TABLEAU DE BORD DU PORTAIL ENTREPRISE.
 *
 * Rendu à la demande : les compteurs bougent à chaque transition d'étape, et un
 * tableau de bord qui montre l'état d'hier ne sert qu'à faire douter du reste.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PAS DE `loading.tsx` ICI, ET C'EST UNE CORRECTION MESURÉE
 * ─────────────────────────────────────────────────────────────────────────
 * Un `loading.tsx` posé sur ce segment s'applique AUSSI À TOUS SES ENFANTS —
 * `/entreprise/mandats/[id]`, `/entreprise/candidatures/[id]`. La frontière
 * `Suspense` fait partir la réponse avant que la page n'ait résolu sa donnée,
 * et une réponse commencée ne change plus de statut : `notFound()` rendait la
 * bonne page avec un **HTTP 200**. Le harnais des écrans l'a trouvé, la
 * suppression du fichier l'a corrigé — les deux routes rendent 404.
 *
 * L'attente est donc découpée ICI, en `Suspense` par section, ce qui ne cascade
 * nulle part. On y gagne au passage : le titre et le bouton « Ouvrir un poste »
 * arrivent tout de suite au lieu d'attendre les trois requêtes.
 */
export const dynamic = 'force-dynamic';

export default function Vue() {
  return (
    <CadreEcran>
      <Suspense fallback={<SqueletteEntete />}>
        <Entete />
      </Suspense>

      <Suspense fallback={<SqueletteTuiles />}>
        <Tuiles />
      </Suspense>

      <Suspense fallback={<SqueletteTableau lignes={6} colonnes={5} />}>
        <Corps />
      </Suspense>
    </CadreEcran>
  );
}

/* ── L'en-tête ────────────────────────────────────────────────────────────── */

async function Entete() {
  const entreprise = await monEntreprise();
  return (
    <EnteteEcran
      descriptif="Vos recrutements chez"
      impact={entreprise?.nom ?? 'votre entreprise'}
      actions={
        <Bouton
          href="/entreprise/mandats/nouveau"
          apparence="plein"
          iconeAvant={<Icone nom="icon-plus" />}
        >
          Ouvrir un poste
        </Bouton>
      }
    />
  );
}

function SqueletteEntete() {
  return (
    // `role="status"` et non `aria-label` seul : sur un `<div>` nu, dont le
    // rôle est `generic`, `aria-label` n'est pas exposé — le conteneur restait
    // muet alors que les squelettes sont `aria-hidden` par construction.
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">Chargement</span>
      <Squelette largeur="38%" hauteur={30} />
      <Squelette forme="texte" largeur="60%" />
      <Squelette forme="texte" largeur="45%" />
    </div>
  );
}

/* ── Les quatre chiffres ──────────────────────────────────────────────────── */

async function Tuiles() {
  const [mandats, candidatures] = await Promise.all([mesMandats(), toutesMesCandidatures()]);

  const ouverts = mandats.filter((m) => !estClos(m.statut)).length;
  const enCours = candidatures.filter((c) => !c.estTerminale).length;
  // « À examiner » = les profils au send-out, ceux sur lesquels le client n'a
  // encore rien dit. C'est le seul chiffre de cet écran qui appelle un geste,
  // d'où le 🚨 de `TuileCompteur` quand il n'est pas nul.
  const aExaminer = candidatures.filter((c) => c.etapeCode === 'send_out').length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <TuileCompteur nombre={ouverts} libelle="Postes ouverts" />
      <TuileCompteur nombre={aExaminer} libelle="Profils à examiner" alerte={aExaminer > 0} />
      <TuileCompteur nombre={enCours} libelle="Profils en cours chez vous" />
      <TuileCompteur nombre={candidatures.length} libelle="Profils présentés en tout" />
    </div>
  );
}

function SqueletteTuiles() {
  return (
    <div role="status" aria-busy="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <span className="sr-only">Chargement</span>
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="flex min-w-[178px] flex-1 flex-col items-center justify-center gap-2 rounded-[var(--r-md)] bg-[var(--fond-carte)] p-4"
        >
          <Squelette hauteur={24} largeur={48} />
          <Squelette forme="texte" largeur="70%" />
        </div>
      ))}
    </div>
  );
}

/* ── Le tableau, pleine largeur ───────────────────────────────────────────── */

/*
 * L'AM et l'échéance étaient dans une colonne de droite de 300px. Sur un écran
 * de 1 000px de large, une fois la barre latérale retirée, il restait moins de
 * 400px au tableau pour SEPT colonnes : les en-têtes s'affichaient « Cont… »,
 * « Fourche… », « Li… », et la dernière colonne sortait du cadre. Le tableau est
 * la raison d'être de cet écran, il prend donc toute la largeur ; les deux blocs
 * de contexte passent au-dessus, en bandeau, où ils tiennent sur une ligne.
 */
async function Corps() {
  const [entreprise, mandats, candidatures] = await Promise.all([
    monEntreprise(),
    mesMandats(),
    toutesMesCandidatures(),
  ]);

  const prochaine = prochaineEcheance(candidatures);

  return (
    <div className="flex flex-col gap-6">
      {(entreprise?.amNom || prochaine !== null) && (
        <div className="flex flex-wrap items-stretch gap-4">
          {entreprise?.amNom && (
            <CarteInterlocuteur
              titre="Votre Account Manager"
              nom={entreprise.amNom}
              photo={entreprise.amPhoto ?? null}
              fonction={entreprise.amFonction ?? null}
              email={entreprise.amEmail}
              className="min-w-[260px] flex-1"
            />
          )}
          {prochaine !== null && (
            <Carte
              regime="travail"
              className="flex min-w-[200px] flex-col justify-center gap-1 p-4"
            >
              <p className="t-caption text-[var(--encre-500)]">Prochaine échéance</p>
              <p className="t-body-bold text-black">{dateLongue(prochaine)}</p>
            </Carte>
          )}
        </div>
      )}

      <section aria-labelledby="postes" className="min-w-0">
        <h2 id="postes" className="sr-only">
          Vos postes
        </h2>
        <TableauDeBord mandats={mandats} />
      </section>
    </div>
  );
}
