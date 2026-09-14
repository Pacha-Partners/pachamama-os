import { redirect } from 'next/navigation';

import { moiCourant, vueParDefaut } from '@/lib/acces';

/**
 * La racine n'affiche rien : elle aiguille.
 *
 * Sans accès — visiteur, ou compte authentifié que le modèle ne connaît pas —
 * on part sur `/login`. Avec accès, on part sur SA première vue.
 *
 * La destination est décidée par `api.moi`, donc par `app.acces`, et non par un
 * claim `app_metadata.roles` que rien n'écrit dans ce dépôt. C'est le seul
 * moyen d'envoyer un administrateur ailleurs que sur l'espace talent.
 */
export default async function Racine() {
  const moi = await moiCourant();
  if (!moi) redirect('/login');
  redirect(vueParDefaut(moi) ?? '/login');
}
