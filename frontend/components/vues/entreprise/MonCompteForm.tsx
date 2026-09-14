"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Avatar } from "@/components/pacha/Avatar";
import { Carte } from "@/components/pacha/Carte";
import { Divider } from "@/components/pacha/Divider";
import { Champ as ChampSaisie } from "@/components/pacha/Champ";
import {
  Televersement,
  type EtatTeleversement,
} from "@/components/pacha/Televersement";
import { useToasts } from "@/components/pacha/Toast";
import {
  BarreEnregistrement,
  Champ,
  GrilleChamps,
} from "@/components/vues/entreprise/atomes";
import { useNonce } from "@/components/vues/entreprise/nonce";
import type { MonCompte } from "@/lib/domaine/entreprise";
import { nomLisible } from "@/lib/domaine/stockage";
import {
  deposerPhotoCompte,
  majMonCompte,
  type Retour,
} from "@/lib/entreprise/actions";
import { TAILLE_MAX_PHOTO_OCTETS, TYPES_PHOTO } from "@/lib/entreprise/saisie";

/**
 * MES PROPRES INFORMATIONS.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE MÊME PIÈGE QUE LES AUTRES « maj_ » : LE FORMULAIRE PART ENTIER
 * ─────────────────────────────────────────────────────────────────────────
 * `api.maj_mon_compte` écrit ses cinq colonnes à chaque appel, et un argument
 * nul EFFACE la valeur. On tient donc l'état des cinq champs, initialisé sur la
 * donnée lue, et on les renvoie tous — y compris ceux qu'on n'a pas touchés.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ADRESSE EST MONTRÉE ET NE SE MODIFIE PAS
 * ─────────────────────────────────────────────────────────────────────────
 * Elle est l'identité d'authentification : c'est par elle que Supabase
 * reconnaît le compte, et c'est elle que `api.rattacher_compte` a employée pour
 * relier la personne à sa fiche. La changer n'est pas corriger une faute de
 * frappe, c'est déplacer un accès — un acte administré, pas un champ de
 * formulaire. Elle n'est ni dans la liste blanche de la fonction, ni dans les
 * `GRANT UPDATE` par colonne. On l'affiche quand même : cacher l'adresse sous
 * laquelle on est connecté serait la première chose qu'on viendrait chercher
 * ici.
 *
 * Le métier n'est pas éditable non plus dans cette version : le choisir demande
 * une liste déroulante sur les 238 entrées de `ref.metier`, et le schéma `ref`
 * n'est pas exposé au réseau. La fonction l'accepte déjà (`p_metier_code`) :
 * le jour où `api.mon_referentiel` existera, il suffira de brancher un
 * `Combobox`. En attendant la valeur courante est réémise telle quelle, pour ne
 * pas l'effacer.
 */
export function MonCompteForm({
  compte,
  photoApercu,
  amNom,
}: {
  compte: MonCompte;
  /**
   * L'URL SIGNÉE de la photo déjà en place, fabriquée par la page.
   *
   * Le seau est privé : `compte.photoUrl` n'est pas affichable, c'est une
   * référence (`/documents-entreprise/…`). La signature est un geste de
   * serveur, donc elle arrive en propriété plutôt que d'être demandée ici.
   * Nulle quand il n'y a pas de photo, ou quand la signature a échoué —
   * `Avatar` retombe alors sur les initiales.
   */
  photoApercu: string | null;
  /** Le prénom et le nom de l'Account Manager, pour le nommer plutôt que le désigner. */
  amNom: string | null;
}) {
  const router = useRouter();
  const { annoncer } = useToasts();
  const [enCours, demarrer] = useTransition();
  const [nonce, renouvelerNonce] = useNonce();

  const initial = {
    prenom: compte.prenom ?? "",
    nom: compte.nom ?? "",
    description: compte.description ?? "",
    photoUrl: compte.photoUrl ?? "",
  };
  const [champs, setChamps] = useState(initial);
  const [erreur, setErreur] = useState<{
    champ?: string;
    message: string;
  } | null>(null);
  const [modifie, setModifie] = useState(false);

  // Le `File` local n'existe que pour afficher le nom et le poids pendant et
  // après le dépôt. La VALEUR enregistrée, elle, est dans `champs.photoUrl`.
  const [fichierPhoto, setFichierPhoto] = useState<File | null>(null);
  const [etatPhoto, setEtatPhoto] = useState<EtatTeleversement>({
    phase: "repos",
  });
  // L'aperçu suit le dépôt : celui de la page au chargement, celui que la
  // Server Action vient de signer ensuite. Sans cela on afficherait l'ancienne
  // photo sous le nom de la nouvelle.
  const [apercu, setApercu] = useState<string | null>(photoApercu);

  const poser =
    <C extends keyof typeof champs>(cle: C) =>
    (valeur: string) => {
      setChamps((c) => ({ ...c, [cle]: valeur }));
      setModifie(true);
      setErreur(null);
    };
  const err = (cle: keyof typeof champs) =>
    erreur?.champ === cle ? erreur.message : undefined;

  const nomVisible = [champs.prenom, champs.nom]
    .filter(Boolean)
    .join(" ")
    .trim();

  /**
   * LE DÉPÔT DE LA PHOTO.
   *
   * ⚠ `Televersement` a DÉJÀ refusé les fichiers hors contraintes : son contrat
   * dit qu'un fichier refusé n'appelle pas `onFichier`. On arrive donc ici avec
   * un fichier acceptable côté navigateur — et la Server Action revérifie quand
   * même, parce qu'un point d'entrée POST est appelable sans passer par l'écran.
   *
   * ⚠ LE DÉPÔT N'ENREGISTRE PAS LE COMPTE. Il pose la valeur dans le
   * formulaire et marque celui-ci modifié ; c'est « Enregistrer » qui rattache
   * la photo. Écrire ici imposerait de rejouer les quatre autres champs, que la
   * personne est peut-être en train de corriger.
   */
  function deposerPhoto(fichier: File) {
    setFichierPhoto(fichier);
    // `progression` absente : Supabase Storage ne rapporte pas l'avancement
    // d'un `upload`, et inventer un pourcentage serait mentir.
    setEtatPhoto({ phase: "envoi" });

    demarrer(async () => {
      const donnees = new FormData();
      donnees.set("fichier", fichier);
      const r = await deposerPhotoCompte(donnees);

      if (r.ok) {
        setEtatPhoto({ phase: "fait" });
        setApercu(r.apercu);
        poser("photoUrl")(r.valeur);
      } else {
        setEtatPhoto({ phase: "echec", message: r.erreur });
        setFichierPhoto(null);
        annoncer({
          titre: "La photo n’a pas été déposée",
          description: r.erreur,
          ton: "echec",
          duree: 0,
        });
      }
    });
  }

  function enregistrer() {
    demarrer(async () => {
      const r: Retour = await majMonCompte({
        ...champs,
        // Le métier est réémis tel quel : la fonction écrit un formulaire
        // entier, l'omettre l'effacerait.
        metierCode: compte.metierCode ?? "",
        nonce,
      });
      if (r.ok) {
        annoncer({ titre: r.message, ton: "succes" });
        setModifie(false);
        setErreur(null);
        setEtatPhoto({ phase: "repos" });
        renouvelerNonce();
        router.refresh();
      } else {
        setErreur({ champ: r.champ, message: r.erreur });
        annoncer({
          titre: "Vos informations n’ont pas été enregistrées",
          description: r.erreur,
          ton: "echec",
          duree: 0,
        });
      }
    });
  }

  const photoEnPlace = Boolean(champs.photoUrl);

  return (
    /* Deux colonnes : ce qu'on change à gauche, ce qu'on subit à droite. Le
       formulaire est borné à 680px comme celui du brief — un champ de nom sur
       1 200px ne dit plus ce qu'on attend dedans. */
    <div className="flex flex-wrap items-start gap-5">
      <Carte
        regime="travail"
        className="flex min-w-0 flex-[0_1_680px] flex-col gap-5 p-6"
      >
        <h2 className="t-h3">Ce que vous pouvez changer</h2>

        <GrilleChamps colonnes={2} className="gap-x-5">
          <ChampSaisie
            libelle="Prénom"
            requis
            value={champs.prenom}
            onChange={(e) => poser("prenom")(e.currentTarget.value)}
            erreur={err("prenom")}
          />
          <ChampSaisie
            libelle="Nom"
            requis
            value={champs.nom}
            onChange={(e) => poser("nom")(e.currentTarget.value)}
            erreur={err("nom")}
          />
        </GrilleChamps>

        {/* ⚠ ON DÉPOSE UN FICHIER, ON NE COLLE PAS UNE ADRESSE.
            Ce champ était un `ChampSaisie` avec « Adresse d'image » pour toute
            aide. Personne ne colle une URL quand on lui demande sa photo — et
            la mesure le disait : `photo_url` est renseigné sur 0 contact du
            compte de test. Le motif invoqué pour ne pas faire mieux était que
            le portail entreprise n'avait aucun point d'entrée de dépôt. C'était
            une raison de le construire : seau `documents-entreprise` (migration
            `20260913230000`), `lib/stockage.ts`, `deposerPhotoCompte`.

            L'APERÇU est la moitié qui compte. Un nom de fichier ne dit pas ce
            qu'il y a dedans — `IMG_4471.jpg` moins que tout autre — et c'est la
            seule façon de vérifier qu'on a déposé la bonne image. Il est signé
            côté serveur : le seau est privé. */}
        <Televersement
          libelle="Photo"
          typesAcceptes={TYPES_PHOTO}
          libelleTypes="JPEG, PNG ou WebP"
          tailleMaxOctets={TAILLE_MAX_PHOTO_OCTETS}
          fichier={fichierPhoto}
          fichierExistant={
            !fichierPhoto && photoEnPlace
              ? {
                  nom: nomLisible(champs.photoUrl) ?? "Votre photo",
                  href: apercu ?? undefined,
                }
              : null
          }
          apercu={
            photoEnPlace ? (
              <Avatar
                nom={nomVisible || "?"}
                src={apercu}
                taille={56}
                forme="rond"
              />
            ) : undefined
          }
          onFichier={deposerPhoto}
          onRetirer={() => {
            setFichierPhoto(null);
            setEtatPhoto({ phase: "repos" });
            setApercu(null);
            poser("photoUrl")("");
          }}
          etat={etatPhoto}
          desactive={enCours}
          erreur={err("photoUrl")}
        />

        {/* « En une phrase » : un champ d'une ligne, pas une zone de trois. Le
            libellé dit l'attendu, le boîtier doit le dire aussi. */}
        <ChampSaisie
          libelle="Votre rôle, en une phrase"
          placeholder="Je décide des recrutements et j’arbitre les fourchettes."
          value={champs.description}
          onChange={(e) => poser("description")(e.currentTarget.value)}
          erreur={err("description")}
          maxLength={300}
        />
      </Carte>

      {/* ⚠ « CE QUI VIENT DE VOTRE CONTRAT », et non « Tenu par Pachamama ».
          Le second dit QUI détient, le premier dit D'OÙ ÇA VIENT — c'est la
          question qu'on se pose devant une ligne qu'on ne peut pas modifier. */}
      <aside className="flex min-w-0 max-w-[400px] flex-[1_1_300px] flex-col gap-5">
        <Carte regime="travail" className="flex flex-col gap-4 p-5">
          <h2 className="t-h3">Ce qui vient de votre contrat</h2>
          {/* Une colonne : le panneau fait 300px, deux colonnes y donneraient
              130px par valeur et couperaient les adresses électroniques. */}
          <dl className="flex flex-col gap-3">
            <Champ libelle="Adresse de connexion" valeur={compte.email} />
            <Champ libelle="Fonction" valeur={compte.metier} />
            <Champ libelle="Entreprise" valeur={compte.entreprise} />
            {/* ⚠ « Vous » PLUTÔT QUE « Oui ». `estReferent` dit si CETTE
                personne est le contact principal de l'entreprise ; « Oui » sous
                le libellé « Contact principal » se lit comme « il y en a un »,
                ce qui n'est pas la même information. */}
            <Champ
              libelle="Contact principal"
              valeur={
                compte.estReferent
                  ? "Vous"
                  : "Une autre personne de votre équipe"
              }
            />
          </dl>
          <Divider />
          {/* ⚠ LE NOM, QUAND ON L'A. « Votre Account Manager » désigne une
              fonction ; un nom désigne quelqu'un à qui écrire. Le wireframe va
              plus loin et pose un bouton « Écrire à … » — il n'y en a pas ici :
              `am_email` est VIDE sur la vue (mesuré, 0/1 sur le compte de
              test). Un bouton d'écriture sans adresse serait un bouton mort. */}
          <p className="t-body text-black">
            {amNom ?? "Votre Account Manager"} modifie ces quatre lignes pour
            vous.
          </p>
        </Carte>
      </aside>

      <BarreEnregistrement
        modifie={modifie}
        enCours={enCours}
        onEnregistrer={enregistrer}
        onAnnuler={() => {
          setChamps(initial);
          setFichierPhoto(null);
          setEtatPhoto({ phase: "repos" });
          setApercu(photoApercu);
          setModifie(false);
          setErreur(null);
        }}
      />
    </div>
  );
}
