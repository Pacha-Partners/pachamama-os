import { Bouton } from '@/components/pacha/Bouton';
import { Carte } from '@/components/pacha/Carte';
import { Icone } from '@/components/pacha/Icone';
import { PastillePourcentage } from '@/components/pacha/PastillePourcentage';
import { Titre } from '@/components/pacha/Titre';
import { idVideoYoutube, listeDe, scorecardDe, type Fiche } from '@/lib/domaine/fiche';
import { cn } from '@/lib/utils';

/**
 * LE REGISTRE PUBLIC D'UN MANDAT — l'annonce telle que les candidats la lisent.
 *
 * POURQUOI PAS `FicheOffre` TELLE QUELLE. Elle est bonne, et on lui emprunte
 * tout ce qui compte : la même source `api.offre_detail`, les mêmes règles de
 * domaine (`listeDe`, `scorecardDe`, `idVideoYoutube`), les mêmes cotes de
 * blocs, la même règle « dès qu'il manque une information, le bloc DISPARAÎT ».
 * Mais c'est une PAGE : elle pose `min-h-dvh`, son propre fond, son décor, son
 * bouton « Retour » vers `/offres`, le logo Pachamama en haut à droite et un
 * bouton « Postuler ». Montée dans la coquille connectée, elle produirait une
 * page dans une page — et proposerait au client de postuler à son propre poste.
 *
 * On garde donc les blocs et on laisse la page dehors. Le lien vers l'annonce
 * réelle est offert en tête : c'est là que le client vérifie ce que le monde
 * voit.
 *
 * ⚠ CE BLOC N'EXISTE QUE POUR UN MANDAT PUBLIÉ. `api.offre_detail` ne rend que
 * les mandats portant un acte de publication non retiré — 12 sur 533 au 09/09.
 * L'appelant reçoit `null` et n'affiche rien : ce n'est pas une panne, c'est
 * l'état normal d'un poste que le cabinet traite en approche directe.
 */
export function RegistrePublic({ fiche }: { fiche: Fiche }) {
  const missions = listeDe(fiche.missions);
  const scorecard = scorecardDe(fiche);
  const pourToi = listeDe(fiche.pourToi);
  const pasPourToi = listeDe(fiche.pasPourToi);
  const processus = listeDe(fiche.processRecrutement);
  const video = idVideoYoutube(fiche.videoYoutube);

  const rienASire =
    !fiche.description &&
    missions.length === 0 &&
    !scorecard &&
    pourToi.length === 0 &&
    pasPourToi.length === 0 &&
    processus.length === 0 &&
    !video;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icone nom="icon-eye" className="size-4 text-[var(--violet-700)]" />
          <p className="t-body-hl text-black">Cette annonce est publiée sur le job board</p>
        </div>
        <Bouton
          href={`/offres/${fiche.id}`}
          apparence="contour"
          taille="sm"
          iconeApres={<Icone nom="icon-external-link" />}
        >
          Voir l’annonce
        </Bouton>
      </div>

      {rienASire ? (
        <Carte regime="travail" className="p-4">
          <p className="t-body text-[var(--encre-600)]">Contenu non encore rédigé.</p>
        </Carte>
      ) : (
        <>
          {fiche.description && (
            <Carte regime="contour" className="flex flex-col gap-3 rounded-[var(--r-ml)] px-4 pb-4 pt-6">
              <Titre niveau={2} disposition="ligne" descriptif="Le" impact="poste" />
              <p className="t-body whitespace-pre-line text-black">{fiche.description}</p>
            </Carte>
          )}

          {(missions.length > 0 || scorecard) && (
            <Carte regime="contour" className="flex flex-col gap-4 rounded-[var(--r-ml)] px-4 pb-4 pt-6">
              <Titre niveau={2} disposition="ligne" descriptif="Missions" impact="du job" />
              <ListePuces elements={missions} />
              {scorecard && (
                <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
                  {scorecard.map((a) => (
                    <PastillePourcentage
                      key={a.libelle}
                      libelle={a.libelle}
                      pourcentage={a.pourcentage}
                    />
                  ))}
                </div>
              )}
            </Carte>
          )}

          {(pourToi.length > 0 || pasPourToi.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              <Encart titre="Le poste est fait pour vous si" elements={pourToi} />
              <Encart titre="Ça ne marchera pas si" elements={pasPourToi} />
            </div>
          )}

          {processus.length > 0 && (
            <Carte regime="contour" className="flex flex-col gap-4 rounded-[var(--r-ml)] px-4 pb-4 pt-6">
              <Titre
                niveau={2}
                disposition="ligne"
                descriptif="Processus"
                impact="de recrutement"
              />
              {/* Une liste NUMÉROTÉE : les étapes ont un ordre, et c'est à la
                  balise de l'annoncer, pas à un chiffre écrit à la main. */}
              <ol className="flex list-decimal flex-col gap-2 pl-5">
                {processus.map((e, i) => (
                  <li key={`${i}-${e}`} className="t-body">
                    {e}
                  </li>
                ))}
              </ol>
            </Carte>
          )}
        </>
      )}
    </div>
  );
}

function Encart({ titre, elements }: { titre: string; elements: string[] }) {
  if (elements.length === 0) return null;
  return (
    <Carte regime="travail" className="flex flex-col gap-3 p-4">
      <p className="t-titre-hl text-black">{titre}</p>
      <ListePuces elements={elements} />
    </Carte>
  );
}

function ListePuces({ elements, className }: { elements: string[]; className?: string }) {
  if (elements.length === 0) return null;
  return (
    <ul className={cn('flex list-disc flex-col gap-2 pl-5', className)}>
      {elements.map((e, i) => (
        <li key={`${i}-${e}`} className="t-body">
          {e}
        </li>
      ))}
    </ul>
  );
}
