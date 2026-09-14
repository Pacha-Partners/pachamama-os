# L'architecture des données pour la Phase 2

> Décidée le 26/08/2026, sur la base du relevé de `MODELE_DONNEES.md`.
> Chaque chiffre cité est mesuré.

## Quatre schémas, une règle chacun

| schéma | contenu | qui écrit | exposé à l'API |
|---|---|---|---|
| `public` | le miroir de Bubble, 107 tables | **la synchro n8n, seule** | oui (héritage) |
| `pivot` | la base talent unifiée, 11 tables | **les connecteurs, seuls** | oui (héritage) |
| `app` | ce que l'application possède | **l'application, seule** | **non** |
| `api` | la surface exposée : **des vues, rien d'autre** | personne | **oui, et c'est le seul qui compte** |

Trois interdits qui découlent de ce tableau :

**Aucune migration applicative ne modifie `public`.** Il est réécrit en continu
par une synchro qui a cassé six fois. On lit ce qu'il contient, on n'y touche
pas.

**Aucune écriture applicative ne va dans `public` ni `pivot`.** Ce que
l'application produit — la localisation d'un mandat, le lien entre une note et
une candidature, un journal d'écriture — vit dans `app`, que la synchro ignore.

**`api` ne contient que des vues**, à colonnes énumérées explicitement, en
`security_invoker`. Une vue sans cette option s'exécute avec les droits de son
propriétaire et contourne la RLS des tables qu'elle lit. Énumérer les colonnes
n'est pas du zèle : c'est ce qui empêche qu'une colonne ajoutée demain dans
`public` se retrouve publiée sans que personne l'ait décidé.

## Pas de clé étrangère de `app` vers `public` — et c'est un choix

Une clé étrangère de `app.mandat_publication` vers `public.mandat` serait le
réflexe correct dans un schéma normal. Ici elle est dangereuse : `public` est
réécrit par la synchro, et `truncate_data_tables()` existe. En `CASCADE`, un
rechargement complet détruirait silencieusement les données saisies par
l'application. En `RESTRICT`, il bloquerait la synchro.

On garde donc la référence comme une colonne texte, **et on rend le risque
visible** : `api.reconciliation_app` liste les lignes de `app` dont la référence
n'existe plus dans `public`. Ce n'est pas la même chose que les 79 liens non
contraints du miroir — ceux-là ne sont contrôlés par rien.

À l'intérieur de `app`, les clés étrangères sont posées normalement.

## Les référentiels que `app` doit absorber

Mesuré sur la base, et c'est le constat le plus utile de ce relevé : **le miroir
stocke des libellés d'affichage comme valeurs.**

`process.etape` porte **14 valeurs distinctes** sur 7 206 candidatures, et ce
sont des chaînes avec emoji :

```
4 302  🙅🏻‍♀️ KO by Pachamama      86  👌 Send-out
1 470  🙅🏻‍♀️ KO by client          48  🎤 Interview 1
  467  🙅🏻‍♀️ KO by candidat        46  🙅🏻‍♀️ KO
  235  🙌 Hired                    45  🎤 Interview 2
  205  ⚡️ Applicant                 9  🎙️ Final interview
  176  📩 To contact                5  🎤 Screen Pachamama
  110  📨 Contacted                 2  Push Candidature
```

Deux problèmes visibles à l'œil nu : `🙅🏻‍♀️ KO` (46 lignes) est un quasi-doublon
des trois KO qualifiés, et `Push Candidature` (2 lignes) n'a pas d'emoji — c'est
un intrus. Et surtout, **un changement de libellé dans Bubble casserait
silencieusement tout filtre applicatif**, puisque le filtre est une comparaison
de chaînes.

`mandat_tag_job.tag_job` porte **16 valeurs**, également des libellés avec
emoji : `🐓 Boîte FR` (152), `🌱 Croissance saine` (83), `🔧 Cas d'usage
concrets` (82)… **L'emoji est donc déjà dans la donnée**, contrairement à ce que
le ticket J1 supposait en cherchant `ref_tag_job.icone_url`.

`app.etape` et `app.tag_job` existent pour **absorber cette fragilité** : elles
associent chaque chaîne du miroir à une valeur interne stable, et un test échoue
si une valeur inconnue apparaît. C'est le seul moyen de ne pas exposer une
comparaison de libellés dans une policy de sécurité.

## Ce que le jalon 1 doit créer

Mesuré : **13 mandats** sont `visibilite='public'` et `statut='En cours'`, dont
**1 est `job_off_market`** — donc **12 publiables**. Et **les 13 sont
`job_anonyme`**, ce qui veut dire que le nom du client ne se projette
aujourd'hui pour aucune offre.

```
app.tag_job              (valeur, libelle, emoji, ordre)          16 lignes à poser
app.mandat_publication   (mandat_id, libelle_public, localisation,
                          departement, publie_le, stack, presentation_equipe)
                                                                  12 lignes à saisir
api.offre_publique       vue : visibilite='public' AND statut='En cours'
                          AND NOT job_off_market, colonnes énumérées,
                          `titre` JAMAIS projeté
api.reconciliation_app   vue de contrôle : références orphelines
```

`app.mandat_publication` porte exactement ce que le miroir n'a pas : `mandat`
n'a **aucune colonne de localisation**, son `titre` porte le nom du client sur
les 13 offres publiques, et `created_at` est une date de synchronisation, pas de
mise en ligne. Douze lignes à remplir une fois.

## Ce que les jalons suivants ajouteront à `app`

Écrit ici pour que la forme soit décidée maintenant, pas construit maintenant.

| jalon | tables `app` | pourquoi |
|---|---|---|
| J2 | `compte` (auth_id, role, entreprise_id, candidat_id, talent_id, actif) et trois fonctions de résolution | `public.user.auth_id` est vide sur 4 596 lignes sur 4 596, et le miroir est réécrit par la synchro : il ne peut pas porter la règle de sécurité |
| J3 | `note_process`, `decision_client`, `etape` | `public.note` n'a pas de `process_id` et il n'existe pas de `process_note` : le report d'une décision client sur une candidature n'a aucune cible |
| J5–J6 | `tache`, `journal_ecriture`, `idempotence` | `public.task` n'a de lien que vers `mandatclose`, un deal clos : une file de travail priorisée n'est pas exprimable |
| J7 | `demande_rgpd`, `alerte` | rien n'existe |

## Ce qui reste à arbitrer, et qui n'est pas technique

**La séniorité.** Le portail entreprise l'affiche sur chaque carte de candidat.
Elle n'existe que dans `pivot.qualification` — donc pour **6 615 talents sur
30 966**, et pour **aucun** talent venu de Jarvi. Soit on l'affiche quand elle
existe et on l'omet sinon, soit on la calcule, soit on retire le champ.

**Les prétentions salariales dans le portail entreprise.** La maquette affiche
« Prétentions : 82 – 88 K » ; le ticket J3 interdit de projeter
`salaire_minimum`, `salaire_souhaite` et `tjm_*`. Contradiction à trancher.

**`pachamama_like`**, un jugement interne, apparaît dans `avisCabinet` de la
maquette. Techniquement il ne doit pas sortir ; commercialement c'est un
engagement pris. À trancher.
