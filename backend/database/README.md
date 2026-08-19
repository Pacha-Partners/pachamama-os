# database — schéma, dumps et jeux de données

## schema/

| Fichier | Contenu |
|---|---|
| `01_schema_pivot.sql` | schéma `pivot` : 8 tables, 18 index, 1 vue de sourcing, RLS et droits |
| `02_vues_qualite.sql` | 6 vues de contrôle qualité (`qa_*`) |

Les deux sont **rejouables** : on peut les relancer sans effet de bord. Ils
s'exécutent dans cet ordre, le second dépendant des tables du premier.

## migrations/

Vide aujourd'hui. Les évolutions de schéma y seront versionnées une par fichier
horodaté. Le schéma initial reste dans `schema/` : il décrit un état, pas une
transition.

## dump/

`pivot_dump.sql` — schéma complet **plus** un échantillon de 400 talents
**anonymisés**. Restaurable dans une base vierge, et testé comme tel.

Il ne contient pas les données réelles : la base de production porte 30 829
personnes physiques, dont la communication à un tiers serait sans base légale.

## seeds/

Fichiers générés par les audits, destinés à une lecture humaine — notamment
`revue_fusions.md`, le dossier de revue des désaccords de nom entre sources.

## Sécurité du schéma

- **RLS activée sur les 8 tables, aucune policy** : refus par défaut. Les rôles
  publics se voient refuser l'accès au schéma lui-même.
- **`security_invoker` sur les 7 vues.** Sans cette option une vue s'exécute avec
  les droits de son propriétaire et **contourne la RLS des tables** : elle
  rouvrirait ce que les tables protègent.
- Les `GRANT`/`REVOKE` ne sortent jamais du schéma `pivot` : les ~104 tables du
  miroir applicatif ne sont pas concernées.
