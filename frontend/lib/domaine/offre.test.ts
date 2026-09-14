import { describe, expect, it } from 'vitest';
import {
  FILTRES_VIDES,
  filtrer,
  formaterSalaire,
  optionsDepuis,
  repartir,
  teinteUnivers,
  versOffre,
  type Offre,
} from './offre';

/**
 * Les six fonctions du domaine, sous filet.
 *
 * Ces tests ne décrivent pas ce que le code fait — ils décrivent les RÈGLES
 * qu'il doit tenir, celles qui sont annotées sur la maquette ou nées d'une
 * mesure. Un test qui se contenterait de recopier l'implémentation figerait
 * aussi bien ses défauts.
 */

const offre = (p: Partial<Offre> = {}): Offre => ({
  id: 'x', intitule: 'Poste', universCode: null, univers: null, metier: null,
  entreprise: null, contrat: null, contratLibelle: null, management: null,
  managementLibelle: null, exclusivitePachamama: false, salaireMinKe: null,
  salaireMaxKe: null, tjmMinEur: null, tjmMaxEur: null, salaireAffiche: null,
  localisation: null, remoteLibelle: null, publieLe: null, ...p,
});

describe('versOffre — la projection depuis api.offre_publique', () => {
  it('ne perd rien quand la ligne est complète', () => {
    const o = versOffre({
      id: 'abc', intitule: 'Lead PM', univers_code: 'product', univers: 'Product',
      metier: 'Product Manager', entreprise: 'Acme', contrat: 'cdi',
      contrat_libelle: 'CDI', management: 'oui', management_libelle: 'Manager',
      exclusivite_pachamama: true, salaire_min_ke: 50, salaire_max_ke: 55,
      tjm_min_eur: null, tjm_max_eur: null, salaire_affiche: null,
      localisation: 'Paris', remote_libelle: 'Hybride', publie_le: '2026-09-01',
    });
    expect(o).toEqual(offre({
      id: 'abc', intitule: 'Lead PM', universCode: 'product', univers: 'Product',
      metier: 'Product Manager', entreprise: 'Acme', contrat: 'cdi',
      contratLibelle: 'CDI', management: 'oui', managementLibelle: 'Manager',
      exclusivitePachamama: true, salaireMinKe: 50, salaireMaxKe: 55,
      localisation: 'Paris', remoteLibelle: 'Hybride', publieLe: '2026-09-01',
    }));
  });

  it('distingue le vide de zéro — 0 K€ est une donnée, pas une absence', () => {
    expect(versOffre({ id: '1', salaire_min_ke: 0 }).salaireMinKe).toBe(0);
    expect(versOffre({ id: '1' }).salaireMinKe).toBeNull();
    expect(versOffre({ id: '1', salaire_min_ke: null }).salaireMinKe).toBeNull();
  });

  it("remplace un intitulé absent plutôt que d'afficher « null »", () => {
    expect(versOffre({ id: '1' }).intitule).toBe('Poste à pourvoir');
    expect(versOffre({ id: '1', intitule: '' }).intitule).toBe('');
  });
});

describe('formaterSalaire — deux unités qui ne se mélangent jamais', () => {
  it('laisse la main au libellé déjà rédigé en base', () => {
    expect(formaterSalaire(offre({ salaireAffiche: '50 K fixe + variable', salaireMinKe: 60 })))
      .toBe('50 K fixe + variable');
  });

  it('rend une plage en K€, et une seule valeur quand les bornes sont égales', () => {
    expect(formaterSalaire(offre({ salaireMinKe: 50, salaireMaxKe: 55 }))).toBe('50-55 K');
    expect(formaterSalaire(offre({ salaireMinKe: 50, salaireMaxKe: 50 }))).toBe('50 K');
    expect(formaterSalaire(offre({ salaireMinKe: 50 }))).toBe('50 K');
    expect(formaterSalaire(offre({ salaireMaxKe: 55 }))).toBe('55 K');
  });

  it('rend le TJM en euros par jour', () => {
    expect(formaterSalaire(offre({ tjmMinEur: 900, tjmMaxEur: 1000 }))).toBe('900-1000 €/j');
  });

  it('fait primer le K€ sur le TJM quand les deux sont renseignés', () => {
    expect(formaterSalaire(offre({ salaireMinKe: 50, tjmMinEur: 900 }))).toBe('50 K');
  });

  it("ne rend rien plutôt qu'un libellé vide quand aucune borne n'existe", () => {
    expect(formaterSalaire(offre())).toBeUndefined();
  });

  it('coupe les décimales à une seule et retire le zéro inutile', () => {
    expect(formaterSalaire(offre({ salaireMinKe: 47.5 }))).toBe('47.5 K');
    expect(formaterSalaire(offre({ salaireMinKe: 47.04 }))).toBe('47 K');
  });
});

describe('teinteUnivers — huit univers, quatre teintes', () => {
  it('range chaque univers coloré sous sa verticale', () => {
    expect(teinteUnivers('product')).toBe('product');
    expect(teinteUnivers('tech')).toBe('tech');
    expect(teinteUnivers('sales')).toBe('sales');
  });

  it("n'est PAS injective, et c'est assumé — data et design prennent la teinte tech", () => {
    // Collision connue : la couleur est décorative, le libellé porte le sens.
    // Ce test fige l'état des lieux, il ne le recommande pas. Le jour où un
    // mandat data sera publié, deux tags « Tech » coexisteront à l'écran.
    expect(teinteUnivers('data')).toBe('tech');
    expect(teinteUnivers('design')).toBe('tech');
  });

  it('donne la teinte la plus neutre à tout le reste, y compris à l’inconnu', () => {
    expect(teinteUnivers('marketing')).toBe('people');
    expect(teinteUnivers('un-univers-inedit')).toBe('people');
    expect(teinteUnivers(null)).toBe('people');
  });
});

describe('filtrer — un axe vide ne filtre rien', () => {
  const lot = [
    offre({ id: 'a', universCode: 'tech', contrat: 'cdi', management: 'oui' }),
    offre({ id: 'b', universCode: 'product', contrat: 'freelance', management: 'non' }),
    offre({ id: 'c', universCode: null, contrat: 'cdi', management: null }),
  ];

  it('rend tout le lot quand aucun critère n’est coché', () => {
    expect(filtrer(lot, FILTRES_VIDES).map((o) => o.id)).toEqual(['a', 'b', 'c']);
  });

  it('écarte les offres dont la valeur est nulle sur un axe ACTIF', () => {
    // Une offre sans univers ne peut pas « appartenir » à l'univers coché.
    expect(filtrer(lot, { ...FILTRES_VIDES, univers: ['tech'] }).map((o) => o.id)).toEqual(['a']);
  });

  it('mais garde ces mêmes offres tant que l’axe reste vide', () => {
    expect(filtrer(lot, { ...FILTRES_VIDES, contrat: ['cdi'] }).map((o) => o.id)).toEqual(['a', 'c']);
  });

  it('combine les axes en ET, et les valeurs d’un même axe en OU', () => {
    expect(filtrer(lot, { univers: ['tech', 'product'], contrat: ['cdi'], management: [] })
      .map((o) => o.id)).toEqual(['a']);
  });

  it('ne modifie pas le tableau reçu', () => {
    const avant = [...lot];
    filtrer(lot, { ...FILTRES_VIDES, contrat: ['cdi'] });
    expect(lot).toEqual(avant);
  });
});

describe('repartir — les trois plus récentes, puis le reste', () => {
  const lot = [
    offre({ id: 'vieille', publieLe: '2026-01-01' }),
    offre({ id: 'recente', publieLe: '2026-09-01' }),
    offre({ id: 'moyenne', publieLe: '2026-05-01' }),
    offre({ id: 'ancienne', publieLe: '2026-03-01' }),
    offre({ id: 'toute-fraiche', publieLe: '2026-09-08' }),
  ];

  it('trie du plus récent au plus ancien et coupe à trois', () => {
    const { nouveaux, autres } = repartir(lot);
    expect(nouveaux.map((o) => o.id)).toEqual(['toute-fraiche', 'recente', 'moyenne']);
    expect(autres.map((o) => o.id)).toEqual(['ancienne', 'vieille']);
  });

  it('ne perd aucune offre : nouveaux + autres = le lot entier', () => {
    for (const n of [0, 1, 2, 3, 5]) {
      const { nouveaux, autres } = repartir(lot.slice(0, n));
      expect(nouveaux.length + autres.length).toBe(n);
    }
  });

  it('relègue en queue les offres sans date, sans jamais les faire disparaître', () => {
    const { nouveaux, autres } = repartir([offre({ id: 'sansDate' }), ...lot.slice(0, 3)]);
    expect([...nouveaux, ...autres].map((o) => o.id)).toContain('sansDate');
    expect([...nouveaux, ...autres].at(-1)!.id).toBe('sansDate');
  });

  it('ne modifie pas le tableau reçu', () => {
    const avant = lot.map((o) => o.id);
    repartir(lot);
    expect(lot.map((o) => o.id)).toEqual(avant);
  });
});

describe('optionsDepuis — les options viennent des offres publiées', () => {
  const lot = [
    offre({ universCode: 'tech', univers: 'Tech' }),
    offre({ universCode: 'product', univers: 'Product' }),
    offre({ universCode: 'tech', univers: 'Tech (doublon)' }),
    offre({ universCode: null, univers: 'Sans code' }),
  ];
  const opts = optionsDepuis(lot, (o) => o.universCode, (o) => o.univers);

  it('ne propose que ce qui existe réellement, sans doublon', () => {
    expect(opts.map((o) => o.valeur)).toEqual(['product', 'tech']);
  });

  it('retient le PREMIER libellé rencontré pour un code donné', () => {
    expect(opts.find((o) => o.valeur === 'tech')!.libelle).toBe('Tech');
  });

  it('ignore les offres sans code — elles ne sont pas filtrables', () => {
    expect(opts).toHaveLength(2);
  });

  it('trie par libellé en locale française', () => {
    const accentues = [
      offre({ universCode: 'z', univers: 'Zèbre' }),
      offre({ universCode: 'e', univers: 'Éditeur' }),
      offre({ universCode: 'a', univers: 'Analyste' }),
    ];
    expect(optionsDepuis(accentues, (o) => o.universCode, (o) => o.univers).map((o) => o.libelle))
      .toEqual(['Analyste', 'Éditeur', 'Zèbre']);
  });

  it('se rabat sur le code quand le libellé manque', () => {
    expect(optionsDepuis([offre({ universCode: 'tech' })], (o) => o.universCode, (o) => o.univers)[0])
      .toEqual({ valeur: 'tech', libelle: 'tech' });
  });
});
