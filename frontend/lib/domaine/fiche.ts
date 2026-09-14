import type { Univers } from "@/components/pacha/Tag";
import { teinteUnivers } from "./offre";

/**
 * LA FICHE D'UNE OFFRE — la donnée et ses règles.
 *
 * Source unique : la vue `api.offre_detail`, distincte de `offre_publique`.
 * Le board lit douze lignes et n'a que faire de l'entreprise ni de l'agent ;
 * la fiche en lit une et joint six tables de plus.
 *
 * L'ANONYMAT EST DÉJÀ APPLIQUÉ QUAND LA DONNÉE ARRIVE ICI. Sur une offre
 * anonyme la vue ne construit pas les champs d'identification — ils valent
 * `null`, et ce fichier n'a aucune décision à reprendre. C'est délibéré :
 * un filtrage écrit en TypeScript ne protège rien, la vue étant interrogeable
 * directement au réseau.
 */

export type Fiche = {
  id: string;
  intitule: string;
  universCode: string | null;
  univers: string | null;
  metier: string | null;
  estAnonyme: boolean;
  exclusivitePachamama: boolean;

  entreprise: string | null;
  entrepriseLogo: string | null;
  entrepriseAmbition: string | null;
  entrepriseLocalisation: string | null;
  entrepriseFondateur: string | null;
  entrepriseSerie: string | null;
  entrepriseProduit: string | null;
  entrepriseSalaries: number | null;
  entrepriseEquipeTech: number | null;
  entrepriseSite: string | null;

  managerNom: string | null;
  managerPhoto: string | null;
  managerTitre: string | null;

  agentNom: string | null;
  agentPhoto: string | null;

  contrat: string | null;
  contratLibelle: string | null;
  salaireMinKe: number | null;
  salaireMaxKe: number | null;
  tjmMinEur: number | null;
  tjmMaxEur: number | null;
  salaireAffiche: string | null;
  localisation: string | null;
  remoteLibelle: string | null;
  tags: string[] | null;

  description: string | null;
  missions: string | null;
  pourToi: string | null;
  pasPourToi: string | null;
  remoteInfos: string | null;
  salaireInfos: string | null;
  processRecrutement: string | null;

  scorecardDiscovery: number | null;
  scorecardDelivery: number | null;
  scorecardStrategie: number | null;
  scorecardManagement: number | null;
  scorecardOps: number | null;
  videoYoutube: string | null;
};

/** Les colonnes demandées à PostgREST. Une seule liste, pour ne pas diverger. */
export const COLONNES_FICHE = [
  "id",
  "intitule",
  "univers_code",
  "univers",
  "metier",
  "est_anonyme",
  "exclusivite_pachamama",
  "entreprise",
  "entreprise_logo",
  "entreprise_ambition",
  "entreprise_localisation",
  "entreprise_fondateur",
  "entreprise_serie",
  "entreprise_produit",
  "entreprise_salaries",
  "entreprise_equipe_tech",
  "entreprise_site",
  "manager_nom",
  "manager_photo",
  "manager_titre",
  "agent_nom",
  "agent_photo",
  "contrat",
  "contrat_libelle",
  "salaire_min_ke",
  "salaire_max_ke",
  "tjm_min_eur",
  "tjm_max_eur",
  "salaire_affiche",
  "localisation",
  "remote_libelle",
  "tags",
  "description",
  "missions",
  "pour_toi",
  "pas_pour_toi",
  "remote_infos",
  "salaire_infos",
  "process_recrutement",
  "scorecard_discovery",
  "scorecard_delivery",
  "scorecard_strategie",
  "scorecard_management",
  "scorecard_ops",
  "video_youtube",
].join(",");

type LigneFiche = Record<string, unknown>;

const texte = (v: unknown) =>
  v === null || v === undefined ? null : String(v);
const nombre = (v: unknown) =>
  v === null || v === undefined ? null : Number(v);
const tableau = (v: unknown) =>
  Array.isArray(v) && v.length > 0 ? v.map(String) : null;

export function versFiche(l: LigneFiche): Fiche {
  return {
    id: String(l.id),
    intitule: String(l.intitule ?? "Poste à pourvoir"),
    universCode: texte(l.univers_code),
    univers: texte(l.univers),
    metier: texte(l.metier),
    estAnonyme: Boolean(l.est_anonyme),
    exclusivitePachamama: Boolean(l.exclusivite_pachamama),
    entreprise: texte(l.entreprise),
    entrepriseLogo: texte(l.entreprise_logo),
    entrepriseAmbition: texte(l.entreprise_ambition),
    entrepriseLocalisation: texte(l.entreprise_localisation),
    entrepriseFondateur: texte(l.entreprise_fondateur),
    entrepriseSerie: texte(l.entreprise_serie),
    entrepriseProduit: texte(l.entreprise_produit),
    entrepriseSalaries: nombre(l.entreprise_salaries),
    entrepriseEquipeTech: nombre(l.entreprise_equipe_tech),
    entrepriseSite: texte(l.entreprise_site),
    managerNom: texte(l.manager_nom),
    managerPhoto: texte(l.manager_photo),
    managerTitre: texte(l.manager_titre),
    agentNom: texte(l.agent_nom),
    agentPhoto: texte(l.agent_photo),
    contrat: texte(l.contrat),
    contratLibelle: texte(l.contrat_libelle),
    salaireMinKe: nombre(l.salaire_min_ke),
    salaireMaxKe: nombre(l.salaire_max_ke),
    tjmMinEur: nombre(l.tjm_min_eur),
    tjmMaxEur: nombre(l.tjm_max_eur),
    salaireAffiche: texte(l.salaire_affiche),
    localisation: texte(l.localisation),
    remoteLibelle: texte(l.remote_libelle),
    tags: tableau(l.tags),
    description: texte(l.description),
    missions: texte(l.missions),
    pourToi: texte(l.pour_toi),
    pasPourToi: texte(l.pas_pour_toi),
    remoteInfos: texte(l.remote_infos),
    salaireInfos: texte(l.salaire_infos),
    processRecrutement: texte(l.process_recrutement),
    scorecardDiscovery: nombre(l.scorecard_discovery),
    scorecardDelivery: nombre(l.scorecard_delivery),
    scorecardStrategie: nombre(l.scorecard_strategie),
    scorecardManagement: nombre(l.scorecard_management),
    scorecardOps: nombre(l.scorecard_ops),
    videoYoutube: texte(l.video_youtube),
  };
}

/* ── Mise en forme ────────────────────────────────────────────────────────── */

/**
 * Un texte libre découpé en éléments de liste.
 *
 * Les champs `missions`, `pour_toi`, `process_recrutement` sont saisis à la
 * main dans Bubble et arrivent sous des formes hétérogènes : mesuré, on trouve
 * « 1.\n2.\n3. », « •\n•\n• », des tirets, et des paragraphes sans puce.
 *
 * On retire la puce ou le numéro de tête, on jette les lignes devenues vides —
 * une puce sans texte est du bruit de saisie, pas un élément — et on rend un
 * tableau VIDE plutôt qu'une liste d'éléments vides. C'est ce tableau vide qui
 * fait disparaître le bloc, conformément à la règle de la maquette.
 */
export function listeDe(brut: string | null): string[] {
  if (!brut) return [];

  // UN TABLEAU JSON SÉRIALISÉ EN TEXTE. Mesuré : `missions` arrive sous la
  // forme `["Définir le positionnement…","Contribuer à…"]` — une chaîne, pas un
  // tableau. Découpée par lignes, elle donnait UNE puce contenant les crochets,
  // les guillemets et les virgules. C'est ce que montrait la page.
  const lignes = enTableauJson(brut) ?? [brut];

  return lignes
    .flatMap((l) => l.split(/\r?\n/))
    .map(sansMarqueur)
    .filter((l) => l.length > 0);
}

/** Rend les éléments si le texte est un tableau JSON de chaînes, sinon `null`. */
function enTableauJson(brut: string): string[] | null {
  const t = brut.trim();
  if (!t.startsWith('[') || !t.endsWith(']')) return null;
  try {
    const v: unknown = JSON.parse(t);
    if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) return null;
    return v as string[];
  } catch {
    // Un texte qui commence par un crochet sans être du JSON reste du texte.
    return null;
  }
}

/**
 * Une ligne débarrassée du marqueur qu'elle porte déjà.
 *
 * LES DONNÉES ARRIVENT DÉJÀ PUCÉES, chacune à sa façon : `pour_toi` préfixe ses
 * lignes de `✅`, `process_recrutement` de `1️⃣ 2️⃣ 3️⃣`, d'autres champs de
 * tirets ou de « 1. ». Les rendre telles quelles dans une liste HTML affichait
 * DEUX marqueurs — « • ✅ Tu as… », « 1. 1️⃣ Screening… ». C'est la liste qui
 * numérote et qui puce ; le texte n'apporte que le texte.
 *
 * On ne retire qu'un marqueur EN TÊTE et suivi d'une espace : un ✅ au milieu
 * d'une phrase est du contenu, et « 2024 » en début de ligne est une date.
 */
function sansMarqueur(ligne: string): string {
  let t = ligne.trim();
  // Une ligne peut cumuler les marqueurs (« - 1️⃣ Appel »), et un marqueur peut
  // être SEUL sur sa ligne — d'où la boucle, et le `|$` de chaque motif.
  for (;;) {
    const avant = t;
    t = t
      // Les chiffres encerclés : leur base est le CHIFFRE ASCII, qui n'est pas
      // un pictogramme Unicode. `\p{Extended_Pictographic}` ne les voit donc
      // pas — mesuré, « 1️⃣ Pachamama » traversait le filtre intact.
      .replace(/^[\d#*]\uFE0F?\u20E3(?:\s+|$)/u, '')
      // Les autres pictogrammes de tête, ✅ compris, avec leurs sélecteurs de
      // variante et leurs jointures à largeur nulle.
      .replace(/^\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*(?:\s+|$)/u, '')
      // Tirets, puces et numérotations écrites.
      .replace(/^(?:[-–—•*·▪]|\d+[.)])(?:\s+|$)/u, '')
      .trim();
    if (t === avant) return t;
  }
}

/** Les cinq axes de la scorecard, dans l'ordre de la maquette. */
const AXES_SCORECARD = [
  ["Discovery", "scorecardDiscovery"],
  ["Delivery", "scorecardDelivery"],
  ["Stratégie", "scorecardStrategie"],
  ["Management", "scorecardManagement"],
  ["OPS", "scorecardOps"],
] as const;

/**
 * La répartition du poste, ou `null` si elle n'a pas été renseignée.
 *
 * ZÉRO N'EST PAS UNE ABSENCE. La maquette affiche « 0% » sur trois axes : c'est
 * une information — le poste ne fait pas de management. Le bloc ne disparaît
 * que si les CINQ axes sont nuls, ce qui est le cas des 12 offres publiées
 * aujourd'hui alors que 84 mandats du modèle les portent.
 */
export function scorecardDe(
  f: Fiche,
): { libelle: string; pourcentage: number }[] | null {
  const axes = AXES_SCORECARD.map(([libelle, cle]) => ({
    libelle,
    valeur: f[cle],
  }));
  if (axes.every((a) => a.valeur === null)) return null;
  return axes.map((a) => ({ libelle: a.libelle, pourcentage: a.valeur ?? 0 }));
}

/**
 * L'identifiant YouTube d'une valeur de base, ou `null`.
 *
 * On n'insère jamais la valeur reçue telle quelle dans un `<iframe src>` : elle
 * finirait dans le document sans contrôle. On en extrait l'identifiant, on
 * vérifie qu'il n'est qu'alphanumérique, et on reconstruit l'adresse. Une
 * valeur non reconnue ne rend rien — le bloc disparaît, ce qui est exactement
 * le comportement voulu.
 *
 * DEUX FORMES, et la première est celle que la base porte vraiment. Le champ
 * Bubble `z_vidéo_yt` stocke un IDENTIFIANT NU, pas une URL — c'est aussi le
 * format des 47 valeurs de `entreprise.video`. La version précédente n'acceptait
 * que les URL : elle aurait rendu `null` sur la totalité des données réelles, et
 * le bloc vidéo ne se serait jamais affiché. Le défaut n'était pas visible tant
 * qu'aucun mandat ne portait de vidéo.
 *
 * L'identifiant nu est accepté à ONZE caractères exactement, la longueur
 * canonique d'un identifiant YouTube. Élargir la fourchette comme le fait la
 * branche URL transformerait n'importe quel mot saisi de travers en vidéo.
 */
export function idVideoYoutube(valeur: string | null): string | null {
  if (!valeur) return null;
  const brut = valeur.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(brut)) return brut;
  const m = brut.match(
    /(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,20})/,
  );
  return m ? m[1] : null;
}

/** La teinte de la carte agent suit l'univers du job — annoté sur la maquette. */
export function teinteAgent(f: Fiche): Univers {
  return teinteUnivers(f.universCode);
}
