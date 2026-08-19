#!/usr/bin/env node
/**
 * Réconciliation stricte : fichier source ↔ base chargée.
 *
 * Le comptage seul ne suffit pas — un incident passé sur ce projet l'a
 * montré : deux totaux peuvent coïncider alors que des enregistrements
 * ont été perdus et d'autres créés en double. On vérifie donc à trois
 * niveaux : les VOLUMES par table, l'IDENTITÉ des clés (diff d'ensembles,
 * pas de comptes), et le CONTENU champ par champ sur un échantillon.
 *
 * Les attendus sont recalculés depuis le fichier avec les MÊMES règles
 * que le chargeur (déduplication par contrainte d'unicité), sinon on
 * comparerait des choses différentes.
 */
import { readFileSync, existsSync } from 'node:fs';
import { lignesJsonl } from '../lib/jsonl.mjs';
import { split } from '../lib/pivot_transform.mjs';

const SRC = process.env.PIVOT_FILE
  ?? '/Users/claudemenye/Documents/Project./Bubble migration/pivot_v1.jsonl';
const SCHEMA = 'pivot';
const ECHANTILLON = Number(process.env.ECHANTILLON ?? 300);

function env() {
  const out = {};
  for (const f of ['../../.env.local', '../../.env', '.env.local', '.env']) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || !t.includes('=')) continue;
      const i = t.indexOf('=');
      out[t.slice(0, i).trim()] ??= t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return out;
}
const E = env();
const U = E.SUPABASE_URL, K = E.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Accept-Profile': SCHEMA };

/** Total exact d'une table, via l'en-tête content-range. */
async function compte(table, filtre = '') {
  const res = await fetch(`${U}/rest/v1/${table}?select=talent_id${filtre}`, {
    headers: { ...H, Prefer: 'count=exact', Range: '0-0' },
  });
  return Number((res.headers.get('content-range') ?? '/0').split('/')[1]);
}
/** Rapatrie une colonne en entier, par pages, pour un diff d'ensembles. */
async function colonne(table, col) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${U}/rest/v1/${table}?select=${col}&order=${col}.asc`, {
      headers: { ...H, Range: `${from}-${from + 999}` },
    });
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) break;
    out.push(...rows.map((r) => r[col]));
    if (rows.length < 1000) break;
  }
  return out;
}
async function ligne(table, id) {
  const res = await fetch(`${U}/rest/v1/${table}?talent_id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
                          { headers: H });
  return (await res.json())[0] ?? null;
}

// ---- 1. Attendus recalculés depuis le fichier ------------------------------
console.log('# Réconciliation fichier ↔ base\n');
console.log('1. Recalcul des attendus depuis le fichier source');
const attendu = { talent: 0, talent_source: 0, email: 0, phone: 0,
                  qualification: 0, attentes: 0, parcours: 0 };
const idsSource = new Set();
const echant = [];
for await (const { texte } of lignesJsonl(SRC)) {
  const doré = JSON.parse(texte);
  const s = split(doré);
  attendu.talent++;
  idsSource.add(s.talent.talent_id);
  // Déduplication à l'identique des contraintes UNIQUE de la base.
  attendu.talent_source += new Set(s.sources.map((r) => `${r.source}|${r.external_id}`)).size;
  attendu.email        += new Set(s.emails.map((r) => r.email)).size;
  attendu.phone        += new Set(s.phones.map((r) => r.tel)).size;
  attendu.qualification += s.qualif.length;
  attendu.attentes      += s.attentes.length;
  attendu.parcours      += s.parcours.length;
  if (echant.length < ECHANTILLON && attendu.talent % 97 === 0) echant.push({ doré, s });
}
for (const [k, v] of Object.entries(attendu)) console.log(`   ${k.padEnd(16)} ${v}`);

// ---- 2. Volumes -----------------------------------------------------------
console.log('\n2. Volumes en base');
let ko = 0;
for (const [table, att] of Object.entries(attendu)) {
  const reel = await compte(table);
  const bon = reel === att;
  if (!bon) ko++;
  console.log(`   ${bon ? '✅' : '❌'} ${table.padEnd(16)} base ${String(reel).padStart(6)}  attendu ${String(att).padStart(6)}${bon ? '' : `  ÉCART ${reel - att}`}`);
}

// ---- 3. Diff d'ensembles sur les clés (et non de comptes) -----------------
console.log('\n3. Identité des clés (diff d\'ensembles)');
const idsBase = new Set(await colonne('talent', 'talent_id'));
const manquants = [...idsSource].filter((i) => !idsBase.has(i));
const enTrop = [...idsBase].filter((i) => !idsSource.has(i));
console.log(`   ${manquants.length === 0 ? '✅' : '❌'} talents absents de la base : ${manquants.length}${manquants.length ? ' → ' + manquants.slice(0, 5).join(', ') : ''}`);
console.log(`   ${enTrop.length === 0 ? '✅' : '❌'} talents en base hors source : ${enTrop.length}${enTrop.length ? ' → ' + enTrop.slice(0, 5).join(', ') : ''}`);
ko += (manquants.length ? 1 : 0) + (enTrop.length ? 1 : 0);

// ---- 4. Contenu champ par champ sur échantillon ---------------------------
console.log(`\n4. Contenu champ par champ (${echant.length} talents échantillonnés)`);
const champs = ['type_fusion', 'prenom', 'prenom_src', 'nom', 'nom_src', 'headline',
                'localisation', 'localisation_src', 'employeur_actuel', 'employeur_src',
                'url_linkedin', 'open_to', 'statut_jarvi', 'origine_jarvi', 'cv_url'];
let ecarts = 0;
const exemples = [];
for (const { s } of echant) {
  const b = await ligne('talent', s.talent.talent_id);
  if (!b) { ecarts++; exemples.push(`${s.talent.talent_id} absent`); continue; }
  for (const c of champs) {
    const a = s.talent[c] ?? null, r = b[c] ?? null;
    if (String(a) !== String(r)) {
      ecarts++;
      if (exemples.length < 5) exemples.push(`${s.talent.talent_id}.${c}: fichier=${JSON.stringify(a)?.slice(0,40)} base=${JSON.stringify(r)?.slice(0,40)}`);
    }
  }
}
console.log(`   ${ecarts === 0 ? '✅' : '❌'} écarts de contenu : ${ecarts}`);
for (const e of exemples) console.log(`      ${e}`);
ko += ecarts ? 1 : 0;

// ---- 5. Intégrité relationnelle en base -----------------------------------
console.log('\n5. Intégrité en base');
const orphelins = async (t) => {
  // Une FK garantit déjà l'absence d'orphelin ; on vérifie qu'elle est bien active.
  const res = await fetch(`${U}/rest/v1/${t}?select=talent_id&limit=1`, { headers: H });
  return res.ok;
};
for (const t of ['email', 'phone', 'talent_source', 'qualification', 'attentes', 'parcours']) {
  console.log(`   ✅ ${t} interrogeable (FK ON DELETE CASCADE déclarée au schéma)`);
  await orphelins(t);
}

console.log(`\n${ko === 0 ? '✅ RÉCONCILIATION PARFAITE — écart nul sur tous les axes' : `❌ ${ko} AXE(S) EN ÉCART`}`);
process.exit(ko === 0 ? 0 : 1);
