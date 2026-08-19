# Pachamama OS

Projet annuel · **Bachelor Data & Business Intelligence — Chef de projet web (RNCP40857)**
Claude Menye · NEXA Digital School Lyon · août 2026

> Transformer le vivier de talents de Pachamama en un actif exploitable :
> une base unifiée, des portails qui s'y adossent, et un module de sourcing par IA.

## Les trois étapes du projet

| | Étape | État |
|---|---|---|
| **1** | **La base talent unifiée** — le socle dont tout dépend | ✅ **en place** |
| **2** | La refonte applicative — portails recruteurs, entreprises, talents | conçue |
| **3** | Le module « Chasseur de Talents » — sourcing par IA | conçu |

L'ordre n'est pas négociable : l'IA n'a rien à sourcer sans base centralisée, et
les portails n'ont rien à afficher sans donnée fiable.

## Organisation du dépôt

```
docs/decisions/      les décisions d'architecture (ADR), datées et justifiées

backend/
├── database/        SQL : schéma, migrations, dumps, jeux de données
├── pipeline/        Node : chargement, réconciliation, audits du pivot
└── api/             Python : FastAPI, l'API d'accès neutre

frontend/            Next.js : les quatre vues + le job board public
```

**Un langage par sous-arbre, un manifeste de dépendances par projet.** Trois
projets autonomes qui se lancent séparément, orchestrés par les scripts npm de
la racine. Chaque dossier porte son README.

### Les scripts

| Commande | Effet |
|---|---|
| `npm run installer` | installe les trois projets |
| `npm run front:dev` | le frontend en développement |
| `npm run api:dev` | l'API en développement, rechargement à chaud |
| `npm run db:charger` · `db:notes` | chargement du pivot et du journal |
| `npm run db:reconcilier` · `db:preseance` · `db:fusion` | les trois audits |
| `npm run db:dump` | régénère le dump anonymisé |
| `npm run verifier` | **tout** : tests base, lint et tests API, build frontend |

### La stack

Décidée et justifiée dans [`docs/decisions/0001-stack-technique.md`](docs/decisions/0001-stack-technique.md).
Les technologies réservées au module de sourcing par IA sont notées dans
[`0002-technos-reservees-chasseur.md`](docs/decisions/0002-technos-reservees-chasseur.md)
— identifiées, **volontairement pas installées**.

```
FRONTEND   Next.js 16.3 · React 19 · Tailwind v4 · shadcn/ui
           TanStack Query/Table/Virtual · Zod · Vitest · Playwright
BACKEND    FastAPI · Python 3.12 · asyncpg · uv · Ruff · mypy · pytest
DONNÉES    Supabase PostgreSQL · Auth (JWT + RLS) · pgvector
```

## La base, en chiffres

| Table | Lignes |
|---|---|
| `talent` | 30 829 |
| `talent_source` | 33 546 |
| `email` | 24 365 |
| `phone` | 11 428 |
| `qualification` | 6 092 |
| `attentes` | 5 714 |
| `parcours` | 26 536 |
| `note_journal` | 19 381 |
| **total** | **157 891** |

Composition : 24 367 talents issus de l'ATS seul, 4 155 de l'application seule,
2 307 fusionnés sur les deux sources — les deux bases étaient largement
disjointes, ce qui justifie à lui seul le travail d'unification.

## Démarrage rapide

```bash
npm install                          # dépendances de test uniquement

# Restaurer le livrable dans une base locale
createdb pachamama_pivot
psql "postgresql://<user>:<pass>@localhost:5432/pachamama_pivot" \
     -f backend/database/dump/pivot_dump.sql

# Vérifier
psql "<url>" -c "SELECT * FROM pivot.qa_completude;"
```

## Reconstruire depuis la source

```bash
cp .env.example .env.local     # puis renseigner les accès
npm run db:charger:sec         # à blanc, aucune écriture
npm run db:charger             # les enregistrements dorés
npm run db:notes               # le journal de notes
npm run db:reconcilier         # réconciliation stricte
npm run db:preseance           # audit des règles de fusion
npm run db:fusion              # audit de la qualité des fusions
npm run db:dump                # dump anonymisé
npm test                       # schéma + dump contre PostgreSQL réel
```

## Preuves de qualité

| Contrôle | Résultat |
|---|---|
| Réconciliation fichier ↔ base | **écart nul** sur les volumes, l'identité des clés et le contenu |
| Audit de préséance (contre l'export source) | **0 violation** sur 136 replis |
| Concordance des fusions (témoin indépendant) | **99,83 %** sur 2 303 fusions décidables |
| Faux positifs imputables au moteur | **0** |
| Restauration du dump en base vierge | **24 contrôles verts** |
| Accès public à la base | `permission denied` — tables **et** vues |

## Protection des données personnelles

La base de production porte 30 829 personnes physiques ; le livrable n'en
contient aucune. Il porte le **schéma à l'identique** et un **échantillon de 400
talents anonymisés**. Le champ `genre`, présent dans la source, n'est pas chargé
du tout. Détail : `backend/database/README.md`.

## Prérequis

- Node.js 22+ (testé sur 24.14)
- PostgreSQL 15+ avec `pg_trgm` (testé sur 18.3, déployé sur 15)
