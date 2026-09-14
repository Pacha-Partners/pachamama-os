import { notFound } from 'next/navigation';

import { FicheOffre } from '@/components/vues/FicheOffre';
import { CadreEcran } from '@/components/vues/talent/atomes';
import { Postuler } from '@/components/vues/talent/Postuler';
import { COLONNES_FICHE, versFiche } from '@/lib/domaine/fiche';
import { clientServeur } from '@/lib/supabase/serveur';
import { mesMandatsPostules } from '@/lib/talent/lectures';

export const dynamic = 'force-dynamic';

/**
 * LA FICHE D'UNE OFFRE, DANS L'ESPACE TALENT.
 *
 * Même vue et même lecture que la fiche publique — `api.offre_detail`, ouverte
 * à `anon` comme à `authenticated`. Trois différences, toutes de contexte :
 *
 *  · la coquille connectée l'entoure, donc la barre latérale reste là ;
 *  · le bouton dit « Je suis intéressé·e » et non « Postuler » ;
 *  · il n'y a pas de branche « visiteur » — la route est sous `(prive)`, le
 *    portail talent est donc déjà vérifié par la coquille. Pas de
 *    `PostulerApresConnexion`, pas de `?suite=`.
 *
 * ⚠ AUCUNE MÉTADONNÉE D'INDEXATION. La fiche publique en porte, parce qu'elle
 * est la seule vue du produit destinée aux moteurs. Celle-ci est privée : lui
 * donner un `robots: index` reviendrait à publier deux fois la même offre sous
 * deux adresses, dont une que personne ne peut ouvrir sans compte.
 *
 * ⚠ PAS DE `FournisseurToasts` ICI. La coquille connectée le monte déjà pour
 * tout l'espace. Le monter une seconde fois imbriquerait deux régions
 * `aria-live`, et l'annonce partirait dans celle du dessous.
 */
async function lireFiche(id: string) {
  // Un identifiant qui n'est pas un uuid ferait échouer PostgREST avec un 400
  // plutôt qu'un résultat vide : on le refuse avant la requête.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;

  const supabase = await clientServeur();
  const lire = () =>
    supabase.schema('api').from('offre_detail').select(COLONNES_FICHE).eq('id', id).maybeSingle();

  let { data, error } = await lire();
  if (error) {
    console.warn('[/talent/offres/:id] premier essai en échec, on réessaie :', error.message);
    ({ data, error } = await lire());
  }
  if (error) {
    console.error('[/talent/offres/:id] lecture impossible :', error.message);
    throw new Error('La fiche est momentanément indisponible.');
  }
  return data ? versFiche(data as unknown as Record<string, unknown>) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fiche = await lireFiche(id).catch(() => null);
  return { title: fiche ? fiche.intitule : 'Offre introuvable', robots: { index: false } };
}

export default async function Vue({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fiche = await lireFiche(id);
  if (!fiche) notFound();

  // Une candidature qui ne se lit pas ne doit pas faire tomber la fiche : au
  // pire on propose un geste que `api.postuler` refusera avec son message.
  const postules = await mesMandatsPostules().catch(() => new Map<string, string>());

  return (
    <CadreEcran>
      <FicheOffre
        fiche={fiche}
        hote="talent"
        retourHref="/talent/offres"
        actionCandidature={
          <Postuler
            mandatId={fiche.id}
            intitule={fiche.intitule}
            dejaPostule={postules.has(fiche.id)}
            candidatureId={postules.get(fiche.id) ?? null}
            libelle="Je suis intéressé·e"
          />
        }
      />
    </CadreEcran>
  );
}
