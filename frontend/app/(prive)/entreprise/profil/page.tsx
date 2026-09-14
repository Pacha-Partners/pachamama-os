import { CadreEcran, EnteteEcran } from '@/components/vues/entreprise/atomes';
import { SansEntreprise } from '@/components/vues/entreprise/SansEntreprise';
import { ProfilEntreprise } from '@/components/vues/entreprise/ProfilEntreprise';
import { monEntreprise, monProduit } from '@/lib/entreprise/lectures';
import { signer } from '@/lib/stockage';

export const metadata = { title: 'Profil entreprise' };
export const dynamic = 'force-dynamic';

/**
 * LE PROFIL DE L'ENTREPRISE.
 *
 * QUAND `api.mon_entreprise` NE REND RIEN, CE N'EST PAS UN 404.
 * C'est un compte qui porte l'accès `entreprise` sans être rattaché à une
 * fiche — la reprise en a laissé 341 dans cet état. L'adresse est bonne, la
 * page existe, c'est le RATTACHEMENT qui manque. On rend donc l'écran avec son
 * explication, et non « page introuvable », qui enverrait l'utilisateur
 * chercher une faute dans son lien.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA SIGNATURE DU LOGO SE FAIT ICI
 * ─────────────────────────────────────────────────────────────────────────
 * `documents-entreprise` est privé : un `logo_url` déposé chez nous vaut
 * `/documents-entreprise/…`, une référence et non une adresse affichable.
 * `signer` la change en URL à cinq minutes, et c'est un geste de serveur.
 * Il SORT IMMÉDIATEMENT sur une valeur qui n'en vient pas — et les 275 logos
 * repris de Bubble sur 363 sont dans ce cas : l'appel ne coûte un aller-retour
 * que pour un fichier réellement déposé.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PLUS DE CARTE D'INTERLOCUTEUR EN BAS DE PAGE
 * ─────────────────────────────────────────────────────────────────────────
 * Elle nommait l'Account Manager sous un titre « Une question sur cette
 * fiche ». Deux raisons de la retirer : `am_email` est VIDE (mesuré, 0/1 sur
 * le compte de test), donc la carte affichait un nom sans moyen de le joindre ;
 * et l'écran a désormais deux cartes qui disent quoi faire — ce qui manque aux
 * candidats, ce qui manque à la facturation — là où celle-ci ne disait qu'à
 * qui s'adresser. L'Account Manager reste nommé sur « Mes informations ».
 */
export default async function Vue() {
  const [entreprise, produit] = await Promise.all([monEntreprise(), monProduit()]);
  if (!entreprise) return <SansEntreprise objet="votre fiche entreprise" />;

  const logoApercu = await signer(entreprise.logoUrl);

  return (
    <CadreEcran>
      <EnteteEcran descriptif="La fiche de" impact={entreprise.nom} />

      <ProfilEntreprise entreprise={entreprise} produit={produit} logoApercu={logoApercu} />
    </CadreEcran>
  );
}
