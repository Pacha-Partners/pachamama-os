import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Client Supabase côté SERVEUR, porteur de la session de l'utilisateur.
 *
 * C'est par lui que passent les LECTURES. Le jeton de l'utilisateur voyage
 * jusqu'à PostgreSQL, donc les policies de Row Level Security s'appliquent :
 * c'est le moteur de base qui refuse une requête inter-entreprise, pas le code
 * applicatif. Une lecture cloisonnée par du `if` en TypeScript se contourne ;
 * une lecture cloisonnée par RLS, non.
 *
 * On utilise la clé publique, jamais la clé de service : cette dernière
 * contourne la RLS et n'a rien à faire dans un chemin qui sert un utilisateur.
 */
export async function clientServeur() {
  const magasin = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => magasin.getAll(),
        setAll: (cookiesAPoser) => {
          try {
            cookiesAPoser.forEach(({ name, value, options }) =>
              magasin.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Server Component : les cookies sont en lecture
            // seule. Le rafraîchissement de session est assuré par le
            // middleware, cette exception est donc sans conséquence.
          }
        },
      },
    },
  );
}
