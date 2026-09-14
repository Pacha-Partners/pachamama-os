"use client";

import { useSyncExternalStore } from "react";

/**
 * `md` de Tailwind : 768px. La valeur est répétée ici parce qu'aucune API ne
 * permet de lire les points de rupture de Tailwind v4 depuis JavaScript. Si
 * elle change dans le thème, elle doit changer ici — d'où ce commentaire.
 */
const SEUIL_MOBILE = "(max-width: 767.98px)";

/**
 * Vrai en dessous de `md`.
 *
 * À N'UTILISER QUE POUR CHANGER DE COMPORTEMENT, jamais pour changer une
 * apparence : une mise en forme se fait en CSS, qui répond au redimensionnement
 * sans rendu et fonctionne dès le premier octet. Ce hook existe pour les cas
 * où le CSS ne suffit pas — ici, un sélecteur qui ouvre une liste déroulante en
 * desktop et une feuille modale en mobile, ce qui n'est pas la même interaction
 * et pas le même arbre.
 *
 * `useSyncExternalStore` plutôt qu'un `useEffect` : le rendu serveur renvoie
 * `false` de façon déterministe, donc l'hydratation ne diverge pas, et le
 * changement de largeur est pris en compte sans rendu superflu.
 */
/*
 * Les trois fonctions sont déclarées AU NIVEAU DU MODULE et non en ligne dans
 * l'appel : `useSyncExternalStore` compare l'identité de `subscribe`, et une
 * fonction fléchée recréée à chaque rendu le fait se désabonner puis se
 * réabonner à chaque fois. Sur un composant qui rend souvent, cela revient à
 * défaire et refaire un écouteur `matchMedia` à chaque frappe.
 */
const souscrire = (surChangement: () => void) => {
  const liste = window.matchMedia(SEUIL_MOBILE);
  liste.addEventListener("change", surChangement);
  // `resize` EN PLUS de `change`, et ce n'est pas une ceinture-bretelles
  // gratuite : mesuré, il existe des contextes où le franchissement du seuil
  // ne déclenche AUCUN événement `change` sur la MediaQueryList alors que
  // `matches` a bien basculé — un écouteur posé à la main n'y reçoit rien non
  // plus. Le composant restait alors coincé dans l'arbre mobile sur un écran
  // devenu large. `resize` rattrape ce cas, et il ne coûte rien : `getSnapshot`
  // rend un booléen primitif, donc React ne redessine que si la valeur a
  // réellement changé, pas à chaque pixel de redimensionnement.
  window.addEventListener("resize", surChangement);
  return () => {
    liste.removeEventListener("change", surChangement);
    window.removeEventListener("resize", surChangement);
  };
};

const lireClient = () => window.matchMedia(SEUIL_MOBILE).matches;

/** Côté serveur on rend le desktop ; le client corrige après l'hydratation. */
const lireServeur = () => false;

export function useEstMobile(): boolean {
  return useSyncExternalStore(souscrire, lireClient, lireServeur);
}
