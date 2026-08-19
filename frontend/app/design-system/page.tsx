import { Specimen } from './specimen';

export const metadata = { title: 'Design system' };

/**
 * Page de référence du design system.
 *
 * Elle existe pour une raison précise : un design system qu'on ne peut pas
 * regarder n'est pas vérifiable. Le spécimen est un composant client parce
 * qu'il démontre des états interactifs — c'est la seule raison, et elle ne
 * concerne que cette page de documentation.
 */
export default function PageDesignSystem() {
  return <Specimen />;
}
