import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Rafraîchit la session à chaque navigation.
 *
 * Nécessaire parce qu'un Server Component ne peut pas écrire de cookie : sans ce
 * passage, un jeton expiré ne serait jamais renouvelé et l'utilisateur serait
 * déconnecté au milieu de son travail.
 *
 * Ce middleware ne décide PAS des autorisations. L'autorisation se joue dans
 * PostgreSQL par la Row Level Security — un contrôle en bordure se contourne,
 * une policy en base ne se contourne pas.
 *
 * ── Pourquoi tout est ici enveloppé dans des garde-fous ────────────────────
 *
 * Un middleware s'exécute sur CHAQUE requête. Une exception levée ici ne casse
 * donc pas une page : elle casse le site entier, avec un
 * `MIDDLEWARE_INVOCATION_FAILED` en 500 sur toutes les routes, y compris celles
 * qui n'ont aucun besoin d'authentification.
 *
 * C'est exactement ce qui s'est produit au premier déploiement : les variables
 * d'environnement Supabase n'étaient pas posées — délibérément, pour qu'un
 * déploiement public de démonstration ne porte aucune clé d'accès à une base
 * contenant des données personnelles — et `createServerClient` recevait deux
 * `undefined`. Les assertions non nulles `!` masquaient le problème à la
 * compilation, et il n'apparaissait qu'en production.
 *
 * Deux protections, dans cet ordre :
 *   1. si l'environnement n'est pas configuré, on ne construit pas de client du
 *      tout — il n'y a pas de session à rafraîchir, ce n'est pas une erreur ;
 *   2. si le rafraîchissement échoue pour toute autre raison (réseau, jeton
 *      illisible, service indisponible), on laisse passer la requête.
 *
 * Le sens sûr de la défaillance est « visiteur non identifié », pas « site en
 * panne » : les pages privées redirigent d'elles-mêmes vers la connexion, et la
 * donnée reste protégée par la RLS quoi qu'il arrive ici.
 */
export async function middleware(requete: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 1. Environnement non configuré : rien à rafraîchir, on passe la main.
  if (!url || !cle) return NextResponse.next({ request: requete });

  let reponse = NextResponse.next({ request: requete });

  try {
    const supabase = createServerClient(url, cle, {
      cookies: {
        getAll: () => requete.cookies.getAll(),
        setAll: (cookiesAPoser) => {
          cookiesAPoser.forEach(({ name, value }) => requete.cookies.set(name, value));
          reponse = NextResponse.next({ request: requete });
          cookiesAPoser.forEach(({ name, value, options }) =>
            reponse.cookies.set(name, value, options),
          );
        },
      },
    });
    await supabase.auth.getUser();
  } catch {
    // 2. Échec du rafraîchissement : on ne bloque pas la navigation.
    return NextResponse.next({ request: requete });
  }

  return reponse;
}

export const config = {
  // On évite les fichiers statiques : les faire passer par ici coûterait sans
  // rien apporter. `icon.svg` est exclu comme les autres images.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
