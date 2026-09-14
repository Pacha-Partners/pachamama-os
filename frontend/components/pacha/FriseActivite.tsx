import { Icone, type NomIcone } from './Icone';
import { cn } from '@/lib/utils';

/**
 * FriseActivite — le journal d'un dossier, en frise verticale.
 *
 * CE QU'ELLE SERT. Une candidature passe par quatorze étapes, change d'agent,
 * gagne un argumentaire, reçoit un motif de KO. Le tableau montre l'état
 * COURANT ; la frise montre le CHEMIN. C'est ce que le client demande quand il
 * dit « il s'est passé quoi depuis la semaine dernière ? ».
 *
 * LE COUPLE AVANT → APRÈS EST LA PIÈCE MAÎTRESSE. « Étape modifiée » ne dit
 * rien ; « Étape : Interview 1 → Interview 2 » dit tout. La flèche est un
 * caractère décoratif, doublé d'un « devient » réservé au lecteur d'écran :
 * « Interview 1 flèche vers la droite Interview 2 » n'est pas une phrase.
 * `avant` est facultatif — une création n'a pas d'état antérieur, et la frise
 * rend alors la seule valeur d'arrivée plutôt qu'un « (vide) → x » trompeur.
 *
 * UNE `<ol>`, DU PLUS RÉCENT AU PLUS ANCIEN. L'ordre est celui du tableau reçu :
 * le composant ne trie pas, parce que la requête sait déjà le faire et qu'un
 * tri côté client sur un tableau paginé mentirait sur ce qu'il montre.
 *
 * LE RAIL est un filet `--encre-100` d'un pixel, tiré derrière les pastilles.
 * Il s'arrête au dernier événement — un rail qui dépasse promet une suite qui
 * n'existe pas.
 */

export type EvenementFrise = {
  id: string;
  /** Ce qui s'est passé. « Étape modifiée », « Note partagée ». */
  libelle: React.ReactNode;
  /** L'icône de la pastille. Défaut : un point plein sans glyphe. */
  icone?: NomIcone;
  /** L'état d'avant. Absent sur une création. */
  avant?: React.ReactNode;
  /** L'état d'après. Absent quand l'événement n'a pas de valeur. */
  apres?: React.ReactNode;
  date: string | Date;
  /** Qui a fait le geste. « Marion Darnet », « Pachamama », « le système ». */
  auteur?: string;
  /** Un détail libre sous la ligne — le corps d'une note, un commentaire. */
  detail?: React.ReactNode;
};

function formatParDefaut(valeur: string | Date): string {
  const date = valeur instanceof Date ? valeur : new Date(valeur);
  if (Number.isNaN(date.getTime())) return String(valeur);
  return date.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isoDe(valeur: string | Date): string | undefined {
  const date = valeur instanceof Date ? valeur : new Date(valeur);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function FriseActivite({
  evenements,
  formaterDate = formatParDefaut,
  className,
}: {
  evenements: readonly EvenementFrise[];
  formaterDate?: (valeur: string | Date) => string;
  className?: string;
}) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {evenements.map((evenement, index) => {
        const dernier = index === evenements.length - 1;
        return (
          <li key={evenement.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/* Le rail. Posé en absolu derrière la pastille, il part du bas de
                celle-ci et s'arrête à l'événement suivant. `aria-hidden` : un
                trait n'a rien à annoncer. */}
            {!dernier && (
              <span
                aria-hidden="true"
                className="absolute left-[11px] top-6 bottom-0 w-px bg-[var(--encre-100)]"
              />
            )}

            <span
              aria-hidden="true"
              className={cn(
                'relative z-10 mt-0.5 flex size-[23px] shrink-0 items-center justify-center',
                'rounded-[var(--r-full)] border border-[var(--encre-200)] bg-[var(--fond-carte)]',
              )}
            >
              {evenement.icone ? (
                <Icone nom={evenement.icone} className="size-3.5 text-[var(--encre-600)]" />
              ) : (
                <span className="size-1.5 rounded-[var(--r-full)] bg-[var(--encre-400)]" />
              )}
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
              <p className="t-body-hl text-black">{evenement.libelle}</p>

              {(evenement.avant !== undefined || evenement.apres !== undefined) && (
                <p className="t-body flex flex-wrap items-center gap-1.5 text-black">
                  {evenement.avant !== undefined && (
                    <>
                      <span className="text-[var(--encre-500)]">{evenement.avant}</span>
                      <span aria-hidden="true" className="text-[var(--encre-400)]">
                        →
                      </span>
                      <span className="sr-only">devient</span>
                    </>
                  )}
                  {evenement.apres !== undefined && (
                    <span className="t-body-bold">{evenement.apres}</span>
                  )}
                </p>
              )}

              {evenement.detail && (
                <div className="t-caption whitespace-pre-wrap break-words text-[var(--encre-600)]">
                  {evenement.detail}
                </div>
              )}

              <p className="t-caption text-[var(--encre-500)]">
                <time dateTime={isoDe(evenement.date)}>{formaterDate(evenement.date)}</time>
                {evenement.auteur && <> · {evenement.auteur}</>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
