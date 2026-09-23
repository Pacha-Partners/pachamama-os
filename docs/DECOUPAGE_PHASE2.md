# Découpage des jalons de développement

Le jalon est la seule maille du projet. Il porte un état, et il est validé quand
deux grilles passent : la grille technique et la grille produit.

## Règle d'ordonnancement

Chaque jalon ouvre un seul type d'accès aux données :

1. lecture publique, sans authentification ;
2. authentification et résolution du rôle ;
3. lecture avec isolation entre clients ;
4. lecture et première écriture sur les données d'un seul compte ;
5. lecture du vivier, hors du chemin des portails ;
6. lecture des données internes ;
7. écriture des données internes ;
8. gouvernance et administration des comptes.

Le portail entreprise passe avant l'espace talent : l'isolation entre comptes est
éprouvée sur la surface où une erreur montre les données d'un autre client plutôt
qu'un écran vide. Les deux contrôles qui la couvrent — extraction automatique de
la liste des colonnes accessibles, et test sur deux comptes clients distincts —
sont bloquants avant l'ouverture du moindre compte client réel.

`J5` lit `pivot` et `public.mandat`, tous deux vivants en production. Il ne
dépend d'aucun jalon de portail et n'engage aucun geste irréversible.

## Les huit jalons

| | jalon | résultat visible | état |
|---|---|---|---|
| **J1** | Job Board public sur données réelles | Le job board affiche les mandats publiables, sans nom de client sur une offre anonyme | en cours de développement |
| **J2** | Authentification et rattachement des comptes | Trois comptes se connectent et arrivent chacun sur sa vue | en cours de développement |
| **J3** | Portail Entreprise | Un client suit ses mandats et ses candidats sans accéder à aucune identité, et enregistre sa décision | en cours de développement |
| **J4** | Espace Talent | Un talent voit son profil, ses attentes et ses candidatures, et modifie ses attentes | en cours de développement |
| **J5** | Le Chasseur de Talent | Un mandat sans candidature reçoit une liste ordonnée de profils, avec la raison de chaque rapprochement ; le recruteur retient ou écarte | prévu |
| **J6** | Poste recruteur : consultation | La page vide devient un écran de priorisation, un kanban réel et une fiche talent complète | prévu |
| **J7** | Poste recruteur : actions | Un recruteur ajoute une note, avance une candidature, coche une tâche — et l'ATS le reflète | prévu |
| **J8** | Back-office de gouvernance | Les instruments de surveillance deviennent des écrans consultés, avec des alertes sur seuils ; un administrateur rattache, promeut et désactive un compte | prévu |

`J1` à `J4` portent du code écrit. Aucun de leurs 29 critères d'acceptation n'a
été confronté au code, et aucune grille n'a été passée.

Les tickets détaillés sont dans `docs/tickets/`, un fichier par jalon.

## Les huit états

`prévu` · `en maquette` · `maquette validée` · `en cours de développement` ·
`prêt pour le test` · `en test` · `recette` · `validé`

On entre en `prêt pour le test` quand la grille technique passe. On est `validé`
quand la boucle test ⇄ recette est terminée et que les deux grilles passent.

Le détail des transitions est dans `JALONS.md`.

## Les deux grilles

**Grille technique** — huit points mesurables par une commande : critères
d'acceptation confrontés au code, harnais du jalon au vert, aucune régression sur
les jalons précédents, tests unitaires, schéma rejouable depuis une base vierge,
cloisonnement mesuré avec un vrai jeton, écran sans erreur et vérifié à 375 px,
aucun secret ni donnée nominative commitée.

**Grille produit** — à cadrer avec le PM.

### Le contrôle d'isolation

Un test automatique compare le résultat obtenu avec le jeton de l'utilisateur au
résultat obtenu avec la clé de service. Tout écart fait échouer le test.

Avec la clé publique `anon`, `public.mandat` et `public.candidat` renvoient un
code 200 et un tableau vide, pas une erreur. Une politique de sécurité manquante
produit donc le même résultat qu'une base vide — c'est la forme qu'ont prise les
six incidents de perte de données de ce projet. Le test vérifie aussi que le
nombre de lignes attendu est différent de zéro, sinon il passerait au vert alors
que la base est injoignable.

## Décisions d'architecture

**Les lectures passent en direct par Supabase, les écritures par l'API FastAPI.**
Aucune des deux ne touche les tables de base : les deux passent par un schéma
`api` composé de vues qui listent explicitement les colonnes exposées. C'est le
seul schéma accordé aux rôles `anon` et `authenticated`. La RLS filtre des
lignes ; l'anonymat des candidats et la non-exposition des jugements internes
sont des problèmes de colonnes.

`J5` fait exception : le schéma `api` n'est pas déployé en production, et le
Chasseur lit `pivot`, qui y est vivant. Il passe par une route FastAPI en
lecture. Il se rebranchera sur `api` le jour où celui-ci sera déployé.

**Le rattachement compte ↔ données métier est stocké dans `api.compte`**, propriété
de l'application. Pas dans `public.user.auth_id` : cette colonne est vide sur
4 596 lignes sur 4 596, et le sync réécrit cette table en continu.

**Le référentiel des étapes est `ref.etape_process`** : 14 étapes, toutes actives,
avec leur ordre, leur caractère terminal et leur appartenance aux KO. Il se
rapproche du miroir par `p.etape = coalesce(r.emoji||' ','')||r.libelle_interne`,
qui couvre 7 623 candidatures sur 7 653 sans un seul non-apparié. La table
correspondante du miroir n'est pas utilisée : ses 70 lignes portent une chaîne
JSON découpée caractère par caractère, et `is_public` y est vraie sur 0 ligne.

**19 offres sont publiables**, sur le critère `visibilite='public' AND
statut='En cours' AND NOT job_off_market`.

**Le champ `titre` d'un mandat n'est jamais publié.** Les 20 mandats publics et
ouverts sont marqués `job_anonyme = true`, et les 20 contiennent le nom du client
dans leur titre. Le problème est dans le contenu du champ, aucune politique de
sécurité ne le corrige. Le libellé public est calculé à partir de `metier` et
`univers`.

**`avisCabinet` est retiré du contrat de données client, et aucune note n'est
exposée au client.** La table `public.note` ne comporte aucune colonne de
visibilité.

**L'écriture côté recruteur arrive après la vérification de la lecture.** L'ATS
reste la seule source d'écriture jusqu'au `J7`. Deux exceptions : au `J4` un
talent modifie ses propres attentes ; au `J5` le Chasseur écrit qu'un profil a
été retenu ou écarté, et marque l'origine « chasseur » de la candidature créée.

## Ce que la donnée permet

**Le vivier.** `pivot.talent` porte 31 222 talents. 6 147 portent une ligne
d'attentes, 3 387 le socle complet métier + localisation + prétention. Les
profils venus de l'ATS n'ont ni attente, ni qualification, ni prétention ;
2 373 talents portent à la fois le récit et les attentes.

**Le rapprochement du `J5` se fait sur le texte** — `headline`, `experience`,
`localisation`, remplis à 76–97 % — et non sur la taxonomie, remplie à 7–19 %.

**L'ordre du `J5`.** 31 des 66 mandats ouverts ne portent aucune candidature,
dont 21 depuis plus de trente jours. Sur 346 mandats fermés en 24 mois, un mandat
servi dans les trente jours aboutit à 50,2 %, un mandat jamais servi à 4,2 %.

**Le connecteur ATS n'a jamais tourné en production** : `runs_total = 0`. Les
profils d'origine ATS sont un instantané figé. Le connecteur `app` tourne toutes
les quinze minutes.

**`pivot.note_journal` est un journal d'événements** : 34 810 des 37 068 lignes
sont automatiques. L'écran du `J6` s'intitule « historique ».

**Le déploiement ne contient aucune clé Supabase.** Le premier branchement est
l'opération qui place la clé publique dans un navigateur.

**Aucun des 7 comptes existants ne porte de rôle** dans `app_metadata` :
`rolesDe()` renvoie une liste vide pour tous.

## Hors périmètre

Le matching sémantique vectoriel · le sourcing externe LinkedIn et web · le
connecteur ATS → pivot · la réparation de fond du sync et la purge des fantômes,
que le `J8` rend seulement visibles · le cycle commercial en écriture (mandat en
self-service, signature électronique, facturation, commissions) · la parité
fonctionnelle avec l'ATS · la matrice de rôles éditable ·
internationalisation, PWA, notifications temps réel · l'analytique client.

Écartées faute de données : le mode « ouvert aux opportunités » côté talent, et
les notes partagées avec le client.

## Décisions qui vous appartiennent

- **La grille produit**, à cadrer avec le PM. `JALONS.md` §4 pose les six
  questions de la séance.
- **Le questionnaire de sourcing** (`QUESTIONNAIRE_SOURCING.md`), à envoyer aux
  quatre recruteurs qui portent la moitié des mandats. Préalable produit du `J5`.
- **Le cadrage RGPD**, qui vise les profils issus du seul ATS : aucun ne porte de
  consentement enregistré.
- **Révoquer ou supprimer les fonctions RPC** `truncate_data_tables`,
  `disable_fk`, `enable_fk` et `rls_auto_enable`. `replace_m2m`,
  `claim_next_sync_type` et `finish_sync_type` servent au sync.
- **La rotation de la clé de service**, qui a circulé dans les scripts de
  migration. À décider avec la révocation.
- **L'accord des clients** dont les mandats seraient publiés.
- **Le client pilote du `J3`** — le plus important porte 84 candidatures en cours.
- **Le retrait de `avisCabinet`**, engagement commercial.
- **Ce qui doit être démontrable pour la soutenance**, et à quelle date.
