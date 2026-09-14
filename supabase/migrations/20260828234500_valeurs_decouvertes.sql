-- =====================================================================
-- LES VALEURS DÉCOUVERTES EN DONNÉES
--
-- Le contrôle de non-perte, passé après l'amorçage, a trouvé des valeurs
-- utilisées par les données mais absentes de leur référentiel : des
-- métiers et des expertises saisis au clavier par les recruteurs, que
-- personne n'a jamais reversés au vocabulaire.
--
-- Sans elles, les clés étrangères de core.mandat.metier_id, de
-- core.fiche_talent.poste_actuel_metier_id et des tables d'expertise
-- rejetteraient ces lignes à la reprise.
--
-- Le modèle l'avait prévu : origine = 'decouvert_en_donnees', qui les
-- distingue pour toujours des valeurs venues d'un référentiel.
-- =====================================================================

-- ref.metier — 17 valeurs découvertes
insert into ref.metier (code, libelle_fr, ordre, origine) values ('engineering_director', 'Engineering Director', 1001, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.metier', 'Engineering Director', 'engineering_director', 'hors_referentiel', 12) on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.metier (code, libelle_fr, ordre, origine) values ('program_manager', 'Program Manager', 1002, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.metier', 'Program Manager', 'program_manager', 'hors_referentiel', 6) on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.metier (code, libelle_fr, ordre, origine) values ('platform_owner', 'Platform Owner', 1003, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.metier', 'Platform Owner', 'platform_owner', 'hors_referentiel', 5) on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.metier (code, libelle_fr, ordre, origine) values ('lead_ml', 'Lead ML', 1004, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.metier', 'Lead ML', 'lead_ml', 'hors_referentiel', 5) on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.metier (code, libelle_fr, ordre, origine) values ('web_analytics_manager', 'Web Analytics Manager', 1005, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.metier', 'Web Analytics Manager', 'web_analytics_manager', 'hors_referentiel', 5) on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.metier (code, libelle_fr, ordre, origine) values ('business_process_owner', 'Business Process Owner', 1006, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.metier', 'Business Process Owner', 'business_process_owner', 'hors_referentiel', 4) on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.metier (code, libelle_fr, ordre, origine) values ('founding_engineer', 'Founding Engineer', 1007, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.metier', 'Founding Engineer', 'founding_engineer', 'hors_referentiel', 4) on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.metier (code, libelle_fr, ordre, origine) values ('senior_devops', 'Senior DevOps', 1008, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.metier', 'Senior DevOps', 'senior_devops', 'hors_referentiel', 2) on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.metier (code, libelle_fr, ordre, origine) values ('director_of_product_marketing_strategy_et_enablement', 'Director of Product Marketing, Strategy & Enablement', 1009, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.metier', 'Director of Product Marketing, Strategy & Enablement', 'director_of_product_marketing_strategy_et_enablement', 'hors_referentiel', 1) on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.metier (code, libelle_fr, ordre, origine) values ('responsable_acquisition_abonnement', 'Responsable acquisition abonnement', 1010, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.metier', 'Responsable acquisition abonnement', 'responsable_acquisition_abonnement', 'hors_referentiel', 1) on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.metier (code, libelle_fr, ordre, origine) values ('senior_product_builder_data', 'Senior Product Builder - Data', 1011, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.metier', 'Senior Product Builder - Data', 'senior_product_builder_data', 'hors_referentiel', 1) on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.metier (code, libelle_fr, ordre, origine) values ('staff_product_manager', 'Staff Product Manager', 1012, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.metier', 'Staff Product Manager', 'staff_product_manager', 'hors_referentiel', 1) on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.metier (code, libelle_fr, ordre, origine) values ('senior_ml', 'Senior ML', 1013, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.metier', 'Senior ML', 'senior_ml', 'hors_referentiel', 1) on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.metier (code, libelle_fr, ordre, origine) values ('consultant_e_cro', 'Consultant·e CRO', 1014, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.metier', 'Consultant·e CRO', 'consultant_e_cro', 'hors_referentiel', 1) on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.metier (code, libelle_fr, ordre, origine) values ('head_of_rssi', 'Head of RSSI', 1015, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.metier', 'Head of RSSI', 'head_of_rssi', 'hors_referentiel', 1) on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.metier (code, libelle_fr, ordre, origine) values ('principal_engineer', 'Principal Engineer', 1016, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.metier', 'Principal Engineer', 'principal_engineer', 'hors_referentiel', 1) on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.metier (code, libelle_fr, ordre, origine) values ('associate_pm', 'Associate PM', 1017, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.metier', 'Associate PM', 'associate_pm', 'hors_referentiel', 1) on conflict (referentiel, libelle_miroir) do nothing;

-- ref.expertise — 2 valeurs découvertes
insert into ref.expertise (code, libelle_fr, ordre, origine) values ('ux_ui', 'UX/UI', 1001, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.expertise', 'UX/UI', 'ux_ui', 'hors_referentiel', 29) on conflict (referentiel, libelle_miroir) do nothing;
insert into ref.expertise (code, libelle_fr, ordre, origine) values ('integrations', 'Intégrations', 1002, 'decouvert_en_donnees');
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values ('donnees.expertise', 'Intégrations', 'integrations', 'hors_referentiel', 20) on conflict (referentiel, libelle_miroir) do nothing;
