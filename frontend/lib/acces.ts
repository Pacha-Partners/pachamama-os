import { cache } from 'react';
import { redirect } from 'next/navigation';

import { clientServeur } from '@/lib/supabase/serveur';

/**
 * Qui est connecté, et sur quelles vues il a le droit d'aller.
 *
 * LA SOURCE EST LA BASE, PAS LE JETON. Le dépôt lisait jusqu'ici un tableau
 * `roles` dans `app_metadata` — un claim que RIEN n'écrit, ni la reprise, ni
 * l'application, ni l'administration. Toute personne connectée aurait donc
 * atterri sur l'espace talent, quel que soit son rôle réel. La base, elle, sait
 * exactement : `app.acces` porte une ligne par contexte, et la vue `api.moi`
 * les résume pour le compte courant.
 *
 * `api.moi` est en `security_invoker` : elle s'exécute avec le jeton de
 * l'appelant, donc `api.compte_id()` résout par `auth.uid()`. Un visiteur non
 * connecté n'y lit rien — ce n'est pas une fuite, c'est le mécanisme.
 */

export type Portail = 'talent' | 'entreprise' | 'recruteur' | 'backoffice';

export type Moi = {
  compteId: string;
  /** Les surfaces ouvertes à ce compte. C'est la base qui les dit, pas nous. */
  portails: Portail[];
  estInterne: boolean;
  /** La graduation SUR le portail recruteur : recruteur ou support. */
  roleRecruteur: 'recruteur' | 'support' | null;
  /** La graduation SUR le back-office : admin ou superadmin. */
  roleBackoffice: 'admin' | 'superadmin' | null;
  ficheTalentId: string | null;
  entrepriseIds: string[];
  /**
   * La personne derrière le compte, quelle que soit sa casquette. Résolue en
   * base par `api.mon_identite()` sur les trois tables de personne
   * (contact client, fiche talent, collaborateur) — la coquille des écrans
   * connectés est partagée par les quatre portails et ne sait pas dans lequel
   * elle se trouve.
   */
  prenom: string | null;
  nom: string | null;
  photoUrl: string | null;
};

export type Vue = {
  cle: Portail;
  /** Le nom de la DESTINATION, dans la liste des vues. */
  libelle: string;
  /**
   * Ce que la pastille affiche quand cette vue est la vue courante. Sur un
   * portail interne c'est le RÔLE — « Super Admin » dit quelque chose que
   * « Back-office » ne dit pas, alors que la barre latérale montre déjà où
   * l'on est. Ailleurs, c'est le nom de la vue.
   *
   * PAS D'ICÔNE ICI. Un composant React ne traverse pas la frontière
   * serveur/client : la pastille associe l'icône à `cle`, côté client.
   */
  badge: string;
  href: string;
  portail: Portail;
};

const LIBELLES_ROLE: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  recruteur: 'Recruteur',
  support: 'Support',
};

/** Le contenu brut de la vue `api.moi`, tel que PostgREST le rend. */
type LigneMoi = {
  compte_id: string | null;
  portails: string[] | null;
  est_interne: boolean | null;
  role_recruteur: string | null;
  role_backoffice: string | null;
  fiche_talent_id: string | null;
  entreprise_ids: string[] | null;
  prenom: string | null;
  nom: string | null;
  photo_url: string | null;
};

const PORTAILS: readonly Portail[] = ['talent', 'entreprise', 'recruteur', 'backoffice'];

/**
 * Les colonnes de `api.moi`, ÉNUMÉRÉES.
 *
 * La règle du dépôt vaut ici comme partout : jamais `select('*')` sur une vue
 * `api`. Une colonne ajoutée à la vue ne doit pas descendre dans le client
 * parce que personne n'a réécrit cette ligne — c'est la fuite `titre` de la
 * décision D-06, par la porte de la session.
 */
const COLONNES_MOI =
  'compte_id, portails, est_interne, role_recruteur, role_backoffice, fiche_talent_id, entreprise_ids, prenom, nom, photo_url';

export const moiCourant = cache(async function moiCourant(): Promise<Moi | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  try {
    const supabase = await clientServeur();
    const { data } = await supabase
      .schema('api')
      .from('moi')
      .select(COLONNES_MOI)
      .maybeSingle<LigneMoi>();
    // `compte_id` nul veut dire : authentifié, mais aucun compte ne porte cet
    // `auth_id`. C'est un état réel — une inscription dont l'adresse n'a
    // rencontré personne — et non une erreur. On le traite comme « pas d'accès ».
    if (!data?.compte_id) return null;

    // Les portails ne sont plus DÉDUITS ici : `api.mes_portails()` les rend
    // tels que `app.acces` les porte. On se contente de filtrer les valeurs
    // qu'on sait rendre — une valeur inconnue de l'énuméré ne doit pas
    // fabriquer une vue fantôme.
    const portails = (data.portails ?? []).filter((p): p is Portail =>
      (PORTAILS as readonly string[]).includes(p),
    );

    const rr = data.role_recruteur;
    const rb = data.role_backoffice;
    return {
      compteId: data.compte_id,
      portails,
      estInterne: Boolean(data.est_interne),
      roleRecruteur: rr === 'recruteur' || rr === 'support' ? rr : null,
      roleBackoffice: rb === 'admin' || rb === 'superadmin' ? rb : null,
      ficheTalentId: data.fiche_talent_id,
      entrepriseIds: data.entreprise_ids ?? [],
      prenom: data.prenom,
      nom: data.nom,
      photoUrl: data.photo_url,
    };
  } catch {
    // Même parti pris que `utilisateurCourant` : une couche de session en panne
    // se traduit par « pas d'accès », jamais par une page en erreur.
    return null;
  }
});

/**
 * Les vues ouvertes à ce compte : UNE VUE PAR PORTAIL, sans arbitrage ici.
 *
 * L'application ne décide plus rien. Elle lisait auparavant « un accès interne
 * ouvre le portail recruteur, et le rôle admin y ajoute le back-office » — un
 * arbitrage d'interface, posé faute de règle en base. Le modèle le dit
 * désormais lui-même : administrer et recruter sont deux portails distincts,
 * et un compte peut porter les deux. Il n'y a plus qu'à traduire.
 *
 * L'ordre de la liste est celui de `VUES`, pas celui de la base : c'est un
 * choix d'affichage, et le seul qui reste ici.
 */
const VUES: readonly Omit<Vue, 'badge'>[] = [
  { cle: 'recruteur', libelle: 'Recruteur', href: '/recruteur', portail: 'recruteur' },
  { cle: 'backoffice', libelle: 'Back-office', href: '/backoffice', portail: 'backoffice' },
  { cle: 'entreprise', libelle: 'Entreprise', href: '/entreprise', portail: 'entreprise' },
  { cle: 'talent', libelle: 'Talent', href: '/talent', portail: 'talent' },
];

export function vuesDe(moi: Moi): Vue[] {
  return VUES.filter((v) => moi.portails.includes(v.portail)).map((v) => {
    const role =
      v.portail === 'recruteur'
        ? moi.roleRecruteur
        : v.portail === 'backoffice'
          ? moi.roleBackoffice
          : null;
    return { ...v, badge: (role && LIBELLES_ROLE[role]) || v.libelle };
  });
}

/** Où envoyer quelqu'un qui arrive sans destination. La première vue de sa liste. */
export function vueParDefaut(moi: Moi): string | null {
  return vuesDe(moi)[0]?.href ?? null;
}

/**
 * Le garde d'une vue, appelé par la page elle-même.
 *
 * Il ne peut pas vivre dans la disposition : un layout Next ne connaît pas le
 * chemin demandé. Chaque page déclare donc la vue qu'elle sert, et se refuse à
 * qui n'y a pas droit — un talent qui tape `/backoffice` repart sur SA vue, pas
 * sur une page vide qui lui laisserait croire qu'il y est arrivé.
 */
export async function exigerVue(cle: string): Promise<Moi> {
  const moi = await moiCourant();
  if (!moi) redirect('/login');
  const permises = vuesDe(moi);
  if (!permises.some((v) => v.cle === cle)) redirect(permises[0]?.href ?? '/login');
  return moi;
}
