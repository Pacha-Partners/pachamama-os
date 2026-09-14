# Environnement de développement séparé

> Décision du 25/08/2026. Chaque chiffre de ce document est mesuré, pas estimé.

## La décision

Deux projets Supabase distincts.

| | Projet | Référence | Région | Sert à |
|---|---|---|---|---|
| **live** | Pacha App | `zkxwoclmephuzbdgcggr` | `eu-west-1` (Dublin) | la production. Inchangée. |
| **dev** | Pacha-App_dev | `xavnvkpgbpczblmwlaxk` | `eu-central-1` (Francfort) | construire les jalons de la Phase 2 |

Les deux vivent dans l'organisation **Pachamama, plan Pro**. Le projet dev est
donc facturé — compute Micro, environ 10 $/mois — mais il ne se met jamais en
pause et il est sauvegardé. La région n'a pas été proposée au moment de la
création ; l'écart Dublin/Francfort est sans conséquence, à ceci près que les
temps de réponse mesurés sur le dev ne sont pas strictement comparables à ceux
de la production.

⚠️ **La CLI est rattachée à UN seul projet à la fois.** `supabase/.temp/project-ref`
dit lequel. Elle pointe actuellement sur le **dev**. Toute commande qui écrit —
`db push` en particulier — s'applique au projet rattaché : vérifier avant, pas
après.

### T4 — le dev, mesuré le 25/08/2026

| | tables | lignes |
|---|---|---|
| `public` | 107 | 0 |
| `pivot` | 11 | 0 |

`supabase db diff --linked --schema public,pivot` répond **« No schema changes
found »**. Le fichier de migration, la production et le projet dev décrivent la
même structure. Les données restent à charger — c'est T5.

Les données de dev sont **anonymisées pour ce qui identifie une personne**, et
**réelles pour ce qui décrit une offre ou une entreprise**.

## Pourquoi pas deux schémas dans le même projet

C'était la première approche, et l'outillage existe (`backend/database/test/`).
Elle ne répond pas à la demande, pour trois raisons mesurées.

**Ce ne serait pas deux bases.** Même URL, mêmes clés, même `auth.users`, même
disque, même configuration PostgREST. Le projet héberge déjà une autre
application : les schémas exposés sont `public, graphql_public, avant_garde_dev,
avant_garde, pivot`. Un compte créé pour tester serait un vrai compte du projet.

**Changer de projet est plus simple que changer de schéma.** Le frontend lit
`NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` depuis
l'environnement (`frontend/lib/supabase/navigateur.ts:11`,
`frontend/lib/supabase/serveur.ts:16`) : pointer sur un autre projet ne coûte
que deux variables. Pointer sur un autre schéma exige de modifier les deux
clients, d'exposer le schéma dans le tableau de bord, et de corriger les trois
`profil="pivot"` écrits en dur dans `connecteurs/commun.py`.

**Et côté API, le repli est silencieux.** `DB_SCHEMA` bascule le `search_path`,
mais `public` y reste en deuxième position (`backend/api/.../db.py:54`). Un
schéma cible absent ou vide ne provoque aucune erreur : les requêtes retombent
sur le miroir de production.

## Le problème de fond, à régler d'abord

**Il n'existe aucun historique de migrations.** `backend/database/migrations/`
est vide.

Vérifié par rejeu des huit fichiers DDL de `Bubble migration` sur une base
vierge : on obtient **105 tables et 667 colonnes**. La production en compte
**107 et 688**. Deux objets et vingt et une colonnes ne sont décrits par aucun
fichier — des modifications faites à la main dans l'éditeur SQL, jamais
reversées. Aucun `GRANT`, aucune `RLS`, aucune policy de `public` n'existe non
plus sous forme de fichier.

Le schéma `pivot` fait exception : `backend/database/schema/01+02+03` le
reconstruit à l'identique, vérifié par rejeu.

Tant que ce trou n'est pas comblé, **n'importe quel environnement de dev
dérivera à nouveau en quelques semaines**. La capture du schéma réel est donc
l'étape zéro, avant même la création du projet dev.

### Le trou est comblé — 25/08/2026

`supabase/migrations/20260825111210_remote_schema.sql` décrit désormais l'état
réel de la production. Vérifié deux fois :

- **rejeu sur un PostgreSQL 17 vierge**, sans erreur, puis comptage :

  | | tables | vues | colonnes | index | FK | RLS | policies | fonctions | déclencheurs |
  |---|---|---|---|---|---|---|---|---|---|
  | `public` | 107 | 0 | 688 | 159 | 57 | 107 | **0** | 7 | 0 |
  | `pivot` | 11 | 7 | 171 | 36 | 8 | 11 | **0** | 0 | 0 |

  Les 107 relations et 688 colonnes de `public`, les 18 relations et 171
  colonnes de `pivot` correspondent exactement à ce que l'API mesurait en
  production. Les 21 colonnes et 2 objets que plus aucun fichier ne décrivait
  sont dans celui-ci.

- **`supabase db diff --linked --schema public,pivot` : « No schema changes
  found ».** Le fichier et la base sont identiques. C'est la preuve qui compte,
  parce qu'elle est produite par comparaison avec la base elle-même, pas par
  recomptage de ce que j'ai écrit.

Deux constats de cette capture, à garder :

**La RLS est activée sur les 118 tables, et il n'existe aucune policy.** Refus
par défaut partout. C'est ce qui explique qu'une lecture sous clé `anon` renvoie
un tableau vide plutôt qu'une erreur — et c'est le point de départ du jalon 1.

**Ni `public` ni `pivot` ne portent de déclencheur.** Les 8 déclencheurs vus
d'abord appartiennent aux schémas d'Avant-garde.

### Deux pièges rencontrés, pour qui refera l'opération

**`supabase db pull` n'est pas l'outil.** Il a ignoré `--schema public,pivot` —
le fichier produit contenait les deux schémas d'Avant-garde — et surtout il
n'emporte **aucune fonction** : les 7 RPC dont dépend la synchro n8n étaient
absentes. `supabase db dump --schema public,pivot` les capture correctement.

**`pg_dump` exclut les extensions**, parce que Supabase les gère lui-même. Or
trois index de `pivot.talent` utilisent `extensions.gin_trgm_ops`. Sans un
`CREATE EXTENSION pg_trgm` ajouté en tête, rejouer le fichier échoue — ce qui
se serait produit au moment de pousser vers le projet dev. Les deux lignes sont
ajoutées et commentées dans le fichier.

## Les étapes, et qui fait quoi

| | Étape | Qui |
|---|---|---|
| **T0** | CLI Supabase installée (2.115.0) | fait |
| **T1** | `supabase login` puis `supabase link` sur le projet live | fait |
| **T2** | capture du schéma réel dans un fichier de migration | **fait et vérifié** |
| **T3** | création du projet dev dans le tableau de bord | fait |
| **T4** | schéma réel appliqué au projet dev | **fait et vérifié** |
| **T5** | anonymiseur, puis peuplement du dev | **fait** |
| **T6** | configuration locale sur le dev | **fait** — reste Vercel, **vous** |

T1, T3 et T6 demandent des identifiants ou le tableau de bord : je ne les
manipule pas. Le reste se fait depuis le dépôt.

### Un réglage qui reste manuel, et pourquoi

Un projet Supabase neuf n'expose que `public` et `graphql_public`. La production
expose en plus `pivot`, `avant_garde` et `avant_garde_dev`. Il faut donc ajouter
**`pivot`** aux schémas exposés du projet dev, dans *Settings → API → Exposed
schemas*, sinon rien ne peut écrire dans `pivot` par l'API.

La CLI sait pousser ce réglage (`supabase config push`, à partir du `[api]` de
`supabase/config.toml`). **On ne s'en sert pas ici**, et c'est délibéré : ce
fichier déclare `schemas = ["public", "graphql_public"]`, et le pousser sur le
projet **live** retirerait `pivot`, `avant_garde` et `avant_garde_dev` de son
API. La synchro n8n s'arrêterait, et l'application d'Avant-garde aussi. Tant
que les deux projets partagent une configuration locale et qu'un seul est
rattaché à la fois, le risque n'en vaut pas la commodité.

Conséquence à assumer : la liste des schémas exposés n'est pas versionnée. Elle
est notée ici, et c'est le seul endroit où elle l'est.

## La règle d'anonymisation

> **08/09/2026 — levée.** Sur décision du dirigeant, la pseudonymisation du
> projet de développement est abolie. Le dev est une capture des données
> réelles à un instant t et **porte désormais des données personnelles
> réelles** ; les données du live continuent d'évoluer de leur côté, et ce
> qu'on transférera au live depuis le dev, c'est la logique et l'architecture,
> jamais les lignes. La restauration a été faite par
> `backend/database/anonymisation/restaurer_reel.py` (production lue seulement,
> lignes présentes des deux côtés uniquement). Tout ce qui suit dans cette
> section, comme `classification.json` et son README, ne décrit plus l'état du
> dev mais le **mode anonymisé de `peupler_dev.py`** — ce qui s'appliquerait
> s'il était repeuplé par lui. Seuls `pivot.sync_etat` et `pivot.sync_run`
> restent volontairement fictifs : leur curseur ferait sauter des
> enregistrements à la synchro du dev.

**Ce qui identifie une personne est substitué. Ce qui décrit une offre ou une
entreprise reste réel.**

Substitué : `candidat` (identité, coordonnées, `genre`, `note_interne`,
`pachamama_*`), `candidat_expanded` (`note_1`, `note_2`, `perso`, `ecole`),
`job_reve` (description, disponibilité, salaires), `job_actuel`
(`entreprise_nom`, `pourquoi`), `note` et `note_archivee` (20 018 et 19 778
commentaires), `user`, `equipe` (650 contacts client — des personnes physiques
rarement pensées comme telles), `business_maker`, et les colonnes de contact de
`entreprise` (`fondateur`, `email_facturation`, `siret`).

Conservé : `mandat`, `mandatclose`, la raison sociale des entreprises, les 44
référentiels `ref_*`, `tag`, `produit`. C'est ce qui permet de juger le rendu
réel du Job Board au jalon 1.

Un anonymiseur existe déjà, mais **pour le seul schéma `pivot` et sur 400
lignes** : `backend/pipeline/etl/generer_dump.mjs`. Il substitue par hachage
déterministe et vérifie l'absence de fuite en trois passes. Le travail de T5
consiste à étendre cette mécanique à `public`, pas à la réinventer.

⚠️ Ce dump est une **pseudonymisation, pas une anonymisation** au sens du RGPD :
il conserve délibérément la localisation à la granularité du code postal, le
statut de process, la séniorité et les fourchettes de salaire. Sur 400 lignes le
risque de réidentification est faible ; il croît avec le volume. À trancher
explicitement en T5.

## T5 — l'anonymiseur, et les trois mesures qui l'ont façonné

Outillage dans `backend/database/anonymisation/` :

| Fichier | Rôle |
|---|---|
| `classification.json` | le traitement de chacune des 785 colonnes |
| `README.md` | **généré** depuis la classification, jamais édité à la main |
| `verifier_classification.py` | échoue si la classification ne décrit plus le schéma |
| `substituts.py` | les substitutions déterministes |
| `peupler_dev.py` | lit la production, anonymise, écrit dans le dev |
| `verifier_dev.py` | contrôle le dev contre la production, après chargement |

`commun.py` a été étendu d'un paramètre `acces` facultatif pour viser un second
projet. La logique de pagination PostgREST — plafond silencieux à 1 000 lignes,
recoupement des totaux, distinction entre troncature et table en mouvement —
reste écrite une seule fois.

### La substitution porte sur la valeur, pas sur la ligne

Le même prénom réel donne partout le même prénom fictif. `candidat.prenom`,
`user.prenom` et `nps_tracking.candidate_firstname` restent donc cohérents pour
une même personne **sans aucune jointure**. L'anonymiseur du livrable Bachelor
(`backend/pipeline/etl/generer_dump.mjs`) hache le `talent_id` : il ne peut pas
être cohérent d'une table à l'autre.

### Mesure 1 — la purge doit porter sur le couple, pas sur ses moitiés

Première version : purger les listes de prénoms des valeurs réellement
présentes. Résultat, **6 prénoms survivants sur 119**. La production porte
6 915 prénoms et 22 038 noms distincts : avec trente mille personnes, tout
prénom français plausible y figure déjà.

Or ce n'est pas le prénom qui identifie, c'est le **couple**. Sur les 22 610
couples fabricables, **59 seulement existent réellement, soit 0,26 %**. La
purge porte donc sur le couple : elle ne coûte presque rien et protège ce qui
doit l'être. Le prénom reste une fonction pure du prénom réel, ce qui préserve
la cohérence des colonnes qui ne portent qu'un prénom.

### Mesure 2 — une liste courte détruit la variété

Premier chargement complet, puis comptage des valeurs distinctes dans le dev :

| | production | dev, 1re version | dev, corrigé |
|---|---:|---:|---:|
| employeurs distincts | 14 401 | **40** | 18 961 fabricables |
| intitulés distincts | 12 458 | **12** | 5 250 fabricables |
| couples prénom+nom | 30 512 | 15 566 | 15 566 |

Quarante employeurs pour trente mille personnes : les écrans du jalon 1 qui
filtrent, regroupent ou complètent automatiquement par employeur n'auraient
rien prouvé. Les noms de société et les intitulés sont désormais **composés**
(racine + qualificatif + forme ; niveau + fonction + domaine) au lieu d'être
tirés d'une liste courte.

L'homonymie des personnes, elle, reste : 15 566 couples pour 30 973 talents,
soit environ deux personnes par nom. C'est assumé — aucune contrainte d'unicité
ne porte sur un nom, rien ne joint dessus, et les bases réelles ont des
homonymes. À garder en tête si l'on veut un jour éprouver la cascade de
rapprochement, qui utilise nom + société comme clé de repli : le dev en
exagère la difficulté.

### Ce que les contrôles ont arrêté

Cinq arrêts pendant les essais, dont **trois étaient des défauts de mon propre
détecteur** — c'est la partie utile à retenir.

Deux vrais défauts : un prénom pouvait se substituer à lui-même une fois la
purge déplacée au couple ; et `sync_etat.statut` valait déjà `jamais_lance`,
parce qu'il s'agit d'une **remise à zéro** et non d'une substitution. D'où un
cinquième traitement, `REINITIALISER`, plutôt qu'une exception dans le contrôle.

Trois faux positifs : `2025-02-13` pris pour un numéro de téléphone ; le
préfixe `https://www.linkedin.com/` d'une valeur parasite, que tout substitut
LinkedIn contient forcément ; et le mot `/portfolio/` que mon URL fictive
réutilisait. Corrigés en réduisant l'aiguille à sa partie identifiante. Un
contrôle qui crie à tort cesse vite d'être cru — c'est aussi grave qu'un
contrôle muet.

### Ce qui n'est pas chargé, et pourquoi

Six tables de tenue de synchronisation — `_fk_backup`, `_sync_ecart`,
`_sync_passe`, `_sync_quarantine`, `_sync_state`, `pivot.sync_run` — sont
créées mais pas peuplées. Copiées, elles feraient croire au dev qu'une synchro
a tourné et jusqu'où. `pivot.sync_etat` est chargée mais remise à son état de
départ.

Les quatre colonnes à séquence (`pivot.email.id` et ses trois sœurs) sont
**omises** à l'insertion : la séquence du dev attribue elle-même et reste juste.
Insérer un identifiant explicite la laisserait en arrière, et la première
insertion suivante violerait la clé primaire. Rien ne référence ces
identifiants — les 8 clés étrangères de `pivot` pointent toutes sur `talent_id`.

### Le résultat, mesuré le 25/08/2026

`verifier_dev.py` pose trois questions, dans cet ordre d'importance.

**Le dev contient-il des vraies valeurs ?** 659 valeurs réelles cherchées dans
le dev — noms, courriels, téléphones, profils LinkedIn, employeurs, et **200
couples prénom+nom** — **aucune retrouvée**. Un témoin vérifie d'abord que la
recherche rend bien des lignes : sans lui, un résultat vide ne prouverait rien.

**Le dev est-il complet ?** 369 730 lignes de part et d'autre, **zéro écart**,
table par table. Aucune table peuplée en production n'est vide dans le dev, et
aucune des six tables volontairement écartées ne porte de ligne.

**Le dev est-il exploitable ?**

| | production | dev | part |
|---|---:|---:|---:|
| courriels de candidat | 6 417 | 6 437 | 100 % |
| employeurs | 14 401 | 10 452 | 73 % |
| couples prénom+nom | 30 512 | 15 566 | 51 % |
| intitulés de poste | 12 458 | 4 830 | 39 % |

### Une sonde corrigée, et pourquoi ce n'est pas un relâchement

Le premier passage de `verifier_dev.py` a signalé le prénom réel « Adrien »
présent dans le dev. La sonde testait la mauvaise chose : l'engagement du
programme porte sur le **couple**, pas sur ses moitiés. Un prénom isolé ne
désigne personne — la production en porte 6 915 pour 30 000 personnes — et
mesurer a montré qu'exiger leur absence ne laisserait que 6 prénoms utilisables
sur 119. La sonde vérifie désormais le couple, qui est l'engagement réel. Ni le
prénom ni le nom pris séparément ne sont garantis absents, et c'est écrit dans
le script.

### Où pointe quoi, après T6

| Fichier | Projet visé | Pourquoi |
|---|---|---|
| `frontend/.env.local` | **dev** | l'application locale ne doit jamais lire la production |
| `backend/api/.env` | **dev** | `SUPABASE_URL` sert à déduire le JWKS : il doit désigner le projet où le frontend authentifie |
| `.env.local` (racine) | **production** | les connecteurs alimentent la production — inchangé, et il faut qu'il le reste |
| `supabase/.temp/project-ref` | **dev** | la CLI. À vérifier avant toute commande qui écrit |

Les valeurs précédentes sont sauvegardées dans `frontend/.env.local.production.sauvegarde`
et `backend/api/.env.production.sauvegarde`, tous deux ignorés par git.

**Reste à faire, côté Vercel** : poser `NEXT_PUBLIC_SUPABASE_URL` et
`NEXT_PUBLIC_SUPABASE_ANON_KEY` du projet dev sur l'environnement *Preview*, et
**ne rien poser sur Production** tant que le jalon 1 n'a pas défini les droits —
c'est la position actuelle, et elle est volontaire : sans clé, le déploiement
public ne porte aucun accès à une base de trente mille personnes.

### Conformité complète — `verifier_dev.py --complet`, 26/08/2026

Quatre contrôles s'ajoutent aux trois de base. Résultat : **aucun problème**.

**Les 52 liens que la base ne contrôle pas.** Beaucoup de colonnes `*_id`
n'ont aucune contrainte de clé étrangère — `note.candidat_id`,
`experience.candidat_id`, `mandatclose.mandat_id`, `tag.entreprise_id`… Un
chargement dans le mauvais ordre les aurait cassés **sans que PostgreSQL
bronche**. Vérifié un par un : le dev porte exactement les mêmes orphelins que
la production, aucun écart. C'est le seul contrôle qui pouvait l'établir.

**La nullité est préservée.** Un `cv_url` absent est une information — c'est ce
que compte `qa_completude`. Les cinq écarts observés sont tous inférieurs à la
dérive de leur table.

**L'ordre des fourchettes tient.** La mise en tranches arrondit vers le bas les
deux bornes, elle ne peut donc qu'améliorer l'ordre, jamais le casser — et c'est
ce qu'on observe : 10 fourchettes inversées dans le dev contre 12 en production,
14 contre 15, 17 contre 19.

**Les 7 vues du pivot répondent**, avec des comptes cohérents :
`talent_recherche` 30 973, `qa_sans_contact` 7 013, `qa_completude` 1.

### La dérive, et pourquoi ce n'est pas une casse

Au 26/08, la production porte **369 888 lignes contre 369 730** dans le dev :
158 lignes d'écart sur 25 tables, toutes dans le même sens. La synchro n8n écrit
toutes les 15 minutes ; le dev est un instantané.

Le vérificateur **mesure cette dérive et s'en sert comme tolérance** au lieu de
signaler chaque écart. Il échoue en revanche sur ce que la dérive ne peut pas
expliquer : une table peuplée en production et vide dans le dev, ou un dev
portant **plus** de lignes que la production.

### Deux pièges rencontrés en écrivant ces contrôles

**PostgREST ne compare pas deux colonnes entre elles.** Un filtre
`salaire_min=gt.salaire_max` attend une valeur littérale, pas un nom de
colonne : il rend 400. Les deux colonnes sont lues et comparées en mémoire.

**Une empreinte de clé trop courte donne des faux positifs.** Chercher une clé
API par ses 24 premiers caractères revient à chercher l'en-tête d'un JWT, qui
est identique pour toutes les clés Supabase — et pour les exemples de la
documentation de `pyjwt`. La recherche se fait par la **signature**, en fin de
jeton. Refaite ainsi : la clé de production n'a jamais été committée, et ne
vit sur le disque que dans trois fichiers ignorés par git.

### Rejouer le chargement

Il n'y a pas de reprise : le chargeur refuse d'écrire dans une table déjà
peuplée plutôt que d'y ajouter des doublons. Pour repartir de zéro, la CLI
étant rattachée au **dev** :

```
supabase db reset --linked --no-seed --yes
```

⚠️ Vérifier `supabase/.temp/project-ref` avant. Cette commande détruit la base
du projet rattaché.

## Basculer d'une base à l'autre

Un seul endroit porte les accès aux deux projets : **`env/projets.env`**, ignoré
par git. Aucun composant ne le lit : `outils/cible.py` en dérive la
configuration de chacun. C'est ce qui garantit qu'il n'existe qu'un endroit où
ces valeurs vivent.

```
npm run cible          # sur quoi chaque morceau est branché, et les contrôles
npm run cible:dev      # brancher l'application sur le dev
npm run cible:live     # refuse sans --je-sais-ce-que-je-fais
```

L'outil existe surtout pour la **première** commande. Le risque n'est pas de ne
pas pouvoir basculer : c'est de basculer sans le savoir, ou de croire qu'on lit
le dev en écrivant dans la production.

### Ce qu'il vérifie

**Le frontend et l'API visent le même projet.** Sinon le JWKS ne correspond pas
et aucun jeton n'est validé — une panne qui se diagnostique mal, parce que rien
n'indique que le problème est une adresse.

**Les connecteurs visent la production.** Ils l'alimentent ; les faire pointer
ailleurs priverait le pivot de sa source. `.env.local` à la racine n'est jamais
modifié par l'outil.

**Les deux bases répondent**, en REST *et* en authentification. Vérifier REST ne
dit rien de l'authentification, qui est aujourd'hui le seul usage du client
Supabase par le frontend.

Les fichiers portent en première ligne `# CIBLE = dev (xavnvk…)` : la cible se
lit sans exécuter quoi que ce soit.

### Ce que l'outil a trouvé

La production accepte **email et Google**, le dev seulement **email**. Sans
effet aujourd'hui — l'application ne contient aucun appel `signIn` — mais à
régler au jalon 2 si la connexion Google est retenue.

### Deux limites à connaître

**Next.js incorpore les `NEXT_PUBLIC_*` à la compilation.** Basculer n'a aucun
effet sur un serveur déjà démarré : il faut relancer `npm run dev`, ou
reconstruire. L'outil le rappelle à chaque bascule.

**`npm run verifier` s'arrête sur `api:lint`**, à cause de 175 erreurs mypy dans
les connecteurs, antérieures à ces travaux. Voir `PHASE1_RESTE_A_FAIRE.md`.

## Les contraintes du plan gratuit Supabase

- **2 projets actifs** par personne, pas par organisation. Le compte est agrégé
  sur toutes les organisations où l'on est Owner ou Admin.
- **500 Mo** de base, 1 Go de fichiers, 5 Go d'egress.
- **Mise en pause après une semaine sans activité**, réveil en un clic pendant
  un an. C'est le principal inconvénient pour un environnement de dev utilisé
  par intermittence.
- Le **Branching** Supabase — des environnements éphémères par pull request —
  demande le plan Pro. Il ne copie d'ailleurs aucune donnée de production,
  délibérément.

## Ce que devient le clonage de schémas

`backend/database/test/` ne disparaît pas, il change d'usage : c'est l'outil
pour **éprouver une migration contre les vraies données**, dans le projet live,
avant de l'appliquer. Ce n'est pas un environnement de développement, et le
README de ce dossier le dit maintenant.
