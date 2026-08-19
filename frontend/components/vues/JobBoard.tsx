import Link from 'next/link';
import { CarteOffre } from '@/components/pacha/CarteOffre';
import { EtatVide } from '@/components/pacha/EtatVide';
import { FormeTrait } from '@/components/pacha/Illustration';
import { Titre } from '@/components/pacha/Titre';
import type { Offre } from '@/lib/demo/offres';

/**
 * La liste des offres du Job Board public.
 *
 * Les filtres passent par l'URL et non par un état local, et c'est une décision
 * plutôt qu'une commodité : une recherche filtrée doit pouvoir être partagée par
 * lien et lue par un moteur d'indexation. Un état React aurait rendu ces deux
 * choses impossibles pour la seule vue du produit dont l'indexation est l'objet.
 *
 * D'où le formulaire en méthode GET : le navigateur écrit lui-même les
 * paramètres, sans une ligne de JavaScript. Le filtrage reste donc fonctionnel
 * même sans exécution de script.
 */
export function JobBoard({
  offres,
  total,
  filtres,
  univers,
  localisations,
}: {
  offres: Offre[];
  total: number;
  filtres: { univers?: string; contrat?: string; lieu?: string; q?: string };
  univers: { cle: string; libelle: string }[];
  localisations: string[];
}) {
  const filtre = Boolean(filtres.univers || filtres.contrat || filtres.lieu || filtres.q);

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10 md:px-8">
      <div className="relative">
        <FormeTrait
          aria-hidden="true"
          className="pointer-events-none absolute -top-4 right-0 hidden h-12 w-24 text-[var(--violet-300)] md:block"
        />
        <Titre niveau={1} descriptif="Les postes que nous" impact="ouvrons en ce moment" />
        <p className="t-body mt-4 max-w-[58ch] text-[var(--encre-600)]">
          Nous recrutons sur trois univers — Product, Tech et Sales — en CDI comme en
          freelance. Certaines offres sont sous anonymat&nbsp;: le client ne souhaite pas
          être nommé publiquement, et nous respectons cet engagement.
        </p>
      </div>

      {/* ------------------------------------------------------------ filtres */}
      <form
        method="get"
        aria-labelledby="titre-filtres"
        className="mt-8 rounded-[var(--r-md)] border-2 border-black bg-white p-4 shadow-[var(--ombre-2)]"
      >
        <h2 id="titre-filtres" className="t-caption-hl mb-3 text-[var(--encre-600)]">
          Affiner la recherche
        </h2>
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-end">
          <ChampFiltre libelle="Métier" id="q">
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={filtres.q ?? ''}
              placeholder="Designer, Backend, Sales…"
              className="h-[var(--h-champ)] w-full rounded-[var(--r-md)] border border-black bg-white px-2 text-black placeholder:text-[var(--encre-400)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            />
          </ChampFiltre>

          <ChampFiltre libelle="Univers" id="univers">
            <Select id="univers" name="univers" valeur={filtres.univers}>
              {univers.map((u) => (
                <option key={u.cle} value={u.cle}>
                  {u.libelle}
                </option>
              ))}
            </Select>
          </ChampFiltre>

          <ChampFiltre libelle="Contrat" id="contrat">
            <Select id="contrat" name="contrat" valeur={filtres.contrat}>
              <option value="cdi">CDI</option>
              <option value="freelance">Freelance</option>
            </Select>
          </ChampFiltre>

          <ChampFiltre libelle="Lieu" id="lieu">
            <Select id="lieu" name="lieu" valeur={filtres.lieu}>
              {localisations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </ChampFiltre>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="t-body-hl h-[var(--h-champ)] rounded-[var(--r-sm)] border-2 border-black bg-black px-4 text-white shadow-[var(--ombre-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              Filtrer
            </button>
            {filtre && (
              <Link href="/offres" className="t-caption-hl underline">
                Tout voir
              </Link>
            )}
          </div>
        </div>
      </form>

      {/* ------------------------------------------------------------ résultats */}
      <p aria-live="polite" className="t-caption mt-6 text-[var(--encre-600)]">
        {offres.length === total ? (
          <>
            <strong className="t-caption-bold">{total}</strong> offres ouvertes.
          </>
        ) : (
          <>
            <strong className="t-caption-bold">{offres.length}</strong> offre
            {offres.length > 1 ? 's' : ''} sur {total} correspond
            {offres.length > 1 ? 'ent' : ''} à votre recherche.
          </>
        )}
      </p>

      {offres.length === 0 ? (
        <div className="mt-8">
          <EtatVide
            titre="Aucune offre ne correspond"
            description="Élargissez un critère : nos mandats changent chaque semaine, et certains ne sont pas publiés."
            action={
              <Link
                href="/offres"
                className="t-body-hl inline-block rounded-[var(--r-sm)] border-2 border-black px-4 py-2"
              >
                Réinitialiser les filtres
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {offres.map((o) => (
            <li key={o.id} className="flex">
              <CarteOffre
                poste={o.poste}
                client={o.client}
                contrat={o.contrat}
                salaire={o.salaire}
                localisation={o.localisation}
                modeDeTravail={o.modeDeTravail}
                motsCles={o.motsCles}
                exclusivite={o.exclusivite}
                href={`/offres/${o.id}`}
                action={{ libelle: 'Voir l’offre' }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChampFiltre({
  libelle,
  id,
  children,
}: {
  libelle: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="t-caption-hl text-black">
        {libelle}
      </label>
      {children}
    </div>
  );
}

/** Une option vide en tête vaut « tous » : elle rend le filtre effaçable. */
function Select({
  id,
  name,
  valeur,
  children,
}: {
  id: string;
  name: string;
  valeur?: string;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={valeur ?? ''}
      className="h-[var(--h-champ)] w-full rounded-[var(--r-md)] border border-black bg-white px-2 text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
    >
      <option value="">Tous</option>
      {children}
    </select>
  );
}
