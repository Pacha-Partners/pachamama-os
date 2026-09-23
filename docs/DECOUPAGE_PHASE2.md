# Découpage des jalons de développement

> Produit le 21/08/2026 à partir de quatre découpages indépendants (valeur
> métier, dépendances techniques, démontrabilité, risque), confrontés et
> arbitrés par la mesure en production.
>
> **Refondu le 23/09/2026** : les phases de test sont abandonnées, `J5` « Le
> Chasseur de Talent » est intercalé, et un jalon porte désormais un **état**.
> Les chiffres marqués *(23/09)* ont été remesurés ce jour-là.

## Règle d'ordonnancement

Chaque jalon ouvre **un seul type d'accès aux données** :

1. lecture publique, sans authentification ;
2. authentification, résolution du rôle ;
3. lecture avec isolation entre clients (portail entreprise) ;
4. lecture et première écriture sur les données d'un seul compte (espace talent) ;
5. **lecture du vivier, hors du chemin des portails** (le Chasseur) ;
6. lecture des données internes (poste recruteur) ;
7. écriture des données internes ;
8. gouvernance : rendre visibles les instruments de surveillance, et administrer
   les comptes.

**Décision d'ordre prise le 24/08 : le portail entreprise passe avant l'espace
talent.** Conséquence assumée : l'isolation entre comptes est éprouvée d'emblée
sur la surface la plus risquée, celle où une erreur montre les données d'un autre
client plutôt qu'un écran vide. En compensation, les deux contrôles qui la
couvrent — extraction automatique de la liste des colonnes accessibles, et test
sur deux comptes clients distincts — deviennent **bloquants avant l'ouverture du
moindre compte client réel**.

**Décision du 23/09 : `J5`, le Chasseur, s'intercale après l'espace talent.** Il
rompt la progression par type d'accès, et c'est délibéré : il ne lit ni `core` ni
le schéma `api`, mais `pivot` et `public.mandat`, tous deux vivants en
production. Il n'engage donc **aucun geste irréversible** et ne dépend d'aucun
des jalons de portail. Ce qui le fait passer devant `J6` est mesuré : **31 des
66 mandats ouverts ne portent aucune candidature** *(23/09)*, et sur 346 mandats
fermés en 24 mois, un mandat servi dans les trente jours aboutit à **50,2 %**
contre **4,2 %** pour un mandat jamais servi.

**Décision du 23/09 : l'administration des comptes quitte `J2` pour `J8`.** Elle
exigeait un écran de back-office, ce qui faisait dépendre le premier jalon
authentifié du dernier. En attendant, les comptes se rattachent en SQL.

## Quand un jalon est terminé

**Deux grilles, et il faut les deux.** Le détail est dans `JALONS.md`.

**La grille technique** — huit points mesurables par une commande : critères
d'acceptation confrontés au code, harnais du jalon au vert, aucune régression sur
les précédents, tests unitaires, schéma rejouable depuis une base vierge,
cloisonnement mesuré avec un vrai jeton, écran sans erreur et vérifié à 375 px,
aucun secret ni donnée nominative commitée.

**La grille produit** — à cadrer avec le PM. Elle porte sur ce que la technique
ne sait pas mesurer.

### Le contrôle qui ne se négocie pas

Un test automatique compare le résultat obtenu **avec le jeton de l'utilisateur**
au résultat obtenu avec la clé de service. Tout écart fait échouer le test.

**Pourquoi il est obligatoire.** Mesuré : avec la clé publique `anon`,
`public.mandat` et `public.candidat` renvoient un code 200 et un tableau vide —
pas une erreur. **Une politique de sécurité manquante produit donc exactement le
même résultat qu'une base vide.** C'est la forme qu'ont prise les six incidents de
perte de données de ce projet. Le test doit aussi vérifier que le nombre de
lignes attendu est **différent de zéro**, sinon il passerait au vert alors que la
base est injoignable.

## Les huit jalons

| | jalon | résultat visible | état *(23/09)* |
|---|---|---|---|
| **J1** | Job Board public sur données réelles | Le job board affiche les mandats publiables, sans nom de client sur une offre anonyme | en cours de développement |
| **J2** | Authentification et rattachement des comptes | Trois comptes se connectent et arrivent chacun sur sa vue | en cours de développement |
| **J3** | Portail Entreprise | Un client suit ses mandats et ses candidats sans accéder à aucune identité, et enregistre sa décision | en cours de développement |
| **J4** | Espace Talent | Un talent voit son profil, ses attentes et ses candidatures, et modifie ses attentes | en cours de développement |
| **J5** | **Le Chasseur de Talent** | Un mandat sans candidature reçoit une liste ordonnée de profils, avec la raison de chaque rapprochement, et le recruteur retient ou écarte | **prévu** |
| **J6** | Poste recruteur : consultation | La page vide devient un écran de priorisation, un kanban réel et une fiche talent complète | prévu |
| **J7** | Poste recruteur : actions | Un recruteur ajoute une note, avance une candidature, coche une tâche — et l'ATS le reflète | prévu |
| **J8** | Back-office de gouvernance | Les instruments de surveillance deviennent des écrans consultés, avec des alertes sur seuils, et un administrateur rattache, promeut et désactive un compte | prévu |

⚠ **Aucun jalon n'est validé.** `J1` à `J4` portent du code écrit, mais aucun de
leurs 29 critères d'acceptation n'a été confronté au code et aucune grille n'a
été passée.

Les huit états — `prévu`, `en maquette`, `maquette validée`, `en cours de
développement`, `prêt pour le test`, `en test`, `recette`, `validé` — sont
définis dans `JALONS.md`.

Les tickets détaillés sont dans `docs/tickets/`, un fichier par jalon.

## Décisions d'architecture tranchées

**Les lectures passent en direct par Supabase, les écritures par l'API FastAPI.**
Mais aucune des deux ne touche les tables de base : les deux passent par un
schéma `api` composé de vues qui listent explicitement les colonnes exposées.
C'est le seul schéma accordé aux rôles `anon` et `authenticated`.

La raison est précise : la sécurité au niveau ligne (RLS) filtre des **lignes**,
alors que l'anonymat des candidats côté client et la non-exposition des jugements
internes sont des problèmes de **colonnes**. Une vue à colonnes listées règle ce
que la RLS ne peut pas régler.

⚠ **`J5` déroge à cette règle, et c'est assumé.** Le schéma `api` n'existe pas en
production — il n'y est pas déployé — et le Chasseur lit `pivot`, qui y est
vivant. Il passe donc par une route FastAPI en lecture, sans vue `api`. Le jour
où le schéma `api` sera déployé, la route se rebranchera dessus.

**Le rattachement entre un compte authentifié et ses données métier est stocké
dans une table `api.compte`, propriété de l'application.** Pas dans
`public.user.auth_id` : cette colonne est vide sur 4 596 lignes sur 4 596, et le
sync réécrit cette table en continu. Une règle de sécurité stockée dans une table
réécrite par un traitement automatique peut disparaître sans que rien ne le
signale.

**Le référentiel des étapes a été reconstruit, et il est sain.** La table du
miroir contenait 70 lignes dont la colonne `value` valait `{`, `"`, `d`, `i`,
`s`… — une chaîne JSON découpée caractère par caractère au chargement, avec
`is_public` vraie sur **0 ligne**. Le référentiel reconstruit, `ref.etape_process`,
porte **14 étapes, toutes actives** *(23/09)*, avec leur ordre, leur caractère
terminal et leur appartenance aux KO. Il se rapproche du miroir par
`p.etape = coalesce(r.emoji||' ','')||r.libelle_interne`, qui couvre **7 623
candidatures sur 7 653, sans un seul non-apparié** *(23/09)*. C'est lui qui rend
tout indicateur de flux calculable.

**19 offres publiables** *(23/09, contre 12 le 21/08)*, sur le critère
`visibilite='public' AND statut='En cours' AND NOT job_off_market`. Publier tous
les mandats marqués `public` mettrait des postes déjà pourvus sur la seule page
indexée par les moteurs de recherche.

**Le champ `titre` d'un mandat ne doit jamais être publié.** *(23/09)* : les
**20** mandats publics et ouverts sont **tous** marqués `job_anonyme = true`, et
**les 20 contiennent le nom du client dans leur titre** — la proportion n'a pas
bougé, le volume a augmenté. Aucune politique de sécurité ne corrige cela,
puisque le problème est dans le contenu du champ. Le libellé public doit être
calculé à partir de `metier` et `univers`.

**Le champ `avisCabinet` est retiré du contrat de données client**, et **aucune
note n'est exposée au client**. La table `public.note` ne comporte aucune colonne
de visibilité : la fonctionnalité « notes partagées avec le client » prévue au
cadrage n'a pas de support en base.

**L'écriture côté recruteur n'arrive qu'après que la lecture a été vérifiée.**
L'ATS reste la seule source d'écriture jusqu'au `J7`, où l'app se limite à trois
opérations. Deux exceptions : au `J4`, un talent modifie ses propres attentes ;
au `J5`, le Chasseur écrit le fait qu'un profil a été retenu ou écarté, et
l'origine « chasseur » de la candidature créée — sans ce marquage, l'apport du
module serait non mesurable.

## Ce que la mesure a corrigé

**Le pivot ne permet pas de filtrer sur quatre fois plus de profils que l'ATS.**
Deux des quatre découpages avaient construit leur argumentaire sur ce chiffre.
Remesuré le 23/09 : le pivot porte **31 222 talents**, mais seuls **6 147**
portent une ligne d'attentes, et **3 387 (10,8 %)** portent le socle complet
métier + localisation + prétention. Les profils venus de l'ATS n'ont **aucune**
attente, aucune qualification, aucune prétention. La base est faite de deux
moitiés disjointes : l'ATS apporte le récit sans les attentes, l'app apporte les
attentes sans le récit, et **2 373 talents seulement portent les deux**.

**Conséquence directe sur `J5`** : le rapprochement se fait sur le **texte**
— `headline`, `experience`, `localisation`, remplis à 76–97 % — et non sur la
taxonomie, remplie à 7–19 %. Un filtre structuré rejetterait 80 % du vivier.

**Le connecteur ATS n'a jamais tourné en production** : `pivot.sync_etat` donne
`statut = jamais_lance`, `runs_total = 0`. Les profils d'origine ATS sont un
instantané figé d'août. Le connecteur `app`, lui, tourne toutes les quinze
minutes, sans erreur.

**`pivot.note_journal` est un journal d'événements, pas un recueil de
commentaires.** 34 810 des 37 068 lignes sont automatiques, soit 2 258 notes
rédigées par un humain. L'écran garde sa place au `J6`, mais il s'intitule
« historique ».

**Le déploiement actuel ne contient aucune clé Supabase.** Le premier branchement
est donc précisément l'opération qui place la clé publique dans un navigateur —
d'où l'ordre du `J1`.

**Aucun des 7 comptes existants ne porte de rôle** dans `app_metadata` : la
fonction `rolesDe()` renvoie une liste vide pour tous, et l'orientation par rôle
ne fonctionne pas.

## Hors périmètre, explicitement

Le **matching sémantique vectoriel** — `pgvector` n'est pas installé, et avec
66 mandats actifs et ~24 nouveaux par mois, un traitement à la demande de
quelques secondes couvre le besoin ; le **sourcing externe** (LinkedIn, web),
bloqué juridiquement avant de l'être techniquement ; le **connecteur ATS →
pivot**, bloqué sur un accès externe ; la réparation de fond du sync et la purge
des fantômes (le `J8` les rend seulement visibles) ; le cycle commercial en
écriture (création de mandat en self-service, signature électronique,
facturation, commissions) ; la parité fonctionnelle avec l'ATS ; la matrice de
rôles éditable ; internationalisation, PWA, notifications temps réel ;
l'analytique client.

⚠ **Le Chasseur de Talent n'est plus hors périmètre** : il est `J5`.

Deux fonctionnalités restent écartées faute de données, non par priorité : le
mode « ouvert aux opportunités » côté talent, et les notes partagées avec le
client.

## Décisions qui vous appartiennent

- **La grille produit**, à cadrer avec le PM. `JALONS.md` §4 pose les six
  questions auxquelles la séance doit répondre.
- **Le questionnaire de sourcing** (`QUESTIONNAIRE_SOURCING.md`), à envoyer aux
  quatre recruteurs qui portent la moitié des mandats. C'est le préalable produit
  de `J5`.
- **Le cadrage RGPD.** Il vise exactement la population qui fait la valeur du
  Chasseur : les profils issus du seul ATS, sans relation avec le cabinet, dont
  **aucun ne porte de consentement enregistré**.
- **Révoquer ou supprimer les fonctions RPC.** `truncate_data_tables`,
  `disable_fk`, `enable_fk` et `rls_auto_enable` n'ont plus d'usage dans un
  produit en service. En revanche `replace_m2m`, `claim_next_sync_type` et
  `finish_sync_type` servent au sync.
- **La rotation de la clé de service**, qui a circulé dans les scripts de
  migration. À décider avec la révocation, pas après.
- **L'accord des clients** dont les mandats seraient publiés.
- **Le client pilote du `J3`** — le plus important porte 84 candidatures en cours.
- **Le retrait de `avisCabinet`** : techniquement tranché, mais c'est un
  engagement commercial.
- **Ce qui doit être démontrable pour la soutenance**, et à quelle date.
