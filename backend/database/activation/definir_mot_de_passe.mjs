#!/usr/bin/env node
/**
 * Pose un mot de passe sur un compte, pour pouvoir se connecter en test.
 *
 *   node --env-file=frontend/.env.local \
 *     backend/database/activation/definir_mot_de_passe.mjs --email vous@… --mdp '…' --appliquer
 *
 * POURQUOI IL EXISTE. Les 4 158 comptes ont été créés SANS mot de passe :
 * l'adresse vient de Bubble, pas le secret, et le scénario prévu à la mise en
 * ligne est un courriel de réinitialisation. En attendant que ce parcours soit
 * écrit, personne ne peut se connecter — pas même pour vérifier que la
 * connexion fonctionne. Cet outil ouvre une porte, une seule, à la demande.
 *
 * IL NE S'ADRESSE QU'AU PROJET DE DÉVELOPPEMENT, et il le vérifie.
 * Il n'imprime jamais le mot de passe.
 */

const args = process.argv.slice(2);
const lire = (nom) => {
  const i = args.indexOf(nom);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};
const EMAIL = lire('--email');
const MDP = lire('--mdp');
const APPLIQUER = args.includes('--appliquer');

const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const S = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!U || !S) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes');
if (!U.includes('xavnvkpgbpczblmwlaxk')) {
  throw new Error(`REFUS : cible inattendue ${U}. Développement uniquement.`);
}
if (!EMAIL) throw new Error('--email est obligatoire');
if (APPLIQUER && (!MDP || MDP.length < 8)) {
  throw new Error('--mdp est obligatoire avec --appliquer, et fait au moins 8 caractères');
}

const entetes = { apikey: S, Authorization: `Bearer ${S}`, 'Content-Type': 'application/json' };

const r = await fetch(`${U}/auth/v1/admin/users?filter=${encodeURIComponent(EMAIL)}`, { headers: entetes });
if (!r.ok) throw new Error(`recherche : HTTP ${r.status} ${await r.text()}`);
const trouve = (await r.json()).users?.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());
if (!trouve) throw new Error(`aucun utilisateur pour ${EMAIL}`);

console.log(`utilisateur ${trouve.id}`);
console.log(`adresse     ${trouve.email}`);
console.log(`confirmée   ${trouve.email_confirmed_at ? 'oui' : 'non'}`);
console.log(`mode        ${APPLIQUER ? 'ÉCRITURE' : 'simulation (aucune écriture)'}`);

if (!APPLIQUER) {
  console.log('\n  simulation — relancer avec --mdp "…" --appliquer pour poser le mot de passe');
  process.exit(0);
}

const p = await fetch(`${U}/auth/v1/admin/users/${trouve.id}`, {
  method: 'PUT',
  headers: entetes,
  body: JSON.stringify({ password: MDP, email_confirm: true }),
});
if (!p.ok) throw new Error(`écriture : HTTP ${p.status} ${(await p.text()).slice(0, 200)}`);
console.log('\n  mot de passe posé. Il n’est écrit nulle part : notez-le.');
