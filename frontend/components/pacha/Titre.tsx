import { FormeHorizontale1 } from "./Illustration";
import { cn } from "@/lib/utils";

/**
 * Titre — le duo de la marque.
 *
 * Règle non négociable de la charte : jamais une ligne sans l'autre. La ligne
 * descriptive est en Instrument Serif, la ligne d'impact en Bricolage
 * Grotesque SemiBold, et **les deux ont la même taille** — la hiérarchie vient
 * du contraste serif/sans, jamais d'un écart de corps. C'est ce qui distingue
 * un titre Pachamama d'un titre générique.
 */
export function Titre({
  niveau = 2,
  descriptif,
  impact,
  souligne,
  disposition = "colonne",
  ton = "defaut",
  className,
}: {
  niveau?: 1 | 2;
  /**
   * `colonne` — les deux lignes l'une sous l'autre, la mise en page d'origine.
   * `ligne`   — côte à côte, gouttière 10px. C'est le titre de la page jobs :
   *             « Les jobs » puis « Pachamama » sur une même ligne de 39px.
   *             La règle de la charte est intacte, les deux lignes gardent la
   *             même taille et le contraste serif/sans porte seul la hiérarchie.
   */
  disposition?: "colonne" | "ligne";
  /** La ligne descriptive, en serif. Optionnelle uniquement pour un H3 d'interface. */
  descriptif?: string;
  /**
   * Un trait de feutre sous la ligne d'impact.
   *
   * ⚠ UNE SEULE FOIS PAR PARCOURS, ET SUR L'ÉCRAN D'ACCUEIL. Les formes de la
   * marque sont des marques d'ANNOTATION : elles disent « regardez ça ». En
   * poser une sur chaque titre du portail reviendrait à tout souligner, donc à
   * ne plus rien désigner. L'accueil est le seul écran qui salue ; c'est le
   * seul qui la porte.
   */
  souligne?: boolean;
  /** La ligne d'impact, en sans. Toujours présente. */
  impact: string;
  /**
   * LA COULEUR DOIT ÊTRE PORTÉE JUSQU'AUX DEUX `<span>`. Ils portent
   * `t-h1/2` et `t-h1/2-comp`, dont le CSS fixe `color: var(--black)` : une
   * couleur posée sur le `<h2>` ne les atteint pas. Un `text-white` au point
   * d'appel ne faisait donc rien, et le titre du bloc noir de la fiche d'offre
   * restait invisible.
   *
   *   `defaut`  — les deux en noir.
   *   `inverse` — les deux en blanc, pour une surface sombre.
   *   `discret` — le descriptif en `--encre-600`, l'impact en noir. C'est le
   *               titre « L'entreprise / Kelvin » de la fiche d'offre, où le
   *               Figma met la ligne serif en #5D6979 (:100) et le nom en noir.
   */
  ton?: "defaut" | "inverse" | "discret";
  className?: string;
}) {
  const Balise = niveau === 1 ? "h1" : "h2";
  return (
    <Balise
      className={cn(
        "flex",
        disposition === "ligne"
          ? "flex-row flex-wrap items-center gap-2.5"
          : "flex-col gap-1.5",
        className,
      )}
    >
      {descriptif && (
        <span
          className={cn(
            niveau === 1 ? "t-h1-comp" : "t-h2-comp",
            ton === "inverse" && "text-white",
            ton === "discret" && "text-[var(--encre-600)]",
          )}
        >
          {descriptif}
        </span>
      )}
      <span
        className={cn(
          niveau === 1 ? "t-h1" : "t-h2",
          ton === "inverse" && "text-white",
          souligne && "relative inline-block",
        )}
      >
        {impact}
        {/* ⚠ LE TRAIT EST POSÉ ICI ET NULLE PART AILLEURS, parce que c'est le
            seul endroit qui connaisse la LARGEUR DU MOT. Placé par l'écran, il
            aurait fallu lui donner une cote en dur : trop court sous « Mon
            espace », débordant sous « process ». En recouvrement sur le span du
            texte, il l'épouse quelle que soit la chaîne et quelle que soit la
            taille de police.

            `-bottom-2` : le tracé du feutre porte son propre blanc tournant, le
            coller au texte le ferait mordre sur les jambages. */}
        {souligne && (
          <FormeHorizontale1
            etirer
            className={cn(
              // 48px de HAUT pour un trait qui n'en montre que dix : l'encre
              // n'occupe que le cinquième médian du viewBox, il faut donc une
              // boîte cinq fois plus haute que le trait voulu. Le décalage
              // `calc(100% - 20px)` remonte cette boîte pour que son centre
              // encré tombe quatre pixels sous le mot. Cotes vérifiées au
              // rendu, contre trois autres essais.
              "pointer-events-none absolute left-0 top-[calc(100%-20px)] h-12 w-full",
              ton === "inverse" ? "text-[var(--violet-200)]" : "text-[var(--violet-400)]",
            )}
          />
        )}
      </span>
    </Balise>
  );
}

/** Titre de section d'interface — pas de duo à ce niveau, le Figma non plus. */
export function TitreSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h3 className={cn("t-h3", className)}>{children}</h3>;
}
