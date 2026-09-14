'use client';

import { useId, useState } from 'react';

import { Avatar } from './Avatar';
import { Bouton } from './Bouton';
import { Case } from './Cases';
import { EtatVide } from './EtatVide';
import { Icone } from './Icone';
import { ZoneTexte } from './ZoneTexte';
import { cn } from '@/lib/utils';

/**
 * FilCommentaires — la conversation attachée à un objet.
 *
 * Il n'y a rien d'approchant dans le design system : le Figma relevé s'arrête
 * au job board, et la base compte 45 685 notes. Ce fil est la surface qui les
 * rend lisibles — sur une candidature, sur un mandat, sur une entreprise.
 *
 * LE BADGE « PARTAGÉ AVEC LE CLIENT » EST LE CŒUR DU COMPOSANT, pas une
 * décoration. `core.note` porte `visible_client` et `visible_talent`, tous deux
 * à `false` par défaut : une note est INTERNE tant que quelqu'un n'a pas décidé
 * l'inverse. Un fil qui n'affiche pas cette distinction est un piège — on y
 * écrit « le client est insupportable » en croyant être entre soi. Le badge est
 * donc rendu pour chaque message partagé, en texte et non par une seule teinte,
 * et l'état par défaut de la case de saisie est TOUJOURS « interne ».
 *
 * LA LISTE EST UNE `<ol>`, pas une pile de `<div>` : l'ordre chronologique est
 * une information, et un lecteur d'écran annonce alors « liste de 12 éléments,
 * élément 3 ». Chaque horodatage est un `<time datetime>` — la valeur lisible
 * par la machine reste exacte même quand le texte dit « il y a 2 jours ».
 *
 * PAS D'ÉDITEUR RICHE. Le corps est du texte, rendu en `whitespace-pre-wrap` :
 * les retours à la ligne saisis sont conservés, et rien d'autre n'est
 * interprété. Coller du HTML dans une note ne doit jamais produire du HTML.
 */

export type Commentaire = {
  id: string;
  auteur: { nom: string; photoUrl?: string | null };
  /** Date ISO ou `Date`. Rendue dans un `<time datetime>`. */
  ecritLe: string | Date;
  corps: string;
  /** `core.note.visible_client`. Rend le badge. */
  partageClient?: boolean;
  /** Le message vient de l'utilisateur courant : l'alignement ne change pas,
   *  seul le nom est remplacé par « Vous ». Un fil de travail n'est pas une
   *  messagerie — aligner ses propres messages à droite ferait perdre la
   *  chronologie de lecture. */
  deMoi?: boolean;
};

/** Format par défaut : « 14 mars 2026 à 09:41 ». Remplaçable par `formaterDate`. */
function formatParDefaut(valeur: string | Date): string {
  const date = valeur instanceof Date ? valeur : new Date(valeur);
  if (Number.isNaN(date.getTime())) return String(valeur);
  return date.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isoDe(valeur: string | Date): string | undefined {
  const date = valeur instanceof Date ? valeur : new Date(valeur);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function FilCommentaires({
  commentaires,
  onEnvoyer,
  enEnvoi = false,
  substitut = 'Écrire une note…',
  libelleEnvoi = 'Publier',
  /**
   * Rend la case « partager avec le client ». Absent ⇒ pas de case, et
   * `onEnvoyer` ne reçoit jamais `true` : sur un fil qui n'a pas de client en
   * face, proposer le partage n'a pas de sens.
   */
  partageDisponible = false,
  formaterDate = formatParDefaut,
  titreVide = 'Aucune note pour l’instant',
  descriptionVide = 'Les échanges de l’équipe sur ce dossier apparaîtront ici.',
  className,
}: {
  commentaires: readonly Commentaire[];
  /** Absent ⇒ fil en lecture seule, sans zone de saisie. */
  onEnvoyer?: (corps: string, partageClient: boolean) => void;
  enEnvoi?: boolean;
  substitut?: string;
  libelleEnvoi?: string;
  partageDisponible?: boolean;
  formaterDate?: (valeur: string | Date) => string;
  titreVide?: string;
  descriptionVide?: string;
  className?: string;
}) {
  const [brouillon, setBrouillon] = useState('');
  const [partager, setPartager] = useState(false);
  const idPartage = useId();

  const envoyer = () => {
    const corps = brouillon.trim();
    if (!corps || enEnvoi) return;
    onEnvoyer?.(corps, partager);
    setBrouillon('');
    // Le partage NE SE SOUVIENT PAS d'un message à l'autre. Le laisser coché
    // ferait publier au client la note suivante sans nouvelle décision — le
    // défaut d'un champ dangereux se réarme après chaque usage.
    setPartager(false);
  };

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {commentaires.length === 0 ? (
        <EtatVide titre={titreVide} description={descriptionVide} />
      ) : (
        <ol className="flex flex-col gap-5">
          {commentaires.map((commentaire) => (
            <li key={commentaire.id} className="flex gap-3">
              <Avatar
                nom={commentaire.auteur.nom}
                src={commentaire.auteur.photoUrl}
                taille={30}
                className="mt-0.5 shrink-0"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="t-body-bold text-black">
                    {commentaire.deMoi ? 'Vous' : commentaire.auteur.nom}
                  </span>
                  <time
                    dateTime={isoDe(commentaire.ecritLe)}
                    className="t-caption text-[var(--encre-500)]"
                  >
                    {formaterDate(commentaire.ecritLe)}
                  </time>
                  {commentaire.partageClient && <MentionPartage />}
                </div>
                <p className="t-body whitespace-pre-wrap break-words text-black">
                  {commentaire.corps}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {onEnvoyer && (
        <div className="flex flex-col gap-3 border-t border-[var(--encre-100)] pt-4">
          <ZoneTexte
            libelle="Nouvelle note"
            placeholder={substitut}
            lignes={3}
            value={brouillon}
            onChange={(e) => setBrouillon(e.target.value)}
            disabled={enEnvoi}
            onKeyDown={(e) => {
              // Cmd/Ctrl + Entrée publie. Entrée seule fait un retour à la
              // ligne : sur un champ de notes, l'inverse coûte un message
              // publié à moitié à chaque paragraphe.
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                envoyer();
              }
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            {partageDisponible ? (
              <Case
                id={idPartage}
                checked={partager}
                onCheckedChange={(coche) => setPartager(coche)}
                disabled={enEnvoi}
                libelle="Partager cette note avec le client"
              />
            ) : (
              <p className="t-caption flex items-center gap-1.5 text-[var(--encre-500)]">
                <Icone nom="icon-lock" className="size-3.5" />
                Visible uniquement en interne
              </p>
            )}

            <Bouton
              apparence="plein"
              taille="sm"
              disabled={enEnvoi || brouillon.trim().length === 0}
              onClick={envoyer}
              iconeApres={<Icone nom="icon-send" className="size-4" />}
            >
              {enEnvoi ? 'Publication…' : libelleEnvoi}
            </Bouton>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Le badge « partagé avec le client ».
 *
 * `TagInfo` du système ferait 35px de haut pour trois mots posés à côté d'un
 * horodatage de 12px : la ligne d'en-tête du message doublerait de hauteur. Ce
 * badge reste donc local, aux jetons du système, et n'est pas exporté comme un
 * tag générique — le jour où le besoin se répète, il montera dans `Tag.tsx`
 * avec une cote décidée là-bas.
 *
 * L'œil est décoratif : le sens est entièrement dans le texte à côté.
 */
function MentionPartage() {
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--violet-100)] px-2 py-0.5">
      <Icone nom="icon-eye" className="size-3 text-[var(--violet-900)]" />
      <span className="t-micro-bold text-[var(--violet-900)]">Partagé avec le client</span>
    </span>
  );
}
