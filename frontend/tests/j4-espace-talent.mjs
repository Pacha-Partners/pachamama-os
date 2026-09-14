#!/usr/bin/env node
/**
 * Harnais du jalon 4 — l'espace Talent : ce qu'il ouvre, et ce qu'il ferme.
 *
 *   cd frontend && npm run verifier:j4
 *
 * Il travaille avec de VRAIS jetons — un compte talent, un compte entreprise,
 * un compte recruteur — et la clé de service. Trois jetons parce que la seule
 * façon de prouver un cloisonnement est de le voir refuser quelqu'un ; la clé
 * de service parce que sans référence il n'y a pas de comparaison (D-11).
 *
 * ⚠ AUCUNE ADRESSE EN DUR DANS CE FICHIER (D-20).
 * Le dépôt `Pacha-Partners/pachamama-os` est PUBLIC, et les comptes de test du
 * projet de développement sont ceux de personnes RÉELLES — c'est la raison
 * pour laquelle `.gitignore` exclut COMPTES_DE_TEST.md en toutes lettres. Les
 * valeurs viennent de `.env.local`, ignoré par git ; sans elles le harnais
 * refuse de tourner plutôt que de passer au vert sur un compte deviné.
 *
 * ⚠ IL ÉCRIT, ET IL NETTOIE DERRIÈRE LUI.
 * Ce qu'il crée puis supprime :
 *   · un poste de frise (core.fiche_talent_poste est vide : trace nulle) ;
 *   · une candidature sur une offre publiée, plus sa note et sa transition ;
 *   · des clés dans app.idempotence.
 * Ce qu'il modifie sans pouvoir le remettre à l'identique :
 *   · les 9 colonnes `*_origine` de la fiche du compte talent passent à
 *     `declare`, et `modifie_par_le_talent_le` est horodatée. C'est le prix
 *     d'éprouver `api.maj_ma_fiche` pour de vrai ; le journal garde l'avant.
 *   · les six listes déclaratives sont réécrites À L'IDENTIQUE (mêmes codes),
 *     leur `origine` passant à `declare`.
 * Ce qu'il ne fait PAS sans canal de nettoyage : `api.demander_ma_suppression`
 * bascule `actif = false` sur la fiche d'une personne réelle et rien dans
 * l'API ne sait le remettre. Le contrôle n'est joué que si la CLI Supabase
 * répond ; sinon il est sauté, et le dit.
 *
 * Le journal (app.journal_ecriture) n'est PAS purgé : la table est en append
 * pur, et ses lignes sont la preuve que le mécanisme a fonctionné.
 *
 * ⚠ JAMAIS SUR LE PROJET LIVE. Le harnais refuse de tourner si l'URL n'est pas
 * celle du projet de développement.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import path from 'node:path';

const execFileP = promisify(execFile);
const DEV_REF = 'xavnvkpgbpczblmwlaxk';
const RACINE = path.resolve(process.cwd(), '..');

const args = process.argv.slice(2);
const lire = (n, defaut = null) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : defaut;
};

const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const S = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!U || !A) {
  console.error('Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(2);
}
if (!S) {
  console.error('SUPABASE_SERVICE_ROLE_KEY est requise : sans référence, il n’y a pas de comparaison.');
  process.exit(2);
}
if (!U.includes(DEV_REF)) {
  console.error(`REFUS : ${U} n’est pas le projet de développement (${DEV_REF}). Ce harnais écrit.`);
  process.exit(2);
}

const MDP = lire('--mdp', process.env.TEST_MDP);
const COMPTES = {
  talent:     { email: lire('--talent', process.env.TEST_TALENT_EMAIL),         mdp: lire('--mdp-talent', MDP) },
  entreprise: { email: lire('--entreprise', process.env.TEST_ENTREPRISE_EMAIL), mdp: lire('--mdp-entreprise', MDP) },
  recruteur:  { email: lire('--recruteur', process.env.TEST_RECRUTEUR_EMAIL),   mdp: lire('--mdp-recruteur', MDP) },
};
for (const [role, c] of Object.entries(COMPTES)) {
  if (!c.email || !c.mdp) {
    console.error(`Compte ${role} absent : renseigner TEST_${role.toUpperCase()}_EMAIL et TEST_MDP dans .env.local.`);
    process.exit(2);
  }
}

let echecs = 0;
let sautes = 0;
const ok      = (t, d) => console.log(`  ✔ ${t}${d ? ` — ${d}` : ''}`);
const ko      = (t, d) => { echecs++; console.log(`  ✘ ${t}${d ? ` — ${d}` : ''}`); };
const saute   = (t, d) => { sautes++; console.log(`  ~ ${t}${d ? ` — ${d}` : ''}`); };
const verifier = (c, t, d) => (c ? ok(t, d) : ko(t, d));
const titre    = (t) => console.log(`\n${t}`);

// ── Petite couche d'accès, pour que les contrôles restent lisibles ──────
const entetes = (jeton, extra = {}) => ({
  apikey: jeton === S ? S : A,
  Authorization: `Bearer ${jeton}`,
  'Accept-Profile': 'api',
  'Content-Profile': 'api',
  ...extra,
});

async function connexion(email, mdp) {
  const r = await fetch(`${U}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: A, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: mdp }),
  });
  const c = r.ok ? await r.json() : null;
  return c?.access_token ?? null;
}

async function lireVue(jeton, vue, requete = 'select=*&limit=1') {
  const r = await fetch(`${U}/rest/v1/${vue}?${requete}`, { headers: entetes(jeton) });
  const brut = await r.text();
  let corps = null;
  try { corps = JSON.parse(brut); } catch { /* réponse non JSON */ }
  return { statut: r.status, ok: r.ok, corps, brut };
}

async function compter(jeton, vue, filtre = '') {
  const r = await fetch(`${U}/rest/v1/${vue}?select=*${filtre}`, {
    headers: entetes(jeton, { Prefer: 'count=exact', Range: '0-0' }),
  });
  if (!r.ok) return -1;                       // vue inaccessible : 0 par refus de droit
  const plage = r.headers.get('content-range');
  return plage ? Number(plage.split('/')[1]) : -1;
}

async function appeler(jeton, fonction, corps) {
  const r = await fetch(`${U}/rest/v1/rpc/${fonction}`, {
    method: 'POST',
    headers: entetes(jeton, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(corps ?? {}),
  });
  const brut = await r.text();
  let json = null;
  try { json = JSON.parse(brut); } catch { /* rien */ }
  return { statut: r.status, ok: r.ok, corps: json, brut };
}

async function patcher(jeton, cible, charge, profil = 'api') {
  const r = await fetch(`${U}/rest/v1/${cible}`, {
    method: 'PATCH',
    headers: {
      apikey: jeton === S ? S : A,
      Authorization: `Bearer ${jeton}`,
      'Accept-Profile': profil,
      'Content-Profile': profil,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(charge),
  });
  return { statut: r.status, ok: r.ok, brut: (await r.text()).slice(0, 160) };
}

// ── Le canal de nettoyage : la CLI Supabase, sur le projet lié ──────────
// PostgREST n'expose pas `core` (mesuré : Accept-Profile: core → 406), donc
// aucune purge n'est possible en HTTP. La CLI est le seul canal, et le harnais
// vérifie qu'elle pointe bien sur le dev avant de s'en servir.
let sqlDispo = false;
async function sql(requete) {
  const { stdout } = await execFileP('supabase', ['db', 'query', '--linked', requete], {
    cwd: RACINE, maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}
async function sqlFichier(chemin) {
  const { stdout } = await execFileP('supabase', ['db', 'query', '--linked', '-f', chemin], {
    cwd: RACINE, maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

console.log('\nHarnais J4 — l’espace Talent\n');
console.log(`  base       ${U}`);
console.log(`  talent     ${COMPTES.talent.email}`);
console.log(`  entreprise ${COMPTES.entreprise.email}`);
console.log(`  recruteur  ${COMPTES.recruteur.email}`);

// ═══════════════════════════════════════════════════════════════════════
// 0. Le canal de nettoyage
// ═══════════════════════════════════════════════════════════════════════
titre('0. Le canal de nettoyage');
{
  const ref = path.join(RACINE, 'supabase', '.temp', 'project-ref');
  let lie = null;
  if (existsSync(ref)) {
    lie = (await import('node:fs')).readFileSync(ref, 'utf8').trim();
  }
  if (lie !== DEV_REF) {
    saute('la CLI Supabase n’est pas liée au projet de développement',
      `project-ref = ${lie ?? 'absent'} — nettoyage et contrôle SQL sautés`);
  } else {
    try {
      await sql('select 1 as sonde');
      sqlDispo = true;
      ok('la CLI Supabase répond sur le projet de développement', DEV_REF);
    } catch (e) {
      saute('la CLI Supabase ne répond pas', String(e.message ?? e).slice(0, 120));
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 1. Les jetons, et un compte attendu NON NUL
//    Sans ce contrôle, une base injoignable ferait passer tout le reste au
//    vert : « zéro ligne » est la réponse d'une porte fermée comme celle
//    d'un réseau coupé.
// ═══════════════════════════════════════════════════════════════════════
titre('1. Les jetons');
const jetons = {};
const profils = {};
for (const [role, c] of Object.entries(COMPTES)) {
  jetons[role] = await connexion(c.email, c.mdp);
  verifier(Boolean(jetons[role]), `le compte ${role} se connecte`, c.email);
}
if (!jetons.talent) {
  console.log('\nJ4 : sans jeton talent, rien n’est contrôlable.');
  process.exit(1);
}
for (const role of Object.keys(COMPTES)) {
  if (!jetons[role]) continue;
  profils[role] = (await lireVue(jetons[role], 'moi', 'select=*')).corps?.[0] ?? null;
}
const MOI = profils.talent;
verifier(Boolean(MOI?.compte_id), 'api.moi reconnaît le compte talent', MOI?.compte_id ?? 'aucun');
verifier(Array.isArray(MOI?.portails) && MOI.portails.includes('talent'),
  'le compte porte bien le portail talent', (MOI?.portails ?? []).join(' + ') || 'aucun');
verifier(Boolean(MOI?.fiche_talent_id),
  'le compte est rattaché à une fiche talent', MOI?.fiche_talent_id ?? 'aucune');
verifier(MOI?.est_interne === false,
  'le compte talent n’est PAS interne', `est_interne = ${MOI?.est_interne}`);
const MA_FICHE = MOI?.fiche_talent_id ?? null;

// ═══════════════════════════════════════════════════════════════════════
// 2. Ce que l'espace sert au talent — un nombre attendu NON NUL
// ═══════════════════════════════════════════════════════════════════════
titre('2. Ce que l’espace sert au talent');
const VUES_TALENT = ['ma_fiche', 'ma_candidature', 'ma_candidature_detail',
                     'mes_postes', 'ma_note_partagee', 'mon_referentiel'];
const ATTENDU_NON_VIDE = ['ma_fiche', 'ma_candidature', 'ma_candidature_detail', 'mon_referentiel'];

const vu = {};
for (const v of VUES_TALENT) vu[v] = await compter(jetons.talent, v);
for (const v of ATTENDU_NON_VIDE) {
  verifier(vu[v] > 0, `api.${v} rend des lignes au talent`, `${vu[v]} ligne(s)`);
}
verifier(vu.ma_fiche === 1, 'api.ma_fiche rend UNE fiche, la sienne', `${vu.ma_fiche} ligne(s)`);
console.log(`  · api.mes_postes : ${vu.mes_postes} · api.ma_note_partagee : ${vu.ma_note_partagee}`
          + ' (0 attendu : core.fiche_talent_poste est vide, et aucune note n’est visible_talent)');

// La clé de service voit la vue elle-même — c'est ce que D-11 lui rend.
for (const v of ATTENDU_NON_VIDE) {
  const service = await compter(S, v);
  verifier(service >= vu[v] && service > 0,
    `api.${v} reste auditable à la clé de service`, `${service} au total pour ${vu[v]} au talent`);
}

// Le référentiel doit couvrir les dix vocabulaires que les formulaires
// demandent — sinon le front les recopiera en dur, comme à la phase 1.
{
  const r = await lireVue(jetons.talent, 'mon_referentiel', 'select=referentiel,code&limit=2000');
  const par = {};
  for (const l of r.corps ?? []) par[l.referentiel] = (par[l.referentiel] ?? 0) + 1;
  const ATTENDUS = ['metier', 'univers', 'metier_univers', 'secteur', 'critere',
                    'expertise', 'contrat', 'remote', 'motif_retrait', 'etape'];
  const manquants = ATTENDUS.filter((k) => !par[k]);
  verifier(manquants.length === 0, 'api.mon_referentiel porte les dix vocabulaires',
    manquants.length ? `MANQUE : ${manquants.join(', ')}`
                     : ATTENDUS.map((k) => `${k}=${par[k]}`).join(' '));
  verifier(par.motif_retrait === 7,
    'les 7 motifs de retrait du registre candidat sont là', `${par.motif_retrait ?? 0}`);
}

// ═══════════════════════════════════════════════════════════════════════
// 3. Le cloisonnement, éprouvé par le refus
//
//    ⚠ MESURE QUI CONTREDIT LE TICKET. Le ticket demande qu'« un compte
//    entreprise ET un compte recruteur rendent 0 ligne sur chaque vue
//    talent ». Mesuré le 13/09 : le compte recruteur de test porte DEUX
//    portails — `recruteur` ET `talent` — avec sa propre fiche_talent_id.
//    C'est le cas général et non l'exception : la plupart des collaborateurs
//    ont un accès talent en plus de leur accès interne. Exiger 0 ligne de lui
//    serait exiger qu'il ne puisse pas lire SA PROPRE fiche.
//
//    Le contrôle est donc scindé, et il est plus fort ainsi :
//      · un compte SANS le portail talent rend 0 ligne partout ;
//      · un compte AVEC le portail talent ne voit QUE ses propres lignes,
//        jamais celles d'un autre talent.
// ═══════════════════════════════════════════════════════════════════════
titre('3. Le cloisonnement, éprouvé par le refus');
for (const role of ['entreprise', 'recruteur']) {
  if (!jetons[role]) { ko(`compte ${role} indisponible`, 'contrôle sauté'); continue; }
  const aLeTalent = (profils[role]?.portails ?? []).includes('talent');

  if (!aLeTalent) {
    for (const v of VUES_TALENT) {
      const n = await compter(jetons[role], v);
      verifier(n === 0, `un compte ${role} (sans portail talent) rend 0 ligne sur api.${v}`,
        n < 0 ? 'vue inaccessible (0 par refus de droit)' : `${n} ligne(s)`);
    }
  } else {
    console.log(`  · le compte ${role} porte aussi le portail talent `
              + `(${(profils[role].portails ?? []).join(' + ')}) : on contrôle l’isolement, pas le zéro`);
    // Sa fiche, et seulement la sienne.
    const f = await lireVue(jetons[role], 'ma_fiche', 'select=id');
    const ids = (f.corps ?? []).map((x) => x.id);
    verifier(ids.length === 1 && ids[0] === profils[role].fiche_talent_id,
      `un compte ${role} ne lit QUE sa propre fiche sur api.ma_fiche`,
      `${ids.length} ligne(s)`);
    verifier(!ids.includes(MA_FICHE),
      `un compte ${role} n’atteint PAS la fiche du compte talent`, 'isolé');
    // Ses candidatures, et seulement les siennes.
    const c = await lireVue(jetons[role], 'ma_candidature_detail', 'select=id&limit=1000');
    const miennes = await lireVue(jetons.talent, 'ma_candidature_detail', 'select=id&limit=1000');
    const sesIds = new Set((c.corps ?? []).map((x) => x.id));
    const croisement = (miennes.corps ?? []).filter((x) => sesIds.has(x.id));
    verifier(croisement.length === 0,
      `un compte ${role} ne voit aucune candidature du compte talent`,
      `${sesIds.size} de lui, ${(miennes.corps ?? []).length} de l’autre, 0 en commun`);
  }
}

// Le visiteur anonyme n'atteint aucune vue de l'espace talent.
for (const v of VUES_TALENT) {
  const r = await fetch(`${U}/rest/v1/${v}?select=*&limit=1`, {
    headers: { apikey: A, Authorization: `Bearer ${A}`, 'Accept-Profile': 'api' },
  });
  const corps = r.ok ? await r.json() : null;
  verifier(!r.ok || (Array.isArray(corps) && corps.length === 0),
    `un visiteur anonyme ne lit rien sur api.${v}`, `statut ${r.status}`);
}

// ═══════════════════════════════════════════════════════════════════════
// 4. api.ma_candidature_detail ne PROJETTE aucune colonne de jugement
//    On ne regarde pas les lignes rendues — on DEMANDE la colonne. Si elle
//    n'existe pas, PostgREST répond 42703 : c'est une preuve, pas un indice.
//    (D-16 : un contrôle qui cherche dans le texte rendu ne prouve rien.)
// ═══════════════════════════════════════════════════════════════════════
titre('4. Le suivi de candidature : ce qui n’en sort pas');
const JUGEMENT = [
  'argumentaire_client', 'compte_rendu', 'appreciation_like',
  'appreciation_personnalite', 'points_forts', 'points_faibles',
  'infos_remuneration', 'salaire_min_ke', 'salaire_souhaite_ke',
  'tjm_min_eur', 'tjm_souhaite_eur',
  'titre', 'libelle_interne', 'etape_interne',
  'est_qualifie', 'statut_relation', 'mindset', 'seniorite', 'emoji_statut',
  'agent_referent_id', 'resume_ia', 'score_completude',
  'entreprise_id', 'fiche_talent_id',
];
{
  const fuites = [];
  for (const col of JUGEMENT) {
    const r = await lireVue(S, 'ma_candidature_detail', `select=${col}&limit=1`);
    if (r.ok) fuites.push(col);
  }
  verifier(fuites.length === 0,
    `aucune des ${JUGEMENT.length} colonnes de jugement n’est projetée par api.ma_candidature_detail`,
    fuites.length ? `FUITE : ${fuites.join(', ')}` : `${JUGEMENT.length} colonnes refusées`);
}
{
  const ATTENDUES = ['poste', 'entreprise', 'est_anonyme', 'etape', 'etape_code',
                     'reference_pseudonyme', 'agent_prenom', 'agent_nom', 'agent_photo',
                     'mandat_missions', 'mandat_pour_toi', 'mandat_remote',
                     'mandat_salaire_min_ke', 'mandat_salaire_max_ke',
                     'retire_par_talent_le', 'motif_retrait'];
  const manquantes = [];
  for (const col of ATTENDUES) {
    const r = await lireVue(S, 'ma_candidature_detail', `select=${col}&limit=1`);
    if (!r.ok) manquantes.push(col);
  }
  verifier(manquantes.length === 0, 'les colonnes attendues sont bien là',
    manquantes.length ? `MANQUE : ${manquantes.join(', ')}` : `${ATTENDUES.length} colonnes`);
}
// Le registre TALENT, pas l'interne : le talent ne doit jamais lire
// « KO by Pachamama » (D-02).
{
  const r = await lireVue(jetons.talent, 'ma_candidature_detail', 'select=etape&limit=100');
  const etapes = (r.corps ?? []).map((x) => x.etape ?? '');
  const anglaises = etapes.filter((e) => /KO by|Send-out|Screen|Applicant|Hired|Interview/i.test(e));
  verifier(anglaises.length === 0, 'les étapes sont servies en registre TALENT',
    anglaises.length ? `REGISTRE INTERNE : ${[...new Set(anglaises)].join(' / ')}`
                     : [...new Set(etapes)].join(' / ') || 'aucune candidature');
}
// L'anonymat de l'offre : jamais de nom d'entreprise sur un mandat anonyme.
{
  const r = await lireVue(jetons.talent, 'ma_candidature_detail',
    'select=est_anonyme,entreprise,entreprise_logo&limit=1000');
  const fuites = (r.corps ?? []).filter((x) => x.est_anonyme && (x.entreprise || x.entreprise_logo));
  verifier(fuites.length === 0, 'aucune offre anonyme ne laisse filtrer son entreprise',
    `${(r.corps ?? []).filter((x) => x.est_anonyme).length} candidature(s) sur offre anonyme, ${fuites.length} fuite(s)`);
}
// Une ligne réelle ne porte aucune clé interdite.
{
  const r = await lireVue(jetons.talent, 'ma_candidature_detail', 'select=*&limit=1');
  const cles = Object.keys(r.corps?.[0] ?? {});
  const suspectes = cles.filter((c) => JUGEMENT.includes(c));
  verifier(suspectes.length === 0, 'une ligne réelle ne porte aucune clé interdite',
    `${cles.length} colonnes servies`);
}
// Et api.ma_fiche ne rend plus `mindset` — D-06 le nomme comme une
// qualification du cabinet, au même titre qu'est_qualifie.
{
  const r = await lireVue(jetons.talent, 'ma_fiche', 'select=mindset&limit=1');
  verifier(!r.ok, 'api.ma_fiche ne projette plus `mindset`',
    r.ok ? 'ENCORE PROJETÉ' : `statut ${r.statut}`);
}

// ═══════════════════════════════════════════════════════════════════════
// 5. LE TROU DU §1 — un talent ne réécrit pas sa qualification
// ═══════════════════════════════════════════════════════════════════════
titre('5. La qualification du cabinet est hors d’atteinte');
const RESERVEES = ['est_qualifie', 'statut_relation', 'agent_referent_id', 'seniorite',
                   'emoji_statut', 'score_completude', 'resume_ia', 'mindset',
                   'champs_manquants', 'fiche_complete'];

// 5a. Par la FONCTION : l'argument n'existe pas.
{
  const refusees = [];
  for (const col of RESERVEES) {
    const r = await appeler(jetons.talent, 'maj_ma_fiche',
      { p_prenom: 'Essai', p_nom: 'Essai', [`p_${col}`]: 'x' });
    if (!r.ok) refusees.push(col);
  }
  verifier(refusees.length === RESERVEES.length,
    `api.maj_ma_fiche refuse les ${RESERVEES.length} arguments réservés au cabinet`,
    refusees.length === RESERVEES.length
      ? 'aucun n’existe comme paramètre'
      : `ACCEPTÉS : ${RESERVEES.filter((c) => !refusees.includes(c)).join(', ')}`);
}

// 5b. Par un PATCH direct sur la vue.
{
  const echecsPatch = [];
  for (const col of RESERVEES) {
    const r = await patcher(jetons.talent, `ma_fiche?id=eq.${MA_FICHE}`,
      { [col]: col === 'est_qualifie' || col === 'fiche_complete' ? true : 'x' });
    if (r.ok) echecsPatch.push(`${col} (${r.statut})`);
  }
  verifier(echecsPatch.length === 0,
    'un PATCH direct sur api.ma_fiche est refusé sur chaque colonne réservée',
    echecsPatch.length ? `ACCEPTÉ : ${echecsPatch.join(', ')}` : `${RESERVEES.length} refus`);
}

// 5c. Par un PATCH direct sur la TABLE : le schéma n'est pas exposé.
{
  const r = await patcher(jetons.talent, `fiche_talent?id=eq.${MA_FICHE}`,
    { est_qualifie: true }, 'core');
  verifier(!r.ok, 'un PATCH direct sur core.fiche_talent est refusé',
    `statut ${r.statut} ${r.brut.slice(0, 60)}`);
}

// 5d. Et par la vue de recherche du cabinet, qui ne doit rien lui rendre.
{
  const n = await compter(jetons.talent, 'talent_recherche');
  verifier(n === 0, 'api.talent_recherche ne rend rien à un talent',
    n < 0 ? 'vue inaccessible' : `${n} ligne(s)`);
}

// 5e. Le tag reste un acte du cabinet : aucun p_type ne l'atteint.
{
  const r = await appeler(jetons.talent, 'maj_mes_listes', { p_type: 'tag', p_codes: ['x'] });
  verifier(!r.ok, 'api.maj_mes_listes refuse p_type = « tag »',
    r.ok ? 'ACCEPTÉ — un talent se pose ses propres tags' : `statut ${r.statut}`);
}

// ═══════════════════════════════════════════════════════════════════════
// 6. L'écriture de ce qu'il déclare
// ═══════════════════════════════════════════════════════════════════════
titre('6. L’écriture de ce qu’il déclare');
const ficheAvant = (await lireVue(jetons.talent, 'ma_fiche', 'select=*')).corps?.[0] ?? null;
verifier(Boolean(ficheAvant), 'la fiche est lisible avant écriture',
  ficheAvant ? `${Object.keys(ficheAvant).length} colonnes` : 'aucune');

// 6a. LE CONTRÔLE DE D-17 : la fonction accepte la donnée DÉJÀ en base.
//     Une validation qui interdit l'état actuel n'est pas une validation,
//     c'est une porte fermée — 34 clients l'ont payé au J3.
if (ficheAvant) {
  const r = await appeler(jetons.talent, 'maj_ma_fiche', {
    p_prenom: ficheAvant.prenom,
    p_nom: ficheAvant.nom,
    p_email_personnel: ficheAvant.email_personnel,
    p_telephone: ficheAvant.telephone,
    p_url_linkedin: ficheAvant.url_linkedin,
    p_localisation_texte: ficheAvant.localisation_texte,
    p_photo_url: ficheAvant.photo_url,
    p_cv_url: ficheAvant.cv_url,
    p_portfolio_url: ficheAvant.portfolio_url,
  });
  verifier(r.ok, 'api.maj_ma_fiche accepte la donnée DÉJÀ en base (D-17)',
    r.ok ? `${r.corps?.champs_modifies} champ(s) modifié(s)` : r.brut.slice(0, 200));
  verifier(r.ok && r.corps?.champs_modifies === 0,
    'un formulaire renvoyé sans modification ne journalise rien',
    `champs_modifies = ${r.corps?.champs_modifies}`);
}

// 6b. Les refus.
{
  const cas = [
    ['un prénom vide', { p_prenom: '   ', p_nom: 'Essai' }],
    ['un nom vide', { p_prenom: 'Essai', p_nom: '' }],
    ['une adresse sans arobase', { p_prenom: 'A', p_nom: 'B', p_email_personnel: 'pas-une-adresse' }],
    ['un LinkedIn sans point', { p_prenom: 'A', p_nom: 'B', p_url_linkedin: 'moncompte' }],
    ['un CV qui n’est pas une URL', { p_prenom: 'A', p_nom: 'B', p_cv_url: 'mon cv.pdf' }],
  ];
  for (const [quoi, charge] of cas) {
    const r = await appeler(jetons.talent, 'maj_ma_fiche', charge);
    verifier(!r.ok, `api.maj_ma_fiche refuse ${quoi}`, r.ok ? 'ACCEPTÉ' : `statut ${r.statut}`);
  }
  // Et la forme protocole-relative, qui est celle de 3 926 CV sur 3 926, PASSE.
  const r = await appeler(jetons.talent, 'maj_ma_fiche', {
    p_prenom: ficheAvant?.prenom ?? 'Essai', p_nom: ficheAvant?.nom ?? 'Essai',
    p_email_personnel: ficheAvant?.email_personnel, p_telephone: ficheAvant?.telephone,
    p_url_linkedin: ficheAvant?.url_linkedin, p_localisation_texte: ficheAvant?.localisation_texte,
    p_photo_url: '//exemple.test/photo.png', p_cv_url: ficheAvant?.cv_url,
    p_portfolio_url: ficheAvant?.portfolio_url,
  });
  verifier(r.ok, 'une URL protocole-relative (//hôte/…) est acceptée',
    r.ok ? 'oui' : r.brut.slice(0, 160));
  // On remet la photo d'origine.
  if (r.ok) {
    await appeler(jetons.talent, 'maj_ma_fiche', {
      p_prenom: ficheAvant.prenom, p_nom: ficheAvant.nom,
      p_email_personnel: ficheAvant.email_personnel, p_telephone: ficheAvant.telephone,
      p_url_linkedin: ficheAvant.url_linkedin, p_localisation_texte: ficheAvant.localisation_texte,
      p_photo_url: ficheAvant.photo_url, p_cv_url: ficheAvant.cv_url,
      p_portfolio_url: ficheAvant.portfolio_url,
    });
    const apres = (await lireVue(jetons.talent, 'ma_fiche', 'select=photo_url')).corps?.[0];
    verifier(apres?.photo_url === ficheAvant.photo_url, 'la photo d’origine est remise',
      `${(apres?.photo_url ?? 'null').slice(0, 40)}…`);
  }
}

// 6c. Les attentes : la donnée en base passe, et le garde-fou des unités tient.
if (ficheAvant) {
  const charge = {
    p_metier_code: ficheAvant.attentes_metier_code,
    p_univers_code: ficheAvant.attentes_univers_code,
    p_salaire_min_ke: ficheAvant.attentes_salaire_min_ke,
    p_salaire_max_ke: ficheAvant.attentes_salaire_max_ke,
    p_tjm_min_eur: ficheAvant.attentes_tjm_min_eur,
    p_tjm_max_eur: ficheAvant.attentes_tjm_max_eur,
    p_disponibilite_texte: ficheAvant.attentes_disponibilite_texte,
    p_localisation_texte: ficheAvant.attentes_localisation_texte,
    p_description: ficheAvant.attentes_description,
    p_recherche_active: ficheAvant.recherche_active,
  };
  const r = await appeler(jetons.talent, 'maj_mes_attentes', charge);
  verifier(r.ok, 'api.maj_mes_attentes accepte les attentes DÉJÀ en base',
    r.ok ? `${r.corps?.champs_modifies} champ(s)` : r.brut.slice(0, 200));

  const unites = await appeler(jetons.talent, 'maj_mes_attentes', { ...charge, p_salaire_min_ke: 55000 });
  verifier(!unites.ok, 'un salaire de 55 000 dans un champ en K€ est refusé',
    unites.ok ? 'ACCEPTÉ' : `statut ${unites.statut}`);

  const inverse = await appeler(jetons.talent, 'maj_mes_attentes',
    { ...charge, p_salaire_min_ke: 80, p_salaire_max_ke: 40 });
  verifier(!inverse.ok, 'un minimum supérieur au maximum est refusé',
    inverse.ok ? 'ACCEPTÉ' : `statut ${inverse.statut}`);

  const metier = await appeler(jetons.talent, 'maj_mes_attentes',
    { ...charge, p_metier_code: 'metier-qui-n-existe-pas' });
  verifier(!metier.ok, 'un code métier inconnu est refusé',
    metier.ok ? 'ACCEPTÉ' : `statut ${metier.statut}`);
}

// 6d. Les six listes déclaratives, réécrites à l'identique.
if (ficheAvant) {
  const LISTES = [
    ['secteur_vise', ficheAvant.secteurs_vises_codes],
    ['secteur_nogo', ficheAvant.secteurs_nogo_codes],
    ['critere',      ficheAvant.criteres_codes],
    ['expertise',    ficheAvant.expertises_codes],
    ['contrat',      ficheAvant.contrats_souhaites],
    ['remote',       ficheAvant.remote_souhaites],
  ];
  for (const [type, codes] of LISTES) {
    const r = await appeler(jetons.talent, 'maj_mes_listes',
      { p_type: type, p_codes: codes ?? [] });
    verifier(r.ok, `api.maj_mes_listes rejoue « ${type} » à l’identique`,
      r.ok ? `${r.corps?.nombre_avant} → ${r.corps?.nombre_apres} · journal sur ${r.corps?.table}`
           : r.brut.slice(0, 160));
    verifier(r.ok && typeof r.corps?.table === 'string' && r.corps.table.startsWith('core.fiche_talent_'),
      `« ${type} » journalise le NOM RÉEL de sa table`, r.corps?.table ?? 'aucun');
  }
  const inconnu = await appeler(jetons.talent, 'maj_mes_listes',
    { p_type: 'secteur_vise', p_codes: ['secteur-inexistant'] });
  verifier(!inconnu.ok, 'un code de secteur inconnu est refusé',
    inconnu.ok ? 'ACCEPTÉ' : `statut ${inconnu.statut}`);

  // Le secteur à la fois visé et no-go : on le pose en no-go, puis on tente
  // de le viser. Tout est remis en place ensuite.
  const r0 = await lireVue(jetons.talent, 'mon_referentiel',
    'select=code&referentiel=eq.secteur&limit=1');
  const unSecteur = r0.corps?.[0]?.code ?? null;
  if (unSecteur) {
    const pose = await appeler(jetons.talent, 'maj_mes_listes',
      { p_type: 'secteur_nogo', p_codes: [unSecteur] });
    const conflit = await appeler(jetons.talent, 'maj_mes_listes',
      { p_type: 'secteur_vise', p_codes: [unSecteur] });
    verifier(pose.ok && !conflit.ok,
      'un secteur à la fois visé et no-go est refusé',
      conflit.ok ? 'ACCEPTÉ — la règle croisée ne joue pas' : `statut ${conflit.statut}`);
    // Remise en état des deux listes.
    await appeler(jetons.talent, 'maj_mes_listes',
      { p_type: 'secteur_nogo', p_codes: ficheAvant.secteurs_nogo_codes ?? [] });
    await appeler(jetons.talent, 'maj_mes_listes',
      { p_type: 'secteur_vise', p_codes: ficheAvant.secteurs_vises_codes ?? [] });
    const remis = (await lireVue(jetons.talent, 'ma_fiche',
      'select=secteurs_vises_codes,secteurs_nogo_codes')).corps?.[0] ?? {};
    const memeListe = (a, b) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
    verifier(memeListe(remis.secteurs_vises_codes, ficheAvant.secteurs_vises_codes)
          && memeListe(remis.secteurs_nogo_codes, ficheAvant.secteurs_nogo_codes),
      'les deux listes de secteurs sont remises à l’identique',
      `${(remis.secteurs_vises_codes ?? []).length} visés, ${(remis.secteurs_nogo_codes ?? []).length} no-go`);
  } else {
    saute('aucun secteur au référentiel', 'contrôle du conflit visé/no-go sauté');
  }
}

// 6e. La frise d'expériences : ajouter, retoucher, supprimer.
{
  const cle = `j4-poste-${Date.now()}`;
  const un = await appeler(jetons.talent, 'ajouter_mon_poste', {
    p_intitule: 'Contrôle J4', p_entreprise_nom: 'Pachamama (contrôle)',
    p_debut_le: '2020-01-01', p_fin_le: '2021-01-01', p_en_cours: false,
    p_description: 'ligne de contrôle, supprimée en fin de harnais',
    p_cle_idempotence: cle,
  });
  const deux = await appeler(jetons.talent, 'ajouter_mon_poste', {
    p_intitule: 'Contrôle J4', p_entreprise_nom: 'Pachamama (contrôle)',
    p_debut_le: '2020-01-01', p_fin_le: '2021-01-01', p_en_cours: false,
    p_description: 'ligne de contrôle, supprimée en fin de harnais',
    p_cle_idempotence: cle,
  });
  verifier(un.ok && Boolean(un.corps?.poste_id), 'api.ajouter_mon_poste crée un poste',
    un.ok ? un.corps.poste_id : un.brut.slice(0, 200));
  verifier(deux.ok && un.corps?.poste_id === deux.corps?.poste_id,
    'le rejeu avec la même clé rend LE MÊME poste',
    `${un.corps?.poste_id} = ${deux.corps?.poste_id}`);
  const n = await compter(jetons.talent, 'mes_postes');
  verifier(n === 1, 'deux appels, UN seul poste dans la frise', `${n} ligne(s)`);

  const encours = await appeler(jetons.talent, 'ajouter_mon_poste',
    { p_intitule: 'Contrôle', p_en_cours: true, p_fin_le: '2024-01-01' });
  verifier(!encours.ok, 'un poste « en cours » avec une date de fin est refusé',
    encours.ok ? 'ACCEPTÉ' : `statut ${encours.statut}`);
  const dates = await appeler(jetons.talent, 'ajouter_mon_poste',
    { p_intitule: 'Contrôle', p_debut_le: '2022-01-01', p_fin_le: '2021-01-01' });
  verifier(!dates.ok, 'une fin antérieure au début est refusée',
    dates.ok ? 'ACCEPTÉ' : `statut ${dates.statut}`);
  const sansTitre = await appeler(jetons.talent, 'ajouter_mon_poste', { p_intitule: '  ' });
  verifier(!sansTitre.ok, 'un poste sans intitulé est refusé',
    sansTitre.ok ? 'ACCEPTÉ' : `statut ${sansTitre.statut}`);

  if (un.corps?.poste_id) {
    const maj = await appeler(jetons.talent, 'maj_mon_poste', {
      p_poste_id: un.corps.poste_id, p_intitule: 'Contrôle J4 retouché',
      p_entreprise_nom: 'Pachamama (contrôle)', p_debut_le: '2020-01-01', p_en_cours: true,
    });
    verifier(maj.ok && maj.corps?.champs_modifies >= 1, 'api.maj_mon_poste retouche le poste',
      maj.ok ? `${maj.corps.champs_modifies} champ(s)` : maj.brut.slice(0, 160));
    const lu = (await lireVue(jetons.talent, 'mes_postes', 'select=intitule,en_cours,fin_le')).corps?.[0];
    verifier(lu?.intitule === 'Contrôle J4 retouché' && lu?.en_cours === true && lu?.fin_le === null,
      '« en cours » efface bien la date de fin', JSON.stringify(lu));

    // Un autre talent ne touche pas ce poste.
    if (jetons.recruteur && profils.recruteur?.fiche_talent_id
        && profils.recruteur.fiche_talent_id !== MA_FICHE) {
      const vol = await appeler(jetons.recruteur, 'maj_mon_poste',
        { p_poste_id: un.corps.poste_id, p_intitule: 'volé' });
      verifier(!vol.ok, 'un autre talent ne peut pas retoucher ce poste',
        vol.ok ? 'ACCEPTÉ — fuite d’écriture' : `statut ${vol.statut}`);
    }

    const sup = await appeler(jetons.talent, 'supprimer_mon_poste', { p_poste_id: un.corps.poste_id });
    verifier(sup.ok, 'api.supprimer_mon_poste retire le poste',
      sup.ok ? 'oui' : sup.brut.slice(0, 160));
    const reste = await compter(jetons.talent, 'mes_postes');
    verifier(reste === 0, 'la frise est revenue à son état d’origine', `${reste} ligne(s)`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 7. Postuler : idempotence, doublon, offre retirée
// ═══════════════════════════════════════════════════════════════════════
titre('7. Postuler');
const aNettoyer = { candidatures: [], demandes: [], cles: [] };
{
  // Une offre publiée à laquelle ce talent n'a PAS déjà postulé.
  const offres = (await lireVue(jetons.talent, 'offre_publique', 'select=id&limit=50')).corps ?? [];
  const dejaVues = new Set(((await lireVue(jetons.talent, 'ma_candidature_detail',
    'select=mandat_id&limit=1000')).corps ?? []).map((x) => x.mandat_id));
  const cible = offres.map((o) => o.id).find((id) => !dejaVues.has(id)) ?? null;
  verifier(Boolean(cible), 'une offre publiée non encore postulée est disponible',
    cible ?? `${offres.length} offre(s), toutes déjà postulées`);

  if (cible) {
    const cle = `j4-postuler-${Date.now()}`;
    aNettoyer.cles.push(cle);
    const charge = { p_mandat_id: cible, p_message: `contrôle J4 ${cle}`, p_cle_idempotence: cle };
    const avant = await compter(jetons.talent, 'ma_candidature_detail');

    const un   = await appeler(jetons.talent, 'postuler', charge);
    const deux = await appeler(jetons.talent, 'postuler', charge);

    verifier(un.ok && Boolean(un.corps?.candidature_id), 'la candidature est acceptée',
      un.ok ? `candidature ${un.corps.candidature_id} · ${un.corps.reference_pseudonyme}` : un.brut.slice(0, 250));
    if (un.corps?.candidature_id) aNettoyer.candidatures.push(un.corps.candidature_id);
    verifier(deux.ok, 'le rejeu est accepté sans erreur', deux.ok ? 'oui' : deux.brut.slice(0, 160));
    verifier(un.corps?.candidature_id && un.corps.candidature_id === deux.corps?.candidature_id,
      'le rejeu rend LE MÊME résultat', `${un.corps?.candidature_id} = ${deux.corps?.candidature_id}`);

    const apres = await compter(jetons.talent, 'ma_candidature_detail');
    verifier(apres === avant + 1, 'deux appels, UNE seule candidature', `${avant} → ${apres}`);

    verifier(Boolean(un.corps?.reference_pseudonyme),
      'le pseudonyme est posé par le déclencheur', un.corps?.reference_pseudonyme ?? 'aucun');
    verifier(un.corps?.etape === 'applicant',
      'la candidature entre à l’étape applicant', un.corps?.etape ?? '?');

    // LE DOUBLON, avec une clé d'idempotence DIFFÉRENTE : c'est la règle
    // métier qui doit refuser, pas le cache d'idempotence.
    const doublon = await appeler(jetons.talent, 'postuler',
      { p_mandat_id: cible, p_cle_idempotence: `j4-doublon-${Date.now()}` });
    aNettoyer.cles.push('j4-doublon-');
    verifier(!doublon.ok, 'postuler deux fois au même mandat est refusé',
      doublon.ok ? 'ACCEPTÉ — 110ᵉ doublon fabriqué' : `statut ${doublon.statut}`);

    // La même clé avec une charge DIFFÉRENTE doit être refusée.
    const triche = await appeler(jetons.talent, 'postuler', { ...charge, p_message: 'autre charge' });
    verifier(!triche.ok, 'la même clé avec une charge différente est refusée',
      triche.ok ? 'ACCEPTÉE — trou d’idempotence' : `statut ${triche.statut}`);

    // Le message est bien devenu une note visible du talent, et signée « Vous ».
    const note = await lireVue(jetons.talent, 'ma_note_partagee',
      `select=auteur,auteur_est_moi,commentaire&candidature_id=eq.${un.corps?.candidature_id}`);
    verifier(note.corps?.[0]?.auteur === 'Vous' && note.corps[0].auteur_est_moi === true,
      'le message d’accompagnement porte « Vous » pour auteur',
      note.corps?.[0]?.auteur ?? 'aucune note');
    // …et le client ne la voit pas.
    if (jetons.entreprise) {
      const cote = await lireVue(jetons.entreprise, 'note_partagee',
        `select=id&candidature_id=eq.${un.corps?.candidature_id}`);
      verifier((cote.corps ?? []).length === 0,
        'le client ne voit PAS le message du candidat', `${(cote.corps ?? []).length} note(s)`);
    }

    // 7b. Le retrait.
    const mauvaisMotif = await appeler(jetons.talent, 'retirer_ma_candidature',
      { p_candidature_id: un.corps?.candidature_id, p_motif_code: 'competences_insuffisantes' });
    verifier(!mauvaisMotif.ok, 'un motif du registre « pachamama » est refusé au candidat',
      mauvaisMotif.ok ? 'ACCEPTÉ' : `statut ${mauvaisMotif.statut}`);
    const sansMotif = await appeler(jetons.talent, 'retirer_ma_candidature',
      { p_candidature_id: un.corps?.candidature_id });
    verifier(!sansMotif.ok, 'un retrait sans motif est refusé (par la signature : p_motif_code n’a pas de défaut)',
      sansMotif.ok ? 'ACCEPTÉ' : `statut ${sansMotif.statut}`);

    const retrait = await appeler(jetons.talent, 'retirer_ma_candidature', {
      p_candidature_id: un.corps?.candidature_id,
      p_motif_code: 'candidat_renonce',
      p_commentaire: 'contrôle J4',
      p_cle_idempotence: `j4-retrait-${Date.now()}`,
    });
    verifier(retrait.ok && retrait.corps?.etape_apres === 'ko_by_candidat',
      'api.retirer_ma_candidature bascule en ko_by_candidat',
      retrait.ok ? `${retrait.corps.etape_avant} → ${retrait.corps.etape_apres}` : retrait.brut.slice(0, 200));

    const relu = (await lireVue(jetons.talent, 'ma_candidature_detail',
      `select=etape,etape_code,retire_par_talent_le,motif_retrait,motif_retrait_libelle&id=eq.${un.corps?.candidature_id}`)).corps?.[0];
    verifier(relu?.etape_code === 'ko_by_candidat' && Boolean(relu?.retire_par_talent_le),
      'la vue rend le retrait horodaté', JSON.stringify(relu));
    verifier(relu?.etape === '🙅🏻‍♀️ Candidature retirée',
      'le libellé talent dit « Candidature retirée », pas « KO by candidat »', relu?.etape ?? '?');

    const encore = await appeler(jetons.talent, 'retirer_ma_candidature',
      { p_candidature_id: un.corps?.candidature_id, p_motif_code: 'candidat_renonce' });
    verifier(!encore.ok, 'retirer une candidature déjà close est refusé',
      encore.ok ? 'ACCEPTÉ' : `statut ${encore.statut}`);
  }

  // Une offre inconnue, et une candidature qui n'est pas la sienne.
  const inconnue = await appeler(jetons.talent, 'postuler',
    { p_mandat_id: '00000000-0000-0000-0000-000000000000' });
  verifier(!inconnue.ok, 'postuler à une offre inconnue est refusé',
    inconnue.ok ? 'ACCEPTÉ' : `statut ${inconnue.statut}`);
  const pasLaMienne = await appeler(jetons.talent, 'retirer_ma_candidature',
    { p_candidature_id: '00000000-0000-0000-0000-000000000000', p_motif_code: 'candidat_renonce' });
  verifier(!pasLaMienne.ok, 'retirer une candidature hors périmètre est refusé',
    pasLaMienne.ok ? 'ACCEPTÉ' : `statut ${pasLaMienne.statut}`);

  // Un argument obligatoire passé À NULL : c'est la VALIDATION de la fonction
  // qu'on éprouve, pas la résolution de signature de PostgREST (qui répond
  // 404 quand l'argument est absent — un refus, mais pas celui qu'on écrit).
  const nuls = [
    ['api.postuler', 'postuler', { p_mandat_id: null }],
    ['api.retirer_ma_candidature', 'retirer_ma_candidature',
      { p_candidature_id: null, p_motif_code: 'candidat_renonce' }],
    ['api.retirer_ma_candidature (motif nul)', 'retirer_ma_candidature',
      { p_candidature_id: '00000000-0000-0000-0000-000000000000', p_motif_code: null }],
    ['api.enregistrer_mon_consentement', 'enregistrer_mon_consentement', { p_donne: null }],
    ['api.maj_mes_listes (type nul)', 'maj_mes_listes', { p_type: null, p_codes: [] }],
    ['api.ajouter_mon_poste (intitulé nul)', 'ajouter_mon_poste', { p_intitule: null }],
    ['api.supprimer_mon_poste', 'supprimer_mon_poste', { p_poste_id: null }],
  ];
  for (const [libelle, f, charge] of nuls) {
    const r = await appeler(jetons.talent, f, charge);
    verifier(!r.ok && r.statut !== 404, `${libelle} refuse un argument obligatoire à NULL`,
      r.ok ? 'ACCEPTÉ' : `statut ${r.statut}${r.statut === 404 ? ' — signature, pas validation' : ''}`);
  }
}

// 7c. La candidature spontanée : une seule ouverte à la fois.
{
  const dejaOuverte = ((await lireVue(jetons.talent, 'ma_candidature_detail',
    'select=id&est_spontanee=is.true&est_terminale=is.false&limit=1')).corps ?? []).length > 0;
  if (dejaOuverte) {
    saute('api.candidature_spontanee n’est pas éprouvée',
      'ce compte porte déjà une candidature spontanée ouverte, et la fonction en refuse une seconde à raison');
  } else {
  const cle = `j4-spontanee-${Date.now()}`;
  const un   = await appeler(jetons.talent, 'candidature_spontanee',
    { p_message: `contrôle J4 ${cle}`, p_cle_idempotence: cle });
  const deux = await appeler(jetons.talent, 'candidature_spontanee',
    { p_message: `contrôle J4 ${cle}`, p_cle_idempotence: cle });
  verifier(un.ok && Boolean(un.corps?.candidature_id),
    'api.candidature_spontanee crée une candidature sans mandat',
    un.ok ? `${un.corps.candidature_id} · ${un.corps.reference_pseudonyme}` : un.brut.slice(0, 250));
  if (un.corps?.candidature_id) aNettoyer.candidatures.push(un.corps.candidature_id);
  verifier(deux.ok && un.corps?.candidature_id === deux.corps?.candidature_id,
    'le rejeu rend LA MÊME candidature spontanée',
    `${un.corps?.candidature_id} = ${deux.corps?.candidature_id}`);
  verifier(un.corps?.est_spontanee === true, 'est_spontanee est vrai',
    `${un.corps?.est_spontanee}`);

  if (un.ok) {
    const lue = (await lireVue(jetons.talent, 'ma_candidature_detail',
      `select=mandat_id,est_spontanee,poste,entreprise,etape_code&id=eq.${un.corps.candidature_id}`)).corps?.[0];
    verifier(lue?.mandat_id === null && lue?.est_spontanee === true
             && lue?.etape_code === 'applicant',
      'la vue rend la candidature spontanée sans mandat', JSON.stringify(lue));

    const seconde = await appeler(jetons.talent, 'candidature_spontanee',
      { p_message: 'seconde', p_cle_idempotence: `${cle}-bis` });
    verifier(!seconde.ok, 'une seconde candidature spontanée ouverte est refusée',
      seconde.ok ? 'ACCEPTÉE' : `statut ${seconde.statut}`);
    if (seconde.corps?.candidature_id) aNettoyer.candidatures.push(seconde.corps.candidature_id);
  }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 8. Consentement, export, suppression
// ═══════════════════════════════════════════════════════════════════════
titre('8. Consentement, export, suppression');
{
  const avant = ficheAvant?.consentement_donne_le ?? null;
  const donne = await appeler(jetons.talent, 'enregistrer_mon_consentement', { p_donne: true });
  verifier(donne.ok && Boolean(donne.corps?.consentement_donne_le),
    'api.enregistrer_mon_consentement écrit consentement_donne_le',
    donne.ok ? donne.corps.consentement_donne_le : donne.brut.slice(0, 200));
  const retire = await appeler(jetons.talent, 'enregistrer_mon_consentement', { p_donne: false });
  verifier(retire.ok && retire.corps?.consentement_donne_le === null,
    'le retrait remet la colonne à NULL', `${retire.corps?.consentement_donne_le}`);
  const sansArgument = await appeler(jetons.talent, 'enregistrer_mon_consentement', {});
  verifier(!sansArgument.ok, 'un consentement sans p_donne est refusé (par la signature)',
    sansArgument.ok ? 'ACCEPTÉ' : `statut ${sansArgument.statut}`);
  // Remise dans l'état d'origine.
  if (avant) await appeler(jetons.talent, 'enregistrer_mon_consentement', { p_donne: true });
  const relu = (await lireVue(jetons.talent, 'ma_fiche', 'select=consentement_donne_le')).corps?.[0];
  verifier(Boolean(relu?.consentement_donne_le) === Boolean(avant),
    'le consentement est remis dans son état d’origine',
    `${avant ? 'donné' : 'absent'} → ${relu?.consentement_donne_le ? 'donné' : 'absent'}`);
}

// 8b. L'export RGPD ne contient rien du cabinet.
{
  const r = await appeler(jetons.talent, 'exporter_mes_donnees', {});
  verifier(r.ok && r.corps?.fiche_talent_id === MA_FICHE,
    'api.exporter_mes_donnees rend un export pour SA fiche',
    r.ok ? `${Object.keys(r.corps).join(', ')}` : r.brut.slice(0, 250));

  if (r.ok) {
    for (const clef of ['fiche', 'experiences', 'candidatures', 'notes_partagees']) {
      verifier(clef in r.corps, `l’export porte la section « ${clef} »`,
        Array.isArray(r.corps[clef]) ? `${r.corps[clef].length} élément(s)` : 'objet');
    }
    verifier(Array.isArray(r.corps.candidatures) && r.corps.candidatures.length > 0,
      'l’export porte au moins une candidature',
      `${r.corps.candidatures?.length ?? 0}`);

    // Aucune clé du cabinet, à n'importe quelle profondeur.
    const CABINET = ['est_qualifie', 'statut_relation', 'agent_referent_id', 'seniorite',
                     'mindset', 'emoji_statut', 'resume_ia', 'argumentaire_client',
                     'compte_rendu', 'appreciation_like', 'appreciation_personnalite',
                     'points_forts', 'points_faibles', 'infos_remuneration',
                     'note_interne', 'titre', 'apporteur_affaires_id',
                     'date_dernier_contact', 'anonymise_le', 'fusionnee_vers_fiche_id',
                     'salaire_souhaite_ke', 'tjm_souhaite_eur'];
    const trouvees = new Set();
    const parcourir = (n) => {
      if (Array.isArray(n)) return n.forEach(parcourir);
      if (n && typeof n === 'object') {
        for (const [k, v] of Object.entries(n)) {
          if (CABINET.includes(k)) trouvees.add(k);
          parcourir(v);
        }
      }
    };
    parcourir(r.corps);
    verifier(trouvees.size === 0, 'l’export ne contient AUCUNE clé du cabinet',
      trouvees.size ? `FUITE : ${[...trouvees].join(', ')}` : `${CABINET.length} clés absentes`);

    // Le texte brut ne doit pas non plus porter le titre interne d'un mandat.
    const brut = JSON.stringify(r.corps);
    verifier(!/KO by |Send-out|Screen Pachamama/i.test(brut),
      'l’export n’emploie pas le vocabulaire interne des étapes', `${brut.length} octets`);

    /**
     * ⚠ LE CODE D'ÉTAPE, QUE LES DEUX CONTRÔLES CI-DESSUS NE VOYAIENT PAS.
     *
     * `CABINET` liste des NOMS DE COLONNES ; la regex ci-dessus liste des
     * LIBELLÉS INTERNES. `ko_by_pachamama` n'est ni l'un ni l'autre — et c'est
     * exactement ce que l'export livrait, mesuré le 09/09 sur quatre des six
     * candidatures de ce compte, via un `to_jsonb(c)` sur
     * `api.ma_candidature_detail`. Les deux harnais du jalon étaient verts.
     *
     * D-02 collapse `ko`, `ko_by_pachamama` et `ko_by_client` en un seul
     * « Candidature close » POUR NE PAS DIRE QUI A FERMÉ. Le code le dit, et
     * l'export est un document que la personne garde. Colonnes énumérées depuis
     * `20260913190000`.
     */
    const CODES = ['to_contact', 'contacted', 'applicant', 'push_candidature',
                   'screen_pachamama', 'send_out', 'interview_1', 'interview_2',
                   'final_interview', 'hired', 'ko_by_pachamama', 'ko_by_client',
                   'ko_by_candidat'];
    const codesVus = CODES.filter((c) => brut.includes(c));
    verifier(codesVus.length === 0,
      'l’export ne porte aucun CODE du registre interne des étapes',
      codesVus.length ? `FUITE : ${codesVus.join(', ')}` : `${CODES.length} codes absents`);

    // Et les mécaniques qui ne sont pas des étapes : le pseudonyme que voit le
    // CLIENT, l'ordre du process, le code de fonction de l'agent, la notation
    // abrégée du salaire du mandat (« 60+5 »).
    const MECANIQUES = ['reference_pseudonyme', 'etape_ordre', 'etape_code',
                        'agent_fonction', 'mandat_salaire_infos',
                        'date_prochaine_echeance'];
    const mecaVues = MECANIQUES.filter((k) => brut.includes(`"${k}"`));
    verifier(mecaVues.length === 0,
      'l’export ne porte aucune clé de mécanique interne',
      mecaVues.length ? `FUITE : ${mecaVues.join(', ')}` : `${MECANIQUES.length} clés absentes`);

    // Contre-épreuve : sans elle, les deux contrôles passeraient sur un export
    // vide. Le talent DOIT retrouver son étape, dans le registre qui est le sien.
    verifier(r.corps.candidatures.every((c) => typeof c.etape === 'string' && c.etape.length > 0),
      'chaque candidature exportée porte son étape en registre talent',
      `${r.corps.candidatures.length} candidature(s)`);
  }
}

// 8c. La demande de suppression — seulement si on sait la nettoyer.
if (!sqlDispo) {
  saute('api.demander_ma_suppression n’est pas éprouvée',
    'elle bascule actif = false sur une personne réelle et rien dans l’API ne le remet ; canal de nettoyage absent');
} else {
  const cle = `j4-suppression-${Date.now()}`;
  const un   = await appeler(jetons.talent, 'demander_ma_suppression',
    { p_motif: 'contrôle J4', p_cle_idempotence: cle });
  const deux = await appeler(jetons.talent, 'demander_ma_suppression',
    { p_motif: 'contrôle J4', p_cle_idempotence: cle });
  verifier(un.ok && Boolean(un.corps?.demande_id), 'api.demander_ma_suppression enregistre la demande',
    un.ok ? un.corps.demande_id : un.brut.slice(0, 250));
  if (un.corps?.demande_id) aNettoyer.demandes.push(un.corps.demande_id);
  verifier(deux.ok && un.corps?.demande_id === deux.corps?.demande_id,
    'le rejeu rend LA MÊME demande', `${un.corps?.demande_id} = ${deux.corps?.demande_id}`);
  verifier(un.corps?.actif === false, 'la fiche est désactivée, pas effacée',
    `actif = ${un.corps?.actif}`);

  // Une deuxième demande, sous une autre clé, doit être refusée.
  const seconde = await appeler(jetons.talent, 'demander_ma_suppression',
    { p_motif: 'contrôle J4 bis', p_cle_idempotence: `${cle}-bis` });
  verifier(!seconde.ok, 'une seconde demande ouverte est refusée',
    seconde.ok ? 'ACCEPTÉE' : `statut ${seconde.statut}`);

  // Rien n'a été effacé : la fiche et ses candidatures sont toujours là.
  const s = await sql(`select
      (select count(*) from core.fiche_talent where id = '${MA_FICHE}') as fiche,
      (select count(*) from core.candidature where fiche_talent_id = '${MA_FICHE}') as candidatures;`);
  const chiffres = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)).rows?.[0] ?? {};
  verifier(Number(chiffres.fiche) === 1 && Number(chiffres.candidatures) > 0,
    'la fiche et ses candidatures sont intactes après la demande',
    `fiche ${chiffres.fiche}, candidatures ${chiffres.candidatures}`);
}

// ═══════════════════════════════════════════════════════════════════════
// 9. Ce que les autres ne peuvent pas appeler
// ═══════════════════════════════════════════════════════════════════════
titre('9. Ce que les autres ne peuvent pas appeler');
const FONCTIONS = [
  ['maj_ma_fiche', { p_prenom: 'A', p_nom: 'B' }],
  ['maj_mes_attentes', { p_description: 'essai' }],
  ['maj_mes_listes', { p_type: 'critere', p_codes: [] }],
  ['postuler', { p_mandat_id: '00000000-0000-0000-0000-000000000000' }],
  ['candidature_spontanee', {}],
  ['retirer_ma_candidature', { p_candidature_id: '00000000-0000-0000-0000-000000000000', p_motif_code: 'candidat_renonce' }],
  ['enregistrer_mon_consentement', { p_donne: true }],
  ['exporter_mes_donnees', {}],
  ['demander_ma_suppression', { p_motif: 'essai' }],
  ['ajouter_mon_poste', { p_intitule: 'essai' }],
  ['maj_mon_poste', { p_poste_id: '00000000-0000-0000-0000-000000000000', p_intitule: 'essai' }],
  ['supprimer_mon_poste', { p_poste_id: '00000000-0000-0000-0000-000000000000' }],
];
// 9a. Un compte SANS fiche talent : chaque fonction doit refuser.
if (jetons.entreprise && !profils.entreprise?.fiche_talent_id) {
  const acceptees = [];
  for (const [f, charge] of FONCTIONS) {
    const r = await appeler(jetons.entreprise, f, charge);
    if (r.ok) acceptees.push(f);
  }
  verifier(acceptees.length === 0,
    `un compte entreprise ne peut appeler aucune des ${FONCTIONS.length} fonctions du talent`,
    acceptees.length ? `ACCEPTÉES : ${acceptees.join(', ')}` : `${FONCTIONS.length} refus`);
} else {
  saute('le compte entreprise porte une fiche talent', 'contrôle 9a sauté');
}
// 9b. Un visiteur anonyme.
{
  const acceptees = [];
  for (const [f, charge] of FONCTIONS) {
    const r = await fetch(`${U}/rest/v1/rpc/${f}`, {
      method: 'POST',
      headers: { apikey: A, Authorization: `Bearer ${A}`, 'Content-Profile': 'api', 'Content-Type': 'application/json' },
      body: JSON.stringify(charge),
    });
    if (r.ok) acceptees.push(f);
  }
  verifier(acceptees.length === 0,
    `un visiteur anonyme ne peut appeler aucune des ${FONCTIONS.length} fonctions`,
    acceptees.length ? `ACCEPTÉES : ${acceptees.join(', ')}` : `${FONCTIONS.length} refus`);
}
// 9c. Les tables restent hors du réseau, et le journal illisible.
{
  for (const [profil, table] of [['core', 'fiche_talent'], ['app', 'journal_ecriture'],
                                 ['app', 'demande_suppression']]) {
    const r = await fetch(`${U}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: A, Authorization: `Bearer ${jetons.talent}`, 'Accept-Profile': profil },
    });
    verifier(!r.ok, `${profil}.${table} n’est pas atteignable par le réseau`, `statut ${r.status}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 10. La fermeture, prouvée par un contrôle qui échoue si on la retire
// ═══════════════════════════════════════════════════════════════════════
titre('10. La fermeture de core.fiche_talent, colonne par colonne');
if (!sqlDispo) {
  saute('le contrôle SQL de frontière n’a pas tourné', 'CLI Supabase indisponible');
} else {
  try {
    const sortie = await sqlFichier('frontend/tests/j4-frontiere-colonnes.sql');
    const bloc = sortie.slice(sortie.indexOf('{'), sortie.lastIndexOf('}') + 1);
    const ligne = JSON.parse(bloc).rows?.[0] ?? {};
    ok('le contrôle de frontière passe',
      'ceinture posée, bretelles éprouvées avec la ceinture retirée');
    verifier(ligne.grant_table_persistant === false,
      'le GRANT temporaire du contrôle a bien été annulé',
      `grant de table = ${ligne.grant_table_persistant}`);
    verifier(ligne.qualification_ecrivable === false && ligne.declaratif_ecrivable === true,
      'après contrôle : qualification fermée, déclaratif ouvert',
      `qualification=${ligne.qualification_ecrivable} déclaratif=${ligne.declaratif_ecrivable}`);
  } catch (e) {
    ko('le contrôle de frontière ÉCHOUE',
      String(e.stdout || e.message || e).replace(/\s+/g, ' ').slice(0, 300));
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 11. Nettoyage — le dev porte des données réelles
// ═══════════════════════════════════════════════════════════════════════
titre('11. Nettoyage');
if (!sqlDispo) {
  ko('le nettoyage n’a pas pu être fait', 'CLI Supabase indisponible');
  console.log('  À passer à la main, depuis la racine du dépôt :');
  console.log(`    supabase db query --linked "
      delete from app.transition_etape where candidature_id in (${aNettoyer.candidatures.map((c) => `'${c}'`).join(',') || 'null'});
      delete from core.note            where candidature_id in (${aNettoyer.candidatures.map((c) => `'${c}'`).join(',') || 'null'});
      delete from core.candidature     where id in (${aNettoyer.candidatures.map((c) => `'${c}'`).join(',') || 'null'});
      delete from app.demande_suppression where id in (${aNettoyer.demandes.map((d) => `'${d}'`).join(',') || 'null'});
      update core.fiche_talent set actif = true where id = '${MA_FICHE}';
      delete from app.idempotence where cle like '%:j4-%';"`);
} else {
  const enListe = (t) => (t.length ? t.map((x) => `'${x}'`).join(',') : 'null');
  try {
    const sortie = await sql(`
      delete from app.transition_etape   where candidature_id in (${enListe(aNettoyer.candidatures)});
      delete from core.note              where candidature_id in (${enListe(aNettoyer.candidatures)});
      delete from core.candidature       where id in (${enListe(aNettoyer.candidatures)});
      delete from app.demande_suppression where id in (${enListe(aNettoyer.demandes)});
      update core.fiche_talent set actif = true where id = '${MA_FICHE}' and not actif;
      delete from app.idempotence where cle like '%:j4-%';
      delete from core.fiche_talent_poste where fiche_talent_id = '${MA_FICHE}'
        and intitule like 'Contrôle J4%';
      select (select count(*) from core.candidature where id in (${enListe(aNettoyer.candidatures)})) as candidatures_restantes,
             (select count(*) from app.demande_suppression where fiche_talent_id = '${MA_FICHE}') as demandes_restantes,
             (select count(*) from app.idempotence where cle like '%:j4-%') as cles_restantes,
             (select count(*) from core.fiche_talent_poste where fiche_talent_id = '${MA_FICHE}') as postes_restants,
             (select actif from core.fiche_talent where id = '${MA_FICHE}') as fiche_active;`);
    const ligne = JSON.parse(sortie.slice(sortie.indexOf('{'), sortie.lastIndexOf('}') + 1)).rows?.[0] ?? {};
    verifier(Number(ligne.candidatures_restantes) === 0
          && Number(ligne.demandes_restantes) === 0
          && Number(ligne.cles_restantes) === 0
          && Number(ligne.postes_restants) === 0
          && ligne.fiche_active === true,
      'tout ce que le harnais a créé est retiré, et la fiche est réactivée',
      JSON.stringify(ligne));
  } catch (e) {
    ko('le nettoyage a échoué', String(e.stdout || e.message || e).replace(/\s+/g, ' ').slice(0, 300));
  }
}

// ═══════════════════════════════════════════════════════════════════════
console.log(echecs === 0
  ? `\nJ4 : tous les contrôles passent${sautes ? ` (${sautes} sauté(s))` : ''}`
  : `\nJ4 : ${echecs} contrôle(s) en échec${sautes ? `, ${sautes} sauté(s)` : ''}`);
process.exit(echecs === 0 ? 0 : 1);
