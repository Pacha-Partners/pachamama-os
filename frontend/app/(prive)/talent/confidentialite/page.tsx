import { Confidentialite } from '@/components/vues/talent/Confidentialite';
import { SansFiche } from '@/components/vues/talent/SansFiche';
import { CadreEcran, EnteteEcran } from '@/components/vues/talent/atomes';
import { ficheConfidentialite } from '@/lib/talent/lectures';

export const metadata = { title: 'Mes données' };
export const dynamic = 'force-dynamic';

/**
 * MES DONNÉES — consentement, export, suppression, visibilité.
 *
 * ⚠ SIX COLONNES, ET AUCUNE DONNÉE PERSONNELLE.
 * `COLONNES_CONFIDENTIALITE` ne demande que des états et des dates : `actif`,
 * `recherche_active`, `consentement_donne_le`, `modifie_par_le_talent_le`,
 * `cv_depose_le`. Ni nom, ni adresse, ni chemin de document — cet écran parle
 * DE la donnée, il n'a pas à la porter (D-15).
 *
 * D-07 : le cadrage RGPD est déclaré bloquant avant toute mise en production et
 * n'est pas instruit. Cet écran construit et branche les mécanismes ; il dit en
 * bas, explicitement, qu'il ne remplace pas une politique de confidentialité.
 */
export default async function Vue() {
  const fiche = await ficheConfidentialite();
  if (!fiche) return <SansFiche objet="votre dossier candidat" />;

  return (
    <CadreEcran>
      <EnteteEcran
        descriptif="Vos données"
        impact="chez Pachamama"
      />
      <Confidentialite fiche={fiche} />
    </CadreEcran>
  );
}
