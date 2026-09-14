"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Avatar } from "@/components/pacha/Avatar";
import { Bouton } from "@/components/pacha/Bouton";
import { Carte } from "@/components/pacha/Carte";
import { Champ as ChampSaisie } from "@/components/pacha/Champ";
import { Divider } from "@/components/pacha/Divider";
import { Icone } from "@/components/pacha/Icone";
import { Selecteur } from "@/components/pacha/Selecteur";
import { TagInfo } from "@/components/pacha/Tag";
import { useToasts } from "@/components/pacha/Toast";
import { ZoneTexte } from "@/components/pacha/ZoneTexte";
import { Champ, GrilleChamps } from "@/components/vues/entreprise/atomes";
import { useNonce } from "@/components/vues/entreprise/nonce";
import {
  UNIVERS_MANDAT,
  codeMetier,
  fourchette,
} from "@/lib/domaine/entreprise";
import { creerMandat } from "@/lib/entreprise/actions";
import { cn } from "@/lib/utils";

/**
 * OUVRIR UN POSTE — le brief en self-service, en quatre temps.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE CE FORMULAIRE PRODUIT, ET CE QU'IL NE PRODUIT PAS
 * ─────────────────────────────────────────────────────────────────────────
 * `api.creer_mandat` crée le mandat en statut `nouveau`, SANS publication et
 * SANS validation : `valide_par_am_le` reste nul, et aucun droit ne permet de
 * l'écrire depuis ce portail. Le sourcing ne démarre pas tant que l'Account
 * Manager n'a pas relu le brief. L'écran le dit AVANT (le bandeau de la
 * dernière étape), PENDANT (le libellé du bouton, « Transmettre le brief »,
 * jamais « Publier ») et APRÈS (le message de confirmation).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI QUATRE ÉTAPES, ET NON UN SEUL FORMULAIRE
 * ─────────────────────────────────────────────────────────────────────────
 * Quatorze champs à la suite se remplissent mal : on abandonne au milieu, et le
 * navigateur ne garde rien. Découpées, les quatre étapes tiennent chacune dans
 * un écran, et l'état vit ici — passer de l'étape 3 à l'étape 1 ne perd rien.
 * Le découpage suit l'ordre dans lequel un recruteur pose les questions : quel
 * poste, dans quel cadre, pour faire quoi, et on relit.
 *
 * ⚠ RIEN N'EST SAUVEGARDÉ AVANT LA DERNIÈRE ÉTAPE. C'est assumé : un brouillon
 * de mandat exigerait soit un `statut` de plus au référentiel, soit une table
 * de brouillons, deux décisions de modèle qui ne se prennent pas dans un
 * composant d'interface. Quitter la page perd la saisie, et l'avertissement du
 * navigateur ne se déclenche pas non plus — signalé au rapport.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE MÉTIER : PROPOSÉ, JAMAIS INVENTÉ
 * ─────────────────────────────────────────────────────────────────────────
 * `ref.metier` compte 238 entrées et n'est PAS exposé au réseau (`Accept-Profile:
 * ref` → « Only the following schemas are exposed »). On ne peut donc pas
 * afficher la liste. Ce que l'on peut faire sans rien inventer : proposer les
 * métiers que ce client emploie DÉJÀ sur ses propres mandats, dont on connaît
 * le libellé, et dériver leur code par la convention vérifiée par sonde le
 * 09/09 (`VP of Engineering` → `vp_of_engineering`). Hors de cette liste, le
 * champ reste vide et c'est l'Account Manager qui qualifie le métier — ce qu'il
 * fait de toute façon à la validation.
 */

const ETAPES = [
  { cle: "poste", titre: "Le poste" },
  { cle: "cadre", titre: "Le cadre" },
  { cle: "contenu", titre: "Le contenu" },
  { cle: "relecture", titre: "Relecture" },
] as const;

const CONTRATS = [
  { valeur: "cdi", libelle: "CDI" },
  { valeur: "freelance", libelle: "Freelance" },
  { valeur: "entrepreneur", libelle: "Entrepreneur" },
] as const;

type Brouillon = {
  titre: string;
  universCode: string | null;
  metierCode: string | null;
  contrat: "cdi" | "freelance" | "entrepreneur" | null;
  localisation: string;
  remoteInfos: string;
  experienceMinAnnees: string;
  salaireMinKe: string;
  salaireMaxKe: string;
  tjmMinEur: string;
  tjmMaxEur: string;
  missions: string;
  mustHave: string[];
  niceToHave: string[];
};

const VIDE: Brouillon = {
  titre: "",
  universCode: null,
  metierCode: null,
  contrat: null,
  localisation: "",
  remoteInfos: "",
  experienceMinAnnees: "",
  salaireMinKe: "",
  salaireMaxKe: "",
  tjmMinEur: "",
  tjmMaxEur: "",
  missions: "",
  mustHave: [],
  niceToHave: [],
};

export function FormulaireBrief({
  metiersConnus,
  relecteur,
}: {
  metiersConnus: string[];
  /** L'Account Manager de l'entreprise : celui qui relira ce brief. */
  relecteur?: {
    nom: string | null;
    photo: string | null;
    fonction: string | null;
  } | null;
}) {
  const router = useRouter();
  const { annoncer } = useToasts();
  const [enCours, demarrer] = useTransition();
  const [nonce, renouvelerNonce] = useNonce();

  const [etape, setEtape] = useState(0);
  const [b, setB] = useState<Brouillon>(VIDE);
  const [erreur, setErreur] = useState<{
    champ?: string;
    message: string;
  } | null>(null);

  const poser = <C extends keyof Brouillon>(cle: C, valeur: Brouillon[C]) => {
    setB((x) => ({ ...x, [cle]: valeur }));
    setErreur(null);
  };
  const err = (cle: keyof Brouillon) =>
    erreur?.champ === cle ? erreur.message : undefined;

  const optionsMetier = useMemo(
    () =>
      metiersConnus.map((libelle) => ({
        valeur: codeMetier(libelle),
        libelle,
      })),
    [metiersConnus],
  );

  // Le TJM ne concerne que les missions en régie ; le salaire annuel, l'emploi.
  // Montrer les quatre champs en même temps invite à remplir les quatre, et
  // `app.controler_brief` accepterait — on écrirait alors une fourchette qui ne
  // veut rien dire. Tant que le contrat n'est pas choisi, on montre les deux
  // blocs : le client peut vouloir ouvrir sans trancher.
  const montreSalaire = b.contrat !== "freelance";
  const montreTjm = b.contrat === null || b.contrat === "freelance";

  const titreValide = b.titre.trim().length >= 3;

  function transmettre() {
    demarrer(async () => {
      const r = await creerMandat({
        titre: b.titre,
        universCode: b.universCode,
        metierCode: b.metierCode,
        contrat: b.contrat,
        localisation: b.localisation,
        remoteInfos: b.remoteInfos,
        experienceMinAnnees: b.experienceMinAnnees,
        salaireMinKe: montreSalaire ? b.salaireMinKe : null,
        salaireMaxKe: montreSalaire ? b.salaireMaxKe : null,
        tjmMinEur: montreTjm ? b.tjmMinEur : null,
        tjmMaxEur: montreTjm ? b.tjmMaxEur : null,
        missions: b.missions,
        mustHave: b.mustHave,
        niceToHave: b.niceToHave,
        nonce,
      });
      if (r.ok) {
        annoncer({ titre: r.message, ton: "succes", duree: 8000 });
        renouvelerNonce();
        // Sur le mandat créé quand on en connaît l'identifiant, sur le tableau
        // de bord sinon. Rester sur un formulaire vidé laisserait croire que
        // rien n'est parti.
        router.push(
          r.mandatId ? `/entreprise/mandats/${r.mandatId}` : "/entreprise",
        );
      } else {
        setErreur({ champ: r.champ, message: r.erreur });
        // On ramène sur l'étape qui porte le champ fautif : un message d'erreur
        // affiché sur l'écran de relecture, à propos d'un champ saisi deux
        // écrans plus tôt, ne se corrige pas.
        setEtape(etapeDuChamp(r.champ));
        annoncer({
          titre: "Le brief n’a pas été transmis",
          description: r.erreur,
          ton: "echec",
          duree: 0,
        });
      }
    });
  }

  return (
    /* ⚠ LE FORMULAIRE EST BORNÉ À 680px, PAS À LA COLONNE DE CONTENU.
       Un champ de 1 200px de large ne dit plus combien de texte on attend
       dedans, et l'œil perd la ligne entre le libellé et le boîtier. La place
       que cette borne libère va au fil d'étapes, qui reste ainsi sous les yeux
       pendant toute la saisie — ce qu'un fil posé en tête de page perd dès
       qu'on descend dans le formulaire. */
    <div className="flex flex-wrap items-start gap-5">
      {/* En étroit il n'y a plus de colonne de droite : le fil repasse en tête.
          Posé sous le formulaire, il indiquerait une progression après l'avoir
          fait faire. */}
      <Fil
        etape={etape}
        onAller={setEtape}
        titreValide={titreValide}
        className="flex-[1_1_100%] lg:hidden"
      />

      <Carte
        regime="travail"
        className="flex min-w-0 flex-[0_1_680px] flex-col gap-6 p-6"
      >
        {etape === 0 && (
          <div className="flex flex-col gap-5">
            <Entete
              titre="Quel poste ouvrez-vous ?"
              aide="Seul l’intitulé est obligatoire."
            />
            <ChampSaisie
              libelle="Intitulé du poste"
              requis
              placeholder="Senior Product Manager"
              value={b.titre}
              onChange={(e) => poser("titre", e.currentTarget.value)}
              // ⚠ LE MESSAGE VIT SOUS SON CHAMP, pas sous la rangée de boutons.
              // Il y était : on lisait « l'intitulé est nécessaire » à plusieurs
              // champs de distance de celui qu'il concerne. Et il dit la
              // CONSÉQUENCE — nécessaire pour ouvrir le poste — plutôt que
              // « champ obligatoire », qui répète la marque du libellé.
              erreur={
                err("titre") ??
                (etape > 0 && !titreValide
                  ? "Un intitulé est nécessaire pour ouvrir le poste."
                  : undefined)
              }
              maxLength={200}
            />
            {/* ⚠ LES QUATRE CHAMPS S'EMPILENT, à pleine largeur du formulaire.
                Ils étaient deux par deux : dans un cadre borné à 680px, deux
                déroulants côte à côte font 320px chacun et leurs libellés se
                serrent, alors que la colonne est là pour qu'on lise une ligne
                par décision. Le brief se remplit décision après décision, pas
                en balayant une grille. */}
            <Selecteur
              libelle="Verticale"
              substitut="Choisir une verticale"
              options={UNIVERS_MANDAT.map((u) => ({
                valeur: u.code,
                libelle: u.libelle,
              }))}
              valeur={b.universCode}
              onChangement={(v) => poser("universCode", v)}
              erreur={err("universCode")}
            />
            <Selecteur
              libelle="Type de contrat"
              substitut="Choisir un contrat"
              options={CONTRATS.map((c) => ({
                valeur: c.valeur,
                libelle: c.libelle,
              }))}
              valeur={b.contrat}
              onChangement={(v) => poser("contrat", v as Brouillon["contrat"])}
              erreur={err("contrat")}
            />

            {optionsMetier.length > 0 ? (
              <Selecteur
                libelle="Métier"
                substitut="Choisir un métier déjà ouvert chez vous"
                options={optionsMetier}
                valeur={b.metierCode}
                onChangement={(v) => poser("metierCode", v)}
                erreur={err("metierCode")}
              />
            ) : (
              <p className="t-caption text-[var(--encre-600)]">
                Qualifié par votre Account Manager à la relecture.
              </p>
            )}
          </div>
        )}

        {etape === 1 && (
          <div className="flex flex-col gap-5">
            <Entete
              titre="Dans quel cadre ?"
              aide="Ce qui encadre le poste : où, depuis combien de temps, pour combien."
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <ChampSaisie
                libelle="Localisation"
                placeholder="Lyon, Paris, France…"
                value={b.localisation}
                onChange={(e) => poser("localisation", e.currentTarget.value)}
                erreur={err("localisation")}
              />
              <ChampSaisie
                libelle="Expérience minimale"
                aide="En années. Laissez vide si ce n’est pas un critère."
                inputMode="numeric"
                value={b.experienceMinAnnees}
                onChange={(e) =>
                  poser("experienceMinAnnees", e.currentTarget.value)
                }
                erreur={err("experienceMinAnnees")}
              />
            </div>

            <ZoneTexte
              libelle="Télétravail"
              aide="Jours sur site, souplesse, fuseau."
              value={b.remoteInfos}
              onChange={(e) => poser("remoteInfos", e.currentTarget.value)}
              lignes={3}
            />

            {montreSalaire && (
              <div className="grid gap-5 sm:grid-cols-2">
                {/* ⚠ L'UNITÉ EST DANS LE LIBELLÉ, pas seulement dans l'aide. La
                  convention « numeric pour l'argent, unité dans le nom » a été
                  posée après qu'une conversion €→K€ a gelé la synchronisation
                  43 jours. Un client qui tape 55000 ici doit être arrêté par ce
                  qu'il lit, avant même que la base le refuse. */}
                <ChampSaisie
                  libelle="Salaire annuel minimum (en K€)"
                  aide="65 pour 65 000 €."
                  inputMode="decimal"
                  value={b.salaireMinKe}
                  onChange={(e) => poser("salaireMinKe", e.currentTarget.value)}
                  erreur={err("salaireMinKe")}
                />
                <ChampSaisie
                  libelle="Salaire annuel maximum (en K€)"
                  aide="80 pour 80 000 €."
                  inputMode="decimal"
                  value={b.salaireMaxKe}
                  onChange={(e) => poser("salaireMaxKe", e.currentTarget.value)}
                  erreur={err("salaireMaxKe")}
                />
              </div>
            )}

            {montreTjm && (
              <div className="grid gap-5 sm:grid-cols-2">
                <ChampSaisie
                  libelle="TJM minimum (en € par jour)"
                  inputMode="decimal"
                  value={b.tjmMinEur}
                  onChange={(e) => poser("tjmMinEur", e.currentTarget.value)}
                  erreur={err("tjmMinEur")}
                />
                <ChampSaisie
                  libelle="TJM maximum (en € par jour)"
                  inputMode="decimal"
                  value={b.tjmMaxEur}
                  onChange={(e) => poser("tjmMaxEur", e.currentTarget.value)}
                  erreur={err("tjmMaxEur")}
                />
              </div>
            )}
          </div>
        )}

        {etape === 2 && (
          <div className="flex flex-col gap-5">
            <Entete
              titre="Que fera cette personne ?"
              aide="Ce que vous écrivez ici part dans l’annonce, après relecture avec votre agent."
            />
            <ZoneTexte
              libelle="Les missions"
              aide="Une ligne par mission. Trois ou quatre suffisent."
              value={b.missions}
              onChange={(e) => poser("missions", e.currentTarget.value)}
              lignes={6}
            />
            <ListeCriteres
              titre="Indispensable"
              aide="Ce sans quoi vous ne recevrez pas la personne."
              valeurs={b.mustHave}
              onChangement={(v) => poser("mustHave", v)}
            />
            <ListeCriteres
              titre="Apprécié"
              aide="Ce qui fait la différence à profil égal."
              valeurs={b.niceToHave}
              onChangement={(v) => poser("niceToHave", v)}
            />
          </div>
        )}

        {etape === 3 && (
          <div className="flex flex-col gap-5">
            <Carte
              regime="travail"
              className="flex items-start gap-3 bg-[var(--violet-050)] p-4"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                ⏳
              </span>
              <div>
                <p className="t-body-hl text-black">
                  Ce brief part chez votre Account Manager
                </p>
                <p className="t-caption mt-1 text-black">
                  Créé en statut « nouveau », relu avec votre agent avant
                  diffusion.
                </p>
              </div>
            </Carte>

            <Carte
              regime="contour"
              className="flex flex-col gap-5 rounded-[var(--r-ml)] p-5"
            >
              <Entete
                titre="Relisez avant d’envoyer"
                aide="Tout reste modifiable ensuite."
              />
              <GrilleChamps colonnes={2}>
                <Champ libelle="Intitulé" valeur={b.titre.trim() || null} />
                <Champ
                  libelle="Verticale"
                  valeur={
                    UNIVERS_MANDAT.find((u) => u.code === b.universCode)
                      ?.libelle ?? null
                  }
                />
                <Champ
                  libelle="Contrat"
                  valeur={
                    CONTRATS.find((c) => c.valeur === b.contrat)?.libelle ??
                    null
                  }
                />
                <Champ
                  libelle="Métier"
                  valeur={
                    optionsMetier.find((m) => m.valeur === b.metierCode)
                      ?.libelle ?? null
                  }
                />
                <Champ
                  libelle="Localisation"
                  valeur={b.localisation.trim() || null}
                />
                <Champ
                  libelle="Expérience minimale"
                  valeur={
                    b.experienceMinAnnees
                      ? `${b.experienceMinAnnees} ans`
                      : null
                  }
                />
                <Champ
                  libelle="Fourchette"
                  valeur={fourchette({
                    salaireMinKe: montreSalaire
                      ? nombreOuNull(b.salaireMinKe)
                      : null,
                    salaireMaxKe: montreSalaire
                      ? nombreOuNull(b.salaireMaxKe)
                      : null,
                    tjmMinEur: montreTjm ? nombreOuNull(b.tjmMinEur) : null,
                    tjmMaxEur: montreTjm ? nombreOuNull(b.tjmMaxEur) : null,
                  })}
                />
                <Champ
                  libelle="Télétravail"
                  valeur={b.remoteInfos.trim() || null}
                />
              </GrilleChamps>

              <div className="flex flex-col gap-3">
                <Champ
                  libelle="Missions"
                  valeur={
                    b.missions.trim() ? (
                      <span className="t-body whitespace-pre-line text-black">
                        {b.missions}
                      </span>
                    ) : null
                  }
                />
                <Champ
                  libelle="Indispensable"
                  valeur={b.mustHave.length > 0 ? b.mustHave.join(" · ") : null}
                />
                <Champ
                  libelle="Apprécié"
                  valeur={
                    b.niceToHave.length > 0 ? b.niceToHave.join(" · ") : null
                  }
                />
              </div>
            </Carte>
          </div>
        )}

        {/* LE TEXTE D'ERREUR EST NOIR, pas rouge. Deux raisons qui vont dans le
          même sens, et ce sont celles que `MessageErreur` de `Champ.tsx` écrit
          déjà : la règle dure du système (le texte est noir, la couleur ne
          signale rien seule), et le contraste — `--marker-red` #e8553a sur
          crème donne 3,5:1, sous le seuil AA de 4,5 pour du texte de 14px. Le
          rouge reste sur les filets et les icônes, où il n'a pas à être lu. */}
        {erreur && !erreur.champ && (
          <p role="alert" className="t-body text-black">
            {erreur.message}
          </p>
        )}

        <Divider />

        {/* ⚠ « Précédent » À GAUCHE, L'ACTION À DROITE, ET LA PLACE DE
          « Précédent » RESTE VIDE À L'ÉTAPE 1. Le bouton d'avancée ne doit pas
          changer de position d'une étape à l'autre : on clique quatre fois au
          même endroit. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* ⚠ IL DISPARAÎT À LA PREMIÈRE ÉTAPE, IL N'EST PAS GRISÉ.
              Un bouton désactivé occupe la place et invite à cliquer pour rien.
              Mais la PLACE reste tenue par un élément vide : sans lui,
              `justify-between` ramènerait « Continuer » à gauche, et le bouton
              d'avancée changerait de position entre l'étape 1 et les suivantes.
              On clique quatre fois au même endroit. */}
          {etape > 0 ? (
            <Bouton
              apparence="contour"
              onClick={() => setEtape((e) => Math.max(0, e - 1))}
              disabled={enCours}
              iconeAvant={<Icone nom="icon-arrow-left" />}
            >
              Précédent
            </Bouton>
          ) : (
            <span aria-hidden="true" />
          )}

          {etape < ETAPES.length - 1 ? (
            <Bouton
              apparence="plein"
              onClick={() =>
                setEtape((e) => Math.min(ETAPES.length - 1, e + 1))
              }
              disabled={!titreValide || enCours}
              iconeApres={<Icone nom="icon-arrow-right" />}
            >
              Continuer
            </Bouton>
          ) : (
            <Bouton
              apparence="plein"
              onClick={transmettre}
              disabled={!titreValide || enCours}
              iconeApres={<Icone nom="icon-send" />}
            >
              {enCours ? "Envoi…" : "Transmettre le brief"}
            </Bouton>
          )}
        </div>
      </Carte>

      {/* La colonne de droite : le fil qui reste sous les yeux, et la seule
          chose qu'on veut savoir en briefant — qui va relire, et ce qui arrive
          après l'envoi. */}
      <aside className="hidden min-w-0 max-w-[400px] flex-[1_1_300px] lg:flex lg:flex-col lg:gap-5">
        <Carte regime="travail" className="p-5">
          <Fil
            etape={etape}
            onAller={setEtape}
            titreValide={titreValide}
            colonne
          />
        </Carte>

        {relecteur?.nom && (
          <Carte regime="travail" className="flex flex-col gap-3 p-5">
            <h2 className="t-h3">Qui relit ce brief</h2>
            <div className="flex items-center gap-3">
              <Avatar
                nom={relecteur.nom}
                src={relecteur.photo}
                taille={42}
                forme="rond"
              />
              <div className="min-w-0">
                <p className="t-body-bold truncate text-black">
                  {relecteur.nom}
                </p>
                {/* « Account Manager » et non « Career Agent » : c'est son
                    rôle SUR CE BRIEF, pas son intitulé interne. */}
                <p className="t-caption truncate text-[var(--encre-500)]">Account Manager</p>
              </div>
            </div>
            <Divider />
            {/* ⚠ CETTE PHRASE ÉTAIT À L'ÉTAPE 4, avec un émoji. Elle répond à la
                question qu'on se pose EN briefant — « qu'est-ce qui se passe si
                j'envoie ça ? » — pas une fois qu'on y est arrivé. */}
            <p className="t-body text-black">
              Après l’envoi, le poste apparaît à votre tableau de bord en statut
              «&nbsp;Nouveau&nbsp;». {relecteur.nom.split(" ")[0]} relit le
              brief avec vous avant toute publication.
            </p>
          </Carte>
        )}
      </aside>
    </div>
  );
}

/* ── Le fil des étapes ────────────────────────────────────────────────────── */

/**
 * ON PEUT REVENIR EN ARRIÈRE EN CLIQUANT, mais pas sauter en avant tant que
 * l'intitulé manque : c'est le seul champ que la base exige, et laisser
 * atteindre la relecture sans lui offrirait un bouton d'envoi qui échoue.
 *
 * Ce n'est pas un jeu d'onglets ARIA : les étapes n'ont pas de panneaux
 * indépendants, elles ont un ordre et un état d'avancement. Une liste ordonnée
 * avec `aria-current` dit exactement cela.
 */
function Fil({
  etape,
  onAller,
  titreValide,
  colonne,
  className,
}: {
  etape: number;
  onAller: (i: number) => void;
  titreValide: boolean;
  /** En colonne dans le panneau de droite ; en rangée au-dessus sinon. */
  colonne?: boolean;
  className?: string;
}) {
  return (
    <ol
      className={cn(
        "flex",
        colonne
          ? "flex-col items-stretch gap-3.5"
          : "flex-wrap items-center gap-x-5 gap-y-2",
        className,
      )}
    >
      {ETAPES.map((e, i) => {
        const franchie = i < etape;
        const courante = i === etape;
        const atteignable = i <= etape || titreValide;
        return (
          <li key={e.cle} className={cn("flex", colonne && "w-full")}>
            {/* ⚠ UNE PASTILLE NUMÉROTÉE ET UN LIBELLÉ, PAS UNE GÉLULE PLEINE.
                La rangée entière était un bouton coloré — noir pour l'étape
                courante, gris pour les suivantes — ce qui donnait quatre gros
                aplats empilés dans un panneau de 300px et faisait lire le fil
                comme un menu. Le wireframe met l'état DANS la pastille : disque
                noir coché pour ce qui est franchi, disque violet cerclé pour
                l'étape en cours, cercle vide pour la suite. Le libellé, lui,
                reste du texte. */}
            <button
              type="button"
              onClick={() => atteignable && onAller(i)}
              disabled={!atteignable}
              aria-current={courante ? "step" : undefined}
              className={cn(
                "flex min-w-0 items-center gap-2.5 rounded-[var(--r-xs)] text-left",
                colonne && "w-full",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                atteignable
                  ? "hover:text-[var(--violet-700)]"
                  : "cursor-not-allowed",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "t-caption-hl grid size-[26px] shrink-0 place-items-center rounded-[var(--r-full)]",
                  franchie && "bg-black text-white",
                  courante &&
                    "bg-[var(--violet-900)] text-white ring-4 ring-[var(--violet-100)]",
                  !franchie &&
                    !courante &&
                    "border border-[var(--encre-200)] bg-[var(--fond-page)] text-[var(--encre-400)]",
                )}
              >
                {franchie ? (
                  <Icone nom="icon-check" className="size-3.5" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "min-w-0 truncate",
                  franchie || courante
                    ? "t-body-hl text-black"
                    : "t-body text-[var(--encre-400)]",
                )}
              >
                <span className="sr-only">Étape {i + 1} sur 4 : </span>
                {e.titre}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * ⚠ CHAQUE ÉTAPE EST UNE QUESTION, EN `t-h2`.
 *
 * « Quel poste ouvrez-vous ? » plutôt que « Informations générales » : on
 * répond à une question, on ne remplit pas une rubrique. Et en `t-h2` parce que
 * c'est le titre de ce qu'on est en train de faire — le `t-h3` en faisait un
 * intertitre dans une page dont le vrai titre, « Ouvrir un poste », est à
 * quarante pixels au-dessus et ne dit rien de l'étape.
 *
 * La précision est en corps et non en légende : elle ne décrit pas
 * l'interface, elle lève l'inquiétude du moment — « tout n'est pas
 * obligatoire », « ce texte part dans l'annonce ».
 */
function Entete({ titre, aide }: { titre: string; aide?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="t-h2">{titre}</h2>
      {/* L'aide n'est plus obligatoire : la plupart des étapes se comprennent
          par leur titre et leurs champs, et une phrase d'explication sous
          chaque titre remplissait l'écran sans rien apprendre. */}
      {aide ? <p className="t-body text-[var(--encre-600)]">{aide}</p> : null}
    </div>
  );
}

/* ── Une liste de critères en texte libre ─────────────────────────────────── */

/**
 * `must_have` et `nice_to_have` sont des `jsonb`, et le client y écrit ce qu'il
 * veut : aucun référentiel de compétences n'existe côté portail.
 *
 * `SaisieTags` du design system ne convient donc pas — son contrat exige une
 * liste d'options fermée, et il filtre dedans. On compose ici la même grammaire
 * visuelle (`TagInfo` avec une croix DEDANS, comme `PuceFiltre`) autour d'un
 * champ libre. Rien du système n'est redessiné, seulement assemblé autrement.
 */
function ListeCriteres({
  titre,
  aide,
  valeurs,
  onChangement,
}: {
  titre: string;
  aide: string;
  valeurs: string[];
  onChangement: (v: string[]) => void;
}) {
  const [saisie, setSaisie] = useState("");

  function ajouter() {
    const v = saisie.trim();
    // Le doublon est refusé en silence plutôt que signalé : ajouter deux fois
    // « TypeScript » n'est pas une erreur, c'est une hésitation.
    if (!v || valeurs.includes(v) || valeurs.length >= 20) return;
    onChangement([...valeurs, v]);
    setSaisie("");
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="t-body-hl text-black">{titre}</p>
        <p className="t-caption mt-0.5 text-[var(--encre-600)]">{aide}</p>
      </div>

      <div className="flex items-end gap-2">
        <ChampSaisie
          aria-label={`Ajouter un critère « ${titre.toLowerCase()} »`}
          placeholder="Ex. cinq ans en environnement SaaS"
          value={saisie}
          onChange={(e) => setSaisie(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Sans ce `preventDefault`, Entrée soumettrait le formulaire
              // englobant — ici il n'y en a pas, mais le jour où il y en aura
              // un, le brief partirait à la première frappe.
              e.preventDefault();
              ajouter();
            }
          }}
          className="flex-1"
        />
        <Bouton
          apparence="contour"
          onClick={ajouter}
          disabled={saisie.trim().length === 0 || valeurs.length >= 20}
          iconeAvant={<Icone nom="icon-plus" />}
        >
          Ajouter
        </Bouton>
      </div>

      {valeurs.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {valeurs.map((v) => (
            <li key={v}>
              <TagInfo regime="travail">
                <span className="flex items-center gap-2">
                  {v}
                  <button
                    type="button"
                    onClick={() => onChangement(valeurs.filter((x) => x !== v))}
                    className="rounded-[var(--r-full)] leading-none text-black hover:text-[var(--encre-600)]"
                  >
                    <span aria-hidden="true">✕</span>
                    <span className="sr-only">Retirer le critère {v}</span>
                  </button>
                </span>
              </TagInfo>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Utilitaires ──────────────────────────────────────────────────────────── */

function nombreOuNull(valeur: string): number | null {
  const v = valeur.trim().replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Sur quelle étape se trouve le champ que la base a refusé. */
function etapeDuChamp(champ: string | undefined): number {
  switch (champ) {
    case "titre":
    case "universCode":
    case "metierCode":
    case "contrat":
      return 0;
    case "localisation":
    case "experienceMinAnnees":
    case "salaireMinKe":
    case "salaireMaxKe":
    case "tjmMinEur":
    case "tjmMaxEur":
      return 1;
    case "missions":
    case "mustHave":
    case "niceToHave":
      return 2;
    default:
      return 3;
  }
}
