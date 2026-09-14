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
 *
 * DEUX SOURCES, PAS UNE — établi le 21/08/2026
 * Bubble applique un archivage glissant à ~12 mois : la note est recopiée
 * dans `note_archivée` SOUS UN NOUVEL IDENTIFIANT, puis l'originale est
 * supprimée. Lire `note` seule perd donc tout l'historique antérieur à
 * ~12 mois : 20 018 notes vivantes contre 25 318 archivées. On lit les deux.
 *
 * ET IL FAUT ÉCARTER LES FANTÔMES — sinon on charge deux fois le même texte
 * Une synchro incrémentale ne propage pas les suppressions : le miroir garde
 * 5 540 lignes dans `note` dont Bubble s'est débarrassé au profit de leur
 * jumelle archivée. Comme l'archivage RENUMÉROTE, la contrainte
 * UNIQUE(talent_id, external_id) ne peut PAS voir le doublon : elle compare
 * des identifiants différents pour un contenu identique. On écarte donc
 * explicitement les notes que `_sync_ecart` a CONFIRMÉES fantômes — deux
 * passes consécutives, jamais sur un seul constat.
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

// ---- 2. Les fantômes CONFIRMÉS, à ne jamais charger --------------------------
// On ne se fie pas à un constat unique : seuls les écarts vus sur deux passes
// consécutives comptent (constats_consecutifs >= 2, resolu_le IS NULL).
console.log('\n2. Fantômes confirmés par la réconciliation');
const fantomes = new Set((await tout('public',
  '_sync_ecart?select=bubble_id&supa_table=eq.note&nature=eq.fantome'
  + '&resolu_le=is.null&constats_consecutifs=gte.2', 'bubble_id')).map((x) => x.bubble_id));
console.log(`   ${fantomes.size} note(s) confirmée(s) fantôme — écartées du chargement`);

// ---- 3. Les notes, vivantes ET archivées ------------------------------------
const COLONNES = 'id,candidat_id,commentaire,date_note,note_automatique,'
               + 'entreprise_id,mandat_id,mandatclose_id';
console.log('\n3. Lecture des notes du miroir');
const vivantes = await tout('public', `note?select=${COLONNES}`, 'id');
const archivees = await tout('public', `note_archivee?select=${COLONNES}`, 'id');
console.log(`   note            ${vivantes.length}`);
console.log(`   note_archivee   ${archivees.length}`);
const notes = [...vivantes.map((n) => ({ ...n, _src: 'note' })),
               ...archivees.map((n) => ({ ...n, _src: 'note_archivee' }))];
console.log(`   total à trier   ${notes.length}`);

// ---- 3. Tri selon le périmètre ---------------------------------------------
const stats = { total: notes.length, fantomes: 0, sans_candidat: 0, sans_commentaire: 0,
                portee_candidature: 0, orphelines: 0, retenues: 0,
                depuis_note: 0, depuis_archive: 0 };
const aCharger = [];
for (const n of notes) {
  // 5e motif, COMPTÉ et imprimé : jamais un WHERE muet. Ce projet a déjà perdu
  // des enregistrements par des écarts silencieux.
  if (n._src === 'note' && fantomes.has(n.id)) { stats.fantomes++; continue; }
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
  if (n._src === 'note') stats.depuis_note++; else stats.depuis_archive++;
}
console.log('\n4. Tri par périmètre');
console.log(`   notes lues                        ${stats.total}`);
console.log(`   écartées — fantômes confirmés     ${stats.fantomes}   (doublons d'archive : le contenu est chargé depuis note_archivee)`);
console.log(`   écartées — sans candidat          ${stats.sans_candidat}`);
console.log(`   écartées — sans commentaire       ${stats.sans_commentaire}`);
console.log(`   écartées — portée candidature     ${stats.portee_candidature}   (mandat / job / entreprise : hors périmètre base talent)`);
console.log(`   écartées — orphelines             ${stats.orphelines}   (candidat sans doré : mises de côté, pas rattachées à l'aveugle)`);
console.log(`   RETENUES (portée talent)          ${stats.retenues}`);
console.log(`      dont depuis note               ${stats.depuis_note}`);
console.log(`      dont depuis note_archivee      ${stats.depuis_archive}`);

// ---- 4. Écriture ------------------------------------------------------------
if (DRY) { console.log('\nDRY-RUN : aucune écriture.'); process.exit(0); }
console.log('\n5. Écriture dans pivot.note_journal');
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
console.log(`\n6. Contrôle : ${enBase} en base, ${stats.retenues} attendues → ${enBase === stats.retenues ? '✅ écart nul' : `❌ écart ${enBase - stats.retenues}`}`);
process.exit(enBase === stats.retenues && ko === 0 ? 0 : 1);
