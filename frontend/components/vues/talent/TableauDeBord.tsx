import Link from 'next/link';

import { Bouton } from '@/components/pacha/Bouton';
import { Carte } from '@/components/pacha/Carte';
import { EtatVide } from '@/components/pacha/EtatVide';
import { Icone } from '@/components/pacha/Icone';
import { FormeEtincelles, FormeEtoiles } from '@/components/pacha/Illustration';
import { Jauge } from '@/components/pacha/Jauge';
import { CandidatureSpontanee } from '@/components/vues/talent/CandidatureSpontanee';
import { ListeCandidatures } from '@/components/vues/talent/ListeCandidatures';
import {
  CadreEcran,
  CarteInterlocuteur,
  EnteteEcran,
  LienInvitation,
  Precision,
} from '@/components/vues/talent/atomes';
import {
  dateLongue,
  manquantsPrioritaires,
  repartirCandidatures,
  type CandidatureTalent,
  type Completude,
  type FicheTalent,
  type ManqueTalent,
} from '@/lib/domaine/talent';
import { cn } from '@/lib/utils';

/**
 * Combien de process l'aperçu montre avant de renvoyer à l'écran dédié.
 *
 * Deux, et non trois. Depuis que les candidatures tiennent la colonne large,
 * une carte occupe toute la largeur et non plus la moitié : trois repoussaient
 * l'interlocuteur sous la ligne de flottaison sur un portable.
 */
const APERCU = 2;

/** Combien de manques nommés avant de replier le reste sur un compte. */
const MANQUES_MONTRES = 3;

/**
 * MON ESPACE — l'écran d'accueil du talent.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA HIÉRARCHIE VIENT DU WIREFRAME, LES COMPOSANTS VIENNENT DU SYSTÈME
 * ─────────────────────────────────────────────────────────────────────────
 * Le wireframe `templates/mon-espace/` du projet Design a inversé les deux
 * colonnes, et il a raison : **la visite a lieu pour savoir où en sont les
 * process**. Ils prennent donc la colonne large, et la complétude — qui est un
 * remplissage graduel, pas une nouvelle — passe en colonne étroite avec
 * l'interlocuteur.
 *
 * Ce qu'il écrivait à la main, le DS le portait déjà, et c'est le DS qui gagne :
 *   · ses trois traitements de carte sont `Carte regime={accroche|contour|travail}` ;
 *   · sa barre à quinze segments est `Jauge segments={15} taille="sm"` ;
 *   · ses pastilles gardent la couleur de `ref.etape_process`, jamais une
 *     teinte inerte choisie ici — une close n'appelle aucun geste, et ça se dit
 *     en retirant le chevron et le survol, pas en repeignant.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ACCORD EST UNE BANDE, TOUJOURS PRÉSENTE, EN TROIS ÉTATS
 * ─────────────────────────────────────────────────────────────────────────
 * Il était un encart qui n'apparaissait qu'en cas de manque, et une ligne de
 * précision sinon : deux formes pour un même fait, donc deux endroits à
 * chercher. C'est désormais un seul bloc dont seul le RÉGIME change, et le
 * régime dit la portée — `accroche` quand on attend quelque chose de la
 * personne, `contour` quand c'est un fait établi, `travail` quand le dossier
 * est en pause.
 *
 * Le consentement passe devant la complétude parce que c'est une AUTORISATION
 * ABSENTE et non un remplissage : sans lui, rien ne part, quel que soit l'état
 * de la fiche. `consentement_donne_le` existe depuis la reprise et n'a jamais
 * été écrite — sur les 7 023 fiches, personne n'a consenti à ce jour. L'état
 * « accord absent » est donc l'état NOMINAL de cet écran, pas son cas limite.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ LA JAUGE N'EST PAS CELLE QUE LE BRIEF DÉCRIT, ET C'EST MESURÉ
 * ─────────────────────────────────────────────────────────────────────────
 * Le brief demande des invitations « tirées de `champs_manquants` ». La colonne
 * existe, la vue la projette, et elle est **nulle sur les 7 023 fiches**. Idem
 * pour `score_completude`. Le calcul vit donc dans `completudeDe`, côté
 * domaine, et il fait mieux que la colonne : chaque manque nomme l'écran qui le
 * répare, et les deux bloquants se disent bloquants.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUI NE FRANCHIT PAS LA FRONTIÈRE
 * ─────────────────────────────────────────────────────────────────────────
 * Ce composant reçoit une `Completude` — un nombre et des libellés — et non la
 * fiche complète. `Jauge` est un composant CLIENT : tout ce qu'on lui passe
 * part dans la charge utile RSC. Le score et « Votre CV » y vont ; l'adresse,
 * le téléphone et le chemin du CV restent sur le serveur (D-15).
 */
export function TableauDeBord({
  fiche,
  completude,
  candidatures,
  interlocuteur,
}: {
  /** `COLONNES_ENTETE` seulement : prénom, actif, consentement. Pas de photo. */
  fiche: FicheTalent;
  completude: Completude;
  candidatures: CandidatureTalent[];
  interlocuteur: { prenom: string | null; nom: string | null; photo: string | null; fonction: string | null } | null;
}) {
  const { enCours, closes } = repartirCandidatures(candidatures);
  const nomAgent = [interlocuteur?.prenom, interlocuteur?.nom].filter(Boolean).join(' ') || null;
  const apercu = (enCours.length > 0 ? enCours : closes).slice(0, APERCU);
  const montres = manquantsPrioritaires(completude, MANQUES_MONTRES);
  const restants = completude.manquants.length - montres.length;

  return (
    <CadreEcran>
      {/* Le duo de titre porte la salutation en serif et le nom de l'écran en
          Bricolage. Une fiche sans prénom est un cas RÉEL — 51 fiches actives,
          mesuré — et « Bonjour null » serait la pire des salutations : le repli
          reste une salutation, et l'invitation à se nommer est dans le dossier.
          Aucune action à droite : « Offres » est dans la barre latérale, et
          l'y répéter n'ajoute rien. */}
      <EnteteEcran
        descriptif={fiche.prenom ? `Bonjour ${fiche.prenom},` : 'Bonjour,'}
        impact="Mon espace"
        // Le seul trait de feutre du portail. L'accueil est le seul écran qui
        // salue ; souligner aussi « Ma fiche », « Vos process » et le reste
        // reviendrait à tout souligner, donc à ne plus rien désigner.
        souligne
      />

      {/* ─────────────────────────────── 1. l'autorisation, avant tout le reste */}
      <BandeAccord actif={fiche.actif !== false} donneLe={fiche.consentementDonneLe ?? null} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ─────────────────────── 2. les process, dans la colonne large */}
        <section aria-labelledby="candidatures" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="candidatures" className="t-h3">
              Vos candidatures
            </h2>
            {candidatures.length > 0 && (
              <LienInvitation href="/talent/process" className="shrink-0">
                Mes process
              </LienInvitation>
            )}
          </div>

          {/* ⚠ UN APERÇU, PAS LE SUIVI. Le suivi complet vit sur « Mes
              process ». Ici, les deux process en cours les plus récents. Les
              closes ne sont pas listées du tout : elles n'appellent aucun geste
              et se réduisent à leur nombre, sous l'aperçu. */}
          {candidatures.length === 0 ? (
            <Carte regime="travail" className="p-2">
              <EtatVide
                titre="Aucun process pour l’instant"
                description="Dès que vous postulez, le suivi s’affiche ici."
                illustration={<FormeEtoiles />}
                action={
                  // DEUX ISSUES, PARCE QU'IL Y A DEUX SITUATIONS : soit une des
                  // offres publiées convient, soit aucune — et dans le second
                  // cas, la seule façon d'entrer dans le pipeline depuis cet
                  // espace est la candidature spontanée. Sans elle, il faudrait
                  // écrire un courriel, et cette candidature n'existerait nulle
                  // part dans le modèle.
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Bouton href="/talent/offres" apparence="plein">
                      Voir les offres ouvertes
                    </Bouton>
                    <CandidatureSpontanee apparence="contour" />
                  </div>
                }
              />
            </Carte>
          ) : (
            <div className="flex flex-col gap-3">
              <ListeCandidatures candidatures={apercu} />
              {/* Le compte des closes, sans geste attaché : il dit qu'elles
                  existent et où les trouver, il ne les met pas en scène. */}
              {enCours.length > 0 && closes.length > 0 && (
                <Precision>
                  {closes.length} candidature{closes.length > 1 ? 's closes' : ' close'}, dans{' '}
                  <LienInvitation href="/talent/process" className="align-baseline">
                    Mes process
                  </LienInvitation>
                </Precision>
              )}
              {enCours.length === 0 && (
                <Precision>Aucun process en cours. Ceux-ci sont clos.</Precision>
              )}
            </div>
          )}
        </section>

        {/* ──────────── 3. le dossier et l'interlocuteur, en colonne étroite */}
        <aside className="flex flex-col gap-4">
          <Carte regime="travail" className="flex flex-col gap-4 p-4">
            {/* `chiffre="fraction"` et non un pourcentage : quinze segments
                montrent un COMPTE, et « 14 / 15 » se lit d'un coup d'œil là où
                « 93 % » demande une conversion. `segments` vaut le total
                attendu, donc un segment par information. */}
            {/* La carte ne se félicite QUE lorsqu'il n'y a plus rien à
                remplir. C'est l'autre chose que cet écran réclame en
                permanence ; quand c'est fait, il le dit une fois, et la
                marque de marque vaut mieux qu'une phrase de plus. */}
            {completude.manquants.length === 0 && (
              <div className="flex items-center gap-2">
                <FormeEtincelles aria-hidden="true" className="size-5 shrink-0 text-[var(--violet-400)]" />
                <p className="t-caption-hl text-black">Tout y est.</p>
              </div>
            )}
            <Jauge
              valeur={completude.remplis}
              max={completude.attendus}
              segments={completude.attendus}
              chiffre="fraction"
              taille="sm"
              libelle="Votre dossier"
              ton={completude.manquants.length === 0 ? 'positif' : 'defaut'}
            />

            {montres.length > 0 ? (
              <ul className="flex flex-col">
                {montres.map((m) => (
                  <LigneManque key={m.libelle} manque={m} />
                ))}
                {restants > 0 && (
                  <LigneManque
                    manque={{
                      libelle: `et ${restants} autre${restants > 1 ? 's informations' : ' information'}`,
                      href: '/talent/fiche',
                      ecran: 'Qui vous êtes',
                      bloquant: false,
                    }}
                    attenue
                  />
                )}
              </ul>
            ) : (
              <ul className="flex flex-col">
                <LigneManque
                  manque={{
                    libelle: 'Ma fiche',
                    href: '/talent/fiche',
                    ecran: 'Qui vous êtes',
                    bloquant: false,
                  }}
                />
              </ul>
            )}
          </Carte>

          {nomAgent ? (
            <CarteInterlocuteur
              titre="Qui suit votre dossier"
              nom={nomAgent}
              photo={interlocuteur?.photo ?? null}
              fonction={interlocuteur?.fonction ?? null}
              // ⚠ PAS D'ADRESSE : `api.ma_candidature_detail` ne projette pas
              // celle de l'agent, et aucune vue talent ne rend de canal de
              // contact. La carte est inerte, et c'est volontaire.
            />
          ) : (
            <Carte regime="travail" className="flex flex-col gap-2 p-4">
              <p className="t-caption text-[var(--encre-500)]">Qui suit votre dossier</p>
              <p className="t-body text-black">
                Il vous sera présenté dès votre première candidature.
              </p>
            </Carte>
          )}
        </aside>
      </div>
    </CadreEcran>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   L'accord de présentation
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * UN SEUL BLOC, TROIS RÉGIMES, ET LE RÉGIME PORTE LE SENS.
 *
 * `accroche` — filet noir et ombre — quand on attend une décision de la
 * personne. C'est la seule carte de la page à le porter, et c'est ce qui la
 * fait lire en premier. `contour` quand l'accord est donné : le fait est
 * établi, il se consulte, il n'appelle plus rien. `travail` quand le dossier
 * est retiré : l'information reste, elle ne réclame pas.
 *
 * ⚠ LE GESTE N'EST PAS ICI. Donner ou reprendre son accord s'écrit sur « Mes
 * données », qui porte aussi l'export et la demande de suppression — les
 * quatre gestes qui touchent au dossier lui-même vivent ensemble. Cette bande
 * énonce l'état et ouvre la porte ; elle ne duplique pas l'interrupteur.
 */
function BandeAccord({ actif, donneLe }: { actif: boolean; donneLe: string | null }) {
  const donne = Boolean(donneLe);

  const { regime, fond, titre, action } = !actif
    ? {
        regime: 'travail' as const,
        fond: 'bg-[var(--fond-inerte)]',
        titre: 'Votre dossier est retiré du marché',
        action: 'Voir mes données',
      }
    : donne
      ? {
          regime: 'contour' as const,
          fond: 'bg-[var(--fond-carte)]',
          titre: `Présentation autorisée depuis le ${dateLongue(donneLe)}`,
          action: 'Revenir sur mon accord',
        }
      : {
          regime: 'accroche' as const,
          fond: 'bg-[var(--violet-050)]',
          titre: 'Votre dossier n’est présenté à aucune entreprise',
          action: 'Donner mon accord',
        };

  return (
    <Carte
      regime={regime}
      className={cn('flex flex-wrap items-center justify-between gap-x-6 gap-y-4 p-5', fond)}
    >
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
        <p className="t-caption text-[var(--encre-600)]">Accord de présentation</p>
        <h2 className="t-h3">{titre}</h2>
      </div>
      <Bouton
        href="/talent/confidentialite"
        apparence={regime === 'accroche' ? 'plein' : 'contour'}
        taille="sm"
        iconeApres={regime === 'accroche' ? <Icone nom="icon-arrow-right" /> : undefined}
      >
        {action}
      </Bouton>
    </Carte>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Une information qui manque, et la porte qui la répare
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ CHAQUE LIGNE VISE LE CHAMP, PAS LE DOSSIER.
 *
 * `href` porte l'ancre de la section qui répare ce manque précis
 * (`/talent/fiche#ce-que-vous-cherchez`). Renvoyer vers « Ma fiche » tout court
 * rendrait l'invitation inutile : l'écran fait trois hauteurs, et retrouver le
 * champ y coûte plus cher que de le remplir.
 *
 * La hauteur de 44px est celle d'une cible tactile confortable, et elle donne à
 * la liste le rythme d'un menu plutôt que d'un paragraphe à puces — ce qu'elle
 * était, et ce qui ne se cliquait pas.
 */
function LigneManque({ manque, attenue }: { manque: ManqueTalent; attenue?: boolean }) {
  return (
    <li>
      <Link
        href={manque.href}
        className={cn(
          'flex h-11 items-center justify-between gap-2 rounded-[var(--r-sm)] px-2',
          'border-t border-[var(--encre-100)] hover:bg-[var(--violet-050)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn('truncate', attenue ? 't-body text-[var(--encre-600)]' : 't-body-hl text-black')}
          >
            {manque.libelle}
          </span>
          {/* La marque des deux manques sans lesquels rien ne part. Fond
              `--statut-attente`, texte NOIR : c'est la règle dure du système,
              et les couleurs de statut sont toutes claires par construction. */}
          {manque.bloquant && (
            <span className="t-caption-hl inline-flex h-[22px] shrink-0 items-center rounded-[var(--r-md)] bg-[var(--statut-attente)] px-[7px] text-black">
              Bloquant
            </span>
          )}
        </span>
        <Icone nom="icon-chevron-right" className="size-4 shrink-0 text-[var(--encre-500)]" />
      </Link>
    </li>
  );
}
