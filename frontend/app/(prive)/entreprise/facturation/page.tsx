import { Carte } from '@/components/pacha/Carte';
import { Icone } from '@/components/pacha/Icone';
import { TuileCompteur } from '@/components/pacha/StatutProcess';
import {
  CadreEcran,
  CarteInterlocuteur,
  Champ,
  EnteteEcran,
  GrilleChamps,
} from '@/components/vues/entreprise/atomes';
import {
  FormulaireFacturation,
  TableauPlacements,
} from '@/components/vues/entreprise/Facturation';
import { SansEntreprise } from '@/components/vues/entreprise/SansEntreprise';
import { dateLongue, montantKe, type MonEntreprise } from '@/lib/domaine/entreprise';
import { mesPlacements, monEntreprise } from '@/lib/entreprise/lectures';

export const metadata = { title: 'Contrat et factures' };
export const dynamic = 'force-dynamic';

/**
 * CONTRAT ET FACTURATION.
 *
 * Le contrat est en LECTURE SEULE, et pas par prudence : aucune de ses colonnes
 * n'est dans une liste blanche d'écriture, et aucun droit par colonne ne les
 * couvre — un `DO` de contrôle refuse même la migration si `success_fee_*` ou
 * `valide_par_am_le` se retrouvent dans un `GRANT`. Les conditions commerciales
 * se négocient avec l'Account Manager, pas dans un formulaire.
 *
 * Seules les COORDONNÉES de facturation s'éditent : où envoyer la facture, et
 * à quelle raison sociale. Trois colonnes, une fonction dédiée.
 */
export default async function Vue() {
  const [entreprise, placements] = await Promise.all([monEntreprise(), mesPlacements()]);
  if (!entreprise) return <SansEntreprise objet="votre contrat et vos factures" />;

  const vivants = placements.filter((p) => !p.estArchive);
  const totalCommission = vivants.reduce((n, p) => n + (p.commissionKe ?? 0), 0);

  return (
    <CadreEcran>
      <EnteteEcran
        descriptif="Contrat et"
        impact="factures"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <TuileCompteur nombre={vivants.length} libelle="Recrutements facturés" />
        <TuileCompteur
          nombre={Math.round(totalCommission)}
          libelle="Total des commissions, en milliers d’euros"
        />
        <TuileCompteur
          nombre={entreprise.nbMoisGarantie ?? 0}
          libelle={
            entreprise.nbMoisGarantie
              ? 'Mois de garantie sur chaque recrutement'
              : 'Aucune garantie au contrat'
          }
        />
      </div>

      <section aria-labelledby="contrat" className="flex flex-col gap-4">
        <h2 id="contrat" className="t-h2">
          Votre contrat
        </h2>
        <ContratLecture entreprise={entreprise} />
      </section>

      <section aria-labelledby="placements" className="flex flex-col gap-4">
        <h2 id="placements" className="t-h2">
          Ce qui vous a été facturé
        </h2>
        <TableauPlacements placements={placements} />
        <p className="t-caption text-[var(--encre-500)]">Montants en milliers d’euros ; TJM en euros.</p>
      </section>

      <section aria-labelledby="coordonnees" className="flex flex-col gap-4">
        <h2 id="coordonnees" className="t-h2">
          Vos coordonnées de facturation
        </h2>
        <FormulaireFacturation entreprise={entreprise} />
      </section>

      {entreprise.amNom && (
        <div className="max-w-[320px]">
          <CarteInterlocuteur
            titre="Une question sur une facture"
            nom={entreprise.amNom}
            photo={entreprise.amPhoto}
            fonction={entreprise.amFonction}
            email={entreprise.amEmail}
          />
        </div>
      )}
    </CadreEcran>
  );
}

/**
 * Le contrat, tel qu'il est.
 *
 * `success_fee_est_absolu` décide laquelle des deux colonnes de commission
 * porte la valeur : un pourcentage du salaire, ou un montant fixe. Afficher les
 * deux, ou la mauvaise, sur un écran qui parle d'argent est le genre d'erreur
 * qui se paie en appel téléphonique.
 */
function ContratLecture({ entreprise: e }: { entreprise: MonEntreprise }) {
  const honoraires = e.successFeeEstAbsolu
    ? (montantKe(e.successFeeAbsKe) ?? null)
    : e.successFeePct !== null
      ? `${e.successFeePct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % du salaire annuel`
      : null;

  return (
    <Carte regime="contour" className="flex flex-col gap-5 rounded-[var(--r-ml)] p-5">
      <div className="flex items-start gap-3">
        <Icone nom="icon-file-text" className="mt-0.5 size-5 shrink-0 text-[var(--violet-700)]" />
        <div>
          <p className="t-body-hl text-black">{e.statutContrat ?? 'Contrat en cours de cadrage'}</p></div>
      </div>

      <GrilleChamps colonnes={3}>
        <Champ libelle="Honoraires de succès" valeur={honoraires} />
        <Champ
          libelle="Garantie"
          valeur={e.nbMoisGarantie ? `${e.nbMoisGarantie} mois` : null}
        />
        <Champ
          libelle="Exclusivité"
          valeur={
            e.exclusivite
              ? e.dureeExclusiviteSemaines
                ? `Oui, ${e.dureeExclusiviteSemaines} semaines`
                : 'Oui'
              : 'Non'
          }
        />
        <Champ libelle="Signé le" valeur={dateLongue(e.signatureLe)} />
        <Champ libelle="Échéance" valeur={dateLongue(e.finContratLe)} />
        <Champ libelle="Apport d’affaires" valeur={e.apportAffaires ? 'Oui' : 'Non'} />
      </GrilleChamps>
    </Carte>
  );
}
