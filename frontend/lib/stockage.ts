import {
  cheminDepose,
  SEAU_ENTREPRISE,
  SEAU_TALENT,
  seauDe,
  type Seau,
} from '@/lib/domaine/stockage';
import { urlMedia } from '@/lib/domaine/entreprise';
import { clientServeur } from '@/lib/supabase/serveur';

/**
 * LE STOCKAGE DE FICHIERS — la couche serveur, pour les deux seaux.
 *
 * ⚠ MODULE DE SERVEUR : il ouvre un client Supabase porteur du cookie de
 * session. Aucun composant client ne doit l'importer.
 *
 * Il servait le seul portail talent sous `lib/talent/stockage.ts` ; il a été
 * remonté d'un cran le jour où le portail entreprise a eu besoin de déposer la
 * photo d'un contact client. La raison de ne pas le dupliquer est la COQUILLE :
 * l'en-tête des écrans connectés affiche la photo de qui que ce soit sans
 * savoir dans quel portail il se trouve, donc il lui faut UN signataire qui
 * reconnaisse la valeur à son préfixe. C'est `signer` ci-dessous.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES DEUX SEAUX SONT PRIVÉS, DONC RIEN N'EST AFFICHABLE SANS SIGNATURE
 * ─────────────────────────────────────────────────────────────────────────
 * `documents-talent` (migration `20260913170000`) et `documents-entreprise`
 * (`20260913230000`) sont créés `public = false`. Leurs policies ne laissent un
 * compte voir que les objets dont le PREMIER dossier est sa propre clé — sa
 * fiche talent d'un côté, sa fiche de contact client de l'autre. Vérifié par
 * sonde sur le premier le 09/09 :
 *
 *   · dépôt du talent dans son dossier `cv/` → 200 ;
 *   · dépôt dans un dossier hors liste blanche → 403 RLS ;
 *   · dépôt dans le dossier d'autrui → 403 RLS ;
 *   · dépôt par un compte entreprise dans le dossier du talent → 403 RLS ;
 *   · signature demandée par le compte entreprise → 404 « Object not found » ;
 *   · 11 Mo → 413 ; `image/svg+xml` → 415.
 *
 * Un `<img src>` ou un `<a href>` ne peut donc PAS pointer sur l'objet : il
 * faut une URL signée, fabriquée ici, à durée courte.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI DES URL SIGNÉES ET NON UN SEAU PUBLIC
 * ─────────────────────────────────────────────────────────────────────────
 * Un seau public sert ses objets par URL devinable, sans session, pour
 * toujours. Le CV est le document le plus identifiant du vivier : mesuré en
 * phase 1, **1 145 des 1 414 `cv_url` d'un seul client portent le patronyme
 * dans leur chemin** (D-14). Et un fichier de photo s'appelle presque toujours
 * du nom de la personne. Une signature à cinq minutes est le contraire d'une
 * URL publique : elle expire.
 *
 * ⚠ CONSÉQUENCE ASSUMÉE : une URL signée part dans le HTML servi, donc dans la
 * charge utile RSC, et elle porte le chemin de l'objet — donc souvent le
 * patronyme. C'est SA PROPRE photo, SON PROPRE CV : la personne a le droit de
 * lire son nom. Mais c'est la raison pour laquelle ces fonctions ne sont
 * appelées que sur la donnée du compte courant, jamais sur celle d'un tiers.
 */

/** Cinq minutes. Le temps d'ouvrir un PDF, pas celui de le partager. */
const DUREE_SIGNATURE = 300;

/**
 * Une valeur de `cv_url` / `photo_url` / `portfolio_url` rendue affichable.
 *
 * Trois régimes, et il faut les trois :
 *   · `/documents-talent/…` ou `/documents-entreprise/…` → un objet de NOS
 *     seaux : on le signe ;
 *   · `//hôte/…` → une URL protocole-relative héritée de Bubble (3 926 des
 *     3 926 `cv_url` renseignés, mesuré) : `urlMedia` la préfixe en `https:` ;
 *   · autre chose → rendue telle quelle, ou `null`.
 *
 * ⚠ LE PREMIER TEST EST UNE SORTIE ANTICIPÉE, ET C'EST CE QUI REND CETTE
 * FONCTION APPELABLE DEPUIS LA COQUILLE. Une valeur qui ne vient pas de nos
 * seaux ne coûte AUCUN aller-retour réseau — et c'est le cas de 100 % du
 * corpus repris de Bubble. Seul un fichier réellement déposé chez nous paie la
 * signature.
 *
 * ÉCHOUE VERS `null`, jamais vers une exception. Une signature qui ne se fait
 * pas — objet supprimé du seau à la main, jeton expiré — doit faire disparaître
 * l'image, pas la page. C'est le même parti pris que `utilisateurCourant` :
 * `Avatar` retombe alors sur les initiales, ce qui est un état lisible.
 */
export async function signer(
  valeur: string | null,
  secondes: number = DUREE_SIGNATURE,
): Promise<string | null> {
  if (!valeur) return null;

  const seau = seauDe(valeur);
  if (!seau) return urlMedia(valeur);

  const chemin = cheminDepose(valeur);
  if (!chemin) return null;

  try {
    const supabase = await clientServeur();
    const { data, error } = await supabase.storage
      .from(seau)
      .createSignedUrl(chemin, secondes);
    if (error || !data?.signedUrl) {
      console.warn(`[stockage] signature refusée sur ${seau}/${chemin} : ${error?.message ?? 'sans URL'}`);
      return null;
    }
    return data.signedUrl;
  } catch (erreur) {
    console.error('[stockage] signature impossible :', erreur);
    return null;
  }
}

/** Le plafond annoncé par chaque seau, pour traduire un refus 413. */
const PLAFONDS: Record<Seau, string> = {
  [SEAU_TALENT]: '10 Mo',
  [SEAU_ENTREPRISE]: '2 Mo',
};

/**
 * Le dépôt d'un fichier.
 *
 * `upsert: false` — le chemin porte déjà un horodatage, donc une collision
 * signalerait un vrai problème plutôt qu'un remplacement voulu. On ne masque
 * pas une collision par un écrasement.
 *
 * Rend le message de Supabase TRADUIT pour les trois refus que la personne peut
 * comprendre et corriger (taille, type, dossier), et un message générique pour
 * le reste : le corps d'une erreur de stockage peut porter le chemin complet de
 * l'objet, donc le nom du fichier, donc le patronyme.
 */
export async function deposer(
  seau: Seau,
  chemin: string,
  fichier: File,
): Promise<{ ok: true } | { ok: false; erreur: string }> {
  try {
    const supabase = await clientServeur();
    const { error } = await supabase.storage.from(seau).upload(chemin, fichier, {
      upsert: false,
      contentType: fichier.type || 'application/octet-stream',
    });
    if (!error) return { ok: true };

    const message = error.message ?? '';
    if (/exceeded the maximum allowed size|Payload too large/i.test(message)) {
      return {
        ok: false,
        erreur: `Ce fichier dépasse ${PLAFONDS[seau]}. Réduisez-le et réessayez.`,
      };
    }
    if (/mime type|not supported/i.test(message)) {
      return { ok: false, erreur: 'Ce format de fichier n’est pas accepté.' };
    }
    if (/row-level security|Unauthorized/i.test(message)) {
      // Le seul chemin qui mène ici est un compte sans fiche : la policy compare
      // le premier dossier à `api.ma_fiche_talent()` ou `api.mon_contact_client()`,
      // qui est alors nul.
      return {
        ok: false,
        erreur: 'Votre compte n’est rattaché à aucune fiche : le dépôt est impossible.',
      };
    }
    console.error(`[stockage] dépôt refusé sur ${seau}/${chemin} : ${message}`);
    return {
      ok: false,
      erreur: 'Le dépôt a échoué de notre côté. Réessayez dans un instant.',
    };
  } catch (erreur) {
    console.error('[stockage] dépôt impossible :', erreur);
    return { ok: false, erreur: 'Le dépôt a échoué. Vérifiez votre accès au réseau.' };
  }
}
