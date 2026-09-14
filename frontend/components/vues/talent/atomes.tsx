import Link from 'next/link';

import { Avatar } from '@/components/pacha/Avatar';
import { Carte } from '@/components/pacha/Carte';
import { Icone } from '@/components/pacha/Icone';
import {
  BarreEnregistrement,
  CadreEcran,
  CarteInterlocuteur,
  Champ,
  EnteteEcran,
  EtapeTexte,
  GrilleChamps,
  PastilleEtape,
} from '@/components/vues/entreprise/atomes';
import type { MembreEquipe } from '@/lib/domaine/talent';
import type { NomIcone } from '@/lib/icones';
import { cn } from '@/lib/utils';

/**
 * LES PETITES PIÈCES DE L'ESPACE TALENT.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SEPT D'ENTRE ELLES SONT CELLES DU PORTAIL ENTREPRISE, RÉEXPORTÉES
 * ─────────────────────────────────────────────────────────────────────────
 * `components/vues/entreprise/atomes.tsx` se termine par cette phrase :
 * « Le jour où le portail talent en aura besoin à l'identique, la question se
 * reposera. » Elle se repose, et la réponse est **on réemploie**.
 *
 * `CadreEcran` (la largeur de 1 180px et le rythme vertical), `EnteteEcran`
 * (le duo de titre de la charte, le chapeau, le lien de remontée),
 * `CarteInterlocuteur`, `Champ` / `GrilleChamps` (la ligne « libellé / valeur »
 * qui sait dire qu'elle est vide) et les deux écritures d'étape ne portent RIEN
 * d'entreprise : ce sont des règles de mise en page et d'écriture du projet.
 * Les recopier donnerait deux vérités qui divergeraient au premier ajustement,
 * et le journal du projet est explicite là-dessus : une copie ne se tient
 * jamais à jour.
 *
 * L'endroit juste serait `components/vues/commun/atomes.tsx`. Les y déplacer
 * imposerait de réécrire les imports de six écrans du portail entreprise, qui
 * est livré, vérifié et hors de mon périmètre. On importe donc, sans rien
 * déplacer, et ce fichier sert de surface unique aux écrans du talent : le jour
 * de l'extraction, c'est lui seul qui change.
 *
 * ⚠ `PastilleEtape` est réemployée alors que son commentaire d'origine parle du
 * registre CLIENT. Ce qu'elle fait est neutre : elle sépare l'emoji du libellé
 * et pose la couleur reçue en fond. Le registre, lui, est choisi par la VUE —
 * `api.ma_candidature.etape` rend `libelle_talent`, pas `libelle_client`
 * (D-02). Le composant ne connaît pas la différence et n'a pas à la connaître.
 */
export {
  BarreEnregistrement,
  CadreEcran,
  CarteInterlocuteur,
  Champ,
  EnteteEcran,
  EtapeTexte,
  GrilleChamps,
  PastilleEtape,
};

/* ══════════════════════════════════════════════════════════════════════════
   Une carte qui mène quelque part
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * UNE SEULE ZONE CLIQUABLE PAR CARTE, et c'est tout le composant.
 *
 * La maquette de l'espace talent empile des cartes de candidature dont la
 * carte entière mène au détail. Deux façons de faire : envelopper la carte dans
 * un `<a>`, ou poser un lien en recouvrement. La première interdit tout autre
 * contrôle à l'intérieur (un lien dans un lien est du HTML invalide, et les
 * lecteurs d'écran s'y perdent) ; la seconde laisse la carte accueillir plus
 * tard un bouton sans rien casser, et donne UNE seule cible à la tabulation.
 *
 * L'anneau de focus est porté par la CARTE (`group-focus-within`) et non par le
 * lien invisible : un anneau autour d'un élément transparent n'indique rien.
 */
export function CarteLien({
  href,
  libelle,
  discret,
  children,
  className,
}: {
  href: string;
  /** Ce que le lien annonce. Le contenu visible n'est pas forcément lisible seul. */
  libelle: string;
  /**
   * Sans ombre au survol : la carte reste ouvrable, mais elle n'invite plus.
   *
   * Sert aux candidatures closes. Elles n'appellent AUCUN geste — c'est fini —
   * et l'ombre les faisait se soulever comme les autres. Le lien, lui, reste :
   * on consulte encore leurs dates, l'offre et ce que le cabinet a partagé. Ne
   * plus pouvoir les ouvrir serait une perte, pas une sobriété.
   */
  discret?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Carte
      regime="travail"
      className={cn(
        'group relative flex flex-col gap-3 p-4 transition-shadow',
        !discret && 'hover:shadow-[var(--ombre-2)]',
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-black',
        className,
      )}
    >
      {children}
      <Link
        href={href}
        className="absolute inset-0 rounded-[inherit] focus:outline-none"
        // Le lien recouvre la carte : son contenu textuel serait annoncé deux
        // fois. Il ne porte donc qu'un nom accessible, et rien de visible.
        aria-label={libelle}
      >
        <span className="sr-only">{libelle}</span>
      </Link>
    </Carte>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Le lien vers l'écran qui répare quelque chose
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * L'invitation : ce qui manque, et le chemin pour le remplir.
 *
 * Elle est un LIEN et non un bouton, parce qu'elle change de page. Le libellé
 * dit la destination — « Compléter mon profil » — et non l'action abstraite
 * (« Corriger »), qui obligerait à cliquer pour savoir où l'on va.
 */
export function LienInvitation({
  href,
  children,
  icone,
  nouvelOnglet,
  className,
}: {
  href: string;
  children: React.ReactNode;
  /** Remplace la flèche. Une icône de nature — un document, une image. */
  icone?: NomIcone;
  /**
   * Ouvre ailleurs, et le DIT aux lecteurs d'écran.
   *
   * Sert aux liens signés du stockage : ils ne sont pas des pages de
   * l'application, et les ramener dans l'onglet courant ferait perdre un
   * formulaire en cours de saisie. `rel` est posé avec, jamais séparément —
   * `target="_blank"` sans `noopener` donne la main sur `window.opener`.
   */
  nouvelOnglet?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      target={nouvelOnglet ? '_blank' : undefined}
      rel={nouvelOnglet ? 'noopener noreferrer' : undefined}
      className={cn(
        't-caption-hl inline-flex w-fit items-center gap-1.5 text-black underline underline-offset-2',
        'rounded-[var(--r-xs)] hover:decoration-2',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black',
        className,
      )}
    >
      {icone && <Icone nom={icone} className="size-3.5" />}
      {children}
      {!icone && <Icone nom="icon-arrow-right" className="size-3.5" />}
      {nouvelOnglet && <span className="sr-only"> (nouvel onglet)</span>}
    </Link>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   La note de bas de bloc
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ce que l'écran doit DIRE et qui n'est pas une donnée : ce qui est tenu par
 * le cabinet, ce qui n'est pas encore branché, ce qu'une action déclenche.
 *
 * Un simple paragraphe, et c'est délibéré : un encart coloré ou une icône
 * d'avertissement transformerait chaque explication en alerte, et un écran
 * couvert d'alertes n'en signale plus aucune.
 */
export function Precision({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn('t-caption text-[var(--encre-600)]', className)}>{children}</p>;
}

/* ══════════════════════════════════════════════════════════════════════════
   Un état qui compte plus que le reste
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * L'ENCART D'ÉTAT — consentement absent, dossier retiré du marché.
 *
 * ⚠ IL NE PORTE PAS DE ROUGE. Le rouge du système (`--statut-echec`) signale
 * une erreur ; ici il n'y a pas d'erreur, il y a une décision à prendre ou une
 * décision prise. Le fond est celui des cartes d'accroche, le filet est noir,
 * et c'est le TEXTE qui porte le sens — la règle du système, où la couleur ne
 * signale jamais seule.
 *
 * `role="region"` avec un `aria-labelledby` : sans rôle, le bloc n'est pas
 * atteignable par la navigation par régions d'un lecteur d'écran, et c'est
 * précisément le bloc qu'on veut qu'il trouve.
 */
export function EncartEtat({
  titre,
  emoji,
  children,
  action,
  ton = 'attention',
  id,
}: {
  titre: string;
  /** Décoratif, `aria-hidden`. Le sens est dans le titre. */
  emoji?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  /** `attention` = il y a un geste à faire · `neutre` = un état, sans geste. */
  ton?: 'attention' | 'neutre';
  id: string;
}) {
  return (
    <Carte
      regime={ton === 'attention' ? 'accroche' : 'travail'}
      role="region"
      aria-labelledby={id}
      className={cn(
        'flex flex-col gap-3 p-5',
        ton === 'attention' && 'border-2 bg-[var(--fond-entete)]',
      )}
    >
      <h2 id={id} className="t-h3 text-black">
        {emoji && <span aria-hidden="true">{emoji} </span>}
        {titre}
      </h2>
      <div className="t-body flex flex-col gap-2 text-black">{children}</div>
      {action && <div className="flex flex-wrap items-center gap-2 pt-1">{action}</div>}
    </Carte>
  );
}

/**
 * LA POIGNÉE D'UNE SECTION DE LA FICHE.
 *
 * « Ma fiche » réunit trois sections qui écrivent la même fiche talent par des
 * fonctions différentes, et n'offre qu'UN bouton. Chaque section enregistrable
 * expose donc de quoi la sauver et de quoi l'annuler, et signale si elle porte
 * des modifications. L'écran parent n'appelle que les sections salies : quelqu'un
 * qui corrige son téléphone ne doit pas déclencher la réécriture de ses attentes
 * — les fonctions `maj_` écrivent le formulaire ENTIER.
 */
export type PoigneeSection = {
  sauver: () => Promise<boolean>;
  annuler: () => void;
};

/* ══════════════════════════════════════════════════════════════════════════
   La barre d'enregistrement
   ══════════════════════════════════════════════════════════════════════════ */


/**
 * L'ÉQUIPE QUI SUIT UN PROCESS.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI CE N'EST PAS `CarteInterlocuteur`
 * ─────────────────────────────────────────────────────────────────────────
 * Celle-là montre UNE personne. Un mandat en porte jusqu'à trois : un ou deux
 * recruteurs et un Account Manager. Le commanditaire : « on n'affiche pas le ou
 * les recruteurs, alors qu'ils sont plus actifs en général que l'Account
 * Manager ». Les montrer un par un aurait empilé trois cartes identiques.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE RÔLE AFFICHÉ EST CELUI SUR CE PROCESS, PAS LE TITRE INTERNE
 * ─────────────────────────────────────────────────────────────────────────
 * La base porte une `fonction` — « Career Agent », « Talent Partner ». Elle ne
 * dit pas ce que la personne fait sur CETTE candidature. « Recrutement » et
 * « Account Manager » le disent, et c'est la question que pose le titre de la
 * carte.
 *
 * Aucune adresse : le talent a un point d'entrée, son interlocuteur. Un
 * recruteur joignable en direct serait un canal parallèle que personne n'a
 * décidé d'ouvrir — la vue ne projette d'ailleurs pas les adresses.
 */
export function CarteEquipe({
  titre,
  equipe,
  className,
}: {
  titre: string;
  equipe: MembreEquipe[];
  className?: string;
}) {
  if (equipe.length === 0) return null;
  return (
    <Carte regime="travail" className={cn('flex flex-col gap-3 p-4', className)}>
      <p className="t-caption text-[var(--encre-500)]">{titre}</p>
      <ul className="flex flex-col gap-3">
        {equipe.map((m) => (
          <li key={`${m.role}-${m.nom}`} className="flex items-center gap-3">
            <Avatar nom={m.nom} src={m.photo} taille={42} forme="rond" />
            <div className="min-w-0">
              <p className="t-body-hl truncate text-black">{m.nom}</p>
              <p className="t-caption text-[var(--encre-500)]">{m.role}</p>
            </div>
          </li>
        ))}
      </ul>
    </Carte>
  );
}
