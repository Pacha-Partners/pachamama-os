#!/usr/bin/env node
/**
 * Génération du dump SQL livrable.
 *
 * DEUX ARTEFACTS DISTINCTS, ET C'EST VOULU
 * La base réelle porte 30 829 personnes physiques : noms, emails,
 * téléphones, profils LinkedIn, et des notes rédigées à leur sujet. La
 * livrer à un tiers serait une communication de données personnelles sans
 * base légale. Le dump livrable contient donc :
 *   1. le SCHÉMA COMPLET, à l'identique de la production ;
 *   2. un ÉCHANTILLON ANONYMISÉ, qui conserve la structure, les
 *      cardinalités et les distributions analytiques, sans aucune donnée
 *      permettant de réidentifier une personne.
 *
 * CE QUI EST ANONYMISÉ (tout ce qui identifie, directement ou par
 * recoupement) : prénom, nom, emails, téléphones, URL LinkedIn, intitulé
 * de poste, employeur, parcours et formations, descriptions libres
 * rédigées par les talents, notes rédigées par les recruteurs.
 *
 * CE QUI EST CONSERVÉ (aucun identifiant, et c'est la valeur analytique) :
 * type de fusion, provenance des champs, univers, séniorité, niveau
 * d'anglais, expertises, secteurs, contrats visés, fourchettes de
 * rémunération, disponibilité, ville.
 *
 * L'anonymisation est DÉTERMINISTE : dérivée d'un hachage de l'identifiant
 * du talent. Le dump est donc reproductible à l'identique, ce qui permet
 * de le régénérer sans divergence — mais elle n'est pas réversible.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { toutesLesLignes, premieresLignes } from '../lib/pagination.mjs';

const N = Number(process.env.ECHANTILLON ?? 400);
const SORTIE = '../database/dump/pivot_dump.sql';

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

// ---- Anonymisation déterministe -------------------------------------------
const h = (s) => parseInt(createHash('sha256').update(String(s)).digest('hex').slice(0, 8), 16);
const PRENOMS = ['Camille','Alex','Noam','Sasha','Louison','Charlie','Maël','Ilan','Ambre','Nour',
                 'Robin','Eden','Léo','Anaé','Timo','Jules','Alba','Nino','Sacha','Lou'];
const NOMS = ['Bertin','Vasseur','Lemoine','Chartier','Bonnet','Faure','Perrot','Rey','Delaunay',
              'Marchand','Aubert','Colin','Devaux','Hamon','Nguyen','Rousset','Salvi','Thibault'];
const SOCIETES = ['Northwind','Altiva','Corelia','Bluemont','Vantis','Solvea','Ardenne Labs',
                  'Kestrel','Ovania','Trilex','Maribel','Sequoia Works'];
const POSTES = ['Product Manager','Software Engineer','Data Analyst','Designer produit',
                'Engineering Manager','Consultant Data','Développeur back-end','Product Designer'];
const pick = (arr, id, sel = 0) => arr[(h(id + ':' + sel)) % arr.length];

const anonymiserTalent = (t) => {
  const p = pick(PRENOMS, t.talent_id, 1);
  const n = pick(NOMS, t.talent_id, 2);
  return {
    ...t,
    prenom: t.prenom === null ? null : p,
    nom: t.nom === null ? null : n,
    headline: t.headline === null ? null : pick(POSTES, t.talent_id, 3),
    employeur_actuel: t.employeur_actuel === null ? null : pick(SOCIETES, t.talent_id, 4),
    url_linkedin: t.url_linkedin === null ? null
      : `https://www.linkedin.com/in/${p.toLowerCase()}-${n.toLowerCase()}-${h(t.talent_id) % 9999}/`,
    cv_url: t.cv_url === null ? null : 'https://exemple.test/cv/anonymise.pdf',
    notes_jarvi: t.notes_jarvi === null ? null : '[note anonymisée pour le livrable]',
    notes_bloc: null,
    // localisation CONSERVÉE : une ville seule ne réidentifie pas, et c'est
    // un axe de recherche essentiel du sourcing.
  };
};

// ---- Échappement SQL -------------------------------------------------------
const q = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return `'{${v.map((x) => `"${String(x).replace(/(["\\])/g, '\\$1')}"`).join(',')}}'`;
  // Les guillemets simples sont doublés ; U+2028/U+2029 sont échappés pour
  // qu'aucun outil ne coupe une instruction au milieu d'une chaîne.
  return `'${String(v).replace(/'/g, "''").replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')}'`;
};
const insert = (table, colonnes, lignes) => {
  if (!lignes.length) return `-- ${table} : aucune ligne dans l'échantillon\n`;
  const valeurs = lignes.map((l) => `  (${colonnes.map((c) => q(l[c])).join(', ')})`).join(',\n');
  return `INSERT INTO pivot.${table} (${colonnes.join(', ')}) VALUES\n${valeurs};\n`;
};

const lire = (chemin, tri) => toutesLesLignes({ url: U, cle: K, schema: 'pivot', chemin, tri });

console.log('# Génération du dump livrable\n');

console.log(`1. Extraction de l'échantillon (${N} talents)`);
const talents = await premieresLignes({ url: U, cle: K, schema: 'pivot',
                                       chemin: 'talent?select=*', tri: 'talent_id', n: N });
const ids = talents.map((t) => t.talent_id);
const dansIds = (col = 'talent_id') => `${col}=in.(${ids.map((i) => `"${i}"`).join(',')})`;

const [sources, emails, phones, qualifs, attentes, parcours, notes] = await Promise.all([
  lire(`talent_source?select=*&${dansIds()}`, 'talent_id'),
  lire(`email?select=*&${dansIds()}`, 'id'),
  lire(`phone?select=*&${dansIds()}`, 'id'),
  lire(`qualification?select=*&${dansIds()}`, 'talent_id'),
  lire(`attentes?select=*&${dansIds()}`, 'talent_id'),
  lire(`parcours?select=*&${dansIds()}`, 'talent_id'),
  lire(`note_journal?select=*&${dansIds()}`, 'id'),
]);
console.log(`   talents ${talents.length} · sources ${sources.length} · emails ${emails.length} · tél ${phones.length}`);
console.log(`   qualif ${qualifs.length} · attentes ${attentes.length} · parcours ${parcours.length} · notes ${notes.length}`);

console.log('\n2. Anonymisation');
// Un substitut qui coïncide avec une vraie valeur de l'échantillon rendrait
// le contrôle de fuite ambigu : on purge les listes au préalable.
const reels = new Set();
for (const t of talents) for (const v of [t.prenom, t.nom, t.employeur_actuel, t.headline])
  if (v) reels.add(String(v).trim().toLowerCase());
for (const [nom, liste] of [['PRENOMS', PRENOMS], ['NOMS', NOMS], ['SOCIETES', SOCIETES], ['POSTES', POSTES]]) {
  const avant = liste.length;
  for (let i = liste.length - 1; i >= 0; i--) if (reels.has(liste[i].toLowerCase())) liste.splice(i, 1);
  if (liste.length < avant) console.log(`   ${nom} : ${avant - liste.length} substitut(s) écarté(s) pour collision avec une valeur réelle`);
  if (liste.length < 4) throw new Error(`Liste ${nom} trop réduite après purge (${liste.length})`);
}
const tA = talents.map(anonymiserTalent);
const parIdTalent = new Map(tA.map((t) => [t.talent_id, t]));
// Les substituts doivent rester UNIQUES par talent : la contrainte porte sur
// (talent_id, email). Un talent qui possède trois adresses réelles doit donc
// recevoir trois substituts distincts — on numérote à partir de la deuxième.
const rangEmail = new Map();
const eA = emails.map((e) => {
  const t = parIdTalent.get(e.talent_id);
  const base = `${(t?.prenom ?? 'anonyme').toLowerCase()}.${(t?.nom ?? 'talent').toLowerCase()}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9.]/g, '');
  const k = (rangEmail.get(e.talent_id) ?? 0);
  rangEmail.set(e.talent_id, k + 1);
  return { ...e, email: `${base}${k ? '+' + k : ''}@exemple.test` };
});
const rangTel = new Map();
const pA = phones.map((p) => {
  const k = (rangTel.get(p.talent_id) ?? 0);
  rangTel.set(p.talent_id, k + 1);
  return { ...p, tel: String(600000000 + ((h(p.talent_id) + k * 7919) % 99999999)).slice(0, 9) };
});
// Les identifiants externes sont des clés de systèmes tiers : remplacés.
const sA = sources.map((s) => ({ ...s, external_id: `${s.source}-${h(s.external_id)}` }));
const parA = parcours.map((p) => ({
  talent_id: p.talent_id,
  experience: p.experience === null ? null : '[parcours anonymisé — structure conservée]',
  formation: p.formation === null ? null : '[formation anonymisée]',
  competences: p.competences,   // liste de compétences : non identifiante
}));
// `nogo` liste les entreprises qu'un talent refuse : identifiant par
// recoupement, donc remplacé par des sociétés fictives.
// `disponibilite` est du texte libre rédigé par les recruteurs : il contient
// des noms d'entreprises (« à voir avec X »). On le remplace par une CATÉGORIE
// normalisée, qui conserve la valeur analytique sans le texte identifiant.
const categoriserDispo = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const t = String(v).toLowerCase();
  if (/asap|imm[ée]diat|maintenant|de suite|tout de suite/.test(t)) return 'Immédiate';
  if (/pr[ée]avis|mois|semaine|septembre|octobre|novembre|d[ée]cembre|janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|20\d\d/.test(t)) return 'À terme';
  return 'Non précisée';
};
const attA = attentes.map((a) => ({
  ...a,
  description: a.description === null ? null : '[description anonymisée]',
  // `nogo` nomme les entreprises qu'un talent refuse : identifiant par recoupement.
  nogo: a.nogo === null ? null : `${pick(SOCIETES, a.talent_id, 8)}, ${pick(SOCIETES, a.talent_id, 9)}`,
  disponibilite: categoriserDispo(a.disponibilite),
}));
const nA = notes.map((n) => ({ ...n, contenu: '[note anonymisée pour le livrable]',
                               external_id: `note-${h(n.external_id ?? n.id)}` }));
console.log('   identité, coordonnées, employeur, parcours, descriptions et notes remplacés');
console.log('   conservés : type de fusion, provenance, univers, séniorité, expertises,');
console.log('               secteurs, contrats, rémunérations, disponibilité, ville');

console.log('\n3. Assemblage');
const ddl = readFileSync('../database/schema/01_schema_pivot.sql', 'utf8');
const vues = readFileSync('../database/schema/02_vues_qualite.sql', 'utf8');
const entete = `-- =====================================================================
-- Pachamama OS — Base talent unifiée : DUMP LIVRABLE
-- Projet annuel Bachelor Data & BI · Chef de projet web · RNCP40857
-- Claude Menye · NEXA Digital School Lyon
-- =====================================================================
-- CE QUE CONTIENT CE FICHIER
--   1. Le schéma complet, IDENTIQUE à la production : 8 tables,
--      18 index, 7 vues, RLS et droits.
--   2. Un échantillon de ${talents.length} talents ANONYMISÉS.
--
-- POURQUOI UN ÉCHANTILLON ANONYMISÉ, ET NON LA BASE RÉELLE
-- La base de production porte 30 829 personnes physiques. La transmettre
-- serait une communication de données personnelles sans base légale. Le
-- principe de minimisation impose de ne livrer que ce qui est nécessaire
-- à la démonstration technique : le schéma, les contraintes, les index,
-- les vues, et un jeu de données de forme réaliste.
--
-- Volumes de la base réelle, pour référence :
--   talent 30 829 · talent_source 33 546 · email 24 365 · phone 11 428
--   qualification 6 092 · attentes 5 714 · parcours 26 536
--   note_journal 19 381        (157 891 lignes au total)
--
-- RESTAURATION
--   psql "postgresql://user:pass@hote:5432/base" -f pivot_dump.sql
-- =====================================================================

`;
const corps = [
  '\n-- ============ DONNÉES : ÉCHANTILLON ANONYMISÉ ============\n',
  insert('talent', ['talent_id','type_fusion','prenom','prenom_src','nom','nom_src','headline',
                    'localisation','localisation_src','url_linkedin','open_to','employeur_actuel',
                    'employeur_src','statut_jarvi','origine_jarvi','cv_url','notes_jarvi','notes_bloc'], tA),
  insert('talent_source', ['talent_id','source','external_id'], sA),
  insert('email', ['talent_id','email','source','generique'], eA),
  insert('phone', ['talent_id','tel','source'], pA),
  insert('qualification', ['talent_id','niveau_qualifie','univers','anglais','product','profil',
                           'seniorite','background','expertises','secteurs'], qualifs),
  insert('attentes', ['talent_id','metier_vise','univers_vise','contrats','localisations','remotes',
                      'secteurs','nogo','salaire_min','salaire_souhaite','tjm_min','tjm_souhaite',
                      'disponibilite','description'], attA),
  insert('parcours', ['talent_id','experience','formation','competences'], parA),
  insert('note_journal', ['talent_id','contenu','source','automatique','date_note','external_id'], nA),
].join('\n');

writeFileSync(SORTIE, entete + ddl + '\n' + vues + corps);
const taille = (readFileSync(SORTIE).length / 1024).toFixed(0);
console.log(`   ✅ ${SORTIE} — ${taille} Ko`);

console.log('\n4. Contrôle de l\'anonymisation');
const complet = readFileSync(SORTIE, 'utf8');
const donnees = complet.slice(complet.indexOf('-- ============ DONNÉES'));
const fuites = [];

// --- 4a. Assertion structurelle : chaque champ identifiant a-t-il CHANGÉ ? ---
// C'est la vérification décisive, et elle ne produit aucun faux positif :
// on compare la valeur réelle à la valeur écrite, ligne par ligne.
const parId = parIdTalent;
let compares = 0;
for (const reel of talents) {
  const anon = parId.get(reel.talent_id);
  for (const champ of ['prenom','nom','headline','employeur_actuel','url_linkedin','cv_url','notes_jarvi']) {
    const a = reel[champ], b = anon[champ];
    if (a === null || a === undefined || String(a).trim() === '') continue;
    compares++;
    if (String(a) === String(b)) fuites.push(`INCHANGÉ ${reel.talent_id}.${champ} = ${String(a).slice(0, 34)}`);
  }
}
console.log(`   ${fuites.length === 0 ? '✅' : '❌'} ${compares} valeurs identifiantes comparées : toutes remplacées`);

// --- 4b. Scan textuel, réservé aux identifiants à FORTE ENTROPIE ------------
// Un email, un téléphone, une URL ou un identifiant technique ne peut pas
// apparaître par coïncidence : une correspondance y est nécessairement une
// fuite. On n'y met JAMAIS un intitulé de poste ni un nom de société, qui
// relèvent du vocabulaire courant.
const avant = fuites.length;
for (const e of emails)   if (donnees.includes(e.email)) fuites.push(`email ${e.email}`);
for (const p of phones)   if (p.tel && p.tel.length >= 8 && donnees.includes(p.tel)) fuites.push(`tél ${p.tel}`);
for (const t of talents)  if (t.url_linkedin && donnees.includes(t.url_linkedin)) fuites.push(`URL ${t.url_linkedin.slice(0,40)}`);
for (const s2 of sources) if (donnees.includes(s2.external_id)) fuites.push(`id externe ${s2.external_id.slice(0,24)}`);
console.log(`   ${fuites.length === avant ? '✅' : '❌'} aucun email, téléphone, URL ni identifiant technique réel`);

// --- 4c. Les champs de texte libre ont-ils bien été remplacés ? -------------
const avant2 = fuites.length;
for (const n of notes)    if (n.contenu && n.contenu.length > 25 && donnees.includes(n.contenu.slice(0, 45))) fuites.push(`note ${n.id}`);
for (const a of attentes) if (a.description && a.description.length > 25 && donnees.includes(a.description.slice(0, 45))) fuites.push(`description ${a.talent_id}`);
// `nogo` et `disponibilite` sont vérifiés par ASSERTION, pas par scan : leur
// contenu peut être un terme de taxonomie (« Adtech ») qui figure légitimement
// ailleurs dans le dump. Un scan textuel y produirait un faux positif.
const attParId = new Map(attA.map((a) => [a.talent_id, a]));
for (const a of attentes) {
  const ecrit = attParId.get(a.talent_id);
  if (a.nogo && String(a.nogo) === String(ecrit?.nogo)) fuites.push(`INCHANGÉ nogo ${a.talent_id}`);
  if (a.disponibilite && String(a.disponibilite) === String(ecrit?.disponibilite)
      && !['Immédiate','À terme','Non précisée'].includes(String(a.disponibilite)))
    fuites.push(`INCHANGÉ disponibilité ${a.talent_id}`);
}
for (const p of parcours) if (p.experience && p.experience.length > 40 && donnees.includes(p.experience.slice(0, 60))) fuites.push(`parcours ${p.talent_id}`);
console.log(`   ${fuites.length === avant2 ? '✅' : '❌'} textes libres remplacés · no-go et disponibilité vérifiés par assertion`);

console.log(`\n${fuites.length === 0 ? '✅ DUMP CONFORME — aucune donnée personnelle résiduelle' : `❌ ${fuites.length} FUITE(S)`}`);
for (const f of fuites.slice(0, 10)) console.log(`      ${f}`);
process.exit(fuites.length === 0 ? 0 : 1);
