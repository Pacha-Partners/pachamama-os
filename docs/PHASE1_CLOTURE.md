# Phase 1 — Base talent unifiée : ce qu'il reste pour la boucler

> Établi le 20/08/2026 en confrontant les **30 critères de sortie** des cinq
> tâches, **les questions ouvertes de la note d'architecture (T1 §9)**, les points
> à arbitrer de la T3 et la section « ce qui reste » de l'architecture finale
> (T4 §6-8) à ce qui existe réellement en base, dans le code et dans les documents.
>
> ⚠️ Une première version de ce document, écrite le matin même, ne couvrait que
> les critères de sortie. Elle manquait la moitié du travail restant : le cadrage
> RGPD, la complétude du socle, la règle d'écriture concurrente, l'angle mort de
> l'API et trois arbitrages. Le présent document les intègre.

---

## Vue d'ensemble

| | Nature | Bloquant pour clore la phase ? |
|---|---|---|
| **A.** Six arbitrages à trancher | décision | oui — plusieurs chantiers en dépendent |
| **B.** Cadrage RGPD | décision + juridique | **oui avant toute mise en production** |
| **C.** Complétude du socle (résumé, photo, parcours daté) | technique, dépend de l'API du fournisseur | oui |
| **D.** Journal des valeurs écartées | technique, sans dépendance | oui — critère T3 |
| **E.** `notes_bloc` | technique, sans dépendance | oui — critère T2 |
| **F.** Règle d'écriture concurrente | technique, sans dépendance | oui — prérequis T5 |
| **G.** Angle mort de l'API sur `candidat` | vérification | oui avant production |
| **H.** T5-a — l'API d'accès | technique | oui |
| **I.** R2 — valeur vérifiée humain | **exige un changement produit dans l'app** | **non — bascule en phase 2** |
| **J.** T5-b — sync bidirectionnelle | bloqué par un tiers | non — dépendance externe assumée |
| **K.** Files de revue qualité | exploitation continue | non |
| **L.** Rotation du jeton d'API | **sécurité** | oui, et urgent |

---

## A. Les six arbitrages à trancher

Cinq viennent des documents T1/T2, un de la T3. Deux ont été tranchés **par
l'implémentation** sans que les documents soient mis à jour.

### Déjà tranchés, à consigner

| Sujet | Décision effective | Où c'est visible |
|---|---|---|
| **Genre** (79 %) | **écarté** — minimisation RGPD | commentaire du schéma, ligne 151 |
| **Portfolio** (2,3 %) | **écarté en v0** | matrice de préséance T3 |
| **Journal de notes brut** | **conservé, dans le pivot** | table `note_journal`, 19 381 lignes |

### Réellement ouverts

| Sujet | La question | Recommandation d'origine |
|---|---|---|
| **Statut talent** (49 %) | un statut talent doit-il vivre au pivot, ou `qualification.niveau_qualifie` suffit-il ? | — |
| **Tags libres** (0,6 %) | porter au pivot ou garder côté app ? | ne porter que les tags à valeur transverse (sourcing, matching) |
| **Business maker** (0,2 %) | porter et réalimenter, ou écarter ? | — |
| **Coordonnée « préférée »** | quand les deux sources proposent un email ou un téléphone, lequel fait défaut ? le plus récent, ou celui confié au recruteur ? | — |

⚠️ La **coordonnée préférée** est celle que j'avais manquée, et c'est la plus
concrète des quatre : sans elle, une interface qui affiche « l'email » d'un talent
choisit arbitrairement.

---

## B. Le cadrage RGPD — le chantier le plus lourd, et le plus oublié

La note d'architecture le pose : **le pivot constitue un nouveau traitement de
données personnelles.** Non bloquant pour la conception, **bloquant avant toute
mise en production**. Quatre points à instruire avec la direction :

1. **La base légale des 24 367 profils issus du seul ATS.** Ce sont des personnes
   **sans relation avec le cabinet**, dont on crée une nouvelle copie chez
   Pachamama. C'est le point le plus sérieux du dossier RGPD, et il n'est pas
   instruit.
2. **Le statut du fournisseur** : provider ou sous-traitant au sens du règlement ?
   La réponse change les obligations contractuelles.
3. **La politique de rétention et de purge** : combien de temps garde-t-on un
   talent sans relation active ?
4. **Le droit à l'effacement propagé aux producteurs**, et la mise à jour du
   registre des traitements.

Ce qui est **déjà acquis** et qui plaide en votre faveur : la minimisation est
appliquée (le genre n'est pas chargé du tout), l'anonymisation du livrable est
déterministe et non réversible, et le cloisonnement est garanti au niveau du
moteur de base.

---

## C. Le socle est partiel — trois familles de champs manquent

L'architecture finale le dit : **l'export plat n'a ni résumé, ni photo, ni
parcours daté.** La matrice de préséance attribue pourtant ces champs à l'ATS.

Conséquence : le modèle cible n'est pas entièrement rempli, et les vues qui
s'appuieraient dessus (fiche talent 360, matching sémantique) travailleraient sur
un socle incomplet.

**Le combler exige l'API live du fournisseur**, pas l'export en fichier. Même
dépendance que la synchronisation — mais en **lecture seule**, ce qui est
potentiellement plus facile à obtenir qu'un accès en écriture.

---

## D. Le journal des valeurs écartées

Critère T3 : « la politique de conflit tranche de façon **définie et
journalisée** ». Elle est définie et déterministe. Elle **n'est pas journalisée** :
la valeur perdante est abandonnée.

On sait d'où vient chaque valeur retenue — les colonnes `*_src` le portent — mais
**pas ce qui a été écarté ni pourquoi**. Le glossaire de la note d'architecture
définit d'ailleurs la provenance comme incluant « la valeur écartée ».

**À faire** : une table de conflits — talent, champ, valeur retenue et sa source,
valeur écartée et sa source, règle appliquée, horodatage. Prérequis à une
synchronisation auditable, donc **avant la T5**.

---

## E. `notes_bloc` : la génération n'a jamais été lancée

Critère T2 : « les notes sont **1 seul bloc** généré par LLM ».

La matière est sécurisée — **19 381 notes** dans `note_journal` — et c'était le
bon ordre : un bloc dérivé dont on a perdu la source est irréparable. La colonne
`talent.notes_bloc` existe et vaut `null`.

**À faire** : le service de consolidation, **régénérable**, avec traçage du coût
et plafond. Y verser aussi les contenus *legacy* de l'app
(`_del_Note_interne`, `_del_pachamama_personnalité`, `_del_Mindset`).

---

## F. La règle d'écriture concurrente

Question ouverte n°2 de la note d'architecture, jamais tranchée ni implémentée.

Elle ne concerne pas deux sources différentes — ça, c'est la matrice de préséance.
Elle concerne **la même source qui écrit deux fois** : deux recruteurs sur la même
fiche à quelques secondes, ou **une synchronisation qui rejoue un ancien état**.

Recommandation d'origine, à valider : retenir la version dont l'horodatage **à la
source** est le plus récent, et rejeter toute écriture plus ancienne que l'état
courant. Ça neutralise au passage les rejeux de synchronisation.

C'est un **prérequis de la T5** : sans cette règle, la synchronisation peut
régresser des données en rejouant un état périmé.

---

## G. L'angle mort de l'API sur `candidat`

Reporté en T4, **à lever avant mise en production**.

Le contexte : sur un autre type de données, l'API du no-code n'exposait qu'une
partie des enregistrements — environ un sur cinq restait invisible au jeton
employé. La vérification équivalente sur `candidat` n'a jamais été faite.

Si le même angle mort existe, **le pivot a été construit sur une vue partielle**
de l'app. C'est une vérification courte et son résultat est structurant.

---

## H. T5-a — L'API d'accès · faisable maintenant

Ce qui existe : 8 modules FastAPI, l'application des droits par `SET LOCAL ROLE`
avec injection des revendications vérifiées, un catalogue de filtres figé pour
qu'aucune chaîne venue d'HTTP n'atteigne le SQL, un endpoint de liste, deux de
santé, **6 tests de sécurité**.

Ce qui manque : la fiche détail d'un talent, la pagination et le tri sur les axes
réels du sourcing, le contrat documenté, des tests d'intégration contre un
PostgreSQL réel, le déploiement.

---

## I. R2 — reclassée en phase 2

**C'est la correction la plus importante de ce document.**

R2 dit : « une valeur vérifiée par un humain prime jusqu'à ce que la source qui
fait foi la contredise plus récemment ». Elle n'est pas implémentée.

Mais la T3 précise ce que je n'avais pas relevé : **le flag « vérifié humain »
n'existe pas dans l'app actuelle**, et le poser « demandera un geste explicite
côté producteur ».

Autrement dit, R2 n'est pas un chantier de base de données : c'est **un
changement produit** — il faut que l'interface permette à un recruteur de marquer
une valeur comme vérifiée. Cela appartient à la **phase 2**, et la phase 1 peut se
clore sans, à condition de l'écrire comme une dépendance et non comme un oubli.

En attendant, la conséquence reste réelle et doit être connue : une information
vérifiée en entretien peut être écrasée par une donnée d'ATS périmée.

---

## J. T5-b — La synchronisation · bloquée par un tiers

Exige un **accès en écriture** à l'ATS : seul un export en fichier est disponible.

Conséquence assumée : **le pivot est un instantané**. 114 candidats vivants dans
l'app en sont absents, tous créés après l'extraction du 21/07.

**Ce qui reste faisable sans le tiers** : le sens **app → pivot**, dont nous avons
l'accès. Il couvrirait les 114 absents et empêcherait l'écart de croître.

À noter aussi : le **seeding de l'`externalId`** — écrire l'identifiant de l'app
dans les profils de l'ATS — donnerait un matching déterministe pour toujours.
Il exige lui aussi l'écriture, donc même blocage.

---

## K. Files de revue qualité

Interrogeables par les vues `qa_*` plutôt que consignées dans un document qui périme.

| File | Volume |
|---|---|
| Talents sans aucun moyen de contact | **7 013** |
| Clusters à plusieurs liens vers une même source | 387 |
| Emails génériques | 247 |
| Dorés sans identité exploitable | 65 |
| Clusters multi-ATS | 15 |
| Désaccords de fusion à examiner | 4 |

Plus une correction **à la source** : une fiche de l'app porte l'URL de profil
d'une autre personne. Le moteur a appliqué sa règle correctement.

---

## L. Sécurité — la seule urgence

**Le jeton de l'API du no-code a existé en clair et n'a jamais été régénéré.**
L'architecture finale le porte en « action requise » depuis la clôture de la T4.

Ce n'est pas du travail en retard, c'est un risque ouvert. À faire avant tout le reste.

---

## L'ordre que je propose

**Immédiat** — L. rotation du jeton.

**Décisions** (elles débloquent le reste) — A. les quatre arbitrages ouverts,
puis B. lancer l'instruction RGPD avec la direction, qui est longue et ne bloque
pas la conception.

**Technique sans dépendance** — F. la règle d'écriture concurrente, D. le journal
des conflits, E. `notes_bloc`, G. la vérification de l'angle mort.

**Ensuite** — H. l'API d'accès, puis C. la complétude du socle et J. le sens
app → pivot, tous deux fonction de ce qu'on obtient du fournisseur.

**Reclassé en phase 2** — I. la règle R2, qui exige un changement produit.

La phase 1 peut être déclarée close sans J (sens pivot → ATS), sans I, et avec un
C partiel — **à condition d'écrire ces trois points comme des dépendances
identifiées et non comme des oublis.** C'est la différence entre un périmètre
tenu et un périmètre raboté.
