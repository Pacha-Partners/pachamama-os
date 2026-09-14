#!/usr/bin/env node
/**
 * Crée dans Supabase Auth les utilisateurs des comptes pré-provisionnés.
 *
 *   node --env-file=frontend/.env.local --env-file=../Bubble\ migration/.env \
 *        backend/database/activation/activer_comptes.mjs                  # simulation
 *   ... activer_comptes.mjs --portail interne --appliquer                 # l'équipe
 *   ... activer_comptes.mjs --appliquer                                   # tout le monde
 *
 * POURQUOI CE SCRIPT EXISTE. La reprise a créé 4 158 comptes depuis les
 * utilisateurs Bubble, avec leurs accès, mais sans `auth_id` : personne ne
 * peut se connecter. Il manque, pour chacun, un utilisateur d'authentification
 * portant son adresse.
 *
 * D'OÙ VIENT L'ADRESSE. Pas du miroir : `public.user` n'a jamais eu de colonne
 * courriel. Le connecteur n8n ouvre pourtant l'objet `authentication.email` de
 * Bubble et n'en retient que `email_confirmed`, jetant `email` au passage.
 * On la lit donc directement dans l'API Data de Bubble, où elle est présente
 * sur 4 720 utilisateurs sur 4 720, toutes distinctes.
 *
 * POURQUOI PAS LE RATTACHEMENT PAR COURRIEL. `api.rattacher_compte` cherche la
 * personne par son adresse dans core. Mesuré sur les 4 195 accès : 4 067
 * concordent, 69 portent une AUTRE adresse et 59 n'en portent aucune — dont
 * les 42 accès internes. Sur ces 128 cas la fonction créerait un second
 * compte. On lie donc par IDENTIFIANT : app.compte.id vaut
 * reprise.uid('compte#'||user_id), et l'appariement est exact, 4 158 / 4 158.
 *
 * AUCUN COURRIEL N'EST ENVOYÉ. L'API d'administration crée l'utilisateur en
 * silence. Les comptes naissent SANS MOT DE PASSE : la seule entrée sera la
 * réinitialisation, ce qui est le scénario de mise en ligne prévu.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// Le cache porte 4 720 adresses réelles et le dépôt est PUBLIC : il est
// ignoré par git (.gitignore), et `--cache` permet de le poser ailleurs.
const CACHE_DEFAUT = new URL('./bubble_users.json', import.meta.url).pathname;
const NS = Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex'); // uuid_ns_url

/** uuid v5, la même formule que reprise.uid (socle:40). */
function uid(nom) {
  const h = createHash('sha1').update(Buffer.concat([NS, Buffer.from(nom, 'utf8')])).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const s = b.toString('hex');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

const args = process.argv.slice(2);
const lire = (nom, defaut) => {
  const i = args.indexOf(nom);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : defaut;
};
const APPLIQUER = args.includes('--appliquer');
const PORTAIL = lire('--portail', 'tous');
const LIMITE = Number(lire('--limite', '0')) || 0;
const CACHE = lire('--cache', CACHE_DEFAUT);

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUB = process.env.BUBBLE_API_ROOT;
const JETON = process.env.BUBBLE_TOKEN;
if (!SUPA || !CLE) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes');

// GARDE-FOU : on n'active que le projet de développement. Le projet de
// production héberge aussi Avant-garde ; s'y tromper créerait 4 158 comptes
// dans une base vivante.
if (!SUPA.includes('xavnvkpgbpczblmwlaxk')) {
  throw new Error(`REFUS : cible inattendue ${SUPA}. Ce script ne vise que le projet de développement.`);
}

const entetes = { apikey: CLE, Authorization: `Bearer ${CLE}`, 'Content-Type': 'application/json' };

/** Lecture paginée d'une vue api. Le tri est OBLIGATOIRE : sans ordre stable,
 *  PostgREST rend des doublons d'une page à l'autre et en omet d'autres. */
async function lireVue(chemin, tri) {
  const out = [];
  for (let o = 0; ; o += 1000) {
    const r = await fetch(`${SUPA}/rest/v1/${chemin}&order=${tri}&limit=1000&offset=${o}`, {
      headers: { ...entetes, 'Accept-Profile': 'api' },
    });
    if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status} ${await r.text()}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

async function utilisateursBubble() {
  if (existsSync(CACHE)) {
    const c = JSON.parse(readFileSync(CACHE, 'utf8'));
    console.log(`  ${c.length} utilisateurs Bubble lus du cache`);
    return c;
  }
  if (!BUB || !JETON) throw new Error('BUBBLE_API_ROOT / BUBBLE_TOKEN manquants et aucun cache');
  const tout = [];
  for (let curseur = 0, reste = 1; reste > 0; ) {
    const r = await fetch(`${BUB}/user?limit=100&cursor=${curseur}`, { headers: { Authorization: `Bearer ${JETON}` } });
    if (!r.ok) throw new Error(`Bubble : HTTP ${r.status}`);
    const j = (await r.json()).response;
    for (const u of j.results) {
      tout.push({ id: u._id, email: u.authentication?.email?.email ?? null });
    }
    reste = j.remaining;
    curseur += j.count;
    if (j.count === 0) break;
  }
  writeFileSync(CACHE, JSON.stringify(tout));
  console.log(`  ${tout.length} utilisateurs Bubble lus de l'API`);
  return tout;
}

/** Crée l'utilisateur, ou retrouve le sien s'il existe déjà. Idempotent. */
async function creerUtilisateur(email) {
  const r = await fetch(`${SUPA}/auth/v1/admin/users`, {
    method: 'POST',
    headers: entetes,
    // email_confirm : l'adresse vient de Bubble, où la personne s'authentifie
    // déjà. Aucun mot de passe : la seule entrée sera la réinitialisation.
    body: JSON.stringify({ email, email_confirm: true }),
  });
  if (r.ok) return { id: (await r.json()).id, deja: false };
  const texte = await r.text();
  if (r.status === 422 || /already been registered|already exists/i.test(texte)) {
    const q = await fetch(`${SUPA}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`, { headers: entetes });
    const trouve = q.ok ? (await q.json()).users?.find((u) => u.email?.toLowerCase() === email.toLowerCase()) : null;
    if (trouve) return { id: trouve.id, deja: true };
  }
  throw new Error(`création ${email} : HTTP ${r.status} ${texte.slice(0, 160)}`);
}

async function lier(compte, auth) {
  const r = await fetch(`${SUPA}/rest/v1/rpc/lier_compte`, {
    method: 'POST',
    headers: { ...entetes, 'Content-Profile': 'api' },
    body: JSON.stringify({ p_compte: compte, p_auth: auth }),
  });
  if (!r.ok) throw new Error(`liaison ${compte} : HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
  return (await r.json()) === true;
}

async function main() {
  console.log(`cible   ${SUPA}`);
  console.log(`portail ${PORTAIL}${LIMITE ? ` · limite ${LIMITE}` : ''}`);
  console.log(`mode    ${APPLIQUER ? 'ÉCRITURE' : 'simulation (aucune écriture)'}\n`);

  const bubble = await utilisateursBubble();
  const parCompte = new Map();
  for (const u of bubble) if (u.email) parCompte.set(uid(`https://pachamama.pm/bubble/compte#${u.id}`), u.email);

  const acces = await lireVue('compte_a_activer?select=compte_id,portail,role_interne,prenom,nom', 'compte_id');
  const comptes = new Map();
  for (const a of acces) {
    if (!comptes.has(a.compte_id)) comptes.set(a.compte_id, { ...a, portails: new Set() });
    comptes.get(a.compte_id).portails.add(a.portail);
  }
  console.log(`  ${comptes.size} comptes dormants, ${acces.length} accès\n`);

  let cible = [...comptes.entries()].filter(([, c]) => PORTAIL === 'tous' || c.portails.has(PORTAIL));
  const sansAdresse = cible.filter(([id]) => !parCompte.get(id));
  cible = cible.filter(([id]) => parCompte.get(id));
  if (LIMITE) cible = cible.slice(0, LIMITE);

  console.log(`  ${cible.length} à activer · ${sansAdresse.length} sans adresse Bubble`);
  if (!APPLIQUER) {
    console.log('\n  simulation — relancer avec --appliquer pour écrire');
    return;
  }

  let crees = 0, deja = 0, lies = 0, dejaLies = 0;
  const echecs = [];
  const LOT = 6; // l'API d'administration n'aime pas la rafale
  for (let i = 0; i < cible.length; i += LOT) {
    await Promise.all(cible.slice(i, i + LOT).map(async ([compteId]) => {
      const email = parCompte.get(compteId);
      try {
        const u = await creerUtilisateur(email);
        u.deja ? deja++ : crees++;
        (await lier(compteId, u.id)) ? lies++ : dejaLies++;
      } catch (e) {
        echecs.push({ compteId, message: String(e.message).slice(0, 140) });
      }
    }));
    if ((i / LOT) % 20 === 0) process.stdout.write(`\r  ${Math.min(i + LOT, cible.length)}/${cible.length}`);
  }
  console.log(`\r  ${cible.length}/${cible.length}\n`);
  console.log(`  utilisateurs créés    ${crees}`);
  console.log(`  déjà présents         ${deja}`);
  console.log(`  comptes liés          ${lies}`);
  console.log(`  déjà liés             ${dejaLies}`);
  console.log(`  échecs                ${echecs.length}`);
  for (const e of echecs.slice(0, 8)) console.log(`     ${e.compteId} — ${e.message}`);
}

await main();
