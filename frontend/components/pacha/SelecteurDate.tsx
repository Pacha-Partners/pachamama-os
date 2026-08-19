'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { Icone } from './Icone';
import { cn } from '@/lib/utils';

/**
 * SelecteurDate — un calendrier Material rhabillé en Pachamama.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ARBITRAGE CENTRAL : LA COQUE EST À NOUS, LES ENTRAILLES ÉTAIENT À MATERIAL
 * ════════════════════════════════════════════════════════════════════════════
 * Le composant occupe les 4 411 premières lignes du Figma et il est hybride. La
 * coque est indiscutablement Pachamama : 250×408, `border: 2px solid #000000`,
 * `border-radius: 16px` (Figma.md:1-18) — la bordure noire épaisse et le rayon 16
 * du régime « accroche ».
 *
 * Tout l'intérieur est du Material Design déposé tel quel :
 *   · `font-family: 'Roboto'` sur CHAQUE texte — Figma.md:68, 91, 271, 356, 591,
 *     637, 4539, 4615… ;
 *   · les jetons `M3/label/large` (Figma.md:272, 539, 4539, 4615) ;
 *   · les calques `state-layer` (12 occurrences : Figma.md:159, 246, 389, 483,
 *     953, 1031…), qui sont l'implémentation Material des états de survol ;
 *   · les gabarits 48×48 / 40×40 à `border-radius: 100px` de la « touch target »
 *     Material, incompatibles avec la grille : sept colonnes de 40px font 280px
 *     dans une rangée que le Figma déclare à 226px (Figma.md:556) ;
 *   · les couleurs Material `#49454F` (Figma.md:77, 199) et `#2D2B31`
 *     (Figma.md:99, 601) ;
 *   · la semaine qui commence le DIMANCHE (Figma.md:565 `Sunday` en `order: 0`),
 *     convention américaine.
 *
 * Autrement dit : le designer a posé un calendrier Material dans un cadre
 * Pachamama sans le rhabiller. app.css avait déjà tranché la question en amont —
 * « `Roboto`, `M3/*`, `state-layer`, `WF Base/*` et les rayons sous-pixel viennent
 * d'un sélecteur de date Material Design importé. → écartés ». On applique cette
 * décision ici.
 *
 * CE QU'ON GARDE DU FIGMA : toute la géométrie et toute la structure.
 *   coque             250 de large, bordure noire 2px, rayon 16   (Figma.md:12-18)
 *   en-tête           hauteur 100, padding 16/12/12/24, gap 8,
 *                     filet bas 1px #E7E6EB                       (Figma.md:29-35)
 *   libellé + date    colonne, gap 16, largeur 158, hauteur 72    (Figma.md:46-55)
 *   bouton d'édition  40×40 rond, icône 24                        (Figma.md:140-184)
 *   rangée de mois    hauteur 56, padding 4/12/4/16               (Figma.md:208-214)
 *   bouton mois/année 119×40 rond, libellé + chevron 18           (Figma.md:246-300)
 *   flèches           deux cibles 40×40 rondes, icônes 24         (Figma.md:368-412)
 *   grille            padding 0 12px, rangées de 226×32, 6 semaines
 *                                                        (Figma.md:531-556, 887→4215)
 *   actions           hauteur 60, padding 8/12/12, alignées à droite
 *                                                              (Figma.md:4416-4423)
 *
 * CE QU'ON RHABILLE : la typographie et les couleurs, avec nos classes et nos
 * jetons. `Supporting text` (Roboto 500 12/20 #49454F) devient `t-caption-hl` en
 * `--encre-600` ; `Week day, Day` (Roboto 400 24/40 #2D2B31) devient `t-h2` ;
 * `Date` (Roboto 400 12/24 #2D2B31) devient `t-caption` en noir ; `M3/label/large`
 * devient `t-body-hl`. Les 40×40 de la grille deviennent des 32×32 ronds, seule
 * façon de tenir les 226px de rangée que le Figma exige.
 *
 * CE QU'ON N'A PAS PU REPRODUIRE, PARCE QUE LE FIGMA NE LE CONTIENT PAS :
 *   · aucun état de jour SÉLECTIONNÉ. Les 40 cellules de la grille sont toutes en
 *     `Default date` ou `Blank date` (Figma.md:911, 1067, 1159…) — pas une seule
 *     n'est marquée. Le fond retenu est `--violet-500`, par analogie avec l'état
 *     sélectionné du menu (Figma.md:35076), avec du texte NOIR : c'est le seul
 *     appariement qui passe AA (4,82:1 contre 4,36:1 pour du blanc). Choix assumé.
 *   · aucun état « aujourd'hui », aucun état désactivé, aucun survol de jour.
 *   · aucun libellé de texte : Figma nomme les calques `Supporting text` et
 *     `label-text`, jamais leur contenu. « Sélectionner une date », « Annuler »,
 *     « OK » sont déduits de Material et des largeurs relevées (44px et 19px pour
 *     les deux boutons d'action, Figma.md:4536 et 4612). Copie à valider.
 *   · le bouton « Clear » est `display: none` dans le Figma (Figma.md:4452) : il
 *     n'est pas rendu. L'effacement passe par la croix de `LigneDate`, elle,
 *     dessinée (Figma.md:8541).
 *   · la hauteur 408 n'est pas forcée : 100 + 56 + 192 + 60 = 408, mais le Figma
 *     déclare une grille de 192px tout en y plaçant sept rangées de 32
 *     (Figma.md:536 contre 887→4215, soit 224). Sa propre cote est incohérente ;
 *     on laisse la hauteur suivre le contenu, ce qui est de toute façon nécessaire
 *     pour les mois qui débordent sur six semaines.
 *
 * ACCESSIBILITÉ. `@base-ui/react` v1.7.0 n'expose NI calendrier NI sélecteur de
 * date (vérifié dans ses exports : accordion… avatar, separator, tooltip, mais
 * rien de temporel). Le clavier est donc écrit ici, d'après le patron « date
 * grid » de l'ARIA APG : flèches pour se déplacer d'un jour et d'une semaine,
 * Origine/Fin aux bornes de la semaine, PagePréc/PageSuiv de mois en mois
 * (majuscule enfoncée : d'année en année), Entrée ou Espace pour choisir, Échap
 * pour fermer. Le curseur est roulant — un seul jour est dans l'ordre de
 * tabulation, les flèches font le reste, sinon il faudrait 42 tabulations pour
 * traverser un mois. Les jours indisponibles portent `aria-disabled` et RESTENT
 * focalisables : un jour retiré de l'ordre de tabulation devient un trou dans
 * lequel la navigation se casse.
 */

// Libellés français. Le Figma étant en anglais (Sunday…Saturday), ils ne sont pas
// « recopiés » mais traduits : un calendrier français commence le lundi, et
// afficher « Sunday » dans une interface française serait une faute.
const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

const JOURS_ABREGES = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'] as const;
const JOURS_COMPLETS = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
] as const;

/* ── Outils de date. Volontairement sans dépendance : on manipule des jours, pas
   des instants, et une bibliothèque de dates entière pour six fonctions serait
   payée par tous les écrans. ─────────────────────────────────────────────── */

function auJour(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function memeJour(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function ajouterJours(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function ajouterMois(d: Date, n: number): Date {
  // On borne le jour pour que « 31 mars + 1 mois » donne le 30 avril et non le
  // 1er mai — le débordement silencieux de `Date` est un piège classique.
  const cible = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const dernier = new Date(cible.getFullYear(), cible.getMonth() + 1, 0).getDate();
  return new Date(cible.getFullYear(), cible.getMonth(), Math.min(d.getDate(), dernier));
}

/** Index de la colonne (0 = lundi) du premier jour du mois. */
function decalageLundi(annee: number, mois: number): number {
  return (new Date(annee, mois, 1).getDay() + 6) % 7;
}

function cleJour(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** jj/mm/aaaa — le format de `Date : 12/12/2012` (Figma.md:8514). */
export function formaterDateFr(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(
    2,
    '0',
  )}/${d.getFullYear()}`;
}

function analyserDateFr(texte: string): Date | null {
  const m = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})\s*$/.exec(texte);
  if (!m) return null;
  const [, j, mo, a] = m;
  const jour = Number(j);
  const mois = Number(mo) - 1;
  const annee = Number(a);
  const d = new Date(annee, mois, jour);
  // Rejette « 31/02/2024 », que `Date` accepterait en glissant au 2 mars.
  if (d.getFullYear() !== annee || d.getMonth() !== mois || d.getDate() !== jour) return null;
  return d;
}

/* ── Le panneau ──────────────────────────────────────────────────────────── */

export function SelecteurDate({
  valeur,
  onChangement,
  onFermer,
  libelle = 'Sélectionner une date',
  dateMin,
  dateMax,
  jourDesactive,
  className,
}: {
  valeur?: Date | null;
  onChangement?: (date: Date | null) => void;
  /** Appelé sur Échap et sur « Annuler ». */
  onFermer?: () => void;
  /** Le `Supporting text` de l'en-tête (Figma.md:63). Contenu absent de l'export. */
  libelle?: string;
  dateMin?: Date;
  dateMax?: Date;
  /** Règle métier libre : jours fériés, week-ends, créneaux pris… */
  jourDesactive?: (date: Date) => boolean;
  className?: string;
}) {
  const idTitre = useId();
  const aujourdhui = useMemo(() => auJour(new Date()), []);
  const ancre = valeur ?? aujourdhui;

  const [moisAffiche, setMoisAffiche] = useState(
    () => new Date(ancre.getFullYear(), ancre.getMonth(), 1),
  );
  const [jourFocus, setJourFocus] = useState(() => auJour(ancre));
  const [modeAnnee, setModeAnnee] = useState(false);
  const [saisieLibre, setSaisieLibre] = useState(false);
  const [texteSaisie, setTexteSaisie] = useState(() => (valeur ? formaterDateFr(valeur) : ''));
  const [erreurSaisie, setErreurSaisie] = useState<string | null>(null);

  const grilleRef = useRef<HTMLDivElement | null>(null);
  const doitFocaliser = useRef(false);

  // Le curseur roulant ne vaut que si le focus SUIT le curseur. On ne le déplace
  // qu'après une navigation au clavier, jamais au montage : voler le focus à
  // l'ouverture déplacerait la lecture d'écran sans que l'utilisateur l'ait
  // demandé.
  useEffect(() => {
    if (!doitFocaliser.current) return;
    doitFocaliser.current = false;
    grilleRef.current
      ?.querySelector<HTMLButtonElement>(`[data-jour="${cleJour(jourFocus)}"]`)
      ?.focus();
  }, [jourFocus, moisAffiche]);

  const estIndisponible = useCallback(
    (d: Date): boolean => {
      if (dateMin && d < auJour(dateMin)) return true;
      if (dateMax && d > auJour(dateMax)) return true;
      return jourDesactive?.(d) ?? false;
    },
    [dateMin, dateMax, jourDesactive],
  );

  const deplacer = useCallback((cible: Date) => {
    doitFocaliser.current = true;
    setJourFocus(cible);
    setMoisAffiche(new Date(cible.getFullYear(), cible.getMonth(), 1));
  }, []);

  const choisir = useCallback(
    (d: Date) => {
      if (estIndisponible(d)) return;
      onChangement?.(d);
      setTexteSaisie(formaterDateFr(d));
    },
    [estIndisponible, onChangement],
  );

  const surToucheGrille = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const t = e.key;
    let cible: Date | null = null;
    if (t === 'ArrowLeft') cible = ajouterJours(jourFocus, -1);
    else if (t === 'ArrowRight') cible = ajouterJours(jourFocus, 1);
    else if (t === 'ArrowUp') cible = ajouterJours(jourFocus, -7);
    else if (t === 'ArrowDown') cible = ajouterJours(jourFocus, 7);
    else if (t === 'Home') cible = ajouterJours(jourFocus, -((jourFocus.getDay() + 6) % 7));
    else if (t === 'End') cible = ajouterJours(jourFocus, 6 - ((jourFocus.getDay() + 6) % 7));
    else if (t === 'PageUp') cible = ajouterMois(jourFocus, e.shiftKey ? -12 : -1);
    else if (t === 'PageDown') cible = ajouterMois(jourFocus, e.shiftKey ? 12 : 1);
    else if (t === 'Enter' || t === ' ') {
      e.preventDefault();
      choisir(jourFocus);
      return;
    } else return;

    e.preventDefault();
    deplacer(cible);
  };

  const annee = moisAffiche.getFullYear();
  const mois = moisAffiche.getMonth();
  const nbJours = new Date(annee, mois + 1, 0).getDate();
  const decalage = decalageLundi(annee, mois);

  // Six rangées de sept, toujours : une grille dont la hauteur change d'un mois à
  // l'autre fait sauter tout ce qui est en dessous.
  const semaines: (Date | null)[][] = useMemo(() => {
    const cases: (Date | null)[] = [
      ...Array.from({ length: decalage }, () => null),
      ...Array.from({ length: nbJours }, (_, i) => new Date(annee, mois, i + 1)),
    ];
    while (cases.length < 42) cases.push(null);
    return Array.from({ length: 6 }, (_, i) => cases.slice(i * 7, i * 7 + 7));
  }, [annee, mois, nbJours, decalage]);

  const annees = useMemo(() => {
    // Aucune plage dans le Figma. Par défaut ±10 ans autour du mois affiché, ce
    // qui couvre les dates de candidature passées et les prochaines étapes.
    const debut = dateMin ? dateMin.getFullYear() : annee - 10;
    const fin = dateMax ? dateMax.getFullYear() : annee + 10;
    return Array.from({ length: Math.max(1, fin - debut + 1) }, (_, i) => debut + i);
  }, [annee, dateMin, dateMax]);

  const titreEnTete = valeur
    ? new Intl.DateTimeFormat('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(valeur)
    : // `N/A` est le vocabulaire du Figma lui-même (Figma.md:8475).
      'N/A';

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={idTitre}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onFermer?.();
        }
      }}
      className={cn(
        // Figma.md:12-18 — 250 de large, blanc, bordure noire 2px, rayon 16.
        'flex w-[250px] flex-col rounded-[var(--r-lg)] border-2 border-black bg-white',
        className,
      )}
    >
      {/* ── En-tête ─────────────────────────────────── Figma.md:20-42 ── */}
      <div className="flex items-end gap-2 border-b border-[var(--encre-100)] pb-3 pl-6 pr-3 pt-4">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Figma.md:63 — `Supporting text`, rhabillé en t-caption-hl / --encre-600
              (5,58:1 sur blanc, contre 2,17 si on avait pris --encre-300). */}
          <p className="t-caption-hl text-[var(--encre-600)]">{libelle}</p>
          {saisieLibre ? (
            <>
              <label htmlFor={`${idTitre}-saisie`} className="sr-only">
                Date au format jour/mois/année
              </label>
              <input
                id={`${idTitre}-saisie`}
                value={texteSaisie}
                inputMode="numeric"
                placeholder="jj/mm/aaaa"
                aria-invalid={erreurSaisie ? true : undefined}
                aria-describedby={erreurSaisie ? `${idTitre}-err` : undefined}
                onChange={(e) => {
                  setTexteSaisie(e.currentTarget.value);
                  setErreurSaisie(null);
                }}
                onBlur={() => {
                  if (texteSaisie.trim() === '') {
                    onChangement?.(null);
                    return;
                  }
                  const d = analyserDateFr(texteSaisie);
                  if (!d) {
                    setErreurSaisie('Date invalide. Format attendu : jj/mm/aaaa.');
                    return;
                  }
                  if (estIndisponible(d)) {
                    setErreurSaisie('Cette date n’est pas disponible.');
                    return;
                  }
                  onChangement?.(d);
                  deplacer(d);
                }}
                className="t-body h-[var(--h-champ)] w-full rounded-[var(--r-md)] border border-black bg-white px-2 text-black"
              />
              {erreurSaisie && (
                <p id={`${idTitre}-err`} className="t-caption text-[#e8553a]">
                  {erreurSaisie}
                </p>
              )}
            </>
          ) : (
            // Figma.md:86 — `Week day, Day`, rhabillé en t-h2 (le 24px du DS).
            <p id={idTitre} className="t-h2 truncate">
              {titreEnTete}
            </p>
          )}
        </div>
        {/* Figma.md:140-184 — cible 40×40 ronde, icône 24 (`mode_edit_24px`). */}
        <button
          type="button"
          aria-label={saisieLibre ? 'Choisir dans le calendrier' : 'Saisir la date au clavier'}
          aria-pressed={saisieLibre}
          onClick={() => {
            setErreurSaisie(null);
            setSaisieLibre((v) => !v);
          }}
          className="grid size-10 shrink-0 place-items-center rounded-[var(--r-full)] text-black hover:bg-[var(--violet-100)]"
        >
          <Icone nom="icon-edit-2" className="size-6" />
        </button>
      </div>

      {/* ── Rangée mois / année ─────────────────────── Figma.md:202-214 ── */}
      <div className="flex h-14 items-center justify-between py-1 pl-4 pr-3">
        {/* Figma.md:246-300 — pastille 119×40, libellé + chevron 18. Le Figma ne
            dit pas ce que ce bouton ouvre ; Material y ouvre un choix d'année. */}
        <button
          type="button"
          aria-expanded={modeAnnee}
          onClick={() => setModeAnnee((v) => !v)}
          className="t-body-hl flex h-10 items-center gap-2 rounded-[var(--r-full)] px-2 text-black hover:bg-[var(--violet-100)]"
        >
          <span>
            {MOIS[mois]} {annee}
          </span>
          <Icone nom={modeAnnee ? 'icon-chevron-up' : 'icon-chevron-down'} className="size-[18px]" />
        </button>

        {/* Figma.md:319-330 — deux cibles 40×40 (`navigate_before` / `navigate_next`). */}
        <div className="flex items-center">
          <button
            type="button"
            aria-label="Mois précédent"
            onClick={() => setMoisAffiche(ajouterMois(moisAffiche, -1))}
            className="grid size-10 place-items-center rounded-[var(--r-full)] text-black hover:bg-[var(--violet-100)]"
          >
            <Icone nom="icon-chevron-left" className="size-6" />
          </button>
          <button
            type="button"
            aria-label="Mois suivant"
            onClick={() => setMoisAffiche(ajouterMois(moisAffiche, 1))}
            className="grid size-10 place-items-center rounded-[var(--r-full)] text-black hover:bg-[var(--violet-100)]"
          >
            <Icone nom="icon-chevron-right" className="size-6" />
          </button>
        </div>
      </div>

      {/* ── Grille, ou choix d'année ─────────────── Figma.md:526-4408 ── */}
      {modeAnnee ? (
        <ul
          aria-label="Choisir une année"
          className="max-h-[192px] overflow-y-auto px-3" // 192 = la hauteur de grille du Figma
        >
          {annees.map((a) => {
            const choisie = a === annee;
            return (
              <li key={a}>
                <button
                  type="button"
                  aria-pressed={choisie}
                  onClick={() => {
                    setMoisAffiche(new Date(a, mois, 1));
                    setModeAnnee(false);
                  }}
                  className={cn(
                    't-body-hl flex h-8 w-full items-center justify-center rounded-[var(--r-full)]',
                    choisie
                      ? 'bg-[var(--violet-500)] text-black'
                      : 'text-black hover:bg-[var(--violet-100)]',
                  )}
                >
                  {a}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div
          ref={grilleRef}
          role="grid"
          aria-label={`${MOIS[mois]} ${annee}`}
          onKeyDown={surToucheGrille}
          className="flex flex-col px-3" // Figma.md:531 — padding 0px 12px
        >
          {/* Figma.md:545-556 — rangée d'en-tête 226×32. */}
          <div role="row" className="flex">
            {JOURS_ABREGES.map((abrege, i) => (
              <span
                key={abrege}
                role="columnheader"
                aria-label={JOURS_COMPLETS[i]}
                className="t-caption flex h-8 flex-1 items-center justify-center text-[var(--encre-600)]"
              >
                <abbr title={JOURS_COMPLETS[i]} className="no-underline">
                  {abrege}
                </abbr>
              </span>
            ))}
          </div>

          {semaines.map((semaine, i) => (
            // L'index EST la semaine du mois : deux rangées ne peuvent pas
            // permuter, la clé est donc stable.
            <div role="row" key={i} className="flex">
              {semaine.map((jour, j) => {
                if (!jour) {
                  // Figma.md:973 — `Empty container` : la case des jours hors mois.
                  // Rendue vide et non focalisable, mais présente pour que la
                  // grille garde ses sept colonnes.
                  return (
                    <span
                      // Position fixe dans la rangée : clé stable.
                      key={`vide-${j}`}
                      role="gridcell"
                      aria-disabled="true"
                      className="h-8 flex-1"
                    />
                  );
                }
                const selectionne = memeJour(jour, valeur);
                const estAujourdhui = memeJour(jour, aujourdhui);
                const indisponible = estIndisponible(jour);
                return (
                  <span key={cleJour(jour)} className="flex h-8 flex-1 items-center justify-center">
                    <button
                      type="button"
                      role="gridcell"
                      data-jour={cleJour(jour)}
                      tabIndex={memeJour(jour, jourFocus) ? 0 : -1}
                      aria-selected={selectionne}
                      aria-disabled={indisponible || undefined}
                      aria-current={estAujourdhui ? 'date' : undefined}
                      onClick={() => {
                        deplacer(jour);
                        choisir(jour);
                      }}
                      className={cn(
                        't-caption grid size-8 place-items-center rounded-[var(--r-full)]',
                        // Aucun état sélectionné dans le Figma : violet-500 par
                        // analogie avec le menu, texte NOIR (4,82:1, seul
                        // appariement qui passe AA sur cette teinte).
                        selectionne && 'bg-[var(--violet-500)] font-medium text-black',
                        // « Aujourd'hui » n'existe pas non plus : filet noir, qui
                        // reste lisible sous le fond sélectionné.
                        !selectionne && estAujourdhui && 'ring-1 ring-inset ring-black',
                        indisponible
                          ? 'cursor-not-allowed text-[var(--encre-300)] line-through'
                          : !selectionne && 'text-black hover:bg-[var(--violet-100)]',
                      )}
                    >
                      {jour.getDate()}
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── Actions ─────────────────────────────── Figma.md:4411-4423 ── */}
      <div className="flex items-start justify-end gap-2 px-3 pb-3 pt-2">
        {/* Figma.md:4484 et 4560 — deux boutons texte, rayon 100px, libellé en
            `#8657FF`. Sur blanc, violet-500 mesure 4,36:1 : ces deux libellés
            échouent AA, et la règle « la couleur d'action est le noir » les vise
            aussi. On applique le Figma et on le signale. */}
        <button
          type="button"
          onClick={onFermer}
          className="t-body-hl h-10 rounded-[var(--r-full)] px-3 text-[var(--violet-500)] hover:bg-[var(--violet-050)]"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() => {
            choisir(jourFocus);
            onFermer?.();
          }}
          className="t-body-hl h-10 rounded-[var(--r-full)] px-3 text-[var(--violet-500)] hover:bg-[var(--violet-050)]"
        >
          OK
        </button>
      </div>
    </div>
  );
}

/* ── Le déclencheur ─────────────────────────────────────────────────────── */

/**
 * LigneDate — `Date picker line` (Figma.md:8444), la ligne qui ouvre le panneau.
 *
 * Quatre variantes relevées, sur deux axes croisés en un seul :
 *   `Property 1=Default`     vide, sans fond               (Figma.md:8457)
 *   `Property 1=Hover`       vide, fond #E8EAED            (Figma.md:8568)
 *   `Property 1=Fill`        remplie + croix 16×16         (Figma.md:8496, 8541)
 *   `Property 1=Fill hover`  remplie, fond #E8EAED         (Figma.md:8608)
 *
 * Cotes : ligne, `padding: 4px`, `gap: 10px`, hauteur 24, rayon 4
 * (Figma.md:8459-8474). Le survol est un état CSS, pas une prop.
 *
 * ÉCART ASSUMÉ SUR LA COULEUR. Le Figma met le texte en `#A8B1BD`
 * (`--encre-300`) dans les QUATRE variantes — y compris quand la ligne affiche
 * une vraie date (Figma.md:8532). `--encre-300` est le gris du texte désactivé :
 * il mesure 2,17:1 sur blanc. Afficher une valeur réelle dans le gris du
 * désactivé, c'est faire passer une donnée pour une absence de donnée. On garde
 * ce gris pour l'état VIDE, où il a le sens d'un texte de substitution, et on
 * passe la valeur en noir — ce que la règle « le texte est toujours noir » exige
 * de toute façon. Les deux occurrences sont consignées.
 */
export function LigneDate({
  valeur,
  onOuvrir,
  onEffacer,
  libelle = 'Date',
  className,
}: {
  valeur?: Date | null;
  onOuvrir?: () => void;
  onEffacer?: () => void;
  /** Le mot devant les deux-points. « Date » dans le Figma (Figma.md:8475). */
  libelle?: string;
  className?: string;
}) {
  const texte = valeur ? formaterDateFr(valeur) : 'N/A';
  return (
    <span
      className={cn(
        'group flex min-h-6 items-center gap-2.5 rounded-[var(--r-xs)] p-1', // Figma.md:8461
        className,
      )}
    >
      <button
        type="button"
        onClick={onOuvrir}
        className={cn(
          't-caption-hl flex-1 truncate rounded-[var(--r-xs)] px-1 text-left',
          'hover:bg-[#e8eaed]', // Figma.md:8586 — #E8EAED, sans jeton
          valeur ? 'text-black' : 'text-[var(--encre-300)]', // Figma.md:8532 / 8500
        )}
      >
        {libelle} : {texte}
      </button>
      {valeur && onEffacer && (
        // Figma.md:8541 — `Close` 16×16, présente uniquement dans les variantes
        // remplies.
        <button
          type="button"
          onClick={onEffacer}
          aria-label={`Effacer ${libelle.toLowerCase()}`}
          className="grid size-4 shrink-0 place-items-center rounded-[var(--r-xs)] text-black"
        >
          <Icone nom="icon-x" className="size-4" />
        </button>
      )}
    </span>
  );
}

/**
 * MentionDate — `Date` / `Type of date={Application date, Next step}`
 * (Figma.md:47782 et 47844).
 *
 * Une mention en lecture seule, sur une carte ou une ligne. Le type de date n'est
 * pas porté par une couleur ni par un libellé mais par un EMOJI de préfixe :
 * `🗓` pour la prochaine étape (Figma.md:47797) et `📥` pour la date de
 * candidature (Figma.md:47876). L'emoji étant la seule marque du type, il ne peut
 * pas être seulement décoratif : le type est donc aussi écrit, en texte, dans un
 * libellé accessible — sans quoi l'information n'existerait que pour qui voit
 * l'emoji.
 *
 * `🚨` (Figma.md:47825) signale l'urgence. Même raisonnement : `urgent` ajoute la
 * mention « urgent » au libellé accessible.
 *
 * Cotes : ligne, `gap: 4px`, hauteur 16, texte `Caption/Regular` en `#A8B1BD`
 * (Figma.md:47810). Comme pour `LigneDate`, la valeur passe en noir.
 */
const typesDeDate = {
  'prochaine-etape': { emoji: '🗓', libelle: 'Prochaine étape' }, // Figma.md:47797
  candidature: { emoji: '📥', libelle: 'Date de candidature' }, // Figma.md:47876
} as const;

export function MentionDate({
  type,
  date,
  urgent,
  className,
}: {
  type: keyof typeof typesDeDate;
  date: Date | null;
  urgent?: boolean;
  className?: string;
}) {
  const { emoji, libelle } = typesDeDate[type];
  const texte = date ? formaterDateFr(date) : 'N/A';
  return (
    <span className={cn('t-caption inline-flex items-center gap-1', className)}>
      <span aria-hidden="true">{emoji}</span>
      <span className="sr-only">
        {libelle}
        {urgent ? ', urgent' : ''} :{' '}
      </span>
      <span className={date ? 'text-black' : 'text-[var(--encre-300)]'}>{texte}</span>
      {urgent && (
        <span aria-hidden="true" className="text-[12px] leading-[14px]">
          🚨
        </span>
      )}
    </span>
  );
}
