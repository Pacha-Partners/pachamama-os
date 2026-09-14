import { PageJobs } from '@/components/vues/PageJobs';
import { CadreEcran, EnteteEcran } from '@/components/vues/talent/atomes';
import { COLONNES_OFFRE, versOffre, type Offre } from '@/lib/domaine/offre';
import { clientServeur } from '@/lib/supabase/serveur';

export const metadata = { title: 'Offres' };
export const dynamic = 'force-dynamic';

/**
 * LES OFFRES, DANS L'ESPACE TALENT.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES MÊMES LIGNES QUE LE JOB BOARD PUBLIC, ET C'EST DÉLIBÉRÉ
 * ─────────────────────────────────────────────────────────────────────────
 * `api.offre_publique` est ouverte à `anon` ET à `authenticated` : un compte
 * connecté y voit exactement ce qu'un visiteur y voit — mesuré par le harnais
 * J2, 12 offres contre 12. Cet écran ne crée donc AUCUNE vue : il sert la même
 * liste dans la coquille connectée.
 *
 * Le commanditaire a d'abord demandé que les mandats « private » y figurent
 * aussi, puis s'est ravisé le temps d'en parler aux recruteurs. La mesure qui
 * a nourri ce retour, pour mémoire : 57 mandats ouverts sur 533, dont 44
 * privés et 13 publics ; et aucune propriété du modèle ne dit « ouvert mais
 * pas encore montrable » — `confidentiel` et `valide_par_am_le` existent mais
 * ne sont alimentées par rien, et l'outil no-code ne portait que quatre
 * champs : visibilite, job_off_market, job_anonyme, statut.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUI CHANGE PAR RAPPORT À LA VUE PUBLIQUE
 * ─────────────────────────────────────────────────────────────────────────
 * La barre latérale remplace le monogramme, l'en-tête d'écran porte le titre,
 * « Login » disparaît — la personne est connectée — et « Postuler » devient
 * « Je suis intéressé·e » sur la fiche. Le geste, lui, est le même :
 * `api.postuler`.
 *
 * ⚠ PAS DE PAGINATION ICI. La vue publique en a une parce qu'elle est indexée
 * et peut grossir ; à 12 offres, un espace connecté n'en a pas besoin, et la
 * barre de filtres suffit. `parPage` est donc omis, ce qui désactive la
 * pagination du composant — c'est son contrat.
 */
export default async function Vue() {
  const supabase = await clientServeur();

  // Un réessai, et un seul : même raison que sur le board public — la première
  // connexion vers Supabase paie un coût de démarrage que les suivantes ne
  // paient plus, et elle tombait dans un écran d'erreur définitif.
  const lire = () =>
    supabase
      .schema('api')
      .from('offre_publique')
      .select(COLONNES_OFFRE)
      .order('publie_le', { ascending: false });

  let { data, error } = await lire();
  if (error) {
    console.warn('[/talent/offres] premier essai en échec, on réessaie :', error.message);
    ({ data, error } = await lire());
  }
  if (error) {
    console.error('[/talent/offres] lecture impossible :', error.message);
    throw new Error('Les offres sont momentanément indisponibles.');
  }

  const offres: Offre[] = (data ?? []).map((l) =>
    versOffre(l as unknown as Record<string, unknown>),
  );

  return (
    // Le cadre d'écran STANDARD, comme les autres écrans du portail : même
    // gouttière avec la barre latérale, même centrage. Il bornait la grille à
    // 1180px, ce qui élargissait les cartes tant qu'elles s'étiraient en `1fr` ;
    // depuis que le gabarit est borné à 320px, la largeur du conteneur ne
    // change plus que le NOMBRE de colonnes. La rustine `max-w-none` n'a donc
    // plus lieu d'être — et elle collait l'écran à la barre latérale.
    <CadreEcran>
      <EnteteEcran descriptif="Les offres" impact="Pachamama" />
      <PageJobs
        offres={offres}
        hote="talent"
        // Les deux liens ne sont pas rendus en mode « talent » ; ils restent
        // exigés par le contrat du composant, qui les porte pour le public.
        lienEspaceTalent="/talent"
        lienSiteWeb="https://www.pachamama-collective.com"
      />
    </CadreEcran>
  );
}
