import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Carte } from "@/components/pacha/Carte";
import { Divider } from "@/components/pacha/Divider";
import { TuileCompteur } from "@/components/pacha/StatutProcess";
import { TagContrat, TagInfo, TagUnivers } from "@/components/pacha/Tag";
import { ActionsMandat } from "@/components/vues/entreprise/ActionsMandat";
import {
  CadreEcran,
  CarteEquipe,
  Champ,
  EnteteEcran,
  GrilleChamps,
} from "@/components/vues/entreprise/atomes";
import { PipelineMandat } from "@/components/vues/entreprise/PipelineMandat";
import { SqueletteTableau } from "@/components/vues/entreprise/squelettes";
import {
  dateLongue,
  estClos,
  fourchette,
  libelleStatut,
  teinteDepuisLibelle,
  type MandatClient,
} from "@/lib/domaine/entreprise";
import { candidatsDuMandat, unMandat } from "@/lib/entreprise/lectures";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mandat = await unMandat(id).catch(() => null);
  return { title: mandat ? mandat.intitule : "Poste introuvable" };
}

/**
 * LE DÉTAIL D'UN POSTE.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA PAGE ATTEND SA LIGNE, ET SEULEMENT ELLE
 * ─────────────────────────────────────────────────────────────────────────
 * `unMandat` est résolu AVANT tout rendu : c'est ce qui permet à `notFound()`
 * de rendre un vrai HTTP 404. Un `loading.tsx` sur cette route posait une
 * frontière `Suspense` autour de la page entière, la réponse partait avant que
 * la donnée n'arrive, et le statut restait bloqué à 200 — mesuré, corrigé,
 * expliqué dans `components/vues/entreprise/squelettes.tsx`.
 *
 * Les deux sections coûteuses — le pipeline et l'annonce publiée — ont chacune
 * leur propre `Suspense` : le titre du poste, ses tags et son résumé arrivent
 * immédiatement, le reste suit.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 404 ET « PAS À VOUS » RENDENT LA MÊME PAGE
 * ─────────────────────────────────────────────────────────────────────────
 * `api.mandat_client` est cloisonnée par entreprise : « aucune ligne » veut
 * dire soit « ce mandat n'existe pas », soit « il n'est pas à vous ». Les deux
 * doivent produire la même réponse — les distinguer apprendrait à un curieux
 * qu'un identifiant existe ailleurs.
 */
export default async function Vue({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mandat = await unMandat(id);
  if (!mandat) notFound();

  const clos = estClos(mandat.statut);
  const plage = fourchette(mandat);

  // Les trois textes du brief, dans l'ordre où ils ont été saisis. Un bloc sans
  // contenu ne rend rien : la règle du portail veut qu'il disparaisse.
  const brief = [
    mandat.missions && { titre: "Les missions", corps: mandat.missions },
    mandat.pourToi && {
      titre: "Le poste est fait pour vous si",
      corps: mandat.pourToi,
    },
    mandat.pasPourToi && {
      titre: "Ça ne marchera pas si",
      corps: mandat.pasPourToi,
    },
  ].filter(Boolean) as { titre: string; corps: string }[];

  return (
    <CadreEcran>
      <EnteteEcran
        descriptif="Le poste"
        impact={mandat.intitule}
        retour={{ href: "/entreprise", libelle: "Tous vos postes" }}
        actions={
          <ActionsMandat
            mandatId={mandat.id}
            statut={mandat.statut}
            estClos={clos}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <TagInfo>{libelleStatut(mandat.statut)}</TagInfo>
        {mandat.univers && (
          <TagUnivers univers={teinteDepuisLibelle(mandat.univers)}>
            {mandat.univers}
          </TagUnivers>
        )}
        {mandat.contrat && <TagContrat contrat={mandat.contrat} />}
        {mandat.estAnonyme && <TagInfo emoji="🕶">Diffusion anonyme</TagInfo>}
      </div>

      {mandat.statut === "nouveau" && (
        /* ⚠ LE JAUNE D'ATTENTE, ET NON LE VIOLET PÂLE. C'est le seul bandeau
           du portail qui dit « quelque chose est en cours de votre côté à nous » :
           il porte la teinte de statut qui signifie l'attente, la même que
           l'étiquette « Nouveau » à trois centimètres de là. L'émoji ⏳ est
           parti : le portail n'en porte plus aucun. */
        <Carte
          regime="contour"
          className="flex flex-col gap-1.5 bg-[var(--statut-attente)] p-5"
        >
          <h2 className="t-h3">Ce brief attend la validation de votre agent</h2>
          <p className="t-body max-w-[64ch] text-black">
            En attente de relecture avec votre Account Manager.
          </p>
        </Carte>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-8">
          {/* Le titre a suivi le contenu : il est DANS la carte du pipeline,
              sur la même ligne que la bascule de vue. Le laisser ici en aurait
              fait deux. */}
          <Suspense fallback={<SqueletteTableau lignes={4} colonnes={5} />}>
            <SectionPipeline mandat={mandat} clos={clos} />
          </Suspense>

          {/* ⚠ LE BRIEF, QU'IL SOIT PUBLIÉ OU NON.
              Cette section lisait `api.offre_detail` — la vue du JOB BOARD —
              et n'existait donc que pour les mandats publiés : 2 sur 9, mesuré.
              Les sept autres perdaient un texte que l'entreprise avait écrit
              elle-même dans « Ouvrir un poste ». Elle lit désormais le mandat,
              qui le porte depuis toujours ; la migration du 13/09 l'expose.

              La phrase de contexte suit l'état : sur un poste publié, ce texte
              EST l'annonce que les candidats lisent ; sur un poste non publié,
              c'est le brief, et le dire évite de croire qu'on est en ligne. */}
          {brief.length > 0 && (
            /* Même forme que le pipeline : une seule carte, titre et phrase
               de contexte à l'intérieur. Deux blocs voisins sur un écran ne
               peuvent pas avoir deux structures différentes. */
            <Carte regime="travail" className="flex flex-col gap-5 p-5">
              <div className="flex flex-col gap-1">
                <h2 className="t-h3">
                  {mandat.estPublie ? "L’annonce" : "Le brief"}
                </h2>
                {/* La phrase n'existe que sur un poste publié, où elle dit une chose
                    que le titre ne dit pas : ce texte est LU, et par des
                    candidats. Sur un poste non publié, « Le brief » se suffit. */}
                {mandat.estPublie && (
                  <p className="t-caption text-[var(--encre-600)]">
                    Ce que les candidats lisent sur le job board.
                  </p>
                )}
              </div>
              {brief.map((b) => (
                <BlocBrief key={b.titre} titre={b.titre} corps={b.corps} />
              ))}
            </Carte>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Carte regime="travail" className="flex flex-col gap-4 p-4">
            <h2 className="t-h3">Le poste en bref</h2>
            <GrilleChamps colonnes={2} className="sm:grid-cols-1">
              <Champ libelle="Métier" valeur={mandat.metier} />
              <Champ libelle="Fourchette" valeur={plage} />
              <Champ libelle="Localisation" valeur={mandat.localisation} />
              <Champ
                libelle="Ouvert le"
                valeur={dateLongue(mandat.kickoffLe ?? mandat.creeLe)}
              />
            </GrilleChamps>
            <Divider />
            {/* ⚠ DEUX TUILES, ET C'EST LE RETOUR DU COMPOSANT DU SYSTÈME.
                `TuileCompteur` avait été écartée parce que TROIS d'entre elles
                dans une colonne de 300px se voyaient allouer 90px chacune : les
                libellés se coupaient en « candid… » et les chiffres se
                chevauchaient. Le problème venait du nombre, pas du composant —
                le troisième compteur affichait de toute façon le même nombre que
                « présentés ». À deux, elles s'empilent à pleine largeur
                (`min-w-[178px]` contre 300 disponibles) et rien ne se tronque.

                Les deux restent à zéro plutôt que de disparaître : zéro profil
                présenté est une information sur ce poste. */}
            <div className="flex flex-wrap gap-3">
              <TuileCompteur
                nombre={mandat.presentes}
                libelle="profils présentés"
                className="flex-[1_1_178px] bg-[var(--fond-page)]"
              />
              <TuileCompteur
                nombre={mandat.enCours}
                libelle="encore en cours"
                className="flex-[1_1_178px] bg-[var(--fond-page)]"
              />
            </div>
          </Carte>

          <CarteEquipe
            amNom={mandat.agentNom}
            amPhoto={mandat.agentPhoto}
            amFonction={mandat.agentFonction}
            recruteurs={[
              {
                nom: mandat.recruteurNom,
                photo: mandat.recruteurPhoto,
                fonction: mandat.recruteurFonction,
              },
              {
                nom: mandat.recruteur2Nom,
                photo: mandat.recruteur2Photo,
                fonction: mandat.recruteur2Fonction,
              },
            ]}
          />
        </aside>
      </div>
    </CadreEcran>
  );
}

/** Un bloc de texte long, rendu tel qu'il a été écrit — retours compris. */
function BlocBrief({ titre, corps }: { titre: string; corps: string }) {
  return (
    <div className="flex flex-col gap-2 border-t border-[var(--encre-100)] pt-4 first:border-t-0 first:pt-0">
      <h3 className="t-titre-hl text-black">{titre}</h3>
      <p className="t-body whitespace-pre-line text-[var(--encre-700)]">
        {corps}
      </p>
    </div>
  );
}

async function SectionPipeline({
  mandat,
  clos,
}: {
  mandat: MandatClient;
  clos: boolean;
}) {
  const candidats = await candidatsDuMandat(mandat.id);
  return (
    <PipelineMandat
      candidats={candidats}
      totalCandidatures={mandat.candidatures}
      mandatEstClos={clos}
    />
  );
}
