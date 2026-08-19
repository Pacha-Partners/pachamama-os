/**
 * Pagination complète et VÉRIFIÉE d'une ressource PostgREST.
 *
 * Deux défauts classiques sont traités ici, tous deux silencieux :
 *
 * 1. `if (rows.length < taille) break` — une page revenue incomplète pour
 *    une raison transitoire coupe la boucle sans erreur. On lit donc
 *    d'abord le TOTAL EXACT, puis on boucle jusqu'à l'avoir atteint, et
 *    on ÉCHOUE si le compte final ne correspond pas. Un chargement
 *    partiel doit crier, pas se taire.
 *
 * 2. Pagination sans ORDER BY — PostgreSQL ne garantit aucun ordre stable
 *    entre deux requêtes, donc les pages peuvent se chevaucher ou en
 *    sauter. Le tri est ici obligatoire.
 */
export async function toutesLesLignes({ url, cle, schema, chemin, tri, taille = 1000 }) {
  if (!tri) throw new Error('toutesLesLignes: le tri est obligatoire (pagination stable)');
  const entetes = (extra = {}) => ({
    apikey: cle, Authorization: `Bearer ${cle}`, 'Accept-Profile': schema, ...extra,
  });
  const sep = chemin.includes('?') ? '&' : '?';
  const urlTriee = `${url}/rest/v1/${chemin}${sep}order=${tri}.asc`;

  // Total exact, avant toute pagination.
  const tete = await fetch(urlTriee, { headers: entetes({ Prefer: 'count=exact', Range: '0-0' }) });
  if (!tete.ok) throw new Error(`${chemin} → HTTP ${tete.status} ${(await tete.text()).slice(0, 200)}`);
  const total = Number((tete.headers.get('content-range') ?? '/0').split('/')[1]);

  const lignes = [];
  let vides = 0;
  while (lignes.length < total) {
    const res = await fetch(urlTriee, {
      headers: entetes({ Range: `${lignes.length}-${lignes.length + taille - 1}` }),
    });
    if (!res.ok) throw new Error(`${chemin} → HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const page = await res.json();
    if (!page.length) {
      // Deux pages vides d'affilée alors que le total n'est pas atteint :
      // on refuse de rendre un résultat tronqué.
      if (++vides >= 2) break;
      continue;
    }
    vides = 0;
    lignes.push(...page);
  }
  if (lignes.length !== total) {
    throw new Error(`${chemin} : pagination incomplète — ${lignes.length} lignes lues sur ${total} annoncées`);
  }
  return lignes;
}

/**
 * Lecture des N PREMIÈRES lignes, triées.
 *
 * Distincte de `toutesLesLignes` : PostgREST refuse un `limit` dans l'URL
 * combiné à un en-tête Range (HTTP 416). On borne donc par le Range seul.
 */
export async function premieresLignes({ url, cle, schema, chemin, tri, n }) {
  if (!tri) throw new Error('premieresLignes: le tri est obligatoire');
  const sep = chemin.includes('?') ? '&' : '?';
  const res = await fetch(`${url}/rest/v1/${chemin}${sep}order=${tri}.asc`, {
    headers: { apikey: cle, Authorization: `Bearer ${cle}`, 'Accept-Profile': schema,
               Range: `0-${n - 1}` },
  });
  if (!res.ok) throw new Error(`${chemin} → HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
