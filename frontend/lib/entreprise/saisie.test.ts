import { describe, expect, it } from 'vitest';

import {
  cleIdempotence,
  SCHEMA_BRIEF,
  SCHEMA_CLOTURE,
  SCHEMA_COMMENTAIRE,
  SCHEMA_DECISION,
  SCHEMA_ENTREPRISE,
  SCHEMA_FACTURATION,
} from './saisie';

/**
 * CE QUE CES TESTS PROTÈGENT.
 *
 * La couche de saisie est mince, et c'est précisément pour ça qu'elle se casse
 * en silence : une chaîne vide qui part telle quelle EFFACE une colonne, un
 * salaire tapé en euros dans un champ en milliers passe un facteur mille au
 * cabinet, une clé d'idempotence mal composée fait échouer le second
 * enregistrement d'un formulaire. Rien de tout cela ne se voit à la relecture.
 */

const NONCE = 'abcdef01-2345-6789-abcd-ef0123456789';
const UUID = '56825764-b94a-5345-890c-be80d3cabb1c';

describe('cleIdempotence — le double-clic, mais pas la correction', () => {
  it('une même charge sous un même nonce donne la MÊME clé', () => {
    const a = cleIdempotence(NONCE, { p_sens: 'valide', p_commentaire: null });
    const b = cleIdempotence(NONCE, { p_sens: 'valide', p_commentaire: null });
    expect(a).toBe(b);
  });

  it('une charge modifiée donne une clé DIFFÉRENTE', () => {
    // C'est la condition pour qu'une correction s'enregistre :
    // `app.idempotence_rejeu` REFUSE une clé déjà posée avec une autre charge.
    const a = cleIdempotence(NONCE, { p_sens: 'valide' });
    const b = cleIdempotence(NONCE, { p_sens: 'refuse' });
    expect(a).not.toBe(b);
  });

  it('un nonce neuf donne une clé différente à charge égale', () => {
    // Ce qui permet de republier volontairement le même commentaire après une
    // navigation, sans que le rejeu l'avale.
    const a = cleIdempotence(NONCE, { x: 1 });
    const b = cleIdempotence('99999999-0000-0000-0000-000000000000', { x: 1 });
    expect(a).not.toBe(b);
  });

  it('nettoie un nonce hostile et reste borné', () => {
    const cle = cleIdempotence('../../;drop table--' + 'x'.repeat(200), { x: 1 });
    expect(cle).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(cle.length).toBeLessThanOrEqual(57); // 40 de nonce + tiret + 16 d'empreinte
  });

  it('un nonce entièrement illégal ne produit pas une clé vide', () => {
    expect(cleIdempotence('///', { x: 1 })).toMatch(/^sans-nonce-/);
  });
});

describe('SCHEMA_DECISION — le refus exige un motif, la validation l’interdit', () => {
  it('accepte une validation sèche', () => {
    const r = SCHEMA_DECISION.safeParse({ candidatureId: UUID, sens: 'valide', nonce: NONCE });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.motif).toBeNull();
  });

  it('refuse un refus sans motif', () => {
    const r = SCHEMA_DECISION.safeParse({ candidatureId: UUID, sens: 'refuse', nonce: NONCE });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['motif']);
  });

  it('refuse un motif posé sur autre chose qu’un refus', () => {
    const r = SCHEMA_DECISION.safeParse({
      candidatureId: UUID,
      sens: 'valide',
      motif: 'client_culture',
      nonce: NONCE,
    });
    expect(r.success).toBe(false);
  });

  it('refuse un sens inventé', () => {
    expect(
      SCHEMA_DECISION.safeParse({ candidatureId: UUID, sens: 'peut_etre', nonce: NONCE }).success,
    ).toBe(false);
  });

  it('refuse un identifiant qui n’est pas un uuid', () => {
    expect(
      SCHEMA_DECISION.safeParse({ candidatureId: 'abc', sens: 'valide', nonce: NONCE }).success,
    ).toBe(false);
  });
});

describe('SCHEMA_COMMENTAIRE — un commentaire vide n’est pas un commentaire', () => {
  it.each([['', 'vide'], ['   ', 'des espaces']])('refuse %s (%s)', (valeur) => {
    expect(
      SCHEMA_COMMENTAIRE.safeParse({ candidatureId: UUID, commentaire: valeur, nonce: NONCE })
        .success,
    ).toBe(false);
  });

  it('rogne les blancs de bord', () => {
    const r = SCHEMA_COMMENTAIRE.safeParse({
      candidatureId: UUID,
      commentaire: '  Bon profil.  ',
      nonce: NONCE,
    });
    expect(r.success && r.data.commentaire).toBe('Bon profil.');
  });

  it('refuse au-delà de 5 000 caractères, la borne de la fonction SQL', () => {
    expect(
      SCHEMA_COMMENTAIRE.safeParse({
        candidatureId: UUID,
        commentaire: 'x'.repeat(5001),
        nonce: NONCE,
      }).success,
    ).toBe(false);
  });
});

describe('SCHEMA_ENTREPRISE — les règles suivent la donnée réelle, pas l’idéal', () => {
  const base = { nonce: NONCE };

  it('une chaîne vide devient NULL, jamais une chaîne vide', () => {
    // Sinon on écrirait '' là où la colonne portait NULL, et le journal
    // compterait un changement à chaque enregistrement.
    const r = SCHEMA_ENTREPRISE.safeParse({ ...base, fondateur: '' });
    expect(r.success && r.data.fondateur).toBeNull();
  });

  it('accepte un domaine nu comme site web — 133 des 259 en base', () => {
    const r = SCHEMA_ENTREPRISE.safeParse({ ...base, siteWeb: 'kiliba.com' });
    expect(r.success).toBe(true);
  });

  it('refuse un « site web » sans point ou avec un espace', () => {
    expect(SCHEMA_ENTREPRISE.safeParse({ ...base, siteWeb: 'kiliba' }).success).toBe(false);
    expect(SCHEMA_ENTREPRISE.safeParse({ ...base, siteWeb: 'a b.com' }).success).toBe(false);
  });

  it('accepte un identifiant YouTube nu — les 47 valeurs remplies en base', () => {
    expect(SCHEMA_ENTREPRISE.safeParse({ ...base, videoUrl: 'wCPJ5VNpqzQ' }).success).toBe(true);
    expect(
      SCHEMA_ENTREPRISE.safeParse({ ...base, videoUrl: 'https://youtu.be/wCPJ5VNpqzQ' }).success,
    ).toBe(true);
  });

  it('accepte un logo protocole-relatif — 275 des 363 en base', () => {
    expect(
      SCHEMA_ENTREPRISE.safeParse({ ...base, logoUrl: '//cdn.bubble.io/f1/logo.png' }).success,
    ).toBe(true);
  });

  it('accepte un SIRET espacé et le recolle', () => {
    const r = SCHEMA_ENTREPRISE.safeParse({ ...base, siret: '123 456 789 01234' });
    expect(r.success && r.data.siret).toBe('12345678901234');
  });

  it('refuse un SIRET qui n’a pas 14 chiffres', () => {
    expect(SCHEMA_ENTREPRISE.safeParse({ ...base, siret: '1234' }).success).toBe(false);
  });

  it('lit un effectif saisi en texte, et rend null sur du vide', () => {
    const r = SCHEMA_ENTREPRISE.safeParse({ ...base, nbEmployes: '200', nbTechs: '' });
    expect(r.success && r.data.nbEmployes).toBe(200);
    expect(r.success && r.data.nbTechs).toBeNull();
  });
});

describe('SCHEMA_FACTURATION', () => {
  it('refuse une adresse électronique malformée', () => {
    expect(
      SCHEMA_FACTURATION.safeParse({ emailFacturation: 'pas-une-adresse', nonce: NONCE }).success,
    ).toBe(false);
  });

  it('accepte un formulaire entièrement vide — tout effacer est un geste légitime', () => {
    const r = SCHEMA_FACTURATION.safeParse({ nonce: NONCE });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ville).toBeNull();
  });
});

describe('SCHEMA_BRIEF — les bornes de app.controler_brief, redites côté écran', () => {
  const base = { titre: 'Senior Product Manager', nonce: NONCE };

  it('accepte un brief réduit à son intitulé', () => {
    expect(SCHEMA_BRIEF.safeParse(base).success).toBe(true);
  });

  it('refuse un intitulé trop court ou absent', () => {
    expect(SCHEMA_BRIEF.safeParse({ ...base, titre: 'PM' }).success).toBe(false);
    expect(SCHEMA_BRIEF.safeParse({ ...base, titre: '   ' }).success).toBe(false);
  });

  it('ARRÊTE un salaire saisi en euros dans un champ en milliers', () => {
    // Le défaut que la convention « unité dans le nom » existe pour empêcher :
    // une conversion €→K€ avait gelé la synchronisation 43 jours.
    const r = SCHEMA_BRIEF.safeParse({ ...base, salaireMinKe: '55000' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['salaireMinKe']);
  });

  it('refuse une fourchette à l’envers', () => {
    const r = SCHEMA_BRIEF.safeParse({ ...base, salaireMinKe: 80, salaireMaxKe: 60 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['salaireMaxKe']);
  });

  it('accepte une virgule décimale — c’est ce qu’on tape sur un clavier français', () => {
    const r = SCHEMA_BRIEF.safeParse({ ...base, salaireMinKe: '62,5' });
    expect(r.success && r.data.salaireMinKe).toBe(62.5);
  });

  it('refuse un TJM hors bornes', () => {
    expect(SCHEMA_BRIEF.safeParse({ ...base, tjmMaxEur: 99999 }).success).toBe(false);
  });

  it('refuse une expérience non entière ou hors bornes', () => {
    expect(SCHEMA_BRIEF.safeParse({ ...base, experienceMinAnnees: '3,5' }).success).toBe(false);
    expect(SCHEMA_BRIEF.safeParse({ ...base, experienceMinAnnees: 99 }).success).toBe(false);
    expect(SCHEMA_BRIEF.safeParse({ ...base, experienceMinAnnees: '0' }).success).toBe(true);
  });

  it('refuse un contrat hors des trois valeurs du CHECK SQL', () => {
    expect(SCHEMA_BRIEF.safeParse({ ...base, contrat: 'stage' }).success).toBe(false);
    expect(SCHEMA_BRIEF.safeParse({ ...base, contrat: 'entrepreneur' }).success).toBe(true);
  });

  it('une liste de critères vide devient NULL, pas un tableau vide', () => {
    // `[]` en jsonb se relit comme « une liste, vide » ; NULL comme « pas de
    // liste ». Ce n'est pas la même information pour le Chasseur.
    const r = SCHEMA_BRIEF.safeParse({ ...base, mustHave: [] });
    expect(r.success && r.data.mustHave).toBeNull();
  });

  it('garde une liste de critères renseignée', () => {
    const r = SCHEMA_BRIEF.safeParse({ ...base, mustHave: ['Go', 'PostgreSQL'] });
    expect(r.success && r.data.mustHave).toEqual(['Go', 'PostgreSQL']);
  });
});

describe('SCHEMA_CLOTURE — le motif est facultatif mais borné', () => {
  it('accepte une demande sans motif', () => {
    const r = SCHEMA_CLOTURE.safeParse({ mandatId: UUID, nonce: NONCE });
    expect(r.success && r.data.motif).toBeNull();
  });

  it('refuse un motif au-delà de 2 000 caractères', () => {
    expect(
      SCHEMA_CLOTURE.safeParse({ mandatId: UUID, motif: 'x'.repeat(2001), nonce: NONCE }).success,
    ).toBe(false);
  });
});
