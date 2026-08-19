#!/usr/bin/env node
/**
 * Chargement du journal de notes dans le pivot.
 *
 * POURQUOI CETTE ÉTAPE EST NÉCESSAIRE
 * Le champ `notes_bloc` du talent est destiné à être une consolidation
 * produite par un LLM. Or un bloc DÉRIVÉ dont on a perdu la source devient
 * irréparable : on ne peut plus le régénérer si la règle de consolidation
 * change. Le modèle impose donc de conserver le journal brut. Sans ce
 * chargement, la base talent serait incomplète par conception.
 *
 * PÉRIMÈTRE — portée talent uniquement
 * La table `note` du miroir est polymorphe : une note peut porter sur un
 * talent, mais aussi sur un mandat, un job ou une entreprise. Ces
 * dernières relèvent de la CANDIDATURE, explicitement hors périmètre de la
 * base talent. On ne charge donc que les notes de portée talent, et on
 * compte celles qu'on écarte plutôt que de les ignorer en silence.
 *
 * Rattachement : note.candidat_id (identifiant Bubble) → talent_source
 * (source='app') → talent_id. Une note dont le candidat n'a pas de doré
 * est une ORPHELINE : mise de côté, jamais rattachée à l'aveugle.
 */
import { readFileSync, existsSync } from 'node:fs';
import { toutesLesLignes } from '../lib/pagination.mjs';

const BATCH = 500;
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
const DRY = process.argv.includes('--dry-run');

const entetes = (schema) => ({
  apikey: K, Authorization: `Bearer ${K}`,
  'Accept-Profile': schema, 'Content-Profile': schema,
  'Content-Type': 'application/json',
});

const tout = (schema, chemin, tri) =>
  toutesLesLignes({ url: U, cle: K, schema, chemin, tri });

console.log('# Chargement du journal de notes' + (DRY ? ' (DRY-RUN)' : '') + '\n');

// ---- 1. La table de correspondance app → doré ------------------------------
console.log('1. Table de correspondance (identifiant app → talent doré)');
const liens = await tout('pivot', 'talent_source?select=talent_id,external_id&source=eq.app', 'external_id');
const parApp = new Map(liens.map((l) => [l.external_id, l.talent_id]));
console.log(`   ${parApp.size} identifiants app rattachés à un doré`);

// ---- 2. Les notes du miroir -------------------------------------------------
console.log('\n2. Lecture des notes du miroir');
const notes = await tout('public',
  'note?select=id,candidat_id,commentaire,date_note,note_automatique,entreprise_id,mandat_id,mandatclose_id',
  'id');
console.log(`   ${notes.length} notes lues`);

// ---- 3. Tri selon le périmètre ---------------------------------------------
const stats = { total: notes.length, sans_candidat: 0, sans_commentaire: 0,
                portee_candidature: 0, orphelines: 0, retenues: 0 };
const aCharger = [];
for (const n of notes) {
  if (!n.candidat_id)   { stats.sans_candidat++;   continue; }
  if (!n.commentaire)   { stats.sans_commentaire++; continue; }
  // Portée candidature : la note parle d'un mandat, d'un job ou d'une entreprise.
  if (n.entreprise_id || n.mandat_id || n.mandatclose_id) { stats.portee_candidature++; continue; }
  const talent = parApp.get(n.candidat_id);
  if (!talent) { stats.orphelines++; continue; }
  aCharger.push({
    talent_id: talent, contenu: n.commentaire, source: 'app',
    automatique: !!n.note_automatique, date_note: n.date_note ?? null,
    external_id: String(n.id),
  });
  stats.retenues++;
}
console.log('\n3. Tri par périmètre');
console.log(`   notes lues                        ${stats.total}`);
console.log(`   écartées — sans candidat          ${stats.sans_candidat}`);
console.log(`   écartées — sans commentaire       ${stats.sans_commentaire}`);
console.log(`   écartées — portée candidature     ${stats.portee_candidature}   (mandat / job / entreprise : hors périmètre base talent)`);
console.log(`   écartées — orphelines             ${stats.orphelines}   (candidat sans doré : mises de côté, pas rattachées à l'aveugle)`);
console.log(`   RETENUES (portée talent)          ${stats.retenues}`);

// ---- 4. Écriture ------------------------------------------------------------
if (DRY) { console.log('\nDRY-RUN : aucune écriture.'); process.exit(0); }
console.log('\n4. Écriture dans pivot.note_journal');
let ok = 0, ko = 0;
for (let i = 0; i < aCharger.length; i += BATCH) {
  const lot = aCharger.slice(i, i + BATCH);
  const res = await fetch(`${U}/rest/v1/note_journal?on_conflict=talent_id,external_id`, {
    method: 'POST',
    headers: { ...entetes('pivot'), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(lot),
  });
  if (res.ok) { ok += lot.length; } else { ko += lot.length; console.error(`   ✗ HTTP ${res.status} ${(await res.text()).slice(0, 200)}`); }
  process.stdout.write(`\r   ${ok} notes écrites…`);
}
console.log(`\n   ✅ ${ok} écrites · ${ko} en échec`);

// ---- 5. Contrôle ------------------------------------------------------------
const res = await fetch(`${U}/rest/v1/note_journal?select=id`, {
  headers: { ...entetes('pivot'), Prefer: 'count=exact', Range: '0-0' },
});
const enBase = Number((res.headers.get('content-range') ?? '/0').split('/')[1]);
console.log(`\n5. Contrôle : ${enBase} en base, ${stats.retenues} attendues → ${enBase === stats.retenues ? '✅ écart nul' : `❌ écart ${enBase - stats.retenues}`}`);
process.exit(enBase === stats.retenues && ko === 0 ? 0 : 1);
