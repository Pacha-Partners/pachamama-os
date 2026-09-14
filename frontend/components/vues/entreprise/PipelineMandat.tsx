"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Carte } from "@/components/pacha/Carte";
import { EtatVide } from "@/components/pacha/EtatVide";
import { FormeLignesEnRond } from "@/components/pacha/Illustration";
import { Kanban, type ColonneKanban } from "@/components/pacha/Kanban";
import { SelecteurVue, type Vue } from "@/components/pacha/SelecteurVue";
import { Tableau, type ColonneTableau } from "@/components/pacha/Tableau";
import { PastilleEtape } from "@/components/vues/entreprise/atomes";
import {
  dateCourte,
  fourchette,
  fusionnerEtapes,
  instantDe,
  type CandidatPresente,
} from "@/lib/domaine/entreprise";
import { cn } from "@/lib/utils";

/**
 * LE PIPELINE D'UN MANDAT, en liste ou en kanban.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE LE CLIENT VOIT, ET CE QU'IL NE VOIT PAS
 * ─────────────────────────────────────────────────────────────────────────
 * Six étapes sur quatorze (décision D-03). Ce n'est pas un filtre écrit ici :
 * `api.candidat_presente` ne construit pas les lignes des huit autres. Le
 * sourcing, la prise de contact, le screen Pachamama et les deux KO qui ne sont
 * pas du fait du client restent de notre côté.
 *
 * Conséquence mesurée le 09/09 : 1 893 candidatures sur 7 206 sont visibles, et
 * la répartition est très inégale — le compte de test Hublo ne voit que 2 de ses
 * 26 candidatures. UN PIPELINE VIDE EST DONC UN ÉTAT NORMAL, pas une panne, et
 * l'écran doit le DIRE. C'est tout l'objet de `PipelineVide` en bas de fichier :
 * il ne se contente pas de « rien à afficher », il explique pourquoi, et quand
 * le mandat a reçu des candidatures il donne le chiffre.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES SIX COLONNES SONT TOUJOURS LÀ, MÊME VIDES
 * ─────────────────────────────────────────────────────────────────────────
 * Un kanban dont les colonnes apparaissent au fur et à mesure change de forme
 * sous l'utilisateur, et on ne peut plus dire « il n'y a personne en entretien
 * final » — on ne sait pas si la colonne manque ou si elle est vide.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE GLISSER-DÉPOSER N'EST PAS BRANCHÉ, ET C'EST VOULU
 * ─────────────────────────────────────────────────────────────────────────
 * `Kanban` accepte un `onDeplacer`, qui active aussi son menu « Déplacer
 * vers… ». On ne le passe PAS. Un client ne fait pas avancer une étape en
 * traînant une carte : il prend une décision (valider, demander un entretien,
 * refuser avec un motif), et c'est `api.decider_candidature` qui décide de la
 * transition — `entretien_demande` n'avance que depuis le send-out, `valide`
 * n'avance rien du tout. Exposer un déplacement libre laisserait croire à un
 * contrôle qui n'existe pas, et la moitié des gestes seraient refusés par la
 * base. La décision se prend sur la fiche du candidat.
 */
export function PipelineMandat({
  candidats,
  totalCandidatures,
  mandatEstClos,
}: {
  candidats: CandidatPresente[];
  /** `mandat_client.candidatures` — TOUTES, y compris celles qu'on ne montre pas. */
  totalCandidatures: number;
  mandatEstClos: boolean;
}) {
  const router = useRouter();
  // ⚠ LE KANBAN EST LA VUE D'OUVERTURE, ET NON LA LISTE.
  // La question qu'on porte en arrivant sur un poste est « où en sont les
  // profils » : c'est une RÉPARTITION, et seul le kanban la montre d'un coup
  // d'œil. La liste sert deux besoins réels mais seconds — comparer les
  // prétentions d'une colonne à l'autre, et voir les échéances à venir sans
  // ouvrir sept profils. En écran étroit, le kanban n'existant pas, c'est la
  // liste qui est rendue quel que soit cet état.
  const [vue, setVue] = useState<Vue>("kanban");

  const etapes = useMemo(() => fusionnerEtapes(candidats), [candidats]);

  const colonnesKanban = useMemo<ColonneKanban[]>(
    () =>
      etapes.map((e) => ({
        cle: e.code,
        libelle: e.libelle,
        couleur: e.couleur ?? undefined,
        cartes: candidats
          .filter((c) => c.etapeCode === e.code)
          .map((c) => ({
            cle: c.id,
            libelle: `Candidature ${c.reference}`,
            contenu: <CarteCandidature candidat={c} />,
          })),
      })),
    [etapes, candidats],
  );

  const colonnesListe = useMemo<ColonneTableau<CandidatPresente>[]>(
    () => [
      {
        cle: "reference",
        entete: "Référence",
        triSur: (c) => c.reference,
        cellule: (c) => (
          <Link
            href={`/entreprise/candidatures/${c.id}`}
            tabIndex={-1}
            className="t-body-bold text-black underline-offset-2 hover:underline"
          >
            {c.reference}
          </Link>
        ),
        largeur: 120,
      },
      {
        cle: "etape",
        entete: "Étape",
        triSur: (c) => c.etapeOrdre,
        cellule: (c) => (
          <PastilleEtape etape={c.etape} couleur={c.etapeCouleur} />
        ),
        largeur: 210,
      },
      {
        cle: "poste",
        entete: "Poste actuel",
        triSur: (c) => c.metierActuel,
        cellule: (c) => (
          <div className="flex min-w-0 flex-col">
            <span className="t-body truncate text-black">
              {c.metierActuel ?? "—"}
            </span>
            {c.posteActuel && (
              <span className="t-caption truncate text-[var(--encre-500)]">
                {c.posteActuel}
              </span>
            )}
          </div>
        ),
        largeur: 220,
        masquerEnMobile: true,
      },
      {
        cle: "lieu",
        entete: "Localisation",
        triSur: (c) => c.localisation,
        cellule: (c) => (
          <span className="t-body text-[var(--encre-600)]">
            {c.localisation ?? "—"}
          </span>
        ),
        largeur: 160,
        masquerEnMobile: true,
      },
      {
        cle: "attentes",
        entete: "Attentes",
        triSur: (c) => c.attentesSalaireMinKe ?? c.attentesTjmMinEur,
        cellule: (c) => (
          <span className="t-body text-black">{attentesDe(c) ?? "—"}</span>
        ),
        largeur: 140,
        masquerEnMobile: true,
      },
      {
        cle: "echeance",
        entete: "Prochaine étape",
        triSur: (c) => instantDe(c.echeanceLe),
        cellule: (c) => (
          <span className="t-caption text-[var(--encre-600)]">
            {dateCourte(c.echeanceLe) ?? "Non renseigné"}
          </span>
        ),
        largeur: 130,
        masquerEnMobile: true,
      },
    ],
    [],
  );

  if (candidats.length === 0) {
    return (
      <PipelineVide total={totalCandidatures} mandatEstClos={mandatEstClos} />
    );
  }

  return (
    /* ⚠ TOUTE LA SECTION EST UNE CARTE, titre et bascule sur la MÊME ligne.
       Le titre vivait en `h2` nu sur le fond de page, et la bascule sur une
       ligne à part en dessous : trois éléments flottants là où il y a un seul
       bloc. La carte les réunit, et le titre passe en `h3` puisqu'il est
       désormais dans son conteneur et non au-dessus de lui. */
    <Carte regime="travail" className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <h2 className="t-h3">Le pipeline</h2>
        {/* ⚠ LA BASCULE DISPARAÎT SOUS `md`, AVEC LE KANBAN QU'ELLE COMMANDE.
          Six colonnes dans 342px font moins de cinquante pixels chacune : la vue
          n'est pas rétrécie, elle est retirée. Et proposer un choix dont une
          branche est indisponible revient à promettre un geste qui n'existe pas.

          La phrase « N profils vous ont été présentés sur ce poste » a sauté :
          le panneau de droite porte le même chiffre, en tuile, à trois cents
          pixels de là. Deux endroits pour un même nombre se lisent comme un
          défaut plutôt que comme une information. */}
        {/* La bascule du système, en icônes — `SelecteurVue`, deux glyphes de
            24px séparés d'un filet, relevés du Figma. */}
        <div className="hidden md:flex">
          <SelecteurVue vue={vue} onChanger={setVue} />
        </div>
      </div>

      {/* Les deux rendus coexistent dans le document mais jamais à l'écran :
          `hidden` retire du flux ET de l'arbre d'accessibilité. En étroit c'est
          donc toujours la liste — qui sait défiler latéralement, ce qu'un kanban
          ne sait pas faire. */}
      {vue === "kanban" && (
        <div className="hidden md:block">
          <Kanban
            colonnes={colonnesKanban}
            titreColonneVide="Personne à cette étape"
            // Les six étapes tiennent d'un coup d'œil : c'est la répartition
            // qu'on vient lire, et la cote fixe de 288px la faisait défiler —
            // on n'en voyait que deux et demie dans la colonne de contenu.
            ajustement="egales"
          />
        </div>
      )}
      <div className={vue === "kanban" ? "md:hidden" : undefined}>
        <Tableau
          colonnes={colonnesListe}
          lignes={candidats}
          cleDeLigne={(c) => c.id}
          legende="Les profils qui vous ont été présentés sur ce poste, avec leur étape et leurs attentes."
          triInitial={{ cle: "etape", sens: "asc" }}
          onLigneActivee={(c) =>
            router.push(`/entreprise/candidatures/${c.id}`)
          }
          libelleLigne={(c) => `Ouvrir la candidature ${c.reference}`}
        />
      </div>
    </Carte>
  );
}

/* ── La carte d'une candidature, dans une colonne de kanban ───────────────── */

/**
 * TROIS LIGNES, ET PAS UNE DE PLUS.
 *
 * Elle en portait cinq : référence, métier, localisation avec son épingle,
 * attentes salariales, et la date de prochaine étape avec son émoji. C'était
 * tenable tant que la colonne faisait 288px ; depuis que les six colonnes se
 * partagent la largeur, elle en fait environ 125 et chaque ligne de plus la
 * rend illisible.
 *
 * Ce qui est parti n'est pas perdu : les attentes et l'échéance sont DEUX
 * COLONNES de la vue liste, qui existe précisément pour les comparer d'un
 * candidat à l'autre — et tout est à un clic sur la fiche du profil.
 *
 * Elle porte son propre habillage : le kanban ne rend que `carte.contenu`,
 * sans cadre, donc c'est à l'appelant de le poser.
 */
function CarteCandidature({ candidat: c }: { candidat: CandidatPresente }) {
  return (
    <Link
      href={`/entreprise/candidatures/${c.id}`}
      className={cn(
        "flex flex-col gap-1 rounded-[var(--r-md)] p-2.5",
        "border border-[var(--encre-100)] bg-[var(--fond-page)]",
        "transition-shadow hover:shadow-[var(--ombre-3)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
      )}
    >
      <span className="t-body-hl truncate text-black">{c.reference}</span>
      {/* Le poste actuel ET l'employeur sur la même ligne : « Lead Dev chez
          Havane ». Le métier seul ne situe pas — c'est le couple qui dit d'où
          vient la personne, et `poste_actuel_employeur` est renseigné. */}
      {c.metierActuel && (
        <span className="t-caption line-clamp-2 text-[var(--encre-600)]">
          {c.posteActuel
            ? `${c.metierActuel} chez ${c.posteActuel}`
            : c.metierActuel}
        </span>
      )}
      {c.localisation && (
        <span className="t-caption truncate text-[var(--encre-600)]">
          {c.localisation}
        </span>
      )}
    </Link>
  );
}

/**
 * Les attentes du candidat, en une ligne.
 *
 * ⚠ CE SONT LES ATTENTES DÉCLARÉES PAR LE CANDIDAT (`fiche_talent.attentes_*`),
 * pas la négociation menée par le cabinet (`candidature.salaire_*`), qui reste
 * fermée au client. Les deux colonnes existent et ne disent pas la même chose ;
 * le développeur base a signalé la tension au ticket, elle attend un arbitrage.
 */
function attentesDe(c: CandidatPresente): string | null {
  return fourchette({
    salaireMinKe: c.attentesSalaireMinKe,
    salaireMaxKe: c.attentesSalaireMaxKe,
    tjmMinEur: c.attentesTjmMinEur,
    tjmMaxEur: c.attentesTjmMaxEur,
  });
}

/* ── L'état vide, qui dit pourquoi ────────────────────────────────────────── */

function PipelineVide({
  total,
  mandatEstClos,
}: {
  total: number;
  mandatEstClos: boolean;
}) {
  // Trois situations, trois textes. « Aucun résultat » ne convient à aucune des
  // trois : le client doit pouvoir distinguer « c'est en cours », « ça n'a rien
  // donné » et « c'est fini », sans appeler son agent pour le savoir.
  const titre = mandatEstClos
    ? "Aucun profil présenté sur ce poste"
    : "Aucun profil ne vous a encore été présenté";

  const description = mandatEstClos
    ? total > 0
      ? `Ce poste a été clos. Nous avions ${total} candidature${total > 1 ? "s" : ""} en portefeuille, mais aucune n'a atteint le stade de la présentation.`
      : "Ce poste a été clos sans qu’aucun profil vous soit présenté."
    : total > 0
      ? `Nous travaillons dessus : ${total} candidature${total > 1 ? "s sont" : " est"} déjà dans notre pipeline. Nous les qualifions avant de vous les soumettre — vous les verrez apparaître ici au moment du send-out, et pas avant.`
      : "Le sourcing est en cours. Nous cherchons et qualifions les profils avant de vous les présenter : cet écran se remplira dès le premier send-out.";

  return (
    <Carte regime="travail" className="p-2">
      <EtatVide
        titre={titre}
        description={description}
        illustration={<FormeLignesEnRond />}
      />
    </Carte>
  );
}
