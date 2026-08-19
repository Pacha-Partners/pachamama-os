import { redirect } from 'next/navigation';
import { clientServeur } from '@/lib/supabase/serveur';

/**
 * Racine : oriente selon le rôle plutôt que d'afficher une page neutre.
 *
 * Le rôle est lu dans `app_metadata`, contrôlé côté serveur — jamais dans
 * `user_metadata`, que l'utilisateur peut modifier lui-même.
 */
export default async function Racine() {
  const supabase = await clientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/connexion');

  const roles: string[] = (user.app_metadata?.roles as string[] | undefined) ?? [];
  if (roles.includes('admin')) redirect('/backoffice');
  if (roles.includes('recruteur')) redirect('/recruteur');
  if (roles.includes('entreprise')) redirect('/entreprise');
  redirect('/talent');
}
