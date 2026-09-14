#!/usr/bin/env node
/**
 * Harnais du jalon 2 — la connexion, et ce qu'elle ouvre.
 *
 *   npm run verifier:j2                       (comptes lus dans .env.local)
 *   node --env-file=.env.local tests/j2-authentification.mjs --email … --mdp …
 *
 * Il vérifie la chaîne complète avec un VRAI jeton d'utilisateur, pas avec la
 * clé de service : c'est la seule façon de contrôler que les policies laissent
 * réellement passer ce qu'elles doivent, et rien d'autre.
 */
/*
 * ⚠ AUCUNE ADRESSE EN DUR DANS CE FICHIER.
 * Le dépôt `Pacha-Partners/pachamama-os` est PUBLIC, et les comptes de test du
 * projet de développement sont ceux de personnes réelles — c'est la raison pour
 * laquelle `.gitignore` exclut COMPTES_DE_TEST.md en toutes lettres. Les valeurs
 * viennent de `.env.local`, ignoré par git ; sans elles le harnais refuse de
 * tourner plutôt que de passer au vert sur un compte deviné.
 */

import fs from 'node:fs';

const args = process.argv.slice(2);
const lire = (n, defaut = null) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : defaut;
};
// L'argument de ligne de commande l'emporte ; à défaut, `.env.local`. Aucune
// valeur en dur : `npm run verifier:j2` doit marcher sans argument, et le
// fichier doit rester publiable.
const EMAIL = lire('--email', process.env.TEST_TALENT_EMAIL);
const MDP = lire('--mdp', process.env.TEST_MDP);

const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!U || !A) {
  console.error('Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(2);
}
if (!EMAIL || !MDP) {
  console.error(
    'Compte de test absent. Renseignez TEST_TALENT_EMAIL et TEST_MDP dans .env.local,\n' +
      'ou passez --email <adresse> --mdp <mot de passe>. Voir COMPTES_DE_TEST.md (hors git).',
  );
  process.exit(2);
}

let echecs = 0;
const ok = (titre, detail) => console.log(`  ✔ ${titre}${detail ? ` — ${detail}` : ''}`);
const ko = (titre, detail) => {
  echecs++;
  console.log(`  ✘ ${titre}${detail ? ` — ${detail}` : ''}`);
};
const verifier = (condition, titre, detail) => (condition ? ok(titre, detail) : ko(titre, detail));

console.log('\nHarnais J2 — l’authentification et les accès\n');

// ── 1. Anonyme : api.moi ne doit rien rendre
{
  const r = await fetch(`${U}/rest/v1/moi?select=*`, {
    headers: { apikey: A, Authorization: `Bearer ${A}`, 'Accept-Profile': 'api' },
  });
  const corps = r.ok ? await r.json() : null;
  const vide = !corps || corps.length === 0 || corps.every((l) => l.compte_id === null);
  verifier(vide, 'api.moi ne dit rien à un visiteur sans compte', `statut ${r.status}`);
}

// ── 2. La connexion elle-même
const cx = await fetch(`${U}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: A, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: MDP }),
});
const session = cx.ok ? await cx.json() : null;
verifier(Boolean(session?.access_token), 'la connexion rend un jeton', `statut ${cx.status}`);
if (!session?.access_token) {
  console.log('\nJ2 : la connexion a échoué, le reste ne peut pas être contrôlé.');
  process.exit(1);
}

const jeton = { apikey: A, Authorization: `Bearer ${session.access_token}`, 'Accept-Profile': 'api' };

// ── 3. api.moi, avec le jeton de l'utilisateur
const moi = await (await fetch(`${U}/rest/v1/moi?select=*`, { headers: jeton })).json();
const m = Array.isArray(moi) ? moi[0] : null;
verifier(Boolean(m?.compte_id), 'api.moi reconnaît le compte', m?.compte_id ?? 'aucun');

// Les portails viennent de la base — `api.mes_portails()` — et non d'une
// déduction refaite ici. C'était le défaut du modèle précédent.
const portails = m?.portails ?? [];
const graduation = [
  m?.role_recruteur ? `recruteur:${m.role_recruteur}` : null,
  m?.role_backoffice ? `backoffice:${m.role_backoffice}` : null,
].filter(Boolean).join(' · ');
verifier(portails.length > 0, 'le compte porte au moins un accès',
  `${portails.join(' + ')}${graduation ? ` · ${graduation}` : ''}`);

// ── 4. Les vues : une par portail, sans arbitrage côté application
const ORDRE = ['recruteur', 'backoffice', 'entreprise', 'talent'];
const vues = ORDRE.filter((p) => portails.includes(p));
verifier(vues.length === portails.length, 'chaque portail donne exactement une vue',
  `${portails.length} portail(s) → ${vues.length} vue(s)`);
verifier(vues.length > 0, 'au moins une vue est ouverte', vues.join(', ') || 'aucune');
ok('le sélecteur de vue s’affichera', vues.length > 1 ? `${vues.length} vues` : '1 seule vue — libellé simple');

// ── 5. Le jeton n'ouvre pas plus que la clé de service ne le dit
{
  const S = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (S) {
    const service = { apikey: S, Authorization: `Bearer ${S}`, 'Accept-Profile': 'api', Prefer: 'count=exact', Range: '0-0' };
    const jetonCompte = { ...jeton, Prefer: 'count=exact', Range: '0-0' };
    const compte = async (h) => {
      const r = await fetch(`${U}/rest/v1/offre_publique?select=id`, { headers: h });
      return r.ok ? Number(r.headers.get('content-range').split('/')[1]) : -1;
    };
    const [vuUtilisateur, vuService] = await Promise.all([compte(jetonCompte), compte(service)]);
    verifier(vuUtilisateur === vuService && vuUtilisateur > 0,
      'le job board rend la même chose au compte connecté qu’à la clé de service',
      `${vuUtilisateur} vs ${vuService}`);
  }
}

// ── 6. La vue de contrôle qualité ne doit pas être lisible par un compte connecté
{
  const r = await fetch(`${U}/rest/v1/v_fuite_client?select=client`, { headers: jeton });
  const corps = r.ok ? await r.json() : null;
  verifier(!r.ok || !Array.isArray(corps) || corps.length === 0,
    'api.v_fuite_client reste fermée au compte connecté',
    r.ok ? `${Array.isArray(corps) ? corps.length : '?'} ligne(s) LUES` : `statut ${r.status}`);
}

// ── 6 bis. Aucune vue de l'application n'a perdu son GRANT
//
// ⚠ POURQUOI CE CONTRÔLE EXISTE. Un `permission denied for view …` ne se voit
// pas en écrivant du SQL : il surgit dans le navigateur de quelqu'un, au milieu
// d'un écran. C'est arrivé sur `api.mon_entreprise` et `api.ma_facturation`
// pendant une application de migration. Un GRANT perdu est silencieux jusqu'à
// la première lecture — ce contrôle le rend bruyant.
//
// La liste est TENUE À LA MAIN, et c'est délibéré : la dériver des migrations
// ferait qu'une vue oubliée dans les deux endroits passerait inaperçue. Elle
// dit ce que l'application exige, pas ce que le schéma contient.
{
  // ⚠ LA LISTE EST DÉRIVÉE DES MIGRATIONS, PAS ÉCRITE À LA MAIN.
  // Elle l'était, et j'y avais mis `ma_fiche_talent` — qui n'existe pas — en
  // oubliant `ma_fiche`, `mon_compte`, `kanban` et trois autres. Le balayage
  // passait au vert en manquant précisément la vue qui échouait.
  //
  // Seules les vues RÉSERVÉES au rôle de service sont nommées ici : une vue
  // privée ajoutée sans être déclarée sera donc contrôlée, ce qui est le bon
  // sens de défaut.
  const FERMEES = ['compte_a_activer', 'diagnostic_rattachement', 'v_fuite_client'];
  const dossier = new URL('../../supabase/migrations/', import.meta.url);
  const sql = fs
    .readdirSync(dossier)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => fs.readFileSync(new URL(f, dossier), 'utf8'))
    .join('\n');
  const OUVERTES = [
    ...new Set([...sql.matchAll(/create or replace view api\.([a-z_]+)/g)].map((m) => m[1])),
  ].filter((v) => !FERMEES.includes(v));

  const refusees = [];
  for (const v of OUVERTES) {
    const r = await fetch(`${U}/rest/v1/${v}?select=*&limit=1`, { headers: jeton });
    if (r.status === 401 || r.status === 403) {
      const j = await r.json().catch(() => ({}));
      if (/permission denied/i.test(j.message ?? '')) refusees.push(`${v} (${j.message})`);
    }
  }
  verifier(refusees.length === 0,
    'aucune vue de l’application n’a perdu son GRANT',
    refusees.join(' · ') || `${OUVERTES.length} vues lisibles`);

  const ouvertesATort = [];
  for (const v of FERMEES) {
    const r = await fetch(`${U}/rest/v1/${v}?select=*&limit=1`, { headers: jeton });
    if (r.ok) ouvertesATort.push(v);
  }
  verifier(ouvertesATort.length === 0,
    'les vues de service restent fermées à un compte connecté',
    ouvertesATort.join(', ') || `${FERMEES.length} vues fermées`);
}

// ── 7. La déconnexion invalide bien la session
{
  const d = await fetch(`${U}/auth/v1/logout`, {
    method: 'POST',
    headers: { apikey: A, Authorization: `Bearer ${session.access_token}` },
  });
  verifier(d.status === 204 || d.ok, 'la déconnexion est acceptée', `statut ${d.status}`);
}

console.log(echecs === 0 ? '\nJ2 : tous les contrôles passent' : `\nJ2 : ${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);
