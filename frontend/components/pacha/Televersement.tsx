'use client';

import { useId, useState } from 'react';

import { CadreChamp } from './Champ';
import { Icone } from './Icone';
import { Jauge } from './Jauge';
import { cn } from '@/lib/utils';

/**
 * Televersement — déposer un fichier : CV, photo, portfolio.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * IL N'ENVOIE RIEN. C'EST VOULU, ET C'EST LA PREMIÈRE CHOSE À SAVOIR.
 * ─────────────────────────────────────────────────────────────────────────
 * Ce composant ne connaît ni Supabase Storage, ni `fetch`, ni le nom d'un
 * bucket. Il reçoit `onFichier(f)` et un `etat`, et il dessine. La raison est
 * la règle d'écriture du projet (ADR 0005) : un téléversement réel touche un
 * bucket, journalise, et doit passer par une Server Action — un composant du
 * design system qui appellerait le réseau court-circuiterait tout ce chemin et
 * emporterait avec lui la clé d'idempotence, la liste blanche et le journal.
 * Ici : l'écran téléverse, le composant montre où ça en est.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UN VRAI `<input type="file">`, JAMAIS UN `<div>` CLIQUABLE
 * ─────────────────────────────────────────────────────────────────────────
 * L'input est réel, monté en permanence, et il COUVRE la zone de dépôt en
 * `absolute inset-0 opacity-0`. Ce n'est pas un bricolage : c'est le seul
 * montage où un seul et même élément reçoit le clic, la tabulation, l'Entrée,
 * la commande vocale, et le dépôt de fichier — un `input[type=file]` accepte
 * nativement un `drop`, sans une ligne de JavaScript. Un `<div onClick>` qui
 * appellerait `input.click()` perdrait le clavier, ou ajouterait une seconde
 * cible focalisable pour une seule action.
 *
 * Les gestionnaires `onDragOver` / `onDragLeave` ne servent QU'À L'APPARENCE.
 * Aucun d'eux n'appelle `preventDefault` : l'événement doit continuer sa route
 * jusqu'à l'input, qui fait le travail. Le jour où l'un d'eux préviendra le
 * défaut, le dépôt cessera de fonctionner — et rien ne le dira.
 *
 * L'anneau de focus est porté par la ZONE, via `has-[:focus-visible]`, parce
 * que l'input qui le reçoit est transparent.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES LIMITES SONT ANNONCÉES AVANT, ET ELLES SONT TENUES
 * ─────────────────────────────────────────────────────────────────────────
 * `typesAcceptes` et `tailleMaxOctets` produisent une phrase — « PDF ou Word ·
 * 5 Mo maximum » — posée dans le texte d'aide du cadre, donc rattachée à
 * l'input par `aria-describedby` : elle est lue À LA PRISE DE FOCUS, avant le
 * choix, et pas en reproche après.
 *
 * Et elles sont VÉRIFIÉES ici. Annoncer une limite qu'on ne contrôle pas est
 * un mensonge poli : un fichier refusé n'appelle pas `onFichier`, et le motif
 * s'affiche à la place. C'est une garde de confort, pas une sécurité — la
 * vérification qui compte est celle du serveur, toujours.
 *
 * ⚠ UN SEUL FICHIER. `multiple` n'existe pas dans ce contrat. Les trois usages
 * connus (CV, photo, portfolio) sont singuliers, et un composant multi-fichiers
 * a une autre anatomie : une liste, un ordre, une progression par ligne, un
 * total. Ce serait un second composant, pas une prop.
 */

/* ── L'état du transfert, tel que l'écran le connaît ───────────────────────── */

/**
 * Union discriminée, et non un objet à quatre champs facultatifs : « en échec
 * avec une progression de 40 % » ne veut rien dire, et le type interdit de
 * l'écrire.
 */
export type EtatTeleversement =
  | { phase: 'repos' }
  /** `progression` absente = on ne sait pas de combien ça a avancé. */
  | { phase: 'envoi'; progression?: number }
  | { phase: 'fait' }
  | { phase: 'echec'; message: string };

/** Un fichier déjà stocké côté serveur, qu'aucun `File` local ne représente. */
export type FichierExistant = {
  nom: string;
  /** Lien de consultation. Absent, le nom n'est pas cliquable. */
  href?: string;
  octets?: number;
};

export type ProprietesTeleversement = {
  libelle?: string;
  /** Texte d'aide propre à l'écran. La contrainte de format s'y ajoute. */
  aide?: string;
  /** Erreur imposée de l'extérieur (refus du serveur). */
  erreur?: string;
  requis?: boolean;
  /**
   * Ce qui est accepté : types MIME (`'application/pdf'`, `'image/*'`) et/ou
   * extensions (`'.docx'`). Sert à la fois d'attribut `accept`, de phrase
   * annoncée et de garde à la sélection.
   */
  typesAcceptes?: readonly string[];
  /** Plafond en octets. `5 * 1024 * 1024` pour 5 Mo. */
  tailleMaxOctets?: number;
  /**
   * Remplace la phrase déduite de `typesAcceptes` quand celle-ci est illisible
   * (« application/vnd.openxmlformats-officedocument… »).
   */
  libelleTypes?: string;
  /** Le fichier retenu, choisi par l'écran. Le composant ne le stocke pas. */
  fichier?: File | null;
  /** Le fichier déjà en place, quand il n'y a pas de `File` local. */
  fichierExistant?: FichierExistant | null;
  /**
   * Un aperçu de ce qui est retenu, posé à GAUCHE du nom de fichier.
   *
   * Il n'existe que pour les dépôts qu'on peut REGARDER — une photo, un
   * logo — et c'est la seule façon de vérifier qu'on a déposé la bonne : un
   * nom de fichier ne dit pas ce qu'il y a dedans, et `IMG_4471.jpg` encore
   * moins que les autres. Sur un CV il n'y a rien à montrer, et la prop reste
   * absente.
   *
   * Le composant ne le fabrique pas : c'est l'écran qui sait si la valeur est
   * signable, et la signature est un geste de serveur.
   */
  apercu?: React.ReactNode;
  /** Appelé seulement si le fichier passe les gardes de type et de taille. */
  onFichier: (fichier: File) => void;
  /** Absent, le bouton de retrait n'apparaît pas. */
  onRetirer?: () => void;
  etat?: EtatTeleversement;
  desactive?: boolean;
  className?: string;
};

/* ── Deux outils, exportés parce que les écrans en ont besoin aussi ────────── */

/**
 * « 4,2 Mo ». Unités françaises (Ko / Mo / Go), séparateur décimal virgule.
 * Base 1024 : c'est celle que les systèmes de fichiers affichent, donc celle à
 * laquelle le chiffre annoncé doit correspondre quand l'utilisateur va vérifier.
 */
export function formaterOctets(octets: number): string {
  if (!Number.isFinite(octets) || octets < 0) return '—';
  if (octets < 1024) return `${octets} o`;
  const unites = ['Ko', 'Mo', 'Go', 'To'];
  let valeur = octets / 1024;
  let rang = 0;
  while (valeur >= 1024 && rang < unites.length - 1) {
    valeur /= 1024;
    rang += 1;
  }
  const arrondi = valeur < 10 ? Math.round(valeur * 10) / 10 : Math.round(valeur);
  return `${arrondi.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${unites[rang]}`;
}

/**
 * La garde. Rend le motif du refus, ou `null` si le fichier passe.
 *
 * Trois formes d'acceptation sont reconnues, parce que les trois circulent :
 * le type exact (`application/pdf`), la famille (`image/*`) et l'extension
 * (`.docx`). Un `typesAcceptes` vide n'interdit rien — c'est une liste
 * d'autorisations, pas de refus.
 */
export function verifierFichier(
  fichier: File,
  contraintes: { typesAcceptes?: readonly string[]; tailleMaxOctets?: number } = {},
): string | null {
  const { typesAcceptes, tailleMaxOctets } = contraintes;

  if (typesAcceptes && typesAcceptes.length > 0) {
    const nom = fichier.name.toLowerCase();
    const type = fichier.type.toLowerCase();
    const accepte = typesAcceptes.some((regle) => {
      const r = regle.trim().toLowerCase();
      if (r.startsWith('.')) return nom.endsWith(r);
      if (r.endsWith('/*')) return type.startsWith(r.slice(0, -1));
      return type === r;
    });
    // Certains navigateurs rendent `type` vide sur des extensions qu'ils ne
    // connaissent pas. On ne refuse alors QUE si aucune règle d'extension ne
    // correspond — refuser sur un type vide écarterait des fichiers valides.
    if (!accepte) return 'Ce format n’est pas accepté ici.';
  }

  if (tailleMaxOctets !== undefined && fichier.size > tailleMaxOctets) {
    return `Ce fichier pèse ${formaterOctets(fichier.size)}, le maximum est ${formaterOctets(tailleMaxOctets)}.`;
  }

  return null;
}

/* ── La phrase de contrainte ───────────────────────────────────────────────── */

/** Les types courants d'un ATS, en français lisible. Le reste retombe sur l'extension. */
const NOMS_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'image/*': 'image',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
};

function phraseTypes(types: readonly string[]): string {
  const noms = Array.from(
    new Set(types.map((t) => NOMS_TYPES[t.trim().toLowerCase()] ?? t.replace(/^\./, '').toUpperCase())),
  );
  if (noms.length === 0) return '';
  if (noms.length === 1) return noms[0];
  return `${noms.slice(0, -1).join(', ')} ou ${noms[noms.length - 1]}`;
}


/* ── Le composant ──────────────────────────────────────────────────────────── */

export function Televersement({
  libelle,
  aide,
  erreur,
  requis,
  typesAcceptes,
  tailleMaxOctets,
  libelleTypes,
  fichier,
  fichierExistant,
  apercu,
  onFichier,
  onRetirer,
  etat = { phase: 'repos' },
  desactive,
  className,
}: ProprietesTeleversement) {
  const id = useId();
  // Le refus local n'est PAS remonté à l'écran : rien n'a changé de son point
  // de vue, aucun fichier n'a été retenu. C'est un message d'interface, il vit
  // donc ici, et il s'efface au choix suivant.
  const [refus, setRefus] = useState<string | null>(null);
  const [survole, setSurvole] = useState(false);

  const enEnvoi = etat.phase === 'envoi';
  const inerte = desactive || enEnvoi;

  // Le nom et le poids de ce qui est retenu : le `File` local d'abord (il est
  // plus récent), le fichier déjà stocké sinon.
  const retenu = fichier
    ? { nom: fichier.name, octets: fichier.size, type: fichier.type, href: undefined }
    : fichierExistant
      ? { nom: fichierExistant.nom, octets: fichierExistant.octets, type: undefined, href: fichierExistant.href }
      : null;

  const contrainte = [
    typesAcceptes && typesAcceptes.length > 0 ? (libelleTypes ?? phraseTypes(typesAcceptes)) : null,
    tailleMaxOctets !== undefined ? `${formaterOctets(tailleMaxOctets)} maximum` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;
  const idContrainte = `${id}-contrainte`;

  // Priorité des messages : l'échec du transfert (le plus récent et le plus
  // grave), puis le refus local, puis l'erreur imposée par l'écran.
  const message = etat.phase === 'echec' ? etat.message : (refus ?? erreur);

  // ⚠ LA CONTRAINTE N'EST ÉCRITE QU'UNE FOIS, ET RATTACHÉE LÀ OÙ ELLE EST.
  // Elle l'était deux fois : une dans la zone, une dans l'aide du cadre juste
  // dessous — le même « JPEG, PNG ou WebP · 2 Mo maximum », à cinquante pixels
  // d'écart, la seconde marquée `aria-hidden` pour ne pas l'entendre en double.
  // C'était du bruit visible sur toute la largeur du champ. Elle vit désormais
  // dans la zone (là où le regard se pose au moment de choisir) ou sous le nom
  // du fichier retenu (là où l'on se demande par quoi le remplacer), et c'est
  // CE texte que `aria-describedby` vise — donc il est bien annoncé à la prise
  // de focus, sans répétition. `aide` reste l'aide propre à l'écran.
  const decrit = [
    message ? idErreur : null,
    aide && !message ? idAide : null,
    contrainte && !message ? idContrainte : null,
  ]
    .filter(Boolean)
    .join(' ');

  function choisir(liste: FileList | null) {
    const f = liste?.[0];
    if (!f) return;
    const motif = verifierFichier(f, { typesAcceptes, tailleMaxOctets });
    if (motif) {
      setRefus(motif);
      return;
    }
    setRefus(null);
    onFichier(f);
  }

  return (
    <CadreChamp
      id={id}
      libelle={libelle}
      erreur={message}
      // Seulement l'aide de l'écran : la contrainte, elle, est rendue au plus
      // près du geste — voir le commentaire de `decrit`.
      aide={aide}
      className={className}
    >
      {/* Une région vivante, toujours montée, jamais visible.
          `MessageErreur` rend un `<p>` inerte : un refus survenu APRÈS le choix
          — mauvais format, fichier trop lourd, envoi échoué — s'afficherait
          sans que rien ne l'annonce, et l'utilisateur attendrait un transfert
          qui n'a jamais commencé. `aria-describedby` ne suffit pas : il n'est
          relu qu'à une nouvelle prise de focus. La région doit exister AVANT le
          message pour qu'il soit annoncé, d'où le rendu inconditionnel. */}
      <p aria-live="polite" className="sr-only">
        {message ?? ''}
      </p>

      {/* ⚠ UNE LIGNE, ET ELLE NE CRIE PAS.
          Ce bloc portait un filet noir, un fond de carte et un bouton à cadre
          avec sa corbeille : trois marques d'insistance pour dire « il y a un
          fichier », alors que le fait est acquis et qu'il n'appelle rien. La
          hauteur de champ, un filet fin et un retrait en lien suffisent. */}
      {retenu && (
        <div
          className={cn(
            'flex items-center gap-3 px-2.5 py-1.5',
            apercu ? 'min-h-[72px]' : 'min-h-[var(--h-champ)]',
            'rounded-[var(--r-md)] border border-[var(--encre-100)] bg-[var(--fond-page)]',
            message && 'border-[#ff2626]',
          )}
        >
          {apercu && <span className="flex shrink-0 items-center">{apercu}</span>}

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 items-baseline gap-2">
              {retenu.href ? (
                <a
                  href={retenu.href}
                  target="_blank"
                  rel="noreferrer"
                  className="t-body-hl min-w-0 truncate text-black underline underline-offset-2 hover:text-[var(--violet-700)]"
                >
                  {retenu.nom}
                </a>
              ) : (
                <span className="t-body-hl min-w-0 truncate text-black">{retenu.nom}</span>
              )}
              {retenu.octets !== undefined && (
                <span className="t-caption shrink-0 text-[var(--encre-500)]">
                  {formaterOctets(retenu.octets)}
                </span>
              )}
            </div>

            {enEnvoi && (
              <Jauge valeur={etat.progression ?? null} taille="sm" libelle="Envoi en cours" />
            )}

            {etat.phase === 'fait' && (
              <p className="t-caption flex items-center gap-1 text-[var(--encre-600)]">
                <Icone nom="icon-check" className="size-3.5 text-black" />
                Envoyé.
              </p>
            )}

            {/* Elle répond ici à une autre question qu'à la zone vide : non
                plus « que puis-je déposer » mais « par quoi puis-je le
                remplacer ». Elle s'efface pendant l'envoi, où la jauge et le
                « Envoyé. » occupent la ligne. */}
            {contrainte && etat.phase !== 'envoi' && etat.phase !== 'fait' && (
              <p id={idContrainte} className="t-caption text-[var(--encre-600)]">
                {contrainte}
              </p>
            )}
          </div>

          {onRetirer && (
            <button
              type="button"
              disabled={inerte}
              onClick={() => {
                setRefus(null);
                onRetirer();
              }}
              className={cn(
                't-caption-hl shrink-0 rounded-[var(--r-xs)] text-black underline underline-offset-2',
                'hover:decoration-2 disabled:cursor-not-allowed disabled:text-[var(--encre-300)]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-anneau)]',
              )}
            >
              Retirer
            </button>
          )}
        </div>
      )}

      {/* ⚠ LA ZONE RESTE MONTÉE, MÊME AVEC UN FICHIER EN PLACE.
          Le wireframe ne montre que la ligne du fichier, et c'était tentant :
          l'écran y gagnait un élément. Mais il ne modélise pas le REMPLACEMENT,
          qui est le geste le plus fréquent sur un CV — et sans zone, il faudrait
          « Retirer » d'abord, ce qui vide `cv_url` : quelqu'un qui abandonne
          entre les deux enregistre une fiche sans CV. Le poids que le wireframe
          dénonçait venait d'ailleurs — du filet noir autour du nom, du bouton à
          cadre et de l'aide répétée dessous, tous trois retirés. La zone, elle,
          ne pèse qu'une ligne de la hauteur d'un champ. */}
      <div
        data-survole={survole && !inerte ? '' : undefined}
        onDragOver={() => !inerte && setSurvole(true)}
        onDragLeave={() => setSurvole(false)}
        onDrop={() => setSurvole(false)}
        className={cn(
          'relative flex w-full flex-col items-center justify-center gap-1 text-center',
          'rounded-[var(--r-md)] border border-dashed border-black bg-[var(--fond-carte)]',
          retenu ? 'h-[var(--h-champ)] flex-row gap-2 px-3' : 'min-h-[var(--h-zone-depot)] px-4 py-5',
          // Survol souris et survol de fichier : mêmes signes que la famille
          // `Champ` — bordure épaissie, élévation douce, retrait compensé.
          !inerte && [
            'hover:border-2 hover:border-[var(--encre-600)] hover:shadow-[var(--ombre-douce)]',
            'data-survole:border-2 data-survole:border-black data-survole:bg-[var(--violet-050)]',
            'data-survole:shadow-[var(--ombre-douce)]',
          ],
          // L'anneau de focus est posé sur la zone : l'input qui le reçoit est
          // transparent, et un anneau invisible n'est pas un anneau.
          'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
          'has-[:focus-visible]:outline-[var(--focus-anneau)]',
          message && 'border-[#ff2626]',
          inerte && 'cursor-not-allowed border-[#dee3ed] bg-[var(--encre-100)]',
        )}
      >
        <input
          id={id}
          type="file"
          accept={typesAcceptes && typesAcceptes.length > 0 ? typesAcceptes.join(',') : undefined}
          required={requis}
          disabled={inerte}
          aria-required={requis || undefined}
          aria-invalid={message ? true : undefined}
          // ⚠ SANS CETTE LIGNE, TOUT LE RAISONNEMENT DE L'EN-TÊTE S'EFFONDRE.
          // `CadreChamp` rend bien la phrase de contrainte et le message
          // d'erreur, avec les identifiants `-aide` et `-erreur` — mais c'est
          // au champ de dire qu'il les porte. Oubliée une première fois, cette
          // ligne rendait la promesse « les limites sont annoncées AVANT le
          // choix » littéralement fausse : les deux textes étaient à l'écran et
          // rattachés à rien.
          aria-describedby={decrit || undefined}
          // `value=''` à chaque changement : sans cela, rechoisir DEUX FOIS le
          // même fichier ne déclenche pas d'événement, et l'écran croit que
          // l'utilisateur n'a rien fait alors qu'il vient de corriger un envoi
          // échoué avec le même document.
          onChange={(e) => {
            choisir(e.target.files);
            e.target.value = '';
          }}
          className={cn(
            'absolute inset-0 z-10 h-full w-full opacity-0',
            inerte ? 'cursor-not-allowed' : 'cursor-pointer',
          )}
        />

        <Icone
          nom="icon-upload-cloud"
          className={cn('shrink-0 text-[var(--encre-500)]', retenu ? 'size-4' : 'size-6')}
        />
        <p className={cn('text-black', retenu ? 't-caption-hl' : 't-body-hl')}>
          {retenu ? 'Remplacer le fichier' : 'Déposez un fichier, ou cliquez pour le choisir'}
        </p>
        {!retenu && contrainte && (
          // L'unique énoncé de la contrainte quand rien n'est encore déposé, et
          // c'est lui que l'input désigne par `aria-describedby` : il est donc
          // lu À LA PRISE DE FOCUS, avant le choix, et pas en reproche après.
          <p id={idContrainte} className="t-caption text-[var(--encre-500)]">
            {contrainte}
          </p>
        )}
      </div>
    </CadreChamp>
  );
}
