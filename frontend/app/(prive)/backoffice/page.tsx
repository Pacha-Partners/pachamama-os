import { exigerVue } from '@/lib/acces';

export const metadata = { title: 'Back-office' };

/**
 * Back-office — vue VIDE, volontairement.
 *
 * Le jalon 2 ouvre les portes ; il ne meuble pas les pièces. Ce qui est réel
 * ici, c'est le chemin : une session, une lecture de `api.moi`, un accès
 * vérifié, une barre latérale et une sortie qui fonctionne. Le contenu viendra
 * avec les jalons suivants, et il viendra dans cette coquille.
 *
 * `exigerVue` renvoie sur SA vue quiconque n'a pas cet accès : la disposition
 * ne peut pas s'en charger, une disposition Next ne connaissant pas le chemin
 * demandé. C'est un garde d'affichage — l'autorisation, elle, reste dans les
 * policies PostgreSQL.
 */
export default async function Vue() {
  await exigerVue('backoffice');
  return null;
}
