# J5 — Le Chasseur de Talent

> **Créé le 23/09/2026.** Jalon intercalé entre l'espace talent (J4) et le poste
> recruteur (J6). Les anciens J5, J6 et J7 deviennent J6, J7 et J8.

🎯 **Problème**

**31 des 66 mandats ouverts ne portent aucune candidature**, et 21 d'entre eux
depuis plus de trente jours — 1 975 jours-mandat immobilisés. Mesuré sur
346 mandats fermés en 24 mois, un mandat servi dans les trente jours aboutit à
**50,2 %**, un mandat jamais servi à **4,2 %**. Douze fois. Et le retard ne tue
presque pas (44,4 %) : **c'est l'absence de démarrage qui tue**, pas la lenteur.

Le vivier existe pourtant : `pivot.talent` porte **31 220 talents** en
production, vivants et lisibles. Mais il n'est pas interrogeable comme on le
croit — les champs structurés sont remplis à 7–19 %, et sur les 36 métiers
distincts des mandats actifs, **9 ne ramènent aucun profil** par correspondance
littérale, parce que l'intitulé est sur mesure ou abrégé.

💡 **Solution proposée**

Une route `/chasse/{mandat}` sur le back FastAPI existant (2 716 lignes, qui
sert déjà `pivot.talent_recherche`), et un écran monté sur le Design System
(50 composants disponibles).

Le rapprochement se fait sur le **texte**, pas sur la taxonomie : `headline`,
`experience` et `localisation` sont remplis à 76–97 % quand `univers`,
`expertises` et `seniorite` plafonnent à 19 %. Un filtre structuré rejetterait
80 % du vivier. Un balayage plein texte sur toute la base répond en **0,6 s**.

La valeur du modèle est **exactement** de traduire un intitulé de mandat sur
mesure en lexique de recherche — c'est là que les 9 métiers muets se débloquent,
et nulle part ailleurs. Écrire le SQL n'est pas le sujet.

Il lit `pivot` et `public.mandat`. **Il ne dépend ni de `core`, ni du schéma
`api`, ni de la reprise** : aucun geste irréversible n'est engagé.

✅ **Acceptance criteria (Definition of Done)**

* [ ]  Quand un recruteur ouvre un mandat sans candidature, alors il obtient une liste ordonnée d'au moins 10 profils en moins de 5 secondes, ou un message explicite disant pourquoi le vivier ne rend rien.
* [ ]  Quand un profil est proposé, alors la raison du rapprochement est affichée en clair — les termes qui ont matché, et sur quel champ — et un recruteur peut la contester.
* [ ]  Quand l'intitulé du mandat est sur mesure, alors la recherche s'exécute sur un lexique élargi, et le lexique employé est visible et modifiable par le recruteur avant relance.
* [ ]  Quand on relance la même chasse deux fois sans rien changer, alors on obtient la même liste dans le même ordre.
* [ ]  Quand un profil a déjà une candidature sur ce mandat, alors il n'apparaît jamais dans la liste.
* [ ]  Quand un recruteur écarte un profil, alors ce profil ne réapparaît pas sur ce mandat, et le geste est enregistré avec son auteur et son horodatage.
* [ ]  Quand un recruteur retient un profil, alors une candidature est créée sur le mandat, et son **origine est marquée « chasseur »** — sans ce marquage, l'apport du module est non mesurable.
* [ ]  Quand on lance la chasse sur les 66 mandats ouverts, alors le nombre de mandats pour lesquels elle ne rend rien est mesuré et publié : c'est l'indicateur de couverture du module.
* [ ]  Quand un jeton de talent ou d'entreprise interroge la route de chasse, alors il obtient zéro ligne.
* [ ]  Quand le harnais des jalons précédents est rejoué, alors il reste vert.

🗺️ **Zones touchées**

* **Back** : route `/chasse/{mandat}` dans `backend/api/`, lecture seule sur
  `pivot.talent_recherche` et `public.mandat`. Une table d'écriture pour les
  profils écartés et retenus, et le marquage d'origine.
* **Front** : `/(prive)/recruteur/` — **première surface réelle de
  l'application**. Monté sur le DS : `Tableau`, `BarreFiltres`, `CarteCandidat`,
  `Pagination`, `ChampTags`, `PastillePourcentage`.
* **Donnée** : aucune migration sur `core`. Le marquage d'origine est la seule
  écriture nouvelle, et elle est additive.
* **Dépend de** : J2 (résolution du compte et cloisonnement). **Ne dépend pas**
  de J3, J4, ni de la reprise.
* **Préalable produit** : le questionnaire de méthodologie de sourcing
  (`docs/QUESTIONNAIRE_SOURCING.md`) — sans lui, le lexique élargi est deviné.

⚠️ **Ce qui n'est pas dans ce jalon**

Le sourcing externe (LinkedIn, web) : il est **bloqué juridiquement** avant de
l'être techniquement, et la population qui ferait sa valeur — 24 301 profils
issus de l'ATS, dont 17 015 avec un courriel et **0 consentement enregistré** —
est exactement celle dont la base légale n'est pas instruite. À dater à part.

Ni file de tâches, ni orchestration durable, ni recherche vectorielle : avec
66 mandats actifs et ~24 nouveaux par mois, un traitement à la demande de
quelques secondes couvre le besoin. L'ADR 0002 dimensionne pour un volume qui
n'existe pas.
