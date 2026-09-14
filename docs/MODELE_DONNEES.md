# Le modèle de données, avant le jalon 1

> Relevé du 26/08/2026, mesuré sur la production et le dump du schéma.
> Écrit pour décider, pas pour documenter l'existant.

## Trois faits qui décident

### 1. `public` n'est pas un modèle, c'est un décalque de Bubble

107 tables et 688 colonnes pour **dix entités métier**. Le talent en occupe 23
tables et 56 % du volume ; la note 6 tables et 29 % ; les référentiels 48 tables
pour 0,6 % des lignes.

Et surtout : sur les **113 liens entité→entité** que porte le schéma, **34 sont
tenus par une clé étrangère**, soit 30 %. Sur les ~96 colonnes portant une
valeur de référentiel, **13 sont contraintes**, soit 14 %. Ce n'est pas un modèle
relationnel troué : c'est un modèle documentaire avec 65 contraintes
résiduelles.

Quatre tables sont strictement 1 pour 1 avec `candidat` — `candidat_expanded`,
`job_actuel`, `job_reve`, `experience`, toutes à ~7 024 lignes pour 7 023
candidats distincts. Une entité découpée en cinq, donc **cinq jointures pour
afficher un candidat**, sur des liens qu'aucune contrainte ne garantit. Même
chose pour `task_notif` (1 pour 1 avec `task`) et `entreprise_remote` (1 pour 1
avec `entreprise`).

Et **102 des 107 clés primaires sont du texte sans valeur par défaut** : des
identifiants Bubble. Tant que l'application lit, c'est sans effet. Dès qu'elle
écrit, elle doit fabriquer l'identifiant elle-même.

### 2. `pivot` est un magasin de personnes, pas un modèle de recrutement

Sur ses 11 tables, 9 sont clefées sur `talent_id` et 2 pilotent l'alimentation.
Ses **8 clés étrangères pointent toutes vers `pivot.talent`**. Il n'existe, dans
tout le schéma pivot et ses vues, **aucune colonne `mandat_id`, `process_id`,
`entreprise_id` ni `equipe_id`**.

Conséquence directe : une application qui ne lirait que le pivot **ne peut pas
afficher un job board, une fiche d'offre, ni le suivi d'une candidature**. Le
pivot répond à la Phase 1 — unifier les personnes. La Phase 2 a besoin des
offres et des candidatures, qui n'y sont pas.

### 3. La surface que les jalons supposent n'existe pas

Les sept tickets s'appuient tous sur un schéma **`api`** — onze objets nommés
(`compte`, trois fonctions de résolution, `offre_publique`, `process_client`,
`mandat_client`, `talent_moi`, `etape`, `tag_job`, `talent_recherche`,
`process_interne`). Aucun n'existe, et **le schéma `api` lui-même n'est déclaré
dans aucun script**.

Sous cette absence, une plus grave : **118 tables avec RLS activée, zéro
policy**. Tout renvoie donc un tableau vide — le même résultat qu'une base
injoignable, qui est précisément la forme qu'ont prise les incidents de perte de
ce projet.

## Ce qui bloque le jalon 1, concrètement

Le Job Board est censé afficher douze offres. Sur les quinze champs que la
maquette (`frontend/lib/demo/offres.ts`) attend, **six n'ont aucune source** :

| champ attendu | état en base |
|---|---|
| localisation | **`mandat` n'a aucune colonne de localisation.** Seule `entreprise.localisation` existe. Or le filtre « Lieu » en dépend. |
| poste (libellé public) | `mandat.titre` est inutilisable : les 13 mandats publics et ouverts portent tous le nom du client. |
| date de publication | `created_at` est une date de synchronisation du miroir, pas de mise en ligne. |
| environnement technique | aucune colonne stack / technos. |
| description d'équipe | `nb_employes` et `nb_techs` sont des entiers portés par l'entreprise, pas la phrase affichée. |
| emoji des mots-clés | `ref_tag_job` porte `icone_url`, et la table est **détruite** — 74 lignes de caractères isolés. |

`ref_process_etape` est détruite de la même façon (70 lignes de caractères
isolés, `is_public` vrai sur zéro ligne) — or c'est elle qui doit décider ce
qu'un client a le droit de voir.

## Trois défauts de modèle que les tickets ne signalent pas

**`note` n'a pas de `process_id`**, et il n'existe pas de table `process_note`.
Ses seuls rattachements sont `candidat_id`, `entreprise_id`, `mandat_id`,
`mandatclose_id`. Le report de la décision client en note sur la candidature
(J3) et l'ajout d'une note sur une candidature (J6) n'ont donc **pas de cible**.

**`task` n'a aucun lien vers `mandat`, `process`, `candidat` ni `entreprise`** —
son unique rattachement est `mandatclose_id`, un deal déjà clos. La file de
travail priorisée du J5 et la création de tâche du J6 ne sont pas exprimables.

**La séniorité n'existe que dans `pivot.qualification`** — donc pour 6 615
talents sur 30 966, et pour **aucun** talent venu de Jarvi. Or le portail
entreprise l'affiche sur chaque carte.

## La décision de structure à prendre

Trois voies, et elles ne s'équivalent pas.

**Redresser `public`** — replier les quatre tables 1 pour 1, poser les 79 clés
étrangères manquantes, contraindre les référentiels. Séduisant et **dangereux** :
`public` est réécrit en continu par la synchro n8n, qui a cassé six fois. Changer
sa forme, c'est changer la synchro.

**Étendre `pivot`** aux offres et aux candidatures, et en faire la base de
l'application. C'est la cible logique — le pivot est déclaré maître — mais c'est
un chantier, et la Phase 1 l'a explicitement borné aux personnes.

**Construire une surface applicative** : un schéma `api` de vues au-dessus de
`public` et `pivot`, plus un petit nombre de tables **possédées par
l'application**. Additif, ne touche pas la synchro, donne au jalon 1 sa surface,
et c'est déjà l'intention des tickets.

### La question que les tickets ne posent pas

**Où vivent les écritures de l'application ?**

Si elles vont dans `public`, la synchro Bubble les écrasera : elle réécrit ces
tables. Les données que l'application possède — la localisation d'un mandat, son
libellé public, sa date de publication, le lien note↔candidature, le
rattachement d'une tâche, le journal d'écriture, le registre d'idempotence —
doivent donc vivre dans un schéma **que la synchro ne touche jamais**.

C'est la décision structurante, et elle se prend avant la première ligne de SQL
du jalon 1.
