import { Avatar, type TailleAvatar } from './Avatar';
import { Bouton } from './Bouton';
import { Carte, ContenuCarte, EnteteContenu, LigneContenu } from './Carte';
import { Divider } from './Divider';
import { Icone } from './Icone';
import { Notation, type Note } from './Notation';
import { StatutProcess, StatutTexte, type Etape } from './StatutProcess';
import { TagContrat, type Contrat } from './Tag';
import { cn } from '@/lib/utils';

/**
 * Les cartes de personne — deux familles distinctes dans le Figma.
 *
 * `CarteCandidat` la carte du PIPELINE : `Qualifié ?={True,False}` ×
 *   `Version={Expanded,Small}` × `Status={Received,In process}`, huit variantes
 *   peuplées (Figma.md:24665, :25506, :26261, :26620, :27021, :27862, :28332,
 *   :28711). Elle vit dans une colonne de kanban, par dizaines.
 *
 * `CarteTalent` la carte de RECHERCHE : `Type={Card Kanban,Card List}` ×
 *   `State={Default,Hover}`, quatre variantes (Figma.md:6648, :7096, :7544,
 *   :8018). Elle vit dans une liste de résultats, avec une action d'ajout.
 *
 * Les confondre serait tentant — même personne, même photo — mais elles ne
 * répondent pas à la même question. La première dit « où en est ce candidat sur
 * ce poste », la seconde « faut-il l'approcher ». D'où deux composants.
 *
 * RÉGIME DE SURFACE. Les deux sont en régime « travail » : aucune ombre rétro,
 * puisqu'on les parcourt en nombre. Le relevé donne quand même deux traitements
 * différents, et l'écart est signifiant : la carte de pipeline porte une bordure
 * de 1px (Figma.md:24680), la carte de recherche n'en porte AUCUNE — juste un
 * fond blanc sur le crème de la page (Figma.md:6664). La bordure de la première
 * est un porteur d'information, pas une décoration : c'est elle qui change de
 * couleur selon la qualification.
 */

/* ────────────────────────────────────────────────────────────────────────────
   La carte du pipeline
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * CarteCandidat — un candidat dans une colonne de statut.
 *
 * `Version={Expanded,Small}` → `densite`. Deux densités d'un seul composant, et
 *   non deux composants : la version compacte n'est pas une autre carte, c'est
 *   la même privée de son bloc de faits et de son bloc motivations
 *   (Figma.md:26261 contre :25506 — mêmes cotes, gap 8 au lieu de 6).
 *
 * `Status={Received,In process}` → `statut`. Reçu affiche la date de
 *   candidature (« 📥 05/05/2024 », Figma.md:26577) ; en cours affiche l'étape
 *   en texte puis la date de prochaine échéance (« 🗓 20/06/2024 »,
 *   Figma.md:26978). Ce ne sont pas deux styles, ce sont deux dates différentes.
 *
 * `Qualifié ?={True,False}` → `qualifie`. Le Figma ne l'exprime QUE par la
 *   couleur de la bordure : noire si non qualifié (Figma.md:24680), vert
 *   #79E6BE si qualifié (Figma.md:27036). Or cette information bloque l'envoi au
 *   client — elle ne peut pas reposer sur une teinte. On la double donc d'une
 *   mention textuelle dans les deux sens.
 *
 * INCOHÉRENCE DU FICHIER, tranchée ici : la ligne « ⚠️Qualif niveau 1
 * incomplète » figure aussi dans la variante `Qualifié ?=True`
 * (Figma.md:27750), ce qui est manifestement un oubli de nettoyage. On ne
 * l'affiche que lorsque `qualifie` est faux.
 */
export function CarteCandidat({
  nom,
  ville,
  photoUrl,
  note,
  qualifie,
  densite = 'complete',
  statut,
  date,
  dateAlerte = false,
  etape,
  poste,
  contrat,
  onRetirerContrat,
  pretentions,
  motivations,
  actionMotivations,
  className,
  ...reste
}: {
  /** `Candidate name & surname` — Caption/Bold #2D2B31 (Figma.md:24853). */
  nom: string;
  /** Deuxième ligne du bloc identité : la ville (Figma.md:24918). */
  ville?: string;
  /** `Candidate image` — 30×30, bordure encre-100 (Figma.md:24729). */
  photoUrl?: string;
  /** `Candidate rating` — la pastille de note posée sur la photo (Figma.md:24746). */
  note?: Note;
  /** `Qualifié ?` — bloque l'envoi au client quand il est faux. */
  qualifie: boolean;
  /** `Version` : `complete` = Expanded, `compacte` = Small. */
  densite?: 'complete' | 'compacte';
  /** `Status` : `recu` = Received, `en-cours` = In process. */
  statut: 'recu' | 'en-cours';
  /** La date, déjà formatée — le Figma la montre en JJ/MM/AAAA. */
  date?: string;
  /** Le 🚨 posé à côté de la date (Figma.md:25329). */
  dateAlerte?: boolean;
  /** `Interview status` — l'étape, en texte (Figma.md:25244). */
  etape?: Etape;
  /** `Card content Item` — ex. « Senior Product manager » (Figma.md:25101). */
  poste?: string;
  contrat?: Contrat;
  onRetirerContrat?: () => void;
  /** `Card content Item` — ex. « 90 - 180K€ » (Figma.md:25203). */
  pretentions?: string;
  /** `Motivations text` — Figma.md:23614. Absent ⇒ le bouton d'ajout s'affiche. */
  motivations?: string;
  /** Le bouton du bloc `Motivations` (Figma.md:25450). */
  actionMotivations?: { libelle: string; onClick?: () => void };
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>) {
  const complete = densite === 'complete';

  return (
    <Carte
      regime="travail"
      className={cn(
        // Figma.md:24673 padding 8px · :24674 gap 6px (Expanded) / :26269 gap 8px (Small)
        'flex w-full max-w-[210px] flex-col items-start p-2',
        complete ? 'gap-1.5' : 'gap-2',
        // Figma.md:24680 / :27036 — la bordure porte la qualification.
        qualifie ? 'border-[var(--statut-positif)]' : 'border-black',
        className,
      )}
      {...reste}
    >
      {/* `Candidate identity` — Figma.md:24689 : ligne, gap 8px, hauteur 36px. */}
      <EnteteContenu
        className="w-full"
        vignette={<PhotoCandidat nom={nom} photoUrl={photoUrl} note={note} />}
      >
        <p className="t-caption-bold truncate text-[var(--encre-700)]">{nom}</p>
        {ville && <p className="t-caption text-[var(--encre-250)]">{ville}</p>}
      </EnteteContenu>

      {/* `Frame 2` — le bloc de faits, absent de la version compacte
          (Figma.md:24939, seul dans les quatre variantes Expanded). */}
      {complete && (poste || contrat || pretentions) && (
        <div className="flex w-full flex-col gap-1.5 rounded-[var(--r-md)] p-1">
          {contrat && (
            // Figma.md:24975 — sur cette carte le tag Contrat est BLANC et
            // fermable, là où la carte d'offre le montre en violet 100 (:35311).
            // Le blanc étant le repos de TagContrat, il n'y a rien à passer.
            <TagContrat contrat={contrat} onRetirer={onRetirerContrat} />
          )}
          <ContenuCarte>
            {poste && (
              <LigneContenu compact>
                <span className="t-caption text-black">{poste}</span>
              </LigneContenu>
            )}
            {pretentions && (
              <LigneContenu compact className="items-baseline gap-1">
                <span aria-hidden="true" className="t-caption">
                  💸
                </span>
                <span className="t-caption text-black">
                  <span className="sr-only">Prétentions : </span>
                  {pretentions}
                </span>
              </LigneContenu>
            )}
          </ContenuCarte>
        </div>
      )}

      {/* `Date` — le bloc temporel, seul élément qui distingue les deux Status. */}
      <div className="flex w-full flex-col gap-1.5">
        {statut === 'en-cours' && etape && <StatutTexte etape={etape} />}
        {date && (
          <p className="t-caption flex items-baseline gap-1 text-[var(--encre-300)]">
            <span aria-hidden="true">{statut === 'recu' ? '📥' : '🗓'}</span>
            <span className="sr-only">
              {statut === 'recu' ? 'Date de candidature : ' : 'Prochaine échéance : '}
            </span>
            {date}
            {dateAlerte && (
              <>
                <span aria-hidden="true" className="text-black">
                  🚨
                </span>
                <span className="sr-only">échéance à traiter</span>
              </>
            )}
          </p>
        )}
      </div>

      {/* La qualification, en texte. Le libellé négatif est celui du Figma
          (Figma.md:25394, sans espace après l'emoji — recopié tel quel) ; le
          libellé positif reprend celui de la carte de recherche
          (Figma.md:6833), faute d'équivalent dans cette famille. */}
      {qualifie ? (
        <p className="t-caption text-[var(--encre-250)]">
          <span aria-hidden="true">✅️</span> Qualifié.e
        </p>
      ) : (
        <p className="t-caption text-[var(--encre-250)]">
          <span aria-hidden="true">⚠️</span>
          <span className="sr-only">Attention : </span>
          Qualif niveau 1 incomplète
        </p>
      )}

      {/* `Motivations` — Figma.md:25415 : un filet puis, selon `Status`, le
          texte des motivations ou le bouton pour les ajouter. */}
      {complete && (motivations !== undefined || actionMotivations) && (
        <div className="flex w-full flex-col items-center gap-1.5">
          {/* Figma.md:25441 — ici le filet est en encre-100, non en encre-050 ;
              la couleur du composant Divider est portée par `bg-`. */}
          <Divider className="bg-[var(--encre-100)]" />
          {motivations !== undefined ? (
            <p className="t-caption self-start text-black">{motivations}</p>
          ) : (
            actionMotivations && (
              <Bouton apparence="plein" taille="sm" onClick={actionMotivations.onClick}>
                {actionMotivations.libelle}
              </Bouton>
            )
          )}
        </div>
      )}
    </Carte>
  );
}

/**
 * `Candidate picture` + `Candidate rating` — Figma.md:24709-24807.
 *
 * La photo et la note sont deux composants d'autres lots (`Avatar`, `Notation`),
 * déjà relevés sur les mêmes lignes du Figma : on les compose au lieu de les
 * refaire. Ne reste ici que leur superposition, qui n'appartient à ni l'un ni
 * l'autre — la pastille est posée en badge sur l'angle haut-gauche de la photo
 * (`left: -4px; top: -6px`, Figma.md:24759), le blanc de la pastille servant à
 * la détacher de l'image.
 */
function PhotoCandidat({
  nom,
  photoUrl,
  note,
  taille = 30,
}: {
  nom: string;
  photoUrl?: string;
  note?: Note;
  taille?: TailleAvatar;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar nom={nom} src={photoUrl} taille={taille} />
      {note && (
        <Notation note={note} taille="sm" className="absolute -top-1.5 -left-1" /> // Figma.md:24759
      )}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   La carte de recherche
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * CarteTalent — un talent dans une liste de résultats ou un vivier.
 *
 * `Type={Card List,Card Kanban}` → `type`. La liste est plus aérée (padding 16,
 *   gap 12 — Figma.md:6654) et porte la pastille de statut en tête
 *   (Figma.md:6668) ; le kanban est resserré (padding 8, gap 8 — Figma.md:7550)
 *   et s'ouvre sur la mention de qualification.
 *
 * `State={Default,Hover}` → survol CSS. Deux fonds relevés, et ils diffèrent
 *   selon le type : #F2F0FA en liste (Figma.md:7112), #FBFAFF en kanban
 *   (Figma.md:8034). Aucun des deux n'a de jeton.
 *
 * ÉCART DU FICHIER : les variantes Hover ne portent pas le même contenu que les
 * Default (la variante `Card Kanban / Hover` perd sa pastille de statut et deux
 * lignes de contenu, Figma.md:8018-8300). Ce sont des maquettes remplies à la
 * main, non des états d'un même contenu : on n'a donc retenu du survol que ce
 * qui en est vraiment un, la couleur de fond.
 */
export function CarteTalent({
  nom,
  ville,
  photoUrl,
  type = 'liste',
  etape,
  qualifie = false,
  disponibilite,
  faits = [],
  action,
  onRetirer,
  className,
  ...reste
}: {
  /** `Marcel Ito` — Figma.md:6767, 16px/24px semi-gras #2D2B31. */
  nom: string;
  /** `Lyon, France` — Figma.md:6789. */
  ville?: string;
  /** `Client Image` — 56×56 sur cette carte (Figma.md:6733). */
  photoUrl?: string;
  type?: 'liste' | 'kanban';
  /** `Status` — la pastille pleine, présente en vue liste (Figma.md:6668). */
  etape?: Etape;
  /** `Menu item` → « ✅️ Qualifié.e » (Figma.md:6833). */
  qualifie?: boolean;
  /** `Open to work...` — première ligne de contenu, en violet 700 (Figma.md:6895). */
  disponibilite?: string;
  /** `Card content Item` — ex. « Prétentions : 90K - 180K » (Figma.md:6936). */
  faits?: string[];
  /** `Button` — Figma.md:6957. */
  action?: { libelle: string; onClick?: () => void };
  /** `Close` — retirer de la liste (Figma.md:7024, icône minus-circle). */
  onRetirer?: () => void;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>) {
  const liste = type === 'liste';

  return (
    <Carte
      regime="travail"
      className={cn(
        // Figma.md:6664 / :7559 — aucune bordure : le fond blanc suffit sur le crème.
        'flex w-full max-w-[240px] flex-col items-start border-0',
        liste ? 'gap-3 p-4' : 'gap-2 p-2',
        // Figma.md:7112 / :8034 — deux fonds de survol, sans jeton.
        liste ? 'hover:bg-[#F2F0FA]' : 'hover:bg-[#FBFAFF]',
        'transition-colors duration-150',
        className,
      )}
      {...reste}
    >
      {liste && etape && <StatutProcess etape={etape} />}

      {!liste && qualifie && <MentionQualifie />}

      <EnteteContenu
        className="w-full"
        vignette={<PhotoCandidat nom={nom} photoUrl={photoUrl} taille={56} />}
      >
        {/* 16px/24px semi-gras : le Figma le pose en Montserrat, écarté par la
            charte ; seul le corps est repris, la famille reste Host Grotesk.
            Aucune classe typographique ne couvre ce couple — cf. les jetons. */}
        <p className="truncate font-[family-name:var(--font-body)] text-[16px] leading-6 font-semibold text-[var(--encre-700)]">
          {nom}
        </p>
        {ville && <p className="t-caption text-[var(--encre-250)]">{ville}</p>}
      </EnteteContenu>

      {liste && qualifie && <MentionQualifie />}

      {(disponibilite || faits.length > 0) && (
        <ContenuCarte>
          {disponibilite && (
            <LigneContenu>
              <span className="t-caption-hl text-[var(--violet-700)]">{disponibilite}</span>
            </LigneContenu>
          )}
          {faits.map((f) => (
            <LigneContenu key={f}>
              <span className="t-caption text-[var(--encre-250)]">{f}</span>
            </LigneContenu>
          ))}
        </ContenuCarte>
      )}

      {(action || onRetirer) && (
        <div className="flex w-full items-center justify-between gap-2">
          {action && (
            <Bouton
              apparence="plein"
              taille="sm"
              onClick={action.onClick}
              iconeAvant={<Icone nom="icon-user-plus" className="size-4" />}
            >
              {action.libelle}
            </Bouton>
          )}
          {onRetirer && (
            <button
              type="button"
              onClick={onRetirer}
              aria-label={`Retirer ${nom} de la liste`}
              className={cn(
                // Figma.md:7024 — 24×24, rond, fond blanc, trait violet 700.
                'grid size-6 shrink-0 place-items-center rounded-[var(--r-full)] bg-white',
                'text-[var(--violet-700)] hover:bg-[var(--violet-100)]',
              )}
            >
              <Icone nom="icon-minus-circle" className="size-4" />
            </button>
          )}
        </div>
      )}
    </Carte>
  );
}

/**
 * `Menu item` → « ✅️ Qualifié.e » (Figma.md:6811-6845).
 * Pastille à rayon complet, padding 8px 12px, texte violet 700. Le fond varie
 * dans le fichier — blanc en liste (:6823), #F6F5FA en kanban (:7716) : on
 * retient #F6F5FA, le seul qui se détache du fond de carte.
 */
function MentionQualifie() {
  return (
    <span className="t-caption-hl inline-flex items-center gap-2 rounded-[var(--r-full)] bg-[#F6F5FA] px-3 py-2 text-[var(--violet-700)]">
      <span aria-hidden="true">✅️</span>
      Qualifié.e
    </span>
  );
}
