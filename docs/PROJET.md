# Pachamama OS — structure du projet

> Nom de code : **cash-cash**. Document de référence : il dit ce qu'est le
> projet, où il en est, et ce qui vient ensuite. Toute décision de périmètre
> se tranche ici avant d'être codée.
>
> Dernière mise à jour : 20/08/2026.

---

## Le projet en une phrase

Transformer la relation de Pachamama à ses talents — aujourd'hui dans les têtes
et dans deux bases qui s'ignorent — en un **actif exploitable** : une base
unifiée, les portails qui s'y adossent, et un agent de sourcing qui travaille
dessus.

## Trois parties, et l'ordre n'est pas négociable

```
   1. LA BASE TALENT UNIFIÉE            le socle
              │
              ├──────────────► 2. L'APPLICATION           4 vues + Job Board
              │                          │
              └──────────────────────────┴──► 3. LE CHASSEUR DE TALENTS
```

On ne branche pas un moteur de rapprochement sur deux bases qui se contredisent :
il hériterait de leurs contradictions et produirait des recommandations fausses
avec assurance. L'ordre est une **contrainte de dépendance**, pas une préférence.

---

# Partie 1 — La base talent unifiée

Cinq tâches, dans `Project./Bubble migration/BDD_talent_unifiee_plan.md`.

| | Tâche | État |
|---|---|---|
| **T1** | Cadrage et architecture du pivot | **réalisée** |
| **T2** | Inventaire de l'app et modèle de données talent | **réalisée** |
| **T3** | Moteur d'inclusion et **règles de préséance** | **réalisée** |
| **T4** | Réconciliation ATS ↔ app et migration | **réalisée** — close le 19/08/2026 |
| **T5** | API d'accès et synchronisation bidirectionnelle | **à découper, voir ci-dessous** |

⚠️ Les **règles de préséance sont la T3**, pas la T4. La T4 était la
réconciliation et la migration. La distinction compte : la préséance est une
règle métier arbitrée, la réconciliation est son exécution contrôlée.

## Ce que le socle porte aujourd'hui

Schéma `pivot` : **8 tables, 18 index, 7 vues de qualité, 157 891 lignes**, dont
**30 829 enregistrements dorés** — 24 367 issus de l'ATS seul, 4 155 de l'app
seule, 2 307 fusionnés. Sécurité vérifiée en production : RLS active sur les
8 tables **sans aucune policy** (refus par défaut), `security_invoker` sur les
7 vues.

Preuves : réconciliation à trois axes (**écart nul**), audit de préséance
(**0 violation** sur 136 occurrences), qualité des fusions (**99,83 %** contre un
seuil de 95 %), validation croisée par deux chemins indépendants, restauration du
dump en base vierge (**24 contrôles verts**).

## La T5 doit être coupée en deux

C'est le principal ajustement de cadrage à faire, parce qu'en l'état la T5
paraît bloquée alors qu'elle ne l'est qu'à moitié.

### T5-a — L'API d'accès au pivot · **faisable maintenant**

Personne n'écrit en direct dans le pivot : tout passe par une API neutre qui
découple producteurs et consommateurs. Le squelette existe (FastAPI, 8 modules,
application de la RLS par `SET LOCAL ROLE` et injection des revendications
vérifiées du jeton).

Reste à faire : les endpoints de lecture réels, la pagination, les filtres,
la documentation du contrat, et les tests contre un PostgreSQL réel.

### T5-b — La synchronisation bidirectionnelle · **bloquée, dépendance externe**

Exige un **accès en écriture à l'ATS**, dont nous ne disposons pas — seul un
export en fichier est disponible. Ce goulot ne se résout pas par plus de travail
mais par une négociation avec un tiers.

Conséquence concrète : **le pivot est un instantané**. 114 candidats vivants dans
l'app en sont absents, tous créés après l'extraction du 21/07. Ce n'est pas une
perte, c'est la démonstration que la base a besoin de la synchronisation pour
rester courante.

---

# Partie 2 — L'application

Quatre vues, plus une surface publique. Le cadrage détaillé des features est dans
`Project./Bubble migration/CADRAGE_FEATURES.md`, par portail, avec type
(existant/nouveau), priorité et valeur.

| Surface | Rôle | État |
|---|---|---|
| **Job Board public** | les offres, sans compte, **indexable** | **réalisé** — 12 offres, filtres par URL, fiches prérendues |
| **Talents** | profil, attentes, candidatures, recommandations | **réalisé** (démonstration) |
| **Entreprises** | suivi **anonymisé** des candidats | **réalisé** (démonstration) |
| **Recruteurs** | c'est l'**interface du Chasseur**, pas un CRM de plus | **à construire** |
| **Backoffice** | gouvernance : accès, qualité de donnée, taxonomies, conformité | **à construire** |

## Le socle d'interface, réalisé

**25 composants** dans `frontend/components/pacha/`, portés depuis 95 006 lignes
d'export de maquettes ; **252 icônes** typées, **34 illustrations** de marque,
**14 classes typographiques**, et une page de référence `/design-system` qui rend
chaque composant dans tous ses états — parce qu'un design system qu'on ne peut
pas regarder n'est pas vérifiable.

Contrastes WCAG **mesurés** sur les 57 jetons de fond. Les 8 paires prescrites
par la maquette qui échouent au seuil AA sont documentées avec leur mesure ;
celles des pastilles de statut ont été tranchées **pour la charte** (texte noir),
l'écart étant tracé dans le code.

## La règle d'architecture des vues

**Les composants de vue prennent leurs données en props et n'importent jamais une
fixture.** La route authentifiée lira l'API, la route de démonstration passe des
données fictives — une seule implémentation, deux sources. Le jour où l'API
existe, on change la source, pas la vue.

## Ce qui reste conçu, non codé

L'authentification (les policies de cloisonnement restent à écrire), le
déploiement de l'API, et les deux vues manquantes.

---

# Partie 3 — Le Chasseur de Talents

Un agent qui **cible et qualifie sur la base entière** : 30 829 talents, pas
6 856. Sa valeur dépend entièrement de la qualité du socle — d'où sa position en
troisième.

Pipeline en sept étapes, cadré dans `CADRAGE_FEATURES.md` :
brief assisté → plan → sourcing multi-canal → enrichissement → scoring →
**validation critique** → short-list.

## La règle éthique du produit, à rendre visible dans l'interface

**L'IA propose, le recruteur décide.** Un outil de recrutement qui déciderait
seul reproduirait des biais à grande échelle. Trois garanties concrètes :

- aucune action irréversible prise par l'agent ; l'écriture métier n'a lieu que
  sur action humaine ;
- le **motif du rapprochement toujours affiché** — un score sans justification
  est inauditable ;
- le champ `genre`, présent dans la source, **n'est pas chargé du tout**.

## Technologies réservées, volontairement pas installées

Décision `docs/decisions/0002-technos-reservees-chasseur.md` : exécution durable
avec human-in-the-loop, traçage et plafonnement des coûts, file de tâches,
modèle d'embeddings. Identifiées, non installées — installer une dépendance dont
on n'a pas encore l'usage, c'est s'engager sans contrepartie.

---

# Ce qui vient ensuite

Par ordre de dépendance, pas d'envie :

1. **La vue recruteur / Chasseur** — la dernière des vues du funnel, et la plus
   démonstrative. Elle ne nécessite aucune brique d'IA pour exister en prototype.
2. **T5-a, l'API de lecture** — c'est elle qui débranche les fixtures et fait
   passer les vues de « démonstration » à « application ».
3. **L'authentification et les policies de cloisonnement** — sans elles, les
   routes privées n'ont rien à protéger.
4. **Le backoffice**, dont les besoins sont déjà documentés en 8 domaines.
5. **Le Chasseur réel**, une fois le socle branché.

---

# Dettes ouvertes, transverses

Elles ne bloquent aucune des trois parties mais elles se paient si on les oublie.

| Dette | Où |
|---|---|
| **Le jeton de l'API de l'outil no-code n'a jamais été tourné** | sécurité, prioritaire |
| `NEXT_PUBLIC_VERSION_EN_LIGNE=1` à poser sur l'hébergement | ouvre le Job Board et les démonstrations en ligne |
| Les 3 comptes de démonstration ne sont pas créés | `IDENTIFIANTS_DEMO.md`, rôle dans `app_metadata` |
| `notes_bloc` : la matière est chargée, la génération reste à lancer | T4 §9 |
| Files de revue qualité, interrogeables par les vues `qa_*` | 65 dorés sans identité, 7 013 sans moyen de contact, 247 emails génériques |
| Une fiche de l'app porte l'URL de profil d'une autre personne | correction à la source |
| Pagination du dossier Bachelor non résolue | 26 pages rendues contre ~46 attendues |
