"use client";

import { Select } from "@base-ui/react/select";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useEstMobile } from "@/lib/media";
import { cn } from "@/lib/utils";
import { Bouton } from "./Bouton";
import { CaseVisuelle } from "./Cases";
import { Feuille } from "./Feuille";
import { ListeItem } from "./ListeItem";
import {
  CHAMP_BOITIER,
  CHAMP_DESACTIVE,
  CHAMP_ERREUR,
  CHAMP_SUBSTITUT_OPTIONS,
  CHAMP_SURVOL,
  CHAMP_VALEUR,
  CadreChamp,
} from "./Champ";
import { TagUnivers, type Univers } from "./Tag";

/**
 * LES MENUS DÉROULANTS — `Input / dropdown` (Figma.md:13464) et
 * `Input / Agent select` (Figma.md:15724).
 *
 * ┌─ NOTE DU DESIGNER, RECOPIÉE DU FIGMA (:21582) ────────────────────────────┐
 * │ « Note: the multiple choice dropdown input should be used only if the tag  │
 * │   system is not working in this specific case. »                          │
 * └───────────────────────────────────────────────────────────────────────────┘
 * Autrement dit : pour choisir PLUSIEURS valeurs, le système de tags
 * (`ChampTags`) est le choix par défaut, et `SelecteurMulti` le recours. La
 * raison est lisible dans la maquette : un déroulant multi replié n'affiche ses
 * choix qu'en pastilles tassées (`State=Filled, Multiselect=True`, :14544), alors
 * que les tags les montrent tous, retirables un par un. `SelecteurMulti` existe
 * pour les listes trop longues à étaler — pas pour trois contrats.
 *
 * LE DÉCLENCHEUR est le boîtier de `Champ` (même couche `Input / Search/Default`
 * réutilisée par le Figma), plus un chevron de 20px poussé à droite. Ses états
 * sont donc ceux de `Champ`, avec une addition : « ouvert » se peint comme
 * « focus » (bordure 2px noire + ombre douce), ce que le Figma confirme en
 * donnant à `State=Focus, Opened=Opened` (:14840) exactement le déclencheur de
 * `State=Focus, Opened=Closed` (:14093).
 *
 * LE PANNEAU (:14991) : 156px de haut au maximum, fond blanc, bordure 2px noire,
 * rayon 8px, retrait vertical 4px, posé 4px sous le déclencheur (gouttière de la
 * colonne parente, :14847). Il n'a PAS d'ombre — le Figma n'en donne qu'au
 * déclencheur. On ne lui en ajoute pas.
 *
 * QUATRE TYPES DE LISTE, tous relevés
 *   Simple dropdown   texte seul                              :19249
 *   Multiselect       case à cocher + texte                   :19504
 *   Univers           case à cocher + tag de verticale        :19827
 *   Picture dropdown  photo ronde de 42px + nom en gras       :20309
 *
 * POURQUOI @base-ui/react
 * Flèches, Entrée, Échap, Début/Fin, saisie au clavier pour atteindre une option,
 * fermeture au clic extérieur, `aria-expanded`, `aria-activedescendant`, retour
 * du focus au déclencheur : c'est une centaine de lignes de code de pièges, et
 * `Select` de `@base-ui/react` les tient déjà. On n'écrit ici que le vêtement.
 * Les composants shadcn de `components/ui/select.tsx` enveloppent la même
 * primitive, mais avec le thème shadcn (`border-input`, `bg-primary`…) qu'il
 * faudrait défaire classe par classe : on attaque la primitive directement.
 */

/* ── Types et recettes partagées ───────────────────────────────────────────── */

export type Option<V extends string = string> = {
  valeur: V;
  libelle: string;
  desactive?: boolean;
};

/** Une option de la liste `Univers` : le libellé est porté par le tag. Figma.md:19827 */
export type OptionUnivers = {
  valeur: Univers;
  libelle?: string;
  desactive?: boolean;
};

/** Une option de la liste `Picture dropdown` / `Agent select`. Figma.md:20309 */
export type OptionPersonne<V extends string = string> = {
  valeur: V;
  libelle: string;
  /** URL de la photo. Absente, les initiales prennent la place. */
  photo?: string;
  desactive?: boolean;
};

/** Le panneau ouvert. Figma.md:14991 */
export const PANNEAU_DEROULANT = cn(
  "box-border w-[var(--anchor-width)] max-h-[156px] overflow-y-auto",
  "rounded-[var(--r-md)] border-2 border-black bg-white py-1",
  // Barre de défilement fine, teinte #ADABB3. Figma.md:15244
  "[scrollbar-color:var(--encre-250)_transparent] [scrollbar-width:thin]",
);

/** La pile d'options à l'intérieur du panneau : retrait 4px, gouttière 8px. Figma.md:15020 */
export const LISTE_DEROULANTE = "flex flex-col gap-2 p-1";

/**
 * Un élément de liste. Axes du Figma : `Resting` × `Multiselect` × `Type`,
 * onze combinaisons présentes (:17713 à :18422).
 *
 * `Default` n'a pas de fond, `Hover` prend #F8F5FF (:17768), `Clicked` prend
 * #E9E0FF (:17811), `Selected` reprend #F8F5FF (:18020). `Hover` est double ici :
 * la pseudo-classe pour la souris, `data-highlighted` pour le clavier — sans quoi
 * naviguer aux flèches ne montrerait rien.
 *
 * ⚠ CORRECTIF DU 09/09/2026 — le fond seul ne suffisait pas au clavier.
 * #F8F5FF sur blanc mesure **1,03:1** : c'est une teinte, pas un indicateur de
 * focus. Combiné à `outline-none`, naviguer aux flèches ne montrait rien du
 * tout, ce qui contredit la règle de base du projet (« :focus-visible jamais
 * supprimé », `globals.css`) et échoue à WCAG 2.4.11.
 *
 * L'anneau est posé sur `:focus-visible` SEUL, jamais sur `data-highlighted` :
 * la souris garde exactement l'apparence du Figma, le clavier gagne un
 * indicateur qui se voit. L'`outline-none` devient `focus:outline-none` pour
 * n'étouffer que le focus non visible.
 */
export const ELEMENT_LISTE = cn(
  "flex cursor-pointer items-center rounded-[var(--r-xs)] select-none focus:outline-none",
  "t-body text-black",
  "hover:bg-[var(--violet-050)] data-highlighted:bg-[var(--violet-050)]",
  "focus-visible:outline-2 focus-visible:outline-[var(--focus-anneau)] focus-visible:-outline-offset-2",
  "data-selected:bg-[var(--violet-050)]",
  "active:bg-[var(--violet-100)]",
  "data-disabled:cursor-not-allowed data-disabled:text-[var(--encre-300)] data-disabled:bg-transparent",
);

/* ── Le déclencheur ────────────────────────────────────────────────────────── */

/**
 * Les classes du déclencheur. « Ouvert » emprunte le vêtement du focus.
 * Figma.md:13561 (repos), :14020 (survol), :14171 (focus / ouvert).
 */
function classesDeclencheur(erreur?: boolean, pourTags?: boolean) {
  return cn(
    CHAMP_BOITIER,
    "justify-between text-left",
    CHAMP_VALEUR,
    CHAMP_SURVOL,
    // Focus clavier ET panneau ouvert : bordure 2px noire, retrait compensé à 7px.
    "enabled:focus-visible:border-2 enabled:focus-visible:border-black enabled:focus-visible:px-[7px]",
    "enabled:focus-visible:shadow-[var(--ombre-douce)]",
    "data-popup-open:border-2 data-popup-open:border-black data-popup-open:px-[7px]",
    "data-popup-open:shadow-[var(--ombre-douce)]",
    CHAMP_DESACTIVE,
    // `State=Filled for tags` (:14244) : le déclencheur se teinte de violet 050
    // pour dire « des choix ont été faits, et ils sont affichés en tags ailleurs
    // sur l'écran ». C'est le cas du déroulant qui alimente un `ChampTags`.
    pourTags && "bg-[var(--violet-050)]",
    erreur && CHAMP_ERREUR,
    erreur && "data-popup-open:border-[#ff2626] data-popup-open:border-2",
  );
}

/**
 * Le chevron. 20px, il suit la couleur de la bordure : noir au repos et au
 * focus (:13633, :14241), gris au survol (:14090), gris clair désactivé (:13939).
 */
/**
 * Les classes du chevron, extraites parce que DEUX branches les portent : le
 * déclencheur desktop, qui passe par `Select.Icon`, et le déclencheur mobile,
 * qui est un simple `<button>` hors de tout `Select.Root`. Y rendre `Chevron`
 * levait « SelectRootContext is missing » — `Select.Icon` est une pièce du
 * sélecteur, pas une icône ordinaire.
 */
const CLASSES_CHEVRON = cn(
  "size-5 shrink-0 text-black",
  "group-hover/declencheur:text-[var(--encre-600)]",
  "group-disabled/declencheur:text-[var(--encre-300)]",
);

function Chevron() {
  return (
    <Select.Icon
      render={<ChevronDown aria-hidden="true" className={CLASSES_CHEVRON} />}
    />
  );
}

/**
 * Le texte substitut, gris #738296. Figma.md:13604
 * `Select.Value` porte `flex-1 min-w-0` partout : son <span> ne se laisse sinon
 * ni étirer ni rétrécir, et les pastilles d'une multisélection débordent au lieu
 * de passer à la ligne.
 */
function Substitut({ children }: { children: React.ReactNode }) {
  return (
    <span className={cn(CHAMP_SUBSTITUT_OPTIONS, "truncate")}>{children}</span>
  );
}

/* ── Sélecteur simple ─────────────────────────────────────────────────────── */

export type ProprietesSelecteur<V extends string = string> = {
  libelle?: string;
  options: readonly Option<V>[];
  valeur?: V | null;
  valeurParDefaut?: V | null;
  onChangement?: (valeur: V | null) => void;
  /** Recopié du Figma. Figma.md:13592 */
  substitut?: string;
  erreur?: string;
  aide?: string;
  desactive?: boolean;
  requis?: boolean;
  nom?: string;
  className?: string;
  /** Ouverture pilotée depuis l'extérieur. Sinon le composant s'en occupe. */
  ouvert?: boolean;
  onOuvertChange?: (ouvert: boolean) => void;
  /**
   * `State=Filled for tags` (Figma.md:14244) : le déclencheur se teinte de
   * violet 050 quand les valeurs choisies sont affichées en tags AILLEURS sur
   * l'écran (typiquement au-dessous, dans un `ChampTags`).
   */
  teinteTags?: boolean;
};

/**
 * Selecteur — `Dropdown simple=Simple dropdown` (:19249).
 * Axes couverts : `State` × `Opened`, `Multiselect=False`.
 */
export function Selecteur<V extends string = string>({
  libelle,
  options,
  valeur,
  valeurParDefaut,
  onChangement,
  substitut = "Choisir des options",
  erreur,
  aide,
  desactive,
  requis,
  nom,
  className,
  ouvert,
  onOuvertChange,
  teinteTags,
}: ProprietesSelecteur<V>) {
  const id = useId();
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;
  const decrit = [erreur ? idErreur : null, aide && !erreur ? idAide : null]
    .filter(Boolean)
    .join(" ");

  return (
    <CadreChamp
      id={id}
      libelle={libelle}
      erreur={erreur}
      aide={aide}
      className={className}
    >
      <Select.Root<V, false>
        value={valeur}
        defaultValue={valeurParDefaut}
        onValueChange={(v) => onChangement?.(v)}
        disabled={desactive}
        required={requis}
        name={nom}
        open={ouvert}
        onOpenChange={onOuvertChange}
      >
        <Select.Trigger
          id={id}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit || undefined}
          aria-required={requis || undefined}
          className={cn(
            "group/declencheur",
            classesDeclencheur(Boolean(erreur), teinteTags),
          )}
        >
          <Select.Value className="min-w-0 flex-1">
            {(v: V | null) => {
              const choisie = options.find((o) => o.valeur === v);
              return choisie ? (
                <span className="truncate">{choisie.libelle}</span>
              ) : (
                <Substitut>{substitut}</Substitut>
              );
            }}
          </Select.Value>
          <Chevron />
        </Select.Trigger>

        <PanneauDeroulant>
          {options.map((o) => (
            <Select.Item
              key={o.valeur}
              value={o.valeur}
              disabled={o.desactive}
              // `Resting=* , Multiselect=False, Type=Text` : hauteur 35px,
              // retrait 8px, gouttière 10px. Figma.md:17713
              className={cn(ELEMENT_LISTE, "h-[35px] gap-2.5 px-2")}
            >
              <Select.ItemText className="truncate">
                {o.libelle}
              </Select.ItemText>
            </Select.Item>
          ))}
        </PanneauDeroulant>
      </Select.Root>
    </CadreChamp>
  );
}

/**
 * Le rendu de ce qui est choisi, dans le champ replié.
 *
 * Extrait du `Select.Value` de la branche desktop pour que les DEUX branches
 * disent la même chose. Écrit deux fois, il avait déjà divergé : le mobile
 * rendait le substitut en toute circonstance, donc une sélection faite dans la
 * feuille redevenait invisible dès la feuille refermée.
 */
function valeurRendue<V extends string>(
  valeurs: V[] | null,
  options: readonly Option<V>[],
  substitut: string,
  apparenceValeur: "pastilles" | "compte",
  teinteTags?: boolean,
): React.ReactNode {
  const choisies = (valeurs ?? []).map(
    (x) => options.find((o) => o.valeur === x)?.libelle ?? x,
  );
  // `State=Filled for tags` dit que les choix « sont affichés en tags AILLEURS
  // sur l'écran » : les répéter ici les montrerait deux fois.
  if (choisies.length === 0 || teinteTags)
    return <Substitut>{substitut}</Substitut>;
  if (apparenceValeur === "compte") {
    return (
      <span className="truncate">
        {choisies.length} sélectionné{choisies.length > 1 ? "s" : ""}
      </span>
    );
  }
  return choisies.map((libelleChoix) => (
    <PastilleReponse key={libelleChoix}>{libelleChoix}</PastilleReponse>
  ));
}

/**
 * L'ouverture de la feuille, et le brouillon qu'elle sème.
 *
 * `ouvert` / `onOuvertChange` sont documentés comme « ouverture pilotée depuis
 * l'extérieur » sur les deux sélecteurs. La branche mobile les ignorait :
 * l'ouverture n'obéissait qu'à son état interne, si bien qu'un appelant qui
 * pilotait son sélecteur perdait la main sous 768px, sans rien pour le lui
 * dire. Ce hook rend les deux modes équivalents.
 */
function useOuvertureFeuille<V extends string>(
  estMobile: boolean,
  valeurs: V[] | undefined,
  valeursParDefaut: V[] | undefined,
  ouvert: boolean | undefined,
  onOuvertChange: ((ouvert: boolean) => void) | undefined,
) {
  // La référence du déclencheur vit ici, avec l'ouverture : les deux ne servent
  // qu'ensemble, et `Feuille` en a besoin pour rendre le focus.
  const refDeclencheur = useRef<HTMLButtonElement>(null);
  const [ouvertureInterne, setOuvertureInterne] = useState(false);
  // `valeursParDefaut` sert de repli tant que le parent ne pilote pas la
  // valeur : sans lui, un sélecteur non piloté ouvrait sa feuille vierge alors
  // que son champ affichait déjà des choix.
  const [valeursInternes, setValeursInternes] = useState<V[]>(
    valeursParDefaut ?? [],
  );
  const [brouillon, setBrouillon] = useState<V[]>([]);

  const valeursEffectives = valeurs ?? valeursInternes;
  const ouvertureFeuille = ouvert ?? ouvertureInterne;

  const changerOuverture = (o: boolean) => {
    setOuvertureInterne(o);
    onOuvertChange?.(o);
  };

  /*
   * LE FRANCHISSEMENT DU SEUIL PENDANT QUE LA FEUILLE EST OUVERTE.
   *
   * Élargir la fenêtre au-delà de 768px rend l'autre arbre : la feuille est
   * démontée sèchement. Sans garde-fou, deux choses restaient en plan. Le
   * brouillon d'abord — des cases cochées, jamais enregistrées, jamais
   * annulées, et réapparaissant telles quelles à la prochaine ouverture. L'état
   * d'ouverture ensuite, plus grave : un appelant qui pilote son sélecteur
   * gardait `ouvert` à `true` pour toujours, sans jamais recevoir le
   * `onOuvertChange(false)` qui l'aurait détrompé.
   *
   * On ferme donc, et on jette le brouillon — c'est ce que fait « Annuler », et
   * c'est le seul choix honnête : l'interaction à laquelle ces choix
   * appartenaient n'existe plus. Les appliquer en silence serait pire.
   *
   * L'ajustement de l'état interne se fait EN PHASE DE RENDU et non dans un
   * effet : c'est le motif que React documente pour recaler un état sur un
   * changement de props, et il évite le rendu supplémentaire qu'un effet
   * imposerait. Prévenir le parent, en revanche, est un effet de bord : cela ne
   * peut pas se faire pendant le rendu, d'où l'effet ci-dessous — qui ne pose
   * aucun état, et ne déclenche donc pas de second rendu.
   */
  const [seuilPrecedent, setSeuilPrecedent] = useState(estMobile);
  if (seuilPrecedent !== estMobile) {
    setSeuilPrecedent(estMobile);
    if (!estMobile) {
      setOuvertureInterne(false);
      setBrouillon([]);
    }
  }

  useEffect(() => {
    if (!estMobile && ouvert) onOuvertChange?.(false);
  }, [estMobile, ouvert, onOuvertChange]);

  return {
    refDeclencheur,
    brouillon,
    setBrouillon,
    valeursEffectives,
    ouvertureFeuille,
    changerOuverture,
    ouvrirFeuille: () => {
      setBrouillon([...valeursEffectives]);
      changerOuverture(true);
    },
    enregistrer: (onChangement?: (v: V[]) => void) => {
      setValeursInternes(brouillon);
      onChangement?.(brouillon);
    },
  };
}

/**
 * DeclencheurFeuille — le champ replié, en mobile.
 *
 * Extrait parce que DEUX sélecteurs l'emploient, et qu'ils avaient déjà
 * divergé quand il était écrit deux fois : l'un conditionnait sa hauteur à
 * `apparenceValeur`, l'autre non. C'est le même travers que `Chevron`,
 * `Substitut` ou `classesDeclencheur` évitent partout ailleurs dans ce fichier.
 *
 * Ce n'est PAS un `Select.Trigger` : il n'y a pas de `Select.Root` en mobile,
 * et les pièces du sélecteur lèvent « SelectRootContext is missing » hors de
 * lui. D'où le chevron nu et l'apparence empruntée à `classesDeclencheur`, qui
 * reste la seule source de vérité pour les deux branches.
 */
function DeclencheurFeuille({
  ref,
  id,
  decrit,
  desactive,
  erreur,
  teinteTags,
  ouverte,
  onOuvrir,
  hauteurAuto,
  children,
}: {
  /** Transmise à `Feuille` pour que le focus revienne ici à la fermeture. */
  ref?: React.Ref<HTMLButtonElement>;
  id: string;
  decrit: string;
  desactive?: boolean;
  erreur?: string;
  teinteTags?: boolean;
  ouverte: boolean;
  onOuvrir: () => void;
  /** Le boîtier grandit avec les pastilles ou les tags qu'il affiche. */
  hauteurAuto?: boolean;
  /** Ce qui est choisi, ou le texte substitut — jamais rien. */
  children: React.ReactNode;
}) {
  return (
    <button
      ref={ref}
      type="button"
      id={id}
      disabled={desactive}
      aria-haspopup="dialog"
      aria-expanded={ouverte}
      // Ni `aria-invalid` ni `aria-required` ici, contrairement au déclencheur
      // desktop : là-bas
      // le rôle implicite est `combobox`, qui l'accepte ; ici c'est un bouton
      // qui ouvre un dialogue, et ces deux attributs n'y sont pas définis — la
      // règle `role-supports-aria-props` le signale. L'erreur reste annoncée
      // par `aria-describedby`, qui pointe le message lui-même — ce qui en dit
      // plus qu'un drapeau —, et l'obligation par l'astérisque que `CadreChamp`
      // pose sur le libellé.
      aria-describedby={decrit || undefined}
      onClick={onOuvrir}
      className={cn(
        "group/declencheur",
        classesDeclencheur(Boolean(erreur), teinteTags),
        hauteurAuto && "h-auto min-h-[var(--h-champ)] py-2",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left">
        {children}
      </span>
      <ChevronDown aria-hidden="true" className={CLASSES_CHEVRON} />
    </button>
  );
}

/* ── La feuille de sélection, en mobile ───────────────────────────────────── */

/**
 * FeuilleDeSelection — ce que devient une liste déroulante sous `md`.
 *
 * Annotée « Visualisation de l'ouverture du filtre spéciale mobile » sur la
 * maquette : les options passent dans une feuille modale plutôt que dans un
 * panneau ancré, parce qu'un panneau de 200px ancré à un champ de 95px, sur un
 * écran de 375, se retrouve à cheval sur le bord ou replié par-dessus le champ
 * qui l'a ouvert.
 *
 * LES CHOIX SONT UN BROUILLON, et c'est le vrai écart de comportement avec le
 * desktop, pas un détail d'habillage. En desktop chaque case cochée applique le
 * filtre immédiatement, la liste des offres se recomposant derrière le panneau,
 * visible. En mobile la feuille couvre tout : appliquer à chaque case ferait
 * travailler la page pour rien et priverait le visiteur de tout retour, d'où
 * les deux boutons du Figma. `Annuler` jette le brouillon, `Enregistrer`
 * l'applique en une fois.
 *
 * Le brouillon est réinitialisé À L'OUVERTURE et non par un effet : un effet
 * dépendant de `valeurs`, dont l'identité change à chaque rendu du parent,
 * écraserait les cases cochées pendant que la feuille est ouverte.
 */
function FeuilleDeSelection<V extends string>({
  titre,
  options,
  brouillon,
  onBrouillonChange,
  onEnregistrer,
  ouverte,
  onOuvertureChange,
  focusFinal,
  rendreOption,
}: {
  titre: string;
  /** `libelle` est optionnel : sur l'axe univers, c'est le tag qui porte le
      sien par défaut, et l'appelant n'a pas à le répéter. */
  options: readonly { valeur: V; libelle?: string; desactive?: boolean }[];
  brouillon: V[];
  onBrouillonChange: (v: V[]) => void;
  onEnregistrer: () => void;
  ouverte: boolean;
  onOuvertureChange: (ouverte: boolean) => void;
  /** Le déclencheur, à qui rendre le focus à la fermeture. */
  focusFinal?: React.RefObject<HTMLElement | null>;
  /** Le rendu d'une option : un tag teinté pour l'univers, du texte ailleurs. */
  rendreOption: (option: { valeur: V; libelle?: string }) => React.ReactNode;
}) {
  const basculer = (valeur: V) =>
    onBrouillonChange(
      brouillon.includes(valeur)
        ? brouillon.filter((v) => v !== valeur)
        : [...brouillon, valeur],
    );

  return (
    <Feuille
      titre={titre}
      ouverte={ouverte}
      onOuvertureChange={onOuvertureChange}
      focusFinal={focusFinal}
      actions={
        <>
          {/* `Annuler` : fond blanc, filet noir — c'est `contour` du DS. */}
          <Bouton apparence="contour" onClick={() => onOuvertureChange(false)}>
            Annuler
          </Bouton>
          <Bouton
            apparence="plein"
            onClick={() => {
              onEnregistrer();
              onOuvertureChange(false);
            }}
          >
            Enregistrer
          </Bouton>
        </>
      }
    >
      {/* Une liste de cases, pas un groupe de `Case` : le libellé n'est pas du
          texte mais un tag teinté sur l'axe univers, et `ListeItem` est déjà
          la rangée cliquable du design system — c'est elle que nomme le Figma
          (« List item », avec « Rectangle 11 » pour la case). */}
      {/* UNE LISTE VIDE SE DIT. Sans ce cas, la feuille s'ouvrait sur 453px de
          blanc surmontés d'un titre, avec deux boutons en bas : rien
          n'indiquait s'il n'y avait aucune option ou si le chargement avait
          échoué. C'est le pendant de la règle du job board — un filtre qui ne
          propose rien tend un piège au visiteur. */}
      {options.length === 0 ? (
        <p className="t-body px-2 py-4 text-[var(--encre-500)]">
          Aucune option disponible pour le moment.
        </p>
      ) : (
        /* `List items` du Figma : retrait 4px (Job_board_mobile.md:13569),
         gouttière 8px entre les rangées. */
        <ul className="flex flex-col gap-2 p-1">
          {options.map((o) => {
            const cochee = brouillon.includes(o.valeur);
            return (
              // PAS d'enveloppe <li> ici : `ListeItem` émet déjà la sienne
              // (ListeItem.tsx:77 et :82). En ajouter une imbriquait deux <li>,
              // ce qui doublait chaque libellé pour les aides techniques —
              // mesuré, six éléments annoncés pour trois options.
              //
              // `onClic` est TOUJOURS fourni, même sur une option désactivée :
              // sans lui, `ListeItem` bascule sur sa branche sans bouton et rend
              // un <li> nu, qui perd `aria-pressed`, le rôle, la tabulation et
              // l'annonce de l'état désactivé. C'est `desactive` qui neutralise
              // le clic, en posant l'attribut `disabled` sur le bouton.
              <ListeItem
                key={o.valeur}
                selectionne={cochee}
                desactive={o.desactive}
                onClic={() => basculer(o.valeur)}
                // Le calque `List item` du Figma donne `gap: 8px` (:13590), pas
                // 16 : `gap-4` inventait une gouttière que rien ne demandait.
                className="gap-2"
              >
                {/* `CaseVisuelle` pose déjà son propre `aria-hidden`
                  (Cases.tsx:62) : l'envelopper une seconde fois n'ajoutait
                  qu'un nœud. C'est le bouton de la rangée qui porte l'état. */}
                <CaseVisuelle cochee={cochee} />
                {rendreOption(o)}
              </ListeItem>
            );
          })}
        </ul>
      )}
    </Feuille>
  );
}

/* ── Sélecteur multiple ───────────────────────────────────────────────────── */

export type ProprietesSelecteurMulti<V extends string = string> = Omit<
  ProprietesSelecteur<V>,
  "valeur" | "valeurParDefaut" | "onChangement"
> & {
  valeurs?: V[];
  valeursParDefaut?: V[];
  onChangement?: (valeurs: V[]) => void;
  /**
   * Comment le déclencheur replié montre ce qui est choisi.
   * `'pastilles'` = `State=Filled, Multiselect=True` (:14544, quatre pastilles
   * violet 050 qui passent à la ligne) ; `'compte'` = une ligne de texte, pour
   * les sélections longues que le Figma ne montre pas repliées.
   */
  apparenceValeur?: "pastilles" | "compte";
};

/**
 * SelecteurMulti — `Dropdown simple=Multiselect` (:19504).
 *
 * À n'employer que si `ChampTags` ne convient pas : voir la note du designer en
 * tête de fichier.
 */
export function SelecteurMulti<V extends string = string>({
  libelle,
  options,
  valeurs,
  valeursParDefaut,
  onChangement,
  substitut = "Choisir des options",
  apparenceValeur = "pastilles",
  erreur,
  aide,
  desactive,
  requis,
  nom,
  className,
  ouvert,
  onOuvertChange,
  teinteTags,
}: ProprietesSelecteurMulti<V>) {
  const id = useId();
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;
  const decrit = [erreur ? idErreur : null, aide && !erreur ? idAide : null]
    .filter(Boolean)
    .join(" ");

  const estMobile = useEstMobile();
  const feuille = useOuvertureFeuille<V>(
    estMobile,
    valeurs,
    valeursParDefaut,
    ouvert,
    onOuvertChange,
  );
  const {
    refDeclencheur,
    brouillon,
    setBrouillon,
    valeursEffectives,
    ouvertureFeuille,
    changerOuverture,
    ouvrirFeuille,
  } = feuille;

  // Sous `md`, le même champ ouvre une feuille modale au lieu d'un panneau
  // ancré : ce n'est pas la même interaction, donc pas le même arbre.
  if (estMobile) {
    return (
      <CadreChamp
        id={id}
        libelle={libelle}
        erreur={erreur}
        aide={aide}
        className={className}
      >
        <DeclencheurFeuille
          ref={refDeclencheur}
          id={id}
          decrit={decrit}
          desactive={desactive}
          erreur={erreur}
          teinteTags={teinteTags}
          ouverte={ouvertureFeuille}
          onOuvrir={ouvrirFeuille}
          hauteurAuto={apparenceValeur === "pastilles"}
        >
          {/* LE DÉCLENCHEUR MONTRE CE QUI EST CHOISI, comme en desktop. Rendre
              le substitut sans condition rendait la sélection invisible une
              fois la feuille refermée : sur la page jobs le défaut passait
              inaperçu, `teinteTags` y demandant justement de garder le libellé,
              mais partout ailleurs le champ mentait. Même règle que le
              `Select.Value` de la branche desktop, et un seul endroit la dit. */}
          {valeurRendue(
            valeursEffectives,
            options,
            substitut,
            apparenceValeur,
            teinteTags,
          )}
        </DeclencheurFeuille>

        <FeuilleDeSelection<V>
          titre={libelle ?? substitut}
          options={options}
          brouillon={brouillon}
          onBrouillonChange={setBrouillon}
          onEnregistrer={() => feuille.enregistrer(onChangement)}
          ouverte={ouvertureFeuille}
          onOuvertureChange={changerOuverture}
          focusFinal={refDeclencheur}
          rendreOption={(o) => (
            <span className="truncate">{o.libelle ?? o.valeur}</span>
          )}
        />
      </CadreChamp>
    );
  }

  return (
    <CadreChamp
      id={id}
      libelle={libelle}
      erreur={erreur}
      aide={aide}
      className={className}
    >
      <Select.Root<V, true>
        multiple
        value={valeurs}
        defaultValue={valeursParDefaut}
        onValueChange={(v) => onChangement?.(v)}
        disabled={desactive}
        required={requis}
        name={nom}
        open={ouvert}
        onOpenChange={onOuvertChange}
      >
        <Select.Trigger
          id={id}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit || undefined}
          aria-required={requis || undefined}
          className={cn(
            "group/declencheur",
            classesDeclencheur(Boolean(erreur), teinteTags),
            // Le boîtier grandit avec les pastilles : 8 + 64 + 8 = 80px pour deux
            // rangées dans le Figma (:14619). On garde 36px comme plancher.
            apparenceValeur === "pastilles" &&
              "h-auto min-h-[var(--h-champ)] py-2",
          )}
        >
          <Select.Value className="min-w-0 flex-1">
            {(v: V[] | null) => {
              const choisies = (v ?? []).map(
                (x) => options.find((o) => o.valeur === x)?.libelle ?? x,
              );
              // `State=Filled for tags` dit que les choix « sont affichés en
              // tags AILLEURS sur l'écran ». Les répéter dans le déclencheur
              // les montrerait deux fois et ferait grandir le champ à chaque
              // clic, ce que la maquette de la page jobs ne fait pas : elle
              // garde « Univers » et teinte le fond. On s'en tient à ça.
              if (choisies.length === 0 || teinteTags)
                return <Substitut>{substitut}</Substitut>;
              if (apparenceValeur === "compte") {
                return (
                  <span className="truncate">
                    {choisies.length} sélectionné
                    {choisies.length > 1 ? "s" : ""}
                  </span>
                );
              }
              return (
                // `Answers` — rangée qui passe à la ligne, gouttière 10px. Figma.md:14632
                <span className="flex flex-1 flex-wrap items-center gap-2.5">
                  {choisies.map((libelleChoix) => (
                    <PastilleReponse key={libelleChoix}>
                      {libelleChoix}
                    </PastilleReponse>
                  ))}
                </span>
              );
            }}
          </Select.Value>
          <Chevron />
        </Select.Trigger>

        <PanneauDeroulant>
          {options.map((o) => (
            <Select.Item
              key={o.valeur}
              value={o.valeur}
              disabled={o.desactive}
              // `Resting=*, Multiselect=True, Type=Text` : hauteur 36px,
              // gouttière 8px. Figma.md:17841
              className={cn(ELEMENT_LISTE, "h-9 gap-2 px-2")}
            >
              <CaseDeListe />
              <Select.ItemText className="truncate">
                {o.libelle}
              </Select.ItemText>
            </Select.Item>
          ))}
        </PanneauDeroulant>
      </Select.Root>
    </CadreChamp>
  );
}

/* ── Sélecteur d'univers ──────────────────────────────────────────────────── */

/**
 * SelecteurUnivers — `Dropdown simple=Univers` (:19827).
 *
 * Les options sont des tags de verticale. Le tag vient de `Tag.tsx` (LOT 3) : on
 * ne le redessine pas ici, sous peine d'avoir deux vérités sur la même pastille.
 * L'élément de liste passe en retrait 4px 8px pour laisser respirer un tag de
 * 27px dans une ligne de 35px (:18130).
 */
export function SelecteurUnivers({
  libelle,
  options,
  valeurs,
  valeursParDefaut,
  onChangement,
  substitut = "Choisir des options",
  erreur,
  aide,
  desactive,
  requis,
  nom,
  className,
  ouvert,
  onOuvertChange,
  teinteTags,
}: Omit<ProprietesSelecteurMulti<Univers>, "options" | "apparenceValeur"> & {
  options: readonly OptionUnivers[];
}) {
  const id = useId();
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;
  const decrit = [erreur ? idErreur : null, aide && !erreur ? idAide : null]
    .filter(Boolean)
    .join(" ");

  const estMobile = useEstMobile();
  const feuille = useOuvertureFeuille<Univers>(
    estMobile,
    valeurs,
    valeursParDefaut,
    ouvert,
    onOuvertChange,
  );
  const {
    refDeclencheur,
    brouillon,
    setBrouillon,
    valeursEffectives,
    ouvertureFeuille,
    changerOuverture,
    ouvrirFeuille,
  } = feuille;

  // Sous `md`, le même champ ouvre une feuille modale au lieu d'un panneau
  // ancré : ce n'est pas la même interaction, donc pas le même arbre.
  if (estMobile) {
    return (
      <CadreChamp
        id={id}
        libelle={libelle}
        erreur={erreur}
        aide={aide}
        className={className}
      >
        <DeclencheurFeuille
          ref={refDeclencheur}
          id={id}
          decrit={decrit}
          desactive={desactive}
          erreur={erreur}
          teinteTags={teinteTags}
          ouverte={ouvertureFeuille}
          onOuvrir={ouvrirFeuille}
          hauteurAuto
        >
          {/* Comme en desktop : les tags choisis, ou le substitut. */}
          {valeursEffectives.length === 0 || teinteTags ? (
            <Substitut>{substitut}</Substitut>
          ) : (
            valeursEffectives.map((u) => <TagUnivers key={u} univers={u} />)
          )}
        </DeclencheurFeuille>

        <FeuilleDeSelection<Univers>
          titre={libelle ?? substitut}
          options={options}
          brouillon={brouillon}
          onBrouillonChange={setBrouillon}
          onEnregistrer={() => feuille.enregistrer(onChangement)}
          ouverte={ouvertureFeuille}
          onOuvertureChange={changerOuverture}
          focusFinal={refDeclencheur}
          rendreOption={(o) => (
            <TagUnivers univers={o.valeur}>{o.libelle}</TagUnivers>
          )}
        />
      </CadreChamp>
    );
  }

  return (
    <CadreChamp
      id={id}
      libelle={libelle}
      erreur={erreur}
      aide={aide}
      className={className}
    >
      <Select.Root<Univers, true>
        multiple
        value={valeurs}
        defaultValue={valeursParDefaut}
        onValueChange={(v) => onChangement?.(v)}
        disabled={desactive}
        required={requis}
        name={nom}
        open={ouvert}
        onOpenChange={onOuvertChange}
      >
        <Select.Trigger
          id={id}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit || undefined}
          aria-required={requis || undefined}
          className={cn(
            "group/declencheur",
            classesDeclencheur(Boolean(erreur), teinteTags),
            "h-auto min-h-[var(--h-champ)] py-2",
          )}
        >
          <Select.Value className="min-w-0 flex-1">
            {(v: Univers[] | null) =>
              // Même règle que SelecteurMulti : quand les tags sont rendus
              // ailleurs (`teinteTags`), le déclencheur garde son libellé.
              (v ?? []).length === 0 || teinteTags ? (
                <Substitut>{substitut}</Substitut>
              ) : (
                <span className="flex flex-1 flex-wrap items-center gap-2">
                  {(v ?? []).map((u) => (
                    <TagUnivers key={u} univers={u} />
                  ))}
                </span>
              )
            }
          </Select.Value>
          <Chevron />
        </Select.Trigger>

        <PanneauDeroulant>
          {options.map((o) => (
            <Select.Item
              key={o.valeur}
              value={o.valeur}
              disabled={o.desactive}
              label={o.libelle ?? o.valeur}
              // `Resting=*, Multiselect=True, Type=Tag` : retrait 4px 8px,
              // gouttière 8px, hauteur 35px. Figma.md:18123
              className={cn(ELEMENT_LISTE, "h-[35px] gap-2 px-2 py-1")}
            >
              <CaseDeListe />
              {/* Le nom lisible de la verticale est porté par le tag lui-même ;
                  `label` le redonne à la recherche au clavier de base-ui. */}
              <Select.ItemText render={<span />} className="flex items-center">
                <TagUnivers univers={o.valeur} />
              </Select.ItemText>
            </Select.Item>
          ))}
        </PanneauDeroulant>
      </Select.Root>
    </CadreChamp>
  );
}

/* ── Sélecteur de personne (photo) ────────────────────────────────────────── */

export type ProprietesSelecteurPersonne<V extends string = string> = {
  libelle?: string;
  options: readonly OptionPersonne<V>[];
  valeur?: V | null;
  valeurParDefaut?: V | null;
  onChangement?: (valeur: V | null) => void;
  /** Recopié du Figma. Figma.md:15864 */
  substitut?: string;
  erreur?: string;
  aide?: string;
  desactive?: boolean;
  requis?: boolean;
  nom?: string;
  className?: string;
  ouvert?: boolean;
  onOuvertChange?: (ouvert: boolean) => void;
};

/**
 * SelecteurPersonne — `Input / Agent select` (:15724) et
 * `Dropdown simple=Picture dropdown` (:20309), qui sont le même composant vu
 * replié puis déplié.
 *
 * Particularité relevée : une fois REMPLI, le déclencheur passe de 36px à 50px
 * pour loger la photo de 42px (:16273), et le nom passe en Body/Bold (:16325).
 * Tant qu'il est vide, il reste un déroulant de 36px avec son texte substitut
 * (:15864). Les deux hauteurs sont dans le Figma ; c'est bien un champ qui
 * grandit quand on le remplit.
 */
export function SelecteurPersonne<V extends string = string>({
  libelle,
  options,
  valeur,
  valeurParDefaut,
  onChangement,
  substitut = "Choisir un.e agent.e",
  erreur,
  aide,
  desactive,
  requis,
  nom,
  className,
  ouvert,
  onOuvertChange,
}: ProprietesSelecteurPersonne<V>) {
  const id = useId();
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;
  const decrit = [erreur ? idErreur : null, aide && !erreur ? idAide : null]
    .filter(Boolean)
    .join(" ");

  return (
    <CadreChamp
      id={id}
      libelle={libelle}
      erreur={erreur}
      aide={aide}
      className={className}
    >
      <Select.Root<V, false>
        value={valeur}
        defaultValue={valeurParDefaut}
        onValueChange={(v) => onChangement?.(v)}
        disabled={desactive}
        required={requis}
        name={nom}
        open={ouvert}
        onOpenChange={onOuvertChange}
      >
        <Select.Trigger
          id={id}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit || undefined}
          aria-required={requis || undefined}
          className={cn(
            "group/declencheur",
            classesDeclencheur(Boolean(erreur)),
            // Vide, le boîtier fait 36px (:15806). Rempli, il fait 50px pour
            // loger la photo de 42px, et son retrait vertical tombe à 0
            // (`padding: 0px 8px`, :16269). On laisse donc la hauteur au contenu,
            // avec 36px comme plancher : c'est vrai que le champ soit piloté ou
            // non, là où un test sur `valeur` raterait le mode autonome.
            "h-auto min-h-[var(--h-champ)] py-0",
          )}
        >
          <Select.Value className="min-w-0 flex-1">
            {(v: V | null) => {
              const choisie = options.find((o) => o.valeur === v);
              if (!choisie) return <Substitut>{substitut}</Substitut>;
              return (
                // `Agent name` — retrait 4px, gouttière 10px. Figma.md:16292
                <span className="flex min-w-0 flex-1 items-center gap-2.5 p-1">
                  <AvatarOption nom={choisie.libelle} photo={choisie.photo} />
                  <span className="t-body-bold truncate text-black">
                    {choisie.libelle}
                  </span>
                </span>
              );
            }}
          </Select.Value>
          <Chevron />
        </Select.Trigger>

        {/* Le panneau photo a un retrait de 4px sur les quatre côtés, là où les
            trois autres n'en ont que verticalement. Figma.md:16522 */}
        <PanneauDeroulant className="p-1">
          {options.map((o) => (
            <Select.Item
              key={o.valeur}
              value={o.valeur}
              disabled={o.desactive}
              label={o.libelle}
              // `Agent name` — hauteur 50px, retrait 4px, gouttière 10px.
              // Figma.md:20585 (repos), :20641 (survol), :20698 (cliqué).
              className={cn(ELEMENT_LISTE, "h-[50px] gap-2.5 p-1")}
            >
              <AvatarOption nom={o.libelle} photo={o.photo} />
              <Select.ItemText className="t-body-bold truncate text-black">
                {o.libelle}
              </Select.ItemText>
            </Select.Item>
          ))}
        </PanneauDeroulant>
      </Select.Root>
    </CadreChamp>
  );
}

/* ── Pièces communes ──────────────────────────────────────────────────────── */

/**
 * Le panneau, portail et positionnement compris.
 *
 * `alignItemWithTrigger={false}` : par défaut, `Select` de base-ui superpose
 * l'option choisie au déclencheur, à la manière d'un menu natif de macOS. Le
 * Figma pose le panneau SOUS le déclencheur, à 4px (:14847) — on désactive donc
 * l'alignement natif.
 */
function PanneauDeroulant({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Select.Portal>
      <Select.Positioner
        side="bottom"
        align="start"
        sideOffset={4}
        alignItemWithTrigger={false}
        className="z-50"
      >
        <Select.Popup className={cn(PANNEAU_DEROULANT, className)}>
          <Select.List className={LISTE_DEROULANTE}>{children}</Select.List>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  );
}

/**
 * La case d'un élément de liste multisélection.
 *
 * `Select.ItemIndicator` ne s'affiche que quand l'option est choisie : on peint
 * donc la case vide en dessous, et la case noire par-dessus. Ni l'une ni l'autre
 * n'est un contrôle — la sémantique est sur l'option (voir `CaseVisuelle`).
 * Figma.md:15472 (case vide), :18068 (case cochée noire).
 */
function CaseDeListe() {
  return (
    <span className="relative flex size-5 shrink-0 items-center justify-center">
      <CaseVisuelle />
      <Select.ItemIndicator className="absolute inset-0">
        <CaseVisuelle cochee />
      </Select.ItemIndicator>
    </span>
  );
}

/**
 * PastilleReponse — la pastille d'un choix dans un déclencheur multi replié.
 * Figma.md:14659 : retrait 4px, fond #F8F5FF, rayon 8px, hauteur 27px, texte noir.
 *
 * Ce n'est PAS un `Tag` de `Tag.tsx` : le Figma lui refuse la bordure noire et
 * l'ombre rétro que portent tous les tags. C'est un accusé de réception à
 * l'intérieur d'un champ, pas une étiquette de contenu — d'où sa place ici.
 */
export function PastilleReponse({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[27px] items-center rounded-[var(--r-md)] bg-[var(--violet-050)] p-1",
        "t-body text-black",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * AvatarOption — photo ronde de 42px. Figma.md:16308
 *
 * Le repli est obligatoire : une photo manquante ne doit ni trouer la ligne ni
 * la faire sauter. On garde donc le disque de 42px, rempli des initiales sur
 * fond violet 050 — même surface, même rythme, quelle que soit la donnée.
 */
/* Renommé depuis `Avatar` : `components/pacha/Avatar.tsx` exporte déjà un
   composant de ce nom, avec une autre API (`src` et une échelle de cotes, un
   repli géré par la primitive). Deux `Avatar` dans un même design system, c'est
   une collision à l'import et un doute permanent sur lequel utiliser. Celui-ci
   est l'avatar d'une OPTION de liste déroulante : son nom le dit maintenant. */
export function AvatarOption({
  nom,
  photo,
  className,
}: {
  nom: string;
  photo?: string;
  className?: string;
}) {
  const initiales = nom
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      // L'image de fond plutôt qu'un <img> : le Figma décrit un remplissage
      // (`background: url(...)`), et un fond ne casse pas la mise en page quand
      // l'URL est morte — il ne montre alors que les initiales dessous.
      style={
        photo ? { backgroundImage: `url(${JSON.stringify(photo)})` } : undefined
      }
      className={cn(
        "flex size-[42px] shrink-0 items-center justify-center overflow-hidden rounded-full",
        "bg-[var(--violet-050)] bg-cover bg-center",
        "t-caption-bold text-black",
        className,
      )}
    >
      {/* Les initiales restent sous la photo : décoratives quand elle existe,
          seul repère quand elle manque. Le nom est toujours écrit à côté, donc
          rien n'est perdu pour un lecteur d'écran. */}
      <span aria-hidden="true" className={photo ? "sr-only" : undefined}>
        {initiales}
      </span>
    </span>
  );
}
