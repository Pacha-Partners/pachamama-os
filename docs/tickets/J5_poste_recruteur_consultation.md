# J5 — Poste Recruteur : consultation

🎯 **Problème**
`app/(prive)/recruteur/page.tsx` fait 10 lignes : un titre et une phrase. Le travail se perd sans que personne ne le voie — **811 tâches ouvertes dont 682 en retard**, et l'ancienneté d'une candidature n'est affichée nulle part. Par ailleurs deux tables de référentiel sont détruites en production : `ref_process_etape` contient 70 lignes dont la colonne `value` vaut `{`, `"`, `d`, `i`, `s`, `p`, `l`, `a`, `y` — une chaîne JSON découpée caractère par caractère lors du chargement — et `is_public` est vraie sur zéro ligne. C'est pourtant cette table qui doit déterminer quelles étapes un client peut voir. `ref_tag_job` est cassée de la même façon (74 lignes de caractères isolés) alors que `mandat_tag_job` compte 818 lignes.

💡 **Solution proposée**
Reconstruire `api.etape` et `api.tag_job` sous contrôle applicatif, à partir des 15 valeurs réellement présentes dans `process.etape`. Construire quatre écrans en lecture seule : une file de travail priorisée, un kanban par mandat sur les 35 mandats en cours, une fiche talent complète affichant la provenance de chaque valeur (`prenom_src`, `nom_src`, `localisation_src`, `employeur_src`, `type_fusion`), et une recherche paginée sur les 30 966 profils. Aucune écriture dans ce jalon : l'ATS reste la seule source d'écriture.

✅ **Acceptance criteria (Definition of Done)**

* [ ]  Quand on compare, sur 3 mandats tirés au hasard, l'effectif de chaque colonne du kanban au `COUNT(*)` du même critère en SQL, alors les nombres sont égaux.
* [ ]  Quand on compare la file de travail à une requête écrite indépendamment, alors les deux listes se recoupent ligne à ligne.
* [ ]  Quand on additionne les pages d'une liste, alors la somme égale le total annoncé (7 230 candidatures, 30 966 profils, 4 592 rôles) — une liste qui s'arrête à 1 000 fait échouer le test.
* [ ]  Quand on charge la première page de la recherche sur 30 966 profils, alors le temps de réponse est mesuré et consigné, non estimé.
* [ ]  Quand un jeton talent ou un jeton entreprise interroge une route recruteur, alors il obtient zéro ligne ou un code 403.
* [ ]  Quand la fiche talent est ouverte, alors la provenance de chaque valeur est affichée, et les conflits de préséance sont consultables.
* [ ]  Quand le harnais des jalons 1 à 4 est rejoué, alors il reste vert.

🗺️ **Zones touchées**

* Base : `api.etape`, `api.tag_job`, `api.talent_recherche`, `api.process_interne`, vues de la file de travail.
* Frontend : `app/(prive)/recruteur/` (quatre écrans à construire), pagination et comptage exécutés en base.
* Dépend de : J2 (rattachement et rôles), J1 (harnais).
* Effet de bord : le plafond de PostgREST est silencieux — mesuré, `limit=5000` sur `process` renvoie un code 200 avec 1 000 lignes et un en-tête `Content-Range: 0-999/7230`. Un garde-fou de pagination est obligatoire sur chaque liste, sans quoi les effectifs affichés seront faux sans le signaler.

**Bonus**

* 📈 **Critère de succès (en prod)**
Un recruteur ouvre l'app le matin et sait quoi faire, sans ouvrir l'ATS pour le savoir.
   * Baisse mesurée du nombre de tâches en retard, à partir des 682 actuelles.
   * Les effectifs affichés égalent les effectifs en base, vérifié à chaque déploiement.
   * Zéro écriture, donc zéro divergence possible pendant ce jalon.
* 🟢 **Ce qu'on s'autorise / 🚫 Ce qu'on ne fait pas**
On s'autorise (in scope) :
   * File de travail, kanban par mandat, fiche talent complète avec provenance, recherche paginée, reconstruction des deux référentiels.
On ne fait pas (out of scope) :
   * Toute écriture, sans exception.
   * Le matching, le scoring, les recommandations.
   * La parité fonctionnelle avec l'ATS : édition des fiches entreprise et mandat, tags, apporteurs d'affaires, templates d'emails.
   * Attention à ne pas survendre le périmètre : 30 966 profils sont cherchables par nom, employeur ou localisation, mais seuls 5 852 portent des attentes et 3 471 un salaire souhaité — tous côté app, aucun côté Jarvi. Un filtre dur sur univers et salaire renvoie donc moins de résultats que les 7 016 profils de l'ATS.
