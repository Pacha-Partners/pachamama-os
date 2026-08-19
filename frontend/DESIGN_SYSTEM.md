# Design system de Pachamama OS

Statut : **en construction** — 19/08/2026, 21 h. Un premier socle (10 composants)
est en place et vérifié ; **l'inventaire du Figma montre qu'il couvrait environ
15 % de la surface réelle**, et cinq chantiers parallèles construisent le reste.
Ce document est mis à jour à mesure. Les sections marquées ⚠️ signalent une
affirmation que j'avais faite et que le relevé a démentie.

Page de référence : **`/design-system`** — tous les éléments, dans leurs états
réels. C'est le point de contrôle : un design system qu'on ne peut pas regarder
n'est pas vérifiable.

---

## 1. Les trois sources, et ce que chacune fait autorité

| Source | Ce qu'elle fournit | Où elle vit dans le dépôt |
|---|---|---|
| **DS de marque** (Claude Design, projet `844ac5af…`) | identité : couleurs de marque, verticales, polices, ombre rétro, règles d'usage | `styles/brand/*.css` — **miroir verbatim, ne pas modifier à la main** |
| **Figma de l'app** (export « Copy as CSS ») | couche interface : rampes violette et encre, cotes exactes, échelle typographique canonique, statuts | `Figma.md` (95 006 lignes) → distillé dans `styles/app.css` |
| **10 captures d'écran** | l'intention visuelle : composition, densité, ce qui porte l'ombre et ce qui ne la porte pas | arbitrages documentés en commentaires dans `styles/app.css` |

Hiérarchie en cas de conflit : **la marque gouverne l'identité, le Figma
gouverne l'interface.** Le miroir de marque n'est jamais édité ; quand l'app a
besoin d'autre chose, elle l'ajoute dans `app.css` sans toucher au miroir.

## 2. Chaîne de chargement

`app/globals.css` dans cet ordre, et l'ordre est signifiant :

1. `tailwindcss` + `tw-animate-css`
2. `styles/brand/*.css` — le miroir de marque
3. `styles/app.css` — la couche interface + les 11 classes typographiques
4. `@theme inline` de shadcn
5. bloc de correspondance : les jetons shadcn pointent sur les jetons de marque

Correspondances retenues : `--background` → `--fond-page` (crème, jamais blanc),
`--foreground` / `--primary` / `--input` / `--ring` → `--black`, `--accent` →
`--violet-100`. **Pas de mode sombre** : le DS de marque n'en définit aucun pour
l'application, et en inventer un aurait été du design, pas du portage.

Polices auto-hébergées via `next/font/google` (`app/layout.tsx`) :
Bricolage Grotesque, Host Grotesk, Instrument Serif — cette dernière en
`style: 'normal'`, elle n'est **jamais** en italique. `app.css` redirige
`--font-display/-body/-serif` sur les variables produites par next/font, en
conservant les mêmes familles et les mêmes replis. Vérifié : trois `.woff2`
servies en HTTP 200.

## 3. Règles dures

- **Le texte est toujours noir.** ⚠️ **Correction (mesurée le 19/08)** : j'avais
  écrit que l'état actif du menu justifiait du blanc sur violet 500 « parce que du
  noir y passerait sous le seuil ». **C'est l'inverse.** Ratios WCAG calculés sur
  `--violet-500` (#8657ff) : **noir = 4,82 (AA ✅)**, **blanc = 4,36 (échec AA ❌)**.
  Le noir est donc le choix accessible, ce qui est d'ailleurs cohérent avec la
  règle elle-même. Si le Figma prescrit du blanc, `--violet-700` (blanc à 8,91)
  est le repli accessible.
- **Les couleurs de verticale sont décoratives.** People, Product, Tech, Revenue
  qualifient un métier ; elles ne portent jamais de texte et ne signalent jamais
  une action. La couleur d'action est le noir.
- **Deux mécanismes d'ombre, pas un.** ⚠️ **Correction** : j'avais écrit « jamais
  floue ». Le Figma utilise `0px 0px 3px rgba(0,0,0,0.25)` **13 fois**, et les 13
  sont sur `Input / Search/Default`. La règle juste :
  - le **décalage sans flou** est la signature *rétro* — `--ombre-1` (-1px) pour un
    tag, `--ombre-2` (-2px) au survol d'un bouton, `--ombre-3` (-3px) pour un
    bouton au repos, `--ombre-6` (-6px) pour une carte d'accroche ; il existe aussi
    `--ombre-1-grise` (`#a8b1bd`) pour un tag posé sur une carte déjà bordée de noir ;
  - le **flou** est l'*élévation* d'un élément qui flotte au-dessus du contenu —
    `--ombre-douce` (champ de recherche, déroulant ouvert), `--ombre-portee`
    (survol de ligne).
- **Deux régimes de surface**, prescrits par le DS lui-même (qui livre un
  `--shadow-soft` étiqueté « dashboard only ») :
  - *accroche* — ce qui **se regarde** (carte d'offre) : bordure noire + ombre rétro ;
  - *travail* — ce qui **se parcourt** (carte candidat dans un kanban) : bordure fine.
  Se tromper coûte la marque dans un cas, la lisibilité dans l'autre.
- **Une information critique n'est jamais portée par la seule couleur.** L'alerte
  « Qualif niveau 1 incomplète » est du texte avec `role="alert"`, parce qu'elle
  bloque l'envoi au client.

## 4. Échelle typographique — 14 styles

⚠️ **Correction** : j'avais annoncé 11 styles « exhaustifs ». Le Figma descend à
**10px** (60 occurrences, notamment les quatre variantes `Rating=…, Size=Small`),
taille que mon échelle n'avait pas. Elle en compte donc 14.

`t-h1` `t-h1-comp` `t-h2` `t-h2-comp` `t-h3` `t-body` `t-body-hl` `t-body-bold`
`t-caption` `t-caption-hl` `t-caption-bold` **`t-micro` `t-micro-hl` `t-micro-bold`**

10px est le plancher : en dessous, rien n'est lisible.

**Le duo de titres : les deux lignes ont la même taille.** La hiérarchie vient
du contraste serif / sans, pas d'un écart de corps. C'est la signature
typographique de la marque et c'est l'erreur la plus facile à commettre.

## 5. Deux arbitrages, et pourquoi

Ces deux points sont des décisions, pas des relevés. Ils sont motivés par la
donnée, pas par le goût.

1. **`Body/Regular` et `Caption/Regular` en Abhaya Libre sont une substitution
   de police accidentelle.** Le spécimen canonique (capture 1) les montre en
   sans-serif, et leurs propres frères `bold` / `highlight` sont en Host Grotesk.
   Retenu : Host Grotesk pour toute la famille.
2. **`Roboto`, `M3/*`, `state-layer` et les rayons sous-pixels (0,35 px / 0,70 px)
   sont exclus** — mais ⚠️ **pas le composant qui les porte.** Le Figma commence
   ligne 1 par `/* Modal Date Picker */`, en `250×408`, `border: 2px solid #000`,
   `border-radius: 16px` : la **coque est Pachamama**, seules les **entrailles**
   sont restées Material, le designer ayant déposé un calendrier M3 dans un cadre
   maison sans le rhabiller. J'avais exclu le composant entier : c'était une
   erreur. Il est construit (`SelecteurDate.tsx`) en reprenant la géométrie du
   Figma et en rhabillant typographie et couleurs avec nos jetons.
3. **`Montserrat` est un reliquat, comme Abhaya Libre.** ⚠️ Je ne l'avais pas
   même remarqué : **134 occurrences**, dont **42 sur la couche `Button text`** à
   l'intérieur des variantes `Size=…, State=…, color=…`. Il n'existe pas dans le
   design system de marque. Même traitement : mappé sur Host Grotesk (400 → `t-*`,
   500 → `t-*-hl`, 600/700 → `t-*-bold`).
4. **Le rayon des contrôles est 5px**, pas 6. Relevé **35 fois** (boutons, boutons
   icône, filtres, tags) → jeton `--r-controle`. Les surfaces restent en 8px
   (171 occurrences) et 16px pour les modales.

## 6. Une caractéristique à connaître : les rampes ne sont pas monotones

Extraites **verbatim** du Figma, donc fidèles à la maquette :

```
violet  050 #f8f5ff · 100 #e9e0ff · 200 #ccb8ff · 300 #ab8aff · 400 #9747ff
        500 #8657ff · 600 #8a38f5 · 700 #5022c3 · 900 #371b7e
encre   050 #f1f0f5 · 100 #e7e6eb · 200 #cac9cd · 250 #adabb3 · 300 #a8b1bd
        400 #a0abc0 · 500 #738296 · 600 #5d6979 · 700 #2d2b31 · 800 #2d3648 · 900 #1a202c
```

Deux irrégularités réelles : le violet n'est pas monotone en clarté perçue entre
400 et 600, et l'encre mêle deux familles de gris (bleutée `#a0abc0`, neutre
`#adabb3`). Ce sont des valeurs choisies au cas par cas par la conception, pas
une rampe générée. **Je ne les ai pas normalisées** : la maquette est la
référence, et « corriger » une rampe désaligne tous les écrans déjà dessinés.
À normaliser plus tard, si jamais, comme une décision de conception assumée.

## 7. Inventaire des composants

`components/pacha/` — API en français, comme le reste du dépôt.

| Composant | Rôle | États / variantes |
|---|---|---|
| `Titre` | le duo serif/sans | `niveau` 1–2, `TitreSection` |
| `Bouton` | action | `plein` · `presse` · `contour` · `contour-ombre` · inerte × `sm`/`md` |
| `Tag` | 4 familles qui ne se mélangent jamais | `TagUnivers` (4 verticales) · `TagContrat` (freelance → violet) · `TagInfo` · `TagAction` (3 appuis) |
| `StatutProcess` | vocabulaire métier | **11 étapes** dans l'ordre réel, + compteur, + état masqué |
| `Carte` | surface | `accroche` / `travail` ; `InfoLigne`, `Encart` |
| `Champ` | saisie | libellé lié (`htmlFor`), `aria-invalid`, `aria-describedby`, erreur en texte |
| `Menu` | navigation | `ElementMenu` (actif / désactivé), sections, `MarqueMonogramme` |
| `Entete` | barre supérieure | utilisateur, notifications |
| `CarteOffre` | l'offre — surface la plus lue | `etroite` / `large`, anonymat explicite, exclusivité |
| `CarteCandidat` | le candidat en pipeline | sélection, alerte de qualification |

Primitives shadcn thémées disponibles : `button`, `badge`, `checkbox`, `switch`,
`radio-group`, `select`, `tooltip` — Radix pour le comportement clavier et les
rôles ARIA, habillées par nos jetons.

## 8. Accessibilité — ce qui est fait

Lien d'évitement en tête de `layout.tsx` · `lang="fr"` · libellés de champs liés
programmatiquement · erreurs annoncées en texte et non par la couleur seule ·
alertes en `role="alert"` · emojis décoratifs en `aria-hidden` avec le sens porté
par le texte · respect de `prefers-reduced-motion`.

**Contrastes : désormais mesurés** (calcul WCAG sur les 57 jetons de fond) —
toutes les teintes de verticale (People, Product, Tech, Revenue) passent **AAA**
avec du texte noir. Mon inquiétude était infondée, et je l'ai vérifiée plutôt que
laissée en suspens.

Les 11 fonds sur lesquels le noir **ne suffit pas** : `encre-600/700/800/900`,
`grey-500/600/800/900`, `violet-600/700/900`. Sur ceux-là le texte doit être
blanc. Cas limites à connaître : `violet-400` (noir 4,66 / blanc 4,51 — les deux
passent de justesse) et `violet-500` (noir 4,82 ✅ / blanc 4,36 ❌).

## 9. Note de portée

`/design-system` est aujourd'hui **hors du groupe `(prive)`**, donc accessible
sans authentification. C'est volontaire pendant la construction. À déplacer sous
`(prive)/` avant tout déploiement public.
