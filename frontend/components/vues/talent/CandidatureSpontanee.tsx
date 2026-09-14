'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { Dialogue } from '@/components/pacha/Dialogue';
import { Icone } from '@/components/pacha/Icone';
import { useToasts } from '@/components/pacha/Toast';
import { ZoneTexte } from '@/components/pacha/ZoneTexte';
import { useNonce } from '@/components/vues/talent/nonce';
import { candidatureSpontanee } from '@/lib/talent/actions';

/**
 * LA CANDIDATURE SPONTANÉE — se manifester sans offre.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI CET ÉCRAN EXISTE, ALORS QUE LE BRIEF NE LE DEMANDE PAS
 * ─────────────────────────────────────────────────────────────────────────
 * `api.candidature_spontanee` est livrée côté base, et un module `'use server'`
 * publie un point d'entrée POST pour CHACUN de ses exports. Une action que
 * rien n'appelle reste donc appelable — c'est le raisonnement écrit dans
 * `lib/entreprise/actions.ts` à propos de `maj_mandat`, et il vaut ici : ou
 * bien la fonction a son geste à l'écran, ou bien elle n'a pas à être exportée.
 *
 * Elle a son geste, et c'est le bon endroit pour lui : quelqu'un qui n'a aucune
 * candidature en cours et qui ne trouve rien dans les douze offres publiées n'a
 * autrement AUCUN moyen d'entrer dans le pipeline depuis son espace. Il
 * devrait écrire un courriel, et cette candidature-là n'existerait nulle part
 * dans le modèle.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UNE SEULE À LA FOIS, ET LA BASE LE DIT MIEUX QUE L'ÉCRAN
 * ─────────────────────────────────────────────────────────────────────────
 * `api.candidature_spontanee` refuse d'en ouvrir une seconde tant que la
 * première est vivante (23514, en nommant la candidature existante). On
 * n'essaie pas de le prévoir ici : le composant n'est monté que sur l'état
 * vide du tableau de bord — donc quand il n'y a aucune candidature du tout —
 * et si la règle joue quand même, son message part tel quel dans le toast.
 */
export function CandidatureSpontanee({
  /**
   * ⚠ L'APPARENCE EST DÉCIDÉE PAR L'ÉCRAN, PAS PAR CE COMPOSANT.
   * Le même geste change de rang selon l'endroit : sur « Mes process », se
   * manifester sans offre est la voie PRINCIPALE — la personne est venue voir
   * un suivi vide ou insuffisant. Dans l'état vide, c'est « voir les offres »
   * qui prime, parce qu'il y en a douze de publiées et qu'une candidature
   * spontanée n'a de sens que si aucune ne convient.
   */
  apparence = 'contour',
}: {
  apparence?: 'plein' | 'contour';
} = {}) {
  const router = useRouter();
  const { annoncer } = useToasts();
  const [enCours, demarrer] = useTransition();
  const [nonce, renouvelerNonce] = useNonce();
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState('');

  function envoyer() {
    demarrer(async () => {
      const r = await candidatureSpontanee({ message, nonce });
      if (r.ok) {
        setOuvert(false);
        setMessage('');
        renouvelerNonce();
        annoncer({ titre: r.message, ton: 'succes' });
        router.push(r.candidatureId ? `/talent/candidatures/${r.candidatureId}` : '/talent');
      } else {
        setOuvert(false);
        annoncer({
          titre: 'Votre candidature n’a pas été enregistrée',
          description: r.erreur,
          ton: 'echec',
          duree: 0,
        });
        router.refresh();
      }
    });
  }

  return (
    <>
      <Bouton apparence={apparence} onClick={() => setOuvert(true)} disabled={enCours}>
        Me manifester sans offre
      </Bouton>

      <Dialogue
        ouvert={ouvert}
        onOuvertureChange={setOuvert}
        titre="Vous manifester sans offre précise"
        description="Dites-nous ce que vous cherchez."
        actions={
          <>
            <Bouton apparence="contour" taille="sm" onClick={() => setOuvert(false)} disabled={enCours}>
              Annuler
            </Bouton>
            <Bouton
              apparence="plein"
              taille="sm"
              onClick={envoyer}
              disabled={enCours}
              iconeApres={<Icone nom="icon-send" />}
            >
              {enCours ? 'Envoi…' : 'Envoyer'}
            </Bouton>
          </>
        }
      >
        <ZoneTexte
          libelle="Ce que vous cherchez"
          aide="Facultatif."
          lignes={5}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.currentTarget.value)}
          disabled={enCours}
        />
      </Dialogue>
    </>
  );
}
