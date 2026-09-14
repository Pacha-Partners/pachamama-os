# J2 — Authentification, rôles et rattachement des comptes

🎯 **Problème**
Aucune page privée ne peut lire quoi que ce soit avant ce maillon : la chaîne part de `auth.uid()` et s'arrête immédiatement. La colonne prévue au schéma pour joindre les comptes d'authentification aux données métier, `public.user.auth_id`, est **vide sur 4 596 lignes sur 4 596**. De plus, cette table appartient au miroir, que le sync réécrit en continu (16 exécutions, curseur avancé le 24/08 à 09:54) : y placer une règle de sécurité l'expose à disparaître sans aucun signal. Enfin, aucun des 7 comptes d'authentification existants ne porte de rôle dans `app_metadata` : la fonction `rolesDe()` renvoie une liste vide pour tous, et l'orientation par rôle après connexion ne fonctionne pas. Les 3 comptes de démonstration annoncés n'existent pas.

💡 **Solution proposée**
Créer `api.compte` (clé primaire `auth_id`, plus `role`, `entreprise_id`, `candidat_id`, `talent_id`, `actif`), table appartenant à l'application, initialisée depuis `public.user` mais jamais cible du sync. Alimenter le rattachement par email : `candidat.email_perso` (6 690 renseignés) pour un talent, `equipe.email` (670) pour un contact client — en passant par `equipe → mandat → entreprise_id`, car `equipe` se rattache à un mandat et non à une entreprise. Écrire trois fonctions `api.auth_role()`, `api.auth_entreprise_id()` et `api.auth_talent_id()` en STABLE, SECURITY DEFINER, `search_path` épinglé, renvoyant NULL par défaut. Accorder `USAGE` et `SELECT` à `authenticated` sur le seul schéma `api`. Réactiver le middleware de rafraîchissement de session, avec import dynamique à l'intérieur du bloc gardé.

✅ **Acceptance criteria (Definition of Done)**

* [ ]  Quand un compte de chacun des 3 rôles se connecte, alors il arrive sur sa vue, et son jeton porte le rôle attendu lu dans `app_metadata` — et non dans `user_metadata`.
* [ ]  Quand on appelle `api.auth_entreprise_id()` ou `api.auth_talent_id()` avec ce jeton, alors la valeur renvoyée est identique à celle lue avec la clé de service.
* [ ]  Quand un compte authentifié n'a aucune ligne dans `api.compte`, alors toutes les fonctions renvoient NULL et toutes les requêtes renvoient zéro ligne.
* [ ]  Quand le rapport de rattachement est produit, alors le nombre de résolus additionné au nombre de non-résolus égale 4 596, et les non-résolus sont listés nominativement.
* [ ]  Quand le sync n8n s'exécute, alors `api.compte` n'est pas modifiée.
* [ ]  Quand un administrateur rattache, promeut ou désactive un compte depuis `/(prive)/backoffice`, alors l'effet est immédiat et vérifié sur ce que ce compte peut lire.
* [ ]  Quand un compte est désactivé, alors il obtient zéro ligne sur toutes les routes privées.
* [ ]  Quand le harnais du jalon 1 est rejoué, alors il reste vert.

🗺️ **Zones touchées**

* Base : `api.compte`, trois fonctions de résolution, `GRANT` sur le schéma `api` à `authenticated`.
* Frontend : `app/connexion/`, orientation post-connexion par rôle, `middleware.ts` réactivé depuis `lib/session-refresh/middleware.reference.ts`.
* Administration : création des 3 comptes de démonstration avec leur rôle dans `app_metadata`.
* Frontend `/(prive)/backoffice/` : premier écran réel — rattacher, promouvoir, désactiver un compte. Cette brique vient ici et non plus tard, parce que sans elle chaque rattachement passe par un script lancé à la main, dès le jalon 3.
* Dépend de : J1 (le schéma `api` et le harnais existent).
* Effet de bord : deux vocabulaires de rôles coexistent — `public.user_role` porte Candidat 4 207, Entreprise 344, Admin 10, Recruiter Core Team 13, Recruiter Support Crew 18 ; les documents attendent `talent` / `entreprise` / `recruteur`. Une table de correspondance explicite est nécessaire.
