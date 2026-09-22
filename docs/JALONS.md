# Les jalons, et la phase que chacun ouvre

Arrêté le 22/09/2026. **Maille unique du projet : `J1` à `J7`.**

Ce document est le point d'attache qui manquait. Jusqu'ici les jalons vivaient
dans `DECOUPAGE_PHASE2.md`, les phases dans `PHASES.md`, et **aucun des deux ne
nommait l'autre** — zéro occurrence de « jalon » dans `PHASES.md`, zéro
occurrence d'« alpha » dans les tickets.

**Les critères de sortie de phase ne sont écrits qu'ici.** Ils étaient auparavant
dans deux documents, en trois formulations qui avaient divergé.

---

## 0. Le principe de lecture

> **Les phases définissent le calendrier. Les jalons en sont le contenu.**

La date d'ouverture d'une phase est une **décision** ; le périmètre est ce qui
s'y ajuste. C'est l'inverse d'un planning qui attend que le code soit « prêt » —
question à laquelle personne ne sait répondre honnêtement, parce que personne ne
sait dire si on est à 85 % ou à 91 %.

Un jalon n'existe donc pas pour lui-même : **il existe parce qu'il conditionne
l'ouverture d'une phase.** Un chantier qui n'ouvre aucune phase n'a pas sa place
dans le calendrier.

Quatre axes alimentent les portes. Trois sont réversibles, un ne l'est pas :

| axe | ce qui le fait avancer | réversible |
|---|---|---|
| le code | une fusion dans `dev` | oui |
| la livraison | `dev` → `recette` → `main` | oui |
| **les données** | des migrations | **non — le schéma ne recule pas** |
| l'exposition | une ligne dans `app.acces` | on referme le robinet, on n'efface pas ce qui a été vu |

## 1. Ce que ce document remplace

| découpage | où | statut |
|---|---|---|
| `LOT 0` … `LOT 3` | `PLAN_PORTAILS.md` | **périmé** — conservé pour l'historique |
| `T1` … `T5` | `PROJET.md` | **périmé** — conservé pour l'historique |
| `J1` … `J7` | `DECOUPAGE_PHASE2.md` + `docs/tickets/` | **la maille** |

`J1`–`J7` l'emporte pour trois raisons mesurées : c'est le seul découpage qui
porte des **critères d'acceptation testables** (54, écrits en « Quand… alors… »),
le seul dont les tickets existent, et le seul dont la numérotation suit déjà
celle des harnais.

## 2. Le lien jalon ↔ harnais : une convention réelle, une couverture qui ne l'est pas

**La numérotation correspond**, et c'est un acquis qui ne demande rien :

| jalon | harnais | appels de contrôle déclarés |
|---|---|---|
| `J1` Job Board public | `j1` | 10 |
| `J2` Authentification et rattachement | `j2` | 10 |
| `J3` Portail Entreprise | `j3` + `j3-ecrans` | 30 + 56 |
| `J4` Espace Talent | `j4` + `j4-ecrans` | 99 + 108 |
| `J5` `J6` `J7` | **aucun** | **0** |
| | **total** | **313** |

⚠ **Le chiffre de 319 qui circulait comptait les déclarations.** Chacun des six
fichiers définit sa propre fonction `verifier(…)` ; le comptage par `grep` les
additionnait aux appels. 313 + 6 = 319. Et le nombre rapporté **à l'exécution**
est encore plus bas : trois des dix appels de `j1` sont des branches d'échec, qui
ne se jouent que si quelque chose casse.

### Ce que la correspondance ne garantit pas

Les harnais **n'ont pas été écrits contre les critères**. Mesuré aujourd'hui :

| | |
|---|---|
| **`J1`** | ses deux premiers critères portent sur la **page rendue** (« quand on ouvre `/offres`, alors 12 offres réelles s'affichent »). `j1` n'ouvre aucune URL : il interroge `api.offre_publique` par PostgREST. Et **il n'existe pas de `j1-ecrans`**, alors que `J3` et `J4` en ont un chacun. |
| **`J2`** | son critère 2 nomme `api.auth_entreprise_id()` et `api.auth_talent_id()`. **Ces deux fonctions n'existent nulle part** — 0 occurrence dans les 127 migrations et dans le frontend. La seule fonction d'identité construite est `api.compte_id`. Le critère est écrit contre une API qui n'a jamais été bâtie. |
| **`J3`** | son critère 6 exige que la décision se retrouve **aux trois endroits** : relue dans l'app, reçue par l'Account Manager, présente en note côté ATS. Seul le premier existe : `api.decider_candidature` écrit dans PostgreSQL et n'en sort pas. |

**Donc la règle « ce qu'une phase éprouve, ce sont les critères d'acceptation des
jalons qu'elle ouvre » est une convention à honorer, pas un état à constater.**
C'est le premier travail du chantier, et il est concret : confronter les 54
critères au code, réécrire ceux qui visent une API inexistante, et écrire les
contrôles manquants.

⚠ **Conséquence pour l'alpha 2** : `J5`, `J6` et `J7` portent **25 critères** et
aucun harnais. `j5` à `j7` se construisent **avec** les écrans, pas après.

## 3. Les sept jalons — état du code mesuré le 22/09/2026

*(Les chiffres de production du §5 viennent, eux, du relevé archivé du 21/09.)*

| jalon | ce qu'il rend possible | crit. | état du code | ouvre |
|---|---|---|---|---|
| **J1** Job Board public | 2 écrans publics sur données réelles | 7 | écrans construits | alpha 1 |
| **J2** Authentification et rattachement | connexion, résolution du compte, désactivation | 7 | construit | alpha 1 |
| **J3** Portail Entreprise | 7 écrans, 11 actions d'écriture | 8 | écrans construits | alpha 1 |
| **J4** Espace Talent | 7 écrans réels + 3 redirections, 12 actions | 7 | écrans construits | alpha 1 |
| **J5** Poste recruteur — consultation | priorisation, kanban, fiche 360 | 7 | **21 lignes, 0 composant** | alpha 2 |
| **J6** Poste recruteur — actions | note, transition d'étape, tâche | 9 | rien | alpha 2 |
| **J7** Back-office de gouvernance | surveillance, référentiels, RGPD, **administration des comptes** | 9 | **21 lignes, 0 composant** | alpha 2 |

⚠ **« construit » décrit le code, pas le jalon.** Les 54 cases sont cochées
**0 fois**, et l'échantillon du §2 montre que les cocher **n'est pas un simple
travail de relecture** : au moins un critère vise une API qui n'existe pas, et un
autre exige deux intégrations sorties de la base qui n'ont jamais été écrites.
Le travail de confrontation reste entier, et il révélera des manques.

**Ce qui manque encore sous J5/J6** : trois mécaniques transverses sans lesquelles
les écrans n'auraient rien à montrer — le déclencheur qui rend le journal
d'événements vivant, le moteur qui écrit les notifications de tâches, et
l'historique des transitions d'étape, sans lequel aucune durée n'est calculable.

## 4. Les quatre phases

### Alpha 1 — les deux portails clients

| | |
|---|---|
| **qui entre** | le cabinet, et personne d'autre |
| **où** | branche `recette`, projet Supabase **dev** |
| **ouvre sur** | `J1` `J2` `J3` `J4` — 29 critères |
| **on éprouve** | ces 29 critères, par les harnais `j1`–`j4` une fois leur couverture établie (§2), plus 5 parcours joués à la main |
| **le produit sait** | un client suit ses mandats et enregistre sa décision ; un talent postule, suit sa candidature et corrige ses attentes. **Le recrutement se conduit encore dans Bubble.** |
| **on en sort quand** | aucun défaut `bloquant` n'est `ouvert` dans `DEFAUTS.md`, **et** les six harnais sont au vert, **et** les 29 critères sont confrontés au code |

**Ce que cette phase ne peut PAS dire** : si un client trouve son pipeline
lisible. Le cabinet n'est l'utilisateur d'aucun des deux portails. L'alpha 1
éprouve la **mécanique**, pas l'**usage**.

### Alpha 2 — les vues internes

| | |
|---|---|
| **qui entre** | les recruteurs — cette fois les **vrais** usagers |
| **où** | branche `recette`, projet Supabase **dev** |
| **ouvre sur** | `J5` `J6` `J7` — 25 critères |
| **on éprouve** | ces 25 critères — **les harnais `j5`–`j7` sont à construire** |
| **le produit sait** | un recruteur conduit un mandat de bout en bout sans ouvrir Bubble |
| **on en sort quand** | un recruteur a conduit **un mandat réel** de bout en bout sans ouvrir Bubble, et aucun défaut `bloquant` n'est `ouvert` |

C'est la phase la plus informative des deux alphas : « est-ce que ça marche » et
« est-ce que ça sert » y ont le même juge. Et sa sortie est **la seule des trois
qui s'observe directement** — un mandat mené, ou pas.

### Beta — de vraies personnes

| | |
|---|---|
| **qui entre** | des clients et des talents nommés, prévenus, peu nombreux |
| **où** | branche `main`, projet Supabase **live** |
| **ouvre sur** | **aucun jalon neuf** — voir §5 |
| **on éprouve** | ce qu'aucune alpha ne dira : le volume et la forme réelle — un kanban à deux cents candidatures, un intitulé à rallonge, une fiche sans CV depuis 2019, un navigateur qu'on n'a pas |
| **le produit sait** | tenir le travail réel. Bubble cesse d'être le maître, par client ou en une fois. |
| **on en sort quand** | **aucun défaut signalé en beta n'est `ouvert`** — quelle que soit sa gravité, y compris `gênant` et `cosmétique` — et on accepterait d'ouvrir à tous sans prévenir personne |

⚠ **La beta est la seule phase dont la sortie ne tolère aucun défaut ouvert, de
quelque gravité que ce soit.** Les alphas ne se ferment que sur les `bloquant` ;
la beta se ferme sur tout. C'est délibéré : après elle, on ouvre à des gens qu'on
ne préviendra pas.

⚠ **Porte à sens unique.** Les deux alphas tournent sur le projet dev : on ouvre,
on referme, on remet à zéro. La beta non. **Une date d'alpha glisse sans rien
coûter ; la date de beta engage.**

### v1.0

Constatée, pas planifiée. **Elle n'a pas de critère de sortie** — c'est celui de
la beta qui la déclenche. Rien de neuf n'y est éprouvé.

## 5. Ce qui conditionne la beta sans être un jalon

C'est la particularité de cette porte, et la raison pour laquelle un schéma
purement fonctionnel serait faux :

| condition | état, relevé du 21/09 |
|---|---|
| **la reprise en production** | 107 migrations en attente, `core` vide, **2 courriels invalides bloquants** — déjà présents au 14/09 |
| **la première fusion `recette` → `main`** | `main` est figée au 20/08 et ne porte **ni `.github/` ni `supabase/`** : tant qu'elle n'a pas reçu la chaîne d'intégration, `main.yml` ne peut pas se déclencher, donc ni le garde du nombre de migrations ni release-please n'opèrent. *(L'environnement `base-de-production` et sa règle d'approbation, eux, existent déjà sur le dépôt.)* |
| **le cadrage RGPD** | déclaré bloquant avant toute mise en production depuis le 20/08, instruit côté produit, **pas côté juridique** |
| **le gel du périmètre v1.0** | à décider |

**Le fait mécanique qui gouverne la date de beta** est établi dans `PHASES.md` :
`core` n'est pas une vue, aucun déclencheur ne la relie au miroir, et une fiche
modifiée dans Bubble après la reprise ne sera jamais réécrite. D'où :
**remplir `core` et basculer sont le même geste.**

## 6. Les décisions du 22/09/2026

1. **`J2` est scindé.** Son critère « un administrateur rattache, promeut ou
   désactive un compte depuis `/(prive)/backoffice` » part dans **`J7`**. `J2`
   garde la connexion, la résolution du compte et la désactivation — vérifiables
   sans écran. L'alpha 1 n'attend donc plus une vue interne, et les comptes du
   cabinet sont rattachés en SQL.
2. **La maille est `J1`–`J7`.** `LOT` et `T` sont marqués périmés en tête de leur
   fichier.
3. **Le tag `v1.0.0` est retiré.** Il coiffait l'état déployé du 20/08, avant la
   refonte, et bloquait le nom de la version visée. Pour mémoire :
   commit `b3b982b`, du 20/08/2026, message
   *« v1.0.0 — l'état déployé au 20/08/2026, avant la refonte des portails »*.
   Les alphas prennent des tags posés à la main — `v1.0.0-alpha.1`, `-alpha.2` —
   et `release-please` reprend son rôle sur `main` à partir de la beta.
4. **Les défauts se consignent dans `DEFAUTS.md`.** Les trois phases qui ont une
   sortie en dépendent — les alphas sur les `bloquant`, la beta sur tous.

## 7. Ce qui n'est pas encore vrai, et qu'il faut savoir

À dire, parce qu'un document de jalons qui ne décrit que le plan ment.

| | mesuré le 22/09 |
|---|---|
| **les harnais ne couvrent pas les critères** | la correspondance est de numérotation, pas de contenu — voir §2. C'est le premier chantier. |
| **l'étage d'intégration ne tourne pas en CI** | **0 secret** posé sur le dépôt. `dev.yml` saute donc la montée des migrations *et* les six harnais à chaque poussée, avec un avertissement. |
| **les 54 critères ne sont pas cochés** | aucun, sur aucun jalon |
| **`dev` et `recette` ont divergé** | `origin/recette` porte 2 commits que `dev` n'a pas — dont le correctif de sécurité `next` 16.3.5 ; `dev` en porte 7 que `recette` n'a pas, et reste en **16.3.1** |
| **aucun harnais pour `J5`–`J7`** | 25 critères sans étage automatique |

## 8. Comment on mesure

```bash
npm --prefix frontend run test          # étage unitaire — 270 cas, aucune base
npm --prefix frontend run verifier:j1   # …j2, j3, j4
python3 outils/derive.py live           # l'état des données de production
```

⚠ **`j3-ecrans` et `j4-ecrans` exigent l'application en marche** (`npm run dev`
dans un autre terminal) : ils interrogent des URL, pas seulement la base.
⚠ **`j3` écrit dans la base de dev** — il envoie 11 décisions de candidature.
À ne pas lancer sur un projet dont on veut préserver l'état.

`PROTOCOLE_DE_TEST.md` dit **comment** on éprouve — les quatre étages et les
parcours humains. `PHASES.md` dit **qui entre** et **sur quelles données**.
**Celui-ci dit ce qu'il faut avoir construit, et ce qui permet de sortir.**
