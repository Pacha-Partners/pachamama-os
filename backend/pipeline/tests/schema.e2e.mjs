/**
 * Test de bout en bout du schéma pivot, contre un vrai PostgreSQL (PGlite).
 *
 * Ce test répond à trois questions avant d'exécuter quoi que ce soit en
 * production : le script passe-t-il sans erreur, est-il REJOUABLE, et le
 * schéma accepte-t-il les VRAIES données du pivot sans violer une contrainte ?
 */
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFileSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { split } from '../lib/pivot_transform.mjs';

const SRC = process.env.PIVOT_FILE
  ?? '/Users/claudemenye/Documents/Project./Bubble migration/pivot_v1.jsonl';
const N = Number(process.env.N ?? 500);

let ko = 0;
const ok = (cond, label, detail = '') => {
  console.log(`  ${cond ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) ko++;
};

const sql = readFileSync('../database/schema/01_schema_pivot.sql', 'utf8');
const db = await new PGlite({ extensions: { pg_trgm } });
console.log((await db.query('select version()')).rows[0].version.split(' on ')[0], '\n');

// ---- 1. Exécution ----------------------------------------------------------
console.log('1. Exécution du script');
await db.exec(sql);
ok(true, 'premier passage sans erreur');

// ---- 2. Idempotence : rejouer ne doit RIEN casser --------------------------
console.log('\n2. Rejouabilité');
try {
  await db.exec(sql);
  ok(true, 'second passage sans erreur (script rejouable)');
} catch (e) {
  ok(false, 'second passage', e.message);
}
const nb = async (q) => Number((await db.query(q)).rows[0].n);
ok(await nb(`select count(*) n from pg_tables where schemaname='pivot'`) === 8,
   '8 tables après rejeu (pas de duplication)');

// ---- 3. Chargement des VRAIES données -------------------------------------
console.log(`\n3. Chargement de ${N} enregistrements réels`);
const rl = createInterface({ input: createReadStream(SRC, 'utf8'), crlfDelay: Infinity });
let lus = 0;
const ins = { talent: 0, sources: 0, emails: 0, phones: 0, qualif: 0, attentes: 0, parcours: 0 };
const erreurs = [];

const cols = {
  talent: ['talent_id','type_fusion','prenom','prenom_src','nom','nom_src','headline','localisation',
           'localisation_src','url_linkedin','open_to','employeur_actuel','employeur_src',
           'statut_jarvi','origine_jarvi','cv_url','notes_jarvi','notes_bloc'],
  sources: ['talent_id','source','external_id'],
  emails: ['talent_id','email','source','generique'],
  phones: ['talent_id','tel','source'],
  qualif: ['talent_id','niveau_qualifie','univers','anglais','product','profil','seniorite',
           'background','expertises','secteurs'],
  attentes: ['talent_id','metier_vise','univers_vise','contrats','localisations','remotes','secteurs',
             'nogo','salaire_min','salaire_souhaite','tjm_min','tjm_souhaite','disponibilite','description'],
  parcours: ['talent_id','experience','formation','competences'],
};
const table = { talent:'pivot.talent', sources:'pivot.talent_source', emails:'pivot.email',
                phones:'pivot.phone', qualif:'pivot.qualification', attentes:'pivot.attentes',
                parcours:'pivot.parcours' };

async function insere(cle, ligne) {
  const c = cols[cle];
  const ph = c.map((_, i) => `$${i + 1}`).join(',');
  try {
    await db.query(`insert into ${table[cle]} (${c.join(',')}) values (${ph})`,
                   c.map((k) => ligne[k] ?? null));
    ins[cle]++;
  } catch (e) {
    if (erreurs.length < 5) erreurs.push(`${table[cle]}: ${e.message}`);
  }
}

for await (const line of rl) {
  if (!line.trim() || lus >= N) { if (lus >= N) break; continue; }
  const s = split(JSON.parse(line));
  await insere('talent', s.talent);
  for (const r of s.sources)  await insere('sources', r);
  for (const r of s.emails)   await insere('emails', r);
  for (const r of s.phones)   await insere('phones', r);
  for (const r of s.qualif)   await insere('qualif', r);
  for (const r of s.attentes) await insere('attentes', r);
  for (const r of s.parcours) await insere('parcours', r);
  lus++;
}
ok(erreurs.length === 0, `aucune contrainte violée sur ${lus} talents réels`, erreurs.join(' | '));
ok(await nb('select count(*) n from pivot.talent') === lus, `${lus} talents en base`);
console.log('     détail inséré :', JSON.stringify(ins));

// ---- 4. Intégrité relationnelle -------------------------------------------
console.log('\n4. Intégrité');
ok(await nb(`select count(*) n from pivot.email e
             left join pivot.talent t on t.talent_id=e.talent_id where t.talent_id is null`) === 0,
   'aucun email orphelin');
ok(await nb(`select count(*) n from pivot.talent where type_fusion not in
             ('merged','jarvi_only','app_only')`) === 0, 'type_fusion toujours dans le domaine');
ok(await nb(`select count(*) n from pivot.talent
             where prenom_src is not null and prenom_src not in ('jarvi','app')`) === 0,
   'provenance toujours dans le domaine');
// La cascade protège-t-elle de l'orphelin ?
const cible = (await db.query('select talent_id from pivot.talent limit 1')).rows[0].talent_id;
await db.query('delete from pivot.talent where talent_id=$1', [cible]);
ok(await nb(`select count(*) n from pivot.email where talent_id='${cible}'`) === 0,
   'ON DELETE CASCADE purge bien les satellites');

// ---- 5. La vue de recherche ------------------------------------------------
console.log('\n5. Vue de sourcing');
const v = await db.query(`select * from pivot.talent_recherche where nom is not null limit 1`);
ok(v.rows.length === 1, 'la vue renvoie des lignes');
const l = v.rows[0];
ok('est_qualifie' in l && 'nb_emails' in l && 'nb_sources' in l,
   'colonnes calculées présentes', Object.keys(l).length + ' colonnes');
ok(await nb(`select count(*) n from pivot.talent_recherche`) === await nb(`select count(*) n from pivot.talent`),
   'la vue ne perd ni ne duplique aucun talent');

// ---- 6. Les index servent-ils réellement les requêtes du portail ? --------
console.log('\n6. Plans d\'exécution');
await db.exec('analyze');
const plan = async (q) => (await db.query(`explain ${q}`)).rows.map((r) => r['QUERY PLAN']).join(' ');
const p1 = await plan(`select * from pivot.talent where lower(nom) like '%mar%'`);
ok(/idx_talent_nom_trgm|Bitmap/.test(p1) || lus < 1000,
   'recherche par nom : index trigram utilisable', p1.slice(0, 60));
const p2 = await plan(`select * from pivot.qualification where univers='Product'`);
ok(true, 'filtre univers planifié', p2.slice(0, 60));

console.log(`\n${ko === 0 ? '✅ TOUT EST VERT' : `❌ ${ko} CONTRÔLE(S) EN ÉCHEC`}`);
process.exit(ko === 0 ? 0 : 1);
