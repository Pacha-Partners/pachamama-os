/**
 * OÙ REVENIR APRÈS S'ÊTRE CONNECTÉ — et le garde qui empêche d'aller ailleurs.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI CE MODULE EXISTE
 * ─────────────────────────────────────────────────────────────────────────
 * Le parcours « Postuler » traverse trois pages : la fiche d'offre envoie sur
 * `/connexion?offre=<uuid>`, qui traduit en `/login?suite=/offres/<uuid>`, qui
 * ramène sur l'offre après connexion. La notion de « suite » est donc partagée
 * par trois fichiers, et sa validation ne doit vivre qu'à un seul endroit :
 * une règle de sécurité écrite deux fois est une règle qui divergera.
 *
 * Il est aussi ici pour être ÉPROUVABLE. Dans un `page.tsx`, cette fonction
 * serait hors de portée d'un test unitaire — et c'est exactement le genre de
 * code qu'il faut tester, parce qu'il est court, qu'il a l'air évident, et
 * qu'une redirection ouverte ne se voit pas à la relecture.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ LA REDIRECTION OUVERTE, ET COMMENT ON LA REFUSE
 * ─────────────────────────────────────────────────────────────────────────
 * `?suite=` vient de l'URL, donc de n'importe qui. Un lien
 * `…/login?suite=https://exemple.test/phishing` ferait de notre écran de
 * connexion un tremplin vers une page qui ressemblerait à la nôtre — c'est la
 * forme classique de l'attaque, et elle marche d'autant mieux que le domaine
 * de départ est légitime.
 *
 * On valide donc par ce que la valeur DOIT ÊTRE, jamais par une liste de
 * choses interdites :
 *
 *   · elle commence par UNE barre oblique. `//hôte/…` est une URL
 *     protocole-relative, pas un chemin — c'est le contournement le plus
 *     courant de ce garde, et il est explicitement refusé. Cette seule règle
 *     écarte aussi `javascript:`, `data:` et tout schéma : un schéma ne peut
 *     pas commencer par `/` ;
 *   · elle ne contient pas de barre oblique inversée. Plusieurs navigateurs
 *     traitent `/\hôte` comme `//hôte` — donc comme une URL absolue ;
 *   · elle ne contient aucun caractère de contrôle, qui permettent d'injecter
 *     un en-tête dans certaines piles ;
 *   · elle tient en 512 caractères.
 *
 * LE REFUS REND `null`, DONC L'AIGUILLAGE PAR DÉFAUT. Un paramètre douteux ne
 * casse pas la connexion et n'affiche pas d'erreur : il est ignoré, et la
 * personne part vers sa vue habituelle. Échouer vers le comportement normal
 * est le sens sûr — c'est le même parti pris que `utilisateurCourant`.
 */

const LONGUEUR_MAX = 512;

/** Caractères de contrôle C0 et DEL, en points de code. */
const CONTROLE = /[\u0000-\u001f\u007f]/;

export function cheminInterne(brut: string | string[] | undefined): string | null {
  // Un paramètre répété (`?suite=a&suite=b`) arrive en tableau : on prend le
  // premier plutôt que de refuser, et il sera validé comme les autres.
  const valeur = Array.isArray(brut) ? brut[0] : brut;
  if (!valeur || valeur.length > LONGUEUR_MAX) return null;
  if (!valeur.startsWith('/') || valeur.startsWith('//')) return null;
  if (valeur.includes('\\')) return null;
  if (CONTROLE.test(valeur)) return null;
  return valeur;
}
