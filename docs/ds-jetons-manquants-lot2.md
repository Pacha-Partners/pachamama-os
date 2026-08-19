# Jetons manquants — LOT 2, la famille des champs de saisie

Valeurs imposées par le Figma pour lesquelles il n'existe aucun jeton dans
`styles/brand/*.css` ni dans `styles/app.css`. Elles sont écrites en classe
arbitraire Tailwind dans les composants, en attendant que l'orchestrateur les
consolide.

Fichiers concernés : `components/pacha/{Champ,Selecteur,Cases,ChampTags}.tsx`.

## Couleurs sans jeton

| valeur | rôle | composant | ligne Figma |
| --- | --- | --- | --- |
| `#FF2626` | bordure d'un champ en erreur | `Champ`, `Selecteur`, `SaisieTags`, `Case` | `Figma.md:17518` (texte), `:13714` (déroulant) |
| `#DEE3ED` | bordure d'un champ désactivé | `Champ`, `Case`, `Radio`, `Interrupteur`, `SaisieTags` | `Figma.md:17645` |

Note sur `#FF2626` : `--bord-erreur` existe déjà dans `app.css` mais vaut
`1px solid #e8553a` (le `--marker-red` de la marque). Ce n'est pas la même
couleur que celle du Figma de l'app. Il faut trancher — soit `--bord-erreur`
s'aligne sur `#FF2626`, soit le Figma est corrigé. Tant que ce n'est pas fait,
les composants du lot 2 écrivent `#ff2626` en clair pour ne pas mentir sur la
source.

## Couleurs déjà couvertes par un jeton (pour mémoire, aucune action)

Relevées dans le Figma et rendues telles quelles, mais un jeton existait :

| valeur Figma | jeton utilisé | rôle |
| --- | --- | --- |
| `#5D6979` | `--encre-600` | bordure et icône au survol |
| `#A8B1BD` | `--encre-300` | texte substitut au repos, icône désactivée |
| `#ADABB3` | `--encre-250` | texte substitut en erreur et au désactivé |
| `#738296` | `--encre-500` | texte substitut d'un déroulant |
| `#E7E6EB` | `--encre-100` | fond d'un champ désactivé |
| `#F8F5FF` | `--violet-050` | survol d'option, pastille de réponse, puce au repos |
| `#E9E0FF` | `--violet-100` | option enfoncée (`Resting=Clicked`) |
| `#CCB8FF` | `--violet-200` | puce de tag au survol |
| `#371B7E` | `--violet-900` | puce de tag sélectionnée, puce « autre » ouverte |
| `0 0 3px rgba(0,0,0,.25)` | `--ombre-douce` | élévation au survol et au focus |
| `8px` | `--r-md` | boîtier de champ, panneau ouvert, tags |
| `4px` | `--r-xs` | élément de liste, case à cocher, bouton-icône |
| `36px` | `--h-champ` | hauteur du boîtier |

## Cotes sans jeton, laissées en valeur littérale

Trop locales pour mériter un jeton — signalées pour que l'arbitrage soit fait
sciemment, pas par oubli.

| valeur | rôle | composant | ligne Figma |
| --- | --- | --- | --- |
| `35px` | hauteur d'une option de liste simple, hauteur d'une puce de tag | `Selecteur`, `PuceChoix` | `Figma.md:15044`, `:18614` |
| `50px` | hauteur d'une option à photo, et du boîtier une fois rempli | `SelecteurPersonne` | `Figma.md:16273`, `:20595` |
| `42px` | diamètre d'un avatar | `Avatar` | `Figma.md:16308` |
| `156px` | hauteur maximale d'un panneau ouvert | `PANNEAU_DEROULANT` | `Figma.md:15002` |
| `223px` | largeur du panneau de la puce « autre » | `PuceAutre` | `Figma.md:21178` |
| `27px` | hauteur d'une pastille de réponse dans un champ | `PastilleReponse`, chips de `SaisieTags` | `Figma.md:14662` |
| `21px` / `17px` | bouton-icône et loupe du champ de recherche | `Champ` | `Figma.md:11532` |
| `7px` | retrait compensé quand la bordure passe à 2px (1+8 = 2+7) | tous les boîtiers | déduit de `:16872` et `:17000` |

## Valeurs INVENTÉES — aucune source dans le Figma

À lire comme une dette, pas comme un relevé.

| valeur | rôle | composant | source |
| --- | --- | --- | --- |
| `36×20px`, curseur `12px` | l'interrupteur en entier | `Interrupteur` | **aucune.** Le Figma ne contient pas d'interrupteur (recherché : `Switch`, `Toggle`, `Bascule` — seules les icônes `icon-toggle-left` / `icon-toggle-right`, `Figma.md:55368` et `:55400`). Dérivé du vocabulaire des cases : 20px de haut, bordure 2px noire, noir = actif. |
| `+` | glyphe de la puce « autre » | `PuceAutre` | le Figma exporte les noms de couches, pas leur contenu ; la couche s'appelle « Tag » et ne mesure que 10px de large fermée, 13px ouverte — soit un caractère. Le choix du caractère est le nôtre. |
| `« Aucun résultat »` | liste vide après filtrage | `SaisieTags` | aucun état vide dans les familles de champ du Figma. (`Empty container`, `Figma.md:973` et suivantes, appartient au sélecteur de date Material écarté par `app.css`.) |
| texte d'erreur en noir sous le champ | message d'erreur | tous | le Figma ne montre qu'une bordure rouge, sans ligne de message (hauteur totale 56px = 16 + 4 + 36). Exigence d'accessibilité, pas relevé. |
| état désactivé des cases, radios, interrupteur | — | `Cases` | non montré par le Figma. On y applique le traitement du champ texte désactivé (`#E7E6EB` / `#DEE3ED`, `Figma.md:17644`). |

## Divergences internes au Figma, tranchées dans le code

| point | ce que montre le Figma | ce qu'on a retenu |
| --- | --- | --- |
| couleur du libellé | noir (`:16848`, `:14147`), `#371B7E` (`:17494`, `:17621`, `:12925`), `#5D6979` (`:13996`) | **noir partout.** Règle dure du DS ; trois couleurs pour une même couche relèvent du bruit de maquette. |
| bordure d'un champ désactivé | `#DEE3ED` pour le champ texte (`:17645`), `#000000` pour le déroulant (`:13867`) | **`#DEE3ED` partout.** Une bordure noire ne dit pas « inerte ». |
| couleur de la loupe de recherche | noire dans le champ (`:13041`, `:13239`, `:13437`) ; triptyque violet `#AB8AFF` / `#8657FF` / `#371B7E` pour le bouton-icône autonome (`:11831`, `:11898`, `:11965`) | **noire dans le champ.** Le triptyque violet appartient au bouton-icône, qui n'est pas du lot 2. |
