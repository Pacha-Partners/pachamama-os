# Chantier du jour — 20/08/2026 · Rendre le pivot courant

> **L'objectif de la journée, formulé comme un test qu'on peut faire passer :**
>
> *Je modifie un candidat dans l'app. Au run suivant, le pivot porte la
> modification. Si les deux sources se contredisaient, la préséance a tranché et
> le conflit est écrit dans un journal.*
>
> Le pivot est aujourd'hui un instantané figé au 21/07. Ce soir, il se met à jour
> tout seul sur au moins une source.

---

## Le déroulé

Sept étapes. Les durées sont des ordres de grandeur, pas des engagements.

### 0 · Rotation du jeton — **reportée, décision du 20/08**

Le jeton actuel est un **jeton maître** : il contourne les règles de
confidentialité de l'outil. Il a existé en clair dans des scripts.

**Vérifié ce matin** : aucune fuite publique. Le dossier n'est sous aucun dépôt
git, le jeton n'apparaît dans aucun commit ni fichier suivi, et aucun script ne
le porte en dur — ils le lisent tous depuis l'environnement.

**Décision : reportée.** Le risque actuel est théorique — pas de fuite, et le
jeton ne sert aujourd'hui qu'à **lire**. La manipulation de jetons dans l'outil
no-code est fastidieuse et ralentirait le chantier sans réduire de risque réel.

**Le seuil qui la rend non négociable est identifié : le dual-write.** Le jour où
le pivot écrit vers les producteurs, le même jeton passe de la lecture à
l'écriture — une compromission cesserait d'être une fuite de données pour devenir
une corruption de la production. À faire **avant** cette bascule, pas après.

**Preuve, le jour venu** : l'ancien jeton renvoie 401, le nouveau répond, et les
identifiants n8n sont à jour des deux côtés.

---

### 1 · Lever l'angle mort de l'API sur `candidat` — *moi, ~45 min*

**L'étape que je ne veux pas sauter.**

Sur le type `mandat`, l'API n'exposait que 498 enregistrements sur ~633 :
**un sur cinq était invisible au jeton**. La vérification équivalente sur
`candidat` a été reportée en T4 et jamais faite.

Si le même trou existe, le pivot a été bâti sur une vue partielle de l'app — et
la synchronisation le reproduirait à chaque run, en silence.

**Méthode** : croiser les références indirectes. Les candidats cités par
`process`, `note` ou `job_actuel` mais absents du point d'accès révèlent l'écart.
C'est la technique qui avait démasqué l'angle mort sur `mandat`.

**RÉSULTAT — 20/08, aucun angle mort.**

```
candidats visibles dans la liste     7 006
candidats cités par process /
  job_actuel / experience            7 006
cités mais ABSENTS de la liste           0
```

La couverture est totale, pas échantillonnée : `job_actuel` étant en 1-1 avec
`candidat`, le croisement porte sur 100 % des candidats. Le pivot n'a donc pas
été bâti sur une vue partielle de l'app.

Réserve : un candidat cité par aucun des trois types **et** caché échapperait au
test. Un tel enregistrement est inerte, et les comptes s'égalisent exactement.

Script rejouable : `Bubble migration/verif_angle_mort_candidat.py`.

**Effet de bord relevé** : le type `note_archivee` renvoie 404 — il n'est **pas
exposé** à l'API, alors qu'il porte ~25 000 notes archivées. À instruire hors de
ce chantier.

---

### 2 · Trancher la règle d'écriture concurrente — *vous, 1 min*

Deux recruteurs modifient la même fiche à quelques secondes. Ou une
synchronisation rejoue un état ancien. Que fait le pivot ?

**Recommandation** : retenir la version dont l'horodatage **à la source** est le
plus récent, et rejeter toute écriture plus ancienne que l'état courant.
Ça neutralise au passage les rejeux.

Sans cette règle, un rejeu **régresse la donnée**. Et un rejeu arrive toujours.

---

### 3 · Le journal des valeurs écartées — *moi, ~30 min*

Table `pivot.conflit` : talent, champ, valeur retenue et sa source, valeur
écartée et sa source, règle appliquée, horodatage.

**Pourquoi avant le connecteur et pas après** : une synchronisation continue
produit des conflits en continu. Sans journal, on ne saura ni ce qui a été écarté,
ni si le moteur se comporte comme prévu. C'est l'instrument de mesure du chantier
— il doit exister avant ce qu'il mesure.

**Preuve** : la table existe, sous RLS comme le reste du schéma, et le moteur y
écrit lors d'un test de conflit fabriqué.

---

### 4 · L'état de synchronisation — *moi, ~1 h*

Table `pivot.sync_etat` : une ligne par source, avec curseur, statut, dernier
message d'erreur, volume du dernier run.

**Quatre règles à encoder, chacune payée par un incident réel :**

| Règle | L'incident qui l'a achetée |
|---|---|
| Ne jamais avancer le curseur sur exception | 396 enregistrements devenus inatteignables |
| Reculer le curseur d'une milliseconde | la comparaison stricte exclut l'enregistrement pivot et ses ex æquo |
| Lire le total exact d'abord, échouer bruyamment sinon | 13 073 notes écrites au lieu de 19 381, sans erreur |
| Pagination déterministe, départage par identifiant | pages instables entre deux appels |

**Preuve** : un run interrompu volontairement ne fait pas avancer le curseur.

---

### 5 · Le connecteur app → pivot — *moi, ~2 à 3 h · le cœur de la journée*

- lecture incrémentale sur la date de modification, curseur géré par l'étape 4 ;
- chaque enregistrement entrant passe dans le **moteur d'inclusion** existant :
  rapprochement par la cascade contre les dorés, puis fusion avec préséance et
  journalisation des conflits ;
- écriture **idempotente** : rejouer ne duplique rien, ne régresse rien.

**Preuve, et elle est déjà écrite** : les **114 candidats** vivants dans l'app et
absents du pivot — tous créés après l'extraction du 21/07 — sont rattrapés au
premier run. C'est le contrôle de recette naturel.

---

### 6 · Les contrôles de recette — *moi, ~1 h*

Les contrôles de la tâche 4, transformés en contrôle **périodique** :

| Contrôle | Seuil |
|---|---|
| Réconciliation source ↔ pivot, par **identité de clés** | écart nul |
| Audit de préséance **contre la source** | 0 violation |
| Concordance des fusions, **nom en témoin** | ≥ 95 % |
| Écart de fraîcheur | mesuré, sous seuil |

La méthode compte autant que le résultat : l'audit se fait **contre la source**,
jamais contre le pivot — auditer un résultat avec lui-même ne prouve rien.

---

### 7 · Le connecteur ATS → pivot — *si vos accès arrivent, ~2 h*

Même structure que l'étape 5. Deux gains qui ne dépendent que de la **lecture** :

- la **fraîcheur** de l'identité, de la localisation et de l'employeur — le champ
  qui diverge deux fois sur trois ;
- la **complétude du socle** : l'export plat n'a ni résumé, ni photo, ni parcours
  daté, alors que la matrice attribue ces champs à l'ATS.

---

## Ce qu'on ne fait **pas** aujourd'hui

Écrit noir sur blanc pour protéger le périmètre.

| Écarté | Raison |
|---|---|
| **Sens pivot → producteurs** | exige l'écriture chez le fournisseur. La lecture rend le pivot *courant* ; l'écriture le rendrait *maître*. Deux objectifs. |
| **Règle R2** | exige un flag « vérifié humain » qui n'existe pas dans l'app : c'est un changement produit, pas de base de données. |
| **`notes_bloc`** | vrai critère T2, mais sans effet sur l'auto-alimentation. |
| **Seeding `externalId`** | exige l'écriture. Le rapprochement s'en passe : 0 conflit sur 1 661 doubles clés. |
| **Cadrage RGPD** | instruction longue, à lancer en parallèle. Bloquant avant *mise en production*, pas avant la construction. |
| **Les 4 arbitrages ouverts** | ils ne bloquent pas l'auto-alimentation. À trancher quand vous voulez. |

---

## Definition of Done de la journée

- [ ] Une modification faite dans l'app se retrouve dans le pivot au run suivant.
- [ ] Un run rejoué ne duplique rien et ne régresse rien.
- [ ] Un run interrompu ne perd rien : le curseur n'a pas avancé.
- [ ] Les 114 candidats absents sont rattrapés.
- [ ] Un conflit de préséance est **écrit dans le journal**, pas seulement tranché.
- [ ] Les contrôles de recette passent.
- [ ] L'angle mort de l'API sur `candidat` est **mesuré** — nul ou chiffré.
- [ ] Aucune défaillance silencieuse : tout écart lève une erreur visible.

---

## Le seul risque sérieux de la journée

**L'étape 1.** Si l'API cache une partie des candidats, tout ce qui suit est bâti
sur une vue partielle, et le chantier devient d'abord un chantier d'exposition
côté outil no-code — ce qui dépend de vos règles de confidentialité, donc de vous.

C'est pour ça qu'elle est en premier et qu'elle ne coûte que 45 minutes.
