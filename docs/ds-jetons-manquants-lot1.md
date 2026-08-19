# Jetons manquants — LOT 1 (illustrations, logos, icônes)

Valeurs que les fichiers de marque ou le Figma imposent et qui n'ont pas de jeton
exact dans `styles/brand/*.css` ni dans `styles/app.css`. Écrites en classe
arbitraire Tailwind ou en littéral SVG dans mes composants, à consolider par
l'orchestrateur.

| valeur | rôle | composant | ligne Figma |
| --- | --- | --- | --- |
| `#AC8CFF` à 40 / 50 / 70 / 100 % | les quatre halos concentriques du logo rond | `Logo.tsx` › `LogoRond` | Figma.md:41738 |
| `#FFFFFF` (via `var(--logo-papier, #FFFFFF)`) | le « papier » du monogramme : la lettre blanche posée sur son ombre noire | `Logo.tsx` › `Monogramme`, `LogoComplet` | Figma.md:60198, 60238 |
| `92px` | cote du logo rond dans l'application | `Logo.tsx` › `LogoRond` | Figma.md:41738 |
| `29.79px` | hauteur du logo complet dans l'application | `Logo.tsx` › `LogoComplet` | Figma.md:33631, 34277 |
| `15px` | hauteur du monogramme en `Size=Small` (le `Size=Large` tombe sur `h-8`) | `Logo.tsx` › `Monogramme` | Figma.md:60238 |
| `#1A202C` | disque des onze pastilles numériques `icon-number-00…10` | **non implémenté** | Figma.md:56756 |

Les trois cotes qui ne demandent **aucun** jeton, pour mémoire : les
illustrations sont en 64px (`h-16`), les icônes en 24px (`h-6`), le monogramme
`Size=Large` en 32px (`h-8`). L'échelle Tailwind les couvre exactement.

## Notes de consolidation

### 1. `#AC8CFF` est la valeur de `--tech-500`, mais pas son rôle

`styles/brand/colors.css:31` définit `--tech-500: #ac8cff`, c'est-à-dire la
couleur de la verticale **Tech**. Le logo rond utilise la même teinte.

Ne pas les brancher l'un sur l'autre. La règle §6 du cahier des charges dit que
les couleurs de verticale « qualifient un métier » ; le jour où la verticale Tech
change de teinte, le logo de l'entreprise ne doit pas changer avec elle. Le jeton
qui manque est un jeton d'identité, pas de verticale :

```css
--logo-lila: #ac8cff;   /* logo rond, halos — coïncide avec --tech-500 par hasard */
```

Tant qu'il n'existe pas, la valeur reste écrite en dur dans `LogoRond`, ce qui est
de toute façon le traitement correct d'un logo verrouillé.

### 2. `--logo-papier` est un point d'accroche, pas une couleur du DS

Le monogramme n'est pas monochrome : c'est un aplat noir décalé (l'ombre rétro,
déjà dessinée dans le fichier de marque) surmonté de la lettre **en blanc cerclée
de noir**. Passer les deux tracés en `currentColor` en ferait un pâté.

`Monogramme` et `LogoComplet` déclarent donc `fill="var(--logo-papier, #FFFFFF)"`
sur le tracé de la lettre. Sans surcharge, le rendu est celui de l'asset de
marque à l'octet près. Un conteneur coloré peut redéfinir la variable pour que la
contre-forme prenne sa teinte :

```css
.menu-violet { --logo-papier: var(--violet-500); }
```

L'orchestrateur n'a rien à ajouter à `app.css` : la variable n'a pas de valeur par
défaut à l'échelle du DS, seulement des surcharges locales. Elle est listée ici
pour que personne ne la découvre par hasard.

### 3. `#2D3648` — à ne PAS reprendre

Les 285 icônes du Figma sont peintes en `#2D3648`, commenté « WF Base/800 ». Ce
n'est pas une couleur de marque : c'est l'encre du kit de maquettage utilisé pour
construire la maquette. Les icônes suivent `currentColor`, donc le noir, comme
tout le texte du design system (règle §6). Aucun jeton à créer.

### 4. Les pastilles numériques ne sont pas des icônes

`icon-number-00` à `icon-number-10` (Figma.md:56756 et suivants, rangée y=692) ne
sont pas des glyphes de trait comme les 274 autres. Chacune est un composé de
deux couches :

- `Ellipse 1`, disque plein occupant les 24×24, `background: #1A202C` (WF Base/900) ;
- le chiffre, en `WF Base/White`, centré (inset ≈ 28 % / 33 %).

C'est-à-dire un **jeton de comptage** : disque sombre, chiffre clair. Lucide n'a
rien de tel et ne peut rien fournir. Il faudra un composant dédié — quelque chose
comme `PastilleNombre({ valeur })` — plutôt qu'une entrée dans la table des
icônes. Deux points à trancher à ce moment-là :

- le `#1A202C` n'est pas le noir du DS (`--black`), il vient encore du kit de
  maquettage : c'est probablement `--black` qu'il faut employer ;
- le chiffre blanc sur disque noir est la deuxième exception à « le texte est
  toujours noir », après l'élément de menu actif. À valider explicitement.

### 5. Les treize logos de marque

`icon-chrome`, `icon-codepen`, `icon-codesandbox`, `icon-dribbble`,
`icon-facebook`, `icon-figma`, `icon-instagram`, `icon-linkedin`, `icon-pocket`,
`icon-trello`, `icon-twitch`, `icon-twitter`, `icon-youtube` existent dans le
Figma parce que Feather les fournissait. Lucide les a tous retirés en v1 — un
fork généraliste ne veut pas porter les marques d'autrui.

Aucun jeton en jeu, mais une dépendance à décider si l'application doit un jour
afficher un profil LinkedIn : `simple-icons` est la bibliothèque de référence pour
les logos de marque. À ne pas redessiner à la main.
