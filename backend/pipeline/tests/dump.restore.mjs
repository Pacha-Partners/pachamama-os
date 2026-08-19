/**
 * Test de restauration du dump livrable.
 *
 * Un dump qui ne se restaure pas ne vaut rien. On le rejoue donc dans une
 * base VIERGE, puis on vérifie que le schéma, les index, les vues, la
 * sécurité ET les données sont bien là et cohérents.
 */
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFileSync } from 'node:fs';

let ko = 0;
const ok = (c, l, d = '') => { console.log(`  ${c ? '✅' : '❌'} ${l}${d ? ` — ${d}` : ''}`); if (!c) ko++; };

const db = await new PGlite({ extensions: { pg_trgm } });
console.log('Base vierge :', (await db.query('select version()')).rows[0].version.split(' on ')[0], '\n');

console.log('1. Restauration');
try {
  await db.exec(readFileSync('../database/dump/pivot_dump.sql', 'utf8'));
  ok(true, 'le dump se restaure sans erreur');
} catch (e) { ok(false, 'restauration', e.message); process.exit(1); }

const n = async (q) => Number((await db.query(q)).rows[0].n);

console.log('\n2. Structure restaurée');
ok(await n(`select count(*) n from pg_tables where schemaname='pivot'`) === 8, '8 tables');
ok(await n(`select count(*) n from pg_views  where schemaname='pivot'`) === 7, '7 vues');
ok(await n(`select count(*) n from pg_indexes where schemaname='pivot'`) >= 18, 'au moins 18 index');
ok(await n(`select count(*) n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
            where ns.nspname='pivot' and c.relkind='r' and c.relrowsecurity`) === 8, 'RLS active sur les 8 tables');
ok(await n(`select count(*) n from pg_policies where schemaname='pivot'`) === 0, '0 policy (refus par défaut)');

console.log('\n3. Données restaurées');
const t = await n('select count(*) n from pivot.talent');
ok(t > 0, `${t} talents`);
for (const [tbl, min] of [['talent_source', 1], ['email', 1], ['phone', 1],
                          ['qualification', 1], ['attentes', 1], ['parcours', 1], ['note_journal', 1]]) {
  const c = await n(`select count(*) n from pivot.${tbl}`);
  ok(c >= min, `${tbl} : ${c} lignes`);
}

console.log('\n4. Cohérence relationnelle');
ok(await n(`select count(*) n from pivot.email e left join pivot.talent t using (talent_id)
            where t.talent_id is null`) === 0, 'aucun email orphelin');
ok(await n(`select count(*) n from pivot.attentes a left join pivot.talent t using (talent_id)
            where t.talent_id is null`) === 0, 'aucune attente orpheline');

console.log('\n5. Les vues fonctionnent sur les données restaurées');
const c = (await db.query('select * from pivot.qa_completude')).rows[0];
ok(!!c && Number(c.talents) === t, 'qa_completude cohérente', `talents=${c?.talents}`);
const rech = await db.query(`select * from pivot.talent_recherche where univers is not null limit 3`);
ok(rech.rows.length > 0, 'talent_recherche renvoie des lignes', `${rech.rows.length} lignes`);

console.log('\n6. Le dump ne contient aucune donnée réelle (contrôle de forme)');
const src = readFileSync('../database/dump/pivot_dump.sql', 'utf8');
ok(src.includes('exemple.test'), 'les emails sont en domaine réservé aux tests (exemple.test)');
ok(src.includes('[note anonymisée'), 'les notes sont remplacées');
ok(!/@(gmail|outlook|hotmail|yahoo|free|orange|wanadoo)\./i.test(src), 'aucun domaine de messagerie grand public');

console.log(`\n${ko === 0 ? '✅ DUMP RESTAURABLE ET CONFORME' : `❌ ${ko} CONTRÔLE(S) EN ÉCHEC`}`);
process.exit(ko === 0 ? 0 : 1);
