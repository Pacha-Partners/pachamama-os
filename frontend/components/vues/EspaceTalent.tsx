import { Carte, Encart, InfoLigne } from '@/components/pacha/Carte';
import { Avatar } from '@/components/pacha/Avatar';
import { StatutProcess } from '@/components/pacha/StatutProcess';
import { TagContrat, TagInfo } from '@/components/pacha/Tag';
import { Titre } from '@/components/pacha/Titre';
import type { DonneesTalent } from '@/lib/demo/talent';

/**
 * L'espace du candidat.
 *
 * L'ordre de lecture est délibéré : la complétude de la qualification vient
 * AVANT le reste, parce que c'est la seule information qui empêche le cabinet de
 * présenter le talent à un client. La lui cacher en bas de page serait lui
 * cacher pourquoi rien n'avance.
 *
 * Elle est rendue en texte, et énumère ce qui manque : un pourcentage ou une
 * barre de progression indiquerait qu'il y a un problème sans dire lequel.
 */
export function EspaceTalent({ identite, qualification, attentes, candidatures, suggestions }: DonneesTalent) {
  const nomComplet = `${identite.prenom} ${identite.nom}`;
  return (
    <div className="mx-auto max-w-[1000px] px-6 py-10 md:px-8">
      <div className="flex items-start gap-4">
        <Avatar nom={nomComplet} taille={56} bordure />
        <div>
          <Titre niveau={1} descriptif="Bonjour" impact={identite.prenom} />
          <p className="t-body mt-2 text-[var(--encre-600)]">
            {identite.poste} · {identite.ville}
          </p>
        </div>
      </div>

      {/* ---------------------------------------------- la qualification d'abord */}
      {!qualification.complete && (
        <Carte
          regime="accroche"
          className="mt-8 border-2 bg-[var(--people-100)] p-5"
          role="region"
          aria-labelledby="qualif"
        >
          <h2 id="qualif" className="t-h3">
            <span aria-hidden="true">⚠️ </span>Votre qualification est incomplète
          </h2>
          <p className="t-caption mt-2 text-black">
            Tant qu’il manque ces éléments, nous ne pouvons pas vous présenter à un
            client&nbsp;: ce sont les informations qu’il demande en premier.
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {qualification.manquant.map((m) => (
              <li key={m} className="t-caption-hl flex items-start gap-2 text-black">
                <span aria-hidden="true">•</span> {m}
              </li>
            ))}
          </ul>
        </Carte>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="profil">
          <h2 id="profil" className="t-h2 mb-3">Mon profil</h2>
          <Encart
            entrees={[
              { libelle: 'Séniorité', valeur: identite.seniorite },
              { libelle: 'Univers', valeur: identite.univers },
              { libelle: 'Ville', valeur: identite.ville },
              { libelle: 'Anglais', valeur: identite.anglais },
            ]}
          />
        </section>

        <section aria-labelledby="attentes">
          <h2 id="attentes" className="t-h2 mb-3">Mes attentes</h2>
          <Carte regime="travail" className="flex flex-col gap-1.5 p-5">
            <InfoLigne emoji="💸" libelle="Rémunération" valeur={attentes.remuneration} />
            <InfoLigne emoji="📄" libelle="Contrats visés" valeur={attentes.contrats.join(' · ')} />
            <InfoLigne emoji="📍" libelle="Mobilité" valeur={attentes.mobilite} />
            <InfoLigne emoji="🗓" libelle="Disponibilité" valeur={attentes.disponibilite} />
            <InfoLigne emoji="💻" libelle="Mode de travail" valeur={attentes.modeDeTravail} />
          </Carte>
          <p className="t-caption mt-2 text-[var(--encre-500)]">
            La modification des attentes n’est pas encore branchée sur l’API&nbsp;: rien
            n’est enregistré depuis cet écran.
          </p>
        </section>
      </div>

      {/* ------------------------------------------------------- candidatures */}
      <section aria-labelledby="candidatures" className="mt-10">
        <h2 id="candidatures" className="t-h2">Mes candidatures</h2>
        <p className="t-caption mt-1 mb-4 text-[var(--encre-600)]">
          Où vous en êtes, process par process. L’étape affichée est celle que le
          recruteur a validée.
        </p>
        <ul className="flex flex-col gap-3">
          {candidatures.map((c) => (
            <li key={c.id}>
              <Carte regime="travail" className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="t-body-bold text-black">{c.poste}</p>
                  <p className="t-caption text-[var(--encre-500)]">
                    {c.entreprise ?? 'Entreprise anonyme'}
                  </p>
                </div>
                <StatutProcess etape={c.etape} />
                {c.prochaine && (
                  <p className="t-caption whitespace-nowrap text-[var(--encre-600)]">
                    <span aria-hidden="true">🗓 </span>
                    <span className="sr-only">Prochaine échéance : </span>
                    {c.prochaine}
                  </p>
                )}
              </Carte>
            </li>
          ))}
        </ul>
      </section>

      {/* -------------------------------------------------------- suggestions */}
      <section aria-labelledby="suggestions" className="mt-10">
        <h2 id="suggestions" className="t-h2">Des postes qui pourraient vous convenir</h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {suggestions.map((s) => (
            <li key={s.id}>
              <Carte regime="accroche" className="flex h-full flex-col gap-2 p-5">
                <p className="t-caption uppercase tracking-wide text-[var(--encre-500)]">
                  {s.entreprise ?? 'Entreprise anonyme'}
                </p>
                <h3 className="t-h3">{s.poste}</h3>
                <div className="flex flex-col gap-1">
                  <InfoLigne emoji="💸" libelle="Rémunération" valeur={s.salaire} />
                  <InfoLigne emoji="📍" libelle="Localisation" valeur={s.lieu} />
                </div>
                <div className="mt-auto pt-2">
                  {s.dejaCandidate ? (
                    <TagInfo emoji="✅">Vous avez déjà candidaté</TagInfo>
                  ) : (
                    <TagContrat contrat="cdi" />
                  )}
                </div>
              </Carte>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
