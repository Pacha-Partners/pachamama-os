#!/usr/bin/env node
/**
 * Audit de la qualité des fusions — mesure des faux positifs.
 *
 * CE QUE CET AUDIT MESURE, ET CE QU'IL NE MESURE PAS
 * La cascade de matching fusionne sur des clés fortes : slug LinkedIn, puis
 * email non générique. Elle ne fusionne JAMAIS sur le nom (choix de la
 * tâche 3 : le nom reste en revue humaine). Le nom est donc un TÉMOIN
 * INDÉPENDANT de la décision de fusion : si deux systèmes désignent la
 * même personne, les noms doivent concorder.
 *
 * Un désaccord de nom n'est pas automatiquement un faux positif — une
 * personne peut figurer sous un nom d'usage d'un côté et un nom de
 * naissance de l'autre. Mais c'est exactement la population qu'une revue
 * humaine doit examiner. On mesure donc un TAUX DE CONCORDANCE, et on
 * produit la liste des désaccords à réviser.
 *
 * Sortie : ../database/seeds/revue_fusions.md
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { toutesLesLignes } from '../lib/pagination.mjs';

const CSV = process.env.JARVI_CSV
  ?? '/Users/claudemenye/Documents/Project./Bubble migration/jarvi-profiles-2026-07-21.csv';
const SEUIL = Number(process.env.SEUIL ?? 95);   // concordance attendue, en %
const SORTIE = '../database/seeds/revue_fusions.md';

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

function lireCsv(texte) {
  const lignes = []; let champ = '', ligne = [], guill = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guill) { if (c === '"') { if (texte[i+1] === '"') { champ += '"'; i++; } else guill = false; } else champ += c; }
    else if (c === '"') guill = true;
    else if (c === ',') { ligne.push(champ); champ = ''; }
    else if (c === '\n') { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; }
    else if (c !== '\r') champ += c;
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  const e = lignes.shift();
  return lignes.filter((l) => l.length > 1).map((l) => Object.fromEntries(e.map((h, i) => [h, l[i] ?? ''])));
}

/** Normalisation : minuscules, sans accents, sans ponctuation, tokens triés. */
const jetons = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/).filter((t) => t.length > 1).sort();

/** Concordance : au moins un jeton long commun, ou recouvrement de Jaccard suffisant. */
function concordent(a, b) {
  const A = jetons(a), B = jetons(b);
  if (!A.length || !B.length) return null;              // indécidable, non compté
  const inter = A.filter((t) => B.includes(t));
  if (inter.some((t) => t.length >= 4)) return true;    // un nom de famille en commun
  const union = new Set([...A, ...B]).size;
  return inter.length / union >= 0.5;
}

console.log('# Audit de la qualité des fusions\n');

console.log('1. Sources');
const jarvi = lireCsv(readFileSync(CSV, 'utf8'));
const parIdJarvi = new Map(jarvi.map((r) => [r['ID Jarvi'], r]));
console.log(`   Jarvi : ${parIdJarvi.size} profils`);
const candidats = await toutesLesLignes({
  url: U, cle: K, schema: 'public', chemin: 'candidat?select=id,prenom,nom', tri: 'id' });
const parIdApp = new Map(candidats.map((c) => [c.id, c]));
console.log(`   App   : ${parIdApp.size} candidats`);

console.log('\n2. Les talents fusionnés et leurs liens');
const fusionnes = await toutesLesLignes({
  url: U, cle: K, schema: 'pivot', tri: 'talent_id',
  chemin: 'talent?select=talent_id,prenom,nom,employeur_actuel&type_fusion=eq.merged' });
const liens = await toutesLesLignes({
  url: U, cle: K, schema: 'pivot', chemin: 'talent_source?select=talent_id,source,external_id', tri: 'talent_id' });
const parTalent = new Map();
for (const l of liens) {
  if (!parTalent.has(l.talent_id)) parTalent.set(l.talent_id, { jarvi: [], app: [] });
  parTalent.get(l.talent_id)[l.source].push(l.external_id);
}
console.log(`   ${fusionnes.length} talents fusionnés à contrôler`);

console.log('\n3. Comparaison des noms entre les deux sources');
let concordants = 0, desaccords = 0, indecidables = 0;
const aRevoir = [];
for (const t of fusionnes) {
  const l = parTalent.get(t.talent_id) ?? { jarvi: [], app: [] };
  const nomsJarvi = l.jarvi.map((i) => parIdJarvi.get(i)).filter(Boolean)
    .map((r) => `${r['Prénom']} ${r['Nom']}`.trim()).filter(Boolean);
  const nomsApp = l.app.map((i) => parIdApp.get(i)).filter(Boolean)
    .map((c) => `${c.prenom ?? ''} ${c.nom ?? ''}`.trim()).filter(Boolean);
  if (!nomsJarvi.length || !nomsApp.length) { indecidables++; continue; }
  // Concordance si AU MOINS une paire concorde (un cluster peut porter
  // plusieurs identités d'une même source après collapse des doublons).
  let ok = false, indecidable = true;
  for (const nj of nomsJarvi) for (const na of nomsApp) {
    const r = concordent(nj, na);
    if (r !== null) indecidable = false;
    if (r === true) ok = true;
  }
  if (indecidable) { indecidables++; continue; }
  if (ok) concordants++;
  else {
    desaccords++;
    aRevoir.push({ talent_id: t.talent_id, jarvi: nomsJarvi.join(' / '), app: nomsApp.join(' / '),
                   employeur: t.employeur_actuel ?? '' });
  }
}
const decidables = concordants + desaccords;
const taux = decidables ? (concordants / decidables) * 100 : 0;
console.log(`   concordants   ${concordants}`);
console.log(`   désaccords    ${desaccords}`);
console.log(`   indécidables  ${indecidables}   (une source sans nom exploitable)`);
console.log(`\n   TAUX DE CONCORDANCE : ${taux.toFixed(2)} %  sur ${decidables} fusions décidables`);
console.log(`   seuil retenu        : ${SEUIL} %  →  ${taux >= SEUIL ? '✅ ATTEINT' : '❌ NON ATTEINT'}`);

console.log('\n4. Dossier de revue humaine');
const md = `# Revue humaine des fusions — désaccords de nom

> Généré par \`backend/etl/audit_fusion.mjs\`. ${fusionnes.length} talents fusionnés contrôlés.

## Résultat

| | |
|---|---|
| Fusions contrôlées | ${fusionnes.length} |
| Décidables (nom exploitable des deux côtés) | ${decidables} |
| **Concordants** | **${concordants}** |
| Désaccords à réviser | ${desaccords} |
| Indécidables | ${indecidables} |
| **Taux de concordance** | **${taux.toFixed(2)} %** |
| Seuil retenu | ${SEUIL} % → ${taux >= SEUIL ? 'atteint' : 'non atteint'} |

## Méthode

La cascade de matching fusionne sur le **slug LinkedIn** puis sur l'**email non
générique**, et **jamais sur le nom** — décision de la tâche 3, qui laisse le nom
en revue humaine. Le nom est donc un **témoin indépendant** de la décision de
fusion : il n'a pas participé à la décision qu'il sert à contrôler.

Un désaccord n'est pas automatiquement une erreur : nom d'usage contre nom de
naissance, prénom d'usage, translittération. Ce sont les cas à examiner, pas des
faux positifs démontrés.

## Désaccords à examiner

${desaccords === 0 ? '_Aucun désaccord._' :
`| Talent | Nom côté Jarvi | Nom côté app | Employeur |
|---|---|---|---|
${aRevoir.slice(0, 200).map((r) => `| \`${r.talent_id}\` | ${r.jarvi} | ${r.app} | ${r.employeur} |`).join('\n')}${aRevoir.length > 200 ? `\n\n_… et ${aRevoir.length - 200} autres._` : ''}`}
`;
writeFileSync(SORTIE, md);
console.log(`   ✅ ${SORTIE} — ${desaccords} cas listés`);
process.exit(taux >= SEUIL ? 0 : 1);
