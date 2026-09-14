'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { FilCommentaires, type Commentaire } from '@/components/pacha/FilCommentaires';
import { Icone } from '@/components/pacha/Icone';
import { useToasts } from '@/components/pacha/Toast';
import { ZoneTexte } from '@/components/pacha/ZoneTexte';
import { useNonce } from '@/components/vues/entreprise/nonce';
import type { NotePartagee } from '@/lib/domaine/entreprise';
import { commenterCandidature } from '@/lib/entreprise/actions';

/**
 * LE FIL D'ÉCHANGE SUR UNE CANDIDATURE, VU DU CLIENT.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI `FilCommentaires` EST MONTÉ EN LECTURE SEULE, AVEC UN COMPOSEUR À CÔTÉ
 * ─────────────────────────────────────────────────────────────────────────
 * Le composant du design system est excellent et on ne touche pas son contrat.
 * Mais il a été écrit depuis le poste RECRUTEUR, et deux de ses textes le
 * disent :
 *
 *   · sans `partageDisponible`, son pied affiche « Visible uniquement en
 *     interne ». Faux ici, et à l'envers : un commentaire écrit par le client
 *     est justement destiné à Pachamama.
 *   · le badge « Partagé avec le client » a tout son sens côté cabinet. Côté
 *     client, il apparaîtrait sur CHAQUE message — puisque `api.note_partagee`
 *     ne rend rien d'autre — et n'apprendrait rien.
 *
 * On lui passe donc la liste sans `onEnvoyer` et sans `partageClient`, ce qui
 * éteint les deux, et on écrit le composeur ici avec les mots du client. Le
 * jour où le DS exposera un axe « point de vue », ce fichier fondra.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE FIL DÉMARRE VIDE, ET CE N'EST PAS UN BOGUE
 * ─────────────────────────────────────────────────────────────────────────
 * Les 45 685 notes historiques sont restées INTERNES : décision D-04, aucun
 * backfill, parce qu'elles ont été écrites sans que personne envisage qu'un
 * client les lise. Le fil ne porte donc que ce qui a été écrit depuis
 * l'ouverture du portail — les décisions, et les commentaires. L'état vide doit
 * le dire, pas laisser croire que le cabinet n'a rien noté.
 */
export function FilCandidature({
  candidatureId,
  notes,
}: {
  candidatureId: string;
  notes: NotePartagee[];
}) {
  const router = useRouter();
  const { annoncer } = useToasts();
  const [enCours, demarrer] = useTransition();
  const [brouillon, setBrouillon] = useState('');
  const [nonce, renouvelerNonce] = useNonce();

  const commentaires: Commentaire[] = notes.map((n) => ({
    id: n.id,
    // `api.note_partagee` calcule déjà l'auteur du point de vue du lecteur :
    // « Vous », « Votre équipe », ou le prénom et le nom du collaborateur, avec
    // « Pachamama » en repli — jamais NULL, c'était le piège de la décision
    // D-12. On ne repasse donc pas `deMoi` : la vue a tranché, et le faire
    // afficherait « Vous » deux fois.
    auteur: { nom: n.auteur, photoUrl: n.auteurPhoto },
    ecritLe: n.ecriteLe ?? new Date().toISOString(),
    corps: n.commentaire,
  }));

  function envoyer() {
    const corps = brouillon.trim();
    if (!corps || enCours) return;
    demarrer(async () => {
      const r = await commenterCandidature({ candidatureId, commentaire: corps, nonce });
      if (r.ok) {
        annoncer({ titre: r.message, ton: 'succes' });
        setBrouillon('');
        renouvelerNonce();
        router.refresh();
      } else {
        annoncer({
          titre: 'Le commentaire n’a pas été publié',
          description: r.erreur,
          ton: 'echec',
          duree: 0,
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <FilCommentaires
        commentaires={commentaires}
        titreVide="Rien d’écrit pour l’instant"
      />

      <div className="flex flex-col gap-3 border-t border-[var(--encre-100)] pt-4">
        <ZoneTexte
          libelle="Écrire à votre équipe Pachamama"
          placeholder="Une question, une précision sur le poste, un retour après un entretien…"
          lignes={3}
          value={brouillon}
          onChange={(e) => setBrouillon(e.currentTarget.value)}
          disabled={enCours}
          maxLength={5000}
          onKeyDown={(e) => {
            // Le même geste que dans le composant du DS : Cmd/Ctrl + Entrée
            // publie, Entrée seule fait un retour à la ligne. Deux raccourcis
            // différents pour deux zones de saisie voisines seraient un piège.
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              envoyer();
            }
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="t-caption flex items-center gap-1.5 text-[var(--encre-500)]">
            <Icone nom="icon-eye" className="size-3.5" />Visible par votre équipe Pachamama.</p>
          <Bouton
            apparence="plein"
            taille="sm"
            disabled={enCours || brouillon.trim().length === 0}
            onClick={envoyer}
            iconeApres={<Icone nom="icon-send" />}
          >
            {enCours ? 'Publication…' : 'Publier'}
          </Bouton>
        </div>
      </div>
    </div>
  );
}
