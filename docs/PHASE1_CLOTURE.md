# Phase 1 — Base talent unifiée : ce qu'il reste pour la boucler

> Établi le 20/08/2026 en confrontant les **30 critères de sortie** des cinq
> tâches à ce qui existe réellement en base, dans le code et dans les documents.
> Les tâches 1 à 4 sont closes ; il reste **cinq chantiers**, dont un seul est
> bloqué par un tiers.

---

## Vue d'ensemble

| Tâche | Critères | État |
|---|---|---|
| T1 — Cadrage et architecture | 6/6 | ✅ **close** |
| T2 — Inventaire et modèle talent | 4/6 | ⚠️ **deux restes** |
| T3 — Moteur d'inclusion et préséance | 4,5/6 | ⚠️ **deux restes** |
| T4 — Réconciliation et migration | 6/6 | ✅ **close** — files de revue ouvertes |
| T5 — API d'accès et synchronisation | 1/6 | 🔨 **le gros du travail** |

---

## Chantier 1 — `notes_bloc` : la génération n'a jamais été lancée

**C'est un critère de sortie non satisfait de la T2** : « quand on regarde les
notes, alors elles sont **1 seul bloc** généré par LLM ».

État exact : la matière est en base — **19 381 notes** chargées dans
`note_journal`. La colonne `talent.notes_bloc` existe. Elle est remplie à `null`,
avec en commentaire « généré ultérieurement par le service LLM ».

Le chargement du journal avait été fait en priorité, et pour une bonne raison :
**un bloc dérivé dont on a perdu la source est irréparable**. La matière est donc
sécurisée. Il manque le service de consolidation.

**À faire** : un service qui, par talent, consolide ses notes en un bloc unique,
**régénérable** (la source reste), avec traçage du coût et un plafond. Y verser
aussi les contenus *legacy* récupérés de l'app (`_del_Note_interne`,
`_del_pachamama_personnalité`, `_del_Mindset`).

**Dépendance** : aucune. Faisable immédiatement.

---

## Chantier 2 — Trois arbitrages jamais tranchés

Les documents de la T2 portent encore **cinq marqueurs ⚖️**. Deux ont en réalité
été tranchés par l'implémentation sans que les documents soient mis à jour :

| Champ | Décision | Où elle est visible |
|---|---|---|
| `Genre` (79 %) | **écarté** — minimisation RGPD | commentaire du schéma, ligne 151 |
| `Portfolio_file` (2,3 %) | **écarté en v0** | matrice de préséance T3 |

**Trois restent ouverts**, et sont absents du schéma faute de décision :

| Champ | Remplissage | La question |
|---|---|---|
| **Statut talent** (`_del_Statut`) | 49,3 % | un statut talent doit-il vivre au pivot ? La colonne `statut_jarvi` existe, mais elle porte le statut de l'ATS, pas celui de Pachamama |
| **Tags libres** | 0,6 % | porter au pivot, ou abandonner un champ quasi vide ? |
| **Business maker** | 0,2 % | concept propre au cabinet mais quasi vide : porter et réalimenter, ou écarter ? |

**À faire** : trancher les trois, puis **mettre les documents à jour** — y compris
pour les deux déjà décidés. Un document qui affiche « à arbitrer » sur une
question réglée fait perdre du temps à chaque relecture.

**Dépendance** : une décision de votre part. Pas de code tant qu'elle n'est pas prise.

---

## Chantier 3 — La règle R2 n'est pas implémentée

Le moteur de préséance tient en quatre lignes et applique **R1** : une source qui
fait foi ne peut pas écraser une valeur existante par du vide. C'est codé,
exécuté sur les 30 829 dorés, et audité contre l'export source — **136
occurrences, 0 violation**.

**R2 est absente** : « une valeur vérifiée par un humain prime jusqu'à ce que la
source qui fait foi la contredise plus récemment ».

Pourquoi ça compte : un recruteur apprend un changement de poste **en entretien**
et le saisit dans l'app ; LinkedIn ne le reflète pas encore. Aujourd'hui l'ATS
gagne, donc **l'information vérifiée est écrasée par une donnée périmée**. Sur un
champ qui diverge deux fois sur trois, ce n'est pas un cas d'école.

**À faire** : un indicateur « vérifié humain » porté par la provenance, une
comparaison sur la **date de l'événement** (pas la date de saisie ni de scrape),
bornée par `max(date de saisie, date de scrape)` pour qu'une date postdatée ne
puisse pas primer, et l'ordre de départage déterministe déjà spécifié en T3.

**Dépendance** : exige que la source porte l'information « vérifié humain ».
À vérifier dans l'app avant de coder.

---

## Chantier 4 — Le journal des valeurs écartées

Le critère T3 dit : « la politique de conflit tranche de façon **définie et
journalisée** ». Elle est définie et déterministe. Elle **n'est pas journalisée** :
la valeur perdante est simplement abandonnée.

Conséquence : on sait d'où vient chaque valeur retenue, mais **pas ce qui a été
écarté ni pourquoi**. Le document T3 promet un enregistrement « auditable,
déterministe et sans perte silencieuse » — les deux premiers sont tenus, le
troisième ne l'est pas.

**À faire** : une table de conflits — talent, champ, valeur retenue et sa source,
valeur écartée et sa source, règle appliquée, horodatage. C'est aussi ce qui
rendra la synchronisation de la T5 auditable, donc à faire **avant** elle.

**Dépendance** : aucune. Faisable immédiatement.

---

## Chantier 5 — La tâche 5, à couper en deux

### T5-a — L'API d'accès · **faisable maintenant**

Ce qui existe : 8 modules FastAPI (477 lignes), l'application des droits par
`SET LOCAL ROLE` avec injection des revendications vérifiées, un catalogue de
filtres figé pour qu'aucune chaîne venue d'HTTP n'atteigne le SQL, un endpoint de
liste et deux de santé, et **6 tests de sécurité**.

Ce qui manque : la fiche détail d'un talent, la pagination et le tri sur les axes
réels du sourcing, le **contrat d'API documenté**, des tests d'intégration contre
un PostgreSQL réel, et le déploiement.

Un critère T5 est déjà satisfait : « quand on lit un talent via l'API, alors on
obtient l'enregistrement doré » — c'est la nature même du pivot.

### T5-b — La synchronisation bidirectionnelle · **bloquée**

Exige un **accès en écriture à l'ATS**, dont nous ne disposons pas : seul un
export en fichier est disponible. Ce goulot ne se lève pas par plus de travail,
mais par une négociation avec un tiers.

Conséquence assumée : **le pivot est un instantané**. 114 candidats vivants dans
l'app en sont absents, tous créés après l'extraction du 21/07. Ce n'est pas une
perte — c'est la démonstration que la base a besoin de la synchronisation pour
rester courante.

**Ce qui reste faisable sans l'ATS** : le sens **app → pivot**, dont nous avons
l'accès. Il couvrirait déjà les 114 absents et empêcherait l'écart de croître.

---

## Files de revue ouvertes (T4 close, mais elles vivent)

Interrogeables par les vues `qa_*` plutôt que consignées dans un document qui
périme :

| File | Volume |
|---|---|
| Talents sans aucun moyen de contact | **7 013** |
| Clusters à plusieurs liens vers une même source | 387 |
| Emails génériques (contact@, info@…) | 247 |
| Dorés sans identité exploitable | 65 |
| Désaccords de fusion à examiner | 4 |

Plus une correction **à la source** : une fiche de l'app porte l'URL de profil
d'une autre personne. Le moteur a appliqué sa règle correctement — l'erreur est
dans la donnée saisie.

---

## L'ordre que je propose

1. **Trancher les trois arbitrages** — ils ne coûtent qu'une décision, et le
   chantier 1 comme le 3 peuvent en dépendre.
2. **Le journal des valeurs écartées** — sans dépendance, et prérequis à une
   synchronisation auditable.
3. **`notes_bloc`** — sans dépendance, et c'est un critère de sortie de la T2.
4. **R2** — après vérification que la source porte l'information « vérifié humain ».
5. **T5-a, l'API** — c'est elle qui fait passer les vues de l'app de
   « démonstration » à « application ».
6. **T5-b, le sens app → pivot** — la moitié faisable de la synchronisation.

Le sens pivot → ATS reste ouvert tant que l'accès en écriture n'est pas obtenu.
**La phase 1 peut être déclarée close sans lui**, à condition de l'écrire comme
une dépendance externe et non comme un oubli.
