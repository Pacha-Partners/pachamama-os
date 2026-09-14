/**
 * LA CONVENTION DE CHEMIN DE NOS SEAUX — une seule, pour les deux.
 *
 * ⚠ MODULE PARTAGÉ SERVEUR/CLIENT. Il n'importe ni `next/headers`, ni le client
 * Supabase : les formulaires en ont besoin pour afficher un nom de fichier, les
 * Server Actions pour fabriquer un chemin de dépôt.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI CE MODULE EXISTE
 * ─────────────────────────────────────────────────────────────────────────
 * Cette logique vivait dans `lib/domaine/talent.ts`, avec en commentaire :
 * « le jour où un troisième portail les demandera, l'extraction deviendra le
 * bon geste ». Le portail entreprise est arrivé — il dépose la photo d'un
 * contact client dans `documents-entreprise` — et il fallait choisir entre
 * recopier quarante lignes de découpage de chemin ou les extraire. Recopier
 * aurait donné deux vérités : celle qui assainit le nom de fichier pour le
 * talent, et celle qui l'assainit pour le client. Elles auraient divergé au
 * premier ajustement, et l'une des deux porte une garde de sécurité.
 *
 * `lib/domaine/talent.ts` ré-exporte les noms d'origine : aucun appelant
 * existant n'a bougé.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA FORME D'UNE VALEUR STOCKÉE
 * ─────────────────────────────────────────────────────────────────────────
 *     /documents-talent/<fiche talent>/<cv|photo|portfolio>/<horodatage>-<nom>
 *     /documents-entreprise/<contact client>/photo/<horodatage>-<nom>
 *
 * Le préfixe en barre oblique n'est pas décoratif : `api.maj_ma_fiche` valide
 * ses adresses par « pas d'espace, et commence par `http://`, `https://`, `//`
 * ou `/` » — une règle écrite d'après la donnée réelle (3 926 `cv_url`
 * renseignés, 3 926 en `//hôte/…`, séquelle de Bubble). Un chemin d'objet nu,
 * `91cf…/cv/1757…-cv.pdf`, ne passerait pas cette règle. On stocke donc une
 * valeur qui la satisfait sans la modifier, et qui se reconnaît à son préfixe.
 *
 * ⚠ LES DEUX SEAUX SONT PRIVÉS. Une valeur reconnue ici n'est PAS affichable
 * telle quelle : elle doit passer par `lib/stockage.ts`, qui la signe.
 */

export const SEAU_TALENT = 'documents-talent';
export const SEAU_ENTREPRISE = 'documents-entreprise';

export type Seau = typeof SEAU_TALENT | typeof SEAU_ENTREPRISE;

const SEAUX: readonly Seau[] = [SEAU_TALENT, SEAU_ENTREPRISE];

/**
 * De quel seau vient cette valeur, ou `null` si elle n'en vient d'aucun.
 *
 * C'est la fonction qui permet à un seul signataire de servir les deux
 * portails : la coquille des écrans connectés affiche la photo de qui que ce
 * soit sans savoir dans quel portail elle se trouve.
 */
export function seauDe(valeur: string | null | undefined): Seau | null {
  if (typeof valeur !== 'string') return null;
  return SEAUX.find((s) => valeur.startsWith(`/${s}/`)) ?? null;
}

/** Vrai si la valeur désigne un objet de NOS seaux. */
export function estObjetDepose(valeur: string | null | undefined): boolean {
  return seauDe(valeur) !== null;
}

/** Le chemin dans le seau, ou `null` si la valeur n'en vient pas. */
export function cheminDepose(valeur: string | null | undefined): string | null {
  const seau = seauDe(valeur);
  if (!seau) return null;
  const chemin = (valeur as string).slice(`/${seau}/`.length);
  return chemin.length > 0 ? chemin : null;
}

/** L'inverse de `cheminDepose` : ce qu'on écrit en base. */
export function valeurDeposee(seau: Seau, chemin: string): string {
  return `/${seau}/${chemin.replace(/^\/+/, '')}`;
}

/**
 * Le nom d'origine, rendu sûr comme segment de clé d'objet.
 *
 * ⚠ CE N'EST PAS DE LA COSMÉTIQUE, C'EST UNE GARDE. Le nom part dans un chemin
 * d'objet, et `storage.foldername` découpe sur les `/`. Un nom contenant une
 * barre oblique créerait un dossier de plus, donc décalerait les indices que
 * les policies comparent — et contournerait la liste blanche du deuxième
 * dossier. On ne garde que des lettres, des chiffres, un point, un tiret et un
 * souligné.
 */
export function assainirNomFichier(nomOrigine: string): string {
  return (
    nomOrigine
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      // Les suites de points sont écrasées : `..` n'a aucune valeur dans un nom
      // de fichier, et le laisser dans une clé d'objet laisse planer un doute
      // de traversée là où il n'y en a pas. Un doute sur un chemin de stockage
      // se paie en relecture, pas en octets.
      .replace(/\.{2,}/g, '.')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(-80) || 'fichier'
  );
}

/**
 * Le nom sous lequel un fichier est déposé : `<propriétaire>/<nature>/<ts>-<nom>`.
 *
 * Horodaté : deux dépôts successifs ne s'écrasent pas, et l'ordre de dépôt
 * reste lisible dans le seau — utile le jour où quelqu'un doit retrouver la
 * version d'un document transmise à un client.
 */
export function cheminDepot(
  proprietaireId: string,
  nature: string,
  nomOrigine: string,
): string {
  return `${proprietaireId}/${nature}/${Date.now()}-${assainirNomFichier(nomOrigine)}`;
}

/** Ce que l'écran affiche comme nom d'un document déjà en place. */
export function nomLisible(valeur: string | null): string | null {
  if (!valeur) return null;
  const sansRequete = valeur.split(/[?#]/)[0];
  const dernier = sansRequete.split('/').filter(Boolean).pop() ?? null;
  if (!dernier) return null;
  // Nos dépôts portent leur horodatage en tête : on le retire à l'affichage, il
  // n'apprend rien à la personne qui relit son propre document.
  const sansHorodatage = dernier.replace(/^\d{10,}-/, '');
  try {
    return decodeURIComponent(sansHorodatage);
  } catch {
    return sansHorodatage;
  }
}
