import { describe, expect, it } from 'vitest';

import type { EntreeParcours } from '@/components/pacha/FriseParcours';

import {
  candidatureIdDe,
  cheminObjet,
  completudeDe,
  COLONNES_ATTENTES,
  COLONNES_CANDIDATURE,
  COLONNES_CANDIDATURE_DETAIL,
  COLONNES_COMPLETUDE,
  COLONNES_CONFIDENTIALITE,
  COLONNES_ENTETE,
  COLONNES_PROFIL,
  entreesIdentiques,
  estObjetStocke,
  estUuid,
  grouperReferentiel,
  libelleAnglais,
  libelleDe,
  libellesDe,
  manquantsPrioritaires,
  nomDepot,
  nomEntreprise,
  nomLisible,
  planDeSynchronisation,
  repartirCandidatures,
  retraitPossible,
  valeurStockee,
  versCandidature,
  versCandidatureDetail,
  versDateIso,
  versEntreeFrise,
  versFiche,
  versPoste,
  type CandidatureTalent,
  type FicheTalent,
} from '@/lib/domaine/talent';

/**
 * LE DOMAINE DE L'ESPACE TALENT, ÉPROUVÉ.
 *
 * Ce fichier ne vérifie pas que le code fait ce qu'il fait : il vérifie les
 * DÉCISIONS. Chaque bloc renvoie à une mesure ou à un arbitrage écrit en tête
 * de `lib/domaine/talent.ts`, et un test qui tombe doit signifier que la
 * décision a changé — pas qu'une variable a été renommée.
 */

/* ══════════════════════════════════════════════════════════════════════════
   Les jeux de colonnes — D-15
   ══════════════════════════════════════════════════════════════════════════ */

describe('les jeux de colonnes de api.ma_fiche', () => {
  /**
   * ⚠ LE CONTRÔLE LE PLUS UTILE DU FICHIER.
   *
   * D-15 : une colonne sélectionnée part dans le HTML, même si rien ne
   * l'affiche. L'écran des attentes n'a aucune raison de demander l'adresse
   * électronique, le téléphone ou le chemin du CV — ce dernier portant le
   * patronyme dans 81 % des cas mesurés en phase 1. Si quelqu'un ajoute une
   * colonne « pour faire simple », ce test tombe.
   */
  const INTERDITES_HORS_PROFIL = [
    'email_personnel',
    'telephone',
    'url_linkedin',
    'cv_url',
    'photo_url',
    'portfolio_url',
    'nom',
  ];

  it('les attentes ne demandent aucune coordonnée ni aucun document', () => {
    for (const colonne of INTERDITES_HORS_PROFIL) {
      expect(COLONNES_ATTENTES).not.toContain(colonne);
    }
  });

  it('l’écran des données ne demande que des états et des dates', () => {
    for (const colonne of INTERDITES_HORS_PROFIL) {
      expect(COLONNES_CONFIDENTIALITE).not.toContain(colonne);
    }
    expect(COLONNES_CONFIDENTIALITE).not.toContain('prenom');
  });

  it('l’en-tête ne demande ni coordonnée ni document', () => {
    for (const colonne of INTERDITES_HORS_PROFIL) {
      expect(COLONNES_ENTETE).not.toContain(colonne);
    }
  });

  it('aucun jeu ne demande une colonne de qualification cabinet', () => {
    // Elles ne sont pas projetées par la vue (`mindset` a été retirée au J4),
    // donc les demander produirait un 42703. Le test fixe l'intention.
    const qualification = [
      'est_qualifie',
      'statut_relation',
      'seniorite',
      'mindset',
      'emoji_statut',
      'resume_ia',
      'agent_referent_id',
    ];
    for (const jeu of [
      COLONNES_ENTETE,
      COLONNES_PROFIL,
      COLONNES_ATTENTES,
      COLONNES_CONFIDENTIALITE,
      COLONNES_COMPLETUDE,
    ]) {
      for (const colonne of qualification) expect(jeu).not.toContain(colonne);
    }
  });

  it('le détail d’une candidature ne demande aucune appréciation', () => {
    // ⚠ Le talent ne doit JAMAIS voir l'argumentaire client ni une
    // appréciation. La vue ne les construit pas — vérifié en base, 42703 —
    // mais on ne les demande pas non plus : deux barrières, comme pour
    // l'anonymat d'une offre (D-12).
    for (const colonne of [
      'argumentaire_client',
      'avis_pachamama',
      'note_interne',
      'pretention_ke',
      'est_qualifie',
      'mindset',
      'reference_pseudonyme',
    ]) {
      expect(COLONNES_CANDIDATURE_DETAIL).not.toContain(colonne);
    }
  });

  it('chaque jeu porte l’identifiant, et aucun doublon', () => {
    for (const jeu of [
      COLONNES_ENTETE,
      COLONNES_PROFIL,
      COLONNES_ATTENTES,
      COLONNES_CONFIDENTIALITE,
      COLONNES_COMPLETUDE,
    ]) {
      expect(jeu).toContain('id');
      expect(new Set(jeu).size).toBe(jeu.length);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   La complétude — calculée faute de source en base
   ══════════════════════════════════════════════════════════════════════════ */

const FICHE_VIDE: FicheTalent = { id: '00000000-0000-4000-8000-000000000000' };

const FICHE_PLEINE: FicheTalent = {
  id: '00000000-0000-4000-8000-000000000000',
  prenom: 'Camille',
  nom: 'Rivoire',
  emailPersonnel: 'camille@exemple.test',
  telephone: '0600000000',
  urlLinkedin: 'linkedin.com/in/camille',
  localisationTexte: 'Lyon',
  cvUrl: '/documents-talent/abc/cv/cv.pdf',
  photoUrl: '//hote/photo.jpg',
  attentesMetierCode: 'product_manager',
  attentesSalaireMinKe: 65,
  attentesSalaireMaxKe: 75,
  attentesDisponibiliteTexte: 'Sous deux mois',
  attentesDescription: 'Un poste orienté discovery.',
  contratsSouhaites: ['cdi'],
  remoteSouhaites: ['hybride'],
  expertisesCodes: ['ia'],
};

describe('completudeDe', () => {
  it('une fiche vide rend 0 % et nomme tous les manques', () => {
    const c = completudeDe(FICHE_VIDE);
    expect(c.score).toBe(0);
    expect(c.remplis).toBe(0);
    expect(c.manquants).toHaveLength(c.attendus);
  });

  it('une fiche complète rend 100 % et aucun manque', () => {
    const c = completudeDe(FICHE_PLEINE);
    expect(c.score).toBe(100);
    expect(c.manquants).toHaveLength(0);
  });

  /**
   * ⚠ SALAIRE **OU** TJM, ET C'EST LE POINT.
   * Un freelance n'a pas de salaire annuel. Exiger les deux aurait plafonné sa
   * complétude sans qu'il puisse rien y faire — le motif de D-17, transposé.
   */
  it('un TJM seul suffit à valider les prétentions', () => {
    const sansSalaire = { ...FICHE_PLEINE, attentesSalaireMinKe: null, attentesSalaireMaxKe: null };
    expect(completudeDe({ ...sansSalaire, attentesTjmMinEur: 500 }).score).toBe(100);
    expect(
      completudeDe(sansSalaire).manquants.map((m) => m.libelle),
    ).toContain('Vos prétentions');
  });

  it('une chaîne d’espaces ne compte pas pour une valeur', () => {
    // Un `<input>` vidé rend `''`, et le schéma zod le transforme en `null`
    // seulement à l'enregistrement : entre les deux, la fiche relue peut
    // porter des blancs. Les compter serait gonfler le score pour rien.
    const c = completudeDe({ ...FICHE_VIDE, prenom: '   ', nom: '\n' });
    expect(c.remplis).toBe(0);
  });

  it('une liste vide ne compte pas, une liste d’un élément compte', () => {
    expect(completudeDe({ ...FICHE_VIDE, expertisesCodes: [] }).remplis).toBe(0);
    expect(completudeDe({ ...FICHE_VIDE, expertisesCodes: ['ia'] }).remplis).toBe(1);
  });

  /**
   * ⚠ LE CONSENTEMENT N'EST PAS UN CHAMP INCOMPLET.
   * C'est une autorisation absente, et les deux appellent des mots très
   * différents. Il a son propre bloc sur le tableau de bord.
   */
  it('le consentement ne participe pas au score', () => {
    const avant = completudeDe(FICHE_PLEINE).score;
    const apres = completudeDe({
      ...FICHE_PLEINE,
      consentementDonneLe: '2026-09-09T10:00:00Z',
    }).score;
    expect(apres).toBe(avant);
  });

  it('chaque manque nomme un écran qui le répare', () => {
    for (const m of completudeDe(FICHE_VIDE).manquants) {
      expect(m.href.startsWith('/talent/')).toBe(true);
      expect(['Qui vous êtes', 'Ce que vous avez fait', 'Ce que vous cherchez']).toContain(m.ecran);
    }
  });

  it('le CV et le métier visé passent devant les autres manques', () => {
    const priorites = manquantsPrioritaires(completudeDe(FICHE_VIDE));
    expect(priorites[0].libelle).toBe('Votre CV');
    expect(priorites[1].libelle).toBe('Le métier que vous visez');
    expect(priorites).toHaveLength(3);
  });

  it('sur une fiche complète, il n’y a rien à prioriser', () => {
    expect(manquantsPrioritaires(completudeDe(FICHE_PLEINE))).toHaveLength(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Les documents et le stockage
   ══════════════════════════════════════════════════════════════════════════ */

describe('la convention de chemin du seau privé', () => {
  it('reconnaît nos objets et laisse passer les URL héritées de Bubble', () => {
    expect(estObjetStocke('/documents-talent/abc/cv/x.pdf')).toBe(true);
    // Mesuré : 3 926 `cv_url` sur 3 926 renseignés sont en `//hôte/…`.
    expect(estObjetStocke('//s3.amazonaws.com/appforest_uf/x.pdf')).toBe(false);
    expect(estObjetStocke('https://exemple.test/x.pdf')).toBe(false);
    expect(estObjetStocke(null)).toBe(false);
  });

  it('cheminObjet et valeurStockee sont réciproques', () => {
    const chemin = 'abc/cv/1757000000000-cv.pdf';
    expect(cheminObjet(valeurStockee(chemin))).toBe(chemin);
  });

  it('un préfixe sans chemin ne rend rien', () => {
    expect(cheminObjet('/documents-talent/')).toBeNull();
  });

  /**
   * ⚠ LE CONTRÔLE DE SÉCURITÉ DE CE BLOC.
   * `storage.foldername` découpe sur les `/` : un nom de fichier contenant une
   * barre oblique créerait un dossier, donc contournerait la liste blanche
   * `('cv','photo','portfolio')` de la policy d'insertion. Le nom est assaini
   * jusqu'à ne plus porter que des lettres, chiffres, point, tiret, souligné.
   */
  it('assainit un nom de fichier hostile', () => {
    const chemin = nomDepot('abc', 'cv', '../../autre/cv.pdf');
    const morceaux = chemin.split('/');
    expect(morceaux).toHaveLength(3);
    expect(morceaux[0]).toBe('abc');
    expect(morceaux[1]).toBe('cv');
    expect(morceaux[2]).not.toContain('..');
  });

  it('retire les accents et les espaces du nom déposé', () => {
    const chemin = nomDepot('abc', 'cv', 'CV Élodie Février.pdf');
    expect(chemin).toMatch(/^abc\/cv\/\d+-CV-Elodie-Fevrier\.pdf$/);
  });

  it('un nom vidé par l’assainissement retombe sur « fichier »', () => {
    expect(nomDepot('abc', 'photo', '   ///   ')).toMatch(/^abc\/photo\/\d+-fichier$/);
  });

  it('nomLisible retire l’horodatage de nos dépôts', () => {
    expect(nomLisible('/documents-talent/abc/cv/1757000000000-mon-cv.pdf')).toBe('mon-cv.pdf');
    // Une URL héritée garde son nom tel quel, requête retirée.
    expect(nomLisible('//hote/f1667x18/CV-Fr-Nicolas.pdf?v=2')).toBe('CV-Fr-Nicolas.pdf');
    expect(nomLisible(null)).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Les candidatures
   ══════════════════════════════════════════════════════════════════════════ */

const base = (p: Partial<CandidatureTalent>): CandidatureTalent => ({
  id: 'x',
  poste: 'Product Manager',
  entreprise: null,
  etape: '👌 Profil transmis au client',
  etapeCouleur: '#8657FF',
  estKo: false,
  estTerminale: false,
  entreeLe: null,
  changeeLe: null,
  retireeLe: null,
  ...p,
});

describe('les candidatures', () => {
  it('une offre anonyme est nommée « Entreprise confidentielle »', () => {
    // 5 des 6 candidatures du compte de test sont dans ce cas, et c'est la vue
    // qui décide — jamais l'écran.
    expect(nomEntreprise(null)).toBe('Entreprise confidentielle');
    expect(nomEntreprise('Najar')).toBe('Najar');
  });

  /**
   * ⚠ LA RÉPARTITION SUIT `est_terminale`, PAS `est_ko`.
   * `est_ko` dirait « close » d'un « Recruté·e » — la pire des confusions sur
   * cet écran.
   */
  it('sépare sur est_terminale et non sur est_ko', () => {
    const { enCours, closes } = repartirCandidatures([
      base({ id: 'recrute', estKo: false, estTerminale: true, etape: '🎉 Recruté·e' }),
      base({ id: 'vivante', estTerminale: false }),
    ]);
    expect(enCours.map((c) => c.id)).toEqual(['vivante']);
    expect(closes.map((c) => c.id)).toEqual(['recrute']);
  });

  it('le dernier mouvement passe en tête', () => {
    const { enCours } = repartirCandidatures([
      base({ id: 'vieille', changeeLe: '2026-01-01T00:00:00Z' }),
      base({ id: 'recente', changeeLe: '2026-09-01T00:00:00Z' }),
    ]);
    expect(enCours.map((c) => c.id)).toEqual(['recente', 'vieille']);
  });

  it('une candidature sans date se range en bas sans faire tomber le tri', () => {
    const { enCours } = repartirCandidatures([
      base({ id: 'sans-date' }),
      base({ id: 'datee', changeeLe: '2026-09-01T00:00:00Z' }),
    ]);
    expect(enCours[0].id).toBe('datee');
    expect(enCours).toHaveLength(2);
  });

  /**
   * `api.retirer_ma_candidature` refuse une candidature déjà close en 23514.
   * L'écran n'offre donc pas le geste : proposer un bouton dont on sait qu'il
   * sera refusé est une promesse qu'on ne tient pas.
   */
  it('le retrait n’est possible que sur une candidature vivante', () => {
    expect(retraitPossible({ estTerminale: false, retireeLe: null })).toBe(true);
    expect(retraitPossible({ estTerminale: true, retireeLe: null })).toBe(false);
    expect(retraitPossible({ estTerminale: false, retireeLe: '2026-09-01' })).toBe(false);
  });

  it('versCandidature garde la couleur d’étape et le libellé du registre talent', () => {
    const c = versCandidature({
      id: 'abc',
      poste: 'Product Manager',
      entreprise: null,
      etape: '🙅🏻‍♀️ Candidature close',
      etape_code: 'ko_by_pachamama',
      etape_couleur: '#F4728A',
      est_ko: true,
      est_terminale: true,
    });
    expect(c.etape).toBe('🙅🏻‍♀️ Candidature close');
    expect(c.etapeCouleur).toBe('#F4728A');
    expect(c.estTerminale).toBe(true);
  });

  /**
   * ⚠ LE REGISTRE INTERNE NE DOIT PAS SORTIR, MÊME PAR UNE COLONNE MUETTE.
   *
   * `etape` collapse exprès `ko`, `ko_by_pachamama` et `ko_by_client` en une
   * seule phrase — « Candidature close » — pour ne pas dire QUI a fermé (D-02).
   * `etape_code` défaisait ce collapse : mesuré le 09/09, quatre des six
   * candidatures du compte de test portent `ko_by_pachamama`. La colonne était
   * demandée par les deux jeux et lue par aucun écran talent, donc sérialisable
   * à la première frontière client ouverte (D-15).
   *
   * Ce contrôle porte sur les DEUX bouts : la colonne ne doit pas être demandée
   * à la vue, et le mappeur ne doit pas la faire entrer dans l'objet — parce que
   * la remettre dans un seul des deux endroits suffirait à la faire revenir.
   */
  it('ni la liste ni le détail ne demandent ou ne portent etape_code', () => {
    expect(COLONNES_CANDIDATURE).not.toContain('etape_code');
    expect(COLONNES_CANDIDATURE_DETAIL).not.toContain('etape_code');
    expect(COLONNES_CANDIDATURE_DETAIL).not.toContain('entreprise_logo');

    const brut = {
      id: 'abc',
      poste: 'Product Manager',
      etape: '🙅🏻‍♀️ Candidature close',
      etape_code: 'ko_by_pachamama',
      entreprise_logo: 'https://exemple.test/logo.png',
    };
    expect(Object.keys(versCandidature(brut))).not.toContain('etapeCode');
    const detail = versCandidatureDetail(brut);
    expect(Object.keys(detail)).not.toContain('etapeCode');
    expect(Object.keys(detail)).not.toContain('entrepriseLogo');
    expect(JSON.stringify(detail)).not.toContain('ko_by_pachamama');
    expect(JSON.stringify(detail)).not.toContain('logo.png');
  });

  it('un poste absent ne rend jamais « null »', () => {
    expect(versCandidature({ id: 'a', poste: null }).poste).toBe('Poste');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   La frise, et la traduction des deux formes de période
   ══════════════════════════════════════════════════════════════════════════ */

describe('versEntreeFrise', () => {
  const poste = (p: Record<string, unknown>) =>
    versPoste({
      id: '11111111-1111-4111-8111-111111111111',
      intitule: 'PM',
      entreprise_nom: 'Ombelle',
      debut_le: '2019-03-01',
      fin_le: null,
      en_cours: false,
      description: null,
      ordre: 0,
      ...p,
    });

  it('traduit une date en année plus mois', () => {
    const e = versEntreeFrise(poste({}));
    expect(e?.anneeDebut).toBe(2019);
    expect(e?.moisDebut).toBe(3);
    expect(e?.anneeFin).toBeNull();
  });

  /**
   * ⚠ UNE LIGNE SANS DATE DE DÉBUT EST ÉCARTÉE, PAS REPLIÉE SUR AUJOURD'HUI.
   * `core.fiche_talent_poste.debut_le` est nullable ; replier inventerait une
   * date, et l'écran la présenterait comme une donnée de la personne.
   */
  it('rend null sans date de début', () => {
    expect(versEntreeFrise(poste({ debut_le: null }))).toBeNull();
  });

  it('une date illisible est écartée comme une date absente', () => {
    expect(versEntreeFrise(poste({ debut_le: 'pas une date' }))).toBeNull();
  });

  it('« en poste » remonte, et la fin reste absente', () => {
    const e = versEntreeFrise(poste({ en_cours: true }));
    expect(e?.enPoste).toBe(true);
    expect(e?.anneeFin).toBeNull();
  });

  it('versDateIso pose le 1er du mois, et janvier sans mois', () => {
    expect(versDateIso(2019, 3)).toBe('2019-03-01');
    expect(versDateIso(2019)).toBe('2019-01-01');
    expect(versDateIso(2019, 13)).toBe('2019-01-01');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Les référentiels
   ══════════════════════════════════════════════════════════════════════════ */

describe('les référentiels', () => {
  const entrees = [
    { referentiel: 'metier', code: 'pm', libelle: 'Product Manager', ordre: null },
    { referentiel: 'metier', code: 'de', libelle: 'Data Engineer', ordre: null },
    { referentiel: 'univers', code: 'product', libelle: 'Product', ordre: 1 },
  ];

  it('groupe par vocabulaire et trie en français', () => {
    const g = grouperReferentiel(entrees);
    expect(Object.keys(g).sort()).toEqual(['metier', 'univers']);
    expect(g.metier.map((o) => o.libelle)).toEqual(['Data Engineer', 'Product Manager']);
  });

  it('trie sur les accents comme le fait le français', () => {
    const g = grouperReferentiel([
      { referentiel: 'x', code: 'z', libelle: 'Zèbre', ordre: null },
      { referentiel: 'x', code: 'e', libelle: 'Épargne', ordre: null },
      { referentiel: 'x', code: 'a', libelle: 'Analyste', ordre: null },
    ]);
    expect(g.x.map((o) => o.libelle)).toEqual(['Analyste', 'Épargne', 'Zèbre']);
  });

  it('un code inconnu du référentiel est rendu tel quel, jamais masqué', () => {
    const options = [{ valeur: 'pm', libelle: 'Product Manager' }];
    expect(libelleDe(options, 'pm')).toBe('Product Manager');
    expect(libelleDe(options, 'inconnu')).toBe('inconnu');
    expect(libelleDe(options, null)).toBeNull();
  });

  it('libellesDe conserve les codes inconnus en fin de liste', () => {
    const options = [
      { valeur: 'a', libelle: 'Alpha' },
      { valeur: 'b', libelle: 'Beta' },
    ];
    expect(libellesDe(options, ['b', 'zzz', 'a'])).toEqual(['Alpha', 'Beta', 'zzz']);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Le reste
   ══════════════════════════════════════════════════════════════════════════ */

describe('les petites règles', () => {
  it('les cinq niveaux d’anglais sont traduits, l’inconnu est rendu tel quel', () => {
    // Mesuré : `api.ma_fiche.niveau_anglais` rend le CODE brut, et
    // `api.mon_referentiel` ne publie pas ce domaine.
    expect(libelleAnglais('courant_occasionnel')).toBe(
      'Bon niveau écrit et oral dans un contexte pro',
    );
    expect(libelleAnglais('aucun')).toBe('Ne maîtrise pas');
    expect(libelleAnglais('code_futur')).toBe('code_futur');
    expect(libelleAnglais(null)).toBeNull();
  });

  it('estUuid accepte les identifiants de la base et refuse le reste', () => {
    expect(estUuid('91cf787f-c1c2-5932-8a37-274e8d32f241')).toBe(true);
    expect(estUuid('«r1»-1757000000000')).toBe(false);
    expect(estUuid('')).toBe(false);
  });

  it('candidatureIdDe ne retient qu’un uuid', () => {
    expect(candidatureIdDe({ candidature_id: '91cf787f-c1c2-5932-8a37-274e8d32f241' })).toBe(
      '91cf787f-c1c2-5932-8a37-274e8d32f241',
    );
    expect(candidatureIdDe({ candidature_id: 'oui' })).toBeNull();
    expect(candidatureIdDe(null)).toBeNull();
    expect(candidatureIdDe('texte')).toBeNull();
  });

  it('versFiche ne fabrique pas de tableau à partir d’une colonne non demandée', () => {
    // Le point du jeu de colonnes partiel : un écran qui n'a pas demandé les
    // secteurs ne doit pas les croire renseignés, ni planter en les lisant.
    const f = versFiche({ id: 'abc' });
    expect(f.secteursVisesCodes).toEqual([]);
    expect(f.prenom).toBeNull();
    expect(f.rechercheActive).toBeNull();
  });

  it('versFiche distingue « false » de « non demandé » sur un booléen', () => {
    expect(versFiche({ id: 'a', actif: false }).actif).toBe(false);
    expect(versFiche({ id: 'a' }).actif).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Le plan de synchronisation de la frise — la pièce la plus risquée
   ══════════════════════════════════════════════════════════════════════════ */

describe('planDeSynchronisation', () => {
  const UUID_A = '11111111-1111-4111-8111-111111111111';
  const UUID_B = '22222222-2222-4222-8222-222222222222';
  const NEUVE = '«r1»-1757000000000';

  const e = (cle: string, p: Partial<EntreeParcours> = {}): EntreeParcours => ({
    cle,
    employeur: 'Ombelle',
    intitule: 'Product Manager',
    anneeDebut: 2019,
    moisDebut: 3,
    anneeFin: null,
    moisFin: null,
    enPoste: false,
    description: '',
    ...p,
  });

  it('rien ne bouge, rien ne s’écrit', () => {
    const liste = [e(UUID_A), e(UUID_B)];
    const plan = planDeSynchronisation(liste, liste);
    expect(plan).toEqual({ retraits: [], ajouts: [], majs: [] });
  });

  /**
   * ⚠ LE DÉFAUT QUE CETTE FONCTION EXISTE POUR NE PAS COMMETTRE.
   * Une clé qui n'est pas un uuid vient du composant, donc la ligne n'existe
   * pas en base : c'est un AJOUT. La traiter comme une modification lèverait
   * en 42501 ; l'inverse — traiter une ligne existante comme un ajout — crée un
   * doublon silencieux, et c'est celui-là qui fait mal.
   */
  it('une clé non-uuid est un ajout, une clé uuid une modification', () => {
    const plan = planDeSynchronisation(
      [e(UUID_A)],
      [e(UUID_A, { intitule: 'Lead Product' }), e(NEUVE)],
    );
    expect(plan.ajouts.map((a) => a.entree.cle)).toEqual([NEUVE]);
    expect(plan.majs.map((m) => m.posteId)).toEqual([UUID_A]);
    expect(plan.retraits).toEqual([]);
  });

  it('une entrée disparue est un retrait', () => {
    const plan = planDeSynchronisation([e(UUID_A), e(UUID_B)], [e(UUID_A)]);
    expect(plan.retraits).toEqual([UUID_B]);
    expect(plan.majs).toEqual([]);
  });

  /**
   * ⚠ RETIRER UNE LIGNE DÉCALE LES SUIVANTES, DONC LEUR `ordre` CHANGE.
   * Sans cette règle, la base garderait des rangs périmés et la frise ne
   * raconterait plus la même histoire que le dossier.
   */
  it('un déplacement est une modification, même à contenu identique', () => {
    const plan = planDeSynchronisation([e(UUID_A), e(UUID_B)], [e(UUID_B), e(UUID_A)]);
    expect(plan.majs.map((m) => [m.posteId, m.rang])).toEqual([
      [UUID_B, 0],
      [UUID_A, 1],
    ]);
  });

  it('le rang transmis est celui de la liste rendue par la frise', () => {
    const plan = planDeSynchronisation([], [e(NEUVE), e(`${NEUVE}-2`)]);
    expect(plan.ajouts.map((a) => a.rang)).toEqual([0, 1]);
  });

  it('un champ facultatif vide et un champ absent sont égaux', () => {
    // La base ne les distingue pas : `optionnel` transforme `''` en `null`.
    // Les compter comme un changement provoquerait un `UPDATE` et une ligne de
    // journal à chaque passage, sans que rien n'ait bougé.
    const plan = planDeSynchronisation(
      [e(UUID_A, { description: '' })],
      [e(UUID_A, { description: '   ' })],
    );
    expect(plan.majs).toEqual([]);
  });

  it('remplacer une ligne par une neuve donne un retrait ET un ajout', () => {
    const plan = planDeSynchronisation([e(UUID_A)], [e(NEUVE)]);
    expect(plan.retraits).toEqual([UUID_A]);
    expect(plan.ajouts).toHaveLength(1);
  });

  it('entreesIdentiques compare le fond, pas la clé', () => {
    // Deux clés différentes, même contenu : « identiques » au sens qui compte
    // ici, celui de « faut-il écrire ». C'est `planDeSynchronisation` qui
    // décide du verbe à partir de la clé.
    expect(entreesIdentiques(e(UUID_A), e(UUID_B))).toBe(true);
  });

  it('« en poste » est un changement de fond', () => {
    expect(entreesIdentiques(e(UUID_A), e(UUID_A, { enPoste: true }))).toBe(false);
  });
});
