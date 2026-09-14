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

**1. Avancer `recette`** — par une pull request `dev → recette`, fusionnée avec
un **commit de fusion** (jamais un squash : il écraserait vingt commits en un,
et `main` en hériterait).

```bash
gh pr create --base recette --head dev --title "Livraison …"
# CI verte → « Create a merge commit »
```

⚠ **Pas de `--ff-only`, et c'est une correction.** Ce document a d'abord
prescrit `git merge --ff-only`, qui est le geste juste en local mais que la
protection de branche rend impossible : `recette` n'accepte que des pull
requests, et GitHub ne sait pas fusionner en avance rapide. Elle reçoit donc un
commit de fusion.

Ce qu'on perd : l'identité des graphes. Ce qu'on garde — et c'est ce qui
compte : **le contenu**. Juste après la fusion, `recette` et `dev` portent le
même arbre. Le contrôle de non-divergence devient donc :

```bash
git diff recette dev                  # vide juste après la fusion
git log dev..recette --no-merges      # vide : aucun commit propre à recette
```

Si la seconde commande rend quelque chose, c'est un correctif de beta qui n'a
pas été reporté dans `dev`.

**2. Un défaut trouvé sur la beta** se corrige sur `recette` et repart **dans
`dev` tout de suite** — sans le report, la livraison suivante le ramène.

```bash
git switch recette && git commit -am "fix(entreprise): …"
gh pr create --base dev --head recette --title "Report du correctif de beta"
```

**3. Mise en ligne** — pull request `recette → main`, commit de fusion.

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

### ⚠⚠ Règle 1 bis — LA PRODUCTION EST DÉSACCORDÉE, ET ELLE LE RESTE

Mesuré le 14/09 : `supabase migration list` sur le projet **live** rend **2**
migrations connues, la dernière du 26/08. Le dépôt en compte **127**.

La production n'a jamais été construite par ces migrations — elle vient de la
reprise, exécutée autrement. Son historique
`supabase_migrations.schema_migrations` ne reflète donc pas son schéma réel, et
un `db push` y tenterait d'appliquer 125 migrations, dont toute la reprise
Bubble, l'amorçage, les comptes de test et les fixtures. Sur 30 829 personnes
physiques.

**`main.yml` porte DEUX serrures**, et elles ne sont pas du même ordre :

1. un garde **automatique** du NOMBRE — au-delà de 20 migrations pour une
   livraison, il refuse et le dit ;
2. un garde **humain** — le job passe par l'environnement GitHub
   `base-de-production`, qui exige une approbation explicite. Le job attend,
   GitHub notifie, rien ne bouge tant que personne n'a cliqué.

Il faut les deux erreurs pour qu'une migration fautive atteigne la production :
une mesure qui se trompe, et un humain qui approuve sans lire. Une livraison normale en porte zéro à quelques
unes ; 125 n'est pas une livraison, c'est un historique désaccordé.

**Avant la première mise en ligne**, il faut réconcilier : pour chaque migration
déjà reflétée dans le schéma de la production,

```bash
supabase migration repair --status applied <version>
```

Ce travail n'est pas fait. Tant qu'il ne l'est pas, ne fusionnez pas
`recette → main`.

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
| `SUPABASE_PROJECT_REF_DEV` | `dev.yml` |
| `SUPABASE_URL_DEV`, `SUPABASE_ANON_KEY_DEV`, `SUPABASE_SERVICE_ROLE_KEY_DEV` | `dev.yml` |
| `TEST_MDP`, `TEST_ENTREPRISE_EMAIL`, `TEST_TALENT_EMAIL`, `TEST_RECRUTEUR_EMAIL` | `dev.yml` |
| `SUPABASE_PROJECT_REF_LIVE` | `main.yml` |

⚠ **Aucun mot de passe Postgres.** Mesuré le 14/09 sur un dossier neuf : le CLI
Supabase se connecte avec le seul jeton d'accès, `link` et `db push` compris.
En exiger un obligerait à le réinitialiser — Supabase ne le montre qu'à la
création du projet — pour une valeur qui ne sert à rien.

`bash outils/secrets_ci.sh` les pose toutes : neuf viennent de vos fichiers
locaux, le jeton vient du trousseau macOS.

`ci.yml` n'en emploie **aucun** : il tourne sur toute pull request, y compris
d'un dépôt tiers.
