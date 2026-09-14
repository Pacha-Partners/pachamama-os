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

Répétition conduite sur une base **locale**, chargée avec le miroir du **dev**
(70 Mo), amenée à l'état exact du live, puis soumise aux 126 migrations.

### Un seul blocage, à la 23ᵉ migration

`20260908201003_reprise_fiche_talent.sql` :

    ERROR: new row for relation "fiche_talent"
           violates check constraint "fiche_email_arobase"

**Deux lignes sur 7 023** portent autre chose qu'une adresse dans
`public.candidat.email_perso` :

    «Patrick Lambein-Monette»                  ← un nom
    «https://www.linkedin.com/in/lauradinin/»  ← une URL LinkedIn

Des saisies fautives dans Bubble, arrivées **après** que les migrations ont
tourné sur le dev — d'où leur invisibilité jusqu'ici.

La contrainte a raison de les refuser. Mais **une reprise qui s'arrête sur deux
lignes sur sept mille ne peut pas être lancée en production.**

### Les 104 suivantes passent toutes

Une fois ces deux lignes neutralisées, la chaîne va jusqu'au bout sans une
seule erreur.

---

## 5. Ce que la reprise produit

### Vos propres contrôles

`reprise.controle` déclare **6 écarts, tous expliqués** — ce sont des pertes
assumées, pas des défauts :

| étape | écart | motif |
|---|---|---|
| `core.note` | 5 069 | 51 007 sources fondues en 45 938 notes par empreinte de contenu |
| `activation_comptes` | 4 159 | comptes dormants : aucun `auth.users` sur une base neuve |
| `restauration` | 20 | contacts sans nom ni courriel dans `public.equipe` |
| `core.tache` | 16 | notifications orphelines (`task_id` nul), perte déclarée |
| `salaire` | 2 | mandats à salaire min > max |
| `agent` | 2 | les mêmes, écartés par `mandat_salaire_ordre` |

### Comparaison avec le dev

| table | répétition | dev | écart |
|---|---|---|---|
| `entreprise` | 850 | 850 | — |
| `collaborateur` | 42 | 42 | — |
| `fiche_talent` | 7 023 | 7 023 | — |
| `mandat` | 533 | 533 | — |
| `candidature` | 7 236 | 7 237 | −1 |
| `placement` | 227 | 227 | — |
| `tache` | 1 136 | 1 136 | — |
| `analyse` | 501 | 501 | — |
| `contact_client` | 523 | 525 | −2 |
| `note` | 50 775 | 45 713 | **+5 062** |

**7 tables sur 10 reproduisent le dev à la ligne près.**

Les trois écarts s'expliquent : les deux contacts sont les lignes neutralisées
et leur candidature ; les notes sont **plus nombreuses parce que la répétition
reflète le miroir d'aujourd'hui**, tandis que le `core` du dev a été construit
le 08/09 et n'a pas été reconstruit depuis (45 938 de la reprise + 4 837 des
colonnes qualitatives de la fiche = 50 775, exactement).

---

## 6. Ce qu'il reste à décider

**La reprise doit-elle survivre aux données sales ?**

Deux gestes, et je recommande les deux :

1. **Rendre `20260908201003` défensive** — écarter ce qui n'est pas une adresse
   et le **consigner dans `reprise.controle`** plutôt que de le perdre en
   silence.

   ⚠ Cela demande de **modifier une migration déjà poussée**, contraire à la
   règle 1 de `CONTRIBUTING.md`. L'exception se défend : cette migration n'a
   jamais tourné sur sa cible, et une reprise qui tombe sur deux lignes sur
   sept mille n'est pas déployable. À décider explicitement, pas à glisser.

2. **Corriger les deux fiches dans Bubble** — une adresse LinkedIn dans un
   champ courriel est une vraie perte d'information, et n8n réimportera la
   faute suivante.

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
- Données extraites du **dev**, jamais du live.
- Base locale isolée, ports décalés de 1000, conteneur nommé
  `pachamama-repetition`.
- **Aucune écriture sur la production.**
