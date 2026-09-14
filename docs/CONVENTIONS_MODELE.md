# Conventions du modèle applicatif

> Décidées le 26/08/2026. Chaque règle répond à un défaut **mesuré** dans le
> miroir. Sans cette colonne de droite, ce ne seraient que des préférences.

## La méthode

Étude complète du miroir, lecture des fonctionnalités, puis déduction du schéma
cible — pas domaine par domaine, sinon les liens transverses se découvrent trop
tard.

Le critère qui domine tout : **ne perdre aucune donnée**. Il est rendu
vérifiable par une **correspondance colonne par colonne** : chacune des 688
colonnes du miroir est attribuée à un attribut du cible, ou déclarée abandonnée
**avec sa raison**. Une colonne non attribuée est un défaut, pas un oubli. Le
contrôle est arithmétique : 688 lignes de correspondance pour 688 colonnes.

Un abandon n'est légitime que s'il est motivé. Deux motifs valent : la colonne
est un artefact de la plateforme Bubble (`Slug`, `Creation Date`, `unique id`,
préfixes `os_`, `_del_`), ou elle est **vide en production** — auquel cas il n'y
a rien à perdre. Le taux de remplissage réel des 688 colonnes est mesuré pour
que ce second motif soit un fait et non une impression.

## Les règles, et ce qu'elles corrigent

| Règle | Le défaut mesuré qu'elle corrige |
|---|---|
| **Clé primaire `uuid` avec `default gen_random_uuid()`** | 102 des 107 clés du miroir sont du texte **sans valeur par défaut** : l'application ne peut pas créer une ligne sans inventer un identifiant Bubble. |
| **`bubble_id text unique`, facultatif, sur les entités migrées — une provenance, pas une clé** | Le pivot rattache aujourd'hui les 7 028 talents de l'app par leur identifiant Bubble. La provenance doit être traçable sans qu'aucune clé n'en dépende, pour que le cut ne casse rien. |
| **Une entité, une table. Aucun satellite 1 pour 1** | `candidat_expanded`, `job_actuel`, `job_reve` et `experience` sont strictement 1 pour 1 avec `candidat` — 7 024 lignes pour 7 023 candidats. Idem `task_notif` avec `task`, `entreprise_remote` avec `entreprise`. Cinq jointures pour afficher une personne. |
| **Tout lien est une clé étrangère, avec un `on delete` explicite** | 34 des 113 liens entité→entité sont tenus, soit 30 %. La règle de sécurité du portail client reposerait sur `process.entreprise_id`, qu'aucune contrainte ne garantit. |
| **Un référentiel porte un code interne stable ET un libellé. Jamais le libellé comme valeur** | `process.etape` stocke `🙅🏻‍♀️ KO by Pachamama` **comme valeur**. Un renommage dans Bubble casserait tout filtre en silence — et pire, toute policy de sécurité. |
| **Les types disent ce qu'ils sont** : `timestamptz` pour les dates, `numeric` pour l'argent avec l'unité écrite, `boolean` pour les drapeaux | Les salaires étaient en `integer`, ce qui a gelé la synchro 43 jours quand une conversion €→K€ a produit des décimales. |
| **Nommage français, table au singulier, suffixe `_id` réservé aux clés étrangères** | Le miroir mélange `cand_firstname`, `os_language`, `_del_Statut`, `job_rêve` — accents et préfixes de plateforme compris. |
| **`cree_le` et `maj_le` sur chaque entité, posés par l'application** | `created_at` du miroir est une date de **synchronisation**, pas de création : elle ne peut pas servir de date de mise en ligne d'une offre. |
| **Un drapeau `actif` seulement là où le métier en a besoin** | Le chantier des flags `Actif` a coûté cher précisément parce qu'ils étaient posés partout sans règle. |

## Ce que le schéma cible ne fait pas

**Il ne modifie pas le miroir.** `public` reste le décalque de Bubble tant que
Bubble tourne. On l'importe, on ne le corrige pas : une correction dans un
miroir est une transformation que la synchro doit reproduire, et qui dérivera.

**Il ne remplace pas le pivot.** Le pivot est une base à part, indépendante de
l'application pour être réutilisable, alimentée **par** l'application et **par**
Jarvi. L'application est un producteur, pas un consommateur.

**Il ne coexiste pas avec Bubble sur un même domaine.** Tant que Bubble possède
un domaine, l'application l'**importe** depuis le miroir et ne l'écrit pas.
Quand elle le reprend, l'import s'arrête. C'est ce qui évite une matrice de
préséance champ par champ entre l'app et Bubble — la chose la plus coûteuse du
projet jusqu'ici.

## Ce que le cut coûtera, par construction

Quand Bubble s'arrête : la synchro s'arrête, la source `bubble` du pivot passe
en état terminal, le schéma `public` est supprimé, et les colonnes `bubble_id`
deviennent du poids mort — retirées en une migration.

**Aucune clé n'aura jamais dépendu de Bubble.** C'est la propriété qu'on achète
en refusant son format d'identifiant, et c'est ce qui fait que le cut est une
suppression et non une reprise.
