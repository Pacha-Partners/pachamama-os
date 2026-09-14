'use client';

/**
 * LE NONCE D'UN FORMULAIRE — réemployé tel quel du portail entreprise.
 *
 * `app.idempotence_rejeu` refuse une clé déjà posée avec une charge différente,
 * et rejoue le résultat quand la charge est identique. Les Server Actions
 * composent donc leur clé en `<nonce>-<empreinte de la charge>` :
 *
 *   · le double-clic renvoie la MÊME charge sous le MÊME nonce → rejeu propre,
 *     une seule écriture ;
 *   · une correction change l'empreinte → clé neuve → vraie écriture ;
 *   · `renouveler()` après un succès rend possible un envoi identique
 *     VOLONTAIRE — redéposer deux fois le même poste de frise, par exemple.
 *
 * Le mécanisme est le même des deux côtés, donc le crochet aussi. Le recopier
 * ici donnerait deux tirages de nonce à maintenir, dont un seul serait corrigé
 * le jour où `crypto.randomUUID` change de comportement.
 *
 * Un fichier de réexport plutôt qu'un import direct depuis les écrans : le jour
 * où les deux mécaniques divergeront — ce qui arrivera si l'espace talent
 * gagne un formulaire à plusieurs étapes — c'est ce fichier seul qui changera.
 */
export { useNonce } from '@/components/vues/entreprise/nonce';
