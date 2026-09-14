import { describe, expect, it } from 'vitest';

import {
  cleIdempotence,
  SCHEMA_ATTENTES,
  SCHEMA_CONSENTEMENT,
  SCHEMA_LISTE,
  SCHEMA_MAJ_POSTE,
  SCHEMA_POSTE,
  SCHEMA_POSTULER,
  SCHEMA_PROFIL,
  SCHEMA_RETRAIT,
  SCHEMA_SUPPRESSION,
  TYPES_LISTE,
  finApresDebut,
  periodeSansContradiction,
} from '@/lib/talent/saisie';

/**
 * LES RÈGLES DE SAISIE DE L'ESPACE TALENT, ÉPROUVÉES.
 *
 * Ce fichier existe pour la raison écrite en tête de `saisie.ts` : ces schémas
 * décident si une chaîne vide EFFACE une colonne et si une règle d'URL bloque
 * les 3 926 talents porteurs d'un CV. C'est la couche la plus courte du lot et
 * la plus coûteuse quand elle se trompe — D-17 et D-18 sont toutes les deux des
 * fautes de cette couche.
 *
 * Les valeurs employées ici sont celles MESURÉES en base le 09/09, pas des
 * exemples inventés : `//s3.amazonaws.com/appforest_uf/…` est la forme réelle
 * des 3 926 `cv_url`, et « à présenter en visio (trop de NDA signés) » est une
 * vraie valeur de `portfolio_url`.
 */

const NONCE = 'essai-nonce';

/* ══════════════════════════════════════════════════════════════════════════
   La clé d'idempotence
   ══════════════════════════════════════════════════════════════════════════ */

describe('cleIdempotence', () => {
  it('même nonce et même charge donnent la même clé — c’est le double-clic', () => {
    const a = cleIdempotence(NONCE, { p_prenom: 'Camille' });
    const b = cleIdempotence(NONCE, { p_prenom: 'Camille' });
    expect(a).toBe(b);
  });

  it('une charge modifiée donne une clé différente — c’est la correction', () => {
    const a = cleIdempotence(NONCE, { p_prenom: 'Camille' });
    const b = cleIdempotence(NONCE, { p_prenom: 'Camile' });
    expect(a).not.toBe(b);
  });

  it('un nonce neuf donne une clé différente — c’est le renvoi volontaire', () => {
    const a = cleIdempotence('un', { x: 1 });
    const b = cleIdempotence('deux', { x: 1 });
    expect(a).not.toBe(b);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Mon profil
   ══════════════════════════════════════════════════════════════════════════ */

const PROFIL_MINIMAL = { prenom: 'Camille', nom: 'Rivoire', nonce: NONCE };

describe('SCHEMA_PROFIL', () => {
  it('accepte prénom et nom seuls, et met tout le reste à null', () => {
    const r = SCHEMA_PROFIL.parse(PROFIL_MINIMAL);
    // ⚠ `null` ET NON `undefined` : le contrat « maj_ » enregistre le
    // formulaire ENTIER, et un argument absent serait envoyé comme absent —
    // donc la valeur par défaut de la fonction, donc NULL de toute façon. On
    // rend le null explicite pour que la charge journalisée soit lisible.
    expect(r.emailPersonnel).toBeNull();
    expect(r.telephone).toBeNull();
    expect(r.cvUrl).toBeNull();
    expect(r.portfolioUrl).toBeNull();
  });

  /**
   * ⚠ 51 FICHES ACTIVES SANS PRÉNOM, 56 SANS NOM. Le refus est délibéré (D-14 :
   * c'est sous ce nom que le cabinet présente quelqu'un) et il va bloquer ces
   * gens — la différence avec D-17, c'est que le champ fautif est sous leurs
   * yeux dans le premier bloc de l'écran.
   */
  it('refuse un prénom vide, et le message nomme le champ fautif', () => {
    const r = SCHEMA_PROFIL.safeParse({ ...PROFIL_MINIMAL, prenom: '   ' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path[0]).toBe('prenom');
      // Le message ne justifie plus la règle — l'interface ne se commente pas.
      // Ce qu'on exige de lui : nommer le champ, pour que la personne sache
      // lequel corriger sans relire le formulaire.
      expect(r.error.issues[0].message).toContain('prénom');
    }
  });

  it('refuse un nom vide', () => {
    expect(SCHEMA_PROFIL.safeParse({ ...PROFIL_MINIMAL, nom: '' }).success).toBe(false);
  });

  /**
   * ⚠ LE CONTRÔLE QUI PROTÈGE 3 926 PERSONNES.
   * Mesuré : `cv_url` est renseigné 3 926 fois, dont **3 926 en `//hôte/…`** et
   * ZÉRO en `http(s)://`. Un `^https?://` — le défaut réparé pour l'entreprise
   * par la migration `20260912109000` (D-17) — aurait empêché 100 % des talents
   * porteurs d'un CV d'enregistrer leur fiche.
   */
  it('accepte les quatre formes d’URL que la base accepte', () => {
    for (const url of [
      '//s3.amazonaws.com/appforest_uf/f1667x18/CV.pdf',
      'https://exemple.test/cv.pdf',
      'http://exemple.test/cv.pdf',
      '/documents-talent/abc/cv/1757-cv.pdf',
    ]) {
      const r = SCHEMA_PROFIL.safeParse({ ...PROFIL_MINIMAL, cvUrl: url });
      expect(r.success, url).toBe(true);
    }
  });

  it('refuse une adresse de document qui n’est pas une adresse', () => {
    for (const url of ['exemple.test/cv.pdf', 'mon cv.pdf', 'javascript:alert(1)']) {
      expect(SCHEMA_PROFIL.safeParse({ ...PROFIL_MINIMAL, cvUrl: url }).success, url).toBe(false);
    }
  });

  /**
   * ⚠ AUCUNE RÈGLE DE FORME SUR LE PORTFOLIO, ET C'EST MESURÉ.
   * 24 des 737 valeurs sont de la prose. Lui imposer une URL, ce serait écrire
   * une règle contre la donnée — et effacer 24 phrases qui ont un sens pour
   * ceux qui les ont écrites.
   */
  it('accepte de la prose dans le portfolio', () => {
    for (const valeur of [
      'à présenter en visio (trop de NDA signés)',
      'https://drive.exemple.test/x (mdp: motherloade)',
      'exemple.test et exemple2.test',
    ]) {
      const r = SCHEMA_PROFIL.safeParse({ ...PROFIL_MINIMAL, portfolioUrl: valeur });
      expect(r.success, valeur).toBe(true);
    }
  });

  /**
   * Mesuré : 34 `url_linkedin` sont inutilisables — « ok », « t », « test »,
   * trois prénoms. Le refus est délibéré : un lien qui ne mène nulle part sur
   * une fiche transmise à un client est pire que son absence.
   */
  it('refuse un LinkedIn qui n’est pas une adresse, accepte un domaine nu', () => {
    for (const mauvais of ['ok', 't', 'test', 'Camille']) {
      expect(
        SCHEMA_PROFIL.safeParse({ ...PROFIL_MINIMAL, urlLinkedin: mauvais }).success,
        mauvais,
      ).toBe(false);
    }
    expect(
      SCHEMA_PROFIL.safeParse({ ...PROFIL_MINIMAL, urlLinkedin: 'linkedin.com/in/camille' })
        .success,
    ).toBe(true);
  });

  it('refuse une adresse électronique qui n’en est pas une', () => {
    expect(
      SCHEMA_PROFIL.safeParse({ ...PROFIL_MINIMAL, emailPersonnel: 'camille' }).success,
    ).toBe(false);
  });

  it('un formulaire envoyé SANS ses champs facultatifs passe', () => {
    // Le piège de zod v4 documenté dans `entreprise/saisie.ts` : une union qui
    // contient `z.undefined()` n'est pas un schéma optionnel, et la clé
    // MANQUANTE échouait là où la valeur `undefined` passait. On éprouve la clé
    // manquante, pas la valeur.
    expect(SCHEMA_PROFIL.safeParse(PROFIL_MINIMAL).success).toBe(true);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Mes attentes
   ══════════════════════════════════════════════════════════════════════════ */

describe('SCHEMA_ATTENTES', () => {
  const base = { nonce: NONCE };

  it('un formulaire vide est valide : tout est facultatif', () => {
    const r = SCHEMA_ATTENTES.parse(base);
    expect(r.metierCode).toBeNull();
    expect(r.salaireMinKe).toBeNull();
    // ⚠ `recherche_active` RESTE NULL quand elle n'est pas transmise. La
    // colonne est nulle sur les 7 023 fiches : la replier sur `false`
    // déclarerait « je ne cherche pas » à la place de tout le monde.
    expect(r.rechercheActive).toBeNull();
  });

  it('accepte true ET false pour la recherche active, et les distingue de null', () => {
    expect(SCHEMA_ATTENTES.parse({ ...base, rechercheActive: true }).rechercheActive).toBe(true);
    expect(SCHEMA_ATTENTES.parse({ ...base, rechercheActive: false }).rechercheActive).toBe(false);
  });

  it('la virgule décimale française est acceptée', () => {
    expect(SCHEMA_ATTENTES.parse({ ...base, salaireMinKe: '62,5' }).salaireMinKe).toBe(62.5);
  });

  /**
   * D-18 : une saisie illisible est REFUSÉE, jamais effacée. Rendre `null` ici
   * faisait disparaître la valeur quand on tapait « douze » — une perte de
   * donnée sans message, le pire mode d'échec d'un formulaire.
   */
  it('une saisie non numérique est refusée, pas effacée', () => {
    const r = SCHEMA_ATTENTES.safeParse({ ...base, salaireMinKe: 'soixante-cinq' });
    expect(r.success).toBe(false);
  });

  it('un salaire en euros au lieu de milliers est refusé, avec le bon message', () => {
    const r = SCHEMA_ATTENTES.safeParse({ ...base, salaireMinKe: 65000 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toContain('MILLIERS');
  });

  it('un minimum au-dessus du maximum est refusé, sur le champ du maximum', () => {
    // 21 fiches actives portent `attentes_salaire_min_ke > max` : ces personnes
    // devront corriger, et le message doit désigner le champ à corriger.
    const r = SCHEMA_ATTENTES.safeParse({ ...base, salaireMinKe: 80, salaireMaxKe: 65 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path[0]).toBe('salaireMaxKe');
  });

  it('un TJM hors bornes est refusé', () => {
    expect(SCHEMA_ATTENTES.safeParse({ ...base, tjmMinEur: 20000 }).success).toBe(false);
    expect(SCHEMA_ATTENTES.safeParse({ ...base, tjmMinEur: 500 }).success).toBe(true);
  });

  it('une borne seule est acceptée : min sans max, et l’inverse', () => {
    expect(SCHEMA_ATTENTES.safeParse({ ...base, salaireMinKe: 65 }).success).toBe(true);
    expect(SCHEMA_ATTENTES.safeParse({ ...base, salaireMaxKe: 75 }).success).toBe(true);
  });

  it('zéro est une valeur, pas une absence', () => {
    expect(SCHEMA_ATTENTES.parse({ ...base, salaireMinKe: 0 }).salaireMinKe).toBe(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Mes listes
   ══════════════════════════════════════════════════════════════════════════ */

describe('SCHEMA_LISTE', () => {
  it('les six types sont ceux que la fonction accepte, et fiche_talent_tag n’en est pas', () => {
    expect([...TYPES_LISTE]).toEqual([
      'secteur_vise',
      'secteur_nogo',
      'critere',
      'contrat',
      'remote',
      'expertise',
    ]);
    expect(TYPES_LISTE as readonly string[]).not.toContain('tag');
  });

  it('un type inconnu est refusé', () => {
    expect(SCHEMA_LISTE.safeParse({ type: 'tag', codes: [], nonce: NONCE }).success).toBe(false);
  });

  /** Un tableau vide est la façon de VIDER une liste : pas de `min(1)`. */
  it('un tableau vide est valide', () => {
    expect(SCHEMA_LISTE.parse({ type: 'critere', codes: [], nonce: NONCE }).codes).toEqual([]);
  });

  it('dédoublonne les codes', () => {
    const r = SCHEMA_LISTE.parse({ type: 'contrat', codes: ['cdi', 'cdi', 'freelance'], nonce: NONCE });
    expect(r.codes).toEqual(['cdi', 'freelance']);
  });

  it('refuse au-delà de cinquante codes — le plafond de la fonction', () => {
    const codes = Array.from({ length: 51 }, (_, i) => `c${i}`);
    expect(SCHEMA_LISTE.safeParse({ type: 'expertise', codes, nonce: NONCE }).success).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Postuler, se retirer
   ══════════════════════════════════════════════════════════════════════════ */

describe('SCHEMA_POSTULER et SCHEMA_RETRAIT', () => {
  const MANDAT = '56825764-b94a-5345-890c-be80d3cabb1c';

  it('un identifiant de mandat malformé est refusé avant le réseau', () => {
    expect(SCHEMA_POSTULER.safeParse({ mandatId: 'abc', nonce: NONCE }).success).toBe(false);
    expect(SCHEMA_POSTULER.safeParse({ mandatId: MANDAT, nonce: NONCE }).success).toBe(true);
  });

  it('un message vide devient null, un message trop long est refusé', () => {
    expect(SCHEMA_POSTULER.parse({ mandatId: MANDAT, message: '  ', nonce: NONCE }).message).toBeNull();
    expect(
      SCHEMA_POSTULER.safeParse({ mandatId: MANDAT, message: 'x'.repeat(5001), nonce: NONCE })
        .success,
    ).toBe(false);
  });

  /**
   * ⚠ `api.retirer_ma_candidature` LÈVE 23514 SANS MOTIF. L'écran doit le
   * demander, et le schéma doit le refuser avant l'aller-retour.
   */
  it('un retrait sans motif est refusé, avec un message pour la personne', () => {
    const r = SCHEMA_RETRAIT.safeParse({ candidatureId: MANDAT, motifCode: '', nonce: NONCE });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toContain('obligatoire');
  });

  it('un retrait avec motif passe, le commentaire reste facultatif', () => {
    const r = SCHEMA_RETRAIT.parse({
      candidatureId: MANDAT,
      motifCode: 'candidat_contre_offre',
      nonce: NONCE,
    });
    expect(r.motifCode).toBe('candidat_contre_offre');
    expect(r.commentaire).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Consentement et suppression
   ══════════════════════════════════════════════════════════════════════════ */

describe('SCHEMA_CONSENTEMENT et SCHEMA_SUPPRESSION', () => {
  it('le consentement exige un booléen explicite', () => {
    expect(SCHEMA_CONSENTEMENT.safeParse({ nonce: NONCE }).success).toBe(false);
    expect(SCHEMA_CONSENTEMENT.parse({ donne: true, nonce: NONCE }).donne).toBe(true);
    expect(SCHEMA_CONSENTEMENT.parse({ donne: false, nonce: NONCE }).donne).toBe(false);
  });

  /**
   * ⚠ LA CONFIRMATION EST DANS LA CHARGE, PAS SEULEMENT DANS LE DIALOGUE.
   * Une Server Action est un point d'entrée POST : elle est appelable sans
   * passer par l'écran, et une demande de suppression déclenchée par accident
   * se répare mal.
   */
  it('une demande de suppression non confirmée est refusée', () => {
    expect(SCHEMA_SUPPRESSION.safeParse({ nonce: NONCE }).success).toBe(false);
    expect(SCHEMA_SUPPRESSION.safeParse({ confirme: false, nonce: NONCE }).success).toBe(false);
    expect(SCHEMA_SUPPRESSION.safeParse({ confirme: true, nonce: NONCE }).success).toBe(true);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Mon parcours
   ══════════════════════════════════════════════════════════════════════════ */

describe('SCHEMA_POSTE', () => {
  const base = { intitule: 'Product Manager', anneeDebut: 2019, nonce: NONCE };

  it('exige un intitulé, laisse l’employeur facultatif', () => {
    expect(SCHEMA_POSTE.safeParse({ ...base, intitule: '  ' }).success).toBe(false);
    expect(SCHEMA_POSTE.parse(base).employeur).toBeNull();
  });

  it('exige une année de début : une période sans début n’est pas une période', () => {
    expect(SCHEMA_POSTE.safeParse({ intitule: 'PM', nonce: NONCE }).success).toBe(false);
  });

  it('refuse une année qui n’est pas encore arrivée', () => {
    const trop = new Date().getUTCFullYear() + 5;
    expect(SCHEMA_POSTE.safeParse({ ...base, anneeDebut: trop }).success).toBe(false);
    // L'année prochaine est acceptée : on prend un poste avec quelques mois
    // d'avance, et l'interdire serait interdire un cas réel.
    expect(
      SCHEMA_POSTE.safeParse({ ...base, anneeDebut: new Date().getUTCFullYear() + 1 }).success,
    ).toBe(true);
  });

  /**
   * ⚠ « EN POSTE » ET UNE DATE DE FIN SONT EXCLUSIFS.
   * `FriseParcours` pose la question dans le bon sens mais n'empêche pas les
   * deux. Une période à la fois ouverte et fermée n'a pas de sens, et la base
   * enregistrerait la contradiction sans rien dire.
   */
  it('refuse « en poste » avec une année de fin', () => {
    const r = SCHEMA_POSTE.safeParse({ ...base, enCours: true, anneeFin: 2022 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toContain('pas les deux');
  });

  it('accepte « en poste » sans fin, et une fin sans « en poste »', () => {
    expect(SCHEMA_POSTE.safeParse({ ...base, enCours: true }).success).toBe(true);
    expect(SCHEMA_POSTE.safeParse({ ...base, anneeFin: 2022 }).success).toBe(true);
  });

  it('refuse une fin antérieure au début', () => {
    expect(SCHEMA_POSTE.safeParse({ ...base, anneeFin: 2017 }).success).toBe(false);
  });

  it('compare les mois quand l’année est la même', () => {
    expect(
      SCHEMA_POSTE.safeParse({ ...base, moisDebut: 6, anneeFin: 2019, moisFin: 3 }).success,
    ).toBe(false);
    expect(
      SCHEMA_POSTE.safeParse({ ...base, moisDebut: 3, anneeFin: 2019, moisFin: 6 }).success,
    ).toBe(true);
  });

  it('un mois de fin absent sur la même année est traité comme décembre', () => {
    // Sinon une période « mars 2019 → 2019 » serait refusée alors qu'elle est
    // simplement imprécise, ce qui est le régime normal d'une frise.
    expect(SCHEMA_POSTE.safeParse({ ...base, moisDebut: 3, anneeFin: 2019 }).success).toBe(true);
  });

  it('SCHEMA_MAJ_POSTE exige un identifiant valide en plus', () => {
    expect(SCHEMA_MAJ_POSTE.safeParse(base).success).toBe(false);
    expect(
      SCHEMA_MAJ_POSTE.safeParse({ ...base, posteId: '11111111-1111-4111-8111-111111111111' })
        .success,
    ).toBe(true);
  });

  it('les deux prédicats de période sont éprouvables seuls', () => {
    const p = { enCours: false, anneeDebut: 2019, anneeFin: null, moisDebut: null, moisFin: null };
    expect(periodeSansContradiction({ ...p, enCours: true, anneeFin: 2020 })).toBe(false);
    expect(periodeSansContradiction({ ...p, enCours: true })).toBe(true);
    expect(finApresDebut({ ...p, anneeFin: 2018 })).toBe(false);
    expect(finApresDebut({ ...p, anneeFin: 2020 })).toBe(true);
    expect(finApresDebut(p)).toBe(true);
  });
});
