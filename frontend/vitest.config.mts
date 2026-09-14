import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Les tests unitaires du front.
 *
 * L'alias `@/` est indispensable et non décoratif : le module de domaine
 * importe `@/components/pacha/Tag`. C'est aujourd'hui un `import type`, donc
 * effacé à la compilation — mais le jour où une seule valeur en sera importée,
 * l'absence d'alias ferait échouer la résolution sans rapport visible avec le
 * changement. Il doit refléter `paths` de tsconfig.json.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'components/**/*.test.tsx'],
  },
});
