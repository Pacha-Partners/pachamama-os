'use client';

import { useId, useRef, useState } from 'react';

import { Bouton } from './Bouton';
import { Carte } from './Carte';
import { Case } from './Cases';
import { Champ } from './Champ';
import { ChampNombre } from './ChampNombre';
import { DialogueConfirmation } from './Dialogue';
import { EtatVide } from './EtatVide';
import { Icone } from './Icone';
import { Selecteur } from './Selecteur';
import { ZoneTexte } from './ZoneTexte';
import { cn } from '@/lib/utils';

/**
 * FriseParcours — les expériences professionnelles, en frise ÉDITABLE.
 *
 * ⚠ CE N'EST PAS `FriseActivite`. Les deux dessinent un rail vertical avec des
 * pastilles, et c'est là que la ressemblance s'arrête :
 *
 *   FriseActivite   des ÉVÉNEMENTS, en lecture seule, dans l'ordre reçu
 *   FriseParcours   des ENTRÉES saisies par la personne, qu'on ajoute,
 *                   modifie, retire, et que le composant TRIE lui-même
 *
 * La grammaire visuelle est délibérément la même — rail d'un pixel en
 * `--encre-100`, pastille de 23px — pour qu'un talent qui voit les deux sur son
 * espace comprenne qu'il regarde deux fois « une histoire dans le temps ».
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI ELLE TRIE, ALORS QUE `FriseActivite` REFUSE DE LE FAIRE
 * ─────────────────────────────────────────────────────────────────────────
 * `FriseActivite` reçoit le résultat d'une requête paginée : trier côté client
 * mentirait sur ce qu'elle montre. Ici il n'y a aucune requête —
 * `core.fiche_talent_poste` compte **0 ligne et n'a aucune source** : cette
 * frise est une saisie neuve, pas une reprise. Les entrées arrivent dans
 * l'ordre où on les a tapées, qui n'est jamais le bon. Le composant les range
 * donc **de la plus récente à la plus ancienne**, comme un CV : l'expérience en
 * cours d'abord. C'est un ordre d'AFFICHAGE ; le tableau rendu par
 * `onChangement` garde l'ordre de saisie, et c'est à l'écran de décider ce
 * qu'il enregistre.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA PÉRIODE : ANNÉE OBLIGATOIRE, MOIS FACULTATIF
 * ─────────────────────────────────────────────────────────────────────────
 * Personne ne se souvient du JOUR où il a pris un poste il y a huit ans —
 * `SelecteurDate` serait une fausse précision, et un texte libre (« 2021 »,
 * « mars 21 », « printemps 2022 ») rendrait le tri impossible, donc la promesse
 * d'ordre chronologique intenable. Le compromis tenu ici : l'année est un
 * nombre exigé, le mois un choix facultatif. Assez pour trier, assez pour
 * distinguer deux missions de six mois, jamais plus précis que la mémoire.
 *
 * Une fin absente ne veut pas dire « inconnue » : elle veut dire **en poste**.
 * C'est une case à cocher, pas un champ vide qu'on interprète — l'interprétation
 * silencieuse d'un vide est la façon la plus sûre de se tromper.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ÉDITION EST EN PLACE, ET UNE SEULE À LA FOIS
 * ─────────────────────────────────────────────────────────────────────────
 * Pas de modale : un formulaire de six champs tient dans la frise, et ouvrir un
 * dialogue par-dessus une page qui est elle-même un formulaire empilerait deux
 * contextes de saisie. Une seule entrée est ouverte à la fois — deux
 * brouillons simultanés, ce sont deux « Enregistrer » et une question sans
 * réponse sur celui qui gagne.
 *
 * Le brouillon vit DANS ce composant et n'en sort qu'à la validation : tant
 * qu'on n'a pas confirmé, `onChangement` n'est pas appelé, donc rien ne remonte
 * et rien ne s'enregistre. « Annuler » rend l'entrée telle qu'elle était.
 *
 * Le retrait passe par une confirmation (`DialogueConfirmation`) : une
 * expérience se retape en deux minutes, mais on ne s'aperçoit de sa disparition
 * qu'une semaine plus tard, et il n'y a pas d'annulation.
 */

export type EntreeParcours = {
  /** Identifiant stable. Sert de clé React et d'ancre à l'édition. */
  cle: string;
  employeur: string;
  intitule: string;
  anneeDebut: number;
  /** 1 à 12. Absent = l'année seule. */
  moisDebut?: number | null;
  /** Absente ET `enPoste` faux = période ouverte non déclarée : à éviter. */
  anneeFin?: number | null;
  moisFin?: number | null;
  /** La personne occupe encore ce poste. Prime sur `anneeFin`. */
  enPoste?: boolean;
  description?: string;
};

export type ProprietesFriseParcours = {
  entrees: readonly EntreeParcours[];
  /**
   * Appelé à chaque validation, ajout ou retrait — jamais pendant la saisie.
   * Reçoit le tableau complet, dans l'ordre de saisie et non l'ordre affiché.
   */
  onChangement: (entrees: EntreeParcours[]) => void;
  /** Passe la frise en lecture : plus de boutons, plus de formulaire. */
  lectureSeule?: boolean;
  /** Année plancher des sélecteurs. Défaut : 1970. */
  anneeMin?: number;
  className?: string;
};

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

const OPTIONS_MOIS = MOIS.map((libelle, i) => ({ valeur: String(i + 1), libelle }));

/**
 * « mars 2021 – en poste », « 2019 – 2021 ».
 * Le tiret est un demi-cadratin, pas un trait d'union : c'est le signe d'un
 * intervalle. Exporté, parce qu'un récapitulatif ailleurs devra écrire la même
 * chose, et deux formats pour une même période se remarquent.
 */
export function formaterPeriode(entree: EntreeParcours): string {
  const borne = (annee: number, mois?: number | null) =>
    mois && mois >= 1 && mois <= 12 ? `${MOIS[mois - 1]} ${annee}` : String(annee);

  const debut = borne(entree.anneeDebut, entree.moisDebut);
  if (entree.enPoste) return `${debut} – en poste`;
  if (entree.anneeFin == null) return debut;
  return `${debut} – ${borne(entree.anneeFin, entree.moisFin)}`;
}

/**
 * Le rang chronologique d'une entrée, en mois depuis l'an zéro.
 * Une entrée en cours est projetée à l'infini : elle passe devant tout le reste,
 * ce qui est exactement sa place sur un CV.
 */
function rang(entree: EntreeParcours): number {
  if (entree.enPoste) return Number.POSITIVE_INFINITY;
  const annee = entree.anneeFin ?? entree.anneeDebut;
  const mois = (entree.anneeFin != null ? entree.moisFin : entree.moisDebut) ?? 12;
  return annee * 12 + mois;
}

/** Un brouillon : les mêmes champs, en chaînes, parce qu'un champ vide n'est pas 0. */
type Brouillon = {
  cle: string;
  employeur: string;
  intitule: string;
  anneeDebut: number | null;
  moisDebut: string | null;
  anneeFin: number | null;
  moisFin: string | null;
  enPoste: boolean;
  description: string;
};

function versBrouillon(e: EntreeParcours): Brouillon {
  return {
    cle: e.cle,
    employeur: e.employeur,
    intitule: e.intitule,
    anneeDebut: e.anneeDebut,
    moisDebut: e.moisDebut ? String(e.moisDebut) : null,
    anneeFin: e.anneeFin ?? null,
    moisFin: e.moisFin ? String(e.moisFin) : null,
    enPoste: Boolean(e.enPoste),
    description: e.description ?? '',
  };
}

function brouillonVide(cle: string): Brouillon {
  return {
    cle,
    employeur: '',
    intitule: '',
    anneeDebut: null,
    moisDebut: null,
    anneeFin: null,
    moisFin: null,
    enPoste: false,
    description: '',
  };
}

/**
 * Les trois règles de validité, écrites une fois. Rend le champ fautif et son
 * message, ou `null`. Elles ne portent QUE sur ce qui rend une entrée
 * inexploitable — un employeur sans nom, un poste sans intitulé, une période à
 * l'envers. Rien sur la description : une expérience sans texte est valide.
 */
function verifier(b: Brouillon): { champ: keyof Brouillon; message: string } | null {
  if (b.employeur.trim().length === 0)
    return { champ: 'employeur', message: 'Indiquez l’employeur.' };
  if (b.intitule.trim().length === 0)
    return { champ: 'intitule', message: 'Indiquez l’intitulé du poste.' };
  if (b.anneeDebut == null)
    return { champ: 'anneeDebut', message: 'Indiquez l’année de début.' };
  if (!b.enPoste && b.anneeFin != null) {
    const debut = b.anneeDebut * 12 + Number(b.moisDebut ?? 1);
    const fin = b.anneeFin * 12 + Number(b.moisFin ?? 12);
    if (fin < debut)
      return { champ: 'anneeFin', message: 'La fin ne peut pas précéder le début.' };
  }
  return null;
}

export function FriseParcours({
  entrees,
  onChangement,
  lectureSeule,
  anneeMin = 1970,
  className,
}: ProprietesFriseParcours) {
  const prefixe = useId();
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [faute, setFaute] = useState<{ champ: keyof Brouillon; message: string } | null>(null);
  const [aRetirer, setARetirer] = useState<EntreeParcours | null>(null);
  const refAjouter = useRef<HTMLButtonElement>(null);

  const anneeMax = new Date().getFullYear() + 1;
  const affichees = [...entrees].sort((a, b) => rang(b) - rang(a));
  const ajoutEnCours = brouillon !== null && !entrees.some((e) => e.cle === brouillon.cle);

  function valider() {
    if (!brouillon) return;
    const f = verifier(brouillon);
    if (f) {
      setFaute(f);
      return;
    }
    const entree: EntreeParcours = {
      cle: brouillon.cle,
      employeur: brouillon.employeur.trim(),
      intitule: brouillon.intitule.trim(),
      // `anneeDebut` est non nul : `verifier` vient de le garantir.
      anneeDebut: brouillon.anneeDebut as number,
      moisDebut: brouillon.moisDebut ? Number(brouillon.moisDebut) : null,
      anneeFin: brouillon.enPoste ? null : brouillon.anneeFin,
      moisFin: brouillon.enPoste || !brouillon.moisFin ? null : Number(brouillon.moisFin),
      enPoste: brouillon.enPoste,
      description: brouillon.description.trim() || undefined,
    };
    const existe = entrees.some((e) => e.cle === entree.cle);
    onChangement(
      existe ? entrees.map((e) => (e.cle === entree.cle ? entree : e)) : [...entrees, entree],
    );
    setBrouillon(null);
    setFaute(null);
  }

  function retirer(entree: EntreeParcours) {
    onChangement(entrees.filter((e) => e.cle !== entree.cle));
    setARetirer(null);
    if (brouillon?.cle === entree.cle) setBrouillon(null);
  }

  const formulaire = (b: Brouillon) => (
    <Formulaire
      brouillon={b}
      faute={faute}
      anneeMin={anneeMin}
      anneeMax={anneeMax}
      onPoser={(cle, valeur) => {
        setBrouillon((x) => (x ? { ...x, [cle]: valeur } : x));
        setFaute(null);
      }}
      onValider={valider}
      onAnnuler={() => {
        setBrouillon(null);
        setFaute(null);
      }}
    />
  );

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {!lectureSeule && (
        <div className="flex justify-end">
          <Bouton
            ref={refAjouter}
            apparence="contour"
            taille="sm"
            // Ouvrir un second brouillon écraserait le premier sans le dire.
            disabled={brouillon !== null}
            onClick={() => {
              setFaute(null);
              setBrouillon(brouillonVide(`${prefixe}-${Date.now()}`));
            }}
            iconeAvant={<Icone nom="icon-plus" className="size-4" />}
          >
            Ajouter une expérience
          </Bouton>
        </div>
      )}

      {ajoutEnCours && brouillon && (
        <Carte regime="contour" className="p-4">
          {formulaire(brouillon)}
        </Carte>
      )}

      {affichees.length === 0 && !ajoutEnCours ? (
        <EtatVide
          titre="Aucune expérience renseignée"
          description={
            lectureSeule
              ? 'Rien n’a encore été saisi ici.'
              : 'Ajoutez vos postes : c’est ce qui permet de vous proposer les bonnes offres.'
          }
        />
      ) : (
        <ol className="flex flex-col">
          {affichees.map((entree, index) => {
            const dernier = index === affichees.length - 1;
            const enEdition = brouillon?.cle === entree.cle;

            return (
              <li key={entree.cle} className="relative flex gap-3 pb-5 last:pb-0">
                {/* Le rail. Même tracé que `FriseActivite` : posé en absolu
                    derrière la pastille, il s'arrête à la dernière entrée —
                    un rail qui dépasse promet une suite qui n'existe pas. */}
                {!dernier && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-[11px] top-6 w-px bg-[var(--encre-100)]"
                  />
                )}

                <span
                  aria-hidden="true"
                  className={cn(
                    'relative z-10 mt-0.5 flex size-[23px] shrink-0 items-center justify-center',
                    'rounded-[var(--r-full)] border border-[var(--encre-200)] bg-[var(--fond-carte)]',
                  )}
                >
                  {/* Le poste en cours porte le point plein : c'est le seul
                      repère qui distingue « aujourd'hui » du reste de la pile. */}
                  <span
                    className={cn(
                      'rounded-[var(--r-full)]',
                      entree.enPoste ? 'size-2 bg-black' : 'size-1.5 bg-[var(--encre-400)]',
                    )}
                  />
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                  {enEdition && brouillon ? (
                    <Carte regime="contour" className="p-4">
                      {formulaire(brouillon)}
                    </Carte>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <p className="t-body-bold text-black">{entree.intitule}</p>
                          <p className="t-body text-black">{entree.employeur}</p>
                          <p className="t-caption text-[var(--encre-500)]">
                            {formaterPeriode(entree)}
                          </p>
                        </div>

                        {!lectureSeule && (
                          <div className="flex shrink-0 gap-1">
                            <Bouton
                              apparence="contour"
                              taille="sm"
                              disabled={brouillon !== null}
                              onClick={() => {
                                setFaute(null);
                                setBrouillon(versBrouillon(entree));
                              }}
                            >
                              {/* Le nom nomme l'OBJET : cinq boutons
                                  « Modifier » identiques dans une liste ne se
                                  distinguent pas au lecteur d'écran. Écrit d'un
                                  seul tenant, parce que le calcul du nom
                                  accessible élague les blancs de bord de chaque
                                  nœud : « Modifier » + « — X » se recollent en
                                  « Modifier— X ». */}
                              <span className="sr-only">
                                {`Modifier — ${entree.intitule}`}
                              </span>
                              <span aria-hidden="true">Modifier</span>
                            </Bouton>
                            <Bouton
                              apparence="contour"
                              taille="sm"
                              disabled={brouillon !== null}
                              onClick={() => setARetirer(entree)}
                            >
                              <span className="sr-only">
                                {`Retirer — ${entree.intitule}`}
                              </span>
                              <span aria-hidden="true">Retirer</span>
                            </Bouton>
                          </div>
                        )}
                      </div>

                      {entree.description && (
                        <p className="t-caption whitespace-pre-wrap break-words text-[var(--encre-600)]">
                          {entree.description}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <DialogueConfirmation
        ouvert={aRetirer !== null}
        onOuvertureChange={(o) => !o && setARetirer(null)}
        titre="Retirer cette expérience ?"
        message={
          aRetirer
            ? `« ${aRetirer.intitule} » chez ${aRetirer.employeur} sera retiré de votre parcours. Cette action ne peut pas être annulée.`
            : ''
        }
        libelleConfirmation="Retirer l’expérience"
        destructif
        onConfirmer={() => aRetirer && retirer(aRetirer)}
        focusFinal={refAjouter}
      />
    </div>
  );
}

/* ── Le formulaire d'une entrée ────────────────────────────────────────────── */

function Formulaire({
  brouillon,
  faute,
  anneeMin,
  anneeMax,
  onPoser,
  onValider,
  onAnnuler,
}: {
  brouillon: Brouillon;
  faute: { champ: keyof Brouillon; message: string } | null;
  anneeMin: number;
  anneeMax: number;
  onPoser: <C extends keyof Brouillon>(cle: C, valeur: Brouillon[C]) => void;
  onValider: () => void;
  onAnnuler: () => void;
}) {
  const err = (cle: keyof Brouillon) => (faute?.champ === cle ? faute.message : undefined);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Champ
          libelle="Intitulé du poste"
          requis
          value={brouillon.intitule}
          erreur={err('intitule')}
          onChange={(e) => onPoser('intitule', e.target.value)}
        />
        <Champ
          libelle="Employeur"
          requis
          value={brouillon.employeur}
          erreur={err('employeur')}
          onChange={(e) => onPoser('employeur', e.target.value)}
        />
      </div>

      {/* Début et fin dans deux groupes distincts : les quatre contrôles alignés
          d'affilée se confondent, et on remplit la fin en croyant remplir le
          début. La légende de chaque groupe lève l'ambiguïté, à l'œil comme au
          lecteur d'écran. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset className="flex flex-col gap-1">
          <legend className="t-caption-bold mb-1 text-black">Début</legend>
          <div className="flex items-start gap-2">
            <ChampNombre
              className="w-[120px]"
              libelle="Année"
              valeur={brouillon.anneeDebut}
              onChangement={(v) => onPoser('anneeDebut', v)}
              min={anneeMin}
              max={anneeMax}
              boutons={false}
              requis
              erreur={err('anneeDebut')}
            />
            <Selecteur
              className="flex-1"
              libelle="Mois (facultatif)"
              options={OPTIONS_MOIS}
              valeur={brouillon.moisDebut}
              onChangement={(v) => onPoser('moisDebut', v)}
              substitut="—"
            />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1">
          <legend className="t-caption-bold mb-1 text-black">Fin</legend>
          <div className="flex items-start gap-2">
            <ChampNombre
              className="w-[120px]"
              libelle="Année"
              valeur={brouillon.anneeFin}
              onChangement={(v) => onPoser('anneeFin', v)}
              min={anneeMin}
              max={anneeMax}
              boutons={false}
              desactive={brouillon.enPoste}
              erreur={err('anneeFin')}
            />
            <Selecteur
              className="flex-1"
              libelle="Mois (facultatif)"
              options={OPTIONS_MOIS}
              valeur={brouillon.moisFin}
              onChangement={(v) => onPoser('moisFin', v)}
              substitut="—"
              desactive={brouillon.enPoste}
            />
          </div>
          <div className="mt-2">
            <Case
              libelle="J’occupe encore ce poste"
              checked={brouillon.enPoste}
              onCheckedChange={(coche) => {
                onPoser('enPoste', Boolean(coche));
                // Les deux champs de fin sont vidés en même temps qu'ils sont
                // grisés : les laisser garnis derrière un voile gris ferait
                // enregistrer une date de fin sur un poste en cours.
                if (coche) {
                  onPoser('anneeFin', null);
                  onPoser('moisFin', null);
                }
              }}
            />
          </div>
        </fieldset>
      </div>

      <ZoneTexte
        libelle="Ce que vous y faites (facultatif)"
        lignes={3}
        maxLength={1000}
        compteur
        value={brouillon.description}
        onChange={(e) => onPoser('description', e.target.value)}
      />

      <div className="flex justify-end gap-2">
        <Bouton apparence="contour" taille="sm" onClick={onAnnuler}>
          Annuler
        </Bouton>
        <Bouton apparence="plein" taille="sm" onClick={onValider}>
          Enregistrer cette expérience
        </Bouton>
      </div>
    </div>
  );
}
