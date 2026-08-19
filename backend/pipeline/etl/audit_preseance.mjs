#!/usr/bin/env node
/**
 * Audit indépendant des règles de préséance.
 *
 * La règle : sur un talent fusionné, Jarvi remporte l'identité, la
 * localisation et l'employeur. Une valeur étiquetée « app » n'est
 * légitime que si Jarvi était VIDE (règle R1 : le vide n'est pas
 * autoritaire).
 *
 * POURQUOI CONTRE LE CSV JARVI, ET NON CONTRE LE PIVOT
 * Le pivot ne conserve que la valeur retenue et son étiquette de source.
 * L'auditer avec lui-même reviendrait à vérifier une réponse avec la même
 * réponse. On rejoue donc la comparaison sur la SOURCE d'origine : si un
 * champ est étiqueté « app » alors que le CSV Jarvi le renseignait, c'est
 * une violation de préséance — un bug du moteur de fusion.
 */
import { readFileSync, existsSync } from 'node:fs';
import { toutesLesLignes } from '../lib/pagination.mjs';

const CSV = process.env.JARVI_CSV
  ?? '/Users/claudemenye/Documents/Project./Bubble migration/jarvi-profiles-2026-07-21.csv';

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

/** Lecteur CSV minimal, tolérant aux guillemets et aux retours dans les champs. */
function lireCsv(texte) {
  const lignes = [];
  let champ = '', ligne = [], dansGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (dansGuillemets) {
      if (c === '"') { if (texte[i + 1] === '"') { champ += '"'; i++; } else dansGuillemets = false; }
      else champ += c;
    } else if (c === '"') dansGuillemets = true;
    else if (c === ',') { ligne.push(champ); champ = ''; }
    else if (c === '\n') { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; }
    else if (c !== '\r') champ += c;
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  const entetes = lignes.shift();
  return lignes.filter((l) => l.length > 1).map((l) => Object.fromEntries(entetes.map((h, i) => [h, l[i] ?? ''])));
}

const vide = (v) => v === null || v === undefined || String(v).trim() === '';

console.log('# Audit des règles de préséance\n');

console.log('1. Lecture de la source Jarvi');
const jarvi = lireCsv(readFileSync(CSV, 'utf8'));
const parId = new Map(jarvi.map((r) => [r['ID Jarvi'], r]));
console.log(`   ${jarvi.length} profils Jarvi, ${parId.size} identifiants distincts`);

console.log('\n2. Les fusionnés dont un champ à préséance vient de l\'app');
const suspects = await toutesLesLignes({
  url: U, cle: K, schema: 'pivot', tri: 'talent_id',
  chemin: 'qa_preseance_suspecte?select=*',
});
console.log(`   ${suspects.length} talents à examiner`);

console.log('\n3. Rattachement à leur identifiant Jarvi');
const liens = await toutesLesLignes({
  url: U, cle: K, schema: 'pivot', tri: 'talent_id',
  chemin: 'talent_source?select=talent_id,external_id&source=eq.jarvi',
});
const jarviDuTalent = new Map();
for (const l of liens) {
  if (!jarviDuTalent.has(l.talent_id)) jarviDuTalent.set(l.talent_id, []);
  jarviDuTalent.get(l.talent_id).push(l.external_id);
}

// Champ du pivot -> colonne du CSV Jarvi
const paires = [
  ['prenom_src',       'Prénom'],
  ['nom_src',          'Nom'],
  ['localisation_src', 'Localisation'],
  ['employeur_src',    'Entreprise'],
];

console.log('\n4. Vérification de R1 (« le vide n\'est pas autoritaire »)');
let legitimes = 0, violations = 0, introuvables = 0;
const exemples = [];
for (const s of suspects) {
  const ids = jarviDuTalent.get(s.talent_id) ?? [];
  const lignesJarvi = ids.map((i) => parId.get(i)).filter(Boolean);
  if (!lignesJarvi.length) { introuvables++; continue; }
  for (const [colSrc, colCsv] of paires) {
    if (s[colSrc] !== 'app') continue;
    // Jarvi renseignait-il ce champ sur AU MOINS un des profils du cluster ?
    const jarviRenseigne = lignesJarvi.some((l) => !vide(l[colCsv]));
    if (jarviRenseigne) {
      violations++;
      if (exemples.length < 8) {
        exemples.push(`${s.talent_id} · ${colCsv} : app a gagné alors que Jarvi valait ${JSON.stringify(lignesJarvi.map((l) => l[colCsv]).find((v) => !vide(v))).slice(0, 46)}`);
      }
    } else legitimes++;
  }
}
console.log(`   ✅ légitimes (Jarvi vide, repli app conforme à R1) : ${legitimes}`);
console.log(`   ${violations === 0 ? '✅' : '❌'} violations de préséance                        : ${violations}`);
if (introuvables) console.log(`   ℹ️  talents sans profil Jarvi retrouvé dans le CSV  : ${introuvables}`);
for (const e of exemples) console.log(`      ${e}`);

console.log(`\n${violations === 0 ? '✅ PRÉSÉANCE CONFORME — aucune valeur app n\'a supplanté une valeur Jarvi renseignée' : `❌ ${violations} VIOLATION(S)`}`);
process.exit(violations === 0 ? 0 : 1);
