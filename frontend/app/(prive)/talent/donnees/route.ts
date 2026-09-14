import { moiCourant } from '@/lib/acces';
import { clientServeur } from '@/lib/supabase/serveur';

/**
 * L'EXPORT RGPD — un GET qui rend un fichier.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI UN ROUTE HANDLER ET NON UNE SERVER ACTION
 * ─────────────────────────────────────────────────────────────────────────
 * Trois raisons, dans cet ordre :
 *
 *   1. **Une Server Action ne peut pas poser d'en-tête.** Rendre un fichier
 *      que le navigateur enregistre demande `Content-Disposition:
 *      attachment; filename=…`, qui appartient à une réponse HTTP.
 *   2. **Un téléchargement lancé par un script est bloqué** dans plusieurs
 *      contextes — aperçu en bac à sable, navigateur restreint. Un lien `href`
 *      vers un GET marche partout.
 *   3. **Ça marche sans JavaScript.** Sur l'écran qui parle de garder la main
 *      sur ses données, c'est plus qu'un détail.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE CLOISONNEMENT N'EST PAS ICI
 * ─────────────────────────────────────────────────────────────────────────
 * `api.exporter_mes_donnees()` est `security invoker` et ne prend AUCUN
 * argument : elle exporte la fiche de `api.ma_fiche_talent()`, donc celle du
 * porteur du jeton. Il n'y a pas d'identifiant à passer, donc rien à falsifier.
 * Les trois refus ci-dessous ne sont que des gardes d'affichage — la vérité
 * reste dans la fonction.
 *
 * ⚠ UN ROUTE HANDLER N'EST PAS ENVELOPPÉ PAR `layout.tsx`.
 * `app/(prive)/talent/layout.tsx` appelle `exigerVue('talent')` et couvre les
 * sept PAGES du dossier ; il ne couvre pas ce fichier. Les gardes sont donc
 * refaits ici, explicitement, avec un statut par cause :
 *
 *   · pas de session          → 401
 *   · pas de portail talent   → 403
 *   · pas de fiche rattachée  → 404
 *
 * Mesuré avant correctif : le compte entreprise obtenait un **502** « l'export
 * a échoué de notre côté », parce que la fonction levait « aucune fiche talent
 * n'est rattachée à ce compte » et que la route traitait toute erreur comme une
 * panne. Un refus d'accès annoncé comme une panne envoie chercher un incident
 * qui n'existe pas.
 *
 * ⚠ CE QUE L'EXPORT NE CONTIENT PAS, ET C'EST VÉRIFIÉ EN BASE : 22 clés du
 * cabinet sont absentes de la charge, et aucun vocabulaire interne d'étape n'y
 * figure — le harnais `verifier:j4` l'éprouve clé par clé. La fonction est
 * aussi journalisée : `app.journal_ecriture` n'autorise que
 * `insert|update|delete`, donc l'export s'inscrit en `insert` sur l'entité
 * `rgpd.export`. C'est un abus assumé du vocabulaire, commenté côté base : un
 * export mérite une trace, c'est la preuve d'avoir honoré une demande d'accès.
 *
 * `dynamic = 'force-dynamic'` : un export mis en cache servirait le dossier
 * d'hier, et — bien pire sur une route sans paramètre — pourrait servir celui
 * de quelqu'un d'autre.
 */
export const dynamic = 'force-dynamic';

/** « pachamama-mes-donnees-2026-09-09.json ». */
function nomFichier(): string {
  const jour = new Date().toISOString().slice(0, 10);
  return `pachamama-mes-donnees-${jour}.json`;
}

/** Une réponse texte, brève, dans la langue du produit. */
function refus(message: string, statut: number) {
  return new Response(message, {
    status: statut,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function GET() {
  const moi = await moiCourant();
  if (!moi) {
    return refus('Vous devez être connecté pour exporter vos données.', 401);
  }
  if (!moi.portails.includes('talent')) {
    return refus('Cet export est réservé à un espace candidat.', 403);
  }
  if (!moi.ficheTalentId) {
    return refus(
      'Aucun dossier candidat n’est rattaché à votre compte : il n’y a rien à exporter.',
      404,
    );
  }

  const supabase = await clientServeur();
  const { data, error } = await supabase.schema('api').rpc('exporter_mes_donnees');

  if (error) {
    // Le corps d'une erreur PostgreSQL peut porter des noms de colonnes et des
    // valeurs : il part dans le journal du serveur, jamais dans la réponse.
    console.error(`[talent/donnees] export refusé : ${error.code ?? ''} — ${error.message}`);
    return refus(
      'L’export a échoué de notre côté. Réessayez dans un instant ; si cela persiste, dites-le à votre interlocuteur Pachamama.',
      502,
    );
  }

  // `null` est un retour possible : un compte sans fiche rattachée. On le dit
  // plutôt que de livrer un fichier « null » que personne ne saurait lire.
  // `null` reste possible malgré le garde ci-dessus : `app.acces` peut porter
  // une `fiche_talent_id` qui ne désigne plus rien. On le dit de la même façon.
  if (data === null || data === undefined) {
    return refus(
      'Aucun dossier candidat n’est rattaché à votre compte : il n’y a rien à exporter.',
      404,
    );
  }

  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nomFichier()}"`,
      // ⚠ CE FICHIER EST LE DOSSIER COMPLET D'UNE PERSONNE. Aucun cache, ni
      // navigateur, ni intermédiaire : `no-store` est la seule valeur
      // acceptable, et `private` la double pour les proxys qui l'ignorent.
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
