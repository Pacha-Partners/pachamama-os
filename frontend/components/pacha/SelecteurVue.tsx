'use client';

import { LayoutGrid, SquareKanban } from 'lucide-react';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';

import { cn } from '@/lib/utils';

/**
 * SelecteurVue — la bascule liste/cartes ↔ kanban de la page des offres.
 *
 * Composant Figma : `Job Kanban Switcher` (Figma.md:8896). Axe réel relevé :
 * `Property 1={Kanban, Kanban hover, Dashboard, Dashboard hover}` — quatre
 * variantes, pas huit.
 *
 * MISE AU POINT SUR L'ÉNONCÉ : les valeurs `{Fill, Fill hover, Default, Hover}`
 * existent bien dans le fichier (Figma.md:8457, 8496, 8568, 8608), mais elles
 * appartiennent à `Date picker line` — un champ de date, pas ce sélecteur. Les
 * `Property 1={Default, Hover}` de 8693 et 8795 appartiennent à `Hidden status`.
 * Vérifié en remontant à la couche parente de chaque bloc. Il n'y a donc pas
 * d'axe `Fill` ici. De même, `Name={Card Vue, Kaban vue}` (Figma.md:6285, 6308)
 * n'est pas ce composant : ce sont les deux GLYPHES, dans le jeu d'icônes.
 *
 * COTES — conteneur en ligne, gap 4px, hauteur 24px, sans fond ni bordure, avec
 * un filet vertical de 1px #E7E6EB (= --encre-100) entre les deux icônes
 * (Figma.md:8949-8954 : `Line 1`, 24px, rotate(90deg)). Icônes 24×24.
 *
 * COULEURS — l'actif est noir, l'inactif gris. Les quatre variantes se lisent
 * ainsi, une fois croisées :
 *
 *   Property 1=Dashboard        widget #000000 · kanban #ADABB3  Figma.md:9154, 9192
 *   Property 1=Kanban           widget #ADABB3 · kanban #000000  Figma.md:8946, 8984
 *   Property 1=Kanban hover     widget #000000 · kanban #CAC9CD  Figma.md:9258, 9296
 *   Property 1=Dashboard hover  widget #CAC9CD · kanban #000000  Figma.md:9050, 9088
 *
 * La lecture cohérente est : le nom désigne la vue SÉLECTIONNÉE, et le suffixe
 * `hover` l'instant où le pointeur survole l'AUTRE icône — celle-ci passe au
 * noir (l'affordance), tandis que la sélectionnée s'éclaircit à #CAC9CD pour
 * annoncer la bascule. Les quatre blocs sont cohérents avec cette lecture, et
 * avec aucune autre : #CAC9CD (--encre-200) est plus clair que #ADABB3
 * (--encre-250), donc ce n'est pas l'inactif qui se renforce, c'est l'actif qui
 * s'efface. Le survol de la sélectionnée elle-même n'est pas dessiné : rien ne
 * bouge alors.
 *
 * ICÔNES — le Figma appelle `solar:widget-bold` et `solar:bedside-table-bold`
 * (Figma.md:8926, 8964), qui viennent d'Iconify et non du jeu `icon-*` du
 * fichier. Le LOT 1 n'a donc pas ces noms : je prends leurs équivalents Lucide,
 * `LayoutGrid` (quatre tuiles) et `SquareKanban` (colonnes). Choix assumé, pas
 * un relevé.
 *
 * SÉMANTIQUE — groupe de boutons exclusifs, appuyé sur `ToggleGroup` de
 * @base-ui/react : `aria-pressed` sur chaque bouton, tabindex mobile et
 * navigation par flèches fournis par la primitive. La désélection est bloquée :
 * une vue doit toujours être active.
 */

export type Vue = 'cartes' | 'kanban';

const libelles: Record<Vue, string> = {
  cartes: 'Vue cartes',
  kanban: 'Vue kanban',
};

export function SelecteurVue({
  vue,
  onChanger,
  className,
}: {
  vue: Vue;
  onChanger: (vue: Vue) => void;
  className?: string;
}) {
  return (
    <ToggleGroup
      value={[vue]}
      // Un groupe exclusif : on ignore l'événement qui viderait la sélection
      // (clic sur l'icône déjà active).
      onValueChange={(valeurs) => {
        const suivante = valeurs[0];
        if (suivante && suivante !== vue) onChanger(suivante as Vue);
      }}
      aria-label="Choix de la vue"
      className={cn(
        // Figma.md:8915-8920 — gap 4px, height 24px, ni fond ni bordure
        'inline-flex h-6 items-center gap-1',
        // L'actif s'éclaircit quand le pointeur survole l'inactive.
        '[&:has([data-vue-inactive]:hover)_[data-vue-active]]:text-[var(--encre-200)]',
        className,
      )}
    >
      <Bascule vue="cartes" courante={vue} icone={<LayoutGrid />} />
      {/* Le filet : 1px #E7E6EB sur 24px de haut (Figma.md:8949-8954). */}
      <span aria-hidden="true" className="h-6 w-px shrink-0 bg-[var(--encre-100)]" />
      <Bascule vue="kanban" courante={vue} icone={<SquareKanban />} />
    </ToggleGroup>
  );
}

function Bascule({
  vue,
  courante,
  icone,
}: {
  vue: Vue;
  courante: Vue;
  icone: React.ReactNode;
}) {
  const actif = vue === courante;
  return (
    <Toggle
      value={vue}
      aria-label={libelles[vue]}
      // Ces deux attributs portent la règle de survol croisé écrite sur le
      // conteneur — impossible à exprimer avec les seules variantes Tailwind.
      data-vue-active={actif ? '' : undefined}
      data-vue-inactive={actif ? undefined : ''}
      className={cn(
        'grid size-6 shrink-0 place-items-center transition-colors duration-150',
        '[&_svg]:size-full',
        actif
          ? 'text-black' // #000000 — Figma.md:9154
          : 'text-[var(--encre-250)] hover:text-black', // #ADABB3, noir au survol
      )}
    >
      {icone}
    </Toggle>
  );
}
