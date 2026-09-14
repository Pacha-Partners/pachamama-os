<!--
Ce gabarit redit les règles AU MOMENT OÙ ON PEUT ENCORE LES APPLIQUER.
Une règle écrite dans CONTRIBUTING.md et nulle part ailleurs est une règle
qu'on relit une fois. Celle-ci s'ouvre à chaque proposition de modification.
Supprimez les sections sans objet plutôt que de cocher au hasard.
-->

## Ce que ça change

<!-- Une phrase. Le « pourquoi » va dans les commits, pas ici. -->

## Base de destination

- [ ] `dev` — une modification ordinaire
- [ ] `main` — **correctif d'urgence** parti d'un tag (et non de `dev`)

---

## Si cette proposition touche `supabase/migrations/`

- [ ] **Un fichier par changement**, horodaté, et **aucun fichier déjà poussé n'a été modifié**
- [ ] La migration est **rétrocompatible avec le code encore en ligne** — on ajoute, on ne retire pas (*expand*, pas *contract*)
- [ ] Sur une vue : les colonnes existantes sont **recopiées à l'identique** et les nouvelles **ajoutées en fin** (`create or replace view` rend `42P16` sinon)
- [ ] Le rejeu sur base vierge passe en CI

> ⚠ Le code revient en arrière en un clic, **le schéma non**. Une colonne créée reste créée.

## Si c'est un correctif d'urgence

- [ ] Il part du **tag** de la version en ligne, pas de `dev` ni de `main`
- [ ] Il ne refactore rien et **ne porte pas de migration**
- [ ] **Le report dans `dev` est prévu** — et dans `recette` si elle est gelée

> Sans le report, le défaut revient à la livraison suivante, et il ressemble alors à un correctif qui se serait défait tout seul.

## Dans tous les cas

- [ ] Aucune **adresse nominative**, aucun mot de passe même de test, aucune clé — le dépôt est **public**, et 30 829 personnes physiques sont derrière la base
- [ ] Les commits portent leur **portée** : `feat(talent):`, `fix(ds):`, `fix(entreprise):`…
- [ ] Ce qui est **mesuré** est écrit dans le code, pas seulement ici

<!-- CONTRIBUTING.md porte le modèle complet, les quatre règles et la procédure de correctif d'urgence. -->
