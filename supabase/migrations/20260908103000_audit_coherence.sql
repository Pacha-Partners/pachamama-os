-- =====================================================================
-- AUDIT DE COHÉRENCE — LES DEUX DÉFAUTS TROUVÉS, CORRIGÉS
--
-- Audit structurel du 08/09/2026 sur le modèle rejoué depuis une base
-- vierge. Sept contrôles : clés primaires, liens non contraints, tables
-- isolées, clés étrangères non indexées, énumérés morts, profondeur des
-- cascades, colonnes obligatoires.
--
-- CINQ CONTRÔLES PASSENT SANS RÉSERVE
--   · aucune table sans clé primaire
--   · aucun lien non contraint, hors les deux du journal, polymorphes
--     par construction et documentés comme tels
--   · les 7 tables isolées le sont délibérément : la configuration
--     autonome, et les deux tables référencées PAR VALEUR — ref.libelle
--     depuis les énumérés, ref.correspondance depuis rien, pour survivre
--     à ce qu'elle documente
--   · aucune chaîne de suppression en cascade de profondeur 3 ou plus :
--     supprimer une racine n'emporte jamais plus loin qu'on ne le croit
--   · les 25 colonnes obligatoires sans défaut sont toutes alimentables —
--     vérifié sur la production, zéro ligne vide sur chacune
--
-- DEUX DÉFAUTS RÉELS, corrigés ci-dessous.
-- =====================================================================

-- ---------------------------------------------------------------------
-- DÉFAUT 1 — 57 CLÉS ÉTRANGÈRES SANS INDEX SUR LA COLONNE PORTEUSE
--
-- PostgreSQL n'indexe PAS automatiquement le côté enfant d'une clé
-- étrangère. Sans index, chaque suppression ou mise à jour du parent
-- balaie la table enfant EN ENTIER pour appliquer ON DELETE. Effacer un
-- collaborateur — un départ, une purge RGPD — déclenchait un balayage
-- complet de core.note et de ses ~50 900 lignes, quinze fois de suite.
--
-- Les index sont posés sur la totalité. À ces volumes — 51 000 lignes au
-- maximum — le coût en écriture est négligeable devant le balayage qu'ils
-- évitent, et les jointures inverses (« tous les mandats de ce métier »,
-- « les notes de cet auteur ») sont de vraies requêtes de l'application.
-- ---------------------------------------------------------------------

create index if not exists "acces_cree_par_compte_id_fk_idx" on app.acces (cree_par_compte_id);
create index if not exists "mandat_publication_publie_par_compte_id_fk_idx" on app.mandat_publication (publie_par_compte_id);
create index if not exists "mandat_publication_retire_par_compte_id_fk_idx" on app.mandat_publication (retire_par_compte_id);
create index if not exists "transition_etape_auteur_compte_id_fk_idx" on app.transition_etape (auteur_compte_id);
create index if not exists "transition_etape_etape_avant_id_fk_idx" on app.transition_etape (etape_avant_id);
create index if not exists "modele_email_cree_par_compte_id_fk_idx" on config.modele_email (cree_par_compte_id);
create index if not exists "analyse_auteur_id_fk_idx" on core.analyse (auteur_id);
create index if not exists "apporteur_affaires_cree_par_collaborateur_id_fk_idx" on core.apporteur_affaires (cree_par_collaborateur_id);
create index if not exists "candidature_cree_par_id_fk_idx" on core.candidature (cree_par_id);
create index if not exists "candidature_entreprise_id_fk_idx" on core.candidature (entreprise_id);
create index if not exists "candidature_etape_id_fk_idx" on core.candidature (etape_id);
create index if not exists "candidature_talent_id_fk_idx" on core.candidature (talent_id);
create index if not exists "collaborateur_univers_cree_par_collaborateur_id_fk_idx" on core.collaborateur_univers (cree_par_collaborateur_id);
create index if not exists "contact_client_cree_par_id_fk_idx" on core.contact_client (cree_par_id);
create index if not exists "contact_client_metier_id_fk_idx" on core.contact_client (metier_id);
create index if not exists "contact_client_univers_id_fk_idx" on core.contact_client (univers_id);
create index if not exists "entreprise_cree_par_id_fk_idx" on core.entreprise (cree_par_id);
create index if not exists "entreprise_statut_contrat_id_fk_idx" on core.entreprise (statut_contrat_id);
create index if not exists "fiche_talent_apporteur_affaires_id_fk_idx" on core.fiche_talent (apporteur_affaires_id);
create index if not exists "fiche_talent_attentes_metier_id_fk_idx" on core.fiche_talent (attentes_metier_id);
create index if not exists "fiche_talent_attentes_univers_id_fk_idx" on core.fiche_talent (attentes_univers_id);
create index if not exists "fiche_talent_cree_par_compte_id_fk_idx" on core.fiche_talent (cree_par_compte_id);
create index if not exists "fiche_talent_fusionnee_vers_fiche_id_fk_idx" on core.fiche_talent (fusionnee_vers_fiche_id);
create index if not exists "fiche_talent_poste_actuel_entreprise_id_fk_idx" on core.fiche_talent (poste_actuel_entreprise_id);
create index if not exists "fiche_talent_poste_actuel_metier_id_fk_idx" on core.fiche_talent (poste_actuel_metier_id);
create index if not exists "fiche_talent_poste_actuel_univers_id_fk_idx" on core.fiche_talent (poste_actuel_univers_id);
create index if not exists "fiche_talent_univers_id_fk_idx" on core.fiche_talent (univers_id);
create index if not exists "fiche_talent_tag_pose_par_compte_id_fk_idx" on core.fiche_talent_tag (pose_par_compte_id);
create index if not exists "mandat_account_manager_id_fk_idx" on core.mandat (account_manager_id);
create index if not exists "mandat_agent_2_id_fk_idx" on core.mandat (agent_2_id);
create index if not exists "mandat_cloture_demandee_par_compte_id_fk_idx" on core.mandat (cloture_demandee_par_compte_id);
create index if not exists "mandat_contact_manager_id_fk_idx" on core.mandat (contact_manager_id);
create index if not exists "mandat_contact_recruteur_id_fk_idx" on core.mandat (contact_recruteur_id);
create index if not exists "mandat_cree_par_id_fk_idx" on core.mandat (cree_par_id);
create index if not exists "mandat_metier_id_fk_idx" on core.mandat (metier_id);
create index if not exists "mandat_secteur_nogo_secteur_id_fk_idx" on core.mandat_secteur_nogo (secteur_id);
create index if not exists "note_auteur_fiche_talent_id_fk_idx" on core.note (auteur_fiche_talent_id);
create index if not exists "placement_apporteur_cooptation_id_fk_idx" on core.placement (apporteur_cooptation_id);
create index if not exists "placement_apporteur_deal_id_fk_idx" on core.placement (apporteur_deal_id);
create index if not exists "placement_candidature_id_fk_idx" on core.placement (candidature_id);
create index if not exists "placement_cree_par_id_fk_idx" on core.placement (cree_par_id);
create index if not exists "placement_statut_contrat_entreprise_id_fk_idx" on core.placement (statut_contrat_entreprise_id);
create index if not exists "placement_statut_contrat_freelance_id_fk_idx" on core.placement (statut_contrat_freelance_id);
create index if not exists "placement_talent_id_fk_idx" on core.placement (talent_id);
create index if not exists "placement_univers_id_fk_idx" on core.placement (univers_id);
create index if not exists "produit_cree_par_id_fk_idx" on core.produit (cree_par_id);
create index if not exists "repartition_commission_cree_par_id_fk_idx" on core.repartition_commission (cree_par_id);
create index if not exists "tache_candidature_id_fk_idx" on core.tache (candidature_id);
create index if not exists "tache_creee_par_collaborateur_id_fk_idx" on core.tache (creee_par_collaborateur_id);
create index if not exists "tache_entreprise_id_fk_idx" on core.tache (entreprise_id);
create index if not exists "tache_fiche_talent_id_fk_idx" on core.tache (fiche_talent_id);
create index if not exists "tache_maj_par_collaborateur_id_fk_idx" on core.tache (maj_par_collaborateur_id);
create index if not exists "tache_mandat_id_fk_idx" on core.tache (mandat_id);
create index if not exists "tache_notif_destinataire_compte_id_fk_idx" on core.tache (notif_destinataire_compte_id);
create index if not exists "tag_cree_par_id_fk_idx" on core.tag (cree_par_id);
create index if not exists "expertise_fusionne_vers_id_fk_idx" on ref.expertise (fusionne_vers_id);
create index if not exists "metier_fusionne_vers_id_fk_idx" on ref.metier (fusionne_vers_id);

-- ---------------------------------------------------------------------
-- DÉFAUT 2 — UN TYPE ÉNUMÉRÉ MORT
--
-- ref.role_utilisateur reprenait les 5 rôles Bubble (Admin, Candidat,
-- Entreprise, Recruiter Core Team, Recruiter Support Crew). Aucune
-- colonne du modèle ne l'emploie, et c'est normal : la Décision 4 a
-- éclaté cette notion en deux. Le portail se déduit de la personne
-- rattachée à l'accès, le pouvoir interne vit dans app.role_interne.
-- Le type est un vestige de la traduction mécanique des 28 référentiels.
--
-- Sa correspondance est REPOINTÉE vers les vraies destinations plutôt
-- que supprimée : c'est précisément ce que ref.correspondance existe pour
-- garder, et un rôle Bubble devra rester lisible après la coupure.
-- ---------------------------------------------------------------------

update ref.correspondance set code_cible = 'admin'
  where referentiel = 'ref_role' and libelle_miroir = 'Admin';
update ref.correspondance set code_cible = 'recruteur'
  where referentiel = 'ref_role' and libelle_miroir = 'Recruiter Core Team';
update ref.correspondance set code_cible = 'support'
  where referentiel = 'ref_role' and libelle_miroir = 'Recruiter Support Crew';
update ref.correspondance set code_cible = 'talent'
  where referentiel = 'ref_role' and libelle_miroir = 'Candidat';
update ref.correspondance set code_cible = 'entreprise'
  where referentiel = 'ref_role' and libelle_miroir = 'Entreprise';

delete from ref.libelle where domaine = 'role_utilisateur';

alter table ref.libelle drop constraint libelle_domaine;
alter table ref.libelle add constraint libelle_domaine check (domaine in (
  'background_talent','cible_produit','type_entreprise','type_apporteur',
  'source_marketing','type_contrat','type_contributeur','emoji_statut',
  'fonction_utilisateur','genre','langue','statut_mandat','visibilite_mandat',
  'mindset_talent','niveau_analyse','niveau_anglais','type_note_event',
  'type_produit_xp','type_produit_entreprise','profil_talent','rythme_remote',
  'statut_relation','form_concurrence','form_provenance',
  'formule_mission','ancre_tache','evenement_tache'));

drop type ref.role_utilisateur;
