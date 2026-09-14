import { Icone } from '@/components/pacha/Icone';
import { CarteLien, PastilleEtape, Precision } from '@/components/vues/talent/atomes';
import { dateLongue, nomEntreprise, type CandidatureTalent } from '@/lib/domaine/talent';

/**
 * LES CANDIDATURES, EN CARTES.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEUX COLONNES DÈS QU'IL Y A LA PLACE, ET C'EST MESURÉ
 * ─────────────────────────────────────────────────────────────────────────
 * La liste était une colonne unique. Deux défauts, aux deux extrémités de la
 * plage : dans la colonne large de « Mon espace », à 760px, elle laissait un
 * tiers d'écran vide à droite ; sur « Mes process », à 1 128px, la pastille
 * d'étape se retrouvait à un demi-écran de l'intitulé qu'elle qualifie — et
 * c'est précisément le couple que l'œil vient chercher.
 *
 * Un gabarit de 420px minimum règle les deux : une colonne sous 860px environ,
 * deux au-delà. Le `min(100%, …)` évite le débordement sous 420px, où aucune
 * colonne entière ne tient.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ UNE CANDIDATURE CLOSE N'INVITE PLUS, MAIS S'OUVRE ENCORE
 * ─────────────────────────────────────────────────────────────────────────
 * Ni chevron ni ombre au survol : il n'y a plus rien à y faire. Le lien, lui,
 * reste — on consulte encore ses dates, l'offre et ce que le cabinet a partagé.
 * Le wireframe les rendait inertes ; ç'aurait échoué la seule page qui les
 * affiche, et le harnais vérifie qu'elle répond.
 *
 * Et elle ne dit JAMAIS qui a fermé (D-02) : les trois issues KO rendent toutes
 * « Candidature close », précisément pour ne pas le dire. Cet écran n'ajoute
 * rien de sa part — il montre l'étape telle que la vue la rend.
 *
 * `PastilleEtape` reçoit le libellé TEL QUEL, emoji compris, et la couleur de
 * `ref.etape_process` — jamais une couleur choisie ici. Sur les candidatures du
 * compte de test, ces couleurs sont #8657FF, #FFEA4D et #F4728A, toutes
 * claires : le texte noir de la pastille y passe AA.
 */
export function ListeCandidatures({
  titre,
  candidatures,
  note,
}: {
  /** Absent sur « Mes process » : l'onglet nomme déjà l'ensemble. */
  titre?: string;
  candidatures: CandidatureTalent[];
  note?: string;
}) {
  const id = `candidatures-${(titre ?? 'toutes').toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <section
      aria-labelledby={titre ? id : undefined}
      aria-label={titre ? undefined : 'Vos process'}
      className="flex flex-col gap-3"
    >
      {titre && (
        <h3 id={id} className="t-titre-hl text-[var(--encre-600)]">
          {titre}
        </h3>
      )}
      <ul className="grid items-start gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
        {candidatures.map((c) => (
          <LigneCandidature key={c.id} candidature={c} />
        ))}
      </ul>
      {note && <Precision>{note}</Precision>}
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Une candidature
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * L'ORDRE DE LECTURE : le poste, l'entreprise, l'étape — puis la date.
 *
 * D'abord ce dont il s'agit et où j'en suis, sur la même ligne ; ensuite depuis
 * quand, en dessous. La date est TOUJOURS qualifiée — « Déposée le », « Dernier
 * mouvement le », « Retirée par vous le » — jamais nue : sur un suivi, une date
 * sans verbe ne dit pas si elle est un début, un mouvement ou une fin.
 *
 * L'intitulé se tronque au lieu de passer à la ligne : sinon la carte grandit à
 * chaque poste au nom long, et la grille se désaligne sur deux colonnes.
 */
function LigneCandidature({ candidature: c }: { candidature: CandidatureTalent }) {
  // Une candidature retirée par la personne n'est pas forcément marquée
  // terminale en base — `retraitPossible` teste bien les deux. Elle est close
  // pour l'écran dans les deux cas.
  const close = c.estTerminale || Boolean(c.retireeLe);

  const date = c.retireeLe
    ? `Retirée par vous le ${dateLongue(c.retireeLe)}`
    : c.changeeLe
      ? `Dernier mouvement le ${dateLongue(c.changeeLe)}`
      : c.entreeLe
        ? `Déposée le ${dateLongue(c.entreeLe)}`
        : 'Date inconnue';

  return (
    <li>
      <CarteLien
        href={`/talent/candidatures/${c.id}`}
        libelle={`${c.poste} chez ${nomEntreprise(c.entreprise)}, voir le détail`}
        discret={close}
        className="gap-2.5 px-5 py-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2.5">
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
            <p className="t-h3 truncate">{c.poste}</p>
            <p className="t-body text-[var(--encre-600)]">{nomEntreprise(c.entreprise)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <PastilleEtape etape={c.etape} couleur={c.etapeCouleur ?? null} />
            {!close && (
              <Icone
                nom="icon-chevron-right"
                className="size-5 shrink-0 text-[var(--encre-500)]"
              />
            )}
          </div>
        </div>
        <p className="t-caption text-[var(--encre-600)]">{date}</p>
      </CarteLien>
    </li>
  );
}
