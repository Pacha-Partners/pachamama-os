'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { Avatar } from '@/components/pacha/Avatar';
import { Carte } from '@/components/pacha/Carte';
import { ElementMenu } from '@/components/pacha/Menu';
import { Champ as ChampSaisie } from '@/components/pacha/Champ';
import { Televersement, type EtatTeleversement } from '@/components/pacha/Televersement';
import { useToasts } from '@/components/pacha/Toast';
import { FormulaireAttentes, type Vocabulaires } from '@/components/vues/talent/FormulaireAttentes';
import { Parcours } from '@/components/vues/talent/Parcours';
import {
  BarreEnregistrement,
  Champ,
  GrilleChamps,
  LienInvitation,
  Precision,
  type PoigneeSection,
} from '@/components/vues/talent/atomes';
import { useNonce } from '@/components/vues/talent/nonce';
import {
  dateLongue,
  libelleAnglais,
  nomLisible,
  type FicheTalent,
  type PosteTalent,
} from '@/lib/domaine/talent';
import { deposerDocument, majMonProfil, type Retour } from '@/lib/talent/actions';
import { TAILLE_MAX_OCTETS, TYPES_CV, TYPES_IMAGE } from '@/lib/talent/saisie';
import { cn } from '@/lib/utils';

/**
 * QUELLE SECTION ON REGARDE, ET POURQUOI ÇA S'OBSERVE PLUTÔT QUE SE DÉDUIRE.
 *
 * La navigation porte un état actif ; sans mesure, il faudrait le poser en dur
 * sur la première entrée, et il mentirait dès le premier défilement. Le fragment
 * de l'URL ne suffit pas non plus : il ne change qu'au clic, jamais au
 * défilement, et il reste figé sur la dernière ancre visitée.
 *
 * `rootMargin` borne une bande de lecture : on retranche en haut la coquille
 * collante — 62px de barre plus la rangée d'ancres en étroit —, et en bas 55 %
 * de la fenêtre. Une section est « courante » quand son haut entre dans le tiers
 * supérieur, ce qui est l'endroit où l'œil lit. Sans la marge basse, les trois
 * sections seraient visibles ensemble sur un grand écran et la dernière
 * gagnerait toujours.
 */
function useSectionVisible(ancres: readonly string[]): string {
  const [courante, setCourante] = useState(ancres[0]);

  useEffect(() => {
    const cibles = ancres
      .map((a) => document.getElementById(a))
      .filter((e): e is HTMLElement => e !== null);
    if (cibles.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const observateur = new IntersectionObserver(
      (entrees) => {
        // La plus HAUTE des sections qui croisent la bande : plusieurs peuvent
        // y être à la fois, et c'est celle du dessus qu'on est en train de lire.
        const visible = entrees
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setCourante(visible.target.id);
      },
      { rootMargin: '-110px 0px -55% 0px', threshold: 0 },
    );

    cibles.forEach((c) => observateur.observe(c));
    return () => observateur.disconnect();
  }, [ancres]);

  return courante;
}

/**
 * MA FICHE — les trois écrans qui n'en faisaient qu'un.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI UN SEUL ÉCRAN
 * ─────────────────────────────────────────────────────────────────────────
 * « Mon profil », « Mes attentes » et « Mon parcours » n'écrivaient rien
 * d'autre que la fiche talent : `core.fiche_talent` pour les deux premiers, ses
 * satellites (`_secteur_vise`, `_secteur_nogo`, `_critere`, `_expertise`,
 * `_contrat_souhaite`, `_remote_souhaite`) et `core.fiche_talent_poste` pour
 * les autres. Trois écrans, un seul objet — et la complétude le disait déjà :
 * elle compte 21 colonnes qui traversaient les trois, ce qui obligeait le
 * tableau de bord à écrire « sur les deux écrans ci-dessous ».
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DES SECTIONS, PAS DES ONGLETS
 * ─────────────────────────────────────────────────────────────────────────
 * Deux raisons, toutes deux mesurées sur cet écran.
 *
 * 1. La jauge de complétude annonce ce qui manque. Derrière trois onglets
 *    fermés, « il manque 8 informations » oblige à chercher ; empilé, il suffit
 *    de défiler.
 * 2. Les sections n'ont pas le même contrat d'enregistrement : identité,
 *    documents et attentes s'écrivent en différé, formulaire entier ; le
 *    parcours s'écrit poste par poste, immédiatement. Un onglet quitté avec des
 *    modifications non enregistrées ne le dit pas. Empilées, la barre couvre ce
 *    qu'elle couvre, et la liste des postes se voit se comporter en liste.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE REGROUPEMENT SUIT LA QUESTION POSÉE, PAS LA FAMILLE DE COLONNES
 * ─────────────────────────────────────────────────────────────────────────
 * L'ancien découpage suivait le stockage. Il rangeait le CV dans « profil »
 * alors que c'est une preuve du passé. Ici : qui vous êtes · ce que vous avez
 * fait · ce que vous cherchez. Effet de bord voulu — « Où vous êtes basé·e » se
 * retrouve parmi les coordonnées et « Où vous acceptez de travailler » parmi
 * les critères de recherche. Les deux se ressemblaient trop quand elles étaient
 * sur deux écrans ; c'est leur contexte qui les distingue, pas leur distance.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ LE PIÈGE DU CONTRAT « maj_ » EST INTACT
 * ─────────────────────────────────────────────────────────────────────────
 * `api.maj_ma_fiche` écrit ses NEUF colonnes à chaque appel, et un argument nul
 * EFFACE la valeur. On tient donc l'état des neuf champs et on les renvoie tous.
 * Même contrat pour `api.maj_mes_attentes`. C'est pour cela que le bouton
 * n'appelle QUE les sections salies : corriger un téléphone ne doit pas
 * réécrire dix colonnes d'attentes ni poser une entrée de journal de plus.
 */

const SECTIONS = [
  { ancre: 'qui-vous-etes', libelle: 'Qui vous êtes' },
  { ancre: 'ce-que-vous-avez-fait', libelle: 'Ce que vous avez fait' },
  { ancre: 'ce-que-vous-cherchez', libelle: 'Ce que vous cherchez' },
] as const;

/** Hors du composant : la référence doit être stable, c'est une dépendance d'effet. */
const ANCRES = SECTIONS.map((s) => s.ancre);

type Champs = {
  prenom: string;
  nom: string;
  emailPersonnel: string;
  telephone: string;
  urlLinkedin: string;
  localisationTexte: string;
  photoUrl: string;
  cvUrl: string;
  portfolioUrl: string;
};

function initiales(f: FicheTalent): Champs {
  // `?? ''` partout : un `<input>` contrôlé dont la valeur passe de `null` à une
  // chaîne bascule de non-contrôlé à contrôlé, et React le signale. Le retour
  // vers `null` se fait à l'enregistrement, dans le schéma zod.
  return {
    prenom: f.prenom ?? '',
    nom: f.nom ?? '',
    emailPersonnel: f.emailPersonnel ?? '',
    telephone: f.telephone ?? '',
    urlLinkedin: f.urlLinkedin ?? '',
    localisationTexte: f.localisationTexte ?? '',
    photoUrl: f.photoUrl ?? '',
    cvUrl: f.cvUrl ?? '',
    portfolioUrl: f.portfolioUrl ?? '',
  };
}

export function MaFiche({
  profil,
  attentes,
  vocabulaires,
  postes,
  cvHref,
  photoHref,
}: {
  profil: FicheTalent;
  attentes: FicheTalent;
  vocabulaires: Vocabulaires;
  postes: PosteTalent[];
  /** URL SIGNÉE du CV en place, fabriquée côté serveur. Expire en 5 minutes. */
  cvHref: string | null;
  photoHref: string | null;
}) {
  const router = useRouter();
  const { annoncer } = useToasts();
  const [enCours, demarrer] = useTransition();
  const [nonce, renouvelerNonce] = useNonce();
  const sectionCourante = useSectionVisible(ANCRES);

  const [champs, setChamps] = useState<Champs>(() => initiales(profil));
  const [erreur, setErreur] = useState<{ champ?: string; message: string } | null>(null);
  const [modifieProfil, setModifieProfil] = useState(false);

  // Le `File` local n'existe que pour l'affichage du nom et du poids pendant et
  // après le dépôt. La VALEUR enregistrée, elle, est dans `champs.cvUrl`.
  const [fichierCv, setFichierCv] = useState<File | null>(null);
  const [fichierPhoto, setFichierPhoto] = useState<File | null>(null);
  const [etatCv, setEtatCv] = useState<EtatTeleversement>({ phase: 'repos' });
  const [etatPhoto, setEtatPhoto] = useState<EtatTeleversement>({ phase: 'repos' });

  // La section « ce que vous cherchez » garde son état chez elle et se déclare
  // ici : ses dix colonnes et ses six listes n'ont pas à remonter.
  const poigneeAttentes = useRef<PoigneeSection | null>(null);
  const [modifieAttentes, setModifieAttentes] = useState(false);
  const rangerPoignee = useCallback((p: PoigneeSection) => {
    poigneeAttentes.current = p;
  }, []);

  const modifie = modifieProfil || modifieAttentes;

  const poser =
    <C extends keyof Champs>(cle: C) =>
    (valeur: string) => {
      setChamps((c) => ({ ...c, [cle]: valeur }));
      setModifieProfil(true);
      setErreur(null);
    };
  const err = (cle: keyof Champs) => (erreur?.champ === cle ? erreur.message : undefined);

  /**
   * Le dépôt d'un fichier, pour les deux natures.
   *
   * ⚠ `Televersement` a DÉJÀ refusé les fichiers hors contraintes : son contrat
   * dit qu'un fichier refusé n'appelle pas `onFichier`. On arrive donc ici avec
   * un fichier acceptable côté navigateur — et la Server Action revérifie quand
   * même, parce qu'un point d'entrée POST est appelable sans l'écran.
   */
  function deposer(
    nature: 'cv' | 'photo',
    fichier: File,
    poserFichier: (f: File | null) => void,
    poserEtat: (e: EtatTeleversement) => void,
  ) {
    poserFichier(fichier);
    // `progression` absente : Supabase Storage ne rapporte pas l'avancement d'un
    // `upload`, et inventer un pourcentage serait mentir.
    poserEtat({ phase: 'envoi' });

    demarrer(async () => {
      const donnees = new FormData();
      donnees.set('nature', nature);
      donnees.set('fichier', fichier);
      const r = await deposerDocument(donnees);

      if (r.ok) {
        poserEtat({ phase: 'fait' });
        poser(nature === 'cv' ? 'cvUrl' : 'photoUrl')(r.valeur);
      } else {
        poserEtat({ phase: 'echec', message: r.erreur });
        poserFichier(null);
        annoncer({
          titre: 'Le fichier n’a pas été déposé',
          description: r.erreur,
          ton: 'echec',
          duree: 0,
        });
      }
    });
  }

  async function sauverProfil(): Promise<boolean> {
    const r: Retour = await majMonProfil({ ...champs, nonce });
    if (r.ok) {
      setModifieProfil(false);
      setErreur(null);
      setEtatCv({ phase: 'repos' });
      setEtatPhoto({ phase: 'repos' });
      return true;
    }
    setErreur({ champ: r.champ, message: r.erreur });
    annoncer({
      titre: 'Vos informations n’ont pas été enregistrées',
      description: r.erreur,
      ton: 'echec',
      duree: 0,
    });
    return false;
  }

  /**
   * UN BOUTON, ET SEULEMENT LES SECTIONS SALIES.
   *
   * L'ordre compte : si l'identité échoue — prénom et nom sont obligatoires, la
   * base lève `22004` sans eux — on s'arrête avant d'écrire les attentes. Écrire
   * la seconde moitié d'un formulaire dont la première a été refusée laisserait
   * la personne devant un écran à moitié enregistré sans savoir laquelle.
   */
  function enregistrer() {
    demarrer(async () => {
      if (modifieProfil && !(await sauverProfil())) return;
      if (modifieAttentes && !(await poigneeAttentes.current?.sauver())) return;
      annoncer({ titre: 'Votre fiche est enregistrée.', ton: 'succes' });
      renouvelerNonce();
      router.refresh();
    });
  }

  function annuler() {
    setChamps(initiales(profil));
    setFichierCv(null);
    setFichierPhoto(null);
    setEtatCv({ phase: 'repos' });
    setEtatPhoto({ phase: 'repos' });
    setModifieProfil(false);
    setErreur(null);
    poigneeAttentes.current?.annuler();
  }

  const cvEnPlace = champs.cvUrl.trim() !== '';
  const photoEnPlace = champs.photoUrl.trim() !== '';

  return (
    /* ⚠ FLEX ET NON GRID, ET C'EST CE QUI REND LA NAVIGATION COLLANTE.
       Un élément `sticky` est borné par son bloc conteneur. Dans une grille à
       une seule colonne — le cas en étroit — la zone de grille de la navigation
       ne fait que sa propre hauteur : `sticky` n'a nulle part où glisser, et il
       ne se passait rien. En flex, le conteneur est la rangée entière,
       navigation ET contenu, donc elle accompagne le défilement dans les deux
       gabarits. */
    <div className="flex flex-wrap items-start gap-6 lg:gap-8">
      {/* ═════════════════════════════════════ la navigation par ancres ═══
          ⚠ `ElementMenu` DU DESIGN SYSTEM, ET NON TROIS LIENS RÉÉCRITS.
          Cette navigation avait été codée à la main — cotes, survol, anneau de
          focus, état actif recopiés à l'œil. Le système porte exactement ce
          composant, avec son contrat : un `<li><a>`, `aria-current` posé par
          `actif`, le fond `--violet-500` au repos sélectionné et le texte qui
          reste NOIR dessus. Le réécrire, c'était garantir la dérive au premier
          ajustement du DS.

          Deux extensions ont été posées DANS le système plutôt que contournées
          ici : la variante « discret », qui marque la section courante en violet
          pâle — le violet plein appartient à la barre latérale, à 190px de là —,
          et le visuel rendu facultatif, parce qu'un index de sections n'a rien à
          reconnaître de loin et que trois icônes inventées pour satisfaire un
          type n'auraient nommé personne.

          Les décalages collants ne sont pas des valeurs rondes : la barre du
          haut de la coquille est collée à 12px et mesure 38px de contenu plus
          12px de rembourrage, soit un bas à 62px. En dessous, la navigation
          passerait DERRIÈRE elle. En large, on ajoute la gouttière de 12px. */}
      <nav
        aria-label="Sections de votre fiche"
        className={cn(
          'sticky top-[62px] z-10 flex-[1_1_100%] bg-[var(--fond-page)] py-1',
          'lg:top-[74px] lg:w-[190px] lg:flex-[0_0_190px] lg:py-0',
        )}
      >
        <ul className="flex flex-row flex-wrap gap-1 lg:flex-col">
          {SECTIONS.map((s) => (
            <ElementMenu
              key={s.ancre}
              href={`#${s.ancre}`}
              libelle={s.libelle}
              actif={s.ancre === sectionCourante}
              variante="discret"
            />
          ))}
        </ul>
      </nav>

      {/* La colonne de contenu. 40px entre les sections — elles portent chacune
          plusieurs cartes, et 32px ne séparaient plus les sections des cartes
          qu'elles contiennent. */}
      <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-10">
        {/* ══════════════════════════════════════ 1. qui vous êtes ══════ */}
        <section id="qui-vous-etes" aria-labelledby="t-qui" className="flex flex-col gap-4">
          <h2 id="t-qui" className="t-h2">
            Qui vous êtes
          </h2>

          <Carte regime="travail" className="flex flex-col gap-5 p-5">
            <div className="grid gap-x-5 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
              <ChampSaisie
                libelle="Prénom"
                requis
                value={champs.prenom}
                onChange={(e) => poser('prenom')(e.currentTarget.value)}
                erreur={err('prenom')}
              />
              <ChampSaisie
                libelle="Nom"
                requis
                value={champs.nom}
                onChange={(e) => poser('nom')(e.currentTarget.value)}
                erreur={err('nom')}
              />
              <ChampSaisie
                libelle="Adresse électronique"
                type="email"
                inputMode="email"
                placeholder="prenom.nom@exemple.fr"
                value={champs.emailPersonnel}
                onChange={(e) => poser('emailPersonnel')(e.currentTarget.value)}
                erreur={err('emailPersonnel')}
              />
              <ChampSaisie
                libelle="Téléphone"
                inputMode="tel"
                placeholder="06 12 34 56 78"
                value={champs.telephone}
                onChange={(e) => poser('telephone')(e.currentTarget.value)}
                erreur={err('telephone')}
              />
              <ChampSaisie
                libelle="Où vous êtes basé·e"
                placeholder="Lyon, Paris, Bordeaux…"
                value={champs.localisationTexte}
                onChange={(e) => poser('localisationTexte')(e.currentTarget.value)}
                erreur={err('localisationTexte')}
              />
              <ChampSaisie
                libelle="Profil LinkedIn"
                // Pas de `type="url"` : la validation native du navigateur exige
                // un schéma, et la règle de la base accepte un domaine nu. Le
                // champ refuserait la donnée déjà présente.
                inputMode="url"
                placeholder="linkedin.com/in/votre-nom"
                value={champs.urlLinkedin}
                onChange={(e) => poser('urlLinkedin')(e.currentTarget.value)}
                erreur={err('urlLinkedin')}
              />
            </div>

            <Televersement
              libelle="Votre photo"
              typesAcceptes={TYPES_IMAGE}
              libelleTypes="JPEG, PNG ou WebP"
              tailleMaxOctets={TAILLE_MAX_OCTETS}
              fichier={fichierPhoto}
              fichierExistant={
                !fichierPhoto && photoEnPlace
                  ? { nom: nomLisible(champs.photoUrl) ?? 'Votre photo', href: photoHref ?? undefined }
                  : null
              }
              // Le même aperçu que côté entreprise : un nom de fichier ne dit
              // pas ce qu'il y a dedans, et c'est la seule vérification
              // possible. `photoHref` est déjà signé par la page.
              apercu={
                photoEnPlace ? (
                  <Avatar
                    nom={[champs.prenom, champs.nom].filter(Boolean).join(' ') || '?'}
                    src={photoHref}
                    taille={56}
                    forme="rond"
                  />
                ) : undefined
              }
              onFichier={(f) => deposer('photo', f, setFichierPhoto, setEtatPhoto)}
              onRetirer={() => {
                setFichierPhoto(null);
                setEtatPhoto({ phase: 'repos' });
                poser('photoUrl')('');
              }}
              etat={etatPhoto}
              desactive={enCours}
              erreur={err('photoUrl')}
            />
          </Carte>

          {/* Un vrai titre de carte, et non une étiquette grise : ce bloc est
              de même rang que les six champs du dessus — ce que la personne ne
              peut pas changer ne se mélange pas à ce qu'elle peut changer, mais
              ne se relègue pas non plus en note de bas de carte. */}
          <Carte regime="travail" className="flex flex-col gap-4 p-5">
            <h3 className="t-h3">Tenu par Pachamama</h3>
            <GrilleChamps colonnes={3}>
              <Champ libelle="Niveau d’anglais" valeur={libelleAnglais(profil.niveauAnglais ?? null)} />
              <Champ libelle="CV déposé le" valeur={dateLongue(profil.cvDeposeLe ?? null)} />
              <Champ libelle="Dernière modification" valeur={dateLongue(profil.modifieParLeTalentLe ?? null)} />
            </GrilleChamps>
            <Precision>Non modifiable ici&nbsp;: dites-le à votre interlocuteur.</Precision>
          </Carte>
        </section>

        {/* ═══════════════════════════════ 2. ce que vous avez fait ═════ */}
        <section id="ce-que-vous-avez-fait" aria-labelledby="t-fait" className="flex flex-col gap-4">
          <h2 id="t-fait" className="t-h2">
            Ce que vous avez fait
          </h2>

          <Carte regime="travail" className="flex flex-col gap-5 p-5">
            <Televersement
              libelle="Votre CV"
              typesAcceptes={TYPES_CV}
              libelleTypes="PDF, DOC ou DOCX"
              tailleMaxOctets={TAILLE_MAX_OCTETS}
              fichier={fichierCv}
              fichierExistant={
                // Le fichier EXISTANT n'est montré que s'il n'y a pas de dépôt en
                // cours : afficher les deux ferait croire à deux CV en place.
                !fichierCv && cvEnPlace
                  ? { nom: nomLisible(champs.cvUrl) ?? 'Votre CV', href: cvHref ?? undefined }
                  : null
              }
              onFichier={(f) => deposer('cv', f, setFichierCv, setEtatCv)}
              onRetirer={() => {
                setFichierCv(null);
                setEtatCv({ phase: 'repos' });
                poser('cvUrl')('');
              }}
              etat={etatCv}
              desactive={enCours}
              erreur={err('cvUrl')}
            />

            <ChampSaisie
              libelle="Portfolio, site, ou ce que vous voulez montrer"
              // Mesuré : 24 des 737 valeurs sont des phrases, pas des liens. Le
              // champ les accepte ; imposer une URL écrirait une règle contre
              // la donnée.
              placeholder="votre-nom.fr"
              value={champs.portfolioUrl}
              onChange={(e) => poser('portfolioUrl')(e.currentTarget.value)}
              erreur={err('portfolioUrl')}
            />

            {/* ⚠ UNE CARTE À FILET NOIR, ET NON UNE NOTE GRISE.
                Un fichier déposé et non enregistré n'existe pas pour le client :
                le dépôt a réussi côté stockage, mais `cv_url` n'est pas encore
                écrite. C'est le seul moment de l'écran où l'on a quelque chose à
                perdre en partant, et une `Precision` en gris le disait du même
                ton que « le mois est facultatif ». */}
            {(fichierCv || fichierPhoto) && (
              <Carte regime="contour" className="p-4">
                <p className="t-body-hl text-black">
                  {fichierCv && fichierPhoto
                    ? 'Vos deux fichiers sont déposés'
                    : 'Votre fichier est déposé'}{' '}
                  mais pas encore rattaché à votre dossier&nbsp;: enregistrez pour cela.
                </p>
              </Carte>
            )}

            {/* `LienInvitation` avec `nouvelOnglet` : ces deux liens étaient deux
                ancres réécrites à la main, avec leur soulignement et leur anneau
                de focus recopiés. L'atome les portait déjà. */}
            {(cvEnPlace || photoEnPlace) && (
              <div className="flex flex-wrap items-center gap-4">
                {cvEnPlace && cvHref && (
                  <LienInvitation href={cvHref} icone="icon-file-text" nouvelOnglet>
                    Ouvrir mon CV
                  </LienInvitation>
                )}
                {photoEnPlace && photoHref && (
                  <LienInvitation href={photoHref} icone="icon-image" nouvelOnglet>
                    Voir ma photo
                  </LienInvitation>
                )}
                <Precision>Ces liens expirent au bout de quelques minutes.</Precision>
              </div>
            )}
          </Carte>

          {/* Le parcours garde ses enregistrements par poste : c'est une liste,
              elle se comporte comme une liste. La barre du bas ne la couvre pas,
              et c'est visible. */}
          <Parcours postes={postes} />
        </section>

        {/* ═══════════════════════════ 3. ce que vous cherchez ══════════ */}
        <section id="ce-que-vous-cherchez" aria-labelledby="t-cherche" className="flex flex-col gap-4">
          <h2 id="t-cherche" className="t-h2">
            Ce que vous cherchez
          </h2>
          <FormulaireAttentes
            fiche={attentes}
            vocabulaires={vocabulaires}
            pilote={{ onModifie: setModifieAttentes, onPoignee: rangerPoignee }}
          />
        </section>

        {erreur && !erreur.champ && (
          <Carte regime="contour" className="p-4">
            <p className="t-body-hl text-black">{erreur.message}</p>
          </Carte>
        )}

        <BarreEnregistrement
          modifie={modifie}
          enCours={enCours}
          onEnregistrer={enregistrer}
          onAnnuler={annuler}
        />
      </div>
    </div>
  );
}
