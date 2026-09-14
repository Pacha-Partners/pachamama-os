# Le modèle de données de Pachamama

> Document de référence, au 9 septembre 2026. Il explique ce qu'est ce
> modèle, pourquoi il est fait ainsi, et comment s'en servir. Les autres
> documents détaillent : `MODELE_V1_DETAIL.md` attribut par attribut,
> l'ADR 0003 les décisions et leurs alternatives, `REPRISE.md`
> l'avancement et les mesures.

---

## En un coup d'œil

| | |
|---|--:|
| tables | **64** |
| colonnes | 831 |
| types énumérés | 36 |
| clés étrangères | 142 |
| contraintes CHECK | 165 |
| index | 238 |
| vues | 13 |
| **lignes métier chargées** | **141 616** |

Déployé sur le projet Supabase **Pacha-App_dev**. Vingt-cinq migrations
rejouent l'ensemble depuis une base vierge : schéma, référentiels,
reprise des données, contraintes et sécurité.

---

## Pourquoi ce modèle existe

L'application actuelle tourne sur Bubble. Une copie de sa base — le
« miroir » — est synchronisée dans Supabase, dans le schéma `public`.
Cette copie reproduit la structure de Bubble, avec ses défauts : des
tables 1:1 éclatées sans raison, des N-N de façade, des drapeaux qui se
contredisent, des identifiants textuels partout.

Refaire l'application sur cette structure aurait été refaire Bubble en
plus lent. Ce modèle est donc une **refonte**, pas une recopie, et il
obéit à quatre contraintes posées au départ :

**Ne pas toucher au miroir** tant que Bubble tourne, et pouvoir être
alimenté par lui. Aucune des vingt-cinq migrations ne modifie `public` ni
`pivot` — vérifiable.

**Ne perdre aucune donnée.** Mesuré : sur 1 136 243 valeurs du miroir,
498 ne se retrouvent pas dans le modèle, soit 0,044 %, et chacune a une
cause nommée.

**Reproduire les fonctionnalités existantes** et en permettre de
nouvelles. 92 % des attributs qu'exigent les fonctionnalités vivantes
sont présents.

**Régler les identifiants**, parce que la finalité est de couper Bubble.
Les clés primaires sont des `uuid` ; `bubble_id` n'est jamais une clé,
seulement une provenance, et il est nullable partout.

---

## Les quatre schémas, et la règle de chacun

La séparation dit **qui a le droit d'écrire où**. Ce n'est pas une
commodité de rangement : c'est ce qui rend la sécurité vérifiable au lieu
d'être promise.

### `ref` — les vocabulaires · 15 tables, 32 types énumérés

Les métiers, les secteurs, les étapes du pipeline, les critères. Écrits
par l'administration, **jamais par l'application**. Un recruteur ne doit
pas pouvoir créer un univers en remplissant un formulaire.

Un vocabulaire **fermé** devient un type énuméré ; un vocabulaire qui
**grandit** reste une table. `ref.libelle` porte la présentation des
énumérés — libellé, emoji, couleur, ordre — et se joint par le couple
`(domaine, code)`.

`ref.correspondance` garde la trace de chaque transformation : « ce
libellé Bubble est devenu ce code ». C'est la seule pièce qui restera
lisible le jour où Bubble s'éteindra.

### `config` — le paramétrage · 8 tables

La marque, les gabarits d'e-mail, les canaux, les intégrations, les
interrupteurs. Même autorité que `ref`, nature différente : cela change
sans migration.

### `core` — le métier · 35 tables

Les talents, les entreprises, les mandats, les candidatures, les
placements, les notes. C'est ce que l'application écrit — à une exception
près, `core.talent`, qui est une projection en lecture seule.

### `app` — ce que l'application possède · 6 tables

L'authentification, les droits, les actes, les journaux, l'idempotence.
Ce ne sont pas des données métier, et les mélanger aux talents et aux
mandats brouillerait les deux. C'est le schéma le plus sensible : aucune
lecture anonyme n'y est possible.

### `api` — la surface exposée · 13 vues, aucune table

Le seul schéma destiné à sortir sur le réseau. Que des vues et des
fonctions.

---

## Les trois partis structurants

Ce sont eux qu'il faut comprendre : tout le reste en découle.

### 1. Le talent est dédoublé

Chercher et éditer sont deux gestes différents, et le modèle les sépare.

**`core.talent`** est la **projection** du pivot : ~31 000 personnes,
lecture seule, valeurs multiples à plat en tableaux. Elle sert à
chercher. Elle est alimentée par le connecteur pivot→app, jamais par
l'application, et deux verrous indépendants le garantissent — les droits
d'abord, un déclencheur ensuite.

**`core.fiche_talent`** est l'**enregistrement de l'application**, le
seul modifiable : 7 023 fiches, douze satellites normalisés, et une
colonne `_origine` par champ déclarable pour que le moteur d'inclusion
sache qui a dit quoi.

Le lien entre les deux est **nullable et non unique**. Nullable, parce
qu'une fiche créée à l'inscription n'a pas encore été ingérée par le
pivot. Non unique, parce que 374 talents du pivot sont nés de la fusion
de 769 candidats — une contrainte d'unicité échouerait dès le premier
jour.

### 2. Les droits vivent sur l'accès, jamais sur la personne

Un **compte** porte une identité d'authentification et rien d'autre. Les
droits sont accrochés à un **accès**, qui rattache ce compte à exactement
une personne : une fiche talent, un contact client ou un collaborateur.

```
app.compte  ──1..N──▶  app.acces  ──1──▶  une personne, et une seule
```

Le portail est **déclaré**, et sa cohérence avec la personne rattachée est
tenue par `acces_portail_coherent`. Il se déduisait jusqu'au 09/09 — la
déduction est devenue impossible quand le back-office s'est séparé du
recruteur, deux portails naissant désormais d'un même `collaborateur`
(voir [ADR 0004](decisions/0004-quatre-portails.md)). La contrainte centrale,
elle, ne bouge pas : `num_nonnulls(fiche_talent_id, contact_client_id,
collaborateur_id) = 1`.

Quatre portails : `talent`, `entreprise`, `recruteur`, `backoffice`.

Une candidate placée qui devient responsable de recrutement chez son
nouvel employeur **ajoute une ligne**. Rien de ce qui existait ne bouge,
et elle ne voit pas les notes écrites sur elle. C'est toute la raison
d'être du parti.

### 3. Publier est un acte, plus un état

Dans le miroir, l'exposition d'une offre dépendait de l'alignement de
quatre drapeaux — 24 combinaisons possibles, dont 15 mandats à la fois
publics et clos. Désormais un mandat est publié parce qu'une ligne existe
dans `app.mandat_publication` et que `retire_le` est nul. Un index unique
partiel interdit structurellement deux publications actives sur le même
canal.

---

## La carte des entités

### Le talent — 14 tables, 73 550 lignes

| table | lignes | |
|---|--:|---|
| `core.fiche_talent` | 7 023 | le cœur, seul modifiable |
| `core.talent` | 0 | la projection, attend le connecteur |
| `fiche_talent_background` | 5 213 | familles de parcours |
| `fiche_talent_profil` | 5 223 | IC, manager, entrepreneur, agence |
| `fiche_talent_expertise` | 9 488 | ce qu'elle sait faire |
| `fiche_talent_produit_xp` | 11 331 | types de produits vécus |
| `fiche_talent_secteur_xp` | 10 321 | secteurs vécus |
| `fiche_talent_secteur_vise` | 2 831 | secteurs visés |
| `fiche_talent_secteur_nogo` | 1 803 | secteurs refusés |
| `fiche_talent_critere` | 8 873 | ce qui compte pour elle |
| `fiche_talent_contrat_souhaite` | 6 477 | CDI, freelance, entrepreneur |
| `fiche_talent_remote_souhaite` | 4 967 | rythme de télétravail |
| `fiche_talent_tag` | 86 | tags posés par le cabinet |
| `fiche_talent_poste` | 0 | la timeline — aucune source au miroir |

### L'entreprise et ses contacts — 6 tables

`core.entreprise` 851 · `core.contact_client` 524 ·
`core.mandat_contact_client` 706 · `core.produit` 103 · `core.tag` 110 ·
`core.enquete_nps` 118

La **Décision 6** scinde le contact en deux : la **personne** d'un côté,
sa **participation** à un mandat de l'autre. Le miroir mélangeait les
deux, obligeant à recréer une ligne par mandat pour la même personne —
764 lignes pour 524 personnes réelles.

### Les personnes internes — 3 tables

`core.collaborateur` 42 · `core.collaborateur_univers` 8 ·
`core.apporteur_affaires` 20

Quarante-deux, et non quarante-et-un : le chiffre qui circulait comptait
les *lignes* de rôles, certaines personnes en cumulant deux. La table
porte aussi les **anciens** — quatre personnes sans rôle restent
référentes sur 1 959 fiches, et les exclure les aurait orphelinées.

### Le mandat, la candidature, le placement — 11 tables

`core.mandat` 533 · `core.candidature` 7 236 · `core.placement` 227 ·
`core.repartition_commission` 260 · `core.analyse` 501 ·
`core.placement_utilisateur` 201 · plus quatre tables de liaison

### Le journal et le travail — 2 tables

`core.note` **45 685** · `core.tache` 1 136

`core.note` est le journal métier — un contenu rédigé, relu par un
recruteur. À ne pas confondre avec `app.journal_ecriture`, qui est une
trace machine des changements de champ.

Elle fusionne `note` et `note_archivee`, qui ne partagent aucun
identifiant : l'archivage créait une ligne neuve, à ~1 500 par mois.
Rapprochées par leur contenu, 51 007 lignes sources donnent 45 685 notes.

Son auteur est **soit un collaborateur, soit un talent** — deux clés
étrangères nullables, avec des politiques opposées : une note écrite
**sur** une personne disparaît avec elle, une note écrite **par** elle
survit.

### Ce que l'application possède — 6 tables

`app.compte` 4 159 · `app.acces` 4 196 · `app.mandat_publication` 36 ·
`app.transition_etape` 0 · `app.journal_ecriture` 0 · `app.idempotence` 0

Les trois vides le sont pour trois raisons distinctes : la première n'a
aucune source au miroir, les deux autres se remplissent à l'usage.

---

## Les conventions, à connaître avant d'écrire une requête

**Les identifiants.** Clé primaire `uuid`, toujours. `bubble_id` est une
provenance, nullable, jamais une clé. À la reprise, l'uuid est **calculé**
depuis l'identifiant Bubble de façon déterministe : la reprise est donc
rejouable et partielle.

**Les unités sont dans le nom.** `_ke` pour les milliers d'euros, `_eur`
pour les euros, `_pct` pour les pourcentages. Aucune colonne monétaire
n'en est dépourvue, et ce n'est pas cosmétique : la mesure a trouvé un
facteur mille entre `core.placement` (K€) et
`core.repartition_commission` (€), invisible dans les noms d'origine.

**Les dates.** `cree_le` et `maj_le` partout, `_le` en suffixe pour tout
horodatage. `maj_le` est tenue par un déclencheur.

**Les vocabulaires.** Un code stable en `snake_case` ASCII, jamais le
libellé. L'emoji vit dans sa propre colonne. L'ordre d'affichage des
énumérés est celui de leur **déclaration** — PostgreSQL trie ainsi
nativement.

**La provenance déclarative.** Les champs qu'un talent peut déclarer
portent une colonne `_origine` : `declare`, `recruteur`, `pre_rempli`,
`import`, `automatique`. C'est ce qui permettra au moteur d'inclusion
d'arbitrer sans reconstituer le journal.

---

## Comment l'interroger

La couche `api` est la seule surface destinée au réseau. **Deux
mécanismes s'y combinent, et ils ne font pas la même chose** : la
*policy* choisit les **lignes** qu'un appelant peut voir, la *vue*
choisit les **colonnes** qu'elle lui montre. Une candidate voit sa
candidature, mais pas l'appréciation qu'un recruteur y a écrite.

### Les fonctions d'identité

`api.compte_id()` · `api.est_interne()` · `api.mes_portails()` ·
`api.a_portail(text)` · `api.role_sur(text)` · `api.ma_fiche_talent()` ·
`api.mes_entreprises()`

Toutes les policies s'appuient sur elles : c'est le point unique où
l'identité entre dans le modèle.

`api.role_interne()` existe encore mais est **héritée** : elle fait `limit 1`,
et rendait un rôle au hasard depuis qu'un compte peut porter deux portails
internes. Rendue déterministe — le back-office l'emporte — elle ne doit plus
être employée dans du code neuf : `api.a_portail()` répond sans ambiguïté
([ADR 0004](decisions/0004-quatre-portails.md)).

### Les vues, par usage

| vue | pour qui |
|---|---|
| `api.moi` | tout le monde — qui suis-je, que puis-je voir |
| `api.offre` | le job board, ouvert aux visiteurs |
| `api.ma_fiche` | le talent — sa fiche, sans la qualification du cabinet |
| `api.ma_candidature` | le talent — où en est sa candidature |
| `api.mandat_client` | le contact entreprise — ses mandats |
| `api.candidature_client` | le contact entreprise — les candidats présentés |
| `api.talent_recherche` | le recruteur — la recherche de talents |
| `api.kanban` | le recruteur — le pipeline d'un mandat |

### Le rattachement d'une connexion

Les 4 159 comptes créés par la reprise n'ont pas d'identité
d'authentification : ils sont **pré-provisionnés**. Un déclencheur sur
`auth.users` les rattache à la première connexion, par l'e-mail — la
seule clé commune. Il crée même le compte et l'accès si la personne
existe sans compte, ce qui est le cas des contacts entreprise.

---

## Ce que le modèle ne porte pas, délibérément

**Les secrets.** Aucune colonne ne peut accueillir un webhook ou une clé
d'API. `config.integration` porte une *référence* au secret, et un CHECK
refuse structurellement qu'on y colle une URL ou un jeton.

**Les tables du miroir qui n'en étaient pas.** `candidat_mandat` — deux
colonnes, aucun attribut, 99,7 % de doublons avec les candidatures — n'est
pas reprise. `task_notif` se replie dans la tâche, sa cardinalité 1:1
étant mesurée et non supposée.

**Les identifiants d'URL Bubble.** Les vingt-et-une colonnes `slug`
disparaissent.

**Les colonnes dérivées.** `prenom_lower`, `nom_lower` : reconstruites par
un index fonctionnel.

---

## Ce qui a été perdu, et par qui

498 valeurs sur 1 136 243, soit 0,044 %. Chacune a une cause nommée :

- **426** `created_by` désignant des comptes supprimés de Bubble — la
  personne n'existe plus, rien ne peut la rendre ;
- **16** notifications orphelines, prix déclaré du repli de `task_notif` ;
- **5** références de tâche vers un closing inexistant ;
- **8** satellites orphelins ;
- **43** artefacts de comptage de transformations voulues — la fusion des
  notes, l'éclatement d'un tableau.

**Et ce que le miroir avait déjà perdu de son côté**, découvert en
chemin : deux référentiels détruits, réduits à une suite de caractères
isolés — les tags de mandat et, plus grave, **le pipeline de
recrutement**. Leurs vocabulaires ont été reconstruits depuis l'usage,
mais l'ordre, les couleurs et quatre des cinq drapeaux du pipeline sont
partis pour de bon.

Enfin, **l'historique des étapes n'existe nulle part** : les deux colonnes
du miroir censées le porter sont vides à 100 %. Aucune durée par étape
n'est calculable sur les quatre ans passés. `app.transition_etape`
commencera à enregistrer au premier jour de la nouvelle application.

---

## Le seul endroit non mesuré

Tout le modèle repose sur des mesures faites en production. **Un attribut
fait exception** : l'ordre des 14 étapes du pipeline. Le `sort_order`
d'origine est parti avec le référentiel détruit, et trois pistes ont été
cherchées sans aboutir — les volumes ne s'ordonnent pas, les dates de
statut sont vides, les événements de note ne mentionnent aucune étape.

L'ordre retenu est l'entonnoir de recrutement usuel. C'est une inférence
de métier, assumée comme telle, et signalée dans la base elle-même.

---

## Où trouver le reste

| document | ce qu'il contient |
|---|---|
| `MODELE_V1_DETAIL.md` | chaque entité, chaque attribut, son type et son origine |
| `decisions/0003-modele-donnees-application.md` | les décisions, leurs alternatives, ce qui les fonde |
| `REPRISE.md` | l'avancement, les mesures, ce qu'il reste à faire |
| `backend/database/reprise/` | les scripts de reprise, rejouables |
| `backend/database/audit/` | le mapping colonne à colonne de l'audit de non-perte |
| `reprise.controle` (en base) | le rapprochement de chaque étape de chargement |
| `reprise.audit_valeur` (en base) | l'audit valeur par valeur, interrogeable en SQL |
