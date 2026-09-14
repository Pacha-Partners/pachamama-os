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
/**
 * L'environnement porte-t-il de quoi joindre Supabase ?
 *
 * ⚠ CE PRÉDICAT EXISTE PARCE QUE `clientServeur()` MENT. Elle déréférence les
 * deux variables avec des assertions non nulles ; sans elles,
 * `createServerClient` LÈVE. Or « pas de configuration » n'est pas une erreur
 * dans ce projet : c'est l'état d'un aperçu monté avant que les variables
 * soient posées, et celui du déploiement public — qui ne porte volontairement
 * AUCUNE clé d'accès à une base de 30 829 personnes physiques (DEPLOIEMENT.md).
 *
 * Les lectures PRIVÉES n'en ont pas besoin : `moiCourant()` teste déjà
 * l'environnement et rend `null`, ce qui renvoie sur `/login`. Ce sont les
 * pages PUBLIQUES qui lisent la base — le job board — qui doivent s'en servir.
 */
export function environnementConfigure(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

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
