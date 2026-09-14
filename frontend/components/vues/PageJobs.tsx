"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Bouton } from "@/components/pacha/Bouton";
import { Pagination } from "@/components/pacha/Pagination";
import { CarteOffre } from "@/components/pacha/CarteOffre";
import { FondDecor } from "@/components/pacha/Decor";
import { EtatVide } from "@/components/pacha/EtatVide";
import {
  Forme4,
  FormeEtincelles,
  FormeS,
} from "@/components/pacha/Illustration";
import { Monogramme } from "@/components/pacha/Logo";
import { SelecteurMulti, SelecteurUnivers } from "@/components/pacha/Selecteur";
import { TagInfo, TagUnivers } from "@/components/pacha/Tag";
import { Titre } from "@/components/pacha/Titre";
import {
  FILTRES_VIDES,
  filtrer,
  formaterSalaire,
  optionsDepuis,
  repartir,
  teinteUnivers,
  type Filtres,
  type Offre,
} from "@/lib/domaine/offre";

/** Les options réellement proposées, un tableau par axe de filtre. */
type OptionsFiltres = Record<
  keyof Filtres,
  { valeur: string; libelle: string }[]
>;

/** Un critère coché, aplati sur les trois axes pour la rangée de tags. */
type ChoixFiltre = { axe: keyof Filtres; valeur: string };

/**
 * LA PAGE JOBS — le job board public.
 *
 * Portée du Figma « Job board ». Les trois règles annotées sur la maquette,
 * qui sont la seule logique de cette page :
 *
 *   1. « Les petits nouveaux » = les 3 offres les plus récentes, et la
 *      catégorie SUIT LES FILTRES : les trois plus récentes parmi celles qui
 *      respectent tous les critères cochés.
 *   2. « Tous les jobs (N) » montre le reste, et N les compte SANS ces trois.
 *   3. L'ordre va du plus récent au plus ancien.
 *
 * ── LA PAGINATION, ET CE QU'ELLE COÛTE ─────────────────────────────────────
 * La page servait sa requête SANS `.range()` : les douze offres publiées
 * aujourd'hui, et les cinq cents du jour où le cabinet publiera davantage,
 * toutes dans la charge utile RSC. Le serveur borne désormais la fenêtre et
 * passe ici `page`, `parPage` et `total`.
 *
 * ⚠ LES FILTRES RESTENT CÔTÉ CLIENT, DONC ILS NE PORTENT QUE SUR LA PAGE
 * AFFICHÉE. C'est la limite de ce lot, et elle est dite à l'écran dès qu'il y a
 * plus d'une page. La corriger demande de porter les trois axes de filtre dans
 * l'URL et de filtrer en SQL — un vrai chantier, qui change l'interaction (un
 * aller-retour serveur à chaque case cochée) et qui ne se justifie pas à douze
 * offres. Ce qui se justifiait, c'était de ne plus lire la table entière.
 *
 * ⚠ « LES PETITS NOUVEAUX » N'EXISTE QU'À LA PAGE 1. Les trois offres les plus
 * récentes de la page 2 ne sont pas les plus récentes du board : les appeler
 * ainsi serait faux. Au-delà de la première page, tout va dans « Tous les
 * jobs ».
 *
 * Deux écarts assumés entre la maquette et le composant réutilisé, tous deux
 * signalés dans docs/REPRISE.md :
 *
 *   · La carte est `CarteOffre`, portée du même Figma (:35146) — même anatomie,
 *     mêmes cotes, même badge d'exclusivité. Elle porte une largeur maximale de
 *     282px relevée sur un AUTRE écran ; ici l'annotation prescrit « responsive
 *     avec une largeur minimale de 300 px ». C'est la page qui pose la grille
 *     et lève la contrainte, le composant garde son défaut.
 *   · Les deux scribbles de section sont désignés, plus déduits : `forme-4`
 *     pour « Les petits nouveaux », `forme-s` pour « Tous les jobs ». Ils
 *     étaient provisoirement choisis pour leur sens — étincelles, flèche —
 *     faute de correspondance nommée entre les scribbles numérotés du Figma et
 *     le design system. La réserve est levée.
 */
export function PageJobs({
  offres,
  lienEspaceTalent,
  lienSiteWeb,
  page = 1,
  parPage,
  total,
  hote = 'public',
}: {
  offres: Offre[];
  lienEspaceTalent: string;
  lienSiteWeb: string;
  /**
   * OÙ CETTE LISTE EST RENDUE.
   *
   * `public` : le job board, servi à un visiteur. Il porte son titre, le
   * monogramme vers le site vitrine, et le bouton « Login ».
   *
   * `talent` : la même liste dans l'espace connecté. Le titre est déjà porté
   * par l'en-tête de l'écran, la barre latérale remplace le monogramme, et
   * « Login » n'a plus de sens — la personne est connectée.
   */
  hote?: 'public' | 'talent';
  /** La page servie, à partir de 1. */
  page?: number;
  /** La taille de la fenêtre. Absente ⇒ pas de pagination du tout. */
  parPage?: number;
  /** Le nombre total d'offres publiées, toutes pages confondues. */
  total?: number;
}) {
  const router = useRouter();
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_VIDES);

  // La fiche d'une offre vit sous la même racine que la liste : sinon un clic
  // depuis l'espace connecté renverrait sur la page publique, donc hors de la
  // coquille et de sa barre latérale.
  const base = hote === 'talent' ? '/talent/offres' : '/offres';

  // Les options viennent des offres publiées, jamais du référentiel : proposer
  // un filtre qui ne rend rien tend un piège au visiteur.
  const options = useMemo(
    () => ({
      univers: optionsDepuis(
        offres,
        (o) => o.universCode,
        (o) => o.univers,
      ),
      contrat: optionsDepuis(
        offres,
        (o) => o.contrat,
        (o) => o.contratLibelle,
      ),
      management: optionsDepuis(
        offres,
        (o) => o.management,
        (o) => o.managementLibelle,
      ),
    }),
    [offres],
  );

  const visibles = useMemo(() => filtrer(offres, filtres), [offres, filtres]);

  // `repartir` extrait les trois plus récentes — ce qui n'a de sens qu'à la
  // page 1. Au-delà, tout va dans « Tous les jobs ».
  const { nouveaux, autres } = useMemo(
    () => (page > 1 ? { nouveaux: [], autres: visibles } : repartir(visibles)),
    [visibles, page],
  );

  const pagine = Boolean(parPage && total && total > parPage);
  const filtreActif =
    filtres.univers.length + filtres.contrat.length + filtres.management.length > 0;

  const poser = (axe: keyof Filtres) => (valeurs: string[]) =>
    setFiltres((f) => ({ ...f, [axe]: valeurs }));
  const retirer = (axe: keyof Filtres, valeur: string) =>
    setFiltres((f) => ({ ...f, [axe]: f[axe].filter((v) => v !== valeur) }));

  return (
    // `Job board` — retrait 32px, gouttière 24px.
    //
    // `min-h-dvh` et non `min-h-full` : `min-height: 100%` exige un parent à
    // hauteur DÉFINIE, or ni <main> ni <body> n'en ont une. La règle ne
    // s'appliquait donc jamais et le conteneur faisait la hauteur de son
    // contenu — invisible tant que la page est longue, béant dès qu'elle est
    // filtrée à deux offres.
    //
    // Le fond est `--fond-page`, pas le #FFFEFA du Figma. Mesuré, l'écart avec
    // le crème de marque #fffcf4 est de 2 et 6 points sur deux canaux :
    // imperceptible. Introduire un troisième crème quasi identique aux deux
    // existants aurait été le début exact de la dérive qu'un design system
    // existe pour empêcher.
    //
    // Plus d'`overflow-hidden` : il servait à contenir les décors, qui portent
    // désormais le leur. Il ne faisait plus que risquer de rogner les ombres
    // rétro des cartes en bord de grille.
    // ⚠ EN MODE « talent », ON RETIRE TOUTE LA CHROME DE PAGE.
    // `min-h-dvh`, le fond, le rembourrage et le décor sont ceux d'une page
    // AUTONOME. Dans la coquille connectée, le cadre d'écran porte déjà tout
    // cela : les cumuler faisait déborder la grille par la gauche et rognait
    // le titre. Le décor part aussi — la coquille a le sien, et deux fonds
    // superposés ne se raccordent pas.
    <div
      className={
        hote === 'talent'
          ? 'relative isolate'
          : 'relative isolate min-h-dvh bg-[var(--fond-page)] p-4 md:p-8'
      }
    >
      {hote === 'public' && <FondDecor />}

      <div className="flex flex-col gap-6">
        <BarreHaute
          options={options}
          filtres={filtres}
          poser={poser}
          retirer={retirer}
          lienEspaceTalent={lienEspaceTalent}
          lienSiteWeb={lienSiteWeb}
          hote={hote}
        />

        {/* ── `Jobs` ───────────────────────────────────────────────────── */}
        {visibles.length === 0 ? (
          <EtatVide
            titre={
              filtreActif
                ? "Aucune offre ne correspond à ces filtres"
                : "Aucune offre sur cette page"
            }
            description={
              filtreActif
                ? "Retirez un critère pour élargir la recherche, ou découvrez toutes nos offres dans votre espace Pachamama."
                : "Revenez à la première page : cette adresse pointe au-delà de nos offres publiées."
            }
            illustration={
              <FormeEtincelles className="h-16 w-16 text-[var(--violet-300)]" />
            }
            action={
              page > 1 ? (
                <Bouton href="/offres" apparence="plein">
                  Revenir à la première page
                </Bouton>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-9">
            {nouveaux.length > 0 && (
              <SectionOffres base={base}
                titre="Les petits nouveaux"
                illustration={
                  <Forme4 className="h-6 w-6 text-[var(--violet-300)]" />
                }
                offres={nouveaux}
              />
            )}
            {autres.length > 0 && (
              <SectionOffres base={base}
                titre={`Tous les jobs (${autres.length})`}
                illustration={
                  <FormeS className="h-6 w-6 text-[var(--violet-300)]" />
                }
                offres={autres}
              />
            )}
          </div>
        )}

        {/* ── La pagination ────────────────────────────────────────────────
            Elle NAVIGUE, elle ne filtre pas : `router.push` change l'URL, le
            serveur relit sa fenêtre avec un nouveau `.range()`. Une pagination
            qui se contenterait de découper un tableau déjà chargé n'aurait rien
            réglé du problème qu'elle prétend résoudre.

            `scroll: false` : la barre de filtres est collée en haut et reste
            visible ; remonter la page en plus du changement de contenu ferait
            deux mouvements pour un seul geste. */}
        {pagine && (
          <div className="flex flex-col gap-2 pb-4">
            <Pagination
              total={total as number}
              page={page}
              taille={parPage as number}
              objets="offres"
              onPageChange={(p) => {
                router.push(p <= 1 ? "/offres" : `/offres?page=${p}`, { scroll: false });
              }}
            />
            {filtreActif && (
              <p className="t-caption text-[var(--encre-500)]">
                {/* ⚠ LA LIMITE, DITE PLUTÔT QUE CACHÉE. Les filtres travaillent
                    sur les offres de cette page, pas sur les {total} publiées :
                    tant qu'ils vivent dans l'état du composant et non dans
                    l'URL, ils ne peuvent pas atteindre le SQL. */}
                Vos filtres portent sur les offres de cette page. Retirez-les pour
                parcourir les {total} offres publiées.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Une section et sa grille ─────────────────────────────────────────────── */

function SectionOffres({
  titre,
  illustration,
  offres,
  base,
}: {
  /** La racine des liens de fiche : « /offres » ou « /talent/offres ». */
  base: string;
  titre: string;
  illustration: React.ReactNode;
  offres: Offre[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-0.5">
        {illustration}
        <h2 className="t-h3">{titre}</h2>
      </div>
      {/* « Sur desktop les cards doivent être responsive avec une largeur
          minimale de 300 px » — annotation de la maquette. La grille porte
          cette règle et lève les deux bornes que CarteOffre tient d'un autre
          écran du Figma (261px, puis 282px à partir de md).

          Les DEUX `max-w-none` sont nécessaires : `cn` passe par tailwind-merge,
          qui traite chaque variante comme un groupe distinct. `max-w-none` seul
          n'écrase que la borne sans variante ; `md:max-w-[282px]` survivait et
          les cartes restaient à 282px dans des cellules plus larges — c'est ce
          reliquat, et non `gap-6` (24px, la cote du Figma), qui faisait paraître
          l'espacement trop grand. */}
      {/* ⚠ LE GABARIT EST BORNÉ EN HAUT, ET C'EST CE QUI REND LES DEUX VUES
          IDENTIQUES. Avec `1fr`, une piste prend tout l'espace restant : la
          carte vaut donc « largeur du conteneur ÷ nombre de colonnes ». Or les
          deux conteneurs ne font pas la même largeur — l'espace talent a une
          barre latérale. Mesuré à 2000px de fenêtre : 303px de carte sur le
          board public, 322px dans l'espace. Le même composant, deux tailles.

          `minmax(300px, 320px)` fixe le haut : dès qu'il y a la place, une
          carte fait 320px des deux côtés. En dessous, elle se resserre jusqu'à
          300px plutôt que de casser la rangée — l'annotation de la maquette
          garde sa borne basse (« largeur minimale de 300px »).

          `justify-start` : le reliquat s'accumule à droite au lieu d'être
          réparti dans les gouttières.

          GOUTTIÈRE À 32px, et non les 24 du Figma : à cote égale, des cartes
          désormais bornées à 320px paraissaient plus serrées qu'en `1fr`, où
          elles s'écartaient d'elles-mêmes. Demande du commanditaire, et les
          deux grilles — réelle et squelette — la portent ensemble. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,320px))] justify-start gap-8">
        {offres.map((o) => (
          <CarteOffre
            key={o.id}
            className="max-w-none md:max-w-none"
            poste={o.intitule}
            client={o.entreprise ? { nom: o.entreprise } : null}
            contrat={o.contrat ?? undefined}
            salaire={formaterSalaire(o)}
            /* La ligne « Localisation » reste affichée même sans donnée :
               une carte à laquelle il manque une ligne se lit comme une carte
               d'un autre gabarit. `N/A` dit que le lieu n'est pas renseigné. */
            localisation={o.localisation ?? "N/A"}
            modeDeTravail={o.remoteLibelle ?? undefined}
            exclusivite={o.exclusivitePachamama}
            /* Le titre est de nouveau cliquable. Il ne l'était pas tant que
               /offres/[id] servait des fixtures indexées par slug : un uuid y
               donnait un 404, et un lien mort dessert plus qu'un titre inerte.
               La fiche lit désormais `api.offre_detail` par l'uuid du mandat. */
            href={`${base}/${o.id}`}
          />
        ))}
      </div>
    </section>
  );
}

/* ── La barre figée ───────────────────────────────────────────────────────── */

/**
 * BarreHaute — le titre, le descriptif et les filtres, collés en haut d'écran
 * pendant que le reste de la page défile dessous.
 *
 * Elle reste collée en haut, le reste de la page défile dessous.
 *
 * `-mx-6 -mt-6 … px-6 pt-6` : la barre annule le rembourrage de la
 * page puis le reprend à son compte. Sans cela, elle se figerait à
 * 24px du haut et on verrait les cartes défiler dans la bande laissée
 * libre au-dessus d'elle.
 *
 * PAS d'`overflow-hidden` ici, même s'il simplifierait le rognage du
 * décor : les menus des trois sélecteurs s'ouvrent vers le bas et en
 * sortent. Le décor porte déjà le sien.
 *
 * `z-20` la place au-dessus des cartes ; le conteneur de page étant en
 * `isolate`, cette valeur ne vaut que dans cette page.
 *
 * `will-change-transform` : la barre est géométriquement immobile —
 * mesurée à y=0 à 0, 400 et 902px de défilement, hauteur constante —
 * et pourtant on la voit bouger légèrement pendant le défilement. Ce
 * n'est donc pas la mise en page mais la composition : un élément
 * collant repeint dans la même couche que le contenu qui défile peut
 * accuser une image de retard. Cette déclaration lui donne sa propre
 * couche, ce qui supprime le décalage.
 *
 * Le fond crème est porté par la barre ELLE-MÊME et non par un calque
 * enfant : une couche de moins à faire suivre, et l'ordre de peinture
 * reste juste — le fond d'un contexte d'empilement se peint AVANT ses
 * enfants à z-index négatif, donc le décor passe bien par-dessus.
 *
 * Elle porte `choisis` et `libelleDe`, qui ne servent qu'ici : les garder dans
 * la page obligeait à les lui repasser en props sans qu'aucun autre appelant
 * n'en tire parti.
 */
function BarreHaute({
  options,
  filtres,
  poser,
  retirer,
  lienEspaceTalent,
  lienSiteWeb,
  hote,
}: {
  options: OptionsFiltres;
  filtres: Filtres;
  poser: (axe: keyof Filtres) => (valeurs: string[]) => void;
  retirer: (axe: keyof Filtres, valeur: string) => void;
  lienEspaceTalent: string;
  lienSiteWeb: string;
  hote: 'public' | 'talent';
}) {
  const libelleDe = (axe: keyof Filtres, valeur: string) =>
    options[axe].find((o) => o.valeur === valeur)?.libelle ?? valeur;

  const choisis: ChoixFiltre[] = [
    ...filtres.univers.map((v) => ({ axe: "univers" as const, valeur: v })),
    ...filtres.contrat.map((v) => ({ axe: "contrat" as const, valeur: v })),
    ...filtres.management.map((v) => ({
      axe: "management" as const,
      valeur: v,
    })),
  ];

  return (
    // Les marges négatives ANNULENT le rembourrage de la racine pour que la
    // bande colle aux bords : elles n'ont de sens que si ce rembourrage
    // existe. En mode « talent » il n'existe pas, et elles débordaient.
    //
    // Le `sticky top-0` tombe aussi : l'en-tête de la coquille est déjà collé
    // en haut (z-30), deux barres collantes se chevauchaient.
    <div
      className={
        hote === 'talent'
          ? 'relative flex flex-col gap-6'
          : 'sticky top-0 z-20 -mx-4 -mt-4 flex flex-col gap-6 bg-[var(--fond-page)] px-4 pt-4 pb-4 will-change-transform md:-mx-8 md:-mt-8 md:px-8 md:pt-8 md:pb-6'
      }
    >
      {/* Sa part de décor : sans elle la bande crème serait tranchée net
          sous le titre. Les deux copies se raccordent d'elles-mêmes, sans
          calage à faire — voir `ancrage` dans Decor.tsx. */}
      {hote === 'public' && <FondDecor ancrage="conteneur" />}

      {/* ── `Page title` ─────────────────────────────────────────────── */}
      {/* Dans l'espace talent, l'en-tête d'écran porte déjà le titre et la
          barre latérale porte déjà l'identité : ce bandeau ferait doublon. */}
      {hote === 'public' && (
      <header className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Titre
            niveau={1}
            disposition="ligne"
            descriptif="Les jobs"
            impact="Pachamama"
          />
          <p className="t-body-hl text-[var(--encre-500)]">
            Un avant-goût de toutes nos offres exclusives à découvrir dans ton
            espace Pachamama&nbsp;😎
          </p>
        </div>
        {/* Le monogramme renvoie au site vitrine — annoté sur la maquette.
            IL S'OUVRE DANS UN NOUVEL ONGLET : c'est le seul lien de la page qui
            quitte l'application, et un visiteur en pleine recherche ne doit pas
            perdre ses filtres pour être allé voir qui est Pachamama.

            `rel="noopener noreferrer"` accompagne obligatoirement `_blank` : le
            premier empêche la page ouverte d'accéder à `window.opener` et donc
            de rediriger celle-ci à notre insu, le second lui cache l'adresse
            d'où vient le visiteur.

            La destination est ANNONCÉE aux lecteurs d'écran. Un lien qui ouvre
            un onglet sans le dire désoriente : le retour arrière ne fait plus
            rien, sans que rien n'explique pourquoi. */}
        <a
          href={lienSiteWeb}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-[var(--r-xs)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        >
          <Monogramme className="h-8 w-8" />
          <span className="sr-only">Le site Pachamama (nouvel onglet)</span>
        </a>
      </header>
      )}

      {/* ── `Filters` ────────────────────────────────────────────────── */}
      <div className="flex flex-col items-start gap-6 md:flex-row md:justify-between">
        <div className="flex w-full flex-col gap-2 md:w-auto">
          {/* EN MOBILE LA RANGÉE DÉFILE, elle ne se replie pas. Le Figma la
              donne à 363px de large dans un cadre de 320 (Job_board_mobile.md,
              « Filters ») : le débordement est voulu, et l'annotation de la
              maquette le confirme — « possibilité de scroll horizontal sur les
              filtres ». Un `flex-wrap` aurait empilé trois lignes et repoussé
              les offres sous la ligne de flottaison.

              `-mx-4 px-4` fait déborder la zone défilante jusqu'aux bords de
              l'écran tout en gardant la gouttière : sans cela le dernier filtre
              s'arrêtait à 16px du bord, ce qui se lit comme une fin de liste
              alors qu'il en reste.

              Le rognage est sans risque pour les menus : `Selecteur` porte son
              popup dans un `Select.Portal` (Selecteur.tsx:648), donc hors de
              cette boîte.

              Les largeurs fixes ne valent qu'à partir de `md` — « adaptation de
              la taille des filtres si possible », dit l'annotation : en mobile
              chaque filtre prend la largeur de son libellé. */}
          <div
            className={
              hote === 'talent'
                ? 'flex items-center gap-2 overflow-x-auto pb-1 md:flex-wrap md:gap-x-4 md:gap-y-2 md:overflow-x-visible md:pb-0'
                : '-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:gap-x-4 md:gap-y-2 md:overflow-x-visible md:px-0 md:pb-0'
            }
          >
            <SelecteurUnivers
              substitut="Univers"
              className="w-auto shrink-0 md:w-[205px]"
              options={options.univers.map((o) => ({
                valeur: teinteUnivers(o.valeur),
                libelle: o.libelle,
              }))}
              valeurs={filtres.univers.map(teinteUnivers)}
              teinteTags={filtres.univers.length > 0}
              onChangement={(t) =>
                poser("univers")(
                  options.univers
                    .filter((o) => t.includes(teinteUnivers(o.valeur)))
                    .map((o) => o.valeur),
                )
              }
            />
            <SelecteurMulti
              substitut="Type de contrat"
              className="w-auto shrink-0 md:w-[191px]"
              options={options.contrat}
              valeurs={filtres.contrat}
              teinteTags={filtres.contrat.length > 0}
              onChangement={poser("contrat")}
            />
            <SelecteurMulti
              substitut="Management"
              className="w-auto shrink-0 md:w-[217px]"
              options={options.management}
              valeurs={filtres.management}
              teinteTags={filtres.management.length > 0}
              onChangement={poser("management")}
            />
          </div>

          <TagsChoisis
            choisis={choisis}
            libelleDe={libelleDe}
            retirer={retirer}
          />
        </div>

        {/* Une navigation : donc un lien, pas un bouton qui déplace la page
          en JavaScript. Annoté sur la maquette — « Redirection vers
          l'espace Talent » : la destination ne bouge pas, seul le libellé
          change. La largeur de 176px est la cote du Figma et tient la
          rangée ; elle est conservée bien que « Login » soit court. */}
        {/* « Login » n'a pas de sens pour quelqu'un qui est déjà connecté. */}
        {hote === 'public' && (
          <Bouton
            href={lienEspaceTalent}
            className="w-full shrink-0 md:w-[176px]"
          >
            Login
          </Bouton>
        )}
      </div>
    </div>
  );
}

/* ── Les critères cochés, retirables un par un ────────────────────────────── */

/**
 * TagsChoisis — `Filter tags` sur la maquette.
 *
 * LA GARDE DU VIDE EST ICI, et pas chez l'appelant. Portée par le parent, elle
 * disparaissait à la première extraction : le composant rendait alors un
 * conteneur `flex` vide, invisible mais porteur du `gap-2` de sa colonne, ce
 * qui décalait la barre de deux pixels tant qu'aucun filtre n'était coché.
 *
 * L'univers prend un `TagUnivers`, qui sait se retirer lui-même. Les deux
 * autres axes prennent un `TagInfo`, qui ne le sait pas : d'où la croix
 * réécrite ici. C'est une duplication assumée et non un oubli — doter `TagInfo`
 * d'un `onRetirer` est une modification du design system, qui touche tous ses
 * appelants et n'a pas sa place dans un rangement à comportement constant.
 */
function TagsChoisis({
  choisis,
  libelleDe,
  retirer,
}: {
  choisis: ChoixFiltre[];
  libelleDe: (axe: keyof Filtres, valeur: string) => string;
  retirer: (axe: keyof Filtres, valeur: string) => void;
}) {
  if (choisis.length === 0) return null;

  return (
    <div className="flex flex-wrap items-start gap-2">
      {choisis.map(({ axe, valeur }) =>
        axe === "univers" ? (
          <TagUnivers
            key={`${axe}-${valeur}`}
            univers={teinteUnivers(valeur)}
            onRetirer={() => retirer(axe, valeur)}
          >
            {libelleDe(axe, valeur)}
          </TagUnivers>
        ) : (
          <TagInfo key={`${axe}-${valeur}`} regime="accroche">
            <span className="flex items-center gap-1">
              {libelleDe(axe, valeur)}
              <button
                type="button"
                onClick={() => retirer(axe, valeur)}
                className="rounded-full leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              >
                <span aria-hidden>✕</span>
                <span className="sr-only">
                  Retirer le filtre {libelleDe(axe, valeur)}
                </span>
              </button>
            </span>
          </TagInfo>
        ),
      )}
    </div>
  );
}
