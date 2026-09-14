'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Bouton } from '@/components/pacha/Bouton';
import { Carte } from '@/components/pacha/Carte';
import { Champ as ChampSaisie } from '@/components/pacha/Champ';
import { EtatVide } from '@/components/pacha/EtatVide';
import { Icone } from '@/components/pacha/Icone';
import { Tableau, type ColonneTableau } from '@/components/pacha/Tableau';
import { TagContrat } from '@/components/pacha/Tag';
import { useToasts } from '@/components/pacha/Toast';
import { useNonce } from '@/components/vues/entreprise/nonce';
import {
  adresseEnLignes,
  dateCourte,
  instantDe,
  montantKe,
  montantTjm,
  type AdresseFacturation,
  type LignePlacement,
  type MonEntreprise,
} from '@/lib/domaine/entreprise';
import { majFacturation } from '@/lib/entreprise/actions';
import { cn } from '@/lib/utils';

/* ══════════════════════════════════════════════════════════════════════════
   Les placements facturés
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * L'HISTORIQUE DE CE QUI VOUS A ÉTÉ FACTURÉ.
 *
 * ⚠ DEUX UNITÉS COHABITENT, et c'est mesuré, pas supposé : les montants de
 * `core.placement` sont en MILLIERS d'euros (`salaire_final_ke`,
 * `commission_ke`) tandis que le TJM facturé est en euros par jour
 * (`tjm_facture_client_eur`). Le rapport de 1000 entre placement et répartition
 * a été re-mesuré sur 260 lignes par le développeur base. Les afficher sans
 * unité, ou avec la même, produirait un écart de trois ordres de grandeur sur
 * un écran qui parle d'argent.
 *
 * CE QUI N'EST PAS ICI, ET NE DOIT PAS Y ÊTRE : `core.repartition_commission`.
 * C'est le partage interne de la commission entre agents et apporteurs. Le
 * client paie une commission, il n'a pas à savoir comment elle se répartit chez
 * nous. La vue `api.ma_facturation` ne la projette pas.
 */
export function TableauPlacements({ placements }: { placements: LignePlacement[] }) {
  const colonnes = useMemo<ColonneTableau<LignePlacement>[]>(
    () => [
      {
        cle: 'poste',
        entete: 'Poste',
        triSur: (p) => p.mandatIntitule,
        cellule: (p) => (
          <div className="flex min-w-0 flex-col py-1">
            {p.mandatId ? (
              <Link
                href={`/entreprise/mandats/${p.mandatId}`}
                className="t-body-bold truncate text-black underline-offset-2 hover:underline"
              >
                {p.mandatIntitule ?? 'Poste'}
              </Link>
            ) : (
              <span className="t-body-bold truncate text-black">{p.mandatIntitule ?? 'Poste'}</span>
            )}
            {p.metier && <span className="t-caption truncate text-[var(--encre-500)]">{p.metier}</span>}
          </div>
        ),
        largeur: 260,
      },
      {
        cle: 'reference',
        entete: 'Profil',
        triSur: (p) => p.reference,
        cellule: (p) => <span className="t-body text-black">{p.reference ?? '—'}</span>,
        largeur: 100,
      },
      {
        cle: 'contrat',
        entete: 'Contrat',
        triSur: (p) => p.contrat,
        cellule: (p) => (p.contrat ? <TagContrat contrat={p.contrat} /> : null),
        largeur: 120,
        masquerEnMobile: true,
      },
      {
        cle: 'closing',
        entete: 'Signé le',
        triSur: (p) => instantDe(p.closingLe),
        cellule: (p) => (
          <span className="t-body text-[var(--encre-600)]">{dateCourte(p.closingLe) ?? '—'}</span>
        ),
        largeur: 110,
      },
      {
        cle: 'remuneration',
        entete: 'Rémunération',
        triSur: (p) => p.salaireFinalKe ?? p.tjmFactureEur,
        cellule: (p) => (
          <span className="t-body text-black">
            {montantKe(p.salaireFinalKe) ?? montantTjm(p.tjmFactureEur) ?? '—'}
          </span>
        ),
        alignement: 'droite',
        largeur: 140,
        masquerEnMobile: true,
      },
      {
        cle: 'commission',
        entete: 'Commission',
        triSur: (p) => p.commissionKe,
        cellule: (p) => (
          <span className="t-body-bold text-black">{montantKe(p.commissionKe) ?? '—'}</span>
        ),
        alignement: 'droite',
        largeur: 130,
      },
      {
        cle: 'garantie',
        entete: 'Fin de garantie',
        triSur: (p) => instantDe(p.finGarantieLe),
        cellule: (p) => (
          <span className="t-caption text-[var(--encre-600)]">
            {dateCourte(p.finGarantieLe) ?? '—'}
          </span>
        ),
        largeur: 130,
        masquerEnMobile: true,
      },
      {
        cle: 'remboursement',
        entete: 'Remboursé',
        enteteAccessible: 'Remboursement au titre de la garantie',
        triSur: (p) => p.remboursementKe,
        cellule: (p) =>
          p.remboursementKe === null ? (
            <span className="t-caption text-[var(--encre-300)]">—</span>
          ) : (
            <span className="t-body text-black">
              {montantKe(p.remboursementKe)}
              {p.rembourseLe && (
                <span className="t-caption ml-1 text-[var(--encre-500)]">
                  le {dateCourte(p.rembourseLe)}
                </span>
              )}
            </span>
          ),
        alignement: 'droite',
        largeur: 160,
        masquerEnMobile: true,
      },
    ],
    [],
  );

  return (
    <Tableau
      colonnes={colonnes}
      lignes={placements}
      cleDeLigne={(p) => p.id}
      legende="Vos placements facturés : le poste, le profil, la rémunération retenue, la commission et la garantie."
      triInitial={{ cle: 'closing', sens: 'desc' }}
      etatVide={
        <EtatVide
          titre="Aucun placement facturé"
          description="Aucun recrutement abouti à ce jour."
        />
      }
    />
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Les coordonnées de facturation
   ══════════════════════════════════════════════════════════════════════════ */

type ChampsFacturation = {
  emailFacturation: string;
  raisonSociale: string;
  ligne1: string;
  ligne2: string;
  codePostal: string;
  ville: string;
  pays: string;
};

function initiales(e: MonEntreprise): ChampsFacturation {
  const a = (e.adresseFacturation ?? {}) as AdresseFacturation;
  return {
    emailFacturation: e.emailFacturation ?? '',
    raisonSociale: e.raisonSocialeFacturation ?? '',
    ligne1: a.ligne1 ?? '',
    ligne2: a.ligne2 ?? '',
    codePostal: a.code_postal ?? '',
    ville: a.ville ?? '',
    pays: a.pays ?? '',
  };
}

/**
 * OÙ ENVOYER LA FACTURE.
 *
 * `api.maj_facturation` écrit trois colonnes, en bloc : l'adresse est un
 * `jsonb` sans forme imposée en base, et vide sur les 851 entreprises du dev.
 * On lui pose donc une forme — quatre clés d'adresse postale française — et on
 * la renvoie ENTIÈRE à chaque enregistrement, sans quoi remplir la ville
 * effacerait la rue.
 */
export function FormulaireFacturation({ entreprise }: { entreprise: MonEntreprise }) {
  const router = useRouter();
  const { annoncer } = useToasts();
  const [enCours, demarrer] = useTransition();
  const [nonce, renouvelerNonce] = useNonce();

  const [champs, setChamps] = useState<ChampsFacturation>(() => initiales(entreprise));
  const [erreur, setErreur] = useState<{ champ?: string; message: string } | null>(null);
  const [modifie, setModifie] = useState(false);

  const poser = <C extends keyof ChampsFacturation>(cle: C) => (valeur: string) => {
    setChamps((c) => ({ ...c, [cle]: valeur }));
    setModifie(true);
    setErreur(null);
  };
  const err = (cle: keyof ChampsFacturation) =>
    erreur?.champ === cle ? erreur.message : undefined;

  function enregistrer() {
    demarrer(async () => {
      const r = await majFacturation({ ...champs, nonce });
      if (r.ok) {
        annoncer({ titre: r.message, ton: 'succes' });
        setModifie(false);
        setErreur(null);
        renouvelerNonce();
        router.refresh();
      } else {
        setErreur({ champ: r.champ, message: r.erreur });
        annoncer({
          titre: 'Les coordonnées n’ont pas été enregistrées',
          description: r.erreur,
          ton: 'echec',
          duree: 0,
        });
      }
    });
  }

  const apercu = adresseEnLignes(entreprise.adresseFacturation);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Carte regime="travail" className="flex flex-col gap-5 p-5">
        <div>
          <h3 className="t-h3">Où adresser vos factures</h3>
          <p className="t-caption mt-1 text-[var(--encre-600)]">Repris tel quel sur nos factures.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <ChampSaisie
            libelle="Adresse de facturation (courriel)"
            type="email"
            inputMode="email"
            placeholder="comptabilite@votre-entreprise.com"
            value={champs.emailFacturation}
            onChange={(e) => poser('emailFacturation')(e.currentTarget.value)}
            erreur={err('emailFacturation')}
          />
          <ChampSaisie
            libelle="Raison sociale à facturer"
            aide="Si elle diffère du nom commercial."
            value={champs.raisonSociale}
            onChange={(e) => poser('raisonSociale')(e.currentTarget.value)}
            erreur={err('raisonSociale')}
          />
        </div>

        <fieldset className="flex flex-col gap-5 border-0 p-0">
          <legend className="t-body-hl pb-1 text-black">Adresse postale</legend>
          <ChampSaisie
            libelle="Numéro et rue"
            value={champs.ligne1}
            onChange={(e) => poser('ligne1')(e.currentTarget.value)}
            erreur={err('ligne1')}
          />
          <ChampSaisie
            libelle="Complément"
            aide="Bâtiment, étage, service."
            value={champs.ligne2}
            onChange={(e) => poser('ligne2')(e.currentTarget.value)}
            erreur={err('ligne2')}
          />
          <div className="grid gap-5 sm:grid-cols-3">
            <ChampSaisie
              libelle="Code postal"
              inputMode="numeric"
              value={champs.codePostal}
              onChange={(e) => poser('codePostal')(e.currentTarget.value)}
              erreur={err('codePostal')}
            />
            <ChampSaisie
              libelle="Ville"
              value={champs.ville}
              onChange={(e) => poser('ville')(e.currentTarget.value)}
              erreur={err('ville')}
            />
            <ChampSaisie
              libelle="Pays"
              value={champs.pays}
              onChange={(e) => poser('pays')(e.currentTarget.value)}
              erreur={err('pays')}
            />
          </div>
        </fieldset>

        {modifie && (
          <div
            className={cn(
              'sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3',
              'rounded-[var(--r-md)] border-2 border-black bg-[var(--fond-carte)] p-3 shadow-[var(--ombre-3)]',
            )}
          >
            <p className="t-caption-hl text-black">Des modifications ne sont pas enregistrées.</p>
            <div className="flex items-center gap-2">
              <Bouton
                apparence="contour"
                taille="sm"
                disabled={enCours}
                onClick={() => {
                  setChamps(initiales(entreprise));
                  setModifie(false);
                  setErreur(null);
                }}
              >
                Annuler
              </Bouton>
              <Bouton
                apparence="plein"
                taille="sm"
                onClick={enregistrer}
                disabled={enCours}
                iconeAvant={<Icone nom="icon-save" />}
              >
                {enCours ? 'Enregistrement…' : 'Enregistrer'}
              </Bouton>
            </div>
          </div>
        )}
      </Carte>

      <aside className="flex flex-col gap-4">
        {/* Ce que le client doit VOIR sans avoir à le demander : à qui il paie.
            La raison sociale du cabinet n'est pas la marque, et c'est
            exactement le genre d'écart qui fait rejeter un virement. */}
        <Carte regime="contour" className="flex flex-col gap-2 p-4">
          <p className="t-caption text-[var(--encre-500)]">Nos coordonnées</p>
          <p className="t-body-bold text-black">Pacha Partners</p>
          <p className="t-body text-black">
            15B route de Vienne
            <br />
            69007 Lyon
          </p>
          <p className="t-caption text-[var(--encre-600)]">Raison sociale d’émission de nos factures.</p>
        </Carte>

        {apercu.length > 0 && (
          <Carte regime="travail" className="flex flex-col gap-2 p-4">
            <p className="t-caption text-[var(--encre-500)]">Adresse enregistrée</p>
            <address className="t-body not-italic text-black">
              {entreprise.raisonSocialeFacturation && (
                <>
                  <strong className="t-body-bold">{entreprise.raisonSocialeFacturation}</strong>
                  <br />
                </>
              )}
              {apercu.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </address>
          </Carte>
        )}
      </aside>
    </div>
  );
}
