# Plan de construction des portails — Entreprise, Talent, tranche Recruteur

> ## ⚠ PÉRIMÉ — 22/09/2026
>
> Les `LOT 0` à `LOT 3` ne sont plus la maille du projet. **La maille unique est
> `J1`–`J7`**, tenue par `JALONS.md`. Ce fichier est conservé pour l'historique
> et pour ses mesures du 09/09, mais son état est faux depuis : il annonce que
> « les quatre pages privées sont vides » et qu'« il n'existe aucun chemin
> d'écriture », alors que les portails talent et entreprise portent aujourd'hui
> 14 écrans et 23 actions d'écriture.


> Établi le 09/09/2026 à partir de `docs/Cadrage des features - P0 3844f3790e1c801a94e0cd9ce844884f.md`,
> et **ancré sur l'état mesuré du dépôt et du projet dev** (`xavnvkpgbpczblmwlaxk`), pas sur les tickets J3/J4
> qui emploient encore le vocabulaire d'avant la refonte `core`/`app` et sont périmés.
>
> Ce document ne remplace ni `docs/DECOUPAGE_PHASE2.md` (les 7 jalons) ni les ADR. Il les instancie :
> **LOT 1 = J3**, **LOT 2 = J4**, **LOT 3 = une tranche de J5/J6**.

---

## 0. Ce que dit la mesure, avant toute chose

Sept faits établis par lecture du code et interrogation du dev. Ils commandent le plan.

| # | Fait mesuré | Conséquence |
|---|---|---|
| 1 | **Les quatre pages privées sont vides.** `(prive)/{talent,entreprise,recruteur,backoffice}/page.tsx` appellent `exigerVue()` puis `return null`. | Tout l'applicatif est à écrire. Le J2 a livré la porte, pas les pièces. |
| 2 | **Aucune vue `api` n'est écrivable, et `appelApi` n'est appelée nulle part.** Les seules écritures du dépôt sont `signInWithPassword` et `signOut`. | **Il n'existe aujourd'hui aucun chemin d'écriture.** C'est le verrou n°1. |
| 3 | **`ref.etape_process` a ses 7 attributs de présentation à NULL** (`libelle_client`, `libelle_talent`, `visible_client`, `visible_interne`, `est_publique`, les 2 couleurs) — la table source Bubble est détruite (70 lignes d'un caractère). | Les vues replient sur `libelle_interne` : le client et le talent lisent aujourd'hui **« 🙅🏻‍♀️ KO by Pachamama »**. Et **aucune vue ne filtre sur `visible_client`** : tout est visible. Verrou n°2. |
| 4 | **`core.candidature.reference_pseudonyme` est NULL sur 7 236 lignes.** | `api.candidature_client` sert une colonne vide : le client ne peut désigner aucun candidat. Verrou n°3. |
| 5 | **Les 4 policies du portail entreprise sont en `select` seul**, et **aucun accès `portail='entreprise'` réel n'existe** (4 lignes posées à la main en dev ; 341 utilisateurs d'entreprise en quarantaine, le lien `user → contact_client` étant irreconstituable). | Le portail entreprise est lisible et muet, pour trois comptes de test. Verrou n°4. |
| 6 | **Le middleware de rafraîchissement de session a été retiré** du chemin d'exécution le 20/08 (`MIDDLEWARE_INVOCATION_FAILED`). | Le jeton n'est jamais renouvelé en navigation : une session expire sous l'utilisateur. Verrou n°5. |
| 7 | **Le design system ne couvre pas l'applicatif.** Absents : tableau de données, pagination, onglets, modale desktop, toast, squelette de chargement, état d'erreur de page, `<textarea>`, téléversement de fichier, menu d'actions, fil de commentaires, frise chronologique, accordéon, barre de filtres, graphiques. `Feuille` est un *bottom sheet* mobile ; `Menu` est la navigation latérale, pas un menu d'actions. | Chaque écran de portail bute sur les mêmes 8 primitives manquantes. Verrou n°6. |

**Correction à un document existant** : `docs/ENVIRONNEMENT_DEV.md` et `docs/REPRISE.md` présentent « exposer `api` au réseau » comme le point 1 du reste-à-faire. C'est fait sur le dev : les 12 vues répondent, mesuré le 09/09 (`Accept-Profile: api`, 12 vues + 12 RPC dans l'OpenAPI).

### La matière disponible

| Entité | Lignes | Remarque |
|---|---|---|
| `core.entreprise` | 851 | 303 doublons dormants non traités |
| `core.mandat` | 533 | **57 actifs** (38 `en_cours` + 19 `nouveau`), 271 `termine`, 204 `close_pachamama` |
| Offres publiées | **12** | `app.mandat_publication`, canal `job_board_public` |
| `core.candidature` | 7 236 | **684 vivantes**, 235 `Hired`, **6 285 KO** dont 4 302 « by Pachamama » |
| `core.fiche_talent` | 7 023 | `core.talent` (projection pivot) = **0 ligne** |
| `core.contact_client` | 524 | 706 participations `mandat_contact_client` |
| `core.note` | 45 685 | **aucune colonne de visibilité** |
| `core.placement` | 227 | 260 répartitions de commission |
| `app.compte` / `app.acces` | 4 159 / 4 196 | 4 accès entreprise seulement |

---

## 1. Le périmètre demandé

192 features au cadrage, dont **109 sur les trois vues retenues**.

| Vue | Features | must | should | could | Retenu ici |
|---|---|---|---|---|---|
| ENTREPRISES | 36 | 14 | 12 | 10 | **les 36** |
| TALENTS | 27 | 12 | 7 | 8 | **les 27** |
| RECRUTEURS | 46 | 23 | 20 | 3 | **12 (26 %)** |

### 1.1 Le critère de sélection des 12 features recruteur

> **Sont retenues les features du poste recruteur sans lesquelles le portail Entreprise ou l'espace Talent
> affiche une donnée morte, ou ne boucle pas.**

Le poste recruteur est le producteur ; les deux portails self-service sont des surfaces de lecture et de
réaction sur ce qu'il produit. Prendre 25 % au hasard donnerait douze écrans orphelins ; prendre les douze
qui alimentent l'autre côté du miroir donne un système qui tourne.

| # | Feature | Section | Ce qu'elle débloque en face |
|---|---|---|---|
| 1 | Kanban process vue recruteur | Pipeline | L'étape que le kanban client et le suivi talent lisent tous les deux |
| 2 | Fiche process / détail candidature | Pipeline | `argumentaire_client` — la seule chose que le client lit d'un candidat |
| 3 | Transitions d'étape & motifs de KO structurés | Pipeline | La machine à états. Sans elle rien n'avance, et les 6 285 KO restent muets |
| 4 | Liste & fiche mandat éditables | Mandats | Le job board, le tableau de bord client, et la validation des mandats créés en self-service |
| 5 | Affectation d'équipe sur le mandat | Mandats | L'Account Manager affiché au client (must côté entreprise) |
| 6 | Liste & fiche candidat 360 éditable | CRM talent | La fiche candidat présentée au client |
| 7 | Recherche & filtres avancés talents | CRM talent | Sans elle, personne n'entre dans un pipeline |
| 8 | Liste & fiche entreprise éditable | CRM client | Le compte client lui-même, et ses conditions commerciales |
| 9 | Gestion des contacts equipe | CRM client | **Qui reçoit un accès entreprise.** Déverrouille les 341 comptes en quarantaine |
| 10 | Prises de notes polymorphes | Collaboration | Le fil partagé que les deux portails lisent |
| 11 | Journal d'événements structuré | Collaboration | La frise d'activité et l'audit, des deux côtés |
| 12 | Notifications de tâches (email/in-app) | Tâches | Le centre de notifications, `must` **des deux** portails |

**Écartées sciemment, et pourquoi** : *Clôture de mandat & split* (le portail client lit la facturation
historique, il n'a pas besoin qu'on en produise de nouvelle) · *Qualification candidat* (interne, invisible
côté portails) · *Génération auto des tâches de closing* · *Dashboards et reporting financier* · *Matching
pgvector* · *Chasseur de Talents* · *Tags, apporteurs, annuaire recruteur* · *Dupliquer / snoozer un mandat*
· *« Mon jour »* · *Analyses de mandat* · *Actions de masse* · *Détection de candidatures bloquées*.
Aucune ne bloque un portail. Elles constituent le reste de J5/J6.

---

## 2. Les 36 features — portail ENTREPRISE

État mesuré : 🟢 servi de bout en bout · 🟡 donnée prête, vue ou écran manquant · 🟠 champ existant mais vide
ou non filtré · 🔴 table/colonne à créer.

### 2.1 Accès, identité, gouvernance (5)

| Feature | Type | Prio | État | Ce qui manque exactement |
|---|---|---|---|---|
| Login & onboarding client (SSO Supabase) | ✅ | must | 🟠 | Le socle marche (J2). Mais **aucun accès entreprise réel** : `contact_client_id` forcé à NULL à la reprise, 341 en quarantaine. Et le chemin d'insertion du déclencheur GoTrue **échoue en 500 muet, cause non élucidée** |
| Cloisonnement strict (RLS par entreprise) | ✨ | must | 🟡 | Les 4 policies `client_*` existent sur `api.mes_entreprises()`. **Mais `api.kanban` et `api.talent_recherche` sont ouvertes à tout `authenticated`** — à segmenter (§5.1) |
| Collaboration multi-utilisateurs & rôles côté client | ✨ | should | 🔴 | Aucun mécanisme d'invitation. `core.mandat_contact_client.est_contact_principal` existe mais **son unicité par mandat n'est pas posée** |
| Désactivation / archivage de comptes client | ✨ | should | 🟡 | `app.compte.actif`, `app.acces.actif`, `core.contact_client.actif` existent. Écran d'administration absent |
| Préférences utilisateur (langue, notifications) | ✨ | could | 🔴 | `config` porte les gabarits, rien ne porte la préférence par compte |

### 2.2 Profil entreprise & vitrine (4)

| Feature | Type | Prio | État | Ce qui manque |
|---|---|---|---|---|
| Édition du profil entreprise | ✅ | must | 🔴 | Toutes les colonnes existent sur `core.entreprise`. **Aucune vue `api` ne les projette, aucune policy d'écriture client.** Écran entier à faire |
| Gestion du/des produit(s) | ✅ | should | 🔴 | `core.produit` (103 lignes). Idem : ni vue, ni écriture, ni écran |
| Score de complétude & qualité de fiche | ✨ | could | 🔴 | Le calcul existe côté talent (`fiche_talent.score_completude`), pas côté entreprise |
| Vérification / enrichissement SIRET | ✨ | could | 🔴 | Intégration externe, hors socle |

### 2.3 Dashboard & pilotage des mandats (6)

| Feature | Type | Prio | État | Ce qui manque |
|---|---|---|---|---|
| Tableau de bord des mandats | ✅ | must | 🟡 | `api.mandat_client` **existe et rend 533 lignes** avec compteurs `candidatures` / `en_cours`. ⚠ **Elle projette `titre`, qui est interne et contient la raison sociale dans 11 cas sur 12** — à remplacer par le libellé public. Écran absent |
| Détail d'un mandat (description publique) | ✅ | must | 🟡 | `api.offre_detail` couvre déjà le registre public. À réutiliser sous jeton client. Écran absent |
| Création de mandat en self-service | ✨ | must | 🔴 | Colonnes présentes (`must_have`/`nice_to_have` jsonb, 5 scorecards, `valide_par_am_le`). Manquent : **chemin d'écriture**, formulaire multi-étapes (absent du DS), workflow de validation AM |
| Brief enrichi pour le Chasseur | ✨ | should | 🟠 | Les colonnes existent et sont vides. Dépend de la création de mandat |
| Édition / pause / clôture par le client | ✨ | should | 🟠 | `cloture_demandee_le`, `cloture_demandee_par_compte_id`, `mis_en_pause_le` existent, **jamais écrits** |
| Mandat anonyme / off-market | ✅ | could | 🟡 | `est_anonyme`, `est_hors_marche`, `visibilite` existent et sont exploités par `offre_publique`. Reste à exposer la bascule au client |

### 2.4 Suivi du pipeline candidats (7)

| Feature | Type | Prio | État | Ce qui manque |
|---|---|---|---|---|
| Vue des candidats en process par mandat | ✅ | must | 🟠 | `api.candidature_client` existe. Mais **`reference_pseudonyme` est vide** et **`etape` replie sur le libellé interne** |
| Kanban funnel côté entreprise (étapes filtrées) | ✅ | must | 🔴 | **Le filtre n'existe nulle part.** `visible_client` est NULL sur les 14 étapes ; la règle prescrite est « NULL ⇒ non visible », le SQL fait l'inverse. Plus : aucun composant kanban au DS |
| Fiche candidat présentée (profil contrôlé) | ✅ | must | 🔴 | `api.candidature_client` ne projette que 6 colonnes. Aucune policy client sur `core.fiche_talent`. Vue dédiée à écrire, colonne par colonne |
| Feedback / décision client sur un candidat | ✨ | must | 🔴 | **`app.decision_client` n'existe pas** (grep exhaustif). Aucune policy d'écriture client. C'est la feature la plus lourde de la vue |
| Notes & commentaires partagés (lecture) | ✅ | should | 🔴 | **`core.note` n'a aucune colonne de visibilité.** Rien ne distingue une note interne d'une note partagée |
| Commentaires libres du client | ✨ | could | 🔴 | Même verrou, plus l'écriture |
| Planification d'entretien / créneaux | ✨ | could | 🟠 | `candidature.date_prochaine_echeance` existe. Pas de composant calendrier au-delà de la date simple |

### 2.5 Contrat & conditions commerciales (3)

| Feature | Type | Prio | État | Ce qui manque |
|---|---|---|---|---|
| Consultation du contrat (lecture) | ✅ | must | 🟡 | Toutes les colonnes sont sur `core.entreprise` (`statut_contrat_id`, `success_fee_*`, `exclusivite*`, `nb_mois_garantie`, dates). **Aucune vue ne les projette.** Vue + écran |
| Signature électronique | ✨ | should | 🔴 | Intégration tierce |
| Alertes échéances contractuelles | ✨ | should | 🟡 | `ref.type_tache` porte déjà `ancre` et `delai_relatif_jours` — c'est de la configuration exécutable. Le moteur qui l'exécute n'existe pas |

### 2.6 Facturation & success fees (4)

| Feature | Type | Prio | État | Ce qui manque |
|---|---|---|---|---|
| Espace facturation en lecture seule | ✅ | must | 🟡 | `core.placement` (227) + `core.repartition_commission` (260). ⚠ **Placement en K€, répartition en € — ratio 1000 mesuré.** Vue + écran |
| Coordonnées & structure de facturation éditables | ✅ | should | 🟡 | Colonnes présentes. Écriture absente. *(Défaut d'organisation : facturer à « Pacha Partners », 15B route de Vienne 69007 Lyon)* |
| Génération & téléchargement de factures | ✨ | should | 🔴 | Génération PDF + stockage, rien n'existe |
| Récapitulatif financier | ✨ | could | 🟡 | Agrégation de données présentes |

### 2.7 Relation avec l'Account Manager (4)

| Feature | Type | Prio | État | Ce qui manque |
|---|---|---|---|---|
| Identité & contact de l'AM | ✅ | must | 🟡 | `entreprise.account_manager_id` → `core.collaborateur` (nom, photo, fonction). `api.offre_detail` le projette déjà (`agent_nom`, `agent_photo`). À reprendre côté portail |
| Centre de notifications & tâches client | ✅ | must | 🟠 | `core.tache` porte les 9 colonnes `notif_*` dont `destinataire_compte_id` et `lue_le`. **Aucun moteur ne les écrit, aucune vue ne les lit.** Plus : ni cloche fonctionnelle, ni panneau au DS |
| Messagerie / fil d'échange contextualisé | ✨ | should | 🔴 | `core.note` est polymorphe et taillé pour ça, mais sans visibilité ni écriture client. Pas de composant fil de discussion |
| Journal d'activité de la relation | ✨ | could | 🟠 | `ref.evenement_note` (24 types) + `core.note`. Pas de frise chronologique au DS |

### 2.8 Analytics & reporting client (3)

| Feature | Type | Prio | État | Ce qui manque |
|---|---|---|---|---|
| Métriques de performance des recrutements | ✨ | should | 🔴 | ⚠ **`app.transition_etape` est vide et l'historique d'étapes n'existe nulle part** (colonnes sources vides à 100 %). Aucune durée par étape n'est calculable sur l'historique. Les métriques ne démarreront qu'à partir des transitions **futures** |
| Dashboard exécutif & exports | ✨ | could | 🔴 | Idem, plus aucun composant graphique |
| Benchmark marché | ✨ | could | 🔴 | Agrégation anonymisée à concevoir |

---

## 3. Les 27 features — espace TALENT

### 3.1 Job board & découverte (4)

| Feature | Type | Prio | État | Ce qui manque |
|---|---|---|---|---|
| Job board public & indexable | ✅ | must | 🟢 | **Livré au J1.** `/offres` sert 12 offres réelles via `api.offre_publique`. Manquent : pagination (aucun `.range()`), `loading.tsx`, `error.tsx` |
| Recherche & filtres avancés | ✅ | must | 🟢 | Livré, mais **entièrement en mémoire client** (`lib/domaine/offre.ts`). Tiendra tant que le catalogue est à 12 |
| Détail offre avec contexte enrichi | ✅ | should | 🟢 | `api.offre_detail`, 46 colonnes, scorecards, vidéo. Manque `not-found.tsx` |
| Anonymisation contrôlée des offres | ✨ | could | 🟡 | `est_anonyme` existe et fonctionne. ⚠ **`site_web` est renseigné sur 12 offres anonymes sur 12** — la règle posée est le non-construit, pas le masquage |

### 3.2 Profil talent & complétude (6)

| Feature | Type | Prio | État | Ce qui manque |
|---|---|---|---|---|
| Profil éditable | ✅ | must | 🟠 | `api.ma_fiche` existe (23 colonnes) et la policy `talent_maj_sa_fiche` autorise l'`update`. **Mais la vue n'est pas auto-updatable** (sous-requêtes) et **la policy ne restreint aucune colonne** : un talent peut écrire `est_qualifie`, `statut_relation`, `agent_referent_id`, `seniorite`. Verrou de sécurité |
| Expériences & parcours structurés | ✅ | must | 🔴 | **`core.fiche_talent_poste` est vide (0 ligne, aucune source)** — `public.experience` n'était pas une liste de postes. La frise est à construire et à saisir |
| Job rêvé & critères d'aspiration | ✅ | must | 🟡 | Replié dans `fiche_talent` (`attentes_*`) + satellites `_secteur_vise`, `_secteur_nogo`, `_critere`. Policy `talent_ses_satellites` en `for all`. Écran absent |
| Préférences de rémunération & contrats | ✅ | must | 🟡 | `attentes_salaire_*`, `attentes_tjm_*`, `_contrat_souhaite`, `_remote_souhaite`. Écran absent |
| Score de complétude gamifié | ✨ | should | 🟡 | `score_completude` et `champs_manquants text[]` **existent déjà sur la fiche** et sont projetés par `api.ma_fiche` |
| Import / pré-remplissage depuis CV ou LinkedIn (IA) | ✨ | should | 🔴 | `source_import`, `parse_par_ia_le`, `resume_ia` prévus et vides. Nécessite téléversement (absent du DS) + traitement |

### 3.3 Candidature & suivi (5)

| Feature | Type | Prio | État | Ce qui manque |
|---|---|---|---|---|
| Candidature à un mandat | ✅ | must | 🔴 | **Le CTA « Postuler » mène à `/connexion?offre=<uuid>` et la redirection perd la query.** Aucune écriture de candidature. `est_spontanee`, `cree_par_fiche_talent_id` prêts |
| Suivi des candidatures | ✅ | must | 🟠 | `api.ma_candidature` existe. ⚠ **Elle projette `m.titre`, le titre interne**, et replie l'étape sur `libelle_interne` : le talent lit « KO by Pachamama » |
| Notifications candidat | ✅ | must | 🟠 | Même socle `core.tache` non branché que côté entreprise |
| Candidature spontanée | ✨ | could | 🟡 | `candidature.est_spontanee` existe |
| Retrait / désistement & feedback de fin | ✨ | could | 🟡 | `retire_par_talent_le`, `motif_retrait`, `feedback_fin_process` jsonb existent, jamais écrits |

### 3.4 Matching sémantique & recommandations (4)

| Feature | Type | Prio | État | Ce qui manque |
|---|---|---|---|---|
| Recommandations d'offres (pgvector) | ✨ | should | 🔴 | Aucune table d'embedding (`app.embedding` annoncée, jamais créée). pgvector réservé à l'étape 3 par l'ADR 0002 |
| Alertes offres personnalisées | ✨ | should | 🔴 | Entité `alerte_talent` absente |
| Explicabilité du match | ✨ | could | 🔴 | Dépend du précédent |
| Suggestions d'amélioration de profil | ✨ | could | 🟡 | `champs_manquants` est déjà calculé — la version non-IA est à portée |

### 3.5 Confidentialité, visibilité, consentement (3)

| Feature | Type | Prio | État | Ce qui manque |
|---|---|---|---|---|
| Contrôle de visibilité / mode passif | ✅ | must | 🟡 | `recherche_active`, `actif` existent et sont projetés. Écran + écriture |
| Consentement RGPD & données personnelles | ✨ | must | 🟠 | `consentement_donne_le`, `anonymise_le` existent, **jamais écrits**. ⚠ Le **cadrage RGPD est déclaré bloquant avant toute mise en production** et n'est pas instruit |
| Masquage sélectif vis-à-vis d'employeurs no-go | ✨ | could | 🟠 | `_secteur_nogo` existe ; la liste d'entreprises bloquées non |

### 3.6 Authentification & espace personnel (2)

| Feature | Type | Prio | État | Ce qui manque |
|---|---|---|---|---|
| Login Supabase & onboarding talent | ✅ | must | 🟡 | Livré au J2. Manquent : inscription (`signUp` inexistant), mot de passe oublié, lien magique |
| Réconciliation candidat↔compte & déduplication | ✨ | should | 🟠 | `fusionnee_vers_fiche_id` existe. **109 candidatures en double** et une vue de contrôle les signalent déjà |

### 3.7 Nurturing & engagement (3)

| Feature | Type | Prio | État | Ce qui manque |
|---|---|---|---|---|
| Réactivation des profils dormants | ✨ | should | 🟡 | `actif`, `date_dernier_contact`, `confirme_sans_changement_le` prêts. Moteur de campagne absent |
| Rappels de fraîcheur | ✨ | could | 🟡 | `modifie_par_le_talent_le` prêt |
| Espace ressources & marque | ✨ | could | 🔴 | Contenu éditorial, hors socle |

---

## 4. Les 12 features — tranche RECRUTEUR

| # | Feature | Type | Prio | État | Ce qui manque |
|---|---|---|---|---|---|
| 1 | Kanban process vue recruteur | ✅ | must | 🟠 | `api.kanban` existe (7 206 lignes) mais **ne filtre pas sur `visible_interne`** (NULL) et **est lisible par un compte entreprise**. Aucun composant kanban, **aucune dépendance glisser-déposer** |
| 2 | Fiche process / détail candidature | ✅ | must | 🟡 | `core.candidature` porte tout (compte rendu, appréciations, points forts/faibles, rémunération). Aucune vue `api`, aucun écran |
| 3 | Transitions d'étape & motifs de KO | ✅ | must | 🔴 | **`ref.motif_ko` n'existe pas** ; `motif_ko_code` est un `text` libre, vide. **`app.transition_etape` est vide.** L'ADR 0002 impose des motifs structurés et journalisés |
| 4 | Liste & fiche mandat éditables | ✅ | must | 🟡 | 533 mandats, ~60 colonnes. Aucune vue, aucun écran, aucune écriture |
| 5 | Affectation d'équipe sur le mandat | ✅ | must | 🟡 | `agent_en_charge_id`, `agent_2_id`, `account_manager_id` → `core.collaborateur` (42) |
| 6 | Liste & fiche candidat 360 éditable | ✅ | must | 🟡 | 7 023 fiches, ~81 colonnes + 12 satellites. Écriture couverte par `interne_ecriture` |
| 7 | Recherche & filtres avancés talents | ✅ | must | 🟠 | `api.talent_recherche` existe (7 023). ⚠ **Ouverte à tout `authenticated`** — un talent y lit sa propre qualification cabinet. Ni recherche plein texte, ni pagination |
| 8 | Liste & fiche entreprise éditable | ✅ | must | 🟡 | 851 entreprises. Aucune vue, aucun écran |
| 9 | Gestion des contacts equipe | ✅ | must | 🟡 | `core.contact_client` (524) + `core.mandat_contact_client` (706). **C'est ici que se crée un accès entreprise** — donc ici que se dénouent les 341 quarantaines |
| 10 | Prises de notes polymorphes | ✅ | must | 🟠 | 45 685 notes, 5 ancrages. **Pas de colonne de visibilité**, pas de `<textarea>` au DS, pas de fil de commentaires |
| 11 | Journal d'événements structuré | ✅ | must | 🟡 | `ref.evenement_note` (24 types), `valeur_avant`/`valeur_apres`, `est_automatique`. **Aucun déclencheur ne l'écrit** : le journal est historique, pas vivant |
| 12 | Notifications de tâches | ✅ | must | 🟠 | `core.tache` (1 136) avec les 9 colonnes `notif_*`. Moteur absent |

---

## 5. Le plan

Quatre lots. **Le LOT 0 conditionne les trois autres** : sans lui, chaque écran construit
au-dessus devra être repris.

### LOT 0 — Le socle (bloquant)

| # | Chantier | Taille | Pourquoi maintenant |
|---|---|---|---|
| **0.1** | **Le vocabulaire des étapes.** Peupler `ref.etape_process` : `libelle_client`, `libelle_talent`, `visible_client`, `visible_interne`, `est_publique`, `couleur_colonne`, `couleur_pastille`, et **confirmer `ordre`** (inféré, jamais mesuré). Puis écrire dans `api` la liste explicite des étapes visibles par un client, **sans lire `ref.etape_process`** (prescription J3). | M | Tant que c'est NULL, le client et le talent lisent « KO by Pachamama » et **voient toutes les étapes**. Aucun écran de pipeline n'est présentable. **Demande un arbitrage produit** : les 14 libellés, en deux registres |
| **0.2** | **`ref.motif_ko`** + FK depuis `candidature.motif_ko_code` et `app.transition_etape.motif_ko_code`. | S | 6 285 KO sans motif. Imposé par l'ADR 0002 |
| **0.3** | **Peupler `reference_pseudonyme`** sur les 7 236 candidatures, déterministe et stable. | S | Sans lui le client ne peut désigner aucun candidat |
| **0.4** | **Segmenter les droits du schéma `api`.** Remplacer le `grant select on all tables in schema api to authenticated` par un grant par vue et par portail. Retirer `titre` de `api.mandat_client` et de `api.ma_candidature`. Révoquer le résidu `anon` sur `app.mandat_publication`. | S | Deux fuites mesurables aujourd'hui (§5.1). Le J3 en fait un contrôle **bloquant avant l'ouverture du moindre compte client réel** |
| **0.5** | **Le chemin d'écriture.** ⚠ **Décision d'architecture requise** — voir §6. Puis : brancher `app.journal_ecriture` (aujourd'hui vide, `revoke all from authenticated`) et `app.idempotence` (vide, jamais utilisée), tous deux exigés par la définition de fini de J3 et J4. | L | **Il n'existe aucun chemin d'écriture.** C'est le verrou n°1 du projet |
| **0.6** | **Remettre le middleware de session.** `lib/session-refresh/middleware.reference.ts` est hors du chemin d'exécution depuis le 20/08 (import module-level de `@supabase/ssr` en Edge Runtime). | S | Sans lui la session expire sous l'utilisateur, et `setAll` avale l'écriture de cookie en silence |
| **0.7** | **Les 8 primitives manquantes du DS**, dans le dépôt d'abord : `Tableau` (TanStack Table est installé et n'est importé nulle part), `Pagination`, `Onglets`, `Dialogue` desktop, `Toast`, `Squelette`, `ErreurDePage` + `error.tsx`/`loading.tsx`/`not-found.tsx`, `ZoneTexte` (`<textarea>`). | L | Chaque écran des trois portails bute dessus. Les construire une fois |

**Fin de LOT 0** : un talent et un client connectés lisent des libellés d'étape en français, ne voient
que les étapes qui les concernent, et une écriture aboutit avec une ligne de journal.

### LOT 1 — Portail Entreprise (= J3)

| Tranche | Contenu | Dépend de |
|---|---|---|
| **1.a — Lire** | Tableau de bord des mandats · détail de mandat · vue des candidats en process · kanban client filtré · fiche candidat présentée · identité de l'AM | 0.1, 0.3, 0.4, 0.7 |
| **1.b — Réagir** | Décision client sur un candidat (`app.decision_client` à créer) · commentaires · notes partagées en lecture (**colonne de visibilité à ajouter sur `core.note`**) | 0.2, 0.5 |
| **1.c — Administrer** | Profil entreprise éditable · produit · coordonnées de facturation · contrat en lecture · espace facturation en lecture | 0.5 |
| **1.d — Ouvrir** | Création de mandat en self-service · brief enrichi · édition/pause/clôture · collaboration multi-utilisateurs et invitation | 1.c, 3.c |

Les tranches 1.a→1.c se valident sur les **3 comptes de test** existants. La 1.d suppose la feature
recruteur n°9 (contacts equipe) pour créer de vrais accès.

### LOT 2 — Espace Talent (= J4)

| Tranche | Contenu | Dépend de |
|---|---|---|
| **2.a — Lire** | Suivi des candidatures avec libellés talent · détail d'une candidature | 0.1, 0.4 |
| **2.b — Se décrire** | Profil éditable · attentes · job rêvé · préférences · complétude — avec **restriction par colonne** (une policy RLS ne filtre pas les colonnes : soit `GRANT UPDATE (colonnes)`, soit passage par l'API) | 0.5, 0.7 |
| **2.c — Candidater** | Candidature depuis une offre · **réparer la perte du `?offre=` à la redirection `/connexion`** · candidature spontanée · retrait | 0.5 |
| **2.d — Maîtriser** | Visibilité / mode passif · consentement RGPD · export de ses données | cadrage RGPD |
| **2.e — Parcours** | Frise d'expériences : `core.fiche_talent_poste` est **vide, sans source** — c'est une saisie neuve, pas une reprise | 0.7 |

### LOT 3 — Poste Recruteur, tranche 25 % (= J5 partiel + J6 partiel)

| Tranche | Contenu | Dépend de |
|---|---|---|
| **3.a — Consulter** | Liste & fiche mandat · liste & fiche candidat 360 · liste & fiche entreprise · recherche et filtres talents · fiche process | 0.4, 0.7 |
| **3.b — Faire avancer** | Kanban interne · transitions d'étape avec motif de KO structuré · alimentation de `app.transition_etape` · affectation d'équipe | 0.1, 0.2, 0.5, glisser-déposer |
| **3.c — Entretenir** | Notes polymorphes avec visibilité · journal d'événements **vivant** (déclencheurs d'écriture) · contacts equipe et **invitation d'un contact au portail** · notifications de tâches | 0.5, 1.b |

---

## 6. La décision qui commande tout : par où passent les écritures

**Il n'existe aujourd'hui aucun chemin d'écriture.** Il faut en choisir un avant d'écrire le premier
formulaire, parce qu'il détermine la forme de tous les autres.

| | A — API FastAPI | B — Écriture directe Supabase sous RLS |
|---|---|---|
| Conformité | **C'est l'ADR 0001** : « écritures toujours par l'API, lectures en direct Supabase avec le JWT » | Contredit l'ADR 0001 ; l'ADR 0003 D1 réserve `api` aux vues |
| Journal & idempotence | Naturels côté serveur — `app.journal_ecriture` et `app.idempotence` sont **exigés** par la définition de fini de J3/J4 | À faire par déclencheurs, ce qui rend l'auteur applicatif difficile à porter |
| Restriction par colonne | Liste blanche explicite | Possible par `GRANT UPDATE (colonnes)`, mais dispersée sur 81 colonnes de `fiche_talent` |
| Coût | **Élevé** : `backend/api` est aujourd'hui câblé sur le schéma `pivot`, pas sur `core` ; `npm run api:lint` échoue déjà sur **175 erreurs mypy** et 2 tests de sécurité | Faible : Server Actions Next, le socle est déjà là |
| Risque | Retarde les trois portails | Dette d'architecture, et une reprise à faire plus tard |

**Ma recommandation : A, l'ADR tient** — mais en la bornant. Ne pas reconstruire une API complète :
ouvrir `backend/api` sur `core` avec **un seul module d'écriture** par portail, et n'y faire passer que
les mutations. Les lectures restent en direct Supabase, comme aujourd'hui. Deux raisons décisives :
la décision client et la modification d'attentes doivent l'une et l'autre produire une ligne de journal
avec auteur et horodatage, et être idempotentes — c'est écrit dans la définition de fini ; et la policy
`talent_maj_sa_fiche` laisse aujourd'hui un talent réécrire sa propre qualification cabinet, ce qu'une
liste blanche règle en une ligne.

**Réserve honnête** : cette voie ajoute un chantier avant le premier écran qui écrit, et le backend
Python n'est pas au vert. Si la soutenance prime sur l'architecture, B livre plus vite — mais alors il
faut l'écrire comme un amendement à l'ADR 0001, pas le laisser arriver par défaut.

---

## 7. Ce qui demande un arbitrage avant que je code

| # | Question | Pourquoi elle bloque |
|---|---|---|
| 1 | **Le chemin d'écriture** (§6) | Détermine la forme de tous les formulaires |
| 2 | **Les 14 libellés d'étape, en registre client et en registre talent** | Le contenu est définitivement perdu. Personne d'autre que vous ne peut le rétablir |
| 3 | **L'ordre des 14 étapes** — inféré, jamais mesuré | À confirmer **avant** d'ouvrir un kanban |
| 4 | **Quelles étapes un client voit-il ?** Le ticket J3 dit « rien avant le send-out ». À confirmer | Détermine le filtre du kanban client |
| 5 | **Une note partagée avec le client : comment ?** Drapeau sur `core.note`, ou table séparée | Trois features en dépendent |
| 6 | **Le cadrage RGPD**, déclaré bloquant avant production et non instruit | Bloque l'ouverture réelle du portail talent |
| 7 | **L'accord des 12 clients** avant publication de leurs offres | Déjà ouvert au J1 |

---

## 8. Dette qui n'est pas dans le périmètre mais qui va gêner

- **Rien n'est commité depuis le 20/08** : 70 entrées non versionnées, dont les 88 migrations et tout le travail J1/J2.
- `npm run verifier` **s'arrête sur `api:lint`** (175 erreurs mypy) — le contrôle global est donc inopérant.
- **`core.talent` est vide** et le connecteur pivot→app n'existe pas.
- **La synchro n8n ne rapatrie pas `mandat.localisations`** : tout mandat créé après le 09/09 arrive sans lieu.
- **`--r-controle`** est référencé dans `PageJobs.tsx:329` et `FicheOffre.tsx:78` mais **n'est défini nulle part**.
- **388 lignes en quarantaine**, **109 candidatures en double**, 25 répartitions dont le total ne retombe pas.
- Les correctifs de sécurité du 26/08 et du 10/09 sont marqués « reste à appliquer en production ».
