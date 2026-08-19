import { clientServeur } from '@/lib/supabase/serveur';

/**
 * Appel de l'API d'accès (FastAPI).
 *
 * RÉPARTITION DES ACCÈS — la décision d'architecture à ne pas perdre :
 *
 *   ÉCRITURES  → toujours ici, par l'API. C'est le seul endroit où la
 *                préséance s'applique, où l'audit se journalise et où la
 *                synchronisation s'orchestre. Le principe verrouillé du
 *                projet est que personne n'écrit en direct.
 *
 *   LECTURES   → directement par Supabase (voir lib/supabase/serveur.ts).
 *                La RLS fait respecter le cloisonnement au niveau du moteur,
 *                sans saut réseau supplémentaire.
 *
 * Dans les deux cas le jeton de l'utilisateur est transmis : sans lui,
 * PostgreSQL ne saurait pas pour qui il travaille et la RLS serait aveugle.
 */
const BASE = process.env.API_URL ?? 'http://127.0.0.1:8000';

export class ErreurApi extends Error {
  constructor(
    readonly statut: number,
    message: string,
  ) {
    super(message);
    this.name = 'ErreurApi';
  }
}

export async function appelApi<T>(
  chemin: string,
  options: RequestInit = {},
): Promise<T> {
  const supabase = await clientServeur();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const reponse = await fetch(`${BASE}${chemin}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
      ...options.headers,
    },
    // Données opérationnelles : jamais de cache figé.
    cache: 'no-store',
  });

  if (!reponse.ok) {
    // On ne remonte pas le corps de la réponse tel quel : il peut contenir des
    // détails d'implémentation utiles à un attaquant.
    throw new ErreurApi(reponse.status, `API ${reponse.status} sur ${chemin}`);
  }
  return reponse.json() as Promise<T>;
}
