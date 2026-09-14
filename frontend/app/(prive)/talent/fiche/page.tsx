import { MaFiche } from '@/components/vues/talent/MaFiche';
import { SansFiche } from '@/components/vues/talent/SansFiche';
import { CadreEcran, EnteteEcran } from '@/components/vues/talent/atomes';
import { ficheAttentes, ficheProfil, mesPostes, referentiels } from '@/lib/talent/lectures';
import { signer } from '@/lib/stockage';

export const metadata = { title: 'Ma fiche' };
export const dynamic = 'force-dynamic';

/**
 * MA FICHE — l'écran unique, en trois sections.
 *
 * Il remplace « Mon profil », « Mes attentes » et « Mon parcours », qui
 * n'écrivaient rien d'autre que `core.fiche_talent`, ses six satellites et
 * `core.fiche_talent_poste`. Les trois anciennes routes redirigent ici, sur
 * l'ancre correspondante.
 *
 * ⚠ DEUX LECTURES DE LA MÊME LIGNE, ET C'EST VOULU.
 * `ficheProfil` et `ficheAttentes` interrogent la même fiche mais projettent
 * deux jeux de colonnes disjoints. Les fusionner en une lecture reviendrait à
 * charger les colonnes des deux pour tous les usages — or tout ce qui est lu
 * dans un composant serveur part dans le HTML servi, qu'un composant l'affiche
 * ou non. Un aller-retour de plus vaut mieux qu'une fiche entière sérialisée.
 *
 * ⚠ LES DEUX URL SIGNÉES SONT FABRIQUÉES ICI, SUR LE SERVEUR.
 * Le seau `documents-talent` est PRIVÉ : un `<a href>` ne peut pas pointer sur
 * l'objet. `signer` rend une URL valable cinq minutes, ou l'URL héritée telle
 * quelle quand la valeur n'est pas l'un de nos objets — mesuré, c'est le cas de
 * 3 926 `cv_url` sur 3 926 renseignés.
 *
 * `force-dynamic` n'est pas un réglage de confort : une URL signée expire, et
 * une page mise en cache servirait un lien mort.
 *
 * ⚠ SEPT VOCABULAIRES SUR DIX (D-15). `api.mon_referentiel` porte 769 lignes ;
 * cet écran en demande 387. Les trois autres — `metier_univers` (361 lignes),
 * `motif_retrait`, `etape` — ne sont affichés par aucun de ses champs.
 */
export default async function Vue() {
  const [profil, attentes, postes, vocabulaires] = await Promise.all([
    ficheProfil(),
    ficheAttentes(),
    mesPostes(),
    referentiels('metier', 'univers', 'secteur', 'critere', 'expertise', 'contrat', 'remote'),
  ]);
  if (!profil || !attentes) return <SansFiche objet="votre dossier candidat" />;

  const [cvHref, photoHref] = await Promise.all([
    signer(profil.cvUrl ?? null),
    signer(profil.photoUrl ?? null),
  ]);

  return (
    <CadreEcran>
      <EnteteEcran
        descriptif="Votre fiche"
        impact={[profil.prenom, profil.nom].filter(Boolean).join(' ') || 'à compléter'}
      />
      <MaFiche
        profil={profil}
        attentes={attentes}
        postes={postes}
        cvHref={cvHref}
        photoHref={photoHref}
        vocabulaires={{
          metier: vocabulaires.metier ?? [],
          univers: vocabulaires.univers ?? [],
          secteur: vocabulaires.secteur ?? [],
          critere: vocabulaires.critere ?? [],
          expertise: vocabulaires.expertise ?? [],
          contrat: vocabulaires.contrat ?? [],
          remote: vocabulaires.remote ?? [],
        }}
      />
    </CadreEcran>
  );
}
