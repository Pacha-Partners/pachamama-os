'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';

import { Accordeon, SectionAccordeon } from '@/components/pacha/Accordeon';
import { Carte } from '@/components/pacha/Carte';
import { Interrupteur } from '@/components/pacha/Cases';
import { Champ as ChampSaisie } from '@/components/pacha/Champ';
import { ChampFourchette, type Fourchette } from '@/components/pacha/ChampFourchette';
import { ChampTags } from '@/components/pacha/ChampTags';
import { Combobox } from '@/components/pacha/Combobox';
import { SelecteurMulti } from '@/components/pacha/Selecteur';
import { useToasts } from '@/components/pacha/Toast';
import { ZoneTexte } from '@/components/pacha/ZoneTexte';
import {
  BarreEnregistrement,
  Precision,
  type PoigneeSection,
} from '@/components/vues/talent/atomes';
import { useNonce } from '@/components/vues/talent/nonce';
import { libellesDe, type FicheTalent } from '@/lib/domaine/talent';
import { majMaListe, majMesAttentes } from '@/lib/talent/actions';
import type { TypeListe } from '@/lib/talent/saisie';

/**
 * MES ATTENTES — le job rêvé.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ UN SEUL BOUTON, SEPT APPELS — ET LE PREMIER PEUT PASSER SANS LES AUTRES
 * ─────────────────────────────────────────────────────────────────────────
 * La base découpe cet écran en sept écritures : `api.maj_mes_attentes` pour les
 * dix colonnes scalaires, puis `api.maj_mes_listes` UNE FOIS PAR LISTE — son
 * contrat prend un `p_type` et un tableau de codes, pas six tableaux.
 *
 * On n'expose pas sept boutons : personne ne comprendrait pourquoi enregistrer
 * sa fourchette de salaire ne sauve pas ses secteurs. Un seul geste, donc, et
 * la conséquence est DITE quand elle se produit : si la quatrième écriture
 * échoue, les trois premières sont enregistrées, et le message nomme la liste
 * fautive. C'est plus honnête qu'un « échec » global qui laisserait croire que
 * rien n'est passé.
 *
 * **L'ORDRE N'EST PAS ARBITRAIRE** : `secteur_nogo` part AVANT `secteur_vise`.
 * `api.maj_mes_listes` refuse en 23514 qu'un secteur soit à la fois visé et
 * no-go, en nommant le secteur — et 4 fiches actives sont dans cette situation
 * aujourd'hui (mesuré). Quelqu'un qui déplace un secteur d'une liste à l'autre
 * doit donc le voir RETIRÉ de l'ancienne avant d'être ajouté à la nouvelle,
 * sinon la première écriture bute sur l'ancienne valeur de la seconde.
 *
 * Et seules les listes MODIFIÉES sont envoyées : réécrire une liste inchangée
 * est un vrai `delete` + `insert` en base et une ligne de journal pour rien.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ `recherche_active` A TROIS ÉTATS, ET L'INTERRUPTEUR N'EN A QUE DEUX
 * ─────────────────────────────────────────────────────────────────────────
 * Mesuré : la colonne est **NULLE sur les 7 023 fiches actives**. Elle n'a
 * jamais été écrite — personne n'a jamais déclaré être en recherche ou ne pas
 * l'être. Or `maj_mes_attentes` enregistre le formulaire entier : un
 * interrupteur qui replierait `null` sur `false` DÉCLARERAIT « je ne cherche
 * pas » pour les 7 023 personnes, au premier enregistrement de leur
 * fourchette de salaire. Une déclaration silencieuse, sur le champ le plus
 * lourd de conséquences de l'écran.
 *
 * L'état est donc `boolean | null`. Tant que personne n'a touché
 * l'interrupteur, on envoie `null` et la colonne reste vide, avec une phrase
 * qui le dit. Le premier clic, lui, déclare — dans un sens ou dans l'autre.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEUX COMPOSANTS DE LISTE, ET LE CHOIX SUIT LE VOLUME
 * ─────────────────────────────────────────────────────────────────────────
 * `ChampTags` montre ses options en puces cliquables — parfait pour 3 contrats,
 * 4 rythmes de remote, 32 critères, 33 expertises, où voir le vocabulaire fait
 * partie du choix. `SelecteurMulti` pour les 52 secteurs, deux fois : 104 puces
 * à l'écran pour deux listes qui concernent 858 et 677 fiches sur 7 023
 * noieraient l'écran sous un vocabulaire que la plupart n'emploie pas.
 *
 * Et `Combobox` pour les 255 métiers, parce qu'on ne choisit pas dans 255
 * options sans taper — c'est exactement ce pour quoi le composant a été fait.
 */

type Echelle = { min: number | null; max: number | null };

type EtatAttentes = {
  metierCode: string | null;
  universCode: string | null;
  salaire: Echelle;
  tjm: Echelle;
  disponibiliteTexte: string;
  localisationTexte: string;
  description: string;
  rechercheActive: boolean | null;
};

/** L'ordre d'envoi. `secteur_nogo` d'abord : voir l'en-tête. */
const ORDRE_LISTES: readonly TypeListe[] = [
  'secteur_nogo',
  'secteur_vise',
  'critere',
  'contrat',
  'remote',
  'expertise',
];

/*
 * ⚠ LES NOMS DE LISTE NE SONT PAS RECOPIÉS ICI, ET C'EST VOLONTAIRE.
 * `majMaListe` préfixe déjà son message d'erreur du nom de la liste
 * (« Secteurs visés : un secteur ne peut pas être… ») : les redire ici
 * donnerait deux tables de libellés, dont une seule serait corrigée le jour
 * où l'on rebaptise « Ce qui compte pour vous ».
 */

function initiales(f: FicheTalent): EtatAttentes {
  return {
    metierCode: f.attentesMetierCode ?? null,
    universCode: f.attentesUniversCode ?? null,
    salaire: { min: f.attentesSalaireMinKe ?? null, max: f.attentesSalaireMaxKe ?? null },
    tjm: { min: f.attentesTjmMinEur ?? null, max: f.attentesTjmMaxEur ?? null },
    disponibiliteTexte: f.attentesDisponibiliteTexte ?? '',
    localisationTexte: f.attentesLocalisationTexte ?? '',
    description: f.attentesDescription ?? '',
    rechercheActive: f.rechercheActive ?? null,
  };
}

function listesInitiales(f: FicheTalent): Record<TypeListe, string[]> {
  return {
    secteur_nogo: [...(f.secteursNogoCodes ?? [])],
    secteur_vise: [...(f.secteursVisesCodes ?? [])],
    critere: [...(f.criteresCodes ?? [])],
    contrat: [...(f.contratsSouhaites ?? [])],
    remote: [...(f.remoteSouhaites ?? [])],
    expertise: [...(f.expertisesCodes ?? [])],
  };
}

/** Deux listes identiques à l'ordre près ne sont PAS modifiées. */
function memeEnsemble(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const gauche = [...a].sort();
  const droite = [...b].sort();
  return gauche.every((v, i) => v === droite[i]);
}

export type Vocabulaires = {
  metier: { valeur: string; libelle: string }[];
  univers: { valeur: string; libelle: string }[];
  secteur: { valeur: string; libelle: string }[];
  critere: { valeur: string; libelle: string }[];
  expertise: { valeur: string; libelle: string }[];
  contrat: { valeur: string; libelle: string }[];
  remote: { valeur: string; libelle: string }[];
};

export function FormulaireAttentes({
  fiche,
  vocabulaires,
  pilote,
}: {
  fiche: FicheTalent;
  vocabulaires: Vocabulaires;
  /**
   * Présent quand l'écran « Ma fiche » orchestre l'enregistrement : la section
   * range alors sa propre barre et remonte son état au parent.
   */
  pilote?: {
    onModifie: (v: boolean) => void;
    onPoignee: (p: PoigneeSection) => void;
  };
}) {
  const router = useRouter();
  const { annoncer } = useToasts();
  const [enCours, demarrer] = useTransition();
  const [nonce, renouvelerNonce] = useNonce();

  const [etat, setEtat] = useState<EtatAttentes>(() => initiales(fiche));
  const [listes, setListes] = useState<Record<TypeListe, string[]>>(() => listesInitiales(fiche));
  const [erreur, setErreur] = useState<{ champ?: string; message: string } | null>(null);
  const [modifie, setModifie] = useState(false);

  const depart = useMemo(() => initiales(fiche), [fiche]);
  const departListes = useMemo(() => listesInitiales(fiche), [fiche]);

  const poser = <C extends keyof EtatAttentes>(cle: C, valeur: EtatAttentes[C]) => {
    setEtat((e) => ({ ...e, [cle]: valeur }));
    setModifie(true);
    setErreur(null);
  };
  const poserListe = (type: TypeListe, codes: string[]) => {
    setListes((l) => ({ ...l, [type]: codes }));
    setModifie(true);
    setErreur(null);
  };
  const err = (cle: string) => (erreur?.champ === cle ? erreur.message : undefined);

  /**
   * ⚠ LE CONFLIT VISÉ / NO-GO EST SIGNALÉ AVANT L'ENVOI.
   *
   * La base le refuse et nomme le secteur, ce qui suffirait — mais découvrir à
   * l'enregistrement qu'on a coché « Blockchain » des deux côtés, après avoir
   * rempli six autres champs, est une punition pour une faute évitable. On le
   * dit là où elle se fait.
   */
  const conflits = useMemo(() => {
    const nogo = new Set(listes.secteur_nogo);
    return listes.secteur_vise.filter((c) => nogo.has(c));
  }, [listes.secteur_vise, listes.secteur_nogo]);

  /**
   * L'écriture, rendue ATTENDABLE : « Ma fiche » enchaîne les sections et doit
   * savoir si la précédente a tenu avant d'écrire la suivante.
   */
  async function sauver(): Promise<boolean> {
    if (conflits.length > 0) {
      const noms = libellesDe(vocabulaires.secteur, conflits).join(', ');
      setErreur({
        champ: 'secteur_vise',
        message: `${noms} : un secteur ne peut pas être à la fois visé et à éviter. Retirez-le d’une des deux listes.`,
      });
      return false;
    }

    {
      const r = await majMesAttentes({
        metierCode: etat.metierCode,
        universCode: etat.universCode,
        salaireMinKe: etat.salaire.min,
        salaireMaxKe: etat.salaire.max,
        tjmMinEur: etat.tjm.min,
        tjmMaxEur: etat.tjm.max,
        disponibiliteTexte: etat.disponibiliteTexte,
        localisationTexte: etat.localisationTexte,
        description: etat.description,
        rechercheActive: etat.rechercheActive,
        nonce,
      });
      if (!r.ok) {
        setErreur({ champ: r.champ, message: r.erreur });
        annoncer({
          titre: 'Vos attentes n’ont pas été enregistrées',
          description: r.erreur,
          ton: 'echec',
          duree: 0,
        });
        return false;
      }
    }

      // Les listes, dans l'ordre, et seulement celles qui ont changé.
      const echecs: string[] = [];
      for (const type of ORDRE_LISTES) {
        if (memeEnsemble(listes[type], departListes[type])) continue;
        const rl = await majMaListe({ type, codes: listes[type], nonce });
        if (!rl.ok) echecs.push(rl.erreur);
      }

      if (echecs.length === 0) {
        annoncer({ titre: 'Vos attentes sont enregistrées.', ton: 'succes' });
        setModifie(false);
        setErreur(null);
        renouvelerNonce();
        router.refresh();
        return true;
      }

      // Ce qui est passé EST passé : on rafraîchit pour que l'écran montre
      // l'état réel, et on garde la barre ouverte sur ce qui reste à corriger.
      setErreur({ message: echecs[0] });
      annoncer({
        titre: 'Une partie n’a pas été enregistrée',
        description: `${echecs.join(' · ')} Le reste de vos attentes est bien enregistré.`,
        ton: 'echec',
        duree: 0,
      });
      renouvelerNonce();
      router.refresh();
      return false;
  }

  function annuler() {
    setEtat(depart);
    setListes(departListes);
    setModifie(false);
    setErreur(null);
  }

  function enregistrer() {
    demarrer(async () => {
      await sauver();
    });
  }

  // La section se déclare au parent : son état, et de quoi l'actionner.
  useEffect(() => {
    if (!pilote) return;
    pilote.onPoignee({ sauver, annuler });
    pilote.onModifie(modifie);
  });

  return (
    <div className="flex flex-col gap-6">
      {/* ─────────────────────────────────────────── 1. suis-je en recherche */}
      <Carte regime="accroche" className="flex flex-col gap-3 p-5">
        <h3 className="t-h3">Êtes-vous en recherche&nbsp;?</h3>
        <Interrupteur
          libelle={
            etat.rechercheActive === true
              ? 'Oui, je suis en recherche active'
              : etat.rechercheActive === false
                ? 'Non, je ne cherche pas en ce moment'
                : 'Dites-le-nous'
          }
          checked={etat.rechercheActive === true}
          onCheckedChange={(v) => poser('rechercheActive', v)}
          disabled={enCours}
        />
        <Precision>
          {etat.rechercheActive === null
            ? // ⚠ 7 023 fiches sur 7 023 sont dans cet état : la colonne n'a jamais
              // été écrite. Tant que l'interrupteur n'est pas touché, on n'écrit
              // rien — et on ne déclare donc rien à la place de la personne.
              'Vous ne nous l’avez pas encore dit.'
            : etat.rechercheActive
              ? 'Nous vous proposons des postes dès qu’un correspond à ce que vous décrivez ci-dessous.'
              : 'Nous gardons votre dossier, sans vous solliciter. Vous restez joignable pour une opportunité exceptionnelle.'}
        </Precision>
      </Carte>

      {/* ───────────────────────────────────────────────── 2. le job visé */}
      <Carte regime="travail" className="flex flex-col gap-5 p-5">
        <div>
          <h3 className="t-h3">Le poste que vous visez</h3>
        </div>

        <div className="grid gap-x-5 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
          <Combobox
            libelle="Métier"
            // 255 métiers actifs (mesuré) : on ne choisit pas là-dedans sans
            // taper. `Combobox` filtre à la frappe et rend au plus 100 options.
            options={vocabulaires.metier}
            valeur={etat.metierCode}
            onChangement={(v) => poser('metierCode', v)}
            substitut="Product Manager, Data Engineer…"
            texteVide="Aucun métier ne correspond"
            erreur={err('metierCode')}
            desactive={enCours}
          />
          <Combobox
            libelle="Univers"
            options={vocabulaires.univers}
            valeur={etat.universCode}
            onChangement={(v) => poser('universCode', v)}
            substitut="Product, Tech, Data…"
            erreur={err('universCode')}
            desactive={enCours}
          />
        </div>

        <ChampTags
          libelle="Contrats qui vous intéressent"
          options={vocabulaires.contrat}
          valeurs={listes.contrat}
          onChangement={(v) => poserListe('contrat', v)}
          desactive={enCours}
        />

        <ChampTags
          libelle="Rythme de télétravail"
          options={vocabulaires.remote}
          valeurs={listes.remote}
          onChangement={(v) => poserListe('remote', v)}
          // ⚠ MESURÉ : `ref.libelle` au domaine `rythme_remote` ne porte que
          // quatre rythmes actifs, tous à distance ou hybrides — il n'existe
          // AUCUN code « sur site ». Ne rien cocher est donc la seule façon de
          // dire « je viens au bureau », et l'aide le dit plutôt que de laisser
          // chercher une option qui n'existe pas.
          desactive={enCours}
        />
      </Carte>

      {/* ────────────────────────────────────────── 3. ce que vous attendez */}
      <Carte regime="travail" className="flex flex-col gap-5 p-5">
        <div>
          <h3 className="t-h3">Vos prétentions</h3>
        </div>

        <ChampFourchette
          libelle="Rémunération annuelle brute (K€)"
          unite="K€"
          // ⚠ EN MILLIERS. Les 3 264 salaires de la base ont été harmonisés en
          // K€ : « 65 » vaut 65 000 €. L'unité est portée par le champ ET par
          // l'aide, parce qu'un « 65000 » saisi ici serait refusé par la borne
          // de 1 000 de la base — et qu'un refus vaut mieux qu'un salaire
          // multiplié par mille.
          valeurs={etat.salaire as Fourchette}
          onChangement={(v) => poser('salaire', v)}
          min={0}
          max={1000}
          erreur={err('salaireMaxKe') ?? err('salaireMinKe')}
          desactive={enCours}
        />

        <ChampFourchette
          libelle="Taux journalier (€/jour)"
          unite="€/j"
          valeurs={etat.tjm as Fourchette}
          onChangement={(v) => poser('tjm', v)}
          min={0}
          max={10000}
          erreur={err('tjmMaxEur') ?? err('tjmMinEur')}
          desactive={enCours}
        />

        <div className="grid gap-x-5 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
          <ChampSaisie
            libelle="Votre disponibilité"
            placeholder="Immédiatement, sous deux mois, en janvier…"
            value={etat.disponibiliteTexte}
            onChange={(e) => poser('disponibiliteTexte', e.currentTarget.value)}
            erreur={err('disponibiliteTexte')}
          />
          <ChampSaisie
            libelle="Où vous acceptez de travailler"
            placeholder="Lyon et Paris, deux jours par semaine maximum…"
            value={etat.localisationTexte}
            onChange={(e) => poser('localisationTexte', e.currentTarget.value)}
            erreur={err('localisationTexte')}
          />
        </div>

        <ZoneTexte
          libelle="Ce que vous cherchez, en vos mots"
          lignes={6}
          maxLength={10000}
          compteur
          value={etat.description}
          onChange={(e) => poser('description', e.currentTarget.value)}
          erreur={err('description')}
          disabled={enCours}
        />
      </Carte>

      {/* ⚠ LE CONFLIT PASSE DEVANT L'ACCORDÉON, PAS DERRIÈRE.
          Il empêche l'enregistrement, et sa cause est repliée dans la section
          « Secteurs » juste en dessous. Posé après, il se lisait une fois la
          section dépassée — donc trop tard pour expliquer pourquoi elle s'était
          ouverte toute seule. */}
      {conflits.length > 0 && (
        <Carte regime="contour" className="flex flex-col gap-1 p-4">
          <p className="t-titre-hl text-black">
            {conflits.length > 1 ? 'Des secteurs sont' : 'Un secteur est'} dans les deux listes
          </p>
          <p className="t-body text-black">
            {libellesDe(vocabulaires.secteur, conflits).join(', ')}{' '}
            {conflits.length > 1 ? 'sont' : 'est'} à la fois visé
            {conflits.length > 1 ? 's' : ''} et à éviter. Retirez-le
            {conflits.length > 1 ? 's' : ''} d’une des deux listes pour pouvoir enregistrer.
          </p>
        </Carte>
      )}

      {/* ───────────────────────────── 4. le détail, replié par défaut */}
      {/* ⚠ CHAQUE SECTION EST UNE CARTE, ET C'EST UNE CONFIGURATION DU DS,
          PAS UN REMPLACEMENT.
          `Accordeon` rend par défaut une liste continue séparée par des filets,
          posée à même le fond crème. Ça convient à un panneau latéral ; ici,
          les trois blocs qui précèdent sont des cartes blanches, et la liste
          nue qui leur succédait se lisait comme un bas de page inachevé. On
          annule donc les séparateurs, on espace, et on donne à chaque item
          l'habillage de `Carte regime="travail"`. */}
      <Accordeon
        valeurParDefaut={conflits.length > 0 ? ['secteurs'] : []}
        className="gap-3 divide-y-0"
      >
        <SectionAccordeon
          valeur="secteurs"
          className="rounded-[var(--r-md)] border border-[var(--encre-100)] bg-[var(--fond-carte)] px-5"
          titre="Secteurs"
          niveauTitre={3}
          resume={
            listes.secteur_vise.length + listes.secteur_nogo.length === 0
              ? 'Aucun secteur choisi'
              : `${listes.secteur_vise.length} visé${listes.secteur_vise.length > 1 ? 's' : ''} · ${listes.secteur_nogo.length} à éviter`
          }
          compteur={listes.secteur_vise.length + listes.secteur_nogo.length}
        >
          <div className="flex flex-col gap-5 border-t border-[var(--encre-100)] pb-4 pt-4">
            <Precision>
            Un même secteur ne peut pas être dans les deux listes.
          </Precision>
            <SelecteurMulti
              libelle="Secteurs qui vous intéressent"
              options={vocabulaires.secteur}
              valeurs={listes.secteur_vise}
              onChangement={(v) => poserListe('secteur_vise', v)}
              substitut="Choisissez un ou plusieurs secteurs"
              erreur={err('secteur_vise')}
              desactive={enCours}
            />
            <SelecteurMulti
              libelle="Secteurs que vous ne voulez pas"
              options={vocabulaires.secteur}
              valeurs={listes.secteur_nogo}
              onChangement={(v) => poserListe('secteur_nogo', v)}
              substitut="Choisissez un ou plusieurs secteurs"
              desactive={enCours}
            />
          </div>
        </SectionAccordeon>

        <SectionAccordeon
          valeur="expertises"
          className="rounded-[var(--r-md)] border border-[var(--encre-100)] bg-[var(--fond-carte)] px-5"
          titre="Vos expertises"
          niveauTitre={3}
          resume={
            listes.expertise.length === 0
              ? 'Aucune expertise choisie'
              : libellesDe(vocabulaires.expertise, listes.expertise).slice(0, 3).join(' · ')
          }
          compteur={listes.expertise.length}
        >
          <div className="border-t border-[var(--encre-100)] pb-4 pt-4">
            <ChampTags
              libelle="Ce que vous savez faire"
              options={vocabulaires.expertise}
              valeurs={listes.expertise}
              onChangement={(v) => poserListe('expertise', v)}
              visibles={12}
              desactive={enCours}
            />
          </div>
        </SectionAccordeon>

        <SectionAccordeon
          valeur="criteres"
          className="rounded-[var(--r-md)] border border-[var(--encre-100)] bg-[var(--fond-carte)] px-5"
          titre="Ce qui compte pour vous"
          niveauTitre={3}
          resume={
            listes.critere.length === 0
              ? 'Aucun critère choisi'
              : libellesDe(vocabulaires.critere, listes.critere).slice(0, 3).join(' · ')
          }
          compteur={listes.critere.length}
        >
          <div className="flex flex-col gap-3 border-t border-[var(--encre-100)] pb-4 pt-4">
            <ChampTags
              libelle="Vos critères"
              options={vocabulaires.critere}
              valeurs={listes.critere}
              onChangement={(v) => poserListe('critere', v)}
              visibles={12}
              desactive={enCours}
            />
          </div>
        </SectionAccordeon>
      </Accordeon>


      {erreur && !erreur.champ && (
        <Carte regime="contour" className="p-4">
          <p className="t-body-hl text-black">{erreur.message}</p>
        </Carte>
      )}

      {!pilote && (
        <BarreEnregistrement
          modifie={modifie}
          enCours={enCours}
          onEnregistrer={enregistrer}
          onAnnuler={annuler}
        />
      )}

    </div>
  );
}
