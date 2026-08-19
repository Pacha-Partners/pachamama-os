# Backend — Pachamama OS

Le backend porte **la base talent unifiée** et les traitements qui l'alimentent
et la contrôlent. Il est organisé par **nature de responsabilité**, pas par
technologie : le framework d'API sera choisi en tâche 5, et ce choix ne doit
obliger à déplacer aucun script de données.

```
backend/
├── database/          tout ce qui définit ou transporte le schéma
│   ├── schema/        DDL : tables, index, vues, sécurité
│   ├── migrations/    évolutions de schéma versionnées (à venir)
│   ├── dump/          exports restaurables
│   └── seeds/         jeux de données et dossiers de revue générés
├── etl/               chargement, réconciliation, audits
├── lib/               modules partagés, purs et testables
├── api/               API d'accès neutre — tâche 5, framework à choisir
└── tests/             tests exécutés contre un PostgreSQL réel
```

## Pourquoi cette séparation

**`database/` contre `etl/`.** Le premier décrit un état (le schéma, un dump) ;
le second décrit un mouvement (charger, réconcilier, auditer). Les mélanger
rendrait impossible de répondre à « quelle est la structure actuelle ? » sans
lire du code de transport.

**`lib/` isolé.** Ces modules sont **purs** : aucune entrée/sortie, aucune
dépendance réseau. C'est ce qui les rend testables unitairement — et la
transformation d'un enregistrement doré est précisément l'endroit où une erreur
se propagerait aux 30 829 talents.

**`api/` vide et assumé.** L'API d'accès neutre est l'objet de la tâche 5. Le
dossier existe pour marquer la place ; y poser du code avant d'avoir choisi le
framework produirait de la dette immédiate.

## Commandes

| Commande | Effet |
|---|---|
| `npm run db:charger:sec` | chargement à blanc, aucune écriture |
| `npm run db:charger` | charge les enregistrements dorés |
| `npm run db:notes` | charge le journal de notes |
| `npm run db:reconcilier` | réconciliation stricte fichier ↔ base |
| `npm run db:preseance` | audit des règles de préséance contre la source |
| `npm run db:fusion` | audit de la qualité des fusions + dossier de revue |
| `npm run db:dump` | génère le dump anonymisé |
| `npm test` | schéma et dump testés contre un PostgreSQL réel |

## Dépendances

Aucune en production : les scripts n'utilisent que la bibliothèque standard de
Node. `@electric-sql/pglite` sert **uniquement aux tests** — il embarque un
PostgreSQL réel, ce qui permet de valider le DDL sans installer de serveur.
