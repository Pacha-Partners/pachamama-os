import { CadreEcran, EnteteEcran } from "@/components/vues/entreprise/atomes";
import { FormulaireBrief } from "@/components/vues/entreprise/FormulaireBrief";
import { mesMandats, monEntreprise } from "@/lib/entreprise/lectures";

export const metadata = { title: "Ouvrir un poste" };
export const dynamic = "force-dynamic";

/**
 * OUVRIR UN POSTE.
 *
 * La page lit les mandats du client pour une seule raison : en tirer la liste
 * des MÉTIERS qu'il emploie déjà. `ref.metier` n'est pas exposé au réseau, et
 * c'est le seul moyen honnête de proposer un choix — voir le commentaire
 * d'en-tête de `FormulaireBrief`.
 *
 * Le tri est alphabétique et les doublons sont retirés : la liste des postes
 * est triée par date, ce qui donnerait un sélecteur dans le désordre.
 */
export default async function Vue() {
  const [entreprise, mandats] = await Promise.all([
    monEntreprise(),
    mesMandats(),
  ]);

  const metiersConnus = [
    ...new Set(
      mandats.map((m) => m.metier).filter((m): m is string => Boolean(m)),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));

  return (
    <CadreEcran>
      <EnteteEcran
        descriptif="Ouvrir un"
        impact="poste"
        retour={{ href: "/entreprise", libelle: "Tous vos postes" }}
      />

      {/* ⚠ LE FORMULAIRE PORTE SA PROPRE COLONNE DE DROITE.
          Le fil d'étapes y vit, et il n'appartient qu'à lui : c'est son état.
          La page se contente de lui passer le relecteur, qu'elle sait lire.
          L'aside qui tenait ici dupliquait la carte de l'Account Manager. */}
      <FormulaireBrief
        metiersConnus={metiersConnus}
        relecteur={
          entreprise?.amNom
            ? {
                nom: entreprise.amNom,
                photo: entreprise.amPhoto,
                fonction: entreprise.amFonction,
              }
            : null
        }
      />
    </CadreEcran>
  );
}
