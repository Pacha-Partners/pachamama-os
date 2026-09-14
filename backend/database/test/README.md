# Base de test — `public_test` et `pivot_test`

> **À quoi sert ce dossier, depuis le 25/08/2026.**
> Ce n'est pas l'environnement de développement. Celui-ci est un **second
> projet Supabase** — voir `docs/ENVIRONNEMENT_DEV.md`. Deux schémas dans le
> même projet partagent l'URL, les clés, `auth.users` et le disque : ils ne
> séparent pas le dev du live.
>
> Ce que cet outillage sert désormais : **éprouver une migration ou une policy
> contre les vraies données de production**, dans le projet live, avant de
> l'appliquer. C'est un besoin réel et distinct, que l'environnement de dev —
> peuplé de données anonymisées — ne couvre pas.

Deux schémas de test, copies de `public` et de `pivot`, **dans la même base
Supabase**. Ils servent de terrain pour la Phase 2 : on y écrit les droits
d'accès et les policies RLS de chaque jalon avant de les appliquer en
production.

## Pourquoi des schémas et pas un second projet Supabase

`pg_dump` et la CLI Supabase ne sont pas installés sur cette machine, et le
seul accès disponible est PostgREST. Recopier 415 000 lignes vers un autre
projet passerait par l'API, table par table, sans emporter ni les index, ni
les contraintes, ni la RLS. Un clonage intra-base fait tout cela en une
transaction et en quelques dizaines de secondes.

**Ce que ce choix ne donne pas**, et qu'il faut garder en tête :

- **le disque et le processeur sont partagés** avec la production. Le clone
  double l'occupation disque des données ;
- **`auth.users` est commun.** Un compte créé pour tester est un vrai compte
  du projet. À traiter au jalon 2, au moment de l'authentification ;
- **ce n'est pas une sauvegarde.** Un incident au niveau de la base emporte
  les deux schémas ;
- **le projet Supabase est partagé avec Avant-garde.** Les schémas exposés par
  l'API sont `public, graphql_public, avant_garde_dev, avant_garde, pivot` :
  une autre application vit dans la même base, avec le même disque, le même
  processeur et le même `auth.users`. Mesuré le 25/08/2026.

## Ordre d'exécution

| Fichier | Rôle | Écrit ? |
|---|---|---|
| `00_etat_des_lieux.sql` | inventaire de ce qu'il y a à cloner | non |
| `00b_vues_et_fonctions.sql` | cherche le seul angle mort du clonage | non |
| `01_outillage_clonage.sql` | installe `outillage.cloner_schema()` | crée une fonction |
| `02_cloner.sql` | crée `public_test` et `pivot_test` | oui |
| `03_verifier.sql` | contrôle le résultat | non |

**Lire `00` avant de lancer `02`.** Trois lignes décident :

- `taille totale de la base` et `PLACE QUE PRENDRAIT LE CLONE` — si la somme
  approche la limite du forfait Supabase, la base bascule en lecture seule et
  la synchro s'arrête. Ne pas lancer sans marge ;
- `DÉCLENCHEURS` — ils ne sont pas clonés (voir plus bas). S'il y en a, il faut
  décider quoi en faire avant, pas après.

## Ce que le clonage reproduit

Séquences, tables, colonnes, valeurs par défaut, colonnes `identity` et
générées, clés primaires, contraintes uniques, `CHECK`, exclusion, index,
commentaires, clés étrangères, état RLS, policies, vues et vues matérialisées
avec leur `security_invoker`, et les données.

Deux propriétés viennent du fait que tout tient dans une transaction : le
clone est un **instantané cohérent** même si la synchro n8n écrit pendant ce
temps, et une erreur en cours de route **annule tout** au lieu de laisser un
schéma à moitié construit. Les lectures ne prennent qu'un verrou partagé :
la synchro n'est jamais bloquée.

## Ce que le clonage ne reproduit pas, volontairement

**Les déclencheurs et les fonctions.** Le corps d'une fonction peut viser
`public` en dur — c'est le cas de `truncate_data_tables()`. Un déclencheur
cloné dans `public_test` écrirait alors en **production**. Ils sont comptés et
signalés dans le rapport, pas recopiés.

**Les droits d'accès.** Le clone naît fermé : aucun droit pour `anon` ni
`authenticated`, seul `service_role` entre. Ouvrir un accès est le travail du
jalon 1, et c'est précisément ce qu'on veut pouvoir répéter sans risque.

Conséquence directe : **tant que le jalon 1 n'a pas posé de droits, l'app ne
peut pas lire `public_test`.** C'est voulu. Et pour que le client Supabase
atteigne un jour ces schémas, il faudra aussi les ajouter à la liste des
schémas exposés dans *Settings → API → Exposed schemas* — une action manuelle
dans le tableau de bord, à faire au jalon 1 et pas avant.

## Garde-fou

`outillage.cloner_schema()` **refuse toute cible dont le nom ne finit pas par
`_test`**. Une faute de frappe ne peut pas viser `public`. La fonction vit dans
le schéma `outillage`, qui n'est pas exposé par l'API, et ses droits sont
retirés à `PUBLIC` — au lieu d'être posée dans `public`, où PostgreSQL
l'aurait rendue exécutable par tout le monde et PostgREST l'aurait publiée en
route `/rpc/`. C'est exactement le défaut de `truncate_data_tables`.

## Rafraîchir plus tard

Le clone dérive dès la minute suivante. Pour le reprendre :
`SELECT outillage.cloner_schema('public', 'public_test', true, true);`

Le quatrième argument détruit le schéma existant. **Tout ce qui aura été
développé dedans est perdu** — d'où la règle : les policies et les migrations
se rédigent dans des fichiers versionnés de `backend/database/`, jamais
seulement dans le schéma de test.

## Ce qui a été testé, et comment

Les quatre scripts ont été exécutés sur un PostgreSQL local **15.19 puis
17.11**, contre un schéma d'essai construit pour contenir les cas qui cassent
un clonage naïf : séquence autonome à pas de 7, colonne `identity GENERATED
ALWAYS`, colonne générée `STORED`, type énuméré, tableau, `jsonb`, clé primaire
composite, clé étrangère `ON DELETE CASCADE` et clé étrangère restrictive, RLS
avec `FORCE`, deux policies, une vue sur une autre vue, une vue matérialisée,
un déclencheur, une fonction `SECURITY DEFINER`, et des droits larges accordés
à `anon` sur la source.

Résultat : **17 contrôles de structure et de comportement**, tous au vert sur
les deux versions.

Ce que les contrôles établissent, au-delà du fait que « ça tourne » :

- le contenu est identique dans les deux sens (`EXCEPT` croisé) ;
- une écriture dans le clone **n'avance pas** la séquence de la source ;
- la suppression en cascade s'arrête à la frontière du clone : la source garde
  ses lignes ;
- les vues du clone lisent le clone — vérifié en créant un écart de 5 lignes
  et en constatant que la vue de la source ne bouge pas ;
- `anon` n'a aucun accès au schéma de test, alors que la source lui était
  ouverte : les droits ne sont pas hérités ;
- les trois garde-fous refusent bien une cible sans suffixe `_test`, une cible
  existante sans `p_ecraser`, et une source égale à la cible.

Trois défauts réels ont été trouvés et corrigés par ces tests :

1. les expressions de policy sortaient sans schéma sous le `search_path` de la
   source, et référençaient un type qui n'existe pas dans le clone ;
2. `INCLUDING COMMENTS` ne reprend pas le commentaire de la table elle-même,
   ni ceux des vues et des séquences ;
3. le recalage des séquences sur `MAX(colonne) + 1` écrasait la position reprise
   de la source et cassait le pas d'incrément.

Le correctif du point 1 — exécuter sous `cible, source` — laisse une relation
non clonée se résoudre dans la production **sans erreur**. C'est pourquoi la
fonction termine par un audit `pg_depend` : elle échoue si une vue ou une clé
étrangère du clone reste rattachée à la source.

## L'angle mort, et ce qui le couvre

Le clonage vérifie par `pg_depend` qu'aucune vue et aucune clé étrangère du
clone ne reste rattachée à la source. Mais **PostgreSQL n'enregistre aucune
dépendance sur le corps d'une fonction.** Une vue clonée qui appelle une
fonction dont le corps nomme `public.x` en dur lira la **production**, et aucun
audit ne peut le détecter.

C'est l'objet de `00b_vues_et_fonctions.sql`, qui liste les vues appelant une
fonction de leur schéma. Il doit renvoyer « aucune ». C'est aussi **le seul
fichier du dossier qui n'a pas été exécuté sur un PostgreSQL local** — il est
séparé pour qu'une erreur dedans n'invalide pas l'inventaire du `00`.

Les **types non standard** ne sont pas dupliqués non plus : une colonne du
clone qui utilise un type énuméré déclaré dans `public` continue de pointer sur
ce type-là. C'est sans conséquence tant que personne ne le modifie, et la ligne
25 du `00` dit s'il en existe. Le relevé des colonnes par l'API n'en a trouvé
aucun : les 688 colonnes de `public` et les 171 de `pivot` sont toutes sur des
types standard.

## Une réserve à connaître

Une **vue matérialisée** n'accepte pas `security_invoker` et ne porte pas de
RLS : elle s'exécute toujours avec les droits de son propriétaire. Le script de
vérification les liste séparément. Il n'y en a aucune aujourd'hui dans `public`
ni dans `pivot` — si l'une apparaît, elle ouvrira ce que les tables ferment.
