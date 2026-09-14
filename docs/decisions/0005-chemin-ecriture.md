# ADR 0005 — Les écritures passent par des fonctions `api.*` en SECURITY INVOKER

**Statut** : **appliqué** · **Date** : 09/09/2026 · **Portée** : Phase 2, jalons 3 à 6
**Amende** : ADR 0001, « écritures toujours par l'API »
**Précise** : ADR 0003 D1, « `api` : des vues et rien d'autre »

## La décision

Toute écriture applicative passe par une fonction déclarée dans le schéma `api`,
en **`security invoker`**, appelée depuis une Server Action Next.js avec le jeton
de l'utilisateur.

```sql
create function api.<verbe>_<objet>(...) returns <...>
  language plpgsql
  security invoker            -- la RLS de l'appelant s'applique DANS la fonction
  set search_path = ''
as $$ ... $$;
```

Chaque fonction d'écriture doit, dans cet ordre :

1. **valider** ses arguments et refuser bruyamment (`raise exception`) ;
2. **n'écrire que des colonnes nommées une à une** — jamais un `update` sur une
   ligne entière, jamais un `jsonb` déversé ;
3. inscrire une ligne dans **`app.journal_ecriture`** (auteur, entité, avant, après) ;
4. honorer **`app.idempotence`** quand l'appelant fournit une clé.

Les **lectures ne changent pas** : en direct sur les vues `api`, avec le jeton de
l'utilisateur, comme depuis le J1.

## Ce que disait l'ADR 0001, et pourquoi il fallait l'amender

L'ADR 0001 impose : « écritures toujours par l'API, lectures en direct Supabase
avec le JWT de l'utilisateur ». L'API désignée est le service **FastAPI** de
`backend/api`.

L'intention est juste et n'est pas remise en cause : **un client web ne doit pas
pouvoir écrire ce qu'il veut où il veut.** Ce qui est amendé, c'est le *lieu* où
cette garantie est posée.

Trois faits mesurés au 09/09 :

- `backend/api` est câblé sur le schéma **`pivot`** (`db_schema: str = "pivot"`),
  pas sur `core`. Il ne connaît aucune des tables des portails.
- `npm run api:lint` échoue sur **175 erreurs mypy** dans les connecteurs, ce qui
  arrête `npm run verifier` avant les tests du front.
- **2 tests de sécurité échouent** dans `backend/api/tests/test_securite.py`,
  antérieurs au 24/08.

Placer le chemin d'écriture des trois portails derrière ce service imposerait de
le remettre d'aplomb avant le premier formulaire. Le coût est réel, le bénéfice
ne l'est pas : rien de ce que les features `must` des trois portails écrivent ne
sort de PostgreSQL.

## Pourquoi INVOKER, et pas DEFINER

Le projet a payé cette leçon. `api.masquer_client`, en `security definer` et
exécutable par `anon`, répondait à la question « ce nom est-il celui du client ? » —
reproduit en deux requêtes sur une offre anonyme. Trois règles en sont sorties, dont
celle-ci : **c'est PostgreSQL qui arbitre, pas la fonction.**

En `security invoker`, la RLS de l'appelant s'applique à l'intérieur de la fonction.
Le cloisonnement ne dépend plus de ce que la fonction croit faire : une fonction
buguée écrit moins, elle n'écrit pas ailleurs.

La contrepartie est qu'il faut **ouvrir des policies d'écriture** et des `GRANT`
par colonne, portail par portail. C'est le travail, et c'est le bon endroit pour
le faire.

## Pourquoi pas l'écriture directe depuis le client

Parce qu'une policy RLS choisit des **lignes**, jamais des **colonnes**. La policy
`talent_maj_sa_fiche` autorise aujourd'hui un talent à faire un `update` sur
n'importe quelle colonne de sa fiche — dont `est_qualifie`, `statut_relation`,
`agent_referent_id` et `seniorite`, c'est-à-dire la qualification que le cabinet
porte **sur lui**.

`GRANT UPDATE (colonnes)` réglerait le cas, mais éparpillerait la règle sur les
81 colonnes de `core.fiche_talent`, sans endroit où lire ce qui est permis. Une
fonction nomme sa liste blanche en un seul endroit lisible.

Et surtout : la définition de « fini » des jalons J3 et J4 exige **une ligne de
journal portant l'auteur et l'horodatage** à chaque modification, et **qu'une même
modification envoyée deux fois ne produise qu'un seul effet**. `app.journal_ecriture`
et `app.idempotence` existent, sont vides, et rien ne les écrit. Une écriture
directe depuis le client ne les remplirait jamais.

## Ce que cet ADR n'autorise pas

- **Aucune table dans `api`.** L'ADR 0003 D1 tient : `api` porte des vues et des
  fonctions, rien d'autre.
- **Aucune écriture dans `public` ni dans `pivot`.** Les trois interdits de D1 sont
  intacts.
- **Aucune fonction d'écriture en `security definer`.** S'il en faut une un jour,
  elle fera l'objet d'un amendement motivé et d'une révocation explicite à `public`
  — `create or replace function` réaccorde `EXECUTE` à `PUBLIC`, piège déjà payé.

## La limite, assumée

Cette voie ne couvre que les écritures qui **restent dans PostgreSQL**. Le jour où
une écriture devra appeler un tiers — signature électronique, parsing de CV par un
modèle, génération d'une facture PDF — il faudra un vrai serveur, et ce sera
`backend/api` conformément à l'ADR 0001.

Aucune feature `must` des portails Entreprise, Talent ou de la tranche Recruteur
retenue n'est dans ce cas. Les features concernées sont toutes en `should` ou
`could` : signature électronique, génération de factures, import de profil par IA,
matching pgvector.
