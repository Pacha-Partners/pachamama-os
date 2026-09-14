import { notFound } from 'next/navigation';
import { FournisseurToasts } from '@/components/pacha/Toast';
import { FicheOffre } from '@/components/vues/FicheOffre';
import { PostulerApresConnexion } from '@/components/vues/talent/Postuler';
import { redirect } from 'next/navigation';

import { moiCourant } from '@/lib/acces';
import { COLONNES_FICHE, versFiche } from '@/lib/domaine/fiche';
import { clientServeur } from '@/lib/supabase/serveur';

/**
 * LA FICHE D'UNE OFFRE PUBLIÉE.
 *
 * Elle lit `api.offre_detail` avec la CLÉ PUBLIQUE, jamais la clé de service :
 * le filtrage est fait par PostgreSQL. La vue ne rend que les mandats portant
 * un acte de publication non retiré — un identifiant valide qui désigne une
 * offre dépubliée rend donc zéro ligne, et cette page un 404. C'est voulu :
 * une offre retirée doit disparaître, pas rester atteignable par son lien.
 *
 * ADRESSÉE PAR L'UUID DU MANDAT. La version précédente servait des fixtures
 * indexées par slug, ce qui est la raison pour laquelle le titre des cartes du
 * job board n'était pas cliquable — un uuid y donnait un 404. Le lien est
 * rétabli dans le même mouvement.
 *
 * Rendu à la demande, sans cache, pour la même raison que le board : une offre
 * retirée doit disparaître au rafraîchissement suivant.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ ELLE NE S'ADAPTE PLUS À LA SESSION : ELLE RENVOIE CHEZ SOI
 * ─────────────────────────────────────────────────────────────────────────
 * Elle le faisait — « Postuler » qui postait vraiment pour un talent connecté,
 * « Candidature déposée » s'il l'avait déjà fait. C'était défendable tant que
 * le job board était la SEULE façon de voir une offre. Depuis que l'espace
 * talent a son écran « Offres », c'était devenu une incohérence visible : le
 * commanditaire, connecté dans le même navigateur, voyait son propre état de
 * candidature sur une page de vitrine.
 *
 * Un talent connecté est donc REDIRIGÉ vers la même offre dans son espace. Les
 * autres — visiteurs, comptes entreprise, comptes recruteur — restent ici :
 * eux n'ont pas d'écran équivalent, et la page ne leur montre rien de privé.
 *
 * Conséquences, toutes voulues :
 *  · plus aucune lecture de dossier depuis une page publique ;
 *  · le bouton est TOUJOURS le lien de connexion, qui survit au détour
 *    (`?suite=`) — c'est ce que le commanditaire demandait ;
 *  · l'indexation n'est pas touchée : un robot n'a pas de session, il ne
 *    rencontre jamais la redirection.
 *
 * `moiCourant()` échoue vers `null` (voir `lib/acces.ts`) : une couche de
 * session en panne rend donc la fiche telle qu'un visiteur la voit, jamais une
 * page en erreur — et surtout jamais une redirection en boucle.
 */
export const dynamic = 'force-dynamic';

async function lireFiche(id: string) {
  // Un identifiant qui n'est pas un uuid ferait échouer PostgREST avec une
  // erreur 400 plutôt qu'un résultat vide. On le refuse avant la requête :
  // une adresse malformée est un 404, pas une panne.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;

  const supabase = await clientServeur();
  const lire = () =>
    supabase.schema('api').from('offre_detail').select(COLONNES_FICHE).eq('id', id).maybeSingle();

  // Un réessai, et un seul — même raison que sur le job board : la première
  // connexion vers Supabase paie un coût que les suivantes ne paient plus.
  let { data, error } = await lire();
  if (error) {
    console.warn('[/offres/:id] premier essai en échec, on réessaie :', error.message);
    ({ data, error } = await lire());
  }
  if (error) {
    console.error('[/offres/:id] lecture impossible :', error.message);
    throw new Error('La fiche est momentanément indisponible.');
  }
  // Le même transtypage que sur le board : PostgREST rend un type générique
  // quand la liste de colonnes est une chaîne, et c'est `versFiche` qui porte
  // la vraie connaissance de la forme.
  return data ? versFiche(data as unknown as Record<string, unknown>) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fiche = await lireFiche(id).catch(() => null);
  if (!fiche) return { title: 'Offre introuvable | Pachamama', robots: { index: false } };

  // Le titre de l'onglet ne doit pas nommer le client d'une offre anonyme : ce
  // serait le seul endroit de la page à le faire, et il part dans les moteurs.
  const chez = fiche.entreprise ? `chez ${fiche.entreprise}` : '— entreprise anonyme';
  return {
    title: `${fiche.intitule} ${chez} | Pachamama`,
    description:
      fiche.description?.slice(0, 155) ??
      `${fiche.intitule}${fiche.localisation ? ` — ${fiche.localisation}` : ''}. Une offre du collectif Pachamama.`,
    robots: { index: true, follow: true },
  };
}

export default async function Fiche({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fiche = await lireFiche(id);
  if (!fiche) notFound();

  // Un talent connecté a cette offre chez lui, avec son état de candidature :
  // on l'y envoie plutôt que de lui servir une page de vitrine qui prétendrait
  // le connaître.
  const moi = await moiCourant();
  if (moi?.portails.includes('talent')) redirect(`/talent/offres/${fiche.id}`);

  const action = <PostulerApresConnexion mandatId={fiche.id} />;

  return (
    <main id="contenu">
      {/*
        LE FOURNISSEUR DE TOASTS EST MONTÉ ICI, et seulement ici parmi les vues
        publiques : `Postuler` annonce le résultat du dépôt par un toast, et sa
        région `aria-live` doit exister AVANT qu'on y insère quoi que ce soit —
        un `aria-live` inséré avec son contenu n'annonce rien.

        Il est monté même pour un visiteur : le coût est un `<div>` vide, et le
        conditionner ferait dépendre la structure de la page de la session, donc
        deux arbres possibles sur une page indexée.
      */}
      <FournisseurToasts>
        <FicheOffre fiche={fiche} actionCandidature={action} />
      </FournisseurToasts>
    </main>
  );
}
