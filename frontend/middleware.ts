import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Rafraîchit la session à chaque navigation.
 *
 * Nécessaire parce qu'un Server Component ne peut pas écrire de cookie : sans
 * ce passage, un jeton expiré ne serait jamais renouvelé et l'utilisateur
 * serait déconnecté au milieu de son travail.
 *
 * Ce middleware ne décide PAS des autorisations. L'autorisation se joue dans
 * PostgreSQL par la Row Level Security — un contrôle en bordure se contourne,
 * une policy en base ne se contourne pas.
 */
export async function middleware(requete: NextRequest) {
  let reponse = NextResponse.next({ request: requete });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  );
  await supabase.auth.getUser();
  return reponse;
}

export const config = {
  // On évite les fichiers statiques : les faire passer par ici coûterait sans rien apporter.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
