import { FournisseurToasts } from '@/components/pacha/Toast';
import { exigerVue } from '@/lib/acces';

/**
 * La disposition du portail entreprise.
 *
 * ELLE PORTE LE GARDE D'AFFICHAGE, et c'est nouveau : jusqu'ici chaque page
 * appelait `exigerVue` pour elle-même, parce qu'une disposition Next ne connaît
 * pas le chemin demandé. Ici la question ne se pose pas — cette disposition
 * n'enveloppe QUE `/entreprise/**`, donc « avoir le droit d'être ici » est une
 * question qu'elle peut poser une fois pour toutes les routes qu'elle couvre.
 * Les cinq pages en dessous n'ont plus à le redire.
 *
 * Ce n'est toujours PAS l'autorisation : celle-ci vit dans les policies
 * PostgreSQL. Un compte qui forcerait le passage ne lirait rien — les vues
 * `api.*` portent `api.a_portail('entreprise')` dans leur WHERE et rendraient
 * zéro ligne. Le garde évite une page vide sans explication, rien de plus.
 *
 * LE FOURNISSEUR DE TOASTS EST MONTÉ ICI, une fois. Sa région `aria-live` doit
 * exister AVANT qu'on y insère quoi que ce soit — un `aria-live` inséré avec
 * son contenu n'annonce rien — et elle doit survivre à la navigation entre les
 * écrans, sinon l'accusé de réception d'une décision disparaît au moment où la
 * page se recharge.
 */
export default async function LayoutEntreprise({ children }: { children: React.ReactNode }) {
  await exigerVue('entreprise');
  return <FournisseurToasts>{children}</FournisseurToasts>;
}
