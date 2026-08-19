# Jetons manquants — LOT 4 (surfaces métier)

Valeurs imposées par le Figma et écrites en classe arbitraire Tailwind, faute de
jeton dans `styles/app.css` ou `styles/brand/*.css`. Périmètre : `StatutProcess`,
`Carte`, `CarteOffre` / `CarteOffreTalent`, `CarteCandidat` / `CarteTalent`.

## 1. Fonds des statuts de process — le point le plus sensible

Les onze pastilles n'utilisent que **quatre** fonds. Deux coïncident au caractère
près avec un jeton existant, deux non. Aucun des quatre n'est ambigu : chacun est
relevé dans le bloc CSS de sa variante.

| valeur | rôle | composant | ligne Figma |
| --- | --- | --- | --- |
| `#8657FF` | fond des statuts `applicants` et `send-out-violet` | `StatutProcess` | `Figma.md:9638`, `:9474` |
| `#FFEA4D` | fond des six statuts d'attente et d'entretien | `StatutProcess` | `:9597`, `:9556`, `:9515`, `:9761`, `:9433`, `:9720` |
| `#58D5A7` | fond des statuts `send-out-vert` et `recrute` | `StatutProcess` | `:9351`, `:9679` |
| `#F47777` | fond du statut `ko` | `StatutProcess` | `:9392` |

Correspondance avec les jetons existants :

- `#8657FF` = `--violet-500` = `--statut-avance` — **identique**, jeton utilisable.
- `#FFEA4D` = `--statut-attente` — **identique**, jeton utilisable.
- `#58D5A7` ≠ `--statut-positif` (`#79E6BE`) — **jeton à créer**. Proposition :
  `--statut-positif-figma`, ou correction de `--statut-positif`.
- `#F47777` ≠ `--statut-echec` (`#F4728A`) — **jeton à créer**.

Les quatre sont écrits en littéral dans `StatutProcess.tsx`, y compris les deux
qui ont un équivalent exact : la table des onze étapes reste ainsi lisible ligne
à ligne contre le Figma, ce qui est le seul moyen d'auditer un mapping de
vocabulaire métier.

### Couleurs de texte des pastilles — à arbitrer, pas à consigner

Le Figma pose du texte **blanc** sur les quatre fonds saturés
(`:9655`, `:9491`, `:9368`, `:9696`, `:9409`) et **noir** sur `#FFEA4D`
(`:9614`, `:9573`, `:9532`, `:9778`, `:9450`, `:9737`). Deux de ces combinaisons
échouent au seuil AA :

| fond | texte relevé | contraste | avec du texte noir |
| --- | --- | --- | --- |
| `#8657FF` | `#FFFFFF` | 4,3:1 | — (exception de charte connue) |
| `#58D5A7` | `#FFFFFF` | **1,8:1** | 11,5:1 |
| `#F47777` | `#FFFFFF` | **2,7:1** | 7,8:1 |
| `#FFEA4D` | `#000000` | 17,2:1 | conforme |

Le code suit le fichier. Ce n'est pas un jeton manquant mais une décision de
design à prendre en amont ; elle est signalée ici parce que c'est le même
tableau qui la porte.

## 2. Deuxième vert de statut — la vue talent

| valeur | rôle | composant | ligne Figma |
| --- | --- | --- | --- |
| `#4DA467` | fond de `Job status` sur la carte d'offre vue par le talent | `CarteOffreTalent` | `Figma.md:21828`, `:22271`, `:23746` |

Relevé trois fois, jamais mélangé avec `#58D5A7` : ce sont deux verts pour deux
surfaces (kanban recruteur / carte talent), pas une variation accidentelle.

## 3. Bordures et fonds de carte

| valeur | rôle | composant | ligne Figma |
| --- | --- | --- | --- |
| `#FFE9A8` | bordure de la pastille « Exclu Pachamama » | `CarteOffre` | `Figma.md:35952`, `:36339` |
| `#F2F0FA` | fond de survol de la carte talent en vue liste | `CarteTalent` | `Figma.md:7112` |
| `#FBFAFF` | fond de survol de la carte talent en vue kanban | `CarteTalent` | `Figma.md:8034` |
| `#F6F5FA` | fond de la pastille « ✅️ Qualifié.e » | `CarteTalent` | `Figma.md:7716`, `:8150` |

Valeurs déjà couvertes par un jeton, pour mémoire — aucune action requise :
`#FFFBF0` = `--fond-entete` (fond de « Exclu Pachamama », `:35951`),
`#F8F5FF` = `--violet-050` (état `Clicked`, `:38999` ; `Already candidate`,
`:22082`), `#79E6BE` = `--statut-positif` (bordure d'un candidat qualifié,
`:27036`), `#F1F0F5` = `--encre-050` (filet de la carte d'offre, `:35402`),
`#E9E0FF` = `--violet-100` (filet de la carte talent, `:21806`),
`#E7E6EB` = `--encre-100` (bordure des images, `:24737`).

## 4. Style typographique manquant

| valeur | rôle | composant | ligne Figma |
| --- | --- | --- | --- |
| `16px / 24px / 600` | nom du talent sur la carte de recherche | `CarteTalent` | `Figma.md:6767-6776`, `:7659-7668`, `:8093-8102` |

Aucune des quatorze classes `t-*` ne couvre ce couple : `t-body-*` s'arrête à
14/19 et `t-h3` monte à 18/22. Le Figma le pose en Montserrat, écartée par la
charte ; seul le corps est repris, la famille reste Host Grotesk. Écrit en
utilitaires (`text-[16px] leading-6 font-semibold`). Une classe `t-lead` ou
`t-body-lg` conviendrait.

## 5. Couleurs de filet, pour information — aucun jeton manquant

`Divider` (LOT 5) est appelé avec trois couleurs selon la surface, toutes déjà
porteuses d'un jeton :

| surface | couleur | ligne Figma | appel |
| --- | --- | --- | --- |
| carte d'offre | `--encre-050` | `:35402` | `<Divider />` (défaut) |
| carte d'offre vue talent | `--violet-100` | `:21806` | `bg-[var(--violet-100)]` |
| carte candidat | `--encre-100` | `:25441` | `bg-[var(--encre-100)]` |

`Divider` porte sa couleur en `bg-`, pas en `border-` : les surcharges passent
donc par `bg-[…]`. Vérifié contre l'implémentation du LOT 5.

## 6. Réconciliations avec les autres lots — pas de jeton, mais à savoir

- Le fond `#E9E0FF` du tag `Contrat` sur la carte d'offre (`:35311`) n'est pas
  un état de repos : c'est l'état `Focus=True` de `TagContrat` (`:47546`). La
  carte d'offre passe donc `focus`, la carte candidat non (`:24975`, blanc).
- L'ombre `-3px` des mots-clés (`:36992`) est le `regime="accroche"` de
  `TagInfo`, et non une surcharge de classe.
- `Number screened` est bien une tuile de KPI (`TuileCompteur` ici) et non un
  élément de `Notation` — les deux lots convergent sur ce point.
