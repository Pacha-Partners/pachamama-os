'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { BoutonIcone } from './BoutonIcone';
import { Icone, type NomIcone } from './Icone';
import { cn } from '@/lib/utils';

/**
 * Toast — l'accusé de réception d'une action.
 *
 * POURQUOI IL EN FAUT UN. Dans un portail, la moitié des gestes ne changent
 * rien à l'écran : on partage une note avec le client, on relance un candidat,
 * on enregistre un filtre. Sans accusé, l'utilisateur reclique. Avec une
 * bannière posée en haut de page, il ne la voit pas s'il a défilé. Le toast est
 * la seule forme qui dise « c'est fait » à l'endroit où se porte le regard,
 * sans voler le focus.
 *
 * ÉCRIT À LA MAIN PLUTÔT QUE SUR `toast` DE BASE UI, et c'est le seul composant
 * de ce lot dans ce cas. Le contrat demandé est court et entièrement dicté par
 * l'accessibilité — région vivante polie, disparition automatique, pile bornée,
 * `prefers-reduced-motion` — et la primitive de Base UI apporte en plus un
 * modèle de balayage tactile, une file de priorités et un gestionnaire global,
 * dont aucun n'est demandé ici. Le jour où il faudra empiler, réordonner ou
 * balayer, la bascule vers la primitive se fera derrière ce même `useToasts`.
 *
 * LE PIÈGE DE LA RÉGION VIVANTE, et la raison de la forme de ce fichier : un
 * `aria-live` inséré DANS LE MÊME TEMPS que son contenu n'annonce rien. Les
 * aides techniques observent les régions déjà présentes dans le document. La
 * région est donc montée en permanence par `FournisseurToasts`, vide la plupart
 * du temps, et ce sont les toasts qu'on y insère. C'est la seule façon
 * d'obtenir une annonce fiable.
 *
 * `polite` et non `assertive` : un accusé de réception n'interrompt pas ce que
 * l'utilisateur est en train de lire. Un échec bloquant n'est pas un toast —
 * c'est un `EtatErreur` ou un `DialogueConfirmation`.
 */

export type TonToast = 'neutre' | 'succes' | 'echec';

export type Toast = {
  id: string;
  /** Une phrase courte, au passé accompli. « Note partagée avec le client. » */
  titre: string;
  /** Le détail, quand il en faut un. Reste sur une ligne ou deux. */
  description?: string;
  ton?: TonToast;
  /** Durée d'affichage en millisecondes. `0` = ne disparaît pas tout seul. */
  duree?: number;
  /** Une action de rattrapage : « Annuler », « Voir la note ». */
  action?: { libelle: string; onClic: () => void };
};

type ToastEntrant = Omit<Toast, 'id'> & { id?: string };

type ContexteToasts = {
  annoncer: (toast: ToastEntrant) => string;
  retirer: (id: string) => void;
};

const Contexte = createContext<ContexteToasts | null>(null);

/**
 * Le point d'accès. Lève si le fournisseur manque : un `annoncer()` silencieux
 * ferait croire à un accusé de réception qui n'existe pas — exactement le bogue
 * que ce composant est censé empêcher.
 */
export function useToasts(): ContexteToasts {
  const contexte = useContext(Contexte);
  if (!contexte) {
    throw new Error(
      'useToasts() hors de <FournisseurToasts>. Monter le fournisseur une fois, haut dans l’arbre.',
    );
  }
  return contexte;
}

/** Les trois tons. L'icône double la couleur : la teinte ne signale jamais seule. */
const TONS: Record<TonToast, { icone: NomIcone; couleur: string }> = {
  neutre: { icone: 'icon-info', couleur: 'text-[var(--violet-700)]' },
  succes: { icone: 'icon-check-circle', couleur: 'text-[var(--encre-800)]' },
  echec: { icone: 'icon-alert-triangle', couleur: 'text-[var(--marker-red)]' },
};

export function FournisseurToasts({
  children,
  /**
   * Combien de toasts au maximum. Au-delà, le PLUS ANCIEN part. Trois est un
   * plafond, pas une cible : quatre accusés simultanés veulent dire que l'écran
   * enchaîne des actions sans le montrer autrement, ce qui est le vrai problème.
   */
  maximum = 3,
  /** Durée par défaut. 5s : le temps de lire deux lignes sans les chercher. */
  dureeParDefaut = 5000,
}: {
  children: React.ReactNode;
  maximum?: number;
  dureeParDefaut?: number;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const compteur = useRef(0);

  const retirer = useCallback((id: string) => {
    setToasts((liste) => liste.filter((t) => t.id !== id));
  }, []);

  const annoncer = useCallback(
    (entrant: ToastEntrant) => {
      compteur.current += 1;
      const id = entrant.id ?? `toast-${compteur.current}`;
      setToasts((liste) => [...liste, { ...entrant, id }].slice(-maximum));
      return id;
    },
    [maximum],
  );

  const valeur = useMemo(() => ({ annoncer, retirer }), [annoncer, retirer]);

  return (
    <Contexte.Provider value={valeur}>
      {children}
      {/* LA RÉGION EST MONTÉE EN PERMANENCE — voir le commentaire d'en-tête.
          `pointer-events-none` sur le conteneur, rétabli sur chaque toast : une
          colonne vide de 360px posée en bas à droite avalerait sinon les clics
          sur ce qu'elle recouvre. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Notifications"
        className={cn(
          'pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(var(--largeur-toast),calc(100vw-2rem))] flex-col gap-2',
        )}
      >
        {toasts.map((toast) => (
          // `retirer` est passé TEL QUEL, jamais enveloppé dans une fonction
          // fléchée : une nouvelle référence à chaque rendu relancerait la
          // minuterie du toast depuis zéro, et un toast survolé par une souris
          // qui bouge ne partirait jamais.
          <LigneToast
            key={toast.id}
            toast={toast}
            dureeParDefaut={dureeParDefaut}
            onFermer={retirer}
          />
        ))}
      </div>
    </Contexte.Provider>
  );
}

/**
 * Un toast.
 *
 * LA MINUTERIE SE MET EN PAUSE au survol et tant que le focus est dedans. Sans
 * cela, un toast portant un bouton « Annuler » l'emporterait au moment précis
 * où l'on tend la main vers lui — et la règle 2.2.1 exige de pouvoir suspendre
 * ce qui disparaît tout seul. `duree: 0` retire la minuterie : à réserver aux
 * accusés qui portent une action, pour laquelle cinq secondes ne suffisent pas.
 */
function LigneToast({
  toast,
  dureeParDefaut,
  onFermer,
}: {
  toast: Toast;
  dureeParDefaut: number;
  /** Reçoit l'identifiant. Doit être STABLE — voir l'appel dans le fournisseur. */
  onFermer: (id: string) => void;
}) {
  const [enPause, setEnPause] = useState(false);
  const id = toast.id;
  const duree = toast.duree ?? dureeParDefaut;
  const { icone, couleur } = TONS[toast.ton ?? 'neutre'];

  useEffect(() => {
    if (duree <= 0 || enPause) return;
    const minuterie = window.setTimeout(() => onFermer(id), duree);
    return () => window.clearTimeout(minuterie);
  }, [duree, enPause, id, onFermer]);

  return (
    <div
      onMouseEnter={() => setEnPause(true)}
      onMouseLeave={() => setEnPause(false)}
      onFocusCapture={() => setEnPause(true)}
      onBlurCapture={() => setEnPause(false)}
      className={cn(
        'pointer-events-auto flex items-start gap-3',
        // Régime « accroche » : filet noir 2px et ombre rétro. Un toast se
        // regarde, donc il porte l'ombre.
        'rounded-[var(--r-md)] border-2 border-black bg-[var(--fond-carte)] p-3 shadow-[var(--ombre-3)]',
        'animate-in slide-in-from-bottom-2 fade-in duration-150',
        'motion-reduce:animate-none',
      )}
    >
      <Icone nom={icone} className={cn('mt-0.5 size-4 shrink-0', couleur)} />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="t-body-hl text-black">{toast.titre}</p>
        {toast.description && (
          <p className="t-caption text-[var(--encre-600)]">{toast.description}</p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClic();
              onFermer(id);
            }}
            className="t-caption-bold self-start text-[var(--violet-700)] underline underline-offset-2 hover:text-[var(--violet-900)]"
          >
            {toast.action.libelle}
          </button>
        )}
      </div>

      <BoutonIcone
        type="supprimer"
        libelle="Fermer la notification"
        onClick={() => onFermer(id)}
        className="-m-1 box-content shrink-0 p-1"
      />
    </div>
  );
}
