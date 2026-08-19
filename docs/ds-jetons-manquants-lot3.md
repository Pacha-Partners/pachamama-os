# Jetons manquants — LOT 3 (boutons, tags, notation, sélecteur de vue)

Valeurs que le Figma impose et qui n'ont pas de jeton exact dans
`styles/brand/*.css` ni dans `styles/app.css`. Écrites en classe arbitraire
Tailwind dans mes composants, à consolider par l'orchestrateur.

| valeur | rôle | composant | ligne Figma |
| --- | --- | --- | --- |
| `rgba(45, 43, 49, 0.75)` | fond de survol du bouton plein (= `--encre-700` à 75 % d'alpha) | `Bouton.tsx` | Figma.md:5188, 5252, 5316, 5380 |
| `#FFFBF0` | fond du tag univers **People** | `Tag.tsx` | Figma.md:58299 |
| `#CCF5E6` | fond du tag univers **Sales** | `Tag.tsx` | Figma.md:58381 |
| `#FFE8E0` | fond du tag contrat **CDI** en `Focus=True` | `Tag.tsx` | Figma.md:47189 |
| `22px` | hauteur du tag contrat (les autres hauteurs ont un jeton) | `Tag.tsx` | Figma.md:47068 |
| `18px` / `22px` | diamètre de la pastille de notation (Small / Medium) | `Notation.tsx` | Figma.md:24531, 24593 |

## Notes de consolidation

**1. Les trois teintes de tag sont des quasi-doublons de jetons existants.**
Elles méritent une décision, pas un jeton de plus :

| Figma | jeton le plus proche | écart |
| --- | --- | --- |
| `#FFFBF0` (People) | `--fond-entete` (#fffbf0) — identique, mais rôle sans rapport ; `--people-100` vaut #fffbdb | teinte identique à `--fond-entete`, pas à la verticale People |
| `#CCF5E6` (Sales) | `--revenue-200` (#caf5e5) | 2 unités sur R et B |
| `#FFE8E0` (CDI focus) | `--product-100` (#ffe9e1) | 1 unité sur G et B |

L'arbitrage déjà écrit en tête d'`app.css` (« couleurs quasi-doublons → la
charte de marque tranche ») s'applique mot pour mot. Si l'orchestrateur l'étend,
ces trois valeurs deviennent `--people-100` / `--revenue-200` / `--product-100`
et les classes arbitraires disparaissent. J'ai gardé les littérales parce que le
brief §1 fait du Figma la norme pour l'interface, et que je ne voulais pas
prendre cette décision de charte à sa place.

**2. Le tag univers Tech est peint avec la rampe d'interface.**
`#E9E0FF` (Figma.md:58218) = `--violet-100` exactement, alors que `--tech-200`
vaut `#ded1ff`. J'ai posé `--violet-100`, donc un tag de verticale peint avec la
couleur interactive de l'app. C'est ce que dit le Figma, mais ça brouille la
frontière verticale / interface. À trancher au même endroit que la note 1.

**3. `--r-controle: 5px` n'a pas de base dans le Figma — à retirer.**
Le jeton a été ajouté dans `app.css` sur la foi de 35 occurrences de
`border-radius: 5px`. Vérification faite : **les 35 sont précédées de
`border: 1px dashed`** (`grep -B1 'border-radius: 5px' Figma.md | grep -c dashed`
→ 35). Ce sont les cadres pointillés que Figma dessine autour d'un jeu de
variantes, jamais un contrôle. Les rayons réels des contrôles de ce lot :

| contrôle | rayon | ligne |
| --- | --- | --- |
| Bouton (24/24 variantes) | 6px = `--r-sm` | Figma.md:4665 |
| Bouton icône | 4px = `--r-xs` | Figma.md:11843, 12337 |
| Tags (les quatre familles) | 8px = `--r-md` | Figma.md:58078, 47073, 58139, 18617 |
| Pastille de notation | plein = `--r-full` | Figma.md:24535 |

Je n'utilise donc pas `--r-controle` : les 6px du bouton tombent exactement sur
`--r-sm`, qui existe déjà. Aucun jeton de rayon n'est à créer.

**4. Jetons utilisés tels quels, sans écart** — pour mémoire, afin que la
consolidation ne les recrée pas : `--encre-100` (#e7e6eb, fond désactivé),
`--encre-200` (#cac9cd), `--encre-250` (#adabb3), `--encre-300` (#a8b1bd, mode
atténué), `--encre-500` (#738296, bordure désactivée), `--encre-700` (#2d2b31),
`--violet-050/100/200/300/500/700/900`, `--product-200` (#ffd2c2), `--ombre-1`,
`--ombre-1-grise`, `--ombre-2`, `--ombre-3`, `--ombre-douce`, `--r-xs`,
`--r-sm`, `--r-md`, `--r-full`, `--h-tag`, `--h-statut`, et les classes typographiques
(`.t-micro-hl`, `.t-caption`, `.t-caption-hl`, `.t-body`, `.t-body-hl`).
