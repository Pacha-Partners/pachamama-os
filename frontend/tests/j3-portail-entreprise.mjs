#!/usr/bin/env node
/**
 * Harnais du jalon 3 — le portail Entreprise : ce qu'il ouvre, et ce qu'il ferme.
 *
 *   cd frontend && node --env-file=.env.local tests/j3-portail-entreprise.mjs \
 *     --email <compte de test> --mdp '<le mot de passe de test>' \
 *     --talent <compte de test> --recruteur <compte de test>
 *
 * Il travaille avec de VRAIS jetons — un compte entreprise, un compte talent,
 * un compte recruteur — et la clé de service. Trois jetons parce que la seule
 * façon de prouver un cloisonnement est de le voir refuser quelqu'un.
 *
 * ⚠ IL ÉCRIT. Le contrôle d'idempotence appelle deux fois
 * `api.decider_candidature` avec le sens « valide », qui ne fait AVANCER AUCUNE
 * étape : il dépose une décision et une note partagée sur une candidature du
 * compte de test. Chaque exécution en laisse une paire de plus dans le projet
 * de développement. Pour les retirer :
 *
 *   supabase db query --linked "
 *     delete from core.note        where commentaire like 'Profil validé.%contrôle J3 %';
 *     delete from app.decision_client where commentaire like 'contrôle J3 %';
 *     delete from app.idempotence  where cle like '%:j3-%';"
 *
 * Le journal (app.journal_ecriture) n'est PAS purgé : la table est en append
 * pur, et ses lignes sont la preuve que le mécanisme a fonctionné.
 *
 * ⚠ JAMAIS SUR LE PROJET LIVE. Le harnais refuse de tourner si l'URL n'est pas
 * celle du projet de développement.
 */
/*
 * ⚠ AUCUNE ADRESSE EN DUR DANS CE FICHIER.
 * Le dépôt `Pacha-Partners/pachamama-os` est PUBLIC, et les comptes de test du
 * projet de développement sont ceux de personnes réelles — c'est la raison pour
 * laquelle `.gitignore` exclut COMPTES_DE_TEST.md en toutes lettres. Les valeurs
 * viennent de `.env.local`, ignoré par git ; sans elles le harnais refuse de
 * tourner plutôt que de passer au vert sur un compte deviné.
 */

const DEV_REF = 'xavnvkpgbpczblmwlaxk';

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
  entreprise: { email: lire('--email', process.env.TEST_ENTREPRISE_EMAIL), mdp: lire('--mdp-entreprise', MDP) },
  talent:     { email: lire('--talent', process.env.TEST_TALENT_EMAIL),        mdp: lire('--mdp-talent', MDP) },
  recruteur:  { email: lire('--recruteur', process.env.TEST_RECRUTEUR_EMAIL), mdp: lire('--mdp-recruteur', MDP) },
};

let echecs = 0;
const ok = (t, d) => console.log(`  ✔ ${t}${d ? ` — ${d}` : ''}`);
const ko = (t, d) => { echecs++; console.log(`  ✘ ${t}${d ? ` — ${d}` : ''}`); };
const verifier = (c, t, d) => (c ? ok(t, d) : ko(t, d));
const titre = (t) => console.log(`\n${t}`);

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
  const corps = await r.text();
  let json = null;
  try { json = JSON.parse(corps); } catch { /* réponse non JSON */ }
  return { statut: r.status, ok: r.ok, corps: json, brut: corps };
}

async function compter(jeton, vue, filtre = '') {
  const r = await fetch(`${U}/rest/v1/${vue}?select=*${filtre}`, {
    headers: entetes(jeton, { Prefer: 'count=exact', Range: '0-0' }),
  });
  if (!r.ok) return -1;
  const plage = r.headers.get('content-range');
  return plage ? Number(plage.split('/')[1]) : -1;
}

async function appeler(jeton, fonction, corps) {
  const r = await fetch(`${U}/rest/v1/rpc/${fonction}`, {
    method: 'POST',
    headers: entetes(jeton, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(corps),
  });
  const texte = await r.text();
  let json = null;
  try { json = JSON.parse(texte); } catch { /* rien */ }
  return { statut: r.status, ok: r.ok, corps: json, brut: texte };
}

console.log('\nHarnais J3 — le portail Entreprise\n');
console.log(`  base      ${U}`);
console.log(`  entreprise ${COMPTES.entreprise.email}`);
console.log(`  talent     ${COMPTES.talent.email}`);
console.log(`  recruteur  ${COMPTES.recruteur.email}`);

// ═══════════════════════════════════════════════════════════════════════
// 1. Les trois connexions
// ═══════════════════════════════════════════════════════════════════════
titre('1. Les jetons');
const jetons = {};
for (const [role, c] of Object.entries(COMPTES)) {
  jetons[role] = await connexion(c.email, c.mdp);
  verifier(Boolean(jetons[role]), `le compte ${role} se connecte`, c.email);
}
if (!jetons.entreprise) {
  console.log('\nJ3 : sans jeton entreprise, rien n’est contrôlable.');
  process.exit(1);
}

const moi = (await lireVue(jetons.entreprise, 'moi', 'select=*')).corps?.[0] ?? null;
verifier(Boolean(moi?.compte_id), 'api.moi reconnaît le compte entreprise', moi?.compte_id ?? 'aucun');
verifier(Array.isArray(moi?.portails) && moi.portails.includes('entreprise'),
  'le compte porte bien le portail entreprise', (moi?.portails ?? []).join(' + ') || 'aucun');
verifier(Array.isArray(moi?.entreprise_ids) && moi.entreprise_ids.length > 0,
  'le compte est rattaché à au moins une entreprise', `${moi?.entreprise_ids?.length ?? 0} entreprise(s)`);

// ═══════════════════════════════════════════════════════════════════════
// 2. Les vues rendent quelque chose — et un nombre ATTENDU NON NUL
//    Sans ce contrôle, une base injoignable ferait passer tout le reste
//    au vert : « zéro ligne » est la réponse d'une porte fermée comme
//    celle d'un réseau coupé.
// ═══════════════════════════════════════════════════════════════════════
titre('2. Ce que le portail sert au client');
const VUES_ENTREPRISE = ['mon_entreprise', 'mon_produit', 'ma_facturation',
                         'candidat_presente', 'note_partagee',
                         'mandat_client', 'candidature_client'];
const ATTENDU_NON_VIDE = ['mon_entreprise', 'ma_facturation', 'candidat_presente',
                          'mandat_client', 'candidature_client'];

const vu = {};
for (const v of VUES_ENTREPRISE) {
  vu[v] = await compter(jetons.entreprise, v);
}
for (const v of ATTENDU_NON_VIDE) {
  verifier(vu[v] > 0, `api.${v} rend des lignes au client`, `${vu[v]} ligne(s)`);
}
console.log(`  · api.mon_produit : ${vu.mon_produit} · api.note_partagee : ${vu.note_partagee} (peuvent être à zéro)`);

// La clé de service voit la vue elle-même — c'est ce que D-11 lui rend.
for (const v of ATTENDU_NON_VIDE) {
  const service = await compter(S, v);
  verifier(service >= vu[v] && service > 0,
    `api.${v} reste auditable à la clé de service`, `${service} au total pour ${vu[v]} au client`);
}

// ═══════════════════════════════════════════════════════════════════════
// 3. Le cloisonnement : un talent et un recruteur ne voient RIEN
// ═══════════════════════════════════════════════════════════════════════
titre('3. Le cloisonnement, éprouvé par le refus');
for (const role of ['talent', 'recruteur']) {
  if (!jetons[role]) { ko(`compte ${role} indisponible`, 'contrôle sauté'); continue; }
  for (const v of VUES_ENTREPRISE) {
    const n = await compter(jetons[role], v);
    verifier(n === 0, `un compte ${role} rend 0 ligne sur api.${v}`,
      n < 0 ? 'vue inaccessible (0 par refus de droit)' : `${n} ligne(s)`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 4. api.candidat_presente ne PROJETTE aucune colonne interdite
//    On ne regarde pas les lignes rendues — on demande la colonne. Si elle
//    n'existe pas, PostgREST répond 42703 : c'est une preuve, pas un indice.
// ═══════════════════════════════════════════════════════════════════════
titre('4. Le profil contrôlé : ce qui n’en sort pas');
// D-14 — `nom` a QUITTÉ cette liste, et c'est une décision, pas un oubli.
// Le cadrage P0 décrit la feature ainsi : « prénom/nom (ou anonymisé selon
// étape), photo, CV » ; le garde-fou du métier porte sur l'AVIS interne, pas
// sur l'identité. Et la mesure a tranché le reste : 1 145 des 1 414 `cv_url`
// servis (81 %) portent déjà le patronyme dans le chemin du fichier. Masquer le
// nom au-dessus d'un lien qui le contient ne protégeait rien.
// Ce qui reste interdit ne bouge pas : les MOYENS DE CONTACT — le client passe
// par le cabinet — et tout ce que le cabinet PENSE du candidat.
const INTERDITES = [
  'email', 'email_personnel', 'telephone', 'url_linkedin',
  'est_qualifie', 'mindset', 'statut_relation', 'emoji_statut',
  'agent_referent', 'agent_referent_id', 'score_completude', 'seniorite',
  'compte_rendu', 'appreciation_like', 'appreciation_personnalite',
  'points_forts', 'points_faibles', 'infos_remuneration',
  'salaire_min_ke', 'salaire_souhaite_ke', 'tjm_souhaite_eur',
];
const fuites = [];
for (const col of INTERDITES) {
  const r = await lireVue(S, 'candidat_presente', `select=${col}&limit=1`);
  if (r.ok) fuites.push(col);
}
verifier(fuites.length === 0, `aucune des ${INTERDITES.length} colonnes interdites n’est projetée`,
  fuites.length ? `FUITE : ${fuites.join(', ')}` : `${INTERDITES.length} colonnes refusées`);

const ATTENDUES = ['reference_pseudonyme', 'argumentaire_client', 'etape', 'prenom', 'nom',
                   'localisation_texte', 'niveau_anglais', 'poste_actuel_employeur',
                   'metier_actuel', 'univers', 'expertises', 'cv_url', 'photo_url'];
const manquantes = [];
for (const col of ATTENDUES) {
  const r = await lireVue(S, 'candidat_presente', `select=${col}&limit=1`);
  if (!r.ok) manquantes.push(col);
}
verifier(manquantes.length === 0, 'les colonnes attendues sont bien là',
  manquantes.length ? `MANQUE : ${manquantes.join(', ')}` : `${ATTENDUES.length} colonnes`);

// Aucune clé interdite ne doit non plus se glisser dans une ligne réelle.
{
  const r = await lireVue(jetons.entreprise, 'candidat_presente', 'select=*&limit=1');
  const ligne = r.corps?.[0] ?? {};
  const cles = Object.keys(ligne);
  const suspectes = cles.filter((c) => INTERDITES.includes(c));
  verifier(suspectes.length === 0, 'une ligne réelle ne porte aucune clé interdite',
    `${cles.length} colonnes servies`);
}

// ═══════════════════════════════════════════════════════════════════════
// 5. L'écriture : une décision envoyée deux fois ne produit qu'un effet
// ═══════════════════════════════════════════════════════════════════════
titre('5. L’écriture, et son idempotence');

const candidats = await lireVue(jetons.entreprise, 'candidat_presente',
  'select=candidature_id,etape_code,est_terminale&est_terminale=is.false&limit=1');
const cible = candidats.corps?.[0] ?? null;
verifier(Boolean(cible?.candidature_id),
  'une candidature vivante est disponible pour éprouver l’écriture',
  cible ? `${cible.candidature_id} à l’étape ${cible.etape_code}` : 'aucune');

if (cible?.candidature_id) {
  const cle = `j3-${Date.now()}`;
  const filtre = `&candidature_id=eq.${cible.candidature_id}`;
  const avant = await compter(jetons.entreprise, 'note_partagee', filtre);

  const charge = {
    p_candidature_id: cible.candidature_id,
    p_sens: 'valide',
    p_commentaire: `contrôle J3 ${cle}`,
    p_cle_idempotence: cle,
  };
  const un   = await appeler(jetons.entreprise, 'decider_candidature', charge);
  const deux = await appeler(jetons.entreprise, 'decider_candidature', charge);

  verifier(un.ok && Boolean(un.corps?.decision_id),
    'la décision est acceptée', un.ok ? `décision ${un.corps.decision_id}` : un.brut.slice(0, 160));
  verifier(deux.ok, 'le rejeu est accepté sans erreur', deux.ok ? 'oui' : deux.brut.slice(0, 160));
  verifier(un.corps?.decision_id && un.corps.decision_id === deux.corps?.decision_id,
    'le rejeu rend LE MÊME résultat', `${un.corps?.decision_id} = ${deux.corps?.decision_id}`);
  verifier(un.corps?.etape_changee === false,
    '« valide » ne fait avancer aucune étape', `étape ${un.corps?.etape_apres}`);

  const apres = await compter(jetons.entreprise, 'note_partagee', filtre);
  verifier(apres === avant + 1,
    'deux appels, UNE seule note partagée', `${avant} → ${apres}`);

  // La note est bien signée du client, et lisible par lui.
  const note = await lireVue(jetons.entreprise, 'note_partagee',
    `select=auteur,auteur_est_client,commentaire&candidature_id=eq.${cible.candidature_id}&order=cree_le.desc&limit=1`);
  verifier(note.corps?.[0]?.auteur === 'Vous' && note.corps[0].auteur_est_client === true,
    'la note porte « Vous » pour son auteur', note.corps?.[0]?.auteur ?? 'aucune note');

  // Une clé déjà employée avec une charge DIFFÉRENTE doit être refusée.
  const triche = await appeler(jetons.entreprise, 'decider_candidature',
    { ...charge, p_commentaire: 'une autre charge' });
  verifier(!triche.ok, 'la même clé avec une charge différente est refusée',
    triche.ok ? 'ACCEPTÉE — trou d’idempotence' : `statut ${triche.statut}`);
}

// ═══════════════════════════════════════════════════════════════════════
// 6. Ce que l'écriture REFUSE
// ═══════════════════════════════════════════════════════════════════════
titre('6. Ce que l’écriture refuse');

// 6a. Une colonne hors liste blanche n'existe même pas comme argument.
{
  const r = await appeler(jetons.entreprise, 'maj_entreprise',
    { p_description: 'essai', p_success_fee_pct: 1 });
  verifier(!r.ok, 'api.maj_entreprise refuse p_success_fee_pct',
    r.ok ? 'ACCEPTÉE — la liste blanche fuit' : `statut ${r.statut}`);
}
{
  const r = await appeler(jetons.entreprise, 'maj_entreprise',
    { p_description: 'essai', p_statut_contrat_code: 'contrat_signe' });
  verifier(!r.ok, 'api.maj_entreprise refuse p_statut_contrat_code',
    r.ok ? 'ACCEPTÉE — la liste blanche fuit' : `statut ${r.statut}`);
}
{
  const r = await appeler(jetons.entreprise, 'creer_mandat',
    { p_titre: 'essai', p_valide_par_am_le: '2026-01-01' });
  verifier(!r.ok, 'api.creer_mandat refuse p_valide_par_am_le',
    r.ok ? 'ACCEPTÉE — la validation AM est contournable' : `statut ${r.statut}`);
}

// 6b. Les arguments invalides sont refusés bruyamment.
{
  const r = await appeler(jetons.entreprise, 'decider_candidature',
    { p_candidature_id: cible?.candidature_id ?? '00000000-0000-0000-0000-000000000000',
      p_sens: 'peut_etre' });
  verifier(!r.ok, 'un sens de décision inconnu est refusé', `statut ${r.statut}`);
}
{
  const r = await appeler(jetons.entreprise, 'decider_candidature',
    { p_candidature_id: cible?.candidature_id ?? '00000000-0000-0000-0000-000000000000',
      p_sens: 'refuse' });
  verifier(!r.ok, 'un refus sans motif est refusé', `statut ${r.statut}`);
}
{
  const r = await appeler(jetons.entreprise, 'decider_candidature',
    { p_candidature_id: cible?.candidature_id ?? '00000000-0000-0000-0000-000000000000',
      p_sens: 'refuse', p_motif_ko_code: 'competences_insuffisantes' });
  verifier(!r.ok, 'un motif du registre « pachamama » est refusé au client', `statut ${r.statut}`);
}
{
  // Le garde-fou des unités : 55 000 dans un champ nommé _ke.
  const r = await appeler(jetons.entreprise, 'creer_mandat',
    { p_titre: 'essai unités', p_salaire_min_ke: 55000 });
  verifier(!r.ok, 'un salaire de 55 000 dans un champ en K€ est refusé', `statut ${r.statut}`);
}
{
  const r = await appeler(jetons.entreprise, 'creer_mandat', { p_titre: '   ' });
  verifier(!r.ok, 'un brief sans intitulé est refusé', `statut ${r.statut}`);
}

// 6c. Une candidature hors périmètre est refusée.
{
  const r = await appeler(jetons.entreprise, 'decider_candidature',
    { p_candidature_id: '00000000-0000-0000-0000-000000000000', p_sens: 'valide' });
  verifier(!r.ok, 'une candidature hors périmètre est refusée', `statut ${r.statut}`);
}

// 6d. Un talent n'écrit rien du portail entreprise.
if (jetons.talent) {
  const cibles = [
    ['decider_candidature', { p_candidature_id: cible?.candidature_id ?? '00000000-0000-0000-0000-000000000000', p_sens: 'valide' }],
    ['maj_entreprise', { p_description: 'essai' }],
    ['creer_mandat', { p_titre: 'essai talent' }],
    ['maj_facturation', { p_email_facturation: 'essai@exemple.fr' }],
  ];
  for (const [f, corps] of cibles) {
    const r = await appeler(jetons.talent, f, corps);
    verifier(!r.ok, `un compte talent ne peut pas appeler api.${f}`,
      r.ok ? 'ACCEPTÉE — fuite d’écriture' : `statut ${r.statut}`);
  }
}

// 6e. Un visiteur anonyme n'atteint aucune des fonctions.
{
  const r = await fetch(`${U}/rest/v1/rpc/decider_candidature`, {
    method: 'POST',
    headers: { apikey: A, Authorization: `Bearer ${A}`, 'Content-Profile': 'api', 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_candidature_id: '00000000-0000-0000-0000-000000000000', p_sens: 'valide' }),
  });
  verifier(!r.ok, 'un visiteur anonyme ne peut pas appeler api.decider_candidature', `statut ${r.status}`);
}

// ═══════════════════════════════════════════════════════════════════════
// 7. Le journal reste illisible depuis un portail
// ═══════════════════════════════════════════════════════════════════════
titre('7. Le journal, écrit mais fermé');
{
  const r = await fetch(`${U}/rest/v1/journal_ecriture?select=id&limit=1`, {
    headers: entetes(jetons.entreprise, { 'Accept-Profile': 'app' }),
  });
  verifier(!r.ok, 'app.journal_ecriture n’est pas atteignable par le réseau', `statut ${r.status}`);
}
{
  const r = await fetch(`${U}/rest/v1/entreprise?select=success_fee_pct&limit=1`, {
    headers: entetes(jetons.entreprise, { 'Accept-Profile': 'core' }),
  });
  verifier(!r.ok, 'core n’est pas exposé : aucune écriture directe possible', `statut ${r.status}`);
}

// ═══════════════════════════════════════════════════════════════════════
console.log(echecs === 0
  ? '\nJ3 : tous les contrôles passent'
  : `\nJ3 : ${echecs} contrôle(s) en échec`);
process.exit(echecs === 0 ? 0 : 1);
