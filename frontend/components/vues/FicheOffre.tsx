import Link from 'next/link';
import { Carte, Encart, InfoLigne } from '@/components/pacha/Carte';
import { Monogramme } from '@/components/pacha/Logo';
import { TagContrat, TagInfo, TagUnivers } from '@/components/pacha/Tag';
import { Titre } from '@/components/pacha/Titre';
import type { Offre } from '@/lib/demo/offres';

/**
 * La fiche d'une offre.
 *
 * Sur une offre sous anonymat, l'absence du nom du client n'est pas traitée
 * comme un champ vide mais comme une information à part entière : le monogramme
 * du cabinet remplace le logo, et une phrase dit pourquoi. Masquer sans
 * expliquer donnerait l'impression d'une fiche incomplète, alors que c'est un
 * engagement tenu.
 *
 * L'appel à l'action est honnête : la candidature n'est pas branchée, donc il
 * mène à la connexion plutôt que de simuler un envoi. Un faux succès est pire
 * qu'un bouton qui annonce ce qu'il fait.
 */
export function FicheOffre({ offre }: { offre: Offre }) {
  return (
    <div className="mx-auto max-w-[860px] px-6 py-10 md:px-8">
      <Link href="/offres" className="t-caption-hl underline">
        ← Toutes les offres
      </Link>

      <div className="mt-6 flex items-start gap-4">
        {offre.client ? (
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center rounded-[var(--r-md)] border-2 border-black bg-[var(--violet-100)] t-h3"
          >
            {offre.client.nom.slice(0, 1)}
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center rounded-full bg-[var(--violet-200)] text-black"
          >
            <Monogramme taille="petit" />
          </span>
        )}
        <div className="min-w-0">
          <p className="t-caption uppercase tracking-wide text-[var(--encre-500)]">
            {offre.client ? offre.client.nom : 'Entreprise anonyme'}
          </p>
          <Titre niveau={1} descriptif="Nous recrutons" impact={offre.poste} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <TagUnivers univers={offre.univers} />
        <TagContrat contrat={offre.contrat} />
        {offre.exclusivite && <TagInfo emoji="✨">Exclusivité Pachamama</TagInfo>}
      </div>

      {!offre.client && (
        <p className="t-caption mt-5 rounded-[var(--r-md)] border border-[var(--encre-200)] bg-[var(--violet-050)] px-4 py-3 text-black">
          Ce client a demandé à ne pas être nommé publiquement. Nous respectons cet
          engagement&nbsp;: son identité vous est communiquée dès le premier échange.
        </p>
      )}

      <Carte regime="accroche" className="mt-8 flex flex-col gap-1.5 p-5">
        <InfoLigne emoji="💸" libelle="Rémunération" valeur={offre.salaire} />
        <InfoLigne emoji="📍" libelle="Localisation" valeur={offre.localisation} />
        <InfoLigne emoji="💻" libelle="Mode de travail" valeur={offre.modeDeTravail} />
      </Carte>

      <section aria-labelledby="le-poste" className="mt-10">
        <h2 id="le-poste" className="t-h2">
          Le poste
        </h2>
        <p className="t-body mt-3 text-black">{offre.description}</p>
      </section>

      {offre.motsCles.length > 0 && (
        <section aria-labelledby="ce-qui-compte" className="mt-8">
          <h2 id="ce-qui-compte" className="t-h2">
            Ce qui caractérise ce poste
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {offre.motsCles.map((m) => (
              <li key={m.libelle}>
                <TagInfo emoji={m.emoji}>{m.libelle}</TagInfo>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="le-contexte" className="mt-8">
        <h2 id="le-contexte" className="t-h2">
          Le contexte
        </h2>
        <div className="mt-3">
          <Encart
            entrees={[
              { libelle: 'Équipe', valeur: offre.equipe },
              { libelle: 'Process de recrutement', valeur: offre.process },
              { libelle: 'Environnement technique', valeur: offre.stack },
            ]}
          />
        </div>
      </section>

      <section aria-labelledby="candidater" className="mt-10">
        <Carte regime="accroche" className="flex flex-col gap-3 p-5">
          <h2 id="candidater" className="t-h3">
            Ce poste vous parle&nbsp;?
          </h2>
          <p className="t-caption text-[var(--encre-600)]">
            La candidature passe par votre espace talent&nbsp;: c’est lui qui porte votre
            CV, vos attentes et le suivi de vos process. Créer un compte prend une minute,
            et vous gardez la main sur vos données.
          </p>
          <Link
            href="/"
            className="t-body-hl inline-flex w-fit items-center gap-2 rounded-[var(--r-sm)] border-2 border-black bg-black px-4 py-2.5 text-white shadow-[var(--ombre-3)] transition-shadow hover:shadow-[var(--ombre-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            <span aria-hidden="true">👋</span> Je suis intéressé·e
          </Link>
        </Carte>
      </section>
    </div>
  );
}
