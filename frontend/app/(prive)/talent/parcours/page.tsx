import { redirect } from 'next/navigation';

/**
 * ANCIENNE ROUTE — « Ma fiche » l'a absorbée.
 *
 * Les trois écrans n'écrivaient qu'un seul objet : la fiche talent. Ils sont
 * réunis sur `/talent/fiche`, en trois sections. On redirige plutôt que de
 * supprimer : des liens existent dans la nature — courriels du cabinet, favoris
 * des candidats, invitations ciblées du tableau de bord.
 */
export default function Vue() {
  redirect('/talent/fiche#ce-que-vous-avez-fait');
}
