'use client';

import { useEffect } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { EtatErreur } from '@/components/pacha/EtatErreur';

/** La frontière d'erreur du profil. Voir `(prive)/entreprise/error.tsx`. */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[entreprise/profil] erreur de rendu :', error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[1180px] pt-2">
      <EtatErreur
        portee="page"
        titre="Votre fiche n’a pas pu être chargée"
        description="Ce n’est pas vous. Rien de ce que vous aviez enregistré n’est perdu."
        detail={error.digest ? `Référence : ${error.digest}` : undefined}
        onReessayer={reset}
        action={
          <Bouton href="/entreprise" apparence="contour">
            Revenir au tableau de bord
          </Bouton>
        }
      />
    </div>
  );
}
