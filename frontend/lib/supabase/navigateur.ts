import { createBrowserClient } from '@supabase/ssr';

/**
 * Client Supabase côté NAVIGATEUR.
 *
 * Réservé à ce qui doit vivre dans le navigateur : connexion, déconnexion,
 * écoute des changements de session. Les lectures de données passent par le
 * serveur — rapatrier 30 000 talents dans un navigateur n'aurait aucun sens,
 * et exposerait des données que la RLS filtre mieux en amont.
 */
export function clientNavigateur() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
