# J3 — Portail Entreprise

🎯 **Problème**
Le portail entreprise existe comme composant mais affiche des fixtures. C'est le premier endroit où une politique de sécurité fausse ne produit pas un écran vide, mais **l'écran d'un autre client** : CV, prétentions salariales et jugements internes d'un concurrent. C'est aussi le premier cloisonnement entre plusieurs comptes distincts, donc la surface où une erreur ne touche pas une personne mais une relation commerciale — raison pour laquelle les deux contrôles d'isolation sont **bloquants avant l'ouverture du moindre compte client réel**. Deux contradictions sont déjà présentes dans le contrat de données : le type `CandidatAnonyme` de `lib/demo/entreprise.ts` expose `avisCabinet` au client, alors que le cadrage écrit que l'avis interne n'est jamais exposé ; et la fonctionnalité « notes partagées avec le client » n'a aucun support en base, car `public.note` ne comporte aucune colonne de visibilité. Enfin c'est la douleur la plus coûteuse du cabinet : **421 candidatures sont au stade send-out ou au-delà**, chacune payée d'un email de présentation, d'une relance et d'une ressaisie.

💡 **Solution proposée**
Construire `api.process_client`, vue où l'anonymat devient exécutable : aucune colonne d'identité projetée (`nom`, `prenom`, `email_perso`, `telephone`, `linkedin`, `cv_url`, `photo_url`, `metier_actuel`), aucune colonne de négociation (`salaire_minimum`, `salaire_souhaite`, `tjm_*`, `infos_remuneration`), aucun jugement interne (`pachamama_like`, `pachamama_personnalite`, `moins_par_rapport_mission`). Calculer en base une référence pseudonyme stable. Écrire dans le schéma `api` une liste explicite des étapes visibles par un client, sans jamais lire `ref_process_etape`. Retirer `avisCabinet` du contrat. Enregistrer la décision du client dans une table dont l'application est seule maîtresse, puis la notifier à l'Account Manager et la reporter en note rattachée au process côté ATS.

✅ **Acceptance criteria (Definition of Done)**

* [ ]  **Préalable à l'ouverture de tout compte client réel.** Quand on extrait sous jeton client la liste exhaustive des colonnes atteignables, alors elle est comparée automatiquement à une liste interdite nommée — pas relue à l'œil.
* [ ]  **Préalable à l'ouverture de tout compte client réel.** Quand deux comptes clients de test sont interrogés, alors aucun ne voit une seule ligne de l'autre, et le test comparatif prouve que ce zéro vient d'un refus.
* [ ]  Quand on cherche dans le HTML servi au compte client, pour la totalité de ses candidatures et non un échantillon, un nom, un prénom, un email, un téléphone, une URL LinkedIn, une photo ou un employeur, alors aucune occurrence n'est trouvée.
* [ ]  Quand un client consulte ses candidatures, alors les étapes antérieures au send-out renvoient zéro ligne.
* [ ]  Quand deux comptes clients distincts sont testés, alors chacun voit ses N mandats avec N supérieur à zéro, et zéro mandat de l'autre — le test comparatif montrant que la clé de service en renvoie, elle, plusieurs.
* [ ]  Quand un client enregistre une décision, alors elle est retrouvée aux trois endroits : relue dans l'app, reçue par l'Account Manager, et présente en note rattachée au process côté ATS.
* [ ]  Quand la même décision est envoyée deux fois, alors elle ne produit qu'un seul effet.
* [ ]  Quand on tente une restauration depuis la sauvegarde préalable, alors elle fonctionne — l'essai a réellement été fait, pas seulement prévu.

🗺️ **Zones touchées**

* Base : `api.process_client`, `api.mandat_client`, référence pseudonyme, liste des étapes visibles, table des décisions client, politiques de sécurité.
* API : endpoint d'enregistrement de la décision, notification à l'AM (`entreprise.agent_en_charge_id`), report en note côté ATS.
* Frontend : `app/(prive)/entreprise/`, `components/vues/EspaceEntreprise.tsx`, retrait de `avisCabinet` du contrat de données.
* Dépend de : J2 (rattachement des comptes et fonctions de résolution).
* Effet de bord : la chaîne de rattachement est `api.compte.entreprise_id → mandat.entreprise_id` (530 mandats) `→ process.entreprise_id` (7 210 candidatures rattachées sur 7 230). Les 20 non rattachées doivent être traitées explicitement.

**Bonus**

* 📈 **Critère de succès (en prod)**
Les clients suivent leurs recrutements sans passer par l'Account Manager, et sans qu'aucune donnée personnelle ne fuite.
   * Baisse mesurée des échanges email de suivi sur les mandats du client pilote.
   * Zéro identité, zéro prétention, zéro jugement interne exposés — vérifié par test à chaque déploiement.
   * Les décisions client sont enregistrées et parviennent au recruteur là où il travaille.
* 🟢 **Ce qu'on s'autorise / 🚫 Ce qu'on ne fait pas**
On s'autorise (in scope) :
   * Suivi des mandats et des candidatures en lecture, décision sur un candidat présenté, contrat et facturation en lecture seule.
On ne fait pas (out of scope) :
   * Toute écriture commerciale : création de mandat en self-service, signature électronique, génération de facture.
   * L'exposition de notes au client — aucun support en base.
   * L'analytique client et les métriques de funnel.
   * La collaboration multi-utilisateurs côté client.
