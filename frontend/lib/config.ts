/** L'application en ligne, qui continue d'évoluer après le rendu du projet. */
export const VERSION_DEPLOYEE = 'https://pachamama-os.vercel.app/';

/**
 * Deux régimes pour un même code.
 *
 * Le code remis avec le dossier est un instantané figé : il n'a ni identifiants
 * ni base, et plusieurs de ses vues sont encore incomplètes. L'exposer telle
 * quelle donnerait à lire des écrans à moitié faits, ce qui dessert le travail
 * plutôt qu'il ne le montre. Dans ce régime, seuls l'écran de connexion et le
 * design system sont accessibles, et tout le reste renvoie vers l'application en
 * ligne.
 *
 * Le déploiement, lui, est la version vivante. Il ouvre l'ensemble des vues dès
 * que `NEXT_PUBLIC_VERSION_EN_LIGNE=1` est posé dans son environnement.
 *
 * Le choix du sens par défaut n'est pas neutre : **fermé**. Un réglage oublié
 * ferme des pages, il n'en ouvre pas par accident, et c'est la seule direction
 * acceptable pour un défaut.
 */
export const EST_VERSION_EN_LIGNE = process.env.NEXT_PUBLIC_VERSION_EN_LIGNE === '1';
