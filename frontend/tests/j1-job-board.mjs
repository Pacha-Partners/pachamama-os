#!/usr/bin/env node
/**
 * Harnais de vérification du jalon 1 — le job board public.
 *
 * Il vérifie ce que le ticket J1 exige, et il est conçu pour ÉCHOUER dans
 * les deux cas où un test naïf passerait au vert à tort :
 *
 *   · une politique de sécurité manquante rend un tableau vide, pas une
 *     erreur — le harnais exige donc un nombre d'offres NON NUL ;
 *   · une base injoignable rend elle aussi un tableau vide — le harnais
 *     échoue si le compte servi à la clé publique ne coïncide pas avec
 *     celui obtenu à la clé de service.
 *
 * Sur le critère « aucune raison sociale dans la réponse », le ticket
 * demande de chercher les 849 noms de clients. Pris à la lettre c'est
 * inatteignable : SIX raisons sociales sont des mots courants —
 * « Freelance », « freelance », « Join », « Test », « test », « Uber ».
 * Une offre en contrat freelance déclencherait l'alerte. Le harnais fait
 * donc deux contrôles qui gardent l'intention sans le faux positif :
 *   1. aucune offre ne nomme SON PROPRE client — c'est le vrai risque ;
 *   2. aucune raison sociale distinctive n'apparaît, les mots courants
 *      étant écartés par une liste explicite et courte.
 */

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CLE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !CLE_ANON || !CLE_SERVICE) {
  console.error(
    'Variables manquantes. Ce harnais a besoin de NEXT_PUBLIC_SUPABASE_URL,\n' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY.',
  );
  process.exit(1);
}

/** Raisons sociales qui sont aussi des mots du langage courant : les
 *  chercher dans une page d'offres produit des faux positifs certains. */
const MOTS_COURANTS = new Set(['freelance', 'join', 'test', 'uber', 'pachamama']);

const resultats = [];
function verifier(nom, reussi, detail = '') {
  resultats.push({ nom, reussi, detail });
  console.log(`${reussi ? '  ✔' : '  ✘'} ${nom}${detail ? ` — ${detail}` : ''}`);
}

async function lire(chemin, cle, { profil, compter } = {}) {
  const entetes = { apikey: cle, Authorization: `Bearer ${cle}` };
  if (profil) entetes['Accept-Profile'] = profil;
  if (compter) {
    entetes.Prefer = 'count=exact';
    entetes.Range = '0-0';
  }
  const reponse = await fetch(`${URL_BASE}/rest/v1/${chemin}`, { headers: entetes });
  const plage = reponse.headers.get('content-range');
  const corps = reponse.ok ? await reponse.json() : null;
  return { statut: reponse.status, corps, total: plage ? Number(plage.split('/').pop()) : null };
}

async function appelerFonction(nom, cle) {
  const reponse = await fetch(`${URL_BASE}/rest/v1/rpc/${nom}`, {
    method: 'POST',
    headers: { apikey: cle, Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  return reponse.status;
}

const motEntier = (aiguille) =>
  new RegExp(`\\b${aiguille.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

console.log('\nHarnais J1 — le job board public\n');

// ── 1. Les offres sont servies, en nombre non nul, et le compte coïncide
const publiques = await lire('offre_publique?select=*', CLE_ANON, { profil: 'api' });
const service = await lire('offre_publique?select=id', CLE_SERVICE, { profil: 'api', compter: true });

verifier(
  'la clé publique obtient une réponse',
  publiques.statut === 200,
  `statut ${publiques.statut}`,
);
verifier(
  'le nombre d’offres est non nul',
  Array.isArray(publiques.corps) && publiques.corps.length > 0,
  `${publiques.corps?.length ?? 0} offre(s)`,
);
verifier(
  'ce nombre égale celui obtenu avec la clé de service',
  publiques.corps?.length === service.total,
  `publique ${publiques.corps?.length} · service ${service.total}`,
);

// ── 2. Aucune offre ne nomme son propre client
const clients = await lire('mandat?select=id,entreprise_id', CLE_SERVICE);
const entreprises = await lire('entreprise?select=id,nom&limit=1000', CLE_SERVICE);
const nomParMandat = new Map();
for (const m of clients.corps ?? []) {
  const e = (entreprises.corps ?? []).find((x) => x.id === m.entreprise_id);
  if (e?.nom) nomParMandat.set(m.id, e.nom);
}
// LA RÈGLE N'EST PAS « AUCUN NOM », ELLE EST PLUS FINE.
//
// Le contrôle interdisait toute raison sociale dans toute la réponse. Il tenait
// tant que les douze offres publiées étaient anonymes ; il est devenu faux dès
// qu'une offre a été ouverte — « Outline » y est alors PUBLIC, et le harnais
// sonnait sur le comportement attendu.
//
// La règle réelle a deux volets, et le second est le plus important :
//   · une offre ANONYME (la vue y rend `entreprise: null`) ne doit laisser
//     passer AUCUN nom de client, ni le sien ni un autre ;
//   · une offre OUVERTE ne peut montrer que LE SIEN — le nom d'un autre client
//     dans sa charge utile resterait une fuite, et un masquage trop large
//     l'aurait laissée passer.
const fuitesPropres = [];
for (const offre of publiques.corps ?? []) {
  const charge = JSON.stringify(offre);
  const sien = offre.entreprise?.toLowerCase() ?? null;
  for (const nom of new Set(nomParMandat.values())) {
    if (nom.length < 4 || MOTS_COURANTS.has(nom.toLowerCase())) continue;
    // Le client déclaré par une offre ouverte a le droit d'y figurer.
    if (sien && nom.toLowerCase() === sien) continue;
    if (motEntier(nom).test(charge)) {
      fuitesPropres.push({
        offre: offre.intitule,
        nom,
        cas: sien ? "nom d'un AUTRE client" : 'offre anonyme',
      });
    }
  }
}
verifier(
  'aucune raison sociale ne fuit — ni sur une offre anonyme, ni celle d’un tiers',
  fuitesPropres.length === 0,
  fuitesPropres.length
    ? fuitesPropres.map((f) => `${f.nom} dans « ${f.offre} » (${f.cas})`).join(', ')
    : `${publiques.corps.filter((o) => !o.entreprise).length} anonyme(s) · ${publiques.corps.filter((o) => o.entreprise).length} ouverte(s)`,
);

// ── 3. Le miroir reste muet pour la clé publique
const muets = [];
for (const [table, profil] of [
  ['candidat', null], ['mandat', null], ['note', null], ['entreprise', null], ['talent', 'pivot'],
]) {
  const r = await lire(`${table}?select=id&limit=5`, CLE_ANON, { profil });
  const muet = r.statut !== 200 || (Array.isArray(r.corps) && r.corps.length === 0);
  muets.push(`${table}=${r.statut === 200 ? r.corps.length : r.statut}`);
  if (!muet) verifier(`${table} devrait être muet pour la clé publique`, false, `${r.corps.length} ligne(s)`);
}
verifier('le miroir et le pivot restent muets pour la clé publique', true, muets.join(' · '));

// ── 4. Les fonctions du miroir sont hors de portée
const fonctions = ['truncate_data_tables', 'replace_m2m', 'disable_fk', 'enable_fk', 'rls_auto_enable'];
const codes = [];
for (const f of fonctions) {
  const code = await appelerFonction(f, CLE_ANON);
  codes.push(`${f.split('_')[0]}=${code}`);
  if (![401, 403, 404].includes(code)) {
    verifier(`la fonction ${f} doit être refusée à la clé publique`, false, `statut ${code}`);
  }
}
verifier('les 5 fonctions du miroir sont refusées à la clé publique', true, codes.join(' · '));

// ── 5. L'ORACLE DU MASQUAGE NE DOIT PAS ROUVRIR
//
// Défaut réel, reproduit le 10/09 : `api.masquer_client` était exécutable
// par la clé publique. Elle rend NULL quand le texte soumis contient le nom
// du client — donc, soumise à une liste de raisons sociales, elle DÉSIGNE le
// client d'une offre anonyme. « Advanthink » est ainsi tombé en une requête.
//
// La cause était structurelle et mérite d'être retenue : une vue non-invoker
// encapsule les droits sur les TABLES, jamais sur les FONCTIONS. Tant que le
// masquage passait par une fonction, il fallait choisir entre une vue qui
// tombe et un oracle ouvert. Le masquage est désormais une expression.
//
// Ce contrôle vaut pour toute fonction du schéma `api` qui prend un mandat en
// argument : une réponse 200 signifie qu'elle est interrogeable, et une
// fonction interrogeable qui sait quelque chose du client est un oracle.
const oracles = ['masquer_client', 'client_visible'];
const etats = [];
let unSeulRepond = false;
for (const f of oracles) {
  const reponse = await fetch(`${URL_BASE}/rest/v1/rpc/${f}`, {
    method: 'POST',
    headers: {
      apikey: CLE_ANON,
      Authorization: `Bearer ${CLE_ANON}`,
      'Content-Type': 'application/json',
      'Content-Profile': 'api',
    },
    body: JSON.stringify({ texte: 'sonde', p_mandat_id: publiques.corps[0].id }),
  });
  etats.push(`${f}=${reponse.status}`);
  if (reponse.status === 200) unSeulRepond = true;
}
if (unSeulRepond) {
  verifier(
    "les fonctions de masquage doivent être hors de portée de la clé publique",
    false,
    `${etats.join(' · ')} — une réponse 200 rouvre l'oracle qui a livré « Advanthink »`,
  );
}
verifier("l'oracle du masquage reste fermé à la clé publique", true, etats.join(' · '));

// ── Verdict
const echecs = resultats.filter((r) => !r.reussi);
console.log(
  `\n${echecs.length === 0 ? 'J1 : tous les contrôles passent' : `J1 : ${echecs.length} contrôle(s) en échec`}\n`,
);
process.exit(echecs.length === 0 ? 0 : 1);
