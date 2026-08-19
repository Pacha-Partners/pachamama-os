# ADR 0002 — Technologies réservées au Chasseur de Talents

**Statut** : **réservé, non installé** · **Date** : 19/08/2026 · **Portée** : étape 3

## Pourquoi cette note

Le Chasseur de Talents est l'étape 3. Ses besoins techniques sont déjà
identifiables, et certains **contraignent des choix faits aujourd'hui** — il
serait coûteux de les découvrir plus tard. Mais les installer maintenant
produirait de la dette sur un module qui n'existe pas.

Cette note fige donc ce qui est **prévu**, ce qui est **déjà acquis par la stack
actuelle**, et ce qui reste **à trancher le moment venu**.

## Déjà acquis — rien à ajouter

| Besoin | Couvert par |
|---|---|
| Recherche sémantique candidat ↔ mandat | **pgvector + index HNSW**, dans le PostgreSQL existant. Au-dessous du million de vecteurs, HNSW est recommandé et indistinguable d'un service vectoriel dédié en dessous de 50 req/s. 30 829 talents sont largement dans cette zone |
| Écosystème du module | **Python + FastAPI**, choisi à l'ADR 0001 précisément pour cela |
| Stockage des artefacts (CV analysés) | **Supabase Storage** |
| Isolation de la donnée d'agent | Tables dédiées dans le schéma, RLS en refus par défaut |

## À installer à l'étape 3

| Brique | Rôle | Pourquoi elle sera nécessaire |
|---|---|---|
| **LangGraph** | orchestration du pipeline à 7 étapes | Graphes d'états avec **exécution durable**, **points d'arrêt human-in-the-loop** et parallélisme en éventail. Le human-in-the-loop n'est pas un confort : la décision reste au recruteur, c'est un principe du projet. Utilisé en production par Anthropic, LinkedIn, Uber |
| **Langfuse** | traçage et plafond de coûts | Déjà au plan projet. Sans traçage, le coût d'un agent est invisible jusqu'à la facture |
| **Une file de tâches** | exécution longue et reprise | Un run de sourcing dure des minutes : il ne peut pas vivre dans une requête HTTP. C'est **ici** que Redis + une file deviennent justifiés — pas avant |
| **Modèle d'embeddings** | vectorisation des profils et des mandats | À choisir avec la dimension du vecteur : elle conditionne le schéma de la colonne et le coût de l'index |
| **Deux modèles selon la tâche** | extraction / matching | Décision déjà au plan : un modèle d'extraction, un de raisonnement |
| **Collecte multi-canal** | sourcing LinkedIn et web | Le point le plus sensible : à cadrer **juridiquement** avant techniquement (conditions d'utilisation, base légale du scraping, RGPD) |

## À trancher le moment venu

- **LangGraph seul, ou LangGraph dans un orchestrateur durable ?** Pour des runs
  longs, tolérants aux pannes et coordonnés entre services, le motif reconnu est
  un orchestrateur durable dont chaque activité contient un graphe. À décider
  selon la durée réelle d'un run et l'exigence de reprise.
- **Alternatives à considérer** : CrewAI (agents par rôles, mise en route plus
  rapide), SDK d'agents des fournisseurs de modèles (si l'on s'aligne sur un
  seul). LangGraph reste le choix par défaut pour le contrôle du graphe et les
  points d'arrêt.
- **Dimension du vecteur et quantification** : la quantification en demi-précision
  réduit l'empreinte de l'index, au prix d'un peu de rappel. À mesurer sur les
  données réelles.

## Deux contraintes que l'étape 3 impose déjà à l'étape 2

À garder en tête en construisant les portails, pour ne pas avoir à les reprendre :

1. **Le brief de mandat doit être structuré, pas du texte libre.** Le Chasseur
   consommera ce brief. Un champ de description libre l'obligerait à réextraire
   par LLM ce que le formulaire aurait pu capturer proprement — coût et
   imprécision inutiles. Le cadrage des features prévoit déjà un « brief enrichi
   pour le Chasseur » : c'est de cela qu'il s'agit.
2. **Les décisions des recruteurs doivent être journalisées de façon
   exploitable.** La boucle de feedback du Chasseur s'en nourrira. Un motif de
   rejet en texte libre ne s'apprend pas ; un motif structuré, oui. D'où les
   « motifs de KO structurés » déjà au cadrage.
