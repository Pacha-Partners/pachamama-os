# Découpage de la Phase 2 — l'application

> **L'état des sept jalons n'est pas ici** — ce document les définit, `JALONS.md`
> dit lesquels sont construits et quelle phase chacun ouvre.


> Produit le 24/08/2026 à partir de quatre découpages indépendants (valeur métier,
> dépendances techniques, démontrabilité, risque), confrontés et arbitrés par la
> mesure en production. Chaque chiffre de ce document a été vérifié, pas supposé.

## Règle d'ordonnancement

Chaque jalon ouvre **un seul type d'accès aux données** :

1. lecture publique, sans authentification ;
2. authentification, résolution du rôle et administration des comptes ;
3. lecture avec isolation entre clients (portail entreprise) ;
4. lecture et première écriture sur les données d'un seul compte (espace talent) ;
5. lecture des données internes (poste recruteur) ;
6. écriture des données internes ;
7. gouvernance : rendre visibles les instruments de surveillance existants.

**Décision d'ordre prise le 24/08 : le portail entreprise passe avant l'espace talent.**
Conséquence assumée : l'isolation entre comptes est éprouvée d'emblée sur la surface
la plus risquée, celle où une erreur montre les données d'un autre client plutôt qu'un
écran vide. En compensation, les deux contrôles qui la couvrent — extraction
automatique de la liste des colonnes accessibles, et test sur deux comptes clients
distincts — deviennent **bloquants avant l'ouverture du moindre compte client réel**.

Un jalon est terminé quand deux conditions sont remplies : un écran affiche des
données de production, **et** un test automatique compare le résultat obtenu avec le
jeton de l'utilisateur au résultat obtenu avec la clé de service. Tout écart fait
échouer le test.

**Pourquoi ce test est obligatoire.** Mesuré : avec la clé publique `anon`,
`public.mandat` et `public.candidat` renvoient un code 200 et un tableau vide — pas
une erreur. Une politique de sécurité manquante produit donc exactement le même
résultat qu'une base vide. C'est la forme qu'ont prise les six incidents de perte de
données de ce projet. Le test doit aussi vérifier que le nombre de lignes attendu est
**différent de zéro**, sinon il passerait au vert alors que la base est injoignable.

## Les sept jalons

| | Jalon | Résultat visible | Effort |
|---|---|---|---|
| **J1** | Job Board public sur données réelles | Le job board affiche 12 vrais mandats, sans nom de client sur une offre anonyme | moyen |
| **J2** | Authentification, rôles et rattachement des comptes | Trois comptes se connectent et arrivent chacun sur sa vue *(l'administration des comptes depuis le back-office est partie dans J7 le 22/09)* | moyen |
| **J3** | Portail Entreprise | Un client suit ses mandats et ses candidats sans accéder à aucune identité, et enregistre sa décision | long |
| **J4** | Espace Talent | Un talent voit son profil, ses attentes et ses candidatures, et modifie ses attentes | moyen |
| **J5** | Poste Recruteur : consultation | La page vide devient un écran de priorisation, un kanban réel et une fiche talent complète | long |
| **J6** | Poste Recruteur : actions, et préparation du Chasseur | Un recruteur ajoute une note, avance une candidature, coche une tâche — et l'ATS le reflète | long |
| **J7** | Back-office de gouvernance | Les instruments de surveillance deviennent des écrans consultés, avec des alertes sur seuils | long |

Les tickets détaillés, au format Notion, sont dans [`docs/tickets/`](tickets/) — un fichier par jalon.

## Décisions d'architecture tranchées

**Les lectures passent en direct par Supabase, les écritures par l'API FastAPI.**
Mais aucune des deux ne touche les tables de base : les deux passent par un schéma
`api` composé de vues qui listent explicitement les colonnes exposées. C'est le seul
schéma accordé aux rôles `anon` et `authenticated`.

La raison est précise : la sécurité au niveau ligne (RLS) filtre des **lignes**,
alors que l'anonymat des candidats côté client et la non-exposition des jugements
internes sont des problèmes de **colonnes**. Une vue à colonnes listées règle ce que
la RLS ne peut pas régler.

**Le rattachement entre un compte authentifié et ses données métier est stocké dans
une table `api.compte`, propriété de l'application.** Pas dans `public.user.auth_id` :
cette colonne est vide sur 4 596 lignes sur 4 596, et le sync réécrit cette table en
continu. Une règle de sécurité stockée dans une table réécrite par un traitement
automatique peut disparaître sans que rien ne le signale.

**On n'utilise pas la table `ref_process_etape`.** Mesuré : elle contient 70 lignes
dont la colonne `value` vaut `{`, `"`, `d`, `i`, `s`, `p`, `l`, `a`, `y` — une chaîne
JSON découpée caractère par caractère lors du chargement. La colonne `is_public` est
vraie sur **0 ligne**. Or c'est cette table qui est censée déterminer quelles étapes
de recrutement un client a le droit de voir. On reconstruit le référentiel à partir
des 15 valeurs réellement présentes dans `process.etape`, avec une liste explicite
des étapes visibles par un client.

**12 offres publiables**, sur le critère `visibilite='public' AND statut='En cours'
AND NOT job_off_market`. Mesuré : 34 mandats sont marqués `public`, mais 11 ont le
statut `Terminé` et 10 `Closé`. Les publier tous mettrait 21 postes déjà pourvus sur
la seule page indexée par les moteurs de recherche.

**Le champ `titre` d'un mandat ne doit jamais être publié.** Les 13 mandats publics
et ouverts sont tous marqués `job_anonyme = true`, et les 13 contiennent le nom du
client dans leur titre : « Advanthink - Product Marketing Manager », « SOGELINK -
Head of Product ». Aucune politique de sécurité ne corrige cela, puisque le problème
est dans le contenu du champ. Le libellé public doit être calculé à partir de
`metier` et `univers`.

**Le champ `avisCabinet` est retiré du contrat de données client**, et **aucune note
n'est exposée au client**. La table `public.note` ne comporte aucune colonne de
visibilité : la fonctionnalité « notes partagées avec le client » prévue au cadrage
n'a pas de support en base.

**L'écriture côté recruteur n'arrive qu'après que la lecture a été vérifiée.** L'ATS
reste la seule source d'écriture jusqu'au J6, où l'app se limite à trois opérations.
Seule exception, au J3 : un talent modifie ses propres attentes — une seule ligne
concernée, annulation simple.

## Ce que la mesure a corrigé

**Le pivot ne permet pas de filtrer sur quatre fois plus de profils que l'ATS.**
Les tables `pivot.attentes` (5 852 lignes) et `pivot.qualification` (6 615) ne
concernent que les talents venus de l'app : **aucune** ligne pour les 24 345 talents
venus de Jarvi. Un filtre sur univers et salaire donne donc **moins** de résultats
que les 7 016 profils de l'ATS. Deux des quatre découpages avaient construit leur
argumentaire sur ce chiffre. Tant que le connecteur Jarvi ne fonctionne pas, le J6
reste limité à environ 5 850 profils filtrables.

**`pivot.note_journal` est un journal d'événements, pas un recueil de commentaires.**
34 810 des 37 068 lignes sont automatiques, soit 2 258 notes rédigées par un humain.
L'écran garde sa place au J5, mais il s'intitule « historique ».

**Le déploiement actuel ne contient aucune clé Supabase.** `/offres` et `/talent`
renvoient une redirection 307 vers `/`. Le premier branchement est donc précisément
l'opération qui place la clé publique dans un navigateur — d'où l'ordre du J1.

**Aucun des 7 comptes existants ne porte de rôle** dans `app_metadata` : la fonction
`rolesDe()` renvoie une liste vide pour tous, et l'orientation par rôle ne fonctionne
pas. Les 3 comptes de démonstration n'existent pas.

## Hors périmètre, explicitement

Le Chasseur de Talents et tout le matching sémantique (Phase 3) · le connecteur
Jarvi → pivot (Phase 1, bloqué sur un accès externe) · la réparation de fond du sync
et la purge des fantômes (Phase 1 ; le J7 les rend seulement visibles) · le cycle
commercial en écriture (création de mandat en self-service, signature électronique,
facturation, commissions) · la parité fonctionnelle avec l'ATS · la matrice de rôles
éditable et les indicateurs de fonctionnement · internationalisation, PWA,
notifications temps réel · l'analytique client.

Deux fonctionnalités sont écartées faute de données, non par priorité : le mode
« ouvert aux opportunités » côté talent, et les notes partagées avec le client.

## Décisions qui vous appartiennent

- **Révoquer ou supprimer les fonctions RPC.** `truncate_data_tables`, `disable_fk`,
  `enable_fk` et `rls_auto_enable` n'ont plus d'usage dans un produit en service.
  En revanche `replace_m2m`, `claim_next_sync_type` et `finish_sync_type` servent au sync.
- **La rotation de la clé de service**, qui a circulé dans les scripts de migration.
  À décider avec la révocation, pas après.
- **L'accord des 12 clients** dont les mandats seraient publiés.
- **Le client pilote du J4** — le plus important porte 84 candidatures en cours.
- **Le retrait de `avisCabinet`** : techniquement tranché, mais c'est un engagement
  commercial.
- **Ce qui doit être démontrable pour la soutenance**, et à quelle date. Les jalons
  1 à 3 constituent déjà une démonstration complète.
