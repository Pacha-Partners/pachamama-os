# Les fonctions de `public` exécutables par la clé publique

> Constaté le 24/08/2026. Corrigé sur le **dev** le 26/08/2026.
> **Reste à appliquer en production.**

## Le défaut

La clé `anon` — celle qui part dans le code de la page, donc lisible par
n'importe quel visiteur — pouvait appeler les 7 fonctions du schéma `public`.
Parmi elles, `truncate_data_tables()` est en `SECURITY DEFINER` : elle
s'exécute avec les droits de son propriétaire, contourne toute règle de
sécurité, et son corps supprime les clés étrangères puis vide **toutes** les
tables du schéma.

**La preuve, obtenue sans exécuter la fonction.** Un GET place PostgREST dans
une transaction en lecture seule. La réponse était `405` avec le code
PostgreSQL **`25006`** — « impossible d'écrire dans une transaction en lecture
seule ». Ce code signifie que **le contrôle de droit était déjà passé** : un
refus aurait rendu 401 ou 403. Et `enable_fk` a répondu `204` : elle s'est
réellement exécutée.

## La cause, en deux temps

**PostgreSQL accorde `EXECUTE` à `PUBLIC` par défaut** sur toute fonction
créée. Aucun script de mise en place ne l'a retiré.

**Et ce projet porte quatre droits par défaut explicites**, visibles dans le
dump du schéma :

```
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO postgres / anon / authenticated / service_role
```

## Ce qui ne marche pas, et qu'il faut savoir

**`ALTER DEFAULT PRIVILEGES … REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` est sans
effet.** Le premier jet du correctif reposait dessus.

Mesuré sur PostgreSQL 17.11, la même version majeure que le serveur :

```
état de départ         défaut enregistré = postgres=X anon=X authenticated=X service_role=X
après le REVOKE        défaut enregistré = postgres=X service_role=X
fonction créée ensuite proacl = =X/postgres postgres=X/postgres service_role=X/postgres
                                 ^^^^^^^^^^^^ le droit câblé pour PUBLIC, revenu
                       has_function_privilege('anon', …) = true
```

`anon` hérite de `PUBLIC`. Testé aussi sur une base **vierge**, sans entrée
préalable dans `pg_default_acl` : même résultat, et aucune entrée n'est même
créée. On ne peut pas retirer ce défaut par ce moyen.

La protection des fonctions **futures** passe donc par un **déclencheur
d'événement**, seul mécanisme qui agisse après la création.

## Le correctif

`supabase/migrations/20260826072934_revoquer_execution_publique.sql`

1. `REVOKE EXECUTE` sur les fonctions existantes, à `PUBLIC`, `anon`, `authenticated` ;
2. `GRANT EXECUTE` explicite à `service_role` — les 11 fichiers du projet qui
   appellent une route `/rpc/` utilisent tous cette clé ;
3. retrait des droits par défaut accordés à `anon` et `authenticated` — ceux-là
   se retirent bien ;
4. un **déclencheur d'événement** dans un schéma `securite` non exposé, qui
   ferme toute fonction créée ensuite **dans `public` uniquement** ;
5. une assertion qui **crée réellement une fonction** et vérifie que `anon` ne
   peut pas l'appeler, avant de la supprimer. C'est ce contrôle qui manquait au
   premier jet : il inspectait les catalogues et aurait donc validé une
   protection sans effet.

La migration ne touche aucune donnée.

## Avant / après, mesuré sur le dev

| fonction | avant | après |
|---|---|---|
| `claim_next_sync_type` | 405 · 25006 — droit accordé | **401 — refusé** |
| `disable_fk` | 405 · 25006 — droit accordé | **401 — refusé** |
| `enable_fk` | **204 — exécutée** | **401 — refusé** |
| `finish_sync_type` | 404 — droit non révélé | **401 · 42501 — refusé** |
| `replace_m2m` | 404 — droit non révélé | **401 · 42501 — refusé** |
| `rls_auto_enable` | 400 · 0A000 — droit accordé | **401 — refusé** |
| `truncate_data_tables` | 405 · 25006 — droit accordé | **401 — refusé** |

Les deux fonctions à arguments ont été sondées par POST avec les bons noms de
paramètres : un GET rend 404 avant tout contrôle de droit, et ne prouve donc
rien.

**La synchronisation fonctionne** : `claim_next_sync_type` appelée en POST avec
la clé de service répond `200`.

**Les autres schémas sont épargnés** : vérifié en local, une fonction créée dans
un schéma autre que `public` reste ouverte. Le projet de production étant
partagé avec Avant-garde, qui crée ses fonctions dans ses propres schémas, elle
n'est pas concernée.

`truncate_data_tables` n'a jamais été appelée en POST, avec aucune clé, sur
aucun des deux projets.

## Appliquer en production

```
supabase link --project-ref zkxwoclmephuzbdgcggr
supabase db push
```

⚠️ **Vérifier `supabase/.temp/project-ref` avant et après.** `db push` s'applique
au projet rattaché, et la CLI ne l'est qu'à un seul à la fois. Après
l'opération, revenir au dev — sinon la commande suivante viserait la production
sans que rien ne le signale.

La migration `20260825111210_remote_schema.sql` est déjà marquée appliquée sur
la production : `db push` n'enverra que celle-ci.

---

# L'oracle du masquage dans le schéma `api`

> Constaté et corrigé sur le **dev** le 10/09/2026. **Reste à appliquer en production.**
> Même classe de défaut que ci-dessus, dans le schéma qui devait en être le rempart.

## Le défaut

`api.masquer_client(texte, p_mandat_id)` est en `SECURITY DEFINER` : elle lit le
nom du client et rend `NULL` si le texte qu'on lui soumet le contient. Elle était
exécutable par la clé publique. Elle répond donc à la question « ce nom est-il
celui du client ? » — c'est un **oracle** : on lui soumet des candidats, elle
désigne le bon. Une liste de raisons sociales n'est pas un secret.

Reproduit avec la clé publique, en deux requêtes, sur une offre déclarée anonyme :

```
POST /rest/v1/rpc/masquer_client {"texte":"ZZZ-Inexistante","p_mandat_id":"b13112db-…"}
  → 200  "ZZZ-Inexistante"      (le texte revient : ce n'est pas le client)
POST /rest/v1/rpc/masquer_client {"texte":"<nom du client>","p_mandat_id":"b13112db-…"}
  → 200  null                    (le texte est annulé : C'EST le client)
```

La vue faisait pourtant son travail : elle déclarait bien `entreprise: null`.

## Pourquoi le droit avait été donné

Ce n'était pas une négligence mais une conséquence. La vue était en
`security_invoker` — choix délibéré, pour garder DEUX remparts : des droits
minimaux ET des policies. Or une vue invoker s'exécute avec les droits de
l'appelant, qui doit donc pouvoir exécuter les fonctions qu'elle appelle. Le
`grant execute` était mécaniquement imposé par ce choix.

Deux pièges s'y ajoutaient :

**PostgreSQL accorde `EXECUTE` à `PUBLIC` sur toute fonction créée.** Révoquer
le droit à `anon` seul n'aurait rien changé — il l'aurait gardé par `PUBLIC`. Et
`create or replace function` le réaccorde : il faut re-révoquer après.

**Une vue non-invoker n'encapsule PAS les droits sur les fonctions.** Passer la
vue en `security_definer` ne suffisait donc pas : mesuré, la vue rendait
`42501 permission denied for function client_visible`. PostgreSQL vérifie
`EXECUTE` contre l'appelant, propriétaire de vue ou non — seules les TABLES
passent par le propriétaire.

## Le correctif

Il n'y avait pas de troisième terme tant que le masquage passait par une
fonction : soit `anon` peut l'exécuter et l'oracle est ouvert, soit il ne peut
pas et la vue tombe. **Le masquage est donc devenu une expression.**
`api.offre_publique` est en `security_definer`, lit `core.entreprise` avec les
droits de son propriétaire, et calcule le motif une fois par ligne en latéral.
`anon` n'a toujours aucun droit sur les 851 clients, et il n'y a plus rien à
interroger — une expression ne s'appelle pas.

Contrepartie assumée : on perd le second rempart. Le `WHERE` de la vue tient en
deux lignes et il est sous harnais ; un oracle ouvert valait moins qu'un rempart
de moins.

## Ce qui empêche le retour du défaut

`npm run verifier:j1` porte désormais un septième contrôle qui échoue si l'une
des deux fonctions répond `200` à la clé publique. La sonde distingue bien les
deux états : la même requête rendait `200` avant le correctif, `401` après.

## Ce qui reste ouvert

`core.entreprise.site_web` est renseigné sur **12 offres publiées sur 12**,
toutes anonymes. Un site internet réidentifie un client en zéro recherche, et
aucun masquage lexical ne le voit. La vue ne l'expose pas aujourd'hui — mais la
fiche d'offre, qui doit afficher la ligne « Site internet », le ferait. Le
masquage devra donc être **catégorique sur une offre anonyme** : les champs
d'identification ne sont pas masqués un à un, ils ne sont pas construits.
