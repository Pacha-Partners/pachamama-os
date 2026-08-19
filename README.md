# Pachamama OS

Système d'information du collectif Pachamama : une **base de talents unifiée**,
trois portails et un agent de sourcing.

Projet annuel — Bachelor Data & Business Intelligence, titre professionnel
« Chef de projet web » (RNCP40857), NEXA Digital School Lyon.
Apprenant : **Claude Menye**. Août 2026.

---

## 1. À lire d'abord : ce dépôt ne peut pas être exécuté en l'état, et c'est voulu

**Aucun identifiant n'est fourni, ni ici ni dans l'archive de rendu.**

Ce n'est pas un oubli. La base de production porte **30 829 personnes
physiques** : transmettre les clés d'accès à un tiers serait une communication de
données personnelles sans base légale. Le dépôt contient donc les **noms** des
variables d'environnement nécessaires (`*.env.example`) mais **aucune valeur**.

**Pour évaluer le projet, utilisez l'application déployée** — elle est publique et
ne demande aucun compte :

| Ce que vous voulez voir | Adresse |
|---|---|
| Accueil et état d'avancement | `/` |
| **Job Board public** — la seule vue destinée à être indexée | `/offres` |
| Une offre en détail | `/offres/<identifiant>` |
| **Le design system** — chaque composant dans chacun de ses états | `/design-system` |
| Démonstration — espace talent | `/demo/talent` |
| Démonstration — portail entreprise (suivi anonymisé) | `/demo/entreprise` |
| Démonstration — Chasseur de Talents (vue recruteur) | `/demo/recruteur` |

Les trois portails privés sont derrière authentification et leur donnée est
cloisonnée **au niveau de PostgreSQL** par des policies de Row Level Security —
pas par une condition dans le code applicatif. Les rendre publics reviendrait à
défaire exactement ce qui les protège. Les routes `/demo/*` rendent donc **les
mêmes composants de vue**, alimentés par des données fictives : c'est ce qui
permet de montrer l'interface sans distribuer d'identifiants.

---

## 2. Ce qui est réalisé, en cours, ou conçu

Trois mots, employés sans complaisance dans toute la documentation de ce projet.

### Réalisé — existe, exécutable, vérifié

- **La base de talents unifiée.** Schéma PostgreSQL dédié, **8 tables, 18 index,
  7 vues de qualité, 157 891 lignes**, dont **30 829 enregistrements dorés** issus
  de la réconciliation de deux systèmes qui s'ignoraient (26 689 profils d'un
  côté, 6 856 de l'autre).
- **Le pipeline ETL** : cascade de rapprochement, fermeture transitive des
  grappes, survivance champ par champ avec conservation de la provenance,
  réconciliation et audits exécutables.
- **Les preuves** : réconciliation à trois axes (**écart nul**), audit de
  préséance (**0 violation** sur 136 occurrences), qualité des fusions
  (**99,83 %** de concordance contre un seuil de 95 %), validation croisée par
  deux chemins indépendants, restauration du dump en base vierge
  (**24 contrôles verts**).
- **La sécurité, vérifiée en production** : RLS activée sur les 8 tables **sans
  aucune policy** (refus par défaut), `security_invoker` sur les 7 vues, et
  `permission denied for schema pivot` avec la clé publique — sur les tables
  comme sur les vues.
- **Le design system de l'application** : 25 composants, 252 icônes typées,
  34 illustrations de marque, 14 classes typographiques, et une page de référence
  qui rend chaque composant dans chacun de ses états. Contrastes WCAG **mesurés**
  sur les 57 jetons de fond.

### En cours

- Les quatre vues de l'application, alimentées par des données de démonstration.

### Conçu — spécifié, décidé, documenté, non codé

- L'API de lecture cloisonnée (le squelette existe, la RLS y est appliquée par
  `SET LOCAL ROLE` et injection des revendications vérifiées du jeton).
- L'authentification, la synchronisation bidirectionnelle — elle exige un **accès
  en écriture** à l'ATS dont nous ne disposons pas — et l'agent de sourcing.

---

## 3. Prérequis

| Outil | Version |
|---|---|
| Node.js | ≥ 20 (développé sous 22) |
| npm | ≥ 10 |
| Python | 3.12 |
| `uv` | gestionnaire de paquets Python |
| PostgreSQL | 15+ — ou un projet Supabase |

---

## 4. Installation

### 4.0 Le plus court chemin — les scripts de la racine

Le dépôt réunit trois projets autonomes, **un langage par sous-arbre, un
manifeste de dépendances par projet**. Ils se lancent séparément, et les scripts
de la racine les orchestrent :

| Commande | Effet |
|---|---|
| `npm run installer` | installe les trois projets |
| `npm run front:dev` | le front-end en développement |
| `npm run api:dev` | l'API en développement, rechargement à chaud |
| `npm run db:charger` · `db:notes` | chargement du pivot et du journal de notes |
| `npm run db:reconcilier` · `db:preseance` · `db:fusion` | les trois audits |
| `npm run db:dump` | régénère le dump anonymisé |
| `npm run verifier` | **tout** : tests base, lint et tests API, build front-end |

Les sections suivantes détaillent chaque projet, si vous préférez les lancer à la
main.

### 4.1 Le front-end

```bash
cd frontend
npm install
cp .env.example .env.local   # puis renseigner les valeurs (voir §5)
npm run dev                  # http://localhost:3000
```

**Le front-end démarre sans aucune variable d'environnement.** La lecture de
session (`lib/session.ts`) traite un environnement non configuré comme un
visiteur non identifié : l'accueil, le Job Board, le design system et les
démonstrations fonctionnent immédiatement. Seules les routes authentifiées
redirigent vers l'écran de connexion.

C'est le chemin recommandé pour évaluer le code sans identifiants.

### 4.2 Le back-end

```bash
cd backend/api
uv sync
cp .env.example .env         # puis renseigner DATABASE_URL et SUPABASE_URL
uv run uvicorn pachamama_api.main:app --reload   # http://localhost:8000
```

⚠️ **Piège de connexion, documenté parce qu'il coûte une heure à qui l'ignore** :
avec un connecteur en mode transaction, les requêtes préparées d'`asyncpg` sont
cassées. Il faut le **port 6543**, `statement_cache_size=0`, et aucun pool côté
client. C'est déjà appliqué dans `db.py`.

### 4.3 La base de données

```bash
psql "$DATABASE_URL" -f backend/database/schema/01_schema_pivot.sql
psql "$DATABASE_URL" -f backend/database/schema/02_vues_qualite.sql
```

Les deux fichiers sont **rejouables** : un second passage ne casse rien et ne
duplique rien.

Pour obtenir une base **peuplée** sans donnée réelle :

```bash
psql "$DATABASE_URL" -f backend/database/dump/pivot_dump.sql
```

Ce dump contient le **schéma à l'identique** et **400 talents anonymisés**.
L'anonymisation est **déterministe** (dérivée d'un hachage de l'identifiant) donc
reproductible, et **non réversible**. Sont remplacés : identités, emails,
téléphones, URL LinkedIn, intitulés de poste, employeurs, parcours, formations,
descriptions rédigées par les talents, notes des recruteurs. Sont conservés,
parce qu'ils portent toute la valeur analytique et aucun identifiant : type de
fusion, provenance des champs, univers, séniorité, niveau d'anglais, expertises,
secteurs, contrats visés, fourchettes de rémunération, ville. Le champ `genre`,
présent dans la source, **n'est pas chargé du tout** — minimisation.

Sa restauration en base vierge est vérifiée par **24 contrôles** : structure,
sécurité (RLS active, 0 policy), données, cohérence relationnelle, vues
fonctionnelles, et **absence de donnée réelle**.

---

## 5. Identifiants — pourquoi il n'y en a aucun

Le guide d'évaluation demande « les identifiants de test, les identifiants de
connexion à la base SQL, un accès administrateur au back-office ».

**Je ne les fournis pas, et c'est un choix motivé** :

- **Base SQL** : la base de production porte 30 829 personnes physiques. Aucune
  base légale ne couvre la transmission de ses accès. Le dump anonymisé du §4.3
  est la réponse : il donne une base identique en structure, peuplée, et sans
  aucune donnée personnelle.
- **Comptes de test et accès administrateur** : l'authentification n'est pas
  encore branchée — la créer à la hâte pour produire un jeu d'identifiants
  reviendrait à livrer un contrôle d'accès non éprouvé, ce qui est pire que pas
  de contrôle d'accès. Les **routes `/demo/*` de l'application déployée** montrent
  les quatre vues sans aucun compte, ce qui répond à l'intention de l'exigence.

Variables attendues, si vous branchez votre propre instance :

| Fichier | Variables |
|---|---|
| `frontend/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `API_URL` |
| `backend/api/.env` | `SUPABASE_URL`, `DATABASE_URL`, `DB_SCHEMA`, `ENVIRONNEMENT`, `ORIGINES_AUTORISEES` |

La clé de service n'apparaît nulle part dans un chemin qui sert un utilisateur :
elle **contourne la RLS**, donc l'API ouvre une transaction, exécute
`SET LOCAL ROLE authenticated` et injecte les revendications **vérifiées** du
jeton dans `request.jwt.claims`. C'est le moteur de base qui autorise, pas le
code applicatif.

---

## 6. Vérifier le projet

```bash
cd frontend && npm run build        # typage strict + construction
cd frontend && npx eslint app components lib
cd backend/api && uv run ruff check . && uv run mypy .
cd backend/api && uv run pytest     # dont les tests de sécurité
```

Les tests de sécurité vérifient notamment qu'**un rôle n'est jamais lu dans
`user_metadata`** — champ que l'utilisateur peut modifier lui-même, et donc
s'attribuer le rôle administrateur.

---

## 7. Organisation du dépôt

```
frontend/                 Next.js 16 · React 19 · Tailwind v4
  app/                    routes (App Router)
    (public)/offres/      Job Board — la seule vue indexable
    (prive)/              portails authentifiés
    demo/                 démonstrations publiques, données fictives
    design-system/        page de référence du design system
  components/pacha/       les 25 composants du design system
  components/vues/        les vues, pilotées par props
  lib/demo/               données de démonstration typées
  styles/                 miroir du design system de marque + couche interface

backend/
  database/schema/        DDL rejouable — schéma pivot et vues de qualité
  database/dump/          dump anonymisé restaurable
  pipeline/etl/           chargement, réconciliation, audits
  pipeline/lib/           modules purs et testables
  api/                    FastAPI — lecture cloisonnée par RLS

docs/decisions/           décisions d'architecture, datées et justifiées
docs/journal.md           journal de bord
```

Une règle d'architecture gouverne `components/vues/` : **les composants de vue
prennent leurs données en props et n'importent jamais une fixture.** La route
authentifiée lira l'API, la route de démonstration passe des données fictives —
une seule implémentation, deux sources.

---

## 8. Les décisions d'architecture

Elles sont écrites, datées et justifiées plutôt que reconstituées après coup :

- [`docs/decisions/0001-stack-technique.md`](docs/decisions/0001-stack-technique.md)
  — le choix de la pile, avec les alternatives écartées.
- [`docs/decisions/0002-technos-reservees-chasseur.md`](docs/decisions/0002-technos-reservees-chasseur.md)
  — les technologies réservées à l'agent de sourcing : identifiées, et
  **volontairement pas installées**. Installer une dépendance dont on n'a pas
  encore l'usage, c'est s'engager sans contrepartie.
- [`docs/journal.md`](docs/journal.md) — le journal de bord du projet.

---

## 9. Ce que ce dépôt ne contient pas, et pourquoi

- **Aucune donnée personnelle.** Les extractions de travail (44 Mo et 19 Mo) et
  le fichier de revue interne des fusions — qui contient des noms de personnes et
  d'employeurs réels — sont exclus par `.gitignore`. Le seul jeu de données
  présent est le dump anonymisé.
- **Aucun secret.** Les trois fichiers `.env` sont exclus ; seuls les
  `.env.example` sont versionnés.
- **Aucun nom de client.** Les données de démonstration sont fictives.
