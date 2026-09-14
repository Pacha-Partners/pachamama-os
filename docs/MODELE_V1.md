# Modèle v1 — la proposition

> Proposition du 26/08/2026, à juger avant migration. Elle applique les six
> décisions de l'ADR 0003 et corrige les huit défauts que le challenge a
> trouvés. Le détail attribut par attribut suit ; ce document porte la
> structure, qui est ce qui se juge.
>
> **Révision du 27/08/2026** — après vérification de la conservation des
> données et de la couverture fonctionnelle : deux entités ajoutées
> (`core.note`, `core.tache`), la règle de fusion des montants tranchée, et
> quatre points d'arbitrage fermés. Les changements sont signalés dans le
> texte.

## Ce qui change par rapport à l'étude

Huit corrections, chacune répondant à un défaut mesuré.

| défaut mesuré | ce que la v1 fait |
|---|---|
| `api` n'est pas la seule surface exposée — `public`, `pivot` et deux schémas d'Avant-garde le sont | **seul `api` est exposé.** Les autres schémas restent joignables par le moteur, pas par le réseau |
| la clé Bubble est obligatoire sur 14 entités | **`bubble_id` nullable partout.** Une provenance, jamais une clé |
| `candidature.talent_id` et `mandat_id` obligatoires alors que 19 et 20 lignes sont vides | **nullable**, et la candidature spontanée devient exprimable |
| la fiche talent n'existe dans aucun artefact | **`core.fiche_talent` est la cible de migration de `public.candidat`** et de ses quatre satellites |
| 793 dossiers travaillés sans domicile | une fiche par candidat Bubble — **7 032 fiches**, la règle « process ou compte » décrivait l'usage, pas la migration |
| « contact principal » remonté sur la personne alors qu'il varie par mandat pour 41 personnes | ces colonnes vont sur **`core.mandat_contact_client`** |
| 24 combinaisons de drapeaux gouvernent l'exposition d'une offre | **publier devient un acte** : une ligne dans `app.mandat_publication` |
| la fusion au pivot casse « une fiche par talent » — 374 collisions | `fiche_talent.talent_id` **nullable et non unique**, plus une vue qui liste les collisions |

## Les quatre schémas, et ce qui les sépare

```
core     le métier            ~36 entités    écrit par l'application
ref      les référentiels     ~15            écrit par l'administration
config   le paramétrage        ~8            écrit par l'administration
app      ce que l'app possède ~10 au départ  écrit par l'application
api      des vues, rien d'autre              LE SEUL SCHÉMA EXPOSÉ
```

**Ce qui rend la sécurité tenable, et qui manquait.** Une vue en
`security_invoker` s'exécute avec les droits de l'appelant : celui-ci doit donc
avoir le droit de lire la table de base. Tant que cette table est **joignable
par l'API**, l'énumération des colonnes de la vue ne protège rien.

La v1 sépare les deux notions : `anon` et `authenticated` reçoivent le droit de
lecture sur les tables de `core`, `ref` et `config` — nécessaire au mécanisme —
mais **ces schémas ne sont pas exposés dans les réglages de l'API**. PostgREST
ne sait donc pas y router. La RLS filtre les lignes, la vue choisit les
colonnes, et rien ne contourne les deux.

⚠️ C'est une action dans le tableau de bord Supabase, pas une migration :
retirer `public` et `pivot` des schémas exposés. Tant que ce n'est pas fait, la
couche `api` est contournable.

## Le talent, dédoublé — la décision centrale

```
pivot.talent          ce que NOUS avons assemblé          31 000   jamais montré au candidat
core.talent           projection du pivot                 31 000   LECTURE SEULE
core.fiche_talent     l'enregistrement de l'application    7 032   le seul modifiable
```

**`core.fiche_talent` est la cible de migration de `public.candidat`** et de ses
quatre satellites 1 pour 1 — `candidat_expanded`, `job_actuel`, `job_reve`,
`experience`. Une fiche par candidat Bubble. Cinq tables deviennent une.

Elle porte l'identité **déclarée**, les coordonnées déclarées, les documents, la
**qualification** — travail du cabinet, que Jarvi ne produit pas —, les
**attentes**, et les attributs du cabinet : agent référent, statut de relation,
emoji, drapeau actif, apporteur.

**`core.talent` ne reçoit jamais d'écriture applicative.** Elle sert à chercher
parmi 31 000 personnes sans aller taper dans une autre base. Elle est alimentée
par un connecteur pivot → app qui reste à écrire — c'est un troisième
connecteur, il faut le dire.

`fiche_talent.talent_id` est **nullable** (une fiche créée à l'inscription
précède l'ingestion par le pivot) et **non unique** (374 talents sont nés de la
fusion de plusieurs candidats). Une vue de contrôle liste les collisions au lieu
de les interdire.

Chaque champ déclarable porte une colonne `_origine` : `declare`, `recruteur`,
`pre_rempli`, `import`, `automatique`. C'est ce qui permettra au moteur de faire
primer la parole de la personne — quand le pivot saura la recevoir.

## Publier une offre devient un acte

Aujourd'hui, quatre drapeaux — `visibilite`, `statut`, `job_off_market`,
`job_anonyme` — produisent **24 combinaisons réelles sur 534 mandats**, dont
quatre mandats à la fois publics et hors marché, et quinze publics mais clos.
Aucune règle ne dit lequel l'emporte.

Dans la v1, les quatre drapeaux restent **descriptifs** et ne décident plus
rien. Un mandat est publié parce qu'une ligne existe dans
`app.mandat_publication`, avec son libellé public, sa localisation, sa date de
mise en ligne. Publier et dépublier deviennent deux gestes tracés, au lieu
d'une conjonction que personne ne sait relire.

## Les statuts de mandat

Deux notions manquaient, et vos définitions les tranchent :

**En pause** entre au référentiel : un mandat suspendu dont le process s'est
arrêté, et qui **n'est pas clos**. Le confondre avec « Terminé » fausse le
tableau de bord client et le délai de recrutement.

**Reprise n'est pas un statut** mais un lien : `mandat.issu_de_mandat_id`, vers
le mandat dont celui-ci est issu. Une valeur d'énumération n'aurait pas su le
dire.

## L'ordre de migration

Il découle des dépendances, et chaque étape a un préalable mesuré.

```
1  ref.* et config.*        les référentiels d'abord, tout en dépend
2  core.entreprise          puis produit, tag
3  core.collaborateur       les ~41 internes, extraits de public.user
4  core.contact_client      427 personnes, dédupliquées depuis les 768 lignes equipe
5  core.mandat              puis analyse, et les liaisons
6  core.fiche_talent        7 032 fiches ← candidat + ses 4 satellites
7  core.talent              31 000 lignes ← projection du pivot
8  core.candidature         puis placement, répartition de commission
9  core.note, core.tache
10 app.compte, app.acces    reconstruits, pas migrés
```

**À nettoyer avant de poser les contraintes**, mesuré : 89 tags sur 110
rattachés ni à une entreprise ni à un mandat · 20 analyses sans mandat · 16
lignes de NPS pointant un contact inexistant · 2 notes à l'auteur orphelin ·
2 candidatures partageant un placement · 104 comptes rattachés à rien pour 41
rôles internes · 20 lignes de process sans mandat ni entreprise.

Rien ne se jette : ce sont des lignes à trier, et le tri précède la contrainte.

## Deux arbitrages ouverts, tranchés par la mesure

**`job_reve.salaire` est le minimum.** Sur 3 588 fiches portant les deux
valeurs : 85,1 % ont `salaire < salaire_maximum`, 14,5 % une égalité, et **15
lignes seulement** sont inversées. Le doute venait du vocabulaire Bubble
(« Salaire minimum » / « Salaire souhaité ») ; la donnée tranche. La v1 nomme
donc `salaire_min_souhaite` et `salaire_max_souhaite`, et pose la contrainte
`min <= max` — les 15 lignes inversées sont à trier avant.

**`candidat_expanded` est la table vivante, `candidat` est le legacy.** Mesuré
sur les six champs dupliqués, sans une exception :

| champ | `candidat` | `candidat_expanded` |
|---|---:|---:|
| statut | 47,6 % | **94,4 %** |
| mindset | 32,3 % | **77,2 %** |
| contrat actuel | 11,3 % | **49,8 %** |
| early stage | 7,7 % | **25,8 %** |
| emoji de statut | 3,8 % | **10,2 %** |
| portfolio | **0 %** | **10,4 %** |

La règle de reprise est donc : l'expanded gagne, `candidat` comble les trous.
C'est cohérent avec les préfixes `_del_` que Bubble porte sur ces champs.

## Le journal et les tâches — ajout du 27/08/2026

La vérification de couverture a montré que quatre entités portant des
fonctionnalités **déjà en production** n'avaient aucune cible. Trois deviennent
deux tables, la quatrième n'en devient aucune.

**`core.note`** — le journal métier, à ne pas confondre avec
`app.journal_ecriture` qui trace les changements de champ. Elle fusionne
`note` et `note_archivee`, qui ne partagent aucun identifiant : rapprochées par
leur contenu, elles donnent **46 063 notes et non 51 123**, l'archive portant
20 258 notes absentes du courant. Les quatre tables de liaison du miroir sont
abandonnées — `candidat_note` porte 0 ligne, les trois autres sont plus petites
que les colonnes scalaires équivalentes : des N-N de façade.

Elle **lève le dernier point bloquant du modèle**. On croyait l'auteur
impossible à contraindre — 2 103 valeurs distinctes pour 41 collaborateurs — et
trois issues coûteuses s'offraient. La mesure les rend inutiles : 67,8 % des
notes viennent des 41 internes, 31,4 % d'un candidat, 0,0 % d'un contact
entreprise. Deux clés étrangères nullables résolvent **99,25 %** des auteurs.

**`core.tache`** — 1 141 tâches, entièrement internes : aucun créateur ni
assigné n'échappe aux 41 collaborateurs. `task_notif` s'y replie, la
cardinalité 1:1 étant mesurée et non supposée. Prix déclaré : 16 notifications
orphelines perdues.

**La surveillance de la synchronisation n'ajoute aucune table.** Tous les
instruments existent déjà et ne sont jamais regardés ; le besoin est une
surface de lecture. Mais elle corrige un classement erroné : les tables
`_sync_*` avaient été rangées en « meurt avec le miroir », ce qui n'est vrai
que de leur moitié. La synchro Jarvi ↔ pivot est la raison d'être du pivot et
lui survit — sa supervision doit être portée, sinon la coupure de Bubble
emporte aussi la surveillance de ce qui reste.

## Le détail

`docs/MODELE_V1_DETAIL.md` — **68 entités, ~875 attributs**, chacun avec son
type, son caractère obligatoire et sa colonne d'origine dans le miroir. C'est
de là que la migration se dérive.

Il remonte aussi **72 points à nettoyer** avant de poser les contraintes et
**77 points d'arbitrage** de détail, rangés en annexe.

**Réparé le 27/08/2026.** Le document était une restitution appauvrie de
l'analyse : le rendu avait gardé la colonne d'origine et perdu presque tout le
reste. Restaurés depuis le journal de génération — 56 cellules tronquées,
**652 commentaires d'attribut**, **182 index**, 16 relations, 3 contraintes.
Les commentaires portent les taux de remplissage, les valeurs d'énumérés et les
raisons de nullabilité : sans eux, le SQL n'était pas dérivable.

## Ce qui a été tranché le 27/08/2026

**La fusion des montants.** `public.candidat` porte quatre colonnes de salaire
absentes de `candidat_expanded` : lire `job_reve` seul perd **737 montants
introuvables ailleurs** et tranche en silence 447 désaccords. Règle retenue :
union d'abord, puis préséance au plus récent. Elle n'est pas neutre — sur les
216 désaccords de salaire minimum, `candidat` est la source la plus fraîche
**167 fois sur 216**, alors même que `job_reve` est mieux rempli.

**L'ordre d'affichage des énumérés.** Les 32 `sort_order` des référentiels
devenus des enums ne se perdent pas : PostgreSQL trie un type énuméré par
l'ordre de déclaration de ses valeurs. Il suffit de déclarer chaque `CREATE
TYPE` dans la séquence du `sort_order` source. Coût nul.

**Les 13 horodatages des tables repliées se perdent — j'avais dit l'inverse.**
Les quatre tables se replient bien dans une seule, qui n'a qu'un `maj_le`.
`cree_le` = MIN, `maj_le` = MAX, et l'historique par champ passe désormais par
`app.journal_ecriture`. Le passé n'est pas reconstituable.

**Trois abandons sans réserve** — `candidat.opento` (0 valeur),
`prenom_lower`/`nom_lower` (dérivées, reconstruites par index), et les deux
drapeaux `popup_*` (état d'une interface qui disparaît).

## Ce qui reste à arbitrer, et que le modèle ne peut pas trancher

**`core.vivier_mandat`** — l'ex `candidat_mandat`, 2 603 couples talent×mandat,
quand `process` en porte 7 088. **4 492 existent dans process seulement, 7 dans
l'autre.** Ce sont deux notions différentes ; personne ne sait dire laquelle.
La v1 garde les deux et attend votre définition.

**Ce que la fiche porte que le pivot n'a pas.** Vous l'avez annoncé sans le
détailler ; c'est ce qui décide de la frontière entre la fiche et la projection.

**La provenance par champ dans le pivot.** `attentes` et `qualification` n'en
ont aucune. Tant que c'est le cas, l'origine `pré-rempli` ne peut pas dire d'où
la valeur venait, et la règle « la parole de la personne prime » reste
inapplicable.
