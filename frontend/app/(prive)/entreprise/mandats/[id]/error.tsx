'use client';

import { useEffect } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { EtatErreur } from '@/components/pacha/EtatErreur';

/** La frontière d'erreur du détail d'un poste. Voir `(prive)/entreprise/error.tsx`. */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[entreprise/mandat] erreur de rendu :', error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[1180px] pt-2">
      <EtatErreur
        portee="page"
        titre="Ce poste n’a pas pu être chargé"
        detail={error.digest ? `Référence : ${error.digest}` : undefined}
        onReessayer={reset}
        action={
          <Bouton href="/entreprise" apparence="contour">
            Revenir à vos postes
          </Bouton>
        }
      />
    </div>
  );
}
