'use client';

import { useId } from 'react';

import { MessageErreur } from './Champ';
import { ChampNombre } from './ChampNombre';
import { cn } from '@/lib/utils';

/**
 * ChampFourchette — deux bornes qui ne peuvent pas se croiser.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE MODÈLE EN EST PLEIN
 * ─────────────────────────────────────────────────────────────────────────
 * `salaire_min_ke` / `salaire_max_ke`, `tjm_min_eur` / `tjm_max_eur`, et leurs
 * jumeaux côté mandat comme côté fiche talent. Chaque écran qui les affiche
 * aujourd'hui pose deux `Champ` côte à côte et n'en vérifie aucune cohérence :
 * `FormulaireBrief` accepte un minimum de 80 pour un maximum de 45, et
 * `app.controler_brief` l'accepte aussi. On écrit alors dans la base une
 * fourchette qui ne veut rien dire, et un jour un filtre « salaire entre X
 * et Y » ne rend plus rien sans que personne comprenne pourquoi.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ON N'INVERSE PAS. ON DIT.
 * ─────────────────────────────────────────────────────────────────────────
 * La tentation est d'échanger les deux valeurs quand elles se croisent. C'est
 * exactement la « correction serviable » qui détruit les données : quelqu'un
 * qui tape 80 puis 45 s'est peut-être trompé de champ, mais peut-être aussi de
 * chiffre — l'inversion choisit à sa place, sans le dire, et ce qui est
 * enregistré n'est plus ce qu'il a voulu écrire. Le composant SIGNALE, et
 * laisse corriger.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES DEUX CHAMPS SONT INVALIDES, PAS SEULEMENT LE SECOND
 * ─────────────────────────────────────────────────────────────────────────
 * C'est le COUPLE qui est incohérent : rien ne dit lequel des deux nombres est
 * le mauvais. Marquer le seul maximum désignerait un coupable au hasard et
 * enverrait corriger là où il n'y a peut-être rien à corriger. Les deux portent
 * donc `aria-invalid`, et les deux sont décrits par le MÊME message, écrit une
 * seule fois sous la paire. Un lecteur d'écran qui entre dans l'un ou l'autre
 * entend la phrase entière.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ZÉRO N'EST PAS VIDE
 * ─────────────────────────────────────────────────────────────────────────
 * Une borne à `null` est une borne non renseignée : « à partir de 45 K€ » est
 * une fourchette parfaitement valide, et « jusqu'à 80 K€ » aussi. Le contrôle
 * de cohérence ne s'applique donc que lorsque les DEUX bornes existent. Une
 * borne à `0`, elle, est une vraie valeur — d'où les comparaisons à `null` et
 * jamais des tests de vérité.
 *
 * `erreur` fournie de l'extérieur (un refus du serveur) PRIME sur le contrôle
 * local : le serveur en sait plus, et empiler deux messages sous un même champ
 * ne fait lire ni l'un ni l'autre.
 */

export type Fourchette = { min: number | null; max: number | null };

export type ProprietesChampFourchette = {
  /** Ce que la fourchette mesure. « Rémunération annuelle ». Porté par la légende. */
  libelle?: string;
  libelleMin?: string;
  libelleMax?: string;
  /** L'unité des deux bornes : « K€ », « €/j », « ans ». */
  unite?: string;
  valeurs: Fourchette;
  onChangement: (valeurs: Fourchette) => void;
  /** Erreur imposée de l'extérieur. Prime sur le contrôle de cohérence. */
  erreur?: string;
  /** Texte d'aide sous la paire. Masqué quand un message d'erreur s'affiche. */
  aide?: string;
  requis?: boolean;
  /** Bornes absolues des deux champs, et pas de la fourchette. */
  min?: number;
  max?: number;
  pas?: number;
  decimales?: number;
  boutons?: boolean;
  desactive?: boolean;
  nomMin?: string;
  nomMax?: string;
  className?: string;
};

/**
 * Le contrôle, exporté : une Server Action a le même besoin, et deux règles
 * écrites à deux endroits divergent le jour où l'une change.
 * Rend le motif du refus, ou `null` si la fourchette tient debout.
 */
export function verifierFourchette(
  { min, max }: Fourchette,
  unite?: string,
): string | null {
  if (min === null || max === null) return null;
  if (max >= min) return null;
  return unite
    ? `Le maximum (${max} ${unite}) ne peut pas être inférieur au minimum (${min} ${unite}).`
    : 'Le maximum ne peut pas être inférieur au minimum.';
}

export function ChampFourchette({
  libelle,
  libelleMin = 'Minimum',
  libelleMax = 'Maximum',
  unite,
  valeurs,
  onChangement,
  erreur,
  aide,
  requis,
  min,
  max,
  pas = 1,
  decimales = 0,
  boutons = false,
  desactive,
  nomMin,
  nomMax,
  className,
}: ProprietesChampFourchette) {
  const id = useId();
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;

  const incoherence = verifierFourchette(valeurs, unite);
  const message = erreur ?? incoherence ?? undefined;

  // Les deux champs pointent vers le message de la PAIRE, et non vers le leur :
  // `ChampNombre` ne reçoit donc pas `erreur` (il rendrait sa propre ligne, en
  // double), seulement de quoi se marquer invalide et de quoi être décrit.
  const decrit = [message ? idErreur : null, aide && !message ? idAide : null]
    .filter(Boolean)
    .join(' ');

  return (
    <fieldset
      className={cn('flex w-full flex-col gap-1', className)}
      disabled={desactive}
      aria-describedby={decrit || undefined}
    >
      {/* Même grammaire que `GroupeCases` : Caption/Bold noir, gouttière 4px. */}
      {libelle && <legend className="t-caption-bold mb-1 text-black">{libelle}</legend>}

      <div className="flex items-start gap-3">
        <ChampNombre
          className="flex-1"
          libelle={libelleMin}
          unite={unite}
          valeur={valeurs.min}
          onChangement={(v) => onChangement({ ...valeurs, min: v })}
          min={min}
          max={max}
          pas={pas}
          decimales={decimales}
          boutons={boutons}
          requis={requis}
          nom={nomMin}
          desactive={desactive}
          // Pas de `erreur` : le message est celui de la PAIRE, rendu une seule
          // fois sous elle. `invalide` pose la bordure rouge et `aria-invalid`,
          // `decritPar` rattache ce champ-ci au message commun.
          invalide={Boolean(message)}
          decritPar={message ? idErreur : undefined}
        />

        {/* Le tiret de liaison, aligné sur la ligne des boîtiers : 16px de
            libellé + 4px de gouttière = 20px de décalage. Décoratif — la
            relation est déjà portée par la légende et les deux libellés. */}
        <span
          aria-hidden="true"
          className="t-body mt-[calc(16px+0.25rem)] flex h-[var(--h-champ)] items-center text-[var(--encre-400)]"
        >
          –
        </span>

        <ChampNombre
          className="flex-1"
          libelle={libelleMax}
          unite={unite}
          valeur={valeurs.max}
          onChangement={(v) => onChangement({ ...valeurs, max: v })}
          min={min}
          max={max}
          pas={pas}
          decimales={decimales}
          boutons={boutons}
          requis={requis}
          nom={nomMax}
          desactive={desactive}
          invalide={Boolean(message)}
          decritPar={message ? idErreur : undefined}
        />
      </div>

      {aide && !message && (
        <p id={idAide} className="t-caption text-[var(--encre-500)]">
          {aide}
        </p>
      )}
      {message && <MessageErreur id={idErreur}>{message}</MessageErreur>}
    </fieldset>
  );
}
