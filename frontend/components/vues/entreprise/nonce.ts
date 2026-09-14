'use client';

import { useCallback, useState } from 'react';

/**
 * LE NONCE D'UN FORMULAIRE — la moitié variable de la clé d'idempotence.
 *
 * `app.idempotence_rejeu` refuse une clé déjà posée avec une charge
 * différente, et se contente de rejouer le résultat quand la charge est
 * identique. Les Server Actions composent donc leur clé en
 * `<nonce>-<empreinte de la charge>` (voir `lib/entreprise/actions.ts`) :
 *
 *   · le double-clic renvoie la MÊME charge sous le MÊME nonce → rejeu propre,
 *     une seule écriture ;
 *   · une correction change l'empreinte → clé neuve → vraie écriture ;
 *   · `renouveler()` après un succès rend possible un envoi identique
 *     VOLONTAIRE — republier deux fois le même commentaire, par exemple.
 *
 * `crypto.randomUUID` n'existe que dans un contexte sécurisé : sur `http://`
 * autre que `localhost` — un aperçu ouvert depuis un téléphone sur le réseau
 * local — il est `undefined`. Le repli n'a pas besoin d'être
 * cryptographique : le nonce ne protège rien, il distingue deux montages du
 * même formulaire chez le même compte, et la clé est de toute façon préfixée
 * par l'identifiant du compte côté base.
 */
function tirer(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function useNonce(): [string, () => void] {
  const [nonce, setNonce] = useState(tirer);
  const renouveler = useCallback(() => setNonce(tirer()), []);
  return [nonce, renouveler];
}
