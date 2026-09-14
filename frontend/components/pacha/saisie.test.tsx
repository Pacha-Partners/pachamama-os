/**
 * @vitest-environment jsdom
 *
 * Les huit primitives de saisie, vérifiées là où elles peuvent casser en
 * SILENCE.
 *
 * Ce fichier ne teste pas des couleurs ni des marges : il teste les cinq
 * endroits où une erreur de câblage ne se verrait ni à la compilation, ni au
 * `next build`, ni à l'œil sur la vitrine :
 *
 * 1. les attributs d'état de Base UI (`data-open`, `data-indeterminate`,
 *    `aria-valuenow`, `aria-expanded`) — un nom d'attribut faux produit un
 *    composant qui s'affiche bien et ne réagit jamais ;
 * 2. l'analyse de « 62,5 » par `ChampNombre` — la raison d'être du composant ;
 * 3. le nom accessible qui porte l'unité — invisible par construction ;
 * 4. la garde de `Televersement`, qui doit REFUSER sans appeler `onFichier` ;
 * 5. le tri de `FriseParcours`, qui est une promesse écrite dans son en-tête.
 *
 * `/** @vitest-environment jsdom *\/` en tête de fichier plutôt qu'un
 * changement de `vitest.config.ts` : la configuration du projet est en
 * `environment: 'node'` pour les tests de domaine, et rien ici ne justifie de
 * la basculer pour tout le monde.
 */

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Accordeon, SectionAccordeon } from './Accordeon';
import { ChampFourchette } from './ChampFourchette';
import { ChampNombre } from './ChampNombre';
import { Combobox } from './Combobox';
import { Etapes } from './Etapes';
import { FriseParcours, formaterPeriode, type EntreeParcours } from './FriseParcours';
import { Jauge } from './Jauge';
import { Televersement, formaterOctets, verifierFichier } from './Televersement';

afterEach(cleanup);

/* ── Jauge ─────────────────────────────────────────────────────────────────── */

describe('Jauge', () => {
  it('expose la valeur en ARIA et l’écrit en clair', () => {
    render(<Jauge valeur={62} libelle="Complétude" />);
    const barre = screen.getByRole('progressbar');
    expect(barre).toHaveAttribute('aria-valuenow', '62');
    expect(barre).toHaveAttribute('aria-valuemax', '100');
    // Le chiffre visible, celui sans lequel une barre n'est qu'une longueur.
    expect(screen.getByText('62 %')).toBeInTheDocument();
    // Et la version dite, qui est une phrase.
    expect(barre).toHaveAttribute('aria-valuetext', '62 pour cent');
  });

  it('borne une valeur hors limites au lieu de déborder', () => {
    render(<Jauge valeur={140} libelle="Complétude" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('écrit une fraction et remplit le bon nombre de segments', () => {
    const { container } = render(
      <Jauge valeur={4} max={7} segments={7} chiffre="fraction" libelle="Étapes" />,
    );
    expect(screen.getByText('4 / 7')).toBeInTheDocument();
    // Sept blocs, dont quatre pleins : c'est un dénombrement, pas 57 %.
    const blocs = container.querySelectorAll(
      '[role="progressbar"] > div:nth-of-type(2) > span',
    );
    expect(blocs).toHaveLength(7);
    expect(Array.from(blocs).filter((b) => b.className.includes('bg-black'))).toHaveLength(4);
  });

  it('distingue l’indéterminé du zéro', () => {
    render(<Jauge valeur={null} libelle="Envoi" />);
    const barre = screen.getByRole('progressbar');
    // Base UI retire `aria-valuenow` : « on ne sait pas » n'est pas « zéro ».
    expect(barre).not.toHaveAttribute('aria-valuenow');
    expect(barre).toHaveAttribute('data-indeterminate');
    expect(screen.getByText('en cours…')).toBeInTheDocument();
  });
});

/* ── Etapes ────────────────────────────────────────────────────────────────── */

describe('Etapes', () => {
  const ETAPES = [
    { cle: 'a', libelle: 'Le poste' },
    { cle: 'b', libelle: 'Le cadre' },
    { cle: 'c', libelle: 'Relecture' },
  ];

  it('marque l’étape en cours et verrouille les suivantes', () => {
    render(<Etapes libelle="Ouvrir un poste" etapes={ETAPES} courante={1} onAller={() => {}} />);

    const boutons = screen.getAllByRole('button');
    expect(boutons[1]).toHaveAttribute('aria-current', 'step');
    expect(boutons[0]).not.toBeDisabled();
    // On revient en arrière librement, on n'avance pas sans avoir rempli.
    expect(boutons[2]).toBeDisabled();
  });

  it('annonce la position et l’état en toutes lettres', () => {
    render(<Etapes libelle="Ouvrir un poste" etapes={ETAPES} courante={1} onAller={() => {}} />);
    const boutons = screen.getAllByRole('button');
    expect(boutons[0]).toHaveAccessibleName('Étape 1 sur 3 : Le poste — franchie');
    expect(boutons[1]).toHaveAccessibleName('Étape 2 sur 3 : Le cadre — en cours');
    expect(boutons[2]).toHaveAccessibleName(
      'Étape 3 sur 3 : Relecture — à venir, pas encore accessible',
    );
  });

  it('écrit l’erreur au lieu de la seule peindre', () => {
    render(
      <Etapes
        libelle="Ouvrir un poste"
        etapes={[{ ...ETAPES[0], erreur: true }, ETAPES[1], ETAPES[2]]}
        courante={1}
        onAller={() => {}}
      />,
    );
    expect(screen.getAllByRole('button')[0]).toHaveAccessibleName(/à corriger$/);
  });

  it('sans `onAller`, ne pose plus rien de focalisable', () => {
    render(<Etapes libelle="Où en est votre candidature" etapes={ETAPES} courante={1} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

/* ── Accordeon ─────────────────────────────────────────────────────────────── */

describe('Accordeon', () => {
  it('lie l’en-tête au panneau et bascule au clic', () => {
    render(
      <Accordeon valeurParDefaut={['b']}>
        <SectionAccordeon valeur="a" titre="Identité" resume="Complet">
          <p>contenu a</p>
        </SectionAccordeon>
        <SectionAccordeon valeur="b" titre="Attentes">
          <p>contenu b</p>
        </SectionAccordeon>
      </Accordeon>,
    );

    const identite = screen.getByRole('button', { name: /Identité/ });
    const attentes = screen.getByRole('button', { name: /Attentes/ });
    expect(identite).toHaveAttribute('aria-expanded', 'false');
    expect(attentes).toHaveAttribute('aria-expanded', 'true');

    // Multiple par défaut : ouvrir la première ne referme pas la seconde.
    fireEvent.click(identite);
    expect(identite).toHaveAttribute('aria-expanded', 'true');
    expect(attentes).toHaveAttribute('aria-expanded', 'true');
  });

  it('rend l’en-tête au niveau de titre demandé', () => {
    render(
      <Accordeon>
        <SectionAccordeon valeur="a" titre="Identité" niveauTitre={2}>
          <p>x</p>
        </SectionAccordeon>
      </Accordeon>,
    );
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });
});

/* ── ChampNombre ───────────────────────────────────────────────────────────── */

describe('ChampNombre', () => {
  it('accepte la virgule décimale française', () => {
    const onChangement = vi.fn();
    render(
      <ChampNombre
        libelle="Part variable"
        unite="%"
        decimales={1}
        onChangement={onChangement}
        valeur={null}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '62,5' } });
    expect(onChangement).toHaveBeenCalledWith(62.5);
  });

  it('accepte aussi le point, pour le pavé numérique', () => {
    const onChangement = vi.fn();
    render(
      <ChampNombre libelle="Part variable" decimales={1} onChangement={onChangement} valeur={null} />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '62.5' } });
    expect(onChangement).toHaveBeenCalledWith(62.5);
  });

  it('fait entrer l’unité dans le nom accessible sans la répéter à l’écran', () => {
    render(<ChampNombre libelle="Salaire minimum" unite="K€" valeur={55} />);
    expect(screen.getByRole('textbox')).toHaveAccessibleName('Salaire minimum en K€');
    // L'étiquette visible, elle, reste courte.
    expect(screen.getByText('Salaire minimum')).toBeInTheDocument();
  });

  it('ne borne pas la saisie en silence', () => {
    const onChangement = vi.fn();
    render(
      <ChampNombre libelle="Salaire" max={100} onChangement={onChangement} valeur={null} />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '250' } });
    // 250, pas 100 : une faute de frappe ne devient pas une donnée plausible.
    expect(onChangement).toHaveBeenCalledWith(250);
  });
});

/* ── ChampFourchette ───────────────────────────────────────────────────────── */

describe('ChampFourchette', () => {
  it('signale le croisement sur les DEUX champs, avec un seul message', () => {
    render(
      <ChampFourchette
        libelle="Rémunération"
        unite="K€"
        valeurs={{ min: 80, max: 45 }}
        onChangement={() => {}}
      />,
    );

    const messages = screen.getAllByText(/ne peut pas être inférieur au minimum/);
    // Écrit UNE fois, sous la paire.
    expect(messages).toHaveLength(1);

    const champs = screen.getAllByRole('textbox');
    expect(champs).toHaveLength(2);
    for (const champ of champs) {
      expect(champ).toHaveAttribute('aria-invalid', 'true');
      // Et les deux pointent vers ce même message.
      expect(champ.getAttribute('aria-describedby')).toContain(messages[0].id);
    }
  });

  it('n’invente pas d’incohérence sur une borne absente', () => {
    render(
      <ChampFourchette
        libelle="Rémunération"
        unite="K€"
        valeurs={{ min: 45, max: null }}
        onChangement={() => {}}
      />,
    );
    expect(screen.queryByText(/ne peut pas être inférieur/)).not.toBeInTheDocument();
  });

  it('traite zéro comme une vraie valeur, pas comme un vide', () => {
    render(
      <ChampFourchette
        libelle="Rémunération"
        valeurs={{ min: 10, max: 0 }}
        onChangement={() => {}}
      />,
    );
    // max=0 < min=10 : c'est bien un croisement, et non « pas renseigné ».
    expect(screen.getByText(/ne peut pas être inférieur au minimum/)).toBeInTheDocument();
  });

  it('n’inverse jamais les bornes', () => {
    const onChangement = vi.fn();
    render(
      <ChampFourchette
        libelle="Rémunération"
        valeurs={{ min: 80, max: 45 }}
        onChangement={onChangement}
      />,
    );
    // Le composant a signalé ; il n'a rien réécrit dans le dos de l'appelant.
    expect(onChangement).not.toHaveBeenCalled();
  });
});

/* ── Combobox ──────────────────────────────────────────────────────────────── */

describe('Combobox', () => {
  const OPTIONS = [
    { valeur: 'pm', libelle: 'Product Manager' },
    { valeur: 'pmm', libelle: 'Product Marketing Manager' },
    { valeur: 'ing', libelle: 'Ingénieur DevOps' },
  ];

  /**
   * Base UI ouvre le panneau sur le POINTEUR, pas sur `click` seul : mesuré,
   * un `fireEvent.click` isolé laisse `aria-expanded` à `false`. Une vraie
   * souris envoie les trois événements ; on fait pareil.
   */
  const ouvrir = (champ: HTMLElement) => {
    fireEvent.pointerDown(champ);
    fireEvent.mouseDown(champ);
    fireEvent.click(champ);
  };

  it('filtre sur le libellé et ignore les accents', () => {
    render(<Combobox libelle="Métier" options={OPTIONS} onChangement={() => {}} />);
    const champ = screen.getByRole('combobox');
    ouvrir(champ);
    fireEvent.change(champ, { target: { value: 'ingenieur' } });
    // « ingenieur » trouve « Ingénieur » : le filtre passe par Intl.Collator.
    expect(screen.getByRole('option', { name: /Ingénieur DevOps/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Product Manager/ })).not.toBeInTheDocument();
  });

  it('rend la valeur choisie, une seule', () => {
    const onChangement = vi.fn();
    render(<Combobox libelle="Métier" options={OPTIONS} onChangement={onChangement} />);
    const champ = screen.getByRole('combobox');
    ouvrir(champ);
    fireEvent.click(screen.getByRole('option', { name: 'Product Manager' }));
    expect(onChangement).toHaveBeenCalledWith('pm');
  });

  it('affiche le libellé de la valeur, jamais le code technique', () => {
    render(<Combobox libelle="Métier" options={OPTIONS} valeur="pmm" />);
    expect(screen.getByRole('combobox')).toHaveValue('Product Marketing Manager');
  });
});

/* ── Televersement ─────────────────────────────────────────────────────────── */

describe('Televersement', () => {
  it('monte un vrai `input[type=file]`, relié à son libellé', () => {
    const { container } = render(
      <Televersement libelle="Votre CV" typesAcceptes={['.pdf']} onFichier={() => {}} />,
    );
    const entree = container.querySelector('input[type="file"]');
    expect(entree).not.toBeNull();
    expect(entree).toHaveAccessibleName('Votre CV');
    expect(entree).toHaveAttribute('accept', '.pdf');
  });

  it('annonce la contrainte AVANT le choix, par `aria-describedby`', () => {
    const { container } = render(
      <Televersement
        libelle="Votre CV"
        typesAcceptes={['application/pdf']}
        tailleMaxOctets={5 * 1024 * 1024}
        onFichier={() => {}}
      />,
    );
    const entree = container.querySelector('input[type="file"]') as HTMLInputElement;
    const decrit = entree.getAttribute('aria-describedby') ?? '';
    const aide = document.getElementById(decrit.split(' ')[0]);
    expect(aide?.textContent).toBe('PDF · 5 Mo maximum');
  });

  it('refuse un fichier trop lourd SANS appeler onFichier', () => {
    const onFichier = vi.fn();
    const { container } = render(
      <Televersement libelle="Votre CV" tailleMaxOctets={1024} onFichier={onFichier} />,
    );
    const entree = container.querySelector('input[type="file"]') as HTMLInputElement;
    const gros = new File(['x'.repeat(4096)], 'cv.pdf', { type: 'application/pdf' });
    fireEvent.change(entree, { target: { files: [gros] } });

    expect(onFichier).not.toHaveBeenCalled();
    // Deux fois : la ligne visible sous le champ, et la région vivante qui
    // l'annonce. Deux moments d'énonciation distincts, aucun doublon audible.
    expect(screen.getAllByText(/le maximum est 1 Ko/)).toHaveLength(2);
  });

  it('refuse un format hors liste SANS appeler onFichier', () => {
    const onFichier = vi.fn();
    const { container } = render(
      <Televersement libelle="Votre CV" typesAcceptes={['.pdf']} onFichier={onFichier} />,
    );
    const entree = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(entree, {
      target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] },
    });
    expect(onFichier).not.toHaveBeenCalled();
    expect(screen.getAllByText('Ce format n’est pas accepté ici.')).toHaveLength(2);
  });

  it('accepte ce qui passe les deux gardes', () => {
    const onFichier = vi.fn();
    const { container } = render(
      <Televersement
        libelle="Votre CV"
        typesAcceptes={['.pdf']}
        tailleMaxOctets={1024 * 1024}
        onFichier={onFichier}
      />,
    );
    const entree = container.querySelector('input[type="file"]') as HTMLInputElement;
    const bon = new File(['x'], 'cv.pdf', { type: 'application/pdf' });
    fireEvent.change(entree, { target: { files: [bon] } });
    expect(onFichier).toHaveBeenCalledWith(bon);
  });

  it('formate les poids en unités françaises', () => {
    expect(formaterOctets(0)).toBe('0 o');
    expect(formaterOctets(1024)).toBe('1 Ko');
    expect(formaterOctets(1536)).toBe('1,5 Ko');
    expect(formaterOctets(5 * 1024 * 1024)).toBe('5 Mo');
  });

  it('reconnaît les trois formes d’acceptation', () => {
    const png = new File(['x'], 'photo.PNG', { type: 'image/png' });
    expect(verifierFichier(png, { typesAcceptes: ['image/*'] })).toBeNull();
    expect(verifierFichier(png, { typesAcceptes: ['.png'] })).toBeNull();
    expect(verifierFichier(png, { typesAcceptes: ['image/png'] })).toBeNull();
    expect(verifierFichier(png, { typesAcceptes: ['.pdf'] })).not.toBeNull();
    // Liste vide : c'est une liste d'autorisations, pas de refus.
    expect(verifierFichier(png, {})).toBeNull();
  });
});

/* ── FriseParcours ─────────────────────────────────────────────────────────── */

describe('FriseParcours', () => {
  const ENTREES: EntreeParcours[] = [
    { cle: 'vieux', intitule: 'Chargée de projet', employeur: 'Vertigo', anneeDebut: 2018, anneeFin: 2020 },
    { cle: 'encours', intitule: 'Senior PM', employeur: 'SantéVet', anneeDebut: 2023, moisDebut: 4, enPoste: true },
    { cle: 'milieu', intitule: 'PM', employeur: 'N2J', anneeDebut: 2020, anneeFin: 2023, moisFin: 3 },
  ];

  it('range de la plus récente à la plus ancienne, le poste en cours d’abord', () => {
    render(<FriseParcours entrees={ENTREES} onChangement={() => {}} lectureSeule />);
    const titres = screen.getAllByText(/Senior PM|^PM$|Chargée de projet/);
    expect(titres.map((t) => t.textContent)).toEqual([
      'Senior PM',
      'PM',
      'Chargée de projet',
    ]);
  });

  it('écrit la période sans inventer de précision', () => {
    expect(formaterPeriode(ENTREES[1])).toBe('avril 2023 – en poste');
    expect(formaterPeriode(ENTREES[2])).toBe('2020 – mars 2023');
    // Aucun mois des deux côtés : l'année seule, et pas un « 1er janvier ».
    expect(formaterPeriode(ENTREES[0])).toBe('2018 – 2020');
  });

  it('ne remonte rien tant que le brouillon n’est pas validé', () => {
    const onChangement = vi.fn();
    render(<FriseParcours entrees={[]} onChangement={onChangement} />);

    fireEvent.click(screen.getByRole('button', { name: /Ajouter une expérience/ }));
    fireEvent.change(screen.getByLabelText('Intitulé du poste'), {
      target: { value: 'Product Manager' },
    });
    // Le brouillon vit dans le composant : rien n'est parti.
    expect(onChangement).not.toHaveBeenCalled();

    // Et il refuse de valider tant que l'essentiel manque.
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer cette expérience/ }));
    expect(onChangement).not.toHaveBeenCalled();
    expect(screen.getByText('Indiquez l’employeur.')).toBeInTheDocument();
  });

  it('n’ouvre qu’un brouillon à la fois', () => {
    render(<FriseParcours entrees={ENTREES} onChangement={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Modifier/ })[0]);
    expect(screen.getByRole('button', { name: /Ajouter une expérience/ })).toBeDisabled();
    for (const bouton of screen.queryAllByRole('button', { name: /^Retirer —/ })) {
      expect(bouton).toBeDisabled();
    }
  });

  it('propose l’état vide quand il n’y a rien, sans masquer l’ajout', () => {
    render(<FriseParcours entrees={[]} onChangement={() => {}} />);
    expect(screen.getByText('Aucune expérience renseignée')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ajouter une expérience/ })).toBeEnabled();
  });

  it('demande confirmation avant de retirer, en nommant ce qui partira', () => {
    const onChangement = vi.fn();
    render(<FriseParcours entrees={ENTREES} onChangement={onChangement} />);

    fireEvent.click(screen.getAllByRole('button', { name: /^Retirer —/ })[0]);
    const dialogue = screen.getByRole('alertdialog');
    expect(within(dialogue).getByText(/« Senior PM » chez SantéVet/)).toBeInTheDocument();
    // Rien n'est retiré tant qu'on n'a pas confirmé.
    expect(onChangement).not.toHaveBeenCalled();

    fireEvent.click(within(dialogue).getByRole('button', { name: 'Retirer l’expérience' }));
    expect(onChangement).toHaveBeenCalledWith([
      ENTREES[0],
      ENTREES[2],
    ]);
  });
});
