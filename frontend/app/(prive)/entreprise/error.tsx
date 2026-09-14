'use client';

import { useEffect } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { EtatErreur } from '@/components/pacha/EtatErreur';

/**
 * La frontière d'erreur du portail entreprise.
 *
 * Elle couvre toutes les routes qui n'en déclarent pas une plus proche. Next
 * exige qu'elle soit un composant CLIENT : c'est lui qui reçoit `reset`.
 *
 * ON NE MONTRE PAS `error.message` À L'UTILISATEUR. Les lectures lèvent des
 * messages écrits pour lui (« Les données de “mandat_client” sont
 * momentanément indisponibles »), mais rien ne garantit que l'erreur qui
 * remonte soit l'une des nôtres — une erreur de PostgREST porte des noms de
 * colonnes, parfois des valeurs. On affiche `digest`, l'empreinte que Next
 * pose sur l'erreur et qu'on retrouve dans le journal du serveur : c'est ce
 * qui permet au support de relier l'écran à la trace, sans rien divulguer.
 */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[entreprise] erreur de rendu :', error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[1180px] pt-2">
      <EtatErreur
        portee="page"
        titre="Vos données n’ont pas pu être chargées"
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
