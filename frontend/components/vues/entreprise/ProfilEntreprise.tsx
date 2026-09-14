'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Avatar } from '@/components/pacha/Avatar';
import { Bouton } from '@/components/pacha/Bouton';
import { Carte } from '@/components/pacha/Carte';
import { Champ as ChampSaisie } from '@/components/pacha/Champ';
import { Divider } from '@/components/pacha/Divider';
import { EtatVide } from '@/components/pacha/EtatVide';
import { Icone } from '@/components/pacha/Icone';
import { Onglet, Onglets, ListeOnglets, PanneauOnglet } from '@/components/pacha/Onglets';
import { Televersement, type EtatTeleversement } from '@/components/pacha/Televersement';
import { useToasts } from '@/components/pacha/Toast';
import { ZoneTexte } from '@/components/pacha/ZoneTexte';
import { BarreEnregistrement, Champ, GrilleChamps } from '@/components/vues/entreprise/atomes';
import { useNonce } from '@/components/vues/entreprise/nonce';
import {
  manquesFacturation,
  manquesVitrine,
  type ManqueFiche,
  type MonEntreprise,
  type MonProduit,
} from '@/lib/domaine/entreprise';
import { nomLisible } from '@/lib/domaine/stockage';
import { deposerLogo, majEntreprise, majProduit, type Retour } from '@/lib/entreprise/actions';
import { TAILLE_MAX_PHOTO_OCTETS, TYPES_PHOTO } from '@/lib/entreprise/saisie';

/**
 * LE PROFIL DE L'ENTREPRISE — la vitrine que les candidats liront.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ LE PIÈGE DU CONTRAT « maj_ » : LE FORMULAIRE EST ENVOYÉ ENTIER
 * ─────────────────────────────────────────────────────────────────────────
 * `api.maj_entreprise` écrit ses DIX colonnes à chaque appel, et un argument
 * nul EFFACE la valeur. Une Server Action qui n'enverrait que les champs
 * modifiés viderait tous les autres. Ce composant tient donc l'état des dix
 * champs, initialisé sur la donnée lue, et les renvoie tous — y compris ceux
 * qu'on n'a pas touchés. Même chose pour `maj_produit`, dont la maturité est
 * réémise telle quelle alors que l'écran ne permet pas d'en changer.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'AIDE A CHANGÉ DE PLACE : ELLE EST DANS LE PANNEAU, PAS SOUS LES CHAMPS
 * ─────────────────────────────────────────────────────────────────────────
 * L'écran portait un encart « Tenu par Pachamama » qui répétait cinq valeurs
 * en lecture seule — utile une fois, jamais ensuite. Il cède la place à deux
 * cartes qui disent CE QUI MANQUE, et où le corriger. La différence n'est pas
 * décorative : un écran de formulaire n'a pas à rappeler ce qui est déjà
 * rempli, il a à montrer ce qui ne l'est pas. Les listes sont calculées par
 * `manquesVitrine` / `manquesFacturation`, donc par la donnée — jamais écrites
 * en dur ici.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DES ONGLETS EN PASTILLES, ET CE SONT DE VRAIS ONGLETS
 * ─────────────────────────────────────────────────────────────────────────
 * Le portail emploie déjà des pastilles pour deux filtres exclusifs (tableau de
 * bord, « Mes process »). Deux grammaires pour le même geste se paient en
 * hésitation, d'où `apparence="pastille"` — ajoutée au composant du système
 * plutôt que posée ici à coups de `TagAction` dans un `role="tablist"` écrit à
 * la main, ce qui aurait perdu les flèches, `aria-controls` et la sortie des
 * panneaux inactifs de l'ordre de tabulation.
 *
 * `garderMonte` sur les deux panneaux : changer d'onglet ne doit pas jeter ce
 * qu'on vient de taper dans l'autre.
 */
export function ProfilEntreprise({
  entreprise,
  produit,
  logoApercu,
}: {
  entreprise: MonEntreprise;
  produit: MonProduit | null;
  /**
   * L'URL SIGNÉE du logo déjà en place, fabriquée par la page — le seau est
   * privé. Nulle quand il n'y a pas de logo, ou quand la signature échoue :
   * `Avatar` retombe alors sur l'initiale.
   */
  logoApercu: string | null;
}) {
  const manquesA = manquesVitrine(entreprise);
  const manquesB = manquesFacturation(entreprise);

  return (
    <Onglets valeurParDefaut="vitrine" className="gap-5">
      <ListeOnglets libelle="Votre fiche" apparence="pastille">
        <Onglet valeur="vitrine" apparence="pastille">
          Identité et vitrine
        </Onglet>
        <Onglet valeur="produit" apparence="pastille">
          Votre produit
        </Onglet>
      </ListeOnglets>

      <div className="flex flex-wrap items-start gap-5">
        {/* 680px comme le brief et « Mes informations ». Un champ de nom sur
            1 200px ne dit plus ce qu'on attend dedans. */}
        <div className="flex min-w-0 flex-[0_1_680px] flex-col">
          <PanneauOnglet valeur="vitrine" garderMonte>
            <FormulaireVitrine entreprise={entreprise} logoApercu={logoApercu} />
          </PanneauOnglet>
          <PanneauOnglet valeur="produit" garderMonte>
            <FormulaireProduit produit={produit} />
          </PanneauOnglet>
        </div>

        <aside className="flex min-w-0 max-w-[400px] flex-[1_1_300px] flex-col gap-5">
          <CarteManques
            titre="Ce qui manque aux candidats"
            manques={manquesA}
            rienAFaire="Votre vitrine est complète."
            pied={
              <p className="t-body text-[var(--encre-600)]">
                Un candidat qui ne sait pas où est le poste ni combien vous êtes en
                technique se renseigne ailleurs.
              </p>
            }
          />
          <CarteManques
            titre="Ce qui manque à la facturation"
            manques={manquesB}
            rienAFaire="Votre dossier administratif est complet."
            pied={
              <Bouton href="/entreprise/facturation" apparence="contour" className="w-fit">
                Contrat et factures
              </Bouton>
            }
          />
        </aside>
      </div>
    </Onglets>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Les manques
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ UNE LIGNE AVEC ANCRE EST UN LIEN, UNE LIGNE SANS ANCRE EST UN TEXTE.
 * La raison sociale est tenue par le cabinet : elle figure dans la liste parce
 * que son absence bloque une facture, mais elle ne mène nulle part sur cet
 * écran. Lui donner un chevron et un survol promettrait un champ qui n'existe
 * pas — le bouton du bas dit où ça se règle.
 */
function CarteManques({
  titre,
  manques,
  rienAFaire,
  pied,
}: {
  titre: string;
  manques: ManqueFiche[];
  rienAFaire: string;
  pied: React.ReactNode;
}) {
  return (
    <Carte regime="travail" className="flex flex-col gap-3 p-5">
      <h2 className="t-h3">{titre}</h2>
      {manques.length === 0 ? (
        <p className="t-body flex items-center gap-2 text-[var(--encre-600)]">
          <Icone nom="icon-check" className="size-4 shrink-0 text-black" />
          {rienAFaire}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {manques.map((m) =>
            m.ancre ? (
              <li key={m.cle}>
                <Link
                  href={`#${m.ancre}`}
                  className="t-body-hl flex items-center justify-between gap-2.5 text-black hover:text-[var(--violet-700)]"
                >
                  {m.libelle}
                  <Icone nom="icon-chevron-right" className="size-4 shrink-0" />
                </Link>
              </li>
            ) : (
              <li key={m.cle} className="t-body-hl text-black">
                {m.libelle}
              </li>
            ),
          )}
        </ul>
      )}
      <Divider />
      {pied}
    </Carte>
  );
}

/** Une cible d'ancre, avec le décalage qu'impose la barre du haut. */
function Ancre({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-28">
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   La vitrine
   ══════════════════════════════════════════════════════════════════════════ */

type ChampsVitrine = {
  description: string;
  fondateur: string;
  serieFinancement: string;
  siteWeb: string;
  siret: string;
  videoUrl: string;
  logoUrl: string;
  localisation: string;
  nbEmployes: string;
  nbTechs: string;
};

function initialesVitrine(e: MonEntreprise): ChampsVitrine {
  // `?? ''` partout : un `<input>` contrôlé dont la valeur passe de `null` à
  // une chaîne bascule de non-contrôlé à contrôlé, et React le signale à
  // l'exécution. Le retour vers `null` se fait à l'enregistrement, dans le
  // schéma zod de la Server Action.
  return {
    description: e.description ?? '',
    fondateur: e.fondateur ?? '',
    serieFinancement: e.serieFinancement ?? '',
    siteWeb: e.siteWeb ?? '',
    siret: e.siret ?? '',
    videoUrl: e.videoUrl ?? '',
    logoUrl: e.logoUrl ?? '',
    localisation: e.localisation ?? '',
    nbEmployes: e.nbEmployes === null ? '' : String(e.nbEmployes),
    nbTechs: e.nbTechs === null ? '' : String(e.nbTechs),
  };
}

function FormulaireVitrine({
  entreprise,
  logoApercu,
}: {
  entreprise: MonEntreprise;
  logoApercu: string | null;
}) {
  const router = useRouter();
  const { annoncer } = useToasts();
  const [enCours, demarrer] = useTransition();
  const [nonce, renouvelerNonce] = useNonce();

  const [champs, setChamps] = useState<ChampsVitrine>(() => initialesVitrine(entreprise));
  const [erreur, setErreur] = useState<{ champ?: string; message: string } | null>(null);
  const [modifie, setModifie] = useState(false);

  const [fichierLogo, setFichierLogo] = useState<File | null>(null);
  const [etatLogo, setEtatLogo] = useState<EtatTeleversement>({ phase: 'repos' });
  const [apercu, setApercu] = useState<string | null>(logoApercu);

  const poser =
    <C extends keyof ChampsVitrine>(cle: C) =>
    (valeur: string) => {
      setChamps((c) => ({ ...c, [cle]: valeur }));
      setModifie(true);
      setErreur(null);
    };
  const err = (cle: keyof ChampsVitrine) =>
    erreur?.champ === cle ? erreur.message : undefined;

  /**
   * ⚠ `Televersement` a DÉJÀ refusé les fichiers hors contraintes, et la Server
   * Action revérifie quand même : une Server Action est un point d'entrée POST,
   * appelable sans passer par l'écran.
   */
  function envoyerLogo(fichier: File) {
    setFichierLogo(fichier);
    // `progression` absente : Supabase Storage ne rapporte pas l'avancement
    // d'un `upload`, et inventer un pourcentage serait mentir.
    setEtatLogo({ phase: 'envoi' });
    demarrer(async () => {
      const donnees = new FormData();
      donnees.set('fichier', fichier);
      const r = await deposerLogo(donnees);
      if (r.ok) {
        setEtatLogo({ phase: 'fait' });
        setApercu(r.apercu);
        poser('logoUrl')(r.valeur);
      } else {
        setEtatLogo({ phase: 'echec', message: r.erreur });
        setFichierLogo(null);
        annoncer({
          titre: 'Le logo n’a pas été déposé',
          description: r.erreur,
          ton: 'echec',
          duree: 0,
        });
      }
    });
  }

  function enregistrer() {
    demarrer(async () => {
      const r: Retour = await majEntreprise({ ...champs, nonce });
      if (r.ok) {
        annoncer({ titre: r.message, ton: 'succes' });
        setModifie(false);
        setErreur(null);
        setEtatLogo({ phase: 'repos' });
        renouvelerNonce();
        router.refresh();
      } else {
        setErreur({ champ: r.champ, message: r.erreur });
        annoncer({
          titre: 'La fiche n’a pas été enregistrée',
          description: r.erreur,
          ton: 'echec',
          duree: 0,
        });
      }
    });
  }

  const logoEnPlace = Boolean(champs.logoUrl);

  return (
    <>
      <Carte regime="travail" className="flex flex-col gap-[18px] p-6">
        <Ancre id="champ-description">
          <ZoneTexte
            libelle="Votre présentation, en deux paragraphes"
            value={champs.description}
            onChange={(e) => poser('description')(e.currentTarget.value)}
            erreur={err('description')}
            maxLength={10000}
            compteur
            lignes={5}
          />
        </Ancre>

        <GrilleChamps colonnes={2} className="gap-x-4">
          <Ancre id="champ-fondateur">
            <ChampSaisie
              libelle="Fondateur ou fondatrice"
              value={champs.fondateur}
              onChange={(e) => poser('fondateur')(e.currentTarget.value)}
              erreur={err('fondateur')}
            />
          </Ancre>
          {/* ⚠ UN CHAMP LIBRE, ET NON LA LISTE DÉROULANTE DU WIREFRAME.
              Celui-ci propose cinq options (Amorçage, Série A, B, C, Rentable).
              La donnée réelle n'a pas cette forme : mesuré sur le compte de
              test, `serie_financement` vaut « 24M en 2023 avec PSG Equity
              (fonds américain) » — une phrase, pas un code. Un sélecteur
              n'aurait offert aucune option correspondant à la valeur en place,
              et le premier enregistrement l'aurait remplacée par « Série B ».
              Le jour où la colonne sera normalisée, le sélecteur deviendra le
              bon geste ; pas avant. */}
          <Ancre id="champ-serie">
            <ChampSaisie
              libelle="Série de financement"
              placeholder="Amorçage, Série A, rentable sans lever…"
              value={champs.serieFinancement}
              onChange={(e) => poser('serieFinancement')(e.currentTarget.value)}
              erreur={err('serieFinancement')}
            />
          </Ancre>
        </GrilleChamps>

        <GrilleChamps colonnes={2} className="gap-x-4">
          <Ancre id="champ-localisation">
            <ChampSaisie
              libelle="Localisation"
              placeholder="Lyon, Paris, France…"
              value={champs.localisation}
              onChange={(e) => poser('localisation')(e.currentTarget.value)}
              erreur={err('localisation')}
            />
          </Ancre>
          <Ancre id="champ-site">
            <ChampSaisie
              libelle="Site web"
              placeholder="votre-entreprise.com"
              // Pas de `type="url"` : la validation native du navigateur exige
              // un schéma, et 133 des 259 sites renseignés en base sont des
              // domaines nus. Le champ refuserait la donnée déjà présente.
              inputMode="url"
              value={champs.siteWeb}
              onChange={(e) => poser('siteWeb')(e.currentTarget.value)}
              erreur={err('siteWeb')}
            />
          </Ancre>
        </GrilleChamps>

        <GrilleChamps colonnes={2} className="gap-x-4">
          <Ancre id="champ-effectif">
            <ChampSaisie
              libelle="Effectif total"
              inputMode="numeric"
              value={champs.nbEmployes}
              onChange={(e) => poser('nbEmployes')(e.currentTarget.value)}
              erreur={err('nbEmployes')}
            />
          </Ancre>
          <Ancre id="champ-techs">
            <ChampSaisie
              libelle="Effectif technique"
              placeholder="Nombre de personnes"
              inputMode="numeric"
              value={champs.nbTechs}
              onChange={(e) => poser('nbTechs')(e.currentTarget.value)}
              erreur={err('nbTechs')}
            />
          </Ancre>
        </GrilleChamps>

        {/* ⚠ ON DÉPOSE UN LOGO, ON NE COLLE PAS UNE ADRESSE.
            Ce champ demandait une URL et expliquait au client pourquoi la
            sienne commençait par « // » — c'est-à-dire lui expliquait une
            séquelle de NOTRE reprise. Le seau `documents-entreprise` accepte
            désormais un dossier `logo/` sous l'identifiant de l'ENTREPRISE
            (migration `20260913240000`), et non sous celui de la personne : un
            logo est partagé par tous les contacts, et doit rester remplaçable
            après un départ.

            Le SVG est refusé, alors que c'est le format qu'on voudrait pour un
            logo : c'est un document exécutable. L'aide le dit en clair plutôt
            que de rendre « format non accepté ». */}
        <Ancre id="champ-logo">
          <Televersement
            libelle="Logo"
            aide="Fond transparent de préférence. Le SVG n’est pas accepté."
            typesAcceptes={TYPES_PHOTO}
            libelleTypes="PNG, JPEG ou WebP"
            tailleMaxOctets={TAILLE_MAX_PHOTO_OCTETS}
            fichier={fichierLogo}
            fichierExistant={
              !fichierLogo && logoEnPlace
                ? {
                    nom: nomLisible(champs.logoUrl) ?? 'Votre logo',
                    href: apercu ?? undefined,
                  }
                : null
            }
            apercu={
              logoEnPlace ? (
                <Avatar nom={entreprise.nom} src={apercu} taille={56} forme="carre" />
              ) : undefined
            }
            onFichier={envoyerLogo}
            onRetirer={() => {
              setFichierLogo(null);
              setEtatLogo({ phase: 'repos' });
              setApercu(null);
              poser('logoUrl')('');
            }}
            etat={etatLogo}
            desactive={enCours}
            erreur={err('logoUrl')}
          />
        </Ancre>

        <Ancre id="champ-video">
          <ChampSaisie
            // Mesuré : les 47 valeurs remplies en base sont des identifiants
            // YouTube nus, jamais des URL. Le libellé le dit, sinon on renvoie
            // le client vers une saisie que la fonction accepterait mais que
            // personne d'autre n'emploie.
            libelle="Vidéo de présentation (identifiant YouTube ou adresse complète)"
            value={champs.videoUrl}
            onChange={(e) => poser('videoUrl')(e.currentTarget.value)}
            erreur={err('videoUrl')}
          />
        </Ancre>

        <Ancre id="champ-siret">
          <ChampSaisie
            libelle="SIRET"
            placeholder="14 chiffres"
            inputMode="numeric"
            value={champs.siret}
            onChange={(e) => poser('siret')(e.currentTarget.value)}
            erreur={err('siret')}
          />
        </Ancre>
      </Carte>

      <BarreEnregistrement
        modifie={modifie}
        enCours={enCours}
        onEnregistrer={enregistrer}
        onAnnuler={() => {
          setChamps(initialesVitrine(entreprise));
          setFichierLogo(null);
          setEtatLogo({ phase: 'repos' });
          setApercu(logoApercu);
          setModifie(false);
          setErreur(null);
        }}
      />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Le produit
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ CE PANNEAU EST PLUS COURT QUE LE WIREFRAME, ET C'EST MESURÉ.
 *
 * Le wireframe y pose cinq entrées : « Ce que vous fabriquez », « Votre
 * stack », « Vos enjeux des douze prochains mois », « Nombre de clients » et
 * « Votre marché ». Relevé le 13/09 sur `api.mon_produit` avec un vrai jeton,
 * la vue porte : `nom`, `description`, `texte_annonce`, `maturite_code`,
 * `maturite`, `maturite_image`. **Ni stack, ni enjeux, ni nombre de clients,
 * ni marché n'existent en base** — et `api.maj_produit` n'écrit que trois
 * colonnes.
 *
 * Les dessiner aurait donné quatre champs qui acceptent la saisie et la
 * perdent à l'enregistrement : le pire des deux mondes, puisque la personne
 * croit avoir renseigné sa stack. On construit donc ce qui existe, et on dit
 * ce qui manque au commanditaire plutôt qu'à l'utilisateur.
 *
 * « Le paragraphe des annonces » est conservé bien que le wireframe le retire :
 * c'est la SEULE colonne du produit qui soit renseignée sur le compte de test,
 * et elle part telle quelle dans les offres publiées.
 */
function FormulaireProduit({ produit }: { produit: MonProduit | null }) {
  const router = useRouter();
  const { annoncer } = useToasts();
  const [enCours, demarrer] = useTransition();
  const [nonce, renouvelerNonce] = useNonce();

  const [description, setDescription] = useState(produit?.description ?? '');
  const [annonce, setAnnonce] = useState(produit?.texteAnnonce ?? '');
  const [modifie, setModifie] = useState(false);

  if (!produit) {
    return (
      <Carte regime="travail" className="p-2">
        <EtatVide
          titre="Aucun produit n’est enregistré"
          description="Demandez-la à votre Account Manager."
        />
      </Carte>
    );
  }

  function enregistrer() {
    demarrer(async () => {
      const r = await majProduit({
        produitId: produit!.id,
        description,
        texteAnnonce: annonce,
        // La maturité est RÉÉMISE telle quelle. `api.maj_produit` écrit ses
        // trois colonnes en bloc : l'omettre la mettrait à NULL, et l'écran
        // n'a pas de quoi en proposer une autre — `ref.maturite_produit` n'est
        // pas exposé au réseau.
        maturiteCode: produit!.maturiteCode,
        nonce,
      });
      if (r.ok) {
        annoncer({ titre: r.message, ton: 'succes' });
        setModifie(false);
        renouvelerNonce();
        router.refresh();
      } else {
        annoncer({
          titre: 'Le produit n’a pas été enregistré',
          description: r.erreur,
          ton: 'echec',
          duree: 0,
        });
      }
    });
  }

  return (
    <>
      <Carte regime="travail" className="flex flex-col gap-[18px] p-6">
        <ZoneTexte
          libelle="Ce que vous fabriquez"
          aide="À quoi il sert, pour qui, ce qui le distingue."
          value={description}
          onChange={(e) => {
            setDescription(e.currentTarget.value);
            setModifie(true);
          }}
          lignes={5}
        />

        <ZoneTexte
          libelle="Le paragraphe des annonces"
          aide="Repris tel quel dans vos offres publiées."
          value={annonce}
          onChange={(e) => {
            setAnnonce(e.currentTarget.value);
            setModifie(true);
          }}
          lignes={5}
        />

        <GrilleChamps colonnes={2}>
          <Champ libelle="Maturité" valeur={produit.maturite} />
        </GrilleChamps>
        <p className="t-caption text-[var(--encre-600)]">Réglée avec votre Account Manager.</p>
      </Carte>

      <BarreEnregistrement
        modifie={modifie}
        enCours={enCours}
        onEnregistrer={enregistrer}
        onAnnuler={() => {
          setDescription(produit.description ?? '');
          setAnnonce(produit.texteAnnonce ?? '');
          setModifie(false);
        }}
      />
    </>
  );
}
