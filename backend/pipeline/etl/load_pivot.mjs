#!/usr/bin/env node
/**
 * Chargement du pivot v1 dans PostgreSQL (Supabase) via PostgREST.
 *
 * Entrée  : pivot_v1.jsonl — 30 829 enregistrements dorés produits par le
 *           moteur d'inclusion (tâches 3 et 4).
 * Sortie  : les 8 tables pivot_* peuplées.
 *
 * Idempotent : upsert sur la clé primaire, donc rejouable sans doublon.
 * Le chargement respecte l'ordre des dépendances (talent d'abord, puis
 * ses satellites) : sans FK satisfaite, PostgREST rejette la ligne.
 *
 * Usage : node scripts/load_pivot.mjs [--dry-run] [--limit N]
 */
import { readFileSync, existsSync } from 'node:fs';
import { lignesJsonl } from '../lib/jsonl.mjs';

const SRC = process.env.PIVOT_FILE
  ?? '/Users/claudemenye/Documents/Project./Bubble migration/pivot_v1.jsonl';
const BATCH = 500;
const SCHEMA = 'pivot';
const DRY = process.argv.includes('--dry-run');
const limArg = process.argv.indexOf('--limit');
const LIMIT = limArg > -1 ? Number(process.argv[limArg + 1]) : Infinity;

// --- Configuration : lue dans .env.local, jamais codée en dur -------------
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
const URL_ = E.SUPABASE_URL, KEY = E.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants'); process.exit(1); }

async function upsert(table, rows, conflict) {
  if (!rows.length || DRY) return { ok: rows.length, ko: 0 };
  const res = await fetch(`${URL_}/rest/v1/${table}?on_conflict=${conflict}`, {
    method: 'POST',
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      // Le schéma cible est `pivot`, pas `public` : PostgREST le sélectionne
      // par Content-Profile en écriture (et Accept-Profile en lecture).
      'Content-Profile': SCHEMA,
      'Accept-Profile': SCHEMA,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const msg = (await res.text()).slice(0, 300);
    console.error(`  ✗ ${table} HTTP ${res.status} — ${msg}`);
    return { ok: 0, ko: rows.length };
  }
  return { ok: rows.length, ko: 0 };
}

import { split } from '../lib/pivot_transform.mjs';

// --- Boucle de chargement -------------------------------------------------
const stats = {};
const bump = (k, n) => { stats[k] = (stats[k] ?? 0) + n; };

async function flush(buf) {
  // Ordre imposé par les dépendances : le talent existe avant ses satellites.
  const r1 = await upsert('talent', buf.talent, 'talent_id');
  bump('talent', r1.ok); bump('erreurs', r1.ko);
  if (r1.ko) return;   // satellites inutiles si le parent a échoué
  for (const [table, rows, conflict] of [
    ['talent_source', buf.sources,  'talent_id,source,external_id'],
    ['email',         buf.emails,   'talent_id,email'],
    ['phone',         buf.phones,   'talent_id,tel'],
    ['qualification', buf.qualif,   'talent_id'],
    ['attentes',      buf.attentes, 'talent_id'],
    ['parcours',      buf.parcours, 'talent_id'],
  ]) {
    const r = await upsert(table, rows, conflict);
    bump(table, r.ok); bump('erreurs', r.ko);
  }
}

const t0 = Date.now();
console.log(`# Chargement du pivot${DRY ? ' (DRY-RUN, aucune écriture)' : ''}`);
console.log(`  source : ${SRC}`);

let n = 0;
let buf = { talent: [], sources: [], emails: [], phones: [], qualif: [], attentes: [], parcours: [] };
const malformees = [];
for await (const { numero, texte } of lignesJsonl(SRC)) {
  if (n >= LIMIT) break;
  let doré;
  try {
    doré = JSON.parse(texte);
  } catch (e) {
    // Une ligne illisible est signalée et comptée, jamais avalée en silence,
    // et n'interrompt pas le chargement des 30 828 autres.
    malformees.push(`ligne ${numero}: ${e.message}`);
    continue;
  }
  const s = split(doré);
  buf.talent.push(s.talent);
  buf.sources.push(...s.sources); buf.emails.push(...s.emails); buf.phones.push(...s.phones);
  buf.qualif.push(...s.qualif);   buf.attentes.push(...s.attentes); buf.parcours.push(...s.parcours);
  n++;
  if (buf.talent.length >= BATCH) {
    await flush(buf);
    buf = { talent: [], sources: [], emails: [], phones: [], qualif: [], attentes: [], parcours: [] };
    process.stdout.write(`\r  ${n} talents traités…`);
  }
}
if (buf.talent.length) await flush(buf);

console.log(`\n\n=== BILAN (${((Date.now() - t0) / 1000).toFixed(1)} s) ===`);
for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(22)} ${v}`);
console.log(`  lignes lues            ${n}`);
if (malformees.length) {
  console.log(`\n  LIGNES MALFORMÉES : ${malformees.length}`);
  for (const m of malformees.slice(0, 10)) console.log(`     ${m}`);
}
if ((stats.erreurs ?? 0) > 0 || malformees.length) process.exitCode = 1;
