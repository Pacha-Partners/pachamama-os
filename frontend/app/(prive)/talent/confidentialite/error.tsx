'use client';

import { useEffect } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { EtatErreur } from '@/components/pacha/EtatErreur';

/** Voir `app/(prive)/talent/error.tsx` : on n'affiche jamais `error.message`. */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[talent/confidentialite] erreur de rendu :', error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[1180px] pt-2">
      <EtatErreur
        portee="page"
        titre="Cet écran n’a pas pu être chargé"
        description="Ce n’est pas vous. Réessayez : si l’écran reste vide, votre interlocuteur Pachamama peut faire remonter le problème."
        detail={error.digest ? `Référence : ${error.digest}` : undefined}
        onReessayer={reset}
        action={
          <Bouton href="/talent" apparence="contour">
            Revenir à mon espace
          </Bouton>
        }
      />
    </div>
  );
}
