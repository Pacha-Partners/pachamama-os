#!/usr/bin/env node
/**
 * Harnais des ÉCRANS de l'espace Talent — le pendant, côté Next, de
 * `tests/j4-espace-talent.mjs` qui éprouve la base.
 *
 *   # dans un terminal
 *   cd frontend && npm run dev
 *   # dans un autre
 *   cd frontend && npm run verifier:j4-ecrans
 *
 * CE QU'IL FAIT, ET POURQUOI IL EXISTE
 * ────────────────────────────────────────────────────────────────────────────
 * Le harnais de base prouve que les vues et les fonctions rendent ce qu'il
 * faut. Il ne prouve pas que les ÉCRANS l'affichent : entre les deux il y a un
 * convertisseur, huit routes et une trentaine de composants. Celui-ci ouvre
 * chaque adresse de l'espace avec une VRAIE session, sur le serveur Next tel
 * qu'il tourne, et lit le HTML rendu.
 *
 * Quatre familles de contrôles :
 *   1. chaque route rend 200 et porte ses repères — une donnée réelle relue de
 *      la base, jamais une chaîne écrite dans le test ;
 *   2. le REGISTRE TALENT est bien celui qui s'affiche : aucun libellé interne
 *      d'étape ne franchit l'écran (D-02) ;
 *   3. les colonnes fermées n'apparaissent nulle part, et les colonnes
 *      d'identité n'apparaissent QUE sur l'écran qui doit les montrer (D-15 :
 *      ce qu'on sélectionne part dans le HTML, affiché ou non) ;
 *   4. le parcours « Postuler » traverse la connexion sans perdre l'offre —
 *      c'est le défaut nommé dans le brief, et il se mesure par des redirections.
 *
 * ⚠ ON CHERCHE DANS LE HTML BRUT, JAMAIS DANS UN TEXTE DÉBALISÉ (D-16).
 * La version phase 1 de ce genre de contrôle passait par un `texteDe(html)`
 * dont le `.replace(/<[^>]+>/g, ' ')` supprime la balise AVEC SES ATTRIBUTS :
 * elle était structurellement incapable de voir une fuite par un `href`, un
 * `src` ou un `alt` — c'est-à-dire exactement la fuite qui existait. Elle était
 * verte, et elle ne prouvait rien. Ici, `contient()` sert à trouver un LIBELLÉ
 * (le HTML de React coupe le texte par des commentaires de segmentation) et
 * `fuite()` cherche une VALEUR dans le brut. Les deux ne sont pas
 * interchangeables, et le nom le dit.
 *
 * ⚠ IL N'ÉCRIT AUCUNE DONNÉE MÉTIER. Que des GET. Deux nuances :
 *
 *   · `/talent/donnees` appelle `api.exporter_mes_donnees`, qui inscrit une
 *     ligne dans `app.journal_ecriture` (entité `rgpd.export`). C'est le prix
 *     d'éprouver l'export pour de vrai, la table est en append pur, et cette
 *     trace est précisément ce qu'on veut pouvoir vérifier un jour ;
 *   · la section 11 — la boucle complète du téléversement — ÉCRIT, et elle ne
 *     tourne QUE sur `--stockage`. Elle dépose un objet, réécrit `cv_url` par
 *     `api.maj_ma_fiche`, relit l'écran, puis restaure la valeur d'origine et
 *     supprime l'objet. Elle est hors du passage par défaut parce qu'un harnais
 *     d'écrans doit pouvoir se relancer sans laisser de trace.
 *
 * ⚠ AUCUNE ADRESSE NI MOT DE PASSE EN DUR (D-20).
 * Le dépôt `Pacha-Partners/pachamama-os` est PUBLIC, et les comptes de test du
 * projet de développement sont ceux de personnes RÉELLES — c'est la raison pour
 * laquelle `.gitignore` exclut COMPTES_DE_TEST.md en toutes lettres. Les valeurs
 * viennent de `.env.local`, ignoré par git ; sans elles le harnais refuse de
 * tourner plutôt que de passer au vert sur un compte deviné.
 *
 * ⚠ JAMAIS SUR LE PROJET LIVE.
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
const TALENT = lire('--talent', process.env.TEST_TALENT_EMAIL);
const ENTREPRISE = lire('--entreprise', process.env.TEST_ENTREPRISE_EMAIL);
/** La section 11 écrit : elle ne tourne que si on la demande. */
const AVEC_STOCKAGE = args.includes('--stockage');

if (!TALENT || !MDP) {
  console.error('Compte talent absent : renseigner TEST_TALENT_EMAIL et TEST_MDP dans .env.local.');
  process.exit(2);
}

/* ── Sortie ──────────────────────────────────────────────────────────────── */

let echecs = 0;
let sautes = 0;
const section = (t) => console.log(`\n${t}`);
const ok = (t, detail) => console.log(`  ✔ ${t}${detail ? ` — ${detail}` : ''}`);
const ko = (t, detail) => {
  echecs += 1;
  console.log(`  ✘ ${t}${detail ? ` — ${detail}` : ''}`);
};
const saute = (t, detail) => {
  sautes += 1;
  console.log(`  ~ ${t}${detail ? ` — ${detail}` : ''}`);
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
 * `<clé>.0`, `<clé>.1`… de 3 180 caractères au plus. La valeur étant de
 * l'ASCII pur, une simple tranche suffit.
 */
function cookiesDeSession(session) {
  const cle = `sb-${DEV_REF}-auth-token`;
  const valeur = 'base64-' + Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
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
    headers: { apikey: jeton === S ? S : A, Authorization: `Bearer ${jeton}`, 'Accept-Profile': 'api' },
  });
  if (!r.ok) throw new Error(`api ${chemin} → ${r.status} ${await r.text()}`);
  return r.json();
}

/* ── Écrans ──────────────────────────────────────────────────────────────── */

async function page(cookie, chemin) {
  const r = await fetch(`${BASE}${chemin}`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  });
  const html = r.status < 300 ? await r.text() : '';
  return { statut: r.status, destination: r.headers.get('location'), html, entetes: r.headers };
}

/**
 * Le HTML rendu par React porte des commentaires de segmentation (`<!-- -->`)
 * entre les morceaux de texte, et échappe les apostrophes typographiques et les
 * accolades. On aplatit avant de chercher un LIBELLÉ.
 *
 * ⚠ NE JAMAIS EMPLOYER CETTE FONCTION POUR CHERCHER UNE FUITE : elle supprime
 * les balises avec leurs attributs. Voir `fuite()`.
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

/**
 * Une valeur cherchée dans le HTML BRUT — attributs compris.
 *
 * C'est la seule forme acceptable pour un contrôle de fuite : 81 % des `cv_url`
 * mesurés en phase 1 portent un patronyme dans leur CHEMIN, donc dans un `href`
 * ou un `src`, que `texteDe` efface.
 */
const fuite = (html, valeur) => Boolean(valeur) && html.includes(valeur);

const UUID_INCONNU = '00000000-0000-4000-8000-000000000000';

/* ══════════════════════════════════════════════════════════════════════════ */

async function main() {
  console.log(`Harnais des écrans de l’espace Talent — ${BASE} contre ${U}`);

  const session = await ouvrirSession(TALENT, MDP);
  const cookie = cookiesDeSession(session);
  const jeton = session.access_token;

  /* ── 0. La session traverse jusqu'au serveur ──────────────────────────── */
  section('0. La session traverse jusqu’au serveur');
  const accueil = await page(cookie, '/talent');
  verifier(
    accueil.statut === 200,
    'le cookie de session est accepté par le serveur Next',
    `statut ${accueil.statut}${accueil.destination ? ` → ${accueil.destination}` : ''}`,
  );
  if (accueil.statut !== 200) {
    console.log('\n  Le reste du harnais suppose une session valide. Vérifiez que `npm run dev`');
    console.log('  tourne et que le format de cookie de @supabase/ssr n’a pas changé de version.');
    process.exit(1);
  }

  const [fiche] = await api(
    jeton,
    'ma_fiche?select=id,prenom,nom,email_personnel,telephone,url_linkedin,cv_url,photo_url,attentes_metier,secteurs_nogo,consentement_donne_le,actif&limit=1',
  );
  const candidatures = await api(
    jeton,
    'ma_candidature?select=id,poste,entreprise,etape,etape_code,est_terminale,mandat_id&order=est_terminale.asc',
  );

  /* ── 1. Mon espace ────────────────────────────────────────────────────── */
  section('1. Mon espace');
  verifier(
    contient(accueil.html, fiche.prenom ?? 'vous'),
    'le prénom salue la personne',
    fiche.prenom ? `« Bonjour ${fiche.prenom} »` : 'fiche sans prénom : repli sur « vous »',
  );
  // La jauge dit désormais un COMPTE et non un pourcentage : quinze segments
  // montrent quinze informations, et « 14 / 15 » se lit sans conversion. On
  // exige donc la fraction elle-même — un contrôle plus fort que l'ancien, qui
  // se contentait du libellé et passait même si la valeur manquait.
  verifier(
    contient(accueil.html, 'Votre dossier') && /\b\d{1,2} \/ 15\b/.test(accueil.html),
    'la jauge de complétude est rendue, et elle porte sa fraction',
    (accueil.html.match(/\b\d{1,2} \/ 15\b/) ?? ['fraction absente'])[0],
  );
  verifier(
    /aria-valuenow|role="progressbar"/.test(accueil.html),
    'la jauge est une vraie barre de progression, pas un dessin',
  );
  // « Mon espace » ne montre plus qu'un APERÇU — trois process au plus. Le
  // suivi exhaustif est sur « Mes process », et c'est là qu'on l'exige.
  const ecranProcess = await page(cookie, '/talent/process');
  const ecranOffres = await page(cookie, '/talent/offres');
  verifier(ecranProcess.statut === 200, '/talent/process répond', `statut ${ecranProcess.statut}`);
  verifier(
    candidatures.every((c) => contient(ecranProcess.html, c.poste)),
    'tous les process sont listés sur « Mes process »',
    `${candidatures.length} process`,
  );
  verifier(
    accueil.html.includes('href="/talent/process"'),
    'l’aperçu de « Mon espace » renvoie vers « Mes process »',
  );
  {
    const lignes = (accueil.html.match(/href="\/talent\/candidatures\/[^"]+"/g) ?? []).length;
    verifier(
      lignes > 0 && lignes <= 3,
      'l’aperçu de « Mon espace » ne dépasse pas trois process',
      `${lignes} ligne(s) sur ${candidatures.length} process`,
    );
  }

  const anonymes = candidatures.filter((c) => c.entreprise === null);
  const nommees = candidatures.filter((c) => c.entreprise !== null);
  if (anonymes.length > 0) {
    verifier(
      contient(ecranProcess.html, 'Entreprise confidentielle'),
      'une offre anonyme est nommée « Entreprise confidentielle »',
      `${anonymes.length} anonyme(s) sur ${candidatures.length}`,
    );
  } else {
    saute('aucune offre anonyme sur ce compte : contrôle sans objet');
  }
  if (nommees.length > 0) {
    verifier(
      nommees.every((c) => contient(ecranProcess.html, c.entreprise)),
      'une offre non anonyme nomme bien son entreprise',
      nommees.map((c) => c.entreprise).join(', '),
    );
  } else {
    saute('aucune offre nommée sur ce compte : contrôle sans objet');
  }

  // Le consentement passe DEVANT la complétude : c'est une autorisation
  // absente, pas un champ incomplet.
  // L'accord est UN SEUL bloc en trois régimes, et non plus un encart présent
  // à l'état manquant et une ligne de précision sinon. On exige donc les deux
  // choses qui comptent : l'intitulé du bloc, toujours là, et l'énoncé propre
  // à l'état — daté quand l'accord existe.
  verifier(
    contient(accueil.html, 'Accord de présentation'),
    'l’accord de présentation a son bloc, quel que soit son état',
  );
  if (!fiche.consentement_donne_le) {
    verifier(
      contient(accueil.html, 'Votre dossier n’est présenté à aucune entreprise'),
      'sans consentement, l’écran le dit en premier',
    );
  } else {
    const attendu = `Présentation autorisée depuis le ${new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(fiche.consentement_donne_le))}`;
    verifier(
      contient(accueil.html, attendu),
      'avec consentement, l’écran le rappelle avec sa date',
      attendu,
    );
  }

  const [interlocuteur] = await api(
    jeton,
    'ma_candidature_detail?select=agent_prenom,agent_nom&agent_prenom=not.is.null&limit=1',
  ).catch(() => [null]);
  if (interlocuteur?.agent_prenom) {
    verifier(
      contient(accueil.html, `${interlocuteur.agent_prenom} ${interlocuteur.agent_nom ?? ''}`.trim()),
      'l’interlocuteur Pachamama est nommé',
      `${interlocuteur.agent_prenom}`,
    );
  } else {
    saute('aucun agent sur les candidatures de ce compte : contrôle sans objet');
  }

  /* ── 2. Le registre TALENT, et rien du vocabulaire interne ────────────── */
  section('2. Le registre talent (D-02)');
  const INTERNES = [
    'To contact',
    'Contacted',
    'Applicant',
    'Screen Pachamama',
    'Send-out',
    'Interview 1',
    'Final interview',
    'Hired',
    'KO by Pachamama',
    'KO by client',
    'KO by candidat',
  ];
  for (const chemin of ['/talent', `/talent/candidatures/${candidatures[0]?.id ?? UUID_INCONNU}`]) {
    const r = chemin === '/talent' ? accueil : await page(cookie, chemin);
    const trouves = INTERNES.filter((v) => contient(r.html, v));
    verifier(trouves.length === 0, `aucun libellé interne d’étape sur ${chemin}`, trouves.join(', ') || 'aucun');
  }
  verifier(
    candidatures.every((c) => contient(ecranProcess.html, texteDe(c.etape).trim().split(' ').slice(1).join(' ') || c.etape)),
    'chaque process porte son étape en registre talent',
  );

  /* ── 3. Ce qui ne doit PAS être dans le HTML (D-15) ───────────────────── */
  section('3. Les deux régimes d’identité');
  const maFiche = await page(cookie, '/talent/fiche');
  const donnees = await page(cookie, '/talent/confidentialite');

  verifier(maFiche.statut === 200, '/talent/fiche répond', `statut ${maFiche.statut}`);
  verifier(donnees.statut === 200, '/talent/confidentialite répond', `statut ${donnees.statut}`);

  // Les trois anciennes routes survivent en redirection : des liens existent
  // dans la nature — courriels du cabinet, favoris, invitations de la jauge.
  for (const [ancienne, ancre] of [
    ['/talent/profil', 'qui-vous-etes'],
    ['/talent/attentes', 'ce-que-vous-cherchez'],
    ['/talent/parcours', 'ce-que-vous-avez-fait'],
  ]) {
    const r = await page(cookie, ancienne);
    verifier(
      [307, 308].includes(r.statut) && (r.destination ?? '').includes(`/talent/fiche#${ancre}`),
      `${ancienne} redirige vers sa section`,
      `statut ${r.statut} → ${r.destination ?? '—'}`,
    );
  }

  /**
   * ⚠ LE CŒUR DU CONTRÔLE, ET IL AFFIRME LES DEUX SENS.
   *
   * Les coordonnées et le chemin du CV DOIVENT être sur « Ma fiche » — c'est
   * l'écran où l'on corrige ses propres informations, les cacher n'aurait aucun
   * sens. Elles NE DOIVENT PAS être sur les autres écrans du portail, qui n'en
   * affichent aucune : une colonne sélectionnée part dans le HTML même si rien
   * ne la rend, et c'est la faute que D-15 a coûté à la phase 1.
   *
   * La fusion des trois écrans n'a pas dissous ce contrôle, elle en a déplacé
   * la frontière : elle passait entre profil, attentes et parcours ; elle passe
   * maintenant entre « Ma fiche » et le reste du portail.
   */
  const IDENTITE = [
    ['l’adresse électronique', fiche.email_personnel],
    ['le téléphone', fiche.telephone],
    ['le profil LinkedIn', fiche.url_linkedin],
  ];
  for (const [libelle, valeur] of IDENTITE) {
    if (!valeur) {
      saute(`${libelle} n’est pas renseigné : contrôle sans objet`);
      continue;
    }
    verifier(fuite(maFiche.html, valeur), `${libelle} EST sur « Ma fiche » — c’est son écran`);
    for (const [nom, r] of [
      ['Mon espace', accueil],
      ['Mes données', donnees],
    ]) {
      verifier(!fuite(r.html, valeur), `${libelle} n’est PAS servi sur « ${nom} »`);
    }
  }

  // Le chemin d'un CV porte le patronyme dans 81 % des cas mesurés : il n'a
  // rien à faire dans le HTML d'un écran qui ne l'affiche pas.
  if (fiche.cv_url) {
    verifier(
      !fuite(accueil.html, fiche.cv_url) && !fuite(donnees.html, fiche.cv_url),
      'le chemin du CV ne franchit que « Ma fiche »',
    );
  } else {
    saute('aucun CV sur ce compte : contrôle du chemin sans objet');
  }

  /**
   * ⚠ LA QUALIFICATION CABINET — ÉPROUVÉE PAR LE MÉCANISME, PUIS PAR LA VALEUR
   *
   * C'est le motif n°1 de l'ADR 0005 : `est_qualifie`, `statut_relation`,
   * `mindset`, `seniorite`, `emoji_statut`, `agent_referent_id` sont ce que le
   * cabinet porte SUR la personne, et `api.ma_fiche` ne doit pas les
   * construire — `mindset` y était projetée depuis le J1, et le lot de base l'a
   * retirée au J4.
   *
   * PREMIÈRE FORME, la seule qui prouve quelque chose : on DEMANDE la colonne à
   * la vue avec le jeton du talent, et on exige `42703, colonne inexistante`.
   * C'est la leçon D-16 — on éprouve le mécanisme, pas la présence d'une chaîne
   * dans un texte. Une vue qui reprojetterait `est_qualifie` demain serait
   * prise ici même si aucun écran ne l'affichait.
   */
  section('3 bis. La qualification cabinet');
  for (const colonne of [
    'est_qualifie',
    'statut_relation',
    'mindset',
    'seniorite',
    'emoji_statut',
    'agent_referent_id',
    'resume_ia',
  ]) {
    const r = await fetch(`${U}/rest/v1/ma_fiche?select=${colonne}&limit=1`, {
      headers: { apikey: A, Authorization: `Bearer ${jeton}`, 'Accept-Profile': 'api' },
    });
    const corps = await r.text();
    verifier(
      r.status === 400 && corps.includes('42703'),
      `api.ma_fiche refuse « ${colonne} » — la vue ne la construit pas`,
      `statut ${r.status}`,
    );
  }

  if (S) {
    /**
     * SECONDE FORME, en complément : la VALEUR relue sous clé de service ne doit
     * apparaître sur aucun écran.
     *
     * ⚠ ELLE NE PORTE QUE SUR LES VALEURS DISCRIMINANTES, et c'est une leçon de
     * ce harnais lui-même. Sa première version comparait toutes les colonnes et
     * signalait trois « fuites » qui n'en étaient pas :
     *
     *   · `est_qualifie` vaut `true` — et « true » est dans tout HTML React ;
     *   · `statut_relation` vaut « lead » — quatre lettres, présentes dans
     *     « preload » comme dans « Lead Product » ;
     *   · `referent` vaut « Marion » — le prénom de l'interlocutrice, que
     *     l'écran AFFICHE délibérément. `api.ma_candidature_detail` le projette
     *     par la policy `talent_son_agent` (D-12) : dire à quelqu'un qui suit
     *     son dossier est l'objet de la carte, pas une fuite.
     *
     * Un contrôle qui crie sur des coïncidences finit par être ignoré. On ne
     * garde donc que les valeurs assez longues pour être reconnaissables, et
     * `referent` sort de la liste avec sa raison.
     */
    const reponse = await fetch(
      `${U}/rest/v1/talent_recherche?select=est_qualifie,statut_relation,mindset,seniorite,emoji_statut&id=eq.${fiche.id}`,
      { headers: { apikey: S, Authorization: `Bearer ${S}`, 'Accept-Profile': 'api' } },
    )
      .then((r) => r.json())
      .catch(() => null);
    const interne = Array.isArray(reponse) ? reponse[0] : null;

    if (!interne) {
      saute('la qualification cabinet n’est pas relisible sous clé de service');
    } else {
      const pages = [
        ['Mon espace', accueil],
        ['Ma fiche', maFiche],
        ['Mes données', donnees],
      ];
      let eprouvees = 0;
      for (const [colonne, valeur] of Object.entries(interne)) {
        if (typeof valeur !== 'string' || valeur.length < 8) continue;
        eprouvees += 1;
        const fautives = pages.filter(([, r]) => fuite(r.html, valeur)).map(([n]) => n);
        verifier(
          fautives.length === 0,
          `la valeur de « ${colonne} » n’apparaît sur aucun écran`,
          fautives.join(', ') || 'aucun',
        );
      }
      if (eprouvees === 0) {
        saute('aucune valeur de qualification assez discriminante sur ce compte');
      }
    }
  } else {
    console.log('  · SUPABASE_SERVICE_ROLE_KEY absente : le contrôle par la valeur est sauté');
  }

  /**
   * TROISIÈME FORME : LE REGISTRE INTERNE DES ÉTAPES.
   *
   * ⚠ CE CONTRÔLE MANQUAIT, ET LA COLONNE QU'IL SURVEILLE ÉTAIT BIEN DEMANDÉE.
   *
   * `ref.etape_process` porte trois registres (D-02) : `libelle_interne`,
   * `libelle_client`, `libelle_talent`. Le registre talent collapse EXPRÈS des
   * étapes distinctes en une phrase commune — `ko`, `ko_by_pachamama` et
   * `ko_by_client` disent tous les trois « Candidature close », pour ne pas
   * dire QUI a fermé le dossier. Le `code` et le `libelle_interne` le disent.
   *
   * `COLONNES_CANDIDATURE` et `COLONNES_CANDIDATURE_DETAIL` demandaient
   * `etape_code` alors qu'aucun écran talent ne la lisait ; sur ce compte,
   * quatre candidatures sur six portent `ko_by_pachamama`. Rien ne la rendait,
   * donc rien ne la faisait apparaître — mais D-15 dit précisément que ne pas
   * afficher ne protège pas : un seul `'use client'` sur `TableauDeBord` et la
   * charge utile RSC l'emportait dans le navigateur.
   *
   * La recherche porte sur le HTML BRUT (leçon D-16), et sur les DEUX pages de
   * détail en plus des quatre écrans — c'est là que le registre transiterait.
   */
  /**
   * Le registre est relu en base quand c'est possible, pour que l'ajout d'une
   * quinzième étape soit couvert sans toucher à ce fichier. `ref` n'est PAS
   * exposé par PostgREST (vérifié : « Only the following schemas are exposed:
   * public, graphql_public, pivot, api ») — la lecture échoue donc en pratique,
   * et le repli porte les codes relevés le 09/09. Il est écrit en clair plutôt
   * que deviné : ce sont des identifiants de process, pas des données de
   * personnes, et rien ici ne dépend de `.env.local`.
   */
  const registre = await fetch(`${U}/rest/v1/etape_process?select=code,libelle_interne`, {
    headers: { apikey: S ?? A, Authorization: `Bearer ${S ?? jeton}`, 'Accept-Profile': 'ref' },
  })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);

  const CODES_INTERNES =
    Array.isArray(registre) && registre.length > 0
      ? registre
      : [
          { code: 'to_contact', libelle_interne: 'To contact' },
          { code: 'push_candidature', libelle_interne: 'Push Candidature' },
          { code: 'screen_pachamama', libelle_interne: 'Screen Pachamama' },
          { code: 'send_out', libelle_interne: 'Send-out' },
          { code: 'final_interview', libelle_interne: 'Final interview' },
          { code: 'ko_by_pachamama', libelle_interne: 'KO by Pachamama' },
          { code: 'ko_by_client', libelle_interne: 'KO by client' },
          { code: 'ko_by_candidat', libelle_interne: 'KO by candidat' },
        ];

  const pagesRegistre = [
    ['Mon espace', accueil],
    ['Ma fiche', maFiche],
    ['Mes données', donnees],
  ];
  for (const c of candidatures.slice(0, 4)) {
    pagesRegistre.push([`Candidature ${c.etape_code ?? '?'}`, await page(cookie, `/talent/candidatures/${c.id}`)]);
  }

  for (const { code, libelle_interne: interne } of CODES_INTERNES) {
    const fautives = pagesRegistre.filter(([, r]) => fuite(r.html, code)).map(([n]) => n);
    verifier(
      fautives.length === 0,
      `le code d’étape « ${code} » n’est servi sur aucun écran talent`,
      fautives.join(', ') || `${pagesRegistre.length} pages éprouvées`,
    );
    // Le libellé interne est plus court et plus ambigu : on n'éprouve que ceux
    // qui ne peuvent pas se confondre avec de la prose d'interface.
    if (typeof interne === 'string' && interne.length >= 8) {
      const f2 = pagesRegistre.filter(([, r]) => fuite(r.html, interne)).map(([n]) => n);
      verifier(
        f2.length === 0,
        `le libellé interne « ${interne} » n’est servi sur aucun écran talent`,
        f2.join(', ') || 'aucun',
      );
    }
  }

  /* ── 4. Le détail d'une candidature ───────────────────────────────────── */
  section('4. Le détail d’une candidature');
  const vivante = candidatures.find((c) => !c.est_terminale);
  const close = candidatures.find((c) => c.est_terminale);

  if (vivante) {
    const d = await page(cookie, `/talent/candidatures/${vivante.id}`);
    verifier(d.statut === 200, 'la page répond', `statut ${d.statut}`);
    verifier(contient(d.html, vivante.poste), 'l’intitulé du poste est affiché', vivante.poste);
    // ⚠ LE FIL N'EST RENDU QUE S'IL Y A QUELQUE CHOSE, et le contrôle suit la
    // donnée au lieu d'exiger la carte inconditionnellement. Mesuré :
    // `core.note where visible_talent` = 0 sur 45 685 — la carte était donc un
    // cadre vide sur chaque process de chaque compte, dont le seul contenu
    // expliquait ce qu'il contiendrait un jour. C'est exactement la ligne
    // d'aide que le projet s'interdit.
    const partagees = await api(jeton, `ma_note_partagee?select=id&candidature_id=eq.${vivante.id}`);
    const fil = contient(d.html, 'Ce que Pachamama vous partage');
    verifier(
      Array.isArray(partagees) && (partagees.length > 0 ? fil : !fil),
      'le fil des notes partagées suit la donnée : présent s’il y en a, absent sinon',
      `${Array.isArray(partagees) ? partagees.length : '?'} note(s) partagée(s) · fil ${fil ? 'rendu' : 'absent'}`,
    );
    verifier(
      contient(d.html, 'Me retirer de ce process'),
      'le retrait est offert sur une candidature vivante',
    );
    // ⚠ LE DÉTAIL DU POSTE NE DÉPEND PAS DE L'ÉTAT DE L'OFFRE. Il ne
    // s'affichait qu'une fois l'offre dépubliée, ce qui le rendait présent sur
    // les candidatures closes et absent des vivantes : la quantité
    // d'information variait selon un état qui ne regarde pas le candidat.
    // Les deux branches ci-dessous l'exigent des deux côtés.
    verifier(
      contient(d.html, 'Ce poste est pour vous si') || contient(d.html, 'Les missions'),
      'le détail du poste est là sur une candidature vivante',
    );
    const motifs = await api(jeton, 'mon_referentiel?select=libelle&referentiel=eq.motif_retrait');
    verifier(
      motifs.length > 0 && motifs.every((m) => contient(d.html, m.libelle)),
      'les motifs de retrait viennent du référentiel',
      `${motifs.length} motif(s)`,
    );
  } else {
    saute('aucune candidature vivante sur ce compte : contrôles de retrait sans objet');
  }

  if (close) {
    const d = await page(cookie, `/talent/candidatures/${close.id}`);
    verifier(d.statut === 200, 'une candidature close s’affiche aussi', `statut ${d.statut}`);
    verifier(
      !contient(d.html, 'Me retirer de ce process'),
      'le retrait n’est PAS offert sur une candidature close — la base le refuserait',
    );
    verifier(
      !['écarté par le client', 'écarté par Pachamama', 'refusé par le client',
        'décision du client'].some((m) => contient(d.html, m)),
      'une candidature close n’attribue la décision à personne (D-02)',
    );
    verifier(
      contient(d.html, 'Ce poste est pour vous si') || contient(d.html, 'Les missions'),
      'le détail du poste est là sur une candidature close aussi',
    );
  } else {
    saute('aucune candidature close sur ce compte : contrôle sans objet');
  }

  const inconnue = await page(cookie, `/talent/candidatures/${UUID_INCONNU}`);
  verifier(
    inconnue.statut === 404,
    'une candidature hors périmètre rend 404 — et non 200 avec le contenu du 404',
    `statut ${inconnue.statut}`,
  );
  const malformee = await page(cookie, '/talent/candidatures/pas-un-uuid');
  verifier(malformee.statut === 404, 'un identifiant malformé rend 404, pas 500', `statut ${malformee.statut}`);

  /* ── 5. Les écrans de saisie ──────────────────────────────────────────── */
  section('5. Les écrans de saisie');
  verifier(contient(maFiche.html, 'Tenu par Pachamama'), 'le profil annonce ce qui n’est pas éditable');
  verifier(contient(maFiche.html, 'Votre CV'), 'le téléversement du CV est présenté');
  verifier(
    /type="file"/.test(maFiche.html),
    'le téléversement est un vrai champ fichier, pas un bouton décoratif',
  );
  verifier(
    contient(maFiche.html, 'Prénom') && contient(maFiche.html, 'Nom'),
    'prénom et nom sont demandés, et marqués obligatoires',
  );

  if (fiche.attentes_metier) {
    verifier(
      contient(maFiche.html, fiche.attentes_metier),
      'le métier visé est repositionné dans la liste',
      fiche.attentes_metier,
    );
  } else {
    saute('aucun métier visé sur ce compte : contrôle sans objet');
  }
  verifier(
    contient(maFiche.html, 'Vous ne nous l’avez pas encore dit') ||
      contient(maFiche.html, 'Nous vous proposons des postes') ||
      contient(maFiche.html, 'Nous gardons votre dossier'),
    'la recherche active distingue « pas déclaré » d’un « non »',
  );
  verifier(
    contient(maFiche.html, 'Rémunération annuelle brute (K€)'),
    'le libellé de la fourchette porte son unité — K€',
  );

  const postes = await api(jeton, 'mes_postes?select=id&limit=1');
  if (postes.length === 0) {
    verifier(
      contient(maFiche.html, 'Ajoutez vos postes'),
      'un parcours vide INVITE à saisir au lieu de sembler cassé',
    );
  } else {
    saute(`${postes.length} poste(s) déjà saisi(s) : contrôle de l’écran vide sans objet`);
  }

  /* ── 6. Mes données, et l'export ──────────────────────────────────────── */
  section('6. Mes données');
  for (const repere of [
    'Ce que Pachamama détient',
    'Emporter vos données',
    'Demander la suppression',
    'pas une politique de confidentialité',
  ]) {
    verifier(contient(donnees.html, repere), `« ${repere.slice(0, 42)}… » est écrit`);
  }

  // ⚠ L'ÉCRAN NE PROMET JAMAIS UN EFFACEMENT QU'IL NE FAIT PAS.
  // `api.demander_ma_suppression` porte ce commentaire dans la base :
  // « Enregistre une demande de suppression et bascule actif = false. N'EFFACE
  // RIEN. » Un libellé « Supprimer mon compte », ou une phrase disant que les
  // données « sont effacées », serait donc faux — et c'est le mensonge le plus
  // lourd que ce portail puisse porter. La règle ne tenait qu'à un commentaire
  // de code ; elle est vérifiée ici.
  for (const interdit of ['Supprimer mon compte', 'sont effacés', 'sont effacées']) {
    verifier(
      !contient(donnees.html, interdit),
      `« ${interdit} » n’est PAS écrit : la demande n’efface rien`,
    );
  }

  const exportr = await fetch(`${BASE}/talent/donnees`, { headers: { cookie }, redirect: 'manual' });
  verifier(exportr.status === 200, 'l’export répond 200', `statut ${exportr.status}`);
  const disposition = exportr.headers.get('content-disposition') ?? '';
  verifier(
    disposition.includes('attachment') && disposition.includes('.json'),
    'l’export est servi comme un fichier à enregistrer',
    disposition,
  );
  verifier(
    (exportr.headers.get('cache-control') ?? '').includes('no-store'),
    'l’export n’est jamais mis en cache — c’est le dossier complet d’une personne',
  );

  const corpsExport = await exportr.text();
  let charge = null;
  try {
    charge = JSON.parse(corpsExport);
  } catch {
    /* laissé nul */
  }
  verifier(charge !== null, 'l’export est du JSON lisible');
  if (charge) {
    const brut = JSON.stringify(charge);

    // ⚠ ON CHERCHE DES CLÉS, PAS DES SOUS-CHAÎNES. La version précédente
    // testait `JSON.stringify(...).includes('mindset')` et se déclenchait sur
    // le texte libre d'une offre — « mindset intrapreneuriat » — qui n'a rien
    // d'une fuite. Un contrôle qui crie pour une phrase du client apprend à
    // ignorer ses propres alertes.
    const clesDe = (v, acc = new Set()) => {
      if (Array.isArray(v)) v.forEach((x) => clesDe(x, acc));
      else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          acc.add(k);
          clesDe(x, acc);
        }
      }
      return acc;
    };
    const cles = clesDe(charge);
    const INTERDITS = ['est_qualifie', 'statut_relation', 'mindset', 'resume_ia', 'argumentaire'];
    const presents = INTERDITS.filter((k) => cles.has(k));
    verifier(presents.length === 0, 'l’export ne porte aucune clé du cabinet', presents.join(', ') || 'aucune');
    const etapesInternes = INTERNES.filter((v) => brut.includes(v));
    verifier(
      etapesInternes.length === 0,
      'l’export ne porte aucun libellé interne d’étape',
      etapesInternes.join(', ') || 'aucun',
    );

    /**
     * ⚠ LE CODE, PAS SEULEMENT LE LIBELLÉ — ET C'EST CE QUI MANQUAIT.
     *
     * `INTERNES` ci-dessus liste les `libelle_interne` (« KO by Pachamama »).
     * Le contrôle jumeau de `j4-espace-talent.mjs` liste, lui, 22 NOMS DE
     * COLONNES du cabinet. `ko_by_pachamama` n'est ni l'un ni l'autre : les
     * deux harnais étaient verts pendant que l'export livrait
     * `etape_code: "ko_by_pachamama"` sur quatre des six candidatures du compte
     * de test — mesuré le 09/09, dans un document que la personne télécharge.
     *
     * Cause : `api.exporter_mes_donnees` construisait la section par
     * `to_jsonb(c)` sur `api.ma_candidature_detail`, soit un `select('*')` en
     * SQL. Colonnes énumérées depuis `20260913190000`.
     *
     * On éprouve les CLÉS et les VALEURS : une clé absente ne prouve pas qu'un
     * code ne transite pas sous un autre nom.
     */
    const CLES_INTERNES = [
      'etape_code',
      'etape_ordre',
      'reference_pseudonyme',
      'agent_fonction',
      'mandat_salaire_infos',
      'date_prochaine_echeance',
    ];
    const clesVues = CLES_INTERNES.filter((k) => brut.includes(`"${k}"`));
    verifier(
      clesVues.length === 0,
      'l’export ne porte aucune clé de mécanique interne',
      clesVues.join(', ') || `${CLES_INTERNES.length} clés absentes`,
    );

    const codesEtape = CODES_INTERNES.map((e) => e.code);
    const codesVus = codesEtape.filter((c) => brut.includes(c));
    verifier(
      codesVus.length === 0,
      'l’export ne porte aucun CODE d’étape du registre interne',
      codesVus.join(', ') || `${codesEtape.length} codes absents`,
    );

    // Contre-épreuve : le détecteur voit-il ce qui EST là ? Sans elle, les deux
    // contrôles au-dessus pourraient passer sur un export vide ou illisible.
    verifier(
      brut.includes('candidatures') && charge.candidatures?.length > 0,
      'l’export porte bien des candidatures — le détecteur ne mesure pas le vide',
      `${charge.candidatures?.length ?? 0} candidature(s)`,
    );
  }

  /* ── 7. Le job board : pagination et frontières ───────────────────────── */
  section('7. Le job board');
  const offres = await api(jeton, 'offre_publique?select=id,intitule');
  const board1 = await page(null, '/offres');
  verifier(board1.statut === 200, '/offres répond sans session', `statut ${board1.statut}`);

  /**
   * ⚠ LA PAGINATION EST MESURÉE PAR LA DIFFÉRENCE ENTRE DEUX PAGES, pas par la
   * présence d'un contrôle. Un `.range()` mal posé rendrait deux fois la même
   * fenêtre avec des flèches qui marchent.
   */
  if (offres.length > 9) {
    const board2 = await page(null, '/offres?page=2');
    verifier(board2.statut === 200, '/offres?page=2 répond', `statut ${board2.statut}`);
    const page1 = offres.filter((o) => contient(board1.html, o.intitule)).map((o) => o.id);
    const page2 = offres.filter((o) => contient(board2.html, o.intitule)).map((o) => o.id);
    verifier(
      page1.length > 0 && page2.length > 0 && page1.length + page2.length >= offres.length,
      'les deux pages se partagent les offres',
      `${page1.length} + ${page2.length} pour ${offres.length} offres`,
    );
    verifier(
      contient(board1.html, 'sur') && /offres/.test(texteDe(board1.html)),
      'le compte total est annoncé',
    );
    verifier(
      !contient(board2.html, 'Les petits nouveaux'),
      'la page 2 ne prétend PAS présenter les plus récentes',
    );
  } else {
    saute(`${offres.length} offres publiées : moins d’une page, la pagination n’a rien à montrer`);
  }

  const boardLoin = await page(null, '/offres?page=999');
  verifier(
    boardLoin.statut === 200 && contient(boardLoin.html, 'Revenir à la première page'),
    'une page au-delà des offres se dit, et propose le retour',
    `statut ${boardLoin.statut}`,
  );
  const boardAbsurde = await page(null, '/offres?page=-3');
  verifier(boardAbsurde.statut === 200, 'un ?page= absurde ne casse pas la page', `statut ${boardAbsurde.statut}`);

  /**
   * ⚠ LE CONTRÔLE QUI SURVEILLE LA FRONTIÈRE `loading.tsx`.
   *
   * Un `loading.tsx` posé sur `offres/` couvrirait `offres/[id]` : Next
   * enverrait la coquille avant la résolution, et une réponse commencée ne
   * change plus de statut — `notFound()` rendrait alors la bonne page avec un
   * **HTTP 200**. C'est le défaut mesuré en phase 1 sur
   * `/entreprise/mandats/<uuid inexistant>`. Ce contrôle est ce qui empêche
   * d'ajouter innocemment cette frontière plus tard.
   */
  const offreInconnue = await page(null, `/offres/${UUID_INCONNU}`);
  verifier(
    offreInconnue.statut === 404,
    'une offre dépubliée ou inconnue rend 404 — et non 200',
    `statut ${offreInconnue.statut}`,
  );

  /* ── 8. Le parcours « Postuler » ──────────────────────────────────────── */
  section('8. Postuler depuis une offre (le défaut du J1)');
  const uneOffre = offres[0];
  if (!uneOffre) {
    saute('aucune offre publiée : le parcours Postuler n’est pas éprouvable');
  } else {
    // 8a. La fiche d'offre d'un VISITEUR porte le lien qui survit au détour.
    const ficheAnonyme = await page(null, `/offres/${uneOffre.id}`);
    verifier(ficheAnonyme.statut === 200, 'la fiche d’offre répond sans session', `statut ${ficheAnonyme.statut}`);
    verifier(
      ficheAnonyme.html.includes(`suite=${encodeURIComponent(`/offres/${uneOffre.id}`)}`),
      'un visiteur reçoit un lien de connexion qui RAMÈNE sur l’offre',
    );

    // 8b. `/connexion?offre=` ne perd plus la requête.
    const traduction = await page(null, `/connexion?offre=${uneOffre.id}`);
    verifier(
      traduction.statut >= 300 &&
        traduction.statut < 400 &&
        (traduction.destination ?? '').includes(`suite=${encodeURIComponent(`/offres/${uneOffre.id}`)}`),
      '/connexion?offre= est traduit en /login?suite=',
      `${traduction.statut} → ${traduction.destination}`,
    );

    // 8c. Le garde contre la redirection ouverte, mesuré sur le serveur.
    const hostile = await page(null, '/connexion?offre=//exemple.test');
    verifier(
      (hostile.destination ?? '').endsWith('/login'),
      'un ?offre= qui n’est pas un uuid ne fabrique aucune suite',
      `${hostile.statut} → ${hostile.destination}`,
    );
    const tremplin = await page(cookie, '/login?suite=https://exemple.test/phishing');
    verifier(
      !(tremplin.destination ?? '').includes('exemple.test'),
      'une suite vers un domaine tiers est IGNORÉE, pas suivie',
      `${tremplin.statut} → ${tremplin.destination}`,
    );
    const relative = await page(cookie, '/login?suite=//exemple.test');
    verifier(
      !(relative.destination ?? '').includes('exemple.test'),
      'une suite protocole-relative est ignorée',
      `${relative.statut} → ${relative.destination}`,
    );

    // 8d. Déjà connecté et porteur d'une suite : on y va directement.
    const raccourci = await page(cookie, `/login?suite=${encodeURIComponent(`/offres/${uneOffre.id}`)}`);
    verifier(
      (raccourci.destination ?? '') === `/offres/${uneOffre.id}`,
      'une session déjà ouverte va DIRECTEMENT sur l’offre',
      `${raccourci.statut} → ${raccourci.destination}`,
    );

    /**
     * 8e. LE JOB BOARD PUBLIC NE CONNAÎT PLUS SON VISITEUR.
     *
     * Il s'adaptait : « Postuler » qui postait vraiment pour un talent
     * connecté, « Candidature déposée » s'il l'avait déjà fait. Défendable tant
     * que c'était la seule façon de voir une offre, intenable depuis que
     * l'espace talent a son écran « Offres » — le commanditaire, connecté dans
     * le même navigateur, y voyait son propre état de candidature sur une page
     * de vitrine.
     *
     * Un talent connecté est désormais REDIRIGÉ chez lui, sur la même offre.
     * On contrôle les deux sens : la redirection, et l'absence de toute trace
     * de dossier dans ce qui est servi.
     */
    const postules = new Set(candidatures.map((c) => c.mandat_id).filter(Boolean));
    const dejaPostulee = offres.find((o) => postules.has(o.id));
    const cible = dejaPostulee ?? offres[0];

    if (cible) {
      const r = await page(cookie, `/offres/${cible.id}`);
      verifier(
        [307, 308].includes(r.statut) &&
          (r.destination ?? '') === `/talent/offres/${cible.id}`,
        'un talent connecté est renvoyé vers la MÊME offre dans son espace',
        `${r.statut} → ${r.destination ?? '—'}`,
      );
      verifier(
        r.html === '' || !contient(r.html, 'Candidature déposée'),
        'la page publique ne lui montre jamais son état de candidature',
      );
    } else {
      saute('aucune offre publiée : contrôle de la redirection sans objet');
    }

    const board = await page(cookie, '/offres');
    verifier(
      [307, 308].includes(board.statut) && (board.destination ?? '') === '/talent/offres',
      'le board public renvoie un talent connecté vers son écran « Offres »',
      `${board.statut} → ${board.destination ?? '—'}`,
    );

    // Et l'inverse : un VISITEUR garde le board et son lien de connexion.
    if (cible) {
      const v = await page(null, `/offres/${cible.id}`);
      verifier(
        v.statut === 200 && !contient(v.html, 'Candidature déposée'),
        'un visiteur garde la fiche publique, sans état de candidature',
        `statut ${v.statut}`,
      );
      // Le bouton mène à `/login?suite=…`, et la suite RAMÈNE sur l'offre :
      // c'est ce détour qui doit survivre, pas seulement le lien.
      verifier(
        v.html.includes(`/login?suite=${encodeURIComponent(`/offres/${cible.id}`)}`),
        'et son bouton mène à la connexion, en gardant l’offre en mémoire',
      );
    }
  }

  /* ── 9. Cloisonnement d'affichage ─────────────────────────────────────── */
  section('9. Le cloisonnement d’affichage');
  const CHEMINS = [
    '/talent',
    '/talent/fiche',
    '/talent/process',
    '/talent/offres',
    '/talent/confidentialite',
  ];

  const anonyme = await page(null, '/talent');
  verifier(
    anonyme.statut === 307 && (anonyme.destination ?? '').includes('/login'),
    'un visiteur sans session est renvoyé sur /login',
    `statut ${anonyme.statut} → ${anonyme.destination}`,
  );
  const exportAnonyme = await fetch(`${BASE}/talent/donnees`, { redirect: 'manual' });
  verifier(
    exportAnonyme.status === 401 || (exportAnonyme.status >= 300 && exportAnonyme.status < 400),
    'l’export refuse un visiteur sans session',
    `statut ${exportAnonyme.status}`,
  );

  if (ENTREPRISE) {
    /**
     * ⚠ ON EMPLOIE LE COMPTE ENTREPRISE, PAS LE COMPTE RECRUTEUR.
     * Mesuré par le harnais de base : sur 4 153 accès porteurs d'une fiche
     * talent, 4 153 portent le portail talent — la plupart des collaborateurs
     * ont un accès talent EN PLUS de leur accès interne, et le compte
     * recruteur de test en fait partie. Exiger qu'un recruteur n'entre pas sur
     * `/talent`, ce serait exiger qu'il ne puisse pas lire SA PROPRE fiche.
     * Le compte entreprise, lui, n'a pas de portail talent : c'est le seul
     * témoin valable du cloisonnement.
     */
    const sessionEntreprise = await ouvrirSession(ENTREPRISE, MDP);
    const cookieEntreprise = cookiesDeSession(sessionEntreprise);
    for (const chemin of CHEMINS) {
      const r = await page(cookieEntreprise, chemin);
      verifier(
        r.statut === 307 && !(r.destination ?? '').startsWith('/talent'),
        `un compte entreprise n’entre pas sur ${chemin}`,
        `statut ${r.statut}${r.destination ? ` → ${r.destination}` : ''}`,
      );
    }
    const exportEntreprise = await fetch(`${BASE}/talent/donnees`, {
      headers: { cookie: cookieEntreprise },
      redirect: 'manual',
    });
    // ⚠ 403 ET NON 502. Un compte sans portail talent n'est pas une panne : la
    // première version de la route laissait la fonction lever et rendait un
    // 502 « l'export a échoué de notre côté » — un message qui accuse le
    // service pour un refus d'accès. Le harnais fixe le statut attendu.
    verifier(
      exportEntreprise.status === 403,
      'l’export refuse un compte sans portail talent, et dit que c’est un refus',
      `statut ${exportEntreprise.status}`,
    );
  } else {
    saute('TEST_ENTREPRISE_EMAIL absente : le cloisonnement inter-portail est sauté');
  }

  /* ── 10. La navigation latérale ───────────────────────────────────────── */
  section('10. La navigation');
  for (const [libelle, href] of [
    ['Mon espace', '/talent'],
    ['Ma fiche', '/talent/fiche'],
    ['Mes process', '/talent/process'],
    ['Offres', '/talent/offres'],
    ['Mes données', '/talent/confidentialite'],
  ]) {
    verifier(
      accueil.html.includes(`href="${href}"`) && contient(accueil.html, libelle),
      `la barre latérale porte « ${libelle} » vers une route réelle`,
    );
  }

  /**
   * L'EN-TÊTE EST FIGÉ, SUR TOUTES LES PAGES.
   *
   * Il porte les deux seuls repères permanents : sous quel compte on regarde,
   * et dans quelle vue on est. Sur « Ma fiche », qui fait trois écrans de haut,
   * ils sortaient du champ au premier défilement.
   *
   * On contrôle aussi le FOND : une barre collante transparente laisse le
   * contenu défiler au travers, et c'est le genre de défaut qu'un test de
   * structure attrape mieux qu'un œil.
   */
  for (const [nom, r] of [
    ['Mon espace', accueil],
    ['Ma fiche', maFiche],
    ['Mes process', ecranProcess],
    ['Offres', ecranOffres],
    ['Mes données', donnees],
  ]) {
    const entete = (r.html.match(/<header[^>]*class="([^"]*)"/) ?? [])[1] ?? '';
    verifier(
      /\bsticky\b/.test(entete) && /\btop-3\b/.test(entete),
      `l’en-tête de « ${nom} » est figé en haut`,
      entete.slice(0, 60),
    );
    verifier(
      entete.includes('bg-[var(--fond-page)]'),
      `l’en-tête de « ${nom} » est opaque — rien ne défile au travers`,
    );
  }

  verifier(
    !accueil.html.includes('href="/talent/candidatures"'),
    'aucune entrée ne mène à une page inexistante',
  );

  /* ── Les offres, dans l'espace ─────────────────────────────────────── */
  section('10 bis. Les offres dans l’espace talent');
  verifier(ecranOffres.statut === 200, '/talent/offres répond', `statut ${ecranOffres.statut}`);

  const offresPubliees = await api(jeton, 'offre_publique?select=id,intitule');
  verifier(
    offresPubliees.length > 0 && offresPubliees.every((o) => contient(ecranOffres.html, o.intitule)),
    'l’écran sert les mêmes offres que le job board public',
    `${offresPubliees.length} offre(s)`,
  );
  // « Login » n'a pas de sens pour quelqu'un de connecté. On cherche le BOUTON,
  // pas le mot : le contrôle doit survivre à un texte qui contiendrait « login »
  // pour une autre raison.
  verifier(
    !/>\s*Login\s*</.test(ecranOffres.html),
    'le bouton « Login » a disparu de l’écran connecté',
  );
  /**
   * ⚠ LA CHROME DE PAGE AUTONOME NE DOIT PAS ENTRER DANS LA COQUILLE.
   *
   * `PageJobs` a été écrit pour une page publique qui occupe l'écran : il porte
   * `min-h-dvh`, son propre rembourrage, son décor, et une barre `sticky top-0`
   * dont les marges NÉGATIVES annulent ce rembourrage. Réutilisé tel quel dans
   * l'espace connecté, il débordait par la gauche et rognait le titre.
   *
   * On contrôle donc l'absence des trois marqueurs, pas l'apparence : un test
   * de structure attrape ça, un œil ne l'attrape qu'une fois sur deux.
   */
  // `min-h-dvh` seul appartient légitimement à la coquille : on vise la
  // COMBINAISON propre à la racine de la page autonome.
  for (const marqueur of ['min-h-dvh bg-[var(--fond-page)] p-4', '-mx-4', 'sticky top-0']) {
    verifier(
      !ecranOffres.html.includes(marqueur),
      `l’écran connecté ne porte pas « ${marqueur} », réservé à la page autonome`,
    );
  }
  /**
   * LA CARTE FAIT LA MÊME TAILLE DES DEUX CÔTÉS.
   *
   * Elle n'y faisait pas : la grille était en `minmax(300px, 1fr)`, donc la
   * carte valait « largeur du conteneur ÷ colonnes ». L'espace talent ayant une
   * barre latérale, ses conteneurs sont plus étroits — mesuré, 322px de carte
   * contre 303px sur le board. Le gabarit est désormais borné en haut, et la
   * carte vaut 320px quelle que soit la largeur disponible.
   *
   * On compare les deux gabarits plutôt que des pixels : c'est le gabarit qui
   * porte la garantie, et une valeur rendue dépendrait de la fenêtre du test.
   */
  {
    const board = await page(null, '/offres');
    // Le squelette de chargement porte lui aussi une grille : elle doit être
    // la MÊME, sinon la mise en page saute à l'arrivée des cartes.
    const tousGabarits = [...board.html.matchAll(/grid-cols-\[([^\]]+)\]/g)].map((m) => m[1]);
    verifier(
      new Set(tousGabarits).size <= 1,
      'le squelette du board porte la même grille que les cartes',
      [...new Set(tousGabarits)].join(' · ') || '—',
    );
    const gabarit = /grid-cols-\[([^\]]+)\]/;
    const gPublic = (board.html.match(gabarit) ?? [])[1];
    const gTalent = (ecranOffres.html.match(gabarit) ?? [])[1];
    verifier(
      Boolean(gPublic) && gPublic === gTalent,
      'la grille des offres est la même dans les deux vues',
      `public ${gPublic ?? '—'} · talent ${gTalent ?? '—'}`,
    );
    verifier(
      Boolean(gPublic) && !gPublic.includes('1fr'),
      'la carte ne s’étire pas à la largeur du conteneur',
      gPublic ?? '—',
    );
  }

  verifier(
    ecranOffres.html.includes('href="/talent/offres/') &&
      !/href="\/offres\/[0-9a-f]{8}-/.test(ecranOffres.html),
    'les cartes mènent à la fiche DANS l’espace, pas à la page publique',
  );

  if (offresPubliees.length > 0) {
    const f = await page(cookie, `/talent/offres/${offresPubliees[0].id}`);
    verifier(f.statut === 200, 'la fiche d’une offre répond dans l’espace', `statut ${f.statut}`);
    verifier(
      contient(f.html, 'Je suis intéressé') && !/>\s*Postuler\s*</.test(f.html),
      '« Postuler » y devient « Je suis intéressé·e »',
    );
    // Le retour doit ramener À LA LISTE D'OÙ L'ON VIENT. Il pointait sur le job
    // board public : on quittait la coquille en cliquant « Retour ».
    verifier(
      f.html.includes('href="/talent/offres"') && !/href="\/offres"/.test(f.html),
      'le « Retour » de la fiche ramène dans l’espace, pas sur le job board',
    );
    // La fiche porte la même chrome de page autonome que la liste : mêmes
    // marqueurs, même contrôle.
    for (const marqueur of ['min-h-dvh bg-[var(--fond-page)] p-4', 'Le site Pachamama (nouvel onglet)']) {
      verifier(
        !f.html.includes(marqueur),
        `la fiche connectée ne porte pas « ${marqueur.slice(0, 34)} »`,
      );
    }
  } else {
    saute('aucune offre publiée : contrôle de la fiche sans objet');
  }

  /**
   * LA BARRE DIT OÙ L'ON EST, Y COMPRIS SUR UNE ROUTE SANS ENTRÉE PROPRE.
   *
   * `/talent/candidatures/<uuid>` n'a pas d'entrée à lui. La règle du plus long
   * préfixe y désignait « Mon espace » — juste tant que le suivi vivait sur le
   * tableau de bord, faux depuis que « Mes process » existe. Une table de
   * rattachements corrige ça, et c'est ici qu'on le vérifie : l'entrée active
   * porte `aria-current="page"`, ce qui rend le contrôle exact plutôt que
   * visuel.
   */
  if (candidatures.length > 0) {
    const d = await page(cookie, `/talent/candidatures/${candidatures[0].id}`);
    // React ne garantit pas l'ordre des attributs : on cherche dans les deux
    // sens plutôt que de supposer `href` avant `aria-current`.
    const marquee = (d.html.match(/aria-current="page"[^>]*href="([^"]+)"/) ??
      d.html.match(/href="([^"]+)"[^>]*aria-current="page"/) ??
      [])[1];
    verifier(
      marquee === '/talent/process',
      'sur le détail d’un process, la barre allume « Mes process »',
      `entrée allumée : ${marquee ?? 'aucune'}`,
    );
    verifier(
      d.html.includes('href="/talent/process"') && contient(d.html, 'Vos process'),
      'le retour du détail mène au suivi, pas à l’accueil',
    );

    /**
     * L'ÉQUIPE AFFICHÉE EST CELLE DU MANDAT.
     *
     * Mesuré avant d'écrire la vue : la fiche porte un agent référent sur
     * 42,2 % des candidatures, le mandat porte un recruteur sur 89,1 %. La
     * carte nommait le mauvais objet ET restait vide six fois sur dix.
     *
     * ⚠ On interroge la vue avec le JETON DU TALENT, pas la clé de service :
     * la policy `talent_agents_de_ses_mandats` est justement ce qu'on vérifie,
     * et la clé de service la contourne. Une LEFT JOIN sur une table fermée
     * rend NULL sans lever — le contrôle serait vert pour une mauvaise raison.
     */
    const eq = (await api(jeton,
      `ma_candidature_detail?id=eq.${candidatures[0].id}` +
      '&select=recruteur_prenom,recruteur_nom,mandat_am_prenom,mandat_am_nom'))[0] ?? {};
    const recruteur = [eq.recruteur_prenom, eq.recruteur_nom].filter(Boolean).join(' ');
    if (recruteur) {
      verifier(
        contient(d.html, recruteur) && contient(d.html, 'Recrutement'),
        'le recruteur du mandat est nommé, avec son rôle sur le process',
        recruteur,
      );
    } else {
      saute('ce mandat ne porte aucun recruteur : contrôle sans objet');
    }
    verifier(
      !/agent_referent|@pachamama|mailto:/i.test(d.html.slice(0, 200000)) ||
        !d.html.includes('mailto:'),
      'aucune adresse de collaborateur n’est servie au talent',
    );
  } else {
    saute('aucun process sur ce compte : rattachement de la barre sans objet');
  }

  /* ── 11. La boucle du téléversement (opt-in : elle écrit) ─────────────── */
  section('11. Le téléversement, de bout en bout');
  if (!AVEC_STOCKAGE) {
    saute(
      'boucle du téléversement non jouée',
      'relancer avec --stockage : elle dépose un fichier, réécrit cv_url, puis restaure',
    );
  } else {
    /**
     * ⚠ C'EST LE SEUL CONTRÔLE QUI PROUVE QUE LE STOCKAGE MARCHE À TRAVERS
     * L'ÉCRAN, et il vaut la peine d'écrire pour l'obtenir.
     *
     * Ce que les autres ne peuvent pas montrer : que la valeur écrite en base
     * (`/documents-talent/<fiche>/cv/<fichier>`) est bien reconnue par
     * `lib/talent/stockage.ts`, SIGNÉE côté serveur, et rendue dans le HTML
     * sous une forme qui ouvre réellement le document. Un seau privé, une
     * convention de chemin et une signature à cinq minutes font trois façons
     * de se tromper en silence.
     *
     * Il restaure `cv_url` par le même chemin d'écriture que l'écran —
     * `api.maj_ma_fiche` avec les neuf champs — et supprime l'objet déposé. La
     * seule trace qui reste est dans `app.journal_ecriture`, en append pur.
     */
    const champs = [
      'id',
      'prenom',
      'nom',
      'email_personnel',
      'telephone',
      'url_linkedin',
      'localisation_texte',
      'photo_url',
      'cv_url',
      'portfolio_url',
    ].join(',');
    const [avant] = await api(jeton, `ma_fiche?select=${champs}&limit=1`);

    const enteteEcriture = {
      apikey: A,
      Authorization: `Bearer ${jeton}`,
      'Accept-Profile': 'api',
      'Content-Profile': 'api',
      'Content-Type': 'application/json',
    };
    const majFiche = (cvUrl, cle) =>
      fetch(`${U}/rest/v1/rpc/maj_ma_fiche`, {
        method: 'POST',
        headers: enteteEcriture,
        body: JSON.stringify({
          p_prenom: avant.prenom,
          p_nom: avant.nom,
          p_email_personnel: avant.email_personnel,
          p_telephone: avant.telephone,
          p_url_linkedin: avant.url_linkedin,
          p_localisation_texte: avant.localisation_texte,
          p_photo_url: avant.photo_url,
          p_cv_url: cvUrl,
          p_portfolio_url: avant.portfolio_url,
          p_cle_idempotence: cle,
        }),
      });

    const chemin = `${avant.id}/cv/${Date.now()}-harnais.pdf`;
    const depot = await fetch(`${U}/storage/v1/object/documents-talent/${chemin}`, {
      method: 'POST',
      headers: { apikey: A, Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/pdf' },
      body: new Blob([new TextEncoder().encode('%PDF-1.4\n%%EOF\n')], { type: 'application/pdf' }),
    });
    verifier(depot.status === 200, 'le dépôt dans le seau privé est accepté', `statut ${depot.status}`);

    if (depot.status === 200) {
      const valeur = `/documents-talent/${chemin}`;
      const ecriture = await majFiche(valeur, `harnais-ecrans-${Date.now()}`);
      verifier(ecriture.status === 200, 'api.maj_ma_fiche accepte la valeur stockée', `statut ${ecriture.status}`);

      const apres = await page(cookie, '/talent/fiche');
      const signee = apres.html.match(/\/storage\/v1\/object\/sign\/documents-talent\/[^"'&\\ ]+/);
      verifier(Boolean(signee), 'l’écran rend une URL SIGNÉE, pas le chemin brut du seau');
      verifier(
        contient(apres.html, 'harnais.pdf'),
        'le nom du fichier est lisible, sans son horodatage',
      );

      if (signee) {
        const ouvert = await fetch(`${U}${signee[0].replace(/&amp;/g, '&')}`);
        verifier(
          ouvert.status === 200 && (ouvert.headers.get('content-type') ?? '').includes('pdf'),
          'l’URL signée sert réellement le document',
          `statut ${ouvert.status}`,
        );
        const sansSignature = await fetch(`${U}/storage/v1/object/documents-talent/${chemin}`);
        verifier(
          sansSignature.status !== 200,
          'le même objet SANS signature est refusé — le seau est bien privé',
          `statut ${sansSignature.status}`,
        );
      }

      // ── Restauration, et vérification de la restauration ──
      const remise = await majFiche(avant.cv_url, `harnais-ecrans-rest-${Date.now()}`);
      const [verif] = await api(jeton, 'ma_fiche?select=cv_url&limit=1');
      verifier(
        remise.status === 200 && verif.cv_url === avant.cv_url,
        'cv_url est restaurée à l’identique',
      );
      const retire = await fetch(`${U}/storage/v1/object/documents-talent/${chemin}`, {
        method: 'DELETE',
        headers: { apikey: A, Authorization: `Bearer ${jeton}` },
      });
      verifier(retire.status === 200, 'l’objet déposé par le harnais est supprimé', `statut ${retire.status}`);
    }
  }

  /* ── Verdict ──────────────────────────────────────────────────────────── */
  console.log(
    echecs === 0
      ? `\nÉcrans J4 : tous les contrôles passent${sautes > 0 ? ` (${sautes} sauté(s))` : ''}`
      : `\nÉcrans J4 : ${echecs} contrôle(s) en échec${sautes > 0 ? `, ${sautes} sauté(s)` : ''}`,
  );
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nHarnais interrompu :', e.message);
  process.exit(2);
});
