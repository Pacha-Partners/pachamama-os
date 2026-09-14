#!/usr/bin/env node
/**
 * Harnais des ÉCRANS du portail Entreprise — le pendant, côté Next, de
 * `tests/j3-portail-entreprise.mjs` qui éprouve la base.
 *
 *   # dans un terminal
 *   cd frontend && npm run dev
 *   # dans un autre
 *   cd frontend && node --env-file=.env.local tests/j3-portail-entreprise-ecrans.mjs \
 *     --email <compte de test> --mdp '<le mot de passe de test>' \
 *     --talent <compte de test> --base http://localhost:3000
 *
 * CE QU'IL FAIT, ET POURQUOI IL EXISTE
 * ────────────────────────────────────────────────────────────────────────────
 * Le harnais de base prouve que les vues et les fonctions rendent ce qu'il
 * faut. Il ne prouve pas que les ÉCRANS l'affichent : entre les deux il y a un
 * convertisseur, six pages, et une trentaine de composants. Celui-ci ouvre les
 * six adresses du portail avec une VRAIE session, sur le serveur Next tel qu'il
 * tourne, et lit le HTML rendu.
 *
 * Trois familles de contrôles :
 *   1. chaque route rend 200 et porte ses repères — un titre, une donnée réelle
 *      relue de la base, pas une chaîne écrite dans le test ;
 *   2. AUCUNE des colonnes fermées n'apparaît dans le HTML servi au client. Le
 *      nom de famille et les moyens de contact d'un candidat sont relus sous
 *      jeton de service, puis cherchés dans la page. Une fuite par le rendu ne
 *      se verrait pas sur la vue seule ;
 *   3. le cloisonnement d'affichage : un compte talent qui tape /entreprise est
 *      renvoyé, un visiteur sans session aussi.
 *
 * IL N'ÉCRIT RIEN. Que des GET. Contrairement au harnais de base, on peut le
 * relancer autant de fois qu'on veut sans laisser de trace.
 *
 * ⚠ JAMAIS SUR LE PROJET LIVE — il refuse de tourner ailleurs que sur le dev,
 * par cohérence avec son jumeau, même s'il ne fait que lire.
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
const BASE = lire('--base', 'http://localhost:3000').replace(/\/$/, '');

if (!U || !A) {
  console.error('Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(2);
}
if (!U.includes(DEV_REF)) {
  console.error(`REFUS : ${U} n’est pas le projet de développement (${DEV_REF}).`);
  process.exit(2);
}

const MDP = lire('--mdp', process.env.TEST_MDP);
const EMAIL = lire('--email', process.env.TEST_ENTREPRISE_EMAIL);
const TALENT = lire('--talent', process.env.TEST_TALENT_EMAIL);

/* ── Sortie ──────────────────────────────────────────────────────────────── */

let echecs = 0;
const section = (t) => console.log(`\n${t}`);
const ok = (t, detail) => console.log(`  ✔ ${t}${detail ? ` — ${detail}` : ''}`);
const ko = (t, detail) => {
  echecs += 1;
  console.log(`  ✘ ${t}${detail ? ` — ${detail}` : ''}`);
};
const verifier = (condition, t, detail) => (condition ? ok(t, detail) : ko(t, detail));

/* ── Session ─────────────────────────────────────────────────────────────── */

async function ouvrirSession(email, mdp) {
  const r = await fetch(`${U}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: A, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: mdp }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`${email} : ${JSON.stringify(j)}`);
  return j;
}

/**
 * Le cookie que `@supabase/ssr` attend, reconstitué.
 *
 * Format de la version 0.12 : la clé est `sb-<ref>-auth-token`, la valeur est
 * `base64-` suivi du base64url du JSON de session, découpée en morceaux
 * `<clé>.0`, `<clé>.1`… de 3 180 caractères au plus. Le découpage du paquet
 * tient compte de l'encodage d'URL ; ici la valeur est du base64url, donc de
 * l'ASCII pur, et `encodeURIComponent` ne l'allonge pas : une simple tranche
 * suffit et donne le même résultat.
 */
function cookiesDeSession(session) {
  const cle = `sb-${DEV_REF}-auth-token`;
  const valeur =
    'base64-' + Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  const TAILLE = 3180;
  if (valeur.length <= TAILLE) return `${cle}=${valeur}`;
  const morceaux = [];
  for (let i = 0; i * TAILLE < valeur.length; i += 1) {
    morceaux.push(`${cle}.${i}=${valeur.slice(i * TAILLE, (i + 1) * TAILLE)}`);
  }
  return morceaux.join('; ');
}

/* ── Lectures de référence ───────────────────────────────────────────────── */

async function api(jeton, chemin) {
  const r = await fetch(`${U}/rest/v1/${chemin}`, {
    headers: { apikey: A, Authorization: `Bearer ${jeton}`, 'Accept-Profile': 'api' },
  });
  if (!r.ok) throw new Error(`api ${chemin} → ${r.status}`);
  return r.json();
}

/* ── Écrans ──────────────────────────────────────────────────────────────── */

async function page(cookie, chemin) {
  const r = await fetch(`${BASE}${chemin}`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  });
  const html = r.status < 300 ? await r.text() : '';
  return { statut: r.status, destination: r.headers.get('location'), html };
}

/**
 * Le HTML rendu par React porte des commentaires de segmentation (`<!-- -->`)
 * entre les morceaux de texte, et échappe les apostrophes typographiques et les
 * accolades. On aplatit avant de chercher : sinon « Hublo - PMM Director »
 * n'est pas trouvé alors qu'il est bien à l'écran.
 */
function texteDe(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;|\s+/g, ' ');
}

const contient = (html, aiguille) => texteDe(html).includes(aiguille);

async function main() {
  console.log(`Harnais des écrans — ${BASE} contre ${U}`);

  const session = await ouvrirSession(EMAIL, MDP);
  const cookie = cookiesDeSession(session);
  const jeton = session.access_token;

  /* ── 0. La session est bien reconnue par Next ─────────────────────────── */
  section('0. La session traverse jusqu’au serveur');
  const racine = await page(cookie, '/entreprise');
  verifier(
    racine.statut === 200,
    'le cookie de session est accepté par le serveur Next',
    `statut ${racine.statut}${racine.destination ? ` → ${racine.destination}` : ''}`,
  );
  if (racine.statut !== 200) {
    console.log(
      '\n  Le reste du harnais suppose une session valide. Vérifiez que `npm run dev` tourne',
    );
    console.log('  et que le format de cookie de @supabase/ssr n’a pas changé de version.');
    process.exit(1);
  }

  /* ── 1. Tableau de bord ───────────────────────────────────────────────── */
  section('1. Le tableau de bord');
  const [entreprise] = await api(jeton, 'mon_entreprise?select=nom,am_nom&limit=1');
  const mandats = await api(
    jeton,
    // `recruteur_nom` et `agent_nom` entrent dans la sélection : sans eux, le
    // contrôle du nommage ci-dessous se serait sauté en silence en croyant
    // qu'aucun recruteur n'était affecté, alors qu'ils le sont 9 fois sur 9.
    'mandat_client?select=id,intitule,statut,presentes,candidatures,recruteur_nom,agent_nom&order=presentes.desc',
  );

  verifier(contient(racine.html, entreprise.nom), 'le nom de l’entreprise titre la page', entreprise.nom);
  verifier(contient(racine.html, 'Postes ouverts'), 'l’onglet des postes ouverts est là');
  verifier(contient(racine.html, 'Postes clos'), 'l’onglet des postes clos est là');
  verifier(
    mandats.every((m) => contient(racine.html, m.intitule)),
    'les mandats sont TOUS rendus, ouverts et clos',
    `${mandats.length} mandats`,
  );
  verifier(
    contient(racine.html, 'Profils à examiner'),
    'la tuile qui appelle un geste est présente',
  );
  verifier(
    contient(racine.html, 'Ouvrir un poste'),
    'l’action d’ouverture de poste est offerte',
  );

  /* ── 2. Détail d’un mandat ────────────────────────────────────────────── */

  /* ⚠ LE RECRUTEUR DU MANDAT EST NOMMÉ, ET AVANT L'ACCOUNT MANAGER.
     Ce sont eux qui font avancer le poste — ils appellent, organisent,
     remontent les retours — quand l'Account Manager tient la relation
     commerciale. Mesuré : `recruteur_nom` est renseigné 9 fois sur 9 sur les
     mandats du compte de test. L'oubli s'est produit TROIS fois (fiche
     entreprise, détail de candidature talent, fiche d'un profil) : la règle est
     désormais vérifiée plutôt que répétée. */
  const nommer = (html, mandat, ou) => {
    // Ce harnais ne porte pas de compteur de contrôles sautés : on trace la
    // situation sans la compter comme un succès.
    if (!mandat.recruteur_nom) {
      console.log(`  ~ aucun recruteur sur ce mandat : contrôle ${ou} sans objet`);
      return;
    }
    const iRec = html.indexOf(mandat.recruteur_nom);
    verifier(iRec > -1, `le recruteur du mandat est nommé ${ou}`, mandat.recruteur_nom);
    if (mandat.agent_nom) {
      const iAm = html.indexOf(mandat.agent_nom);
      verifier(
        iRec > -1 && (iAm === -1 || iRec < iAm),
        `et il passe devant l’Account Manager ${ou}`,
      );
    }
  };

  section('2. Le détail d’un poste');
  const avecProfils = mandats.find((m) => m.presentes > 0) ?? mandats[0];
  const detail = await page(cookie, `/entreprise/mandats/${avecProfils.id}`);
  verifier(detail.statut === 200, 'la page répond', `statut ${detail.statut}`);
  verifier(contient(detail.html, avecProfils.intitule), 'l’intitulé titre la page');
  verifier(contient(detail.html, 'Le pipeline'), 'la section pipeline est là');
  nommer(detail.html, avecProfils, 'sur l’écran du poste');

  const candidatures = await api(
    jeton,
    `candidature_client?select=id,reference_pseudonyme,etape,etape_code,est_terminale&mandat_id=eq.${avecProfils.id}`,
  );
  verifier(
    candidatures.every((c) => contient(detail.html, c.reference_pseudonyme)),
    'chaque profil présenté porte sa référence à l’écran',
    `${candidatures.length} profils`,
  );

  // Un mandat sans profil visible doit DIRE pourquoi, jamais sembler cassé.
  const sansProfil = mandats.find((m) => m.presentes === 0);
  if (sansProfil) {
    const vide = await page(cookie, `/entreprise/mandats/${sansProfil.id}`);
    const html = texteDe(vide.html);
    verifier(
      html.includes('Aucun profil') &&
        (html.includes('send-out') || html.includes('présenté') || html.includes('clos')),
      'un pipeline vide explique POURQUOI il est vide',
      sansProfil.intitule,
    );
  } else {
    ok('aucun mandat sans profil sur ce compte : contrôle sans objet');
  }

  const inexistant = await page(cookie, '/entreprise/mandats/00000000-0000-4000-8000-000000000000');
  verifier(inexistant.statut === 404, 'un mandat hors périmètre rend 404', `statut ${inexistant.statut}`);

  /* ── 3. Fiche d’un candidat, et ce qui ne doit PAS y être ─────────────── */
  section('3. La fiche d’un profil présenté');
  const cible = candidatures[0];
  const fiche = await page(cookie, `/entreprise/candidatures/${cible.id}`);
  verifier(fiche.statut === 200, 'la page répond', `statut ${fiche.statut}`);
  verifier(
    contient(fiche.html, cible.reference_pseudonyme),
    'la référence de suivi reste affichée sur la fiche (D-14 : le nom titre, la référence suit)',
  );
  nommer(fiche.html, avecProfils, 'sur la fiche d’un profil');
  verifier(
    contient(fiche.html, cible.est_terminale ? 'Ce profil est sorti' : 'Votre décision') ||
      contient(fiche.html, 'Ce recrutement est abouti'),
    'le panneau de décision correspond à l’état du dossier',
    cible.etape_code,
  );
  verifier(contient(fiche.html, 'Vos échanges'), 'le fil de notes partagées est là');

  if (S) {
    // ── DEUX RÉGIMES D'IDENTITÉ, ET C'EST LE CŒUR DU CONTRÔLE (D-14) ──
    // La FICHE d'un candidat présenté montre la personne : prénom, nom, photo,
    // CV. La LISTE et le KANBAN ne montrent que la référence pseudonyme.
    //
    // ⚠ On cherche dans le HTML BRUT, jamais dans `texteDe(html)`. La version
    // précédente de ce contrôle passait par `texteDe`, dont le
    // `.replace(/<[^>]+>/g, ' ')` supprime la balise AVEC SES ATTRIBUTS : elle
    // était structurellement incapable de voir une fuite par un `href`, un
    // `src` ou un `alt`. Elle était verte, et elle ne prouvait rien — alors que
    // 1 145 des 1 414 `cv_url` (81 %) portent le patronyme dans leur chemin.
    const [interne] = await fetch(
      `${U}/rest/v1/kanban?select=nom,prenom,fiche_talent_id,pretention_ke&candidature_id=eq.${cible.id}`,
      { headers: { apikey: S, Authorization: `Bearer ${S}`, 'Accept-Profile': 'api' } },
    ).then((r) => r.json());

    const [contact] = interne?.fiche_talent_id
      ? await fetch(
          `${U}/rest/v1/talent_recherche?select=email_personnel,telephone,url_linkedin&id=eq.${interne.fiche_talent_id}`,
          { headers: { apikey: S, Authorization: `Bearer ${S}`, 'Accept-Profile': 'api' } },
        ).then((r) => r.json())
      : [null];

    if (interne?.nom) {
      verifier(
        fiche.html.includes(interne.nom),
        'la FICHE montre le nom du candidat présenté — le client va le rencontrer',
        `cherché « ${interne.nom.slice(0, 2)}… » dans le HTML brut`,
      );

      // La liste du mandat, elle, ne doit porter aucun nom.
      const liste = await page(cookie, `/entreprise/mandats/${avecProfils.id}`);
      verifier(
        !liste.html.includes(interne.nom),
        'la LISTE du mandat ne montre AUCUN nom, seulement la référence',
        `statut ${liste.statut}`,
      );
      verifier(
        liste.html.includes(cible.reference_pseudonyme),
        'la LISTE désigne le candidat par sa référence pseudonyme',
        cible.reference_pseudonyme,
      );
    } else {
      ok('aucun nom en base sur cette candidature : contrôle d’identité sans objet');
    }

    // Ce qui ne sort JAMAIS, sur aucune des deux surfaces : les moyens de
    // contact — le client passe par le cabinet — et la négociation salariale
    // menée par Pachamama.
    for (const [libelle, valeur] of [
      ['l’e-mail personnel', contact?.email_personnel],
      ['le téléphone', contact?.telephone],
      ['le profil LinkedIn', contact?.url_linkedin],
    ]) {
      if (valeur) {
        verifier(!fiche.html.includes(valeur), `${libelle} du candidat n’est jamais servi`);
      }
    }
    if (interne?.pretention_ke !== null && interne?.pretention_ke !== undefined) {
      verifier(
        !texteDe(fiche.html).includes(`${interne.pretention_ke} K€`),
        'la prétention NÉGOCIÉE par le cabinet n’est pas rendue',
      );
    }
  } else {
    console.log('  · SUPABASE_SERVICE_ROLE_KEY absente : les contrôles de fuite sont sautés');
  }

  const inconnu = await page(cookie, '/entreprise/candidatures/00000000-0000-4000-8000-000000000000');
  verifier(inconnu.statut === 404, 'une candidature hors périmètre rend 404', `statut ${inconnu.statut}`);

  /* ── 4. Profil ────────────────────────────────────────────────────────── */
  section('4. Le profil de l’entreprise');
  const profil = await page(cookie, '/entreprise/profil');
  verifier(profil.statut === 200, 'la page répond', `statut ${profil.statut}`);
  verifier(contient(profil.html, 'Identité et vitrine'), 'l’onglet vitrine est là');
  verifier(contient(profil.html, 'Votre produit'), 'l’onglet produit est là');
  verifier(
    contient(profil.html, 'Ce qui manque aux candidats') &&
      contient(profil.html, 'Ce qui manque à la facturation'),
    'les deux cartes de manques sont là',
  );
  // ⚠ LE CONTRÔLE QUI COMPTE : la liste est CALCULÉE, pas écrite en dur.
  // On lit la vue, on en déduit ce qui devrait manquer, et on compare. Un jour
  // où quelqu'un remplira la localisation, ce contrôle suivra la donnée — et
  // si la liste était figée, il tomberait.
  const ent =
    (await api(session.access_token, 'mon_entreprise?select=localisation_texte,nb_techs,site_web'))[0] ??
    {};
  // ⚠ ON CHERCHE L'ANCRE, PAS LE LIBELLÉ. `contient` retire les balises, et
  // « Localisation » figure de toute façon deux fois sur la page — une fois en
  // libellé de champ. Le `href="#champ-…"` n'apparaît QUE dans la carte des
  // manques, et il est la promesse de cette carte : elle emmène au champ.
  const listeManques = profil.html.split('Ce qui manque aux candidats')[1] ?? '';
  for (const [colonne, libelle, ancre] of [
    ['localisation_texte', 'Localisation', 'champ-localisation'],
    ['nb_techs', 'Effectif technique', 'champ-techs'],
    ['site_web', 'Site web', 'champ-site'],
  ]) {
    const attendu = ent[colonne] === null || ent[colonne] === '';
    verifier(
      listeManques.includes(`href="#${ancre}"`) === attendu,
      `« ${libelle} » ${attendu ? 'est' : 'n’est pas'} annoncé comme manquant`,
      attendu ? 'colonne vide' : 'colonne renseignée',
    );
  }
  // Le logo se dépose, il ne se colle pas : même défaut que la photo du compte.
  verifier(
    /<input[^>]+type="file"/.test(profil.html) && !contient(profil.html, 'Adresse d’image'),
    'le logo se dépose : un vrai input[type=file], plus aucune adresse à coller',
  );

  /* ── 5. Facturation ───────────────────────────────────────────────────── */
  section('5. Contrat et factures');
  const facturation = await page(cookie, '/entreprise/facturation');
  verifier(facturation.statut === 200, 'la page répond', `statut ${facturation.statut}`);
  verifier(contient(facturation.html, 'Votre contrat'), 'le contrat est affiché');
  verifier(
    contient(facturation.html, 'Pacha Partners'),
    'la raison sociale qui émet les factures est nommée',
  );
  verifier(
    contient(facturation.html, 'Vos coordonnées de facturation'),
    'les coordonnées éditables sont là',
  );

  const placements = await api(jeton, 'ma_facturation?select=reference_pseudonyme&limit=3');
  verifier(
    placements.length === 0 ||
      placements.every((p) => !p.reference_pseudonyme || contient(facturation.html, p.reference_pseudonyme)),
    'les placements réels sont rendus',
    `${placements.length} lus`,
  );

  /* ── 6. Ouvrir un poste ───────────────────────────────────────────────── */
  section('6. Ouvrir un poste');
  const brief = await page(cookie, '/entreprise/mandats/nouveau');
  verifier(brief.statut === 200, 'la page répond', `statut ${brief.statut}`);
  verifier(contient(brief.html, 'Le poste'), 'la première étape est affichée');
  verifier(contient(brief.html, 'Relecture'), 'les quatre étapes sont annoncées');
  verifier(
    contient(brief.html, 'Intitulé du poste'),
    'le seul champ obligatoire est présenté d’emblée',
  );

  // Ouverte ici : elle sert au contrôle de cloisonnement du seau (§8) ET au
  // cloisonnement d'affichage (§9).
  const sessionTalentStockage = await ouvrirSession(TALENT, MDP);

  /* ── 7. Mes informations, et le dépôt de la photo ─────────────────────── */
  section('7. Mes informations');
  const compteEcran = await page(cookie, '/entreprise/compte');
  verifier(compteEcran.statut === 200, 'l’écran répond', `statut ${compteEcran.statut}`);
  verifier(
    contient(compteEcran.html, 'Ce que vous pouvez changer') &&
      contient(compteEcran.html, 'Ce qui vient de votre contrat'),
    'les deux colonnes sont titrées',
  );
  // ⚠ LE CONTRÔLE QUI COMPTE : un VRAI champ de fichier. L'écran servait un
  // champ de texte « Adresse d'image » — personne ne colle une URL quand on lui
  // demande sa photo. Si quelqu'un le remet, ce contrôle tombe.
  verifier(
    /<input[^>]+type="file"/.test(compteEcran.html),
    'la photo se dépose : il y a un vrai input[type=file]',
  );
  verifier(
    contient(compteEcran.html, '2 Mo maximum'),
    'le plafond est annoncé AVANT le choix',
  );
  verifier(
    !contient(compteEcran.html, 'Adresse d’image') &&
      !contient(compteEcran.html, 'Adresse d\'image'),
    'plus aucune invitation à coller une URL',
  );
  // Le chapeau a été retiré : une interface ne s'explique pas, le menu dit déjà
  // que « Mes informations » n'est pas « Profil entreprise ».
  verifier(
    !contient(compteEcran.html, 'Le profil de l’entreprise se règle ailleurs'),
    'aucune ligne d’explication sous le titre',
  );
  // La contrainte n'est écrite QU'UNE fois : elle l'était deux, à cinquante
  // pixels d'écart.
  const occurrences = (compteEcran.html.match(/2 Mo maximum/g) ?? []).length;
  verifier(occurrences === 1, 'la contrainte n’est pas répétée', `${occurrences} occurrence(s)`);

  /* ── 8. Le seau de la photo, cloisonné ────────────────────────────────── */
  section('8. Le seau documents-entreprise');
  const monContact = (await api(session.access_token, 'mon_compte?select=id'))[0]?.id;
  // Un PNG de 1×1 : le plus petit fichier que le seau accepte réellement.
  const PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const deposer = async (jeton, chemin, corps = PIXEL, type = 'image/png') => {
    const r = await fetch(`${U}/storage/v1/object/documents-entreprise/${chemin}`, {
      method: 'POST',
      headers: { apikey: A, Authorization: `Bearer ${jeton}`, 'Content-Type': type },
      body: corps,
    });
    return { statut: r.status, corps: await r.text() };
  };
  const marque = `harnais-${Date.now()}`;

  const sien = await deposer(session.access_token, `${monContact}/photo/${marque}.png`);
  verifier(sien.statut === 200, 'le dépôt dans son propre dossier photo/ est accepté', `statut ${sien.statut}`);

  const horsListe = await deposer(session.access_token, `${monContact}/cv/${marque}.png`);
  verifier(
    horsListe.statut !== 200 && horsListe.corps.includes('403'),
    'un dossier hors liste blanche est refusé par la RLS',
  );

  const chezAutrui = await deposer(
    session.access_token,
    `00000000-0000-0000-0000-000000000001/photo/${marque}.png`,
  );
  verifier(
    chezAutrui.statut !== 200 && chezAutrui.corps.includes('403'),
    'le dossier d’un autre contact est refusé — même en écriture',
  );

  const parLeTalent = await deposer(
    sessionTalentStockage.access_token,
    `${monContact}/photo/${marque}.png`,
  );
  verifier(
    parLeTalent.statut !== 200,
    'un compte talent n’écrit pas dans le seau des contacts clients',
  );

  const tropGros = await deposer(
    session.access_token,
    `${monContact}/photo/${marque}-gros.png`,
    Buffer.alloc(3 * 1024 * 1024, 1),
  );
  verifier(tropGros.corps.includes('413'), 'le plafond de 2 Mo est tenu par le seau lui-même');

  const pasUneImage = await deposer(
    session.access_token,
    `${monContact}/photo/${marque}.pdf`,
    Buffer.from('%PDF-1.4'),
    'application/pdf',
  );
  verifier(pasUneImage.corps.includes('415'), 'un PDF est refusé par le seau lui-même');

  // Le seau est PRIVÉ : l'objet déposé ne se sert pas sans signature.
  const nu = await fetch(
    `${U}/storage/v1/object/public/documents-entreprise/${monContact}/photo/${marque}.png`,
  );
  verifier(nu.status !== 200, 'l’objet n’est pas servi sans signature', `statut ${nu.status}`);

  // Nettoyage : le harnais ne laisse rien derrière lui.
  const menage = await fetch(`${U}/storage/v1/object/documents-entreprise`, {
    method: 'DELETE',
    headers: {
      apikey: A,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: [`${monContact}/photo/${marque}.png`] }),
  });
  verifier(menage.status === 200, 'l’objet déposé par le harnais est supprimé', `statut ${menage.status}`);

  /* ── 9. Cloisonnement d’affichage ─────────────────────────────────────── */
  section('9. Le cloisonnement d’affichage');
  const anonyme = await page(null, '/entreprise');
  verifier(
    anonyme.statut === 307 && (anonyme.destination ?? '').includes('/login'),
    'un visiteur sans session est renvoyé sur /login',
    `statut ${anonyme.statut}`,
  );

  const cookieTalent = cookiesDeSession(sessionTalentStockage);
  for (const chemin of ['/entreprise', '/entreprise/profil', '/entreprise/facturation']) {
    const r = await page(cookieTalent, chemin);
    verifier(
      r.statut === 307 && !(r.destination ?? '').includes('/entreprise'),
      `un compte talent n’entre pas sur ${chemin}`,
      `statut ${r.statut}${r.destination ? ` → ${r.destination}` : ''}`,
    );
  }

  /* ── Verdict ──────────────────────────────────────────────────────────── */
  console.log(
    echecs === 0
      ? '\nÉcrans J3 : tous les contrôles passent'
      : `\nÉcrans J3 : ${echecs} contrôle(s) en échec`,
  );
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nHarnais interrompu :', e.message);
  process.exit(2);
});
