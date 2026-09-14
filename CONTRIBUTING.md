# Comment on travaille sur ce dépôt

Ce document décrit **trois branches, une convention de commit et quatre règles**.
Tout le reste en découle.

---

## 1. Les branches

Il n'y en a que **trois qui durent**. Toutes les autres vivent quelques jours.

| Branche | Ce qu'elle désigne | Base | Déploiement |
|---|---|---|---|
| `main` | ce qui tourne en ligne | projet **live** | production |
| `recette` | l'état validé, candidat à la mise en ligne | projet **dev** | URL de beta |
| `dev` | l'intégration — tout s'y retrouve | projet **dev** | environnement dev |

```
main        ──●──────────────────────────●────────────●──
              │ v1.0.0                   │ v1.1.0     │ v1.1.1
              │                          ↗            ↑
recette       │              ──●──●──●──               │
              │               ↗                       │
dev         ──●──●──●──●──●──●──●──●──●──●──●──●───────┘
                 ↘  ↗  ↘   ↗
                  ●─●   ●─●            branches de travail (quelques jours)

release/v1.x  ●───────●                née du tag, le jour où on en a besoin
```

**`dev` n'atteint jamais `main` toute seule.** La seule entrée de `main` est
`recette` ; la seule entrée de `recette` est un commit qu'on a désigné.

### Les branches de travail

Nommées `<portail>/<ce-que-ça-fait>`. Le préfixe regroupe la liste dans
GitHub ; il n'a aucune signification pour git, qui ne connaît pas de hiérarchie.

```
entreprise/depot-du-logo      talent/frise-du-process
public/filtre-par-univers     ds/carte-mobile-du-tableau
securite/rotation-des-jetons  db/vue-des-mandats
```

```bash
git switch dev && git pull
git switch -c entreprise/depot-du-logo
# … commits …
git push -u origin entreprise/depot-du-logo
gh pr create --base dev
# CI verte → fusion → la branche est supprimée
```

**Supprimer la branche ne supprime rien.** Une branche est un fichier de
41 octets contenant l'identifiant d'un commit. Une fois fusionnés, ses commits
sont atteignables depuis `dev`, donc conservés pour toujours.

### Le cycle de `recette`

```bash
# 1. On désigne l'état validé. Pas forcément la pointe de dev.
git switch recette && git merge --ff-only <le commit validé>

# 2. Un défaut trouvé sur la beta se corrige ICI, et repart DANS dev tout de suite
git commit -am "fix(entreprise): …"
git switch dev && git merge --no-ff recette

# 3. Mise en ligne
git switch main && git merge --no-ff recette
```

`--ff-only` à l'étape 1 **refuse** que `recette` diverge. Si la commande
échoue, c'est qu'un commit y traîne sans avoir été reporté dans `dev` : c'est
exactement l'erreur qu'on veut voir échouer bruyamment.

---

## 2. Les commits

Format conventionnel, **portée obligatoire** — c'est elle qui donne le suivi
par portail sans une seule branche permanente.

```
feat(entreprise): le logo se dépose au lieu de se coller
fix(ds): la carte mobile recevait la ligne TanStack, pas la donnée
docs(readme): …
```

Portées en usage : `talent`, `entreprise`, `public`, `recruteur`, `backoffice`,
`ds`, `db`, `api`, `app`, `outils`.

```bash
git log --oneline --grep "(talent)"          # l'histoire d'un portail
git log --oneline -- frontend/lib/talent     # ou par chemin
```

---

## 3. Les versions

**Le numéro se calcule, il ne se choisit pas.** `release-please` lit les commits
depuis le dernier tag et ouvre une pull request de release que vous relisez.

| Ce que vous écrivez | Effet |
|---|---|
| `fix(...)` | correctif : 1.1.0 → 1.1.**1** |
| `feat(...)` | mineure : 1.1.1 → 1.**2**.0 |
| `feat(...)!` ou `BREAKING CHANGE:` | majeure : 1.2.0 → **2**.0.0 |
| `docs`, `chore`, `test`, `refactor` | aucun |

Pour imposer un numéro :

```bash
git commit --allow-empty -m "chore: release 2.0.0" -m "Release-As: 2.0.0"
```

Un tag ne bouge jamais : `git switch --detach v1.1.0` rend l'arbre entier de
cette version, dans trois ans comme aujourd'hui.

---

## 4. Les quatre règles

### ⚠ Règle 1 — une migration par changement, jamais modifiée après sa poussée

Le dépôt compte 127 migrations. Cinq d'entre elles recréent la même vue.
**Deux branches portant chacune un `create or replace view api.mandat_client`
fusionnent proprement dans git et cassent dans PostgreSQL** — git ne connaît
pas le schéma.

- Un fichier par changement, horodaté.
- `create or replace view` refuse de renommer, réordonner ou retirer une
  colonne (erreur `42P16`) : on **ajoute en fin**, et on recopie les colonnes
  existantes à l'identique.
- `ci.yml` rejoue les 127 migrations sur une base neuve à chaque pull request.
  C'est le seul contrôle qui attrape une collision.

### ⚠ Règle 2 — on étend, on ne retire pas dans la même livraison

Entre la poussée du schéma et le déploiement du code il s'écoule du temps :
une migration doit être rétrocompatible avec le code **encore en ligne**.
On ajoute ; le retrait vient une version plus tard, quand plus aucun code ne
lit l'ancienne forme. C'est le motif *expand / contract*.

Et **le schéma ne revient pas en arrière** : le code se rétablit en un clic sur
le déploiement précédent, une colonne créée reste créée.

### ⚠ Règle 3 — plus de `db push` depuis un poste

Les migrations partent **par la CI**, jamais d'une machine. Deux poussées
concurrentes depuis deux postes entrent en conflit, et les migrations
s'appliquent dans l'ordre des horodatages.

`dev.yml` et `main.yml` poussent **sans `--include-all`**. Ce drapeau
désarmerait le garde qui refuse une migration datée avant la dernière
appliquée — le cas exact que produit un correctif d'urgence passé par `main`.
S'il tombe, c'est un signal qui demande une décision, pas un drapeau à ajouter.

### ⚠ Règle 4 — ce dépôt est PUBLIC

Derrière le projet live : **30 829 personnes physiques**. Une fuite dans
l'historique est définitive — un `force-push` ne dépublie rien.

Ne versionnez jamais : une adresse électronique nominative, un mot de passe
même de test, une clé de service, un identifiant de projet en clair dans un
fichier de configuration. Les valeurs de ce genre sont fournies par un réglage
PostgreSQL ou par un secret de dépôt. `gitleaks` tourne sur chaque pull
request, et la protection au push de GitHub est active.

---

## 5. Les correctifs d'urgence

Deux situations, et une seule est un correctif d'urgence.

**`dev` est livrable en l'état ?** Alors ce n'en est pas un : branche `fix/…`
depuis `dev`, chemin normal, mais tout de suite.

**`dev` porte du travail non livrable ?** Alors on repart du **tag** :

```bash
git fetch --tags
git switch -c hotfix/v1.1.1-avatar-vide v1.1.0
git commit -m "fix(entreprise): …"
gh pr create --base main
# fusion → release-please pose v1.1.1

# ⚠ ET LE REPORT, qui n'est pas optionnel :
git switch dev     && git merge --no-ff hotfix/v1.1.1-avatar-vide
git switch recette && git merge --no-ff hotfix/v1.1.1-avatar-vide   # si gelée
```

**Sans le report, le défaut revient à la livraison suivante** — et il ressemble
alors à un correctif qui se serait défait tout seul.

Un correctif d'urgence ne refactore pas, ne renomme pas, et **ne porte pas de
migration** sauf nécessité démontrée (voir règle 2).

---

## 6. Les secrets attendus par la CI

À poser dans *Settings → Secrets and variables → Actions*.

| Secret | Employé par |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | `dev.yml`, `main.yml` |
| `SUPABASE_PROJECT_REF_DEV`, `SUPABASE_DB_PASSWORD_DEV` | `dev.yml` |
| `SUPABASE_URL_DEV`, `SUPABASE_ANON_KEY_DEV`, `SUPABASE_SERVICE_ROLE_KEY_DEV` | `dev.yml` |
| `TEST_MDP`, `TEST_ENTREPRISE_EMAIL`, `TEST_TALENT_EMAIL`, `TEST_RECRUTEUR_EMAIL` | `dev.yml` |
| `SUPABASE_PROJECT_REF_LIVE`, `SUPABASE_DB_PASSWORD_LIVE` | `main.yml` |

`ci.yml` n'en emploie **aucun** : il tourne sur toute pull request, y compris
d'un dépôt tiers.
