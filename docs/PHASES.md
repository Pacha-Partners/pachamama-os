# Alpha, beta, v1.0 — ce que chaque phase veut dire ici

> **Ce que chaque phase exige d'avoir construit, et ce qui permet d'en sortir,
> est dans `JALONS.md`.** Ici : qui entre, sur quelles données, et le robinet.


Arrêté le 21/09/2026. Ce document dit **ce qui est décidé**, et marque
explicitement **ce qui ne l'est pas** — une décision différée écrite noir sur
blanc n'est pas un trou, c'en est une.

---

## Les définitions

> **Alpha — purement interne.**
> **Beta — ouverte, sur de vraies personnes.**

Ce qui sépare les deux, c'est **qui entre**, pas la nature des données.

La frontière n'est pas dans l'avancement (« 60 % fait », « 90 % fait ») : le
jour venu, personne ne sait dire si on est à 85 ou à 91, et la discussion tourne
à l'opinion.

**La frontière est dans ce qu'on a le droit de casser.**

| | alpha | beta |
|---|---|---|
| **qui entre** | le cabinet, et personne d'autre | des clients et des talents réels, choisis, prévenus |
| **quelles données** | celles du projet **dev** — voir ci-dessous | **les leurs** |
| **on peut remettre à zéro ?** | oui, autant qu'on veut | **jamais** |
| **ce qu'on teste** | est-ce que ça **marche** ? | est-ce que ça **sert**, à leur volume ? |
| **ce qu'on promet** | rien | « ça fonctionne, dites-nous ce qui cloche » |
| **ce qui peut changer** | tout | des correctifs, **plus de fonctionnalité** |

---

## Les quatre étapes

### Alpha 1 — l'existant

Les deux portails clients et le job board, tels qu'ils sont : 7 écrans réels
(plus 3 redirections) côté
talent, 7 côté entreprise, 23 actions d'écriture.

**Elle répond à** : est-ce que la mécanique tient ? Les écrans, les écritures,
le cloisonnement, les parcours.
**Elle ne répond pas à** : est-ce qu'un client trouve son pipeline lisible. Le
cabinet n'est l'utilisateur ni du portail talent ni du portail entreprise.

**On y entre quand** les six harnais passent et que les comptes du cabinet ont
un `app.acces` actif.
**On en sort quand** — voir `JALONS.md` §4. Le critère n'est écrit que là.

### Alpha 2 — les vues internes

`recruteur` et `backoffice`, aujourd'hui deux ébauches de 21 lignes.

**On y entre quand** elles sont navigables de bout en bout.
**On en sort quand** — voir `JALONS.md` §4. Elles se
développent **pendant** l'alpha 1, sur `dev`, fermées en production — leur ligne
`app.acces` n'existe pas, donc personne ne peut y entrer même une fois le code
déployé.

### Beta — le produit complet

**On y entre quand** le périmètre de la v1.0 est **gelé** et qu'on ouvre à des
personnes nommées.
**On en sort quand** — voir `JALONS.md` §4.

### v1.0

**Quand** la beta se ferme — voir `JALONS.md` §4. La v1.0 n'a pas de critère
propre : elle est déclenchée par la sortie de beta, jamais planifiée.

---

## Le robinet : `app.acces`

Une phase ne se décrète pas, elle **se constate**. Le robinet est une table :
`app.acces` porte une ligne par personne et par portail, avec un `actif`.

```
alpha 1   les comptes du cabinet actifs sur talent et entreprise
alpha 2   + le cabinet sur recruteur et backoffice
beta      + quelques clients et talents réels, nommément
v1.0      ouvert
```

**Tant qu'aucun client n'a de ligne, rien ne peut diverger** — il ne peut rien
écrire dans `core`, donc la production reste alignée sur Bubble, donc toutes les
options restent ouvertes. C'est là qu'est la marge de manœuvre, et elle se prend
au dernier moment, **client par client**.

## Où tourne chaque phase

| | adresse | base | données |
|---|---|---|---|
| **alpha** | `pachamama-os-git-recette-…` | projet **dev** | voir ci-dessous |
| **beta**, **v1.0** | le domaine de production | projet **live** | réelles |

⚠ `recette` écrit dans le projet **dev**. Un utilisateur réel qui y travaillerait
perdrait son travail. **Un vrai utilisateur est forcément sur la production** —
`recette` sert à vérifier avant de livrer, pas à héberger des gens.

### ⚠ Les données du dev restent réelles, et c'est délibéré

`peupler_dev.py` sait pseudonymiser le dev depuis la production. **On ne le
lance pas**, et la raison est mesurée : pendant la répétition du 14/09, les deux
courriels invalides qui bloquent la reprise — un nom, une URL LinkedIn — auraient
été remplacés par des adresses valides en `@exemple.test`. **Le blocage serait
resté invisible jusqu'à la production.**

Des données fabriquées cachent précisément les défauts qu'on cherche. L'alpha
tourne donc sur le dev tel qu'il est : une copie de la production, identités
réelles depuis le 08/09.

**Ce que ça implique, et qu'il faut garder en tête** : les clés du projet dev
deviennent des secrets de CI sur un dépôt public, et ce projet porte des
identités réelles. `peupler_dev.py` reste disponible le jour où l'arbitrage
changera.

## Les versions

Les alphas vivent sur `recette`, or `release-please` ne pose ses tags que sur la
branche par défaut. Le plus simple, et c'est le choix retenu : **les tags
d'alpha se posent à la main** — `v1.0.0-alpha.1`, `-alpha.2` — et
`release-please` garde son rôle sur `main` à partir de la beta. Une poignée de
tags manuels sur toute la durée du projet, contre une configuration à tordre.

---

## ⚠ Le fait mécanique qui gouverne le calendrier

`core` **n'est pas une vue** : la reprise y matérialise des copies du miroir
`public`, et **aucun déclencheur ne relie les deux** — mesuré, zéro trigger. Les
insertions portent toutes `on conflict (id) do nothing`, avec un identifiant
déterministe.

| dans Bubble | rattrapé en rejouant la reprise ? |
|---|---|
| une fiche **nouvelle** | **oui** |
| une fiche **modifiée** | **non** — jamais réécrite |
| une fiche **supprimée** | **non** |

*(Seule exception : `20260910200000` rafraîchit les colonnes d'identité — nom,
courriel, photo. Les champs métier restent figés.)*

**Conséquence : un `core` rempli en septembre et basculé en décembre porterait
trois mois de valeurs périmées, qu'aucune ré-exécution ne réparerait.**

D'où deux règles :

1. **`core` reste vide en production** jusqu'à la bascule. C'est l'état le plus
   souple : il n'engage rien.
2. **Remplir et basculer sont le même geste**, à quelques heures près — pas
   quelques semaines.

## Comment on vérifie

Ce document dit ce que sont les phases. **`PROTOCOLE_DE_TEST.md` dit comment on
les éprouve** : les quatre étages (270 cas unitaires, 313 appels
d'intégration, le rejeu du schéma, le test humain), ce qui doit être vert et
quand, les parcours à jouer par phase, et les cinq angles morts.

## L'outil de mesure

```bash
python3 outils/derive.py live              # l'écart, à l'instant T
python3 outils/derive.py live --archiver   # et on le garde pour comparer
python3 outils/derive.py live --contre var/derive/live-20260921-082526.json
```

Lecture seule, garde dans le code. Il rend les migrations en attente, les
volumes miroir contre `core`, et les **défauts de donnée qui bloqueraient la
reprise**. Code de sortie 1 s'il existe un blocage, pour qu'un script puisse s'y
fier.

Relevé le 21/09 sur la production : 107 migrations en attente, `core` vide,
**2 courriels invalides (bloquants)**, 3 salaires inversés, 22 contacts sans
identité. Et le miroir avait pris +62 fiches, +104 candidatures et +449 notes en
une semaine : c'est cette dérive-là qu'il faut regarder avant de décider.

---

## Ce qui n'est PAS décidé, et pourquoi

> **La beta se fera-t-elle sur de vraies données ?**

**Décision différée, volontairement.** Elle dépend d'un contexte qui n'existe pas
encore, et la prendre aujourd'hui reviendrait à parier. Rien dans l'état actuel
ne la force : `core` vide et `app.acces` sans ligne cliente laissent les deux
portes ouvertes.

Les trois issues, pour que le choix soit posé le jour venu plutôt que redécouvert :

- **beta en lecture seule** — les clients regardent, n'écrivent pas. Sûr, mais
  on ne teste presque rien : 23 actions d'écriture resteraient hors d'épreuve ;
- **bascule par client** — les mandats de deux ou trois clients passent dans la
  nouvelle application, et les recruteurs cessent d'y toucher dans Bubble.
  Réaliste, réversible client par client ;
- **bascule totale** — tout le monde change de main le même jour.

**Ce qui informera la décision** — à mesurer le moment venu, pas à deviner
maintenant :

1. `python3 outils/derive.py live` : combien de blocages restent, et de combien
   le miroir a bougé depuis la dernière mesure ;
2. où en sont `recruteur` et `backoffice` — sans eux, les recruteurs continuent
   dans Bubble, donc la divergence est certaine ;
3. combien de clients acceptent d'être cobayes, et sur combien de mandats ;
4. si la bascule par client est tenable côté cabinet : un recruteur qui doit
   regarder deux outils selon le client fera des erreurs.
