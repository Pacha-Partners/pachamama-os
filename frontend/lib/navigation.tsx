import { Icone } from '@/components/pacha/Icone';
import type { Portail } from '@/lib/acces';

/**
 * LA BARRE LATÉRALE, PORTAIL PAR PORTAIL.
 *
 * `CoquilleConnectee` montait `<Menu sections={[]} />` pour les quatre portails
 * au jalon 2, et le commentaire disait pourquoi : « poser dès maintenant des
 * entrées vers des pages inexistantes donnerait une navigation qui ment ». La
 * règle tient toujours, et c'est elle qui autorise le portail TALENT à recevoir
 * ses entrées : ses cinq écrans existent, et chacune de ces entrées mène à une
 * route réelle. Les deux portails INTERNES — recruteur, back-office — gardent
 * leur barre vide jusqu'à ce que leurs écrans existent.
 *
 * ── DES ICÔNES LUCIDE, PLUS D'ÉMOJIS ───────────────────────────────────────
 * Le Figma dessine des émojis, et `Menu` les acceptait seuls. Mais `ElementMenu`
 * porte depuis toujours une union fermée `{emoji} | {icone}` — le commentaire de
 * `Menu.tsx` dit lui-même pourquoi : « à cette taille les émojis rendent
 * inégalement d'une plateforme à l'autre, et ils ne suivent pas la couleur du
 * texte ». Le second point est décisif dans une barre latérale dont l'entrée
 * active passe en violet : un émoji restait à sa couleur propre.
 *
 * Le type des sections de `Menu` a donc été élargi à ce même
 * `VisuelElementMenu` — ajout purement additif, aucun contrat cassé, et
 * `Menu` fait déjà `{...e}` vers `ElementMenu` : rien à changer au rendu.
 *
 * On passe par `Icone` et non par un import direct de `lucide-react` : c'est le
 * point unique où le design system règle la cote (24px) et la question
 * décoratif/signifiant. Ici l'icône est décorative — `ElementMenu` la pose sous
 * `aria-hidden`, le sens est porté par le libellé.
 *
 * Ce fichier est un `.tsx` pour cette raison : il produit des éléments.
 */

export type SectionMenu = {
  titre?: string;
  entrees: {
    libelle: string;
    href: string;
    desactive?: boolean;
    icone: React.ReactNode;
  }[];
};

const ENTREPRISE: SectionMenu[] = [
  {
    entrees: [
      {
        icone: <Icone nom="icon-bar-chart-2" className="size-4" />,
        libelle: 'Tableau de bord',
        href: '/entreprise',
      },
    ],
  },
  {
    titre: 'Recrutements',
    entrees: [
      {
        icone: <Icone nom="icon-plus" className="size-4" />,
        libelle: 'Ouvrir un poste',
        href: '/entreprise/mandats/nouveau',
      },
    ],
  },
  {
    titre: 'Mon compte',
    entrees: [
      {
        icone: <Icone nom="icon-user" className="size-4" />,
        libelle: 'Mes informations',
        href: '/entreprise/compte',
      },
      {
        icone: <Icone nom="icon-briefcase" className="size-4" />,
        libelle: 'Profil entreprise',
        href: '/entreprise/profil',
      },
      {
        icone: <Icone nom="icon-file-text" className="size-4" />,
        libelle: 'Contrat & factures',
        href: '/entreprise/facturation',
      },
    ],
  },
];

/**
 * LE PORTAIL TALENT — une liste PLATE, sans titres de section.
 *
 * Les cinq entrées forment UN seul parcours : mon espace, puis les trois écrans
 * qui remplissent le dossier, puis mes données. Les grouper sous des titres de
 * une ou deux entrées ajouterait du vocabulaire sans ajouter d'orientation —
 * alors que côté entreprise « Recrutements » et « Mon compte » séparent deux
 * activités réellement distinctes.
 *
 * ⚠ PAS D'ENTRÉE « MES CANDIDATURES », et ce n'est pas un oubli : elles SONT le
 * tableau de bord. Une entrée qui mènerait au même écran que la première ferait
 * douter des deux.
 *
 * Icônes Lucide et non émojis, pour la raison écrite en tête de fichier : dans
 * une barre dont l'entrée active passe en violet, un émoji reste à sa couleur
 * propre.
 */
const TALENT: SectionMenu[] = [
  {
    entrees: [
      {
        icone: <Icone nom="icon-home" className="size-4" />,
        libelle: 'Mon espace',
        href: '/talent',
      },
      // Une seule entrée pour un seul objet : « Mon profil », « Mes attentes »
      // et « Mon parcours » n'écrivaient rien d'autre que la fiche talent.
      // Les trois anciennes routes redirigent vers l'ancre correspondante.
      {
        icone: <Icone nom="icon-user" className="size-4" />,
        libelle: 'Ma fiche',
        href: '/talent/fiche',
      },
      // Le suivi des candidatures a son écran : le tableau de bord n'en garde
      // qu'un aperçu, sinon la page d'accueil devenait un listing.
      {
        icone: <Icone nom="icon-briefcase" className="size-4" />,
        libelle: 'Mes process',
        href: '/talent/process',
      },
      // Les mêmes offres que le job board public, dans la coquille connectée :
      // sans « Login », et « Postuler » y devient « Je suis intéressé·e ».
      {
        icone: <Icone nom="icon-search" className="size-4" />,
        libelle: 'Offres',
        href: '/talent/offres',
      },
      {
        icone: <Icone nom="icon-lock" className="size-4" />,
        libelle: 'Mes données',
        href: '/talent/confidentialite',
      },
    ],
  },
];

const VIDE: SectionMenu[] = [];

/**
 * L'écran où l'on corrige ses propres informations, pour un portail donné.
 *
 * ⚠ ELLE VIT ICI ET NON DANS `lib/acces.ts`, ET CE N'EST PAS UN DÉTAIL.
 * `CoquilleConnectee` est un composant CLIENT. `lib/acces.ts` importe
 * `lib/supabase/serveur.ts` : en importer une VALEUR depuis le client tire tout
 * le module serveur dans le paquet du navigateur, et le build échoue
 * (« next/headers » hors contexte serveur). L'import de `type { Portail }` est
 * effacé à la compilation, lui, d'où la différence. Ce module-ci n'importe
 * qu'un type : il traverse la frontière sans rien emporter.
 *
 * Rendre `null` est un cas normal, pas un trou : les portails internes n'ont
 * pas encore d'écran de compte, et la coquille affiche alors le nom sans en
 * faire un lien — un lien vers un 404 est pire que pas de lien.
 */
export function hrefCompte(portail: Portail | undefined): string | null {
  switch (portail) {
    case 'entreprise':
      return '/entreprise/compte';
    case 'talent':
      return '/talent/fiche';
    default:
      return null;
  }
}

export function sectionsDe(portail: Portail | undefined): SectionMenu[] {
  if (portail === 'entreprise') return ENTREPRISE;
  if (portail === 'talent') return TALENT;
  return VIDE;
}

/**
 * Quelle entrée est « la page où l'on est ».
 *
 * `Menu` compare `cheminActif === entree.href`, une égalité stricte. Sur
 * `/entreprise/mandats/3d03…` aucune entrée ne correspondrait, et la barre
 * n'indiquerait plus rien alors qu'on est bien dans le tableau de bord.
 *
 * On résout donc le chemin AVANT de le passer : l'entrée retenue est celle dont
 * le `href` est le plus long préfixe du chemin courant. La borne `href + '/'`
 * évite qu'un futur `/entreprise/profilage` s'allume sur `/entreprise/profil`.
 *
 * ⚠ C'EST CETTE RÈGLE DU PLUS LONG PRÉFIXE QUI REND LA BARRE TALENT JUSTE.
 * `/talent` est préfixe de tous les autres écrans du portail : sans elle,
 * « Mon espace » resterait allumé en même temps que « Ma fiche ».
 *
 * ⚠ ELLE NE SUFFIT PAS. Certaines routes n'ont pas d'entrée à elles et
 * appartiennent pourtant à une : `/talent/candidatures/<uuid>` est le détail
 * d'un process. Le plus long préfixe qui lui corresponde est `/talent`, si bien
 * que « Mon espace » s'allumait en ouvrant une candidature — ce qui était juste
 * tant que le suivi vivait sur le tableau de bord, et faux depuis que
 * « Mes process » existe. D'où la table de RATTACHEMENTS ci-dessous : elle dit
 * de quelle entrée dépend une route qui n'en a pas.
 *
 * Le contrat de `Menu` reste intact — on lui donne simplement une valeur qu'il
 * sait comparer, plutôt que de lui apprendre à comparer autrement.
 */
const RATTACHEMENTS: { prefixe: string; entree: string }[] = [
  // Le détail d'un process dépend de « Mes process », pas du tableau de bord.
  { prefixe: '/talent/candidatures', entree: '/talent/process' },
];

export function entreeActive(sections: SectionMenu[], chemin: string | null): string | undefined {
  if (!chemin) return undefined;

  // Un rattachement l'emporte sur le préfixe — mais seulement si l'entrée
  // visée existe bien dans les sections servies à ce compte.
  for (const { prefixe, entree } of RATTACHEMENTS) {
    if (chemin !== prefixe && !chemin.startsWith(`${prefixe}/`)) continue;
    if (sections.some((s) => s.entrees.some((e) => e.href === entree))) return entree;
  }

  let meilleure: string | undefined;
  for (const section of sections) {
    for (const entree of section.entrees) {
      const correspond = chemin === entree.href || chemin.startsWith(`${entree.href}/`);
      if (correspond && (!meilleure || entree.href.length > meilleure.length)) {
        meilleure = entree.href;
      }
    }
  }
  return meilleure;
}
