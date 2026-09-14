'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Avatar } from '@/components/pacha/Avatar';
import { EtatVide } from '@/components/pacha/EtatVide';
import { FormeEtincelles } from '@/components/pacha/Illustration';
import { Bouton } from '@/components/pacha/Bouton';
import { Tableau, type ColonneTableau } from '@/components/pacha/Tableau';
import { TagAction, TagContrat, TagInfo, TagUnivers } from '@/components/pacha/Tag';
import {
  dateCourte,
  estClos,
  fourchette,
  instantDe,
  libelleStatut,
  teinteDepuisLibelle,
  type MandatClient,
} from '@/lib/domaine/entreprise';
import { cn } from '@/lib/utils';

/**
 * LA TEINTE DE CHAQUE STATUT DE MANDAT.
 *
 * Six statuts, quatre teintes : « En cours » et « Reprise » partagent le violet
 * parce que ce sont deux formes du même fait — le poste est en recherche. Les
 * deux fins, en revanche, sont séparées : le vert dit qu'on a recruté, le gris
 * qu'on a arrêté. C'est la distinction que le client vient chercher dans un
 * tableau de postes clos.
 *
 * Toutes ces teintes sont claires par construction : le texte de l'étiquette
 * reste noir, ce qui est la règle dure du système.
 */
const TEINTES_STATUT: Record<string, string> = {
  nouveau: 'bg-[var(--statut-attente)]',
  en_cours: 'bg-[var(--violet-100)]',
  reprise: 'bg-[var(--violet-100)]',
  en_pause: 'bg-[var(--fond-decor)]',
  termine: 'bg-[var(--statut-positif)]',
  close_pachamama: 'bg-[var(--fond-inerte)]',
};

/**
 * LE TABLEAU DE BORD — la liste des postes confiés au cabinet.
 *
 * DEUX ONGLETS, PAS DEUX PAGES. Un client revient sur ses postes clos pour
 * retrouver une référence de candidat ou une facture ; les séparer en deux
 * adresses obligerait à savoir, avant de chercher, si le poste est clos. Les
 * onglets de Base UI n'activent pas au focus (`activateOnFocus={false}`) : la
 * flèche traverse sans déclencher le rendu de l'autre tableau.
 *
 * LES DEUX PANNEAUX RESTENT MONTÉS (`garderMonte`) : le tri qu'on a posé sur
 * les postes ouverts survit à un aller-retour vers les clos. Le coût est réel
 * — deux tableaux dans le DOM — mais la donnée est déjà là, en props, et le
 * plus gros compte du dev n'a que neuf mandats.
 *
 * LA LIGNE EST ACTIVABLE, et le titre est AUSSI un lien. C'est volontairement
 * redondant : `onLigneActivee` donne le confort du clic n'importe où sur la
 * ligne, le lien donne le clic du milieu, le survol qui montre la cible et le
 * « ouvrir dans un nouvel onglet ». Un tableau où seule la ligne réagit prive
 * de tout cela sans le dire.
 */
export function TableauDeBord({ mandats }: { mandats: MandatClient[] }) {
  const router = useRouter();
  const [onglet, setOnglet] = useState('ouverts');

  const { ouverts, clos } = useMemo(() => {
    const ouverts: MandatClient[] = [];
    const clos: MandatClient[] = [];
    for (const m of mandats) (estClos(m.statut) ? clos : ouverts).push(m);
    return { ouverts, clos };
  }, [mandats]);

  const colonnes = useMemo<ColonneTableau<MandatClient>[]>(
    () => [
      {
        cle: 'poste',
        entete: 'Poste',
        triSur: (m) => m.intitule,
        cellule: (m) => (
          <div className="flex min-w-0 flex-col py-1">
            <Link
              href={`/entreprise/mandats/${m.id}`}
              className={cn(
                't-body-bold truncate text-black underline-offset-2 hover:underline',
                'rounded-[var(--r-xs)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black',
              )}
              // La ligne entière est déjà activable : ce lien n'a pas à être
              // annoncé une seconde fois comme cible de tabulation.
              tabIndex={-1}
            >
              {m.intitule}
            </Link>
            {m.metier && (
              <span className="t-caption truncate text-[var(--encre-500)]">{m.metier}</span>
            )}
          </div>
        ),
        largeur: 280,
      },
      {
        cle: 'statut',
        entete: 'Statut',
        triSur: (m) => libelleStatut(m.statut),
        // ⚠ LA TEINTE PORTE L'ISSUE, ET C'EST CE QUI MANQUAIT.
        // « Terminé » et « Clos par Pachamama » sont deux fins très
        // différentes — l'une est un poste pourvu, l'autre un poste abandonné —
        // et elles s'affichaient dans la même étiquette blanche. Le vert et le
        // gris les séparent d'un coup d'œil, sur un tableau qu'on balaie.
        // Toutes ces teintes sont claires : le texte reste noir, règle dure.
        cellule: (m) => (
          <TagInfo className={cn('border-black', (m.statut ? TEINTES_STATUT[m.statut] : undefined) ?? 'bg-white')}>
            {libelleStatut(m.statut)}
          </TagInfo>
        ),
        largeur: 150,
      },
      {
        cle: 'univers',
        entete: 'Univers',
        triSur: (m) => m.univers,
        cellule: (m) =>
          m.univers ? (
            <TagUnivers univers={teinteDepuisLibelle(m.univers)}>{m.univers}</TagUnivers>
          ) : null,
        largeur: 130,
        masquerEnMobile: true,
      },
      {
        cle: 'contrat',
        entete: 'Contrat',
        triSur: (m) => m.contrat,
        cellule: (m) => (m.contrat ? <TagContrat contrat={m.contrat} /> : null),
        largeur: 120,
        masquerEnMobile: true,
      },
      {
        cle: 'fourchette',
        entete: 'Fourchette',
        // On trie sur le PLANCHER numérique, pas sur le texte affiché :
        // « 100 K » se rangerait avant « 60 K » dans un tri alphabétique.
        triSur: (m) => m.salaireMinKe ?? m.tjmMinEur,
        // Une cellule vide reste VIDE. Le tiret cadratin se lisait comme une
        // valeur, et « Non communiqué » aurait laissé croire à un choix : aucun
        // mandat du compte de test ne porte de TJM, c'est simplement absent.
        cellule: (m) => <span className="t-body text-black">{fourchette(m) ?? ''}</span>,
        largeur: 130,
        masquerEnMobile: true,
      },
      {
        cle: 'localisation',
        entete: 'Lieu',
        triSur: (m) => m.localisation,
        cellule: (m) => (
          <span className="t-body text-[var(--encre-600)]">{m.localisation ?? ''}</span>
        ),
        largeur: 150,
        masquerEnMobile: true,
      },
      {
        cle: 'presentes',
        entete: 'Présentés',
        enteteAccessible: 'Profils présentés',
        triSur: (m) => m.presentes,
        // « Aucun » plutôt qu'un « 0 » : sur une colonne de chiffres, le zéro se
        // confond avec les autres valeurs alors qu'il dit tout autre chose —
        // le poste n'a pas encore commencé. Et la ligne « dont N en cours »
        // disparaît avec lui : il n'y a rien dont quoi que ce soit soit en cours.
        cellule: (m) => (
          <span className="flex flex-col">
            <span className="t-body-bold text-black">
              {m.presentes === 0 ? 'Aucun' : m.presentes}
            </span>
            {m.presentes > 0 && (
              <span className="t-caption text-[var(--encre-500)]">dont {m.enCours} en cours</span>
            )}
          </span>
        ),
        alignement: 'droite',
        largeur: 160,
      },
      {
        // LE RECRUTEUR PASSE DEVANT L'ACCOUNT MANAGER dans cette colonne.
        // Mesuré sur les 533 mandats : le recruteur est renseigné sur 89 %
        // d'entre eux, l'AM sur 75 % seulement. Sur une liste de postes, la
        // question est « qui cherche pour celui-là ? » — l'AM, lui, est le même
        // pour toute l'entreprise et figure déjà dans le bandeau au-dessus.
        // Le repli sur l'AM évite une colonne vide là où quelqu'un est affecté.
        cle: 'equipe',
        entete: 'Qui cherche',
        triSur: (m) => m.recruteurNom ?? m.agentNom,
        cellule: (m) => {
          const nom = m.recruteurNom ?? m.agentNom;
          const photo = m.recruteurNom ? m.recruteurPhoto : m.agentPhoto;
          const second = m.recruteurNom ? m.recruteur2Nom : null;
          if (!nom) {
            // « à affecter » et non une cellule vide : une case vide se lit
            // comme une donnée manquante, alors que c'est une information — le
            // cabinet n'a pas encore nommé de recruteur sur ce poste.
            return <span className="t-body text-[var(--encre-400)]">à affecter</span>;
          }
          return (
            <span className="flex items-center gap-2">
              <Avatar nom={nom} src={photo} taille={30} forme="rond" />
              <span className="min-w-0">
                <span className="t-caption block truncate text-black">{nom}</span>
                {second && (
                  <span className="t-micro block truncate text-[var(--encre-500)]">
                    et {second}
                  </span>
                )}
              </span>
            </span>
          );
        },
        largeur: 190,
        masquerEnMobile: true,
      },
      {
        cle: 'ouvert',
        entete: 'Ouvert le',
        triSur: (m) => instantDe(m.kickoffLe ?? m.creeLe),
        cellule: (m) => (
          <span className="t-caption text-[var(--encre-500)]">
            {dateCourte(m.kickoffLe ?? m.creeLe) ?? ''}
          </span>
        ),
        largeur: 110,
        masquerEnMobile: true,
      },
    ],
    [],
  );

  /**
   * LA LIGNE PLIÉE, EN ÉCRAN ÉTROIT.
   *
   * Neuf colonnes réduites à trois donneraient quatre-vingt-dix pixels à
   * l'intitulé — précisément ce qu'on vient lire. La ligne se plie donc sur
   * deux niveaux au lieu de rétrécir : le poste et son métier en haut, le
   * statut et le compte en bas. Le compte repasse en phrase, parce qu'il n'y a
   * plus d'en-tête de colonne pour porter le mot « présentés ».
   */
  const carteMobile = (m: MandatClient) => (
    <Link
      href={`/entreprise/mandats/${m.id}`}
      className={cn(
        'flex flex-col gap-2.5 px-4 py-3.5',
        'hover:bg-[var(--violet-050)]',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black',
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="t-body-hl truncate text-black">{m.intitule}</span>
        {m.metier && <span className="t-caption truncate text-[var(--encre-500)]">{m.metier}</span>}
      </span>
      <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <TagInfo className={cn('border-black', (m.statut ? TEINTES_STATUT[m.statut] : undefined) ?? 'bg-white')}>
          {libelleStatut(m.statut)}
        </TagInfo>
        <span className="t-caption text-[var(--encre-600)]">
          {m.presentes === 0
            ? 'Aucun profil présenté'
            : `${m.presentes} présentés, dont ${m.enCours} en cours`}
        </span>
      </span>
    </Link>
  );

  const surOuverts = onglet === 'ouverts';
  const liste = surOuverts ? ouverts : clos;

  return (
    <div className="flex flex-col gap-5">
      {/* ⚠ DES PASTILLES `TagAction`, ET NON LE COMPOSANT `Onglets`.
          Même arbitrage que sur « Mes process » du portail talent : il n'y a
          QU'UN tableau, et deux façons de le filtrer. `Onglets` sert des
          panneaux de contenus différents ; deux filtres exclusifs sur un même
          ensemble sont un sélecteur segmenté, et le système en a l'atome.

          Le compte va dans le libellé plutôt que dans une pastille accolée : sur
          deux entrées, la pastille ajoutait une troisième forme à lire.

          `role="group"` et non `tablist` : un `tablist` exige des enfants
          `role="tab"` liés à des panneaux, or `TagAction` rend un `<button
          aria-pressed>`. */}
      <div role="group" aria-label="Filtrer vos postes" className="flex flex-wrap gap-2">
        <TagAction actif={surOuverts} onClick={() => setOnglet('ouverts')}>
          Postes ouverts · {ouverts.length}
        </TagAction>
        <TagAction actif={!surOuverts} onClick={() => setOnglet('clos')}>
          Postes clos · {clos.length}
        </TagAction>
      </div>

      <Tableau
        colonnes={colonnes}
        lignes={liste}
        cleDeLigne={(m) => m.id}
        legende={
          surOuverts
            ? 'Vos postes ouverts, avec leur statut, leur fourchette et le nombre de profils présentés.'
            : 'Vos postes clos, avec leur issue et le nombre de profils présentés.'
        }
        triInitial={{ cle: 'ouvert', sens: 'desc' }}
        onLigneActivee={(m) => router.push(`/entreprise/mandats/${m.id}`)}
        libelleLigne={(m) => `Ouvrir le poste ${m.intitule}`}
        carteMobile={carteMobile}
        etatVide={
          surOuverts ? (
            /* ⚠ LE SEUL ÉTAT VIDE DE CET ÉCRAN QUI DONNE UNE SUITE, donc le seul
               qui porte un bouton. La description disait « Aucun poste ouvert
               pour l'instant » sous un titre qui disait déjà « Aucun poste
               ouvert » : une tautologie à la place d'une information. */
            <EtatVide
              titre="Aucun poste ouvert"
              description="Vos postes clos restent consultables dans l’autre onglet."
              illustration={<FormeEtincelles />}
              action={
                <Bouton href="/entreprise/mandats/nouveau" apparence="plein">
                  Ouvrir un poste
                </Bouton>
              }
            />
          ) : (
            /* Ni illustration ni bouton : n'avoir jamais clos un poste n'est pas
               un manque, et il n'y a rien à faire pour y remédier. */
            <div className="flex min-h-[120px] items-center px-5">
              <p className="t-body text-[var(--encre-600)]">Aucun poste clos.</p>
            </div>
          )
        }
      />
    </div>
  );
}
