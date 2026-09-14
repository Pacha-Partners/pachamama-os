# J6 — Poste Recruteur : actions, et préparation du Chasseur

🎯 **Problème**
Sans écriture, le poste recruteur reste un tableau de bord consulté **en plus** de l'ATS : un écran de plus, pas un écran de moins. Trois gestes suffisent à faire basculer l'usage quotidien. Par ailleurs la Phase 3 impose deux contraintes à la Phase 2, et les ajouter après coup obligerait à reprendre l'interface : les **6 274 motifs de KO** sont aujourd'hui repliés dans une colonne de texte libre, alors que la boucle d'apprentissage du Chasseur ne peut rien tirer d'un texte libre ; et le brief de mandat doit être structuré, alors que les colonnes existent déjà (`delivery`, `discovery`, `strategie`, `ops`, `management`, `cible`, `min_xp`, fourchettes de salaire et de TJM).

💡 **Solution proposée**
Ouvrir exactement trois écritures, toutes par l'API sous la connexion de l'utilisateur donc soumises à la sécurité au niveau ligne : ajout d'une note, transition d'étape avec motif de KO structuré, création et clôture d'une tâche. Chacune avec une clé d'idempotence et une file de reprise persistée. Construire un tableau de divergence qui compte les deux côtés sur les entités touchées et échoue bruyamment. Ajouter la surface de constitution de short-list depuis la fiche mandat, alimentée par des filtres durs uniquement — sans aucune IA : c'est le contrat d'interface que la Phase 3 viendra remplir derrière.

✅ **Acceptance criteria (Definition of Done)**

* [ ]  Quand on effectue 20 écritures réelles, alors la valeur est identique dans l'app, dans le pivot et dans l'ATS après un cycle de synchronisation.
* [ ]  Quand la même écriture est rejouée, alors elle ne produit qu'un seul enregistrement.
* [ ]  Quand on provoque une panne réseau pendant une écriture, alors la ligne part en file de reprise, et la reprise la passe sans créer de doublon.
* [ ]  Quand on introduit volontairement un écart entre l'app et l'ATS, alors le tableau de divergence le signale ; et quand on le corrige, alors il repasse au vert.
* [ ]  Quand un brief de mandat ou un motif de KO est saisi dans l'interface, alors il se relit en base comme des colonnes exploitables, pas comme une chaîne à analyser.
* [ ]  Quand une short-list est constituée sur 3 mandats réels, alors chaque profil satisfait effectivement les filtres durs, vérifié en SQL, avec zéro faux positif.
* [ ]  Quand un profil de short-list est accepté, alors exactement un candidat et une candidature sont créés, constatés en base.
* [ ]  Quand un utilisateur du rôle Support Crew tente une opération sensible (commission, clôture, suppression), alors elle est refusée.
* [ ]  Quand on cherche un import de `lib/demo` dans une route privée, alors on n'en trouve aucun.

🗺️ **Zones touchées**

* Base : tables de file de reprise et de journal d'écriture, tableau de divergence, `api.compte` administrable.
* API : trois endpoints d'écriture sous la connexion de l'utilisateur, report vers l'ATS.
* Frontend : `app/(prive)/recruteur/` (actions). L'administration des comptes a déménagé en J2 ; la gouvernance complète est en J7.
* Dépend de : J5 (la lecture doit être prouvée juste avant d'écrire).
* Effet de bord : le report vers l'ATS doit passer par `app.pachamama-collective.com` et jamais par l'alias, qui redirige en 301 et transforme un POST en GET. Piège déjà documenté dans le projet.

**Bonus**

* 📈 **Critère de succès (en prod)**
Les recruteurs travaillent dans l'app, et l'ATS reflète leur travail sans divergence.
   * Le tableau de divergence reste à zéro sur une fenêtre d'observation donnée.
   * Zéro enregistrement perdu ; toute écriture échouée est reprise et traçable.
   * Les motifs de KO et les briefs sont exploitables comme données structurées.
* 🟢 **Ce qu'on s'autorise / 🚫 Ce qu'on ne fait pas**
On s'autorise (in scope) :
   * Trois écritures et pas une de plus, file de reprise, tableau de divergence, short-list sur filtres durs, administration des comptes en back-office.
On ne fait pas (out of scope) :
   * Le Chasseur de Talents lui-même : pipeline de sourcing, enrichissement, validation critique, tables `agent_*`. C'est la Phase 3 — ce jalon lui livre seulement sa surface d'interface.
   * Tout matching sémantique, scoring ou recommandation.
   * La date de bascule où Bubble cesse d'être la source maîtresse : décision d'exploitation, pas de code.
