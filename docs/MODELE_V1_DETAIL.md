# Modèle v1 — le détail

> Complément de `MODELE_V1.md`, qui porte la structure. Ici, chaque entité
> avec ses attributs, leur type, leur origine dans le miroir, et les
> contraintes. Produit le 26/08/2026.

**Convention de lecture de la colonne origine** : un nom de la forme
`public.table.colonne` désigne la source dans le miroir ; `A_CREER` désigne un
attribut qui n'existe nulle part aujourd'hui et que le modèle ajoute.


---

# Le talent

## `core.fiche_talent`
LE CŒUR. L'enregistrement de l'application sur une personne, le SEUL modifiable. Cible de migration 1 pour 1 de public.candidat et de ses quatre satellites (candidat_expanded, experience, job_actuel, job_reve) : 7 028 fiches pour 7 028 candidats. Elle naît vide, se remplit par le candidat ou par un recruteur, et porte quatre choses que la projection ne peut pas porter : l'identité et les coordonnées DÉCLARÉES, les documents, la qualification produite par le cabinet, et les attributs de relation du cabinet. Chaque champ déclarable porte sa colonne _origine (13 au total), pour que le moteur d'inclusion arbitre sans reconstituer le journal.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `bubble_id` | `text` | — | public.candidat.id |
| `talent_id` | `uuid` | — | A_CREER (résolu par pivot.talent_source où source='app' et external_id = bubble_id) |
| `prenom` | `text` | — | public.candidat.prenom |
| `prenom_origine` | `ref.origine_valeur` | — | A_CREER |
| `nom` | `text` | — | public.candidat.nom |
| `nom_origine` | `ref.origine_valeur` | — | A_CREER |
| `genre` | `ref.genre` | — | public.candidat.genre |
| `genre_origine` | `ref.origine_valeur` | — | A_CREER |
| `photo_url` | `text` | — | public.candidat.photo_url |
| `photo_origine` | `ref.origine_valeur` | — | A_CREER |
| `email_personnel` | `text` | — | public.candidat.email_perso |
| `email_origine` | `ref.origine_valeur` | — | A_CREER |
| `telephone` | `text` | — | public.candidat.telephone |
| `telephone_origine` | `ref.origine_valeur` | — | A_CREER |
| `url_linkedin` | `text` | — | public.candidat.linkedin |
| `url_linkedin_origine` | `ref.origine_valeur` | — | A_CREER |
| `localisation_texte` | `text` | — | public.candidat.localisations_filtre |
| `localisation_origine` | `ref.origine_valeur` | — | A_CREER |
| `localisations_brut_json` | `jsonb` | — | public.candidat.localisations |
| `cv_url` | `text` | — | public.candidat.cv_url |
| `cv_origine` | `ref.origine_valeur` | — | A_CREER |
| `cv_depose_le` | `timestamptz` | — | A_CREER |
| `portfolio_url` | `text` | — | public.candidat_expanded.portfolio (candidat.portfolio est vide) |
| `portfolio_fichier_url` | `text` | — | public.candidat.portfolio_file_url |
| `portfolio_origine` | `ref.origine_valeur` | — | A_CREER |
| `est_qualifie` | `boolean` | oui | public.candidat.est_qualifie |
| `niveau_anglais` | `ref.niveau_anglais` | — | public.candidat.niveau_anglais |
| `univers_id` | `uuid` | — | public.candidat.univers |
| `seniorite` | `text` | — | A_CREER (pivot.qualification.seniorite) |
| `mindset` | `ref.mindset_talent` | — | public.candidat_expanded.mindset (77,2 %) fusionné avec public.candidat.mindset (32,4 %) |
| `ecole` | `text` | — | public.candidat_expanded.ecole |
| `grande_ecole` | `text` | — | public.candidat.grandes_ecoles |
| `appetence_early_stage` | `text` | — | public.candidat_expanded.stage (25,8 %) fusionné avec public.candidat.early_stage (7,7 %) |
| `fiche_complete` | `boolean` | oui | public.candidat_expanded.is_complete |
| `debut_vie_professionnelle` | `date` | — | public.experience.xp_pro |
| `poste_actuel_employeur` | `text` | — | public.job_actuel.entreprise_nom |
| `poste_actuel_entreprise_id` | `uuid` | — | public.job_actuel.entreprise_id |
| `poste_actuel_metier_id` | `uuid` | — | public.job_actuel.metier (84,4 %) fusionné avec public.candidat.metier_actuel (31,9 %) |
| `poste_actuel_univers_id` | `uuid` | — | public.job_actuel.univers |
| `poste_actuel_contrat` | `ref.type_contrat` | — | public.candidat_expanded.contrat (49,7 %) fusionné avec public.candidat.contrat_actuel (11,4 %) |
| `poste_actuel_depuis_le` | `date` | — | A_CREER |
| `poste_actuel_raison_depart` | `text` | — | public.job_actuel.pourquoi |
| `poste_actuel_origine` | `ref.origine_valeur` | — | A_CREER |
| `attentes_metier_id` | `uuid` | — | public.job_reve.metier |
| `attentes_univers_id` | `uuid` | — | public.job_reve.univers |
| `attentes_salaire_min_ke` | `numeric` | — | FUSION MESURÉE public.job_reve.salaire (4 300) + public.candidat.salaire_min_souhait (1 739) — voir la règle ci-dessous |
| `attentes_salaire_max_ke` | `numeric` | — | FUSION MESURÉE public.job_reve.salaire_maximum (3 623) + public.candidat.salaire_max_souhait (1 574) — 433 valeurs n'existent QUE côté candidat |
| `attentes_tjm_min` | `numeric` | — | FUSION MESURÉE public.job_reve.tjm_minimum (1 147) + public.candidat.tjm_min_souhait (359) — 21 valeurs n'existent QUE côté candidat |
| `attentes_tjm_max` | `numeric` | — | FUSION MESURÉE public.job_reve.tjm_maximum (272) + public.candidat.tjm_max_souhait (336) — 278 valeurs n'existent QUE côté candidat |
| `attentes_infos_salaire` | `text` | — | public.job_reve.infos_salaire |
| `attentes_disponibilite_texte` | `text` | — | public.job_reve.disponibilite |
| `attentes_localisation_texte` | `text` | — | public.job_reve.info_localisation |
| `attentes_localisations_brut_json` | `jsonb` | — | public.job_reve.localisations |
| `attentes_description` | `text` | — | public.job_reve.description |
| `recherche_active` | `boolean` | — | A_CREER |
| `attentes_origine` | `ref.origine_valeur` | — | A_CREER |
| `statut_relation` | `ref.statut_relation` | — | public.candidat_expanded.statut (94,4 %) fusionné avec public.candidat.statut (47,6 %) |
| `emoji_statut` | `ref.emoji_statut` | — | public.candidat_expanded.emoji (10,2 %) fusionné avec public.candidat.emoji_statut (3,8 %) |
| `agent_referent_id` | `uuid` | — | public.candidat_expanded.agent_id (27,8 %) fusionné avec public.candidat.agent_pachamama_id (8,6 %) |
| `apporteur_affaires_id` | `uuid` | — | public.candidat.business_maker_id |
| `actif` | `boolean` | oui | A_CREER (champ Bubble « Actif », jamais synchronisé) |
| `consentement_donne_le` | `timestamptz` | — | A_CREER |
| `anonymise_le` | `timestamptz` | — | A_CREER |
| `date_dernier_contact` | `timestamptz` | — | A_CREER |
| `modifie_par_le_talent_le` | `timestamptz` | — | A_CREER |
| `confirme_sans_changement_le` | `timestamptz` | — | A_CREER |
| `score_completude` | `numeric` | — | A_CREER |
| `champs_manquants` | `text[]` | — | A_CREER |
| `source_import` | `text` | — | A_CREER |
| `parse_par_ia_le` | `timestamptz` | — | A_CREER |
| `resume_ia` | `text` | — | A_CREER |
| `fusionnee_vers_fiche_id` | `uuid` | — | A_CREER |
| `cree_par_origine` | `ref.origine_valeur` | — | A_CREER |
| `cree_par_compte_id` | `uuid` | — | A_CREER |
| `cree_par_legacy_bubble` | `text` | — | public.candidat.created_by |
| `synchro_cree_le` | `timestamptz` | — | public.candidat.created_at |
| `synchro_maj_le` | `timestamptz` | — | public.candidat.updated_at |
| `bubble_modifie_le` | `timestamptz` | — | A_CREER (Modified Date de Bubble, absente du miroir) |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**LA RÈGLE DE FUSION DES MONTANTS — TRANCHÉE PAR LA MESURE, 27/08/2026.** Le document annonçait la fusion sans dire qui gagne. Deux sources décrivent les mêmes prétentions : `public.job_reve` et `public.candidat`, cette dernière portant quatre colonnes de salaire que `candidat_expanded` n'a pas du tout. Le rapprochement des 1 883 candidats concernés donne :

| couple | identiques | en désaccord | seulement dans candidat |
|---|--:|--:|--:|
| salaire_min_souhait ↔ job_reve.salaire | 1 518 | 216 | 5 |
| salaire_max_souhait ↔ job_reve.salaire_maximum | 964 | 177 | 433 |
| tjm_min_souhait ↔ job_reve.tjm_minimum | 292 | 46 | 21 |
| tjm_max_souhait ↔ job_reve.tjm_maximum | 50 | 8 | 278 |

Lire `job_reve` seul — ce que faisait la v1 — **perd 737 montants qui n'existent nulle part ailleurs** et tranche en silence 447 désaccords. La règle retenue est donc en deux temps : **union d'abord** (si l'une des deux sources est vide, l'autre l'emporte, sans condition), **puis préséance au plus récent des deux `updated_at`** quand les deux sont renseignées et diffèrent. Cette seconde règle n'est pas neutre : sur les 216 désaccords de salaire minimum, **`public.candidat` est la source la plus fraîche 167 fois (77 %)**, alors même que `job_reve` est plus rempli. Déclarer `job_reve` maître par principe aurait donc retenu la valeur périmée dans trois cas sur quatre. Écart médian entre les deux : 5 K€.

Conséquence sur la contrainte suspendue : la fusion étant faite, le couple min/max devient comparable et la mesure de l'ordre réel — le point BLOQUANT « min/max des salaires souhaités » — doit être refaite APRÈS reprise, sur la colonne fusionnée, pas sur job_reve seul.

**Relations** — N-1 vers core.talent (talent_id) ON DELETE SET NULL — facultatif et NON unique. · N-1 vers ref.univers (univers_id, poste_actuel_univers_id, attentes_univers_id) ON DELETE RESTRICT. · N-1 vers ref.metier (poste_actuel_metier_id, attentes_metier_id) ON DELETE RESTRICT. · N-1 vers core.entreprise (poste_actuel_entreprise_id) ON DELETE SET NULL. · N-1 vers core.collaborateur (agent_referent_id) ON DELETE SET NULL. · N-1 vers core.apporteur_affaires (apporteur_affaires_id) ON DELETE SET NULL. · N-1 vers app.compte (cree_par_compte_id) ON DELETE SET NULL. · N-1 réflexive vers core.fiche_talent (fusionnee_vers_fiche_id) ON DELETE SET NULL.

**Contraintes** — CHECK (attentes_salaire_min_ke IS NULL OR attentes_salaire_min_ke >= 0), idem attentes_salaire_max_ke, attentes_tjm_min, attentes_tjm_max · À NE PAS POSER TOUT DE SUITE : CHECK (attentes_salaire_min_ke <= attentes_salaire_max_ke). Tant que l'ordre réel du couple Bubble « Salaire minimum » / « Salaire souhaité » n'est pas mesuré, cette contrainte rejetterait des lignes valides. · CHECK (score_completude IS NULL OR score_completude BETWEEN 0 AND 100) · CHECK (fusionnee_vers_fiche_id IS DISTINCT FROM id) — une fiche ne fusionne pas vers elle-même · CHECK (source_import IS NULL OR source_import IN ('cv','linkedin','saisie','bubble')) · CHECK (email_personnel IS NULL OR position('@' in email_personnel) > 1) — contrôle minimal, volontairement laxiste : une regex stricte rejetterait des adresses réelles parmi les 6 702 · AUCUN NOT NULL ajouté sur une colonne reprise, sauf est_qualifie et fiche_complete, seules mesurées à 100 % et déjà NOT NULL dans le miroir.

**Relations — complément restauré** — 1-N vers les 12 tables de liaison ci-dessous, toutes ON DELETE CASCADE : une valeur multivaluée n'a aucun sens sans sa fiche. · 1-N vers app.journal_ecriture (entite='core.fiche_talent', entite_id) ON DELETE CASCADE — décision de conformité avant d'être une décision d'intégrité : l'effacement doit emporter l'historique, qui porte noms, salaires et appréciations. · AUCUNE clé étrangère vers public, jamais. La correspondance avec le miroir passe par bubble_id, colonne texte, et une vue de réconciliation.

**Index**

- UNIQUE (bubble_id) WHERE bubble_id IS NOT NULL — provenance unique sans imposer NOT NULL
- btree (talent_id) WHERE talent_id IS NOT NULL — jointure vers la projection, et détection des fiches non ingérées
- btree (agent_referent_id) — « mes candidats » du poste recruteur
- btree (statut_relation) et btree (univers_id) — filtres de liste
- btree (lower(email_personnel)) — NON UNIQUE tant que les doublons ne sont pas mesurés ; sert la réconciliation compte↔fiche
- btree (est_qualifie, actif) WHERE actif — la population travaillable
- btree (maj_le DESC) et btree (modifie_par_le_talent_le) — rappels de fraîcheur et profils dormants
- GIN (champs_manquants)

<details>
<summary><b>Notes par attribut</b> (72)</summary>

- **`id`** — Corrige le défaut mesuré : 102 des 107 clés du miroir sont du texte sans défaut, l'application ne peut pas créer une ligne.
- **`bubble_id`** — NULLABLE, contre la correspondance qui la marque obligatoire sur 14 entités. C'est une PROVENANCE : nulle pour tout ce que l'application crée. Elle existe parce qu'on a le miroir — import rejouable sans doublon, vérification ligne à ligne, et clavetage des 7 028 liens pivot.talent_source(source='app').
- **`talent_id`** — NULLABLE ET NON UNIQUE. Nullable : une fiche créée à l'inscription n'a pas encore été ingérée par le pivot. Non unique : 374 talents sont nés de la fusion de 769 candidats, une contrainte d'unicité échouerait dès le premier jour — c'est la correction explicite du « PROPOSÉ » de la Décision 3. FK vers core.talent(id) ON DELETE SET NULL : la disparition d'une projection ne doit jamais emporter une fiche.
- **`prenom`** — 6 976 / 7 028 (99,3 %). Reste NULLABLE malgré le taux : 52 lignes sont vides.
- **`prenom_origine`** — NULL = provenance inconnue, ce qui est le cas des 7 028 lignes reprises de Bubble. Aucune des cinq origines ne décrit honnêtement une reprise, et inventer une sixième valeur mentirait au moteur.
- **`nom`** — 6 971 / 7 028 (99,2 %).
- **`genre`** — 5 566 / 7 028 (79,2 %). male | female | non_binary. FICHE UNIQUEMENT : pivot.qualification exclut délibérément le genre au titre de la minimisation RGPD, la projection ne peut donc pas le porter.
- **`photo_url`** — 3 429 / 7 028 (48,8 %). Absent du pivot.
- **`email_personnel`** — 6 702 / 7 028 (95,4 %). Pas d'index unique : les doublons n'ont jamais été mesurés. Une vue de contrôle les liste.
- **`telephone`** — 3 984 / 7 028 (56,7 %). Reste en text : aucune normalisation E.164 n'a été mesurée, un type contraint rejetterait des lignes.
- **`url_linkedin`** — 5 670 / 7 028 (80,7 %). Sert de clé de rapprochement au pivot sous la forme « s: »+slug.
- **`localisation_texte`** — 5 841 / 7 028 (83,1 %). C'est bien localisations_filtre qui alimente le pivot, pas le JSON.
- **`localisations_brut_json`** — 5 842 / 7 028. Charge utile Bubble conservée pour la reprise et la non-perte, NON requêtable par l'application : la donnée exploitable est localisation_texte. À supprimer après le cut.
- **`cv_url`** — 3 923 / 7 028 (55,8 %).
- **`cv_depose_le`** — AJOUT signalé : la fraîcheur du CV est ce qui déclenche les rappels de mise à jour, et le miroir ne la porte pas.
- **`portfolio_url`** — 735 / 7 029 (10,5 %) côté expanded, 0 côté candidat : la fusion des deux colonnes n'a en pratique qu'une source.
- **`portfolio_fichier_url`** — 161 / 7 028 (2,3 %). Fichier déposé, distinct de l'URL.
- **`est_qualifie`** — SEUL NOT NULL scalaire de la fiche justifié par la mesure : 7 028 / 7 028, et déjà NOT NULL DEFAULT false dans le miroir. Acte du cabinet, absent du pivot en tant que booléen.
- **`niveau_anglais`** — 3 115 / 7 028 (44,3 %). aucun | ecrit_seulement | courant_occasionnel | courant_quotidien, plus une valeur orpheline à absorber (59 occurrences). Le référentiel porte DEUX registres de libellé — recruteur et candidat — d'où l'obligation d'un code neutre.
- **`univers_id`** — 5 936 / 7 028 (84,5 %). FK ref.univers ON DELETE RESTRICT : 8 valeurs, 0 orpheline mesurée.
- **`seniorite`** — Reste en text : le pivot le porte mais aucun référentiel du miroir ne le contraint. À convertir en enum quand le vocabulaire sera arrêté.
- **`mindset`** — pas_en_recherche | en_veille | recherche_6_mois | recherche_3_mois | recherche_active. Le référentiel source stockait des PHRASES de 69 caractères avec emoji comme valeur : la phrase part dans ref.libelle, l'ordre 1..5 encode une intensité d'intention à conserver.
- **`ecole`** — 1 807 / 7 029 (25,7 %).
- **`grande_ecole`** — 520 / 7 028 (7,4 %). Reste en text : la correspondance annonce « type_corrige » sans dire vers quoi, et le contenu n'a pas été inspecté.
- **`appetence_early_stage`** — Reste en text tant que les valeurs distinctes ne sont pas mesurées : les typer en enum sans les avoir vues rejetterait des lignes.
- **`fiche_complete`** — 7 029 / 7 029, déjà NOT NULL DEFAULT false dans le miroir. NOT NULL sûr.
- **`debut_vie_professionnelle`** — 4 445 / 7 049 (63,1 %). Retypé timestamptz→date : c'est une année d'entrée sur le marché, l'heure n'a aucun sens. Seule colonne rescapée de la table experience, qui malgré son nom ne porte pas la liste des expériences.
- **`poste_actuel_employeur`** — 1 285 / 7 029 (18,3 %), dont 69 % contiennent un identifiant Bubble au lieu d'un nom. À nettoyer avant de l'afficher.
- **`poste_actuel_entreprise_id`** — 68e attribut, absent de la liste des 67 mais présent dans les lignes de correspondance. 6 valeurs (0,1 %) : abandon renversé en Partie C, parce que ces 6 liens sont le seul rattachement fiable à une entreprise quand il existe. FK core.entreprise ON DELETE SET NULL.
- **`poste_actuel_metier_id`** — FK ref.metier ON DELETE RESTRICT. 238 valeurs, 16 orphelines à absorber avant la contrainte.
- **`poste_actuel_univers_id`** — 5 173 / 7 029 (73,6 %). FK ref.univers ON DELETE RESTRICT.
- **`poste_actuel_contrat`** — cdi | freelance | entrepreneur. Absorbe l'attribut 63 « contrat_actuel » de la correspondance, qui en est un doublon. « Entrepreneur » est aussi une valeur de ref_profile : collision à trancher.
- **`poste_actuel_depuis_le`** — Attribut 64. Ancienneté dans le poste, exigée par « Expériences & parcours structurés ».
- **`poste_actuel_raison_depart`** — 2 840 / 7 029 (40,4 %).
- **`poste_actuel_origine`** — Une origine pour tout le bloc poste actuel : la personne le déclare d'un coup, pas champ par champ.
- **`attentes_metier_id`** — 4 404 / 7 029 (62,7 %). FK ref.metier ON DELETE RESTRICT.
- **`attentes_univers_id`** — 4 400 / 7 029 (62,6 %). FK ref.univers ON DELETE RESTRICT.
- **`attentes_salaire_min_ke`** — En K€ — l'unité est dans le commentaire, pas dans le nom du type. Des salaires en integer ont gelé la synchro 43 jours. ⚠ le rattachement min/max n'est PAS prouvé : côté Bubble le couple est « Salaire minimum » / « Salaire souhaité ».
- **`attentes_salaire_max_ke`** — En K€. Même réserve sur min/max.
- **`attentes_tjm_min`** — En euros par jour. TJM exclu de l'harmonisation €→K€.
- **`attentes_tjm_max`** — En euros par jour.
- **`attentes_infos_salaire`** — 1 475 / 7 029 (21 %). Texte libre, sans équivalent au pivot.
- **`attentes_disponibilite_texte`** — 2 308 / 7 029 (32,8 %). Reste en text : la donnée source est du texte libre, la convertir en date inventerait de l'information.
- **`attentes_localisation_texte`** — 981 / 7 029 (14 %). Commentaire libre, distinct de la liste de lieux.
- **`attentes_localisations_brut_json`** — 5 583 / 7 029 (79,4 %). Même statut que localisations_brut_json : reprise, non requêtable, à supprimer après le cut.
- **`attentes_description`** — 2 335 / 7 029 (33,2 %). Le « job rêvé » raconté par la personne.
- **`recherche_active`** — Attribut 67. Équivalent DÉCLARÉ de open_to : la personne dit elle-même qu'elle cherche. Exigé par la candidature spontanée. NULLABLE — « on ne sait pas » n'est pas « non ».
- **`attentes_origine`** — Une origine pour tout le bloc attentes, comme le prévoit l'ADR. ⚠ elle ne pourra PAS faire l'aller-retour vers le pivot : pivot.attentes porte zéro colonne de provenance.
- **`statut_relation`** — nouveau | qualifie | non_qualifie | lead | client. Le référentiel stockait « ⭐️ Nouveau » comme VALEUR : le code devient stable, l'emoji rejoint ref.libelle. Le référentiel mélange deux axes (qualification et cycle commercial) — scission probable mais c'est un arbitrage métier.
- **`emoji_statut`** — feu | pouce_haut | yeux | pouce_bas. Seul référentiel où l'emoji est légitimement la donnée affichée ; on lui donne quand même un code nommable pour écrire WHERE emoji_statut = 'feu' plutôt qu'un caractère invisible.
- **`agent_referent_id`** — FK core.collaborateur ON DELETE SET NULL — le départ d'un recruteur ne doit pas supprimer une fiche. La correspondance visait core.utilisateur, remplacée par core.collaborateur en Décision 4.
- **`apporteur_affaires_id`** — 14 valeurs (0,2 %). FK core.apporteur_affaires ON DELETE SET NULL. Un remplissage de 0,2 % n'est pas rien : 14 liens réels.
- **`actif`** — NOT NULL sûr parce que la colonne est neuve avec un défaut. Réparation d'une perte : rempli à 100 % sur 6 783 candidats côté Bubble, zéro occurrence dans n8n_sync_type.js. À backfiller depuis l'API Bubble, PAS depuis le miroir.
- **`consentement_donne_le`** — Exigé par « Consentement RGPD » et le registre des droits des personnes.
- **`anonymise_le`** — Console RGPD et purge automatique. ⚠ le pivot n'a pas d'équivalent : la projection ne peut pas refléter un effacement décidé au pivot tant que la colonne n'y est pas ajoutée.
- **`date_dernier_contact`** — Ré-engagement du vivier, réactivation des profils dormants.
- **`modifie_par_le_talent_le`** — Fraîcheur du profil. Ce n'est pas maj_le : une modification par un recruteur ne rafraîchit pas la parole de la personne.
- **`confirme_sans_changement_le`** — Le « rien n'a changé » du rappel de fraîcheur, qui vaut confirmation sans écriture.
- **`score_completude`** — Attribut 53, première moitié. Colonne stockée et non générée : la règle vit dans app.regle_completude et changera sans migration.
- **`champs_manquants`** — Attribut 53, seconde moitié. Ce qui reste à remplir, pour le score gamifié.
- **`source_import`** — Attribut 54, première moitié. cv | linkedin | saisie | bubble. Distinct de _origine : dit PAR QUEL CANAL, pas PAR QUI.
- **`parse_par_ia_le`** — Attribut 54, seconde moitié.
- **`resume_ia`** — Résumé automatique de CV. Distinct de talent.notes_bloc, qui consolide le journal de notes du pivot.
- **`fusionnee_vers_fiche_id`** — Attribut 56, renommé : la fusion porte sur des fiches, pas sur des candidats Bubble. FK réflexive core.fiche_talent ON DELETE SET NULL. La fusion côté pivot s'exprime autrement — plusieurs fiches partageant un talent_id.
- **`cree_par_origine`** — Une fiche née d'une inscription et une fiche créée par un recruteur ne se lisent pas pareil.
- **`cree_par_compte_id`** — FK app.compte ON DELETE SET NULL. NULL quand l'origine est automatique, ou quand l'auteur Bubble n'a pas été résolu.
- **`cree_par_legacy_bubble`** — 6 808 / 7 028 (96,9 %). Identifiant d'utilisateur Bubble non résolvable : user.auth_id est vide sur les 4 605 lignes. Reste en text SANS FK, comme toute référence vers le miroir.
- **`synchro_cree_le`** — Date de SYNCHRONISATION du miroir, pas de création dans Bubble. Nommée pour qu'on ne s'y trompe pas ; ne sert qu'au contrôle de reprise.
- **`synchro_maj_le`** — Attribut 32. Même nature : date de synchronisation.
- **`bubble_modifie_le`** — Attribut 51. Le miroir est lossy : la vraie date de modification Bubble n'a jamais été synchronisée. À récupérer par l'API avant le cut, sinon les rappels de fraîcheur partiront de rien.
- **`cree_le`** — Posé par l'application. Backfillé à la migration avec candidat.created_at, faute de mieux, ce que le commentaire de colonne doit dire.
- **`maj_le`** — Maintenu par trigger.

</details>
## `core.fiche_talent_background`
Les grandes familles de parcours. Source unique : experience_background, 5 218 lignes, 4/4 valeurs utilisées, 0 orpheline.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `fiche_talent_id` | `uuid` | oui | public.experience_background.experience_id (remappé) |
| `background` | `ref.background_talent` | oui | public.experience_background.background |
| `origine` | `ref.origine_valeur` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 vers core.fiche_talent ON DELETE CASCADE.

**Contraintes** — PK (fiche_talent_id, background) · Remontée au pivot lossy : pivot.qualification.background est un text unique.

**Index**

- btree (background)

<details>
<summary><b>Notes par attribut</b> (1)</summary>

- **`background`** — business | tech | data | marketing. Enum : 4 valeurs, aucun attribut propre, vocabulaire fermé et structurel. 5 218 lignes déjà parfaitement conformes, l'enum verrouille cette propreté à coût nul.

</details>
## `core.fiche_talent_contrat_souhaite`
Les types de contrat que la personne vise. Fusionne deux tables du miroir qui disent la même chose à deux niveaux : candidat_contrat (2 460 lignes) et job_reve_contrat (6 444 lignes).

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `fiche_talent_id` | `uuid` | oui | public.candidat_contrat.candidat_id + public.job_reve_contrat.job_reve_id (remappé via job_reve.candidat_id) |
| `contrat` | `ref.type_contrat` | oui | public.candidat_contrat.contrat + public.job_reve_contrat.contrat |
| `origine` | `ref.origine_valeur` | — | A_CREER |
| `bloc_legacy` | `text` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 vers core.fiche_talent ON DELETE CASCADE.

**Contraintes** — PK (fiche_talent_id, contrat) — dédoublonne la fusion des deux tables sources · CHECK (bloc_legacy IS NULL OR bloc_legacy IN ('candidat','job_reve','fusion'))

**Index**

- btree (contrat) — filtre inverse : qui veut du freelance

<details>
<summary><b>Notes par attribut</b> (4)</summary>

- **`fiche_talent_id`** — NOT NULL sûr : 100 % rempli dans les deux tables sources.
- **`contrat`** — cdi | freelance | entrepreneur. « Entrepreneur » est une orpheline à absorber : 20 + 17 occurrences.
- **`origine`** — Provenance déclarative. NULLABLE, contrairement à la correspondance qui la met dans la clé primaire : à la reprise on ne sait pas qui a coché.
- **`bloc_legacy`** — candidat | job_reve | fusion. Trace de quelle table du miroir vient la ligne. La correspondance mettait « origine » dans la PK en confondant ces deux notions — la provenance déclarative et le bloc source. Je les sépare, sinon la même préférence saisie aux deux endroits produirait deux lignes.

</details>
## `core.fiche_talent_critere`
Ce qui compte pour la personne dans son prochain poste. Source unique : job_reve_critere, 8 882 lignes, 32/32 valeurs utilisées, ZÉRO orpheline.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `fiche_talent_id` | `uuid` | oui | public.job_reve_critere.job_reve_id (remappé) |
| `critere_id` | `uuid` | oui | public.job_reve_critere.critere |
| `origine` | `ref.origine_valeur` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 vers core.fiche_talent ON DELETE CASCADE. · N-1 vers ref.critere ON DELETE RESTRICT.

**Contraintes** — PK (fiche_talent_id, critere_id)

**Index**

- btree (critere_id)

<details>
<summary><b>Notes par attribut</b> (1)</summary>

- **`critere_id`** — FK ref.critere ON DELETE RESTRICT. Table et non enum : les 32 libellés sont des formulations produit longues (« Confiance dans la vision fondateurs ») destinées à être réécrites. Un enum figerait la formulation marketing dans le type SQL et toute réécriture deviendrait une migration.

</details>
## `core.fiche_talent_expertise`
Les expertises de la personne. Fusionne candidat_expertise (807 lignes, déclaré au niveau du candidat) et experience_expertise (9 478 lignes, issu du bloc de qualification).

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `fiche_talent_id` | `uuid` | oui | public.candidat_expertise.candidat_id + public.experience_expertise.experience_id (remappé via experience.candidat_id) |
| `expertise_id` | `uuid` | oui | public.candidat_expertise.expertise + public.experience_expertise.expertise |
| `origine` | `ref.origine_valeur` | — | A_CREER |
| `bloc_legacy` | `text` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 vers core.fiche_talent ON DELETE CASCADE. · N-1 vers ref.expertise ON DELETE RESTRICT — on ne supprime pas une expertise portée par des fiches.

**Contraintes** — PK (fiche_talent_id, expertise_id) · CHECK (bloc_legacy IS NULL OR bloc_legacy IN ('candidat','experience','fusion'))

**Index**

- btree (expertise_id) — matching inverse : qui sait faire X

<details>
<summary><b>Notes par attribut</b> (3)</summary>

- **`fiche_talent_id`** — ⚠ le remap par experience_id perd les lignes accrochées aux 21 experience à candidat_id nul.
- **`expertise_id`** — FK ref.expertise ON DELETE RESTRICT. 31 valeurs, 2 orphelines à absorber (« UX/UI » 29, « Integrations » 20). Table et non enum : le vocabulaire est ouvert (GenAI est récent) et les libellés — C#, C++, N/A — sont hostiles à un identifiant, d'où la séparation code / libellé.
- **`bloc_legacy`** — candidat | experience | fusion. Les deux sources n'ont pas le même sens : l'une est une déclaration, l'autre un constat de qualification.

</details>
## `core.fiche_talent_poste`
AJOUT ENTIÈREMENT NOUVEAU, signalé. La liste datée des expériences professionnelles (attribut 62 de la correspondance, marqué « table fille » sans être modélisé). Le miroir ne la porte PAS : malgré son nom, public.experience est un bloc de colonnes de qualification en bijection avec le candidat, pas une liste de postes. Alimentée par le parsing de CV et par la saisie ; côté projection l'équivalent est pivot.parcours.experience, du texte libre.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `fiche_talent_id` | `uuid` | oui | A_CREER |
| `intitule` | `text` | — | A_CREER |
| `entreprise_nom` | `text` | — | A_CREER |
| `entreprise_id` | `uuid` | — | A_CREER |
| `debut_le` | `date` | — | A_CREER |
| `fin_le` | `date` | — | A_CREER |
| `en_cours` | `boolean` | oui | A_CREER |
| `description` | `text` | — | A_CREER |
| `ordre` | `integer` | — | A_CREER |
| `origine` | `ref.origine_valeur` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 vers core.fiche_talent ON DELETE CASCADE. · N-1 vers core.entreprise ON DELETE SET NULL.

**Contraintes** — CHECK (fin_le IS NULL OR debut_le IS NULL OR fin_le >= debut_le) · CHECK (NOT en_cours OR fin_le IS NULL) — un poste en cours n'a pas de date de fin · Pas de PK composite : deux postes chez le même employeur aux mêmes dates existent (temps partiel, changement d'intitulé). Clé de substitution obligatoire.

**Index**

- btree (fiche_talent_id, debut_le DESC) — la timeline, seule lecture de cette table
- btree (entreprise_id) WHERE entreprise_id IS NOT NULL — « qui est passé chez ce client »

<details>
<summary><b>Notes par attribut</b> (9)</summary>

- **`fiche_talent_id`** — FK core.fiche_talent ON DELETE CASCADE.
- **`intitule`** — NULLABLE : un parsing de CV rend parfois l'employeur sans l'intitulé.
- **`entreprise_nom`** — Texte libre, parce que la plupart des employeurs ne sont pas des clients.
- **`entreprise_id`** — FK core.entreprise ON DELETE SET NULL. Renseigné quand l'employeur est une entreprise connue — le cas que experience.entreprise_id n'a jamais su tenir (0 valeur sur 7 049).
- **`debut_le`** — date et non timestamptz : un CV donne un mois, pas une heure.
- **`fin_le`** — NULL quand le poste est en cours.
- **`en_cours`** — Explicite plutôt que déduit de fin_le IS NULL : une fin inconnue n'est pas un poste en cours.
- **`ordre`** — Ordre d'affichage quand les dates manquent ou se chevauchent.
- **`origine`** — 'import' pour une ligne issue d'un parsing de CV, 'declare' pour une saisie du talent.

</details>
## `core.fiche_talent_produit_xp`
Les types de produit sur lesquels la personne a travaillé. Source unique : experience_product, 11 350 lignes, 6/6 valeurs utilisées, 0 orpheline. C'est la table de liaison la plus volumineuse du domaine.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `fiche_talent_id` | `uuid` | oui | public.experience_product.experience_id (remappé via experience.candidat_id) |
| `type_produit` | `ref.type_produit_xp` | oui | public.experience_product.product |
| `origine` | `ref.origine_valeur` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 vers core.fiche_talent ON DELETE CASCADE.

**Contraintes** — PK (fiche_talent_id, type_produit) · La remontée au pivot est lossy : pivot.qualification.product est un text unique pour ces 11 350 lignes.

**Index**

- btree (type_produit)

<details>
<summary><b>Notes par attribut</b> (2)</summary>

- **`type_produit`** — b2b | b2c | b2b2c | marketplace | saas | api. ⚠ recouvre partiellement ref_cible et ref_product_type : trois référentiels pour un même axe sur trois entités, consolidation possible mais c'est un choix métier.
- **`origine`** — Issu du travail de qualification : l'origine sera 'recruteur' pour l'essentiel, mais inconnue à la reprise.

</details>
## `core.fiche_talent_profil`
La posture professionnelle. Fusionne candidat_profile (408 lignes) et experience_profile (5 223 lignes).

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `fiche_talent_id` | `uuid` | oui | public.candidat_profile.candidat_id + public.experience_profile.experience_id (remappé) |
| `profil` | `ref.profil_talent` | oui | public.candidat_profile.profile + public.experience_profile.profile |
| `origine` | `ref.origine_valeur` | — | A_CREER |
| `bloc_legacy` | `text` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 vers core.fiche_talent ON DELETE CASCADE.

**Contraintes** — PK (fiche_talent_id, profil) · CHECK (bloc_legacy IS NULL OR bloc_legacy IN ('candidat','experience','fusion'))

**Index**

- btree (profil)

<details>
<summary><b>Notes par attribut</b> (2)</summary>

- **`profil`** — ic | manager | entrepreneur | agence. 4 valeurs, 0 orpheline sur 5 631 lignes. ⚠ « IC »/« Manager » recoupent ref_contributor_type et « Entrepreneur » est l'orpheline de ref_contrat : collisions à trancher avant de figer l'enum.
- **`bloc_legacy`** — candidat | experience | fusion.

</details>
## `core.fiche_talent_remote_souhaite`
Le rythme de télétravail visé. Fusionne candidat_remote (1 999 lignes) et job_reve_remote (4 469 lignes).

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `fiche_talent_id` | `uuid` | oui | public.candidat_remote.candidat_id + public.job_reve_remote.job_reve_id (remappé) |
| `remote` | `ref.rythme_remote` | oui | public.candidat_remote.remote + public.job_reve_remote.remote |
| `origine` | `ref.origine_valeur` | — | A_CREER |
| `bloc_legacy` | `text` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 vers core.fiche_talent ON DELETE CASCADE.

**Contraintes** — PK (fiche_talent_id, remote) · CHECK (bloc_legacy IS NULL OR bloc_legacy IN ('candidat','job_reve','fusion'))

**Index**

- btree (remote)

<details>
<summary><b>Notes par attribut</b> (2)</summary>

- **`remote`** — hybride | full_remote_fr | full_remote_eu | full_remote_ww, plus trois codes hérités marqués inactifs : teletravail_legacy, presentiel_legacy, indifferent_legacy. Sans eux, 526 lignes seraient détruites — et les deux vocabulaires ne sont pas traduisibles l'un dans l'autre (axe présence/absence contre axe périmètre géographique).
- **`bloc_legacy`** — candidat | job_reve | fusion.

</details>
## `core.fiche_talent_secteur_nogo`
Les secteurs que la personne refuse. Source unique : job_reve_secteur_nogo, 1 803 lignes, 52/52 valeurs utilisées, 0 orpheline. Table à part et non un drapeau sur secteur_vise : un refus n'est pas l'inverse d'une préférence, il est opposable au matching.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `fiche_talent_id` | `uuid` | oui | public.job_reve_secteur_nogo.job_reve_id (remappé) |
| `secteur_id` | `uuid` | oui | public.job_reve_secteur_nogo.secteur |
| `origine` | `ref.origine_valeur` | — | A_CREER |
| `motif` | `text` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 vers core.fiche_talent ON DELETE CASCADE. · N-1 vers ref.secteur ON DELETE RESTRICT.

**Contraintes** — PK (fiche_talent_id, secteur_id)

**Index**

- btree (secteur_id) — exclusion au matching, la lecture la plus fréquente

<details>
<summary><b>Notes par attribut</b> (3)</summary>

- **`secteur_id`** — FK ref.secteur ON DELETE RESTRICT.
- **`origine`** — Le no-go est l'exemple type où la parole de la personne doit primer — et l'endroit exact où pivot.attentes ne porte aucune provenance.
- **`motif`** — AJOUT signalé, facultatif : un no-go sans motif se rediscute à chaque process.

</details>
## `core.fiche_talent_secteur_vise`
Les secteurs que la personne vise. Une seule source : job_reve_secteur, 2 846 lignes, 50 des 52 valeurs utilisées, 0 orpheline.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `fiche_talent_id` | `uuid` | oui | public.job_reve_secteur.job_reve_id (remappé via job_reve.candidat_id) |
| `secteur_id` | `uuid` | oui | public.job_reve_secteur.secteur |
| `origine` | `ref.origine_valeur` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 vers core.fiche_talent ON DELETE CASCADE. · N-1 vers ref.secteur ON DELETE RESTRICT.

**Contraintes** — PK (fiche_talent_id, secteur_id) · Aucune contrainte croisée avec secteur_nogo : un secteur à la fois visé et interdit est une incohérence de saisie réelle, à faire remonter par une vue de contrôle plutôt qu'à rejeter — la migration échouerait sinon sur des lignes existantes non mesurées.

**Index**

- btree (secteur_id) — matching mandat→talent

<details>
<summary><b>Notes par attribut</b> (2)</summary>

- **`secteur_id`** — FK ref.secteur ON DELETE RESTRICT.
- **`origine`** — Champ déclarable au sens de l'ADR : c'est la personne qui dit où elle veut aller.

</details>
## `core.fiche_talent_secteur_xp`
Les secteurs où la personne a de l'expérience. Fusionne candidat_secteur (747 lignes) et experience_secteur (10 342 lignes). Renommée depuis core.talent_secteur pour la distinguer des deux tables de secteurs visés et interdits.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `fiche_talent_id` | `uuid` | oui | public.candidat_secteur.candidat_id + public.experience_secteur.experience_id (remappé) |
| `secteur_id` | `uuid` | oui | public.candidat_secteur.secteur + public.experience_secteur.secteur |
| `origine` | `ref.origine_valeur` | — | A_CREER |
| `bloc_legacy` | `text` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 vers core.fiche_talent ON DELETE CASCADE. · N-1 vers ref.secteur ON DELETE RESTRICT.

**Contraintes** — PK (fiche_talent_id, secteur_id) · CHECK (bloc_legacy IS NULL OR bloc_legacy IN ('candidat','experience','fusion'))

**Index**

- btree (secteur_id)

<details>
<summary><b>Notes par attribut</b> (2)</summary>

- **`secteur_id`** — FK ref.secteur ON DELETE RESTRICT. 52 valeurs, ZÉRO orpheline sur 15 918 lignes consommatrices : le référentiel le plus sain du lot, il n'y a qu'à le normaliser en code + libellé.
- **`bloc_legacy`** — candidat | experience | fusion.

</details>
## `core.fiche_talent_tag`
Les tags posés par le cabinet sur une fiche. Source : candidat_tag, 86 lignes seulement.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `fiche_talent_id` | `uuid` | oui | public.candidat_tag.candidat_id |
| `tag_id` | `uuid` | oui | public.candidat_tag.tag_id |
| `pose_par_compte_id` | `uuid` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 vers core.fiche_talent ON DELETE CASCADE. · N-1 vers core.tag ON DELETE CASCADE. · N-1 vers app.compte (pose_par_compte_id) ON DELETE SET NULL.

**Contraintes** — PK (fiche_talent_id, tag_id) · Pas de colonne origine : un tag est toujours un acte du cabinet, jamais une déclaration de la personne.

**Index**

- btree (tag_id) — « tous les talents portant ce tag »

<details>
<summary><b>Notes par attribut</b> (2)</summary>

- **`tag_id`** — FK core.tag ON DELETE CASCADE — la suppression d'un tag doit retirer ses affectations, pas les bloquer. ⚠ 89 tags sur 110 sont rattachés à rien : vérifier que les 86 tag_id résolvent avant de poser la contrainte.
- **`pose_par_compte_id`** — AJOUT signalé : un tag est un acte, savoir qui l'a posé coûte une colonne.

</details>
## `core.talent`
PROJECTION du pivot, LECTURE SEULE, ~31 000 lignes. Alimentée par le connecteur pivot→app, jamais par l'application. Elle sert à CHERCHER, pas à éditer. Règle appliquée : un attribut que pivot.talent / pivot.email / pivot.phone / pivot.parcours / pivot.qualification / pivot.attentes / pivot.talent_source ne porte pas ne peut PAS y figurer.

=== PARTAGE DES 67 ATTRIBUTS DE core.talent (ordre de correspondance.json) ===
01 cle_legacy_bubble → FICHE. Provenance de public.candidat.id, donc de l'enregistrement applicatif. La projection n'a pas de passé Bubble : sa clé de rapprochement est pivot_talent_id.
02 nom → LES DEUX. Projection = nom fusionné + nom_src (le pivot le porte). Fiche = nom DÉCLARÉ + nom_origine.
03 prenom → LES DEUX. Idem, pivot.talent.prenom/prenom_src.
04 email_personnel → LES DEUX. Projection : pivot.email est multivalué → email_principal + emails[] + emails_generiques[]. Fiche : une adresse déclarée.
05 url_linkedin → LES DEUX. pivot.talent.url_linkedin existe.
06 telephone → LES DEUX. Projection : pivot.phone est multivalué → telephones[].
07 photo_url → FICHE seule. Le pivot ne porte aucune photo.
08 cv_url → LES DEUX. pivot.talent.cv_url existe ; la fiche porte le CV déposé dans l'app.
09 portfolio_fichier_url → FICHE seule. Absent du pivot (161 valeurs, 2,3 %).
10 genre → FICHE seule, et c'est délibéré : le COMMENT de pivot.qualification dit « le genre est volontairement absent (minimisation RGPD) ». L'y projeter contredirait une décision de conformité déjà prise.
11 niveau_anglais → LES DEUX. pivot.qualification.anglais. Fiche = maître (acte du cabinet).
12 univers_id → LES DEUX. pivot.qualification.univers. Fiche = maître.
13 ouvert_au_marche → PROJECTION seule. Unique attribut dans ce cas : pivot.talent.open_to est alimenté par Jarvi, alors que candidat.opento est mesuré à 0 valeur sur 7 028. Rien à migrer côté fiche ; l'équivalent déclaré côté app est recherche_active (n° 67).
14 poste_actuel_metier_id → FICHE seule. Le pivot ne porte que employeur_actuel et headline, pas le métier du poste occupé.
15 statut_relation → FICHE seule. État CRM du cabinet (3 347 valeurs). pivot.talent.statut_jarvi est un autre objet, projeté à part.
16 mindset → FICHE seule. Absent du pivot.
17 emoji_statut → FICHE seule. Appréciation du recruteur (265 valeurs), absente du pivot.
18 poste_actuel_contrat → FICHE seule. pivot.attentes.contrats porte les contrats SOUHAITÉS, pas le contrat actuel.
19 attentes_salaire_max_ke → LES DEUX. pivot.attentes.salaire_souhaite. Fiche = maître.
20 attentes_salaire_min_ke → LES DEUX. pivot.attentes.salaire_min. Fiche = maître.
21 attentes_tjm_max → LES DEUX. pivot.attentes.tjm_souhaite.
22 attentes_tjm_min → LES DEUX. pivot.attentes.tjm_min.
23 est_qualifie → FICHE seule (booléen du cabinet, 100 % rempli). Le pivot porte qualification.niveau_qualifie, un niveau textuel : projeté à part sous qualif_niveau, ce n'est pas le même attribut.
24 localisations_source_json → FICHE seule. Charge utile brute de Bubble, gardée pour la reprise. Le pivot n'en veut pas et n'en a pas besoin.
25 localisation_texte → LES DEUX. pivot.talent.localisation + localisation_src.
26 apporteur_affaires_id → FICHE seule. Attribut du cabinet (14 valeurs), absent du pivot.
27 agent_referent_id → FICHE seule. Attribut du cabinet, absent du pivot.
28 appetence_early_stage → FICHE seule. Absent du pivot.
29 grande_ecole → FICHE seule. Absent du pivot (pivot.parcours.formation est du texte libre, projeté à part).
30 portfolio_url → FICHE seule. Absent du pivot.
31 cree_le → LES DEUX, mais ce ne sont pas les mêmes dates. Projection : pivot_cree_le (pivot.talent.cree_le) + son propre cree_le. Fiche : cree_le posé par l'application + synchro_cree_le, qui est la date de SYNCHRONISATION du miroir et non la date de création Bubble.
32 maj_le_source → FICHE seule (synchro_maj_le). Date de synchronisation, sans équivalent au pivot.
33 cree_par_id → FICHE seule. Auteur de l'enregistrement applicatif.
34 fiche_complete → FICHE seule. Par définition un état de la fiche.
35 ecole → FICHE seule. Absent du pivot en tant que champ structuré.
36 debut_vie_professionnelle → FICHE seule. Absent du pivot.
37 poste_actuel_employeur → LES DEUX. pivot.talent.employeur_actuel + employeur_src.
38 poste_actuel_univers_id → FICHE seule. Le pivot ne porte qu'un univers de qualification, pas celui du poste occupé.
39 poste_actuel_raison_depart → FICHE seule. Absent du pivot.
40 attentes_metier_id → LES DEUX. pivot.attentes.metier_vise.
41 attentes_univers_id → LES DEUX. pivot.attentes.univers_vise.
42 attentes_description → LES DEUX. pivot.attentes.description.
43 attentes_disponibilite_texte → LES DEUX. pivot.attentes.disponibilite.
44 attentes_localisation_texte → FICHE seule. pivot.attentes.localisations est un tableau de lieux ; le commentaire libre du candidat n'y a pas de place.
45 attentes_infos_salaire → FICHE seule. Texte libre, sans équivalent au pivot.
46 attentes_localisations_json → FICHE seule pour le JSON brut. La projection porte attentes_localisations text[] depuis le pivot, ce n'est pas la même donnée.
47 actif → FICHE seule. Drapeau du cabinet, absent du pivot ET du miroir.
48 seniorite → LES DEUX. pivot.qualification.seniorite. Fiche = maître.
49 consentement_donne_le → FICHE seule. Le consentement est donné à l'application.
50 anonymise_le → FICHE seule aujourd'hui, et c'est un défaut : l'ADR veut que l'effacement se fasse au pivot et que la projection suive, mais le pivot n'a pas la colonne. Signalé à l'arbitrage.
51 modifie_le_source → FICHE seule. Modified Date de Bubble, absente du miroir, à récupérer par l'API avant le cut.
52 date_dernier_contact → FICHE seule. Acte du cabinet.
53 score_completude / champs_manquants → FICHE seule, éclaté en deux colonnes. Mesure la complétude de la FICHE, pas du pivot.
54 source_import / parse_par_ia_le → FICHE seule, éclaté en deux colonnes. Trace un acte d'import dans l'application.
55 resume_ia → FICHE seule. pivot.talent.notes_bloc est la consolidation LLM du journal de notes du pivot : autre objet, projeté à part.
56 fusionne_vers_id → FICHE seule, renommé fusionnee_vers_fiche_id. Au pivot la fusion s'exprime autrement : plusieurs fiches partagent un talent_id.
57 background (M2M) → LES DEUX, de façon dégradée. Fiche : table de liaison (5 218 lignes). Projection : qualif_background scalaire, parce que pivot.qualification.background est un text unique.
58 expertise (M2M) → LES DEUX. Fiche : table de liaison (807 + 9 478 lignes). Projection : qualif_expertises text[] (le pivot les porte en tableau).
59 product (M2M) → LES DEUX, dégradé. Fiche : liaison (11 350 lignes). Projection : qualif_produit scalaire (pivot.qualification.product est un text unique).
60 profile (M2M) → LES DEUX, dégradé. Fiche : liaison (408 + 5 223). Projection : qualif_profil scalaire.
61 secteur (M2M) → LES DEUX. Fiche : liaison secteurs d'expérience (747 + 10 342). Projection : qualif_secteurs text[].
62 postes (liste d'expériences datées) → FICHE, sous forme de table fille core.fiche_talent_poste (à créer). La projection n'a que pivot.parcours.experience, du texte libre : projeté tel quel en parcours_experience.
63 contrat_actuel → FICHE. Doublon de l'attribut 18, fusionné avec lui.
64 depuis_le → FICHE seule (poste_actuel_depuis_le). Absent du pivot.
65 modifie_par_le_talent_le → FICHE seule. Trace un acte dans l'application.
66 confirme_sans_changement_le → FICHE seule. Idem.
67 recherche_active → FICHE seule. Déclaration faite dans l'application ; l'équivalent côté sourcing est open_to, projeté.

BILAN : 1 attribut projection seule, 19 aux deux, 47 fiche seule (+ le 68e, employeur_actuel_entreprise_id, fiche seule).

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `pivot_talent_id` | `text` | oui | pivot.talent.talent_id |
| `type_fusion` | `text` | oui | pivot.talent.type_fusion |
| `prenom` | `text` | — | pivot.talent.prenom |
| `prenom_src` | `text` | — | pivot.talent.prenom_src |
| `nom` | `text` | — | pivot.talent.nom |
| `nom_src` | `text` | — | pivot.talent.nom_src |
| `headline` | `text` | — | pivot.talent.headline |
| `localisation` | `text` | — | pivot.talent.localisation |
| `localisation_src` | `text` | — | pivot.talent.localisation_src |
| `url_linkedin` | `text` | — | pivot.talent.url_linkedin |
| `open_to` | `text` | — | pivot.talent.open_to |
| `employeur_actuel` | `text` | — | pivot.talent.employeur_actuel |
| `employeur_src` | `text` | — | pivot.talent.employeur_src |
| `statut_jarvi` | `text` | — | pivot.talent.statut_jarvi |
| `origine_jarvi` | `text` | — | pivot.talent.origine_jarvi |
| `cv_url` | `text` | — | pivot.talent.cv_url |
| `notes_jarvi` | `text` | — | pivot.talent.notes_jarvi |
| `notes_bloc` | `text` | — | pivot.talent.notes_bloc |
| `email_principal` | `text` | — | pivot.email (première adresse non générique) |
| `emails` | `text[]` | — | pivot.email.email WHERE generique = false |
| `emails_generiques` | `text[]` | — | pivot.email.email WHERE generique = true |
| `telephones` | `text[]` | — | pivot.phone.tel |
| `parcours_experience` | `text` | — | pivot.parcours.experience |
| `parcours_formation` | `text` | — | pivot.parcours.formation |
| `parcours_competences` | `text` | — | pivot.parcours.competences |
| `qualif_niveau` | `text` | — | pivot.qualification.niveau_qualifie |
| `qualif_univers` | `text` | — | pivot.qualification.univers |
| `qualif_anglais` | `text` | — | pivot.qualification.anglais |
| `qualif_seniorite` | `text` | — | pivot.qualification.seniorite |
| `qualif_profil` | `text` | — | pivot.qualification.profil |
| `qualif_background` | `text` | — | pivot.qualification.background |
| `qualif_produit` | `text` | — | pivot.qualification.product |
| `qualif_expertises` | `text[]` | — | pivot.qualification.expertises |
| `qualif_secteurs` | `text[]` | — | pivot.qualification.secteurs |
| `attentes_metier_vise` | `text` | — | pivot.attentes.metier_vise |
| `attentes_univers_vise` | `text` | — | pivot.attentes.univers_vise |
| `attentes_contrats` | `text[]` | — | pivot.attentes.contrats |
| `attentes_remotes` | `text[]` | — | pivot.attentes.remotes |
| `attentes_localisations` | `text[]` | — | pivot.attentes.localisations |
| `attentes_secteurs` | `text[]` | — | pivot.attentes.secteurs |
| `attentes_nogo` | `text` | — | pivot.attentes.nogo |
| `attentes_salaire_min_ke` | `numeric` | — | pivot.attentes.salaire_min |
| `attentes_salaire_souhaite_ke` | `numeric` | — | pivot.attentes.salaire_souhaite |
| `attentes_tjm_min` | `numeric` | — | pivot.attentes.tjm_min |
| `attentes_tjm_souhaite` | `numeric` | — | pivot.attentes.tjm_souhaite |
| `attentes_disponibilite` | `text` | — | pivot.attentes.disponibilite |
| `attentes_description` | `text` | — | pivot.attentes.description |
| `recherche` | `tsvector` | — | A_CREER |
| `pivot_cree_le` | `timestamptz` | — | pivot.talent.cree_le |
| `projete_le` | `timestamptz` | oui | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — 1-N vers core.fiche_talent (talent_id) — SANS unicité : 374 talents portent plusieurs fiches, issues de la fusion de 769 candidats. · 1-N vers core.candidature, core.placement, core.note : le talent s'accroche à la candidature, qui EST la rencontre. · N-1 vers rien : la projection ne référence aucune autre entité, c'est ce qui la rend reconstructible. · AUCUNE clé étrangère vers pivot. Même raisonnement que l'interdiction des FK vers public : le pivot est réécrit par ses connecteurs, une CASCADE détruirait la projection et un RESTRICT bloquerait le connecteur. La cohérence est rendue visible par core.v_talent_orphelin_pivot. · Aucune FK entrante en CASCADE ne doit exister depuis core : un rafraîchissement de projection ne doit jamais pouvoir supprimer une fiche.

**Contraintes** — CHECK (type_fusion IN ('merged','jarvi_only','app_only')) — reprend la contrainte du pivot · CHECK (prenom_src IS NULL OR prenom_src IN ('jarvi','app')), idem nom_src, localisation_src, employeur_src · CHECK (attentes_salaire_min_ke IS NULL OR attentes_salaire_min_ke >= 0), idem salaire_souhaite, tjm_min, tjm_souhaite · LECTURE SEULE : REVOKE INSERT, UPDATE, DELETE ON core.talent FROM le rôle applicatif ; GRANT au seul rôle du connecteur ; trigger BEFORE INSERT/UPDATE/DELETE levant une exception si current_user n'est pas le connecteur. La règle « core.talent ne s'écrit jamais depuis l'application » doit être tenue par la base, pas par la discipline. · PAS de CHECK d'appartenance des codes aux référentiels : la projection reçoit ce que le pivot contient. Les écarts sont listés, pas rejetés — un rejet ferait échouer le connecteur sur une donnée qu'il ne maîtrise pas.


---

# Le mandat et la candidature

**Index**

- UNIQUE (pivot_talent_id) — clé de rapprochement, et garantie d'idempotence du connecteur
- GIN (recherche) — recherche plein texte du poste recruteur
- GIN (qualif_expertises), GIN (qualif_secteurs), GIN (attentes_contrats), GIN (attentes_remotes), GIN (attentes_localisations), GIN (attentes_secteurs) — filtres de matching
- GIN (emails) — réconciliation par e-mail, seule clé disponible pour rattacher un compte
- btree (lower(unaccent(nom))) et btree (lower(unaccent(prenom))) — remplacent nom_lower / prenom_lower abandonnées
- btree (type_fusion) — isoler les app_only, qui sont les personnes que Jarvi ne connaît pas
- btree (employeur_actuel) — recherche par employeur
- btree (projete_le) — supervision du connecteur

<details>
<summary><b>Notes par attribut</b> (51)</summary>

- **`id`** — Clé primaire applicative. Aucune donnée métier ne s'y accroche : elle peut être régénérée si la projection est reconstruite, à condition de passer par pivot_talent_id.
- **`pivot_talent_id`** — Seule clé de rapprochement avec le pivot. NOT NULL est sûr : chaque ligne est créée par le connecteur à partir d'une ligne du pivot, il n'existe pas de projection sans source. Ce n'est PAS un bubble_id — la projection n'a aucune provenance Bubble. Pas de clé étrangère vers pivot : le pivot est reconstruit par les connecteurs, exactement le raisonnement qui interdit les FK vers public.
- **`type_fusion`** — merged | jarvi_only | app_only. NOT NULL au pivot, donc NOT NULL ici. Dit d'où vient la personne : app_only signifie qu'aucune donnée Jarvi ne la couvre.
- **`prenom`** — Identité fusionnée. Ce n'est pas la même valeur que fiche_talent.prenom : ici c'est ce que la préséance a retenu.
- **`prenom_src`** — jarvi | app. Une des quatre seules provenances que le pivot sait produire.
- **`nom_src`** — jarvi | app.
- **`headline`** — AJOUT signalé : n'existe pas dans la correspondance des 67, mais le pivot le porte et c'est la ligne d'accroche affichée en résultat de recherche.
- **`localisation`** — Correspond à l'attribut 25 localisation_texte, alimenté au pivot depuis localisations_filtre et non depuis le JSON.
- **`localisation_src`** — jarvi | app.
- **`open_to`** — Attribut 13. Le SEUL des 67 qui va à la projection et pas à la fiche : candidat.opento est mesuré à 0 valeur sur 7 028, la donnée vient de Jarvi.
- **`employeur_actuel`** — Attribut 37.
- **`employeur_src`** — jarvi | app. C'est le champ dont app_pivot.py:28 fait gagner Jarvi — contradiction relevée par l'ADR, renvoyée au moteur d'inclusion.
- **`statut_jarvi`** — AJOUT signalé. À ne pas confondre avec fiche_talent.statut_relation, qui est l'état CRM du cabinet.
- **`origine_jarvi`** — AJOUT signalé : par quelle voie Jarvi a sourcé la personne.
- **`cv_url`** — Attribut 8, côté projection.
- **`notes_jarvi`** — AJOUT signalé. Données Jarvi : à ne PAS exposer dans la vue api destinée au portail talent — c'est exactement la propriété que la séparation projection/fiche préserve.
- **`notes_bloc`** — AJOUT signalé : consolidation LLM du journal de notes du pivot. Distinct de fiche_talent.resume_ia (résumé de CV).
- **`email_principal`** — Attribut 4 côté projection. Dérivé : pivot.email est multivalué avec un drapeau generique.
- **`emails`** — Tableau plutôt que table fille : la projection est en lecture seule et la recherche veut une ligne plate. Index GIN.
- **`emails_generiques`** — Séparés parce que le pivot les exclut délibérément des clés d'union : les mélanger réintroduirait le risque de fusion de deux personnes.
- **`telephones`** — Attribut 6 côté projection.
- **`parcours_experience`** — Attribut 62 côté projection : texte libre. La version structurée vit dans core.fiche_talent_poste.
- **`parcours_formation`** — Voisin de l'attribut 35 (ecole) sans en être l'équivalent : texte libre, non normalisé.
- **`parcours_competences`** — AJOUT signalé.
- **`qualif_niveau`** — AJOUT signalé. Niveau textuel de qualification ; distinct du booléen est_qualifie de la fiche (attribut 23).
- **`qualif_univers`** — Attribut 12 côté projection. Code d'univers en texte : la projection ne pose pas de FK vers ref.univers, la vue de contrôle signale les codes inconnus.
- **`qualif_anglais`** — Attribut 11 côté projection.
- **`qualif_seniorite`** — Attribut 48 côté projection.
- **`qualif_profil`** — Attribut 60, DÉGRADÉ : scalaire au pivot alors que l'app porte 5 631 lignes multivaluées. La projection ne peut pas être plus riche que sa source.
- **`qualif_background`** — Attribut 57, DÉGRADÉ de la même façon (5 218 lignes côté app).
- **`qualif_produit`** — Attribut 59, DÉGRADÉ (11 350 lignes côté app).
- **`qualif_expertises`** — Attribut 58. Le pivot le porte déjà en tableau : projection fidèle. Index GIN.
- **`qualif_secteurs`** — Attribut 61. Index GIN.
- **`attentes_metier_vise`** — Attribut 40.
- **`attentes_univers_vise`** — Attribut 41.
- **`attentes_contrats`** — Contrepartie projetée de core.fiche_talent_contrat_souhaite.
- **`attentes_remotes`** — Contrepartie projetée de core.fiche_talent_remote_souhaite.
- **`attentes_localisations`** — Attribut 46 côté projection : liste normalisée, pas le JSON brut de Bubble.
- **`attentes_secteurs`** — Contrepartie projetée de core.fiche_talent_secteur_vise.
- **`attentes_nogo`** — DÉGRADÉ : text unique au pivot, alors que job_reve_secteur_nogo porte 1 803 lignes. Le no-go du candidat est mal représenté au pivot — point d'arbitrage.
- **`attentes_salaire_min_ke`** — En K€ (3 264 valeurs harmonisées €→K€ en amont). Attribut 20.
- **`attentes_salaire_souhaite_ke`** — En K€. Attribut 19. Nom repris du pivot — « souhaité » n'est pas prouvé être « maximum », voir arbitrage.
- **`attentes_tjm_min`** — En euros par jour. Attribut 22.
- **`attentes_tjm_souhaite`** — En euros par jour. Attribut 21.
- **`attentes_disponibilite`** — Attribut 43. Reste du texte : le pivot ne le date pas.
- **`attentes_description`** — Attribut 42.
- **`recherche`** — GENERATED ALWAYS AS (to_tsvector('french', unaccent(coalesce(prenom,'')||' '||coalesce(nom,'')||' '||coalesce(headline,'')||' '||coalesce(employeur_actuel,'')||' '||coalesce(localisation,'')))) STORED. Raison d'être de la projection : fouiller 31 000 personnes sans taper dans une autre base à chaque frappe.
- **`pivot_cree_le`** — Date de création de l'enregistrement doré, pas de la personne.
- **`projete_le`** — Dernier passage du connecteur sur cette ligne. Permet de détecter une projection qui décroche sans interroger le pivot.
- **`cree_le`** — Convention. Posé par le connecteur, qui est ici l'application.
- **`maj_le`** — Convention, maintenu par trigger.

</details>
## `app.mandat_publication`
L'ACTE de publication. Un mandat est publié parce qu'une ligne existe ici et que retire_le est nul — plus jamais parce que quatre drapeaux s'alignent. Corrige le défaut Partie D : 24 combinaisons de job_anonyme × job_off_market × statut × visibilite sur 534 mandats, dont 4 à la fois publics et hors marché et 15 publics mais clos.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `mandat_id` | `uuid` | oui | A_CREER |
| `canal` | `canal_publication` | oui | A_CREER |
| `libelle_public` | `text` | — | A_CREER |
| `salaire_affiche` | `text` | — | A_CREER |
| `mode_de_travail_affiche` | `text` | — | A_CREER |
| `publie_le` | `timestamptz` | oui | A_CREER |
| `publie_par_compte_id` | `uuid` | — | A_CREER |
| `retire_le` | `timestamptz` | — | A_CREER |
| `retire_par_compte_id` | `uuid` | — | A_CREER |
| `motif_retrait` | `text` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 → core.mandat ON DELETE RESTRICT — la publication porte de la saisie manuelle qu'un CASCADE détruirait ; on dépublie avant de supprimer · N-1 → app.compte x2 (publie_par, retire_par) ON DELETE SET NULL

**Contraintes** — CHECK (retire_le IS NULL OR retire_le >= publie_le) · À poser en règle applicative, pas en CHECK (elle traverse deux tables) : un mandat confidentiel ou de statut 'termine'/'close_pachamama' ne peut pas recevoir une publication active. C'est exactement l'arbitrage que les 15 mandats publics mais clos rendaient impossible.

**Index**

- UNIQUE (mandat_id, canal) WHERE retire_le IS NULL — interdit structurellement deux publications actives sur le même canal
- (publie_le DESC) WHERE retire_le IS NULL — le tri par fraîcheur du job board
- (mandat_id)

<details>
<summary><b>Notes par attribut</b> (9)</summary>

- **`mandat_id`** — FK core.mandat. Écart assumé avec correspondance.json qui prévoyait « text -> public.mandat.id, référence NON contrainte » : l'interdit de la Décision 1 vise le miroir réécrit par la synchro, pas core, que l'application possède. La clé étrangère est donc posable et obligatoire.
- **`canal`** — enum ('job_board_public','espace_talent'). Remplace la lecture de visibilite : 35 mandats 'public' → job_board_public, 2 'talent_only' → espace_talent, 496 'private' → aucune ligne.
- **`libelle_public`** — Le titre tel qu'il paraît. Vit ici et non sur le mandat : c'est la formulation publique d'un acte, pas un fait de la mission. correspondance.json le posait aux deux endroits — doublon supprimé.
- **`salaire_affiche`** — Fourchette rédigée pour l'annonce, distincte de salaire_min_ke/salaire_max_ke qui restent les faits
- **`mode_de_travail_affiche`** — Formulation publique, distincte du multivalué core.mandat_remote
- **`publie_le`** — Tri par fraîcheur du job board. Aucune valeur à migrer : le miroir ne porte pas de date de mise en ligne.
- **`publie_par_compte_id`** — FK app.compte. Nul si publication automatique.
- **`retire_le`** — Nul = publication active. C'est cette colonne, et elle seule, qui répond « ce mandat est-il en ligne ? »
- **`retire_par_compte_id`** — FK app.compte

</details>
## `app.transition_etape`
L'historique des changements d'étape d'une candidature. Entité neuve, et nécessaire ici : les deux colonnes du miroir censées porter ces dates (process.date_statut_applicant et date_statut_ko) sont mesurées à 0 %, donc aucune durée par étape n'est calculable aujourd'hui.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `candidature_id` | `uuid` | oui | A_CREER |
| `etape_avant_id` | `uuid` | — | A_CREER |
| `etape_apres_id` | `uuid` | oui | A_CREER |
| `survenue_le` | `timestamptz` | oui | A_CREER |
| `origine` | `origine_transition` | oui | A_CREER |
| `auteur_compte_id` | `uuid` | — | A_CREER |
| `motif_ko_code` | `text` | — | A_CREER |
| `commentaire` | `text` | — | A_CREER |

**Relations** — N-1 → core.candidature ON DELETE CASCADE — la trace suit la candidature, y compris à l'effacement · N-1 → ref.etape_process x2 ON DELETE RESTRICT · N-1 → app.compte ON DELETE SET NULL · N-1 → ref.motif_ko ON DELETE RESTRICT · duree_etape_precedente_jours n'est PAS une colonne : elle se calcule par fonction de fenêtre dans la vue api. Écart signalé avec correspondance.json.

**Contraintes** — CHECK (etape_avant_id IS DISTINCT FROM etape_apres_id) — une transition change d'étape · CHECK (origine <> 'automatique' OR auteur_compte_id IS NULL) · Aucune reprise depuis le miroir : la table naît vide, l'historique antérieur est définitivement perdu.

**Index**

- (candidature_id, survenue_le DESC)
- (etape_apres_id, survenue_le) — analytics du funnel
- (survenue_le) — métriques de période

<details>
<summary><b>Notes par attribut</b> (6)</summary>

- **`candidature_id`** — FK core.candidature — et non « text -> process.id » comme dans correspondance.json : la cible est core, pas le miroir, donc la clé étrangère est posable.
- **`etape_avant_id`** — FK ref.etape_process. Nul à la première entrée dans le pipeline.
- **`etape_apres_id`** — FK ref.etape_process. Un code stable, jamais le libellé « 🙅🏻‍♀️ KO by Pachamama ».
- **`origine`** — enum ('app','ats','client','talent','import','automatique') — observabilité du dual-write pendant la transition
- **`auteur_compte_id`** — FK app.compte. Nul si origine='automatique'.
- **`motif_ko_code`** — FK ref.motif_ko(code) — le motif se saisit AU MOMENT de la transition ; core.candidature.motif_ko_code n'en est que l'état courant

</details>
## `core.analyse`
L'ex public.analyse (501 lignes) : une appréciation datée portée sur un mandat, avec un niveau d'alerte. Jusqu'à 9 analyses par mandat.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `bubble_id` | `text` | — | public.analyse.id |
| `mandat_id` | `uuid` | — | public.analyse.mandat_id |
| `contenu` | `text` | oui | public.analyse.description |
| `niveau` | `niveau_analyse` | — | public.analyse.niveau |
| `auteur_id` | `uuid` | — | public.analyse.created_by |
| `cree_le` | `timestamptz` | oui | public.analyse.created_at |
| `maj_le` | `timestamptz` | oui | public.analyse.updated_at |

**Relations** — N-1 → core.mandat ON DELETE CASCADE — 0 orphelin, contrainte posable ; les 20 analyses sans mandat restent avec mandat_id nul · N-1 → core.utilisateur (auteur_id) ON DELETE SET NULL · ABANDONNÉ : public.mandat_analyse (duplicata exact de analyse.mandat_id, 481 = 481, analyse_id unique — ce n'est pas un M2M) et slug (0 %)

**Contraintes** — Aucun CHECK : les 3 valeurs du niveau sont portées par l'enum, le contenu par le NOT NULL.

**Index**

- UNIQUE (bubble_id) WHERE bubble_id IS NOT NULL
- (mandat_id, cree_le DESC) — le fil d'analyses d'un mandat
- (niveau) WHERE niveau = 'vigilance' — les 10 alertes à voir

<details>
<summary><b>Notes par attribut</b> (6)</summary>

- **`bubble_id`** — UNIQUE, NULLABLE. correspondance.json le déclarait obligatoire — corrigé.
- **`mandat_id`** — 481/501, 0 orphelin : 20 analyses sans mandat. NULLABLE.
- **`contenu`** — 501/501 renseignés. NOT NULL sûr et juste : une analyse vide n'est pas une analyse.
- **`niveau`** — enum ('bien','moyen','vigilance'). 500/501 (Bien 402, Moyen 88, Vigilance 10) — 1 ligne sans niveau interdit le NOT NULL. La couleur du miroir (#008000/#FF8C00/#CD5C5C) va dans ref.libelle.
- **`auteur_id`** — FK core.utilisateur. 100 % renseigné, laissé NULLABLE pour l'analyse générée automatiquement. Rend inutile l'attribut A_CREER « auteur / date » de correspondance.json, qui doublonnait auteur_id et cree_le.
- **`cree_le`** — La date de l'analyse. 100 %

</details>
## `core.candidature`
La rencontre entre un talent et un mandat — l'entité, pas le trait. Cible de migration 1 pour 1 de public.process (7 243 lignes). 1,74 candidature par talent jusqu'à 26, 15,3 par mandat jusqu'à 240.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `bubble_id` | `text` | — | public.process.id |
| `fiche_talent_id` | `uuid` | — | public.process.candidat_id |
| `talent_id` | `uuid` | — | public.process.candidat_id |
| `mandat_id` | `uuid` | — | public.process.mandat_id |
| `entreprise_id` | `uuid` | — | public.process.entreprise_id |
| `etape_id` | `uuid` | — | public.process.etape |
| `compte_rendu` | `text` | — | public.process.description |
| `appreciation_like` | `text` | — | public.process.pachamama_like |
| `appreciation_personnalite` | `text` | — | public.process.pachamama_personnalite |
| `points_forts` | `text` | — | public.process.plus_par_rapport_mission |
| `points_faibles` | `text` | — | public.process.moins_par_rapport_mission |
| `infos_remuneration` | `text` | — | public.process.infos_remuneration |
| `salaire_min_ke` | `numeric(12,2)` | — | public.process.salaire_minimum |
| `salaire_souhaite_ke` | `numeric(12,2)` | — | public.process.salaire_souhaite |
| `tjm_min` | `numeric(12,2)` | — | public.process.tjm_minimum |
| `tjm_souhaite` | `numeric(12,2)` | — | public.process.tjm_souhaite |
| `date_entree_pipeline` | `timestamptz` | — | public.process.date_statut_applicant |
| `date_ko` | `timestamptz` | — | public.process.date_statut_ko |
| `date_dernier_changement_etape` | `timestamptz` | — | public.process.date_update_etape |
| `date_prochaine_echeance` | `timestamptz` | — | public.process.next_step_date |
| `reference_pseudonyme` | `text` | — | A_CREER |
| `motif_ko_code` | `text` | — | A_CREER |
| `motif_ko_commentaire` | `text` | — | A_CREER |
| `argumentaire_client` | `text` | — | A_CREER |
| `retire_par_talent_le` | `timestamptz` | — | A_CREER |
| `motif_retrait` | `text` | — | A_CREER |
| `feedback_fin_process` | `jsonb` | — | A_CREER |
| `est_spontanee` | `boolean` | oui | A_CREER |
| `cree_par_id` | `uuid` | — | public.process.created_by |
| `cree_le` | `timestamptz` | oui | public.process.created_at |
| `maj_le` | `timestamptz` | oui | public.process.updated_at |

**Relations** — N-1 → core.fiche_talent (fiche_talent_id) ON DELETE SET NULL — et NON cascade : l'effacement d'une fiche ne doit pas emporter l'historique commercial et les commissions qui en dépendent. L'anonymisation des champs de texte libre est un acte distinct. · N-1 → core.talent (talent_id) ON DELETE SET NULL — core.talent est une projection rafraîchie ; une disparition côté pivot ne doit rien bloquer · N-1 → core.mandat ON DELETE RESTRICT · N-1 → core.entreprise ON DELETE SET NULL · N-1 → ref.etape_process ON DELETE RESTRICT · N-1 → ref.motif_ko ON DELETE RESTRICT · 1-N → core.placement — quasi 1 pour 1 (226 non nuls, 224 distincts) : NE PAS poser d'unicité, 2 candidatures partagent un placement · 1-N → app.transition_etape (historique des étapes)

**Contraintes** — PAS d'UNIQUE (talent_id, mandat_id) : la mesure ne l'autorise pas et 7 couples de candidat_mandat n'existent pas dans process. Prévoir à la place une vue de contrôle des doublons de couple. · CHECK (date_ko IS NULL OR date_dernier_changement_etape IS NULL OR date_ko >= cree_le) — À MESURER avant de poser · CHECK (NOT est_spontanee OR mandat_id IS NULL) — À ARBITRER : une candidature spontanée peut être rattachée à un mandat après coup, auquel cause la contrainte est fausse · CHECK sur la cohérence motif_ko_code / étape KO : à porter en règle applicative, elle dépend du drapeau is_ko du référentiel

**Relations — complément restauré** — 1-N → app.decision_client (domaine portail client, hors périmètre ici) · age_dans_etape_jours n'est PAS une colonne : c'est now() - date_dernier_changement_etape, calculé dans la vue api. Écart signalé avec correspondance.json.

**Index**

- UNIQUE (bubble_id) WHERE bubble_id IS NOT NULL
- UNIQUE (reference_pseudonyme) WHERE reference_pseudonyme IS NOT NULL
- (mandat_id, etape_id) — le kanban d'un mandat, jusqu'à 240 candidatures
- (date_dernier_changement_etape) WHERE date_ko IS NULL — détection des candidatures bloquées (aging/SLA)
- (motif_ko_code) WHERE motif_ko_code IS NOT NULL — analytics du funnel
- (entreprise_id)

<details>
<summary><b>Notes par attribut</b> (28)</summary>

- **`bubble_id`** — UNIQUE, NULLABLE. correspondance.json le déclarait obligatoire — corrigé.
- **`fiche_talent_id`** — AJOUT signalé, et c'est la vraie cible de migration : process.candidat_id désigne un public.candidat, qui migre 1 pour 1 vers core.fiche_talent. Le router vers core.talent obligerait à passer par pivot.talent_source et perdrait la précision là où 374 talents sont nés de la fusion de plusieurs candidats.
- **`talent_id`** — Dérivé via la correspondance pivot (talent_source, source='app'). NULLABLE : 19 process sans candidat, plus tous ceux dont le pivot n'a pas encore établi le lien. correspondance.json le déclarait obligatoire — corrigé, c'est le défaut nommé en Partie D.
- **`mandat_id`** — NULLABLE : 20 process sans mandat mesurés, et c'est aussi ce qui rend la candidature spontanée exprimable. correspondance.json le déclarait obligatoire — corrigé.
- **`entreprise_id`** — 20 nuls. Dénormalisation : atteignable par mandat_id → mandat.entreprise_id. Conservée pour ne rien perdre sur les 20 lignes sans mandat ; à arbitrer.
- **`etape_id`** — FK ref.etape_process. 7 213/7 243 renseignés : 30 lignes sans étape interdisent le NOT NULL — correspondance.json le déclarait obligatoire, corrigé. Le miroir stocke le LIBELLÉ « 🙅🏻‍♀️ KO by Pachamama » comme valeur : le code devient ko_pachamama (4 302 lignes), le libellé et l'emoji restent dans le référentiel.
- **`compte_rendu`** — Mesurée à 0 % sur 7 243 lignes. Rien à migrer.
- **`appreciation_like`** — 22,6 %. Donnée personnelle : entre dans le périmètre d'effacement et d'anonymisation.
- **`appreciation_personnalite`** — 49,5 %. Donnée personnelle.
- **`points_forts`** — 41,7 %
- **`points_faibles`** — Mesurée à 0 %. C'est la colonne qu'une analyse antérieure croyait porter 6 274 motifs de KO : elle est vide. Conservée pour l'usage à venir.
- **`infos_remuneration`** — 30,7 %
- **`salaire_min_ke`** — En K€ annuels bruts. 84 % — la colonne la mieux remplie du bloc.
- **`salaire_souhaite_ke`** — En K€ annuels bruts. 72,3 %. Ici le couple minimum/souhaité est explicite dans le miroir, contrairement à job_reve où il reste à mesurer.
- **`tjm_min`** — En € HT/jour. 26 %
- **`tjm_souhaite`** — En € HT/jour. 23,5 %
- **`date_entree_pipeline`** — Mesurée à 0 %. La colonne existe, la donnée n'existe pas : le funnel historique n'est pas reconstituable, il se construira par app.transition_etape.
- **`date_ko`** — Mesurée à 0 %, alors que 87 % des candidatures finissent par un KO. Même constat.
- **`date_dernier_changement_etape`** — 79,7 % — la seule date d'étape réellement peuplée, base du calcul d'aging
- **`date_prochaine_echeance`** — 6,4 %
- **`reference_pseudonyme`** — Référence stable et partageable d'une candidature présentée au client, sans nommer la personne. UNIQUE.
- **`motif_ko_code`** — FK ref.motif_ko(code). À CRÉER, pas à migrer : 6 287 candidatures sur 7 243 finissent par un KO et aucune colonne du miroir n'en donne le motif.
- **`motif_ko_commentaire`** — Texte libre en complément du code, jamais à sa place
- **`argumentaire_client`** — Ce que Pachamama écrit au client sur ce candidat, distinct des appréciations internes
- **`retire_par_talent_le`** — Scission de l'attribut composite de correspondance.json
- **`motif_retrait`** — Désistement à l'initiative du talent — distinct d'un KO
- **`est_spontanee`** — Rendue possible par le passage de mandat_id en NULLABLE. Le cible antérieur prévoyait l'attribut tout en interdisant le cas.
- **`cree_par_id`** — FK core.utilisateur. 99,9 %

</details>
## `core.mandat`
La mission confiée par un client. Cible de migration 1 pour 1 de public.mandat (534 lignes). Porte les faits de la mission ; la mise en ligne n'est plus un état du mandat mais un acte enregistré dans app.mandat_publication.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `bubble_id` | `text` | — | public.mandat.id |
| `titre` | `text` | — | public.mandat.titre |
| `description` | `text` | — | public.mandat.description |
| `description_manager` | `text` | — | public.mandat.description_manager |
| `description_produit` | `text` | — | public.mandat.description_produit |
| `missions` | `text` | — | public.mandat.missions |
| `process_recrutement` | `text` | — | public.mandat.process_recrutement |
| `pour_toi` | `text` | — | public.mandat.pour_toi |
| `pas_pour_toi` | `text` | — | public.mandat.pas_pour_toi |
| `remote_infos` | `text` | — | public.mandat.remote_infos |
| `salaire_infos` | `text` | — | public.mandat.salaire_infos |
| `format_mission` | `text` | — | public.mandat.format_mission |
| `duree_mission` | `text` | — | public.mandat.duree_mission |
| `date_demarrage_souhaitee` | `date` | — | public.mandat.date_demarrage_mission |
| `video_youtube` | `text` | — | public.mandat.video_youtube |
| `salaire_min_ke` | `numeric(12,2)` | — | public.mandat.salaire_min |
| `salaire_max_ke` | `numeric(12,2)` | — | public.mandat.salaire_max |
| `tjm_min` | `numeric(12,2)` | — | public.mandat.tjm_min |
| `tjm_max` | `numeric(12,2)` | — | public.mandat.tjm_max |
| `experience_min_annees` | `smallint` | — | public.mandat.min_xp |
| `scorecard_delivery` | `smallint` | — | public.mandat.delivery |
| `scorecard_discovery` | `smallint` | — | public.mandat.discovery |
| `scorecard_strategie` | `smallint` | — | public.mandat.strategie |
| `scorecard_ops` | `smallint` | — | public.mandat.ops |
| `scorecard_management` | `smallint` | — | public.mandat.management |
| `kickoff_le` | `timestamptz` | — | public.mandat.kickoff |
| `est_anonyme` | `boolean` | oui | public.mandat.job_anonyme |
| `est_hors_marche` | `boolean` | oui | public.mandat.job_off_market |
| `visibilite` | `visibilite_mandat` | — | public.mandat.visibilite |
| `statut` | `statut_mandat` | — | public.mandat.statut |
| `mandat_origine_id` | `uuid` | — | A_CREER |
| `mis_en_pause_le` | `timestamptz` | — | A_CREER |
| `equity` | `equity_mandat` | — | public.mandat.equity |
| `type_contributeur` | `type_contributeur` | — | public.mandat.contributor_type |
| `contrat` | `type_contrat` | — | public.mandat.contrat |
| `exclusivite_pachamama` | `boolean` | — | public.mandat.exclu_pachamama |
| `type_deal` | `type_deal` | — | public.mandat.type_deal |
| `source_marketing` | `source_marketing` | — | public.mandat.source_marketing |
| `type_apporteur` | `type_apporteur` | — | public.mandat.lead_apporteur |
| `univers_id` | `uuid` | — | public.mandat.univers |
| `metier_id` | `uuid` | — | public.mandat.metier |
| `entreprise_id` | `uuid` | — | public.mandat.entreprise_id |
| `contact_manager_id` | `uuid` | — | public.mandat.manager_id |
| `contact_recruteur_id` | `uuid` | — | public.mandat.recruteur_id |
| `agent_en_charge_id` | `uuid` | — | public.mandat.personne_en_charge_id |
| `agent_2_id` | `uuid` | — | public.mandat.agent_2_id |
| `account_manager_id` | `uuid` | — | public.mandat.account_manager_id |
| `localisation` | `text` | — | A_CREER |
| `departement` | `text` | — | A_CREER |
| `stack` | `text[]` | — | A_CREER |
| `presentation_equipe` | `text` | — | A_CREER |
| `contexte_equipe` | `text` | — | A_CREER |
| `raison_du_recrutement` | `text` | — | A_CREER |
| `confidentiel` | `boolean` | oui | A_CREER |
| `must_have` | `jsonb` | — | A_CREER |
| `nice_to_have` | `jsonb` | — | A_CREER |
| `cloture_demandee_le` | `timestamptz` | — | A_CREER |
| `cloture_demandee_par_compte_id` | `uuid` | — | A_CREER |
| `valide_par_am_le` | `timestamptz` | — | A_CREER |
| `cree_par_id` | `uuid` | — | public.mandat.created_by |
| `cree_le` | `timestamptz` | oui | public.mandat.created_at |
| `maj_le` | `timestamptz` | oui | public.mandat.updated_at |

**Relations** — N-1 → core.entreprise (entreprise_id) ON DELETE RESTRICT — 0 orphelin, contrainte posable ; 1 mandat sans entreprise · N-1 → core.contact_client x2 (contact_manager_id, contact_recruteur_id) ON DELETE SET NULL — 0 orphelin · N-1 → core.utilisateur x4 (agent_en_charge_id, agent_2_id, account_manager_id, cree_par_id) ON DELETE SET NULL — 0 orphelin sur les trois premiers · N-1 réflexive → core.mandat (mandat_origine_id) ON DELETE SET NULL — la « reprise » · N-1 → ref.univers (univers_id) et ref.metier (metier_id) ON DELETE RESTRICT · 1-N → core.candidature, core.placement, core.analyse, core.note, core.tag · 1-N → app.mandat_publication (plusieurs actes de publication successifs, un seul actif par canal) · N-N → core.contact_client via core.mandat_contact_client (max 3 contacts par mandat, max 4 mandats par contact) — vraie liaison, le seul repli qui détruirait de la donnée

**Contraintes** — CHECK (mandat_origine_id IS DISTINCT FROM id) — un mandat n'est pas la reprise de lui-même · CHECK (statut <> 'en_pause' OR mis_en_pause_le IS NOT NULL) — sûre : 'en_pause' est une valeur neuve, 0 ligne existante · CHECK (salaire_min_ke IS NULL OR salaire_max_ke IS NULL OR salaire_min_ke <= salaire_max_ke) — À MESURER avant de poser : 375 et 376 lignes concernées · CHECK (tjm_min IS NULL OR tjm_max IS NULL OR tjm_min <= tjm_max) — À MESURER, 100 lignes · CHECK (confidentiel = false OR est_anonyme = true) — proposée, à arbitrer : un mandat confidentiel devrait être au moins anonyme · AUCUN CHECK sur titre/entreprise_id/statut/visibilite : 1 ligne vide sur chacune (voir nettoyage préalable)

**Relations — complément restauré** — Multivalués : core.mandat_cible, core.mandat_remote, core.mandat_tag_job, core.mandat_secteur_nogo · ABANDONNÉ : public.entreprise_mandat (1 ligne, table morte), public.mandat_analyse (1-N déguisée en N-N), public.mandat_note (idem), public.mandat.business_maker_id (0/534), status_sort_order (dénormalisation de ref.libelle.ordre), z_legacy_number (0/534), slug (0/534)

**Index**

- UNIQUE (bubble_id) WHERE bubble_id IS NOT NULL — provenance, jamais une clé
- (statut) — filtre de tableau de bord ; 4 statuts sur 534 lignes, index utile surtout combiné
- (agent_en_charge_id) WHERE statut IN ('nouveau','en_cours','en_pause') — le poste recruteur ne travaille que les mandats vivants
- (univers_id, metier_id) — filtres du job board
- (mandat_origine_id) WHERE mandat_origine_id IS NOT NULL — chaînes de reprise
- (departement) et (localisation) — filtres de recherche, à poser quand les colonnes seront peuplées

<details>
<summary><b>Notes par attribut</b> (63)</summary>

- **`id`** — Clé primaire. public.mandat.id est du texte sans défaut : l'application ne peut pas créer de ligne aujourd'hui.
- **`bubble_id`** — Provenance, jamais une clé. UNIQUE, NULLABLE : nul pour tout mandat créé par l'application. Correction du défaut Partie D — correspondance.json le nomme cle_legacy_bubble et le déclare obligatoire.
- **`titre`** — 533/534 renseignés — 1 mandat sans titre interdit le NOT NULL. Titre INTERNE : ne doit jamais être projeté dans api pour un client (défaut Partie D sur l'exposition).
- **`description`** — Mesurée à 0 % sur 534 lignes. La migration n'apporte rien ; la colonne n'existe que pour l'usage à venir. Candidate à l'abandon.
- **`description_manager`** — 14,2 %
- **`description_produit`** — 11,6 %
- **`missions`** — 1,1 % (6 lignes)
- **`process_recrutement`** — 69,1 %
- **`pour_toi`** — 70,2 %
- **`pas_pour_toi`** — 71,3 %
- **`remote_infos`** — 28,7 % — texte libre, distinct du multivalué core.mandat_remote
- **`salaire_infos`** — 13,7 % — texte libre, distinct de salaire_min_ke / salaire_max_ke
- **`format_mission`** — 7,1 %
- **`duree_mission`** — 14,8 % — durée en texte libre (« 6 mois »), non normalisable sans mesure
- **`date_demarrage_souhaitee`** — Retypage text→date exigé par la règle 7. 80/534 valeurs seulement : à mesurer avant migration, les valeurs non analysables (« ASAP », « septembre ») n'ont pas de destination. Voir points à arbitrer.
- **`video_youtube`** — Mesurée à 0 % sur 534 lignes. Je propose l'abandon : elle relève de la famille « colonne mesurée à 0 valeur » déjà retenue pour 7 autres colonnes.
- **`salaire_min_ke`** — En K€ annuels bruts (harmonisation salaires du 01/07). 70,2 %
- **`salaire_max_ke`** — En K€ annuels bruts. 70,4 %
- **`tjm_min`** — En € HT par jour — le TJM est hors du périmètre de la conversion en K€. 18,7 %
- **`tjm_max`** — En € HT par jour. 18,7 %
- **`experience_min_annees`** — En années. 25,5 %
- **`scorecard_delivery`** — Pondération de la scorecard, 15,7 %
- **`scorecard_discovery`** — 15,7 %
- **`scorecard_strategie`** — 14,6 %
- **`scorecard_ops`** — 13,3 %
- **`scorecard_management`** — 12,7 %
- **`kickoff_le`** — 80,1 %
- **`est_anonyme`** — 100 % renseigné et NOT NULL dans le miroir. DESCRIPTIF : ne décide plus à lui seul de l'exposition — c'est app.mandat_publication qui publie.
- **`est_hors_marche`** — 100 %, NOT NULL dans le miroir. Descriptif. 4 mandats sont à la fois hors marché et visibilite='public' : l'incohérence disparaît puisque plus aucun drapeau ne publie.
- **`visibilite`** — enum ('private','talent_only','public'), 533/534. DESCRIPTIF/hérité : conservé pour ne rien perdre, mais l'exposition réelle se lit dans app.mandat_publication. À retirer une fois la publication en service.
- **`statut`** — enum élargi à 5 valeurs : 'nouveau','en_cours','en_pause','termine','close_pachamama'. 'en_pause' est ajouté (défaut Partie D) : mandat suspendu dont le process s'est arrêté, qui n'est PAS clos — 0 ligne à migrer. 533/534 renseignés donc NULLABLE.
- **`mandat_origine_id`** — AJOUT signalé. « Reprise » n'est pas un statut mais un lien : le mandat dont celui-ci est issu. FK réflexive vers core.mandat.
- **`mis_en_pause_le`** — Déjà prévu en A_CREER dans correspondance.json ; devient le compagnon obligé de statut='en_pause'.
- **`equity`** — enum ('actions_gratuites','bspce','peut_etre_plus_tard','non') — issu du CHECK inline du miroir, pas d'une table ref_. 22,1 %
- **`type_contributeur`** — enum ('ic','manager_c_level'). 18 %
- **`contrat`** — enum ('cdi','freelance','entrepreneur'). 97,8 %. 1 mandat porte l'orpheline « Entrepreneur ».
- **`exclusivite_pachamama`** — Retypage 'Oui'/'Non' → boolean (règle 7). correspondance.json le laissait en text : corrigé. 74,9 %, donc NULLABLE.
- **`type_deal`** — enum ('new_business','existing_business'). 26 %
- **`source_marketing`** — enum 12 valeurs. Mesurée à 0 % : conservée comme axe d'acquisition à remplir, rien à migrer.
- **`type_apporteur`** — enum ('pacha_partners','head_of_bu','collectif'). Mesurée à 0 %, rien à migrer.
- **`univers_id`** — FK ref.univers (table, pas enum : elle porte couleurs, logos et is_live). 86,1 %
- **`metier_id`** — FK ref.metier (238 valeurs, vocabulaire ouvert). 99,3 %
- **`entreprise_id`** — 533/534, 0 orphelin. NULLABLE malgré l'évidence métier : 1 mandat sans entreprise. correspondance.json le déclare obligatoire — corrigé.
- **`contact_manager_id`** — FK core.contact_client, PAS core.utilisateur : le nom du miroir dit user, la donnée pointe equipe (77/77 incluses, 0 orphelin). 14,4 %
- **`contact_recruteur_id`** — FK core.contact_client, même piège de nommage (46 non nuls, 0 orphelin). 8,6 %
- **`agent_en_charge_id`** — FK core.utilisateur. 89,5 %, 32 agents distincts, 0 orphelin
- **`agent_2_id`** — FK core.utilisateur. 4,7 %
- **`account_manager_id`** — FK core.utilisateur. 32,4 %
- **`localisation`** — Fait de la mission, pas de sa mise en ligne : reste sur le mandat et non sur la publication. Exigé par le job board et les filtres.
- **`departement`** — Code INSEE 2 à 3 caractères, pas un libellé. Exigé par les filtres de recherche.
- **`stack`** — Fait de la mission. text[] assumé : pas de référentiel de technologies dans le lot.
- **`presentation_equipe`** — Fait de la mission
- **`contexte_equipe`** — Brief enrichi pour le Chasseur de Talents
- **`raison_du_recrutement`** — Détail offre avec contexte enrichi
- **`confidentiel`** — Distinct de est_anonyme : confidentiel interdit la publication, anonyme la masque.
- **`must_have`** — Critères durs de la short-list. jsonb plutôt que text[] pour porter un libellé et un poids ; à arbitrer contre une table de critères.
- **`nice_to_have`** — Même forme que must_have
- **`cloture_demandee_le`** — Scission de l'attribut composite « demande_cloture_le / demande_par » de correspondance.json — une colonne ne porte qu'une donnée.
- **`cloture_demandee_par_compte_id`** — FK app.compte : la demande vient du portail client
- **`valide_par_am_le`** — Validation AM d'un mandat créé en self-service
- **`cree_par_id`** — FK core.utilisateur. 533/534
- **`cree_le`** — À la migration, created_at du miroir est une date de SYNCHRONISATION : la reprise doit importer la date Bubble, pas celle du miroir.
- **`maj_le`** — Entretenu par trigger applicatif

</details>
## `core.mandat_cible`
Multivalué : les cibles produit d'un mandat (92 lignes, max 3 par mandat).

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `mandat_id` | `uuid` | oui | public.mandat_cible.mandat_id |
| `cible` | `cible_produit` | oui | public.mandat_cible.cible |

**Relations** — N-1 → core.mandat ON DELETE CASCADE

**Contraintes** — Exception assumée à la règle « id uuid partout » : liste à deux colonnes, la clé naturelle suffit et interdit le doublon.

**Index**

- PK composite (mandat_id, cible)

<details>
<summary><b>Notes par attribut</b> (2)</summary>

- **`mandat_id`** — 92/92, 87 mandats distincts
- **`cible`** — enum ('b2b','b2b2c','b2c','users_internes'). Le miroir stocke le libellé (B2B 59, B2B2C 15, B2C 12, Users internes 6), 0 orpheline.

</details>
## `core.mandat_contact_client — VERSION SUPERSÉDÉE`

> ⚠ **VERSION SUPERSÉDÉE, ne pas implémenter.** Rédigée par le domaine
> mandat, elle a été remplacée par celle du domaine entreprise et contacts,
> plus bas dans ce document. Trois écarts : elle prévoit un attribut
> `role_sur_mandat` typé `role_contact_mandat`, un type qui n'existe dans
> aucun des 28 énumérés ; elle omet le `bubble_id` qu'exige la note sur la
> non-injectivité de la provenance du contact ; et elle annonce 768 lignes
> là où la mesure du domaine contacts en attend ~714, union de
> mandat_equipe (705) et equipe (644). Conservée pour la trace.

## `core.mandat_remote`
Multivalué : les rythmes de télétravail acceptés par un mandat (430 lignes, max 2 par mandat).

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `mandat_id` | `uuid` | oui | public.mandat_remote.mandat_id |
| `remote` | `rythme_remote` | oui | public.mandat_remote.remote |

**Relations** — N-1 → core.mandat ON DELETE CASCADE

**Contraintes** — Même exception assumée sur la PK composite.

**Index**

- PK composite (mandat_id, remote)
- (remote) — filtre du job board

<details>
<summary><b>Notes par attribut</b> (2)</summary>

- **`mandat_id`** — 430/430, 419 mandats distincts
- **`remote`** — enum à 7 valeurs : 'hybride','full_remote_fr','full_remote_eu','full_remote_ww' plus 3 codes obsolètes marqués actif=false — 'teletravail_legacy','presentiel_legacy','indifferent_legacy'. Sans eux, 26 lignes de mandat_remote (21 Télétravail, 4 Présentiel, 1 Indifférent) seraient détruites ; les mapper serait inventer une donnée.

</details>
## `core.mandat_secteur_nogo`
AJOUT SIGNALÉ. Multivalué : les secteurs exclus d'un mandat. correspondance.json le prévoyait en colonne text[] sur core.mandat ; la règle 6 impose un code stable et un référentiel, donc une table de liaison comme pour cible/remote/tag.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `mandat_id` | `uuid` | oui | A_CREER |
| `secteur_id` | `uuid` | oui | A_CREER |

**Relations** — N-1 → core.mandat ON DELETE CASCADE · N-1 → ref.secteur ON DELETE RESTRICT

**Contraintes** — Aucune ligne à migrer : la donnée n'existe pas dans le miroir.

**Index**

- PK composite (mandat_id, secteur_id)

<details>
<summary><b>Notes par attribut</b> (1)</summary>

- **`secteur_id`** — FK ref.secteur — le référentiel existe déjà et sert le talent

</details>
## `core.mandat_tag_job`
Multivalué : les arguments de vente d'une offre (830 lignes, max 4 par mandat).

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `mandat_id` | `uuid` | oui | public.mandat_tag_job.mandat_id |
| `tag_job_id` | `uuid` | oui | public.mandat_tag_job.tag_job |

**Relations** — N-1 → core.mandat ON DELETE CASCADE · N-1 → ref.tag_job ON DELETE RESTRICT — à poser seulement une fois les 16 tags reconstruits

**Contraintes** — Blocage de migration : la FK n'est posable qu'après reconstruction de ref.tag_job, y compris la 16e valeur « Job exclu » (18 mandats) dont il est prouvé qu'elle n'a jamais existé dans le référentiel Bubble.

**Index**

- PK composite (mandat_id, tag_job_id)
- (tag_job_id)

<details>
<summary><b>Notes par attribut</b> (2)</summary>

- **`mandat_id`** — 830/830, 294 mandats distincts
- **`tag_job_id`** — FK ref.tag_job — TABLE et non enum : le référentiel porte icone_url et un emoji distinct du libellé. Le référentiel source est DÉTRUIT dans le miroir (74 lignes d'un caractère) : les 16 codes se reconstruisent depuis ces 830 lignes.

</details>
## `core.placement`
L'ex public.mandatclose (227 lignes) : la candidature qui aboutit. Entité de revenu — elle porte le salaire final, la commission et la garantie.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `bubble_id` | `text` | — | public.mandatclose.id |
| `fiche_talent_id` | `uuid` | — | public.mandatclose.candidat_id |
| `talent_id` | `uuid` | — | public.mandatclose.candidat_id |
| `entreprise_id` | `uuid` | — | public.mandatclose.entreprise_id |
| `mandat_id` | `uuid` | — | public.mandatclose.mandat_id |
| `candidature_id` | `uuid` | — | public.mandatclose.process_id |
| `apporteur_cooptation_id` | `uuid` | — | public.mandatclose.business_maker_coo_id |
| `apporteur_deal_id` | `uuid` | — | public.mandatclose.business_maker_deal_id |
| `univers_id` | `uuid` | — | public.mandatclose.univers |
| `type_contributeur` | `type_contributeur` | — | public.mandatclose.contributor_type |
| `contrat` | `type_contrat` | — | public.mandatclose.contrat |
| `statut_contrat_freelance_code` | `text` | — | public.mandatclose.statut_contrat_freelance |
| `statut_contrat_entreprise_code` | `text` | — | public.mandatclose.statut_contrat_entreprise |
| `date_closing` | `timestamptz` | oui | public.mandatclose.date_closing |
| `date_debut_mission` | `timestamptz` | — | public.mandatclose.date_debut |
| `date_fin_garantie` | `timestamptz` | — | public.mandatclose.date_fin_garantie |
| `date_fin_mission` | `timestamptz` | — | public.mandatclose.date_fin_mission |
| `salaire_final_ke` | `numeric(12,2)` | — | public.mandatclose.salaire_final |
| `commission` | `numeric(12,2)` | — | public.mandatclose.commission |
| `commission_nette` | `numeric(12,2)` | — | public.mandatclose.commission_nette |
| `montant_apport_affaires` | `numeric(12,2)` | — | public.mandatclose.apport_affaires_k |
| `montant_cooptation_talent` | `numeric(12,2)` | — | public.mandatclose.cooptation_talent |
| `tjm_facture_client` | `numeric(12,2)` | — | public.mandatclose.tjm_final_marge_inclus |
| `tjm_verse_talent` | `numeric(12,2)` | — | public.mandatclose.tjm_final_talent |
| `est_archive` | `boolean` | oui | public.mandatclose.est_archive |
| `statut_paiement` | `statut_paiement` | — | A_CREER |
| `montant_remboursement_garantie` | `numeric(12,2)` | — | A_CREER |
| `rembourse_le` | `timestamptz` | — | A_CREER |
| `cree_par_id` | `uuid` | — | public.mandatclose.created_by |
| `cree_le` | `timestamptz` | oui | public.mandatclose.created_at |
| `maj_le` | `timestamptz` | oui | public.mandatclose.updated_at |

**Relations** — N-1 → core.fiche_talent et core.talent ON DELETE SET NULL — un enregistrement financier ne disparaît pas avec une fiche · N-1 → core.mandat ON DELETE RESTRICT · N-1 → core.entreprise ON DELETE RESTRICT · N-1 → core.candidature ON DELETE SET NULL — sans unicité · N-1 → core.apporteur_affaires x2 ON DELETE SET NULL · N-1 → ref.univers, ref.statut_contrat x2 ON DELETE RESTRICT · 1-N → core.repartition_commission (jusqu'à 5 répartitions par placement) · 1-N → core.tache — task.mandatclose_id est le SEUL rattachement de la tâche, ni mandat ni candidature (1 099/1 136 lignes, 1 valeur orpheline sur 5 lignes)

**Contraintes** — CHECK (date_fin_mission IS NULL OR date_debut_mission IS NULL OR date_fin_mission >= date_debut_mission) — À MESURER avant de poser (78 lignes concernées) · CHECK (date_fin_garantie IS NULL OR date_fin_garantie >= date_closing) — À MESURER (160 lignes) · PAS d'UNIQUE (candidature_id) : 2 candidatures partagent un placement · Pas de CHECK de positivité sur les montants : un avoir peut être négatif

**Relations — complément restauré** — 1-N → core.note (note.mandatclose_id, 1 750 lignes) · N-N → core.utilisateur via core.placement_utilisateur · ABANDONNÉ : split_id (pointeur inverse qui perd 39 lignes), agent_filtre_id et agent_2_filtre_id (dénormalisations de recherche, contrôle de non-perte à passer avant), slug (0 %), public.process_mandatclose et public.mandatclose_note (1-N déguisées en N-N)

**Index**

- UNIQUE (bubble_id) WHERE bubble_id IS NOT NULL
- (mandat_id)
- (fiche_talent_id)
- (date_closing DESC) — reporting financier par période
- (statut_paiement) WHERE est_archive = false
- (entreprise_id, date_closing)

<details>
<summary><b>Notes par attribut</b> (28)</summary>

- **`bubble_id`** — UNIQUE, NULLABLE. correspondance.json le déclarait obligatoire — corrigé.
- **`fiche_talent_id`** — AJOUT signalé, cible directe de migration (227/227, 220 distincts, max 2 placements par candidat)
- **`talent_id`** — Dérivé via le pivot
- **`entreprise_id`** — 226/227, 0 orphelin
- **`mandat_id`** — 226/227, max 13 placements par mandat
- **`candidature_id`** — 226 non nuls pour 224 distincts : 2 candidatures portent 2 placements. NE PAS poser d'unicité.
- **`apporteur_cooptation_id`** — FK core.apporteur_affaires. 2 lignes seulement (0,9 %), 0 orphelin.
- **`apporteur_deal_id`** — FK core.apporteur_affaires. 16 lignes (7 %), 0 orphelin.
- **`univers_id`** — FK ref.univers. 99,1 %
- **`type_contributeur`** — enum. 7,9 %
- **`contrat`** — enum. 227/227 renseignés — NOT NULL possible mais laissé NULLABLE : l'application doit pouvoir enregistrer un placement avant que le type de contrat soit arrêté.
- **`statut_contrat_freelance_code`** — FK ref.statut_contrat(code) — table et non enum, elle porte signature_requise qui est de la logique métier. 221/227. Codes : non_signe, envoye, signe, expire, non_requis.
- **`statut_contrat_entreprise_code`** — FK ref.statut_contrat(code). 221/227
- **`date_closing`** — 227/227 renseignés. Seul NOT NULL du bloc : il pose que « placement = deal closé ». Si l'application doit un jour préparer un placement avant closing, il faudra le relâcher.
- **`date_debut_mission`** — 99,6 %
- **`date_fin_garantie`** — 70,5 %
- **`date_fin_mission`** — 34,4 %
- **`salaire_final_ke`** — En K€ annuels bruts. 64,8 %
- **`commission`** — Unité à confirmer (€ ou K€) — voir points à arbitrer. 64,8 %
- **`commission_nette`** — Même unité que commission. 18,9 %
- **`montant_apport_affaires`** — Le suffixe _k de la source suggère des K€ : à confirmer avant de figer le nom et le commentaire d'unité. 18,9 %
- **`montant_cooptation_talent`** — 9,3 %
- **`tjm_facture_client`** — En € HT/jour, marge incluse. 35,2 %
- **`tjm_verse_talent`** — En € HT/jour. 35,2 %
- **`est_archive`** — 100 %, NOT NULL dans le miroir
- **`statut_paiement`** — enum ('a_facturer','facture','paye','avoir'). Exigé par la génération de factures et le suivi des commissions.
- **`montant_remboursement_garantie`** — Scission de l'attribut composite « remboursement_garantie : numeric + timestamptz » de correspondance.json
- **`cree_par_id`** — FK core.utilisateur. 100 %

</details>
## `core.placement_utilisateur`
Normalisation du tableau text[] public.mandatclose.note_user_ids : les utilisateurs suivant un placement.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `placement_id` | `uuid` | oui | public.mandatclose.id |
| `utilisateur_id` | `uuid` | oui | public.mandatclose.note_user_ids |
| `cree_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 → core.placement ON DELETE CASCADE · N-1 → core.utilisateur ON DELETE CASCADE

**Contraintes** — Exception assumée à la règle « id uuid partout » : liaison à deux colonnes sans attribut propre, la clé naturelle suffit. · Contrôle de migration : note_user_ids est renseigné sur 227/227 lignes — vérifier qu'aucun élément du tableau ne pointe un utilisateur inexistant avant de poser la FK.

**Index**

- PK composite (placement_id, utilisateur_id)
- (utilisateur_id) — « les placements que je suis »

<details>
<summary><b>Notes par attribut</b> (2)</summary>

- **`placement_id`** — AJOUT signalé : correspondance.json ne liste que utilisateur_id, la table y est sans côté parent.
- **`utilisateur_id`** — Un élément du tableau = une ligne

</details>
## `core.repartition_commission`
L'ex public.mandate_closed_split (266 lignes) : la répartition de la commission d'un placement entre agents, apporteurs et le cabinet. Jusqu'à 5 répartitions pour un même placement.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `bubble_id` | `text` | — | public.mandate_closed_split.id |
| `placement_id` | `uuid` | — | public.mandate_closed_split.mandatclose_id |
| `agent_1_id` | `uuid` | — | A_CREER |
| `agent_1_montant` | `numeric(12,2)` | — | public.mandate_closed_split.agent_1_com |
| `agent_1_pct` | `numeric(5,2)` | — | public.mandate_closed_split.agent_1_com_pct |
| `agent_1_est_absolu` | `boolean` | oui | public.mandate_closed_split.agent_1_com_is_absolute |
| `agent_2_id` | `uuid` | — | A_CREER |
| `agent_2_montant` | `numeric(12,2)` | — | public.mandate_closed_split.agent_2_com |
| `agent_2_pct` | `numeric(5,2)` | — | public.mandate_closed_split.agent_2_com_pct |
| `agent_2_est_absolu` | `boolean` | oui | public.mandate_closed_split.agent_2_com_is_absolute |
| `apporteur_cooptation_montant` | `numeric(12,2)` | — | public.mandate_closed_split.bus_maker_coo_com |
| `apporteur_cooptation_pct` | `numeric(5,2)` | — | public.mandate_closed_split.bus_maker_coo_com_pct |
| `apporteur_deal_montant` | `numeric(12,2)` | — | public.mandate_closed_split.bus_maker_deal_com |
| `apporteur_deal_pct` | `numeric(5,2)` | — | public.mandate_closed_split.bus_maker_deal_com_pct |
| `pachamama_montant` | `numeric(12,2)` | — | public.mandate_closed_split.pacha_com |
| `pachamama_pct` | `numeric(5,2)` | — | public.mandate_closed_split.pacha_com_pct |
| `net_montant` | `numeric(12,2)` | — | public.mandate_closed_split.net |
| `net_pct` | `numeric(5,2)` | — | public.mandate_closed_split.net_pct |
| `total_montant` | `numeric(12,2)` | — | public.mandate_closed_split.total |
| `total_pct` | `numeric(5,2)` | — | public.mandate_closed_split.total_pct |
| `cree_par_id` | `uuid` | — | public.mandate_closed_split.created_by |
| `cree_le` | `timestamptz` | oui | public.mandate_closed_split.created_at |
| `maj_le` | `timestamptz` | oui | public.mandate_closed_split.updated_at |

**Relations** — N-1 → core.placement ON DELETE CASCADE — une répartition n'a aucun sens hors de son placement. Contrainte posable APRÈS traitement de la valeur orpheline (1 ligne) et des 5 lignes sans placement. · N-1 → core.utilisateur x3 (agent_1_id, agent_2_id, cree_par_id) ON DELETE SET NULL · ABANDONNÉ : slug (0 %) ; et côté placement, mandatclose.split_id qui forçait un 1 pour 1 à tort et perdait 39 lignes

**Contraintes** — CHECK sur les pourcentages BETWEEN 0 AND 100 pour les 6 colonnes _pct — À MESURER : total_pct pourrait dépasser 100 ou porter une convention 0–1 · Pas de CHECK d'égalité entre total_montant et la somme des parts : la formule d'origine est inconnue, une contrainte fausse bloquerait 266 lignes. Prévoir une vue de contrôle des écarts plutôt qu'une contrainte.

**Index**

- UNIQUE (bubble_id) WHERE bubble_id IS NOT NULL
- (placement_id)
- (agent_1_id) et (agent_2_id) — reporting des commissions par agent

<details>
<summary><b>Notes par attribut</b> (15)</summary>

- **`bubble_id`** — UNIQUE, NULLABLE. correspondance.json le déclarait obligatoire — corrigé.
- **`placement_id`** — 261/266 : 5 répartitions sans placement, plus 1 valeur orpheline sur 1 ligne. NULLABLE — correspondance.json le déclarait obligatoire, c'est un cas exact du défaut Partie D.
- **`agent_1_id`** — FK core.utilisateur. Sans elle, la répartition dit des montants sans dire à qui : le reporting par agent est impossible.
- **`agent_1_montant`** — En €. 100 % renseigné, laissé NULLABLE : l'application doit pouvoir saisir une répartition partielle.
- **`agent_1_pct`** — Pourcentage 0–100
- **`agent_1_est_absolu`** — 100 %, NOT NULL dans le miroir. Dit si la part est un montant ou un pourcentage.
- **`agent_2_id`** — FK core.utilisateur
- **`agent_2_montant`** — En €
- **`agent_2_pct`** — Pourcentage 0–100
- **`apporteur_cooptation_montant`** — En €
- **`apporteur_deal_montant`** — En €
- **`pachamama_montant`** — En €. La part du cabinet.
- **`net_montant`** — En €. Valeur dérivée conservée telle quelle : ne pas la recalculer à la migration, on ne connaît pas la formule d'origine.
- **`total_montant`** — En €. Idem : dérivée, reprise à l'identique.
- **`cree_par_id`** — FK core.utilisateur. 100 %

</details>
## `core.vivier_mandat`
Ex public.candidat_mandat (2 603 couples). Deuxième réponse à « ce talent est-il sur ce mandat ? », distincte de la candidature : 4 492 couples existent dans process seulement, 7 dans candidat_mandat seulement. SA DÉFINITION MÉTIER EST ATTENDUE — la table est reprise et renommée pour ne rien perdre, pas parce que sa sémantique est établie.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `mandat_id` | `uuid` | oui | public.candidat_mandat.mandat_id |
| `fiche_talent_id` | `uuid` | oui | public.candidat_mandat.candidat_id |
| `talent_id` | `uuid` | — | public.candidat_mandat.candidat_id |
| `ajoute_par_id` | `uuid` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 → core.mandat ON DELETE CASCADE — un vivier n'existe pas sans son mandat · N-1 → core.fiche_talent ON DELETE CASCADE — contrairement à la candidature, la ligne de vivier ne porte aucune valeur propre ; l'effacement l'emporte · N-1 → core.talent ON DELETE SET NULL · N-1 → core.utilisateur (ajoute_par_id) ON DELETE SET NULL

**Contraintes** — Aucune contrainte croisée avec core.candidature tant que la définition métier n'est pas donnée : ni « tout vivier devient candidature », ni l'inverse ne sont vrais dans les données. · Prévoir une vue de contrôle des 7 couples présents ici et absents de core.candidature, et des 4 492 présents seulement dans la candidature.


---

# L'entreprise et ses contacts

**Index**

- UNIQUE (mandat_id, fiche_talent_id)
- (fiche_talent_id) — la PK de substitution ne couvre pas la seconde colonne

<details>
<summary><b>Notes par attribut</b> (6)</summary>

- **`id`** — Clé de substitution plutôt qu'une PK composite : la définition métier manquante rendra probablement la table porteuse d'attributs (qui a ajouté, quand, pourquoi).
- **`mandat_id`** — 2 603/2 603 renseignés, 176 mandats distincts, max 130 talents par mandat. NOT NULL sûr.
- **`fiche_talent_id`** — 2 603/2 603, 1 506 candidats distincts, max 14 mandats par candidat. Même choix que sur la candidature : la source désigne un public.candidat, donc une fiche.
- **`talent_id`** — AJOUT signalé, dérivé via le pivot. NULLABLE.
- **`ajoute_par_id`** — AJOUT signalé, FK core.utilisateur. Le miroir ne porte aucune trace d'auteur : sans elle, impossible de reconstruire ce que la table voulait dire.
- **`cree_le`** — AJOUT signalé : candidat_mandat ne porte pas de date. Les 2 603 lignes migrées prendront la date de migration, à documenter comme telle.

</details>
## `core.contact_client`
LA PERSONNE chez un client, rattachée à l'ENTREPRISE et non au mandat. Carnet de contacts : à qui envoyer un send-out, qui organise les entretiens, qui reçoit un accès au portail. 427 personnes déduites des 766 lignes de public.equipe (une même personne y figure jusqu'à 15 fois). C'est la moitié « personne » de la scission de la Décision 6 ; la moitié « participation » est core.mandat_contact_client. Elle survit à la fin du mandat, et les 122 lignes equipe sans mandat cessent d'être orphelines.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `bubble_id` | `text` | — | public.equipe.id (ligne canonique retenue à la déduplication) |
| `entreprise_id` | `uuid` | — | A_CREER |
| `nom` | `text` | — | public.equipe.nom |
| `prenom` | `text` | — | public.equipe.prenom |
| `email` | `citext` | — | public.equipe.email |
| `description` | `text` | — | public.equipe.description |
| `photo_url` | `text` | — | public.equipe.photo_url |
| `metier_id` | `uuid` | — | public.equipe.metier |
| `univers_id` | `uuid` | — | public.equipe.univers |
| `talent_id` | `uuid` | — | AJOUTÉ (absent de correspondance.json, imposé par la Décision 5) |
| `est_referent_entreprise` | `boolean` | oui | AJOUTÉ |
| `actif` | `boolean` | oui | A_CREER |
| `cree_le` | `timestamptz` | oui | public.equipe.created_at |
| `maj_le` | `timestamptz` | oui | public.equipe.updated_at |
| `cree_par_id` | `uuid` | — | public.equipe.created_by |

**Relations** — N-1 → core.entreprise (entreprise_id, NULLABLE, ON DELETE RESTRICT). · N-1 → core.talent (talent_id, NULLABLE, NON UNIQUE, ON DELETE SET NULL) — 11 cas de casquette mesurés. · N-N → core.mandat via core.mandat_contact_client (705 liens dans mandat_equipe, 644 dans equipe.mandat_id, 70 divergents). · 1-N → core.enquete_nps (enquete_nps.contact_client_id) : 102 des 118 lignes NPS pointent une equipe, 16 lignes / 13 valeurs ne pointent rien. · Cible de core.mandat.manager_id (77 valeurs, 0 orpheline) et core.mandat.recruteur_id (46 valeurs, 36 distinctes, 0 orpheline) : le nom dit « user », la donnée dit equipe. Ces deux FK doivent être re-pointées sur les contacts DÉDUPLIQUÉS. · Cible de app.acces (compte → contact_client), rendue possible par la scission : impossible tant qu'il y avait 15 lignes pour la même personne. · PAS de colonne role_portail ni invite_le/accepte_le/invite_par ici, contrairement à correspondance.json — voir points à arbitrer.

**Contraintes** — CHECK (nom IS NOT NULL OR prenom IS NOT NULL OR email IS NOT NULL) — une ligne de contact doit être identifiable par au moins un des trois. À poser NOT VALID : la coexistence des 42 sans nom, 29 sans prénom et 92 sans e-mail n'a pas été croisée. · CHECK (est_referent_entreprise = false OR entreprise_id IS NOT NULL) — on n'est référent de rien. · NON POSÉE : UNIQUE (talent_id). Une personne peut être contact chez deux entreprises ; et 374 talents du pivot sont nés de fusions.

**Index**

- UNIQUE (bubble_id)
- btree (entreprise_id)
- UNIQUE (email, entreprise_id) WHERE email IS NOT NULL — une personne, une entreprise, un e-mail ; à valider après déduplication
- btree (email) WHERE email IS NOT NULL — rapprochement avec auth.users
- btree (talent_id) WHERE talent_id IS NOT NULL
- UNIQUE (entreprise_id) WHERE est_referent_entreprise — un seul référent par entreprise
- btree (actif) WHERE actif

<details>
<summary><b>Notes par attribut</b> (16)</summary>

- **`id`** — Convention.
- **`bubble_id`** — ⚠ DÉFAUT STRUCTUREL À TRANCHER : 766 lignes equipe se replient sur ~427 contacts, la provenance n'est donc PLUS INJECTIVE. Cette colonne ne peut porter qu'UN des identifiants Bubble absorbés ; les autres vivent sur core.mandat_contact_client.bubble_id (une ligne equipe = une participation). Les 122 lignes equipe sans mandat n'ont aucune participation où loger leur id. La table de correspondance complète equipe.id → contact_client.id doit être conservée hors de cette colonne (app.fusion_doublon), sinon mandat.manager_id (77), mandat.recruteur_id (46) et nps_tracking.bubble_contact_id (118) ne se résolvent plus. NULLABLE, UNIQUE.
- **`entreprise_id`** — Le cœur de la Décision 6 : public.equipe n'a AUCUN entreprise_id, le rattachement se dérive par equipe.mandat_id → mandat.entreprise_id. NULLABLE OBLIGATOIREMENT : 122 des 766 lignes n'ont pas de mandat, donc pas d'entreprise dérivable. Les 2 personnes intervenant pour deux entreprises produisent 2 lignes de contact. FK → core.entreprise ON DELETE RESTRICT.
- **`nom`** — 724/766 (94,5 %) : 42 lignes sans nom interdisent le NOT NULL.
- **`prenom`** — 737/766 (96,2 %).
- **`email`** — 674/766 (88,0 %) : 92 lignes sans e-mail. citext parce que c'est la SEULE clé de rapprochement possible entre un contact et son compte — user ne porte aucun e-mail, l'adresse vit dans auth.users (Décision 6). Clé faible : rapprocher, proposer, faire confirmer.
- **`description`** — 1/766 (0,1 %). Une seule valeur en production — arbitrage porter/abandonner, mais 1 valeur n'est pas 0.
- **`photo_url`** — 191/766 (24,9 %). Affichée dans le bloc « équipe » de l'annonce publique.
- **`metier_id`** — 660/766 (86,2 %). Le poste occupé par le contact chez le client. ref_metier : 238 valeurs. FK → ref.metier(metier_id) ON DELETE SET NULL.
- **`univers_id`** — 684/766 (89,3 %). ref_univers : 8 valeurs. FK → ref.univers(univers_id) ON DELETE SET NULL.
- **`talent_id`** — Le lien de casquette. 11 contacts sont aussi candidats, dont 8 SANS COMPTE : le lien vit entre les personnes, pas par app.acces, sinon les trois quarts sont perdus. NULLABLE et NON UNIQUE — une même personne peut être contact chez deux entreprises (2 cas mesurés), donc deux lignes portant le même talent_id. ⚠ Les 131 correspondances par le nom ne s'établissent PAS automatiquement : la migration propose, un humain confirme. FK → core.talent ON DELETE SET NULL (la projection se rafraîchit, le contact reste).
- **`est_referent_entreprise`** — AJOUT SIGNALÉ. « L'interlocuteur au niveau de l'entreprise, que le cadrage demande, devient exprimable » (Décision 6) — mais il n'a nulle part où vivre une fois contact_principal descendu sur la participation. Un booléen ici plutôt qu'un entreprise.contact_referent_id, qui créerait un cycle de clés étrangères entreprise ↔ contact_client. Non alimenté par la reprise : il naît à false partout.
- **`actif`** — Aucun drapeau côté contact dans le miroir. Un contact qui quitte son entreprise se désactive, il ne se supprime pas — ses participations et ses NPS restent.
- **`cree_le`** — 100 % rempli. À la déduplication, prendre le MIN des lignes absorbées.
- **`maj_le`** — 100 % rempli. Prendre le MAX des lignes absorbées.
- **`cree_par_id`** — 762/766 (99,5 %). FK → core.utilisateur ON DELETE SET NULL.

</details>
## `core.enquete_nps`
La sollicitation de satisfaction envoyée après un closing, et sa réponse. 118 lignes. SEULE table du miroir qui ne vient pas de Bubble : sa clé est déjà un uuid avec gen_random_uuid(), et elle n'a donc PAS de bubble_id. Absorbe public.nps_tracking, dont la colonne cible bubble_mandat_id est POLYMORPHE — 69 lignes désignent un mandatclose (placement), 34 un mandat, 15 aucune table.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | public.nps_tracking.id |
| `contact_client_id` | `uuid` | — | public.nps_tracking.bubble_contact_id |
| `contact_bubble_id_source` | `text` | — | AJOUTÉ (conservation de public.nps_tracking.bubble_contact_id brut) |
| `mandat_id` | `uuid` | — | public.nps_tracking.bubble_mandat_id (34 lignes qui désignent un mandat) |
| `placement_id` | `uuid` | — | public.nps_tracking.bubble_mandat_id (69 lignes qui désignent un mandatclose) |
| `cible_bubble_id_source` | `text` | — | AJOUTÉ (conservation de public.nps_tracking.bubble_mandat_id brut) |
| `contact_email` | `citext` | oui | public.nps_tracking.contact_email |
| `contact_prenom` | `text` | — | public.nps_tracking.contact_firstname |
| `intitule_poste_envoye` | `text` | — | public.nps_tracking.job_title |
| `raison_sociale_envoyee` | `text` | — | public.nps_tracking.company_name |
| `prenom_talent_envoye` | `text` | — | public.nps_tracking.candidate_firstname |
| `type_campagne_code` | `text` | — | public.nps_tracking.nps_type |
| `statut_code` | `text` | oui | public.nps_tracking.status |
| `envoye_le` | `timestamptz` | — | public.nps_tracking.created_at |
| `relance_le` | `timestamptz` | — | public.nps_tracking.reminder_sent_at |
| `repondu_le` | `timestamptz` | — | public.nps_tracking.responded_at |
| `score` | `smallint` | — | A_CREER |
| `commentaire` | `text` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER (amorcé depuis public.nps_tracking.created_at) |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 → core.contact_client (contact_client_id, NULLABLE, ON DELETE SET NULL) : 102/118 résolvent, 16 lignes / 13 valeurs orphelines. · N-1 → core.mandat (mandat_id, NULLABLE, ON DELETE SET NULL) : 34 lignes. · N-1 → core.placement (placement_id, NULLABLE, ON DELETE SET NULL) : 69 lignes. · N-1 → ref.libelle pour type_campagne_code et statut_code (ON DELETE RESTRICT). · Aucune relation entrante. · PAS de bubble_id : nps_tracking est la seule table du miroir qui ne vient pas de Bubble, ses trois colonnes bubble_* sont des références SORTANTES vers des objets Bubble, jamais sa propre provenance.

**Contraintes** — CHECK (num_nonnulls(mandat_id, placement_id) <= 1) — la cible est un mandat OU un placement, jamais les deux. <= 1 et non = 1 : 15 lignes ne désignent rien. · CHECK (score IS NULL OR score BETWEEN 0 AND 10) · CHECK (relance_le IS NULL OR envoye_le IS NULL OR relance_le >= envoye_le) · CHECK (repondu_le IS NULL OR envoye_le IS NULL OR repondu_le >= envoye_le) · NON POSÉE : CHECK (statut_code = 'repondu' ⇒ repondu_le IS NOT NULL ET score IS NOT NULL). repondu_le est VIDE à 100 % : la contrainte rejetterait les lignes existantes si le statut 'repondu' est présent. À poser seulement après nettoyage. · NON POSÉE : CHECK de cohérence type_campagne_code ↔ (mandat_id / placement_id). C'est le contrôle de reprise, pas une contrainte : il faut d'abord vérifier que 'close' et 'termine' s'alignent bien sur 69 et 34.

**Index**

- btree (contact_client_id) WHERE contact_client_id IS NOT NULL
- btree (placement_id) WHERE placement_id IS NOT NULL
- btree (mandat_id) WHERE mandat_id IS NOT NULL
- btree (statut_code, envoye_le DESC) — la lecture réelle est « les enquêtes en attente de réponse, les plus anciennes d'abord »
- btree (contact_email) — rattrapage des 16 lignes dont le contact ne résout pas
- btree (envoye_le DESC) — série temporelle du NPS pour le dashboard

<details>
<summary><b>Notes par attribut</b> (20)</summary>

- **`id`** — Reprise à l'identique : la valeur existante est conservée, pas régénérée — c'est la seule table du miroir déjà conforme à la convention.
- **`contact_client_id`** — 118/118 renseignés dans le miroir MAIS seulement 102 résolvent vers une equipe : 16 lignes / 13 valeurs pointent une equipe inexistante. NULLABLE obligatoire. Résolution en deux temps : bubble_contact_id → equipe.id → contact déduplique. FK → core.contact_client ON DELETE SET NULL — une enquête reste une mesure même si le contact disparaît.
- **`contact_bubble_id_source`** — AJOUT SIGNALÉ. « À isoler, pas à jeter » : garde la valeur brute des 16 lignes non résolues pour que la vue de réconciliation puisse les lister. Nulle dès que contact_client_id est résolu.
- **`mandat_id`** — PREMIÈRE MOITIÉ DE LA SCISSION DU POLYMORPHISME. Une seule clé étrangère est impossible sur la colonne d'origine : la base ne peut pas vérifier un couple « type + identifiant ». FK → core.mandat ON DELETE SET NULL.
- **`placement_id`** — SECONDE MOITIÉ. mandatclose devient core.placement. C'est la majorité des lignes — le nom bubble_mandat_id ment sur son contenu. FK → core.placement ON DELETE SET NULL.
- **`cible_bubble_id_source`** — AJOUT SIGNALÉ. Garde la valeur brute des 15 lignes qui ne désignent NI un mandat NI un placement, et sert de contrôle de non-perte : 34 + 69 + 15 = 118.
- **`contact_email`** — 118/118 (100 %) et déjà NOT NULL dans le miroir : le NOT NULL est SÛR. C'est la seule façon de rattacher les 16 lignes dont le contact ne résout pas.
- **`contact_prenom`** — 118/118 (100 %) mais laissé NULLABLE : le miroir ne l'impose pas, et l'application enverra des enquêtes sans prénom connu.
- **`intitule_poste_envoye`** — 118/118. Renommée : c'est une COPIE figée dans le corps de l'e-mail au moment de l'envoi, pas une jointure vers le mandat. Le suffixe _envoye dit qu'elle ne se rafraîchit pas.
- **`raison_sociale_envoyee`** — 118/118. Même logique de gel.
- **`prenom_talent_envoye`** — 118/118. Même logique de gel. Aucun lien vers core.talent : le miroir n'en porte pas.
- **`type_campagne_code`** — 118/118. CHECK du miroir : 'close' | 'termine' → codes close / termine. ⚠ C'EST L'ARBITRE PROBABLE DU POLYMORPHISME : 'close' devrait correspondre aux 69 placements, 'termine' aux 34 mandats. La reprise doit CROISER les deux et signaler tout désaccord, pas choisir l'un. FK → ref.libelle(domaine='type_campagne_nps', code).
- **`statut_code`** — 118/118, DEFAULT 'sent' dans le miroir → NOT NULL sûr avec défaut. CHECK : 'sent' | 'reminded' | 'responded' | 'ignored' → codes envoye / relance / repondu / ignore. FK → ref.libelle(domaine='statut_nps', code).
- **`envoye_le`** — 118/118 mais nullable dans le miroir (DEFAULT now() sans NOT NULL) : on ne durcit pas. Renommée — ici created_at est bien la date d'ENVOI, pas de synchro : nps_tracking n'est pas alimentée par n8n.
- **`relance_le`** — 95/118 (80,5 %).
- **`repondu_le`** — ⚠ VIDE À 100 % sur 118 lignes, alors que statut_code prévoit 'repondu'. Soit aucune enquête n'a jamais reçu de réponse, soit le statut est posé sans horodater. À trancher — c'est ce qui interdit le CHECK de cohérence statut/date.
- **`score`** — « Un NPS sans score n'est pas un NPS » : les 13 colonnes du miroir portent l'ENVOI et le STATUT, aucune note. Exigé par le dashboard de performance recruteur. Échelle 0-10.
- **`commentaire`** — Le verbatim, absent du miroir au même titre que le score.
- **`cree_le`** — Convention. Distinct de envoye_le : la ligne peut être créée en file avant l'envoi effectif.
- **`maj_le`** — Convention.

</details>
## `core.entreprise`
Le compte client : identité publique et vitrine, cadre contractuel (success fee, exclusivité, garantie), coordonnées de facturation, rattachement à l'account manager. Porte le cloisonnement multi-tenant. 850 lignes dans le miroir. Absorbe public.entreprise (43 colonnes) et public.entreprise_remote (replié 1 pour 1). Les satellites entreprise_mandat (1 ligne), entreprise_note (991 lignes, sous-ensemble strict de note.entreprise_id) et entreprise_tag (5 lignes, sous-ensemble strict de tag.entreprise_id) disparaissent.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `bubble_id` | `text` | — | public.entreprise.id |
| `nom` | `text` | — | public.entreprise.nom |
| `raison_sociale` | `text` | — | A_CREER |
| `description` | `text` | — | public.entreprise.description |
| `fondateur` | `text` | — | public.entreprise.fondateur |
| `serie_financement` | `text` | — | public.entreprise.serie |
| `site_web` | `text` | — | public.entreprise.site_internet |
| `domaine_normalise` | `text` | — | A_CREER |
| `siret` | `text` | — | public.entreprise.siret |
| `video_url` | `text` | — | public.entreprise.video |
| `logo_url` | `text` | — | public.entreprise.logo_url |
| `note_interne` | `text` | — | public.entreprise.note |
| `localisation_json` | `jsonb` | — | public.entreprise.localisation |
| `localisation_texte` | `text` | — | A_CREER |
| `nb_employes` | `integer` | — | public.entreprise.nb_employes |
| `nb_techs` | `integer` | — | public.entreprise.nb_techs |
| `secteur_id` | `uuid` | — | public.entreprise.secteur |
| `type_produit_code` | `text` | — | public.entreprise.product_type |
| `type_entreprise_code` | `text` | — | public.entreprise.type_entreprise |
| `exigence_anglais_code` | `text` | — | public.entreprise.niveau_anglais |
| `remote_code` | `text` | — | public.entreprise_remote.remote |
| `statut_relation_code` | `text` | — | public.entreprise.statut |
| `statut_contrat_code` | `text` | — | public.entreprise.statut_contrat |
| `formule_code` | `text` | — | public.entreprise.formule |
| `agence_code` | `text` | — | public.entreprise.agence |
| `recommandation_code` | `text` | — | public.entreprise.recommandation |
| `success_fee_pct` | `numeric(5,2)` | — | public.entreprise.success_fee_pct |
| `success_fee_abs` | `numeric(12,2)` | — | public.entreprise.success_fee_abs |
| `success_fee_est_absolu` | `boolean` | oui | public.entreprise.success_fee_is_absolute |
| `apport_affaires` | `boolean` | oui | public.entreprise.apport_affaires |
| `apport_affaires_pct` | `numeric(5,2)` | — | public.entreprise.apport_affaires_pct |
| `exclusivite` | `boolean` | oui | public.entreprise.exclu |
| `exclusivite_details` | `text` | — | public.entreprise.exclu_details |
| `duree_exclusivite_semaines` | `smallint` | — | public.entreprise.duree_exclusivite_semaines |
| `nb_mois_garantie` | `smallint` | — | public.entreprise.nb_mois_garantie |
| `type_garantie_code` | `text` | — | public.entreprise.garantie |
| `base_paiement_code` | `text` | — | public.entreprise.paiement |
| `date_signature_contrat` | `timestamptz` | — | public.entreprise.date_signature_contrat |
| `date_fin_contrat` | `timestamptz` | — | public.entreprise.date_fin_contrat |
| `email_facturation` | `text` | — | public.entreprise.email_facturation |
| `raison_sociale_facturation` | `text` | — | public.entreprise.nom_structure_facturation |
| `adresse_facturation` | `jsonb` | — | A_CREER |
| `account_manager_id` | `uuid` | — | public.entreprise.agent_en_charge_id |
| `hs_company_id` | `text` | — | A_CREER |
| `actif` | `boolean` | oui | A_CREER |
| `fusionnee_vers_id` | `uuid` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | public.entreprise.created_at |
| `maj_le` | `timestamptz` | oui | public.entreprise.updated_at |
| `cree_par_id` | `uuid` | — | public.entreprise.created_by |

**Relations** — 1-N → core.mandat (mandat.entreprise_id) : 533/534 mandats rattachés, 229 entreprises, max 25 mandats par entreprise, 0 orphelin, 1 mandat sans entreprise. ON DELETE RESTRICT — on ne supprime pas un client qui porte des mandats. · 1-N → core.produit (produit.entreprise_id) : 103 lignes, 56 entreprises, max 12 produits. ON DELETE CASCADE. La colonne inverse entreprise.produit_id est ABANDONNÉE (56 valeurs, force à tort un 1-1). · 1-N → core.contact_client (contact_client.entreprise_id) : lien A_CREER, dérivé par le mandat à la reprise. · 1-N → core.tag (tag.entreprise_id) : 5 lignes sur 110, 1 seule entreprise concernée. ON DELETE CASCADE. · 1-N → core.placement (placement.entreprise_id) : 226/227, 96 entreprises, max 26, 0 orphelin. · 1-N → core.candidature (candidature.entreprise_id) : 7 223/7 243, 209 entreprises, max 565, 0 orphelin, 20 lignes sans entreprise. · 1-N → core.note (note.entreprise_id) : 2 082/25 728, 76 entreprises, max 256, 0 orphelin. · N-1 → core.utilisateur (account_manager_id, ON DELETE SET NULL ; cree_par_id, ON DELETE SET NULL).

**Contraintes** — CHECK (success_fee_pct IS NULL OR success_fee_pct BETWEEN 0 AND 100) · CHECK (apport_affaires_pct IS NULL OR apport_affaires_pct BETWEEN 0 AND 100) — vacuité mesurée, la contrainte ne coûte rien · CHECK (success_fee_abs IS NULL OR success_fee_abs >= 0) · CHECK (nb_employes IS NULL OR nb_employes >= 0) et CHECK (nb_techs IS NULL OR nb_techs >= 0) · CHECK (duree_exclusivite_semaines IS NULL OR duree_exclusivite_semaines > 0) et CHECK (nb_mois_garantie IS NULL OR nb_mois_garantie >= 0) · CHECK (fusionnee_vers_id IS DISTINCT FROM id) — une fiche ne fusionne pas vers elle-même · CHECK (date_fin_contrat IS NULL OR date_signature_contrat IS NULL OR date_fin_contrat >= date_signature_contrat) — à poser NOT VALID puis à valider : la cohérence des 138 couples n'est pas mesurée · NON POSÉE : CHECK (success_fee_est_absolu ⇒ success_fee_abs IS NOT NULL). Le drapeau est vrai sur une partie des 850 lignes mais success_fee_abs n'en porte que 5 : la contrainte rejetterait des lignes existantes.

**Relations — complément restauré** — N-1 → ref.secteur (secteur_id, ON DELETE RESTRICT). · Réflexive : fusionnee_vers_id → core.entreprise(id) ON DELETE SET NULL. · PAS de lien vers core.talent : job_actuel.entreprise_id ne porte que 6 valeurs sur 7 029 et experience.entreprise_id est vide sur 7 049 lignes — l'employeur d'un talent n'existe qu'en texte libre.

**Index**

- UNIQUE (bubble_id) — provenance, NULL autorisés en nombre
- UNIQUE (hs_company_id) WHERE hs_company_id IS NOT NULL
- btree (domaine_normalise) — détection de doublons ; PAS unique, les doublons existent encore (303 fiches dormantes à traiter)
- GIN trigram (nom) — recherche globale sur 850 lignes, et rapprochement de doublons par le nom
- btree (account_manager_id) WHERE account_manager_id IS NOT NULL
- btree (secteur_id)
- btree (statut_relation_code)
- btree (actif) WHERE actif — la liste par défaut ne montre que les actifs
- btree (date_fin_contrat) WHERE date_fin_contrat IS NOT NULL — alertes d'échéance
- btree (fusionnee_vers_id) WHERE fusionnee_vers_id IS NOT NULL

<details>
<summary><b>Notes par attribut</b> (50)</summary>

- **`id`** — Convention : clé primaire uuid partout. Le miroir porte une clé texte sans défaut.
- **`bubble_id`** — NULLABLE — provenance, jamais une clé. Corrige le défaut relevé en Partie D (obligatoire: true dans correspondance.json). Rempli à 100 % sur les 850 lignes migrées, nul sur tout ce que l'application crée. UNIQUE.
- **`nom`** — Nom commercial. 841/850 renseignés (98,9 %) : 9 lignes sans nom interdisent le NOT NULL. correspondance.json le marquait obligatoire — c'est faux.
- **`raison_sociale`** — Exigé par « Vérification / enrichissement SIRET ». nom est le nom commercial, la raison sociale vient de l'API SIRENE.
- **`description`** — 94/850 (11,1 %).
- **`fondateur`** — 61/850 (7,2 %). Texte libre, pas un lien vers une personne.
- **`serie_financement`** — 55/850 (6,5 %). Renommée. Texte libre (Seed, Série A…), pas de référentiel dans le miroir.
- **`site_web`** — 259/850 (30,5 %). URL brute.
- **`domaine_normalise`** — Domaine sans schéma, sans www, sans slash final. Exigé par la détection de doublons — le matching par site_internet brut est la cause racine des doublons d'entreprises. Colonne générée ou backfillée puis maintenue par l'application.
- **`siret`** — 88/850 (10,4 %). Reste en text : 14 chiffres avec zéros de tête, jamais un nombre.
- **`video_url`** — 47/850 (5,5 %).
- **`logo_url`** — 363/850 (42,7 %). Pointe aujourd'hui le CDN Bubble — à rapatrier vers Storage au cut.
- **`note_interne`** — 51/850 (6,0 %). Renommée pour ne pas se confondre avec core.note.
- **`localisation_json`** — 121/850 (14,2 %). Payload de géocodage Bubble, conservé tel quel.
- **`localisation_texte`** — Pendant de candidat.localisations_filtre, qui n'existe pas côté entreprise. Exigé par le filtre « Lieu » du job board : sans lui le filtre lit du jsonb.
- **`nb_employes`** — 111/850 (13,1 %).
- **`nb_techs`** — 57/850 (6,7 %).
- **`secteur_id`** — 180/850 (21,2 %), 38 des 52 valeurs de ref_secteur utilisées, ZÉRO orpheline. FK → ref.secteur(secteur_id).
- **`type_produit_code`** — 145/850 (17,1 %). Référentiel ref_product_type, 9 valeurs. 5 ORPHELINES mesurées sur 16 lignes (« Hybride Hardware Software » 9, « Hybride On Premise-SaaS » 2, « Media » 2, « On-Premise » 2, « Jeux-vidéos » 1) : à mapper via ref.correspondance, pas à écraser en NULL. FK → ref.libelle(domaine='type_produit_entreprise', code).
- **`type_entreprise_code`** — VIDE À 100 % sur 850 lignes, alors que ref_company_type porte 5 valeurs (startup, scaleup, eti, corporate, vc_private_equity). Portée parce que le cadrage l'exige pour « Édition du profil entreprise », mais c'est un arbitrage : aucune donnée à perdre. FK → ref.libelle(domaine='type_entreprise', code).
- **`exigence_anglais_code`** — 63/850 (7,4 %). Renommée : la valeur est l'EXIGENCE du client, formulée du point de vue recruteur (« Mandatory all day every day »), pas un niveau de personne. FK → ref.libelle(domaine='exigence_anglais', code).
- **`remote_code`** — REPLIÉ depuis la table 1 pour 1 entreprise_remote : 58 lignes, max 1 valeur par entreprise, 0 nul. 5 valeurs distinctes pour 4 dans ref_remote → 1 orpheline (« Télétravail », 398 lignes tous consommateurs confondus) à mapper. FK → ref.libelle(domaine='remote', code).
- **`statut_relation_code`** — 831/850 (97,8 %) : Lead 743, Client 78, ✅ Qualifié 5, ❌ Non qualifié 4, ⭐️ Nouveau 1. Le miroir stocke le LIBELLÉ AVEC EMOJI comme valeur → codes lead / client / qualifie / non_qualifie / nouveau. Référentiel ref_statut_candidat partagé avec candidat.statut, sémantiques différentes. FK → ref.libelle(domaine='statut_relation_entreprise', code).
- **`statut_contrat_code`** — 194/850 (22,8 %). ref_contract_status : 5 valeurs TOUTES à emoji (« ⏳ Contrat non signé »…) → codes non_signe / envoye / signe / expire / non_requis. FK → ref.statut_contrat(code).
- **`formule_code`** — 59/850 (6,9 %). 4 valeurs, 0 orpheline, dont une phrase de 64 caractères (« Je ne sais pas encore… ») → codes recrutement_cdi / recrutement_freelance / rpo_conseil / a_discuter. FK → ref.libelle(domaine='formule_mission', code).
- **`agence_code`** — 58/850 (6,8 %). Ce n'est PAS le nom d'une agence : ce sont les 5 réponses du formulaire ref_form_41, dont une de 122 caractères. Libellé jamais stocké comme valeur. FK → ref.libelle(domaine='reponse_agence', code).
- **`recommandation_code`** — 59/850 (6,9 %). Réponses du formulaire ref_form_42 (canal de découverte) : Recommandation 26, Via LinkedIn 16, Déjà client 6, Article/podcast 6, Ancien talent 5. FK → ref.libelle(domaine='canal_decouverte', code).
- **`success_fee_pct`** — 136/850 (16,0 %). Unité : pourcentage du package annuel.
- **`success_fee_abs`** — 5/850 (0,6 %). Unité : euros. Remplissage sous 1 % → arbitrage porter/abandonner, mais 5 valeurs réelles ne se jettent pas.
- **`success_fee_est_absolu`** — 100 % rempli, NOT NULL DEFAULT false déjà dans le miroir : le NOT NULL est sûr.
- **`apport_affaires`** — 100 % rempli, NOT NULL DEFAULT false déjà dans le miroir.
- **`apport_affaires_pct`** — VIDE À 100 % sur 850 lignes. Portée par cohérence avec le drapeau apport_affaires ; arbitrage porter/abandonner. Unité : pourcentage.
- **`exclusivite`** — 100 % rempli, NOT NULL DEFAULT false déjà dans le miroir. Renommée.
- **`exclusivite_details`** — 22/850 (2,6 %).
- **`duree_exclusivite_semaines`** — 69/850 (8,1 %). Unité dans le nom.
- **`nb_mois_garantie`** — 137/850 (16,1 %). Unité dans le nom. Alimente le calcul de fin de garantie et les tâches ancrées.
- **`type_garantie_code`** — 137/850 (16,1 %). CHECK du miroir : 'Remplacement' | 'Remboursement' → codes remplacement / remboursement. FK → ref.libelle(domaine='type_garantie', code).
- **`base_paiement_code`** — 136/850 (16,0 %). CHECK du miroir : 'Sign date' | 'Start date' → codes sign_date / start_date. Détermine le fait générateur de la facturation. FK → ref.libelle(domaine='base_paiement', code).
- **`date_signature_contrat`** — 141/850 (16,6 %).
- **`date_fin_contrat`** — 138/850 (16,2 %). Alimente les alertes d'échéance contractuelle.
- **`email_facturation`** — 15/850 (1,8 %).
- **`raison_sociale_facturation`** — 11/850 (1,3 %). Entité de facturation, distincte de la raison sociale de l'entreprise cliente (groupe, holding).
- **`adresse_facturation`** — Le miroir porte email et nom de structure, aucune adresse postale. Une facture en exige une. jsonb pour porter ligne1/ligne2/CP/ville/pays sans figer un format international.
- **`account_manager_id`** — 80/850 (9,4 %), 7 valeurs distinctes, max 43 entreprises par AM, ZÉRO orpheline. FK → core.utilisateur. Renommée : agent_en_charge est le vocabulaire Bubble.
- **`hs_company_id`** — Clé stable HubSpot. Le cadrage l'écrit lui-même « hs_company_id (à ajouter) » : c'est elle qui remplace le matching par site web, cause racine des doublons. UNIQUE partiel where not null.
- **`actif`** — Absent des 107 tables du miroir alors que le cadrage le cite sur 3 fonctionnalités. Désactivation logique : une entreprise ne se supprime pas, elle sort de la liste. NOT NULL possible car la colonne est créée avec un défaut.
- **`fusionnee_vers_id`** — Trace de fusion « garde-l'original » : le doublon purgé pointe la fiche retenue, sinon l'historique de la relation est perdu. FK réflexive → core.entreprise(id) ON DELETE SET NULL.
- **`cree_le`** — 100 % rempli. ⚠ created_at du miroir est une date de SYNCHRONISATION, pas de création métier (ADR Partie A) : la valeur reprise est indicative.
- **`maj_le`** — 100 % rempli. Même réserve. Maintenue par trigger côté application.
- **`cree_par_id`** — 796/850 (93,6 %). FK → core.utilisateur ON DELETE SET NULL : l'auteur peut partir, la fiche reste.

</details>
## `core.mandat_contact_client`
LA PARTICIPATION d'un contact client à un mandat — la moitié « rencontre » de la scission de la Décision 6, et l'endroit où atterrit le défaut corrigé. ~714 lignes attendues : union des 705 liens de public.mandat_equipe et des 644 de public.equipe.mandat_id, dont 70 divergents (39 où equipe.mandat_id est nul, 31 où il désigne un AUTRE mandat). Ce n'est pas une pure table de liaison : elle porte deux attributs propres.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `bubble_id` | `text` | — | public.equipe.id |
| `mandat_id` | `uuid` | oui | public.equipe.mandat_id + public.mandat_equipe.mandat_id |
| `contact_client_id` | `uuid` | oui | public.mandat_equipe.equipe_id + public.equipe.id |
| `est_contact_principal` | `boolean` | oui | public.equipe.contact_principal |
| `type_equipe_code` | `text` | — | public.equipe.type_equipe |
| `cree_le` | `timestamptz` | oui | public.equipe.created_at |
| `maj_le` | `timestamptz` | oui | public.equipe.updated_at / A_CREER |

**Relations** — N-1 → core.mandat (mandat_id, NOT NULL, ON DELETE CASCADE) — la participation meurt avec le mandat, le contact survit. C'est exactement ce que la scission cherchait. · N-1 → core.contact_client (contact_client_id, NOT NULL, ON DELETE CASCADE). · N-1 → ref.libelle (type_equipe_code, ON DELETE RESTRICT). · Aucune relation sortante : la participation n'est référencée par rien. core.enquete_nps désigne le CONTACT et le mandat/placement séparément, pas la participation.

**Contraintes** — NON POSÉE, à mesurer d'abord : UNIQUE (mandat_id) WHERE est_contact_principal. « Au plus un contact principal par mandat » n'a PAS été mesuré ; contact_principal est rempli à 100 % en booléen et rien ne garantit qu'un mandat n'en porte pas deux. À vérifier avant de contraindre. · Pas de CHECK propre : les deux clés étrangères et l'unicité de la paire portent l'essentiel.

**Relations — complément restauré** — N-1 → core.mandat ON DELETE CASCADE · N-1 → core.contact_client ON DELETE CASCADE — la participation meurt avec la personne, mais la personne survit à la fin du mandat · La personne elle-même (nom, prénom, email, photo, métier, univers) est portée par core.contact_client, domaine du contact client — hors périmètre ici

**Contraintes — complément restauré** — Contrôle de migration obligatoire : la déduplication de l'union mandat_equipe ∪ equipe.mandat_id doit produire 768 lignes attendues ; tout écart signale un lien perdu ou dupliqué.

**Index**

- UNIQUE (mandat_id, contact_client_id)
- (contact_client_id)

<details>
<summary><b>Notes par attribut</b> (6)</summary>

- **`id`** — Clé de substitution : la liaison porte des attributs propres, elle n'est plus une simple paire.
- **`mandat_id`** — UNION des deux sources : mandat_equipe porte 705 liens, equipe.mandat_id 644, et 70 liens de mandat_equipe manquent à equipe.mandat_id (39 nuls + 31 désignant un autre mandat). Ni l'une ni l'autre ne suffit.
- **`contact_client_id`** — FK core.contact_client. 705/705, max 4 mandats par contact.
- **`est_contact_principal`** — REMONTÉ ICI depuis core.contact_client (défaut Partie D) : sur 134 personnes présentes sur plusieurs mandats, 41 sont contact principal sur certains et pas sur d'autres. Le porter sur la personne écraserait 41 distinctions réelles.
- **`role_sur_mandat`** — enum ('manager','recruteur'), issu du CHECK inline du miroir ('Manager'/'Recruteur'). Déplacé lui aussi de la personne vers la participation : 10 personnes changent de type d'équipe selon le mandat.
- **`cree_le`** — Repris de la ligne equipe d'origine quand elle existe

</details>
## `core.produit`
Le pitch produit d'une entreprise cliente, réutilisé dans l'annonce publique du mandat (« Détail offre avec contexte enrichi : équipe, produit, maturité »). 103 lignes pour 56 entreprises. Absorbe public.produit.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `bubble_id` | `text` | — | public.produit.id |
| `nom` | `text` | — | AJOUTÉ |
| `entreprise_id` | `uuid` | oui | public.produit.entreprise_id |
| `description` | `text` | — | public.produit.description |
| `texte_annonce` | `text` | — | public.produit.txt_explicatif |
| `maturite_code` | `text` | — | public.produit.maturite |
| `cree_le` | `timestamptz` | oui | public.produit.created_at |
| `maj_le` | `timestamptz` | oui | public.produit.updated_at |
| `cree_par_id` | `uuid` | — | public.produit.created_by |

**Relations** — N-1 → core.entreprise (entreprise_id, NOT NULL, ON DELETE CASCADE) — 1-N réelle mesurée, max 12 produits par entreprise. · N-1 → ref.maturite_produit (maturite_code, ON DELETE RESTRICT). · N-1 → core.utilisateur (cree_par_id, ON DELETE SET NULL). · PAS de lien inverse depuis core.entreprise : entreprise.produit_id est ABANDONNÉE (56 valeurs distinctes sur 103 produits, force un faux 1-1).

**Contraintes** — Aucun CHECK propre. Le seul invariant fort est entreprise_id NOT NULL, mesuré à 100 %. · NON POSÉE : unicité (entreprise_id, nom) — nom est un ajout non peuplé, la contrainte n'a pas de données à défendre.

**Index**

- UNIQUE (bubble_id)
- btree (entreprise_id) — la lecture réelle est « les produits de cette entreprise »
- btree (maturite_code)

<details>
<summary><b>Notes par attribut</b> (10)</summary>

- **`id`** — Convention.
- **`bubble_id`** — NULLABLE, UNIQUE. Corrige le obligatoire: true de correspondance.json.
- **`nom`** — AJOUT SIGNALÉ : le miroir n'a AUCUN nom de produit — un produit n'y est identifié que par son texte explicatif. « Gestion du/des produit(s) de l'entreprise » demande une liste ; une liste sans libellé n'est pas affichable. À arbitrer : ajouter, ou dériver du premier segment de texte_annonce.
- **`entreprise_id`** — 103/103 renseignés (100 %), 0 orpheline : le NOT NULL est SÛR. Max 12 produits par entreprise. FK → core.entreprise ON DELETE CASCADE — un produit n'existe pas sans son entreprise.
- **`description`** — VIDE À 100 % sur 103 lignes. Portée parce que le cadrage la demande en écriture, mais aucune donnée à perdre : arbitrage porter/abandonner.
- **`texte_annonce`** — 86/103 (83,5 %). Renommée : c'est le texte affiché sur l'annonce publique, pas une note interne. Seul contenu réellement rempli de la table.
- **`maturite_code`** — 84/103 (81,6 %). ref_maturite_produit : A, B, C, D, E → codes a, b, c, d, e ; valeurs mesurées B 36, C 30, A 13, D 5, E jamais utilisé. FK → ref.maturite_produit(code) ON DELETE RESTRICT.
- **`cree_le`** — 100 % rempli. Date de synchro à la reprise.
- **`maj_le`** — 100 % rempli.
- **`cree_par_id`** — 103/103 (100 %) mais laissé NULLABLE : ce que l'application créera plus tard peut être sans auteur humain. FK → core.utilisateur ON DELETE SET NULL.

</details>
## `core.tag`
Segmentation transverse candidat / entreprise / job, posée par les recruteurs. 110 lignes. Absorbe public.tag ; les satellites entreprise_tag (5 lignes, sous-ensemble strict de tag.entreprise_id) et candidat_tag (86 lignes) — le second devient la vraie table de liaison core.talent_tag.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `bubble_id` | `text` | — | public.tag.id |
| `libelle` | `text` | oui | public.tag.nom |
| `description` | `text` | — | public.tag.description |
| `portee_code` | `text` | oui | public.tag.type_tag |
| `entreprise_id` | `uuid` | — | public.tag.entreprise_id |
| `mandat_id` | `uuid` | — | public.tag.mandat_id |
| `actif` | `boolean` | oui | A_CREER |
| `ordre` | `smallint` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | public.tag.created_at |
| `maj_le` | `timestamptz` | oui | public.tag.updated_at |
| `cree_par_id` | `uuid` | — | public.tag.created_by |

**Relations** — N-1 → core.entreprise (entreprise_id, ON DELETE CASCADE) — 5 lignes sur 110. · N-1 → core.mandat (mandat_id, ON DELETE CASCADE) — 16 lignes sur 110. · N-N → core.talent via core.talent_tag (ex-candidat_tag) : 86 lignes, 41 candidats, 49 tags, max 5 tags par candidat, max 9 candidats par tag. FK déjà contrainte dans le miroir des deux côtés. · N-1 → core.utilisateur (cree_par_id, ON DELETE SET NULL). · ⚠ 89 tags sur 110 ne sont rattachés NI à une entreprise NI à un mandat : ce sont des tags globaux, ou des orphelins. À trier, pas à jeter — et cela interdit tout NOT NULL sur les deux rattachements.

**Contraintes** — CHECK (num_nonnulls(entreprise_id, mandat_id) <= 1) — un tag se rattache à au plus une chose. À poser NOT VALID puis à valider : le recouvrement des 5 entreprise_id et des 16 mandat_id n'a pas été croisé. · CHECK (ordre IS NULL OR ordre >= 0) · NON POSÉE, à vérifier d'abord : UNIQUE (lower(libelle), portee_code). Le nettoyage de taxonomie est un chantier ouvert et les doublons de libellé n'ont pas été mesurés sur tag. · NON POSÉE : cohérence portée ↔ rattachement (portee='entreprise' ⇒ mandat_id IS NULL). 89 tags sans rattachement rendent la règle inapplicable en l'état.


---

# Les personnes internes et les accès

**Index**

- UNIQUE (bubble_id)
- btree (portee_code, actif) — le sélecteur lit « les tags actifs de cette portée »
- btree (entreprise_id) WHERE entreprise_id IS NOT NULL
- btree (mandat_id) WHERE mandat_id IS NOT NULL
- btree (ordre) — 110 lignes, l'index sert surtout à figer l'ordre de tri

<details>
<summary><b>Notes par attribut</b> (12)</summary>

- **`id`** — Convention.
- **`bubble_id`** — NULLABLE, UNIQUE. Corrige le obligatoire: true de correspondance.json.
- **`libelle`** — 110/110 (100 %) : le NOT NULL est SÛR. Renommée depuis nom. Un tag est une entité à identifiant propre, pas un référentiel — son libellé est un attribut, il n'est jamais stocké comme valeur ailleurs, la règle du code stable ne s'applique donc pas.
- **`description`** — VIDE À 100 % sur 110 lignes. Arbitrage porter/abandonner : aucune donnée à perdre, mais l'éditeur de tags du backoffice la demande.
- **`portee_code`** — 110/110 (100 %) : NOT NULL sûr. CHECK du miroir : 'Candidat' | 'Entreprise' | 'Job' → codes candidat / entreprise / job. Renommée depuis type_tag : la colonne dit sur QUOI le tag se pose, pas de quelle sorte il est. FK → ref.libelle(domaine='portee_tag', code) ON DELETE RESTRICT.
- **`entreprise_id`** — 5/110 (4,5 %), 1 seule entreprise concernée, 0 orpheline. FK → core.entreprise ON DELETE CASCADE.
- **`mandat_id`** — 16/110 (14,5 %), 4 mandats distincts, max 7 tags par mandat, 0 orpheline. FK → core.mandat ON DELETE CASCADE.
- **`actif`** — « Un tag ne peut être retiré de la liste sans être supprimé, donc sans casser ses rattachements. » Mise hors ligne sans perte.
- **`ordre`** — Ordre d'affichage dans le sélecteur de tags. Le miroir n'a pas de sort_order sur tag.
- **`cree_le`** — 100 % rempli.
- **`maj_le`** — 100 % rempli.
- **`cree_par_id`** — 108/110 (98,2 %) : 2 lignes sans auteur interdisent le NOT NULL. FK → core.utilisateur ON DELETE SET NULL.

</details>
## `app.acces`
UNE LIGNE PAR CONTEXTE. Un accès rattache un compte à exactement une personne — une fiche talent, un contact client ou un collaborateur — et c'est lui, jamais la personne, qui porte les droits. Un candidat placé qui devient responsable de recrutement chez son nouvel employeur ajoute une ligne : rien de ce qui existait ne bouge. Corollaire : être un talent ne donne pas l'accès talent.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `compte_id` | `uuid` | oui | A_CREER — une ligne par (public.user_role.user_id, rôle) ; c'est ici qu'atterrit user_role.user_id, que le détail ne nommait pas |
| `fiche_talent_id` | `uuid` | — | A_CREER (rapprochement depuis public.user.candidat_id, 4 158 valeurs / 4 156 distinctes) |
| `contact_client_id` | `uuid` | — | A_CREER — reconstruit par l'e-mail, PUIS confirmé par public.user.entreprise_id (344 valeurs), qui sert de source de rapprochement sans devenir une colonne |
| `collaborateur_id` | `uuid` | — | A_CREER (dérivé des 41 lignes internes de public.user_role) |
| `portail` | `app.portail (enum : talent, entreprise, recruteur, backoffice) — NOT NULL, DÉCLARÉ` ⚠️ [ADR 0004](decisions/0004-quatre-portails.md) : plus généré depuis le 09/09 | oui | A_CREER |
| `role_interne` | `app.role_interne (enum : admin, recruteur, support)` | — | public.user_role.role [valeur_vers_referentiel], restreint aux 3 codes internes |
| `actif` | `boolean` | oui | A_CREER |
| `cle_correspondance` | `text` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `cree_par_compte_id` | `uuid` | — | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 vers app.compte ON DELETE CASCADE. · N-1 vers core.fiche_talent ON DELETE CASCADE — la fiche effacée emporte l'accès. · N-1 vers core.contact_client ON DELETE CASCADE — les 2 personnes intervenant pour deux entreprises ne sont plus un cas particulier : deux lignes de contact, deux lignes d'accès, un seul compte. · N-1 vers core.collaborateur ON DELETE CASCADE. · N-1 vers app.compte (cree_par_compte_id) ON DELETE SET NULL. · Le lien d'identité entre casquettes NE PASSE PAS par ici (Décision 5) : sur les 11 contacts qui sont aussi candidats, 8 n'ont pas de compte. Le lien vit entre les personnes — contact_client.talent_id, collaborateur.talent_id, apporteur_affaires.talent_id. · C'est cette table que lisent api.auth_role() et api.auth_entreprise_id() ; entreprise_id se résout par jointure sur contact_client.

**Contraintes** — CHECK (num_nonnulls(fiche_talent_id, contact_client_id, collaborateur_id) = 1) — EXACTEMENT une des trois. C'est la contrainte centrale de la Décision 4 : la base peut vérifier trois liens, elle ne pourrait pas vérifier un couple « type + identifiant ». · ~~CHECK ((collaborateur_id IS NOT NULL) = (role_interne IS NOT NULL))~~ — remplacée le 09/09 par `acces_portail_coherent` et `acces_role_selon_portail`, qui lient le portail à la personne et le rôle au portail ([ADR 0004](decisions/0004-quatre-portails.md)). · FOREIGN KEY (compte_id) REFERENCES app.compte(id) ON DELETE CASCADE · FOREIGN KEY (fiche_talent_id) REFERENCES core.fiche_talent(id) ON DELETE CASCADE · FOREIGN KEY (contact_client_id) REFERENCES core.contact_client(id) ON DELETE CASCADE · FOREIGN KEY (collaborateur_id) REFERENCES core.collaborateur(id) ON DELETE CASCADE · FOREIGN KEY (cree_par_compte_id) REFERENCES app.compte(id) ON DELETE SET NULL · RLS activée, policies fondées sur portail et role_interne. Rappel du défaut de Partie D : tant que la production expose public, graphql_public, avant_garde_dev, avant_garde et pivot, une vue api en security_invoker ne protège rien — la restriction de l'exposition au seul schéma api conditionne tout ce dispositif.

**Index**

- btree (compte_id) — lu à chaque requête authentifiée, c'est l'index le plus chaud du schéma app
- btree (portail, role_interne) WHERE actif — la matrice de permissions du jalon 6
- UNIQUE (fiche_talent_id) WHERE fiche_talent_id IS NOT NULL
- UNIQUE (contact_client_id) WHERE contact_client_id IS NOT NULL
- UNIQUE (collaborateur_id) WHERE collaborateur_id IS NOT NULL
- UNIQUE (compte_id) WHERE fiche_talent_id IS NOT NULL — un compte a au plus un accès talent
- UNIQUE (compte_id) WHERE collaborateur_id IS NOT NULL — un compte a au plus un accès interne ; plusieurs accès entreprise restent permis (une personne, deux contacts, deux clients)

<details>
<summary><b>Notes par attribut</b> (11)</summary>

- **`id`** — Clé primaire.
- **`compte_id`** — Le compte auquel cet accès appartient. NOT NULL : un accès sans compte n'a aucun sens, et la table est créée vide — aucune ligne de production à rejeter.
- **`fiche_talent_id`** — Contexte TALENT. Pointe la FICHE (l'enregistrement modifiable de l'application), pas la projection core.talent : ce que le titulaire édite va dans la fiche. ⚠ La migration ne peut pas se faire par cette colonne seule — un compte n'existe que si une identité Supabase existe, or aucune n'est rattachée aujourd'hui.
- **`contact_client_id`** — Contexte ENTREPRISE. ⚠ Mesuré (Décision 6) : le lien entre un compte client et sa fiche de contact N'EXISTE PAS et ne peut pas exister dans le miroir — equipe porte un email, user n'en porte aucun. La reconstruction passe par l'e-mail, seule clé possible, et c'est une clé faible. L'entreprise se lit par jointure sur contact_client.entreprise_id : pas de colonne entreprise_id ici, ce serait une seconde vérité.
- **`collaborateur_id`** — Contexte INTERNE. Les 41 lignes (Admin 10, Recruiter Core Team 13, Recruiter Support Crew 18).
- **`portail`** — ⚠️ **N'EST PLUS CALCULÉ depuis le 09/09** ([ADR 0004](decisions/0004-quatre-portails.md)) : `recruteur` et `backoffice` naissent tous deux d'un collaborateur, la déduction est donc impossible. La colonne est déclarée, NOT NULL, et sa cohérence tenue par `acces_portail_coherent`. Le raisonnement d'origine, conservé pour mémoire : le premier axe de rôle est « porté par la nature du rattachement » : plutôt que de le saisir et risquer la divergence, on le calcule. CASE WHEN fiche_talent_id IS NOT NULL THEN 'talent' WHEN contact_client_id IS NOT NULL THEN 'entreprise' WHEN collaborateur_id IS NOT NULL THEN 'interne' END. Une colonne générée est indexable et lisible par une policy RLS ; elle n'est pas modifiable, ce qui est exactement la propriété recherchée.
- **`role_interne`** — ⚠️ **CHANGE DE SENS le 09/09** ([ADR 0004](decisions/0004-quatre-portails.md)) : ce n'est plus le pouvoir — le pouvoir, c'est le portail. C'est la graduation À L'INTÉRIEUR d'un portail interne : `recruteur`/`support` sur `recruteur`, `admin`/`superadmin` sur `backoffice`. Le raisonnement d'origine, conservé pour mémoire : le second axe : le pouvoir. Correspondance des libellés du miroir vers les codes stables — « Admin » -> admin, « Recruiter Core Team » -> recruteur, « Recruiter Support Crew » -> support ; « Candidat » et « Entreprise » ne deviennent PAS des pouvoirs, ils sont absorbés par portail. Chaque paire est tracée dans ref.correspondance(referentiel, libelle_miroir) -> code_cible, y compris pour les valeurs abandonnées. Nul obligatoirement hors du portail interne : sans deux axes, « le support voit les mêmes candidatures mais ne peut pas les modifier » n'est pas dicible.
- **`actif`** — Ce contexte est ouvert. On révoque un accès sans toucher au compte, ni aux autres casquettes de la même personne.
- **`cle_correspondance`** — AJOUT, DÉPLACÉ depuis app.compte où correspondance.json le plaçait. Le rattachement se fait par accès, donc sa trace aussi. Contenu : par quoi le rapprochement a été résolu — 'candidat.email_perso', 'equipe.email', 'manuel'. Critère J2 : le rapport doit lister nominativement les non-résolus, et la reprise doit être rejouable.
- **`cree_le`** — C'est le rattache_le de correspondance.json — pas deux colonnes pour un fait.
- **`cree_par_compte_id`** — C'est le rattache_par de correspondance.json. Nul quand l'accès naît d'une reprise automatique ou d'une auto-inscription.

</details>
## `app.compte`
L'identité d'authentification, et rien d'autre. Elle ne porte ni personne, ni entreprise, ni droit : elle porte auth_id et actif. Supabase Auth est indexé sur l'e-mail, donc UNE PERSONNE A UN COMPTE ET UN SEUL — « deux comptes pour la même personne » n'est pas une option qu'on écarte, c'est une option qui n'existe pas. Une personne sans compte n'a aucune ligne ici, et c'est le cas majoritaire : 87 % des talents n'ont pas de compte.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `auth_id` | `uuid` | — | A_CREER (public.user.auth_id est ABANDONNÉE) |
| `actif` | `boolean` | oui | A_CREER |
| `desactive_le` | `timestamptz` | — | A_CREER |
| `derniere_connexion_le` | `timestamptz` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — 1-1 optionnel vers auth.users : compte.auth_id -> auth.users(id) ON DELETE CASCADE. C'est la seule clé étrangère hors des quatre schémas, et elle est légitime : auth n'est pas public, il n'est pas réécrit par la synchro n8n et truncate_data_tables() ne le touche pas. Si un utilisateur Supabase est supprimé, le compte et ses accès partent avec. · 1-N vers app.acces (ON DELETE CASCADE) — le compte est le parent, l'accès porte le contexte. · Référencé par app.journal_ecriture.auteur_compte_id, app.acces.cree_par_compte_id, app.audit_admin.acteur_auth_id. · NE PORTE PAS entreprise_id, candidat_id ni talent_id, contrairement à ce que propose correspondance.json. Ces trois colonnes remontaient les droits sur le compte ; elles descendent sur app.acces, une ligne par contexte. Sans cette descente, une candidate devenue cliente verrait, côté client, les notes que les recruteurs ont écrites sur elle quand elle était candidate. · NE PORTE PAS role : les cinq valeurs de correspondance.json (talent / entreprise / recruteur / admin / superadmin) mélangent les deux axes. Le portail est porté par la nature du rattachement de l'accès, le pouvoir interne par acces.role_interne.

**Contraintes** — FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE · CHECK (actif OR desactive_le IS NOT NULL) — un compte désactivé porte la date de sa désactivation · « Un compte sans accès est impossible » (Décision 4) N'EST PAS exprimable par une contrainte de table : c'est un cycle insertion compte -> insertion accès. À poser en CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED sur app.compte, doublé d'une vue de contrôle api.v_compte_sans_acces. C'est cette règle qui règle les 104 comptes rattachés à rien du miroir.

**Index**

- UNIQUE (auth_id) — NULL multiples admis pour les comptes pré-provisionnés
- btree (actif) WHERE NOT actif — la liste des comptes désactivés est une vue de back-office

<details>
<summary><b>Notes par attribut</b> (5)</summary>

- **`id`** — Clé primaire propre, distincte de auth_id. correspondance.json proposait auth_id comme clé primaire : à rejeter, puisque auth_id doit pouvoir être nul le temps du pré-provisionnement (voir ci-dessous).
- **`auth_id`** — NULLABLE, et c'est la mesure qui l'impose : public.user.auth_id est VIDE sur les 4 605 lignes, et seuls 7 comptes d'authentification existent aujourd'hui. Un compte pré-provisionné (collaborateur migré, invitation envoyée) n'a pas encore d'identité Supabase ; auth_id se remplit à la première connexion. C'est ce qui rend la migration des 41 accès internes possible sans créer 41 comptes auth à la main. UNIQUE — les NULL multiples sont admis, donc plusieurs comptes en attente coexistent sans conflit.
- **`actif`** — Critère d'acceptation J2 : « quand un compte est désactivé, alors il obtient zéro ligne sur toutes les routes privées ». Sens : peut se connecter. À distinguer de collaborateur.actif (est dans l'annuaire) et de acces.actif (ce contexte est ouvert).
- **`desactive_le`** — AJOUT. Quand actif est passé à false. Le qui est dans app.audit_admin.
- **`derniere_connexion_le`** — AJOUT. Duplique auth.users.last_sign_in_at mais reste lisible sans droit sur le schéma auth, que les vues api ne peuvent pas traverser.

</details>
## `app.idempotence`
Garantir qu'une écriture rejouée ne produit qu'un seul effet, et renvoie le MÊME résultat — pas seulement « ne rien faire ». Critère d'acceptation explicite des jalons 3, 4 et 6.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `cle` | `text` | oui | A_CREER |
| `compte_id` | `uuid` | — | A_CREER |
| `empreinte_charge` | `text` | oui | A_CREER |
| `resultat` | `jsonb` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `expire_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 vers app.compte ON DELETE CASCADE — les clés d'un compte supprimé n'ont plus de porteur. · Aucun lien vers le métier : la table ne connaît que des clés et des empreintes, jamais l'entité écrite. C'est ce qui lui permet de servir les trois jalons sans être modifiée.

**Contraintes** — FOREIGN KEY (compte_id) REFERENCES app.compte(id) ON DELETE CASCADE · CHECK (expire_le > cree_le) · Purge : une tâche planifiée supprime WHERE expire_le < now(). Sans purge la table croît indéfiniment et son index primaire devient le coût de chaque écriture.

**Index**

- PRIMARY KEY (cle)
- btree (expire_le) — la purge périodique, seule requête de balayage sur cette table
- btree (compte_id) WHERE compte_id IS NOT NULL

<details>
<summary><b>Notes par attribut</b> (5)</summary>

- **`cle`** — Clé primaire, fournie par le client (en-tête Idempotency-Key). Une intention d'écriture, une clé.
- **`compte_id`** — AJOUT, non prévu par correspondance.json. Sans portée par compte, une clé devinée par un tiers permet de lire le résultat d'une écriture qui ne lui appartient pas — resultat est un jsonb de données métier. Nullable pour les écritures système sans compte.
- **`empreinte_charge`** — Hash SHA-256 du payload. Sert à distinguer un vrai rejeu (même clé, même charge -> on renvoie resultat) d'un conflit (même clé, charge différente -> 409). Sans lui, la clé seule laisserait passer une écriture différente sous couvert de rejeu.
- **`resultat`** — Nul tant que l'écriture n'a pas abouti — la ligne est posée AVANT l'opération pour verrouiller la clé. Peut contenir des données personnelles selon l'écriture : à couvrir par l'anonymisation de la base de dev, au même titre que le journal.
- **`expire_le`** — Une clé d'idempotence n'a de sens que sur la fenêtre où un client peut raisonnablement rejouer. La fenêtre de 24 h est une proposition, pas une mesure : à confirmer contre le comportement réel de la file de retry du dual-write.

</details>
## `app.journal_ecriture`
Le journal : ce qui a changé, quand, par qui, depuis quelle valeur. Un seul journal, pas deux — l'historique de la fiche talent y passe aussi, une vue le filtre pour l'affichage ; deux mécanismes de journalisation divergeraient, c'est la leçon du bug employeur_actuel_src. ⚠ IL PORTE DES DONNÉES PERSONNELLES : valeur_avant et valeur_apres contiennent noms, coordonnées, salaires et appréciations. Il entre donc dans le périmètre du droit à l'effacement ET dans celui de l'anonymisation de la base de dev.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `bigint GENERATED ALWAYS AS IDENTITY` | oui | A_CREER |
| `lot_id` | `uuid` | oui | A_CREER |
| `entite` | `text` | oui | A_CREER |
| `entite_id` | `uuid` | oui | A_CREER |
| `champ` | `text` | — | A_CREER |
| `valeur_avant` | `jsonb` | — | A_CREER |
| `valeur_apres` | `jsonb` | — | A_CREER |
| `operation` | `text` | oui | A_CREER |
| `origine` | `app.origine_valeur (enum : declare, recruteur, pre_rempli, import, automatique)` | oui | A_CREER |
| `auteur_compte_id` | `uuid` | — | A_CREER |
| `survenu_le` | `timestamptz` | oui | A_CREER |
| `cible_ats` | `text` | — | A_CREER |
| `statut_http` | `smallint` | — | A_CREER |
| `etat` | `text` | — | A_CREER |

**Relations** — N-1 vers app.compte (auteur_compte_id) ON DELETE SET NULL. Pas de cascade : effacer l'AUTEUR ne doit pas effacer le journal — c'est l'effacement du SUJET qui l'emporte, et le sujet n'est pas atteignable par une clé étrangère. · Aucune clé étrangère sur (entite, entite_id) : la référence est volontairement polymorphe et textuelle, sans quoi le journal serait détruit par la disparition de ce qu'il journalise. · Une vue api filtrée alimente l'historique de la fiche talent. ⚠ OUVERT : cette vue est-elle montrée au candidat ? « Le recruteur a changé votre prétention de 60 à 55 » ouvre une conversation qui n'est pas toujours celle qu'on veut. Décision de produit, à prendre AVANT d'exposer la vue.

**Contraintes** — CHECK (operation IN ('insert','update','delete')) · CHECK (origine <> 'automatique' OR auteur_compte_id IS NULL) — contrainte à sens unique : automatique implique sans auteur, mais un import peut très bien en avoir un · CHECK (operation <> 'update' OR champ IS NOT NULL) — une modification sait quel champ elle a touché · CHECK (statut_http IS NULL OR statut_http BETWEEN 100 AND 599) · FOREIGN KEY (auteur_compte_id) REFERENCES app.compte(id) ON DELETE SET NULL · RGPD — À TRAITER EXPLICITEMENT, ce n'est pas une contrainte de base : (1) l'effacement d'une personne doit emporter son historique, or il n'y a pas de FK donc pas de ON DELETE CASCADE ; il faut une procédure de purge sur (entite, entite_id) déclenchée par app.demande_rgpd, sur le modèle du ON DELETE CASCADE de pivot.conflit, qualifié de « décision de conformité avant d'être une décision d'intégrité ». (2) L'anonymisation de la base de dev doit couvrir valeur_avant et valeur_apres — c'est typiquement ce qu'on oublie. (3) RLS stricte : aucun accès de portail talent ou entreprise ne lit cette table en direct, uniquement la vue filtrée.

**Index**

- btree (entite, entite_id, survenu_le DESC) — l'historique d'une ligne, et le prédicat de la purge RGPD
- btree (lot_id) — recomposer une écriture
- btree (auteur_compte_id, survenu_le DESC) WHERE auteur_compte_id IS NOT NULL — « qu'a fait cet utilisateur »
- BRIN (survenu_le) — table en append pur, la purge par ancienneté et les fenêtres temporelles n'ont pas besoin d'un btree complet
- btree (etat) WHERE etat IN ('echoue','en_file') — la file de retry du dual-write

<details>
<summary><b>Notes par attribut</b> (14)</summary>

- **`id`** — Clé primaire. Seule entité du domaine à ne pas être en uuid : c'est un journal en append massif, l'ordre d'insertion est une information et le poids de l'index compte.
- **`lot_id`** — AJOUT. Regroupe les lignes issues d'UNE MÊME écriture. Le grain imposé est le champ (une ligne par champ modifié) ; sans lot_id, une modification de fiche à quinze champs devient quinze lignes sans lien, et les colonnes de dual-write ci-dessous seraient recopiées quinze fois.
- **`entite`** — Nom qualifié de la table visée, ex. 'core.fiche_talent'. Référence textuelle et non FK : le journal survit à l'entité journalisée, c'est sa raison d'être.
- **`entite_id`** — Identifiant de la ligne visée. Pas de clé étrangère — donc pas de cascade : l'effacement du sujet passe par une procédure explicite sur (entite, entite_id), voir contraintes.
- **`champ`** — Nul sur une opération insert ou delete, qui portent la ligne entière et non un champ.
- **`valeur_avant`** — jsonb et non text : préserve le type et distingue le nul de la chaîne vide, distinction qui décide de la préséance. Nul sur un insert. DONNÉE PERSONNELLE.
- **`valeur_apres`** — Nul sur un delete. DONNÉE PERSONNELLE.
- **`operation`** — insert / update / delete. Exigé par « Journal d'audit » (fonctionnalité EXISTANTE).
- **`origine`** — Les cinq origines de la Décision 3. Codes stables sans accent ni emoji, libellés affichables portés par ref.libelle. ⚠ La granularité de pre_rempli est plafonnée par ce que le pivot sait : il ne connaît la source que de quatre champs (prénom, nom, localisation, employeur) et zéro sur attentes et qualification. Sur les autres champs, l'origine ne pourra dire que « pré-rempli depuis la base talent », sans distinguer Jarvi de l'app.
- **`auteur_compte_id`** — Nul si origine = automatique. Pointe app.compte(id) et non auth.users : un compte pré-provisionné a un id avant d'avoir un auth_id, et correspondance.json pointait auth_id — inexploitable dans ce cas.
- **`survenu_le`** — Horodatage exigé par le jalon 4.
- **`cible_ats`** — AJOUT, hérité de correspondance.json. Endpoint Bubble appelé par le dual-write. Piège documenté au J6 : le report doit passer par app.pachamama-collective.com et JAMAIS par l'alias, qui redirige en 301 et transforme un POST en GET silencieusement. Renseigné une fois par lot, nul sur les autres lignes du lot.
- **`statut_http`** — AJOUT. 201 attendu. Même remarque de grain : porté au niveau du lot.
- **`etat`** — AJOUT. applique / echoue / en_file / rejoue. Exigé par « Observabilité du dual-write & file de retry » (must).

</details>
## `core.apporteur_affaires`
La casquette « apporteur d'affaires ou cooptant » — 20 lignes. Elle NE RECOPIE PLUS L'IDENTITÉ : le décalque duplique prénom, nom, e-mail et photo d'une personne déjà présente dans candidat. Elle ne porte plus que ce qui est propre à la casquette — la structure, le SIRET, les conditions de commission — et le lien vers le talent (15 sur 20).

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `bubble_id` | `text` | — | public.business_maker.id |
| `talent_id` | `uuid` | — | public.business_maker.candidat_id |
| `raison_sociale` | `text` | — | public.business_maker.company_label [renommée] |
| `siret` | `text` | — | public.business_maker.siret |
| `taux_commission_pct` | `numeric(5,2)` | — | A_CREER |
| `conditions_texte` | `text` | — | A_CREER |
| `nom_affichage` | `text` | — | public.business_maker.prenom + public.business_maker.nom [fusionnées] |
| `email_contact` | `text` | — | public.business_maker.email |
| `cree_le` | `timestamptz` | oui | public.business_maker.created_at |
| `maj_le_source` | `timestamptz` | — | public.business_maker.updated_at |
| `maj_le` | `timestamptz` | oui | A_CREER |
| `cree_par_collaborateur_id` | `uuid` | — | public.business_maker.created_by |

**Relations** — N-1 vers core.talent : apporteur_affaires.talent_id -> core.talent(id) ON DELETE SET NULL. PAS de cascade : un apporteur est une contrepartie contractuelle, son enregistrement ne doit pas disparaître parce que la projection du pivot s'est rafraîchie ou parce que la personne a été effacée côté talent. La ligne survit orpheline et une vue de contrôle la signale. · N-1 vers core.collaborateur (cree_par_collaborateur_id) ON DELETE SET NULL. · ⚠ Lien inverse à réconcilier : core.talent.apporteur_affaires_id vient de candidat.business_maker_id, rempli sur 14 lignes / 7 028 (0,2 %). Deux sens pour une même relation, l'un à 15 valeurs et l'autre à 14 : cardinalites.json tranche « un seul sens conservé » sans dire lequel. À arbitrer. · ABANDONS signalés : prenom, nom, email et picture_url du miroir ne sont plus recopiés (Décision 5). picture_url (50 % rempli) disparaît sans compensation — la photo se lit sur core.talent.

**Contraintes** — FOREIGN KEY (talent_id) REFERENCES core.talent(id) ON DELETE SET NULL · FOREIGN KEY (cree_par_collaborateur_id) REFERENCES core.collaborateur(id) ON DELETE SET NULL · CHECK (taux_commission_pct IS NULL OR taux_commission_pct BETWEEN 0 AND 100) · CHECK (talent_id IS NOT NULL OR nom_affichage IS NOT NULL) — uniquement si l'ajout conditionnel est retenu : interdit une ligne d'apporteur sans aucune identité. Si l'arbitrage retient la création des 5 talents au pivot, cette contrainte devient CHECK (talent_id IS NOT NULL) et les deux colonnes disparaissent. · PAS d'unicité sur talent_id : max 2 apporteurs mesurés pour un même talent.

**Index**

- UNIQUE (bubble_id)
- btree (talent_id) WHERE talent_id IS NOT NULL
- btree (lower(email_contact)) WHERE email_contact IS NOT NULL — uniquement si l'ajout conditionnel est retenu

<details>
<summary><b>Notes par attribut</b> (13)</summary>

- **`id`** — Clé primaire.
- **`bubble_id`** — Provenance. NULLABLE — correction du défaut relevé en Partie D : correspondance.json la marque obligatoire: true sur core.apporteur_affaires.
- **`talent_id`** — 15 sur 20 (75 %), confirmé par une seconde voie : 15 des 18 apporteurs ayant un e-mail correspondent à un candidat. Facultatif : 5 apporteurs ne sont pas des candidats. NON UNIQUE — cardinalites.json mesure « max 2 apporteurs pour 1 talent ».
- **`raison_sociale`** — 1 valeur sur 20 (5 %). La structure par laquelle l'apport est facturé.
- **`siret`** — 1 valeur sur 20 (5 %). text et non numeric : un SIRET est un identifiant, pas un nombre — 14 caractères à zéros significatifs.
- **`taux_commission_pct`** — AJOUT. Les « conditions » exigées par la Décision 5 n'existent nulle part dans le miroir : business_maker n'a aucune colonne de commission, entreprise.apport_affaires_pct est VIDE à 100 %, et mandatclose.business_maker_deal_id / business_maker_coo_id sont remplis à 7 % et 0,9 %. Unité : pourcentage du honoraire, 0 à 100. Les montants par affaire restent dans core.repartition_commission — ici ce sont les conditions permanentes.
- **`conditions_texte`** — AJOUT. Les conditions qui ne sont pas un taux (plafond, durée, exclusivité). Exigé par « Apporteurs d'affaires & cooptation » et « Calcul & suivi des commissions sur mandats clos ».
- **`nom_affichage`** — AJOUT CONDITIONNEL — n'existe QUE si l'arbitrage refuse de créer au pivot les 5 personnes manquantes. Sans lui, les 5 apporteurs sans talent_id deviennent des lignes anonymes portant des conditions de commission. Renseigné uniquement quand talent_id est nul ; pour les 15 autres, l'identité se lit sur core.talent.
- **`email_contact`** — AJOUT CONDITIONNEL, même arbitrage que nom_affichage. 19 valeurs sur 20 (95 %). C'est la seule voie de contact et la clé du rapprochement (15 des 18 e-mails correspondent à un candidat). Renseigné uniquement quand talent_id est nul.
- **`cree_le`** — 100 % rempli.
- **`maj_le_source`** — Horodatage du miroir, distinct de maj_le.
- **`maj_le`** — Posé par l'application.
- **`cree_par_collaborateur_id`** — 100 % rempli (20/20). Renommée en _collaborateur_id : la cible du lien est explicite. ⚠ Aucune mesure d'orphelinage n'existe pour les colonnes created_by du miroir (cardinalites.json ne les couvre pas) — à vérifier avant de poser la FK.

</details>
## `core.collaborateur`
La personne qui travaille chez Pachamama — ~41 lignes. C'est `public.user` amputé de ses 4 211 candidats et de ses 345 contacts client : la table du miroir n'est pas la table des employés, c'est la table de tout le monde. Le périmètre repris est celui des 41 lignes de `user_role` portant Admin (10), Recruiter Core Team (13) ou Recruiter Support Crew (18). Elle ne porte AUCUN droit — le pouvoir interne vit sur `app.acces`.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `bubble_id` | `text` | — | public.user.id |
| `nom` | `text` | — | public.user.nom |
| `prenom` | `text` | — | public.user.prenom |
| `email` | `text` | — | A_CREER |
| `photo_url` | `text` | — | public.user.photo_url |
| `fonction` | `ref.fonction_user (enum : career_agent, recruiter)` | — | public.user.fonction |
| `langue` | `ref.langue (enum : fr_fr, en_us)` | — | public.user.langue + public.user.user_lang [fusionnées] |
| `talent_id` | `uuid` | — | public.user.candidat_id (restreint aux 41 internes) |
| `actif` | `boolean` | oui | A_CREER |
| `est_supprime` | `boolean` | oui | public.user.is_deleted |
| `premiere_connexion_le` | `timestamptz` | — | public.user.premiere_connexion_at |
| `derniere_connexion_le` | `timestamptz` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | public.user.created_at |
| `maj_le_source` | `timestamptz` | — | public.user.updated_at |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — N-1 vers core.talent : collaborateur.talent_id -> core.talent(id) ON DELETE SET NULL. Le collaborateur survit à la disparition de la projection (rafraîchissement du pivot, effacement RGPD côté talent) — il reste un employé. · 1-N vers core.collaborateur_univers (rattachement aux univers). Voir l'entité suivante : le repli en colonne annoncé par la Décision 4 est IMPOSSIBLE, mesure à l'appui. · Référencé par app.acces.collaborateur_id (ON DELETE CASCADE) — c'est le seul chemin vers un compte et vers des droits. · Référencé comme agent/auteur par de nombreuses colonnes d'autres domaines : candidat.agent_pachamama_id (16 valeurs distinctes), candidat_expanded.agent_id (30), entreprise.agent_en_charge_id (7), mandat.account_manager_id (9) / agent_2_id (9) / personne_en_charge_id (32), mandatclose.agent_filtre_id (23) / agent_2_filtre_id (5), task.assigned_user_id (22) / creation_user_id (19) / update_user_id (12). Toutes tiennent sous 41 valeurs distinctes : la restriction aux internes ne les casse PAS. · ⚠ EXCEPTION MESURÉE : note.user_id porte 2 103 valeurs distinctes et note_archivee.user_id 1 958, pour 25 663 et 24 712 lignes. Une FK auteur -> collaborateur (41 lignes) orphelinerait plus de 2 000 auteurs. Ce lien ne peut pas viser collaborateur seul — voir points à arbitrer. · AUCUNE clé étrangère vers public : le miroir est réécrit toutes les quinze minutes et truncate_data_tables() existe.

**Contraintes** — CHECK (NOT (est_supprime AND actif)) — un collaborateur supprimé logiquement ne peut pas être actif. À vérifier avant pose : actif est créé à la migration, le seed doit être actif = NOT est_supprime. · FOREIGN KEY (talent_id) REFERENCES core.talent(id) ON DELETE SET NULL · PAS de contrainte NOT NULL sur nom/prenom/email malgré l'évidence métier : non mesuré sur les 41, et l'e-mail n'existe nulle part dans le miroir.

**Index**

- UNIQUE (bubble_id) — provenance ; PostgreSQL admet les NULL multiples, donc l'unicité n'interdit pas les lignes créées par l'application
- UNIQUE btree (lower(email)) WHERE email IS NOT NULL — clé de rapprochement avec auth.users, insensible à la casse
- btree (talent_id) WHERE talent_id IS NOT NULL — 3 lignes, mais c'est la jointure de la casquette
- btree (actif) WHERE actif — l'annuaire interne ne lit que les actifs
- btree (nom, prenom) — recherche d'un collaborateur (fonctionnalité « Recherche d'un user »)

<details>
<summary><b>Notes par attribut</b> (16)</summary>

- **`id`** — Clé primaire. Le miroir porte un id text sans défaut : l'application ne peut pas créer une ligne.
- **`bubble_id`** — PROVENANCE, jamais une clé. NULLABLE — correction du défaut relevé en Partie D (correspondance.json le marque obligatoire sur core.utilisateur). Nul pour tout collaborateur créé par l'application après le cut. UNIQUE, les NULL multiples étant admis par PostgreSQL.
- **`nom`** — 98,3 % rempli sur les 4 605 lignes du miroir. Le taux sur le sous-ensemble des 41 internes n'a PAS été mesuré : par application de la règle « aucun NOT NULL sur une colonne qui porte des vides », nullable. À re-mesurer sur les 41 avant de durcir.
- **`prenom`** — 98,4 % rempli. Même raisonnement que nom.
- **`email`** — AJOUT. Mesuré : les 18 colonnes de public.user ne comportent AUCUNE adresse e-mail — elle vit dans auth.users, vide côté app. Exigé par « Annuaire utilisateurs internes » et « Provisioning & cycle de vie des comptes », et c'est la seule clé de rapprochement possible avec Supabase Auth. Nullable car aucune valeur n'est migrable : les 41 adresses sont à saisir à la main.
- **`photo_url`** — 22,1 % rempli.
- **`fonction`** — 4 valeurs sur 4 605 lignes (0,1 %). Référentiel ref_fonction : 2 lignes, codes DÉJÀ propres, libellés fr/en portés par ref.libelle. Ce n'est pas un référentiel inutile, c'est un formulaire non rempli. Ne pas confondre avec le pouvoir interne, qui est sur l'accès.
- **`langue`** — Deux colonnes du miroir pour un seul fait : 2 052/4 605 chacune, même distribution, 100 % fr_fr, en_us jamais utilisé. Fusionnées en une. ATTENTION : ces 2 052 valeurs sont majoritairement portées par des candidats et des contacts, qui n'ont plus de ligne ici — voir points à arbitrer.
- **`talent_id`** — Décision 5 : la casquette. 3 collaborateurs sont aussi des talents. Facultatif dans les deux sens. Pointe la PROJECTION core.talent, pas la fiche : le lien est d'identité, pas d'enregistrement applicatif.
- **`actif`** — AJOUT. « Flag Actif / désactivation logique des comptes » est un must du cadrage et n'a jamais existé côté miroir. Sens : la personne est encore dans l'annuaire interne (offboarding). À ne pas confondre avec app.compte.actif (peut se connecter) ni app.acces.actif (ce contexte est ouvert). NOT NULL admissible car la colonne est créée avec un défaut, elle ne porte aucun vide.
- **`est_supprime`** — 100 % rempli, NOT NULL dans le miroir : durcissable sans risque. Seul drapeau de cycle de vie existant. Le cadrage distingue explicitement désactiver (actif) de supprimer logiquement (est_supprime) : les deux colonnes coexistent, c'est voulu.
- **`premiere_connexion_le`** — 7 % rempli (323 lignes). Donnée historique Bubble, conservée telle quelle.
- **`derniere_connexion_le`** — AJOUT. Sans elle on ne distingue pas un compte dormant d'un compte jamais réutilisé après la première fois. Exigé par « Annuaire utilisateurs internes (cycle de vie) » et « Réactivation / offboarding ». Alimentée par l'application, pas par auth.users.
- **`cree_le`** — 100 % rempli. ⚠ Côté miroir, created_at est une date de SYNCHRONISATION, pas de création métier : la valeur est reprise faute de mieux, elle ne fait pas foi avant la date du premier import.
- **`maj_le_source`** — Horodatage venu du miroir, gardé distinct de maj_le pour la même raison. Même traitement que core.talent.maj_le_source.
- **`maj_le`** — Posé par l'application, jamais par la synchro. Trigger de mise à jour.

</details>
## `core.collaborateur_univers`
Les univers (Product, Tech, Design, Data, Finance, People & Finance, Marketing, Sales) auxquels un collaborateur est rattaché. Table de liaison à deux colonnes — la troisième des quatre façons de relier deux tables.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `collaborateur_id` | `uuid` | oui | public.user_partner.user_id |
| `univers_id` | `uuid` | oui | public.user_partner.univers [valeur_vers_referentiel] |
| `bubble_id` | `text` | — | public.user_partner.id |
| `cree_le` | `timestamptz` | oui | public.user_partner.created_at |
| `cree_par_collaborateur_id` | `uuid` | — | public.user_partner.created_by |

**Relations** — N-1 vers core.collaborateur ON DELETE CASCADE — la liaison meurt avec la personne. · N-1 vers ref.univers ON DELETE RESTRICT — on ne supprime pas un univers utilisé. · ⚠ CONTREDIT LA DÉCISION 4 SUR UN POINT DE FORME. L'ADR écrit « user_partner — 8 lignes associant un utilisateur à un univers — se replie dans le collaborateur. Ce n'est pas une entité. » La mesure dit : 8 lignes pour 2 utilisateurs distincts, MAX 7 UNIVERS PAR UTILISATEUR. Un repli en colonne unique perdrait 6 des 8 lignes. La lecture compatible avec l'ADR est : ce n'est pas une entité de substance, c'est une liste de valeurs du collaborateur — donc une table à deux colonnes, exactement ce qui est modélisé ici. La table reste, le concept ne devient pas une entité. · Note de contexte mesurée : Design, Data et Finance ne sont utilisés par AUCUNE donnée métier — seulement par user_partner, qui contient exactement une ligne par univers. Ces 8 lignes ressemblent à un paramétrage de démonstration plus qu'à un rattachement réel : à confirmer avant de les reprendre.

**Contraintes** — FOREIGN KEY (collaborateur_id) REFERENCES core.collaborateur(id) ON DELETE CASCADE · FOREIGN KEY (univers_id) REFERENCES ref.univers(id) ON DELETE RESTRICT


---

# Le journal, les tâches et la surveillance

> Domaine rédigé le 27/08/2026, après que la vérification de couverture a
> montré que quatre entités portant des fonctionnalités DÉJÀ EN PRODUCTION
> n'avaient pas d'entité cible : note, task, task_notif et la surveillance de
> la synchronisation. Les trois premières deviennent deux tables, la
> quatrième n'en devient aucune.

**Index**

- PRIMARY KEY (collaborateur_id, univers_id) — clé composite, pas d'uuid de surface sur une table de liaison
- UNIQUE (bubble_id)
- btree (univers_id) — sens inverse de la jointure

<details>
<summary><b>Notes par attribut</b> (5)</summary>

- **`collaborateur_id`** — 8 lignes, 8 non nuls, 0 orphelin.
- **`univers_id`** — Le miroir stocke le libellé (« Product », « Tech »…) comme valeur. Devient une FK vers ref.univers, dont le code est product, tech, design, data, finance, people_finance, marketing, sales.
- **`bubble_id`** — Provenance, nullable. correspondance.json la portait déjà en facultatif ici — c'est le bon réglage.
- **`cree_le`** — 100 % rempli.
- **`cree_par_collaborateur_id`** — 100 % rempli (8/8). Renommée : _id est réservé aux clés étrangères et celle-ci en devient une.

</details>
## `core.note`
Le journal métier : ce qu'un humain a écrit sur quelqu'un ou sur quelque chose, et les événements typés que l'application a inscrits à sa place. À ne pas confondre avec `app.journal_ecriture`, qui enregistre les CHANGEMENTS DE CHAMP à des fins d'audit technique : la note est un contenu rédigé, lisible et destiné à être relu par un recruteur ; le journal d'écriture est une trace machine. Deux tables, deux publics, deux durées de vie.

**Fusionne les deux tables du miroir.** `public.note` (25 805) et `public.note_archivee` (25 318) ne partagent AUCUN identifiant : l'archivage crée une nouvelle ligne avec un nouvel id, au rythme d'environ 1 500 par mois. Rapprochées par leur contenu — cible, commentaire, date, auteur — elles ont 5 060 empreintes communes. La fusion donne **46 063 notes**, pas 51 123 : l'archive n'est pas un doublon du courant, elle porte 20 258 notes qui n'existent plus ailleurs. L'état d'archivage devient une colonne, `archivee_le`.

**S'y ajoutent 4 834 notes typées** issues de colonnes de la fiche, par décision déjà actée : pachamama_like (503), pachamama_personnalite (742), note_interne (135), candidat_expanded.perso (2 152), note_1 (459), note_2 (843). Volume cible ≈ 50 900 lignes.

**Les quatre tables de liaison du miroir sont abandonnées.** candidat_note porte 0 ligne ; entreprise_note (991), mandat_note (2 013) et mandatclose_note (1 292) sont toutes plus petites que les colonnes scalaires équivalentes (2 087, 2 067, 1 757). Ce sont des N-N de façade, vestiges d'une modélisation Bubble : la voie vivante est la colonne, pas la table.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `bubble_id` | `text` | — | public.note.id, ou public.note_archivee.id pour les 20 258 lignes propres à l'archive |
| `fiche_talent_id` | `uuid` | — | public.note.candidat_id — 23 488 |
| `entreprise_id` | `uuid` | — | public.note.entreprise_id — 2 087 |
| `mandat_id` | `uuid` | — | public.note.mandat_id — 2 067 |
| `placement_id` | `uuid` | — | public.note.mandatclose_id — 1 757 |
| `candidature_id` | `uuid` | — | A_CREER — résolu par le couple (candidat_id, mandat_id) contre public.process |
| `commentaire` | `text` | — | public.note.commentaire — 24 745 |
| `evenement_id` | `uuid` | — | public.note.note_event — 1 483, vers ref.evenement_note |
| `valeur_avant` | `text` | — | public.note.note_event_value_prev |
| `valeur_apres` | `text` | — | public.note.note_event_value_new |
| `est_automatique` | `boolean` | oui | public.note.note_automatique — 25 718 / 25 805 à true |
| `auteur_collaborateur_id` | `uuid` | — | public.note.user_id résolu par un rôle interne — 34 225 (67,8 %) |
| `auteur_fiche_talent_id` | `uuid` | — | public.note.user_id résolu par public.user.candidat_id — 15 849 (31,4 %) |
| `auteur_bubble_id` | `text` | — | public.note.user_id non résolu — 378 lignes (0,75 %) |
| `ecrite_le` | `timestamptz` | — | public.note.date_note |
| `archivee_le` | `timestamptz` | — | A_CREER — renseigné pour les lignes venues de note_archivee |
| `cree_le` | `timestamptz` | oui | public.note.created_at |
| `maj_le` | `timestamptz` | oui | public.note.updated_at |

**L'auteur, et la levée du point bloquant.** Le détail signalait qu'aucune contrainte d'auteur n'était posable : 2 103 valeurs distinctes dans note.user_id pour 41 collaborateurs prévus, et trois issues toutes coûteuses. La mesure lève la difficulté sans en retenir aucune. Sur les 50 452 notes qui portent un auteur, **67,8 % sont écrites par l'un des 41 internes** (37 ont réellement écrit) et **31,4 % par un candidat** — les contacts entreprise en écrivent 23, soit 0,0 %. L'auteur n'est donc jamais « un utilisateur quelconque » : c'est un collaborateur ou un talent, deux entités qui existent au modèle. Deux clés étrangères explicites nullables suffisent, exactement le motif de `app.acces`, et **99,25 % des auteurs se résolvent**. Les 378 restants — 357 utilisateurs sans candidat_id, 21 auteurs absents de public.user — gardent leur identifiant Bubble en repli textuel. Aucune des trois issues envisagées n'était nécessaire : il ne fallait pas choisir entre le compte, le texte libre et l'élargissement de collaborateur, il fallait mesurer QUI écrit.

**Relations** — N-1 vers core.fiche_talent ON DELETE CASCADE — effacer une personne emporte les notes écrites SUR elle. · N-1 vers core.entreprise ON DELETE CASCADE. · N-1 vers core.mandat ON DELETE CASCADE. · N-1 vers core.placement ON DELETE CASCADE. · N-1 vers core.candidature ON DELETE CASCADE. · N-1 vers ref.evenement_note ON DELETE RESTRICT, nullable — 1 483 lignes sur 25 805, un NOT NULL en rejetterait 24 322. · N-1 vers core.collaborateur (auteur) ON DELETE SET NULL — effacer l'AUTEUR ne détruit pas la note, même raisonnement que le journal d'écriture. · N-1 vers core.fiche_talent (auteur_fiche_talent_id) ON DELETE SET NULL — et NON CASCADE, contrairement à fiche_talent_id : une note écrite PAR une personne survit à son effacement, une note écrite SUR elle non. Les deux clés pointent la même table avec deux politiques opposées ; c'est voulu et c'est la seule subtilité de cette entité.

**Les notes à trois cibles.** 2 067 notes portent simultanément candidat, entreprise et mandat — toujours cette combinaison exacte, jamais une autre. C'est la signature d'une candidature, et la mesure le confirme : **2 028 d'entre elles (98,1 %) correspondent à un couple (candidat, mandat) présent dans process**. Elles migrent donc sur `candidature_id` seul, les trois clés brutes laissées à NULL puisque dérivables par jointure. Les 39 sans process correspondant conservent candidat_id et mandat_id en l'état. Sans ce traitement, un ancrage polymorphe à cible unique aurait forcé à choisir arbitrairement l'une des trois et perdu la lecture « les notes de cette candidature ».

**Contraintes** — CHECK (num_nonnulls(auteur_collaborateur_id, auteur_fiche_talent_id) <= 1) — un auteur, ou aucun, jamais deux. · CHECK (auteur_bubble_id IS NULL OR num_nonnulls(auteur_collaborateur_id, auteur_fiche_talent_id) = 0) — le repli textuel ne coexiste pas avec un auteur résolu. · PAS de contrainte « au moins une cible » : 540 notes n'en portent aucune. Elles sont migrées telles quelles et rendues visibles par une vue de contrôle ; les supprimer serait une décision de produit, pas de modèle. · CHECK (archivee_le IS NULL OR archivee_le >= cree_le) · Index sur (fiche_talent_id, ecrite_le DESC) et (candidature_id, ecrite_le DESC) — la lecture réelle est « les notes de cette personne, les plus récentes d'abord ». · ⚠ DONNÉES PERSONNELLES : commentaire porte des appréciations sur des personnes. Même périmètre que app.journal_ecriture pour l'effacement et pour l'anonymisation de la base de dev.

**Colonnes du miroir abandonnées** — note.slug et note_archivee.slug (identifiant d'URL Bubble) · note.note_user_tag_id (0 valeur) · note.note_event_type (redondant : il se lit par jointure sur ref.evenement_note, comme le prescrit déjà la fiche de ce référentiel) · note.created_by et note_archivee.created_by (date de synchro, pas d'auteur métier).

## `core.tache`
La to-do opérationnelle du recruteur : relances, onboarding après placement, échéances de garantie. 1 141 lignes, dont 820 ouvertes et 321 faites. Entité entièrement interne — **la mesure ne trouve aucun créateur ni aucun assigné qui ne soit l'un des 41 collaborateurs**, ce qui autorise ici des clés étrangères strictes là où la note a dû rester souple.

**`public.task_notif` se replie dedans.** La cardinalité est strictement 1:1 et mesurée comme telle : 1 141 task_id distincts pour 1 141 tâches, aucune tâche à plusieurs notifications, maximum observé 1. Le référentiel `ref.type_tache` l'annonçait déjà (« la table task_notif se replie dans core.tache »). Prix du repli, déclaré : **16 notifications orphelines** (task_id nul) n'ont pas de tâche d'accueil et sont perdues.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `bubble_id` | `text` | — | public.task.id |
| `texte` | `text` | — | public.task.task_text |
| `type_tache_id` | `uuid` | — | public.task.task_type — 1 067 / 1 136, vers ref.type_tache |
| `est_faite` | `boolean` | oui | public.task.is_complete — 321 true, 820 false |
| `placement_id` | `uuid` | — | public.task.mandatclose_id — 1 104 (96,8 %) |
| `mandat_id` | `uuid` | — | A_CREER — exigé par « file de travail unifiée », absent du miroir |
| `candidature_id` | `uuid` | — | A_CREER — même origine |
| `fiche_talent_id` | `uuid` | — | A_CREER — même origine |
| `entreprise_id` | `uuid` | — | A_CREER — même origine |
| `echeance_le` | `timestamptz` | — | public.task.due_date — 1 129 |
| `assignee_collaborateur_id` | `uuid` | — | public.task.assigned_user_id — 1 076, 100 % internes |
| `creee_par_collaborateur_id` | `uuid` | — | public.task.creation_user_id — 1 141, 100 % internes |
| `maj_par_collaborateur_id` | `uuid` | — | public.task.update_user_id |
| `notif_envoyee` | `boolean` | oui | public.task_notif.is_sent — 984 true, 173 false |
| `notif_apercu` | `text` | — | public.task_notif.preview_text |
| `notif_email` | `text` | — | public.task_notif.sent_email — 932 |
| `notif_texte` | `text` | — | public.task_notif.sent_text |
| `notif_envoyee_le` | `timestamptz` | — | public.task_notif.wf_date |
| `notif_bubble_id` | `text` | — | public.task_notif.id |
| `notif_canal` | `ref.canal_notification` | — | A_CREER — exigé par le centre de notifications |
| `notif_destinataire_compte_id` | `uuid` | — | A_CREER — même origine |
| `notif_lue_le` | `timestamptz` | — | A_CREER — même origine |
| `notif_statut_delivrabilite` | `text` | — | A_CREER — même origine |
| `cree_le` | `timestamptz` | oui | public.task.created_at, ou task.creation_date si plus ancienne |
| `maj_le` | `timestamptz` | oui | public.task.updated_at |

**Relations** — N-1 vers core.placement ON DELETE CASCADE — une tâche de closing n'a pas de sens sans son closing. · N-1 vers core.mandat, core.candidature, core.fiche_talent, core.entreprise ON DELETE CASCADE, toutes nullables et toutes vides à la reprise. · N-1 vers ref.type_tache ON DELETE RESTRICT, nullable — 69 tâches sans type. · N-1 vers core.collaborateur (assigné, créateur, modificateur) ON DELETE SET NULL — un collaborateur qui part ne détruit pas les tâches qu'il a créées, il les laisse orphelines et réassignables. · N-1 vers app.compte (destinataire de la notification) ON DELETE SET NULL.

**Contraintes** — CHECK (NOT notif_envoyee OR notif_envoyee_le IS NOT NULL) — une notification déclarée envoyée sait quand. · CHECK (notif_lue_le IS NULL OR notif_envoyee) — on ne lit pas ce qui n'est pas parti. · Index partiel sur (assignee_collaborateur_id, echeance_le) WHERE NOT est_faite — la seule lecture chaude est « mes tâches ouvertes, par échéance ». · PAS de NOT NULL sur assignee_collaborateur_id : 65 tâches n'ont pas d'assigné.

**Colonnes du miroir abandonnées** — task.slug et task_notif.slug · task.task_notif_id (le repli le rend inutile) · task_notif.task_type, vide à 100 % (0 / 1 152) · task_notif.wf_id, identifiant de workflow Bubble qui meurt avec Bubble · created_by des deux tables.

## La surveillance de la synchronisation — AUCUNE TABLE NOUVELLE

C'est la seule des quatre entités manquantes qui ne devient pas une table, et il faut le dire explicitement plutôt que de la laisser sans entité : **tous les instruments existent déjà, ils ne sont simplement jamais regardés.** Le besoin fonctionnel est une surface de LECTURE, pas un stockage.

Ce qui existe, et ce qu'il devient :

| instrument | portée | sort après la coupure de Bubble |
|---|---|---|
| `public._sync_state` (8 col.) | curseur et dernier passage par type Bubble | MEURT — plus de Bubble à synchroniser |
| `public._sync_ecart` (13 col.) | fantômes, manquantes, périmées | MEURT |
| `public._sync_passe` (7 col.) | passes de réconciliation | MEURT |
| `public._sync_quarantine` (6 col.) | lignes écartées | MEURT |
| `pivot.sync_etat` (8 col.) | curseur par source, app et ats | **SURVIT** |
| `pivot.sync_run` (13 col.) | historique des runs, volumes, conflits | **SURVIT** |
| `pivot.conflit` (10 col.) | arbitrages de préséance champ par champ | **SURVIT** |
| 6 vues `pivot.qa_*` | complétude, multi-source, préséance suspecte | **SURVIVENT** |

**Correction d'une erreur de classement.** Les 35 colonnes `_sync_*` avaient été rangées en « tuyauterie qui meurt avec le miroir ». C'est vrai de la moitié seulement. La synchronisation Jarvi ↔ pivot ne s'arrête pas avec Bubble : elle est la raison d'être du pivot. La partie `pivot.sync_*` doit donc être **portée dans la surface de lecture de l'application**, faute de quoi la coupure de Bubble emporterait aussi la supervision de ce qui reste.

Le modèle n'ajoute donc rien à `core` ni à `app`, et déclare quatre vues dans `api` : santé des sources (union de `_sync_state` et `pivot.sync_etat` tant que les deux coexistent, `pivot.sync_etat` seul ensuite), écarts non résolus, conflits de préséance récents, et complétude. Les seuils d'alerte relèvent de `config.parametre`, pas d'une table dédiée.

---

# Les référentiels et la configuration

## `config.asset`
Registre des assets applicatifs. Reçoit ref_image — 1 ligne, 0 consommateur, 1 URL. Une table ref_* pour un fichier est du bruit dans le modèle métier ; un registre d'assets est de la configuration de présentation.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `cle` | `text` | oui | public.ref_image.value [identique] |
| `url` | `text` | — | public.ref_image.file_url [renommee] — 1/1 |
| `description` | `text` | — | A_CREER — AJOUT DE MA PART |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — Aucune. · public.ref_image.sort_order ABANDONNÉE : une seule ligne.

**Contraintes** — CHECK (cle ~ '^[a-z0-9_]+$')

**Index**

- UNIQUE (cle)

<details>
<summary><b>Notes par attribut</b> (2)</summary>

- **`cle`** — « mail_signature » — clé déjà propre dans le miroir.
- **`url`** — PNG de signature sur le CDN Bubble : la signature de mail casse à la coupure. NULLABLE pour la fenêtre de rapatriement.

</details>
## `config.branding`
SINGLETON — l'identité de marque de l'application. 1 ligne, 0 consommateur dans le miroir, 7 attributs hétérogènes : ce n'est pas un référentiel, c'est la configuration de l'application déguisée en option set Bubble. La garder en ref_* laisserait croire qu'on peut avoir plusieurs marques ; si le multi-marque devient un besoin, ce sera une table « marque », pas ce singleton.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `cle` | `text` | oui | public.ref_app_branding.value [valeur_vers_referentiel] |
| `libelle` | `text` | oui | public.ref_app_branding.value [renommee] |
| `logo_url` | `text` | — | public.ref_app_branding.logo_url [identique] — 1/1 |
| `logo_mini_url` | `text` | — | public.ref_app_branding.logo_mini_url [identique] — 1/1 |
| `background_image_url` | `text` | — | public.ref_app_branding.background_image [renommee] — 1/1 |
| `background_asset1_url` | `text` | — | public.ref_app_branding.background_asset1 [renommee] — 1/1 |
| `background_asset2_url` | `text` | — | public.ref_app_branding.background_asset2 [renommee] — 1/1 |
| `police` | `text` | — | public.ref_app_branding.police [identique] — 1/1 |
| `site_web` | `text` | — | public.ref_app_branding.web_site [renommee] — 1/1 |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — Aucune. C'est délibéré : le branding ne se rattache à rien, il est lu par l'application.

**Contraintes** — public.ref_app_branding.sort_order ABANDONNÉE explicitement : un ordre n'a aucun sens sur une table à une ligne. (1 des 5 sort_order abandonnés.) · CHECK (site_web IS NULL OR site_web ~ '^https://')

**Index**

- UNIQUE INDEX ON config.branding ((true)) — la garantie de singleton, exprimée par la base et non par une convention
- UNIQUE (cle)

<details>
<summary><b>Notes par attribut</b> (8)</summary>

- **`libelle`** — « Pachamama ». La raison de facturation « Pacha Partners » est une donnée distincte, absente du miroir — ne pas la confondre avec le nom commercial.
- **`logo_url`** — CDN Bubble.
- **`logo_mini_url`** — CDN Bubble.
- **`background_image_url`** — CDN Bubble.
- **`background_asset1_url`** — CDN Bubble.
- **`background_asset2_url`** — CDN Bubble. Les 5 URLs sont NULLABLES bien que remplies : elles seront nulles pendant le rapatriement, et un NOT NULL bloquerait l'opération.
- **`police`** — « Host Grotesk ».
- **`site_web`** — https://www.pachamama.pm

</details>
## `config.canal_notification`
2 canaux Slack de notification. Ce n'est pas un référentiel métier : la table ne porte QUE le code et le libellé du canal. Les 4 webhooks du miroir NE SONT PAS repris — voir points à arbitrer.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `code` | `text` | oui | public.ref_slack_channel.value [valeur_vers_referentiel] |
| `libelle` | `text` | oui | public.ref_slack_channel.value [renommee] |
| `actif` | `boolean` | oui | A_CREER — AJOUT DE MA PART |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — Aucune. Les colonnes public.ref_slack_channel.webhook et .webhook_test (2/2 renseignées chacune, soit 4 valeurs) NE SONT PAS PORTÉES par le modèle : ce ne sont pas des données, ce sont des identifiants d'authentification. · public.ref_slack_channel.sort_order ABANDONNÉE : 2 lignes, aucun ordre métier.

**Contraintes** — CHECK (code ~ '^[a-z0-9_]+$') · AUCUNE colonne de cette table ne doit pouvoir accueillir une URL de webhook. Si le besoin réapparaît, il se traite hors du modèle de données.

**Index**

- UNIQUE (code)

<details>
<summary><b>Notes par attribut</b> (2)</summary>

- **`code`** — notifs_jobs, notifs_closing.
- **`libelle`** — « #notifs-jobs », « #notifs-closing ».

</details>
## `config.integration`
ENTIÈREMENT À CRÉER — aucune source dans le miroir. Déclare les canaux externes (SendGrid, Slack, HubSpot, prestataire de signature, calendrier) pour les paramétrer sans toucher au code, et pour sortir les secrets des nœuds n8n. Entité possédée par l'application, jamais cible de la synchro entrante.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `code` | `text` | oui | A_CREER |
| `libelle` | `text` | oui | A_CREER |
| `actif` | `boolean` | oui | A_CREER |
| `reference_secret` | `text` | — | A_CREER — exigé par « Chiffrement des secrets & gestion des accès API » |
| `date_derniere_rotation` | `timestamptz` | — | A_CREER — exigé par la rotation des accès API |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — Aucune FK. NOTE DE PÉRIMÈTRE : correspondance.json range aussi hs_company_id / hs_deal_id (HubSpot) et l'identifiant d'enveloppe de signature dans cette entité. Ils n'y appartiennent PAS : un identifiant HubSpot d'entreprise est un attribut de core.entreprise, un identifiant de deal un attribut de core.mandat, une enveloppe de signature un attribut de core.placement. config.integration déclare le CANAL, pas les objets qui y transitent.

**Contraintes** — CHECK (code ~ '^[a-z0-9_]+$') · CHECK (reference_secret IS NULL OR reference_secret !~ '^(https?:///SG\./xox/B0)') — refuse structurellement qu'un webhook ou une clé soit collé dans le champ de référence. Garde-fou, pas coffre-fort.

**Index**

- UNIQUE (code)
- INDEX (actif) WHERE actif

<details>
<summary><b>Notes par attribut</b> (3)</summary>

- **`code`** — sendgrid, slack, hubspot, signature_electronique, calendrier.
- **`actif`** — Défaut false : une intégration s'active explicitement.
- **`reference_secret`** — UNE RÉFÉRENCE, JAMAIS UNE VALEUR. La colonne porte le nom de l'entrée dans le coffre, pas le secret. Si une valeur de secret peut y entrer, la colonne est mal conçue.

</details>
## `config.modele_email`
Les 4 modèles d'e-mail rédigés dans l'application, avec leurs jetons de personnalisation. Seule entité de mon domaine qui vient d'une VRAIE table Bubble (public.email_template) et non d'un option set — c'est la seule qui porte donc un bubble_id.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `bubble_id` | `text` | — | public.email_template.id [type_corrige] |
| `libelle` | `text` | oui | public.email_template.label [renommee] — 4/4 |
| `objet` | `text` | — | public.email_template.subject [renommee] — 3/4 |
| `corps` | `text` | oui | public.email_template.body [renommee] — 4/4 |
| `jeton_agent_prenom` | `boolean` | oui | public.email_template.is_agent_firstname [renommee] — 4/4 |
| `jeton_agent_nom` | `boolean` | oui | public.email_template.is_agent_lastname [renommee] — 4/4 |
| `jeton_entreprise_nom` | `boolean` | oui | public.email_template.is_company_name [renommee] — 4/4 |
| `jeton_talent_prenom` | `boolean` | oui | public.email_template.is_firstname [renommee] — 4/4 |
| `jeton_personnalise` | `boolean` | oui | public.email_template.is_custom [renommee] — 4/4 |
| `actif` | `boolean` | oui | A_CREER — AJOUT DE MA PART |
| `cree_par_compte_id` | `uuid` | — | public.email_template.created_by [type_corrige] — 4/4 |
| `cree_le` | `timestamptz` | oui | public.email_template.created_at [renommee] — SOUS RÉSERVE |
| `maj_le` | `timestamptz` | oui | public.email_template.updated_at [renommee] — même réserve |

**Relations** — cree_par_compte_id → app.compte(id) ON DELETE SET NULL. JAMAIS de FK vers public.user (Décision 1, interdit absolu). · public.email_template.slug ABANDONNÉE : artefact de plateforme, 0/4 renseigné, comme les 20 autres slug du miroir.

**Contraintes** — CHECK (corps <> '')

**Index**

- UNIQUE (bubble_id) — plusieurs NULL restent permis en PostgreSQL, ce qui est exactement le comportement voulu pour une provenance facultative
- INDEX (actif)

<details>
<summary><b>Notes par attribut</b> (5)</summary>

- **`bubble_id`** — CORRECTION DOUBLE sur correspondance.json, qui l'appelle « cle_legacy_bubble ». (1) Renommé bubble_id, convention du parti 2. (2) NULLABLE : une provenance, jamais une clé — un modèle créé dans l'application n'en a pas. correspondance.json le laissait déjà facultatif ici, contrairement aux 14 entités core où il est à tort obligatoire.
- **`objet`** — NULLABLE OBLIGATOIRE : 1 modèle sur 4 n'a pas d'objet. Le parti 3 s'applique même sur une table de 4 lignes.
- **`actif`** — AJOUTÉ. Retirer un modèle de la liste d'envoi sans détruire l'historique des envois.
- **`cree_par_compte_id`** — Identifiant Bubble d'un user, à résoudre vers app.compte. NULLABLE : la résolution peut échouer, et un modèle créé par le système n'a pas d'auteur.
- **`cree_le`** — ⚠️ PIÈGE NOMMÉ PAR L'ADR : « created_at du miroir est une date de SYNCHRONISATION ». La colonne du miroir est DEFAULT now() NOT NULL, ce qui est compatible avec une date de synchro comme avec une date reprise de Bubble. À VÉRIFIER dans la table de correspondance de la synchro avant de mapper : si c'est la date de synchro, cree_le devient A_CREER et la valeur du miroir est jetée. Ne pas trancher par le nom de la colonne.

</details>
## `config.parametre`
Table clé/valeur des paramètres d'exécution. Reçoit ref_email_config — 1 ligne, 0 consommateur : un interrupteur de sécurité d'envoi (rediriger les mails vers une adresse de test). De la configuration d'exécution, qui n'a rien à faire dans le modèle métier : la laisser en table de référence invite à l'oublier lors d'un déploiement, avec un risque d'envoi réel à des candidats.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `cle` | `text` | oui | public.ref_email_config.value [valeur_vers_referentiel] |
| `valeur` | `text` | — | public.ref_email_config.email_adresses [renommee] — 1/1 |
| `description` | `text` | — | A_CREER — AJOUT DE MA PART |
| `sensible` | `boolean` | oui | A_CREER — AJOUT DE MA PART |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — Aucune. · public.ref_email_config.sort_order ABANDONNÉE : une seule ligne.

**Contraintes** — CHECK (cle ~ '^[a-z0-9_]+$')

**Index**

- UNIQUE (cle)
- INDEX (sensible) WHERE sensible — l'anonymisation de la base de dev doit pouvoir trouver ces lignes

<details>
<summary><b>Notes par attribut</b> (4)</summary>

- **`cle`** — « Emails Test » devient adresse_redirection_emails_test.
- **`valeur`** — NULLABLE : un paramètre désactivé n'a pas de valeur, et c'est justement l'état voulu en production.
- **`description`** — AJOUTÉ. Une table clé/valeur sans description devient illisible en six mois ; le coût est nul.
- **`sensible`** — AJOUTÉ, et justifié par une mesure : l'unique ligne du miroir contient une adresse e-mail NOMINATIVE. Le drapeau marque les lignes à accès restreint et à anonymiser en base de dev. Il ne fait PAS de cette table un coffre à secrets — voir points à arbitrer.

</details>
## `config.sendgrid_template`
TABLE D'INTÉGRATION — 6 correspondances vers les gabarits SendGrid. Six valeurs, mais ce n'est PAS un vocabulaire métier : c'est une table de correspondance vers un prestataire externe. Elle mérite une table et non un enum, parce que les template_id changent sans que le modèle change. Elle sort des référentiels et rejoint la configuration.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `code` | `text` | oui | public.ref_sendgrid_template.value [valeur_vers_referentiel] |
| `libelle_fr` | `text` | oui | public.ref_sendgrid_template.value [valeur_vers_referentiel] — sans emoji |
| `emoji` | `text` | — | préfixe de public.ref_sendgrid_template.value [calculee] |
| `template_id` | `text` | oui | public.ref_sendgrid_template.id_sendgrid [renommee] — 6/6 |
| `ordre` | `integer` | oui | public.ref_sendgrid_template.sort_order [renommee] |
| `actif` | `boolean` | oui | A_CREER — AJOUT DE MA PART |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — config.sendgrid_template_statut_mandat — N-N vers l'enum statut_mandat, éclatement de la chaîne à pipe. · La CLÉ D'API SendGrid n'est PAS dans le miroir et ne doit PAS y entrer : voir points à arbitrer.

**Contraintes** — CHECK (code ~ '^[a-z0-9_]+$') · CHECK (template_id ~ '^d-[0-9a-f]{32}$') — forme mesurée, À VÉRIFIER sur les 6 valeurs réelles avant de la poser

**Index**

- UNIQUE (code)
- UNIQUE (template_id) — deux entrées ne pointent pas le même gabarit
- INDEX (ordre) WHERE actif

<details>
<summary><b>Notes par attribut</b> (3)</summary>

- **`code`** — ko_during_process, ko_applicant, free_template, freelance_nb_jours, proposition_screening, onboarding_mandat_close. 2 des 6 clés portent l'emoji composé « 🙅🏻‍♀️ ».
- **`emoji`** — 2/6.
- **`template_id`** — CORRECTION DE TYPE : correspondance.json le type « uuid ». Les valeurs mesurées sont de la forme d-xxxx, l'identifiant propriétaire SendGrid — ce n'est PAS un uuid et un cast échouerait à la reprise. text, avec un CHECK de forme. Ce n'est pas un secret : c'est un identifiant de gabarit, il peut vivre en base.

</details>
## `config.sendgrid_template_statut_mandat`
TABLE DE LIAISON — remplace public.ref_sendgrid_template.visible_pour_mandat, qui encode une LISTE DANS UNE CHAÎNE avec un séparateur pipe (« En cours », « Closé », « En cours|Closé »). Pire : les éléments de cette liste sont les LIBELLÉS d'un autre référentiel, et « Closé » n'est même pas le libellé exact de ref_mandate_status, qui dit « Closé par Pachamama ». Une relation N-N stockée en texte, avec une correspondance de libellé approximative.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `sendgrid_template_id` | `uuid` | oui | public.ref_sendgrid_template.value [type_corrige] — résolu par code |
| `statut` | `statut_mandat (enum)` | oui | public.ref_sendgrid_template.visible_pour_mandat [type_corrige] — éclaté sur le séparateur pipe |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — sendgrid_template_id → config.sendgrid_template(id) ON DELETE CASCADE — la visibilité n'a pas de sens sans son gabarit.

**Contraintes** — 1 à 2 lignes par gabarit, 6 gabarits : 8 à 9 lignes attendues après éclatement. Contrôle de non-perte à poser.

**Index**

- UNIQUE (sendgrid_template_id, statut)
- INDEX (statut) — la lecture réelle est « quels gabarits proposer sur un mandat En cours »

<details>
<summary><b>Notes par attribut</b> (1)</summary>

- **`statut`** — CORRECTION DE TYPE : correspondance.json le type « text ». C'est précisément l'égalité de chaînes entre deux référentiels qui rendait le système fragile — le typer en statut_mandat est le seul moyen que la base refuse un « Closé » qui ne correspond à rien. Le rapprochement des 6 lignes doit être VALIDÉ MANUELLEMENT : « Closé » → close_pachamama est une déduction, pas une mesure.

</details>
## `public.ref_role_category — DISPARAÎT`
SEUL RÉFÉRENTIEL SUPPRIMÉ DU LOT. 1 ligne (« recruiter »), 0 usage réel : son unique consommateur, ref_role.role_category, est NULL sur 5/5. Une catégorie à UNE seule valeur ne catégorise rien, et le lien qui devait la porter est vide à 100 %. Le concept a été pensé puis abandonné dans Bubble même.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `value` | `— ABANDONNÉE` | — | public.ref_role_category.value |
| `sort_order` | `— ABANDONNÉE` | — | public.ref_role_category.sort_order |

**Relations** — Si une 2e catégorie apparaît un jour (« client », par exemple), la réintroduire coûtera une colonne, pas une reprise de données.

**Contraintes** — BILAN DU DOMAINE : 47 tables ref_* → 13 tables ref.* + 2 tables transverses (ref.libelle, ref.correspondance) + 28 types énumérés + 5 objets sortis en config.* + 1 abandon. Aucune valeur perdue, aucun attribut perdu hors les 5 sort_order de singletons, ref_role_category et les 4 webhooks Slack (déplacés, pas perdus).

<details>
<summary><b>Notes par attribut</b> (2)</summary>

- **`value`** — L'unique information — « Recruiter Core Team et Recruiter Support Crew sont deux rôles de recruteur » — est déjà lisible dans les codes eux-mêmes et se réexprime en un booléen (ref.libelle.est_recruteur). Créer un enum à une valeur pour cela serait de la cérémonie. L'information n'est PAS perdue.
- **`sort_order`** — 1 des 5 sort_order abandonnés (avec ref_app_branding, ref_email_config, ref_image, ref_slack_channel) : aucun ordre n'a de sens sur une table à une ou deux lignes.

</details>
## `ref — LES 28 TYPES ÉNUMÉRÉS (pas des tables)`
**L'ORDRE D'AFFICHAGE DES ÉNUMÉRÉS — TRANCHÉ, 27/08/2026.** 45 tables `ref_*` du miroir portent une colonne `sort_order`. Treize sont déjà reprises sous le nom `ordre` par les référentiels restés des tables. Les 32 autres appartiennent à des référentiels convertis en types énumérés, où aucune colonne ne peut les accueillir — ce qui avait été relevé comme une perte de 28 colonnes inexpliquées. Il n'y en a pas : **PostgreSQL trie un type énuméré selon l'ordre de DÉCLARATION de ses valeurs**, et `ORDER BY ma_colonne_enum` respecte cet ordre nativement. La règle est donc de déclarer les valeurs de chaque `CREATE TYPE` dans la séquence du `sort_order` de la table source, et non par ordre alphabétique ni par ordre d'apparition. Coût nul, aucune colonne ajoutée, l'ordre d'affichage vu par les recruteurs est préservé. Contrepartie à connaître : insérer plus tard une valeur AU MILIEU de l'ordre exige `ALTER TYPE … ADD VALUE … BEFORE/AFTER`, qui existe mais qu'il faut penser à utiliser.

Vocabulaires FERMÉS, sans attribut propre autre que la présentation. Chacun devient un CREATE TYPE ... AS ENUM ; son libellé, son emoji, sa couleur, son icône, son ordre et son drapeau actif vivent dans ref.libelle, indexés par (domaine, code). Critère appliqué : peu de valeurs + vocabulaire fermé + aucun attribut de LOGIQUE métier. Le miroir applique DÉJÀ ce motif ailleurs — 10 colonnes portent un CHECK sans table de référence (mandat.equity, mandat.type_deal, entreprise.garantie, tag.type_tag, note.note_event_type…) : la proposition étend une norme locale, elle ne l'invente pas. Chaque ligne ci-dessous est UN type, pas une colonne : « obligatoire » y est sans objet.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `background_talent` | `enum ('business','tech','data','marketing')` | — | public.ref_background.value + .sort_order |
| `cible_produit` | `enum ('b2b','b2b2c','b2c','users_internes')` | — | public.ref_cible.value + .sort_order |
| `type_entreprise` | `enum ('startup','scaleup','eti','corporate','vc_private_equity')` | — | public.ref_company_type.value + .sort_order |
| `type_apporteur` | `enum ('pacha_partners','head_of_bu','collectif')` | — | public.ref_apporteur_affaires.value + .sort_order |
| `source_marketing` | `enum (12 valeurs : avant_garde, collectif, emailing, events, inbound, linkedin, nurturing, outbound, partner_bizmaker, recommendation, communaute_metier, website)` | — | public.ref_source_marketing.value + .sort_order |
| `type_contrat` | `enum ('cdi','freelance','entrepreneur')` | — | public.ref_contrat.value + .color + .sort_order |
| `type_contributeur` | `enum ('ic','manager_c_level')` | — | public.ref_contributor_type.value + .full_display + .sort_order |
| `emoji_statut` | `enum ('feu','pouce_haut','yeux','pouce_bas')` | — | public.ref_emoji.value + .sort_order |
| `fonction_utilisateur` | `enum ('career_agent','recruiter')` | — | public.ref_fonction.value + .label_fr + .label_en + .sort_order |
| `genre` | `enum ('male','female','non_binary')` | — | public.ref_gender.value + .label_fr + .label_en + .sort_order |
| `langue` | `enum ('fr_fr','en_us')` | — | public.ref_language.value + .label + .sort_order |
| `statut_mandat` | `enum ('nouveau','en_cours','en_pause','termine','close_pachamama')` | — | public.ref_mandate_status.value + .status_admin_label + .status_color + .status_sort_order + .sort_order |
| `visibilite_mandat` | `enum ('private','talent_only','public')` | — | public.ref_mandate_visibility.value + .label_fr + .tooltip_icon + .sort_order |
| `mindset_talent` | `enum ('pas_en_recherche','en_veille','recherche_6_mois','recherche_3_mois','recherche_active')` | — | public.ref_mindset.value + .sort_order |
| `niveau_analyse` | `enum ('bien','moyen','vigilance')` | — | public.ref_niveau_analyse.value + .color + .sort_order |
| `niveau_anglais` | `enum ('aucun','ecrit_seulement','courant_occasionnel','courant_quotidien')` | — | public.ref_niveau_anglais.value + .candidat_display + .sort_order |
| `type_note_event` | `enum ('contract','info','task','team','archive')` | — | public.ref_note_event_type.value + .sort_order |
| `type_produit_xp` | `enum ('b2b','b2c','b2b2c','marketplace','saas','api')` | — | public.ref_product.value + .sort_order |
| `type_produit_entreprise` | `enum (14 valeurs : saas_b2b, marketplace_b2b2c, app_mobile, api_b2d, e_commerce, hardware, digital_transformation, ia, b2c + hybride_hardware_software, hybride_onpremise_saas, media, on_premise, jeux_videos)` | — | public.ref_product_type.value + .sort_order |
| `profil_talent` | `enum ('ic','manager','entrepreneur','agence')` | — | public.ref_profile.value + .sort_order |
| `rythme_remote` | `enum ('hybride','full_remote_fr','full_remote_eu','full_remote_ww','teletravail_legacy','presentiel_legacy','indifferent_legacy')` | — | public.ref_remote.value + .is_active + .sort_order |
| `role_utilisateur` | `enum ('admin','candidat','entreprise','recruiter_core_team','recruiter_support_crew')` | — | public.ref_role.value + .role_category + .sort_order |
| `statut_relation` | `enum ('nouveau','qualifie','non_qualifie','lead','client')` | — | public.ref_statut_candidat.value + .sort_order |
| `form_concurrence` | `enum ('pachamama_en_premier','plusieurs_agences_simultanees','autres_agences_recent','autres_agences_sans_resultat','autre')` | — | public.ref_form_41.value + .sort_order |
| `form_provenance` | `enum ('ancien_talent','deja_client','recommandation','article_podcast','evenement','linkedin')` | — | public.ref_form_42.value + .sort_order |
| `formule_mission` | `enum ('recrutement_cdi','recrutement_freelance','rpo_conseil','a_definir')` | — | public.ref_formule.value + .sort_order |
| `ancre_tache` | `enum ('creation_date','contract_start_date','guarantee_end_date')` | — | public.ref_task_anchor.value + .sort_order |
| `evenement_tache` | `enum ('mandate_clo_free','mandate_clo_cdi')` | — | public.ref_task_event.value + .sort_order |

**Relations** — Chaque enum est consommé par une ou plusieurs colonnes de core.* / app.*, toutes NULLABLE là où le miroir mesure des vides — la règle est absolue et vaut par colonne, pas par type. · Aucun enum ne peut être contraint vers ref.libelle par la base : le lien est conventionnel (domaine = nom du type). Il doit être vérifié par un test.

**Contraintes** — Un enum EST la contrainte : il n'y a plus de valeur libre possible. · COROLLAIRE À ASSUMER : ajouter une valeur devient un ALTER TYPE, donc une migration. C'est le prix, et c'est pourquoi les 6 vocabulaires ouverts (metier, secteur, expertise, critere, tag_job, evenement_note) restent des tables.

**Index**

- Aucun : un enum n'a pas d'index propre. Les index vivent sur les colonnes consommatrices, dans core.
- Un enum se compare et se trie en 4 octets : c'est aussi ce qui le rend préférable à une FK sur les colonnes très lues (visibilite_mandat, statut_mandat, type_contrat).

<details>
<summary><b>Notes par attribut</b> (28)</summary>

- **`background_talent`** — 4 valeurs, 0 attribut, 0 orpheline sur 5 218 lignes déjà conformes. Familles de parcours : vocabulaire structurel. Anglicisme conservé (terme d'usage du cabinet).
- **`cible_produit`** — 4 valeurs, taxonomie universelle. La table de liaison core.mandat_cible reste (92 lignes) ; c'est la VALEUR qui devient un enum.
- **`type_entreprise`** — 5 valeurs. entreprise.type_entreprise est VIDE à 100 % (0/850) : la colonne cible est donc strictement NULLABLE. Conservé plutôt qu'abandonné — coût nul, et jeter le vocabulaire perdrait une intention de segmentation.
- **`type_apporteur`** — 3 valeurs. mandat.lead_apporteur VIDE (0/534) → colonne NULLABLE. Le concept reste vivant ailleurs (core.apporteur_affaires, les commissions de mandate_closed_split).
- **`source_marketing`** — mandat.source_marketing VIDE (0/534) → NULLABLE. Une valeur porte ses exemples dans la clé — « Communauté métier (TechRocks, FrenchProduct…) », 47 caractères : illustration parfaite de pourquoi la clé ne doit pas être le libellé.
- **`type_contrat`** — 2 valeurs officielles + 1 orpheline. Le plus gros volume consommateur du lot : 10 451 lignes sur 5 colonnes (job_reve_contrat 6 444, candidat_contrat 2 460, mandat.contrat 522, mandatclose.contrat 227, candidat.contrat_actuel 798). Emoji ⚡️ avec sélecteur de variante U+FE0F invisible.
- **`type_contributeur`** — 2 valeurs. full_display (« Contributeur Individuel ») est un SECOND LIBELLÉ, pas un attribut métier : ref.libelle.libelles->>'long' l'accueille. C'est exactement le mécanisme qui fait passer 47 référentiels à 13 tables.
- **`emoji_statut`** — CAS INVERSE revendiqué : la valeur EST l'emoji (🔥 👍 👀 👎) et c'est légitime — l'appréciation du recruteur est réellement le pictogramme, il n'y a pas de libellé à extraire. On lui donne quand même un code nommable, sinon aucune requête ni aucun test n'est lisible. 265 lignes sur candidat.emoji_statut.
- **`fonction_utilisateur`** — RÉFÉRENTIEL MODÈLE : la séparation code / libellé FR / libellé EN existe DÉJÀ ici. Preuve interne que le cible ne fait que généraliser le meilleur cas du miroir. 4 lignes renseignées sur 4 605 users : formulaire non rempli, pas référentiel inutile. Nom francisé (referentiels.json disait fonction_user).
- **`genre`** — Clés déjà propres. Seule normalisation : non-binary → non_binary, pour rester un identifiant SQL sans guillemets. 5 566/7 028.
- **`langue`** — Codes déjà propres, BCP-47 de fait. ATTENTION : user.langue et user.user_lang portent EXACTEMENT la même information (2 052 lignes chacune, 100 % fr_fr). Une seule colonne survit — duplication à trancher, pas une perte.
- **`statut_mandat`** — 4 valeurs mesurées (533/534 : termine 271, close_pachamama 204, en_cours 39, nouveau 19) + « en_pause » AJOUTÉ sur décision de séance (ADR partie D) : un mandat suspendu n'est PAS clos, les confondre fausse le tableau de bord client et le délai de recrutement. « Reprise » n'est PAS un statut mais un lien mandat→mandat : il ne rentre pas ici. Deux registres de libellé (« Closé par Pachamama » / « Closé ») → ref.libelle.
- **`visibilite_mandat`** — Codes déjà propres. Sémantique d'exposition STRICTEMENT fermée et sensible : c'est ce qui décide qu'une offre est publique. Enum pour que la base refuse structurellement une 4e valeur inventée. 533/534 (private 496, public 35, talent_only 2). Les 3 tooltip_icon sont des SVG CDN Bubble.
- **`mindset_talent`** — LE CAS LE PLUS ABUSIF DU LOT : la clé primaire est une phrase de formulaire à la première personne, jusqu'à 69 caractères, avec emoji. Toute reformulation marketing casserait 2 275 lignes. L'ordre 1..5 encode une intensité croissante d'intention de recherche — information métier à conserver dans ref.libelle.ordre.
- **`niveau_analyse`** — 3 valeurs, échelle fermée et ordonnée. 500/501 lignes d'analyse. La couleur est de la présentation → ref.libelle.couleur.
- **`niveau_anglais`** — CAS D'ÉCOLE de la séparation valeur/libellé : DEUX registres pour une même valeur — la clé est une phrase du point de vue RECRUTEUR (« Maîtriser l'écrit, oral pas obligatoire »), candidat_display une phrase du point de vue CANDIDAT (« Maîtrise à l'écrit seulement »). Impossible à exprimer quand la clé EST le libellé, il faudrait dupliquer la valeur. 3 178 lignes + 1 orpheline à 59.
- **`type_note_event`** — 5 valeurs, clés déjà propres, et le miroir applique DÉJÀ un CHECK identique sur note.note_event_type : la table de 5 lignes est redondante avec une contrainte qui existe. On supprime une table sans rien perdre. Sert aussi de type à ref.evenement_note.type_evenement.
- **`type_produit_xp`** — 6 valeurs, 11 350 lignes déjà conformes, 0 orpheline. À franciser : type_produit_experience.
- **`type_produit_entreprise`** — 9 valeurs d'origine + 5 apparues hors référentiel (16 lignes). SIGNAL À NE PAS IGNORER : 1 saisie sur 9 est hors référentiel sur seulement 145 saisies. L'enum + contrainte est recommandé précisément pour ARRÊTER la dérive ; si le produit veut garder cette liberté, il faut une table.
- **`profil_talent`** — 4 valeurs, 5 631 lignes conformes, 0 orpheline. COLLISION : IC et Manager recoupent type_contributeur ; « Entrepreneur » est l'orpheline de type_contrat.
- **`rythme_remote`** — 4 valeurs officielles + 3 CODES OBSOLÈTES OBLIGATOIRES : 526 lignes portent un vocabulaire ANTÉRIEUR (Télétravail 398, Indifférent 77, Présentiel 51) qui relève de l'axe présence/absence, quand la grille actuelle relève du périmètre géographique. Les mapper serait INVENTER une donnée. Les 3 codes entrent avec ref.libelle.actif = false. Plus gros volume de lignes en jeu du lot.
- **`role_utilisateur`** — 5 valeurs, 4 601 lignes. Sur une colonne qui décide des DROITS, la garantie de type est un gain de sécurité, pas de propreté. NE PAS RENOMMER ces codes sans revoir les policies RLS. ⚠️ La Décision 4 de l'ADR remplace cet axe unique par DEUX axes (portail : talent/entreprise/recruteur/backoffice depuis l'[ADR 0004](decisions/0004-quatre-portails.md) ; graduation interne : admin/superadmin sur le back-office, recruteur/support sur le portail recruteur) — cet enum est donc un enum de REPRISE, pas le modèle d'autorisation cible.
- **`statut_relation`** — 5 valeurs, DEUX consommateurs (candidat.statut 3 347, entreprise.statut 831) utilisant effectivement les 5 mêmes valeurs. Enum unique conservé faute de mesure justifiant la scission. 3 clés sur 5 portent un emoji et 2 non : le référentiel est incohérent avec lui-même, preuve qu'il a été étendu après coup.
- **`form_concurrence`** — PIRE CLÉ DU LOT : 122 caractères, avec apostrophes typographiques, points de suspension et emoji — une réponse de questionnaire utilisée comme clé primaire. 58 lignes sur entreprise.agence.
- **`form_provenance`** — 6 valeurs, 59 lignes sur entreprise.recommandation. Recouvre source_marketing (Events, Linkedin, Recommendation) : deux référentiels d'origine de lead, l'un à 0 usage, l'autre à 59. Candidat évident à la consolidation.
- **`formule_mission`** — 3 vraies formules commerciales + 1 phrase d'échappatoire de formulaire de 64 caractères, utilisée 4 fois. Le code a_definir rend cette 4e valeur exploitable en requête, ce que la phrase ne permettait pas.
- **`ancre_tache`** — 0 usage aujourd'hui (son seul consommateur, ref_task_type.task_anchor, est vide) et pourtant CONSERVÉ : les 3 ancres correspondent à des colonnes RÉELLES de mandatclose et le délai relatif est renseigné. L'ancre est de la configuration PERDUE, pas un concept mort ; l'abandonner rendrait la planification non réimplémentable.
- **`evenement_tache`** — 0 usage, conservé, et RÉCUPÉRABLE sans arbitrage : les 2 valeurs sont exactement les préfixes des 12 codes de ref.type_tache.

</details>
## `ref.correspondance`
Table transverse de TRACE DE REPRISE. Une ligne par valeur brute réellement observée dans le miroir, orphelines comprises. Preuve auditable du rapprochement, et garde-fou : une valeur non mappée ARRÊTE la reprise, elle ne devient jamais NULL en silence. Elle survit à la migration — c'est ce qui permet de reformuler un libellé plus tard sans perdre la chaîne d'origine Bubble.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `referentiel` | `text` | oui | A_CREER |
| `libelle_miroir` | `text` | oui | les 47 public.ref_*.value + les valeurs distinctes des colonnes consommatrices [valeur_vers_referentiel] |
| `code_cible` | `text` | oui | A_CREER |
| `origine` | `text` | oui | A_CREER |
| `occurrences_mesurees` | `integer` | — | A_CREER — AJOUT DE MA PART |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — Aucune clé étrangère : c'est délibéré. La table doit survivre à la suppression d'un code cible pour rester une preuve d'audit — une FK vers ref.libelle la rendrait fragile exactement au moment où elle sert.

**Contraintes** — CHECK (origine IN ('referentiel','hors_referentiel')) · CHECK (code_cible ~ '^[a-z0-9_]+$') · CHECK (occurrences_mesurees IS NULL OR occurrences_mesurees >= 0)

**Index**

- UNIQUE (referentiel, libelle_miroir)
- INDEX (referentiel, code_cible) — lecture inverse pendant la reprise

<details>
<summary><b>Notes par attribut</b> (7)</summary>

- **`id`** — PK composite (referentiel, libelle_miroir) proposée par correspondance.json, conservée en UNIQUE. ÉCART SIGNALÉ.
- **`referentiel`** — Nom du référentiel source, ex. 'ref_process_etape'.
- **`libelle_miroir`** — CHAÎNE BRUTE, octet pour octet. Aucune normalisation Unicode : pas de NFC/NFD, pas de trim, pas de casefold. Trois pièges mesurés : « 🙅🏻‍♀️ » est un emoji composé de 4 points de code (visage + modificateur de teint + ZWJ U+200D + ♀ + U+FE0F) ; « Je suis deja en recherche active 🚀 » (1 672 lignes) porte un DOUBLE espace et un espace final ; « 🔧 Cas d'usage concrets » porte une apostrophe typographique U+2019.
- **`code_cible`** — Slug ASCII figé.
- **`origine`** — 'referentiel' si la valeur existait dans le ref_*, 'hors_referentiel' si elle n'existait que dans les données. 28 valeurs orphelines mesurées, 711 occurrences.
- **`occurrences_mesurees`** — AJOUTÉ, absent de correspondance.json. Le volume mesuré le 26/08 par valeur. C'est ce qui rend le contrôle de non-perte exécutable au lieu d'être documentaire : après reprise, la somme par référentiel doit valoir exactement le volume de contrôle (process.etape 7 213, mandat_tag_job 830, experience_product 11 350, experience_secteur 10 342, experience_expertise 9 478, job_reve_critere 8 882, job_reve_contrat 6 444, etc.).
- **`maj_le`** — Ne devrait jamais bouger : la ligne est une trace figée. Posé par uniformité de convention.

</details>
## `ref.critere`
TABLE — 32 critères d'un job rêvé. Consommateur unique, job_reve_critere, 8 882 lignes, 32/32 utilisées, ZÉRO orpheline. Table et non enum pour une raison précise : ce sont des libellés produit longs et reformulables (« Confiance dans la vision fondateurs », 36 caractères). Un enum figerait la formulation marketing dans le type SQL et rendrait toute réécriture d'un libellé migrante.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `code` | `text` | oui | public.ref_criteres.value [valeur_vers_referentiel] |
| `libelle_fr` | `text` | oui | public.ref_criteres.value [valeur_vers_referentiel] |
| `ordre` | `integer` | oui | public.ref_criteres.sort_order [renommee] |
| `actif` | `boolean` | oui | A_CREER — AJOUT DE MA PART |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — core.fiche_talent_critere(fiche_talent_id, critere_id) — N-N. critere_id → ref.critere(id) ON DELETE RESTRICT ; fiche_talent_id ON DELETE CASCADE. 8 882 lignes. · Le bloc « attentes » appartient à la fiche, pas à la projection : c'est la parole du candidat (Décision 3).

**Contraintes** — CHECK (code ~ '^[a-z0-9_]+$')

**Index**

- UNIQUE (code)
- INDEX (ordre) WHERE actif

<details>
<summary><b>Notes par attribut</b> (1)</summary>

- **`code`** — equilibre_vie_pro_perso, confiance_vision_fondateurs, culture_non_toxique… 28 des 32 valeurs contiennent un espace.

</details>
## `ref.etape_process`
TABLE — 14 étapes du tunnel de recrutement. RÉFÉRENTIEL DÉTRUIT EN PRODUCTION, à reconstruire depuis les 7 213 valeurs de process.etape. C'est le référentiel le plus chargé en logique du lot : 5 drapeaux pilotent la perte d'une candidature, ce que voit le candidat, et l'affichage kanban côté client vs côté Pachamama. Aucun type énuméré ne peut porter cela — table obligatoire, sans discussion.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `code` | `text` | oui | public.ref_process_etape.value [valeur_vers_referentiel] — CONTENU DÉTRUIT, reconstruit depuis process.etape |
| `libelle_interne` | `text` | oui | public.ref_process_etape.value [valeur_vers_referentiel] — le libellé SANS l'emoji |
| `emoji` | `text` | — | préfixe de public.ref_process_etape.value [calculee] |
| `libelle_talent` | `text` | — | public.ref_process_etape.public_display [renommee] — CONTENU DÉTRUIT (0/70) |
| `libelle_client` | `text` | — | public.ref_process_etape.public_display [renommee] — CONTENU DÉTRUIT (0/70) |
| `visible_client` | `boolean` | — | public.ref_process_etape.is_in_kanban_view_company [renommee] — CONTENU DÉTRUIT (false sur 70/70, valeur sans signification) |
| `visible_interne` | `boolean` | — | public.ref_process_etape.is_in_kanban_view_pachamama [renommee] — CONTENU DÉTRUIT |
| `est_ko` | `boolean` | oui | public.ref_process_etape.is_ko [renommee] — CONTENU DÉTRUIT mais DÉDUCTIBLE AVEC CERTITUDE |
| `est_terminale` | `boolean` | oui | A_CREER — AJOUT DE MA PART, absent du miroir |
| `est_publique` | `boolean` | — | public.ref_process_etape.is_public [renommee] — CONTENU DÉTRUIT |
| `actif` | `boolean` | — | public.ref_process_etape.is_active [renommee] — CONTENU DÉTRUIT |
| `ordre` | `integer` | oui | public.ref_process_etape.sort_order [renommee] — CONTENU DÉTRUIT mais reconstructible |
| `couleur_colonne` | `text` | — | public.ref_process_etape.kanban_column_color [renommee] — CONTENU DÉTRUIT (0/70) |
| `couleur_pastille` | `text` | — | public.ref_process_etape.kanban_tag_color [renommee] — CONTENU DÉTRUIT (0/70) |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — core.candidature.etape_id → ref.etape_process(id) ON DELETE RESTRICT, NULLABLE — 7 213 valeurs renseignées sur 7 243 lignes de process : 30 sont NULL à la source et le restent. RESTRICT et non CASCADE : supprimer une étape ne doit jamais supprimer des candidatures. · ref.correspondance(referentiel='ref_process_etape') porte les 14 chaînes brutes mesurées.

**Contraintes** — CHECK (code ~ '^[a-z0-9_]+$') · CHECK (couleur_colonne IS NULL OR couleur_colonne ~ '^#[0-9A-Fa-f]{6}$') et idem couleur_pastille · CHECK (NOT est_ko OR est_terminale) — un KO arrête toujours le process. À CONFIRMER par le métier avant de la poser : elle encode une règle, pas une mesure. · CHECK (ordre >= 0)

**Index**

- UNIQUE (code)
- UNIQUE (ordre) — deux étapes ne peuvent pas occuper la même colonne de kanban
- INDEX (est_ko) WHERE est_ko — le taux de KO est la mesure la plus lue du pipeline

<details>
<summary><b>Notes par attribut</b> (14)</summary>

- **`code`** — 14 codes déduits des 7 213 valeurs mesurées : ko_pachamama (4 302), ko_client (1 471), ko_candidat (468), hired (235), applicant (208), to_contact (176), contacted (110), send_out (87), interview_1 (48), interview_2 (46), ko (46), final_interview (9), screen_pachamama (5), push_candidature (2). Remplace « 🙅🏻‍♀️ KO by Pachamama » comme valeur — le défaut nommé au parti 6.
- **`libelle_interne`** — « KO by Pachamama ». Récupérable : les 14 libellés bruts sont dans process.etape.
- **`emoji`** — 12 emoji distincts retrouvés dans les 70 caractères explosés. NULL sur « Push Candidature », le seul libellé sans emoji.
- **`libelle_talent`** — DEMANDÉ PAR LA COMMANDE, et le miroir n'a qu'UN registre public (public_display) pour deux registres attendus. L'un des deux est donc A_CREER. Indice mesuré que le contenu existait : le jeu de caractères détruit contient un « é » qui n'apparaît dans AUCUN des 14 libellés internes — des libellés publics français existaient bel et bien. NE PAS INVENTER : à ré-extraire de l'option set Bubble Process_Etape_OS avant la coupure.
- **`libelle_client`** — Même remarque. Le kanban client tourne AUJOURD'HUI sur ce libellé : c'est une fonctionnalité en production dont le référentiel est détruit.
- **`visible_client`** — NULLABLE VOLONTAIREMENT : NULL veut dire « inconnu, à ré-extraire », false voudrait dire « décidé invisible ». Un défaut NOT NULL false inventerait une décision. RÈGLE D'USAGE : tant que NULL, l'application traite comme non visible (fermeture par défaut) — c'est un drapeau d'exposition, il ne s'ouvre pas par accident.
- **`visible_interne`** — Même raisonnement, mais sans enjeu de fuite.
- **`est_ko`** — Le seul des 5 drapeaux détruits qui se reconstruit sans arbitrage : les 4 libellés préfixés KO (ko_pachamama, ko_client, ko_candidat, ko) = 6 287 candidatures, soit les 87 % de KO mesurés. NOT NULL légitime parce que nous semons les 14 lignes nous-mêmes.
- **`est_terminale`** — AJOUTÉ. referentiels.json le propose déjà dans la définition cible mais sans colonne source. Distingue « le process s'arrête ici » (hired + les 4 KO) de « étape intermédiaire ». Sans lui, le délai de recrutement ne se calcule pas et le tableau de bord client confond arrêt et progression — même défaut que le « En pause » manquant sur statut_mandat.
- **`est_publique`** — Décide de ce que voit le candidat. Fermeture par défaut tant que NULL.
- **`actif`** — NULLABLE pour la même raison. Un default true rouvrirait 14 étapes dont certaines sont peut-être retirées du tunnel.
- **`ordre`** — Ordre de pipeline, déductible de la logique de recrutement : to_contact → contacted → screen_pachamama → push_candidature → applicant → send_out → interview_1 → interview_2 → final_interview → hired, les KO en fin. Reconstruction à faire valider par le métier — c'est ce qui ordonne les colonnes du kanban.
- **`couleur_colonne`** — Le # et les chiffres hexadécimaux sont présents dans les 70 caractères explosés : les couleurs existaient. Irrécupérables depuis le miroir.
- **`couleur_pastille`** — La commande demande « couleur » au singulier ; le miroir en portait DEUX, de rôles distincts (fond de colonne vs pastille d'étiquette). Je conserve les deux : les fusionner perdrait une distinction d'affichage réelle.

</details>
## `ref.evenement_note`
TABLE — 24 événements journalisables sur une note. Trop pour un enum confortable, et surtout le référentiel GRANDIT à chaque nouveau champ tracé : un enum imposerait une migration à chaque champ nouvellement audité. La ligne porte en plus un gabarit de message.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `code` | `text` | oui | public.ref_note_event.value [identique] |
| `type_evenement` | `type_note_event (enum)` | oui | public.ref_note_event.note_event_type [valeur_vers_referentiel] — 0/24, CONTENU VIDE mais RECONSTITUABLE À 100 % |
| `libelle_fr` | `text` | — | public.ref_note_event.note_event_text [renommee] — 20/24 renseigné |
| `ordre` | `integer` | oui | public.ref_note_event.sort_order [renommee] |
| `actif` | `boolean` | oui | A_CREER — AJOUT DE MA PART |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — core.note.evenement_id → ref.evenement_note(id) ON DELETE RESTRICT, NULLABLE — 1 477/25 728 lignes seulement, 18/24 valeurs utilisées. Un NOT NULL rejetterait 24 251 notes. · core.note.type_evenement est alors REDONDANT avec ref.evenement_note.type_evenement : ne pas le dupliquer sur la note, il se lit par jointure. Le miroir le dénormalisait (note.note_event_type, 1 477 lignes, avec un CHECK déjà en place).

**Contraintes** — CHECK (code = 'archive' OR code LIKE type_evenement::text // '_%') — cohérence préfixe/type, matérialise la reconstruction

**Index**

- UNIQUE (code)
- INDEX (type_evenement, ordre) WHERE actif

<details>
<summary><b>Notes par attribut</b> (4)</summary>

- **`code`** — DÉJÀ en snake_case : contract_free_update, info_salary, task_create, team_agent_1_com…
- **`type_evenement`** — NOT NULL malgré la colonne vide : le type se déduit du préfixe du code sans ambiguïté (contract_* → contract, info_* → info, task_* → task, team_* → team, archive → archive). La FK vide n'entraîne donc aucune perte.
- **`libelle_fr`** — NULLABLE OBLIGATOIRE : NULL sur les 4 événements task_*. Un NOT NULL rejetterait 4 lignes sur 24.
- **`actif`** — AJOUTÉ. 6 valeurs ne sont jamais utilisées : archive, contract_cus_update, contract_free_update, team_agent_2_com, team_coo, team_coo_com.

</details>
## `ref.expertise`
TABLE — 31 expertises techniques et produit. Vocabulaire ouvert : GenAI est récent, et 2 valeurs sont déjà apparues hors référentiel. Les intitulés portent des caractères hostiles à un identifiant (C#, C++, N/A, UX/UI) — raison supplémentaire de séparer un code ASCII du libellé affiché.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `code` | `text` | oui | public.ref_expertise.value [valeur_vers_referentiel] |
| `libelle_fr` | `text` | oui | public.ref_expertise.value [valeur_vers_referentiel] |
| `ordre` | `integer` | oui | public.ref_expertise.sort_order [renommee] |
| `actif` | `boolean` | oui | A_CREER — AJOUT DE MA PART |
| `origine` | `text` | oui | A_CREER — AJOUT DE MA PART |
| `fusionne_vers_id` | `uuid` | — | A_CREER |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — fusionne_vers_id → ref.expertise(id) ON DELETE SET NULL. · ref.expertise_univers(expertise_id, univers_id) — N-N vers ref.univers. · Consommateurs, NULLABLE, ON DELETE RESTRICT : core.talent_expertise (experience_expertise 9 478), core.fiche_talent_expertise (candidat_expertise 807). 10 285 lignes.

**Contraintes** — CHECK (code ~ '^[a-z0-9_]+$') · CHECK (origine IN ('referentiel','decouvert_en_donnees')) · CHECK (fusionne_vers_id IS NULL OR fusionne_vers_id <> id)

**Index**

- UNIQUE (code)
- INDEX (ordre) WHERE actif

<details>
<summary><b>Notes par attribut</b> (4)</summary>

- **`code`** — genai, nocode, machine_learning, c_sharp, c_plus_plus, na, ux_ui…
- **`actif`** — AJOUTÉ. 6 valeurs jamais utilisées par candidat_expertise (C#, C++, Elixir, Golang, Rust, Scala).
- **`origine`** — AJOUTÉ. 2 orphelines mesurées sur experience_expertise : « UX/UI » 29, « Integrations » 20.
- **`fusionne_vers_id`** — Justifié par une mesure : « UX/UI » (29 occurrences) est probablement la fusion de UX et UI qui existent tous les deux.

</details>
## `ref.expertise_univers`
TABLE DE LIAISON — 49 rattachements expertise ↔ univers. 31 expertises sur 31 rattachées, 10 portent plusieurs univers : N-N réelle, impossible à replier. Couverture complète, rien à réparer.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `expertise_id` | `uuid` | oui | public.ref_expertise_univers.expertise_value [valeur_vers_referentiel] — résolu par code |
| `univers_id` | `uuid` | oui | public.ref_expertise_univers.univers_value [valeur_vers_referentiel] — résolu par code |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — expertise_id → ref.expertise(id) ON DELETE CASCADE · univers_id → ref.univers(id) ON DELETE RESTRICT

**Contraintes** — Couverture complète mesurée (31/31) : une contrainte de couverture serait tenable ici, mais elle empêcherait de créer une expertise avant de la classer. Je ne la propose pas.

**Index**

- UNIQUE (expertise_id, univers_id)
- INDEX (univers_id) — jusqu'à 18 expertises par univers
## `ref.libelle`
Table transverse : porte le libellé, l'emoji, la couleur, l'icône, l'ordre et le drapeau actif des 28 TYPES ÉNUMÉRÉS du cible. C'est elle qui permet de passer de 47 tables ref_* à 15 : un attribut de PRÉSENTATION ne justifie plus jamais une table. Sans elle, chaque enum de 3 valeurs portant une couleur exigerait sa propre table — le mécanisme même qui a produit 30 tables de 5 lignes ou moins.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `domaine` | `text` | oui | A_CREER — nom du type énuméré auquel le code appartient |
| `code` | `text` | oui | public.ref_apporteur_affaires.value, ref_background.value, ref_cible.value, ref_company_type.value, ref_contrat.value, ref_contributor_type.value, ref_emoji.value, ref_fonction.value, ref_form_41.value, ref_form_42.value, ref_formule.value, ref_gender.value, ref_language.value, ref_mandate_status.value, ref_mandate_visibility.value, ref_mindset.value, ref_niveau_analyse.value, ref_niveau_anglais.value, ref_note_event_type.value, ref_product.value, ref_product_type.value, ref_profile.value, ref_remote.value, ref_role.value, ref_source_marketing.value, ref_statut_candidat.value, ref_task_anchor.value, ref_task_event.value (28 colonnes) [valeur_vers_referentiel] |
| `libelles` | `jsonb` | oui | public.ref_contributor_type.full_display, ref_fonction.label_en, ref_fonction.label_fr, ref_gender.label_en, ref_gender.label_fr, ref_language.label, ref_mandate_status.status_admin_label, ref_mandate_visibility.label_fr, ref_niveau_anglais.candidat_display, + la valeur d'origine de chaque ref_* comme registre 'fr' [fusionnee_avec] |
| `emoji` | `text` | — | extrait du préfixe de public.ref_contrat.value, ref_emoji.value, ref_form_41.value, ref_form_42.value, ref_mindset.value, ref_statut_candidat.value [calculee] |
| `couleur` | `text` | — | public.ref_contrat.color, ref_mandate_status.status_color, ref_niveau_analyse.color [renommee] |
| `icone_url` | `text` | — | public.ref_mandate_visibility.tooltip_icon [renommee] |
| `ordre` | `integer` | oui | public.ref_*.sort_order des 28 référentiels + public.ref_mandate_status.status_sort_order [fusionnee_avec, renommee] |
| `actif` | `boolean` | oui | public.ref_remote.is_active [renommee] |
| `est_recruteur` | `boolean` | — | public.ref_role.role_category [type_corrige] |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — Référencée PAR VALEUR (domaine, code) depuis les 28 types énumérés — jamais par clé étrangère : PostgreSQL ne peut pas contraindre une table vers un type. · ref.correspondance(referentiel, libelle_miroir) → code_cible garde la trace auditable de chaque valeur brute du miroir.

**Contraintes** — CHECK (code ~ '^[a-z0-9_]+$') — impose le slug ASCII, c'est la matérialisation du parti 6 · CHECK (domaine IN (28 valeurs listées)) — à défaut d'une FK impossible vers un type · CHECK (couleur IS NULL OR couleur ~ '^#[0-9A-Fa-f]{6}$') · CHECK (jsonb_typeof(libelles) = 'object') · CHECK (libelles ?/ array['fr','en','court','long','candidat','recruteur','public'] OR libelles = '{}'::jsonb) — interdit un registre inventé · CHECK (ordre >= 0)

**Contraintes — complément restauré** — CHECK (libelles ?| array['fr','en','court','long','candidat','recruteur','public'] OR libelles = '{}'::jsonb) — interdit un registre inventé

**Index**

- UNIQUE (domaine, code)
- INDEX (domaine, ordre) WHERE actif — la liste déroulante d'un domaine est la seule lecture chaude

<details>
<summary><b>Notes par attribut</b> (10)</summary>

- **`id`** — Parti 2. correspondance.json proposait une PK composite (domaine, code) : je la conserve en contrainte UNIQUE, pas en PK. ÉCART SIGNALÉ.
- **`domaine`** — 28 valeurs. CHECK sur la liste fermée (voir contraintes). LIMITE RÉELLE À SIGNALER : PostgreSQL ne sait pas poser de clé étrangère vers un TYPE. La cohérence entre ref.libelle et les 28 enums n'est donc PAS garantie par la base — il faut un test de non-régression comparant enum_range() aux lignes de ref.libelle.
- **`code`** — Slug ASCII figé une fois pour toutes. Il ne doit JAMAIS être recalculé après mise en production, sinon il cesse d'être stable.
- **`libelles`** — Registres nommés : fr, en, court, long, candidat, recruteur, public. Deux registres pour un même code sont MESURÉS et non hypothétiques : ref_niveau_anglais porte une phrase recruteur en clé et une phrase candidat dans candidat_display ; ref_mandate_status porte « Closé par Pachamama » en clé et « Closé » dans status_admin_label. Impossible à exprimer tant que la clé EST le libellé.
- **`emoji`** — Séquence Unicode isolée. NULL légitime : lead et client de ref_statut_candidat n'ont pas d'emoji, et c'est un indice de l'historique du référentiel, pas une erreur. Pour ref_emoji l'emoji EST la donnée, pas une décoration.
- **`couleur`** — Hexadécimal 6 chiffres, mesuré sur les 9 valeurs présentes.
- **`icone_url`** — 3 SVG sur le CDN Bubble — meurent à la coupure de l'abonnement.
- **`ordre`** — ref_mandate_status porte DEUX colonnes d'ordre avec la même séquence 1,2,3,4 : duplication, on n'en garde qu'une. L'ordre n'est pas cosmétique partout : sur ref_mindset il encode une intensité croissante d'intention de recherche, sur ref_niveau_anglais une échelle croissante.
- **`actif`** — Porte les 3 codes obsolètes de rythme_remote (526 lignes) à actif=false.
- **`est_recruteur`** — 100 % NULL dans le miroir (0/5). Renseigné uniquement pour domaine='role_utilisateur', sur les 2 codes recruiter_*. SMELL ASSUMÉ : un drapeau spécifique à un domaine dans une table générique. Il ne survit que pour ne pas perdre l'intention de ref_role_category ; la Décision 4 de l'ADR le rend probablement caduc (deux axes portail/pouvoir dans app.acces). À arbitrer.

</details>
## `ref.maturite_produit`
TABLE — 5 niveaux de maturité produit, A à E. Cas rare où la valeur interne est DÉJÀ saine (une lettre) et où c'est l'attribut qui décide : chaque niveau porte une image_url, ce qu'un enum ne peut pas héberger.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `code` | `text` | oui | public.ref_maturite_produit.value [valeur_vers_referentiel] |
| `libelle_fr` | `text` | — | A_CREER — le miroir ne contient AUCUN libellé explicatif pour A..E |
| `image_url` | `text` | — | public.ref_maturite_produit.image_url [identique] — 5/5 renseigné |
| `ordre` | `integer` | oui | public.ref_maturite_produit.sort_order [renommee] |
| `actif` | `boolean` | oui | A_CREER — AJOUT DE MA PART |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — core.produit.maturite_id → ref.maturite_produit(id) ON DELETE RESTRICT, NULLABLE — 84/103 lignes renseignées, 19 produits sans maturité.

**Contraintes** — CHECK (code ~ '^[a-e]$') — le domaine est fermé et connu

**Index**

- UNIQUE (code)
- INDEX (ordre)

<details>
<summary><b>Notes par attribut</b> (5)</summary>

- **`code`** — a, b, c, d, e. La clé du miroir est déjà un code, pas un libellé.
- **`libelle_fr`** — NULLABLE parce qu'il n'y a rien à y mettre aujourd'hui. Le sens de A..E n'existe que dans 5 images Bubble et dans la tête de l'équipe. À documenter AVANT la coupure, sinon l'information est perdue pour de bon. C'est le seul référentiel du lot sans aucun libellé.
- **`image_url`** — 5 URLs sur le CDN Bubble. NULLABLE bien que rempli : elles deviendront nulles pendant le rapatriement.
- **`ordre`** — L'ordre porte du sens ici : A..E est une échelle.
- **`actif`** — AJOUTÉ. « E » n'est jamais utilisé (produit.maturite : B 36, C 30, A 13, D 5).

</details>
## `ref.metier`
TABLE — 238 intitulés de poste. Le plus gros référentiel du lot et le plus ouvert : 16 intitulés sont apparus dans les données sans passer par le référentiel, ce qui prouve que la liste bouge au rythme du marché. Un enum imposerait un ALTER TYPE à chaque nouveau poste.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `code` | `text` | oui | public.ref_metier.value [valeur_vers_referentiel] |
| `libelle_fr` | `text` | oui | public.ref_metier.value [valeur_vers_referentiel] |
| `ordre` | `integer` | oui | public.ref_metier.sort_order [renommee] |
| `actif` | `boolean` | oui | A_CREER — AJOUT DE MA PART |
| `origine` | `text` | oui | A_CREER — AJOUT DE MA PART |
| `fusionne_vers_id` | `uuid` | — | A_CREER — exigé par la fonctionnalité « Nettoyage des doublons de taxonomie (Metier_OS) » |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — fusionne_vers_id → ref.metier(id) ON DELETE SET NULL — auto-référence, un métier absorbé pointe son absorbant. · ref.metier_univers(metier_id, univers_id) — N-N vers ref.univers. · Consommateurs mesurés, tous NULLABLE et tous ON DELETE RESTRICT : core.talent (job_actuel.metier 5 931/7 029, job_reve.metier 4 404/7 029), core.fiche_talent (candidat.metier_actuel 2 243/7 028), core.mandat.metier_id (530/534), core.mandat_contact_client (equipe.metier 660/766). 13 768 lignes consommatrices sur 5 colonnes.

**Contraintes** — CHECK (code ~ '^[a-z0-9_]+$') · CHECK (origine IN ('referentiel','decouvert_en_donnees')) · CHECK (fusionne_vers_id IS NULL OR fusionne_vers_id <> id) — pas d'auto-fusion · CHECK (fusionne_vers_id IS NULL OR NOT actif) — un métier fusionné n'est plus proposé à la saisie

**Index**

- UNIQUE (code)
- INDEX (ordre) WHERE actif
- INDEX GIN sur libelle_fr en trigrammes (pg_trgm) — 238 valeurs saisies au clavier par les recruteurs, la recherche par préfixe est le seul usage chaud du référentiel

<details>
<summary><b>Notes par attribut</b> (6)</summary>

- **`id`** — correspondance.json nomme la PK « metier_id ». CORRECTION : le parti 8 réserve le suffixe _id aux clés étrangères. Toutes les PK de ref.* et config.* sont nommées « id ». ÉCART SIGNALÉ, il porte sur 8 entités.
- **`code`** — Slug ASCII : head_of_product, engineering_director… 222 des 238 valeurs contiennent un espace, longueur max 42.
- **`libelle_fr`** — Valeur d'origine conservée intacte, accents et caractères spéciaux compris.
- **`actif`** — AJOUTÉ. 97 valeurs ne sont jamais utilisées par mandat.metier, 27 par job_actuel.metier : la liste de saisie doit pouvoir se réduire sans casser l'historique.
- **`origine`** — AJOUTÉ. Les 16 orphelines (52 occurrences) entrent en 'decouvert_en_donnees' pour arbitrage, jamais rejetées : Engineering Director 12, Program Manager 7, Platform Owner 5, Lead ML 5, Web Analytics Manager 5, Business Process Owner 4, Founding Engineer 4, Senior DevOps 2, puis 8 à 1 occurrence.
- **`fusionne_vers_id`** — correspondance.json place cet attribut sur ref.libelle. CORRECTION : ref.libelle sert les 28 enums, qui sont des vocabulaires FERMÉS et n'ont pas de doublons à fusionner. Le besoin de déduplication est mesuré sur les vocabulaires OUVERTS — Engineering Director vs Head of Engineering, Senior DevOps vs DevOps, Lead ML / Senior ML vs Machine Learning Engineer. Il appartient donc à ref.metier et ref.expertise.

</details>
## `ref.metier_univers`
TABLE DE LIAISON — 361 rattachements métier ↔ univers. Vraie relation N-N portée par les données : 77 métiers sur 238 portent PLUSIEURS univers, ce qui interdit de replier l'univers en colonne scalaire sur ref.metier. C'est la seule table du lot qui n'est pas un vocabulaire mais un rattachement.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `metier_id` | `uuid` | oui | public.ref_metier_univers.metier_value [valeur_vers_referentiel] — résolu par code |
| `univers_id` | `uuid` | oui | public.ref_metier_univers.univers_value [valeur_vers_referentiel] — résolu par code |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — metier_id → ref.metier(id) ON DELETE CASCADE — le rattachement n'a pas de sens sans son métier. · univers_id → ref.univers(id) ON DELETE RESTRICT — un univers ne se supprime pas tant qu'il classe des métiers ; il se ferme par est_ouvert.

**Contraintes** — Couverture mesurée : 237 métiers sur 238 rattachés à au moins un univers. Le métier non rattaché est à identifier avant de poser une contrainte de couverture — je n'en propose PAS, elle échouerait sur cette ligne.

**Index**

- UNIQUE (metier_id, univers_id)
- INDEX (univers_id) — lecture inverse « tous les métiers d'un univers », jusqu'à 106 lignes

<details>
<summary><b>Notes par attribut</b> (1)</summary>

- **`id`** — correspondance.json propose une PK composite. J'applique le parti 2 (id uuid partout) et je garde le couple en UNIQUE : l'intégrité est identique et l'application peut adresser une ligne. ÉCART SIGNALÉ.

</details>
## `ref.secteur`
TABLE — 52 secteurs d'activité. Le référentiel le plus sain du lot : ZÉRO orpheline sur 15 918 lignes consommatrices réparties sur 5 colonnes. Table et non enum pour deux raisons mesurées : 52 valeurs dépassent le seuil où un enum reste manipulable, et le vocabulaire est ouvert (ClimateTech, Spacetech, Regtech sont récents et déjà présents).

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `code` | `text` | oui | public.ref_secteur.value [valeur_vers_referentiel] |
| `libelle_fr` | `text` | oui | public.ref_secteur.value [valeur_vers_referentiel] |
| `ordre` | `integer` | oui | public.ref_secteur.sort_order [renommee] |
| `actif` | `boolean` | oui | A_CREER — AJOUT DE MA PART |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — Consommateurs mesurés, tous NULLABLE, tous ON DELETE RESTRICT : core.talent_secteur (experience_secteur 10 342, 52/52 utilisées), core.fiche_talent_secteur_nogo (job_reve_secteur_nogo 1 803, 52/52), core.fiche_talent_secteur (job_reve_secteur 2 846, 50/52), candidat_secteur 747 (46/52), core.entreprise.secteur_id (180/850, 38/52).

**Contraintes** — CHECK (code ~ '^[a-z0-9_]+$')

**Index**

- UNIQUE (code)
- INDEX (ordre) WHERE actif

<details>
<summary><b>Notes par attribut</b> (1)</summary>

- **`code`** — adtech, fintech, consulting_services, blockchain_nft… 11 des 52 valeurs contiennent un espace ou une barre oblique.

</details>
## `ref.statut_contrat`
TABLE — 5 statuts de contrat. Cinq valeurs seulement, donc l'enum serait tentant, MAIS signature_requise est un drapeau de LOGIQUE MÉTIER : il décide si un contrat doit être relancé. Un enum le laisserait sans domicile. Table minuscule assumée.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `code` | `text` | oui | public.ref_contract_status.value [valeur_vers_referentiel] |
| `libelle_fr` | `text` | oui | public.ref_contract_status.value [valeur_vers_referentiel] — libellé sans emoji |
| `emoji` | `text` | — | préfixe de public.ref_contract_status.value [calculee] |
| `couleur` | `text` | — | public.ref_contract_status.couleur [identique] — 4/5 renseigné |
| `signature_requise` | `boolean` | oui | public.ref_contract_status.signature_required [renommee] — 5/5 renseigné |
| `ordre` | `integer` | oui | public.ref_contract_status.sort_order [renommee] |
| `actif` | `boolean` | oui | A_CREER — AJOUT DE MA PART |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — core.placement.statut_contrat_freelance_id → ref.statut_contrat(id) ON DELETE RESTRICT, NULLABLE (221/227) · core.placement.statut_contrat_entreprise_id → idem, NULLABLE (221/227) · core.entreprise.statut_contrat_id → idem, NULLABLE (194/850) — 656 entreprises sans statut, un NOT NULL est exclu

**Contraintes** — CHECK (code ~ '^[a-z0-9_]+$') · CHECK (couleur IS NULL OR couleur ~ '^#[0-9A-Fa-f]{6}$')

**Index**

- UNIQUE (code)
- INDEX (ordre) WHERE actif

<details>
<summary><b>Notes par attribut</b> (6)</summary>

- **`id`** — correspondance.json propose « code text PK ». CORRECTION parti 2 : id uuid PK, code en UNIQUE. Même écart sur maturite_produit, type_tache, evenement_note et les entités config.*.
- **`code`** — non_signe, envoye, signe, expire, non_requis.
- **`libelle_fr`** — « Not required » est un libellé anglais dans une liste française : conservé tel quel ici, francisable sans casser la reprise puisque la chaîne d'origine vit dans ref.correspondance.
- **`emoji`** — 5/5 en portent un, mais DEUX partagent ✅ (« Contrat signé » et « Not required ») : le pictogramme ne discrimine plus. À arbitrer au moment de fixer les libellés.
- **`couleur`** — NULLABLE OBLIGATOIRE : « Not required » n'a pas de couleur. Un NOT NULL rejetterait la ligne.
- **`actif`** — AJOUTÉ. « Contrat expiré » n'est utilisé par aucun consommateur.

</details>
## `ref.tag_job`

> ⚠ **SOURCE DÉTRUITE — corrigé le 28/08/2026.** Cette fiche annonce
> « 74 tags » et « icone_url 0/74 » : ces chiffres viennent d'une table
> corrompue. `public.ref_tag_job` contient 74 lignes portant CHACUNE UN
> SEUL CARACTÈRE, avec un `sort_order` allant jusqu'à 1899 — les débris
> d'une chaîne explosée caractère par caractère. Le référentiel réel
> compte **16 valeurs**, intégralement reconstructibles depuis les 833
> lignes de `public.mandat_tag_job`. L'observation du détail selon
> laquelle « Job exclu » n'a jamais existé au référentiel était juste
> mais très en deçà : AUCUNE des 16 valeurs n'y figure. Détail et
> conséquences de reprise dans la migration `20260828203000`.

TABLE — 16 arguments de vente affichés sur une offre. RÉFÉRENTIEL DÉTRUIT EN PRODUCTION, reconstruit depuis les 830 lignes de mandat_tag_job. Table et non enum : vocabulaire marketing qui bouge, et un attribut d'asset (icone_url) qu'un type énuméré ne peut pas porter.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `code` | `text` | oui | public.ref_tag_job.value [valeur_vers_referentiel] — CONTENU DÉTRUIT, reconstruit depuis mandat_tag_job |
| `libelle_fr` | `text` | oui | public.ref_tag_job.value [valeur_vers_referentiel] — libellé SANS emoji |
| `emoji` | `text` | — | préfixe de public.ref_tag_job.value [calculee] |
| `icone_url` | `text` | — | public.ref_tag_job.icone_url [identique] — 0/74 renseigné, CONTENU ENTIÈREMENT PERDU |
| `ordre` | `integer` | oui | public.ref_tag_job.sort_order [renommee] — CONTENU DÉTRUIT |
| `actif` | `boolean` | oui | A_CREER — AJOUT DE MA PART |
| `origine` | `text` | oui | A_CREER — AJOUT DE MA PART |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — core.mandat_tag_job(mandat_id, tag_job_id) — N-N. tag_job_id → ref.tag_job(id) ON DELETE RESTRICT ; mandat_id → core.mandat(id) ON DELETE CASCADE. 830 lignes à reprendre. · ref.correspondance(referentiel='ref_tag_job') porte les 16 chaînes brutes.

**Contraintes** — CHECK (code ~ '^[a-z0-9_]+$') · CHECK (origine IN ('referentiel','hors_referentiel'))

**Index**

- UNIQUE (code)
- INDEX (ordre) WHERE actif

<details>
<summary><b>Notes par attribut</b> (6)</summary>

- **`code`** — 16 codes mesurés : boite_fr (152), croissance_saine (84), cas_usage_concrets (82), stabilite_financiere (74), international (74), career_move (74), cible_users_sympa (69), boite_a_impact (57), product_led (37), full_remote (34), intrapreneuriat (25), lancement_produit (25), job_exclu (18), max_bspce (15), diversite (9), licorne (1). Total 830.
- **`libelle_fr`** — « Boite FR », « Max de BSPCE », « Cas d'usage concrets » (apostrophe typographique U+2019 dans la chaîne brute).
- **`emoji`** — 15 des 16 tags portent un emoji en préfixe. NULL sur job_exclu.
- **`icone_url`** — Colonne conservée vide et documentée : la colonne dit ce qui manque. Même fenêtre de récupération Bubble que ref.etape_process.
- **`actif`** — AJOUTÉ. Un argument marketing se retire de la liste de saisie sans détruire les 830 rattachements existants.
- **`origine`** — AJOUTÉ. job_exclu (18 mandats) N'A JAMAIS EXISTÉ dans l'option set : la lettre J est absente du jeu de 74 caractères explosés, preuve formelle d'une saisie hors référentiel. Le marquer 'hors_referentiel' plutôt que le rejeter.

</details>
## `ref.type_tache`
TABLE — 12 types de tâche. Douze valeurs, mais la ligne EST une règle de planification exécutable : un gabarit de texte, un décalage en jours, une ancre temporelle et un drapeau admin. Ce n'est pas un vocabulaire, c'est de la configuration.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `code` | `text` | oui | public.ref_task_type.value [identique] |
| `libelle_fr` | `text` | — | A_CREER — le miroir n'a pas de libellé court |
| `gabarit_texte` | `text` | oui | public.ref_task_type.task_text [renommee] — 12/12 renseigné |
| `est_admin` | `boolean` | oui | public.ref_task_type.is_admin [renommee] — 12/12 |
| `delai_relatif_jours` | `smallint` | oui | public.ref_task_type.relative_time [renommee] — 12/12 |
| `ancre` | `ancre_tache (enum)` | — | public.ref_task_type.task_anchor [valeur_vers_referentiel] — 0/12, CONTENU VIDE |
| `evenement` | `evenement_tache (enum)` | oui | public.ref_task_type.task_event [valeur_vers_referentiel] — 0/12 mais RECONSTRUCTIBLE À 100 % |
| `ordre` | `integer` | oui | public.ref_task_type.sort_order [renommee] |
| `actif` | `boolean` | oui | A_CREER — AJOUT DE MA PART |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — core.tache.type_tache_id → ref.type_tache(id) ON DELETE RESTRICT, NULLABLE — 1 067/1 136 lignes de task renseignées, les 12 valeurs sont utilisées (112 max, 58 min). · public.task_notif.task_type est vide à 100 % (0/1 152) : la table task_notif se replie dans core.tache, cette colonne ne porte rien.

**Contraintes** — CHECK (code LIKE evenement::text // '_%') — cohérence préfixe/événement, et c'est la contrainte qui garantit la reconstruction · CHECK (delai_relatif_jours BETWEEN -365 AND 365) — borne de sanité, à valider

**Contraintes — complément restauré** — CHECK (code LIKE evenement::text || '_%') — cohérence préfixe/événement, et c'est la contrainte qui garantit la reconstruction

**Index**

- UNIQUE (code)
- INDEX (evenement, ordre) WHERE actif — la planification lit par événement

<details>
<summary><b>Notes par attribut</b> (7)</summary>

- **`code`** — DÉJÀ en snake_case propre dans le miroir : mandate_clo_free_onboarding, mandate_clo_cdi_invoice_cus… Rien à slugifier.
- **`libelle_fr`** — task_text est un GABARIT, pas un libellé : « [b]Onboarding[/b] du talent placé » n'est pas un intitulé de liste. Le parti 6 veut un libellé ; il est à créer. NULLABLE tant qu'il n'existe pas.
- **`gabarit_texte`** — Contient du BBCode ([b]…[/b]) à convertir vers le balisage du cible.
- **`est_admin`** — correspondance.json garde le nom anglais is_admin. Francisé, parti 8.
- **`delai_relatif_jours`** — Unité : JOURS, à porter en COMMENT ON COLUMN. Valeurs mesurées -1, 0, 1, 15 — le négatif est légitime (une tâche avant l'ancre).
- **`ancre`** — NULLABLE OBLIGATOIRE et arbitrage requis. Sans l'ancre, « J+15 après QUOI » est incomplet et la planification automatique n'est pas réimplémentable. Ce n'est pas un concept mort : les 3 ancres correspondent à des colonnes réelles de mandatclose (created_at, date_debut, date_fin_garantie) et delai_relatif_jours est renseigné.
- **`evenement`** — NOT NULL malgré une colonne source vide, et c'est justifié : les 2 valeurs sont exactement les préfixes des 12 codes (6 en mandate_clo_free_*, 6 en mandate_clo_cdi_*). Aucun arbitrage. Contrairement à l'ancre, il n'y a rien à décider.

</details>
## `ref.univers`
TABLE — 8 verticales métier. Seulement 8 valeurs, ce qui plaiderait pour un enum, MAIS 6 attributs propres dont 3 URLs d'assets et un drapeau est_ouvert qui pilote l'ouverture commerciale d'une verticale. C'est une dimension métier, pas une énumération : les couleurs et les logos sont des données que l'application lit. Un enum obligerait à inventer une table pour les porter de toute façon.

| attribut | type | oblig. | origine |
|---|---|:--:|---|
| `id` | `uuid` | oui | A_CREER |
| `code` | `text` | oui | public.ref_univers.value [valeur_vers_referentiel] |
| `libelle_fr` | `text` | oui | public.ref_univers.value [valeur_vers_referentiel] |
| `couleur_primaire` | `text` | — | public.ref_univers.color [renommee] — 4/8 renseigné |
| `couleur_secondaire` | `text` | — | public.ref_univers.secondary_color [renommee] — 4/8 |
| `logo_url` | `text` | — | public.ref_univers.logo_url [identique] — 3/8 |
| `logo_mini_url` | `text` | — | public.ref_univers.logo_mini_url [identique] — 3/8 |
| `talent_card_url` | `text` | — | public.ref_univers.talent_card_url [identique] — 4/8 |
| `est_ouvert` | `boolean` | oui | public.ref_univers.is_live [renommee] — 8/8 renseigné |
| `ordre` | `integer` | oui | public.ref_univers.sort_order [renommee] |
| `actif` | `boolean` | oui | A_CREER — AJOUT DE MA PART |
| `cree_le` | `timestamptz` | oui | A_CREER |
| `maj_le` | `timestamptz` | oui | A_CREER |

**Relations** — ref.metier_univers et ref.expertise_univers — deux N-N référentielles authentiques (max 8 univers par métier, max 106 métiers par univers). · Consommateurs mesurés, 9 au total, tous NULLABLE, tous ON DELETE RESTRICT : core.fiche_talent (candidat.univers 5 936/7 028), core.talent (job_actuel.univers 5 173, job_reve.univers 4 400), core.mandat_contact_client (equipe.univers 684/766), core.mandat.univers_id (460/534), core.placement (mandatclose.univers 225/227), core.collaborateur (user_partner.univers 8/8 — la table user_partner se replie dans le collaborateur, ce n'est pas une entité). 16 890 lignes consommatrices.

**Contraintes** — CHECK (code ~ '^[a-z0-9_]+$') · CHECK (couleur_primaire IS NULL OR couleur_primaire ~ '^#[0-9A-Fa-f]{6}$') et idem couleur_secondaire


---

# À nettoyer avant de poser les contraintes

- 24 lignes de satellites 1-1 portent un candidat_id NUL et ne peuvent pas être repliées : candidat_expanded 1 (7 029 lignes / 7 028 remplies), job_actuel 1 (7 029 / 7 028), job_reve 1 (7 029 / 7 028), experience 21 (7 049 / 7 028). À trier AVANT le repli, pas à jeter — la correspondance le dit déjà pour experience.
- Les lignes de liaison accrochées à ces 21 experience orphelines (experience_expertise 9 478, experience_secteur 10 342, experience_product 11 350, experience_profile 5 223, experience_background 5 218 pointent un experience_id, pas un candidat_id) deviendront orphelines au remap experience_id→fiche_talent_id. À compter et à trancher avant de poser les FK.
- Valeurs orphelines de référentiel qui feront échouer la conversion en code : expertise « UX/UI » 29 et « Integrations » 20 ; remote « Télétravail » 367 + « Indifférent » 76 + « Présentiel » 47 sur candidat_remote (526 lignes tous consommateurs confondus) ; niveau_anglais « Bon niveau global mais pas au quotidien » 59 ; contrat « Entrepreneur » 20 sur candidat_contrat + 17 sur job_reve_contrat ; metier 16 valeurs absentes du référentiel (52 occurrences).
- job_actuel.entreprise_nom : 1 285 valeurs dont 69 % contiennent un identifiant Bubble au lieu d'un nom d'entreprise (constat ADR Partie C). Nettoyage requis avant de considérer poste_actuel_employeur comme un nom affichable.
- Doublons d'email : 6 702 email_perso remplis sur 7 028, unicité JAMAIS mesurée. Mesurer avant de poser le moindre index unique sur lower(email_personnel) — la vue de contrôle est livrée à la place.
- candidat_tag : 86 lignes, alors que l'ADR mesure 89 tags sur 110 rattachés à rien. Vérifier que les 86 tag_id résolvent bien vers core.tag avant la FK ON DELETE CASCADE.
- candidat.agent_pachamama_id (605) et candidat_expanded.agent_id (1 955) doivent résoudre vers un collaborateur interne, or l'ADR ne mesure que 41 rôles internes sur 4 597 comptes. Les identifiants non résolus doivent être mis à NULL, pas rejetés.
- candidat.business_maker_id : 14 valeurs (0,2 %) à vérifier contre business_maker avant la FK vers core.apporteur_affaires.
- candidat.created_by : 6 808 identifiants d'utilisateur Bubble non résolvables vers app.compte (auth_id vide sur les 4 605 lignes de user). Ils atterrissent en texte dans cree_par_legacy_bubble, sans FK.
- 374 talents du pivot sont nés de la fusion de 769 candidats : AUCUN index unique sur fiche_talent.talent_id, ni maintenant ni plus tard. La vue de contrôle core.v_talent_multi_fiche les liste.
- Tables mortes à ne pas migrer : candidat_jobtype (0 ligne), candidat_note (0 ligne alors que note.candidat_id porte 23 419 liens).
- Colonnes mesurées à 0 valeur, non migrées : candidat.opento, candidat.portfolio, candidat.ajout_par_id, candidat.slug, candidat_expanded.slug, experience.entreprise_id, experience.slug, job_actuel.slug, job_reve.slug.
- Le drapeau Actif de Bubble est rempli à 100 % sur 6 783 candidats et n'a JAMAIS été synchronisé : fiche_talent.actif ne peut pas être backfillé depuis le miroir, il faut le récupérer par l'API Bubble avant le cut. Idem pour bubble_modifie_le (Modified Date).
- core.mandat — 1 ligne sur 534 est vide sur quatre colonnes à la fois : titre, entreprise_id, statut, visibilite (533/534 partout). Tant qu'elle est là, aucun NOT NULL n'est posable sur ces quatre colonnes ; une fois traitée, statut peut devenir NOT NULL DEFAULT 'nouveau' et entreprise_id NOT NULL.
- core.candidature — 19 lignes de process sans candidat, 20 sans mandat, 20 sans entreprise, 30 sans étape. Ce sont ces lignes exactement qui font échouer la migration si l'on suit correspondance.json (talent_id, mandat_id et etape_id y sont obligatoires).
- core.repartition_commission — 5 lignes sans placement (261/266) et 1 valeur de mandatclose_id orpheline sur 1 ligne. À traiter avant de poser la FK vers core.placement.
- core.analyse — 20 analyses sans mandat sur 501. Elles ne bloquent pas la FK (mandat_id reste nullable) mais elles n'ont pas de propriétaire : à rattacher ou à archiver.
- core.placement — 1 ligne sur 227 sans mandat, sans entreprise et sans candidature. Et 2 candidatures partagent un placement (226 non nuls pour 224 distincts) : à trancher avant toute tentation d'unicité.
- app.mandat_publication — avant de semer les lignes depuis visibilite : 4 mandats sont à la fois 'public' et hors marché, et 15 sont 'public' mais clos. Chacun doit être arbitré individuellement ; les semer mécaniquement publierait des offres fermées.
- core.vivier_mandat — 7 couples de candidat_mandat n'existent pas dans process, et 4 492 couples de process n'existent pas dans candidat_mandat. Les 7 doivent être qualifiés avant migration, sinon la reprise les transforme en viviers sans intention.
- ref.etape_process — le référentiel source est DÉTRUIT (70 lignes d'un caractère isolé, 7 attributs perdus dont libelle_public, is_public et les deux drapeaux kanban). Les 14 étapes se reconstruisent depuis les 7 213 valeurs de process.etape, mais les 7 attributs doivent être ré-extraits de l'option set Bubble Process_Etape_OS AVANT la coupure de l'abonnement. La FK core.candidature.etape_id n'est posable qu'après.
- ref.tag_job — même destruction (74 lignes d'un caractère), icone_url perdu sur les 16 tags. Les 16 codes se reconstruisent depuis les 830 lignes de mandat_tag_job, dont « Job exclu » (18 mandats) qui n'a jamais existé dans le référentiel.
- core.mandat_remote — 26 lignes portent 3 valeurs d'un vocabulaire antérieur (21 « Télétravail », 4 « Présentiel », 1 « Indifférent »). Elles ne sont pas traduisibles dans la grille Hybride/Full Remote : soit l'enum accueille 3 codes obsolètes, soit ces lignes disparaissent.
- core.mandat.contrat — 1 mandat porte l'orpheline « Entrepreneur », qui est aussi une valeur de ref_profile. Trancher : 3e type de contrat, ou saisie erronée.
- public.mandatclose.agent_filtre_id et agent_2_filtre_id — abandonnées comme dénormalisations de mandat.agent_en_charge_id et agent_2_id. Contrôle de non-perte à passer d'abord : toute ligne où le filtre diffère de l'agent du mandat doit être remontée (224 et 14 lignes concernées).
- core.tache — 1 valeur orpheline de task.mandatclose_id sur 5 lignes, alors que c'est le SEUL rattachement de la tâche. À traiter avant la FK vers core.placement.
- core.placement_utilisateur — vérifier que chaque élément des 227 tableaux note_user_ids désigne un utilisateur existant avant de poser la FK.
- Les colonnes mesurées à 0 % qui traversent quand même : mandat.description, mandat.video_youtube, mandat.source_marketing, mandat.lead_apporteur, process.description, process.moins_par_rapport_mission, process.date_statut_applicant, process.date_statut_ko. La migration n'en apportera rien — décider colonne par colonne si on la crée pour l'usage à venir ou si on l'abandonne.
- public.equipe — DÉDUPLICATION : 766 lignes à replier sur ~427 personnes. 92 lignes sans e-mail, 42 sans nom, 29 sans prénom : la clé de rapprochement est faible, exactement celle qui a déjà fusionné des personnes distinctes dans le pivot. La migration PROPOSE, un humain CONFIRME, et la décision se conserve. Rien ne se pose avant ce tri.
- public.equipe / public.mandat_equipe — RÉCONCILIATION des 70 liens divergents sur 705 : 39 où equipe.mandat_id est nul alors que mandat_equipe porte le lien, 31 où equipe.mandat_id désigne un AUTRE mandat. Trancher lequel fait foi avant de figer core.mandat_contact_client, sinon la table naît fausse.
- public.equipe — 122 lignes sans mandat_id : leur entreprise_id n'est dérivable par aucun chemin (equipe n'a pas d'entreprise, le rattachement passe par mandat.entreprise_id). À rattacher à la main ou à laisser NULL en connaissance de cause.
- Identifiants Bubble perdus par la déduplication : les 339 equipe.id absorbés doivent être conservés (core.mandat_contact_client.bubble_id en récupère la plupart, mais pas ceux des 122 lignes sans mandat). Sans cette table de correspondance, mandat.manager_id (77 valeurs), mandat.recruteur_id (46 valeurs) et nps_tracking.bubble_contact_id (118 valeurs) ne se résolvent plus.
- public.nps_tracking — 16 lignes / 13 valeurs de bubble_contact_id pointant une equipe inexistante. Isoler, pas jeter.
- public.nps_tracking — 15 lignes dont bubble_mandat_id ne désigne ni un mandat ni un mandatclose. Contrôle de non-perte de la scission : 34 + 69 + 15 = 118.
- public.nps_tracking — repondu_le vide à 100 % sur 118 lignes alors que le statut 'responded' existe. Déterminer si des réponses ont été perdues avant de brancher le dashboard NPS.
- public.tag — 89 tags sur 110 rattachés ni à une entreprise ni à un mandat. Trier avant de poser le CHECK de rattachement (à poser NOT VALID en attendant).
- public.tag — recouvrement entreprise_id / mandat_id non mesuré (5 et 16 valeurs) : vérifier qu'aucun tag ne porte les deux avant de valider num_nonnulls(...) <= 1.
- public.entreprise.product_type — 5 valeurs orphelines sur 16 lignes (« Hybride Hardware Software » 9, « Hybride On Premise-SaaS » 2, « Media » 2, « On-Premise » 2, « Jeux-vidéos » 1). Les mapper dans ref.correspondance avec origine='hors_referentiel' : une valeur non mappée ARRÊTE la reprise, elle ne devient jamais NULL en silence.
- public.entreprise_remote.remote — 5 valeurs distinctes pour 4 dans ref_remote : 1 orpheline à mapper (« Télétravail » pèse 398 lignes tous consommateurs confondus).
- public.entreprise.statut / statut_contrat / formule / agence / recommandation / niveau_anglais / garantie / paiement — SELECT DISTINCT programmatique sur chaque colonne CONSOMMATRICE, octet pour octet, sans normalisation Unicode (les libellés portent des emoji composés et des apostrophes typographiques). Semer ref.correspondance avec les chaînes exactes AVANT de convertir.
- public.entreprise — 9 lignes sans nom (841/850). Les nommer ou les marquer, sinon la liste entreprises affiche des lignes vides.
- public.entreprise — doublons connus du chantier en cours (109 fiches actives déjà traitées, 303 dormantes restantes, 3 fusions en attente). Backfiller domaine_normalise et hs_company_id AVANT tout index unique, et poser fusionnee_vers_id sur les fiches purgées.
- Colonnes vides à 100 % à trancher avant d'écrire le DDL : entreprise.type_entreprise, entreprise.apport_affaires_pct, produit.description, tag.description. Aucune donnée à perdre — porter ou abandonner est une décision, pas une évidence.
- Colonnes vides abandonnées sans discussion : entreprise.slug, equipe.slug, produit.slug, tag.slug (les 21 slug du miroir sont tous vides, artefact Bubble confirmé par la mesure).
- public.entreprise_mandat (1 ligne), public.entreprise_note (991 lignes, sous-ensemble strict de note.entreprise_id qui en porte 2 082), public.entreprise_tag (5 lignes, sous-ensemble strict de tag.entreprise_id) : tables mortes, à ne pas migrer. Vérifier la nullité de leur apport propre une dernière fois avant suppression.
- ~63 comptes sans rattachement ET sans rôle interne. Mesuré : 104 comptes rattachés ni à un candidat ni à une entreprise (4 605 − 4 158 candidat_id − 344 entreprise_id ≈ 103), alors que 41 seulement portent un rôle interne. Ces ~63 lignes ne deviennent ni collaborateur, ni fiche talent, ni contact client : c'est exactement le genre de ligne sur laquelle la contrainte « un compte sans accès est impossible » échoue. À trier nominativement avant migration.
- Les 3 utilisateurs portant deux rôles (4 601 lignes de user_role pour 4 598 utilisateurs distincts, max 2). Il faut savoir lesquels : si le doublon est Candidat + Entreprise, ce sont deux contextes et deux lignes d'app.acces, tout va bien ; si c'est Admin + Recruiter Core Team, c'est un seul accès interne et il faut choisir un role_interne, ce qui écrase une information. Non mesuré aujourd'hui.
- Les 2 auteurs orphelins de note.user_id, sur 21 lignes (mesuré par cardinalites.json). À traiter avant toute contrainte sur l'auteur d'une note.
- L'e-mail des 41 collaborateurs internes : il n'existe NULLE PART dans le miroir (aucune des 18 colonnes de public.user n'est une adresse). Sans ces 41 adresses, ni l'annuaire interne, ni le provisioning, ni le rapprochement avec auth.users ne fonctionnent. C'est une saisie manuelle, pas une reprise.
- Les 5 apporteurs d'affaires sans candidat_id (5 sur 20). Si l'arbitrage retient la version stricte de la Décision 5 — l'apporteur ne recopie plus l'identité —, ces 5 personnes doivent d'abord exister au pivot, sinon leurs lignes deviennent anonymes tout en portant des conditions de commission.
- Le rapprochement compte client ↔ contact client, à reconstruire par l'e-mail : equipe.email existe, public.user n'a aucune adresse. Clé faible. Rappel de la Décision 5 : les 131 correspondances par nom ne doivent PAS être établies automatiquement — c'est la clé faible qui a déjà fusionné des personnes distinctes dans le pivot. La migration propose, un humain confirme, et la décision se conserve.
- Les 8 lignes de user_partner, à confirmer avant reprise : elles couvrent exactement une fois chacun des 8 univers pour 2 utilisateurs seulement, et Design, Data et Finance ne sont utilisés par aucune donnée métier. Cela ressemble à un paramétrage de démonstration plus qu'à un rattachement réel.
- Vérifier l'orphelinage des colonnes created_by du miroir (21 occurrences, dont business_maker.created_by rempli à 100 %). cardinalites.json ne les a PAS mesurées : aucune des FK cree_par_collaborateur_id ne peut être posée sans ce comptage.
- ref.metier — 16 intitulés orphelins, 52 occurrences, présents dans les données et absents du référentiel : Engineering Director 12, Program Manager 7, Platform Owner 5, Lead ML 5, Web Analytics Manager 5, Business Process Owner 4, Founding Engineer 4, Senior DevOps 2, puis 8 valeurs à 1 occurrence. Les charger en origine='decouvert_en_donnees' AVANT de poser la FK, sinon 52 lignes consommatrices sont rejetées.
- ref.expertise — 2 orphelines sur experience_expertise : « UX/UI » 29 occurrences, « Integrations » 20. À charger avant la FK.
- ref.tag_job — « Job exclu », 18 mandats, n'a JAMAIS existé dans l'option set (preuve : la lettre J est absente des 74 caractères explosés). À charger en origine='hors_referentiel', pas à rejeter.
- type_produit_entreprise (enum) — 5 valeurs hors référentiel, 16 lignes : « Hybride Hardware Software » 9, « Hybride On Premise-SaaS » 2, « Media » 2, « On-Premise » 2, « Jeux-videos » 1. À intégrer à l'enum avant la reprise, sinon 16 saisies tombent.
- rythme_remote (enum) — 526 lignes portent un vocabulaire ANTÉRIEUR : Télétravail 398, Indifférent 77, Présentiel 51. Les 3 codes obsolètes doivent exister dans l'enum (actif=false) avant la reprise. C'est le plus gros volume du lot ; les mapper vers la grille actuelle serait inventer une donnée.
- type_contrat (enum) — « Entrepreneur », 38 occurrences (20 candidat_contrat, 17 job_reve_contrat, 1 mandat.contrat). Le code entrepreneur doit exister avant la reprise, en attente d'arbitrage.
- niveau_anglais (enum) — « Bon niveau global mais pas au quotidien », 59 occurrences sur candidat.niveau_anglais. Un code provisoire doit exister avant la reprise ; ne pas fusionner sans décision, ce sont 59 déclarations de candidats.
- process.etape — 30 lignes NULL à la source sur 7 243 (7 213 non nulles). Elles RESTENT NULL : c'est pour cela que core.candidature.etape_id est nullable. Le contrôle de reprise doit valoir exactement 7 213 lignes mappées, pas 7 243.
- process.etape — arbitrer le quasi-doublon avant de figer les 14 codes : « KO » seul (46 lignes) coexiste avec ko_pachamama (4 302), ko_client (1 471) et ko_candidat (468). Est-ce une 4e nuance ou 46 saisies non qualifiées ? Et « Push Candidature » (2 lignes) est le seul libellé SANS emoji du référentiel : intrus ou étape légitime jamais utilisée ?
- ref_metier — le COMMENT du schéma annonce 273 entrées pour 238 uniques : le dédoublonnage a déjà eu lieu, mais le vérifier sur l'instantané figé avant de poser UNIQUE(code), car deux libellés distincts peuvent produire le même slug.
- ref_contributor_type — 4 entrées annoncées, 2 mesurées, et un trou dans sort_order (1 puis 3) : 2 doublons ont déjà été supprimés. Vérifier avant de figer l'enum.
- Les 13 URLs d'assets sur le CDN Bubble (98119bfbf8cfc027dc70db6c69918bd3.cdn.bubble.io) : 5 dans config.branding, 5 dans ref.univers, 3 dans ref.libelle (icone_url de visibilite_mandat), plus config.asset et les 5 de ref.maturite_produit. Elles meurent avec l'abonnement. À rapatrier dans le stockage cible AVANT la coupure.
- ref.maturite_produit — les niveaux A à E n'ont AUCUN libellé nulle part. Leur sens n'existe que dans 5 images Bubble et dans la tête de l'équipe. À documenter avant la coupure, sinon l'information est définitivement perdue.
- ref.etape_process et ref.tag_job — 8 attributs à ré-extraire de Bubble avant la coupure : les 2 couleurs kanban, libelle_public, is_active, is_public, les 2 drapeaux de visibilité kanban, et icone_url sur les 16 tags. Le kanban client tourne AUJOURD'HUI sur ces valeurs. Ne PAS les inventer.
- ref.type_tache — task_anchor vide sur 12/12 alors que relative_time est renseigné. Sans l'ancre, la règle « J+15 après quoi » est incomplète et la planification automatique des tâches n'est pas réimplémentable. À ré-extraire ou à re-décider.
- user.langue et user.user_lang portent exactement la même information sur 2 052 lignes, 100 % fr_fr. Une seule colonne survit — choisir laquelle avant la reprise.
- mandat.status_sort_order : ordre de statut dénormalisé sur chaque ligne de mandat. À supprimer dans le cible, il se lit par jointure sur ref.libelle.
- Le miroir DÉRIVE : mes chiffres de fin de journée du 26/08 dépassent ceux du matin (process.etape 7 213 contre 7 206, « KO by client » 1 471 contre 1 470, mandat.visibilite public 35 contre 34). Tout contrôle de non-perte doit se faire sur un INSTANTANÉ FIGÉ, jamais sur deux lectures à deux heures d'écart.
- Semer ref.correspondance PAR SELECT DISTINCT PROGRAMMATIQUE, jamais par recopie manuelle, et sans aucune normalisation Unicode. Les emoji composés (4 points de code), les doubles espaces (1 672 lignes de mindset) et les apostrophes typographiques U+2019 ne survivent pas à une retranscription. Une valeur non mappée ARRÊTE la reprise.

# Points remontés par la rédaction du détail

- BLOQUANT — min/max des salaires souhaités. Côté Bubble le couple est « Salaire minimum » / « Salaire souhaité », côté pivot c'est salaire_min / salaire_souhaite, côté miroir job_reve.salaire (61,1 %) / job_reve.salaire_maximum (51,4 %). La correspondance mappe salaire→min et salaire_maximum→max sans preuve. Tant que ce n'est pas mesuré, la contrainte CHECK (min <= max) N'EST PAS posée et les noms peuvent être inversés.
- BLOQUANT — candidat vs candidat_expanded : 7 champs sont dupliqués et l'expanded est SYSTÉMATIQUEMENT plus rempli (statut 94,4 % vs 47,6 %, mindset 77,2 % vs 32,4 %, contrat 49,7 % vs 11,4 %, stage 25,8 % vs 7,7 %, agent 27,8 % vs 8,6 %, emoji 10,2 % vs 3,8 %, portfolio 10,5 % vs 0 %). Je propose : l'expanded gagne, le candidat comble les trous (COALESCE expanded, candidat). L'ADR laisse la question ouverte (« lequel est vivant ? »), donc ce n'est pas moi qui la tranche.
- Le pivot ne porte pas anonymise_le ni actif. L'ADR pose que « l'effacement se fait au pivot, la projection suit » — c'est impossible tel quel : la projection n'a aucune colonne pour porter l'état d'effacement. Il faut ajouter anonymise_le (ou efface_le) à pivot.talent, sinon un talent anonymisé restera lisible dans core.talent.
- La remontée fiche→pivot est LOSSY sur quatre axes : pivot.qualification.product, .profil, .background sont des text scalaires alors que l'app porte 11 350 / 5 223 / 5 218 lignes multivaluées, et pivot.attentes.nogo est un text unique alors que job_reve_secteur_nogo porte 1 803 lignes. Passer ces quatre colonnes du pivot en text[] ou les remonter est un préalable au connecteur.
- pivot.attentes ne porte AUCUNE colonne de provenance (mesure ADR : 0). Les colonnes _origine du bloc attentes de la fiche ne peuvent donc pas faire l'aller-retour : la préséance sur le salaire souhaité, la disponibilité et le no-go — là où la parole du candidat compte le plus — n'est pas implémentable en l'état.
- Le genre est volontairement absent du pivot (COMMENT de pivot.qualification : « minimisation RGPD »). Je le mets donc sur la fiche uniquement, avec ses 5 566 valeurs. À confirmer : l'application doit-elle continuer à le porter, et pour quel usage ?
- La correspondance liste 67 attributs pour core.talent mais la ligne public.job_actuel.entreprise_id pointe vers core.talent.employeur_actuel_entreprise_id, absente de cette liste : l'entité en compte 68. La colonne est portée ici (poste_actuel_entreprise_id, 6 valeurs) conformément au renversement d'abandon acté en Partie C.
- Doublon dans la correspondance : l'attribut n° 63 « contrat_actuel » (A_CREER) fait double emploi avec l'attribut n° 18 « poste_actuel_contrat » (candidat.contrat_actuel + candidat_expanded.contrat). Je n'en garde qu'un.
- Cible du référent : la correspondance écrit core.utilisateur, la Décision 4 de l'ADR remplace cette table par core.collaborateur (~41 personnes). J'ai pointé agent_referent_id vers core.collaborateur — à confirmer avec le domaine « comptes et personnes ».
- core.talent_mandat (candidat_mandat, 2 603 couples) n'est PAS traité ici : l'ADR Partie D signale que candidat_mandat et process répondent tous deux à « ce talent est-il sur ce mandat ? » sans que personne n'ait défini ce qui les sépare (4 492 couples dans process seulement, 7 dans candidat_mandat seulement). Clarification métier attendue, domaine mandat/candidature.
- Choix assumé à valider : dans la PROJECTION les valeurs multiples sont des text[] (contrats, remotes, expertises, secteurs, emails, téléphones), pas des tables de liaison. Motif : la projection est en lecture seule, une FK n'y protège rien, et une ligne plate sur 31 000 personnes est ce que la recherche du poste recruteur demande. Les tables de liaison normalisées existent, elles sont sur la FICHE. Le prix est qu'aucune contrainte de base ne garantit que les codes du tableau existent au référentiel : la vue core.v_projection_code_inconnu le rend visible.
- Mécanisme de la lecture seule sur core.talent : REVOKE INSERT/UPDATE/DELETE au rôle applicatif + trigger de garde réservant l'écriture au rôle du connecteur. Alternative écartée : table étrangère vers pivot (coût de lecture, et la recherche ne tiendrait pas).
- pachamama_like (503), pachamama_personnalite (742), note_interne (135), candidat_expanded.perso (2 152), note_1 (459), note_2 (843) partent vers core.note en notes typées, par décision de la correspondance. La fiche perd donc l'appréciation qualitative en colonne : à confirmer côté produit, c'est du travail de recruteur.
- seniorite reste en text : le pivot le porte (pivot.qualification.seniorite) mais AUCUN référentiel ne le contraint dans le miroir. À convertir en enum quand le vocabulaire sera arrêté.
- grande_ecole reste en text (520 valeurs) : la correspondance dit « type_corrige » sans dire vers quoi. Inspecter le contenu avant de le typer booléen.
- score_completude : colonne stockée (recalculée par l'application) plutôt que colonne générée, parce que la règle de complétude vit dans app.regle_completude et changera sans migration.
- Le nombre de fiches : l'ADR dit tantôt 7 023, tantôt 7 028, la commande dit 7 032. La mesure de remplissage.json fait foi — public.candidat porte 7 028 lignes, donc 7 028 fiches.
- fiche_talent_id ou talent_id — j'ajoute fiche_talent_id sur core.candidature, core.placement et core.vivier_mandat parce que la source (process.candidat_id, mandatclose.candidat_id, candidat_mandat.candidat_id) désigne un public.candidat, qui migre 1 pour 1 vers core.fiche_talent. talent_id devient une colonne DÉRIVÉE via pivot.talent_source. Si le domaine talent tranche autrement, ces trois entités changent de clé étrangère. À confirmer avec le domaine fiche talent avant d'écrire le SQL.
- mandat.date_demarrage_mission est du texte, renseigné sur 80 lignes seulement. Je le retype en date, mais les valeurs non analysables (« ASAP », « courant septembre ») n'ont alors aucune destination. Mesurer les 80 valeurs : si plus de quelques-unes résistent, il faut une seconde colonne date_demarrage_libelle.
- Unités des montants du placement : salaire_final est en K€ (harmonisation du 01/07), mais commission, commission_nette et apport_affaires_k n'ont pas été vérifiés. Le suffixe _k de la source suggère des K€ pour l'apport d'affaires. Une erreur d'unité ici fausse tout le reporting financier — à mesurer avant de figer les commentaires d'unité et les noms.
- ref.motif_ko n'existe pas et doit être créé : c'est la donnée la plus manquante du domaine (6 287 KO sur 7 243 candidatures, aucun motif nulle part). Je propose que la catégorie (client / candidat / pachamama) soit un ATTRIBUT du référentiel et non une colonne de la candidature, contrairement à correspondance.json qui prévoyait motif_ko_categorie et motif_ko_code côte à côte. Le référentiel appartient au domaine des référentiels.
- La définition métier de core.vivier_mandat est attendue. 2 603 couples, dont 2 596 sont déjà des candidatures : la table dit-elle « pressenti pour ce mandat, pas encore approché » (un vivier au sens propre), ou est-ce un vestige d'un ancien mécanisme de shortlist ? Tant que la réponse manque, je ne pose aucune contrainte croisée avec la candidature et je n'ose pas la supprimer à cause des 7 couples qu'elle est seule à porter.
- app.mandat_publication référence core.mandat par une vraie clé étrangère, contrairement au « text non contraint » de correspondance.json. Mon raisonnement : l'interdit de la Décision 1 vise public, réécrit par la synchro et exposé à truncate_data_tables(), pas core que l'application possède. À valider explicitement, parce que c'est un écart avec un texte déjà écrit.
- ON DELETE de app.mandat_publication : je pose RESTRICT (dépublier avant de supprimer) parce que la ligne porte de la saisie manuelle — libellé public, salaire affiché — qu'un CASCADE détruirait. CASCADE serait plus commode à l'usage. Choix de produit.
- Le RGPD sur la candidature : compte_rendu, appreciation_like, appreciation_personnalite, points_forts, points_faibles et argumentaire_client contiennent des données personnelles et des appréciations. Je pose ON DELETE SET NULL vers la fiche pour ne pas détruire l'historique commercial et les commissions — ce qui implique que l'effacement doit ANONYMISER ces six champs par un acte distinct. À décider avec le périmètre d'effacement du journal.
- statut_paiement et l'entité de revenu : le placement porte 27 colonnes financières et la répartition 18 de plus. La question posée en Partie D — « mandatclose et mandate_closed_split, une entité de revenu autonome ? » — reste ouverte. Je garde les deux dans core en l'état ; si une facturation arrive, statut_paiement et le remboursement de garantie déménageront vers app.facture.
- must_have et nice_to_have en jsonb sur core.mandat : commode pour le brief, mais un critère dur qui sert à filtrer une short-list gagnerait à être une table de liaison vers un référentiel de critères (ref.critere existe déjà). Arbitrage de produit, il dépend de la finesse attendue du scoring.
- core.utilisateur ou core.collaborateur : correspondance.json cible core.utilisateur, la Décision 4 de l'ADR parle de core.collaborateur (~41 personnes). Neuf clés étrangères de mon domaine en dépendent (3 sur le mandat, 1 sur la candidature, 2 sur la répartition, 1 sur l'analyse, 1 sur le placement, 1 sur placement_utilisateur). À aligner avant d'écrire.
- candidature.entreprise_id et placement.entreprise_id sont des dénormalisations de mandat.entreprise_id. Je les conserve parce que 20 candidatures n'ont pas de mandat et garderaient sinon leur client. Mais elles peuvent diverger silencieusement : soit on assume et on ajoute une vue de contrôle, soit on les abandonne et on perd le client de ces 20 lignes.
- placement.date_closing en NOT NULL : posable (227/227) et il fait de « placement = deal closé » une règle de la base. Refuser le NOT NULL si l'application doit pouvoir préparer un placement avant signature.
- Unicité (talent_id, mandat_id) sur la candidature : la Partie D dit de ne pas la poser. Je ne la pose pas, mais je n'ai pas mesuré combien de couples sont réellement en double dans les 7 243 lignes. La mesure vaut d'être faite, elle dira si c'est un vrai cas métier (recandidature après un KO) ou du bruit.
- UNIQUE (mandat_id) WHERE est_contact_principal sur core.mandat_contact_client : un seul contact principal par mandat est probable mais non mesuré. Ne pas la poser sans compter.
- Le titre interne du mandat (mandat.titre) ne doit jamais être projeté vers un client. Tant que la production expose public, graphql_public, avant_garde_dev, avant_garde et pivot en plus de api, l'énumération des colonnes de la vue ne protège rien — le défaut d'exposition relevé en Partie D est un préalable à tout ce domaine, pas un détail d'infrastructure.
- MÉCANIQUE DES CODES DE RÉFÉRENTIEL — **MESURÉE le 27/08/2026, le blocage est dix fois plus petit qu'annoncé.** Le point était formulé comme un préalable à tout le modèle : « onze colonnes pointent ref.libelle, dont la clé est le COUPLE (domaine, code) ; une FK sur le seul code n'est pas exprimable ; le choix vaut pour tout le modèle, à trancher une fois. » Le comptage réel sépare deux familles qui n'ont pas le même problème. **84 attributs sont typés par l'un des 28 énumérés** (`ref.origine_valeur`, `ref.genre`, `ref.statut_relation`…) : ceux-là n'ont besoin d'AUCUNE clé étrangère, le type énuméré garantit déjà la validité, et `ref.libelle` n'est qu'une table de présentation jointe sur (domaine, code) pour l'affichage. La question ne les concerne pas. Restent **20 colonnes `text` suffixées `_code`** — motif_ko_code, type_produit_code, type_entreprise_code, statut_code, type_campagne_code… — et ce sont précisément celles dont le vocabulaire n'est pas stabilisé : motif_ko n'existe encore nulle part, type_produit_code porte 5 valeurs orphelines mesurées sur 16 lignes, type_entreprise_code est vide à 100 %. **Recommandation** : ne pas inventer de mécanisme de FK composite pour elles. Les laisser en `text`, adosser une vue de contrôle `core.v_code_inconnu` sur le modèle de celle qui existe déjà pour la projection, et promouvoir chaque colonne en type énuméré quand son vocabulaire est arrêté. Une FK dure posée maintenant rejetterait de la donnée réelle dès la reprise. Ce n'est donc plus un préalable à l'écriture du SQL : c'est un choix par colonne, étalé dans le temps.
- BUBBLE_ID NON INJECTIF SUR core.contact_client. 766 lignes equipe se replient sur ~427 contacts : la colonne de provenance ne peut porter qu'un identifiant sur deux. Proposition retenue ici : bubble_id = l'identifiant de la ligne canonique, les autres logés sur mandat_contact_client.bubble_id, la correspondance complète conservée dans app.fusion_doublon. Les 122 lignes equipe sans mandat n'ont toujours nulle part où loger le leur. À valider, ou à remplacer par une table de trace de reprise dédiée.
- role_portail SUR LA PERSONNE OU SUR L'ACCÈS ? correspondance.json place role_portail (admin_client / contributeur_lecture) sur contact_client. La Décision 4 dit l'inverse : « les droits sont accrochés à l'accès, pas à la personne », sans quoi une candidate devenue cliente verrait les notes écrites sur elle. Je l'ai RETIRÉE de core.contact_client au profit de app.acces. À confirmer.
- invite_le / accepte_le / invite_par SUR LA PERSONNE OU DANS app.invitation ? Même raisonnement : app.invitation existe déjà au modèle (7 attributs) et l'invitation est un objet de cycle de vie applicatif, pas un attribut de la personne. Je les ai RETIRÉES de core.contact_client. À confirmer.
- score_completude : colonne ou vue ? correspondance.json en fait un attribut de core.entreprise ; l'analyse fonctionnelle dit « calculable à partir des colonnes existantes, à matérialiser en vue, pas en colonne ». Je l'ai RETIRÉE de la table et renvoyée à une vue api. À confirmer.
- ref_statut_candidat EST PARTAGÉ ENTRE DEUX SÉMANTIQUES. entreprise.statut lit Lead 743 / Client 78 / Qualifié 5 / Non qualifié 4 / Nouveau 1 ; candidat.statut lit Lead 2 161 / Qualifié 833 / Non qualifié 334 / Nouveau 16 / Client 3. Un seul domaine de ref.libelle pour les deux, ou deux domaines distincts ? Les fondre rend impossible de retirer « Client » du sélecteur candidat.
- AU PLUS UN CONTACT PRINCIPAL PAR MANDAT ? Non mesuré. contact_principal est rempli à 100 % en booléen sur 766 lignes ; rien ne dit qu'un mandat n'en porte pas deux. La contrainte UNIQUE (mandat_id) WHERE est_contact_principal est prête mais pas posée.
- LES ~70 PARTICIPATIONS VENUES DU SEUL mandat_equipe naissent avec est_contact_principal = false et type_equipe_code = NULL : mandat_equipe est une jonction nue, sans attribut ni horodatage. C'est une perte assumée sur 10 % des lignes. Accepter, ou dériver la valeur depuis une autre participation de la même personne ?
- nps_type EST-IL L'ARBITRE FIABLE DU POLYMORPHISME ? Le CHECK du miroir donne 'close' | 'termine', ce qui devrait s'aligner sur les 69 placements et les 34 mandats mesurés par résolution d'identifiant. Croiser les deux voies avant de scinder, et décider laquelle gagne en cas de désaccord.
- core.produit N'A AUCUN NOM dans le miroir — un produit n'y est identifié que par txt_explicatif (83,5 %) et une description vide à 100 %. J'ai ajouté `nom` en le signalant. Ajouter, dériver, ou renoncer et afficher le texte tronqué ?
- L'INTERLOCUTEUR AU NIVEAU DE L'ENTREPRISE. La Décision 6 dit qu'il « devient exprimable », mais rien ne le porte une fois contact_principal descendu sur la participation. J'ai ajouté est_referent_entreprise sur core.contact_client (booléen + index unique partiel) plutôt qu'un entreprise.contact_referent_id, qui créerait un cycle de clés étrangères. Il naît à false partout : aucune donnée source. À valider, et à décider s'il faut l'amorcer depuis le contact principal le plus fréquent de l'entreprise.
- entreprise.created_at / updated_at SONT DES DATES DE SYNCHRO (ADR Partie A : « created_at du miroir est une date de synchronisation »). Les reprendre telles quelles dans cree_le / maj_le donne une chronologie fausse mais plausible ; les remettre à la date de reprise donne 850 fiches créées le même jour. Même question sur produit, equipe et tag.
- entreprise_remote REPLIÉ EN COLONNE SCALAIRE. Le repli est justifié par la mesure (max 1 valeur par entreprise, 58 sur 850), mais ref_remote est MULTIVALUÉ partout ailleurs — job_reve_remote 4 469 lignes, candidat_remote 1 999, mandat_remote 430. Si le métier veut demain deux modes de télétravail pour une entreprise, il faut une table de liaison. Assumer le scalaire, ou aligner sur les trois autres consommateurs ?
- talent_id NON UNIQUE SUR core.contact_client. Une personne contact chez deux entreprises produit deux lignes portant le même talent_id (2 cas mesurés), et 374 talents du pivot sont nés de fusions. Confirmer que l'unicité n'est jamais posée, y compris dans les vues api.
- core.entreprise n'a PAS de lien vers core.talent pour l'employeur : job_actuel.entreprise_id ne porte que 6 valeurs sur 7 029, experience.entreprise_id est vide sur 7 049 lignes, et 69 % des employeur_nom contiennent un identifiant Bubble au lieu d'un nom. L'employeur d'un talent reste du texte libre — conséquence à acter explicitement, elle bloque tout reporting « nos talents chez nos clients ».
- ~~BLOQUANT~~ **LEVÉ le 27/08/2026, voir `core.note`** — l'auteur des notes ne peut pas pointer un collaborateur. Mesuré : note.user_id porte 2 103 valeurs distinctes et note_archivee.user_id 1 958, alors que core.collaborateur n'aura que 41 lignes. Amputer public.user de ses candidats et de ses contacts orpheline plus de 2 000 auteurs sur 25 663 notes. Trois issues : (a) l'auteur devient un app.acces (une note est écrite depuis un contexte), ce qui est cohérent avec « les droits sont sur l'accès » mais suppose un compte, qui manque pour la quasi-totalité de ces auteurs ; (b) core.note garde une colonne auteur_bubble_id text non contrainte plus une FK facultative vers collaborateur ; (c) core.collaborateur reprend les 4 597 lignes, ce qui annule la Décision 4. Aucune n'est gratuite, et le choix ne m'appartient pas — mais aucune contrainte d'auteur ne peut être posée avant lui.
- La langue des 2 052 utilisateurs qui ne sont pas internes n'a plus de domicile. public.user.langue est rempli à 44,6 % sur 4 605 lignes, essentiellement des candidats et des contacts. En restreignant collaborateur aux 41 internes, on ne migre que 41 valeurs au maximum ; les autres se perdent, sauf à router la préférence de langue vers core.fiche_talent et core.contact_client — deux domaines qui ne sont pas le mien. Perte silencieuse si personne ne tranche.
- public.user.email_confirmed (100 % rempli) : je propose de l'ABANDONNER, alors que correspondance.json la route vers core.utilisateur.email_confirme. Motif : c'est un état d'authentification Bubble, et auth.users.email_confirmed_at le porte désormais. Abandon à valider, ce n'est pas une décision déjà prise.
- public.user.entreprise_id (344 valeurs) : je propose de l'ABANDONNER sur core.collaborateur, contrairement à correspondance.json. Motif : pour les 41 internes elle est vide de sens, et le rattachement à une entreprise passe désormais par app.acces → core.contact_client → core.entreprise. Ces 344 valeurs restent NÉCESSAIRES à la migration, mais comme source du rapprochement des accès entreprise, pas comme colonne cible.
- app.compte.auth_id nullable : je le propose contre correspondance.json, qui en fait la clé primaire. Deux mesures l'imposent — public.user.auth_id est vide sur 4 605 lignes, et seuls 7 comptes d'authentification existent. Sans cette nullabilité, aucun des 41 accès internes n'est migrable et il faut créer 41 comptes Supabase à la main avant la reprise. Conséquence à assumer : un compte peut exister sans identité d'authentification, état qu'il faut savoir lire (pré-provisionné) et purger s'il n'est jamais activé.
- superadmin. Le cadrage demande explicitement un niveau au-dessus d'admin (« Le niveau superadmin (nouveau) se distingue d'admin ici »), correspondance.json le prévoit en colonne sur core.utilisateur. Le parti n'énumère que trois pouvoirs internes : admin, recruteur, support. Soit une quatrième valeur d'enum, soit un booléen sur l'accès interne — mais pas une colonne sur la personne, ce qui remettrait un droit sur la personne.
- Le grain du journal. Le parti impose une ligne par CHAMP (entite, entite_id, champ, valeur_avant, valeur_apres) ; l'observabilité du dual-write, qui est un must du jalon 6, raisonne par REQUÊTE (cible_ats, statut_http, etat). Ce ne sont pas les mêmes objets. J'ai proposé un lot_id pour tenir les deux dans une table, mais si le volume du dual-write le justifie, la séparation en deux tables est plus honnête. À mesurer sur le volume réel avant d'ouvrir les écritures.
- L'historique est-il montré au candidat ? Question de produit, ouverte dans l'ADR et non tranchée. Elle doit l'être AVANT que la vue api de l'historique de fiche existe, pas après.
- core.apporteur_affaires : version stricte (aucune identité, CHECK talent_id IS NOT NULL, et les 5 non-candidats créés au pivot d'abord) ou version tolérante (nom_affichage + email_contact renseignés seulement quand talent_id est nul) ? La version stricte respecte la Décision 5 à la lettre et fait payer une action de migration ; la version tolérante réintroduit deux colonnes que la décision voulait supprimer. Je recommande la stricte, mais elle a un préalable qui n'est pas dans le plan.
- Le sens du lien apporteur ↔ talent. Deux colonnes du miroir décrivent la même relation : business_maker.candidat_id (15 valeurs sur 20) et candidat.business_maker_id (14 valeurs sur 7 028, soit 0,2 %). cardinalites.json tranche « un seul sens conservé » sans dire lequel, et mesure « max 2 apporteurs pour 1 talent ». J'ai retenu apporteur.talent_id ; il reste à décider ce que devient core.talent.apporteur_affaires_id, et si les deux jeux de valeurs concordent.
- RAPPEL, et il conditionne tout le domaine : tant que la production expose public, graphql_public, avant_garde_dev, avant_garde et pivot, la sécurité construite ici ne tient pas. Une vue api en security_invoker s'exécute avec les droits de l'appelant, qui doit donc avoir le droit sur la table de base — si cette table est elle aussi joignable par l'API, l'énumération des colonnes ne protège plus rien. app.acces, ses CHECK et ses policies n'ont de valeur que si api redevient la seule surface exposée.
- SECRETS — signalement, sans proposition de solution. public.ref_slack_channel expose 4 webhooks Slack EN CLAIR dans le schéma public (webhook et webhook_test, 2/2 renseignés sur 2 lignes) : toute lecture de la table permet de poster dans le Slack de l'entreprise. Ils ne doivent PAS vivre dans une table de données, et je ne les porte donc nulle part dans le modèle. Idem pour la clé d'API SendGrid, qui n'est pas dans le miroir et ne doit pas y entrer. À traiter en priorité et INDÉPENDAMMENT du chantier de modélisation. Nuance à garder : ref_sendgrid_template.id_sendgrid n'est PAS un secret, c'est un identifiant de gabarit, il reste en base.
- DONNÉE PERSONNELLE EN CONFIGURATION — l'unique ligne de ref_email_config contient une adresse e-mail nominative. Elle entre dans le périmètre du droit à l'effacement et de l'anonymisation de la base de dev, au même titre que app.journal_ecriture signalé par l'ADR. Le drapeau config.parametre.sensible sert à la trouver, il ne la protège pas.
- ÉCART ASSUMÉ AVEC correspondance.json — 8 entités y portent une PK nommée metier_id / secteur_id / expertise_id / critere_id / etape_id / tag_job_id / univers_id / modele_id, ou une PK « code text ». Le parti 8 réserve le suffixe _id aux clés étrangères et le parti 2 impose id uuid default gen_random_uuid() partout. J'ai uniformisé en id uuid + code text UNIQUE. Si l'arbitrage préfère la PK naturelle sur les référentiels stables (statut_contrat, maturite_produit, type_tache, evenement_note), c'est défendable — mais alors il faut l'écrire comme une exception motivée, pas la laisser en incohérence.
- PK COMPOSITE SUR LES TABLES DE LIAISON — même sujet : ref.metier_univers, ref.expertise_univers et config.sendgrid_template_statut_mandat reçoivent un id uuid + UNIQUE sur le couple, au lieu de la PK composite proposée. L'intégrité est identique ; le surcoût est un index de plus par table sur 361, 49 et 9 lignes. À confirmer.
- ref.libelle N'EST PAS CONTRAIGNABLE PAR LA BASE — PostgreSQL ne sait pas poser de clé étrangère vers un TYPE. Rien n'empêche donc une ligne ref.libelle('statut_mandat','inexistant') ni un code d'enum sans libellé. C'est le prix de la réduction de 47 tables à 15, et il faut le payer explicitement : un test de non-régression comparant enum_range(null::<type>) aux codes de chaque domaine, exécuté en CI. Sans ce test, le mécanisme est déclaratif.
- ref.libelle.est_recruteur — un drapeau spécifique au domaine 'role_utilisateur' dans une table générique. Il n'existe que pour ne pas perdre l'intention de ref_role_category (100 % NULL). Or la Décision 4 de l'ADR remplace l'axe unique de rôle par DEUX axes (portail / pouvoir) dans app.acces : le regroupement « recruteur » y devient trivial et ce drapeau caduc. Le supprimer est probablement juste, mais c'est au domaine « comptes et accès » de trancher, pas au mien.
- ref_statut_candidat MÉLANGE DEUX AXES — un axe de qualification (Nouveau → Qualifié / Non qualifié) et un axe de cycle commercial (Lead → Client), sur DEUX entités différentes. Les non-sens sont mesurés : 4 entreprises « Non qualifié », 3 candidats « Client ». « Lead » domine les deux consommateurs (2 161 et 743) alors qu'il n'appartient pas à l'axe de qualification. Scinder en deux enums est probablement le bon modèle, mais 4 178 lignes en dépendent et la mesure ne le tranche pas : les deux consommateurs utilisent effectivement les 5 mêmes valeurs.
- COLLISIONS ENTRE RÉFÉRENTIELS, À TRANCHER AVANT DE FIGER LES ENUMS — (1) profil_talent (ic, manager) contre type_contributeur (ic, manager_c_level) : deux référentiels pour la même distinction, sur deux entités. (2) cible_produit (b2b/b2b2c/b2c) contre type_produit_xp (b2b/b2c/b2b2c/saas/marketplace/api) contre type_produit_entreprise (saas_b2b/marketplace_b2b2c/b2c) : trois référentiels pour un même axe, sur trois entités. (3) form_provenance contre source_marketing pour l'origine d'un lead, l'un à 59 usages, l'autre à 0. (4) « Entrepreneur » vit dans type_contrat (38 lignes orphelines) ET dans profil_talent (831 lignes) : même mot, deux sens — statut juridique contre posture professionnelle.
- 3 RÉFÉRENTIELS À ZÉRO USAGE — type_entreprise (0/850), source_marketing (0/534), type_apporteur (0/534). Je propose de les conserver en enums, à coût nul, plutôt que de les abandonner : le vocabulaire porte une intention de modèle. Mais si le cible ne prévoit pas de les remplir, l'abandon devient légitime — c'est un choix de périmètre produit, pas une décision technique.
- ref.univers — Design, Data et Finance ne sont utilisés PAR AUCUNE donnée métier (seulement par user_partner, qui contient exactement 1 ligne par univers). Les garder actifs à la saisie ou les fermer par est_ouvert=false ? La question touche l'ouverture commerciale des verticales, pas le modèle.
- statut_mandat — j'ajoute 'en_pause' sur la décision de séance consignée dans l'ADR (un mandat suspendu n'est pas clos). Il faut confirmer que c'est bien une 5e valeur d'enum et non un drapeau orthogonal au statut : un mandat « En cours » mis en pause puis repris doit-il perdre son statut d'origine ? Et « Reprise » n'entre PAS ici — c'est un lien mandat→mandat, à modéliser dans core.
- ref.etape_process — la commande demande libellé talent ET libellé client, deux registres publics. Le miroir n'en portait qu'UN (public_display), et il est détruit. L'un des deux est donc à créer de toutes pièces. À décider avant de réécrire le kanban client : un candidat et un client voient-ils réellement deux formulations différentes de la même étape, ou une seule ?
- ref.etape_process — la contrainte CHECK (NOT est_ko OR est_terminale) encode une règle métier (« un KO arrête toujours le process ») que je déduis, sans la mesurer. À confirmer : existe-t-il un KO dont le process reprend ?
- ANGLICISMES DANS LES NOMS DE TYPES — le parti 8 impose un nommage français. Restent : background_talent, mindset_talent, type_produit_xp, form_concurrence, form_provenance, et les codes de role_utilisateur (recruiter_core_team, recruiter_support_crew) et de visibilite_mandat (private, talent_only, public). J'ai francisé role_user → role_utilisateur et fonction_user → fonction_utilisateur, et je laisse le reste en l'état : renommer les CODES de rôle et de visibilité toucherait les policies RLS, et renommer les autres est cosmétique. À arbitrer d'un bloc plutôt qu'au cas par cas.
- config.modele_email.cree_le / maj_le — l'ADR pose que created_at du miroir est une date de SYNCHRONISATION, pas une date métier. La colonne source est DEFAULT now() NOT NULL, ce qui ne tranche pas. À vérifier dans la table de correspondance de la synchro (jamais par le nom de la colonne — la synchro renomme) : si c'est bien la date de synchro, cree_le devient A_CREER et les 4 valeurs du miroir sont jetées.
- config.modele_email — correspondance.json prévoit un attribut « envoyes_par_template (compteur) ». Je ne le porte PAS comme colonne : un compteur stocké sur une ligne de configuration se désynchronise et duplique une vérité qui vit dans le journal d'envoi. C'est une vue au-dessus du journal, pas un attribut. À confirmer.
- LES 45 COLONNES sort_order — l'ADR les classe artefact tout en notant qu'elles portent l'ordre des listes déroulantes. Ma position : elles sont CONSERVÉES en ref.libelle.ordre et ref.*.ordre partout, et abandonnées uniquement sur les 5 tables à une ou deux lignes. Deux cas où l'ordre n'est PAS cosmétique et doit être préservé activement : mindset_talent (intensité croissante d'intention de recherche) et niveau_anglais (échelle croissante). Arbitrage de produit à confirmer.
- PORTÉE DES on delete VERS LES RÉFÉRENTIELS — je pose systématiquement ON DELETE RESTRICT depuis core vers ref : supprimer une valeur de référentiel ne doit jamais supprimer des lignes métier. La conséquence est qu'une valeur devenue inutile ne se supprime pas, elle se désactive (actif=false). C'est le comportement voulu, mais il faut que l'éditeur de taxonomies le rende explicite, sinon un recruteur croira pouvoir « supprimer » et recevra une erreur de base.
- **LEVÉE DU BLOQUANT AUTEUR.** Les trois issues envisagées ci-dessus étaient toutes coûteuses, et aucune n'était nécessaire : il ne fallait pas choisir, il fallait mesurer qui écrit. Sur 50 452 notes portant un auteur, 67,8 % viennent des 41 internes et 31,4 % d'un candidat ; les contacts entreprise en écrivent 23. Deux clés étrangères nullables — collaborateur et fiche talent — résolvent **99,25 %** des auteurs, les 378 restants gardant leur identifiant Bubble en repli. Détail et contraintes sur `core.note`.
- **LES 13 HORODATAGES DES TABLES REPLIÉES SE PERDENT BIEN — je m'étais trompé en annonçant le contraire.** J'avais soutenu que les horodatages de `experience`, `job_actuel`, `job_reve` et `candidat_expanded` avaient une place naturelle puisque les satellites deviennent des tables distinctes. C'est faux : `core.fiche_talent_background` vient de `experience_background`, pas de `experience`. Les quatre tables citées se replient toutes dans `core.fiche_talent`, qui n'a qu'un seul `maj_le`. La perte est réelle : « quand la personne a-t-elle modifié son job rêvé pour la dernière fois » disparaît. Traitement retenu : `cree_le` = MIN des quatre `created_at`, `maj_le` = MAX des quatre `updated_at`, et l'historique par champ passe désormais par `app.journal_ecriture`, qui est fait pour ça. Le passé, lui, n'est pas reconstituable.
- `public.candidat.opento` — ABANDON sans réserve : 0 valeur en production.
- `public.candidat.prenom_lower` / `nom_lower` (6 983 et 6 978 valeurs) — ABANDON assumé : ce sont des colonnes dérivées de recherche, reconstruites à la migration par un index fonctionnel sur `lower(prenom)` ou par les index trigrammes déjà en place sur le pivot. Aucune information propre.
- `public.user.popup_pas_de_nouvelles` / `popup_trouve_bonheur` (4 606 / 4 606) — ABANDON : état d'affichage d'une interface qui disparaît. Le remplissage à 100 % traduit une valeur par défaut, pas un choix utilisateur.
- `public.business_maker.picture_url` — la Décision 5 retire l'identité de l'apporteur au profit du lien vers le talent, donc la photo aussi. Elle reste néanmoins la seule identité visuelle des **5 apporteurs qui ne sont pas des talents** ; si la version stricte de `core.apporteur_affaires` est retenue, ces 5 personnes doivent naître au pivot AVEC leur photo, sans quoi elle est perdue. À traiter dans la même action de migration.
- **DÉFAUT DU DOCUMENT — RÉPARÉ le 27/08/2026, et il était plus large qu'annoncé.** Le constat de départ était que 60 lignes de tableau étaient coupées par un « … » littéral, rendant la source illisible — c'est ce qui m'avait fait classer les quatre colonnes de salaire de `public.candidat` en « non reprises » alors que la fusion était annoncée sans sa règle. En remontant à la source de génération, le défaut s'est avéré bien plus étendu : le rendu markdown avait conservé la colonne d'origine mais **jeté la quasi-totalité de l'analyse qui l'accompagnait**. Restauré depuis le journal de génération : **56 cellules d'origine tronquées, 652 commentaires d'attribut (99 % manquaient), 182 définitions d'index (89 % manquaient), 16 relations et 3 contraintes.** Le document passe de 1 955 à 3 326 lignes. Les commentaires portent les taux de remplissage, les valeurs d'énumérés, les raisons de nullabilité et les avertissements de reprise — soit précisément ce sans quoi on ne peut pas écrire le SQL. Ils sont rangés sous un bloc repliable « Notes par attribut » après chaque entité, pour que les tableaux restent lisibles. Aucune troncature ne subsiste.

**Index**

- UNIQUE (code)
- INDEX (ordre) WHERE actif

<details>
<summary><b>Notes par attribut</b> (7)</summary>

- **`code`** — product, tech, design, data, finance, people_finance, marketing, sales.
- **`couleur_primaire`** — MESURE CORRIGÉE : referentiels.json affirme « attributs renseignés seulement sur Product et Tech » ; remplissage.json mesure 4/8 sur color, secondary_color et talent_card_url, et 3/8 sur les deux logos. Je retiens la mesure. Nullable dans tous les cas.
- **`logo_url`** — CDN Bubble, meurt à la coupure.
- **`logo_mini_url`** — CDN Bubble.
- **`talent_card_url`** — CDN Bubble.
- **`est_ouvert`** — Drapeau de LOGIQUE MÉTIER, pas de présentation : il décide qu'une verticale est commercialement ouverte. C'est lui qui justifie la table à lui seul. true sur Product et Tech.
- **`actif`** — AJOUTÉ, et distinct de est_ouvert : « retiré de la liste de saisie » n'est pas « pas encore commercialisé ».

</details>
- **`core.utilisateur` vs `core.collaborateur` — LA QUESTION N'EN ÉTAIT PAS UNE, tranchée le 27/08/2026.** Le détail la présentait comme un arbitrage ouvert dont neuf clés étrangères dépendaient. Vérification faite, la Décision 4 de l'ADR l'avait déjà tranchée et `correspondance.json` est simplement un artefact antérieur. La cible est `core.collaborateur`. Deux constats sont toutefois sortis de la vérification, et ceux-là sont réels.
- **LE COLLABORATEUR DOIT PORTER LES ANCIENS, PAS SEULEMENT LES ACTIFS.** Les rôles internes (Admin, Recruiter Core Team, Recruiter Support Crew) désignent **38 personnes distinctes** et non 41 — le compte de 41 était celui des LIGNES de `user_role`, certaines personnes en cumulant plusieurs. Or `candidat.agent_pachamama_id` et `candidat_expanded.agent_id` désignent **4 personnes qui n'ont plus aucun rôle interne** : Hakim Cren, Amélie Collinet, Rachel GAUTIER, Coralie Ebele — dont trois portent en plus un `candidat_id`, elles sont donc aussi des talents. Ce sont des anciens dont le rôle a été retiré mais qui restent référents sur des fiches historiques. `core.collaborateur` doit donc naître avec **38 actifs + les anciens encore référencés**, et un drapeau `actif`. Le restreindre aux personnes en poste orphelinerait 1 959 fiches côté `agent_id`. Corollaire : trois de ces quatre personnes illustrent la Décision 5 — elles sont collaboratrice ET talent, et le lien passe par `collaborateur.talent_id`.
- **`mandat.recruteur_id` NE DÉSIGNE PAS UN RECRUTEUR DE PACHAMAMA.** 46 valeurs, 36 distinctes, dont **zéro** ne se trouve dans `public.user` ni dans `business_maker`. Elles se résolvent toutes dans `public.equipe` : c'est le **contact côté client** qui recrute, l'interlocuteur du mandat, pas un collaborateur. Le nom de la colonne est trompeur et la cible allait être fausse. Elle doit pointer `core.contact_client`, et non `core.collaborateur`. À rebaptiser à la reprise — `contact_recruteur_id` — pour que l'erreur ne se rejoue pas.
