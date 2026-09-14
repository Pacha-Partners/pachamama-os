"use client";

import { useRef, useState } from "react";

import { Accordeon, SectionAccordeon } from "@/components/pacha/Accordeon";
import { Avatar, AvatarNom } from "@/components/pacha/Avatar";
import { BarreFiltres, type FiltreActif } from "@/components/pacha/BarreFiltres";
import { Bouton } from "@/components/pacha/Bouton";
import { BoutonIcone } from "@/components/pacha/BoutonIcone";
import {
  Carte,
  ContenuCarte,
  Encart,
  EnteteContenu,
  InfoLigne,
  LigneContenu,
  ZoneDefilante,
} from "@/components/pacha/Carte";
import { CarteCandidat, CarteTalent } from "@/components/pacha/CarteCandidat";
import { CarteOffre, CarteOffreTalent } from "@/components/pacha/CarteOffre";
import {
  Case,
  CaseVisuelle,
  GroupeCases,
  GroupeRadio,
  Interrupteur,
  Radio,
} from "@/components/pacha/Cases";
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
} from "@/components/pacha/Champ";
import {
  ChampFourchette,
  type Fourchette,
} from "@/components/pacha/ChampFourchette";
import { ChampNombre } from "@/components/pacha/ChampNombre";
import { ChampTags, PuceChoix, SaisieTags } from "@/components/pacha/ChampTags";
import { Combobox } from "@/components/pacha/Combobox";
import {
  DecorBandeOblique,
  DecorCroissant,
  FondDecor,
} from "@/components/pacha/Decor";
import { Dialogue, DialogueConfirmation } from "@/components/pacha/Dialogue";
import { Divider } from "@/components/pacha/Divider";
import { Etapes, type EtapeFil } from "@/components/pacha/Etapes";
import { Entete } from "@/components/pacha/Entete";
import { EtatErreur } from "@/components/pacha/EtatErreur";
import { EtatVide } from "@/components/pacha/EtatVide";
import {
  FilCommentaires,
  type Commentaire,
} from "@/components/pacha/FilCommentaires";
import {
  FriseActivite,
  type EvenementFrise,
} from "@/components/pacha/FriseActivite";
import {
  FriseParcours,
  type EntreeParcours,
} from "@/components/pacha/FriseParcours";
import { Jauge } from "@/components/pacha/Jauge";
import { Icone, NOMS_ICONES, type NomIcone } from "@/components/pacha/Icone";
import { Kanban, type ColonneKanban } from "@/components/pacha/Kanban";
import { FORMES, Illustration } from "@/components/pacha/Illustration";
import { Feuille } from "@/components/pacha/Feuille";
import { FournisseurInfobulle, Infobulle } from "@/components/pacha/Infobulle";
import {
  ItemContenuCarte,
  Liste,
  ListeItem,
} from "@/components/pacha/ListeItem";
import { LogoComplet, LogoRond, Monogramme } from "@/components/pacha/Logo";
import { ElementMenu, Menu } from "@/components/pacha/Menu";
import { MenuActions } from "@/components/pacha/MenuActions";
import { Notation, type Note } from "@/components/pacha/Notation";
import {
  ListeOnglets,
  Onglet,
  Onglets,
  PanneauOnglet,
} from "@/components/pacha/Onglets";
import { Pagination } from "@/components/pacha/Pagination";
import { PastillePourcentage } from "@/components/pacha/PastillePourcentage";
import {
  type OptionPersonne,
  PastilleReponse,
  Selecteur,
  SelecteurMulti,
  SelecteurPersonne,
  SelecteurUnivers,
} from "@/components/pacha/Selecteur";
import {
  LigneDate,
  MentionDate,
  SelecteurDate,
} from "@/components/pacha/SelecteurDate";
import { SelecteurVue, type Vue } from "@/components/pacha/SelecteurVue";
import {
  Squelette,
  SqueletteCarte,
  SqueletteLigneTableau,
  SqueletteTexte,
} from "@/components/pacha/Squelette";
import {
  CompteurStatut,
  ETAPES,
  StatutProcess,
  StatutTexte,
  TuileCompteur,
} from "@/components/pacha/StatutProcess";
import { Tableau, type ColonneTableau } from "@/components/pacha/Tableau";
import {
  Televersement,
  type EtatTeleversement,
} from "@/components/pacha/Televersement";
import {
  TagAction,
  TagContrat,
  TagInfo,
  TagUnivers,
  type Univers,
} from "@/components/pacha/Tag";
import { Titre, TitreSection } from "@/components/pacha/Titre";
import { FournisseurToasts, useToasts } from "@/components/pacha/Toast";
import { ZoneTexte } from "@/components/pacha/ZoneTexte";
import { cn } from "@/lib/utils";

/**
 * Page de référence du design system.
 *
 * Elle existe pour une raison précise : un design system qu'on ne peut pas
 * regarder n'est pas vérifiable. Chaque section montre les composants dans
 * leurs états réels, à côté de la règle qui les gouverne — de sorte qu'un écart
 * se voie ici, au lieu de se découvrir six écrans plus loin.
 *
 * C'est le SEUL fichier de l'application qui a le droit de tout importer : il
 * sert de test de compilation pour les signatures publiques des 28 composants.
 * Si un lot change une prop sans le dire, cette page cesse de compiler.
 *
 * Composant client parce qu'elle porte des gestionnaires de démonstration —
 * c'est la seule raison, et elle ne concerne que cette page.
 */

const SOMMAIRE: readonly (readonly [string, string])[] = [
  ["couleurs", "Couleurs"],
  ["typographie", "Typographie"],
  ["formes", "Rayons, ombres, densité"],
  ["titre", "Titre"],
  ["logo", "Logo"],
  ["icones", "Icônes"],
  ["illustrations", "Illustrations"],
  ["decor", "Décor de fond"],
  ["avatar", "Avatar"],
  ["boutons", "Boutons"],
  ["boutons-icone", "Boutons icône"],
  ["tags", "Tags"],
  ["notation", "Notation"],
  ["pastille-pourcentage", "Pastille de pourcentage"],
  ["selecteur-vue", "Sélecteur de vue"],
  ["champs", "Champs"],
  ["selecteurs", "Sélecteurs"],
  ["feuille", "Feuille modale"],
  ["cases", "Cases, radios, interrupteur"],
  ["champ-tags", "Champs à tags"],
  ["dates", "Dates"],
  ["statuts", "Statuts de process"],
  ["cartes", "Cartes"],
  ["carte-offre", "Carte offre"],
  ["carte-candidat", "Carte candidat"],
  ["listes", "Listes"],
  ["separateur", "Séparateur"],
  ["etat-vide", "État vide"],
  ["infobulle", "Infobulle"],
  ["navigation", "Navigation"],
  ["entete", "Barre supérieure"],
  ["tableau", "Tableau de données"],
  ["pagination", "Pagination"],
  ["onglets", "Onglets"],
  ["dialogue", "Dialogue"],
  ["toasts", "Toasts"],
  ["squelettes", "Squelettes de chargement"],
  ["etat-erreur", "État d’erreur"],
  ["zone-texte", "Zone de texte"],
  ["menu-actions", "Menu d’actions"],
  ["fil-commentaires", "Fil de commentaires"],
  ["frise", "Frise d’activité"],
  ["barre-filtres", "Barre de filtres"],
  ["kanban", "Kanban"],
  ["jauge", "Jauge"],
  ["etapes", "Fil d’étapes"],
  ["accordeon", "Accordéon"],
  ["champ-nombre", "Champ nombre"],
  ["champ-fourchette", "Champ fourchette"],
  ["combobox", "Combobox"],
  ["televersement", "Téléversement"],
  ["frise-parcours", "Frise de parcours"],
];

/** Un échantillon lisible du jeu de 252 : les icônes que l'app emploie vraiment. */
const ICONES_ECHANTILLON: NomIcone[] = [
  "icon-user",
  "icon-users",
  "icon-user-plus",
  "icon-user-check",
  "icon-briefcase",
  "icon-calendar",
  "icon-clock",
  "icon-mail",
  "icon-send",
  "icon-phone",
  "icon-search",
  "icon-filter",
  "icon-sliders",
  "icon-star",
  "icon-heart",
  "icon-check",
  "icon-check-circle",
  "icon-x",
  "icon-x-circle",
  "icon-alert-triangle",
  "icon-info",
  "icon-bell",
  "icon-settings",
  "icon-edit",
  "icon-trash",
  "icon-download",
  "icon-upload",
  "icon-external-link",
  "icon-link",
  "icon-eye",
  "icon-eye-off",
  "icon-lock",
  "icon-log-out",
  "icon-plus",
  "icon-chevron-down",
  "icon-more-horizontal",
  "icon-map-pin",
  "icon-zap",
  "icon-trending-up",
  "icon-database",
];

/* Les 238 entrées de `ref.metier` ne sont pas exposées au réseau : la vitrine
   en simule une liste longue pour montrer ce que le filtre change. */
const OPTIONS_METIERS = [
  "Product Manager",
  "Product Marketing Manager",
  "Product Designer",
  "Product Owner",
  "Lead Product Manager",
  "Head of Product",
  "Développeur Back-end",
  "Développeuse Front-end",
  "Ingénieur DevOps",
  "Data Analyst",
  "Data Engineer",
  "Data Scientist",
  "Talent Acquisition Manager",
  "Responsable RH",
  "Account Executive",
  "Sales Development Representative",
  "Customer Success Manager",
  "Chief of Staff",
  "VP of Engineering",
  "Engineering Manager",
].map((libelle) => ({
  valeur: libelle.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
  libelle,
}));

const ETAPES_BRIEF: readonly EtapeFil[] = [
  { cle: "poste", libelle: "Le poste" },
  { cle: "cadre", libelle: "Le cadre", detail: "Contrat, lieu, rémunération" },
  { cle: "contenu", libelle: "Le contenu", detail: "Missions et critères" },
  { cle: "relecture", libelle: "Relecture" },
];

const PARCOURS_DEMO: readonly EntreeParcours[] = [
  {
    cle: "p1",
    intitule: "Senior Product Manager",
    employeur: "SantéVet",
    anneeDebut: 2023,
    moisDebut: 4,
    enPoste: true,
    description:
      "Pilotage de la refonte du parcours de souscription. Deux squads, 6 personnes.",
  },
  {
    cle: "p2",
    intitule: "Product Manager",
    employeur: "N2J Soft",
    anneeDebut: 2020,
    moisDebut: 9,
    anneeFin: 2023,
    moisFin: 3,
  },
  {
    cle: "p3",
    intitule: "Chargée de projet digital",
    employeur: "Agence Vertigo",
    anneeDebut: 2018,
    anneeFin: 2020,
  },
];

const NOTES: readonly Note[] = ["excellent", "bon", "mauvais", "indefini"];
const UNIVERS: readonly Univers[] = ["people", "product", "tech", "sales"];

const OPTIONS_SENIORITE = [
  { valeur: "junior", libelle: "Junior" },
  { valeur: "confirme", libelle: "Confirmé.e" },
  { valeur: "senior", libelle: "Senior" },
  { valeur: "lead", libelle: "Lead", desactive: true },
] as const;

const OPTIONS_OUTILS = [
  { valeur: "figma", libelle: "Figma" },
  { valeur: "linear", libelle: "Linear" },
  { valeur: "notion", libelle: "Notion" },
  { valeur: "amplitude", libelle: "Amplitude" },
  { valeur: "segment", libelle: "Segment" },
] as const;

const OPTIONS_COMPETENCES = [
  { valeur: "discovery", libelle: "Discovery" },
  { valeur: "design-system", libelle: "Design system" },
  { valeur: "recherche", libelle: "Recherche utilisateur" },
  { valeur: "data", libelle: "Data produit" },
  { valeur: "growth", libelle: "Growth" },
  { valeur: "roadmap", libelle: "Roadmap" },
  { valeur: "pricing", libelle: "Pricing" },
  { valeur: "b2b", libelle: "B2B SaaS" },
  { valeur: "marketplace", libelle: "Marketplace" },
  { valeur: "fintech", libelle: "Fintech" },
] as const;

const OPTIONS_AGENTS: readonly OptionPersonne[] = [
  { valeur: "marion", libelle: "Marion Darnet" },
  { valeur: "julien", libelle: "Julien Simoes" },
  { valeur: "charles", libelle: "Charles Mouchoux" },
  { valeur: "ines", libelle: "Inès Ferreira", desactive: true },
];

const SECTIONS_MENU = [
  {
    titre: "Database",
    entrees: [
      { emoji: "🎯", libelle: "Dashboard", href: "#navigation" },
      { emoji: "🏢", libelle: "Entreprise", href: "#cartes" },
      { emoji: "🧑", libelle: "Talents", href: "#carte-candidat" },
    ],
  },
  {
    titre: "Jobs",
    entrees: [
      { emoji: "🕹️", libelle: "Pilotage", href: "#statuts" },
      { emoji: "💼", libelle: "Mandats", href: "#carte-offre" },
      { emoji: "📊", libelle: "Reporting", href: "#formes", desactive: true },
    ],
  },
];

/* ── Jeux de démonstration des surfaces applicatives ──────────────────────
   Déclarés au niveau du module : `Tableau` rebâtit son modèle de lignes dès
   que la référence de `lignes` change, et un tableau littéral écrit dans le
   rendu changerait de référence à chaque frappe ailleurs sur la page.      */

type LigneMandat = {
  id: string;
  reference: string;
  poste: string;
  entreprise: string;
  univers: Univers;
  contrat: string;
  candidatures: number;
  ouvertLe: string;
};

const LIGNES_MANDATS: LigneMandat[] = [
  { id: "m1", reference: "#001", poste: "Product Manager", entreprise: "Hublo", univers: "product", contrat: "cdi", candidatures: 12, ouvertLe: "2026-02-03" },
  { id: "m2", reference: "#002", poste: "Data Engineer", entreprise: "N2J Soft", univers: "tech", contrat: "cdi", candidatures: 4, ouvertLe: "2026-03-17" },
  { id: "m3", reference: "#003", poste: "Talent Acquisition", entreprise: "Prose", univers: "people", contrat: "freelance", candidatures: 0, ouvertLe: "2026-01-08" },
  { id: "m4", reference: "#004", poste: "Account Executive", entreprise: "Hublo", univers: "sales", contrat: "cdi", candidatures: 27, ouvertLe: "2026-04-22" },
  { id: "m5", reference: "#005", poste: "Designer produit", entreprise: "Prose", univers: "product", contrat: "cdd", candidatures: 8, ouvertLe: "2025-11-30" },
  { id: "m6", reference: "#006", poste: "Lead Backend", entreprise: "N2J Soft", univers: "tech", contrat: "cdi", candidatures: 15, ouvertLe: "2026-05-11" },
  { id: "m7", reference: "#007", poste: "Office Manager", entreprise: "Hublo", univers: "people", contrat: "cdi", candidatures: 2, ouvertLe: "2026-06-02" },
];

const COLONNES_MANDATS: ColonneTableau<LigneMandat>[] = [
  {
    cle: "reference",
    entete: "Réf.",
    largeur: 72,
    cellule: (l) => <span className="t-body-hl">{l.reference}</span>,
    triSur: (l) => l.reference,
  },
  {
    cle: "poste",
    entete: "Poste",
    cellule: (l) => <span className="t-body-hl text-black">{l.poste}</span>,
    triSur: (l) => l.poste,
  },
  {
    cle: "entreprise",
    entete: "Entreprise",
    cellule: (l) => l.entreprise,
    triSur: (l) => l.entreprise,
    masquerEnMobile: true,
  },
  {
    cle: "univers",
    entete: "Univers",
    largeur: 130,
    cellule: (l) => <TagUnivers univers={l.univers} />,
  },
  {
    cle: "contrat",
    entete: "Contrat",
    largeur: 120,
    cellule: (l) => <TagContrat contrat={l.contrat} />,
    triSur: (l) => l.contrat,
  },
  {
    cle: "candidatures",
    entete: "Candidatures",
    largeur: 120,
    alignement: "droite",
    cellule: (l) => l.candidatures,
    triSur: (l) => l.candidatures,
  },
  {
    cle: "ouvertLe",
    entete: "Ouvert le",
    largeur: 120,
    cellule: (l) => new Date(l.ouvertLe).toLocaleDateString("fr-FR"),
    triSur: (l) => new Date(l.ouvertLe),
    masquerEnMobile: true,
  },
];

/** 96 lignes, pour que la pagination et la virtualisation aient de quoi mordre. */
const LIGNES_LONGUES: LigneMandat[] = Array.from({ length: 96 }, (_, i) => {
  const modele = LIGNES_MANDATS[i % LIGNES_MANDATS.length];
  return {
    ...modele,
    id: `long-${i}`,
    reference: `#${String(i + 1).padStart(3, "0")}`,
    candidatures: (i * 7) % 40,
  };
});

const COMMENTAIRES_DEMO: Commentaire[] = [
  {
    id: "c1",
    auteur: { nom: "Marion Darnet" },
    ecritLe: "2026-06-14T09:41:00.000Z",
    corps: "Premier échange fait. Très bon niveau sur la partie discovery, un peu moins à l’aise sur le pricing.\nÀ recadrer avant le send-out.",
  },
  {
    id: "c2",
    auteur: { nom: "Julien Simoes" },
    ecritLe: "2026-06-16T15:02:00.000Z",
    corps: "Argumentaire envoyé au client. Ils veulent la rencontrer la semaine prochaine.",
    partageClient: true,
  },
  {
    id: "c3",
    auteur: { nom: "Charles Mouchoux" },
    ecritLe: "2026-06-17T08:15:00.000Z",
    corps: "Créneau confirmé jeudi 14h.",
    deMoi: true,
  },
];

const EVENEMENTS_DEMO: EvenementFrise[] = [
  {
    id: "e1",
    icone: "icon-check-circle",
    libelle: "Étape modifiée",
    avant: "Interview 1",
    apres: "Interview 2",
    date: "2026-06-17T08:15:00.000Z",
    auteur: "Charles Mouchoux",
  },
  {
    id: "e2",
    icone: "icon-eye",
    libelle: "Note partagée avec le client",
    date: "2026-06-16T15:02:00.000Z",
    auteur: "Julien Simoes",
    detail: "Argumentaire envoyé au client.",
  },
  {
    id: "e3",
    icone: "icon-user",
    libelle: "Agent·e assigné·e",
    avant: "Non assignée",
    apres: "Marion Darnet",
    date: "2026-06-14T09:30:00.000Z",
    auteur: "le système",
  },
  {
    id: "e4",
    libelle: "Candidature créée",
    apres: "Send out",
    date: "2026-06-12T11:00:00.000Z",
    auteur: "Pachamama",
  },
];

const ACTIONS_DEMO_MENU = [
  { cle: "voir", libelle: "Voir la fiche", icone: "icon-eye" as NomIcone },
  { cle: "note", libelle: "Ajouter une note", icone: "icon-message-square" as NomIcone },
  { cle: "relancer", libelle: "Relancer le client", icone: "icon-send" as NomIcone, desactive: true },
  {
    cle: "retirer",
    libelle: "Retirer du process",
    icone: "icon-trash" as NomIcone,
    destructive: true,
    separateurAvant: true,
  },
];

const COLONNES_KANBAN_LIBELLES: { cle: string; libelle: string; couleur: string }[] = [
  { cle: "send-out", libelle: "Send out", couleur: "#58D5A7" },
  { cle: "interview-1", libelle: "Interview 1", couleur: "#FFEA4D" },
  { cle: "interview-2", libelle: "Interview 2", couleur: "#FFEA4D" },
  { cle: "recrute", libelle: "Recruté·e", couleur: "#58D5A7" },
];

export function Specimen() {
  const [vue, setVue] = useState<Vue>("cartes");
  const [seniorite, setSeniorite] = useState<string | null>("senior");
  const [outils, setOutils] = useState<string[]>(["figma", "linear"]);
  const [universChoisis, setUniversChoisis] = useState<Univers[]>([
    "product",
    "tech",
  ]);
  const [agent, setAgent] = useState<string | null>("marion");
  const [caseCochee, setCaseCochee] = useState(true);
  const [radio, setRadio] = useState<unknown>("cdi");
  const [interrupteur, setInterrupteur] = useState(true);
  const [competences, setCompetences] = useState<string[]>([
    "discovery",
    "data",
  ]);
  const [motsCles, setMotsCles] = useState<string[]>(["figma"]);
  const [date, setDate] = useState<Date | null>(new Date(2026, 5, 20));
  const [contratRetire, setContratRetire] = useState(false);
  const [journal, setJournal] = useState("aucune");
  const [feuilleSimple, setFeuilleSimple] = useState(false);
  const [feuilleLongue, setFeuilleLongue] = useState(false);
  // Les cases de la vitrine cochent pour de bon : une démonstration inerte ne
  // montre ni l'état sélectionné de `ListeItem`, ni la case remplie.
  const [universFeuille, setUniversFeuille] = useState<string[]>(["tech"]);
  const [optionsFeuille, setOptionsFeuille] = useState<number[]>([]);

  /* Les surfaces applicatives. */
  const [chargementTableau, setChargementTableau] = useState(false);
  const [ligneOuverte, setLigneOuverte] = useState<string | null>(null);
  const [pagePagination, setPagePagination] = useState(1);
  const [taillePagination, setTaillePagination] = useState(25);
  const [ongletActif, setOngletActif] = useState("ouverts");
  const [dialogueOuvert, setDialogueOuvert] = useState(false);
  const [confirmationOuverte, setConfirmationOuverte] = useState(false);
  const [note, setNote] = useState("");
  const [commentaires, setCommentaires] =
    useState<Commentaire[]>(COMMENTAIRES_DEMO);
  const [filtresChoisis, setFiltresChoisis] = useState<string[]>([
    "univers-tech",
    "contrat-cdi",
    "ville-lyon",
  ]);
  const declencheurDialogue = useRef<HTMLButtonElement>(null);
  const declencheurConfirmation = useRef<HTMLButtonElement>(null);

  /* Les surfaces de saisie de soi. */
  const [etapeBrief, setEtapeBrief] = useState(1);
  const [anneesXp, setAnneesXp] = useState<number | null>(8);
  const [tjm, setTjm] = useState<number | null>(650);
  const [salaire, setSalaire] = useState<Fourchette>({ min: 55, max: 70 });
  const [salaireCroise, setSalaireCroise] = useState<Fourchette>({
    min: 80,
    max: 45,
  });
  const [metier, setMetier] = useState<string | null>("product_manager");
  const [cv, setCv] = useState<File | null>(null);
  const [etatCv, setEtatCv] = useState<EtatTeleversement>({ phase: "repos" });
  const [parcours, setParcours] = useState<EntreeParcours[]>([
    ...PARCOURS_DEMO,
  ]);

  const FILTRES_POSSIBLES: Record<string, FiltreActif> = {
    "univers-tech": {
      cle: "univers-tech",
      libelle: "Tech",
      axe: "Univers",
      univers: "tech",
      onRetirer: () =>
        setFiltresChoisis((f) => f.filter((c) => c !== "univers-tech")),
    },
    "contrat-cdi": {
      cle: "contrat-cdi",
      libelle: "CDI",
      axe: "Contrat",
      onRetirer: () =>
        setFiltresChoisis((f) => f.filter((c) => c !== "contrat-cdi")),
    },
    "ville-lyon": {
      cle: "ville-lyon",
      libelle: "Lyon",
      axe: "Localisation",
      onRetirer: () =>
        setFiltresChoisis((f) => f.filter((c) => c !== "ville-lyon")),
    },
  };

  const COLONNES_KANBAN: ColonneKanban[] = COLONNES_KANBAN_LIBELLES.map(
    (colonne, index) => ({
      ...colonne,
      cartes:
        index === 3
          ? []
          : Array.from({ length: 3 - index }, (_, i) => ({
              cle: `${colonne.cle}-${i}`,
              libelle: `Candidature #00${index * 3 + i + 1}`,
              contenu: (
                <CarteCandidat
                  nom={`Candidat·e #00${index * 3 + i + 1}`}
                  ville="Lyon"
                  densite="compacte"
                  statut="en-cours"
                  qualifie={i === 0}
                  poste="Product Manager"
                />
              ),
            })),
    }),
  );

  return (
    <FournisseurInfobulle>
      <FournisseurToasts>
      <main id="contenu" className="mx-auto max-w-[1180px] px-8 py-16">
        {/* ============================================================== */}
        <header>
          <Titre
            niveau={1}
            descriptif="Le système de conception de"
            impact="Pachamama OS"
          />
          <p className="t-body mt-5 max-w-[68ch] text-[var(--encre-600)]">
            Identité issue du design system de marque ; couche interface
            extraite du Figma de l’application. Les valeurs ne sont pas
            interprétées : elles viennent des deux sources, et les arbitrages
            sont documentés dans{" "}
            <code className="rounded bg-[var(--encre-050)] px-1">
              styles/app.css
            </code>
            . Cette page importe les 41 composants du dossier{" "}
            <code className="rounded bg-[var(--encre-050)] px-1">
              components/pacha
            </code>{" "}
            : elle sert aussi de test de compilation de leurs signatures
            publiques.
          </p>
          <p className="t-caption mt-4 text-[var(--encre-500)]">
            Dernière action de démonstration :{" "}
            <strong className="t-caption-bold">{journal}</strong>
          </p>
        </header>

        {/* ============================================================== */}
        <nav aria-label="Sommaire" className="mt-10">
          <Carte className="p-6">
            <p className="t-caption-bold mb-4 text-[var(--encre-500)]">
              Sommaire
            </p>
            <ul className="grid grid-cols-2 gap-x-8 gap-y-2 md:grid-cols-4">
              {SOMMAIRE.map(([id, libelle], i) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="t-body flex items-baseline gap-2 text-black hover:underline"
                  >
                    <span className="t-micro-bold w-4 shrink-0 text-[var(--encre-300)]">
                      {String(i + 1).padStart(2, "0")}
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
              ["--cream", "Crème de marque"],
              ["--white", "Blanc"],
              ["--black", "Noir : texte, bordures, action"],
              ["--fond-page", "Fond de page"],
              ["--fond-carte", "Fond de carte"],
              ["--fond-entete", "Barre supérieure"],
              ["--fond-inerte", "Zone inerte"],
            ]}
          />
          <Palette
            titre="Verticale People — accent seulement"
            jetons={[
              ["--people-500", "500"],
              ["--people-300", "300"],
              ["--people-200", "200"],
              ["--people-100", "100"],
            ]}
          />
          <Palette
            titre="Verticale Product"
            jetons={[
              ["--product-500", "500"],
              ["--product-300", "300"],
              ["--product-200", "200"],
              ["--product-100", "100"],
            ]}
          />
          <Palette
            titre="Verticale Tech"
            jetons={[
              ["--tech-500", "500"],
              ["--tech-300", "300"],
              ["--tech-200", "200"],
              ["--tech-100", "100"],
            ]}
          />
          <Palette
            titre="Verticale Revenue"
            jetons={[
              ["--revenue-500", "500"],
              ["--revenue-300", "300"],
              ["--revenue-200", "200"],
              ["--revenue-100", "100"],
            ]}
          />
          <Palette
            titre="Violet interactif — extension d’interface (9 teintes)"
            jetons={[
              ["--violet-900", "900"],
              ["--violet-700", "700"],
              ["--violet-600", "600"],
              ["--violet-500", "500"],
              ["--violet-400", "400"],
              ["--violet-300", "300"],
              ["--violet-200", "200"],
              ["--violet-100", "100"],
              ["--violet-050", "050"],
            ]}
          />
          <Palette
            titre="Encre — la donnée (11 teintes)"
            jetons={[
              ["--encre-900", "900"],
              ["--encre-800", "800"],
              ["--encre-700", "700"],
              ["--encre-600", "600"],
              ["--encre-500", "500"],
              ["--encre-400", "400"],
              ["--encre-300", "300"],
              ["--encre-250", "250"],
              ["--encre-200", "200"],
              ["--encre-100", "100"],
              ["--encre-050", "050"],
            ]}
          />
          <Palette
            titre="Statuts de process — le vocabulaire métier"
            jetons={[
              ["--statut-attente", "attente"],
              ["--statut-avance", "avance"],
              ["--statut-positif", "positif"],
              ["--statut-echec", "échec"],
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
                ["t-h1", "Title H1 — Bricolage Grotesque 700 · 30/36"],
                [
                  "t-h1-comp",
                  "Title H1 complementary — Instrument Serif 400 · 30/39",
                ],
                ["t-h2", "Title H2 — Bricolage Grotesque 700 · 24/29"],
                [
                  "t-h2-comp",
                  "Title H2 complementary — Instrument Serif 400 · 24/31",
                ],
                ["t-h3", "Title H3 — Bricolage Grotesque 700 · 18/22"],
                ["t-body", "Body regular — Host Grotesk 400 · 14/19"],
                ["t-body-hl", "Body highlight — Host Grotesk 500 · 14/19"],
                ["t-body-bold", "Body bold — Host Grotesk 700 · 14/19"],
                ["t-caption", "Caption regular — Host Grotesk 400 · 12/16"],
                [
                  "t-caption-hl",
                  "Caption highlight — Host Grotesk 500 · 12/16",
                ],
                ["t-caption-bold", "Caption bold — Host Grotesk 700 · 12/16"],
                ["t-micro", "Micro regular — Host Grotesk 400 · 10/12"],
                ["t-micro-hl", "Micro highlight — Host Grotesk 500 · 10/12"],
                ["t-micro-bold", "Micro bold — Host Grotesk 700 · 10/12"],
              ] as const
            ).map(([classe, libelle]) => (
              <div key={classe} className="flex items-baseline gap-6">
                <code className="t-micro w-[110px] shrink-0 text-[var(--encre-400)]">
                  {classe}
                </code>
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
                ["--r-xs", "4 px"],
                ["--r-sm", "6 px"],
                ["--r-md", "8 px — le défaut"],
                ["--r-ml", "12 px — blocs de fiche"],
                ["--r-lg", "16 px"],
                ["--r-full", "complet"],
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
                ["--ombre-1", "tags"],
                ["--ombre-2", "petits boutons"],
                ["--ombre-3", "boutons, cartes"],
                ["--ombre-6", "cartes d’accroche"],
                ["--ombre-1-grise", "tag atténué"],
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
                ["--ombre-douce", "champ au focus"],
                ["--ombre-portee", "survol de ligne"],
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
                ["--shadow-retro", "-8 px"],
                ["--shadow-retro-sm", "-5 px"],
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
                  ["--h-champ", "36 px", "champ de saisie"],
                  ["--h-tag", "27 px", "tag univers, tag contrat"],
                  ["--h-statut", "35 px", "pastille de statut, tag action"],
                  ["--h-menu-item", "31 px", "élément de menu"],
                  ["--h-ligne-compacte", "36 px", "ligne de tableau dense"],
                  ["--h-ligne", "44 px", "ligne de tableau"],
                ] as const
              ).map(([jeton, valeur, usage]) => (
                <div key={jeton} className="flex items-baseline gap-4">
                  <code className="t-micro w-[150px] shrink-0 text-[var(--encre-400)]">
                    {jeton}
                  </code>
                  <span className="t-caption-bold w-[60px] shrink-0">
                    {valeur}
                  </span>
                  <span className="t-caption text-[var(--encre-500)]">
                    {usage}
                  </span>
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
            <Titre
              niveau={1}
              descriptif="Le tableau de bord de"
              impact="votre sourcing"
            />
            <Titre
              niveau={2}
              descriptif="Les offres en cours chez"
              impact="Cockpit"
            />
            <Titre impact="Sans ligne descriptive — à réserver aux titres d’interface" />
            <div>
              <p className="t-micro mb-2 text-[var(--encre-400)]">
                ton — la couleur des deux lignes, jamais celle d’une seule
              </p>
              <div className="flex flex-wrap items-start gap-6">
                <div className="rounded-[var(--r-md)] border border-[var(--encre-100)] p-5">
                  <Titre
                    niveau={2}
                    disposition="ligne"
                    descriptif="La review"
                    impact="Pachamama"
                  />
                  <code className="t-micro mt-3 block text-[var(--encre-400)]">
                    defaut
                  </code>
                </div>
                <div className="rounded-[var(--r-md)] bg-black p-5">
                  <Titre
                    niveau={2}
                    disposition="ligne"
                    descriptif="La review"
                    impact="Pachamama"
                    ton="inverse"
                  />
                  <code className="t-micro mt-3 block text-[var(--encre-300)]">
                    inverse — sur fond sombre
                  </code>
                </div>
                <div className="rounded-[var(--r-md)] border border-[var(--encre-100)] p-5">
                  <Titre
                    niveau={2}
                    disposition="ligne"
                    descriptif="La review"
                    impact="Pachamama"
                    ton="discret"
                  />
                  <code className="t-micro mt-3 block text-[var(--encre-400)]">
                    discret — second plan
                  </code>
                </div>
              </div>
            </div>
            <div>
              <p className="t-micro mb-2 text-[var(--encre-400)]">
                TitreSection
              </p>
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
            Jeu Feather servi par lucide-react —{" "}
            <strong className="t-caption-bold">
              {NOMS_ICONES.length} icônes
            </strong>{" "}
            disponibles, cote unique de 24 × 24. Échantillon de{" "}
            {ICONES_ECHANTILLON.length} ci-dessous.
          </p>
          <ul className="grid grid-cols-4 gap-x-4 gap-y-5 sm:grid-cols-6 md:grid-cols-8">
            {ICONES_ECHANTILLON.map((nom) => (
              <li
                key={nom}
                className="flex flex-col items-center gap-1.5 text-center"
              >
                <Icone nom={nom} />
                <code className="t-micro break-all text-[var(--encre-400)]">
                  {nom.replace("icon-", "")}
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
            <strong className="t-caption-bold">{FORMES.length} formes</strong>,
            dans l’ordre du Figma.
          </p>
          <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-5 md:grid-cols-7">
            {FORMES.map((forme) => (
              <li
                key={forme}
                className="flex flex-col items-center gap-2 text-center"
              >
                <Illustration forme={forme} className="size-12 text-black" />
                <code className="t-micro text-[var(--encre-400)]">{forme}</code>
              </li>
            ))}
          </ul>
          <Bloc libelle="Teintes — la forme suit la couleur du texte">
            <Illustration forme="etoiles" className="size-16 text-black" />
            <Illustration
              forme="etoiles"
              className="size-16 text-[var(--violet-500)]"
            />
            <Illustration
              forme="etoiles"
              className="size-16 text-[var(--product-500)]"
            />
            <Illustration
              forme="etoiles"
              className="size-16 text-[var(--encre-200)]"
            />
          </Bloc>
        </Section>

        {/* ==================== DÉCOR DE FOND ========================= */}
        <Section
          id="decor"
          titre="Décor de fond"
          regle="Ces formes ne sont pas des illustrations : elles vivent derrière le contenu, ancrées aux bords de l’écran, et ne doivent jamais capter le clic. Elles sont posées en `aria-hidden` et en `pointer-events-none` — un lecteur d’écran n’a rien à y lire."
        >
          <Bloc libelle="FondDecor — la composition complète, telle qu’elle est posée sur le job board">
            <div className="relative h-[240px] w-full overflow-hidden rounded-[var(--r-md)] border border-[var(--encre-100)] bg-[var(--fond-page)]">
              <FondDecor />
              <p className="t-caption absolute inset-x-0 bottom-3 text-center text-[var(--encre-500)]">
                le contenu passe par-dessus
              </p>
            </div>
          </Bloc>
          <Bloc libelle="Les deux formes, isolées">
            <div className="relative h-[160px] w-[260px] overflow-hidden rounded-[var(--r-md)] border border-[var(--encre-100)] bg-[var(--fond-page)]">
              <DecorBandeOblique className="absolute inset-0" />
              <code className="t-micro absolute bottom-2 left-2 text-[var(--encre-400)]">
                DecorBandeOblique
              </code>
            </div>
            <div className="relative h-[160px] w-[260px] overflow-hidden rounded-[var(--r-md)] border border-[var(--encre-100)] bg-[var(--fond-page)]">
              <DecorCroissant className="absolute inset-0" />
              <code className="t-micro absolute bottom-2 left-2 text-[var(--encre-400)]">
                DecorCroissant
              </code>
            </div>
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
            <Avatar
              nom="Jean-Luc Picard"
              taille={56}
              forme="carre"
              bordure={false}
            />
          </Bloc>
          <Bloc libelle="Repli sur URL morte — les initiales, jamais l’icône d’image brisée">
            <Avatar
              nom="Valentine Ducharme"
              src="/photo-absente.jpg"
              taille={56}
            />
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
            <Bouton
              apparence="contour-ombre"
              iconeAvant={<Icone nom="icon-plus" />}
            >
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
            <Bouton
              apparence="contour"
              iconeApres={<Icone nom="icon-chevron-down" />}
            >
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
            <Bouton
              onClick={() => setJournal("clic sur « Je suis intéressé·e »")}
            >
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
            <BoutonIcone
              type="supprimer"
              libelle="Retirer ce candidat du mandat"
              taille="lg"
            />
            <BoutonIcone type="modifier" taille="lg" disabled />
            <BoutonIcone
              type="envoyer"
              taille="lg"
              onClick={() =>
                setJournal("envoi déclenché depuis un bouton icône")
              }
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
              <TagUnivers
                key={u}
                univers={u}
                onRetirer={() => setJournal(`tag ${u} retiré`)}
              />
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
                  setJournal("tag contrat retiré");
                }}
              />
            )}
            {contratRetire && (
              <Bouton
                taille="sm"
                apparence="contour"
                onClick={() => {
                  setContratRetire(false);
                  setJournal("tag contrat rétabli");
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
            <TagAction
              onClick={() => setJournal("filtre « B2B SaaS » basculé")}
            >
              B2B SaaS
            </TagAction>
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
              <Notation
                note="excellent"
                className="absolute -left-1 -top-1.5"
              />
            </span>
          </Bloc>
        </Section>

        {/* ==================== PASTILLE DE POURCENTAGE =============== */}
        <Section
          id="pastille-pourcentage"
          titre="Pastille de pourcentage"
          regle="Zéro est une valeur, pas une absence : « 0 % Management » dit quelque chose de précis sur un poste, et la maquette l’affiche. C’est au domaine de décider si le bloc entier existe ; le composant, lui, montre toujours ce qu’on lui donne. Le disque porte la signature de marque — filet noir, ombre rétro — appliquée à un cercle."
        >
          <Bloc libelle="La répartition d’un poste, axe par axe">
            <PastillePourcentage libelle="Sourcing" pourcentage={40} />
            <PastillePourcentage libelle="Qualification" pourcentage={30} />
            <PastillePourcentage libelle="Closing" pourcentage={20} />
            <PastillePourcentage libelle="Management" pourcentage={0} />
            <PastillePourcentage libelle="Une valeur pleine" pourcentage={100} />
          </Bloc>
          <Bloc libelle="Le libellé passe à la ligne, le disque ne bouge pas">
            <PastillePourcentage
              libelle="Accompagnement des équipes"
              pourcentage={10}
              className="w-[104px]"
            />
            <PastillePourcentage libelle="Ops" pourcentage={65} />
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
            <SelecteurVue
              vue="cartes"
              onChanger={() => setJournal("bascule (démo figée)")}
            />
            <SelecteurVue
              vue="kanban"
              onChanger={() => setJournal("bascule (démo figée)")}
            />
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
            <Champ
              libelle="Recherche"
              recherche
              placeholder="Chercher un.e candidat.e"
            />
            <Champ
              libelle="Recherche avec bouton"
              recherche
              placeholder="Chercher un.e candidat.e"
              onRechercher={() => setJournal("recherche lancée")}
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
            <Champ
              libelle="Recherche désactivée"
              recherche
              placeholder="Indisponible"
              disabled
            />
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
                className={cn(
                  CHAMP_BOITIER,
                  CHAMP_VALEUR,
                  CHAMP_SUBSTITUT_SAISIE,
                  CHAMP_SURVOL,
                )}
              />
              <MessageErreur id="demo-erreur">
                MessageErreur, hors de tout champ.
              </MessageErreur>
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
                setJournal(`séniorité : ${v ?? "aucune"}`);
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
                setJournal(`outils : ${v.join(", ") || "aucun"}`);
              }}
              substitut="Choisir des outils"
            />
            <SelecteurMulti
              libelle="Outils — multiple, en compte"
              options={OPTIONS_OUTILS}
              valeursParDefaut={["figma", "linear", "notion"]}
              apparenceValeur="compte"
            />
            <SelecteurUnivers
              libelle="Univers — le tag comme option"
              options={UNIVERS.map((u) => ({ valeur: u }))}
              valeurs={universChoisis}
              onChangement={(v) => {
                setUniversChoisis(v);
                setJournal(`univers : ${v.join(", ") || "aucun"}`);
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
                setJournal(`agent : ${v ?? "aucun"}`);
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

        {/* ==================== FEUILLE =============================== */}
        <Section
          id="feuille"
          titre="Feuille modale"
          regle="Elle n’existe qu’en mobile, et c’est une règle de conception, pas une limite technique : en desktop les mêmes choix se font dans une liste déroulante ancrée à son champ, qui laisse la page visible. Une surface qui couvre tout l’écran pour cocher trois cases y serait une régression. Sa fermeture ne dépend JAMAIS d’une animation — un « transitionend » peut ne pas arriver, et une feuille restée ouverte bloque la page entière."
        >
          <Bloc libelle="Les deux boutons du pied sont fournis par l’appelant — ici « contour » et « plein »">
            <Bouton apparence="contour" onClick={() => setFeuilleSimple(true)}>
              Ouvrir une feuille
            </Bouton>
            <Feuille
              titre="Univers"
              ouverte={feuilleSimple}
              onOuvertureChange={setFeuilleSimple}
              actions={
                <>
                  <Bouton
                    apparence="contour"
                    onClick={() => {
                      setFeuilleSimple(false);
                      setJournal("feuille annulée");
                    }}
                  >
                    Annuler
                  </Bouton>
                  <Bouton
                    apparence="plein"
                    onClick={() => {
                      setFeuilleSimple(false);
                      setJournal("feuille enregistrée");
                    }}
                  >
                    Enregistrer
                  </Bouton>
                </>
              }
            >
              <ul className="flex flex-col gap-2">
                {(["product", "tech", "sales", "people"] as const).map((u) => {
                  const cochee = universFeuille.includes(u);
                  return (
                    <ListeItem
                      key={u}
                      selectionne={cochee}
                      onClic={() => {
                        setUniversFeuille((v) =>
                          cochee ? v.filter((x) => x !== u) : [...v, u],
                        );
                        setJournal(
                          `univers ${cochee ? "décoché" : "coché"} : ${u}`,
                        );
                      }}
                    >
                      <CaseVisuelle cochee={cochee} />
                      <TagUnivers univers={u} />
                    </ListeItem>
                  );
                })}
              </ul>
            </Feuille>
          </Bloc>

          <Bloc libelle="Contenu long — c’est la LISTE qui défile, jamais le pied : les boutons restent atteignables">
            <Bouton apparence="contour" onClick={() => setFeuilleLongue(true)}>
              Ouvrir une feuille de trente options
            </Bouton>
            <Feuille
              titre="Métier"
              ouverte={feuilleLongue}
              onOuvertureChange={setFeuilleLongue}
              actions={
                <>
                  <Bouton
                    apparence="contour"
                    onClick={() => setFeuilleLongue(false)}
                  >
                    Annuler
                  </Bouton>
                  <Bouton
                    apparence="plein"
                    onClick={() => setFeuilleLongue(false)}
                  >
                    Enregistrer
                  </Bouton>
                </>
              }
            >
              <ul className="flex flex-col gap-2">
                {Array.from({ length: 30 }, (_, i) => {
                  const cochee = optionsFeuille.includes(i);
                  return (
                    <ListeItem
                      key={i}
                      selectionne={cochee}
                      onClic={() =>
                        setOptionsFeuille((v) =>
                          cochee ? v.filter((x) => x !== i) : [...v, i],
                        )
                      }
                    >
                      <CaseVisuelle cochee={cochee} />
                      Option numéro {i + 1}
                    </ListeItem>
                  );
                })}
              </ul>
            </Feuille>
          </Bloc>

          <Bloc libelle="Liste vide — elle se dit, elle ne se laisse pas deviner">
            <SelecteurMulti
              libelle="Métier — aucune option publiée"
              options={[]}
              substitut="Choisir un métier"
              aide="Sous 768 px, ouvrez-le : la feuille annonce l’absence d’options au lieu de montrer 453 px de blanc."
              className="w-[260px]"
            />
          </Bloc>

          <Bloc libelle="Où elle apparaît d’elle-même">
            <p className="t-body max-w-[620px] text-[var(--encre-600)]">
              Sous&nbsp;768&nbsp;px,{" "}
              <code className="t-body-bold">SelecteurMulti</code> et{" "}
              <code className="t-body-bold">SelecteurUnivers</code> ouvrent une
              feuille au lieu de leur liste déroulante, et leurs choix y
              deviennent un brouillon qu’il faut enregistrer. Rétrécissez la
              fenêtre puis rouvrez un filtre de la section
              «&nbsp;Sélecteurs&nbsp;» pour le constater : ce n’est pas le même
              arbre, donc pas seulement une autre mise en forme.
            </p>
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
              <p className="t-caption-hl text-[var(--encre-500)]">
                Case — tous les états
              </p>
              <Case libelle="Non cochée" />
              <Case libelle="Cochée par défaut" defaultChecked />
              <Case
                libelle={`Contrôlée : ${caseCochee ? "cochée" : "décochée"}`}
                checked={caseCochee}
                onCheckedChange={(v) => {
                  setCaseCochee(v);
                  setJournal(`case ${v ? "cochée" : "décochée"}`);
                }}
              />
              <Case libelle="Désactivée" disabled />
              <Case libelle="Désactivée et cochée" disabled defaultChecked />
              <Case
                libelle="En erreur"
                erreur="Vous devez accepter pour continuer."
              />
              <div className="flex items-center gap-3">
                <span className="t-caption text-[var(--encre-500)]">
                  Sans libellé :
                </span>
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
              <GroupeRadio
                libelle="Disposition en colonne"
                disposition="colonne"
                defaultValue="b"
              >
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
              <p className="t-caption-hl text-[var(--encre-500)]">
                Interrupteur
              </p>
              <Interrupteur
                libelle={`Offre publiée : ${interrupteur ? "oui" : "non"}`}
                checked={interrupteur}
                onCheckedChange={(v) => {
                  setInterrupteur(v);
                  setJournal(`offre ${v ? "publiée" : "dépubliée"}`);
                }}
              />
              <Interrupteur libelle="Éteint par défaut" />
              <Interrupteur libelle="Désactivé" disabled />
              <Interrupteur
                libelle="Désactivé et allumé"
                disabled
                defaultChecked
              />
              <div className="flex items-center gap-3">
                <span className="t-caption text-[var(--encre-500)]">
                  Sans libellé :
                </span>
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
                setJournal(`compétences : ${v.join(", ") || "aucune"}`);
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
              valeursParDefaut={["discovery"]}
              desactive
            />
            <SaisieTags
              libelle="Mots-clés — saisie filtrante"
              options={OPTIONS_OUTILS}
              valeurs={motsCles}
              onChangement={(v) => {
                setMotsCles(v);
                setJournal(`mots-clés : ${v.join(", ") || "aucun"}`);
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
              valeursParDefaut={["notion"]}
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
                  setJournal(
                    `date choisie : ${d ? d.toLocaleDateString("fr-FR") : "aucune"}`,
                  );
                }}
                onFermer={() => setJournal("panneau de date fermé")}
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
                    onOuvrir={() =>
                      setJournal("ouverture du calendrier demandée")
                    }
                    onEffacer={() => {
                      setDate(null);
                      setJournal("date effacée");
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
          <Bloc
            libelle={`StatutProcess — les ${ETAPES.length} étapes, dans l’ordre`}
          >
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
              <TuileCompteur
                nombre={3}
                libelle="Qualifications en retard"
                alerte
              />
              <TuileCompteur nombre={0} libelle="Send-out à relancer" />
            </div>
          </Bloc>
        </Section>

        {/* ==================== CARTES ================================ */}
        <Section
          id="cartes"
          titre="Cartes"
          regle="Trois régimes, et se tromper coûte cher : « accroche » pour ce qui se regarde (bordure 2 px, ombre rétro), « travail » pour ce qui se parcourt (filet gris de 1 px), « contour » pour ce qui se lit en pleine page (bordure 2 px, aucune ombre). Trente cartes d’accroche empilées transforment l’écran en damier ; une carte de travail sur une page vitrine perd la marque ; une carte d’accroche là où la maquette ne met pas d’ombre en ajoute une."
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
            <Carte regime="contour" className="w-[260px] p-5">
              <p className="t-h3">Régime contour</p>
              <p className="t-body mt-2 text-[var(--encre-600)]">
                Bordure noire de 2 px, aucune ombre. Les blocs de la fiche
                d’offre.
              </p>
            </Carte>
            <Carte
              regime="accroche"
              rayon="lg"
              survol
              className="w-[260px] p-5"
            >
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
                <InfoLigne
                  emoji="📍"
                  libelle="Localisation"
                  valeur="Paris, Lyon ou Nantes"
                />
                <InfoLigne
                  emoji="💻"
                  libelle="Mode de travail"
                  valeur="Hybride"
                />
                <InfoLigne libelle="Sans emoji" valeur="Valeur seule" />
              </div>
            </Carte>
          </Bloc>

          <Bloc libelle="Encart — le bloc noir des informations de mandat">
            <div className="w-full max-w-[560px]">
              <Encart
                entrees={[
                  { libelle: "Hiring manager", valeur: "Julien Simoes" },
                  { libelle: "Process", valeur: "4 étapes · 3 semaines" },
                  { libelle: "Stack", valeur: "Figma, Linear" },
                  { libelle: "Équipe", valeur: "6 personnes" },
                ]}
              />
            </div>
          </Bloc>

          <Bloc libelle="EnteteContenu, ContenuCarte, LigneContenu, ItemContenuCarte">
            <Carte className="w-[300px] p-3">
              <EnteteContenu
                vignette={<Avatar nom="Myriam Sterdam" taille={42} />}
              >
                <p className="t-caption-bold text-[var(--encre-700)]">
                  Myriam Sterdam
                </p>
                <p className="t-caption text-[var(--encre-250)]">Lyon</p>
              </EnteteContenu>
              <Divider className="my-3" />
              <ContenuCarte>
                <LigneContenu>
                  <span className="t-caption text-black">
                    Senior Product Manager
                  </span>
                </LigneContenu>
                <LigneContenu compact>
                  <span className="t-caption text-black">💸 90 - 180K</span>
                </LigneContenu>
              </ContenuCarte>
              <ItemContenuCarte ton="mise-en-avant">
                Open to work — dispo sous 15 jours
              </ItemContenuCarte>
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
              client={{ nom: "Cockpit" }}
              poste="Founding Product Designer"
              contrat="freelance"
              salaire="50-55 K"
              localisation="Paris, Lyon ou Nantes"
              modeDeTravail="Hybride"
              exclusivite
              href="#carte-offre"
              action={{
                libelle: "Je suis intéressé·e",
                emoji: "👋",
                onClick: () =>
                  setJournal("intérêt déclaré sur l’offre Cockpit"),
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

          {/* Les mots-clés s'affichent dans les DEUX gabarits, pas seulement
              dans le large : les conditionner à `large` faisait perdre la
              donnée en silence dès qu'un appelant en passait à une carte
              étroite. Ce spécimen affirmait le contraire ; il le démontre
              maintenant, la carte étroite ci-dessous en portant elle aussi. */}
          <Bloc libelle="Gabarit étroit avec mots-clés — ils ne sont pas réservés au large">
            <CarteOffre
              client={{ nom: "Cockpit" }}
              poste="Founding Product Designer"
              contrat="freelance"
              salaire="50-55 K"
              localisation="Paris"
              modeDeTravail="Hybride"
              motsCles={[
                { emoji: "🐓", libelle: "Boîte FR" },
                { emoji: "🚀", libelle: "Série B bouclée" },
              ]}
            />
          </Bloc>

          <Bloc libelle="Gabarit large — deux colonnes, et l'exclusivité remonte en tête">
            <CarteOffre
              large
              client={{ nom: "Cockpit" }}
              poste="Founding Product Designer"
              contrat="freelance"
              salaire="50-55 K"
              localisation="Paris, Lyon ou Nantes"
              modeDeTravail="Hybride"
              motsCles={[
                { emoji: "🐓", libelle: "Boîte FR" },
                { emoji: "✌️", libelle: "Cible user sympa" },
                { emoji: "🚀", libelle: "Série B bouclée" },
              ]}
              exclusivite
              action={{
                libelle: "Je suis intéressé·e",
                emoji: "👋",
                onClick: () => setJournal("intérêt déclaré sur l’offre large"),
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
                libelle: "Candidater",
                onClick: () => setJournal("candidature envoyée à Cockpit"),
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
              onRetirerContrat={() =>
                setJournal("contrat retiré de la fiche Myriam")
              }
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
                libelle: "Ajouter les motivations",
                onClick: () => setJournal("ajout de motivations demandé"),
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
              faits={[
                "Senior Product Manager",
                "90 - 180K",
                "8 ans d’expérience",
              ]}
              action={{
                libelle: "Voir la fiche",
                onClick: () => setJournal("ouverture de la fiche Myriam"),
              }}
            />
            <CarteTalent
              nom="Valentine Ducharme"
              ville="Paris"
              type="kanban"
              etape="a-contacter"
              qualifie
              faits={["Product Designer", "55 - 65K"]}
              onRetirer={() => setJournal("Valentine retirée de la colonne")}
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
                      setJournal(
                        `agent sélectionné dans la liste : ${o.libelle}`,
                      );
                    }}
                  >
                    <Avatar
                      nom={o.libelle}
                      taille={30}
                      forme="rond"
                      bordure={false}
                    />
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
                Le second trait est en encre-100, la variante employée dans les
                cartes.
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
                illustration={
                  <Illustration
                    forme="etincelles"
                    className="text-[var(--violet-300)]"
                  />
                }
                action={
                  <Bouton
                    iconeAvant={<Icone nom="icon-plus" />}
                    onClick={() =>
                      setJournal("création d’offre demandée depuis l’état vide")
                    }
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
                illustration={
                  <Illustration
                    forme="lignes-en-rond"
                    className="text-[var(--encre-200)]"
                  />
                }
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
                <ElementMenu
                  emoji="⚡"
                  libelle="Les offres"
                  href="#navigation"
                />
                <ElementMenu
                  emoji="⚡"
                  libelle="Les offres"
                  href="#navigation"
                  actif
                />
                <ElementMenu
                  emoji="⚡"
                  libelle="Les offres"
                  href="#navigation"
                  desactive
                />
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
              <p className="t-caption-hl mb-3 text-[var(--encre-500)]">
                Menu — profil admin
              </p>
              <Menu
                cheminActif="#navigation"
                sections={SECTIONS_MENU}
                onDeconnexion={() => setJournal("déconnexion demandée")}
              />
            </div>
            <div>
              <p className="t-caption-hl mb-3 text-[var(--encre-500)]">
                Menu — profil talent
              </p>
              <Menu
                cheminActif="#carte-offre"
                utilisateur="talent"
                sections={[
                  {
                    entrees: [
                      {
                        emoji: "💼",
                        libelle: "Mes offres",
                        href: "#carte-offre",
                      },
                      { emoji: "🧑", libelle: "Mon profil", href: "#avatar" },
                    ],
                  },
                ]}
                onDeconnexion={() => setJournal("déconnexion talent demandée")}
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
              utilisateur={{ nom: "Charles Mouchoux" }}
              notifications={3}
              onRecherche={(v) =>
                setJournal(`recherche dans l’en-tête : « ${v} »`)
              }
              onNotifications={() =>
                setJournal("panneau de notifications ouvert")
              }
            />
          </div>
          <div className="mt-6 overflow-hidden rounded-[var(--r-md)] border border-[var(--encre-100)]">
            <Entete utilisateur={{ nom: "Marion Darnet", photoUrl: null }} />
          </div>
          <div className="mt-6 overflow-hidden rounded-[var(--r-md)] border border-[var(--encre-100)]">
            <Entete
              utilisateur={{ nom: "Julien Simoes" }}
              notifications={12}
              placeholderRecherche="Chercher une entreprise"
            />
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════════════
            LES PRIMITIVES APPLICATIVES
            Ajoutées après le job board, sans source Figma : le fichier
            d'origine ne contient ni tableau, ni onglets, ni dialogue centré,
            ni toast, ni kanban. Chacune porte ses arbitrages dans son
            en-tête ; cette page ne fait que les montrer.
            ══════════════════════════════════════════════════════════════ */}

        {/* ==================== TABLEAU =============================== */}
        <Section
          id="tableau"
          titre="Tableau de données"
          regle="Un `<table>` réel, avec une `<caption>` masquée : sans elle, un lecteur d’écran annonce « tableau » sans dire de quoi. Le tri est porté par `aria-sort` sur l’en-tête — la flèche dessinée n’est qu’un doublon visuel. Une colonne n’est triable que si elle sait comparer ce qu’elle affiche : `triSur` absent, l’en-tête reste inerte plutôt que de proposer un tri qui mentirait."
        >
          <Bloc libelle="Densité normale (44 px), lignes activables, tri sur cinq colonnes">
            <div className="w-full">
              <Tableau
                legende="Vos mandats ouverts"
                colonnes={COLONNES_MANDATS}
                lignes={LIGNES_MANDATS}
                cleDeLigne={(l) => l.id}
                triInitial={{ cle: "candidatures", sens: "desc" }}
                onTriChange={(tri) =>
                  setJournal(
                    tri
                      ? `tri du tableau : ${tri.cle} ${tri.sens}`
                      : "tri du tableau retiré",
                  )
                }
                onLigneActivee={(l) => {
                  setLigneOuverte(l.id);
                  setJournal(`ligne ouverte : ${l.reference} ${l.poste}`);
                }}
                libelleLigne={(l) => `Ouvrir le mandat ${l.reference}, ${l.poste}`}
                ligneActive={(l) => l.id === ligneOuverte}
              />
            </div>
          </Bloc>

          <Bloc libelle="Densité compacte (36 px), sans ligne activable">
            <div className="w-full">
              <Tableau
                legende="Vos mandats, vue compacte"
                densite="compacte"
                colonnes={COLONNES_MANDATS.slice(0, 5)}
                lignes={LIGNES_MANDATS}
                cleDeLigne={(l) => l.id}
              />
            </div>
          </Bloc>

          <Bloc libelle="Chargement — six lignes de squelette, hauteur préservée">
            <div className="w-full">
              <Bouton
                apparence="contour"
                taille="sm"
                onClick={() => setChargementTableau((v) => !v)}
                className="mb-3"
              >
                {chargementTableau ? "Afficher les lignes" : "Simuler un chargement"}
              </Bouton>
              <Tableau
                legende="Vos mandats en cours de chargement"
                colonnes={COLONNES_MANDATS.slice(0, 5)}
                lignes={LIGNES_MANDATS}
                cleDeLigne={(l) => l.id}
                chargement={chargementTableau}
              />
            </div>
          </Bloc>

          <Bloc libelle="Vide — l’état vide du système, remplaçable par `etatVide`">
            <div className="w-full">
              <Tableau
                legende="Mandats correspondant au filtre"
                colonnes={COLONNES_MANDATS.slice(0, 5)}
                lignes={[]}
                cleDeLigne={(l) => l.id}
              />
            </div>
          </Bloc>

          <Bloc libelle="Virtualisé — 96 lignes, hauteur visible 320 px, seules les lignes à l’écran sont montées">
            <div className="w-full">
              <Tableau
                legende="Quatre-vingt-seize mandats, liste virtualisée"
                densite="compacte"
                colonnes={COLONNES_MANDATS.slice(0, 6)}
                lignes={LIGNES_LONGUES}
                cleDeLigne={(l) => l.id}
                hauteurVisible={320}
              />
            </div>
          </Bloc>
        </Section>

        {/* ==================== PAGINATION ============================ */}
        <Section
          id="pagination"
          titre="Pagination"
          regle="Pas de pages numérotées : sur soixante-seize pages, aucune ne veut dire quelque chose. Ce qui sert, c’est de savoir où l’on est, d’avancer d’un cran, et de changer la taille du lot. La plage est la SEULE partie en région vivante — après un clic sur « Suivant », rien n’a bougé sous le curseur pour qui n’y voit pas."
        >
          <div className="flex w-full flex-col gap-4">
            <Tableau
              legende="Mandats, page courante"
              densite="compacte"
              colonnes={COLONNES_MANDATS.slice(0, 5)}
              lignes={LIGNES_LONGUES.slice(
                (pagePagination - 1) * taillePagination,
                pagePagination * taillePagination,
              )}
              cleDeLigne={(l) => l.id}
            />
            <Pagination
              total={LIGNES_LONGUES.length}
              page={pagePagination}
              taille={taillePagination}
              onPageChange={setPagePagination}
              taillesDisponibles={[10, 25, 50]}
              onTailleChange={setTaillePagination}
              objets="mandats"
            />
          </div>
          <Bloc libelle="Aucun résultat — le compteur le dit, les deux flèches se figent">
            <div className="w-full">
              <Pagination
                total={0}
                page={1}
                taille={25}
                onPageChange={() => undefined}
                objets="mandats"
              />
            </div>
          </Bloc>
        </Section>

        {/* ==================== ONGLETS =============================== */}
        <Section
          id="onglets"
          titre="Onglets"
          regle="Sur la primitive `tabs` de Base UI : flèches ← →, Début, Fin, saut des onglets désactivés, liaison `aria-controls` entre onglet et panneau. `activateOnFocus={false}` — au clavier les flèches déplacent le focus sans changer de vue, sans quoi traverser sept onglets déclencherait sept chargements. L’onglet actif se distingue par le POIDS et un trait noir, jamais par une teinte."
        >
          <Onglets valeur={ongletActif} onChangement={setOngletActif}>
            <ListeOnglets libelle="Vos postes">
              <Onglet valeur="ouverts" compteur={7}>
                Postes ouverts
              </Onglet>
              <Onglet valeur="process" compteur={24}>
                Candidat·es en process
              </Onglet>
              <Onglet valeur="places" compteur={3}>
                Placements
              </Onglet>
              <Onglet valeur="archives" desactive>
                Archives
              </Onglet>
            </ListeOnglets>
            <PanneauOnglet valeur="ouverts">
              <p className="t-body text-black">
                Sept mandats ouverts. Le panneau est démonté quand on en sort —
                à surveiller s’il porte un formulaire, d’où `garderMonte`.
              </p>
            </PanneauOnglet>
            <PanneauOnglet valeur="process">
              <p className="t-body text-black">
                Vingt-quatre candidat·es réparti·es sur les six étapes visibles
                du client.
              </p>
            </PanneauOnglet>
            <PanneauOnglet valeur="places">
              <p className="t-body text-black">Trois placements sur l’exercice.</p>
            </PanneauOnglet>
            <PanneauOnglet valeur="archives">
              <p className="t-body text-black">Panneau inaccessible.</p>
            </PanneauOnglet>
          </Onglets>
        </Section>

        {/* ==================== DIALOGUE ============================== */}
        <Section
          id="dialogue"
          titre="Dialogue"
          regle="La moitié desktop de `Feuille`, dont il reprend les partis pris tels quels : `data-[closed]:hidden` (la fermeture ne dépend JAMAIS d’une animation, un `transitionend` peut ne pas arriver) et `finalFocus` (sans référence, le focus retombe sur le corps du document). La variante de confirmation nomme l’acte dans son bouton, prend le rôle ARIA « alertdialog », et sur une action destructive le focus part sur « Annuler » — le geste réflexe doit être celui qui ne casse rien."
        >
          <Bloc libelle="Trois largeurs, bornées par la mesure du texte">
            <Bouton
              ref={declencheurDialogue}
              apparence="contour-ombre"
              onClick={() => setDialogueOuvert(true)}
            >
              Ouvrir un dialogue
            </Bouton>
            <Bouton
              ref={declencheurConfirmation}
              apparence="contour"
              onClick={() => setConfirmationOuverte(true)}
            >
              Confirmer une suppression
            </Bouton>
          </Bloc>

          <Dialogue
            titre="Partager cette note avec le client"
            description="Elle apparaîtra dans son portail, signée de votre nom."
            ouvert={dialogueOuvert}
            onOuvertureChange={setDialogueOuvert}
            focusFinal={declencheurDialogue}
            actions={
              <>
                <Bouton apparence="contour" onClick={() => setDialogueOuvert(false)}>
                  Annuler
                </Bouton>
                <Bouton
                  onClick={() => {
                    setDialogueOuvert(false);
                    setJournal("note partagée depuis le dialogue");
                  }}
                >
                  Partager la note
                </Bouton>
              </>
            }
          >
            <p className="t-body text-black">
              Une note partagée ne peut plus redevenir interne. Relisez-la : le
              client la lira telle quelle.
            </p>
          </Dialogue>

          <DialogueConfirmation
            titre="Retirer cette candidature du process ?"
            message="La candidature sortira du pipeline du client. L’historique est conservé, mais la personne n’apparaîtra plus dans son portail."
            libelleConfirmation="Retirer la candidature"
            destructif
            ouvert={confirmationOuverte}
            onOuvertureChange={setConfirmationOuverte}
            focusFinal={declencheurConfirmation}
            onConfirmer={() => {
              setConfirmationOuverte(false);
              setJournal("candidature retirée du process");
            }}
          />
        </Section>

        {/* ==================== TOASTS ================================ */}
        <Section
          id="toasts"
          titre="Toasts"
          regle="La région vivante est montée EN PERMANENCE, vide la plupart du temps : un `aria-live` inséré en même temps que son contenu n’annonce rien, parce que les aides techniques n’observent que les régions déjà présentes. `polite` et non `assertive` — un accusé de réception n’interrompt pas une lecture en cours. La minuterie se met en pause au survol et au focus, sans quoi un toast portant « Annuler » disparaîtrait au moment où l’on tend la main vers lui."
        >
          <DemoToasts />
        </Section>

        {/* ==================== SQUELETTES ============================ */}
        <Section
          id="squelettes"
          titre="Squelettes de chargement"
          regle="Ils réservent la place exacte du contenu à venir : la page ne saute pas quand il arrive. Tous sont `aria-hidden` sans exception — une barre grise n’a rien à annoncer, et c’est au conteneur qui possède l’état de chargement d’annoncer « chargement en cours ». Les largeurs sont inégales à dessein : une pile de barres identiques lit comme un motif, pas comme du texte."
        >
          <Bloc libelle="Les trois formes">
            <Squelette forme="bloc" largeur={160} />
            <Squelette forme="texte" largeur={220} />
            <Squelette forme="cercle" largeur={42} />
          </Bloc>
          <Bloc libelle="Paragraphe — la dernière ligne est courte">
            <div className="w-[380px]">
              <SqueletteTexte lignes={4} />
            </div>
          </Bloc>
          <Bloc libelle="Carte et lignes de liste">
            <SqueletteCarte className="w-[380px]" />
            <div className="w-[380px] rounded-[var(--r-md)] border border-[var(--encre-100)] bg-[var(--fond-carte)]">
              <SqueletteLigneTableau colonnes={3} />
              <SqueletteLigneTableau colonnes={3} />
              <SqueletteLigneTableau colonnes={3} densite="compacte" />
            </div>
          </Bloc>
        </Section>

        {/* ==================== ÉTAT D’ERREUR ========================= */}
        <Section
          id="etat-erreur"
          titre="État d’erreur"
          regle="À ne pas confondre avec `EtatVide` : un état vide est NORMAL — rien à afficher, personne n’a rien fait de mal — quand une erreur est un ACCIDENT. le rôle ARIA « alert » : c’est le seul composant de ce lot où interrompre est justifié, puisque toute la section a disparu. Le bouton « Réessayer » est optionnel, parce qu’un 403 ne se réessaie pas : le proposer promettrait une issue qui n’existe pas."
        >
          <div className="flex flex-wrap items-stretch gap-6">
            <Carte className="w-[380px]">
              <EtatErreur
                onReessayer={() => setJournal("nouvelle tentative de chargement")}
                detail="PostgrestError 57014: statement timeout"
              />
            </Carte>
            <Carte className="w-[380px]">
              <EtatErreur
                titre="Vous n’avez pas accès à ce mandat"
                description="Il appartient à une autre entreprise. Si c’est une erreur, votre agent·e peut vous l’ouvrir."
                action={
                  <Bouton apparence="contour" href="#contenu">
                    Revenir à vos mandats
                  </Bouton>
                }
              />
            </Carte>
          </div>
        </Section>

        {/* ==================== ZONE DE TEXTE ========================= */}
        <Section
          id="zone-texte"
          titre="Zone de texte"
          regle="Le `<textarea>` qui manquait à la famille `Champ`. Il n’en recopie pas les classes : il IMPORTE les sept recettes exportées par `Champ.tsx`, de sorte qu’une bordure de survol modifiée là-bas change ici sans qu’on y touche. Trois ajustements seulement, tous imposés par le multiligne — plancher de hauteur, boîte en `block`, retrait vertical compensé 8 → 7 px comme l’horizontal. Le compteur n’est PAS une région vivante : relu à chaque frappe, il rendrait la saisie inutilisable."
        >
          <div className="flex flex-wrap items-start gap-6">
            <ZoneTexte
              libelle="Argumentaire client"
              placeholder="Pourquoi ce profil pour ce poste…"
              aide="Visible par le client dès la présentation."
              className="w-[340px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              compteur
              maxLength={280}
            />
            <ZoneTexte
              libelle="Motif de refus"
              placeholder="Écrire ici…"
              erreur="Le motif est obligatoire pour un KO client."
              className="w-[340px]"
            />
            <ZoneTexte
              libelle="Note archivée"
              defaultValue="Entretien réalisé le 3 mars. Profil confirmé sur la partie data."
              disabled
              className="w-[340px]"
            />
          </div>
        </Section>

        {/* ==================== MENU D’ACTIONS ======================== */}
        <Section
          id="menu-actions"
          titre="Menu d’actions"
          regle="⚠ Faux ami : `Menu.tsx` est la navigation latérale, ce composant-ci n’a rien à voir avec elle. Le panneau réutilise `PANNEAU_DEROULANT` et `ELEMENT_LISTE`, les recettes relevées du Figma qu’exporte `Selecteur.tsx` — un menu d’actions qui ne leur ressemblerait pas donnerait deux vocabulaires de surface flottante. Le libellé du déclencheur doit être précisé dès qu’il y a plus d’un menu par écran : vingt boutons nommés « Actions » ne disent pas sur quelle ligne on se trouve."
        >
          <Bloc libelle="Déclencheur par défaut — l’ellipse, dans la rampe violette de `BoutonIcone`">
            <MenuActions
              libelle="Actions sur la candidature #012"
              actions={ACTIONS_DEMO_MENU.map((a) => ({
                ...a,
                onSelection: () => setJournal(`menu d’actions : ${a.libelle}`),
              }))}
            />
            <span className="t-caption text-[var(--encre-500)]">
              Ouvrir au clavier : Entrée, puis ↑ ↓, Échap pour fermer.
            </span>
          </Bloc>
          <Bloc libelle="Déclencheur sur mesure">
            <MenuActions
              declencheur={<Bouton apparence="contour">Actions du mandat</Bouton>}
              actions={[
                { cle: "publier", libelle: "Publier l’offre", icone: "icon-upload" },
                { cle: "dupliquer", libelle: "Dupliquer le mandat", icone: "icon-copy" },
                {
                  cle: "cloturer",
                  libelle: "Clôturer le mandat",
                  icone: "icon-x-circle",
                  destructive: true,
                  separateurAvant: true,
                },
              ]}
            />
          </Bloc>
        </Section>

        {/* ==================== FIL DE COMMENTAIRES =================== */}
        <Section
          id="fil-commentaires"
          titre="Fil de commentaires"
          regle="Le badge « partagé avec le client » est le cœur du composant, pas une décoration : `core.note.visible_client` vaut `false` par défaut, une note est donc INTERNE tant que quelqu’un n’a pas décidé l’inverse. La case de partage se réarme après chaque message — la laisser cochée publierait la note suivante sans nouvelle décision. Cmd/Ctrl + Entrée publie ; Entrée seule fait un retour à la ligne."
        >
          <Carte className="max-w-[620px] p-5">
            <FilCommentaires
              commentaires={commentaires}
              partageDisponible
              onEnvoyer={(corps, partage) => {
                setCommentaires((liste) => [
                  ...liste,
                  {
                    id: `c${liste.length + 1}`,
                    auteur: { nom: "Charles Mouchoux" },
                    ecritLe: new Date(),
                    corps,
                    partageClient: partage,
                    deMoi: true,
                  },
                ]);
                setJournal(
                  partage ? "note publiée ET partagée au client" : "note interne publiée",
                );
              }}
            />
          </Carte>
          <Bloc libelle="Vide, et en lecture seule">
            <Carte className="w-[380px] p-5">
              <FilCommentaires commentaires={[]} />
            </Carte>
          </Bloc>
        </Section>

        {/* ==================== FRISE D’ACTIVITÉ ====================== */}
        <Section
          id="frise"
          titre="Frise d’activité"
          regle="Le tableau montre l’état COURANT, la frise montre le CHEMIN. Le couple avant → après est la pièce maîtresse : « Étape modifiée » ne dit rien, « Interview 1 → Interview 2 » dit tout. La flèche est décorative, doublée d’un « devient » réservé au lecteur d’écran. `avant` est facultatif — une création n’a pas d’état antérieur, et un « (vide) → x » serait un mensonge."
        >
          <Carte className="max-w-[560px] p-5">
            <FriseActivite evenements={EVENEMENTS_DEMO} />
          </Carte>
        </Section>

        {/* ==================== BARRE DE FILTRES ====================== */}
        <Section
          id="barre-filtres"
          titre="Barre de filtres"
          regle="Elle ne contient AUCUN contrôle : `TagAction`, `SelecteurMulti`, `ChampTags` existent déjà et sont complets. Ce qui manquait, c’est le cadre — la rangée, le rappel des critères cochés, le compte, « tout effacer ». Elle remplace le `TagsChoisis` fait main de `PageJobs.tsx:433` : la croix de retrait est COMPOSÉE dans `TagInfo` plutôt qu’ajoutée à son contrat, et vit désormais à un seul endroit."
        >
          <BarreFiltres
            actifs={filtresChoisis
              .map((cle) => FILTRES_POSSIBLES[cle])
              .filter(Boolean)}
            onToutEffacer={() => setFiltresChoisis([])}
            resultats={filtresChoisis.length === 0 ? 533 : 12}
          >
            <SelecteurUnivers
              libelle="Univers"
              className="w-[220px]"
              options={UNIVERS.map((u) => ({ valeur: u, libelle: u }))}
              valeurs={universChoisis}
              onChangement={setUniversChoisis}
            />
            <Selecteur
              libelle="Séniorité"
              className="w-[200px]"
              options={OPTIONS_SENIORITE}
              valeur={seniorite}
              onChangement={setSeniorite}
            />
            <div className="flex items-center gap-2 pb-1">
              {(["univers-tech", "contrat-cdi", "ville-lyon"] as const).map((cle) => (
                <TagAction
                  key={cle}
                  actif={filtresChoisis.includes(cle)}
                  onClick={() =>
                    setFiltresChoisis((f) =>
                      f.includes(cle) ? f.filter((c) => c !== cle) : [...f, cle],
                    )
                  }
                >
                  {FILTRES_POSSIBLES[cle].libelle}
                </TagAction>
              ))}
            </div>
          </BarreFiltres>
        </Section>

        {/* ==================== KANBAN ================================ */}
        <Section
          id="kanban"
          titre="Kanban"
          regle="LE GLISSER-DÉPOSER EST HORS PÉRIMÈTRE — le portail client est en lecture, aucune dépendance de DnD n’est ajoutée. `onDeplacer` existe pour que la signature soit déjà la bonne, et parce qu’elle câble dès aujourd’hui l’alternative clavier : un menu « Déplacer vers… » sur chaque carte, chemin complet à la souris comme au clavier. Le glisser-déposer viendra plus tard s’y ajouter comme un raccourci, jamais comme le seul chemin. La pastille de couleur est une DONNÉE (`ref.etape_process.couleur`), pas un jeton."
        >
          <Kanban
            colonnes={COLONNES_KANBAN}
            onDeplacer={({ cleCarte, versColonne }) =>
              setJournal(`déplacement demandé : ${cleCarte} → ${versColonne}`)
            }
          />
        </Section>


        {/* ==================== JAUGE ================================= */}
        <Section
          id="jauge"
          titre="Jauge"
          regle="Il n’y a PAS de variante « barre seule » : une barre est une longueur, qu’il faut voir, comparer et estimer. Le chiffre est toujours écrit à droite ; `chiffre` choisit entre deux ÉCRITURES (« 62 % » ou « 4 / 7 »), jamais entre écrire et ne pas écrire. Le remplissage est NOIR par défaut — la couleur ne signale pas, `ton` ne fait que doubler un statut écrit ailleurs. `valeur={null}` dit « ça avance, on ne sait pas de combien » : la bande balaye la piste et le chiffre devient « en cours… », parce que rendre 0 % dirait « rien n’est parti »."
        >
          <Bloc libelle="Continue — la complétude d’une fiche">
            <div className="flex w-[420px] flex-col gap-5">
              <Jauge
                valeur={62}
                libelle="Complétude de votre fiche"
                detail="Il reste le CV et les secteurs no-go."
              />
              <Jauge valeur={100} libelle="Fiche complète" ton="positif" />
              <Jauge valeur={12} libelle="À peine commencée" taille="sm" />
              <Jauge valeur={null} libelle="Envoi du CV" taille="sm" />
            </div>
          </Bloc>
          <Bloc libelle="Segmentée — un dénombrement, pas une mesure">
            <div className="flex w-[420px] flex-col gap-5">
              <Jauge
                valeur={4}
                max={7}
                segments={7}
                chiffre="fraction"
                libelle="Étapes du process franchies"
                detail="Prochaine étape : entretien final."
              />
              <Jauge
                valeur={1}
                max={3}
                segments={3}
                chiffre="fraction"
                libelle="Pièces fournies"
                ton="attente"
              />
            </div>
          </Bloc>
        </Section>

        {/* ==================== FIL D’ÉTAPES ========================== */}
        <Section
          id="etapes"
          titre="Fil d’étapes"
          regle="Reprend le fil fait main de `FormulaireBrief.tsx:476` et ses quatre décisions justes : une `<ol>` de BOUTONS (le fil sert à REVENIR, et revenir est un acte), `aria-current=&quot;step&quot;`, un préfixe `sr-only` « Étape 2 sur 4 : », et l’inatteignable en bouton `disabled`. Ajouts : l’étape franchie porte une coche à la place de son numéro, l’état d’erreur s’ÉCRIT (« — à corriger ») en plus du pictogramme, et la disposition en colonne. Ce n’est PAS `Onglets` : un fil est séquentiel, aucun `role=&quot;tablist&quot;` ici — des flèches ← → feraient sauter d’étape sans valider la précédente."
        >
          <Bloc libelle="En ligne, pilotable">
            <div className="flex w-full flex-col gap-4">
              <Etapes
                libelle="Ouvrir un poste"
                etapes={ETAPES_BRIEF}
                courante={etapeBrief}
                onAller={setEtapeBrief}
              />
              <p className="t-caption text-[var(--encre-500)]">
                Étape affichée : {etapeBrief + 1} sur {ETAPES_BRIEF.length}. Les
                étapes suivantes sont inatteignables tant qu’on n’a pas avancé.
              </p>
            </div>
          </Bloc>
          <Bloc libelle="Avec une étape en erreur">
            <Etapes
              libelle="Ouvrir un poste, avec une faute à corriger"
              etapes={ETAPES_BRIEF.map((e, i) =>
                i === 0 ? { ...e, erreur: true } : e,
              )}
              courante={2}
              onAller={() => setJournal("fil d’étapes : retour demandé")}
            />
          </Bloc>
          <Bloc libelle="En colonne, et en lecture seule (sans `onAller`)">
            <div className="w-[280px]">
              <Etapes
                libelle="Où en est votre candidature"
                etapes={ETAPES_BRIEF}
                courante={2}
                disposition="colonne"
              />
            </div>
          </Bloc>
        </Section>

        {/* ==================== ACCORDÉON ============================= */}
        <Section
          id="accordeon"
          titre="Accordéon"
          regle="`hiddenUntilFound` est ACTIVÉ par défaut : la recherche du navigateur (Ctrl+F) trouve un mot dans un panneau replié et l’ouvre toute seule — sur une fiche de 37 champs, c’est la différence entre « je ne le trouve pas » et « il était dans Attentes ». L’ouverture MULTIPLE est aussi le défaut, à l’inverse de Base UI : refermer la section qu’on vient de remplir fait perdre le fil de ce qu’on a répondu. `resume` est la ligne qui vaut le pli (« 4 secteurs choisis ») — sans elle, un accordéon n’est qu’une liste de titres muets qu’il faut tous déplier. Ne PAS s’en servir pour ce qui doit être LU : un récapitulatif plié ne récapitule rien."
        >
          <Carte regime="contour" className="max-w-[620px] px-5 py-2">
            <Accordeon valeurParDefaut={["attentes"]}>
              <SectionAccordeon
                valeur="identite"
                titre="Identité et coordonnées"
                resume="Complet"
                compteur={6}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Champ libelle="Prénom" defaultValue="Camille" />
                  <Champ libelle="Nom" defaultValue="Rousset" />
                </div>
              </SectionAccordeon>
              <SectionAccordeon
                valeur="attentes"
                titre="Vos attentes"
                resume="Rémunération et mode de travail à préciser"
                compteur={2}
              >
                <div className="flex flex-col gap-4">
                  <ChampFourchette
                    libelle="Rémunération annuelle souhaitée"
                    unite="K€"
                    valeurs={salaire}
                    onChangement={setSalaire}
                    min={0}
                    max={400}
                  />
                  <ChampTags
                    libelle="Mode de travail"
                    options={OPTIONS_OUTILS}
                    valeursParDefaut={["figma"]}
                  />
                </div>
              </SectionAccordeon>
              <SectionAccordeon
                valeur="nogo"
                titre="Secteurs no-go"
                resume="Aucun secteur écarté"
              >
                <SaisieTags
                  libelle="Secteurs à ne pas proposer"
                  options={OPTIONS_COMPETENCES}
                />
              </SectionAccordeon>
              <SectionAccordeon
                valeur="qualification"
                titre="Qualification Pachamama"
                resume="Renseignée par votre agent·e"
                desactive
              >
                <p className="t-body">Inaccessible en lecture talent.</p>
              </SectionAccordeon>
            </Accordeon>
          </Carte>
        </Section>

        {/* ==================== CHAMP NOMBRE ========================== */}
        <Section
          id="champ-nombre"
          titre="Champ nombre"
          regle="Trois raisons de ne pas employer `<Champ type=&quot;number&quot;>`, toutes mesurables. La VIRGULE : on tape « 62,5 » sur un clavier français, et un `input[type=number]` natif la refuse — la valeur devient vide, sans message. `NumberField` analyse la saisie avec la locale `fr-FR` : « 62,5 » et « 62.5 » donnent tous deux 62,5. L’UNITÉ : elle appartient au champ, pas au libellé — et elle est écrite DEUX FOIS, à l’écran (`aria-hidden`) et dans le nom accessible (« Salaire minimum en K€ »), sans quoi un lecteur d’écran entend « 62 » sans savoir si ce sont des euros ou des milliers. La MOLETTE : `allowWheelScrub` reste à `false`, personne n’a jamais voulu changer un salaire en scrollant. Pas de séparateur de milliers : en `fr-FR` c’est une espace fine insécable, invisible et catastrophique au copier-coller."
        >
          <Bloc libelle="Avec unité et boutons de pas">
            <div className="flex flex-wrap items-start gap-4">
              <ChampNombre
                className="w-[200px]"
                libelle="Expérience"
                unite="ans"
                valeur={anneesXp}
                onChangement={setAnneesXp}
                min={0}
                max={60}
                aide="Flèches ↑ ↓ pour ajuster."
              />
              <ChampNombre
                className="w-[220px]"
                libelle="TJM souhaité"
                unite="€/j"
                valeur={tjm}
                onChangement={setTjm}
                min={0}
                max={3000}
                pas={50}
              />
              <ChampNombre
                className="w-[220px]"
                libelle="Part variable"
                unite="%"
                valeurParDefaut={12.5}
                decimales={1}
                min={0}
                max={100}
                aide="Une décimale : tapez « 12,5 »."
              />
            </div>
          </Bloc>
          <Bloc libelle="Sans unité, sans boutons, et les états">
            <div className="flex flex-wrap items-start gap-4">
              <ChampNombre
                className="w-[180px]"
                libelle="Postes ouverts"
                boutons={false}
                valeurParDefaut={3}
              />
              <ChampNombre
                className="w-[200px]"
                libelle="Salaire minimum"
                unite="K€"
                erreur="Ce montant paraît trop bas pour ce poste."
                valeurParDefaut={9}
              />
              <ChampNombre
                className="w-[200px]"
                libelle="Salaire maximum"
                unite="K€"
                desactive
                valeurParDefaut={70}
              />
              <ChampNombre
                className="w-[200px]"
                libelle="Non renseigné"
                unite="K€"
                substitut="—"
                valeur={null}
              />
            </div>
          </Bloc>
        </Section>

        {/* ==================== CHAMP FOURCHETTE ====================== */}
        <Section
          id="champ-fourchette"
          titre="Champ fourchette"
          regle="ON N’INVERSE PAS, ON DIT. Échanger les deux valeurs quand elles se croisent est la « correction serviable » qui détruit les données : quelqu’un qui tape 80 puis 45 s’est peut-être trompé de champ, mais peut-être de chiffre — l’inversion choisit à sa place, sans le dire. Les DEUX champs portent `aria-invalid`, parce que c’est le COUPLE qui est incohérent et que rien ne dit lequel est le mauvais ; le message est écrit une seule fois sous la paire, et les deux champs y pointent. Une borne à `null` n’est pas une borne à `0` : « à partir de 45 K€ » est une fourchette valide, le contrôle ne s’applique donc que lorsque les deux bornes existent."
        >
          <Bloc libelle="Cohérente">
            <div className="w-[440px]">
              <ChampFourchette
                libelle="Rémunération annuelle"
                unite="K€"
                valeurs={salaire}
                onChangement={setSalaire}
                min={0}
                max={400}
                aide="Laissez une borne vide pour dire « à partir de » ou « jusqu’à »."
              />
            </div>
          </Bloc>
          <Bloc libelle="Croisée — le message est celui de la paire">
            <div className="w-[440px]">
              <ChampFourchette
                libelle="Rémunération annuelle"
                unite="K€"
                valeurs={salaireCroise}
                onChangement={setSalaireCroise}
                min={0}
                max={400}
              />
            </div>
          </Bloc>
          <Bloc libelle="Désactivée">
            <div className="w-[440px]">
              <ChampFourchette
                libelle="TJM (réservé aux missions en régie)"
                unite="€/j"
                valeurs={{ min: 500, max: 800 }}
                onChangement={() => {}}
                desactive
              />
            </div>
          </Bloc>
        </Section>

        {/* ==================== COMBOBOX ============================== */}
        <Section
          id="combobox"
          titre="Combobox"
          regle="`ref.metier` compte 238 entrées, et les trois façons de les présenter avec l’existant échouent : `Selecteur` ouvre un panneau de 156px, soit quatre lignes sur 238 (on défile à l’aveugle) ; `ChampTags` en étalerait 238 ; `SaisieTags` filtre bien mais est MULTIPLE par construction. C’est donc `SaisieTags` moins le multiple : un `<input>` unique qui porte le libellé choisi, une croix pour l’effacer, le filtre par `Intl.Collator` (« ingenieur » trouve « Ingénieur »). Les éléments sont les VALEURS et non des objets — `Combobox` compare par `Object.is`, et un tableau d’objets recréé à chaque rendu ne se reconnaîtrait jamais. `autoHighlight` reste à `false` : surligner la première correspondance fait valider « Product Manager » à qui visait « Product Marketing Manager »."
        >
          <Bloc libelle="Valeur unique, liste longue">
            <div className="flex w-full flex-col gap-4">
              <Combobox
                className="w-[320px]"
                libelle="Métier"
                options={OPTIONS_METIERS}
                valeur={metier}
                onChangement={setMetier}
                substitut="Rechercher un métier"
                aide="Tapez trois lettres. La liste se réduit, les accents sont ignorés."
              />
              <p className="t-caption text-[var(--encre-500)]">
                Valeur retenue :{" "}
                <code className="t-caption-bold">{metier ?? "aucune"}</code>
              </p>
            </div>
          </Bloc>
          <Bloc libelle="Les états">
            <div className="flex flex-wrap items-start gap-4">
              <Combobox
                className="w-[280px]"
                libelle="Métier"
                options={OPTIONS_METIERS}
                substitut="Rechercher un métier"
                erreur="Choisissez un métier dans la liste."
              />
              <Combobox
                className="w-[280px]"
                libelle="Métier (qualifié par l’agent·e)"
                options={OPTIONS_METIERS}
                valeur="head_of_product"
                desactive
              />
              <Combobox
                className="w-[280px]"
                libelle="Liste vide"
                options={[]}
                substitut="Rechercher"
                texteVide="Aucun métier n’est encore référencé."
              />
            </div>
          </Bloc>
        </Section>

        {/* ==================== TÉLÉVERSEMENT ========================= */}
        <Section
          id="televersement"
          titre="Téléversement"
          regle="IL N’ENVOIE RIEN, et c’est la première chose à savoir : il reçoit `onFichier(f)` et un `etat`, et il dessine. Un vrai téléversement touche un bucket et doit passer par une Server Action (ADR 0005) — un composant du DS qui appellerait le réseau emporterait avec lui la clé d’idempotence, la liste blanche et le journal. L’input est un VRAI `<input type=&quot;file&quot;>`, monté en permanence, qui COUVRE la zone en `absolute inset-0 opacity-0` : un seul élément reçoit le clic, la tabulation, la commande vocale ET le dépôt de fichier, qu’un input natif accepte sans une ligne de JavaScript. Les gestionnaires de survol ne servent QU’À L’APPARENCE et n’appellent jamais `preventDefault` — le jour où l’un le fera, le dépôt cessera de fonctionner sans que rien ne le dise. Les limites sont annoncées AVANT le choix, dans l’aide rattachée par `aria-describedby`, et elles sont VÉRIFIÉES : annoncer une limite qu’on ne contrôle pas est un mensonge poli."
        >
          <Bloc libelle="Au repos, puis avec le fichier retenu">
            <div className="flex w-full flex-wrap items-start gap-6">
              <div className="w-[360px]">
                <Televersement
                  libelle="Votre CV"
                  typesAcceptes={[".pdf", ".docx"]}
                  tailleMaxOctets={5 * 1024 * 1024}
                  fichier={cv}
                  etat={etatCv}
                  onFichier={(f) => {
                    setCv(f);
                    setEtatCv({ phase: "fait" });
                    setJournal(`fichier retenu : ${f.name}`);
                  }}
                  onRetirer={() => {
                    setCv(null);
                    setEtatCv({ phase: "repos" });
                  }}
                  aide="Il sera lu par votre agent·e, jamais publié."
                />
              </div>
              <div className="w-[360px]">
                <Televersement
                  libelle="Photo de profil"
                  typesAcceptes={["image/png", "image/jpeg"]}
                  tailleMaxOctets={2 * 1024 * 1024}
                  fichierExistant={{
                    nom: "camille-rousset.jpg",
                    octets: 284_133,
                  }}
                  onFichier={() => setJournal("photo remplacée")}
                  onRetirer={() => setJournal("photo retirée")}
                />
              </div>
            </div>
          </Bloc>
          <Bloc libelle="En cours d’envoi, progression connue puis inconnue">
            <div className="flex w-full flex-wrap items-start gap-6">
              <div className="w-[360px]">
                <Televersement
                  libelle="Portfolio"
                  typesAcceptes={[".pdf"]}
                  tailleMaxOctets={20 * 1024 * 1024}
                  fichierExistant={{ nom: "portfolio-2026.pdf", octets: 8_412_000 }}
                  etat={{ phase: "envoi", progression: 41 }}
                  onFichier={() => {}}
                />
              </div>
              <div className="w-[360px]">
                <Televersement
                  libelle="Portfolio"
                  typesAcceptes={[".pdf"]}
                  fichierExistant={{ nom: "portfolio-2026.pdf" }}
                  etat={{ phase: "envoi" }}
                  onFichier={() => {}}
                />
              </div>
            </div>
          </Bloc>
          <Bloc libelle="En échec, et désactivé">
            <div className="flex w-full flex-wrap items-start gap-6">
              <div className="w-[360px]">
                <Televersement
                  libelle="Votre CV"
                  typesAcceptes={[".pdf", ".docx"]}
                  tailleMaxOctets={5 * 1024 * 1024}
                  fichierExistant={{ nom: "cv-camille.pdf", octets: 1_204_000 }}
                  etat={{
                    phase: "echec",
                    message:
                      "L’envoi a échoué. Réessayez, ou déposez le fichier à nouveau.",
                  }}
                  onFichier={() => {}}
                  onRetirer={() => {}}
                />
              </div>
              <div className="w-[360px]">
                <Televersement
                  libelle="Lettre de recommandation"
                  typesAcceptes={[".pdf"]}
                  tailleMaxOctets={5 * 1024 * 1024}
                  onFichier={() => {}}
                  desactive
                  aide="Disponible après votre premier entretien."
                />
              </div>
            </div>
          </Bloc>
        </Section>

        {/* ==================== FRISE DE PARCOURS ===================== */}
        <Section
          id="frise-parcours"
          titre="Frise de parcours"
          regle="⚠ CE N’EST PAS `FriseActivite`. Celle-là montre des ÉVÉNEMENTS en lecture seule et refuse de trier ; celle-ci porte des ENTRÉES saisies, qu’on ajoute, modifie, retire — et qu’elle TRIE elle-même, de la plus récente à la plus ancienne, comme un CV. La divergence est justifiée : `core.fiche_talent_poste` compte 0 ligne et n’a AUCUNE source, il n’y a donc pas de requête dont l’ordre serait à respecter. La PÉRIODE est une année exigée plus un mois facultatif : personne ne se souvient du jour où il a pris un poste il y a huit ans (`SelecteurDate` serait une fausse précision) et un texte libre rendrait le tri impossible. Une fin absente ne veut pas dire « inconnue » mais EN POSTE : c’est une case à cocher, pas un vide qu’on interprète. Le brouillon ne sort du composant qu’à la validation — tant qu’on n’a pas confirmé, `onChangement` n’est pas appelé."
        >
          <Carte regime="contour" className="max-w-[720px] p-5">
            <FriseParcours entrees={parcours} onChangement={setParcours} />
          </Carte>
          <Bloc libelle="En lecture seule, et vide">
            <div className="flex w-full flex-wrap items-start gap-6">
              <Carte regime="travail" className="w-[340px] p-4">
                <FriseParcours
                  entrees={PARCOURS_DEMO}
                  onChangement={() => {}}
                  lectureSeule
                />
              </Carte>
              <Carte regime="travail" className="w-[340px] p-4">
                <FriseParcours entrees={[]} onChangement={() => {}} />
              </Carte>
            </div>
          </Bloc>
        </Section>

        <footer className="mt-20 border-t border-[var(--encre-100)] pt-8">
          <p className="t-caption text-[var(--encre-500)]">
            49 fichiers de composants · {NOMS_ICONES.length} icônes ·{" "}
            {FORMES.length} formes · {ETAPES.length} statuts de process · 14
            classes typographiques. Les vingt-et-une dernières sections sont les
            primitives applicatives ajoutées après le job board — treize pour
            les portails de lecture, huit pour l’espace de saisie de soi. Elles
            n’ont pas de source Figma, et leurs arbitrages sont écrits dans
            l’en-tête de chaque fichier.
          </p>
        </footer>
      </main>
      </FournisseurToasts>
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
    <section
      id={id}
      className="mt-20 scroll-mt-8 border-t border-[var(--encre-100)] pt-10"
    >
      <div className="flex items-baseline gap-4">
        <h2 className="t-h2">{titre}</h2>
        <a
          href="#contenu"
          className="t-micro text-[var(--encre-300)] hover:text-black hover:underline"
        >
          ↑ sommaire
        </a>
      </div>
      {regle && (
        <p className="t-body mt-3 max-w-[76ch] text-[var(--encre-600)]">
          {regle}
        </p>
      )}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Bloc({
  libelle,
  children,
}: {
  libelle: string;
  children: React.ReactNode;
}) {
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

/**
 * DemoToasts — le seul endroit de cette page qui appelle `useToasts()`.
 *
 * Il faut un composant séparé : le point d'accès lit un contexte, et
 * `Specimen` EST le parent du fournisseur, donc il ne peut pas le lire
 * lui-même. C'est aussi la démonstration du bon montage — le fournisseur
 * haut dans l'arbre, l'appel dans l'écran.
 */
function DemoToasts() {
  const { annoncer } = useToasts();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Bouton
        onClick={() =>
          annoncer({
            titre: "Note partagée avec le client.",
            ton: "succes",
          })
        }
      >
        Accusé simple
      </Bouton>
      <Bouton
        apparence="contour"
        onClick={() =>
          annoncer({
            titre: "Candidature retirée du process.",
            description: "Elle n’apparaît plus dans le portail du client.",
            ton: "neutre",
            duree: 0,
            action: { libelle: "Annuler", onClic: () => undefined },
          })
        }
      >
        Avec action, sans minuterie
      </Bouton>
      <Bouton
        apparence="contour"
        onClick={() =>
          annoncer({
            titre: "L’enregistrement a échoué.",
            description: "Réessayez dans un instant.",
            ton: "echec",
          })
        }
      >
        Échec
      </Bouton>
      <Bouton
        apparence="contour"
        onClick={() => {
          annoncer({ titre: "Premier accusé." });
          annoncer({ titre: "Deuxième accusé." });
          annoncer({ titre: "Troisième accusé." });
          annoncer({ titre: "Quatrième — le premier est parti." });
        }}
      >
        Quatre d’un coup (pile bornée à trois)
      </Bouton>
    </div>
  );
}
