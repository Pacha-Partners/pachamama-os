import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * LE RAFRAÎCHISSEMENT DE SESSION (proxy Next 16).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ CE FICHIER MANQUAIT, ET `lib/supabase/serveur.ts` LE SUPPOSAIT DÉJÀ
 * ─────────────────────────────────────────────────────────────────────────
 * Son commentaire disait, mot pour mot : « le rafraîchissement de session est
 * assuré par le middleware, cette exception est donc sans conséquence ». Il n'y
 * avait pas de middleware. La conséquence, elle, était bien réelle.
 *
 * Un Server Component ne peut pas ÉCRIRE de cookie — Next l'interdit, et
 * `clientServeur()` avale d'ailleurs l'exception. Or un jeton d'accès Supabase
 * expire au bout d'une heure. Passé ce délai, `@supabase/ssr` tente de le
 * renouveler depuis le composant serveur, ne peut pas enregistrer le nouveau
 * jeton, et la requête part **sans session** : PostgREST l'exécute sous le rôle
 * `anon`, qui n'a aucun droit sur les vues privées.
 *
 * D'où le symptôme, reproduit à l'identique en appelant les vues avec la seule
 * clé publique :
 *
 *     anon → api.ma_fiche        401  permission denied for view ma_fiche
 *     anon → api.mon_entreprise  401  permission denied for view mon_entreprise
 *     anon → api.ma_facturation  401  permission denied for view ma_facturation
 *
 * Ce sont mot pour mot les trois erreurs rencontrées. Elles n'avaient rien d'un
 * GRANT perdu — vérifié, les 24 vues `api` portent leurs droits — ni d'une
 * panne de base : c'était une session expirée que personne ne renouvelait.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE FAIT CE MIDDLEWARE, ET CE QU'IL NE FAIT PAS
 * ─────────────────────────────────────────────────────────────────────────
 * Il appelle `getUser()`, et c'est CET appel qui déclenche le renouvellement ;
 * puis il repose les cookies sur la réponse, ce qu'un Server Component ne sait
 * pas faire. Rien d'autre.
 *
 * Il ne redirige pas, il n'autorise pas, il ne refuse pas : le cloisonnement
 * reste où il doit être — dans les policies de la base et dans la coquille
 * connectée. Un middleware qui garderait les routes déplacerait la décision
 * d'accès dans du code applicatif, ce que ce projet refuse par principe.
 *
 * ⚠ `getUser()` ET NON `getSession()`. Le second lit le cookie et le croit ;
 * le premier fait vérifier le jeton par le serveur d'authentification. Sur un
 * chemin qui décide de la suite, on ne fait pas confiance à un cookie.
 *
 * ⚠ `proxy.ts`, PAS `middleware.ts`. Next 16 a renommé le point d'entrée et
 * fournit un codemod pour la migration. Écrit en `middleware.ts`, il s'exécute
 * mais casse le rendu des routes privées — mesuré : `/talent` rendait 200 avec
 * un corps vide au lieu de rediriger, et onze contrôles du harnais J4 tombaient.
 * Le nom du fichier n'est pas cosmétique.
 */
export async function proxy(requete: NextRequest) {
  let reponse = NextResponse.next({ request: requete });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => requete.cookies.getAll(),
        setAll: (aPoser) => {
          // Les deux écritures sont nécessaires et ne font pas la même chose :
          // la première rend le jeton neuf visible à la SUITE de cette requête
          // (les composants serveur liront ce cookie), la seconde le renvoie au
          // navigateur pour les requêtes d'après.
          aPoser.forEach(({ name, value }) => requete.cookies.set(name, value));
          reponse = NextResponse.next({ request: requete });
          aPoser.forEach(({ name, value, options }) =>
            reponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // L'appel qui renouvelle. Son résultat ne nous intéresse pas : une session
  // absente est un cas normal — le job board public se sert sans compte.
  await supabase.auth.getUser();

  return reponse;
}

export const config = {
  /**
   * Tout, sauf ce qui n'a pas de session à renouveler : les fichiers servis par
   * Next, les images, le favicon. Faire tourner un aller-retour d'authentification
   * pour une icône serait payer une latence pour rien.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)'],
};
