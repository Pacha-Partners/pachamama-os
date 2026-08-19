import { redirect } from 'next/navigation';

/**
 * L’écran de connexion vit à la racine. Cette route est conservée parce qu’elle
 * est encore la cible de redirections existantes, et parce qu’un lien
 * `/connexion` partagé ne doit pas se casser : elle renvoie vers la racine.
 */
export default function Connexion() {
  redirect('/');
}
