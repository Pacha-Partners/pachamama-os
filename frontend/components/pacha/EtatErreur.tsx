'use client';

import { Bouton } from './Bouton';
import { Icone } from './Icone';
import { cn } from '@/lib/utils';

/**
 * EtatErreur — quand une section ou une page n'a pas pu charger.
 *
 * À NE PAS CONFONDRE AVEC `EtatVide`, et la confusion est facile : les deux
 * montrent un écran sans données. Mais un état vide est un état NORMAL — il n'y
 * a rien à afficher, l'utilisateur n'a rien fait de mal, et l'issue est
 * d'ajouter quelque chose ou d'élargir un filtre. Une erreur est un ACCIDENT :
 * la donnée existe, on n'a pas su la lire, et la seule issue est de réessayer.
 * Les deux composants coexistent parce qu'ils demandent deux gestes opposés ;
 * les fondre obligerait l'appelant à dire lequel des deux il veut, ce qui est
 * exactement l'information que le nom du composant doit porter.
 *
 * `role="alert"` : l'erreur est annoncée dès son apparition, sans attendre que
 * l'utilisateur explore la page. C'est le seul cas de ce lot où l'interruption
 * est justifiée — un accusé de réception attend son tour (`Toast`, en `polite`),
 * un échec de chargement ne le peut pas, puisque tout le reste de la section a
 * disparu avec lui.
 *
 * LE DÉTAIL TECHNIQUE EST OPTIONNEL ET SECONDAIRE. « TypeError: Failed to
 * fetch » ne dit rien à un client, mais c'est la première chose qu'on demande
 * en support. Il est donc rendu en petit, sous le bouton, dans un `<code>` —
 * lisible à qui le cherche, invisible à qui ne le cherche pas. Ne jamais y
 * mettre le message brut d'une base de données : il contient des noms de
 * colonnes, parfois des valeurs.
 *
 * LE BOUTON « RÉESSAYER » EST OPTIONNEL, parce que toutes les erreurs ne se
 * réessaient pas. Un 403 ne se réessaie pas — le proposer promet une issue qui
 * n'existe pas, et l'utilisateur cliquera cinq fois avant de renoncer. Sans
 * `onReessayer`, aucun bouton n'apparaît : c'est le bon rendu d'un accès refusé.
 */

export function EtatErreur({
  titre = 'Le chargement a échoué',
  description = 'Quelque chose s’est mal passé de notre côté. Ce n’est pas vous.',
  detail,
  onReessayer,
  libelleReessayer = 'Réessayer',
  enCours = false,
  action,
  /**
   * `section` (défaut) tient dans une carte ; `page` respire davantage et se
   * centre verticalement. Deux densités, pas deux composants : la structure et
   * la sémantique sont identiques.
   */
  portee = 'section',
  className,
}: {
  titre?: string;
  description?: string;
  /** Le message technique, pour le support. Jamais une erreur de base brute. */
  detail?: string;
  onReessayer?: () => void;
  libelleReessayer?: string;
  /** La tentative est en cours : le bouton se fige. */
  enCours?: boolean;
  /** Une seconde issue — « Revenir aux mandats », « Contacter votre agent ». */
  action?: React.ReactNode;
  portee?: 'section' | 'page';
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        portee === 'page' ? 'min-h-[360px] px-6 py-16' : 'px-6 py-10',
        className,
      )}
    >
      {/* Le triangle est décoratif : `role="alert"` a déjà annoncé la nature du
          bloc, et le titre la nomme en toutes lettres. */}
      <Icone nom="icon-alert-triangle" className="size-8 text-[var(--marker-red)]" />

      <p className="t-h3 text-black">{titre}</p>
      <p className="t-body max-w-[46ch] text-[var(--encre-600)]">{description}</p>

      {(onReessayer || action) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
          {onReessayer && (
            <Bouton
              apparence="contour-ombre"
              taille="md"
              disabled={enCours}
              onClick={onReessayer}
              iconeAvant={<Icone nom="icon-refresh-cw" className="size-4" />}
            >
              {enCours ? 'Nouvelle tentative…' : libelleReessayer}
            </Bouton>
          )}
          {action}
        </div>
      )}

      {/* `--encre-600` et non `--encre-400` : ce détail est la RÉFÉRENCE que
          l'utilisateur doit pouvoir lire à voix haute à son interlocuteur.
          #a0abc0 donne 2,3:1 sur blanc — illisible, et à 10px c'est le pire
          endroit du système où le placer. #5d6979 donne 5,4:1. */}
      {detail && (
        <code className="t-micro mt-2 max-w-[60ch] break-all text-[var(--encre-600)]">
          {detail}
        </code>
      )}
    </div>
  );
}
