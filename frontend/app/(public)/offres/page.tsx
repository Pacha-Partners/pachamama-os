import { redirect } from "next/navigation";
import { Suspense } from "react";

import { moiCourant } from "@/lib/acces";

import { Squelette, SqueletteCarte } from "@/components/pacha/Squelette";
import { PageJobs } from "@/components/vues/PageJobs";
import { COLONNES_OFFRE, versOffre, type Offre } from "@/lib/domaine/offre";
import { clientServeur, environnementConfigure } from "@/lib/supabase/serveur";
import { VERSION_DEPLOYEE } from "@/lib/config";

export const metadata = {
  title: "Offres d’emploi — Product, Tech et Sales | Pachamama",
  description:
    "Les postes ouverts par le collectif Pachamama sur les univers Product, Tech et Sales, en CDI et en freelance.",
  // C'est la SEULE vue du produit destinée à être indexée : le reste est soit
  // privé, soit une démonstration à données fictives qu'il serait trompeur de
  // référencer.
  robots: { index: true, follow: true },
};

/**
 * Le job board public — la première page servie par le nouveau modèle.
 *
 * Elle lit `api.offre_publique` avec la CLÉ PUBLIQUE et la session du visiteur,
 * jamais la clé de service : le filtrage est fait par PostgreSQL, pas par du
 * TypeScript. Un visiteur sans compte ne voit que les mandats effectivement
 * publiés, parce que trois policies le lui imposent — pas parce que cette
 * requête est bien écrite.
 *
 * Rendu à la demande, sans cache : une offre retirée doit disparaître du site
 * au rafraîchissement suivant, pas au prochain déploiement.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ LA REQUÊTE EST BORNÉE. ELLE NE L'ÉTAIT PAS.
 * ─────────────────────────────────────────────────────────────────────────
 * La version du J1 lisait `api.offre_publique` SANS `.range()` : douze lignes
 * aujourd'hui, et autant que le cabinet en publiera demain, toutes rendues et
 * toutes sérialisées dans la charge utile RSC. Ce n'est pas un problème de
 * performance abstrait — c'est la même mécanique que D-15, une lecture non
 * bornée qui part dans le HTML.
 *
 * `NEUF PAR PAGE`, et le choix se justifie : la grille est en
 * `auto-fill minmax(300px, 320px)`, soit trois colonnes sur un écran courant —
 * neuf remplit exactement trois rangées. Et sur les douze offres publiées
 * mesurées le 09/09, neuf donne DEUX pages : le contrôle de pagination existe
 * donc réellement à l'écran et le harnais peut l'éprouver, au lieu d'être un
 * code mort qui n'apparaîtra que le jour où quelqu'un publiera la treizième.
 *
 * `count: 'exact'` : PostgREST rend le total dans `Content-Range`. Sur 12
 * lignes, `exact` ne coûte rien ; le jour où la table grossira, `planned`
 * deviendra le bon réglage, et il faudra le dire à l'écran (« environ 500 »).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ L'ATTENTE EST UN `Suspense` INTERNE, ET NON UN `loading.tsx`. MESURÉ.
 * ─────────────────────────────────────────────────────────────────────────
 * Le brief demande un `loading.tsx` pour le job board. Je l'ai écrit, posé sur
 * `app/(public)/offres/`, et mesuré :
 *
 *     /offres                                        → 200
 *     /offres/00000000-0000-4000-8000-000000000000   → **200**   (au lieu de 404)
 *
 * Un `loading.tsx` pose une frontière `Suspense` autour du segment ET DE SES
 * ENFANTS : `offres/[id]` se retrouve dedans, Next envoie la coquille avant que
 * la page n'ait résolu sa donnée, et une réponse commencée ne change plus de
 * statut. Le `notFound()` de la fiche rendait donc la bonne page avec un HTTP
 * 200 — c'est exactement le défaut trouvé en phase 1 sur
 * `/entreprise/mandats/<uuid inexistant>` (voir
 * `components/vues/entreprise/squelettes.tsx`), reproduit ici sur la seule vue
 * INDEXÉE du produit : Google aurait référencé des offres retirées.
 *
 * Le fichier a donc été supprimé, et l'attente descend d'un cran : la page
 * rend sa coquille tout de suite et met sa lecture derrière un `Suspense`
 * qu'elle porte elle-même. On y gagne les deux : le squelette pendant le
 * chargement, et un statut exact sur la route sœur. Le harnais
 * `verifier:j4-ecrans` surveille ce 404 précisément pour empêcher de reposer
 * innocemment cette frontière.
 */
export const dynamic = "force-dynamic";

/** Trois rangées de trois. Voir l'en-tête. */
const PAR_PAGE = 9;

/**
 * `?page=` lu défensivement.
 *
 * Une page qui n'est pas un entier positif est ramenée à 1 plutôt que de
 * produire un `.range()` négatif — PostgREST répondrait alors 416, donc un
 * écran d'erreur, pour une faute de frappe dans une URL. Le plafond de 10 000
 * borne l'absurde (`?page=99999999`) sans gêner personne.
 */
function pageDemandee(brut: string | string[] | undefined): number {
  const valeur = Array.isArray(brut) ? brut[0] : brut;
  const n = Number(valeur);
  if (!Number.isInteger(n) || n < 1 || n > 10000) return 1;
  return n;
}

export default async function Offres({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Un talent connecté a son propre écran « Offres », avec la barre latérale et
  // le bon geste. Le laisser ici lui montrait une page de vitrine qui savait
  // qu'il avait postulé — une incohérence relevée par le commanditaire.
  // Les visiteurs et les comptes sans portail talent restent sur le board :
  // l'indexation passe par des robots sans session, elle n'est pas touchée.
  const moi = await moiCourant();
  if (moi?.portails.includes("talent")) redirect("/talent/offres");

  const params = await searchParams;
  const page = pageDemandee(params.page);

  return (
    <main id="contenu">
      {/*
        `key={page}` : sans elle, passer de la page 1 à la page 2 réemploie la
        même frontière, qui ne se re-suspend pas — on resterait sur l'ancienne
        liste jusqu'à l'arrivée de la nouvelle, sans rien indiquer. Avec la
        clé, chaque page a sa propre attente.
      */}
      <Suspense key={page} fallback={<SqueletteBoard />}>
        <Board page={page} />
      </Suspense>
    </main>
  );
}

/**
 * L'attente du board.
 *
 * `role="status"` et non `aria-label` seul : sur un `<div>` nu, dont le rôle
 * est `generic`, `aria-label` n'est pas exposé. Les squelettes étant
 * `aria-hidden`, l'attente ne s'annoncerait nulle part.
 */
function SqueletteBoard() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="min-h-dvh bg-[var(--fond-page)] p-4 md:p-8"
    >
      <span className="sr-only">Chargement des offres</span>
      <Squelette largeur="34%" hauteur={40} />
      {/* Le MÊME gabarit que la grille réelle : un squelette qui ne tient pas
          la même géométrie fait sauter la mise en page à l'arrivée des cartes,
          ce qui est exactement ce qu'un squelette existe pour éviter. */}
      <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(300px,320px))] justify-start gap-8">
        {Array.from({ length: 6 }, (_, i) => (
          <SqueletteCarte key={i} lignes={3} />
        ))}
      </div>
    </div>
  );
}

async function Board({ page }: { page: number }) {
  const debut = (page - 1) * PAR_PAGE;

  // ⚠ SANS CONFIGURATION, UN ÉTAT LISIBLE — PAS UN SQUELETTE ÉTERNEL.
  // `clientServeur()` lève quand les deux variables sont absentes, et
  // l'exception remontait dans le `<Suspense>` de la page : elle rendait 200,
  // affichait « Chargement des offres », et n'en sortait jamais. Mesuré le
  // 14/09 sur la prévisualisation de `dev`, où aucune variable n'est posée.
  // Un chargement qui ne finit pas est le pire des états : il n'informe
  // personne et n'invite à rien.
  //
  // On rejoint la branche d'erreur déjà écrite plus bas plutôt que d'inventer
  // un second écran : pour le visiteur, « pas de configuration » et « service
  // muet » sont le même fait — les offres ne s'affichent pas.
  if (!environnementConfigure()) {
    console.warn("[/offres] environnement non configuré : aucune offre à lire.");
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="t-h2">Les offres sont momentanément indisponibles</h1>
        <p className="t-body mt-2 text-[var(--encre-500)]">
          Le service ne répond pas. Réessayez dans un instant, ou retrouvez nos
          offres sur{" "}
          <a className="underline" href={VERSION_DEPLOYEE}>
            l’application Pachamama
          </a>
          .
        </p>
      </div>
    );
  }

  const supabase = await clientServeur();

  /**
   * Un réessai, et un seul.
   *
   * Mesuré au lancement du serveur : les deux premiers appels ont mis 7 à 8
   * secondes d'exécution avant d'échouer, puis tous les suivants sont revenus
   * en 80 à 200 ms. La première connexion vers Supabase — résolution DNS,
   * poignée de main TLS — paie un coût que les suivantes ne paient plus, et
   * elle tombait dans un écran d'erreur définitif.
   *
   * Un réessai suffit donc à absorber ce démarrage à froid. Il reste UNIQUE et
   * immédiat : au-delà, ce n'est plus une lenteur transitoire mais une panne,
   * et une panne doit se voir plutôt que s'étirer en chargement interminable.
   */
  const lire = () =>
    supabase
      .schema("api")
      .from("offre_publique")
      .select(COLONNES_OFFRE, { count: "exact" })
      .order("publie_le", { ascending: false })
      .range(debut, debut + PAR_PAGE - 1);

  let { data, error, count } = await lire();
  if (error) {
    console.warn(
      "[/offres] premier essai en échec, on réessaie :",
      error.message,
    );
    ({ data, error, count } = await lire());
  }

  /**
   * ⚠ UNE PAGE AU-DELÀ DU TOTAL N'EST PAS UNE PANNE. MESURÉ.
   *
   *     Range: 8982-8990  →  HTTP 416
   *     {"code":"PGRST103","details":"An offset of 8982 was requested,
   *       but there are only 12 rows.","message":"Requested range not
   *       satisfiable"}
   *
   * PostgREST refuse une fenêtre qui commence après la dernière ligne. Sans ce
   * traitement, `/offres?page=999` tombait dans la branche d'erreur et
   * affichait « Les offres sont momentanément indisponibles » : le service
   * répondait parfaitement, et l'écran accusait une panne. C'est exactement la
   * confusion que le harnais J1 traque, à l'envers — une adresse fautive
   * déguisée en incident.
   *
   * Le total est pourtant dans la réponse (l'en-tête `content-range` rend
   * « astérisque barre oblique 12 »), mais
   * supabase-js n'expose pas les en-têtes d'une erreur. On le redemande donc
   * par un `head: true` — un aller-retour de plus, dans un cas qui n'arrive
   * qu'à une adresse tapée à la main — plutôt que de lire un nombre dans le
   * texte d'un message d'erreur, ce qui casserait à la première reformulation
   * de PostgREST.
   */
  if (error && (error as { code?: string }).code === "PGRST103") {
    const { count: total } = await supabase
      .schema("api")
      .from("offre_publique")
      .select("id", { count: "exact", head: true });
    return (
      <PageJobs
        offres={[]}
        lienEspaceTalent="/connexion"
        lienSiteWeb="https://www.pachamama-collective.com/"
        page={page}
        parPage={PAR_PAGE}
        total={total ?? 0}
      />
    );
  }

  // Une base injoignable et un job board vide se ressemblent : c'est exactement
  // la confusion que le harnais J1 traque. On ne la reproduit pas ici — l'échec
  // se dit, il ne se déguise pas en « aucune offre ».
  if (error) {
    // Un écran d'erreur qui ne dit rien aux journaux ne sert que le visiteur :
    // il laisse celui qui doit réparer sans la moindre prise.
    console.error("[/offres] lecture de api.offre_publique refusée :", error);
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="t-h2">Les offres sont momentanément indisponibles</h1>
        <p className="t-body mt-2 text-[var(--encre-500)]">
          Le service ne répond pas. Réessayez dans un instant, ou retrouvez nos
          offres sur{" "}
          <a className="underline" href={VERSION_DEPLOYEE}>
            l’application Pachamama
          </a>
          .
        </p>
      </div>
    );
  }

  // Le typage de supabase-js sur un schéma non généré rend une union pessimiste ;
  // le passage par `unknown` est le geste que TypeScript demande explicitement.
  const offres: Offre[] = (
    (data ?? []) as unknown as Record<string, unknown>[]
  ).map(versOffre);

  return (
    <PageJobs
      offres={offres}
      // ⚠ `/connexion` ET NON `/login` : la route de compatibilité traduit
      // désormais sa requête (voir `app/connexion/page.tsx`), et c'est le
      // lien que le reste du site partage déjà.
      lienEspaceTalent="/connexion"
      lienSiteWeb="https://www.pachamama-collective.com/"
      page={page}
      parPage={PAR_PAGE}
      // `count` est nul si PostgREST n'a pas rendu l'en-tête : on retombe
      // alors sur la taille de la fenêtre, ce qui éteint la pagination au lieu
      // d'afficher « 1–9 sur 0 ».
      total={count ?? offres.length}
    />
  );
}
