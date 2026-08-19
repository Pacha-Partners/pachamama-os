import { ICONES, NOMS_ICONES, type NomIcone } from '@/lib/icones';
import { cn } from '@/lib/utils';

/**
 * Icone — accès unique au jeu d'icônes du Figma.
 *
 * Le jeu est celui de Feather, servi par lucide-react (le fork maintenu). La
 * table de correspondance vit dans lib/icones.ts : elle est longue, et la garder
 * à part évite d'enterrer les vingt lignes utiles de ce fichier sous deux cent
 * cinquante lignes de tableau. Elle documente aussi les trois pièges de
 * renommage Feather -> Lucide, à lire avant d'y toucher.
 *
 * Pourquoi passer par un composant plutôt qu'importer l'icône Lucide
 * directement : c'est ici, et une seule fois, que se règlent la cote par défaut
 * (24px, Figma.md:57660) et la question de l'accessibilité. Une icône importée à
 * la main dans un écran, c'est une icône dont personne ne vérifie si elle est
 * décorative ou signifiante.
 *
 * La cote : 24x24 dans tout le Figma — les 285 occurrences de
 * `Property 1=icon-*` sont sans exception en `width: 24px; height: 24px`. Elle
 * vient de la classe CSS (h-6 w-6) et non de l'attribut `size` de Lucide, pour
 * qu'un appelant puisse la réduire avec un simple `className="h-4 w-4"`.
 *
 * L'épaisseur de trait reste celle de Lucide (2px). Le relevé du Figma la
 * confirme : la boîte englobante de `icon-circle` va de 1 à 23 sur un tracé de
 * rayon 10 centré, soit exactement 1px de débord de chaque côté
 * (Figma.md:49917).
 *
 * Composant pur : pas de 'use client'. lucide-react porte déjà sa propre
 * directive client sur son composant Icon interne, ce fichier n'a pas à la
 * dupliquer.
 */
export type { NomIcone };
export { NOMS_ICONES };

export function Icone({
  nom,
  className,
  titre,
}: {
  nom: NomIcone;
  className?: string;
  /**
   * Absent = l'icône est décorative : elle est masquée aux lecteurs d'écran, et
   * le sens qu'elle porte doit exister en texte à côté d'elle. Présent = elle
   * porte le sens à elle seule (bouton icône), on lui donne role="img" et un
   * <title>. C'est la règle §6 du design system : une information critique
   * n'est jamais portée par le seul dessin.
   */
  titre?: string;
}) {
  const Glyphe = ICONES[nom];
  return (
    <Glyphe
      className={cn('h-6 w-6 shrink-0', className)}
      role={titre ? 'img' : undefined}
      aria-hidden={titre ? undefined : true}
    >
      {/* Lucide concatène `children` à ses propres nœuds dans un tableau : sans
          `key`, React réclame une clé en développement. */}
      {titre ? <title key="titre">{titre}</title> : null}
    </Glyphe>
  );
}
