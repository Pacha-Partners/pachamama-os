'use client';

import { useEffect } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { EtatErreur } from '@/components/pacha/EtatErreur';

/**
 * La frontière d'erreur de l'espace talent.
 *
 * Elle couvre toutes les routes qui n'en déclarent pas une plus proche. Next
 * exige qu'elle soit un composant CLIENT : c'est lui qui reçoit `reset`.
 *
 * ON NE MONTRE PAS `error.message`. Les lectures lèvent des messages écrits
 * pour la personne (« Les données de “ma_candidature” sont momentanément
 * indisponibles »), mais rien ne garantit que l'erreur qui remonte soit l'une
 * des nôtres — une erreur de PostgREST porte des noms de colonnes, parfois des
 * valeurs. On affiche `digest`, l'empreinte que Next pose sur l'erreur et
 * qu'on retrouve dans le journal du serveur : c'est ce qui permet de relier
 * l'écran à la trace, sans rien divulguer.
 */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[talent] erreur de rendu :', error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[1180px] pt-2">
      <EtatErreur
        portee="page"
        titre="Votre dossier n’a pas pu être chargé"
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
