# J4 — Espace Talent

🎯 **Problème**
L'espace talent existe comme composant mais affiche des fixtures : `app/(prive)/talent/page.tsx` importe `lib/demo/talent.ts`. Aucun talent ne peut consulter ni corriger ses données. Or ce sont précisément ces données qui manquent au socle : seuls **5 852 talents sur 30 966 portent des attentes**, et personne ne les remplira à la main. C'est aussi le parcours privé le plus court et le seul dont la chaîne de jointure est entièrement peuplée : il réutilise le mécanisme d'isolation déjà éprouvé au J3 et l'applique à un périmètre plus simple — un seul compte, une seule ligne — où il ouvre en plus le premier chemin d'écriture.

💡 **Solution proposée**
Construire `api.talent_moi`, vue à colonnes listées suivant la chaîne `auth.uid() → api.compte.candidat_id → pivot.talent_source(source='app').external_id → pivot.talent`, complétée par `pivot.attentes`, `pivot.qualification` et `pivot.parcours`. Afficher les candidatures depuis `public.process`, avec un référentiel d'étapes `api.etape` reconstruit sous contrôle applicatif. Ouvrir un premier chemin d'écriture par l'API, limité aux attentes et au dépôt de CV, avec clé d'idempotence et sauvegarde préalable.

✅ **Acceptance criteria (Definition of Done)**

* [ ]  Quand un talent se connecte, alors son profil, ses attentes et ses candidatures s'affichent, et chaque champ correspond à la valeur lue avec la clé de service — vérifié sur 3 talents choisis à l'avance.
* [ ]  Quand le talent A tente une lecture visant le talent B, alors il obtient zéro ligne, et le test comparatif prouve que ce zéro vient d'un refus et non d'une table vide.
* [ ]  Quand n'importe quel jeton talent interroge `pivot.note_journal`, alors il obtient zéro ligne.
* [ ]  Quand un talent modifie ses attentes, alors la modification est relue après rechargement de la page, avec une ligne de journal portant l'auteur et l'horodatage.
* [ ]  Quand la même modification est envoyée deux fois, alors elle ne produit qu'un seul effet.
* [ ]  Quand une 16e valeur d'étape apparaît dans `process.etape`, alors le test échoue — au lieu d'afficher un libellé interne au talent.
* [ ]  Quand on cherche un import de `lib/demo` dans `app/(prive)/talent`, alors on n'en trouve aucun.

🗺️ **Zones touchées**

* Base : `api.talent_moi`, `api.etape`, politiques de sécurité sur les vues, table de journal des écritures.
* API : endpoints d'écriture des attentes et de dépôt de CV.
* Frontend : `app/(prive)/talent/`, `components/vues/EspaceTalent.tsx` (branchement, la vue ne change pas), connexion par lien magique.
* Dépend de : J2 (rattachement et fonctions de résolution), J3 (vues du schéma `api` et contrôles d'isolation en place).
* Effet de bord : 395 doublons de source existent — `pivot.talent_source` compte 7 016 lignes de source `app` pour 6 621 `talent_id` distincts. À traiter explicitement, pas à découvrir en production.

**Bonus**

* 📈 **Critère de succès (en prod)**
Les talents complètent eux-mêmes les données que le matching exige.
   * Progression mesurée du nombre de talents portant des attentes, au-delà des 5 852 actuels.
   * Progression du nombre de CV : 3 103 candidats sur 7 016 n'en ont aucun.
   * Zéro exposition de jugement interne, vérifiée par test.
* 🟢 **Ce qu'on s'autorise / 🚫 Ce qu'on ne fait pas**
On s'autorise (in scope) :
   * Lecture du profil, des attentes, de la qualification, du parcours et des candidatures ; écriture des attentes et du CV.
On ne fait pas (out of scope) :
   * Le mode « ouvert aux opportunités » : `public.candidat.opento` est renseigné sur zéro ligne, et `pivot.talent.open_to` vient de Jarvi, pas de l'app. Un réglage qui écrit dans une colonne jamais alimentée par l'app n'a pas de conséquence vérifiable.
   * Les recommandations et le matching sémantique.
   * L'exposition des notes, sous quelque forme que ce soit.
