import { Squelette, SqueletteCarte, SqueletteLigneTableau } from '@/components/pacha/Squelette';

/**
 * LES ATTENTES DE SECTION.
 *
 * Elles ne vivent pas dans un `loading.tsx`, et c'est une correction mesurée
 * plutôt qu'un goût.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI PAS `loading.tsx` SUR LES ROUTES `[id]`
 * ─────────────────────────────────────────────────────────────────────────
 * Un `loading.tsx` pose une frontière `Suspense` AUTOUR DE LA PAGE ENTIÈRE.
 * Next envoie alors la coquille et le squelette immédiatement, avant que la
 * page n'ait résolu sa donnée — et une réponse commencée ne change plus de
 * statut. `notFound()` rendait donc la bonne page avec un **HTTP 200**.
 *
 * Mesuré le 09/09 sur le serveur de production comme en développement :
 * `/entreprise/mandats/<uuid inexistant>` → 200 avec le contenu du 404, alors
 * que `/offres/<uuid inexistant>`, qui n'a pas de `loading.tsx`, rend bien 404.
 * C'est le harnais `tests/j3-portail-entreprise-ecrans.mjs` qui l'a trouvé.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QU'ON FAIT À LA PLACE, ET POURQUOI C'EST MIEUX
 * ─────────────────────────────────────────────────────────────────────────
 * La page attend SA LIGNE — une seule, par identifiant, quelques dizaines de
 * millisecondes — puis rend son en-tête tout de suite et met les sections
 * coûteuses (pipeline, notes, annonce publiée) derrière leur propre `Suspense`.
 * On y gagne deux fois : le statut redevient exact, et le lecteur voit le titre
 * du poste avant que le pipeline n'arrive, au lieu d'un écran entièrement gris.
 */

/**
 * L'ATTENTE DOIT S'ENTENDRE, pas seulement se voir.
 *
 * Les squelettes sont `aria-hidden` par construction — c'est au conteneur
 * d'annoncer. Or `aria-label` sur un `<div>` nu n'est PAS exposé : l'attribut
 * ne s'applique qu'aux éléments porteurs d'un rôle, et un `div` a le rôle
 * `generic`. Ces conteneurs étaient donc muets. `role="status"` leur donne le
 * rôle qui manquait — et une région vivante polie — et le texte à annoncer
 * descend dans un `sr-only`, qui marche partout. C'est exactement ce que
 * `Tableau` fait déjà en bas de son propre fichier.
 */
function Annonce({ children }: { children: string }) {
  return <span className="sr-only">{children}</span>;
}

export function SqueletteSection({ cartes = 2 }: { cartes?: number }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <Annonce>Chargement en cours</Annonce>
      <Squelette largeur={180} hauteur={24} />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: cartes }, (_, i) => (
          <SqueletteCarte key={i} avecVignette={false} lignes={3} />
        ))}
      </div>
    </div>
  );
}

export function SqueletteTableau({ lignes = 5, colonnes = 5 }: { lignes?: number; colonnes?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="rounded-[var(--r-md)] border border-[var(--encre-100)] bg-[var(--fond-carte)]"
    >
      <Annonce>Chargement en cours</Annonce>
      {Array.from({ length: lignes }, (_, i) => (
        <SqueletteLigneTableau key={i} colonnes={colonnes} />
      ))}
    </div>
  );
}

export function SqueletteBloc({ lignes = 4 }: { lignes?: number }) {
  return (
    <div role="status" aria-busy="true">
      <Annonce>Chargement en cours</Annonce>
      <SqueletteCarte avecVignette={false} lignes={lignes} />
    </div>
  );
}
