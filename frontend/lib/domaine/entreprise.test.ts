import { describe, expect, it } from 'vitest';

import {
  adresseEnLignes,
  codeMetier,
  dateCourte,
  decouperEtape,
  estClos,
  fourchette,
  fusionnerEtapes,
  libelleFonction,
  libelleStatut,
  montantKe,
  montantTjm,
  prochaineEcheance,
  teinteDepuisLibelle,
  urlMedia,
  urlSite,
  versCandidat,
  versEntreprise,
  versMandat,
  versNote,
  versPlacement,
} from './entreprise';

/**
 * LES FORMES RÉELLES DU PORTAIL ENTREPRISE.
 *
 * Même parti pris que `fiche.test.ts` : les jeux d'essai sont RELEVÉS sur le
 * projet de développement le 09/09, sous de vrais jetons des trois comptes de
 * `COMPTES_DE_TEST.md`, et non écrits à la main. Ils figent ce que l'écran doit
 * savoir absorber — les `null` en pagaille, les URL protocole-relatives, les
 * codes techniques rendus en clair — pas ce qu'on aimerait que la saisie soit.
 */

describe('decouperEtape — l’emoji collé au libellé', () => {
  it('sépare l’emoji du texte', () => {
    expect(decouperEtape('👌 Profil présenté')).toEqual({
      emoji: '👌',
      libelle: 'Profil présenté',
    });
  });

  it('sépare une séquence d’emojis composée', () => {
    // « 🙅🏻‍♀️ » est un emoji + modificateur de teinte + jointure de largeur
    // nulle + symbole féminin. Un découpage caractère par caractère le
    // casserait ; on coupe au premier espace.
    expect(decouperEtape('🙅🏻‍♀️ Écarté·e par vos soins')).toEqual({
      emoji: '🙅🏻‍♀️',
      libelle: 'Écarté·e par vos soins',
    });
  });

  it('ne mange pas le premier mot quand il n’y a pas d’emoji', () => {
    expect(decouperEtape('Premier entretien')).toEqual({
      emoji: null,
      libelle: 'Premier entretien',
    });
  });

  it('rend un tiret cadratin sur une étape absente', () => {
    expect(decouperEtape(null)).toEqual({ emoji: null, libelle: '—' });
  });
});

describe('fusionnerEtapes — les six colonnes, même vides', () => {
  it('rend les six colonnes quand la donnée n’en porte qu’une', () => {
    const etapes = fusionnerEtapes([
      { etapeCode: 'send_out', etape: '👌 Profil présenté', etapeCouleur: '#8657FF' },
    ]);
    expect(etapes).toHaveLength(6);
    expect(etapes.map((e) => e.code)).toEqual([
      'send_out',
      'interview_1',
      'interview_2',
      'final_interview',
      'hired',
      'ko_by_client',
    ]);
  });

  it('la donnée l’emporte sur l’ossature', () => {
    const [premiere] = fusionnerEtapes([
      { etapeCode: 'send_out', etape: '✅ Autre libellé', etapeCouleur: '#123456' },
    ]);
    expect(premiere.libelle).toBe('Autre libellé');
    expect(premiere.couleur).toBe('#123456');
  });

  it('une étape sans candidature garde son libellé d’ossature', () => {
    const etapes = fusionnerEtapes([]);
    expect(etapes.find((e) => e.code === 'final_interview')?.libelle).toBe('Entretien final');
  });
});

describe('codeMetier — la convention vérifiée sur les 255 métiers', () => {
  it.each([
    ['Product Manager', 'product_manager'],
    ['VP of Engineering', 'vp_of_engineering'],
    ['Directeur Commercial', 'directeur_commercial'],
    ['Head of RSSI', 'head_of_rssi'],
    ['Data Eng.', 'data_eng'],
    ['Chief Marketing Officer (CMO)', 'chief_marketing_officer_cmo'],
    // L'esperluette devient « et » : c'est le seul écart des douze qui avaient
    // fait échouer la première version de la règle.
    ['PR & Communication Manager', 'pr_et_communication_manager'],
    ['R&D Manager', 'r_et_d_manager'],
    ['Manager / Senior Manager Data & AI', 'manager_senior_manager_data_et_ai'],
  ])('« %s » → %s', (libelle, attendu) => {
    expect(codeMetier(libelle)).toBe(attendu);
  });
});

describe('estClos / libelleStatut — un statut inconnu ne fait pas disparaître un poste', () => {
  it('les deux statuts de fin sont clos', () => {
    expect(estClos('termine')).toBe(true);
    expect(estClos('close_pachamama')).toBe(true);
  });

  it('« reprise » reste actif, comme tout statut hors des deux', () => {
    expect(estClos('reprise')).toBe(false);
    expect(estClos('statut_invente_demain')).toBe(false);
    expect(estClos(null)).toBe(false);
  });

  it('un statut inconnu se rend lisible plutôt que brut', () => {
    expect(libelleStatut('close_pachamama')).toBe('Clos par Pachamama');
    expect(libelleStatut('quelque_chose')).toBe('quelque chose');
    expect(libelleStatut(null)).toBe('Statut inconnu');
  });
});

describe('urlMedia / urlSite — les trois formes réelles de la base', () => {
  it('préfixe une URL protocole-relative — 275 logos sur 363 sont dans ce cas', () => {
    expect(urlMedia('//98119bfbf8cfc027dc70db6c69918bd3.cdn.bubble.io/f177/logo.png')).toBe(
      'https://98119bfbf8cfc027dc70db6c69918bd3.cdn.bubble.io/f177/logo.png',
    );
  });

  it('laisse intacte une URL complète', () => {
    expect(urlMedia('https://exemple.fr/a.png')).toBe('https://exemple.fr/a.png');
  });

  it('rend null sur une valeur vide ou blanche', () => {
    expect(urlMedia(null)).toBeNull();
    expect(urlMedia('   ')).toBeNull();
  });

  it('donne un schéma à un domaine nu — 133 sites sur 259 sont dans ce cas', () => {
    // Sans schéma, le navigateur lit un chemin RELATIF : le lien mènerait à
    // /entreprise/profil/prose.com.
    expect(urlSite('prose.com')).toBe('https://prose.com');
    expect(urlSite('https://www.n2f.com/')).toBe('https://www.n2f.com/');
    expect(urlSite('//exemple.fr')).toBe('https://exemple.fr');
  });
});

describe('les montants — deux unités qui cohabitent', () => {
  it('les milliers d’euros portent leur unité', () => {
    expect(montantKe(25.3)).toBe('25,3 K€');
    expect(montantKe(110)).toBe('110 K€');
    expect(montantKe(null)).toBeNull();
  });

  it('le TJM est en euros par jour, jamais en milliers', () => {
    expect(montantTjm(850)).toBe('850 € / jour');
    expect(montantTjm(null)).toBeNull();
  });

  it('la fourchette prend le salaire, à défaut le TJM, sinon rien', () => {
    expect(
      fourchette({ salaireMinKe: 65, salaireMaxKe: 80, tjmMinEur: null, tjmMaxEur: null }),
    ).toBe('65-80 K');
    expect(
      fourchette({ salaireMinKe: null, salaireMaxKe: null, tjmMinEur: 600, tjmMaxEur: 650 }),
    ).toBe('600-650 €/j');
    expect(
      fourchette({ salaireMinKe: null, salaireMaxKe: null, tjmMinEur: null, tjmMaxEur: null }),
    ).toBeNull();
  });
});

describe('prochaineEcheance — une échéance passée n’est pas « prochaine »', () => {
  const t = (iso: string) => ({ echeanceLe: iso });
  const maintenant = Date.parse('2026-09-09T12:00:00Z');

  it('rend la plus proche des dates à venir', () => {
    expect(
      prochaineEcheance(
        [t('2026-10-01T09:00:00Z'), t('2026-09-15T09:00:00Z'), t('2026-11-01T09:00:00Z')],
        maintenant,
      ),
    ).toBe(new Date('2026-09-15T09:00:00Z').toISOString());
  });

  it('ignore les dates passées', () => {
    expect(prochaineEcheance([t('2026-08-01T09:00:00Z')], maintenant)).toBeNull();
  });

  it('supporte une liste vide ou des dates absentes', () => {
    expect(prochaineEcheance([], maintenant)).toBeNull();
    expect(prochaineEcheance([{ echeanceLe: null }], maintenant)).toBeNull();
  });
});

describe('adresseEnLignes — un jsonb sans forme imposée', () => {
  it('assemble le code postal et la ville sur une seule ligne', () => {
    expect(
      adresseEnLignes({
        ligne1: '15B route de Vienne',
        ligne2: null,
        code_postal: '69007',
        ville: 'Lyon',
        pays: 'France',
      }),
    ).toEqual(['15B route de Vienne', '69007 Lyon', 'France']);
  });

  it('rend un tableau vide sur null, sur un tableau, ou sur un objet vide', () => {
    expect(adresseEnLignes(null)).toEqual([]);
    expect(adresseEnLignes(['a'])).toEqual([]);
    expect(adresseEnLignes({})).toEqual([]);
  });
});

describe('teinteDepuisLibelle — les vues rendent le libellé, pas le code', () => {
  it('reconnaît les quatre verticales que le design system colore', () => {
    expect(teinteDepuisLibelle('Product')).toBe('product');
    expect(teinteDepuisLibelle('Tech')).toBe('tech');
    expect(teinteDepuisLibelle('Sales')).toBe('sales');
  });

  it('range Data et Design sous la teinte Tech, comme le job board', () => {
    expect(teinteDepuisLibelle('Data')).toBe('tech');
    expect(teinteDepuisLibelle('Design')).toBe('tech');
  });

  it('retombe sur la teinte neutre pour les verticales sans couleur propre', () => {
    expect(teinteDepuisLibelle('People & Finance')).toBe('people');
    expect(teinteDepuisLibelle('Marketing')).toBe('people');
    expect(teinteDepuisLibelle(null)).toBe('people');
  });
});

describe('libelleFonction — un code technique rendu lisible, jamais traduit', () => {
  it('remplace les tirets bas et capitalise', () => {
    expect(libelleFonction('career_agent')).toBe('Career Agent');
  });
  it('rend null sur une fonction absente', () => {
    expect(libelleFonction(null)).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Les convertisseurs, sur des lignes RELEVÉES le 09/09
   ══════════════════════════════════════════════════════════════════════════ */

describe('versMandat — une ligne réelle de api.mandat_client (compte Hublo)', () => {
  const ligne = {
    id: '1ea7973a-a7a6-54e3-9b44-d3e719529139',
    intitule: 'Hublo - Senior Product Manager',
    statut: 'termine',
    univers: 'Product',
    metier: 'Senior Product Manager',
    contrat: 'freelance',
    salaire_min_ke: null,
    salaire_max_ke: null,
    tjm_min_eur: 600,
    tjm_max_eur: 650,
    localisation: 'Paris',
    kickoff_le: '2026-06-24T22:00:00+00:00',
    cree_le: '2026-06-25T16:09:31.344+00:00',
    est_anonyme: true,
    est_publie: false,
    candidatures: 6,
    en_cours: 0,
    presentes: 0,
    agent_nom: 'Martin PHILIP',
    agent_photo: '//98119bfbf8cfc027dc70db6c69918bd3.cdn.bubble.io/f177/martin.png',
    agent_fonction: null,
  };

  it('convertit la ligne sans rien perdre', () => {
    const m = versMandat(ligne);
    expect(m.id).toBe(ligne.id);
    expect(m.statut).toBe('termine');
    expect(m.tjmMinEur).toBe(600);
    expect(m.candidatures).toBe(6);
    expect(m.estAnonyme).toBe(true);
    expect(m.estPublie).toBe(false);
  });

  it('rend la photo de l’agent utilisable dans un `src`', () => {
    expect(versMandat(ligne).agentPhoto).toMatch(/^https:\/\//);
  });

  it('l’absence de fonction ne devient pas une chaîne vide', () => {
    expect(versMandat(ligne).agentFonction).toBeNull();
  });

  it('un intitulé absent ne rend jamais « null » à l’écran', () => {
    expect(versMandat({ ...ligne, intitule: null }).intitule).toBe('Poste sans intitulé');
  });
});

describe('versCandidat — une ligne réelle de api.candidat_presente', () => {
  const ligne = {
    candidature_id: '59eb34b5-9c20-5430-b93b-6456bf977b17',
    mandat_id: '5c3be9f0-cd30-5c28-8382-25cb668e7b43',
    reference_pseudonyme: '#001',
    argumentaire_client: null,
    etape: '🙌 Recruté·e',
    etape_code: 'hired',
    etape_ordre: 10,
    etape_couleur: '#79E6BE',
    est_ko: false,
    est_terminale: true,
    date_entree_pipeline: null,
    date_dernier_changement_etape: '2026-07-20T15:48:28.997+00:00',
    date_prochaine_echeance: null,
    presente_le: null,
    prenom: 'Mathieu',
    localisation_texte: 'Paris, France',
    niveau_anglais: 'courant_quotidien',
    poste_actuel_employeur: 'Deezer (en free)',
    metier_actuel: 'Senior Product Designer',
    univers: 'Product',
    // Mesuré : `expertises` arrive à NULL et non en tableau vide.
    expertises: null,
    attentes_salaire_min_ke: null,
    attentes_salaire_max_ke: null,
    attentes_tjm_min_eur: 750,
    attentes_tjm_max_eur: 850,
    attentes_disponibilite_texte: null,
    cv_url: null,
    photo_url: '//98119bfbf8cfc027dc70db6c69918bd3.cdn.bubble.io/f173/IMG_3296.png',
  };

  it('prend `candidature_id` comme identifiant de la fiche', () => {
    expect(versCandidat(ligne).id).toBe('59eb34b5-9c20-5430-b93b-6456bf977b17');
  });

  it('un `expertises` NULL devient un tableau vide, jamais null', () => {
    // La vue rend NULL et non `{}` : sans cette normalisation, `.map()` lève.
    expect(versCandidat(ligne).expertises).toEqual([]);
  });

  it('l’étape terminale est reconnue', () => {
    const c = versCandidat(ligne);
    expect(c.estTerminale).toBe(true);
    expect(c.estKo).toBe(false);
  });

  it('la référence pseudonyme ne se perd jamais', () => {
    expect(versCandidat(ligne).reference).toBe('#001');
    expect(versCandidat({ ...ligne, reference_pseudonyme: null }).reference).toBe(
      'Sans référence',
    );
  });
});

describe('versEntreprise — la fiche N2J Soft, telle qu’elle est', () => {
  const ligne = {
    id: 'f8a5ca9c-bde8-5994-a8ff-fd403b2e77f3',
    nom: 'N2J Soft',
    raison_sociale: null,
    description: 'Fintech qui accompagne les entreprises…',
    fondateur: null,
    serie_financement: null,
    site_web: 'https://www.n2f.com/',
    siret: null,
    // Mesuré : les 47 valeurs remplies sont des identifiants YouTube NUS.
    video_url: 'wCPJ5VNpqzQ',
    logo_url: '//98119bfbf8cfc027dc70db6c69918bd3.cdn.bubble.io/f171/logo.jpeg',
    localisation_texte: null,
    nb_employes: null,
    nb_techs: null,
    secteur: null,
    type_produit: null,
    type_entreprise: null,
    statut_contrat_code: 'contrat_signe',
    statut_contrat: 'Contrat signé',
    success_fee_pct: 18,
    success_fee_abs_ke: null,
    success_fee_est_absolu: false,
    apport_affaires: false,
    exclusivite: false,
    duree_exclusivite_semaines: null,
    nb_mois_garantie: 3,
    date_signature_contrat: null,
    date_fin_contrat: null,
    email_facturation: null,
    raison_sociale_facturation: null,
    adresse_facturation: null,
    am_nom: 'Marion Darnet',
    am_photo: null,
    am_fonction: 'career_agent',
    am_email: null,
  };

  it('garde l’identifiant vidéo tel quel — ce n’est pas une URL', () => {
    expect(versEntreprise(ligne).videoUrl).toBe('wCPJ5VNpqzQ');
  });

  it('normalise le logo protocole-relatif', () => {
    expect(versEntreprise(ligne).logoUrl).toBe(
      '//98119bfbf8cfc027dc70db6c69918bd3.cdn.bubble.io/f171/logo.jpeg',
    );
    // Le logo brut reste tel quel dans le modèle — c'est ce que le formulaire
    // doit RÉÉMETTRE à l'identique —, et c'est `urlMedia` qui le prépare pour
    // un `src`. Confondre les deux ferait enregistrer une valeur modifiée à
    // chaque ouverture de la fiche.
    expect(urlMedia(versEntreprise(ligne).logoUrl)).toMatch(/^https:\/\//);
  });

  it('lit le régime de commission sur `success_fee_est_absolu`', () => {
    const e = versEntreprise(ligne);
    expect(e.successFeeEstAbsolu).toBe(false);
    expect(e.successFeePct).toBe(18);
  });
});

describe('versPlacement — les deux unités d’une même ligne de facturation', () => {
  it('un CDI porte un salaire en K€ et une commission en K€', () => {
    const p = versPlacement({
      id: '3d5afc33-9c79-5e96-844e-1c8293d16f6a',
      mandat_id: '392259a6-df99-5f29-88bb-7c9f2925151f',
      mandat_intitule: 'Hublo - PMM Director',
      metier: 'PMM Director',
      reference_pseudonyme: '#011',
      contrat: 'cdi',
      date_closing: '2026-08-06T22:00:00+00:00',
      salaire_final_ke: 110,
      commission_ke: 25.3,
      tjm_facture_client_eur: null,
      est_archive: false,
    });
    expect(montantKe(p.salaireFinalKe)).toBe('110 K€');
    expect(montantKe(p.commissionKe)).toBe('25,3 K€');
    expect(p.tjmFactureEur).toBeNull();
  });

  it('une mission en régie porte un TJM en euros, pas en milliers', () => {
    const p = versPlacement({
      id: 'bdf75312-69a8-5263-b60c-8201f718b3b7',
      contrat: 'freelance',
      salaire_final_ke: null,
      commission_ke: null,
      tjm_facture_client_eur: 850,
      est_archive: false,
    });
    expect(p.salaireFinalKe).toBeNull();
    expect(montantTjm(p.tjmFactureEur)).toBe('850 € / jour');
  });
});

describe('versNote — l’auteur n’est jamais vide', () => {
  it('garde l’auteur calculé par la vue', () => {
    expect(
      versNote({ id: 'n1', commentaire: 'Profil validé.', auteur: 'Vous', ecrite_le: null }).auteur,
    ).toBe('Vous');
  });

  it('replie sur « Pachamama » plutôt que d’afficher un fil signé de rien', () => {
    expect(versNote({ id: 'n2', commentaire: 'x', auteur: null }).auteur).toBe('Pachamama');
  });
});

describe('les dates — une valeur illisible ne casse pas la page', () => {
  it('formate une date ISO', () => {
    expect(dateCourte('2026-08-06T22:00:00+00:00')).toMatch(/^\d{2}\/\d{2}\/2026$/);
  });
  it('rend null sur une date absente ou invalide', () => {
    expect(dateCourte(null)).toBeNull();
    expect(dateCourte('pas une date')).toBeNull();
  });
});
