# Chantier — Le pivot vivant

> **Objectif** : le pivot tourne et **s'auto-alimente** dès qu'une donnée change
> dans l'ATS ou dans l'app. Aujourd'hui il est un **instantané** figé au 21/07.
> À la fin de ce chantier, il est **courant**.
>
> Ce document est le plan de construction. Il dit quoi faire, dans quel ordre,
> et ce que chaque étape débloque.

---

## Ce qui existe déjà, et qu'on ne refait pas

Le moteur d'inclusion **n'est pas à écrire** : il existe et a tourné sur
30 829 dorés. L'architecture finale le dit explicitement — le script de
construction du pivot est *« le premier run du moteur d'inclusion continu, pas un
script jetable »*.

Le chantier consiste donc à le faire passer d'un **run unique sur export** à un
**service incrémental sur flux**. C'est un changement de régime, pas une
réécriture.

| Brique | État |
|---|---|
| Schéma `pivot`, 8 tables, RLS, vues qualité | ✅ en production, 30 829 dorés |
| Cascade de rapprochement + fermeture transitive | ✅ codée, mesurée (0 conflit sur 1 661 doubles clés) |
| Préséance R1 + provenance par champ | ✅ codée, auditée (0 violation) |
| Contrôles d'intégrité rejouables | ✅ 3 axes, écart nul |
| **Alimentation continue** | ❌ **c'est l'objet de ce chantier** |

---

## L'architecture cible

```
   ATS  ──(API lecture)──┐
                         ├──► CONNECTEUR ──► MOTEUR D'INCLUSION ──► PIVOT
   App  ──(API lecture)──┘      (watermark)   (cascade + préséance    (dorés)
                                               + journal conflits)
```

**Une décision d'architecture à acter, et je la recommande fermement.**

Le pivot lit **directement les API sources**, et non le miroir Supabase. Le
miroir reste un filet de sauvegarde utile, mais il a perdu **396 enregistrements
en silence** et n'a rien signalé. Faire dépendre la source de vérité d'un
composant dont le mode de défaillance est muet serait exactement le mauvais choix.
Le miroir garde sa fonction ; il ne devient pas un maillon du pivot.

---

## Étape 0 — Rotation du jeton d'API · **avant tout le reste**

Le jeton de l'API du no-code **a existé en clair** et n'a jamais été régénéré.
Ce chantier va s'en servir intensivement.

Ce n'est pas du travail en retard : c'est un risque ouvert, et il se ferme en
cinq minutes. **Aucune ligne de code avant.**

→ *Action de votre côté : régénérer le jeton, me le fournir dans `.env`.*

---

## Étape 1 — Lever l'angle mort de l'API sur `candidat`

**Le test qui doit précéder toute construction.**

Sur le type `mandat`, l'API du no-code n'exposait que 498 enregistrements sur
~633 : **environ un sur cinq était invisible au jeton**, à cause d'une règle de
confidentialité. La vérification équivalente sur `candidat` a été reportée et
jamais faite.

Si le même trou existe, **le pivot a été construit sur une vue partielle de
l'app**, et la synchronisation héritera du trou en le reproduisant à chaque run.

**Méthode** : croiser les références indirectes. Les enregistrements cités par
d'autres types (`process.Candidat`, `note.Candidat`, `job_actuel`) mais absents du
point d'accès révèlent l'écart. C'est la technique qui avait démasqué l'angle mort
sur `mandat`.

**Durée** : courte. **Conséquence** : structurante.

---

## Étape 2 — Trancher la règle d'écriture concurrente

Question ouverte n°2 de la note d'architecture, jamais tranchée.

Elle ne concerne pas deux sources différentes — la matrice de préséance s'en
charge. Elle concerne **la même source qui écrit deux fois** : deux recruteurs sur
la même fiche, ou **une synchronisation qui rejoue un état ancien**.

**Recommandation à valider** : retenir la version dont l'horodatage **à la source**
est le plus récent ; rejeter toute écriture plus ancienne que l'état courant.

Sans cette règle, un rejeu de synchronisation **régresse la donnée** — et un rejeu
arrive toujours.

→ *Décision attendue de votre part. Une phrase suffit.*

---

## Étape 3 — Le journal des valeurs écartées

Critère de sortie T3 non satisfait : la politique de conflit est *définie* mais
**pas journalisée**. La valeur perdante est abandonnée.

Une table `pivot.conflit` : talent, champ, valeur retenue et sa source, valeur
écartée et sa source, règle appliquée, horodatage.

**Pourquoi maintenant et pas après** : une synchronisation continue produit des
conflits en continu. Sans journal, on ne saura ni ce qui a été écarté, ni si le
moteur se comporte comme prévu. C'est l'instrument de mesure du chantier, il doit
exister avant ce qu'il mesure.

---

## Étape 4 — L'état de synchronisation, avec les leçons déjà payées

Une table `pivot.sync_etat` : une ligne par source, portant le curseur, le statut,
le dernier message d'erreur, le volume du dernier run.

**Quatre règles à encoder, chacune achetée par un incident réel :**

1. **Ne jamais avancer le curseur sur exception.** L'avancer à « maintenant »
   alors que rien n'a été ingéré rend les enregistrements antérieurs
   structurellement inatteignables. C'est ce qui a coûté 396 enregistrements.
2. **Reculer le curseur d'une milliseconde** sur les chemins de succès. La
   comparaison stricte `>` exclut l'enregistrement portant exactement la date du
   curseur, ainsi que tous ses ex æquo.
3. **Lire le total exact avant de commencer, et échouer bruyamment** si on ne
   l'atteint pas. Une condition d'arrêt confiante avait fait écrire 13 073
   enregistrements au lieu de 19 381, sans lever d'erreur.
4. **Pagination déterministe**, avec départage par identifiant.

**La supervision porte sur des invariants de données, pas sur la disponibilité.**
Cinq des six incidents du projet étaient des défaillances **silencieuses** : le
système répondait « ok ». Une sonde de disponibilité n'en aurait vu aucune.

---

## Étape 5 — Le connecteur app → pivot

Le premier des deux, parce que **l'accès existe déjà**.

- lecture incrémentale sur la date de modification, curseur géré par l'étape 4 ;
- passage de chaque enregistrement entrant dans le **moteur d'inclusion** :
  rapprochement par la cascade contre les dorés existants, puis fusion avec
  préséance et journalisation des conflits ;
- écriture **idempotente** : rejouer un run ne duplique rien et ne régresse rien.

**Premier bénéfice mesurable** : les **114 candidats** vivants dans l'app mais
absents du pivot — tous créés après l'extraction — sont rattrapés au premier run.
C'est le contrôle de recette naturel de cette étape.

---

## Étape 6 — Le connecteur ATS → pivot

Identique dans sa structure, **dès que les accès arrivent**.

Deux gains qui ne dépendent que de la lecture :

- **la fraîcheur** de l'identité, de la localisation et de l'employeur — le champ
  qui diverge deux fois sur trois ;
- **la complétude du socle** : l'export plat n'a ni résumé, ni photo, ni parcours
  daté, alors que la matrice attribue ces champs à l'ATS. L'API live les apporte.

→ *Action de votre côté : fournir un accès en lecture. L'écriture n'est pas
nécessaire à cette étape.*

---

## Étape 7 — L'ordonnancement

Ce qui déclenche les runs : une cadence régulière suffit pour commencer, un
déclenchement par événement si les sources l'offrent.

Trois propriétés à tenir : **idempotence** (un run rejoué ne change rien),
**isolement** (deux runs ne se marchent pas dessus), **traçabilité** (chaque run
laisse son volume et son verdict).

---

## Étape 8 — Les contrôles de recette, rejouables

Les mêmes qu'à la tâche 4, transformés en contrôle **périodique** :

| Contrôle | Seuil |
|---|---|
| Réconciliation source ↔ pivot, par identité de clés | écart nul |
| Audit de préséance contre la source | 0 violation |
| Concordance des fusions, nom en témoin | ≥ 95 % |
| Écart de fraîcheur source ↔ pivot | sous seuil, mesuré |

**La méthode compte autant que le résultat** : l'audit de préséance se fait
**contre la source**, jamais contre le pivot — auditer un résultat avec lui-même
ne prouve rien. Et le nom reste **témoin** parce que la cascade ne fusionne jamais
dessus.

---

## Ce que ce chantier ne couvre pas, et pourquoi

| Hors périmètre | Raison |
|---|---|
| **Sens pivot → producteurs** | exige un accès en **écriture** à l'ATS. La lecture suffit à rendre le pivot courant ; l'écriture sert à le rendre maître. Deux objectifs distincts. |
| **Règle R2** (valeur vérifiée humain) | le flag n'existe pas dans l'app : c'est un **changement produit**, pas de base de données. Bascule en phase 2. |
| **`notes_bloc`** | critère T2 réel, mais sans effet sur l'auto-alimentation. À faire, hors de ce chantier. |
| **Seeding de l'`externalId`** | exige l'écriture. Le rapprochement fonctionne sans, avec 0 conflit mesuré sur 1 661 doubles clés. |
| **Cadrage RGPD** | instruction longue, à lancer en parallèle, bloquante avant **mise en production** — pas avant la construction. |

---

## Definition of Done

- [ ] Une modification dans l'app se retrouve dans le pivot au run suivant.
- [ ] Une modification dans l'ATS aussi *(dès accès fourni)*.
- [ ] Deux sources en désaccord sur un champ : la préséance tranche, **et le
      conflit est journalisé**.
- [ ] Un run rejoué ne duplique rien et ne régresse rien.
- [ ] Un run interrompu ne perd rien : le curseur n'a pas avancé.
- [ ] Les 114 candidats absents sont rattrapés.
- [ ] Les contrôles de recette passent après chaque run.
- [ ] Aucune défaillance silencieuse : tout écart lève une erreur visible.

---

## Ce que j'attends de vous, et quand

| Quand | Quoi |
|---|---|
| **Avant l'étape 1** | le **jeton régénéré** |
| **Avant l'étape 5** | la **règle d'écriture concurrente** tranchée (une phrase) |
| **Avant l'étape 6** | un **accès en lecture à l'ATS** |
| En parallèle, sans bloquer | les 4 arbitrages ouverts, le lancement du cadrage RGPD |

Le reste ne dépend que du travail.
