# Le protocole de test

Ce que l'on éprouve, **qui** l'éprouve, et à quoi l'on reconnaît qu'une phase
est passée.

`PHASES.md` dit ce que sont alpha, beta et v1.0 — qui entre, sur quelle base, et
le robinet. **Celui-ci dit comment on vérifie.**

---

## 1. Les quatre étages, et ce que chacun peut dire

Un étage ne remplace jamais celui du dessus. **Chacun se définit par ce qu'il ne
peut PAS voir** — c'est cette complémentarité des angles morts qui oblige à les
avoir tous les quatre, pas le nombre de tests.

Ce n'est pas théorique. Trois de ces quatre étages ont attrapé, sur ce chantier,
un défaut que les autres avaient laissé passer :

| étage | ce qu'il a trouvé | les autres |
|---|---|---|
| **intégration** | la zone de dépôt retirée avait supprimé **le seul `input[type=file]`** de l'écran : la page s'affichait, plus personne ne pouvait déposer son CV | verts |
| **schéma** | **trois migrations de fixtures rendaient l'historique non rejouable** — la base ne pouvait pas être reconstruite depuis zéro | verts |
| **humain** | sur téléphone, les cartes rendaient « undefined » et le bouton Menu était à **x = −122**, hors écran | verts |

⚠ **L'étage unitaire, lui, n'a rien attrapé pendant ce chantier.** Ses 270 cas
sont restés verts de bout en bout : ils ont *tenu*, ils n'ont pas *trouvé*. La
nuance compte — un test qui ne tombe jamais est soit une protection, soit un
décor, et rien dans son silence ne permet de trancher.

| étage | quoi | combien | quand | ce qu'il attrape |
|---|---|---|---|---|
| **1. Unitaire** | `vitest` | **270 cas** sur 8 fichiers | chaque pull request | une règle de domaine fausse |
| **2. Intégration** | 6 harnais `j1`…`j4` | **319 contrôles** | après fusion dans `dev` | un cloisonnement percé, une vue qui ne rend rien |
| **3. Schéma** | rejeu des 127 migrations sur base vierge | 1 job | chaque pull request | deux branches qui recréent la même vue |
| **4. Humain** | alpha, puis beta | — | par phase | ce qu'aucune assertion ne sait formuler |

### Étage 1 — unitaire

```
talent.test.ts        53 cas      entreprise.test.ts    44
saisie.test.ts        42 + 34     saisie.test.tsx       34
offre.test.ts         26          fiche.test.ts         17
```

Aucune base, aucun réseau. Ils tournent partout, y compris sur une proposition
venue d'un dépôt tiers. Ils décrivent le **domaine** : convertisseurs, règles de
saisie, formatage, découpage des étapes.

### Étage 2 — intégration

| harnais | contrôles | ce qu'il éprouve |
|---|---|---|
| `j1-job-board` | 11 | le job board public, et ce qu'il ne fuite pas |
| `j2-authentification` | 11 | la connexion et ce qu'elle ouvre |
| `j3-portail-entreprise` | 31 | ce que le portail entreprise ouvre et ferme |
| `j3-…-ecrans` | 57 | les mêmes écrans, côté Next |
| `j4-espace-talent` | 100 | ce que l'espace talent ouvre et ferme |
| `j4-…-ecrans` | 109 | les mêmes écrans, côté Next |

⚠ **Ils exigent une vraie base et de vrais comptes.** Ils ne tournent donc
jamais sur une pull request — seulement **après fusion dans `dev`**, là où les
secrets du dépôt sont accessibles. C'est la raison de la coupure entre `ci.yml`
et `dev.yml`.

⚠ **Ils écrivent puis nettoient.** `j4` crée une candidature, la fait avancer,
puis retire tout et le vérifie (`candidatures_restantes: 0`). Un harnais qui
laisserait des traces cesserait d'être rejouable — et cesserait donc d'être un
test.

### Étage 3 — schéma

`supabase start` applique les 127 migrations **dans l'ordre, sur une base
neuve**. C'est le seul contrôle qui attrape une collision que git fusionne
proprement : deux branches portant chacune un `create or replace view
api.mandat_client` — le dépôt en compte déjà cinq.

Il a trouvé, à sa première exécution, que **trois migrations de fixtures
rendaient l'historique non rejouable**.

### Étage 4 — humain

Le seul qui réponde à « est-ce que c'est **utilisable** ». Voir §3.

---

## 2. Ce qui doit être vert, et quand

```
proposition de modification   étage 1 + étage 3 + gitleaks     ci.yml
fusion dans dev               étage 2 (les 6 harnais)          dev.yml
fusion dans recette           les mêmes, plus la relecture     — 
fusion dans main              les mêmes, plus l'approbation    main.yml
```

Sur `main`, deux serrures supplémentaires, décrites dans `CONTRIBUTING.md` : le
garde du nombre de migrations, et l'approbation humaine par l'environnement
`base-de-production`.

**Aucune exception.** Un contrôle qu'on contourne une fois cesse d'être un
contrôle.

---

## 3. Le test humain, phase par phase

### Alpha 1 — les deux portails clients

**Qui** : le cabinet. Chacun avec un compte réel et un `app.acces` actif.

**Comment** : chaque testeur joue **un parcours entier**, pas des écrans isolés.
Un défaut d'enchaînement ne se voit pas écran par écran.

| parcours | portail |
|---|---|
| je découvre une offre, je postule, je suis ma candidature, je la retire | talent |
| je complète ma fiche, je dépose mon CV, je corrige mes attentes | talent |
| j'ouvre un poste, je relis le brief, je décide sur un candidat | entreprise |
| je relis le profil d'un candidat présenté, je le copie, je commente | entreprise |
| je corrige mes informations, je change ma photo, la fiche de mon entreprise | entreprise |

**Ce qu'on note** : ce qui bloque, ce qui surprend, ce qu'on a cherché sans le
trouver. Les trois n'ont pas la même valeur — le troisième est le plus utile et
le moins rapporté spontanément.

**Ce qu'on ne peut PAS apprendre ici** : si un client trouve son pipeline
lisible. Le cabinet n'est l'utilisateur d'aucun de ces deux portails. L'alpha 1
éprouve la **mécanique**, pas l'**usage**.

**Sortie** : aucun défaut bloquant ouvert, et les six harnais au vert.

### Alpha 2 — les vues internes

**Qui** : les recruteurs, qui en sont cette fois les vrais utilisateurs. C'est
la différence avec l'alpha 1, et elle rend cette phase beaucoup plus
informative : ici, « est-ce que ça marche » et « est-ce que ça sert » ont le
même juge.

**Sortie** : un recruteur peut conduire un mandat de bout en bout sans ouvrir
Bubble.

### Beta — de vraies personnes

**Qui** : des clients et des talents nommés, prévenus, peu nombreux.

**Ce qu'elle seule peut dire** — et qu'aucune alpha ne dira, parce que ça tient
au volume et à la forme réelle :

- un kanban à deux cents candidatures ;
- un intitulé de poste à rallonge ;
- une fiche sans CV depuis 2019 ;
- un navigateur, un téléphone, une connexion qu'on n'a pas.

**Une alpha verte ne garantit donc pas une beta calme.** C'est normal, et c'est
à ça qu'elle sert.

**Sortie — v1.0** : aucun défaut signalé en beta n'est ouvert, et on
accepterait d'ouvrir à tous sans prévenir personne.

---

## 4. Ce qu'aucun étage ne couvre

À dire, parce qu'un protocole qui prétend tout couvrir ment.

| angle mort | aujourd'hui |
|---|---|
| **la charge** | rien ne mesure le comportement à N fois le volume actuel |
| **le mobile** | vérifié à la main, jamais automatiquement — deux défauts déjà trouvés ainsi (cartes vides, menu hors écran) |
| **l'accessibilité** | les composants portent les bons rôles, rien ne le vérifie en continu |
| **la régression visuelle** | aucune capture de référence ; un écran peut se déformer sans qu'un test tombe |
| **les données de production** | `outils/derive.py` les sonde, mais il n'est pas dans la CI |

Le dernier est le plus facile à combler : `derive.py` rend **1** s'il existe un
blocage, donc il s'ajoute à un workflow en trois lignes le jour où on le décide.

---

## 5. Les commandes

```bash
npm --prefix frontend run test          # étage 1 — 270 cas, aucune base
npm --prefix frontend run verifier:j1   # …j2, j3, j3-ecrans, j4, j4-ecrans
npm --prefix frontend run verifier:j4-ecrans -- --stockage   # + la boucle de dépôt
python3 outils/derive.py live           # l'état des données de production
```

⚠ **Le `npm run verifier` de la racine ne tourne pas en CI** : il commence par
`npm run cible`, qui lit `env/projets.env`, ignoré par git. En CI, on appelle
les scripts granulaires.
