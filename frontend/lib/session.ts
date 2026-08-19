import { clientServeur } from '@/lib/supabase/serveur';

/**
 * Lecture DÉFENSIVE de la session courante.
 *
 * `clientServeur()` déréférence `NEXT_PUBLIC_SUPABASE_URL` et la clé publique
 * avec des assertions non nulles. Si l'environnement n'est pas configuré — le
 * cas d'un premier déploiement, ou d'un aperçu monté avant que les variables
 * soient posées — la construction du client lève, et la page renvoie une erreur
 * serveur au lieu de s'afficher.
 *
 * Or l'absence de configuration d'authentification n'est pas un état d'erreur
 * pour une page publique : c'est un visiteur non identifié. Cette fonction
 * traduit donc toute défaillance de la couche session en `null`, ce qui permet
 * aux vues publiques de rester servies quoi qu'il arrive.
 *
 * Elle ne relâche AUCUN contrôle d'accès : les vues privées lisent la même
 * valeur et redirigent sur `null`, et l'autorisation réelle reste dans les
 * policies PostgreSQL. Échouer vers « non connecté » est le sens sûr.
 */
export async function utilisateurCourant() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  try {
    const supabase = await clientServeur();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/**
 * Rôles de l'utilisateur, lus dans `app_metadata` UNIQUEMENT.
 *
 * `user_metadata` est modifiable par l'utilisateur lui-même : y lire un rôle
 * reviendrait à laisser n'importe qui s'attribuer le rôle administrateur.
 */
export function rolesDe(utilisateur: { app_metadata?: Record<string, unknown> } | null): string[] {
  const brut = utilisateur?.app_metadata?.roles;
  return Array.isArray(brut) ? brut.filter((r): r is string => typeof r === 'string') : [];
}
