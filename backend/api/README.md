# api — l'API d'accès neutre (tâche 5)

Dossier volontairement vide.

## Ce que cette API devra être

Le principe verrouillé du projet : le pivot est le **maître unique**, l'ATS et
l'application en sont les **producteurs**, et **personne n'écrit en direct**.
Toute lecture et toute écriture passent par une API qui découple les producteurs
des consommateurs.

Sans elle, chaque nouveau consommateur se coupleraient au schéma, et toute
évolution de la base casserait des appelants inconnus.

## Ce qu'elle devra porter

- **Lecture** : un contrat par ressource, plus la vue de sourcing.
- **Écriture** : upsert par clé source, avec **application de la préséance côté
  serveur** — jamais côté appelant, sinon deux producteurs arbitreraient
  différemment le même conflit.
- **Sync bidirectionnelle** : le sens pivot → producteurs suppose un accès en
  écriture à l'ATS dont on ne dispose pas encore.
- **Sécurité** : la clé de service ne quitte jamais le serveur ; RLS en refus par
  défaut conservée.

## Pourquoi rien n'est encore écrit

Le framework n'est pas choisi. Poser du code avant ce choix produirait une dette
immédiate — et le choix mérite d'être instruit, pas subi.
