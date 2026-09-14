import { EtatVide } from "@/components/pacha/EtatVide";
import { CadreEcran, EnteteEcran } from "@/components/vues/entreprise/atomes";
import { MonCompteForm } from "@/components/vues/entreprise/MonCompteForm";
import { monCompte, monEntreprise } from "@/lib/entreprise/lectures";
import { signer } from "@/lib/stockage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mes informations" };

/**
 * MES INFORMATIONS — la personne, pas l'entreprise.
 *
 * L'écran existe parce que rien ne disait sous quel compte on regardait, et
 * que les informations d'un contact client sont bien tenues en base
 * (`core.contact_client`, 524 personnes) sans que personne ne puisse les
 * corriger.
 *
 * `monCompte()` peut rendre `null` sans que ce soit une erreur : un compte
 * interne n'a pas de fiche de contact client. `api.mon_compte` filtre sur
 * `api.mon_contact_client()`, qui ne regarde que les accès de portail
 * `entreprise`. On le dit plutôt que d'afficher un formulaire vide.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA SIGNATURE SE FAIT ICI, PARCE QU'ELLE NE PEUT SE FAIRE QUE LÀ
 * ─────────────────────────────────────────────────────────────────────────
 * `documents-entreprise` est privé : `compte.photoUrl` est une RÉFÉRENCE, pas
 * une adresse affichable. `signer` la change en URL à cinq minutes, et c'est un
 * geste de serveur — il ouvre un client Supabase porteur du cookie de session.
 * Le formulaire est un composant client : il reçoit le résultat, jamais la
 * fonction.
 *
 * ⚠ `signer` SORT IMMÉDIATEMENT sur une valeur qui ne vient pas de nos seaux —
 * et c'est le cas de 100 % du corpus repris de Bubble. Cet appel ne coûte un
 * aller-retour que sur une photo réellement déposée chez nous.
 */
export default async function Vue() {
  const compte = await monCompte();
  // L'entreprise n'est lue que pour NOMMER l'Account Manager dans le panneau de
  // droite. `monEntreprise` est mémoïsée par `cache()` : l'appel est gratuit si
  // un autre écran du rendu l'a déjà demandée.
  const [photoApercu, entreprise] = await Promise.all([
    signer(compte?.photoUrl ?? null),
    monEntreprise(),
  ]);

  return (
    <CadreEcran>
      <EnteteEcran descriptif="Mes" impact="informations" />
      {compte ? (
        <MonCompteForm
          compte={compte}
          photoApercu={photoApercu}
          amNom={entreprise?.amNom ?? null}
        />
      ) : (
        <EtatVide
          titre="Aucune fiche de contact n’est rattachée à ce compte"
          description="Votre Account Manager peut la créer."
        />
      )}
    </CadreEcran>
  );
}
