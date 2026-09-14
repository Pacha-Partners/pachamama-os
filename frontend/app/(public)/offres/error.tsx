'use client';

import { useEffect } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { EtatErreur } from '@/components/pacha/EtatErreur';
import { VERSION_DEPLOYEE } from '@/lib/config';

/**
 * La frontière d'erreur du job board — la seule surface PUBLIQUE du produit.
 *
 * ⚠ ELLE MANQUAIT DEPUIS LE J1, et le trou n'était pas théorique : la page de
 * liste rattrape son erreur de lecture elle-même, mais `/offres/[id]` LÈVE
 * (« La fiche est momentanément indisponible ») et n'avait aucune frontière
 * pour la recevoir. Une visite sur une fiche pendant une panne de Supabase
 * tombait donc sur la page d'erreur générique de Next, en anglais, sur la seule
 * page que le cabinet fait indexer.
 *
 * ON NE MONTRE PAS `error.message` : rien ne garantit que l'erreur qui remonte
 * soit l'une des nôtres, et une erreur de PostgREST porte des noms de colonnes.
 * On affiche `digest`, l'empreinte que Next pose et qu'on retrouve dans le
 * journal du serveur.
 *
 * LA SECONDE ISSUE MÈNE À L'APPLICATION DÉPLOYÉE et non à `/offres` : si c'est
 * le job board qui est en panne, y renvoyer est une boucle.
 */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[/offres] erreur de rendu :', error);
  }, [error]);

  return (
    <main id="contenu" className="min-h-dvh bg-[var(--fond-page)] p-4 md:p-8">
      <div className="mx-auto w-full max-w-[720px] pt-10">
        <EtatErreur
          portee="page"
          titre="Les offres ne se sont pas chargées"
          description="Ce n’est pas vous. Réessayez : nos offres sont aussi visibles depuis l’application Pachamama."
          detail={error.digest ? `Référence : ${error.digest}` : undefined}
          onReessayer={reset}
          action={
            <Bouton href={VERSION_DEPLOYEE} apparence="contour">
              Ouvrir l’application Pachamama
            </Bouton>
          }
        />
      </div>
    </main>
  );
}
