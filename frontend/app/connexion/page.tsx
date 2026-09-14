import { redirect } from 'next/navigation';

/**
 * `/connexion` — la route de compatibilité, qui NE PERD PLUS LA REQUÊTE.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE DÉFAUT QU'ELLE PORTAIT
 * ─────────────────────────────────────────────────────────────────────────
 * `components/vues/FicheOffre.tsx` envoie sur `/connexion?offre=<uuid>` depuis
 * ses deux boutons « Postuler ». Cette page faisait `redirect('/login')` **sans
 * la requête** : l'intention de candidater était perdue au premier saut, et la
 * personne atterrissait sur son espace sans savoir ce qu'elle était venue
 * faire. Le paramètre était donc écrit par un composant, lu par personne, et
 * jeté par une redirection de trois lignes.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QU'ELLE FAIT MAINTENANT
 * ─────────────────────────────────────────────────────────────────────────
 * Elle TRADUIT : `?offre=<uuid>` devient `/login?suite=/offres/<uuid>`.
 * L'écran de connexion n'a pas à connaître le vocabulaire du job board — il
 * n'a besoin que d'un chemin où revenir. Une seule notion de « suite » dans
 * l'application, et un seul endroit qui la valide.
 *
 * ⚠ L'UUID EST VÉRIFIÉ AVANT D'ÊTRE RECOPIÉ DANS UNE URL. Sans ce contrôle,
 * `?offre=//exemple.test` produirait `suite=//exemple.test` — une URL
 * protocole-relative, donc une redirection ouverte vers un domaine tiers. Le
 * garde de `/login` la refuserait aussi (il n'accepte qu'un chemin commençant
 * par une seule barre oblique) mais on ne construit pas une valeur douteuse en
 * comptant sur le lecteur suivant pour la refuser.
 *
 * Un `?offre=` illisible n'est pas une erreur : on redirige sans suite, et la
 * personne arrive sur l'écran de connexion normal.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Connexion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const brut = params.offre;
  const offre = Array.isArray(brut) ? brut[0] : brut;

  if (offre && UUID.test(offre)) {
    redirect(`/login?suite=${encodeURIComponent(`/offres/${offre}`)}`);
  }

  // `?suite=` est aussi accepté ici, pour que le lien de compatibilité serve à
  // n'importe quelle destination interne — le garde de `/login` reste le seul
  // arbitre de ce qui est acceptable.
  const brutSuite = params.suite;
  const suite = Array.isArray(brutSuite) ? brutSuite[0] : brutSuite;
  if (suite) redirect(`/login?suite=${encodeURIComponent(suite)}`);

  redirect('/login');
}
