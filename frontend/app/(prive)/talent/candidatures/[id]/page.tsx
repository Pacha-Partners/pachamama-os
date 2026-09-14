import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { Carte } from '@/components/pacha/Carte';
import { SqueletteBloc } from '@/components/vues/entreprise/squelettes';
import {
  DetailCandidature,
  EnteteCandidature,
} from '@/components/vues/talent/DetailCandidature';
import { CadreEcran } from '@/components/vues/talent/atomes';
import { estUuid } from '@/lib/domaine/talent';
import { notesDeLaCandidature, referentiels, uneCandidature } from '@/lib/talent/lectures';
import { Icone } from '@/components/pacha/Icone';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

/**
 * LE DÉTAIL D'UNE CANDIDATURE.
 *
 * ⚠ PAS DE `loading.tsx` SUR CETTE ROUTE, ET C'EST UNE CORRECTION MESURÉE.
 * Un `loading.tsx` pose une frontière `Suspense` autour de la PAGE ENTIÈRE :
 * Next envoie la coquille avant que la page n'ait résolu sa donnée, et une
 * réponse commencée ne change plus de statut. `notFound()` rendrait donc la
 * bonne page avec un **HTTP 200** — défaut mesuré en phase 1 sur
 * `/entreprise/mandats/<uuid inexistant>`, et trouvé par le harnais des
 * écrans, pas à la relecture.
 *
 * On attend donc SA ligne — une seule, par identifiant, quelques dizaines de
 * millisecondes — puis on rend l'en-tête tout de suite, et les deux lectures
 * secondaires (les notes, le référentiel des motifs) passent derrière leur
 * propre `Suspense`. Le statut redevient exact, et on voit le poste avant que
 * le reste n'arrive.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!estUuid(id)) return { title: 'Candidature introuvable' };
  const c = await uneCandidature(id).catch(() => null);
  // ⚠ LE TITRE D'ONGLET NE NOMME PAS LE CLIENT D'UNE OFFRE ANONYME. Ce serait
  // le seul endroit de la page à le faire, et il part dans l'historique du
  // navigateur. Même règle que la fiche d'offre publique.
  if (!c) return { title: 'Candidature introuvable' };
  return { title: c.entreprise ? `${c.poste} chez ${c.entreprise}` : c.poste };
}

export default async function Vue({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidature = await uneCandidature(id);
  if (!candidature) notFound();

  return (
    <CadreEcran>
      <header className="flex flex-col gap-4">
        <Link
          href="/talent/process"
          className="t-caption-hl inline-flex w-fit items-center gap-1.5 rounded-[var(--r-xs)] text-[var(--encre-600)] hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        >
          <Icone nom="icon-arrow-left" className="size-3.5" />
          Vos process
        </Link>
        <EnteteCandidature candidature={candidature} />
      </header>

      <Suspense fallback={<AttenteDetail />}>
        <Corps id={candidature.id} />
      </Suspense>
    </CadreEcran>
  );
}

/**
 * Les deux lectures secondaires, derrière leur frontière.
 *
 * Le référentiel `motif_retrait` — 7 lignes de catégorie `candidat`, mesuré —
 * n'est demandé QUE ici : c'est le seul écran qui en a besoin, et charger les
 * dix vocabulaires (769 lignes) sur le tableau de bord serait D-15 par la porte
 * du référentiel.
 */
async function Corps({ id }: { id: string }) {
  const [candidature, notes, vocabulaires] = await Promise.all([
    uneCandidature(id),
    notesDeLaCandidature(id),
    referentiels('motif_retrait'),
  ]);
  // La lecture est mémoïsée par requête : celle-ci ne refrappe pas la base.
  if (!candidature) notFound();

  return (
    <DetailCandidature
      candidature={candidature}
      notes={notes}
      motifs={vocabulaires.motif_retrait ?? []}
    />
  );
}

function AttenteDetail() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-6">
        <SqueletteBloc lignes={3} />
        <SqueletteBloc lignes={5} />
      </div>
      <Carte regime="travail" className="p-4">
        <SqueletteBloc lignes={2} />
      </Carte>
    </div>
  );
}
