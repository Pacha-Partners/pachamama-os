import { CandidatureIntrouvable } from '@/components/vues/talent/DetailCandidature';

export const metadata = { title: 'Candidature introuvable' };

/**
 * Le 404 d'une candidature.
 *
 * DEUX CAUSES, UN SEUL TEXTE, et il doit couvrir les deux honnêtement : soit la
 * candidature n'existe pas, soit elle n'est pas la vôtre. Le second cas est
 * celui que la RLS produit — `api.ma_candidature_detail` est filtrée sur
 * `api.ma_fiche_talent()`, donc l'identifiant d'un autre candidat rend zéro
 * ligne, exactement comme un identifiant inventé. On ne distingue pas les deux
 * à l'écran, et c'est voulu : les distinguer dirait à qui essaie des
 * identifiants lesquels existent.
 */
export default function Introuvable() {
  return (
    <div className="mx-auto w-full max-w-[1180px] pt-2">
      <CandidatureIntrouvable />
    </div>
  );
}
