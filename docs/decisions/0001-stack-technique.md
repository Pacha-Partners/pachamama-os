# ADR 0001 — Stack technique de la refonte

**Statut** : accepté · **Date** : 19/08/2026 · **Portée** : étape 2 (les 4 vues)

## Contexte

L'étape 1 est achevée : la base talent unifiée existe en PostgreSQL. L'étape 2
consiste à reconstruire l'application — portails recruteurs, entreprises,
talents, et back-office — sur des technologies modernes. Il faut arrêter la
stack avant d'écrire du code, et la choisir **optimale plutôt que chargée**.

## Décision

```
FRONTEND     Next.js 16.3 · React 19 · TypeScript · Tailwind v4 · shadcn/ui
             TanStack Query + Table + Virtual · Zod
             Vitest · Playwright

BACKEND      FastAPI · Python 3.12+ · asyncpg · Pydantic v2
             uv · Ruff · mypy · pytest + httpx

DONNÉES      Supabase PostgreSQL · Auth (JWT + RLS) · Storage · pgvector/HNSW
             Supabase CLI (Postgres local + migrations SQL versionnées)

EXPLOITATION Sentry
DÉPLOIEMENT  Vercel (frontend) · Fly.io ou Render (API)
```

## Justification, brique par brique

**Next.js 16.3.** Version courante ; apporte le cache explicite par directive,
des navigations instantanées, et un rendu passé aux flux Node natifs (+22 % de
requêtes soutenues). La 15 aurait démarré avec un retard immédiat.

**Tailwind v4 + shadcn/ui.** Non négociable ensemble : shadcn/ui est aujourd'hui
aligné sur Tailwind v4 et React 19. Le modèle « on copie le composant dans le
dépôt » évite le verrouillage à une bibliothèque, et l'écosystème de registres
permet de piocher des composants avancés sans dépendance supplémentaire.

**TanStack Table + Virtual + Query.** Le portail recruteur doit parcourir
**30 829 talents** avec filtres. La pagination serveur seule ne règle pas le coût
de rendu du DOM ; la virtualisation le règle. C'est le seul endroit du projet où
ce besoin existe réellement — ailleurs, ce serait de la sur-ingénierie.

**FastAPI.** À noter honnêtement : **les portails seuls ne justifient pas un
backend Python** — les Server Components suffiraient. FastAPI se justifie par
trois besoins qui ne sont pas web : le module Chasseur de Talents (écosystème
Python), la synchronisation avec l'ATS, et le rôle d'API neutre pour des
consommateurs comme n8n. Coût assumé : **deux langages**.

**asyncpg sans ORM.** Le schéma est écrit à la main, avec des index pensés pour
des axes de recherche identifiés. Un ORM ferait perdre ce contrôle sans rien
apporter ici.

**Supabase Auth plutôt que Clerk ou Better Auth.** Le facteur décisif est que la
**RLS fait partie du modèle de données** : `auth.uid()` est disponible dans
chaque policy, donc la base refuse elle-même une requête inter-tenant même si le
code applicatif a un bug. Aucun concurrent n'offre cette garantie au niveau
moteur.

**Supabase CLI.** Postgres local et migrations SQL versionnées. Manque criant
constaté le 19/08 : le DDL a dû être collé à la main dans l'éditeur web, faute
d'accès en écriture au schéma depuis la machine de développement.

**uv · Ruff · mypy.** La chaîne Python a convergé en 2026 sur ce trio.

**Sentry.** Le référentiel exige un processus documenté de gestion des incidents
post-déploiement avec scénarios d'alerte. Sans instrumentation, cette exigence
n'est pas satisfaite.

## Écarté, et pourquoi

| Écarté | Raison |
|---|---|
| Clerk, Better Auth | La RLS est dans le modèle : Supabase Auth est le seul à l'exploiter nativement |
| Base vectorielle dédiée | pgvector suffit sous le million de vecteurs — une base de plus serait une synchronisation de plus |
| Redis + Celery | Aucun besoin de tâche de fond avant le Chasseur. Réservé (voir ADR 0002) |
| Turborepo, Nx | Deux applications, un développeur : le monorepo outillé résoudrait un problème inexistant |
| Redux, Zustand | Server Components + TanStack Query couvrent l'état |
| GraphQL | REST + OpenAPI s'auto-documente et suffit à quatre vues |
| Prisma, Drizzle | Ferait perdre la maîtrise d'un schéma écrit à la main |
| Litestar | Plus rapide en synthétique, mais écosystème et recrutement plus risqués. L'écart ne se voit pas en latence perçue |

## Conséquences

**Deux points de vigilance à traiter dès le premier jour :**

1. **La RLS est décorative si l'API utilise la clé de service** — celle-ci
   contourne la RLS. Le motif retenu : l'API **transmet le JWT de
   l'utilisateur** à Postgres, et le `tenant_id` ainsi que le rôle vivent en
   claims **`app_metadata`** (contrôlés serveur), jamais `user_metadata` que
   l'utilisateur peut modifier.
2. **`asyncpg` et le pooler Supabase ne s'entendent pas** : en mode transaction
   la connexion change et les *prepared statements* disparaissent. Correctif à la
   création du moteur : port **6543**, `NullPool`, `statement_cache_size` à 0.

**Répartition des accès :**
- **Écritures → toujours par l'API.** Un seul endroit où la préséance s'applique,
  où l'audit se journalise, où la synchronisation s'orchestre. C'est le principe
  verrouillé du projet : personne n'écrit en direct.
- **Lectures → Supabase directement, avec le JWT de l'utilisateur.** Le
  cloisonnement est alors garanti par le moteur, sans saut réseau supplémentaire.

**Les scripts d'ETL du pivot restent en Node.** Ils fonctionnent, sont testés, et
relèvent de la migration de données, pas du runtime applicatif. On ne réécrit pas
ce qui marche. Mais la logique backend nouvelle va en Python.
