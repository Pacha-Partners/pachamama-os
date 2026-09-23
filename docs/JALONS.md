# Les jalons

**Refondu le 23/09/2026.** Les phases de test — alpha 1, alpha 2, beta, v1.0 —
sont abandonnées. **Le jalon est la seule maille du projet.**

Un jalon avance d'état en état. Il est **validé** quand deux grilles passent :
la **grille technique** (§3) et la **grille produit** (§4). Ni l'une ni l'autre
ne suffit seule.

---

## 1. Les huit jalons

`J5` est intercalé le 23/09/2026 : les anciens `J5`, `J6` et `J7` deviennent
`J6`, `J7` et `J8`.

| | jalon | état | où en est le code |
|---|---|---|---|
| **J1** | Job Board public | **en cours de développement** | 2 écrans écrits · grille non passée |
| **J2** | Authentification et rattachement | **en cours de développement** | écrit · grille non passée |
| **J3** | Portail Entreprise | **en cours de développement** | 7 écrans, 11 actions · grille non passée |
| **J4** | Espace Talent | **en cours de développement** | 7 écrans, 12 actions · grille non passée |
| **J5** | **Le Chasseur de Talent** | **prévu** | rien — ticket écrit le 23/09 |
| **J6** | Poste recruteur : consultation | **prévu** | 21 lignes |
| **J7** | Poste recruteur : actions | **prévu** | rien |
| **J8** | Back-office de gouvernance | **prévu** | 21 lignes |

⚠ **Aucun jalon n'est validé à ce jour.** Les quatre premiers portent du code
écrit, mais **aucun de leurs 29 critères d'acceptation n'a été confronté au
code** et aucune grille n'a été passée. C'est le premier travail, et il ne
demande presque pas de développement — sauf là où il en révélera.

## 2. Les états

| état | on y entre quand |
|---|---|
| **prévu** | le ticket existe et porte ses critères d'acceptation |
| **en maquette** | la maquette est en cours |
| **maquette validée** | le PM l'a validée — c'est le premier point de passage de la grille produit |
| **en cours de développement** | — |
| **prêt pour le test** | **la grille technique passe** (§3) |
| **en test** | quelqu'un qui n'a pas écrit le code l'utilise |
| **recette** | les retours du test sont consignés et en cours de correction |
| **validé** | la boucle test ⇄ recette est terminée, **et les deux grilles passent** |

La boucle `test ⇄ recette` tourne autant de fois qu'il le faut. On n'en sort pas
par lassitude : on en sort quand les deux grilles passent.

## 3. La grille technique

Elle dit quand un jalon est **prêt pour le test**, puis elle est rejouée avant
la validation. Huit points, tous mesurables par une commande. **Aucun ne
s'interprète.**

| | ce qu'on vérifie | comment |
|---|---|---|
| 1 | **Les critères d'acceptation du jalon sont confrontés au code**, un par un, et cochés dans son ticket | à la main, et c'est le point le plus lourd |
| 2 | **Le harnais du jalon est au vert** | `npm --prefix frontend run verifier:jN` |
| 3 | **Aucune régression** : les harnais des jalons précédents restent verts | `verifier:j1` … `jN-1` |
| 4 | **Les tests unitaires passent** | `npm --prefix frontend run test` |
| 5 | **Le schéma se reconstruit depuis zéro** | `supabase start` — rejeu des 127 migrations sur base vierge |
| 6 | **Le cloisonnement est mesuré avec un vrai jeton utilisateur** — jamais la clé de service, qui contourne la RLS | dans le harnais du jalon |
| 7 | **L'écran rend sans erreur** : console propre, aucune requête en échec, et **vérifié à 375 px** | deux défauts déjà trouvés ainsi, aucun test ne les avait vus |
| 8 | **Aucun secret, aucune donnée nominative** dans ce qui est commité | `gitleaks`, et la relecture du diff |

⚠ **Un critère qui ne peut pas être coché n'est pas un critère à contourner.**
Il est arrivé qu'un critère vise une API qui n'a jamais existé — `J2` nomme
`api.auth_entreprise_id()` et `api.auth_talent_id()`, absentes du dépôt. Dans ce
cas le critère se **réécrit** contre ce qui existe, il ne se raye pas.

⚠ **Deux points de la grille ne tournent nulle part aujourd'hui** : le dépôt ne
porte aucun secret de CI, donc les harnais (points 2, 3 et 6) ne sont joués
qu'à la main. C'est à régler avant le premier passage de grille.

## 4. La grille produit — à définir avec le PM

**Elle n'est pas écrite, et je ne l'invente pas.** Elle porte sur ce que la
technique ne sait pas mesurer : est-ce que ça sert, est-ce que c'est
compréhensible, est-ce que ça tient le volume réel.

Les questions auxquelles la séance de cadrage doit répondre, pour que la grille
soit utilisable et non décorative :

1. **Qui valide, et seul ou à plusieurs ?** Une grille sans nom au bout ne se
   passe jamais.
2. **Sur quelle donnée le test se joue-t-il ?** Le projet **dev** porte une
   copie de la production avec des identités réelles. Ce choix est à assumer
   explicitement.
3. **Qu'est-ce qu'un défaut bloquant ?** Il faut une définition qui se tranche
   en dix secondes, sinon chaque retour se rediscute.
4. **Où se consignent les retours de la boucle test ⇄ recette ?** Aujourd'hui,
   nulle part : le dépôt ne porte aucune issue, tous états confondus.
5. **Combien de tours de boucle avant qu'on s'arrête pour reconsidérer le
   jalon ?** Sans cette limite, un jalon peut tourner indéfiniment.
6. **Qu'est-ce qui est vérifié à la main à chaque jalon ?** Le mobile et
   l'accessibilité ne sont couverts par aucun test automatique.

## 5. Ce qui est abandonné

Les phases **alpha 1, alpha 2, beta, v1.0** ne pilotent plus rien.
`PHASES.md` et `CHANTIER.md` sont périmés. `PROTOCOLE_DE_TEST.md` garde sa
valeur descriptive sur les étages de test, mais **la grille technique du §3 le
remplace** comme critère de passage.

Les vocabulaires `LOT 0`–`LOT 3` et `T1`–`T5` restent périmés.

## 6. Mesurer l'activité

Indépendant des jalons, et conservé parce qu'il mesure le métier, pas le projet :

```bash
python3 outils/cap.py live       # 31 mandats ouverts sur 66 sans aucune candidature
```

C'est le chiffre qui justifie que `J5` passe devant `J6`.
