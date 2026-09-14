# J1 — Job Board public sur données réelles

🎯 **Problème**
Le job board public est aujourd'hui alimenté par un fichier de fixtures : aucune offre réelle n'est servie, et `/offres` renvoie une redirection 307 vers l'accueil. Brancher cette page sur la base est la première opération qui place la clé publique Supabase dans un navigateur — or cette clé peut actuellement exécuter les fonctions RPC du miroir. Mesuré : un GET sur `truncate_data_tables` renvoie 405 avec le code PostgreSQL 25006, ce qui signifie que le contrôle de droit est passé et que seule la transaction en lecture seule a bloqué l'appel ; un POST l'exécuterait. Cette fonction est en SECURITY DEFINER et fait un TRUNCATE de toutes les tables de `public`. Par ailleurs les 13 mandats publiables et ouverts sont tous marqués `job_anonyme = true`, et les 13 contiennent le nom du client dans leur champ `titre` : publier ce champ exposerait chaque client sur la seule page indexée par les moteurs de recherche.

💡 **Solution proposée**
Retirer `EXECUTE` aux rôles `PUBLIC`, `anon` et `authenticated` sur les fonctions du schéma `public`, et l'accorder au seul `service_role`. Créer un schéma `api` comme unique surface exposée aux rôles accessibles depuis un navigateur, composé de vues qui listent explicitement leurs colonnes. Y créer `api.offre_publique` avec le critère `visibilite='public' AND statut='En cours' AND NOT job_off_market`, et un libellé calculé depuis `metier` et `univers` — jamais depuis `titre`. Construire le harnais de test automatique, qui n'existe pas aujourd'hui (`tests/` est vide).

✅ **Acceptance criteria (Definition of Done)**

* [ ]  Quand on ouvre `/offres`, alors 12 offres réelles s'affichent, et ce nombre égale le `COUNT(*)` du même critère exécuté avec la clé de service.
* [ ]  Quand on cherche dans le HTML servi des 12 offres l'une des 849 raisons sociales de `entreprise.nom`, alors aucune occurrence n'est trouvée.
* [ ]  Quand on interroge `has_function_privilege('anon', …, 'EXECUTE')` sur `truncate_data_tables`, `replace_m2m`, `disable_fk`, `enable_fk` et `rls_auto_enable`, alors le résultat est `false` sur les cinq.
* [ ]  Quand la clé `anon` appelle l'une de ces cinq fonctions, alors la réponse est 403 ou 404 — aucun POST n'est nécessaire pour le vérifier.
* [ ]  Quand la clé `anon` interroge l'un des 107 objets de `public` ou des 18 de `pivot`, alors elle obtient un tableau vide, à la seule exception de `api.offre_publique`.
* [ ]  Quand on retire volontairement une politique de sécurité, alors le harnais échoue ; et quand la base est injoignable, alors il échoue également — un résultat vert obtenu sur une panne est un échec.
* [ ]  Quand le sync n8n s'exécute après la révocation, alors il fonctionne sans erreur (il n'appelle `finish_sync_type` qu'avec la clé de service).

🗺️ **Zones touchées**

* Base : nouveau schéma `api`, révocation des droits sur les fonctions de `public`, `ALTER DEFAULT PRIVILEGES` pour les fonctions futures.
* Frontend : `app/(public)/offres/`, `lib/api.ts`, sortie des types de domaine de `lib/demo/` vers `lib/domaine/`, `EST_VERSION_EN_LIGNE` rendu granulaire par route.
* Nouveau : `tests/` et un script de vérification dans `package.json`.
* Dépend de : rien. C'est le premier jalon.
* Effet de bord : le sync n8n perd l'accès aux fonctions RPC via les clés publiques — vérifié sans impact, il utilise `service_role`.

**Bonus**

* 📈 **Critère de succès (en prod)**
Le job board sert des offres réelles et à jour, sans jamais exposer un client.
   * 12 offres affichées, égales au compte en base, sur une page indexable.
   * Zéro raison sociale dans le HTML servi.
   * Le harnais tourne à chaque déploiement et bloque une régression d'accès.
* 🟢 **Ce qu'on s'autorise / 🚫 Ce qu'on ne fait pas**
On s'autorise (in scope) :
   * Révocation des droits, schéma `api`, vue `api.offre_publique`, branchement de `/offres` et `/offres/[id]`, harnais de test.
On ne fait pas (out of scope) :
   * La suppression des fonctions RPC (décision séparée).
   * La rotation de la clé de service (décision séparée).
   * Toute page privée, toute authentification, toute écriture.
