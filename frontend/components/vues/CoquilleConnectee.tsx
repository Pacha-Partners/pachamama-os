'use client';

import { Popover } from '@base-ui/react/popover';
import { Building2, ChevronDown, Target, UserRound, Wrench } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Avatar } from '@/components/pacha/Avatar';
import { Bouton } from '@/components/pacha/Bouton';
import { FondDecor } from '@/components/pacha/Decor';
import { Feuille } from '@/components/pacha/Feuille';
import { Icone } from '@/components/pacha/Icone';
import { ElementMenu, Menu } from '@/components/pacha/Menu';
import type { Portail, Vue } from '@/lib/acces';
import { entreeActive, hrefCompte, sectionsDe, type SectionMenu } from '@/lib/navigation';
import { clientNavigateur } from '@/lib/supabase/navigateur';
import { cn } from '@/lib/utils';

/**
 * La coquille des écrans connectés : la barre latérale, l'indicateur de vue, la
 * déconnexion. Le contenu, lui, appartient à chaque route.
 *
 * LA BARRE SE REMPLIT AU FUR ET À MESURE DES ÉCRANS, et pas avant. Le portail
 * entreprise a les siens : `lib/navigation.ts` lui donne ses quatre entrées.
 * Les trois autres portails reçoivent toujours `sections={[]}`, pour la raison
 * qui valait pour les quatre au jalon 2 — poser une entrée vers une page
 * inexistante donne une navigation qui ment.
 *
 * `Menu` compare `cheminActif` à ses `href` par égalité stricte. Sur une route
 * imbriquée (`/entreprise/mandats/<uuid>`) plus rien ne s'allumerait : on lui
 * passe donc l'entrée résolue par `entreeActive`, pas le chemin brut. Son
 * contrat n'est pas touché.
 *
 * L'INDICATEUR DE VUE EST DISCRET PAR NATURE, pas par réglage : la plupart des
 * comptes n'ont qu'un seul accès, et il n'affiche alors qu'un libellé. Il ne
 * devient un menu déroulant que pour ceux qui ont réellement le choix — les 37
 * comptes qui portent deux casquettes, collaborateur ET fiche talent. Proposer
 * une bascule à qui n'a nulle part où aller serait un faux affordance.
 *
 * POURQUOI UN `Popover` ET NON UN `Menu` ARIA. Le panneau contient des LIENS,
 * réemployés tels quels du design system (`ElementMenu`, qui rend un `<li><a>`
 * avec son `aria-current`). Un rôle `menu` imposerait des `menuitem` et rendrait
 * cette liste invalide ; un popover ne prescrit rien et laisse la liste être ce
 * qu'elle est. On garde donc le composant du DS plutôt que d'en recopier les
 * classes ailleurs.
 */
/**
 * L'icône de chaque vue, associée ICI et non dans `lib/acces`.
 *
 * Un composant React ne traverse pas la frontière serveur/client : le module
 * qui lit `api.moi` s'exécute sur le serveur et ne peut transmettre qu'une
 * chaîne. Il envoie donc `cle`, et la correspondance vit du côté client.
 */
const ICONES: Record<Portail, React.ComponentType<{ className?: string }>> = {
  recruteur: Target,
  backoffice: Wrench,
  entreprise: Building2,
  talent: UserRound,
};

function IconeVue({ cle, className }: { cle: Portail; className?: string }) {
  const Icone = ICONES[cle];
  return <Icone className={className} />;
}

export function CoquilleConnectee({
  vues,
  personne,
  children,
}: {
  vues: Vue[];
  /**
   * La personne derrière le compte. Reçue en props et non lue ici : la
   * coquille est un composant client, et `api.moi` se lit avec le jeton, donc
   * côté serveur. Résolue en base sur les trois tables de personne, elle vaut
   * pour les quatre portails.
   */
  personne?: { prenom: string | null; nom: string | null; photoUrl: string | null };
  children: React.ReactNode;
}) {
  const router = useRouter();
  // Le chemin est lu ici plutôt que reçu : une disposition Next ne le connaît
  // pas, et le faire descendre depuis chaque page multiplierait les vérités.
  const cheminActif = usePathname();
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);

  // La vue courante est celle dont le chemin PRÉFIXE celui qu'on regarde :
  // `/entreprise/profil` appartient encore à la vue « Entreprise ». Une égalité
  // stricte renvoyait sur `vues[0]`, donc affichait « Recruteur » à un compte
  // multi-portails posé sur un écran entreprise.
  const courante =
    vues.find((v) => cheminActif === v.href || cheminActif?.startsWith(`${v.href}/`)) ?? vues[0];
  const plusieurs = vues.length > 1;

  const sections = sectionsDe(courante?.portail);
  const entree = entreeActive(sections, cheminActif);

  async function deconnecter() {
    setDeconnexionEnCours(true);
    try {
      await clientNavigateur().auth.signOut();
    } finally {
      // `refresh()` avant `replace()` : sans lui, le Server Component relit son
      // rendu en cache et croit la session encore ouverte. L'ordre compte.
      router.refresh();
      router.replace('/login');
    }
  }

  return (
    // Rembourrage serré : la barre latérale porte déjà son propre filet et son
    // rayon, l'éloigner des bords la faisait flotter au milieu du vide.
    //
    // `relative isolate` : l'isolation crée un contexte d'empilement, ce qui
    // garde le décor en `-z-10` À L'INTÉRIEUR de ce conteneur — donc peint
    // APRÈS sa couleur de fond et AVANT le contenu. C'est l'arrangement exact
    // du job board public. `isolation` ne fait pas de ce bloc le référent d'un
    // `position: fixed` (seuls `transform`, `filter` et `contain` le font), le
    // décor reste donc calé sur la fenêtre et ne défile pas.
    <div className="relative isolate flex min-h-dvh gap-3 bg-[var(--fond-page)] p-3">
      {/* LE DÉCOR SUR LES DEUX PORTAILS CLIENTS, ET PAS SUR LES DEUX INTERNES.
          Il n'était posé que sur l'espace talent, au motif que le portail
          entreprise était un outil de travail. Arbitrage du commanditaire, qui
          tranche autrement : entreprise et talent sont les deux surfaces qu'on
          adresse à quelqu'un d'EXTÉRIEUR au cabinet, et elles portent donc
          l'une comme l'autre les formes de la marque.

          Le portail recruteur et le back-office restent nus : ce sont les
          écrans du cabinet lui-même, ceux qu'on regarde huit heures par jour,
          et la marque n'a rien à y dire à personne.

          Il passe derrière la barre latérale et la barre du haut, toutes deux
          opaques. Le contraste entre `--fond-decor` et `--fond-page` est d'un
          cheveu, donc la coupure ne se remarque pas — mais elle existe, et
          c'est la raison pour laquelle elle est écrite ici. */}
      {(courante?.portail === 'talent' || courante?.portail === 'entreprise') && <FondDecor />}

      <Menu
        sections={sections}
        cheminActif={entree}
        onDeconnexion={deconnexionEnCours ? undefined : deconnecter}
        className="sticky top-3 hidden h-[calc(100dvh-1.5rem)] shrink-0 md:flex"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* Tout à DROITE : le sélecteur commande la zone de contenu, pas la
            barre latérale — le poser à gauche le collait à celle-ci et le
            faisait lire comme son en-tête. */}
        {/* FIGÉE EN HAUT, SUR TOUS LES PORTAILS ET TOUTES LES PAGES.
            Elle porte les deux repères dont on a besoin en permanence : sous
            quel compte on regarde, et dans quelle vue on est. Sur un écran qui
            défile — la fiche talent en fait trois de haut — ces deux repères
            sortaient du champ dès le premier mouvement.

            ⚠ LE FOND EST OBLIGATOIRE, ET LE `before:` AUSSI. Une barre collante
            transparente laisse le contenu défiler au travers. Le fond couvre la
            barre ; le `before:` couvre les 12 px de rembourrage AU-DESSUS
            d'elle, sinon le contenu s'y montrerait en défilant. On ne remonte
            pas la barre à `top-0` : elle s'aligne sur la barre latérale, qui
            commence elle aussi à `top-3`.

            z-30 : au-dessus de la barre d'enregistrement collante (z-20), en
            dessous des panneaux du design system (z-50 et z-[60]). */}
        {/* ⚠ `flex-wrap`, ET CE N'EST PAS UN DÉTAIL DE CONFORT.
            Sans lui, les quatre éléments — Menu, identité, déconnexion, vue —
            ne tiennent pas sur 375px, et comme la barre est en `justify-end`
            le débordement part À GAUCHE : mesuré au viewport de 375, le bouton
            « Menu » était à x = −122, entièrement hors champ, et rien ne permet
            de défiler à gauche de zéro. Sur un téléphone, la navigation était
            donc INATTEIGNABLE — la feuille de navigation ne porte pas la
            déconnexion, on ne pouvait pas non plus retirer un élément. Elles
            passent à la ligne. */}
        <header className="sticky top-3 z-30 flex flex-wrap items-center justify-end gap-2 bg-[var(--fond-page)] pt-1 pb-2 before:absolute before:inset-x-0 before:bottom-full before:h-3 before:bg-[var(--fond-page)] before:content-['']">
          {/* Sur mobile la barre latérale est masquée. Tant qu'elle était vide,
              seule la sortie devait être rattrapée ; maintenant qu'elle porte
              des entrées, il faut aussi pouvoir NAVIGUER. La feuille du design
              system est exactement le gabarit prévu pour ça. */}
          {sections.length > 0 && (
            <NavigationMobile sections={sections} entree={entree} className="mr-auto md:hidden" />
          )}

          {/* QUI EST CONNECTÉ. Demandé deux fois par le commanditaire, et
              légitime : sur un poste partagé, rien ne disait sous quel compte
              on regardait. Cliquable quand le portail courant a un écran de
              compte ; sinon simple mention — un lien vers un 404 est pire que
              pas de lien. */}
          <BlocPersonne personne={personne} href={hrefCompte(courante?.portail)} />

          <Bouton
            apparence="contour"
            taille="sm"
            onClick={deconnecter}
            disabled={deconnexionEnCours}
            className="md:hidden"
          >
            Se déconnecter
          </Bouton>

          {/* `key` sur le chemin : changer de vue REMONTE la pastille, donc
              referme le panneau. Base UI ne le ferme pas de lui-même — ses
              entrées sont des liens, et une navigation client ne démonte
              rien. Remonter vaut mieux qu'un effet qui appelle setState. */}
          {courante && (
            <BasculeVue
              key={cheminActif}
              courante={courante}
              vues={vues}
              plusieurs={plusieurs}
            />
          )}
        </header>

        <main id="contenu" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * La navigation du portail, en mobile.
 *
 * `Feuille` est le gabarit modal du système sous `md` ; on lui donne les mêmes
 * `ElementMenu` que la barre latérale, dans une `<ul>` réelle — le composant du
 * DS rend un `<li><a>`, et il faut donc bien une liste autour, pas un `<div>`.
 *
 * `focusFinal` est fourni : la feuille n'est pas ouverte par un
 * `Dialog.Trigger` de Base UI, qui ne saurait donc pas à qui rendre le focus.
 * Sans lui, la tabulation suivante repart du haut du document.
 *
 * Le clic sur une entrée referme la feuille : une navigation client ne démonte
 * rien, la feuille resterait ouverte par-dessus la page d'arrivée.
 */
function NavigationMobile({
  sections,
  entree,
  className,
}: {
  sections: SectionMenu[];
  entree: string | undefined;
  className?: string;
}) {
  const [ouverte, setOuverte] = useState(false);
  const declencheur = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Bouton
        ref={declencheur}
        apparence="contour"
        taille="sm"
        onClick={() => setOuverte(true)}
        iconeAvant={<Icone nom="icon-menu" />}
        className={className}
      >
        Menu
      </Bouton>
      <Feuille titre="Navigation" ouverte={ouverte} onOuvertureChange={setOuverte} focusFinal={declencheur}>
        <div className="flex flex-col gap-6" onClick={() => setOuverte(false)}>
          {sections.map((s, i) => (
            <div key={s.titre ?? `section-${i}`} className="flex flex-col gap-1">
              {s.titre && <p className="t-h3 px-1 text-[var(--violet-300)]">{s.titre}</p>}
              <ul className="flex flex-col gap-1">
                {s.entrees.map((e) => (
                  <ElementMenu key={e.href} {...e} actif={entree === e.href} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Feuille>
    </>
  );
}

/**
 * L'indicateur de vue.
 *
 * Il était en texte gris sur fond crème, sans cadre : illisible, et rien ne
 * disait qu'on pouvait cliquer. Il porte désormais le boîtier `contour` du
 * design system — le même que n'importe quel bouton secondaire —, un libellé
 * « Vue » en gris qui annonce ce dont il s'agit, et le nom en NOIR, comme la
 * règle dure du DS l'exige.
 *
 * Le cas à un seul accès garde exactement le même boîtier, sans chevron et
 * sans interaction : la page ne change pas de silhouette selon le compte qui
 * la regarde.
 */
function BasculeVue({
  courante,
  vues,
  plusieurs,
}: {
  courante: Vue;
  vues: Vue[];
  plusieurs: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const etiquette = (
    <>
      <IconeVue cle={courante.cle} className="size-4 shrink-0 text-black" />
      <span className="t-caption-hl text-black">{courante.badge}</span>
    </>
  );

  const boitier =
    'inline-flex items-center gap-2 rounded-[var(--r-sm)] border border-[var(--encre-200)] bg-[var(--fond-carte)] px-2.5 py-1.5';


  // Un seul accès : rien à choisir. On affiche, on ne propose pas — un chevron
  // qui n'ouvre sur rien est une promesse non tenue.
  if (!plusieurs) {
    return <p className={boitier}>{etiquette}</p>;
  }

  return (
    <Popover.Root open={ouvert} onOpenChange={setOuvert}>
      <Popover.Trigger
        className={cn(
          boitier,
          // `group` : `data-popup-open` est posé sur le DÉCLENCHEUR, pas sur
          // le chevron. Sans lui, la rotation ne se déclencherait jamais.
          'group cursor-pointer transition-shadow',
          'hover:border-black hover:shadow-[var(--ombre-3)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black',
          'data-[popup-open]:border-black data-[popup-open]:shadow-[var(--ombre-3)]',
        )}
      >
        {etiquette}
        <ChevronDown
          aria-hidden="true"
          className="size-4 text-[var(--encre-500)] transition-transform group-data-[popup-open]:rotate-180"
        />
        <span className="sr-only">Changer de vue</span>
      </Popover.Trigger>
      <Popover.Portal>
        {/* Aligné à DROITE : le panneau descend sous le bouton sans déborder
            du contenu, puisque le bouton est lui-même à droite. */}
        <Popover.Positioner sideOffset={6} align="end">
          <Popover.Popup
            /* Recliquer sur la vue où l'on est déjà ne change pas le chemin,
               donc ne remonte rien : ce clic-ci ferme le panneau. */
            onClick={() => setOuvert(false)}
            className="rounded-[var(--r-md)] border-2 border-black bg-black p-2 shadow-[var(--ombre-3)]"
          >
            <p className="t-micro px-1 pb-1 text-[var(--encre-300)]">Changer de vue</p>
            <ul className="flex w-[180px] flex-col gap-1">
              {vues.map((v) => (
                <ElementMenu
                  key={v.href}
                  icone={<IconeVue cle={v.cle} className="size-4" />}
                  libelle={v.libelle}
                  href={v.href}
                  actif={v.href === courante.href}
                  variante="blanc"
                />
              ))}
            </ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ── Qui est connecté ─────────────────────────────────────────────────────── */

/**
 * Le nom de la personne, en haut à droite, sur les quatre portails.
 *
 * TROIS PARTIS PRIS
 *
 * 1. LE NOM PASSE AVANT L'AVATAR. Une photo n'identifie personne sur un poste
 *    partagé — c'est le nom qu'on cherche quand on se demande « sous quel
 *    compte suis-je ? ». L'avatar l'accompagne, il ne le remplace pas.
 * 2. LE BLOC DISPARAÎT PLUTÔT QUE D'AFFICHER UN BLANC. Une personne dont ni
 *    le prénom ni le nom ne sont renseignés existe en base — `core.contact_client`
 *    ne pose pas de NOT NULL dessus, faute mesurée à la reprise. Rendre « — »
 *    à la place d'un nom se lirait comme un défaut d'affichage.
 * 3. IL N'EST UN LIEN QUE S'IL MÈNE QUELQUE PART. Les portails internes n'ont
 *    pas encore d'écran de compte : `hrefCompte()` rend `null`, et le bloc
 *    reste une mention.
 */
function BlocPersonne({
  personne,
  href,
}: {
  personne?: { prenom: string | null; nom: string | null; photoUrl: string | null };
  href: string | null;
}) {
  const nom = [personne?.prenom, personne?.nom].filter(Boolean).join(' ').trim();
  if (!nom) return null;

  const contenu = (
    <>
      <Avatar nom={nom} src={personne?.photoUrl ?? undefined} taille={30} />
      <span className="t-body-hl max-w-[16ch] truncate text-black">{nom}</span>
    </>
  );

  const habillage = cn(
    'inline-flex items-center gap-2 rounded-[var(--r-md)] px-2 py-1',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black',
  );

  if (!href) {
    return <span className={habillage}>{contenu}</span>;
  }
  return (
    <Link
      href={href}
      className={cn(habillage, 'border border-transparent hover:border-black')}
      title="Mes informations"
    >
      {contenu}
    </Link>
  );
}
