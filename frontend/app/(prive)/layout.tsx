import { redirect } from 'next/navigation';

import { CoquilleConnectee } from '@/components/vues/CoquilleConnectee';
import { moiCourant, vuesDe } from '@/lib/acces';
import { signer } from '@/lib/stockage';

/**
 * Disposition des vues authentifiées.
 *
 * Elle tient deux rôles. Le premier est un garde-fou d'expérience : sans
 * session, on repart sur `/login` plutôt que de voir une coquille vide. Il ne
 * remplace PAS l'autorisation — celle-ci vit dans les policies PostgreSQL. Un
 * contrôle en bordure protège l'affichage, la RLS protège la donnée.
 *
 * Le second est de donner à la coquille la liste des vues ouvertes à ce compte,
 * lue dans `api.moi`. C'est la base qui la dit, pas un claim du jeton.
 *
 * `moiCourant` est mémoïsée par requête : la disposition et la page qu'elle
 * enveloppe l'appellent toutes les deux, la lecture n'a lieu qu'une fois.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA PHOTO EST SIGNÉE ICI, ET C'EST LE SEUL ENDROIT POSSIBLE
 * ─────────────────────────────────────────────────────────────────────────
 * Nos deux seaux sont privés. Une photo déposée par quelqu'un — un talent dans
 * `documents-talent`, un contact client dans `documents-entreprise` — vaut
 * `/documents-…/…` dans `photo_url` : un `<img src>` posé dessus ne charge
 * rien, et `Avatar` retombe sur les initiales. Autrement dit, sans cette ligne,
 * on dépose sa photo et l'en-tête continue d'afficher ses initiales, pour
 * toujours.
 *
 * C'est la disposition qui doit le faire parce que c'est elle qui rend
 * l'en-tête, et qu'elle le rend pour LES QUATRE PORTAILS sans savoir dans
 * lequel elle se trouve. `signer` reconnaît le seau au préfixe de la valeur et
 * SORT IMMÉDIATEMENT sur tout le reste — les `//…cdn.bubble.io/…` hérités, soit
 * 100 % du corpus repris. Le coût n'est payé que par une photo réellement
 * déposée chez nous.
 */
export default async function LayoutPrive({ children }: { children: React.ReactNode }) {
  const moi = await moiCourant();
  if (!moi) redirect('/login');

  const photoUrl = await signer(moi.photoUrl);

  return (
    <CoquilleConnectee
      vues={vuesDe(moi)}
      // L'identité descend d'ici : la coquille est un composant client et
      // `api.moi` se lit avec le jeton, donc côté serveur.
      personne={{ prenom: moi.prenom, nom: moi.nom, photoUrl }}
    >
      {children}
    </CoquilleConnectee>
  );
}
