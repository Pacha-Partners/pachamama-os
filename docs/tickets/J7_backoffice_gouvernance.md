# J7 — Back-office de gouvernance

🎯 **Problème**
Tous les instruments de surveillance du projet existent aujourd'hui sous forme de scripts lancés à la main : réconciliation du miroir, contrôle de péremption, audit de préséance, vérification d'anonymat, journal de quarantaine. Personne ne les lance sauf en cas d'incident — donc les six pertes de données de ce projet ont toutes été découvertes tardivement, par hasard. Par ailleurs deux tables de référentiel sont détruites en production (`ref_process_etape` et `ref_tag_job`, remplies de caractères isolés) et rien ne l'avait signalé ; `pivot.sync_etat` montre la source `ats` encore en statut « jamais lancé » ; et le cabinet n'a aucun écran pour arbitrer les cas que la donnée ne tranche pas — 104 comptes sans rattachement, 6 200 fantômes du miroir, 1 227 conflits de préséance.

💡 **Solution proposée**
Remonter à l'écran les instruments déjà écrits, plutôt que d'en inventer de nouveaux : les 7 vues qualité du pivot (`qa_completude`, `qa_sans_identite`, `qa_sans_contact`, `qa_emails_generiques`, `qa_preseance_suspecte`, `qa_multi_source`), le registre des écarts `_sync_ecart`, le journal de quarantaine `_sync_quarantine`, l'état des synchronisations `pivot.sync_etat` et `pivot.sync_run`, et la table `pivot.conflit`. Ajouter un éditeur des référentiels reconstruits au J5 (`api.etape`, `api.tag_job`), et une page de traçabilité RGPD répondant à une demande d'accès ou d'effacement sur une personne. Les instruments deviennent des écrans consultés, avec des seuils qui alertent.

✅ **Acceptance criteria (Definition of Done)**

* [ ]  Quand un administrateur ouvre le back-office, alors il voit l'état des deux sources de synchronisation, la date du dernier passage et le volume traité, sans lancer aucun script.
* [ ]  Quand un écart de réconciliation est confirmé sur deux passages consécutifs, alors il apparaît à l'écran avec sa nature et son ancienneté.
* [ ]  Quand une fiche est mise en quarantaine par le connecteur, alors elle est visible avec son motif — et non seulement présente dans une table.
* [ ]  Quand un seuil est franchi (écarts non expliqués par l'archivage, source de synchronisation à l'arrêt, référentiel vide), alors une alerte est levée et non simplement affichée.
* [ ]  Quand un administrateur modifie un référentiel (`api.etape`, `api.tag_job`), alors le changement est journalisé avec son auteur, et les écrans qui en dépendent le reflètent.
* [ ]  Quand une demande d'accès ou d'effacement est reçue pour une personne, alors une page rassemble tout ce que la plateforme détient sur elle, dans les deux schémas.
* [ ]  Quand un utilisateur du rôle Support Crew ouvre le back-office, alors les opérations sensibles lui sont refusées.
* [ ]  Quand le harnais des jalons précédents est rejoué, alors il reste vert.

🗺️ **Zones touchées**

* Frontend : `app/(prive)/backoffice/` — écrans de qualité de donnée, de synchronisation, des référentiels, de traçabilité.
* Base : vues de lecture pour les tables de surveillance existantes, journal des modifications de référentiel.
* Dépend de : J2 (administration des comptes, déjà livrée), J5 (référentiels reconstruits à administrer), J6 (tableau de divergence à afficher).
* Effet de bord : ce jalon ne crée presque aucune donnée nouvelle. Il rend visible ce qui existe déjà et n'est jamais regardé. Sa valeur est proportionnelle à la fréquence à laquelle il est consulté, pas à la richesse de ses écrans.

**Bonus**

* 📈 **Critère de succès (en prod)**
Un incident de données est découvert par un écran, pas par un client.
   * Le délai entre l'apparition d'un écart et son constat se compte en heures, pas en semaines.
   * Les écarts confirmés diminuent d'un mois sur l'autre au lieu de s'accumuler.
   * Zéro script lancé à la main pour connaître l'état du système.
* 🟢 **Ce qu'on s'autorise / 🚫 Ce qu'on ne fait pas**
On s'autorise (in scope) :
   * Affichage des instruments existants, alertes sur seuils, édition des référentiels, page de traçabilité RGPD, refus des opérations sensibles selon le rôle.
On ne fait pas (out of scope) :
   * La matrice de rôles éditable et la gestion fine des permissions par écran.
   * Les indicateurs de fonctionnement (feature flags) et l'import/export supervisé.
   * L'administration commerciale : facturation, avoirs, calcul des commissions.
   * L'observabilité de l'agent Chasseur de Talents — elle appartient à la Phase 3, avec l'agent.
   * La correction de fond du sync et la purge des fantômes : chantier de la Phase 1, ce jalon se contente de les rendre visibles.
