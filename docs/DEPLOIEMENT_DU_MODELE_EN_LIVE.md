# Déployer le modèle de données en production

**Mesuré et répété le 14/09/2026.** Ce document remplace l'idée d'une
« réconciliation » : il n'y a rien à réconcilier, il y a un **premier
déploiement** à conduire.

---

## 1. L'état de départ, mesuré

`supabase migration list` sur le projet **live** rend **2** migrations connues.
Le dépôt en compte **127**. Et surtout :

| schéma | LIVE | DEV |
|---|---|---|
| `public` (miroir Bubble) | 107 tables | 107 — **structurellement identiques** |
| `pivot` | 18 | 18 |
| `avant_garde` + `avant_garde_dev` | 14 + 14 | absents |
| **`api` · `core` · `app` · `ref` · `config` · `reprise`** | **0 partout** | 22 · 38 · 8 · 18 · 8 · 3 |

**Le nouveau modèle n'existe pas en production.**

⚠ **`supabase migration repair --status applied` serait donc un MENSONGE** :
il marquerait comme appliquées 125 migrations dont les objets n'existent pas,
et empêcherait définitivement le modèle d'être créé.

**Dérive depuis l'instantané du dev (08/09) :** +196 candidats, +246 process,
+1 234 notes, +18 mandats, +7 entreprises.

---

## 2. Les trois risques, tranchés par la mesure

### n8n — **le risque n'existe pas**

Le miroir n'est pas mis à jour par incréments, il est **réécrit en boucle** :

    job_reve_critere   17 406 621 insérés · 17 397 535 supprimés · 9 081 vivants
    candidat                                 5 715 405 modifiés · 7 219 vivants
    _sync_state                              1 114 768 modifiés ·    22 vivants

Et ces tables sont exactement celles que la reprise LIT. **Mais dix mesures sur
41 secondes n'ont montré aucune variation** : n8n travaille dans une
transaction, et le contrôle de concurrence de PostgreSQL garantit qu'un lecteur
ne voit jamais l'état intermédiaire.

**Conséquence : il n'est pas nécessaire d'arrêter n8n.** Il reste prudent de
choisir une heure creuse, mais ce n'est plus une condition.

### Les localisations — **pas un blocage**

Le miroir du dev ne diffère de celui du live que par **une seule colonne** sur
107 tables : `public.mandat.localisations`, que la migration `20260909190000`
ajoute elle-même (`add column if not exists`) puis remplit depuis une liste
figée. Tout le reste est identique.

### Les données sales — **un blocage réel, et le seul**

Voir §4.

---

## 3. Les 125 migrations, classées

| classe | n | ce que c'est |
|---|---|---|
| **SCHÉMA** | 57 | création d'objets — rejouable, sans risque de donnée |
| **MIXTE** | 18 | crée des objets *et* écrit des lignes |
| **REPRISE** | 21 | lisent le miroir et peuplent `core` — le cœur |
| **DONNÉE** | 22 | correctifs et contrôles |
| **GARDÉE** | 7 | s'abstiennent sur la production (`to_regnamespace('avant_garde')`) |

Les 7 gardées sont les fixtures et les comptes de test : elles détectent la
production et ne font rien. **Les 21 de reprise ne sont pas gardées, et c'est
voulu** — ce sont elles qui construisent `core`.

---

## 4. Ce que la répétition a trouvé

Répétition conduite sur une base **locale**, chargée avec le miroir du **LIVE**
(75 Mo, `pg_dump --data-only`, lecture seule), sur un socle qui reproduit la
production à l'objet près — `public.mandat.localisations` absente, comme là-bas.
Puis les 126 migrations, une par une, arrêt au premier échec.

⚠ **UN PREMIER PASSAGE AVAIT ÉTÉ FAIT SUR LE MIROIR DU DEV, ET C'ÉTAIT UNE
ERREUR DE MÉTHODE.** Une répétition qui ne part pas des données de la CIBLE ne
répète rien : le live porte 196 candidats, 247 candidatures et 1 355 notes que
le dev n'a pas, et ce sont les lignes les plus récentes — donc les plus
susceptibles de porter une saisie fautive. Le second passage a effectivement
trouvé deux anomalies de plus (§5).

### Un seul blocage, à la 23ᵉ migration

`20260908201003_reprise_fiche_talent.sql` :

    ERROR: new row for relation "fiche_talent"
           violates check constraint "fiche_email_arobase"

**Deux lignes sur 7 219** portent autre chose qu'une adresse dans
`public.candidat.email_perso` :

    «https://www.linkedin.com/in/lauradinin/»   ← une URL LinkedIn
    «Patrick Lambein-Monette»                   ← un nom

Aucune autre table porteuse d'adresse n'est touchée (`public.equipe` : 0).

La contrainte a raison de les refuser. Mais une reprise qui s'arrête sur deux
lignes sur sept mille ne peut pas être lancée en production.

### Les 104 suivantes passent toutes

Une fois ces deux lignes neutralisées, la chaîne va jusqu'au bout sans une
seule erreur.

---

## 5. Ce que VOS données produisent

### Dans `core`

| table | lignes |
|---|---|
| `fiche_talent` | 7 219 |
| `candidature` | 7 483 |
| `note` | 52 130 |
| `tache` | 1 167 |
| `entreprise` | 858 |
| `mandat` | 551 |
| `contact_client` | 538 |
| `analyse` | 501 |
| `placement` | 232 |
| `tag` | 110 |
| `collaborateur` | 42 |

### Les écarts déclarés par `reprise.controle` — tous expliqués

| étape | écart | motif |
|---|---|---|
| `core.note` | 6 186 | 53 412 sources fondues en 47 226 notes par empreinte de contenu |
| `activation_comptes` | 4 299 | comptes dormants : aucun `auth.users` sur une base neuve |
| `restauration` | 21 | contacts sans nom ni courriel dans `public.equipe` |
| `core.tache` | 16 | notifications orphelines (`task_id` nul), perte déclarée |
| **`salaire`** | **4** | mandats à salaire min > max |
| `agent` | 4 | les mêmes, écartés par `mandat_salaire_ordre` |

### ⚠ Ce que le miroir du dev cachait

| dans `core` | miroir dev | miroir LIVE | écart |
|---|---|---|---|
| `fiche_talent` | 7 023 | 7 219 | +196 |
| `candidature` | 7 236 | 7 483 | +247 |
| `note` | 50 775 | 52 130 | +1 355 |
| **mandats à salaire inversé** | **2** | **4** | **+2** |
| contacts sans identité | 20 | 21 | +1 |

Deux mandats de plus portent un salaire minimum supérieur au maximum :
**Soongo - Sales Executive** et **SOPHT-MANDAT-FULLSTACK** (les deux connus
étaient *Prose-D7-Tech-ML Engineer* et *Weda-D1-Product-PM*). Ils ne bloquent
pas — la migration les écarte et le déclare — mais ils **partiront sans agent**.
Une répétition sur le dev ne les aurait jamais montrés.

## 6. Ce qu'il reste à décider

**A — corriger les deux fiches dans Bubble.** *Recommandé.* Deux saisies. La
reprise passe alors **sans modifier une seule migration**, et la règle 1 reste
intacte. L'information retourne au bon endroit : l'URL LinkedIn a déjà sa
colonne dédiée, et un nom n'a rien à faire dans un champ courriel.

La mesure rend cette option évidente : il n'y a pas un cas général à traiter,
il y a **deux fautes de frappe**, identifiées, corrigeables à la source.

**B — rendre `20260908201003` défensive**, plus tard. Écarter ce qui n'est pas
une adresse et le **consigner dans `reprise.controle`** plutôt que de le perdre
en silence. Souhaitable pour que la reprise ne retombe pas le jour où n8n
réimportera une troisième faute — mais cela demande de **modifier une migration
déjà poussée**, contraire à la règle 1. À décider séparément, et pas dans
l'urgence d'un déploiement.

**Et à traiter à part** : les 4 mandats à salaire inversé, qui partiront sans
agent.

---

## 7. La conduite de l'opération

1. **Ne pas passer par `main.yml`.** Son garde du nombre refuse au-delà de
   20 migrations, et il a raison : cette opération se conduit à la main, sous
   surveillance.
2. **Par classes, avec une mesure entre chaque** : les 57 de SCHÉMA d'abord
   (additives, sans risque), puis MIXTE, puis les 21 de REPRISE, puis DONNÉE.
3. **Relire `reprise.controle` après la reprise** et comparer aux chiffres du
   §5 : tout écart nouveau est un signal.
4. **Après coup**, aligner l'historique : le live connaîtra alors réellement
   les 127 migrations, et `main.yml` pourra reprendre son rôle.

## 8. Comment la répétition a été conduite

- Sonde de schéma **en lecture seule stricte**, avec un garde dans le code qui
  refuse toute requête n'étant pas un `select` (scratchpad, `sonde.mjs`).
- Données extraites du **live**, en lecture seule (`pg_dump --data-only`),
  après qu'un premier passage sur le miroir du dev se soit révélé non fidèle.
- Base locale isolée, ports décalés de 1000, conteneur nommé
  `pachamama-repetition`.
- **Aucune écriture sur la production.**
