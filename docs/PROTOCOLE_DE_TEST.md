# La grille technique

Elle dit quand un jalon est **prêt pour le test**, et elle est rejouée avant sa
validation. Trois étages. La grille produit, cadrée avec le PM, couvre le reste.

## 1. Les trois étages

Un étage ne remplace jamais celui du dessus. **Chacun se définit par ce qu'il ne
peut pas voir** — c'est cette complémentarité des angles morts qui oblige à les
avoir tous les trois, pas le nombre de tests.

| étage | quoi | combien | quand | ce qu'il attrape |
|---|---|---|---|---|
| **1. Unitaire** | `vitest` | **270 cas** sur 8 fichiers | chaque pull request | une règle de domaine fausse |
| **2. Intégration** | 6 harnais `j1`…`j4` | **313 appels** | à la poussée dans `dev` | un cloisonnement percé, une vue qui ne rend rien |
| **3. Schéma** | rejeu des 127 migrations sur base vierge | 1 job | chaque pull request | deux branches qui recréent la même vue |

### Étage 1 — unitaire

```
domaine/entreprise.test.ts   53      domaine/talent.test.ts   53
talent/saisie.test.ts        42      entreprise/saisie.test.ts 36
pacha/saisie.test.tsx        34      domaine/offre.test.ts     26
domaine/fiche.test.ts        17      suite.test.ts              9
                                     ─────────────────────── 270
```

Aucune base, aucun réseau. Ils tournent partout, y compris sur une proposition
venue d'un dépôt tiers. Ils décrivent le **domaine** : convertisseurs, règles de
saisie, formatage, découpage des étapes.

### Étage 2 — intégration

| harnais | appels | ce qu'il éprouve |
|---|---|---|
| `j1-job-board` | 10 | le job board public, et ce qu'il ne fuite pas |
| `j2-authentification` | 10 | la connexion et ce qu'elle ouvre |
| `j3-portail-entreprise` | 30 | ce que le portail entreprise ouvre et ferme |
| `j3-…-ecrans` | 56 | les mêmes écrans, côté Next |
| `j4-espace-talent` | 99 | ce que l'espace talent ouvre et ferme |
| `j4-…-ecrans` | 108 | les mêmes écrans, côté Next |

**Ils exigent une vraie base et de vrais comptes.** Ils ne tournent jamais sur
une pull request — seulement après poussée dans `dev`, là où les secrets du
dépôt sont accessibles. C'est la raison de la coupure entre `ci.yml` et
`dev.yml`.

**Les deux harnais `-ecrans` exigent l'application démarrée** : ils interrogent
des URL. `npm run dev` dans un autre terminal, ou `next build` puis `next start`
comme le fait `dev.yml`.

**`j3` écrit dans la base de dev** — il envoie 11 décisions de candidature.

**Ils écrivent puis nettoient.** `j4` crée une candidature, la fait avancer, puis
retire tout et le vérifie (`candidatures_restantes: 0`). Un harnais qui
laisserait des traces cesserait d'être rejouable — et cesserait donc d'être un
test.

**Le contrôle d'isolation est dans cet étage.** Chaque harnais compare le
résultat obtenu avec le jeton de l'utilisateur au résultat obtenu avec la clé de
service, et vérifie que le nombre de lignes attendu est différent de zéro. Avec
la clé publique `anon`, une politique manquante renvoie un code 200 et un tableau
vide — exactement ce que renvoie une base vide.

### Étage 3 — schéma

`supabase start` applique les 127 migrations **dans l'ordre, sur une base
neuve**. C'est le seul contrôle qui attrape une collision que git fusionne
proprement : deux branches portant chacune un `create or replace view
api.mandat_client` — le dépôt en compte six.

## 2. Ce qui doit être vert, et quand

```
proposition de modification   étage 1 + étage 3 + gitleaks     ci.yml
poussée dans dev              étage 2 (les 6 harnais)          dev.yml
fusion dans recette           relecture humaine                aucun workflow
fusion dans main              migrations + version             main.yml
```

`main.yml` ne joue aucun harnais : il monte les migrations vers la production et
pose la version. L'étage 2 ne tourne qu'à la poussée dans `dev`, et n'est donc
pas rejoué avant la mise en ligne — c'est la relecture avant `recette` qui en
tient lieu.

**Le dépôt porte 0 secret** : `dev.yml` saute la montée des migrations et les six
harnais à chaque poussée. Les 313 appels ne sont joués qu'à la main, jusqu'à
`bash outils/secrets_ci.sh`.

Sur `main`, deux serrures supplémentaires décrites dans `CONTRIBUTING.md` : le
garde du nombre de migrations, et l'approbation humaine par l'environnement
`base-de-production`. Elles n'existeront qu'à la première fusion
`recette` → `main` : `main` ne porte pas `.github/`.

## 3. Ce qu'aucun étage ne couvre

| angle mort | aujourd'hui |
|---|---|
| **la charge** | rien ne mesure le comportement à N fois le volume actuel |
| **le mobile** | vérifié à la main, jamais automatiquement — deux défauts déjà trouvés ainsi |
| **l'accessibilité** | les composants portent les bons rôles, rien ne le vérifie en continu |
| **la régression visuelle** | aucune capture de référence |
| **les données de production** | `outils/derive.py` les sonde, il n'est pas dans la CI |

## 4. Les commandes

```bash
npm --prefix frontend run test          # étage 1 — 270 cas, aucune base
npm --prefix frontend run verifier:j1   # …j2, j3, j3-ecrans, j4, j4-ecrans
supabase start                          # étage 3 — rejeu des 127 migrations
python3 outils/derive.py live           # l'état des données de production
```

**Le `npm run verifier` de la racine ne tourne pas en CI** : il commence par
`npm run cible`, qui lit `env/projets.env`, ignoré par git. En CI, on appelle les
scripts granulaires.
