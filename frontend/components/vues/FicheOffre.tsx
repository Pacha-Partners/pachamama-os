import { CloudLightning, Sun } from "lucide-react";
import { Bouton } from "@/components/pacha/Bouton";
import { Carte } from "@/components/pacha/Carte";
import {
  ExcluPachamama,
  LogoOffre,
  NomEntreprise,
} from "@/components/pacha/CarteOffre";
import { FondDecor } from "@/components/pacha/Decor";
import { Divider } from "@/components/pacha/Divider";
import { Icone } from "@/components/pacha/Icone";
import { LogoComplet, Monogramme } from "@/components/pacha/Logo";
import { PastillePourcentage } from "@/components/pacha/PastillePourcentage";
import { TagContrat, TagInfo } from "@/components/pacha/Tag";
// Depuis `univers.ts` et NON `Tag.tsx` : ce dernier est un composant client,
// et un composant serveur qui importe une valeur d'un module client reçoit une
// référence, pas l'objet. Mesuré — la carte restait blanche, sans erreur.
import {
  fondsAgentUnivers,
  fondsEncartUnivers,
  formesAgentUnivers,
  titresUnivers,
} from "@/components/pacha/univers";
import { Titre } from "@/components/pacha/Titre";
import {
  idVideoYoutube,
  listeDe,
  scorecardDe,
  teinteAgent,
  type Fiche,
} from "@/lib/domaine/fiche";
import { formaterSalaire } from "@/lib/domaine/offre";
import { cn } from "@/lib/utils";

/**
 * LA FICHE D'UNE OFFRE — `Job detailed view` du Figma.
 *
 * LA RÈGLE QUI GOUVERNE TOUTE LA PAGE, annotée sur la maquette : « dès qu'il
 * manque une information, le bloc DISPARAÎT ; on ne doit pas voir de vide ».
 *
 * Ce n'est pas ici un cas limite mais le régime normal. Mesuré sur les douze
 * offres publiées : le processus de recrutement est renseigné 12 fois, les deux
 * listes de la review 10 et 9, les missions 3, la rémunération 1, la vidéo et
 * les cinq pourcentages jamais. Une fiche se construit donc en partant du vide,
 * pas en masquant après coup — chaque bloc rend `null` plutôt que de s'afficher
 * creux, et la colonne de droite disparaît entière si ses deux cartes sont
 * vides, la colonne principale reprenant alors toute la largeur.
 *
 * L'ANONYMAT EST DÉJÀ TRANCHÉ QUAND LA DONNÉE ARRIVE. `api.offre_detail` ne
 * construit pas les champs qui identifient le client sur une offre anonyme :
 * ce composant n'a aucune décision de sécurité à reprendre, et il ne doit pas
 * en reprendre — un filtrage écrit ici ne protégerait rien, la vue étant
 * interrogeable directement au réseau.
 */
export function FicheOffre({
  fiche,
  actionCandidature,
  hote = 'public',
  retourHref = '/offres',
}: {
  fiche: Fiche;
  /**
   * OÙ CETTE FICHE EST RENDUE.
   *
   * `public` : la page indexée, qui occupe l'écran — elle porte son fond, son
   * rembourrage, son décor et le monogramme vers le site vitrine.
   *
   * `talent` : la même fiche dans la coquille connectée, qui porte déjà tout
   * cela. Les cumuler faisait déborder la mise en page.
   */
  hote?: 'public' | 'talent';
  /** Où mène « Retour ». La liste d'où l'on vient, pas toujours le job board. */
  retourHref?: string;
  /**
   * CE QUI REMPLACE LE BOUTON « POSTULER », quand la page sait qui regarde.
   *
   * ⚠ POURQUOI UN EMPLACEMENT PLUTÔT QU'UNE PROP `estConnecte`.
   * Ce composant est rendu par une route PUBLIQUE et il ne doit rien savoir de
   * la session : lui passer un booléen l'obligerait à choisir entre trois
   * comportements (visiteur, talent qui peut postuler, talent qui a déjà
   * postulé) et donc à porter une logique de portail dans un composant de
   * vitrine. C'est la page qui sait, et qui donne le contrôle tout fait.
   *
   * Absent, on retombe sur le lien de connexion — le comportement du J1, avec
   * son adresse corrigée.
   *
   * Le nœud est rendu DEUX FOIS sur desktop (l'en-tête et le bloc processus),
   * comme l'était `BoutonCandidature` : ce sont deux instances indépendantes,
   * et c'est voulu — la maquette montre deux points d'entrée, et une seule
   * instance partagée forcerait à choisir lequel des deux garder.
   */
  actionCandidature?: React.ReactNode;
}) {
  const colonneDroite =
    (fiche.agentNom && fiche.agentPhoto) ||
    fiche.estAnonyme ||
    fiche.entreprise;

  return (
    <div
      className={
        hote === 'talent'
          ? 'relative isolate'
          : 'relative isolate min-h-dvh bg-[var(--fond-page)] p-4 md:p-8'
      }
    >
      {hote === 'public' && <FondDecor />}

      {/* Gouttière de pile : 16 sur mobile (racine du Job_board_détails_mobile,
          `gap: 16px`), 24 sur desktop (`Frame 108`, Job_board_détails.md:287). */}
      <div className="flex flex-col gap-4 lg:gap-6">
        <header className="flex items-start justify-between gap-4">
          {/* `Retour` — un lien, pas un `history.back()` : la fiche est
              indexable et peut donc être ouverte sans page précédente. */}
          <Bouton href={retourHref} apparence="contour">
            Retour
          </Bouton>
          {/* Le monogramme quitte l'application : il n'a pas sa place dans la
              coquille connectée, qui porte déjà la marque en haut à gauche. */}
          {hote === 'public' && (
          <a
            href="https://www.pachamama-collective.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-[var(--r-xs)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            {/* La maquette mobile ouvre la page sur le logo COMPLET, 176 × 32
                (Job_board_détails_mobile.md — `Pachamama full logo`) ; le
                desktop garde le monogramme. Même lien, deux dessins. */}
            <LogoComplet className="h-8 w-auto md:hidden" />
            <Monogramme className="hidden h-8 w-8 md:block" />
            <span className="sr-only">Le site Pachamama (nouvel onglet)</span>
          </a>
          )}
        </header>

        <div
          className={cn(
            "grid items-start gap-4 lg:gap-6",
            colonneDroite && "lg:grid-cols-[minmax(0,1fr)_340px]",
          )}
        >
          <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
            <EnTeteOffre fiche={fiche} actionCandidature={actionCandidature} />
            <BlocMissions fiche={fiche} />
            <BlocReview fiche={fiche} />
            <BlocProcessus fiche={fiche} actionCandidature={actionCandidature} />
          </div>

          {colonneDroite && (
            /* `Other infos` (mobile) : gouttière 21px, et l'entreprise AVANT
               l'agent — l'ordre s'inverse par rapport à la colonne de droite du
               desktop, d'où les `order` plutôt qu'un second rendu. */
            <aside className="flex flex-col gap-[21px] lg:gap-6">
              <CarteAgent fiche={fiche} className="order-2 lg:order-1" />
              <CarteEntreprise fiche={fiche} className="order-1 lg:order-2" />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── L'en-tête : la carte d'offre enrichie ────────────────────────────────── */

/**
 * `Job card` du Figma (:1898). C'est la carte du job board augmentée du logo,
 * des mots-clés et du bouton d'action — pas `CarteOffre`, dont les deux
 * gabarits sont calibrés pour une grille et une liste, jamais pour une page.
 * La réutiliser aurait demandé un troisième gabarit à une prop près, et cette
 * prop aurait servi une seule fois.
 */
function EnTeteOffre({
  fiche,
  actionCandidature,
}: {
  fiche: Fiche;
  actionCandidature?: React.ReactNode;
}) {
  // `formaterSalaire` ne lit que ces cinq champs : elle les prend désormais en
  // type structurel plutôt qu'une `Offre` entière, ce qui évite un cast ici et
  // garantit que la fiche affiche EXACTEMENT le même libellé que la carte.
  const salaire = formaterSalaire(fiche);

  return (
    // `Job card` : filet 2px noir, rayon 8, rembourrage 24/16/16,
    // gouttière 16 — et AUCUNE ombre (Job_board_détails.md:1898).
    <Carte regime="contour" className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          {/* Le logo du client, ou `LogoRond` si l'offre est anonyme :
              `LogoOffre` porte déjà les deux cas.

              MASQUÉ SOUS `md`. La maquette desktop porte un logo de 97 × 92
              dans la carte (`Logo entreprise`, Job_board_détails.md:294) ;
              la maquette mobile n'en porte aucun — vérifié sur l'intégralité
              du bloc `Job card` des deux exports. J'avais écrit l'inverse. */}
          <LogoOffre
            client={
              fiche.entreprise
                ? {
                    nom: fiche.entreprise,
                    logoUrl: fiche.entrepriseLogo ?? undefined,
                  }
                : null
            }
            className="hidden md:block"
          />
          <div className="flex min-w-0 flex-col items-start gap-2">
            {/* `NomEntreprise` du design system : c'est lui qui sait écrire
                « Entreprise anonyme », monogramme compris, dans la typographie
                du Figma. Je l'avais réécrit en `t-caption-hl uppercase`. */}
            <NomEntreprise
              client={fiche.entreprise ? { nom: fiche.entreprise } : null}
              avecMonogramme={false}
            />
            <h1 className="t-h2">{fiche.intitule}</h1>
            {fiche.contrat && <TagContrat contrat={fiche.contrat} focus />}
          </div>
        </div>
        {/* `ExcluPachamama` du design system, relevé au Figma:35936 — pastille
            crème, filet #FFE9A8, sans ombre. La maquette de la fiche le place
            AILLEURS, elle ne le redessine pas.

            Et elle ne le place pas au même endroit selon la largeur : en haut
            à droite dans `Job key info` sur desktop, en BAS de la carte après
            un troisième séparateur sur mobile. Deux emplacements réellement
            distincts, d'où deux rendus dont un seul est affiché. */}
        {fiche.exclusivitePachamama && (
          <ExcluPachamama className="hidden shrink-0 md:inline-flex" />
        )}
      </div>

      <Divider />

      {/* `Frame 1321314384` (:2306) — rangée en `space-between` et surtout en
          `align-items: center`, hauteur 77. C'est ce centrage qui place les
          mots-clés au niveau de la ligne « Localisation », et non en haut : le
          bloc `Keywords` fait lui aussi 77px de haut (:2832), centré.
          Je les avais empilés avec le bouton dans une même colonne alignée en
          haut, d'où des tags à hauteur de « Salaire ». */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <dl className="flex flex-col gap-4">
          <InfoLigne emoji="💸" libelle="Salaire" valeur={salaire} />
          <InfoLigne
            emoji="📍"
            libelle="Localisation"
            valeur={fiche.localisation ?? "N/A"}
          />
          <InfoLigne emoji="🖥️" libelle="Remote" valeur={fiche.remoteLibelle} />
        </dl>

        {fiche.tags && fiche.tags.length > 0 && (
          <>
            {/* Empilés, les deux blocs sont séparés d'un filet ; côte à côte,
                non. Le séparateur disparaît au passage en rangée. */}
            <Divider className="md:hidden" />

            {/* `Keywords` (:2832) : rangée qui passe à la ligne, alignée à
                droite, gouttière 11px. */}
            <ul className="flex flex-wrap items-center gap-[11px] md:justify-end">
              {fiche.tags.map((t) => (
                <li key={t}>
                  <TagInfo regime="accroche">{t}</TagInfo>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Le bouton est une rangée À PART, sous la précédente et alignée à
          droite — il ne partage pas la colonne des mots-clés.

          Il est MASQUÉ sur mobile : la maquette mobile ne porte qu'un seul
          « Postuler », celui du bloc « Processus de recrutement ». Le desktop
          en montre deux, un par bloc. */}
      <div className="hidden md:flex md:justify-end">
        {actionCandidature ?? <BoutonCandidature fiche={fiche} />}
      </div>

      {/* La place mobile du badge : en bas, précédé de son propre séparateur. */}
      {fiche.exclusivitePachamama && (
        <>
          <Divider className="md:hidden" />
          <ExcluPachamama className="self-start md:hidden" />
        </>
      )}
    </Carte>
  );
}

/** `Job admin info` — une ligne emoji / libellé / valeur. */
function InfoLigne({
  emoji,
  libelle,
  valeur,
}: {
  emoji: string;
  libelle: string;
  valeur?: string | null;
}) {
  if (!valeur) return null;
  return (
    <div className="flex items-baseline gap-4">
      <dt className="t-body flex items-center gap-1 text-[var(--encre-500)]">
        <span aria-hidden>{emoji}</span>
        {libelle}
      </dt>
      <dd className="t-body-bold">{valeur}</dd>
    </div>
  );
}

/**
 * L'action de la page, et la SEULE. Son libellé change avec l'anonymat :
 * « Postuler » quand le client est nommé, « Je suis intéressé.e » sinon —
 * on ne postule pas à une entreprise qu'on ne connaît pas encore.
 *
 * Ce bouton ne disparaît JAMAIS, quelle que soit la donnée manquante. La règle
 * du bloc absent vaut pour l'information, pas pour l'action : une fiche sans
 * moyen de se manifester n'aurait plus d'objet.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ SON LIEN MENAIT À UNE IMPASSE, ET C'EST RÉPARÉ
 * ─────────────────────────────────────────────────────────────────────────
 * Il envoyait sur `/connexion?offre=<uuid>`, et `app/connexion/page.tsx`
 * faisait `redirect('/login')` **en perdant la requête** : après connexion, on
 * atterrissait sur son espace, sans l'offre, sans rien pour dire qu'on avait
 * voulu postuler. Le paramètre était écrit ici, lu par personne, et jeté par
 * une redirection de trois lignes.
 *
 * `/connexion` traduit désormais `?offre=` en `?suite=`, et `/login` sait
 * revenir. On garde `/connexion?offre=` plutôt que d'écrire `?suite=`
 * directement : c'est l'adresse que le reste du site partage déjà, et une
 * seule des deux notions doit vivre dans les composants de vitrine.
 */
function BoutonCandidature({ fiche }: { fiche: Fiche }) {
  return (
    <Bouton
      apparence="plein"
      href={`/connexion?offre=${encodeURIComponent(fiche.id)}`}
      iconeAvant={<Icone nom="icon-send" className="size-4" />}
      className="shrink-0"
    >
      Postuler
    </Bouton>
  );
}

/* ── Les missions et la répartition du poste ──────────────────────────────── */

function BlocMissions({ fiche }: { fiche: Fiche }) {
  const missions = listeDe(fiche.missions);
  const scorecard = scorecardDe(fiche);
  if (missions.length === 0 && !scorecard) return null;

  return (
    // `Job missions` (:3072) : filet 2px noir, rayon 12, rembourrage 24/16/16,
    // gouttière 16 — sans ombre, comme tous les blocs de la fiche.
    <Carte
      regime="contour"
      className="flex flex-col gap-4 rounded-[var(--r-ml)] px-4 pt-6 pb-4"
    >
      <Titre
        niveau={2}
        disposition="ligne"
        descriptif="Missions"
        impact="du job"
      />
      {missions.length > 0 && <ListePuces elements={missions} />}
      {scorecard && (
        // `Mission %` — rangée centrée qui passe à la ligne : cinq disques de
        // 66px ne tiennent pas sur 320px, et les comprimer les rendrait
        // illisibles. La maquette mobile les répartit en 3 + 2 avec une
        // gouttière de 16px (`Percentage block`, gap 16) ; le desktop tient sur
        // une rangée à 24px (:3396).
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
          {scorecard.map((a) => (
            <PastillePourcentage
              key={a.libelle}
              libelle={a.libelle}
              pourcentage={a.pourcentage}
            />
          ))}
        </div>
      )}
    </Carte>
  );
}

/* ── La review Pachamama, sur fond noir ───────────────────────────────────── */

/**
 * `Pachamama review` (:3971) : fond noir, filet noir de 2px, rayon 12px.
 *
 * Le rayon de 12px est le jeton `--r-ml`, ajouté après relevé : il revient cinq
 * fois dans l'export desktop et cinq fois dans le mobile, sur les mêmes blocs.
 * Arrondir à 16 changerait la silhouette du seul bloc sombre de l'application.
 */
function BlocReview({ fiche }: { fiche: Fiche }) {
  const video = idVideoYoutube(fiche.videoYoutube);
  const pourToi = listeDe(fiche.pourToi);
  const pasPourToi = listeDe(fiche.pasPourToi);
  if (!video && pourToi.length === 0 && pasPourToi.length === 0) return null;

  return (
    <section className="flex flex-col gap-4 rounded-[var(--r-ml)] border-2 border-black bg-black px-4 pt-6 pb-4 text-white">
      {/* `inverse` et non `className="text-white"` : les deux `<span>` du titre
          portent leur propre couleur, que le parent ne traverse pas. Le titre
          était donc noir sur noir — invisible, alors qu'il est bien au Figma
          (:3996, les deux spans en #FFFFFF). */}
      <Titre
        niveau={2}
        disposition="ligne"
        descriptif="La review"
        impact="Pachamama"
        ton="inverse"
      />
      {video && (
        <div className="overflow-hidden rounded-[var(--r-md)]">
          {/* L'identifiant est extrait et validé par le domaine : on ne place
              jamais dans `src` une URL venue de la base telle quelle. */}
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video}`}
            title={`La review Pachamama — ${fiche.intitule}`}
            allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="aspect-video w-full border-0"
          />
        </div>
      )}
      <BlocSombre
        icone={Sun}
        titre="Cette offre est faite pour toi si :"
        elements={pourToi}
      />
      <BlocSombre
        icone={CloudLightning}
        titre="Ça ne marchera pas si :"
        elements={pasPourToi}
      />
    </section>
  );
}

/**
 * Un encart de la review. Cotes relevées (:4460 et :4700) : fond `#16191D`,
 * rayon 16, rembourrage 16, gouttière 16, et AUCUN filet — j'en avais mis un.
 *
 * LES ICÔNES SONT NOMMÉES DANS LE FIGMA : `sun` et `cloud-lightning`, 24×24,
 * trait de 2px en `#AB8AFF`. Ce sont les noms de `lucide-react`, la
 * bibliothèque déjà employée par le design system. J'avais mis deux emojis, qui
 * ne portent ni la bonne forme, ni la bonne couleur, ni la bonne épaisseur.
 */
function BlocSombre({
  icone: Icone,
  titre,
  elements,
}: {
  icone: typeof Sun;
  titre: string;
  elements: string[];
}) {
  if (elements.length === 0) return null;
  return (
    <div className="flex flex-col gap-4 rounded-[var(--r-lg)] bg-[var(--grey-900)] p-4">
      <p className="t-titre-hl flex items-center gap-2.5 text-white">
        <Icone
          aria-hidden
          className="size-6 shrink-0 text-[var(--violet-300)]"
          strokeWidth={2}
        />
        {titre}
      </p>
      <ListePuces elements={elements} className="text-white" />
    </div>
  );
}

/* ── Le processus de recrutement ──────────────────────────────────────────── */

function BlocProcessus({
  fiche,
  actionCandidature,
}: {
  fiche: Fiche;
  actionCandidature?: React.ReactNode;
}) {
  const etapes = listeDe(fiche.processRecrutement);
  if (etapes.length === 0) return null;

  return (
    // `Recruitement process` (:5426) — mêmes cotes que les missions.
    <Carte
      regime="contour"
      className="flex flex-col gap-4 rounded-[var(--r-ml)] px-4 pt-6 pb-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Titre
          niveau={2}
          disposition="ligne"
          descriptif="Processus"
          impact="de recrutement"
        />
        {actionCandidature ?? <BoutonCandidature fiche={fiche} />}
      </div>
      {/* Une liste NUMÉROTÉE : les étapes d'un processus ont un ordre, et
          l'annoncer est le rôle de la balise, pas d'un chiffre écrit à la main. */}
      <ol className="flex list-decimal flex-col gap-2 pl-5">
        {etapes.map((e, i) => (
          <li key={`${i}-${e}`} className="t-body">
            {e}
          </li>
        ))}
      </ol>
    </Carte>
  );
}

/* ── La colonne de droite ─────────────────────────────────────────────────── */

/**
 * `Pachamama agent` (:1698) — la carte de la personne Pachamama qui suit le
 * mandat.
 *
 * BÂTIE À LA COTE DU FIGMA et non approchée : 291 × 240, rembourrage 8,
 * gouttière 10, colonne centrée, filet 1,5px, rayon 12, `isolation: isolate`.
 * Ses seuls enfants sont, dans l'ordre du calque : la forme décorative
 * `Ellipse 3`, le titre, et le nom.
 *
 * LA PHOTO EST BIEN DANS LA MAQUETTE, et j'avais écrit le contraire. Sur
 * desktop, Figma l'exporte en calque ABSOLU DÉTACHÉ du sous-arbre de la carte
 * (`left: 1026px; top: 136px`, soit 79px et 52px depuis les 947/84 de la carte)
 * : elle n'apparaît donc pas parmi ses enfants, et j'avais conclu trop vite.
 * L'export mobile, lui, la porte comme dernier enfant en flux — même cote,
 * 135 × 136, rayon 8. Les deux disent la même chose.
 *
 * Elle est posée dans le FLUX plutôt qu'en absolu : rembourrage 8 + titre 31 +
 * gouttière 10 la placent à 49px du haut, contre 52 relevés sur le desktop. La
 * colonne centrée reproduit aussi le centrage horizontal (291-135)/2 = 78,
 * pour 79 mesurés. Reproduire la règle vaut mieux que recopier deux offsets.
 *
 * Le titre est en NOIR sur ses deux moitiés (:1759 et :1780), contrairement à
 * celui de la carte entreprise. Le fond et la forme, eux, suivent l'univers.
 *
 * La carte reste visible sur une offre anonyme : c'est une personne de
 * Pachamama, pas du client. Elle ne réidentifie personne.
 */
function CarteAgent({
  fiche,
  className,
}: {
  fiche: Fiche;
  className?: string;
}) {
  if (!fiche.agentNom) return null;
  const teinte = teinteAgent(fiche);

  return (
    // `overflow-hidden` est indispensable : la forme décorative fait 409 × 472
    // et sort de la carte de tous les côtés — c'est le cadre qui la découpe.
    //
    // La HAUTEUR EST FIXE à 240px parce que le nom est posé en absolu à 202px
    // du haut dans le Figma. Les deux vont ensemble : à hauteur libre, cette
    // cote deviendrait arbitraire. La largeur reste fluide — notre colonne fait
    // 340px contre 291 au Figma.
    <Carte
      regime="contour"
      className={cn(
        "relative isolate flex h-[240px] flex-col items-center gap-2.5",
        "overflow-hidden rounded-[var(--r-ml)] border-[1.5px] p-2",
        fondsAgentUnivers[teinte],
        className,
      )}
    >
      {/* `Ellipse 3` — 409 × 472 à (-129 ; 24,52), pivotée de -150°. Purement
          décorative, donc masquée aux lecteurs d'écran. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -z-10 h-[472px] w-[409px] rounded-full",
          formesAgentUnivers[teinte],
        )}
        style={{ left: "-129px", top: "24.52px", transform: "rotate(-150deg)" }}
      />

      {/* `Title` — rangée alignée en BAS, gouttière 4px. */}
      <Titre
        niveau={2}
        disposition="ligne"
        descriptif="Agent.e"
        impact="Pachamama"
        className="relative z-10 items-end justify-center gap-1"
      />

      {/* La photo de la personne : 135 × 136, rayon 8, dernier enfant en flux.
          `object-cover` parce que la boîte est presque carrée alors que les
          photos du CDN Bubble ne le sont pas — sans lui, elles s'écrasent.

          Le fond `--encre-100` tient lieu de repli : si l'image ne charge pas,
          le lecteur voit un emplacement vide plutôt que l'icône d'image cassée
          du navigateur, et la carte ne bouge pas d'un pixel puisque la boîte
          garde sa cote. `alt` vide : le nom est juste en dessous, le doubler
          ferait entendre la même chose deux fois. */}
      {fiche.agentPhoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fiche.agentPhoto}
          alt=""
          width={135}
          height={136}
          className="relative z-10 h-[136px] w-[135px] shrink-0 rounded-[var(--r-md)] bg-[var(--encre-100)] object-cover"
        />
      )}

      {/* `Agent name` — en ABSOLU à 202px du haut, pleine largeur, centré,
          Body/Highlight (:1802). Le Figma le détache du flux, et la pile le
          rejoint sans le toucher : 8 de rembourrage + 31 de titre (l'interligne
          de `t-h2-comp`, la plus haute des deux moitiés) + 10 de gouttière +
          136 de photo = 185, pour un nom qui commence à 202. Dix-sept pixels de
          dégagement, et une carte qui reste à sa hauteur fixe. */}
      <p className="t-body-hl absolute inset-x-0 top-[202px] z-10 text-center">
        {fiche.agentNom}
      </p>
    </Carte>
  );
}

/**
 * `L'entreprise` (:100). Deux régimes, et c'est la vue qui a déjà tranché :
 * sur une offre anonyme les champs d'identification valent `null`, il ne reste
 * que la promesse et la politique de télétravail — laquelle est portée par le
 * MANDAT et non par l'entreprise, donc sans risque.
 */
function CarteEntreprise({
  fiche,
  className,
}: {
  fiche: Fiche;
  className?: string;
}) {
  const ambition = listeDe(fiche.entrepriseAmbition);
  // Les intitulés de section prennent la couleur de l'univers du job.
  const couleurTitre = titresUnivers[teinteAgent(fiche)];

  const contexte: [string, string | null][] = [
    ["Localisation", fiche.entrepriseLocalisation],
    ["Fondateur", fiche.entrepriseFondateur],
    ["Série", fiche.entrepriseSerie],
    ["Produit", fiche.entrepriseProduit],
    ["Salariés", fiche.entrepriseSalaries?.toString() ?? null],
    ["Équipe Tech & Product", fiche.entrepriseEquipeTech?.toString() ?? null],
    ["Site internet", fiche.entrepriseSite],
  ];

  return (
    // `Company info` (:36) : filet de 1,5px, rayon 12, rembourrage 24/16,
    // gouttière 16, sans ombre.
    <Carte
      regime="contour"
      className={cn(
        "flex flex-col gap-4 rounded-[var(--r-ml)] border-[1.5px] px-4 py-6",
        className,
      )}
    >
      {/* `discret` : le Figma met la ligne serif en #5D6979 et le nom en noir
          (:100 et :121).

          Le nom garde SA CASSE D'ORIGINE ici, contrairement à l'en-tête de la
          fiche : la maquette écrit « COCKPIT » en tête et « Kelvin » dans cette
          carte. Les majuscules ne valent donc que pour `NomEntreprise`. */}
      <Titre
        niveau={2}
        disposition="colonne"
        descriptif="L’entreprise"
        impact={fiche.entreprise ?? ""}
        ton="discret"
        className="items-center text-center"
      />

      {fiche.estAnonyme ? (
        // Texte repris MOT POUR MOT du Figma, sur décision du commanditaire.
        // Réserve consignée : il affirme que l'anonymat vient de l'exclusivité,
        // alors que la condition d'affichage est `est_anonyme` seul — mesuré,
        // 5 des 12 offres anonymes ne sont pas exclusives.
        <p
          className={cn(
            "t-body rounded-[var(--r-md)] p-3",
            // La teinte suit l'univers du job, y compris ici : l'anonymat
            // masque le client, pas la verticale du poste.
            fondsEncartUnivers[teinteAgent(fiche)],
          )}
        >
          Cette entreprise est anonyme car le job est une exclusivité
          Pachamama&nbsp;! Pour en savoir plus, laisse-nous ton contact en
          cliquant sur «&nbsp;Postuler&nbsp;».
        </p>
      ) : (
        /* SUR UN MANDAT OUVERT, LES CINQ SECTIONS SONT TOUJOURS LÀ.
         *
         * C'est la maquette qui le dit, et je m'étais trompé deux fois de
         * suite : d'abord en masquant les lignes vides du Contexte, puis en
         * n'appliquant la règle du tiret QU'À ces lignes tout en laissant les
         * quatre autres sections disparaître quand leur donnée manquait. Sur
         * un client peu renseigné, la carte se réduisait alors à « Contexte »
         * seul — ce que vous avez vu.
         *
         * La règle du bloc absent, qui gouverne le reste de la fiche, ne
         * s'applique donc PAS à l'intérieur de cette carte : elle s'applique à
         * la carte entière, qui n'existe que sur un mandat non anonyme. À
         * l'intérieur, une donnée manquante se dit « - ».
         */
        <>
          <SectionEntreprise titre="Contexte" couleurTitre={couleurTitre}>
            <dl className="flex flex-col gap-2">
              {contexte.map(([libelle, valeur]) => (
                // `Entreprise detail line` (:308) : deux colonnes de 124,5px,
                // gouttière 10. Le libellé est en Host Grotesk 700 / #5D6979,
                // la valeur en corps noir — et non l'inverse.
                <div
                  key={libelle}
                  className="grid grid-cols-2 items-start gap-2.5"
                >
                  <dt className="t-body-bold text-[var(--encre-600)]">
                    {libelle}
                  </dt>
                  <dd className="t-body break-words">{valeur ?? "-"}</dd>
                </div>
              ))}
            </dl>
          </SectionEntreprise>

          <SectionEntreprise titre="Ambition" filet couleurTitre={couleurTitre}>
            {ambition.length > 0 ? (
              <ListePuces elements={ambition} />
            ) : (
              <p className="t-body">-</p>
            )}
          </SectionEntreprise>

          <SectionEntreprise
            titre="Infos rémunération"
            couleurTitre={couleurTitre}
          >
            <p className="t-body whitespace-pre-line">
              {fiche.salaireInfos ?? "-"}
            </p>
          </SectionEntreprise>

          <SectionEntreprise
            titre="Remote policy"
            filet
            couleurTitre={couleurTitre}
          >
            <p className="t-body whitespace-pre-line">
              {fiche.remoteInfos ?? "-"}
            </p>
          </SectionEntreprise>

          <SectionEntreprise
            titre="Futur.e manager"
            filet
            couleurTitre={couleurTitre}
          >
            {fiche.managerNom ? (
              // `Manager` (:1600) : rangée alignée en haut, gouttière 8px.
              <div className="flex items-start gap-2">
                {fiche.managerPhoto && (
                  // 104 × 108, rayon 8 — un rectangle PORTRAIT, pas un carré.
                  // `Avatar` du design system aurait donné le repli en
                  // initiales, mais ses quatre tailles sont carrées de 30 à
                  // 56px : le plier à cette cote aurait été le détourner.
                  //
                  // Le fond `--encre-100` tient lieu de repli : si la photo ne
                  // charge pas, le lecteur voit un emplacement vide et non
                  // l'icône d'image cassée du navigateur. La mise en page ne
                  // bouge pas non plus, la boîte gardant sa cote.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fiche.managerPhoto}
                    alt=""
                    width={104}
                    height={108}
                    className="h-[108px] w-[104px] shrink-0 rounded-[var(--r-md)] bg-[var(--encre-100)] object-cover"
                  />
                )}
                {/* `Info` (:1633) : colonne, gouttière 4px. Le prénom en corps
                    régulier, le métier en gras dessous — comme la maquette. */}
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="t-body">{fiche.managerNom}</p>
                  {fiche.managerTitre && (
                    <p className="t-body-bold">{fiche.managerTitre}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="t-body">-</p>
            )}
          </SectionEntreprise>
        </>
      )}
    </Carte>
  );
}

/**
 * Une section de la fiche entreprise.
 *
 * LE FILET EST EXPLICITE, section par section, et non systématique. La maquette
 * n'en met pas partout : rien sous le nom du client, un filet avant
 * « Ambition », aucun entre « Ambition » et « Infos rémunération » — les deux
 * se lisent ensemble —, puis un avant « Remote policy » et un avant
 * « Futur.e manager ». Je posais un filet devant chaque section, ce qui
 * dessinait une ligne juste sous « Kelvin ».
 *
 * La règle n'est pas déductible d'un principe : elle est relevée. On la déclare
 * donc au point d'appel plutôt que de l'inventer ici.
 */
function SectionEntreprise({
  titre,
  filet = false,
  couleurTitre,
  children,
}: {
  titre: string;
  filet?: boolean;
  /** La classe de couleur de l'intitulé — celle de l'univers du job. */
  couleurTitre: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {filet && <Divider />}
      {/* `Title/H3` au Figma (:190, :1074, :1241…) — Bricolage 700, 18px, en
          #FF8F66, soit `--product-500` au chiffre près. J'avais mis
          `t-body-bold`, qui est du Host Grotesk 14px : bonne couleur, mauvaise
          famille et mauvaise taille. */}
      <p className={cn("t-h3", couleurTitre)}>{titre}</p>
      {children}
    </div>
  );
}

/* ── Une liste à puces, partout la même ───────────────────────────────────── */

function ListePuces({
  elements,
  className,
}: {
  elements: string[];
  className?: string;
}) {
  if (elements.length === 0) return null;
  return (
    <ul className={cn("flex list-disc flex-col gap-2 pl-5", className)}>
      {elements.map((e, i) => (
        <li key={`${i}-${e}`} className="t-body">
          {e}
        </li>
      ))}
    </ul>
  );
}
