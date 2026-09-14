'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Bouton, type ApparenceBouton, type TailleBouton } from '@/components/pacha/Bouton';
import { Icone } from '@/components/pacha/Icone';
import { cn } from '@/lib/utils';

/**
 * Copier une valeur dans le presse-papier, et le dire.
 *
 * POURQUOI CE COMPOSANT EXISTE
 * Un client de cabinet de recrutement ne lit pas une fiche candidat pour la
 * lire : il la RECOPIE dans son propre ATS. Tant qu'il doit sélectionner à la
 * souris champ par champ, il se trompe, ou il redemande le CV par e-mail — et
 * l'intérêt du portail tombe. La demande était explicite : « qu'il y ait des
 * options pour copier ces infos, parce que généralement ils en ont besoin pour
 * leur ATS ».
 *
 * TROIS PARTIS PRIS
 *
 * 1. LE RETOUR EST OBLIGATOIRE, PAS DÉCORATIF. Une copie ne produit aucun
 *    changement visible : sans accusé de réception, on ne sait pas si le clic a
 *    porté, et on reclique. L'état « Copié » tient 2 secondes, et il est
 *    annoncé aux lecteurs d'écran par une région `aria-live` — la seule façon
 *    de rendre l'événement perceptible sans le voir.
 *
 * 2. `navigator.clipboard` N'EST PAS TOUJOURS LÀ. Il exige un contexte sécurisé
 *    (https ou localhost) et une permission. Le repli par `document.execCommand`
 *    est déprécié mais fonctionne partout, et un bouton qui ne fait rien en
 *    silence est pire qu'un bouton qui emploie une API dépréciée. Si les deux
 *    échouent, on le dit : « Copie impossible ».
 *
 * 3. LA MINUTERIE EST NETTOYÉE AU DÉMONTAGE. Sans ça, revenir en arrière
 *    pendant les 2 secondes appelle `setState` sur un composant démonté.
 */

type Etat = 'repos' | 'copie' | 'echec';

export function BoutonCopier({
  texte,
  libelle = 'Copier',
  libelleCopie = 'Copié',
  apparence = 'contour',
  taille = 'sm',
  className,
}: {
  /** La valeur exacte qui part dans le presse-papier. */
  texte: string;
  libelle?: string;
  libelleCopie?: string;
  apparence?: ApparenceBouton;
  taille?: TailleBouton;
  className?: string;
}) {
  const [etat, setEtat] = useState<Etat>('repos');
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (minuterie.current) clearTimeout(minuterie.current);
    },
    [],
  );

  const copier = useCallback(async () => {
    let reussi = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texte);
        reussi = true;
      }
    } catch {
      reussi = false;
    }
    if (!reussi) {
      // Repli : déprécié, mais disponible hors contexte sécurisé.
      try {
        const zone = document.createElement('textarea');
        zone.value = texte;
        zone.setAttribute('readonly', '');
        zone.style.position = 'fixed';
        zone.style.opacity = '0';
        document.body.appendChild(zone);
        zone.select();
        reussi = document.execCommand('copy');
        document.body.removeChild(zone);
      } catch {
        reussi = false;
      }
    }
    setEtat(reussi ? 'copie' : 'echec');
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => setEtat('repos'), 2000);
  }, [texte]);

  const libelleCourant =
    etat === 'copie' ? libelleCopie : etat === 'echec' ? 'Copie impossible' : libelle;

  return (
    <>
      <Bouton
        type="button"
        apparence={apparence}
        taille={taille}
        onClick={copier}
        iconeAvant={<Icone nom={etat === 'copie' ? 'icon-check' : 'icon-copy'} />}
        className={cn('w-fit', className)}
      >
        {libelleCourant}
      </Bouton>
      {/* Montée en permanence : une région vivante insérée AVEC son contenu
          n'annonce rien — c'est la leçon déjà écrite dans `Toast.tsx`. */}
      <span role="status" aria-live="polite" className="sr-only">
        {etat === 'copie' ? `${libelleCopie} dans le presse-papier` : ''}
        {etat === 'echec' ? 'La copie a échoué' : ''}
      </span>
    </>
  );
}

/**
 * Une ligne « libellé : valeur » avec sa propre copie.
 *
 * Le bouton n'apparaît que si la valeur existe : un bouton « Copier » à côté
 * d'un tiret cadratin est une promesse vide. Il reste atteignable au clavier en
 * permanence — le révéler au seul survol le rendrait inaccessible à qui ne
 * tient pas de souris, piège déjà relevé sur le tri de `Tableau`.
 */
export function LigneCopiable({
  libelle,
  valeur,
  className,
}: {
  libelle: string;
  valeur: string | null | undefined;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <p className="t-caption text-[var(--encre-500)]">{libelle}</p>
      <div className="flex items-start justify-between gap-2">
        <p className="t-body min-w-0 break-words text-black">{valeur || '—'}</p>
        {valeur ? (
          <BoutonCopier
            texte={valeur}
            libelle=""
            libelleCopie=""
            taille="sm"
            className="shrink-0"
          />
        ) : null}
      </div>
    </div>
  );
}
