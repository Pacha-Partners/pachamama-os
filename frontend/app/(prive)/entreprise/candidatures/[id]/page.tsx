import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { BoutonCopier } from '@/components/pacha/BoutonCopier';
import { Carte } from '@/components/pacha/Carte';
import { Divider } from '@/components/pacha/Divider';
import { Icone } from '@/components/pacha/Icone';
import { TagInfo, TagUnivers } from '@/components/pacha/Tag';
import { ActionsDecision } from '@/components/vues/entreprise/ActionsDecision';
import {
  BlocCopiable,
  CadreEcran,
  CarteEquipe,
  Champ,
  EnteteEcran,
  GrilleChamps,
  ListeTags,
  PastilleEtape,
} from '@/components/vues/entreprise/atomes';
import { FilCandidature } from '@/components/vues/entreprise/FilCandidature';
import { SqueletteBloc } from '@/components/vues/entreprise/squelettes';
import {
  dateLongue,
  ficheEnTexte,
  fourchette,
  libelleNiveau,
  nomAffichable,
  teinteDepuisLibelle,
  textePieces,
  texteProfil,
  texteRecherche,
} from '@/lib/domaine/entreprise';
import { notesDeLaCandidature, unCandidat, unMandat } from '@/lib/entreprise/lectures';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidat = await unCandidat(id).catch(() => null);
  return { title: candidat ? `Profil ${candidat.reference}` : 'Profil introuvable' };
}

/**
 * LA FICHE D'UN PROFIL PRÉSENTÉ.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE CETTE PAGE MONTRE, ET CE QU'ELLE NE PEUT PAS MONTRER
 * ─────────────────────────────────────────────────────────────────────────
 * `api.candidat_presente` projette 28 colonnes. Les 22 colonnes d'identité et
 * de qualification cabinet — nom de famille, courriel, téléphone, LinkedIn,
 * `est_qualifie`, `statut_relation`, `mindset`, la négociation salariale menée
 * par le cabinet — ne sont PAS dans la vue, et deux harnais le contrôlent : le
 * harnais de base interroge chaque colonne interdite (PostgREST répond 42703),
 * celui des écrans relit le nom de famille sous clé de service et le cherche
 * dans le HTML rendu. Il n'y a donc rien à masquer ici : ce composant ne peut
 * pas divulguer ce que sa donnée ne porte pas.
 *
 * ── L'IDENTITÉ EST MONTRÉE ICI, ET NULLE PART AILLEURS (décision D-14) ──
 * La tension a été tranchée. Le cadrage P0 décrit cette feature ainsi :
 * « prénom/nom (ou anonymisé selon étape), photo, CV, expériences, métier
 * actuel, anglais, prétentions, SANS les notes internes ni l'avis Pachamama ».
 * Le garde-fou du métier porte sur l'AVIS, pas sur l'identité.
 *
 * Et la mesure a tranché le reste : 1 145 des 1 414 `cv_url` servis à un client
 * (81 %) contiennent le patronyme dans le chemin du fichier. Afficher une
 * référence pseudonyme au-dessus d'un lien qui nomme la personne ne protégeait
 * rien — cela masquait seulement la divulgation.
 *
 * Donc : la LISTE et le KANBAN ne montrent que la référence ; CETTE PAGE montre
 * la personne. Ce qui reste hors de portée du client n'a pas bougé : e-mail,
 * téléphone, LinkedIn (on passe par le cabinet), les six colonnes de jugement
 * de la candidature, toute la qualification cabinet.
 *
 * La candidature est attendue AVANT tout rendu, pour que `notFound()` rende un
 * vrai 404 — voir `components/vues/entreprise/squelettes.tsx`. Le fil de notes,
 * lui, arrive derrière son propre `Suspense`.
 */
export default async function Vue({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidat = await unCandidat(id);
  if (!candidat) notFound();

  const mandat = candidat.mandatId ? await unMandat(candidat.mandatId) : null;

  const attentes = fourchette({
    salaireMinKe: candidat.attentesSalaireMinKe,
    salaireMaxKe: candidat.attentesSalaireMaxKe,
    tjmMinEur: candidat.attentesTjmMinEur,
    tjmMaxEur: candidat.attentesTjmMaxEur,
  });

  return (
    <CadreEcran>
      <EnteteEcran
        descriptif="Le profil"
        impact={nomAffichable(candidat)}
        retour={
          mandat
            ? { href: `/entreprise/mandats/${mandat.id}`, libelle: mandat.intitule }
            : { href: '/entreprise', libelle: 'Tous vos postes' }
        }
        chapeau={candidat.metierActuel ?? undefined}
        actions={
          <BoutonCopier
            texte={ficheEnTexte(candidat)}
            libelle="Copier la fiche"
            libelleCopie="Fiche copiée"
            apparence="plein"
            taille="md"
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <PastilleEtape etape={candidat.etape} couleur={candidat.etapeCouleur} />
        <TagInfo emoji="🔖">{candidat.reference}</TagInfo>
        {candidat.univers && (
          <TagUnivers univers={teinteDepuisLibelle(candidat.univers)}>
            {candidat.univers}
          </TagUnivers>
        )}
        {candidat.echeanceLe && (
          <TagInfo emoji="🗓">Prochaine étape le {dateLongue(candidat.echeanceLe)}</TagInfo>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-8">
          {/* ── Notre lecture ──────────────────────────────────────────────
              ⚠ CE BLOC GARDE SA PLACE MÊME VIDE, et il devient une demande.
              `argumentaire_client` est nul sur les 35 candidats mesurés : un
              cadre noir vide en tête de l'écran le plus important apprend à
              l'utilisateur à ne plus le regarder. L'état vide dit qui écrit
              cette lecture et mène là où on peut la demander, ce qui est la
              seule suite utile. Régime `contour` — filet noir, pas d'ombre :
              c'est ce qui se lit en pleine page, quand la carte de décision, à
              droite, prend le régime `accroche` parce qu'on clique dedans. */}
          <Carte
            regime="contour"
            className="flex flex-col items-start gap-3 rounded-[var(--r-ml)] p-5"
          >
            <h2 className="t-h3">Notre lecture de ce profil</h2>
            {candidat.argumentaire ? (
              <p className="t-body max-w-[80ch] whitespace-pre-line text-black">
                {candidat.argumentaire}
              </p>
            ) : (
              <>
                <p className="t-body max-w-[80ch] text-[var(--encre-600)]">
                  Votre recruteur écrit ici ce qu’il a vu du profil, et le point qu’il vous
                  conseille de creuser en entretien.
                </p>
                <Bouton href="#echanges" apparence="contour" taille="sm">
                  Demander notre lecture
                </Bouton>
              </>
            )}
          </Carte>

          {/* ── Qui est cette personne ───────────────────────────────────── */}
          <BlocCopiable
            titre="Le profil"
            texte={texteProfil(candidat)}
            libelleCopie="Profil copié"
          >
            {/* Sept faits courts : l'auto-ajustement en donne trois ou quatre
                colonnes sur une carte large, une seule en étroit. Deux colonnes
                fixes gaspillaient la moitié de la largeur. */}
            <GrilleChamps
              colonnes={2}
              className="[grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))] sm:grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))]"
            >
              <Champ libelle="Métier" valeur={candidat.metierActuel} />
              <Champ libelle="Employeur actuel" valeur={candidat.posteActuel} />
              <Champ
                libelle="Expérience"
                valeur={
                  candidat.anneesExperience !== null ? `${candidat.anneesExperience} ans` : null
                }
              />
              <Champ libelle="Contrat actuel" valeur={candidat.posteActuelContrat} />
              <Champ libelle="En poste depuis" valeur={candidat.posteActuelDepuisLe} />
              <Champ libelle="Localisation" valeur={candidat.localisation} />
              <Champ
                libelle="Anglais"
                valeur={candidat.niveauAnglaisLibelle ?? libelleNiveau(candidat.niveauAnglais)}
              />
            </GrilleChamps>
            <Divider />
            <div className="flex flex-col gap-4">
              <ListeTags libelle="Expertises" valeurs={candidat.expertises} />
              <ListeTags libelle="Secteurs connus" valeurs={candidat.secteursExperience} />
              <ListeTags libelle="Type de parcours" valeurs={candidat.parcoursType} />
              <ListeTags libelle="Profil" valeurs={candidat.profils} />
              <ListeTags libelle="Produits connus" valeurs={candidat.produitsConnus} />
            </div>
          </BlocCopiable>

          {/* ── Ce qu'elle cherche ───────────────────────────────────────── */}
          {/* ⚠ DEUX CARTES ET NON UNE. Ce que la personne EST, et ce qu'elle
              VEUT : c'est la comparaison que le décideur fait, et elle demande
              deux blocs séparés par un vrai intervalle.
              « Ce que cette personne recherche » et non « ce qu'il ou elle » :
              le modèle ne porte pas le genre, et la tournure neutre se lit mieux
              que la double forme. */}
          <BlocCopiable
            titre="Ce que cette personne recherche"
            texte={texteRecherche(candidat)}
            libelleCopie="Attentes copiées"
          >
            <GrilleChamps
              colonnes={2}
              className="[grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))] sm:grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))]"
            >
              <Champ libelle="Poste visé" valeur={candidat.attentesMetier} />
              <Champ libelle="Univers visé" valeur={candidat.attentesUnivers} />
              <Champ libelle="Rémunération souhaitée" valeur={attentes} />
              <Champ libelle="Disponibilité" valeur={candidat.disponibilite} />
              <Champ libelle="Localisation visée" valeur={candidat.attentesLocalisation} />
            </GrilleChamps>
            <Divider />
            <div className="flex flex-col gap-4">
              <ListeTags libelle="Contrats acceptés" valeurs={candidat.contratsSouhaites} />
              <ListeTags libelle="Rythme de remote" valeurs={candidat.remotesSouhaites} />
              <ListeTags libelle="Secteurs visés" valeurs={candidat.secteursVises} />
              <ListeTags libelle="Ce qui compte pour cette personne" valeurs={candidat.criteres} />
            </div>
            {candidat.attentesDescription && (
              <>
                <Divider />
                <div className="flex flex-col gap-1">
                  <p className="t-caption text-[var(--encre-600)]">En quelques mots</p>
                  <p className="t-body max-w-[80ch] whitespace-pre-line text-black">
                    {candidat.attentesDescription}
                  </p>
                </div>
              </>
            )}
          </BlocCopiable>

          {/* ── Les pièces ───────────────────────────────────────────────── */}
          {/* ⚠ LE BLOC ENTIER DISPARAÎT QUAND IL N'Y A AUCUN DOCUMENT, et la
              phrase de confidentialité avec lui : elle porte SUR des documents.
              C'est l'autre règle du vide — un champ sans valeur s'écrit « Non
              renseigné », un bloc sans contenu s'en va. */}
          {(candidat.cvUrl || candidat.portfolioUrl) && (
            <BlocCopiable
              titre="Les pièces"
              texte={textePieces(candidat)}
              libelleCopie="Liens copiés"
            >
              <div className="flex flex-wrap gap-2">
                {candidat.cvUrl && (
                  <Bouton
                    href={candidat.cvUrl}
                    cible="_blank"
                    apparence="contour"
                    taille="sm"
                    iconeApres={<Icone nom="icon-external-link" />}
                  >
                    Ouvrir le CV
                  </Bouton>
                )}
                {candidat.portfolioUrl && (
                  <Bouton
                    href={candidat.portfolioUrl}
                    cible="_blank"
                    apparence="contour"
                    taille="sm"
                    iconeApres={<Icone nom="icon-external-link" />}
                  >
                    Ouvrir le portfolio
                  </Bouton>
                )}
              </div>
              {/* ⚠ EN CORPS NOIR, PAS EN LÉGENDE GRISE. Elle est systématique et
                  elle porte une obligation : la mettre en gris de note de bas de
                  page reviendrait à espérer qu'on ne la lise pas. */}
              <p className="t-body-hl max-w-[80ch] text-black">
                Communiqué pour ce recrutement, à ne pas diffuser hors de votre équipe de
                décision.
              </p>
            </BlocCopiable>
          )}

          {/* ── Le fil ───────────────────────────────────────────────────── */}
          <section aria-labelledby="echanges" className="flex flex-col gap-4">
            <h2 id="echanges" className="t-h2">
              Vos échanges
            </h2>
            <Suspense fallback={<SqueletteBloc lignes={3} />}>
              <SectionFil candidatureId={candidat.id} />
            </Suspense>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <ActionsDecision
            candidatureId={candidat.id}
            reference={candidat.reference}
            etapeCode={candidat.etapeCode}
            estTerminale={candidat.estTerminale}
            estKo={candidat.estKo}
          />

          {mandat && (
            <>
              <Carte regime="travail" className="flex flex-col gap-3 p-4">
                <p className="t-caption text-[var(--encre-500)]">Pour le poste</p>
                <p className="t-body-bold text-black">{mandat.intitule}</p>
                <Bouton
                  href={`/entreprise/mandats/${mandat.id}`}
                  apparence="contour"
                  taille="sm"
                  iconeApres={<Icone nom="icon-chevron-right" />}
                  className="w-fit"
                >
                  Voir le pipeline
                </Bouton>
              </Carte>

              {/* ⚠ L'ÉQUIPE ENTIÈRE, ET NON LE SEUL ACCOUNT MANAGER.
                  Cette carte ne nommait que l'agent. Or sur un profil, la
                  question est « qui suit CE candidat » — et la réponse est le
                  ou les recruteurs du mandat, ceux qui l'ont appelé et qui
                  organisent ses entretiens. Ils sont renseignés 9 fois sur 9 sur
                  les mandats mesurés ; les taire laissait croire que seul
                  l'Account Manager travaillait le poste.

                  C'est le même composant et le même ordre que sur l'écran du
                  poste : recruteurs devant, Account Manager après. */}
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
            </>
          )}
        </aside>
      </div>
    </CadreEcran>
  );
}

async function SectionFil({ candidatureId }: { candidatureId: string }) {
  const notes = await notesDeLaCandidature(candidatureId);
  return (
    <Carte regime="travail" className="p-4">
      <FilCandidature candidatureId={candidatureId} notes={notes} />
    </Carte>
  );
}
