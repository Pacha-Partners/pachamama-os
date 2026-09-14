# Le schéma cible de l'application

> Étude du 26/08/2026. Méthode : étude complète du miroir, lecture des 441
> lignes de `CADRAGE_FEATURES.md`, déduction du schéma. Critère dominant :
> ne perdre aucune donnée.
>
> Données de l'étude : `backend/database/modele_cible/`

## La preuve de non-perte

**688 lignes de correspondance pour 688 colonnes.** Vérifié indépendamment de
l'analyse qui l'a produite : aucune colonne manquante, aucune inventée, aucun
doublon. C'est ce contrôle arithmétique qui transforme « ne rien perdre » d'une
intention en une propriété.

Ce que devient chaque colonne :

| transformation | colonnes | ce que ça dit |
|---|---:|---|
| renommée | 214 | le nommage Bubble ne survit pas |
| identique | 109 | **seules 109 colonnes sur 688 passent inchangées** |
| valeur vers référentiel | 109 | des libellés d'affichage stockés comme valeurs |
| type corrigé | 97 | dates, montants et drapeaux mal typés |
| fusionnée | 61 | des colonnes éparpillées qui décrivent la même chose |
| abandonnée | 84 | motivée, voir plus bas |
| repliée depuis une table 1 pour 1 | 14 | les satellites du candidat |

Seize pour cent des colonnes traversent sans changement. C'est la mesure de la
distance entre le miroir et un modèle.

## Les 84 abandons, et pourquoi ils sont légitimes

Chacun porte une raison, et ils se rangent en 13 familles mesurées. Les plus
nombreuses : 23 artefacts de plateforme (`slug` sur 21 tables, tous vides —
mesuré), 12 clés de jointure de blocs 1 pour 1 repliés dans leur parent, 12
tables N-N qui n'étaient que du 1-N redondant, 8 colonnes d'échafaudage de
migration, 7 colonnes mesurées vides en production, 6 tables de liaison mortes.

**Un abandon a été renversé** après vérification croisée :
`job_actuel.entreprise_id`, écartée comme « doublon appauvri », porte 6 valeurs
réelles. L'argument se défendait, mais 69 % des `employeur_nom` contiennent un
identifiant Bubble au lieu d'un nom : ces 6 liens sont le seul rattachement
fiable quand il existe. La colonne est portée.

## Le miroir est déjà lossy — et ça change la référence

Le champ Bubble **`Actif`, rempli à 100 % sur 6 783 candidats, n'a jamais été
synchronisé**. Vérifié deux fois : zéro occurrence dans `n8n_sync_type.js`,
aucune colonne dans le DDL d'origine.

Conséquence de méthode : **la référence de non-perte n'est pas le miroir, c'est
Bubble.** Un schéma déduit du seul miroir hérite de ses pertes. L'inventaire des
345 champs Bubble (`Tache2_inventaire_app.md`, extraction live du 16/07) doit
servir de second contrôle — au moins sur le domaine talent, seul couvert.

⚠️ Attention en le faisant : comparer des noms Bubble à des noms de colonnes ne
prouve rien, la synchro renomme (`cand_firstname` → `prenom`, `num_tel` →
`telephone`). La confrontation doit passer par la table de correspondance de la
synchro, pas par les noms.

## La forme : 97 entités, et trois couches à ne pas confondre

817 attributs, cinq espaces de noms. Mais tout n'est pas à construire, et les
mélanger serait bâtir 97 tables pour un jalon 1 qui en demande quatre.

**Ce que la migration doit porter — 57 entités.** `core` (34) : le talent,
l'entreprise, le mandat, la candidature, le placement, la note, la tâche, le
contact client, l'utilisateur, et leurs tables de liaison réelles. `ref` (15) :
les référentiels, avec code interne **et** libellé séparés. `config` (8) : le
paramétrage et les modèles d'e-mail. C'est le périmètre qui reproduit Bubble
sans perte, et c'est lui qu'il faut modéliser au champ près.

**Ce que l'application possède, jalon par jalon — 35 entités `app`.** Quatre
seulement servent les jalons 1 et 2 : `mandat_publication`, `compte`,
`journal_ecriture`, `idempotence`. Les autres arrivent avec leur jalon.

**Ce qui est feuille de route, nommé mais pas construit.** `app.embedding`,
`app.score_fit`, `app.agent_run`, `app.agent_step`, `app.agent_result`,
`app.conversation_assistant` viennent des fonctionnalités ✨ nouvelles d'IA. Les
nommer maintenant évite de réouvrir le modèle plus tard ; les construire
maintenant serait de la spéculation.

**Et `sync` (4 entités)** ne suit pas : cette tuyauterie meurt avec le miroir.

## Les manques qui portent sur des fonctionnalités déjà en production

Ce sont les plus urgents, parce qu'ils ne sont pas des nouveautés mais des
choses que Bubble fait aujourd'hui et que le modèle ne saurait pas refaire :

- **`ref.etape_process`** — 7 attributs, dont les libellés publics et les
  drapeaux de visibilité du kanban client. La table source est **détruite** en
  production, alors que le kanban tourne.
- **`ref.tag_job`** — `icone_url` perdu sur les 16 tags.
- **`core.mandat`** — `libelle_public`, `localisation`, `departement`,
  `publie_le` : rien de tout cela n'existe, et le job board en dépend.
- **le drapeau `actif`** sur le talent, l'entreprise et l'utilisateur.
- **`app.compte`** — `auth_id` et `role`, parce que `public.user.auth_id` est
  vide sur ses 4 605 lignes.
- **`core.candidature`** — le motif de KO. 6 287 candidatures sur 7 243 finissent
  par un KO, et aucune colonne ne dit pourquoi. À créer, pas à migrer.

## Arbitrages restants, remontés par l'étude

- `job_reve.salaire` et `job_reve.salaire_maximum` : côté Bubble le couple est
  « Salaire minimum » et « Salaire souhaité ». Rien n'établit laquelle porte
  laquelle. Les nommer min/max risque de les inverser — **à mesurer avant**.
- `candidat_expanded` reprend exactement les champs marqués `_del_` de
  `candidat`. Lequel est vivant ? Une dizaine de colonnes changent de camp selon
  la réponse.
- Les 45 colonnes `sort_order` des référentiels : classées artefact, mais elles
  portent l'ordre des listes déroulantes. Arbitrage de produit.
- `mandatclose` et `mandate_closed_split` — 54 colonnes de placement et de
  commission — méritent-elles une entité de revenu autonome ?
- Deux secrets d'intégration vivent dans des tables de données :
  `ref_slack_channel.webhook` et `ref_sendgrid_template`. Ils n'ont rien à y
  faire.
