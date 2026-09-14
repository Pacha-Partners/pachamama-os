'use client';

import { useEffect } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { EtatErreur } from '@/components/pacha/EtatErreur';

/** La frontière d'erreur du formulaire d'ouverture de poste. */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[entreprise/mandat-nouveau] erreur de rendu :', error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[1180px] pt-2">
      <EtatErreur
        portee="page"
        titre="Le formulaire n’a pas pu s’ouvrir"
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
