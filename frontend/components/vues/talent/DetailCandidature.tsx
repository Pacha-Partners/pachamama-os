import { Bouton } from '@/components/pacha/Bouton';
import { Carte } from '@/components/pacha/Carte';
import { EtatVide } from '@/components/pacha/EtatVide';
import { FilCommentaires, type Commentaire } from '@/components/pacha/FilCommentaires';
import { Divider } from '@/components/pacha/Divider';
import { Icone } from '@/components/pacha/Icone';
import { FormeCourbe, FormeEtoiles } from '@/components/pacha/Illustration';
import { TagContrat, TagUnivers } from '@/components/pacha/Tag';
import { Titre } from '@/components/pacha/Titre';
import { ActionsRetrait } from '@/components/vues/talent/ActionsRetrait';
import {
  CarteEquipe,
  Champ,
  GrilleChamps,
  LienInvitation,
  PastilleEtape,
  Precision,
} from '@/components/vues/talent/atomes';
import { teinteUnivers } from '@/lib/domaine/offre';
import {
  dateLongue,
  friseDe,
  nomEntreprise,
  retraitPossible,
  type CandidatureDetail,
  type MarcheFrise,
  type NoteTalent,
} from '@/lib/domaine/talent';
import { cn } from '@/lib/utils';

/**
 * LE DÉTAIL D'UNE CANDIDATURE, VU DU CANDIDAT.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ CE QUE CET ÉCRAN NE PEUT PAS MONTRER, ET POURQUOI CE N'EST PAS UN CHOIX
 * ─────────────────────────────────────────────────────────────────────────
 * L'argumentaire écrit au client, l'avis Pachamama, les six colonnes de
 * jugement de la candidature, la qualification cabinet : `api.ma_candidature_
 * detail` NE LES CONSTRUIT PAS. Vérifié par sonde le 09/09 sur le compte de
 * test — `select=argumentaire_client`, `avis_pachamama`, `note_interne`,
 * `mindset`, `est_qualifie`, `pretention_ke`, `statut_relation` répondent tous
 * **42703, colonne inexistante**. Ce composant n'a donc aucune décision de
 * sécurité à reprendre, et il ne doit pas en reprendre : un filtrage écrit ici
 * ne protégerait rien, la vue étant interrogeable directement au réseau.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ÉTAPE EST DITE DANS LE REGISTRE TALENT, ET RIEN N'EST AJOUTÉ
 * ─────────────────────────────────────────────────────────────────────────
 * `api.ma_candidature_detail.etape` rend `libelle_talent` (D-02), qui replie
 * les trois formes de KO sur « Candidature close ». C'est délibéré : dire
 * « écarté par Pachamama » plutôt que « écarté par le client » est une
 * information qui expose sans aider. L'écran n'ajoute donc aucune précision de
 * sa part, et il dit à qui s'adresser pour en parler.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES DEUX LISTES DE L'OFFRE SONT LÀ, ET ELLES SONT LA VRAIE MATIÈRE
 * ─────────────────────────────────────────────────────────────────────────
 * Mesuré sur les 6 candidatures du compte de test : `mandat_missions` est
 * NULLE six fois sur six, `mandat_salaire_affiche` et `mandat_remote_affiche`
 * aussi — mais `mandat_pour_toi` et `mandat_pas_pour_toi` sont renseignées six
 * fois sur six, et longuement. Ce sont elles qui rappellent à quelqu'un
 * pourquoi il a postulé, et elles portent leurs propres puces (✅ / 🚫) : on
 * rend donc le texte tel quel, en préservant les retours à la ligne, sans
 * fabriquer une liste HTML par-dessus une liste déjà écrite.
 */
export function DetailCandidature({
  candidature,
  notes,
  motifs,
}: {
  candidature: CandidatureDetail;
  notes: NoteTalent[];
  /** Les 7 motifs de catégorie `candidat`, lus dans `api.mon_referentiel`. */
  motifs: readonly { valeur: string; libelle: string }[];
}) {
  const c = candidature;
  const frise = friseDe(c);

  // `etape_ordre` vaut 10 pour `hired`, et 11 à 14 pour les quatre issues KO.
  // On exige les deux conditions plutôt que le seul rang : une issue KO mal
  // ordonnée un jour dans le référentiel afficherait sinon un bandeau vert.
  const recrute = !c.estKo && c.etapeOrdre === 10;
  const retiree = Boolean(c.retireeLe);
  const close = c.estKo && !retiree;

  // La fiche n'est partie chez le client qu'à partir de `send_out` (rang 6).
  // Avant, la carte « ce qui a été transmis » serait un mensonge.
  const ficheTransmise = (c.etapeOrdre ?? 0) >= 6;

  /**
   * ⚠ CE BLOC EST INCONDITIONNEL, ET IL NE L'ÉTAIT PAS.
   *
   * Il ne s'affichait que lorsque l'offre n'était plus publiée, l'idée étant
   * que son détail vit sur sa fiche et qu'on ne le rapatrie qu'en dernier
   * recours. La règle ne tient pas : une candidature close porte presque
   * toujours une offre dépubliée, une candidature en cours une offre en ligne.
   * La quantité d'information affichée dépendait donc d'un état qui ne regarde
   * pas le candidat, et l'écart entre les deux se voyait à l'écran.
   *
   * Or la question qu'on se pose sur un process en cours — « est-ce que ce
   * poste est encore pour moi ? » — est exactement celle à laquelle ces deux
   * blocs répondent. Ils restent donc là quoi qu'il arrive ; seule la note du
   * bas change, selon que la fiche complète est encore atteignable ou non.
   */
  const textesOffre = [
    c.missions && { titre: 'Les missions', corps: c.missions },
    c.pourToi && { titre: 'Ce poste est pour vous si', corps: c.pourToi },
    c.pasPourToi && { titre: 'Ce poste n’est pas pour vous si', corps: c.pasPourToi },
  ].filter(Boolean) as { titre: string; corps: string }[];

  return (
    <div className="flex flex-wrap items-start gap-5">
      {/* ══════════════════════════ la colonne du suivi ══════════════════ */}
      <div className="flex min-w-0 flex-[5_1_560px] flex-col gap-5">
        {recrute && (
          <Carte
            regime="contour"
            className="flex flex-col gap-1.5 bg-[var(--statut-positif)] p-5"
          >
            {/* Les étoiles ne sont pas un ornement de bandeau : c'est le seul
                aboutissement du portail, et la seule fois où l'écran a quelque
                chose à fêter. Les mettre aussi sur « Dossier transmis » ou
                « Entretien programmé » les userait avant ce moment-ci. */}
            <div className="flex items-center gap-2.5">
              <FormeEtoiles aria-hidden="true" className="size-6 shrink-0 text-black" />
              <h2 className="t-h3">
                Vous êtes recruté·e{c.entreprise ? ` chez ${c.entreprise}` : ''}
              </h2>
            </div>
            <p className="t-body max-w-[64ch] text-black">
              Ce process est arrivé à son terme. Vos autres candidatures, elles, suivent leur
              cours.
            </p>
          </Carte>
        )}

        {/* ⚠ LE BANDEAU D'ARRÊT NE DIT JAMAIS QUI A FERMÉ (D-02). Les trois
            issues KO rendent le même libellé, et ce texte n'ajoute rien : il
            borne la portée — les autres process ne sont pas concernés — et
            renvoie vers la personne qui peut en dire plus. */}
        {(close || retiree) && (
          <Carte regime="travail" className="flex flex-col gap-1.5 bg-[var(--fond-inerte)] p-5">
            <h2 className="t-h3">{retiree ? 'Candidature retirée' : 'Candidature close'}</h2>
            <p className="t-body max-w-[64ch] text-[var(--encre-700)]">
              {retiree ? (
                <>
                  Vous avez retiré votre candidature le {dateLongue(c.retireeLe)}.
                  {c.motifRetrait ? ` Motif : ${c.motifRetrait}.` : ''}
                  {c.offreEncorePubliee
                    ? ' L’offre est encore ouverte : elle reste visible dans les offres.'
                    : ''}
                </>
              ) : (
                <>
                  Ce process est terminé. Vos autres candidatures ne sont pas concernées, et
                  votre interlocuteur peut vous en dire plus.
                </>
              )}
            </p>
          </Carte>
        )}

        <Carte regime="travail" className="flex flex-col gap-4 p-5 pb-1">
          <h2 className="t-h3">Les étapes du process</h2>
          <Frise marches={frise} />
        </Carte>

        {textesOffre.length > 0 && (
          <section aria-labelledby="poste" className="flex flex-col gap-3">
            <h2 id="poste" className="t-h3">
              Le poste
            </h2>
            <Carte regime="travail" className="flex flex-col gap-5 p-5">
              {textesOffre.map((b) => (
                <Bloc key={b.titre} titre={b.titre} corps={b.corps} />
              ))}
              {!c.offreEncorePubliee && (
                <Precision>Cette offre n’est plus publiée : son détail est repris ici.</Precision>
              )}
            </Carte>
          </section>
        )}

        {/* ⚠ RENDU SEULEMENT S'IL Y A QUELQUE CHOSE. Mesuré : `core.note where
            visible_talent` = 0 sur 45 685. Une carte « rien de partagé » sur
            chaque process de chaque compte serait du vide permanent — et
            l'absence de canal de contact rend la promesse encore plus creuse.
            Le jour où un interlocuteur partage une note, elle apparaît. */}
        {notes.length > 0 && (
          <section aria-labelledby="notes" className="flex flex-col gap-3">
            <h2 id="notes" className="t-h3">
              Ce que Pachamama vous partage
            </h2>
            <Carte regime="travail" className="p-5">
              <FilCommentaires
                commentaires={notes.map(versCommentaire)}
                titreVide="Rien de partagé pour l’instant"
                descriptionVide=""
              />
            </Carte>
          </section>
        )}
      </div>

      {/* ═════════════════════════ la colonne de rappel ══════════════════
          Elle ne contient QUE du rappel et une seule décision, en dernier :
          l'offre, qui suit, ce qui est parti, puis le retrait. */}
      <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
        <Carte regime="travail" className="flex flex-col gap-3.5 p-5">
          <h2 className="t-h3">L’offre</h2>
          <div className="flex flex-wrap gap-2">
            {c.contrat && <TagContrat contrat={c.contrat.toLowerCase()} />}
            {/* `mandat_univers` arrive capitalisé — « Product » — alors que
                `teinteUnivers` parle le code de la base. */}
            {c.univers && <TagUnivers univers={teinteUnivers(c.univers.toLowerCase())} />}
          </div>
          <Divider />
          <GrilleChamps colonnes={2} className="sm:grid-cols-1">
            <Champ libelle="Lieu" valeur={c.localisation} />
            <Champ libelle="Télétravail" valeur={c.remote} />
            <Champ libelle="Rémunération" valeur={c.salaire} />
            <Champ libelle="Déposée le" valeur={dateLongue(c.entreeLe)} />
          </GrilleChamps>
          {c.estAnonyme && (
            <Precision>Entreprise confidentielle tant qu’elle n’accepte pas de se nommer.</Precision>
          )}
          {c.mandatId && c.offreEncorePubliee && (
            <LienInvitation href={`/talent/offres/${c.mandatId}`}>
              Voir l’offre complète
            </LienInvitation>
          )}
        </Carte>

        {/* L'équipe DU MANDAT — les recruteurs — et non l'agent référent du
            candidat : mesuré, le référent est renseigné sur 42,2 % des
            candidatures là où le mandat porte un recruteur sur 89,1 %.
            ⚠ AUCUN BOUTON POUR ÉCRIRE : aucune vue talent ne projette
            d'adresse de collaborateur, et le harnais l'exige. Le wireframe
            posait « Écrire à Inès » ; ce bouton n'aurait mené nulle part. */}
        <CarteEquipe titre="Qui suit cette candidature" equipe={c.equipe} />

        {ficheTransmise && (
          <Carte regime="travail" className="flex flex-col gap-2.5 p-5">
            <h2 className="t-h3">Ce qui a été transmis</h2>
            <p className="t-body text-[var(--encre-600)]">
              {/* Le wireframe datait la version transmise. `presente_le` est
                  NULLE sur les 7 candidatures mesurées : on dit le fait, pas
                  une date qu'on n'a pas. */}
              Votre fiche Pachamama, telle qu’elle était au moment de l’envoi.
            </p>
            <LienInvitation href="/talent/fiche">Voir ma fiche</LienInvitation>
          </Carte>
        )}

        {retraitPossible(c) ? (
          <ActionsRetrait candidatureId={c.id} poste={c.poste} motifs={motifs} />
        ) : null}
      </aside>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   La frise des cinq étapes
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * L'ÉTAT PASSE PAR LA PUCE, JAMAIS PAR LA COULEUR DU TEXTE.
 *
 * Coche noire pour ce qui est franchi, disque violet cerclé pour l'étape
 * courante, tiret gris pour un process arrêté, cercle vide pour la suite. Une
 * hiérarchie portée par la seule couleur du libellé serait invisible en
 * niveaux de gris et illisible pour une partie des daltoniens ; la forme de la
 * puce, elle, se distingue sans couleur.
 *
 * Chaque état porte aussi son mot en `sr-only` : un lecteur d'écran ne voit ni
 * la coche ni le tiret, et « Décision » sans qualificatif ne dirait rien.
 */
function Frise({ marches }: { marches: MarcheFrise[] }) {
  return (
    <ol className="flex flex-col">
      {marches.map((m, i) => (
        <li key={m.libelle} className="flex items-stretch gap-4">
          <div className="flex flex-[0_0_22px] flex-col items-center gap-1.5">
            <Puce marche={m} />
            {/* Le rail s'arrête à l'avant-dernière marche : un trait qui dépasse
                promet une suite qui n'existe pas. */}
            {i < marches.length - 1 && (
              // 80px, et non le minimum syndical : la frise est le contenu
              // PRINCIPAL de la page, face à une colonne de rappel qui empile
              // trois cartes. Serrée, elle occupait un tiers de sa hauteur et
              // laissait un grand vide sous elle. Respirée, les cinq marches
              // tiennent le regard sur toute la colonne.
              <span aria-hidden="true" className="min-h-[80px] w-px flex-1 bg-[var(--encre-100)]" />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1 pb-6">
            {/* `t-titre-hl` et non `t-body-hl` : un cran au-dessus dans
                l'échelle, parce que ces cinq libellés SONT le contenu de la
                carte — à 14px ils se lisaient comme une légende sous le titre.
                À 16px, l'échelle n'a qu'une graisse : la distinction avec les
                marches à venir passe par la couleur, en plus de la puce qui la
                porte déjà. */}
            <span className={cn('t-titre-hl', m.aVenir ? 'text-[var(--encre-400)]' : 'text-black')}>
              {m.libelle}
            </span>
            <span className="sr-only">
              {m.faite
                ? ', franchie'
                : m.courante
                  ? ', étape en cours'
                  : m.arret
                    ? ', le process s’est arrêté ici'
                    : ', à venir'}
            </span>
            {m.sousLigne && (
              <span className="t-body text-[var(--encre-600)]">{m.sousLigne}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Puce({ marche }: { marche: MarcheFrise }) {
  const boite = 'grid size-[22px] flex-[0_0_22px] place-items-center rounded-[var(--r-full)]';
  if (marche.faite) {
    return (
      <span aria-hidden="true" className={cn(boite, 'bg-black text-white')}>
        <Icone nom="icon-check" className="size-3.5" />
      </span>
    );
  }
  if (marche.courante) {
    return (
      <span
        aria-hidden="true"
        className={cn(boite, 'bg-[var(--violet-900)] ring-4 ring-[var(--violet-100)]')}
      >
        <span className="size-[7px] rounded-[var(--r-full)] bg-white" />
      </span>
    );
  }
  if (marche.arret) {
    return (
      <span
        aria-hidden="true"
        className={cn(boite, 'border border-[var(--encre-200)] bg-[var(--fond-inerte)]')}
      >
        <span className="h-px w-[9px] bg-[var(--encre-500)]" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(boite, 'border border-[var(--encre-200)] bg-[var(--fond-page)]')}
    />
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Un bloc de texte long, tel qu'il a été écrit
   ══════════════════════════════════════════════════════════════════════════ */

function Bloc({ titre, corps }: { titre: string; corps: string }) {
  return (
    <div className="flex flex-col gap-2 border-t border-[var(--encre-100)] pt-4">
      <h3 className="t-titre-hl text-black">{titre}</h3>
      <p className="t-body whitespace-pre-line text-[var(--encre-700)]">{corps}</p>
    </div>
  );
}

function versCommentaire(n: NoteTalent): Commentaire {
  return {
    id: n.id,
    auteur: { nom: n.auteur },
    ecritLe: n.ecriteLe ?? new Date().toISOString(),
    corps: n.commentaire,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   L'en-tête, et le 404
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ LE POSTE EN LIGNE D'IMPACT, L'ENTREPRISE EN COMPLÉMENT — l'inverse du
 * réflexe, et c'est délibéré. À ce stade, la personne sait chez qui elle
 * postule ; elle vient vérifier où en est CE poste-là. Sur une entreprise
 * anonyme, le complément dit l'anonymat plutôt que de laisser une ligne vide.
 *
 * La pastille et sa date de mouvement sont à droite, groupées : c'est le même
 * couple, à la même place, que sur la carte de la liste d'où l'on vient. On
 * retrouve ce sur quoi on vient de cliquer.
 */
export function EnteteCandidature({ candidature }: { candidature: CandidatureDetail }) {
  const c = candidature;
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <Titre niveau={1} descriptif={nomEntreprise(c.entreprise)} impact={c.poste} />
      </div>
      <div className="flex shrink-0 flex-col items-start gap-1.5">
        <PastilleEtape etape={c.etape} couleur={c.etapeCouleur} />
        <span className="t-caption text-[var(--encre-600)]">
          {c.retireeLe
            ? `Retirée par vous le ${dateLongue(c.retireeLe)}`
            : c.changeeLe
              ? `${c.estTerminale ? 'Close le' : 'Dernier mouvement le'} ${dateLongue(c.changeeLe)}`
              : c.entreeLe
                ? `Déposée le ${dateLongue(c.entreeLe)}`
                : 'Date inconnue'}
        </span>
      </div>
    </div>
  );
}

/** L'écran vide du 404, réemployé par `not-found.tsx`. */
export function CandidatureIntrouvable() {
  return (
    <EtatVide
      titre="Cette candidature n’est pas dans votre espace"
      description="Soit le lien est ancien, soit cette candidature n’est pas la vôtre."
      illustration={<FormeCourbe />}
      action={
        <Bouton href="/talent/process" apparence="plein">
          Revenir à mon espace
        </Bouton>
      }
    />
  );
}
