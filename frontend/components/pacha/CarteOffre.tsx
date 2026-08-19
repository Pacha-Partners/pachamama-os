import { Bouton } from './Bouton';
import { Carte, InfoLigne } from './Carte';
import { Divider } from './Divider';
import { Icone } from './Icone';
import { Monogramme } from './Logo';
import { StatutProcess, type Etape } from './StatutProcess';
import { TagContrat, TagInfo, type Contrat } from './Tag';
import { cn } from '@/lib/utils';

/**
 * CarteOffre — la carte d'une offre d'emploi, dans les deux vues du Figma.
 *
 * `CarteOffre`       la vue RECRUTEUR (Figma.md:35146-46860, 12 variantes)
 * `CarteOffreTalent` la vue TALENT    (Figma.md:21710-24080, 5 variantes)
 *
 * Ce sont deux composants Figma distincts et non deux états d'un seul : rayon
 * 8 contre 16, texte noir contre violet 900, ordre de lecture inversé. Les
 * fusionner reviendrait à porter deux mises en page dans un seul arbre JSX.
 *
 * ─── Les axes de la vue recruteur, et comment ils sont rendus ───────────────
 *
 * `Device={Desktop, Mobile}` → classes responsives `md:`, jamais une prop. Une
 *   prop `device` obligerait la page à connaître la largeur de la fenêtre en JS,
 *   donc à se tromper au premier rendu serveur. Largeurs relevées : 261px en
 *   mobile pour les quatre variantes (Figma.md:42902, :43992, :45121, :45998),
 *   282px en desktop étroit (:35156), 765px en desktop large (:36033).
 *
 * `Status={Default, Hover, Clicked}` → états CSS. Au repos la carte ne porte
 *   AUCUNE ombre (Figma.md:36036-36038) ; elle gagne l'ombre rétro -6px au
 *   survol (:37208) et, en « Clicked », un fond violet 050 (:38999). L'ombre
 *   est une réponse au geste, pas un attribut de la surface — c'est le contraire
 *   de ce que je supposais. « Clicked » est un état persistant que seule la page
 *   connaît : il se déclenche par `data-clique="true"`, pas par une prop.
 *
 * `Job anonyme={True, False}` → `client: null`. L'anonymat n'est pas un champ
 *   vide qu'on masque : c'est une promesse faite au client, donc il s'affiche.
 *   Le Figma pose le monogramme Pachamama et la mention « Entreprise anonyme »
 *   (Figma.md:40861-40913), et en version large remplace le logo du client par
 *   le logo violet Pachamama de 92px (:41738).
 *
 * `Large version={True, False}` → `large`. En desktop la version large passe en
 *   deux colonnes (logo, puis faits à gauche et mots-clés à droite) ; en mobile
 *   elle reste en une colonne et ajoute seulement la section mots-clés
 *   (Figma.md:43677). Ce n'est donc pas une largeur, c'est une densité.
 */
export function CarteOffre({
  poste,
  client,
  contrat,
  salaire,
  localisation,
  modeDeTravail,
  motsCles = [],
  exclusivite = false,
  large = false,
  href,
  action,
  className,
  ...reste
}: {
  /** `Job title` — Figma.md:35245, Title/H2. */
  poste: string;
  /** `null` = `Job anonyme=True` : monogramme et mention explicite. */
  client: { nom: string; logoUrl?: string } | null;
  contrat?: Contrat;
  /** `Salaire info` — ex. « 50-55 K » (Figma.md:35597). */
  salaire?: string;
  /** `Ville info` — ex. « Paris, Lyon ou Nantes » (Figma.md:35767). */
  localisation?: string;
  /** `Mode de travail` — ex. « Hybride » (Figma.md:35930). */
  modeDeTravail?: string;
  /** `Keywords` — présents dans la seule version large (Figma.md:36952). */
  motsCles?: { emoji?: string; libelle: string }[];
  /** `Exclu Pachamama` — Figma.md:35936. */
  exclusivite?: boolean;
  /** `Large version=True`. */
  large?: boolean;
  href?: string;
  action?: { libelle: string; emoji?: string; onClick?: () => void };
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>) {
  return (
    <Carte
      regime="accroche"
      survol
      className={cn(
        // Figma.md:35150 padding 24px 16px 16px · :35151 gap 16px
        'flex flex-col gap-4 px-4 pt-6 pb-4',
        // Largeurs relevées : 261 en mobile, 282 ou 765 en desktop.
        'w-full max-w-[261px]',
        large ? 'md:max-w-[765px]' : 'md:max-w-[282px]',
        // Figma.md:38999 — « Clicked » : fond violet 050, ombre conservée.
        'active:bg-[var(--violet-050)] active:shadow-[var(--ombre-6)]',
        'data-[clique=true]:bg-[var(--violet-050)] data-[clique=true]:shadow-[var(--ombre-6)]',
        className,
      )}
      {...reste}
    >
      {/* `Job key info` — colonne en mobile, ligne en desktop large (Figma.md:36049 / :42917). */}
      <div className={cn('flex flex-col gap-2', large && 'md:flex-row md:items-center md:gap-4')}>
        {large && <LogoOffre client={client} />}

        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <NomEntreprise client={client} />
          <h3 className="t-h2">
            {/* Toute la carte n'est pas cliquable : elle contient déjà un bouton,
                et deux zones interactives imbriquées cassent la navigation. */}
            {href ? (
              <a href={href} className="hover:underline">
                {poste}
              </a>
            ) : (
              poste
            )}
          </h3>
          {/* Figma.md:35311 — sur la carte d'offre le tag Contrat est sur fond
              #E9E0FF, ce qui est exactement l'état `Focus=True` de TagContrat
              (Figma.md:47546) : le contrat du poste est le contrat visé. Au
              repos le tag serait blanc, comme sur la carte candidat (:24975). */}
          {contrat && <TagContrat contrat={contrat} focus />}
        </div>

        {/* En desktop large l'exclusivité rejoint l'en-tête (Figma.md:36323, order 2) ;
            partout ailleurs elle reste dans `Bottom actions` (Figma.md:35936). */}
        {exclusivite && large && <ExcluPachamama className="hidden md:inline-flex" />}
      </div>

      {/* Figma.md:35402 — encre-050, qui est déjà le défaut de Divider. */}
      <Divider />

      <div
        className={cn(
          'flex flex-col gap-4',
          large && 'md:flex-row md:items-center md:justify-between',
        )}
      >
        {/* `Job admin info` — Figma.md:35414, colonne, gap 8px. */}
        <div className="flex flex-col gap-2">
          {salaire && <InfoLigne emoji="💸" libelle="Salaire" valeur={salaire} />}
          {localisation && <InfoLigne emoji="📍" libelle="Localisation" valeur={localisation} />}
          {modeDeTravail && <InfoLigne emoji="🖥️" libelle="Remote" valeur={modeDeTravail} />}
        </div>

        {/* Les mots-clés s'affichent dans les DEUX largeurs : les conditionner
            à `large` faisait perdre la donnée en silence, sans erreur de type
            ni avertissement, dès qu'un appelant passait `motsCles` à une carte
            étroite. Perdre une donnée transmise volontairement est un défaut. */}
        {motsCles.length > 0 && (
          <>
            {/* En mobile la section mots-clés est précédée d'un filet (Figma.md:43643). */}
            <Divider className="md:hidden" />
            <ul className="flex flex-wrap items-center gap-2.5 md:justify-end">
              {motsCles.map((m) => (
                <li key={m.libelle}>
                  {/* Figma.md:36992 — sur une carte les mots-clés portent
                      l'ombre -3px : c'est le régime « accroche » de TagInfo. */}
                  <TagInfo emoji={m.emoji} regime="accroche">
                    {m.libelle}
                  </TagInfo>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* `Bottom actions` — Figma.md:35911, ligne centrée, gap 8px. */}
      {(action || (exclusivite && !large)) && (
        <div
          className={cn(
            'flex flex-wrap items-center justify-center gap-2',
            large && 'md:justify-end',
          )}
        >
          {exclusivite && <ExcluPachamama className={large ? 'md:hidden' : undefined} />}
          {action && (
            <Bouton
              apparence="plein"
              onClick={action.onClick}
              iconeAvant={
                action.emoji ? (
                  <span aria-hidden="true">{action.emoji}</span>
                ) : (
                  // Figma.md:37150 — le slot `Icons` du bouton porte icon-send.
                  <Icone nom="icon-send" className="size-4" />
                )
              }
            >
              {action.libelle}
            </Bouton>
          )}
        </div>
      )}
    </Carte>
  );
}

/**
 * `Company name` — le nom du client, ou son anonymat.
 * Body/Bold en #A8B1BD dans les deux cas (Figma.md:36170 et :40913) : le nom du
 * client n'est pas le titre de la carte, c'est sa provenance.
 */
function NomEntreprise({ client }: { client: { nom: string } | null }) {
  if (client) {
    return <p className="t-body-bold text-[var(--encre-300)]">{client.nom}</p>;
  }
  return (
    // Figma.md:40848 — gap 4px quand le monogramme accompagne la mention.
    <p className="t-body-bold flex items-center gap-1 text-[var(--encre-300)]">
      {/* Figma.md:40863 — 15.21×15, soit `taille="petit"`, tracé en #A8B1BD.
          Le monogramme se teinte par la couleur de texte, jamais par un fill. */}
      <Monogramme taille="petit" className="text-[var(--encre-300)]" />
      Entreprise anonyme
    </p>
  );
}

/**
 * `Logo entreprise` (Figma.md:36067) ou `Purple logo Pacha 1` (Figma.md:41738).
 * Masqué en mobile : le Figma ne le montre dans aucune des quatre variantes
 * mobiles, qui commencent directement par le nom de l'entreprise.
 */
function LogoOffre({ client }: { client: { nom: string; logoUrl?: string } | null }) {
  if (client?.logoUrl) {
    return (
      // Logo client servi par l'API du client, hors domaines déclarés à
      // next/image : `<img>` est ici le seul choix qui ne casse pas le rendu.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={client.logoUrl}
        alt={`Logo ${client.nom}`}
        // Figma.md:36088 — 97×92, sans rayon ni filet : le logo client est
        // posé carré, comme toutes les images de personne ou de société.
        className="hidden h-[92px] w-[96px] shrink-0 object-contain md:block"
      />
    );
  }
  return (
    // Figma.md:41740 — `Purple logo Pacha 1`, 92×92. La largeur reste en auto :
    // le viewBox impose le rapport, la forcer déformerait le tracé.
    <Monogramme className="hidden h-[92px] text-[var(--violet-300)] md:block" />
  );
}

/**
 * `Exclu Pachamama` — l'argument commercial, en pastille crème.
 * Figma.md:35936-36000 : padding 4px 6px, gap 4px, fond #FFFBF0, bordure
 * #FFE9A8, rayon 8, texte Caption/Highlight en #5D6979. Pas d'ombre rétro :
 * c'est une mention, pas un bouton.
 */
function ExcluPachamama({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        't-caption-hl inline-flex items-center gap-1 rounded-[var(--r-md)] px-1.5 py-1',
        'border bg-[var(--fond-entete)] text-[var(--encre-600)]',
        'border-[#FFE9A8]', // Figma.md:35952 — sans jeton, cf. docs/ds-jetons-manquants-lot4.md
        className,
      )}
    >
      {/* Figma.md:36350 — 13.21×13, un cran sous `petit` : la hauteur est
          reprise en littéral, la teinte vient du texte (#5D6979). */}
      <Monogramme taille="petit" className="h-[13px]" />
      Exclu Pachamama
    </span>
  );
}

/**
 * CarteOffreTalent — la même offre, vue par un candidat.
 *
 * Figma : `Type={Jobs view Talent, Talent process, Board of jobs}` ×
 * `Status={Default, Already candidate, With motivations}` (Figma.md:21710,
 * :22067, :22524, :23089, :23653). Cotes communes : 311px, padding 16, gap 12,
 * bordure 2px noire, rayon 16 (Figma.md:21719-21727).
 *
 * DEUX PARTICULARITÉS À NE PAS PRENDRE POUR DES ERREURS :
 *
 * · Tout le texte est en violet 900 et non en noir (Figma.md:21929, :21972,
 *   :22015, :22058). C'est une entorse assumée à la règle « le texte est
 *   toujours noir », cohérente sur les cinq variantes, donc délibérée : la vue
 *   talent est une surface de marque, pas une surface de travail.
 *
 * · `Status=Already candidate` retourne la carte : le bouton « ajouter » cède
 *   la place à un sélecteur de statut, et le fond passe en violet 050
 *   (Figma.md:22082). Le Figma ne signale cet état QUE par la couleur du fond ;
 *   on ajoute la mention textuelle, faute de quoi l'information disparaît pour
 *   qui ne distingue pas le crème du violet très clair.
 */
export function CarteOffreTalent({
  entreprise,
  poste,
  contrat,
  agent,
  localisation,
  salaire,
  logoUrl,
  statut,
  dejaCandidat = false,
  slotStatut,
  motivations,
  action,
  className,
  ...reste
}: {
  /** `Company name` — Figma.md:21916, Title/H2 en violet 900. */
  entreprise: string;
  /** `Job title` — Figma.md:21960. */
  poste: string;
  /** `Type of contract` — Figma.md:22003. */
  contrat?: string;
  /** `Job owner agent` — rendu « Agent : … » (Figma.md:22046). */
  agent?: string;
  /** `Location` — ex. « Montpellier - Full remote » (Figma.md:23978). */
  localisation?: string;
  /** `Salary range` — ex. « 800€ - 1 200€ » (Figma.md:24020). */
  salaire?: string;
  /** `Client Image` — 82×82, bordure encre-100 (Figma.md:21859). */
  logoUrl?: string;
  /** `Job status` — la pastille verte de la vue talent (Figma.md:21815). */
  statut?: Etape;
  /** `Status=Already candidate`. */
  dejaCandidat?: boolean;
  /** Le sélecteur de statut du LOT 2 (`Input / dropdown`, Figma.md:22112). */
  slotStatut?: React.ReactNode;
  /** `Motivations text` — `Status=With motivations` (Figma.md:23614). */
  motivations?: string;
  /** `Add to candidates` — Figma.md:21735. */
  action?: { libelle: string; onClick?: () => void };
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>) {
  return (
    <Carte
      regime="accroche"
      rayon="lg"
      className={cn(
        // Figma.md:21719 padding 16px · :21720 gap 12px · :21722 largeur 311px
        'flex w-full max-w-[311px] flex-col items-stretch gap-3 p-4',
        dejaCandidat && 'bg-[var(--violet-050)]', // Figma.md:22082
        className,
      )}
      {...reste}
    >
      {dejaCandidat ? (
        <div className="flex flex-col gap-1">
          {/* Ajout hors Figma, exigé par la règle « jamais la couleur seule ». */}
          <p className="t-caption-bold text-[var(--violet-900)]">Vous avez déjà candidaté</p>
          {slotStatut}
        </div>
      ) : (
        action && (
          <Bouton
            apparence="plein"
            onClick={action.onClick}
            iconeAvant={<Icone nom="icon-user-plus" className="size-4" />}
          >
            {action.libelle}
          </Bouton>
        )
      )}

      {/* `Line 9` — Figma.md:21806 : ici le filet est violet 100, pas encre-050.
          Divider porte sa couleur en `bg-`, pas en `border-`. */}
      <Divider className="bg-[var(--violet-100)]" />

      {/* Figma.md:21828 — la pastille de la vue talent est sur #4DA467, un vert
          distinct du #58D5A7 du kanban. Deux verts, deux surfaces. */}
      {statut && <StatutProcess etape={statut} className="self-start bg-[#4DA467] text-white" />}

      {/* `Job presentation` — Figma.md:21837 : ligne, padding 4px, gap 16px. */}
      <div className="flex items-center gap-4 rounded-[var(--r-md)] p-1">
        {logoUrl && (
          // Même raison que ci-dessus : logo hors domaines next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={`Logo ${entreprise}`}
            // Figma.md:21863 — 82×82, filet encre-100, aucun rayon.
            className="size-[82px] shrink-0 border border-[var(--encre-100)] object-contain"
          />
        )}
        {/* `Job description` — Figma.md:21875, colonne, gap 8px, tout en violet 900. */}
        <div className="flex min-w-0 flex-col gap-2 text-[var(--violet-900)]">
          <h3 className="t-h2 text-[var(--violet-900)]">{entreprise}</h3>
          <p className="t-body">{poste}</p>
          {contrat && <p className="t-body">{contrat}</p>}
          {localisation && <p className="t-body">{localisation}</p>}
          {salaire && <p className="t-body">{salaire}</p>}
          {agent && <p className="t-body">Agent&nbsp;: {agent}</p>}
        </div>
      </div>

      {/* `Talent motivations` — Figma.md:22958 : titre Caption/Bold, puis le
          texte s'il existe, sinon le bouton d'ajout (`Status=Default`). */}
      {motivations !== undefined && (
        <>
          <Divider className="bg-[var(--violet-100)]" />
          <div className="flex flex-col gap-2">
            <p className="t-caption-bold text-[var(--violet-900)]">Motivations Talent</p>
            <p className="t-body text-[var(--violet-900)]">{motivations}</p>
          </div>
        </>
      )}
    </Carte>
  );
}
