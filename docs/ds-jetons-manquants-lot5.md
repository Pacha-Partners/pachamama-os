# Jetons manquants et écarts — LOT 5 (chrome applicatif + sélecteur de date)

Fichiers concernés : `components/pacha/{Menu,Entete,Divider,EtatVide,ListeItem,SelecteurDate,Infobulle,Avatar}.tsx`.

## 1. Valeurs littérales faute de jeton

| valeur | rôle | composant | ligne Figma |
| --- | --- | --- | --- |
| `#101828` | fond de l'infobulle (« Gray/900 »), noir bleuté étranger à la rampe `--encre-*` | `Infobulle` | Figma.md:21634, 21694 |
| `#E8EAED` | fond de survol de la ligne de date (`Property 1=Hover` / `Fill hover`) | `SelecteurDate` → `LigneDate` | Figma.md:8586, 8646 |
| `16px / 18px, poids 600` | nom d'utilisateur dans l'en-tête ; aucun des 14 styles typographiques ne couvre 16/18 | `Entete` | Figma.md:11738 |
| `29.79px` | hauteur du cadre logo du menu | `Menu` | Figma.md:33633 |
| `76px` | hauteur de la barre supérieure (voir §2) | `Entete` | Figma.md:11419 |
| `180px` | largeur du panneau de navigation (voir §2) | `Menu` | Figma.md:33619 |
| `35px` | hauteur d'un élément de menu (voir §2) | `Menu` | Figma.md:33766 |
| `73px` | écart logo → liste dans le menu Talent (le menu Admin utilise 48 = `gap-12`) | `Menu` | Figma.md:34259 |
| `#e8553a` | texte du message d'erreur de la saisie clavier ; `--bord-erreur` porte la couleur mais seulement en bordure | `SelecteurDate` | reprise de `Champ.tsx` (déjà littérale là-bas) |

## 2. Jetons existants que le Figma contredit

À trancher par l'orchestrateur — je n'ai pas touché à `app.css`.

| jeton | valeur actuelle | valeur relevée au Figma | ligne | ce que j'ai implémenté |
| --- | --- | --- | --- | --- |
| `--h-menu-item` | `31px` | `35px`, sans exception sur 12 relevés | Figma.md:33766, 33832, 33938, 34003, 34108, 34172, 34374, 34438, 34502, 34567, 34632, 34739 | 35px (`px-1 py-2` + `t-body-hl` = 8+19+8) |
| `--nav-hauteur` | `64px` | `76px` | Figma.md:11419 | 76px |
| `--panneau-largeur` | `264px` | `180px` pour le menu | Figma.md:33619 | 180px |
| `--fond-entete` | `#fffbf0` | `#fff9e5` | Figma.md:11421 | `--fond-entete` — voir §3 |

## 3. Couleurs relevées mais écartées, avec le motif

| valeur | où | ligne | décision |
| --- | --- | --- | --- |
| `#FFF9E5` | fond de la barre supérieure | Figma.md:11421 | écartée : une seule occurrence dans tout l'export, contre 15 pour `#FFFBF0` déjà retenu comme `--fond-entete`. app.css arbitre explicitement les crèmes quasi-doublons ; ne pas créer un troisième crème. |
| `'Roboto'`, `M3/label/large`, `state-layer` | tout l'intérieur du sélecteur de date | Figma.md:68, 91, 271, 272, 356, 539, 591, 637, 4539, 4615 ; `state-layer` : 159, 246, 389, 483, 953, 1031… | écartés, conformément à l'arbitrage déjà écrit en tête d'app.css. Rhabillage en `t-caption-hl` / `t-h2` / `t-caption` / `t-body-hl`. |
| `'Abhaya Libre'` | libellé de `List item`, placeholder de recherche, `MentionDate` | Figma.md:15064, 11515, 47804 | écartée : substitution accidentelle déjà arbitrée par app.css. Host Grotesk. |
| `'Montserrat'` | nom d'utilisateur, `Card content Item`, `Date : N/A` | Figma.md:11740, 6882, 8481 | écartée : hors charte, déjà arbitrée par app.css. |
| `40×40` de cellule de jour | grille du calendrier | Figma.md:933, 1011 | écarté : 7 × 40 = 280px dans une rangée que le Figma déclare à 226px (Figma.md:556). Ramené à 32×32 rond. |

## 4. Contrastes mesurés qui échouent WCAG AA, prescrits par le Figma

Implémentés tels quels, jamais corrigés en silence. Chaque cas est aussi commenté dans le fichier concerné.

| paire | ratio | seuil | où | ligne | repli recommandé |
| --- | --- | --- | --- | --- | --- |
| `--violet-900` #371B7E sur `--violet-500` #8657FF | **2,98** | 4,5 | élément de menu sélectionné, thème « noir » | Figma.md:35076 + 35113 | texte **noir** sur violet-500 (4,82) |
| blanc sur `--violet-500` | **4,36** | 4,5 | élément de menu sélectionné, thème « blanc » | Figma.md:34879 + 34916 | fond `--violet-700` (blanc dessus : 8,91) |
| blanc sur `--violet-200` #CCB8FF | **1,77** | 4,5 | survol d'élément de menu, thème « blanc » | Figma.md:34813 + 34844 | fond `--violet-700` ou texte noir |
| `--violet-300` #AB8AFF sur blanc | **2,69** | 4,5 (18px gras = 13,5pt, sous le seuil « grand texte ») | titres de groupe du menu (`Database`, `Jobs`, `Mandats`) | Figma.md:33745, 33916, 34091 | `--violet-700` (8,91) |
| `--violet-500` sur blanc | **4,36** | 4,5 | libellés « Annuler » et « OK » du sélecteur de date | Figma.md:4551, 4627 | noir (la couleur d'action du DS) ou `--violet-700` |
| `--encre-300` #A8B1BD sur blanc | **2,17** | 4,5 | valeur de `Date : 12/12/2012`, de `MentionDate` et du placeholder de recherche | Figma.md:8532, 47810, 11515 | `--encre-600` #5d6979 (5,58) pour une valeur ; conservé pour le placeholder, où le gris a le sens d'un texte de substitution |

Écart assumé : dans `LigneDate` et `MentionDate`, la VALEUR est passée en noir alors que le Figma la met en `--encre-300` — afficher une donnée réelle dans le gris du désactivé la fait passer pour une absence de donnée, et la règle §6 (« le texte est toujours noir ») tranche dans ce sens. L'état vide garde le gris du Figma.

## 5. Styles CSS qui ne m'appartiennent pas

- **Barre de défilement.** Le Figma définit un `Scrollbar` : un rail absolu de `width: 0.5px`, `height: 73px`, et un `Line 2` de `border: 2px solid #ADABB3` tourné de 90° (Figma.md:15203, 15220, 15236 ; ~40 occurrences dans l'export). C'est bien un style de barre de défilement, donc des règles CSS (`::-webkit-scrollbar`, `scrollbar-width`, `scrollbar-color`) et non un composant React. `app.css` m'étant interdit, rien n'est implémenté. `#ADABB3` existe déjà comme `--encre-250`. Le rail à 0,5px n'est pas reproductible en `::-webkit-scrollbar` (minimum effectif 1px) ; `scrollbar-width: thin` est l'équivalent portable.

## 6. Cotes absentes du Figma — inventions déclarées

| élément | ce qui manque | ce que j'ai fait |
| --- | --- | --- |
| `EtatVide` | le composant n'existe pas du tout. Le calque `Empty container` (Figma.md:973, 1051, 4125, 4203) est la case VIDE du calendrier (22×24), pas un état vide. Aucun `Empty state`, aucun « Aucun… » dans l'export. | assemblé à partir de l'échelle typographique, `Bouton` et `Illustration` ; espacement (`gap-3`, `px-6 py-10`) choisi, non relevé. À confronter au Figma dès qu'un écran vide y sera dessiné. |
| jour SÉLECTIONNÉ du calendrier | les 40 cellules de la grille sont toutes `Default date` ou `Blank date` (Figma.md:911, 1067, 1159, 1251…) | fond `--violet-500` par analogie avec le menu (Figma.md:35076), texte **noir** — seul appariement AA (4,82 contre 4,36 pour du blanc) |
| jour « aujourd'hui » | absent | filet noir 1px à l'intérieur (`ring-1 ring-inset ring-black`) + `aria-current="date"` |
| jour désactivé | absent | `--encre-300` + barré + `aria-disabled` |
| survol d'un jour | absent | `--violet-100`, d'après le rôle « survol » que lui donne app.css |
| plage d'années du sélecteur | absente | ±10 ans autour du mois affiché, bornée par `dateMin`/`dateMax` |
| libellés textuels du sélecteur de date | Figma nomme les calques (`Supporting text`, `label-text`), jamais leur contenu | « Sélectionner une date », « Annuler » (largeur relevée 44px, Figma.md:4536), « OK » (19px, Figma.md:4612) — déduits de Material et des largeurs. **À valider.** |
| libellés des entrées de menu | tous les calques de texte s'appellent « Les offres » (Figma nomme d'après le premier contenu), largeurs de 52 à 104px | non devinés : ils viennent de l'appelant via `sections`. Seuls les titres de groupe sont littéraux : `Database`, `Jobs`, `Mandats`. |
| panneau du thème « blanc » du menu | le Figma ne dessine qu'un panneau blanc (Figma.md:33616) | non inventé. `variante="blanc"` suppose une surface sombre fournie par l'appelant. |
| semaine commençant le lundi | le Figma commence le DIMANCHE (`Sunday` en `order: 0`, Figma.md:565) | traduit : un calendrier français commence le lundi, et les libellés devaient de toute façon passer en français. |

## 7. Composants relevés qui n'appartiennent à personne

Signalés pour que rien ne se perde entre les lots :

- **`Job Kanban Switcher`** (Figma.md:8896) — bascule Kanban / Tableau de bord, 96×170, variantes `Property 1={Kanban, Dashboard, Kanban hover, Dashboard hover}` (Figma.md:8908, 9012, 9116, 9220). Deux icônes `solar:widget-bold` et `solar:bedside-table-bold` séparées par un filet vertical de 24px (`1px solid #E7E6EB`, Figma.md:8949) ; l'icône active est noire, l'inactive en `#ADABB3`. Ce n'est PAS un composant de navigation : mon brief le rangeait sous `Menu.tsx` (via `Property 1=Dashboard/Kanban`), à tort. Un fichier `SelecteurVue.tsx` existe désormais dans `components/pacha/` — à vérifier qu'il couvre bien ce composant.
- **`Chevron right`** (Figma.md:6549) — un glyphe 20×20 d'une planche d'icônes, pas un composant de menu. Couvert par `Icone` (`icon-chevron-right`).
