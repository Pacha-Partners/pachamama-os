import Link from 'next/link';

import { Avatar } from '@/components/pacha/Avatar';
import { Bouton } from '@/components/pacha/Bouton';
import { BoutonCopier } from '@/components/pacha/BoutonCopier';
import { Carte } from '@/components/pacha/Carte';
import { Icone } from '@/components/pacha/Icone';
import { TagInfo } from '@/components/pacha/Tag';
import { Titre } from '@/components/pacha/Titre';
import { decouperEtape, libelleFonction } from '@/lib/domaine/entreprise';
import { cn } from '@/lib/utils';

/**
 * LES PETITES PIÈCES DU PORTAIL ENTREPRISE, composées ici et non ajoutées au
 * design system.
 *
 * La règle du lot est claire : on ne modifie aucun contrat de
 * `components/pacha/`, et on peut en ajouter. Ce qui suit n'est ni assez
 * général ni assez éprouvé pour mériter d'y entrer — c'est de la composition
 * d'écran, pas du système. Le jour où le portail talent en aura besoin à
 * l'identique, la question se reposera.
 */

/* ══════════════════════════════════════════════════════════════════════════
   Le cadre d'un écran
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * La largeur et le rythme vertical, écrits une fois.
 *
 * `CoquilleConnectee` pose déjà un rembourrage de 12px autour de tout et
 * enveloppe la page dans son `<main id="contenu">` : les écrans n'ajoutent donc
 * ni `<main>` ni fond, seulement leur gouttière et leur largeur maximale.
 *
 * 1180px : la largeur au-delà de laquelle un tableau de neuf colonnes se met à
 * flotter au milieu du vide, mesuré sur le tableau de bord.
 */
export function CadreEcran({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto flex w-full max-w-[1180px] flex-col gap-8 pb-16 pt-2', className)}>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   La pastille d'étape
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * L'étape d'une candidature, vue du client.
 *
 * POURQUOI PAS `StatutProcess` DU DESIGN SYSTEM. Ce composant est excellent et
 * on ne le touche pas — mais son contrat est une union fermée de onze étapes
 * INTERNES, en anglais, avec leurs couleurs relevées du Figma :
 * `'send-out-violet' | 'interview-1' | … | 'ko'`, libellés « Send out »,
 * « KO ». Le client, lui, doit lire « Profil présenté » et « Écarté·e par vos
 * soins » (décision D-02), et la couleur vient de `ref.etape_process`, pas du
 * Figma. Les deux vocabulaires ne coïncident pas et ne doivent pas coïncider :
 * élargir l'union du DS ferait entrer le registre client dans un composant qui
 * sert aussi le kanban interne.
 *
 * La forme, elle, est copiée à l'identique — mêmes cotes, même
 * `--h-statut`, même rayon plein, même `t-body-hl`, même emoji `aria-hidden`.
 *
 * LE TEXTE RESTE NOIR quelle que soit la couleur reçue, parce que c'est la
 * règle dure du système. Les cinq couleurs mesurées sur le dev sont toutes
 * claires (#8657FF, #FFEA4D, #79E6BE, #F4728A) et le noir y passe AA. Une
 * couleur sombre ajoutée un jour au référentiel casserait ce contraste : c'est
 * un risque porté par la donnée, pas par ce composant, et il se réglera là-bas.
 */
export function PastilleEtape({
  etape,
  couleur,
  className,
}: {
  /** Le libellé tel que la vue le rend, emoji compris. « 👌 Profil présenté ». */
  etape: string | null;
  /** `ref.etape_process.couleur_pastille`. Absente ⇒ fond neutre. */
  couleur: string | null;
  className?: string;
}) {
  const { emoji, libelle } = decouperEtape(etape);
  return (
    <span
      style={couleur ? { background: couleur } : undefined}
      className={cn(
        'inline-flex h-[var(--h-statut)] items-center gap-2 rounded-[var(--r-full)] px-2',
        't-body-hl whitespace-nowrap text-black',
        !couleur && 'bg-[var(--fond-inerte)]',
        className,
      )}
    >
      {emoji && <span aria-hidden="true">{emoji}</span>}
      {libelle}
    </span>
  );
}

/** La même chose en légende, pour une carte où la pastille pleine écraserait tout. */
export function EtapeTexte({
  etape,
  className,
}: {
  etape: string | null;
  className?: string;
}) {
  const { emoji, libelle } = decouperEtape(etape);
  return (
    <span className={cn('t-caption text-[var(--encre-500)]', className)}>
      {emoji && <span aria-hidden="true">{emoji} </span>}
      {libelle}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   L'en-tête d'un écran
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * L'en-tête commun aux six écrans : le duo de titre de la marque, une phrase
 * de contexte, et la rangée d'actions.
 *
 * `Titre` impose son duo descriptif + impact — c'est la règle non négociable de
 * la charte, jamais une ligne sans l'autre. On la respecte en donnant toujours
 * les deux : « Vos recrutements chez / Hublo ».
 */
export function EnteteEcran({
  descriptif,
  impact,
  souligne,
  chapeau,
  retour,
  actions,
}: {
  descriptif: string;
  impact: string;
  /** Le trait de feutre sous la ligne d'impact. Voir la règle sur `Titre`. */
  souligne?: boolean;
  /** Une ou deux phrases sous le titre. Ce que l'écran fait, pas ce qu'il est. */
  chapeau?: React.ReactNode;
  /** Le lien de remontée, quand l'écran est un détail. */
  retour?: { href: string; libelle: string };
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4">
      {retour && (
        <Link
          href={retour.href}
          className={cn(
            't-caption-hl inline-flex w-fit items-center gap-1.5 text-[var(--encre-600)]',
            'rounded-[var(--r-xs)] hover:text-black',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black',
          )}
        >
          <Icone nom="icon-arrow-left" className="size-3.5" />
          {retour.libelle}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Titre niveau={1} descriptif={descriptif} impact={impact} souligne={souligne} />
          {chapeau && (
            <p className="t-body mt-3 max-w-[68ch] text-[var(--encre-600)]">{chapeau}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   L'interlocuteur Pachamama
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * La carte de l'Account Manager, ou de l'agent en charge d'un mandat.
 *
 * ⚠ ELLE PEUT ÊTRE VIDE, et souvent elle l'est : mesuré le 09/09, deux des
 * trois comptes de test n'ont AUCUN `account_manager_id` sur leur fiche
 * entreprise. La carte rend alors `null` plutôt qu'un cadre avec un avatar
 * anonyme — la règle de la fiche d'offre, « dès qu'il manque une information,
 * le bloc disparaît », vaut ici aussi.
 */
export function CarteInterlocuteur({
  titre,
  nom,
  photo,
  fonction,
  email,
  precision,
  className,
}: {
  titre: string;
  nom: string | null;
  photo: string | null;
  fonction: string | null;
  email?: string | null;
  precision?: string;
  className?: string;
}) {
  if (!nom) return null;
  const role = libelleFonction(fonction);
  return (
    <Carte regime="travail" className={cn('flex flex-col gap-3 p-4', className)}>
      <p className="t-caption text-[var(--encre-500)]">{titre}</p>
      <div className="flex items-center gap-3">
        <Avatar nom={nom} src={photo} taille={42} forme="rond" />
        <div className="min-w-0">
          <p className="t-body-bold truncate text-black">{nom}</p>
          {role && <p className="t-caption truncate text-[var(--encre-500)]">{role}</p>}
        </div>
      </div>
      {email && (
        <a
          href={`mailto:${email}`}
          className={cn(
            't-caption-hl inline-flex w-fit items-center gap-1.5 text-black underline underline-offset-2',
            'rounded-[var(--r-xs)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black',
          )}
        >
          <Icone nom="icon-mail" className="size-3.5" />
          {email}
        </a>
      )}
      {precision && <p className="t-caption text-[var(--encre-600)]">{precision}</p>}
    </Carte>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Une valeur, ou son absence assumée
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Une ligne « libellé / valeur » qui SAIT DIRE qu'elle est vide.
 *
 * `InfoLigne` du design system attend une valeur et l'affiche ; ici la moitié
 * des colonnes du portail sont nulles sur les données réelles (fondateur,
 * SIRET, série de financement, adresse de facturation…). Un tiret cadratin gris
 * dit « rien de saisi » sans laisser croire à un défaut d'affichage, et sans
 * faire disparaître la ligne — sur un écran d'ÉDITION, savoir ce qui manque est
 * l'information principale.
 */
export function Champ({
  libelle,
  valeur,
  className,
}: {
  libelle: string;
  valeur: React.ReactNode;
  className?: string;
}) {
  const vide = valeur === null || valeur === undefined || valeur === '';
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {/* `t-caption-bold` en noir, et non un gris clair : c'est l'étiquette
          d'une donnée, au même rang que le libellé d'un champ de saisie quelques
          lignes plus haut dans la même page. En `--encre-500` elle passait
          derrière sa propre valeur et la ligne se lisait à l'envers. */}
      <dt className="t-caption-bold text-black">{libelle}</dt>
      {/* ⚠ « Non renseigné » EN TOUTES LETTRES, PLUS UN TIRET CADRATIN.
          Le tiret demandait un `aria-hidden` doublé d'un `sr-only` pour être
          compris des lecteurs d'écran — preuve qu'il ne se comprenait pas
          seul. Écrit, il dit la même chose à tout le monde, et le gris pâle
          suffit à le distinguer d'une vraie valeur. */}
      <dd className={cn('t-body-hl', vide ? 'text-[var(--encre-300)]' : 'text-black')}>
        {vide ? 'Non renseigné' : valeur}
      </dd>
    </div>
  );
}

/** La grille de `Champ`. Une `<dl>` réelle : les lecteurs d'écran l'annoncent. */
export function GrilleChamps({
  children,
  colonnes = 2,
  className,
}: {
  children: React.ReactNode;
  colonnes?: 2 | 3;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-4',
        colonnes === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2',
        className,
      )}
    >
      {children}
    </dl>
  );
}

/**
 * Une rubrique de tags, ou rien du tout.
 *
 * Le `return null` sur liste vide n'est pas une commodité : la fiche d'un
 * candidat compte désormais dix rubriques de ce genre, et la plupart des fiches
 * n'en portent que trois ou quatre. Rendre les autres avec un tiret cadratin
 * remplirait l'écran de vide et masquerait ce qui est réellement renseigné.
 */
export function ListeTags({
  libelle,
  valeurs,
}: {
  libelle: string;
  valeurs: readonly string[];
}) {
  if (valeurs.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="t-caption text-[var(--encre-500)]">{libelle}</p>
      <ul className="flex flex-wrap gap-2">
        {valeurs.map((v) => (
          <li key={v}>
            <TagInfo>{v}</TagInfo>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * L'ÉQUIPE PACHAMAMA SUR UN POSTE — l'Account Manager ET les recruteurs.
 *
 * Le portail ne montrait que l'AM. Or `core.mandat` porte trois rattachements,
 * et la mesure inverse l'intuition : le **recruteur est renseigné sur 89 % des
 * 533 mandats, l'AM sur 75 %**. Le client voyait donc le champ le moins rempli,
 * et pas celui de la personne qui cherche réellement pour lui.
 *
 * DEUX RÔLES, DEUX FONCTIONS DIFFÉRENTES, ET LA DISTINCTION COMPTE :
 * l'AM est le point d'entrée — c'est à lui qu'on parle pour ouvrir un poste ou
 * ajuster un brief ; les recruteurs sont ceux qui sourcent et qualifient. Les
 * fondre dans une liste indifférenciée ferait perdre à qui s'adresser.
 *
 * AUCUNE ADRESSE ÉLECTRONIQUE POUR LES RECRUTEURS : le client passe par son AM,
 * qui est son interlocuteur unique. Un recruteur nommé et joignable en direct
 * ouvrirait un canal parallèle que personne n'a décidé d'ouvrir — c'est la même
 * règle que pour les coordonnées d'un candidat (D-14).
 *
 * La carte disparaît si personne n'est rattaché : 31 mandats sur 533 n'ont
 * aucun des trois, et une carte « Votre équipe » vide se lit comme un défaut.
 */
export function CarteEquipe({
  amNom,
  amPhoto,
  amFonction,
  amEmail,
  recruteurs,
  className,
}: {
  amNom: string | null;
  amPhoto: string | null;
  amFonction: string | null;
  amEmail?: string | null;
  recruteurs: { nom: string | null; photo: string | null; fonction: string | null }[];
  className?: string;
}) {
  const equipe = recruteurs.filter((r) => r.nom);
  if (!amNom && equipe.length === 0) return null;

  return (
    <Carte regime="travail" className={cn('flex flex-col gap-4 p-4', className)}>
      <h2 className="t-h3">L’équipe Pachamama</h2>

      {/* ⚠ LES RECRUTEURS D'ABORD, L'ACCOUNT MANAGER APRÈS.
          Ce sont eux qui font avancer le poste : ils appellent les candidats,
          organisent les entretiens, remontent les retours. L'Account Manager
          tient la relation commerciale, ce qui est un autre métier et une autre
          fréquence. Mesuré sur les 9 mandats du compte de test : `recruteur_nom`
          est renseigné 9 fois sur 9, un second recruteur 3 fois. Les placer en
          second faisait lire la carte à l'envers — la même inversion avait été
          corrigée côté talent. */}
      {equipe.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="t-micro-hl uppercase tracking-[0.04em] text-[var(--encre-500)]">
            {equipe.length > 1 ? 'Recruteurs sur ce poste' : 'Recruteur sur ce poste'}
          </p>
          <ul className="flex flex-col gap-2">
            {equipe.map((r) => (
              <li key={r.nom}>
                <Personne nom={r.nom} photo={r.photo} fonction={r.fonction} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {amNom && (
        <div className="flex flex-col gap-2">
          <p className="t-micro-hl uppercase tracking-[0.04em] text-[var(--encre-500)]">
            Account manager
          </p>
          <Personne nom={amNom} photo={amPhoto} fonction={amFonction} />
          {amEmail && (
            <a
              href={`mailto:${amEmail}`}
              className="t-caption-hl w-fit text-[var(--violet-700)] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              {amEmail}
            </a>
          )}
        </div>
      )}
    </Carte>
  );
}

function Personne({
  nom,
  photo,
  fonction,
}: {
  nom: string | null;
  photo: string | null;
  fonction: string | null;
}) {
  if (!nom) return null;
  const role = libelleFonction(fonction);
  return (
    <div className="flex items-center gap-3">
      <Avatar nom={nom} src={photo} taille={42} forme="rond" />
      <div className="min-w-0">
        <p className="t-body-bold truncate text-black">{nom}</p>
        {role && <p className="t-caption truncate text-[var(--encre-500)]">{role}</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Un bloc dont on peut emporter le contenu
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * UNE CARTE AVEC SON BOUTON DE COPIE, EN HAUT À DROITE, AU SURVOL.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI BLOC PAR BLOC ET PAS SEULEMENT LA FICHE ENTIÈRE
 * ─────────────────────────────────────────────────────────────────────────
 * « Copier la fiche » sert à transmettre le dossier complet à l'équipe de
 * décision. Mais on colle rarement tout : on envoie les prétentions à la paie,
 * le parcours au manager, les liens au service juridique. Copier le tout pour
 * en effacer les trois quarts est le geste qu'on fait aujourd'hui faute de
 * mieux.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ IL APPARAÎT AU SURVOL, MAIS IL RESTE ATTEIGNABLE AU CLAVIER
 * ─────────────────────────────────────────────────────────────────────────
 * C'est la faute classique de ce motif. Trois précautions :
 *
 *  · `opacity-0` et NON `hidden` ni `display:none` — un élément masqué ainsi
 *    sort de l'ordre de tabulation, et le bouton deviendrait inatteignable
 *    sans souris ;
 *  · `group-focus-within` le révèle dès qu'il prend le focus, sinon on
 *    tabulerait sur un bouton invisible ;
 *  · `@media (hover: none)` le laisse visible en permanence — sur un écran
 *    tactile, il n'y a pas de survol, et la fonction n'existerait tout
 *    simplement pas.
 *
 * Le titre porte un `pr-` généreux : le bouton est posé en absolu, il ne
 * pousse rien, et sans cette réserve un titre long passerait dessous.
 */
export function BlocCopiable({
  titre,
  texte,
  libelleCopie,
  children,
  className,
}: {
  titre: string;
  /** Ce qui part dans le presse-papier. Vient des sérialiseurs du domaine. */
  texte: string;
  /** Ce que le bouton annonce une fois copié. « Profil copié ». */
  libelleCopie: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Carte regime="travail" className={cn('group relative flex flex-col gap-4 p-5', className)}>
      <h2 className="t-h3 pr-28">{titre}</h2>
      <div
        className={cn(
          'absolute right-4 top-4',
          'opacity-0 transition-opacity duration-150',
          'group-hover:opacity-100 group-focus-within:opacity-100',
          '[@media(hover:none)]:opacity-100',
          'motion-reduce:transition-none',
        )}
      >
        <BoutonCopier
          texte={texte}
          libelle="Copier"
          libelleCopie={libelleCopie}
          apparence="contour"
          taille="sm"
        />
      </div>
      {children}
    </Carte>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   La barre d'enregistrement
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ ELLE EXISTAIT EN TROIS EXEMPLAIRES, ET C'EST CE QUI L'A FAIT DÉRIVER.
 *
 * Une copie dans les atomes du portail talent, une locale dans
 * `ProfilEntreprise`, une recopiée à la main dans `MonCompteForm`. Quand la
 * première a été bornée à 760px et centrée, les deux autres sont restées
 * pleine largeur — et personne ne l'a vu, puisque rien ne les relie. Elle vit
 * désormais ici, dans le module que les deux portails partagent déjà, et le
 * portail talent la réexporte avec les sept autres pièces communes.
 */
export function BarreEnregistrement({
  modifie,
  enCours,
  onEnregistrer,
  onAnnuler,
  libelle = 'Des modifications ne sont pas enregistrées.',
}: {
  modifie: boolean;
  enCours: boolean;
  onEnregistrer: () => void;
  onAnnuler: () => void;
  libelle?: string;
}) {
  if (!modifie) return null;
  return (
    // `mx-auto max-w-[760px]` : la barre ne s'étire plus sur toute la colonne.
    // Sur « Ma fiche », qui fait trois hauteurs d'écran et près de 900px de
    // large, un bandeau pleine largeur se confondait avec les cartes qu'il
    // surplombe. Bornée et centrée, elle se lit comme ce qu'elle est — le seul
    // élément de l'écran qui SURGIT.
    //
    // ⚠ Cette barre sert aussi le portail entreprise (`ProfilEntreprise`) : la
    // borne y vaut donc aussi, et c'est cohérent — c'est le même geste.
    <div className="sticky bottom-3 z-20 mx-auto flex w-full max-w-[760px] flex-wrap items-center justify-between gap-3 rounded-[var(--r-md)] border-2 border-black bg-[var(--fond-carte)] p-3 shadow-[var(--ombre-3)]">
      <p className="t-caption-hl text-black">{libelle}</p>
      <div className="flex items-center gap-2">
        <Bouton apparence="contour" taille="sm" onClick={onAnnuler} disabled={enCours}>
          Annuler
        </Bouton>
        <Bouton
          apparence="plein"
          taille="sm"
          onClick={onEnregistrer}
          disabled={enCours}
          iconeAvant={<Icone nom="icon-save" />}
        >
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </Bouton>
      </div>
    </div>
  );
}
