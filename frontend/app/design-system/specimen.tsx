'use client';

import { useState } from 'react';

import { Avatar, AvatarNom } from '@/components/pacha/Avatar';
import { Bouton } from '@/components/pacha/Bouton';
import { BoutonIcone } from '@/components/pacha/BoutonIcone';
import {
  Carte,
  ContenuCarte,
  Encart,
  EnteteContenu,
  InfoLigne,
  LigneContenu,
  ZoneDefilante,
} from '@/components/pacha/Carte';
import { CarteCandidat, CarteTalent } from '@/components/pacha/CarteCandidat';
import { CarteOffre, CarteOffreTalent } from '@/components/pacha/CarteOffre';
import {
  Case,
  CaseVisuelle,
  GroupeCases,
  GroupeRadio,
  Interrupteur,
  Radio,
} from '@/components/pacha/Cases';
import {
  CadreChamp,
  CHAMP_BOITIER,
  CHAMP_FOCUS,
  CHAMP_SUBSTITUT_SAISIE,
  CHAMP_SURVOL,
  CHAMP_VALEUR,
  Champ,
  Libelle,
  MessageErreur,
} from '@/components/pacha/Champ';
import { ChampTags, PuceChoix, SaisieTags } from '@/components/pacha/ChampTags';
import { Divider } from '@/components/pacha/Divider';
import { Entete } from '@/components/pacha/Entete';
import { EtatVide } from '@/components/pacha/EtatVide';
import { Icone, NOMS_ICONES, type NomIcone } from '@/components/pacha/Icone';
import { FORMES, Illustration } from '@/components/pacha/Illustration';
import { FournisseurInfobulle, Infobulle } from '@/components/pacha/Infobulle';
import { ItemContenuCarte, Liste, ListeItem } from '@/components/pacha/ListeItem';
import { LogoComplet, LogoRond, Monogramme } from '@/components/pacha/Logo';
import { ElementMenu, Menu } from '@/components/pacha/Menu';
import { Notation, type Note } from '@/components/pacha/Notation';
import {
  type OptionPersonne,
  PastilleReponse,
  Selecteur,
  SelecteurMulti,
  SelecteurPersonne,
  SelecteurUnivers,
} from '@/components/pacha/Selecteur';
import { LigneDate, MentionDate, SelecteurDate } from '@/components/pacha/SelecteurDate';
import { SelecteurVue, type Vue } from '@/components/pacha/SelecteurVue';
import {
  CompteurStatut,
  ETAPES,
  StatutProcess,
  StatutTexte,
  TuileCompteur,
} from '@/components/pacha/StatutProcess';
import { TagAction, TagContrat, TagInfo, TagUnivers, type Univers } from '@/components/pacha/Tag';
import { Titre, TitreSection } from '@/components/pacha/Titre';
import { cn } from '@/lib/utils';

/**
 * Page de référence du design system.
 *
 * Elle existe pour une raison précise : un design system qu'on ne peut pas
 * regarder n'est pas vérifiable. Chaque section montre les composants dans
 * leurs états réels, à côté de la règle qui les gouverne — de sorte qu'un écart
 * se voie ici, au lieu de se découvrir six écrans plus loin.
 *
 * C'est le SEUL fichier de l'application qui a le droit de tout importer : il
 * sert de test de compilation pour les signatures publiques des 23 composants.
 * Si un lot change une prop sans le dire, cette page cesse de compiler.
 *
 * Composant client parce qu'elle porte des gestionnaires de démonstration —
 * c'est la seule raison, et elle ne concerne que cette page.
 */

const SOMMAIRE: readonly (readonly [string, string])[] = [
  ['couleurs', 'Couleurs'],
  ['typographie', 'Typographie'],
  ['formes', 'Rayons, ombres, densité'],
  ['titre', 'Titre'],
  ['logo', 'Logo'],
  ['icones', 'Icônes'],
  ['illustrations', 'Illustrations'],
  ['avatar', 'Avatar'],
  ['boutons', 'Boutons'],
  ['boutons-icone', 'Boutons icône'],
  ['tags', 'Tags'],
  ['notation', 'Notation'],
  ['selecteur-vue', 'Sélecteur de vue'],
  ['champs', 'Champs'],
  ['selecteurs', 'Sélecteurs'],
  ['cases', 'Cases, radios, interrupteur'],
  ['champ-tags', 'Champs à tags'],
  ['dates', 'Dates'],
  ['statuts', 'Statuts de process'],
  ['cartes', 'Cartes'],
  ['carte-offre', 'Carte offre'],
  ['carte-candidat', 'Carte candidat'],
  ['listes', 'Listes'],
  ['separateur', 'Séparateur'],
  ['etat-vide', 'État vide'],
  ['infobulle', 'Infobulle'],
  ['navigation', 'Navigation'],
  ['entete', 'Barre supérieure'],
];

/** Un échantillon lisible du jeu de 252 : les icônes que l'app emploie vraiment. */
const ICONES_ECHANTILLON: NomIcone[] = [
  'icon-user',
  'icon-users',
  'icon-user-plus',
  'icon-user-check',
  'icon-briefcase',
  'icon-calendar',
  'icon-clock',
  'icon-mail',
  'icon-send',
  'icon-phone',
  'icon-search',
  'icon-filter',
  'icon-sliders',
  'icon-star',
  'icon-heart',
  'icon-check',
  'icon-check-circle',
  'icon-x',
  'icon-x-circle',
  'icon-alert-triangle',
  'icon-info',
  'icon-bell',
  'icon-settings',
  'icon-edit',
  'icon-trash',
  'icon-download',
  'icon-upload',
  'icon-external-link',
  'icon-link',
  'icon-eye',
  'icon-eye-off',
  'icon-lock',
  'icon-log-out',
  'icon-plus',
  'icon-chevron-down',
  'icon-more-horizontal',
  'icon-map-pin',
  'icon-zap',
  'icon-trending-up',
  'icon-database',
];

const NOTES: readonly Note[] = ['excellent', 'bon', 'mauvais', 'indefini'];
const UNIVERS: readonly Univers[] = ['people', 'product', 'tech', 'sales'];

const OPTIONS_SENIORITE = [
  { valeur: 'junior', libelle: 'Junior' },
  { valeur: 'confirme', libelle: 'Confirmé.e' },
  { valeur: 'senior', libelle: 'Senior' },
  { valeur: 'lead', libelle: 'Lead', desactive: true },
] as const;

const OPTIONS_OUTILS = [
  { valeur: 'figma', libelle: 'Figma' },
  { valeur: 'linear', libelle: 'Linear' },
  { valeur: 'notion', libelle: 'Notion' },
  { valeur: 'amplitude', libelle: 'Amplitude' },
  { valeur: 'segment', libelle: 'Segment' },
] as const;

const OPTIONS_COMPETENCES = [
  { valeur: 'discovery', libelle: 'Discovery' },
  { valeur: 'design-system', libelle: 'Design system' },
  { valeur: 'recherche', libelle: 'Recherche utilisateur' },
  { valeur: 'data', libelle: 'Data produit' },
  { valeur: 'growth', libelle: 'Growth' },
  { valeur: 'roadmap', libelle: 'Roadmap' },
  { valeur: 'pricing', libelle: 'Pricing' },
  { valeur: 'b2b', libelle: 'B2B SaaS' },
  { valeur: 'marketplace', libelle: 'Marketplace' },
  { valeur: 'fintech', libelle: 'Fintech' },
] as const;

const OPTIONS_AGENTS: readonly OptionPersonne[] = [
  { valeur: 'marion', libelle: 'Marion Darnet' },
  { valeur: 'julien', libelle: 'Julien Simoes' },
  { valeur: 'charles', libelle: 'Charles Mouchoux' },
  { valeur: 'ines', libelle: 'Inès Ferreira', desactive: true },
];

const SECTIONS_MENU = [
  {
    titre: 'Database',
    entrees: [
      { emoji: '🎯', libelle: 'Dashboard', href: '#navigation' },
      { emoji: '🏢', libelle: 'Entreprise', href: '#cartes' },
      { emoji: '🧑', libelle: 'Talents', href: '#carte-candidat' },
    ],
  },
  {
    titre: 'Jobs',
    entrees: [
      { emoji: '🕹️', libelle: 'Pilotage', href: '#statuts' },
      { emoji: '💼', libelle: 'Mandats', href: '#carte-offre' },
      { emoji: '📊', libelle: 'Reporting', href: '#formes', desactive: true },
    ],
  },
];

export function Specimen() {
  const [vue, setVue] = useState<Vue>('cartes');
  const [seniorite, setSeniorite] = useState<string | null>('senior');
  const [outils, setOutils] = useState<string[]>(['figma', 'linear']);
  const [universChoisis, setUniversChoisis] = useState<Univers[]>(['product', 'tech']);
  const [agent, setAgent] = useState<string | null>('marion');
  const [caseCochee, setCaseCochee] = useState(true);
  const [radio, setRadio] = useState<unknown>('cdi');
  const [interrupteur, setInterrupteur] = useState(true);
  const [competences, setCompetences] = useState<string[]>(['discovery', 'data']);
  const [motsCles, setMotsCles] = useState<string[]>(['figma']);
  const [date, setDate] = useState<Date | null>(new Date(2026, 5, 20));
  const [contratRetire, setContratRetire] = useState(false);
  const [journal, setJournal] = useState('aucune');

  return (
    <FournisseurInfobulle>
      <main id="contenu" className="mx-auto max-w-[1180px] px-8 py-16">
        {/* ============================================================== */}
        <header>
          <Titre niveau={1} descriptif="Le système de conception de" impact="Pachamama OS" />
          <p className="t-body mt-5 max-w-[68ch] text-[var(--encre-600)]">
            Identité issue du design system de marque ; couche interface extraite du Figma de
            l’application. Les valeurs ne sont pas interprétées : elles viennent des deux sources,
            et les arbitrages sont documentés dans{' '}
            <code className="rounded bg-[var(--encre-050)] px-1">styles/app.css</code>. Cette page
            importe les 23 composants du dossier{' '}
            <code className="rounded bg-[var(--encre-050)] px-1">components/pacha</code> : elle sert
            aussi de test de compilation de leurs signatures publiques.
          </p>
          <p className="t-caption mt-4 text-[var(--encre-500)]">
            Dernière action de démonstration : <strong className="t-caption-bold">{journal}</strong>
          </p>
        </header>

        {/* ============================================================== */}
        <nav aria-label="Sommaire" className="mt-10">
          <Carte className="p-6">
            <p className="t-caption-bold mb-4 text-[var(--encre-500)]">Sommaire</p>
            <ul className="grid grid-cols-2 gap-x-8 gap-y-2 md:grid-cols-4">
              {SOMMAIRE.map(([id, libelle], i) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="t-body flex items-baseline gap-2 text-black hover:underline"
                  >
                    <span className="t-micro-bold w-4 shrink-0 text-[var(--encre-300)]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {libelle}
                  </a>
                </li>
              ))}
            </ul>
          </Carte>
        </nav>

        {/* ==================== JETONS : COULEURS ======================= */}
        <Section
          id="couleurs"
          titre="Couleurs"
          regle="Le texte est TOUJOURS noir. Les couleurs de verticale sont des accents décoratifs — jamais du texte. Le fond de page est crème, jamais blanc. Le violet est la seule rampe interactive : il signale l’action, là où une verticale qualifie un métier."
        >
          <Palette
            titre="Structurel — les surfaces"
            jetons={[
              ['--cream', 'Crème de marque'],
              ['--white', 'Blanc'],
              ['--black', 'Noir : texte, bordures, action'],
              ['--fond-page', 'Fond de page'],
              ['--fond-carte', 'Fond de carte'],
              ['--fond-entete', 'Barre supérieure'],
              ['--fond-inerte', 'Zone inerte'],
            ]}
          />
          <Palette
            titre="Verticale People — accent seulement"
            jetons={[
              ['--people-500', '500'],
              ['--people-300', '300'],
              ['--people-200', '200'],
              ['--people-100', '100'],
            ]}
          />
          <Palette
            titre="Verticale Product"
            jetons={[
              ['--product-500', '500'],
              ['--product-300', '300'],
              ['--product-200', '200'],
              ['--product-100', '100'],
            ]}
          />
          <Palette
            titre="Verticale Tech"
            jetons={[
              ['--tech-500', '500'],
              ['--tech-300', '300'],
              ['--tech-200', '200'],
              ['--tech-100', '100'],
            ]}
          />
          <Palette
            titre="Verticale Revenue"
            jetons={[
              ['--revenue-500', '500'],
              ['--revenue-300', '300'],
              ['--revenue-200', '200'],
              ['--revenue-100', '100'],
            ]}
          />
          <Palette
            titre="Violet interactif — extension d’interface (9 teintes)"
            jetons={[
              ['--violet-900', '900'],
              ['--violet-700', '700'],
              ['--violet-600', '600'],
              ['--violet-500', '500'],
              ['--violet-400', '400'],
              ['--violet-300', '300'],
              ['--violet-200', '200'],
              ['--violet-100', '100'],
              ['--violet-050', '050'],
            ]}
          />
          <Palette
            titre="Encre — la donnée (11 teintes)"
            jetons={[
              ['--encre-900', '900'],
              ['--encre-800', '800'],
              ['--encre-700', '700'],
              ['--encre-600', '600'],
              ['--encre-500', '500'],
              ['--encre-400', '400'],
              ['--encre-300', '300'],
              ['--encre-250', '250'],
              ['--encre-200', '200'],
              ['--encre-100', '100'],
              ['--encre-050', '050'],
            ]}
          />
          <Palette
            titre="Statuts de process — le vocabulaire métier"
            jetons={[
              ['--statut-attente', 'attente'],
              ['--statut-avance', 'avance'],
              ['--statut-positif', 'positif'],
              ['--statut-echec', 'échec'],
            ]}
          />
        </Section>

        {/* ==================== JETONS : TYPOGRAPHIE ==================== */}
        <Section
          id="typographie"
          titre="Typographie"
          regle="Le duo de titres : les deux lignes ont la MÊME taille. La hiérarchie vient du contraste serif/sans, jamais d’un écart de corps. Instrument Serif n’est jamais en italique. Trois familles, et seulement elles. Quatorze classes nommées — en dessous de 10 px, rien n’est lisible : t-micro est un plancher, pas une invitation."
        >
          <div className="flex flex-col gap-4">
            {(
              [
                ['t-h1', 'Title H1 — Bricolage Grotesque 700 · 30/36'],
                ['t-h1-comp', 'Title H1 complementary — Instrument Serif 400 · 30/39'],
                ['t-h2', 'Title H2 — Bricolage Grotesque 700 · 24/29'],
                ['t-h2-comp', 'Title H2 complementary — Instrument Serif 400 · 24/31'],
                ['t-h3', 'Title H3 — Bricolage Grotesque 700 · 18/22'],
                ['t-body', 'Body regular — Host Grotesk 400 · 14/19'],
                ['t-body-hl', 'Body highlight — Host Grotesk 500 · 14/19'],
                ['t-body-bold', 'Body bold — Host Grotesk 700 · 14/19'],
                ['t-caption', 'Caption regular — Host Grotesk 400 · 12/16'],
                ['t-caption-hl', 'Caption highlight — Host Grotesk 500 · 12/16'],
                ['t-caption-bold', 'Caption bold — Host Grotesk 700 · 12/16'],
                ['t-micro', 'Micro regular — Host Grotesk 400 · 10/12'],
                ['t-micro-hl', 'Micro highlight — Host Grotesk 500 · 10/12'],
                ['t-micro-bold', 'Micro bold — Host Grotesk 700 · 10/12'],
              ] as const
            ).map(([classe, libelle]) => (
              <div key={classe} className="flex items-baseline gap-6">
                <code className="t-micro w-[110px] shrink-0 text-[var(--encre-400)]">{classe}</code>
                <p className={classe}>{libelle}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ==================== JETONS : FORMES ========================= */}
        <Section
          id="formes"
          titre="Rayons, ombres et densité"
          regle="L’ombre rétro décalée est la signature de marque, ici réduite à l’échelle de l’interface : -1 px pour un tag, -3 px pour un bouton, -6 px pour une carte d’accroche. Aucun flou — sauf pour un élément qui FLOTTE (menu déroulant, infobulle), où l’élévation est un autre sujet que la signature. Les rayons d’interface sont serrés : une interface dense respire par l’espacement, pas par l’arrondi."
        >
          <Bloc libelle="Rayons">
            {(
              [
                ['--r-xs', '4 px'],
                ['--r-sm', '6 px'],
                ['--r-md', '8 px — le défaut'],
                ['--r-lg', '16 px'],
                ['--r-full', 'complet'],
              ] as const
            ).map(([jeton, libelle]) => (
              <Vignette key={jeton} jeton={jeton} libelle={libelle}>
                <div
                  className="size-16 border-2 border-black bg-white"
                  style={{ borderRadius: `var(${jeton})` }}
                />
              </Vignette>
            ))}
          </Bloc>

          <Bloc libelle="Ombres d’interface — la signature rétro, sans flou">
            {(
              [
                ['--ombre-1', 'tags'],
                ['--ombre-2', 'petits boutons'],
                ['--ombre-3', 'boutons, cartes'],
                ['--ombre-6', 'cartes d’accroche'],
                ['--ombre-1-grise', 'tag atténué'],
              ] as const
            ).map(([jeton, libelle]) => (
              <Vignette key={jeton} jeton={jeton} libelle={libelle}>
                <div
                  className="size-16 rounded-[var(--r-md)] border-2 border-black bg-white"
                  style={{ boxShadow: `var(${jeton})` }}
                />
              </Vignette>
            ))}
          </Bloc>

          <Bloc libelle="Ombres d’élévation — réservées à ce qui flotte">
            {(
              [
                ['--ombre-douce', 'champ au focus'],
                ['--ombre-portee', 'survol de ligne'],
              ] as const
            ).map(([jeton, libelle]) => (
              <Vignette key={jeton} jeton={jeton} libelle={libelle}>
                <div
                  className="size-16 rounded-[var(--r-md)] bg-white"
                  style={{ boxShadow: `var(${jeton})` }}
                />
              </Vignette>
            ))}
          </Bloc>

          <Bloc libelle="Ombres de marque — l’échelle du print et des visuels">
            {(
              [
                ['--shadow-retro', '-8 px'],
                ['--shadow-retro-sm', '-5 px'],
              ] as const
            ).map(([jeton, libelle]) => (
              <Vignette key={jeton} jeton={jeton} libelle={libelle}>
                <div
                  className="size-16 rounded-[var(--radius-card)] border-2 border-black bg-white"
                  style={{ boxShadow: `var(${jeton})` }}
                />
              </Vignette>
            ))}
          </Bloc>

          <Bloc libelle="Densité — les hauteurs de gabarit, mesurées dans le Figma">
            <div className="flex flex-col gap-2">
              {(
                [
                  ['--h-champ', '36 px', 'champ de saisie'],
                  ['--h-tag', '27 px', 'tag univers, tag contrat'],
                  ['--h-statut', '35 px', 'pastille de statut, tag action'],
                  ['--h-menu-item', '31 px', 'élément de menu'],
                  ['--h-ligne-compacte', '36 px', 'ligne de tableau dense'],
                  ['--h-ligne', '44 px', 'ligne de tableau'],
                ] as const
              ).map(([jeton, valeur, usage]) => (
                <div key={jeton} className="flex items-baseline gap-4">
                  <code className="t-micro w-[150px] shrink-0 text-[var(--encre-400)]">{jeton}</code>
                  <span className="t-caption-bold w-[60px] shrink-0">{valeur}</span>
                  <span className="t-caption text-[var(--encre-500)]">{usage}</span>
                </div>
              ))}
            </div>
          </Bloc>
        </Section>

        {/* ==================== TITRE ================================== */}
        <Section
          id="titre"
          titre="Titre"
          regle="Jamais une ligne sans l’autre : le duo serif + sans est la signature de marque. La ligne descriptive n’est facultative qu’au niveau d’un titre d’interface, où le duo n’a plus de place."
        >
          <div className="flex flex-col gap-10">
            <Titre niveau={1} descriptif="Le tableau de bord de" impact="votre sourcing" />
            <Titre niveau={2} descriptif="Les offres en cours chez" impact="Cockpit" />
            <Titre impact="Sans ligne descriptive — à réserver aux titres d’interface" />
            <div>
              <p className="t-micro mb-2 text-[var(--encre-400)]">TitreSection</p>
              <TitreSection>Informations sur le mandat</TitreSection>
            </div>
          </div>
        </Section>

        {/* ==================== LOGO =================================== */}
        <Section
          id="logo"
          titre="Logo"
          regle="Le monogramme se teinte par la COULEUR DE TEXTE, jamais par un fill : l’encre suit le texte, le papier reste blanc. Le logo rond garde ses lilas en dur — le jour où la verticale Tech change de teinte, le logo ne doit pas changer avec elle."
        >
          <Bloc libelle="LogoComplet">
            <LogoComplet />
          </Bloc>
          <Bloc libelle="LogoRond">
            <LogoRond />
            <LogoRond className="h-12 w-12" />
          </Bloc>
          <Bloc libelle="Monogramme — deux cotes, et la teinte qui suit le texte">
            <Monogramme taille="grand" className="text-black" />
            <Monogramme taille="petit" className="text-black" />
            <Monogramme taille="grand" className="text-[var(--encre-300)]" />
            <Monogramme taille="grand" className="text-[var(--violet-500)]" />
            <span className="inline-flex items-center rounded-[var(--r-md)] bg-black p-3">
              <Monogramme taille="grand" className="text-white" />
            </span>
          </Bloc>
        </Section>

        {/* ==================== ICÔNES ================================ */}
        <Section
          id="icones"
          titre="Icônes"
          regle="Une icône sans titre est décorative : elle est masquée aux lecteurs d’écran, et le sens qu’elle porte doit exister en texte à côté d’elle. Avec un titre, elle porte le sens seule — c’est le cas du bouton icône. Une information critique n’est jamais confiée au seul dessin."
        >
          <p className="t-caption mb-5 text-[var(--encre-500)]">
            Jeu Feather servi par lucide-react —{' '}
            <strong className="t-caption-bold">{NOMS_ICONES.length} icônes</strong> disponibles,
            cote unique de 24 × 24. Échantillon de {ICONES_ECHANTILLON.length} ci-dessous.
          </p>
          <ul className="grid grid-cols-4 gap-x-4 gap-y-5 sm:grid-cols-6 md:grid-cols-8">
            {ICONES_ECHANTILLON.map((nom) => (
              <li key={nom} className="flex flex-col items-center gap-1.5 text-center">
                <Icone nom={nom} />
                <code className="t-micro break-all text-[var(--encre-400)]">
                  {nom.replace('icon-', '')}
                </code>
              </li>
            ))}
          </ul>
          <Bloc libelle="Cotes réduites par la classe, pas par une prop">
            <Icone nom="icon-zap" />
            <Icone nom="icon-zap" className="size-5" />
            <Icone nom="icon-zap" className="size-4" />
            <Icone nom="icon-zap" className="size-6 text-[var(--violet-700)]" />
            <Icone nom="icon-zap" titre="Icône annoncée aux lecteurs d’écran" />
          </Bloc>
        </Section>

        {/* ==================== ILLUSTRATIONS ========================= */}
        <Section
          id="illustrations"
          titre="Illustrations"
          regle="Les 34 formes abstraites de la marque. Elles se teintent par la couleur de texte (currentColor) et sont décoratives par défaut : une forme abstraite ne porte jamais d’information."
        >
          <p className="t-caption mb-5 text-[var(--encre-500)]">
            <strong className="t-caption-bold">{FORMES.length} formes</strong>, dans l’ordre du
            Figma.
          </p>
          <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-5 md:grid-cols-7">
            {FORMES.map((forme) => (
              <li key={forme} className="flex flex-col items-center gap-2 text-center">
                <Illustration forme={forme} className="size-12 text-black" />
                <code className="t-micro text-[var(--encre-400)]">{forme}</code>
              </li>
            ))}
          </ul>
          <Bloc libelle="Teintes — la forme suit la couleur du texte">
            <Illustration forme="etoiles" className="size-16 text-black" />
            <Illustration forme="etoiles" className="size-16 text-[var(--violet-500)]" />
            <Illustration forme="etoiles" className="size-16 text-[var(--product-500)]" />
            <Illustration forme="etoiles" className="size-16 text-[var(--encre-200)]" />
          </Bloc>
        </Section>

        {/* ==================== AVATAR ================================ */}
        <Section
          id="avatar"
          titre="Avatar"
          regle="Quatre cotes, parce que le Figma a quatre usages — pas une échelle inventée. Les photos de candidat et de client sont CARRÉES et cerclées d’un filet gris ; seule la photo d’agent est ronde. Une URL de photo casse : le repli en initiales garde la même boîte, donc la mise en page ne bouge pas."
        >
          <Bloc libelle="Cotes, en repli d’initiales">
            <Avatar nom="Myriam Sterdam" taille={30} />
            <Avatar nom="Myriam Sterdam" taille={38} />
            <Avatar nom="Myriam Sterdam" taille={42} />
            <Avatar nom="Myriam Sterdam" taille={56} />
          </Bloc>
          <Bloc libelle="Formes et filet">
            <Avatar nom="Jean-Luc Picard" taille={56} forme="carre" />
            <Avatar nom="Jean-Luc Picard" taille={56} forme="rond" />
            <Avatar nom="Jean-Luc Picard" taille={56} forme="carre" bordure={false} />
          </Bloc>
          <Bloc libelle="Repli sur URL morte — les initiales, jamais l’icône d’image brisée">
            <Avatar nom="Valentine Ducharme" src="/photo-absente.jpg" taille={56} />
            <Avatar
              nom="Valentine Ducharme"
              src={null}
              taille={56}
              alt="Portrait de Valentine Ducharme"
            />
          </Bloc>
          <Bloc libelle="AvatarNom — l’avatar et le nom, le nom portant l’information">
            <AvatarNom nom="Marion Darnet" />
            <AvatarNom nom="Julien Simoes" forme="carre" taille={38} />
          </Bloc>
        </Section>

        {/* ==================== BOUTONS =============================== */}
        <Section
          id="boutons"
          titre="Boutons"
          regle="Le noir est la couleur d’action. Une verticale qualifie un métier, elle ne signale pas un geste. Un bouton désactivé reste lisible : fond encre-100 et texte encre-700, jamais un gris qui disparaît."
        >
          <Bloc libelle="Apparences · taille md">
            <Bouton apparence="plein" iconeAvant={<Icone nom="icon-plus" />}>
              Créer une offre
            </Bouton>
            <Bouton apparence="contour" iconeAvant={<Icone nom="icon-plus" />}>
              Créer une offre
            </Bouton>
            <Bouton apparence="contour-ombre" iconeAvant={<Icone nom="icon-plus" />}>
              Créer une offre
            </Bouton>
            <Bouton apparence="presse" iconeAvant={<Icone nom="icon-plus" />}>
              Créer une offre
            </Bouton>
            <Bouton apparence="inerte" iconeAvant={<Icone nom="icon-plus" />}>
              Créer une offre
            </Bouton>
          </Bloc>
          <Bloc libelle="Apparences · taille sm">
            <Bouton taille="sm" apparence="plein">
              Ajouter
            </Bouton>
            <Bouton taille="sm" apparence="contour">
              Ajouter
            </Bouton>
            <Bouton taille="sm" apparence="contour-ombre">
              Ajouter
            </Bouton>
            <Bouton taille="sm" apparence="presse">
              Ajouter
            </Bouton>
            <Bouton taille="sm" apparence="inerte">
              Ajouter
            </Bouton>
          </Bloc>
          <Bloc libelle="Couleurs déclarées : defaut · main · lila · blanc">
            <Bouton couleur="defaut">defaut</Bouton>
            <Bouton couleur="main">main</Bouton>
            <Bouton couleur="lila">lila</Bouton>
            <Bouton couleur="blanc">blanc</Bouton>
          </Bloc>
          <Bloc libelle="Icônes avant, après, des deux côtés">
            <Bouton iconeAvant={<Icone nom="icon-search" />}>Rechercher</Bouton>
            <Bouton apparence="contour" iconeApres={<Icone nom="icon-chevron-down" />}>
              Filtrer
            </Bouton>
            <Bouton
              apparence="contour-ombre"
              iconeAvant={<Icone nom="icon-user-plus" />}
              iconeApres={<Icone nom="icon-external-link" />}
            >
              Accès fiche client
            </Bouton>
          </Bloc>
          <Bloc libelle="Désactivé par l’attribut natif, et bouton porteur d’un geste réel">
            <Bouton disabled iconeAvant={<Icone nom="icon-plus" />}>
              Indisponible
            </Bouton>
            <Bouton apparence="contour" disabled>
              Indisponible
            </Bouton>
            <Bouton onClick={() => setJournal('clic sur « Je suis intéressé·e »')}>
              Je suis intéressé·e
            </Bouton>
          </Bloc>
        </Section>

        {/* ==================== BOUTONS ICÔNE ========================= */}
        <Section
          id="boutons-icone"
          titre="Boutons icône"
          regle="Un bouton sans texte porte un libellé accessible obligatoire : le dessin ne suffit pas. La cible tactile est étendue par un pseudo-élément, sans grossir le dessin — un chevron de 20 px reste cliquable au doigt."
        >
          <Bloc libelle="Types · taille md">
            <BoutonIcone type="chevron" />
            <BoutonIcone type="supprimer" />
            <BoutonIcone type="modifier" />
            <BoutonIcone type="agrandir" />
            <BoutonIcone type="reduire" />
            <BoutonIcone type="voir" />
            <BoutonIcone type="envoyer" />
            <BoutonIcone type="rechercher" />
          </Bloc>
          <Bloc libelle="Types · taille lg">
            <BoutonIcone type="chevron" taille="lg" />
            <BoutonIcone type="supprimer" taille="lg" />
            <BoutonIcone type="modifier" taille="lg" />
            <BoutonIcone type="voir" taille="lg" />
          </Bloc>
          <Bloc libelle="Le chevron s’oriente sans changer de composant">
            <BoutonIcone type="chevron" direction="bas" taille="lg" />
            <BoutonIcone type="chevron" direction="haut" taille="lg" />
            <BoutonIcone type="chevron" direction="gauche" taille="lg" />
            <BoutonIcone type="chevron" direction="droite" taille="lg" />
          </Bloc>
          <Bloc libelle="Libellé sur mesure, état désactivé, geste réel">
            <BoutonIcone type="supprimer" libelle="Retirer ce candidat du mandat" taille="lg" />
            <BoutonIcone type="modifier" taille="lg" disabled />
            <BoutonIcone
              type="envoyer"
              taille="lg"
              onClick={() => setJournal('envoi déclenché depuis un bouton icône')}
            />
          </Bloc>
        </Section>

        {/* ==================== TAGS ================================== */}
        <Section
          id="tags"
          titre="Tags"
          regle="Quatre familles, qui ne se mélangent jamais dans un même groupe. Le fond porte la verticale, le texte reste noir. Un tag atténué s’efface en bloc — bordure, texte, croix et ombre passent au gris ensemble — au lieu de compter sur la seule couleur pour dire « inactif »."
        >
          <Bloc libelle="TagUnivers — le fond porte la verticale">
            {UNIVERS.map((u) => (
              <TagUnivers key={u} univers={u} />
            ))}
          </Bloc>
          <Bloc libelle="TagUnivers — retirable, et libellé sur mesure">
            {UNIVERS.map((u) => (
              <TagUnivers key={u} univers={u} onRetirer={() => setJournal(`tag ${u} retiré`)} />
            ))}
            <TagUnivers univers="tech">Data & IA</TagUnivers>
          </Bloc>
          <Bloc libelle="TagContrat — repos, focus, atténué, retirable">
            <TagContrat contrat="cdi" />
            <TagContrat contrat="freelance" />
            <TagContrat contrat="cdi" focus />
            <TagContrat contrat="freelance" focus />
            <TagContrat contrat="cdi" attenue />
            <TagContrat contrat="freelance" desactive />
            <TagContrat contrat="Régie" />
            {!contratRetire && (
              <TagContrat
                contrat="cdi"
                onRetirer={() => {
                  setContratRetire(true);
                  setJournal('tag contrat retiré');
                }}
              />
            )}
            {contratRetire && (
              <Bouton
                taille="sm"
                apparence="contour"
                onClick={() => {
                  setContratRetire(false);
                  setJournal('tag contrat rétabli');
                }}
              >
                Rétablir
              </Bouton>
            )}
          </Bloc>
          <Bloc libelle="TagInfo — les arguments d’une offre, en régime travail puis accroche">
            <TagInfo emoji="🐓">Boîte FR</TagInfo>
            <TagInfo emoji="✌️">Cible user sympa</TagInfo>
            <TagInfo>Sans emoji</TagInfo>
            <TagInfo emoji="🚀" regime="accroche">
              Série B bouclée
            </TagInfo>
          </Bloc>
          <Bloc libelle="TagAction — un filtre qu’on active ; sélectionné = violet 900, texte blanc">
            <TagAction appui="faible">Discovery</TagAction>
            <TagAction appui="moyen">Design system</TagAction>
            <TagAction appui="fort">Growth</TagAction>
            <TagAction actif>Sélectionné explicitement</TagAction>
            <TagAction onClick={() => setJournal('filtre « B2B SaaS » basculé')}>B2B SaaS</TagAction>
          </Bloc>
        </Section>

        {/* ==================== NOTATION ============================== */}
        <Section
          id="notation"
          titre="Notation"
          regle="Ce n’est pas une échelle d’étoiles : c’est un vocabulaire d’emojis, et un emoji n’est pas un mot. Le glyphe est masqué aux lecteurs d’écran et le sens passe par un texte invisible. « Non évalué » n’est pas une absence de note, c’est un état qui se dit."
        >
          <Bloc libelle="Avec pastille (posée en badge sur un avatar) · md puis sm">
            {NOTES.map((n) => (
              <Notation key={n} note={n} />
            ))}
            <span className="w-4" />
            {NOTES.map((n) => (
              <Notation key={`sm-${n}`} note={n} taille="sm" />
            ))}
          </Bloc>
          <Bloc libelle="Sans pastille — sur une carte blanche, la pastille serait invisible">
            {NOTES.map((n) => (
              <Notation key={`nu-${n}`} note={n} pastille={false} />
            ))}
          </Bloc>
          <Bloc libelle="En contexte : le badge sur la photo">
            <span className="relative inline-block">
              <Avatar nom="Myriam Sterdam" taille={56} />
              <Notation note="excellent" className="absolute -left-1 -top-1.5" />
            </span>
          </Bloc>
        </Section>

        {/* ==================== SÉLECTEUR DE VUE ====================== */}
        <Section
          id="selecteur-vue"
          titre="Sélecteur de vue"
          regle="Groupe exclusif : une vue est toujours active, la désélection est bloquée. L’actif est noir, l’inactif gris — et quand le pointeur survole l’inactive, c’est l’ACTIVE qui s’éclaircit pour annoncer la bascule."
        >
          <Bloc libelle={`Vue courante : ${vue}`}>
            <SelecteurVue
              vue={vue}
              onChanger={(v) => {
                setVue(v);
                setJournal(`bascule vers la vue ${v}`);
              }}
            />
          </Bloc>
          <Bloc libelle="Les deux états, côte à côte">
            <SelecteurVue vue="cartes" onChanger={() => setJournal('bascule (démo figée)')} />
            <SelecteurVue vue="kanban" onChanger={() => setJournal('bascule (démo figée)')} />
          </Bloc>
        </Section>

        {/* ==================== CHAMPS ================================ */}
        <Section
          id="champs"
          titre="Champs"
          regle="Le libellé est toujours lié au champ. Une erreur est annoncée par le texte — pas seulement par une bordure rouge, qui serait muette pour un lecteur d’écran et invisible pour un daltonien. Le survol et le focus épaississent la bordure sans déplacer le contenu : le padding compense au pixel."
        >
          <div className="grid max-w-[760px] grid-cols-1 gap-6 md:grid-cols-2">
            <Champ libelle="Texte" placeholder="Écrire ici..." />
            <Champ libelle="Rempli" defaultValue="Valentine Ducharme" />
            <Champ libelle="Recherche" recherche placeholder="Chercher un.e candidat.e" />
            <Champ
              libelle="Recherche avec bouton"
              recherche
              placeholder="Chercher un.e candidat.e"
              onRechercher={() => setJournal('recherche lancée')}
            />
            <Champ
              libelle="Avec texte d’aide"
              placeholder="90 - 180K"
              aide="Fourchette annuelle brute, en K€."
            />
            <Champ libelle="Requis" requis placeholder="Obligatoire" />
            <Champ
              libelle="En erreur"
              defaultValue="valentine@"
              erreur="Adresse e-mail incomplète."
            />
            <Champ libelle="Désactivé" placeholder="Écrire ici..." disabled />
            <Champ libelle="Recherche désactivée" recherche placeholder="Indisponible" disabled />
            <Champ libelle="Numérique" type="number" defaultValue={4} />
          </div>
          <Bloc libelle="Les briques du champ, montées à la main — Libelle, CadreChamp, MessageErreur">
            <div className="w-[320px]">
              <CadreChamp
                id="demo-cadre"
                libelle="Champ assemblé sans <Champ>"
                aide="CadreChamp porte le libellé, l’aide et l’erreur ; le contrôle est libre."
              >
                <select
                  id="demo-cadre"
                  defaultValue="hybride"
                  className={cn(CHAMP_BOITIER, CHAMP_VALEUR, CHAMP_FOCUS)}
                >
                  <option value="site">Sur site</option>
                  <option value="hybride">Hybride</option>
                  <option value="remote">Full remote</option>
                </select>
              </CadreChamp>
            </div>
            <div className="flex w-[280px] flex-col gap-2">
              <Libelle htmlFor="demo-libelle">Libelle seul</Libelle>
              <input
                id="demo-libelle"
                placeholder="Contrôle nu"
                className={cn(CHAMP_BOITIER, CHAMP_VALEUR, CHAMP_SUBSTITUT_SAISIE, CHAMP_SURVOL)}
              />
              <MessageErreur id="demo-erreur">MessageErreur, hors de tout champ.</MessageErreur>
            </div>
          </Bloc>
        </Section>

        {/* ==================== SÉLECTEURS ============================ */}
        <Section
          id="selecteurs"
          titre="Sélecteurs"
          regle="Une liste d’options est une listbox, pas une pile de div : le curseur roulant, les flèches et l’annonce du nombre d’options viennent de la primitive, jamais d’un clic recodé à la main. Le sélecteur d’univers montre le TAG dans la liste, pas son nom — c’est le tag que l’utilisateur reconnaîtra ensuite dans la fiche."
        >
          <div className="grid max-w-[760px] grid-cols-1 gap-6 md:grid-cols-2">
            <Selecteur
              libelle="Séniorité — choix unique"
              options={OPTIONS_SENIORITE}
              valeur={seniorite}
              onChangement={(v) => {
                setSeniorite(v);
                setJournal(`séniorité : ${v ?? 'aucune'}`);
              }}
              substitut="Choisir une séniorité"
              aide="La dernière option est désactivée."
            />
            <Selecteur
              libelle="Séniorité — en erreur"
              options={OPTIONS_SENIORITE}
              substitut="Choisir une séniorité"
              erreur="Une séniorité est requise pour publier l’offre."
              requis
            />
            <Selecteur
              libelle="Séniorité — désactivé"
              options={OPTIONS_SENIORITE}
              valeurParDefaut="junior"
              desactive
            />
            <Selecteur
              libelle="Séniorité — teinte de tag"
              options={OPTIONS_SENIORITE}
              valeurParDefaut="confirme"
              teinteTags
            />
            <SelecteurMulti
              libelle="Outils — multiple, en pastilles"
              options={OPTIONS_OUTILS}
              valeurs={outils}
              onChangement={(v) => {
                setOutils(v);
                setJournal(`outils : ${v.join(', ') || 'aucun'}`);
              }}
              substitut="Choisir des outils"
            />
            <SelecteurMulti
              libelle="Outils — multiple, en compte"
              options={OPTIONS_OUTILS}
              valeursParDefaut={['figma', 'linear', 'notion']}
              apparenceValeur="compte"
            />
            <SelecteurUnivers
              libelle="Univers — le tag comme option"
              options={UNIVERS.map((u) => ({ valeur: u }))}
              valeurs={universChoisis}
              onChangement={(v) => {
                setUniversChoisis(v);
                setJournal(`univers : ${v.join(', ') || 'aucun'}`);
              }}
              substitut="Choisir des univers"
            />
            <SelecteurUnivers
              libelle="Univers — en erreur"
              options={UNIVERS.map((u) => ({ valeur: u }))}
              erreur="Au moins un univers est nécessaire."
            />
            <SelecteurPersonne
              libelle="Agent.e en charge"
              options={OPTIONS_AGENTS}
              valeur={agent}
              onChangement={(v) => {
                setAgent(v);
                setJournal(`agent : ${v ?? 'aucun'}`);
              }}
            />
            <SelecteurPersonne
              libelle="Agent.e — désactivé"
              options={OPTIONS_AGENTS}
              valeurParDefaut="julien"
              desactive
            />
          </div>
          <Bloc libelle="PastilleReponse — la brique qui rend une valeur choisie">
            <PastilleReponse>Figma</PastilleReponse>
            <PastilleReponse>Linear</PastilleReponse>
            <PastilleReponse>Amplitude</PastilleReponse>
          </Bloc>
        </Section>

        {/* ==================== CASES ================================= */}
        <Section
          id="cases"
          titre="Cases, radios et interrupteur"
          regle="Chaque contrôle est enveloppé de son libellé : le clic sur le texte coche la case, ce qui double la cible sans un pixel de code en plus. Un groupe de cases est un fieldset avec sa légende — sans quoi un lecteur d’écran annonce quatre cases orphelines."
        >
          <div className="flex flex-wrap gap-x-16 gap-y-10">
            <div className="flex flex-col gap-4">
              <p className="t-caption-hl text-[var(--encre-500)]">Case — tous les états</p>
              <Case libelle="Non cochée" />
              <Case libelle="Cochée par défaut" defaultChecked />
              <Case
                libelle={`Contrôlée : ${caseCochee ? 'cochée' : 'décochée'}`}
                checked={caseCochee}
                onCheckedChange={(v) => {
                  setCaseCochee(v);
                  setJournal(`case ${v ? 'cochée' : 'décochée'}`);
                }}
              />
              <Case libelle="Désactivée" disabled />
              <Case libelle="Désactivée et cochée" disabled defaultChecked />
              <Case libelle="En erreur" erreur="Vous devez accepter pour continuer." />
              <div className="flex items-center gap-3">
                <span className="t-caption text-[var(--encre-500)]">Sans libellé :</span>
                <Case />
                <Case defaultChecked />
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <GroupeCases libelle="Modes de travail acceptés">
                <Case libelle="Sur site" defaultChecked />
                <Case libelle="Hybride" defaultChecked />
                <Case libelle="Full remote" />
              </GroupeCases>
              <GroupeCases
                libelle="Univers ciblés"
                erreur="Sélectionnez au moins un univers pour lancer le sourcing."
              >
                <Case libelle="People" />
                <Case libelle="Product" />
                <Case libelle="Tech" />
              </GroupeCases>
            </div>

            <div className="flex flex-col gap-6">
              <GroupeRadio
                libelle="Contrat"
                value={radio}
                onValueChange={(v) => {
                  setRadio(v);
                  setJournal(`contrat : ${String(v)}`);
                }}
              >
                <Radio libelle="CDI" valeur="cdi" />
                <Radio libelle="Freelance" valeur="freelance" />
                <Radio libelle="Régie" valeur="regie" />
                <Radio libelle="Stage" valeur="stage" disabled />
              </GroupeRadio>
              <GroupeRadio libelle="Disposition en colonne" disposition="colonne" defaultValue="b">
                <Radio libelle="Premier choix" valeur="a" />
                <Radio libelle="Deuxième choix" valeur="b" />
                <Radio libelle="Troisième choix" valeur="c" />
              </GroupeRadio>
              <GroupeRadio
                libelle="Requis, en erreur"
                requis
                erreur="Ce choix est nécessaire pour envoyer le dossier."
              >
                <Radio libelle="Oui" valeur="oui" />
                <Radio libelle="Non" valeur="non" />
              </GroupeRadio>
            </div>

            <div className="flex flex-col gap-4">
              <p className="t-caption-hl text-[var(--encre-500)]">Interrupteur</p>
              <Interrupteur
                libelle={`Offre publiée : ${interrupteur ? 'oui' : 'non'}`}
                checked={interrupteur}
                onCheckedChange={(v) => {
                  setInterrupteur(v);
                  setJournal(`offre ${v ? 'publiée' : 'dépubliée'}`);
                }}
              />
              <Interrupteur libelle="Éteint par défaut" />
              <Interrupteur libelle="Désactivé" disabled />
              <Interrupteur libelle="Désactivé et allumé" disabled defaultChecked />
              <div className="flex items-center gap-3">
                <span className="t-caption text-[var(--encre-500)]">Sans libellé :</span>
                <Interrupteur />
                <Interrupteur defaultChecked />
              </div>
            </div>
          </div>
          <Bloc libelle="CaseVisuelle — la case purement décorative, pour une ligne de liste déjà activable">
            <CaseVisuelle />
            <CaseVisuelle cochee />
            <Liste className="w-[240px] rounded-[var(--r-md)] border border-[var(--encre-100)] bg-white">
              {OPTIONS_OUTILS.slice(0, 3).map((o) => (
                <ListeItem
                  key={o.valeur}
                  selectionne={outils.includes(o.valeur)}
                  onClic={() =>
                    setOutils((prec) =>
                      prec.includes(o.valeur)
                        ? prec.filter((x) => x !== o.valeur)
                        : [...prec, o.valeur],
                    )
                  }
                >
                  <CaseVisuelle cochee={outils.includes(o.valeur)} />
                  {o.libelle}
                </ListeItem>
              ))}
            </Liste>
          </Bloc>
        </Section>

        {/* ==================== CHAMPS À TAGS ========================= */}
        <Section
          id="champ-tags"
          titre="Champs à tags"
          regle="Au-delà d’une poignée d’options, on n’aligne pas cinquante puces : les premières restent visibles, le reste passe derrière un « Autre ». La saisie à tags, elle, filtre en tapant — mais garde une réponse quand rien ne correspond, plutôt qu’une liste vide qui ressemble à un bug."
        >
          <div className="flex max-w-[760px] flex-col gap-10">
            <ChampTags
              libelle="Compétences — 6 puces visibles, le reste sous « Autre »"
              options={OPTIONS_COMPETENCES}
              valeurs={competences}
              onChangement={(v) => {
                setCompetences(v);
                setJournal(`compétences : ${v.join(', ') || 'aucune'}`);
              }}
              visibles={6}
              aide="Les options au-delà de la sixième sont regroupées."
            />
            <ChampTags
              libelle="Compétences — en erreur"
              options={OPTIONS_COMPETENCES.slice(0, 4)}
              erreur="Sélectionnez au moins une compétence."
            />
            <ChampTags
              libelle="Compétences — désactivé"
              options={OPTIONS_COMPETENCES.slice(0, 4)}
              valeursParDefaut={['discovery']}
              desactive
            />
            <SaisieTags
              libelle="Mots-clés — saisie filtrante"
              options={OPTIONS_OUTILS}
              valeurs={motsCles}
              onChangement={(v) => {
                setMotsCles(v);
                setJournal(`mots-clés : ${v.join(', ') || 'aucun'}`);
              }}
              substitut="Écrire pour filtrer..."
            />
            <SaisieTags
              libelle="Mots-clés — en erreur"
              options={OPTIONS_OUTILS}
              erreur="Au moins un mot-clé est attendu."
              requis
            />
            <SaisieTags
              libelle="Mots-clés — désactivé"
              options={OPTIONS_OUTILS}
              valeursParDefaut={['notion']}
              desactive
            />
          </div>
          <Bloc libelle="PuceChoix — la brique : repos, sélectionnée, désactivée">
            <PuceChoix>Repos</PuceChoix>
            <PuceChoix selectionnee>Sélectionnée</PuceChoix>
            <PuceChoix desactive>Désactivée</PuceChoix>
            <PuceChoix selectionnee desactive>
              Sélectionnée et désactivée
            </PuceChoix>
          </Bloc>
        </Section>

        {/* ==================== DATES ================================= */}
        <Section
          id="dates"
          titre="Dates"
          regle="Le calendrier se pilote entièrement au clavier — flèches pour le jour, PageUp/PageDown pour le mois, Échap pour fermer — et la saisie libre au format JJ/MM/AAAA reste ouverte : personne ne veut cliquer douze fois pour reculer d’un an. Une date absente s’écrit « N/A », le vocabulaire du Figma, jamais un vide."
        >
          <div className="flex flex-wrap items-start gap-10">
            <div>
              <p className="t-caption-hl mb-3 text-[var(--encre-500)]">
                SelecteurDate — panneau ouvert
              </p>
              <SelecteurDate
                valeur={date}
                onChangement={(d) => {
                  setDate(d);
                  setJournal(`date choisie : ${d ? d.toLocaleDateString('fr-FR') : 'aucune'}`);
                }}
                onFermer={() => setJournal('panneau de date fermé')}
                libelle="Prochaine étape"
              />
            </div>
            <div>
              <p className="t-caption-hl mb-3 text-[var(--encre-500)]">
                SelecteurDate — bornes et jours indisponibles
              </p>
              <SelecteurDate
                valeur={null}
                libelle="Entretien final"
                dateMin={new Date(2026, 5, 1)}
                dateMax={new Date(2026, 7, 31)}
                jourDesactive={(d) => d.getDay() === 0 || d.getDay() === 6}
              />
              <p className="t-caption mt-3 max-w-[250px] text-[var(--encre-500)]">
                Week-ends fermés, fenêtre bornée à l’été 2026.
              </p>
            </div>
            <div className="flex flex-col gap-6">
              <div>
                <p className="t-caption-hl mb-3 text-[var(--encre-500)]">
                  LigneDate — la date dans une fiche
                </p>
                <div className="w-[240px] rounded-[var(--r-md)] border border-[var(--encre-100)] bg-white p-2">
                  <LigneDate
                    valeur={date}
                    libelle="Prochaine étape"
                    onOuvrir={() => setJournal('ouverture du calendrier demandée')}
                    onEffacer={() => {
                      setDate(null);
                      setJournal('date effacée')
                    }}
                  />
                  <LigneDate valeur={null} libelle="Date de candidature" />
                </div>
              </div>
              <div>
                <p className="t-caption-hl mb-3 text-[var(--encre-500)]">
                  MentionDate — la date en lecture seule
                </p>
                <div className="flex flex-col items-start gap-2">
                  <MentionDate type="prochaine-etape" date={date} />
                  <MentionDate type="prochaine-etape" date={date} urgent />
                  <MentionDate type="candidature" date={new Date(2026, 4, 5)} />
                  <MentionDate type="candidature" date={null} />
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ==================== STATUTS =============================== */}
        <Section
          id="statuts"
          titre="Statuts de process"
          regle="Le vocabulaire métier, dans son ordre réel : onze étapes, pas dix ni douze. Jaune pour ce qui attend, violet pour ce que l’outil pilote, vert pour les issues positives, rouge pour l’échec. Un statut est une pastille pleine à rayon complet — jamais un point de couleur seul, qui ne dirait rien à qui ne connaît pas le code."
        >
          <Bloc libelle={`StatutProcess — les ${ETAPES.length} étapes, dans l’ordre`}>
            <div className="flex flex-col items-start gap-2.5">
              {ETAPES.map((etape) => (
                <StatutProcess key={etape} etape={etape} />
              ))}
            </div>
          </Bloc>
          <Bloc libelle="StatutTexte — la même étape, en légende de ligne">
            <div className="flex flex-col items-start gap-1.5">
              {ETAPES.map((etape) => (
                <StatutTexte key={etape} etape={etape} />
              ))}
            </div>
          </Bloc>
          <Bloc libelle="CompteurStatut — le pied de colonne d’un kanban">
            <div className="flex flex-col items-start gap-1">
              <CompteurStatut nombre={0} />
              <CompteurStatut nombre={11} />
              <CompteurStatut nombre={248} />
            </div>
          </Bloc>
          <Bloc libelle="TuileCompteur — la tuile de KPI du tableau de bord">
            <div className="flex w-full flex-wrap gap-4">
              <TuileCompteur nombre={12} libelle="Offres ouvertes" />
              <TuileCompteur nombre={248} libelle="Candidat.e.s en process" />
              <TuileCompteur nombre={3} libelle="Qualifications en retard" alerte />
              <TuileCompteur nombre={0} libelle="Send-out à relancer" />
            </div>
          </Bloc>
        </Section>

        {/* ==================== CARTES ================================ */}
        <Section
          id="cartes"
          titre="Cartes"
          regle="Deux régimes, et se tromper coûte cher : « accroche » pour ce qui se regarde (bordure 2 px, ombre rétro), « travail » pour ce qui se parcourt (filet gris de 1 px). Trente cartes d’accroche empilées transforment l’écran en damier ; une carte de travail sur une page vitrine perd la marque."
        >
          <div className="flex flex-wrap items-start gap-6">
            <Carte regime="accroche" className="w-[260px] p-5">
              <p className="t-h3">Régime accroche</p>
              <p className="t-body mt-2 text-[var(--encre-600)]">
                Bordure noire de 2 px et ombre rétro de -3 px.
              </p>
            </Carte>
            <Carte regime="travail" className="w-[260px] p-5">
              <p className="t-h3">Régime travail</p>
              <p className="t-body mt-2 text-[var(--encre-600)]">
                Filet gris de 1 px, aucune ombre.
              </p>
            </Carte>
            <Carte regime="accroche" rayon="lg" survol className="w-[260px] p-5">
              <p className="t-h3">Rayon 16 + survol</p>
              <p className="t-body mt-2 text-[var(--encre-600)]">
                L’ombre passe à -6 px au survol et au focus interne.
              </p>
              <Bouton taille="sm" apparence="contour" className="mt-3">
                Cible focusable
              </Bouton>
            </Carte>
          </div>

          <Bloc libelle="InfoLigne — libellé gris avec l’emoji, valeur noire en gras">
            <Carte className="w-[340px] p-4">
              <div className="flex flex-col gap-2">
                <InfoLigne emoji="💸" libelle="Salaire" valeur="50-55 K" />
                <InfoLigne emoji="📍" libelle="Localisation" valeur="Paris, Lyon ou Nantes" />
                <InfoLigne emoji="💻" libelle="Mode de travail" valeur="Hybride" />
                <InfoLigne libelle="Sans emoji" valeur="Valeur seule" />
              </div>
            </Carte>
          </Bloc>

          <Bloc libelle="Encart — le bloc noir des informations de mandat">
            <div className="w-full max-w-[560px]">
              <Encart
                entrees={[
                  { libelle: 'Hiring manager', valeur: 'Julien Simoes' },
                  { libelle: 'Process', valeur: '4 étapes · 3 semaines' },
                  { libelle: 'Stack', valeur: 'Figma, Linear' },
                  { libelle: 'Équipe', valeur: '6 personnes' },
                ]}
              />
            </div>
          </Bloc>

          <Bloc libelle="EnteteContenu, ContenuCarte, LigneContenu, ItemContenuCarte">
            <Carte className="w-[300px] p-3">
              <EnteteContenu vignette={<Avatar nom="Myriam Sterdam" taille={42} />}>
                <p className="t-caption-bold text-[var(--encre-700)]">Myriam Sterdam</p>
                <p className="t-caption text-[var(--encre-250)]">Lyon</p>
              </EnteteContenu>
              <Divider className="my-3" />
              <ContenuCarte>
                <LigneContenu>
                  <span className="t-caption text-black">Senior Product Manager</span>
                </LigneContenu>
                <LigneContenu compact>
                  <span className="t-caption text-black">💸 90 - 180K</span>
                </LigneContenu>
              </ContenuCarte>
              <ItemContenuCarte ton="mise-en-avant">Open to work — dispo sous 15 jours</ItemContenuCarte>
              <ItemContenuCarte>Prétentions : 90K - 180K</ItemContenuCarte>
            </Carte>
          </Bloc>

          <Bloc libelle="ZoneDefilante — la barre de défilement fine des panneaux">
            <Carte className="w-[300px] p-2">
              <ZoneDefilante className="max-h-[140px]">
                <Liste>
                  {OPTIONS_COMPETENCES.map((o) => (
                    <ListeItem key={o.valeur}>{o.libelle}</ListeItem>
                  ))}
                </Liste>
              </ZoneDefilante>
            </Carte>
          </Bloc>
        </Section>

        {/* ==================== CARTE OFFRE =========================== */}
        <Section
          id="carte-offre"
          titre="Carte offre"
          regle="La carte d’offre est une vitrine : régime accroche, deux gabarits seulement — étroit pour une grille, large pour une liste. C’est le poste qui est le titre, pas l’entreprise : un candidat cherche un métier avant de chercher un logo."
        >
          <div className="flex flex-wrap items-start gap-6">
            <CarteOffre
              client={{ nom: 'Cockpit' }}
              poste="Founding Product Designer"
              contrat="freelance"
              salaire="50-55 K"
              localisation="Paris, Lyon ou Nantes"
              modeDeTravail="Hybride"
              exclusivite
              href="#carte-offre"
              action={{
                libelle: 'Je suis intéressé·e',
                emoji: '👋',
                onClick: () => setJournal('intérêt déclaré sur l’offre Cockpit'),
              }}
            />
            <CarteOffre
              client={null}
              poste="Client confidentiel — Head of Data"
              contrat="cdi"
              salaire="75-90 K"
              localisation="Lyon"
              modeDeTravail="Full remote"
            />
          </div>

          <Bloc libelle="Gabarit large — le seul qui affiche les mots-clés">
            <CarteOffre
              large
              client={{ nom: 'Cockpit' }}
              poste="Founding Product Designer"
              contrat="freelance"
              salaire="50-55 K"
              localisation="Paris, Lyon ou Nantes"
              modeDeTravail="Hybride"
              motsCles={[
                { emoji: '🐓', libelle: 'Boîte FR' },
                { emoji: '✌️', libelle: 'Cible user sympa' },
                { emoji: '🚀', libelle: 'Série B bouclée' },
              ]}
              exclusivite
              action={{
                libelle: 'Je suis intéressé·e',
                emoji: '👋',
                onClick: () => setJournal('intérêt déclaré sur l’offre large'),
              }}
            />
          </Bloc>

          <Bloc libelle="CarteOffreTalent — la même offre vue du côté candidat">
            <CarteOffreTalent
              entreprise="Cockpit"
              poste="Founding Product Designer"
              contrat="Freelance"
              agent="Marion Darnet"
              localisation="Paris"
              salaire="50-55 K"
              action={{
                libelle: 'Candidater',
                onClick: () => setJournal('candidature envoyée à Cockpit'),
              }}
            />
            <CarteOffreTalent
              entreprise="Cockpit"
              poste="Founding Product Designer"
              contrat="Freelance"
              agent="Marion Darnet"
              localisation="Paris"
              salaire="50-55 K"
              statut="interview-1"
              dejaCandidat
              slotStatut={<StatutTexte etape="interview-1" />}
              motivations="Le produit est encore à écrire, et l’équipe cherche quelqu’un pour poser la direction."
            />
          </Bloc>
        </Section>

        {/* ==================== CARTE CANDIDAT ======================== */}
        <Section
          id="carte-candidat"
          titre="Carte candidat"
          regle="Régime travail : elle s’empile par dizaines dans un kanban. La bordure porte la qualification — verte si la qualif est faite, noire sinon — et le manque est ÉCRIT, pas seulement coloré. La densité compacte retire les faits, jamais l’identité ni l’échéance."
        >
          <div className="flex flex-wrap items-start gap-4">
            <CarteCandidat
              nom="Myriam Sterdam"
              ville="Lyon"
              note="excellent"
              qualifie
              statut="en-cours"
              etape="interview-1"
              date="20/06/2026"
              poste="Senior Product Manager"
              contrat="freelance"
              onRetirerContrat={() => setJournal('contrat retiré de la fiche Myriam')}
              pretentions="90 - 180K"
              motivations="Cherche un poste où la discovery n’est pas déjà arbitrée."
            />
            <CarteCandidat
              nom="Valentine Ducharme"
              ville="Paris"
              note="bon"
              qualifie={false}
              statut="en-cours"
              etape="screen-pachamama"
              date="05/07/2026"
              dateAlerte
              poste="Product Designer"
              contrat="cdi"
              pretentions="55 - 65K"
              actionMotivations={{
                libelle: 'Ajouter les motivations',
                onClick: () => setJournal('ajout de motivations demandé'),
              }}
            />
            <CarteCandidat
              nom="Jean-Luc Picard"
              ville="Nantes"
              note="indefini"
              qualifie={false}
              statut="recu"
              date="05/05/2026"
            />
            <CarteCandidat
              nom="Inès Ferreira"
              ville="Lyon"
              note="mauvais"
              qualifie
              statut="en-cours"
              etape="ko"
              date="12/04/2026"
              densite="compacte"
            />
          </div>

          <Bloc libelle="CarteTalent — la carte du portail candidat, en liste puis en kanban">
            <CarteTalent
              nom="Myriam Sterdam"
              ville="Lyon"
              type="liste"
              etape="interview-2"
              disponibilite="Disponible sous 15 jours"
              faits={['Senior Product Manager', '90 - 180K', '8 ans d’expérience']}
              action={{
                libelle: 'Voir la fiche',
                onClick: () => setJournal('ouverture de la fiche Myriam'),
              }}
            />
            <CarteTalent
              nom="Valentine Ducharme"
              ville="Paris"
              type="kanban"
              etape="a-contacter"
              qualifie
              faits={['Product Designer', '55 - 65K']}
              onRetirer={() => setJournal('Valentine retirée de la colonne')}
            />
          </Bloc>
        </Section>

        {/* ==================== LISTES =============================== */}
        <Section
          id="listes"
          titre="Listes"
          regle="Un <ul> réel, pas une pile de div : un lecteur d’écran annonce alors « liste, 4 éléments ». Quand la ligne est activable, elle devient un vrai bouton porteur d’aria-pressed — la bonne sémantique pour ce qu’on active et désactive. Le fond de sélection est très pâle, parce qu’une liste se parcourt."
        >
          <div className="flex flex-wrap items-start gap-6">
            <Carte className="w-[280px] p-2">
              <Liste>
                <ListeItem selectionne>Sélectionné</ListeItem>
                <ListeItem>Au repos</ListeItem>
                <ListeItem desactive>Désactivé</ListeItem>
                <ListeItem>Dernier élément</ListeItem>
              </Liste>
            </Carte>
            <Carte className="w-[280px] p-2">
              <Liste>
                {OPTIONS_AGENTS.map((o) => (
                  <ListeItem
                    key={o.valeur}
                    selectionne={agent === o.valeur}
                    desactive={o.desactive}
                    onClic={() => {
                      setAgent(o.valeur);
                      setJournal(`agent sélectionné dans la liste : ${o.libelle}`);
                    }}
                  >
                    <Avatar nom={o.libelle} taille={30} forme="rond" bordure={false} />
                    {o.libelle}
                  </ListeItem>
                ))}
              </Liste>
            </Carte>
          </div>
        </Section>

        {/* ==================== SÉPARATEUR ============================ */}
        <Section
          id="separateur"
          titre="Séparateur"
          regle="Le trait le plus faible dont le système dispose, et c’est délibéré : dans une interface qui porte déjà des bordures noires de 2 px, un séparateur interne doit se faire oublier. Il ne porte AUCUNE marge — c’est l’espacement du parent qui l’écarte, sinon tout se dédouble."
        >
          <div className="flex flex-wrap items-start gap-10">
            <Carte className="w-[320px] p-4">
              <p className="t-body">Au-dessus</p>
              <Divider className="my-3" />
              <p className="t-body">En dessous</p>
              <Divider className="my-3 bg-[var(--encre-100)]" />
              <p className="t-caption text-[var(--encre-500)]">
                Le second trait est en encre-100, la variante employée dans les cartes.
              </p>
            </Carte>
            <Carte className="flex h-[120px] w-[320px] items-center gap-4 p-4">
              <span className="t-body">Gauche</span>
              <Divider orientation="vertical" />
              <span className="t-body">Droite</span>
            </Carte>
          </div>
        </Section>

        {/* ==================== ÉTAT VIDE ============================= */}
        <Section
          id="etat-vide"
          titre="État vide"
          regle="Un écran qui dit seulement « vide » laisse l’utilisateur se demander s’il a mal cherché ou si l’outil est cassé. D’où la structure imposée : un titre qui NOMME ce qui manque, une phrase qui dit pourquoi, et une action seulement quand il y a une suite à donner — un résultat de recherche vide n’a pas d’action, effacer le filtre appartient au filtre."
        >
          <div className="flex flex-wrap items-stretch gap-6">
            <Carte className="w-[380px]">
              <EtatVide
                titre="Aucune offre sur ce mandat"
                description="Les offres apparaîtront ici dès que le mandat sera cadré avec le client."
                illustration={<Illustration forme="etincelles" className="text-[var(--violet-300)]" />}
                action={
                  <Bouton
                    iconeAvant={<Icone nom="icon-plus" />}
                    onClick={() => setJournal('création d’offre demandée depuis l’état vide')}
                  >
                    Créer une offre
                  </Bouton>
                }
              />
            </Carte>
            <Carte className="w-[380px]">
              <EtatVide
                titre="Aucun résultat pour « senior data »"
                description="Aucun profil ne correspond à ces filtres. Élargissez la séniorité ou la localisation."
                illustration={<Illustration forme="lignes-en-rond" className="text-[var(--encre-200)]" />}
              />
            </Carte>
            <Carte className="w-[380px]">
              <EtatVide titre="Rien à traiter aujourd’hui" />
            </Carte>
          </div>
        </Section>

        {/* ==================== INFOBULLE ============================= */}
        <Section
          id="infobulle"
          titre="Infobulle"
          regle="Elle s’ouvre au survol ET au focus clavier, se ferme à Échap : une infobulle qui n’obéit qu’à la souris est une infobulle inaccessible. Le déclencheur doit être un élément déjà focusable — sinon la bulle existe pour une cible que personne ne peut atteindre. Court : une bulle n’est pas une notice."
        >
          <Bloc libelle="Les quatre côtés — survolez ou tabulez">
            <Infobulle texte="Bulle au-dessus" cote="top">
              <Bouton apparence="contour">Haut</Bouton>
            </Infobulle>
            <Infobulle texte="Bulle en dessous" cote="bottom">
              <Bouton apparence="contour">Bas</Bouton>
            </Infobulle>
            <Infobulle texte="Bulle à gauche" cote="left">
              <Bouton apparence="contour">Gauche</Bouton>
            </Infobulle>
            <Infobulle texte="Bulle à droite" cote="right">
              <Bouton apparence="contour">Droite</Bouton>
            </Infobulle>
          </Bloc>
          <Bloc libelle="Sur un bouton icône, où le dessin seul ne suffirait pas">
            <Infobulle texte="Retirer du mandat">
              <BoutonIcone type="supprimer" taille="lg" />
            </Infobulle>
            <Infobulle texte="Qualif niveau 1 incomplète">
              <BoutonIcone type="voir" taille="lg" />
            </Infobulle>
          </Bloc>
        </Section>

        {/* ==================== NAVIGATION ============================ */}
        <Section
          id="navigation"
          titre="Navigation"
          regle="L’état actif prend le violet en fond plein : c’est le seul endroit où le texte quitte le noir, parce que du noir sur violet 500 passerait sous le seuil de contraste. Une entrée désactivée n’est pas un lien mort — c’est un span annoncé comme indisponible, pour qu’un clavier ne s’y arrête pas."
        >
          <div className="flex flex-wrap items-start gap-10">
            <div>
              <p className="t-caption-hl mb-3 text-[var(--encre-500)]">
                ElementMenu — repos, actif, désactivé
              </p>
              <ul className="flex w-[200px] flex-col gap-1">
                <ElementMenu emoji="⚡" libelle="Les offres" href="#navigation" />
                <ElementMenu emoji="⚡" libelle="Les offres" href="#navigation" actif />
                <ElementMenu emoji="⚡" libelle="Les offres" href="#navigation" desactive />
              </ul>
            </div>
            <div>
              <p className="t-caption-hl mb-3 text-[var(--encre-500)]">
                ElementMenu — variante blanche, sur fond sombre
              </p>
              <ul className="flex w-[200px] flex-col gap-1 rounded-[var(--r-md)] bg-black p-2">
                <ElementMenu
                  emoji="⚡"
                  libelle="Les offres"
                  href="#navigation"
                  variante="blanc"
                />
                <ElementMenu
                  emoji="⚡"
                  libelle="Les offres"
                  href="#navigation"
                  variante="blanc"
                  actif
                />
                <ElementMenu
                  emoji="⚡"
                  libelle="Les offres"
                  href="#navigation"
                  variante="blanc"
                  desactive
                />
              </ul>
            </div>
            <div>
              <p className="t-caption-hl mb-3 text-[var(--encre-500)]">Menu — profil admin</p>
              <Menu
                cheminActif="#navigation"
                sections={SECTIONS_MENU}
                onDeconnexion={() => setJournal('déconnexion demandée')}
              />
            </div>
            <div>
              <p className="t-caption-hl mb-3 text-[var(--encre-500)]">Menu — profil talent</p>
              <Menu
                cheminActif="#carte-offre"
                utilisateur="talent"
                sections={[
                  {
                    entrees: [
                      { emoji: '💼', libelle: 'Mes offres', href: '#carte-offre' },
                      { emoji: '🧑', libelle: 'Mon profil', href: '#avatar' },
                    ],
                  },
                ]}
                onDeconnexion={() => setJournal('déconnexion talent demandée')}
              />
            </div>
          </div>
        </Section>

        {/* ==================== ENTÊTE =============================== */}
        <Section
          id="entete"
          titre="Barre supérieure"
          regle="La recherche est centrée et unique : c’est l’entrée principale dans la base, pas un filtre parmi d’autres. Le compteur de notifications est décoratif — le nombre est répété dans le libellé accessible du bouton, sinon il n’existe que pour ceux qui voient."
        >
          <div className="overflow-hidden rounded-[var(--r-md)] border border-[var(--encre-100)]">
            <Entete
              utilisateur={{ nom: 'Charles Mouchoux' }}
              notifications={3}
              onRecherche={(v) => setJournal(`recherche dans l’en-tête : « ${v} »`)}
              onNotifications={() => setJournal('panneau de notifications ouvert')}
            />
          </div>
          <div className="mt-6 overflow-hidden rounded-[var(--r-md)] border border-[var(--encre-100)]">
            <Entete utilisateur={{ nom: 'Marion Darnet', photoUrl: null }} />
          </div>
          <div className="mt-6 overflow-hidden rounded-[var(--r-md)] border border-[var(--encre-100)]">
            <Entete
              utilisateur={{ nom: 'Julien Simoes' }}
              notifications={12}
              placeholderRecherche="Chercher une entreprise"
            />
          </div>
        </Section>

        <footer className="mt-20 border-t border-[var(--encre-100)] pt-8">
          <p className="t-caption text-[var(--encre-500)]">
            23 composants · {NOMS_ICONES.length} icônes · {FORMES.length} formes ·{' '}
            {ETAPES.length} statuts de process · 14 classes typographiques.
          </p>
        </footer>
      </main>
    </FournisseurInfobulle>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Échafaudage de la page — il n'appartient pas au design system, il ne
   sert qu'à le présenter. D'où des styles écrits ici plutôt que des
   composants ajoutés à components/pacha.
   ══════════════════════════════════════════════════════════════════════ */

function Section({
  id,
  titre,
  regle,
  children,
}: {
  id: string;
  titre: string;
  regle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-20 scroll-mt-8 border-t border-[var(--encre-100)] pt-10">
      <div className="flex items-baseline gap-4">
        <h2 className="t-h2">{titre}</h2>
        <a
          href="#contenu"
          className="t-micro text-[var(--encre-300)] hover:text-black hover:underline"
        >
          ↑ sommaire
        </a>
      </div>
      {regle && <p className="t-body mt-3 max-w-[76ch] text-[var(--encre-600)]">{regle}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Bloc({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="mt-8 first:mt-0">
      <p className="t-caption-hl mb-3 text-[var(--encre-500)]">{libelle}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Palette({
  titre,
  jetons,
}: {
  titre: string;
  jetons: readonly (readonly [string, string])[];
}) {
  return (
    <div className="mb-8">
      <p className="t-caption-hl mb-3 text-[var(--encre-500)]">{titre}</p>
      <div className="flex flex-wrap gap-3">
        {jetons.map(([jeton, libelle]) => (
          <div key={jeton} className="w-[104px]">
            <div
              className="h-14 rounded-[var(--r-md)] border border-black"
              style={{ background: `var(${jeton})` }}
            />
            <p className="t-caption mt-1.5 text-black">{libelle}</p>
            <code className="t-micro text-[var(--encre-400)]">{jeton}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

function Vignette({
  jeton,
  libelle,
  children,
}: {
  jeton: string;
  libelle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-[132px] flex-col items-center gap-2 py-2 text-center">
      {children}
      <code className="t-micro text-[var(--encre-400)]">{jeton}</code>
      <span className="t-caption text-[var(--encre-500)]">{libelle}</span>
    </div>
  );
}
