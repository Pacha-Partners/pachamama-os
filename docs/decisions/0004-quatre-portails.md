# ADR 0004 — Le back-office est un portail, pas un rôle

**Statut** : **appliqué** · **Date** : 09/09/2026 · **Portée** : Phase 2, jalon 2
**Amende** : ADR 0003, « Deux axes de rôle, pas une énumération »

## La décision

Tranchée par Claude Menye : **administrer et recruter sont deux métiers aux
fonctionnalités distinctes, donc deux surfaces, donc deux portails.**

`app.portail` passe de trois valeurs à quatre :

```
talent · entreprise · recruteur · backoffice
```

Un compte peut porter **plusieurs portails internes** : on peut être
administrateur seul, recruteur seul, ou les deux.

## Ce que disait l'ADR 0003, et pourquoi il fallait l'amender

L'ADR 0003 posait deux axes : le **portail** — ce qu'on voit — et le **pouvoir
interne** — ce qu'on peut faire. Le raisonnement tenait pour « le support voit
les mêmes candidatures mais ne peut pas les modifier » : là, deux axes sont
justes. Il ne tenait pas pour l'administration, qui n'est pas un pouvoir plus
grand sur les mêmes écrans — c'est un **autre écran**.

Le symptôme était visible dans le code avant de l'être dans le modèle : la
dérivation des vues côté application disait « un accès interne ouvre le portail
recruteur, et le rôle admin y ajoute le back-office ». Cette règle n'existait
nulle part en base. C'était un arbitrage d'interface qui suppléait un modèle
incomplet.

## La preuve par les données

Trois personnes portent dans Bubble **`Admin` ET `Recruiter Core Team`** :
Marion Darnet, Arnaud Lahy, Andréa Bollard.

La reprise ne pouvait pas les représenter. Son `case` retenait un seul rôle, et
l'index `acces_collab_unique` — unique sur `collaborateur_id`, globalement —
interdisait la seconde ligne. **Ces trois personnes ont perdu une casquette à la
reprise du 08/09.** La correction ne fait donc pas qu'ouvrir un cas futur : elle
répare une perte déjà subie.

## Ce que le modèle devient

**`portail` cesse d'être une colonne générée.** Elle se déduisait du type de
personne rattachée. Deux portails naissant désormais tous deux d'un
`collaborateur`, la déduction est impossible : la colonne est **déclarée**, et
la cohérence tenue par une contrainte.

```sql
constraint acces_portail_coherent check (
      (portail = 'talent'     and fiche_talent_id   is not null)
   or (portail = 'entreprise' and contact_client_id is not null)
   or (portail in ('recruteur','backoffice') and collaborateur_id is not null))
```

Elle est **NOT NULL**, et ce n'est pas décoratif : une contrainte CHECK qui
s'évalue à NULL est considérée comme *satisfaite*. Sans le NOT NULL, un accès
sans portail passerait en silence et n'ouvrirait rien.

**`role_interne` change de sens.** Ce n'est plus le pouvoir — le pouvoir, c'est
le portail. C'est la graduation **à l'intérieur** d'un portail interne :

| portail | rôles admis |
|---|---|
| `recruteur` | `recruteur` · `support` |
| `backoffice` | `admin` · `superadmin` |
| `talent`, `entreprise` | aucun |

Ce qui règle le sort de `support` : une nuance du portail recruteur, pas une
surface. L'argument de l'ADR 0003 lui reste donc entièrement applicable.

**`acces_collab_unique` devient `(collaborateur_id, portail)`.** C'est cet
index, et lui seul, qui interdisait le cumul.

## Ce qui n'a pas bougé, et c'est le signe que le modèle était sain

Les **quatre policies** de `core` et les boucles sur 35 et 32 tables s'appuient
sur `api.est_interne()`. Elles **appellent** la fonction : l'élargir à
`portail in ('recruteur','backoffice')` a suffi. Aucune policy réécrite.

Les principes de l'ADR 0003 tiennent tous : le compte porte le lien vers la
personne et jamais l'inverse ; les droits sont accrochés à l'accès, pas à la
personne ; une personne a un compte et un seul.

## Conséquence sur les fonctions

`api.role_interne()` faisait `limit 1`. Avec deux accès internes — désormais
possibles, et déjà réels pour trois personnes — elle rendait un rôle au hasard.
Elle est conservée pour ne rien casser, mais rendue déterministe (le back-office
l'emporte) et **marquée héritée**. Le code neuf emploie :

- `api.mes_portails()` — les surfaces ouvertes, en tableau
- `api.a_portail(text)` — le test sans ambiguïté
- `api.role_sur(text)` — la graduation sur un portail donné

`api.moi` expose désormais `portails`, `role_recruteur` et `role_backoffice`.

## Ce qui reste ouvert

**`superadmin`** est dans l'énuméré depuis le 29/08 et n'est porté par personne.
Conservé faute de moyen propre de retirer une valeur d'énuméré, et parce qu'il
ne coûte rien tant qu'il est vide. Sa surface reste à définir.

**Aucune barrière en base ne distingue encore admin de recruteur.** Les policies
ne connaissent que `est_interne()`. Si le back-office permet de rattacher,
promouvoir ou désactiver un compte, il lui faudra une policy ou une RPC
`security definer` testant `api.a_portail('backoffice')` — sinon la séparation
reste une frontière d'affichage.

## Répartition après application

```
accès : 4 198
  talent 4 153 · recruteur 35 · backoffice 10 · entreprise 0
  rôles internes : recruteur 17 · support 18 · admin 10
  comptes cumulant recruteur ET backoffice : 3
  incohérences portail/personne : 0
```

Migrations : `20260910280000` (valeurs d'énuméré, seules — PostgreSQL refuse
qu'une valeur ajoutée soit employée dans la même transaction),
`20260910290000` (le modèle), `20260910300000` (les fonctions et la vue),
`20260910301000` (droits `service_role`), `20260910310000` (le NOT NULL).
