'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Bouton } from '@/components/pacha/Bouton';
import { Dialogue } from '@/components/pacha/Dialogue';
import { Icone } from '@/components/pacha/Icone';
import { useToasts } from '@/components/pacha/Toast';
import { ZoneTexte } from '@/components/pacha/ZoneTexte';
import { useNonce } from '@/components/vues/talent/nonce';
import { postuler } from '@/lib/talent/actions';

/**
 * POSTULER À UNE OFFRE — le bouton, et ce qu'il y a derrière.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE DÉFAUT QU'IL RÉPARE
 * ─────────────────────────────────────────────────────────────────────────
 * `FicheOffre` envoyait sur `/connexion?offre=<uuid>`, et `app/connexion/
 * page.tsx` faisait `redirect('/login')` **en perdant la requête**. Après
 * connexion on atterrissait donc sur son espace, sans l'offre, sans rien pour
 * dire qu'on avait voulu postuler. Trois pièces réparent cela ensemble :
 *
 *   1. `/connexion` traduit `?offre=<uuid>` en `/login?suite=/offres/<uuid>` ;
 *   2. `/login` accepte `?suite=` et y renvoie après connexion — après avoir
 *      vérifié que c'est un chemin INTERNE (voir son en-tête) ;
 *   3. ce composant, monté sur la fiche d'offre quand le visiteur est un talent
 *      connecté, poste réellement.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TROIS ÉTATS, ET AUCUN N'EST UN BOUTON QUI ÉCHOUERA
 * ─────────────────────────────────────────────────────────────────────────
 * `api.postuler` refuse une deuxième candidature au même mandat, en nommant la
 * première (23514). Proposer « Postuler » à quelqu'un dont la candidature est
 * déjà dans le pipeline serait promettre un geste qu'on sait refusé : quand
 * `dejaPostule` est vrai, le bouton devient un lien vers SA candidature.
 *
 * ⚠ IL RESTE UN CAS QU'ON NE PEUT PAS PRÉVENIR : l'offre dépubliée entre le
 * chargement de la page et le clic. La fonction refuse alors en 23514 (« cette
 * offre n'est plus publiée »), et son message part tel quel dans le toast —
 * c'est le bon comportement, une offre retirée doit cesser d'être candidatable
 * même par son lien.
 */
export function Postuler({
  mandatId,
  intitule,
  dejaPostule,
  candidatureId,
  libelle = 'Postuler',
}: {
  mandatId: string;
  intitule: string;
  dejaPostule: boolean;
  /** L'identifiant de la candidature déjà déposée, quand on le connaît. */
  candidatureId?: string | null;
  /**
   * LE MÊME GESTE, DEUX MOTS.
   *
   * Sur le job board public, « Postuler » : le visiteur arrive d'un moteur, il
   * sait ce qu'il vient faire. Dans l'espace talent, « Je suis intéressé·e » —
   * la maquette le pose ainsi, et c'est plus juste : la personne est déjà dans
   * notre dossier, elle ne dépose pas un dossier, elle nous signale un intérêt.
   * Le geste, lui, est identique : `api.postuler`.
   */
  libelle?: string;
}) {
  const router = useRouter();
  const { annoncer } = useToasts();
  const [enCours, demarrer] = useTransition();
  const [nonce, renouvelerNonce] = useNonce();
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState('');

  if (dejaPostule) {
    return (
      <Bouton
        href={candidatureId ? `/talent/candidatures/${candidatureId}` : '/talent'}
        apparence="contour"
        iconeAvant={<Icone nom="icon-check-circle" />}
        className="shrink-0"
      >
        Candidature déposée
      </Bouton>
    );
  }

  function envoyer() {
    demarrer(async () => {
      const r = await postuler({ mandatId, message, nonce });
      if (r.ok) {
        setOuvert(false);
        setMessage('');
        renouvelerNonce();
        annoncer({ titre: r.message, ton: 'succes' });
        // On emmène la personne sur SA candidature : rester sur l'offre après
        // avoir postulé laisse se demander si ça a marché.
        router.push(r.candidatureId ? `/talent/candidatures/${r.candidatureId}` : '/talent');
      } else {
        setOuvert(false);
        annoncer({
          titre: 'Votre candidature n’a pas été déposée',
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
      <Bouton
        apparence="plein"
        onClick={() => setOuvert(true)}
        iconeAvant={<Icone nom="icon-send" className="size-4" />}
        className="shrink-0"
        disabled={enCours}
      >
        {libelle}
      </Bouton>

      <Dialogue
        ouvert={ouvert}
        onOuvertureChange={setOuvert}
        titre={`${libelle} : ${intitule}`}
        description="Votre CV, votre parcours et vos attentes partent avec."
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
              {enCours ? 'Envoi…' : 'Déposer ma candidature'}
            </Bouton>
          </>
        }
      >
        <ZoneTexte
          libelle="Un mot pour nous, si vous voulez"
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

/**
 * L'INVITATION À SE CONNECTER — ce que voit un visiteur non identifié.
 *
 * Elle porte le lien qui SURVIT à la connexion : `/login?suite=/offres/<id>`.
 * Le libellé dit ce qui va se passer plutôt que « Postuler », qui promettrait
 * un dépôt immédiat alors qu'il faut d'abord un compte.
 */
export function PostulerApresConnexion({ mandatId }: { mandatId: string }) {
  return (
    <Bouton
      apparence="plein"
      href={`/login?suite=${encodeURIComponent(`/offres/${mandatId}`)}`}
      iconeAvant={<Icone nom="icon-send" className="size-4" />}
      className="shrink-0"
    >
      Postuler
    </Bouton>
  );
}
