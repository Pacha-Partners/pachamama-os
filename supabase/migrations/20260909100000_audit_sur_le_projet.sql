-- =====================================================================
-- AUDIT DE NON-PERTE EXÉCUTÉ SUR LE PROJET LUI-MÊME
--
-- L'audit précédent tournait sur une réplique locale. Celui-ci s'exécute
-- sur la base réelle et ÉCRIT SES RÉSULTATS, pour qu'ils soient relisibles
-- sans me croire sur parole.
--
-- Pour chacune des 188 colonnes du miroir qui doivent migrer : le nombre
-- de valeurs renseignées à la source, le nombre à destination, l'écart.
-- =====================================================================

drop table if exists reprise.audit_valeur;
create table reprise.audit_valeur (
  src_tab text, src_col text, cible text, cible_col text,
  nature text, motif text, n_src bigint, n_cible bigint,
  fait_le timestamptz not null default now());

create temporary table audit_map (
  src_tab text, src_col text, cible text, cible_col text, nature text, motif text);

insert into audit_map values
-- ═══ candidat → core.fiche_talent
('candidat','id','core.fiche_talent','bubble_id','reprise',null),
('candidat','nom','core.fiche_talent','nom','reprise',null),
('candidat','prenom','core.fiche_talent','prenom','reprise',null),
('candidat','email_perso','core.fiche_talent','email_personnel','reprise',null),
('candidat','linkedin','core.fiche_talent','url_linkedin','reprise',null),
('candidat','telephone','core.fiche_talent','telephone','reprise',null),
('candidat','photo_url','core.fiche_talent','photo_url','reprise',null),
('candidat','cv_url','core.fiche_talent','cv_url','reprise',null),
('candidat','portfolio_file_url','core.fiche_talent','portfolio_fichier_url','reprise',null),
('candidat','genre','core.fiche_talent','genre','reprise',null),
('candidat','niveau_anglais','core.fiche_talent','niveau_anglais','reprise',null),
('candidat','univers','core.fiche_talent','univers_id','reprise',null),
('candidat','est_qualifie','core.fiche_talent','est_qualifie','reprise',null),
('candidat','grandes_ecoles','core.fiche_talent','grande_ecole','reprise',null),
('candidat','localisations','core.fiche_talent','localisations_brut_json','reprise',null),
('candidat','localisations_filtre','core.fiche_talent','localisation_texte','reprise',null),
('candidat','created_at','core.fiche_talent','cree_le','reprise',null),
('candidat','updated_at','core.fiche_talent','maj_le','reprise',null),
('candidat','mindset','core.fiche_talent','mindset','fusion','avec candidat_expanded.mindset'),
('candidat','statut','core.fiche_talent','statut_relation','fusion','avec candidat_expanded.statut'),
('candidat','emoji_statut','core.fiche_talent','emoji_statut','fusion','avec candidat_expanded.emoji'),
('candidat','contrat_actuel','core.fiche_talent','poste_actuel_contrat','fusion','avec candidat_expanded.contrat'),
('candidat','early_stage','core.fiche_talent','appetence_early_stage','fusion','avec candidat_expanded.stage'),
('candidat','portfolio','core.fiche_talent','portfolio_url','fusion','avec candidat_expanded.portfolio'),
('candidat','agent_pachamama_id','core.fiche_talent','agent_referent_id','fusion','avec candidat_expanded.agent_id'),
('candidat','salaire_min_souhait','core.fiche_talent','attentes_salaire_min_ke','fusion','avec job_reve.salaire'),
('candidat','salaire_max_souhait','core.fiche_talent','attentes_salaire_max_ke','fusion','avec job_reve.salaire_maximum'),
('candidat','tjm_min_souhait','core.fiche_talent','attentes_tjm_min_eur','fusion','avec job_reve.tjm_minimum'),
('candidat','tjm_max_souhait','core.fiche_talent','attentes_tjm_max_eur','fusion','avec job_reve.tjm_maximum'),
('candidat','business_maker_id','core.fiche_talent','apporteur_affaires_id','reprise',null),
('candidat','created_by','core.fiche_talent','cree_par_legacy_bubble','reprise',null),
('candidat','pachamama_like',null,null,'abandon','déplacé en note typée (vide en dev, 503 en production)'),
('candidat','pachamama_personnalite',null,null,'abandon','déplacé en note typée'),
('candidat','note_interne',null,null,'abandon','déplacé en note typée'),
('candidat','metier_actuel',null,null,'abandon','remplacé par job_actuel.metier, mieux rempli'),
('candidat','opento',null,null,'abandon','0 valeur mesurée en production'),
('candidat','prenom_lower',null,null,'abandon','colonne dérivée, index fonctionnel'),
('candidat','nom_lower',null,null,'abandon','colonne dérivée, index fonctionnel'),
('candidat','slug',null,null,'abandon','identifiant d''URL Bubble'),
('candidat','experience_id',null,null,'abandon','satellite 1:1 replié'),
('candidat','job_actuel_id',null,null,'abandon','satellite 1:1 replié'),
('candidat','job_reve_id',null,null,'abandon','satellite 1:1 replié'),
('candidat','ajout_par_id',null,null,'abandon','non modélisé, doublon de created_by'),
-- ═══ candidat_expanded
('candidat_expanded','ecole','core.fiche_talent','ecole','reprise',null),
('candidat_expanded','is_complete','core.fiche_talent','fiche_complete','reprise',null),
('candidat_expanded','perso',null,null,'abandon','déplacé en note typée'),
('candidat_expanded','note_1',null,null,'abandon','déplacé en note typée'),
('candidat_expanded','note_2',null,null,'abandon','déplacé en note typée'),
('candidat_expanded','slug',null,null,'abandon','identifiant d''URL Bubble'),
-- ═══ job_reve → fiche
('job_reve','salaire','core.fiche_talent','attentes_salaire_min_ke','fusion','avec candidat.salaire_min_souhait'),
('job_reve','salaire_maximum','core.fiche_talent','attentes_salaire_max_ke','fusion','avec candidat.salaire_max_souhait'),
('job_reve','tjm_minimum','core.fiche_talent','attentes_tjm_min_eur','fusion',null),
('job_reve','tjm_maximum','core.fiche_talent','attentes_tjm_max_eur','fusion',null),
('job_reve','infos_salaire','core.fiche_talent','attentes_infos_salaire','reprise',null),
('job_reve','disponibilite','core.fiche_talent','attentes_disponibilite_texte','reprise',null),
('job_reve','info_localisation','core.fiche_talent','attentes_localisation_texte','reprise',null),
('job_reve','localisations','core.fiche_talent','attentes_localisations_brut_json','reprise',null),
('job_reve','description','core.fiche_talent','attentes_description','reprise',null),
('job_reve','metier','core.fiche_talent','attentes_metier_id','reprise',null),
('job_reve','univers','core.fiche_talent','attentes_univers_id','reprise',null),
-- ═══ job_actuel → fiche
('job_actuel','entreprise_nom','core.fiche_talent','poste_actuel_employeur','reprise',null),
('job_actuel','entreprise_id','core.fiche_talent','poste_actuel_entreprise_id','reprise',null),
('job_actuel','metier','core.fiche_talent','poste_actuel_metier_id','reprise',null),
('job_actuel','univers','core.fiche_talent','poste_actuel_univers_id','reprise',null),
('job_actuel','pourquoi','core.fiche_talent','poste_actuel_raison_depart','reprise',null),
-- ═══ experience → fiche
('experience','xp_pro','core.fiche_talent','debut_vie_professionnelle','reprise',null),
('experience','entreprise_id',null,null,'abandon','vide sur 7 049 lignes, mesuré'),
-- ═══ entreprise
('entreprise','nom','core.entreprise','nom','reprise',null),
('entreprise','description','core.entreprise','description','reprise',null),
('entreprise','fondateur','core.entreprise','fondateur','reprise',null),
('entreprise','serie','core.entreprise','serie_financement','reprise',null),
('entreprise','site_internet','core.entreprise','site_web','reprise',null),
('entreprise','siret','core.entreprise','siret','reprise',null),
('entreprise','video','core.entreprise','video_url','reprise',null),
('entreprise','logo_url','core.entreprise','logo_url','reprise',null),
('entreprise','note','core.entreprise','note_interne','reprise',null),
('entreprise','localisation','core.entreprise','localisation_json','reprise',null),
('entreprise','nb_employes','core.entreprise','nb_employes','reprise',null),
('entreprise','nb_techs','core.entreprise','nb_techs','reprise',null),
('entreprise','secteur','core.entreprise','secteur_id','reprise',null),
('entreprise','product_type','core.entreprise','type_produit','reprise',null),
('entreprise','type_entreprise','core.entreprise','type_entreprise','reprise',null),
('entreprise','niveau_anglais','core.entreprise','exigence_anglais','reprise',null),
('entreprise','statut','core.entreprise','statut_relation','reprise',null),
('entreprise','statut_contrat','core.entreprise','statut_contrat_id','reprise',null),
('entreprise','formule','core.entreprise','formule','reprise',null),
('entreprise','agence','core.entreprise','agence','reprise',null),
('entreprise','recommandation','core.entreprise','recommandation','reprise',null),
('entreprise','success_fee_pct','core.entreprise','success_fee_pct','reprise',null),
('entreprise','success_fee_abs','core.entreprise','success_fee_abs_ke','reprise',null),
('entreprise','apport_affaires_pct','core.entreprise','apport_affaires_pct','reprise',null),
('entreprise','exclu_details','core.entreprise','exclusivite_details','reprise',null),
('entreprise','duree_exclusivite_semaines','core.entreprise','duree_exclusivite_semaines','reprise',null),
('entreprise','nb_mois_garantie','core.entreprise','nb_mois_garantie','reprise',null),
('entreprise','garantie','core.entreprise','type_garantie_code','reprise',null),
('entreprise','paiement','core.entreprise','base_paiement_code','reprise',null),
('entreprise','date_signature_contrat','core.entreprise','date_signature_contrat','reprise',null),
('entreprise','date_fin_contrat','core.entreprise','date_fin_contrat','reprise',null),
('entreprise','email_facturation','core.entreprise','email_facturation','reprise',null),
('entreprise','nom_structure_facturation','core.entreprise','raison_sociale_facturation','reprise',null),
('entreprise','agent_en_charge_id','core.entreprise','account_manager_id','reprise',null),
('entreprise','created_by','core.entreprise','cree_par_id','reprise','327 pointent des comptes supprimés'),
('entreprise','slug',null,null,'abandon','identifiant d''URL Bubble'),
('entreprise','produit_id',null,null,'abandon','inverse de produit.entreprise_id'),
-- ═══ mandat
('mandat','titre','core.mandat','titre','reprise',null),
('mandat','description','core.mandat','description','reprise',null),
('mandat','description_manager','core.mandat','description_manager','reprise',null),
('mandat','description_produit','core.mandat','description_produit','reprise',null),
('mandat','missions','core.mandat','missions','reprise',null),
('mandat','process_recrutement','core.mandat','process_recrutement','reprise',null),
('mandat','pour_toi','core.mandat','pour_toi','reprise',null),
('mandat','pas_pour_toi','core.mandat','pas_pour_toi','reprise',null),
('mandat','remote_infos','core.mandat','remote_infos','reprise',null),
('mandat','salaire_infos','core.mandat','salaire_infos','reprise',null),
('mandat','format_mission','core.mandat','format_mission','reprise',null),
('mandat','duree_mission','core.mandat','duree_mission','reprise',null),
('mandat','video_youtube','core.mandat','video_youtube','reprise',null),
('mandat','salaire_min','core.mandat','salaire_min_ke','reprise',null),
('mandat','salaire_max','core.mandat','salaire_max_ke','reprise',null),
('mandat','tjm_min','core.mandat','tjm_min_eur','reprise',null),
('mandat','tjm_max','core.mandat','tjm_max_eur','reprise',null),
('mandat','min_xp','core.mandat','experience_min_annees','reprise',null),
('mandat','delivery','core.mandat','scorecard_delivery','reprise',null),
('mandat','discovery','core.mandat','scorecard_discovery','reprise',null),
('mandat','strategie','core.mandat','scorecard_strategie','reprise',null),
('mandat','ops','core.mandat','scorecard_ops','reprise',null),
('mandat','management','core.mandat','scorecard_management','reprise',null),
('mandat','kickoff','core.mandat','kickoff_le','reprise',null),
('mandat','statut','core.mandat','statut','reprise',null),
('mandat','visibilite','core.mandat','visibilite','reprise',null),
('mandat','equity','core.mandat','equity','reprise',null),
('mandat','contributor_type','core.mandat','type_contributeur','reprise',null),
('mandat','contrat','core.mandat','contrat','reprise',null),
('mandat','type_deal','core.mandat','type_deal','reprise',null),
('mandat','source_marketing','core.mandat','source_marketing','reprise',null),
('mandat','univers','core.mandat','univers_id','reprise',null),
('mandat','metier','core.mandat','metier_id','reprise',null),
('mandat','entreprise_id','core.mandat','entreprise_id','reprise',null),
('mandat','manager_id','core.mandat','contact_manager_id','reprise',null),
('mandat','recruteur_id','core.mandat','contact_recruteur_id','reprise',null),
('mandat','agent_2_id','core.mandat','agent_2_id','reprise',null),
('mandat','account_manager_id','core.mandat','account_manager_id','reprise',null),
('mandat','created_by','core.mandat','cree_par_id','reprise',null),
('mandat','exclu_pachamama','core.mandat','exclusivite_pachamama','reprise',null),
('mandat','date_demarrage_mission',null,null,'abandon','texte non analysable, 80 lignes'),
('mandat','z_legacy_number',null,null,'abandon','vestige Bubble'),
('mandat','status_sort_order',null,null,'abandon','ordre d''affichage du miroir'),
('mandat','personne_en_charge_id',null,null,'abandon','doublon de account_manager_id'),
('mandat','business_maker_id',null,null,'abandon','lien porté par core.apporteur_affaires'),
('mandat','lead_apporteur',null,null,'abandon','non modélisé'),
('mandat','slug',null,null,'abandon','identifiant d''URL Bubble'),
-- ═══ process → candidature
('process','description','core.candidature','compte_rendu','reprise',null),
('process','pachamama_like','core.candidature','appreciation_like','reprise',null),
('process','pachamama_personnalite','core.candidature','appreciation_personnalite','reprise',null),
('process','plus_par_rapport_mission','core.candidature','points_forts','reprise',null),
('process','moins_par_rapport_mission','core.candidature','points_faibles','reprise',null),
('process','infos_remuneration','core.candidature','infos_remuneration','reprise',null),
('process','salaire_minimum','core.candidature','salaire_min_ke','reprise',null),
('process','salaire_souhaite','core.candidature','salaire_souhaite_ke','reprise',null),
('process','tjm_minimum','core.candidature','tjm_min_eur','reprise',null),
('process','tjm_souhaite','core.candidature','tjm_souhaite_eur','reprise',null),
('process','etape','core.candidature','etape_id','reprise',null),
('process','candidat_id','core.candidature','fiche_talent_id','reprise',null),
('process','mandat_id','core.candidature','mandat_id','reprise',null),
('process','entreprise_id','core.candidature','entreprise_id','reprise',null),
('process','date_statut_applicant','core.candidature','date_entree_pipeline','reprise',null),
('process','date_statut_ko','core.candidature','date_ko','reprise',null),
('process','date_update_etape','core.candidature','date_dernier_changement_etape','reprise',null),
('process','next_step_date','core.candidature','date_prochaine_echeance','reprise',null),
('process','created_by','core.candidature','cree_par_id','reprise',null),
('process','slug',null,null,'abandon','identifiant d''URL Bubble'),
-- ═══ mandatclose → placement
('mandatclose','candidat_id','core.placement','fiche_talent_id','reprise',null),
('mandatclose','entreprise_id','core.placement','entreprise_id','reprise',null),
('mandatclose','mandat_id','core.placement','mandat_id','reprise',null),
('mandatclose','process_id','core.placement','candidature_id','reprise',null),
('mandatclose','univers','core.placement','univers_id','reprise',null),
('mandatclose','contributor_type','core.placement','type_contributeur','reprise',null),
('mandatclose','contrat','core.placement','contrat','reprise',null),
('mandatclose','statut_contrat_freelance','core.placement','statut_contrat_freelance_id','reprise',null),
('mandatclose','statut_contrat_entreprise','core.placement','statut_contrat_entreprise_id','reprise',null),
('mandatclose','date_closing','core.placement','date_closing','reprise',null),
('mandatclose','date_debut','core.placement','date_debut_mission','reprise',null),
('mandatclose','date_fin_garantie','core.placement','date_fin_garantie','reprise',null),
('mandatclose','date_fin_mission','core.placement','date_fin_mission','reprise',null),
('mandatclose','salaire_final','core.placement','salaire_final_ke','reprise',null),
('mandatclose','commission','core.placement','commission_ke','reprise',null),
('mandatclose','commission_nette','core.placement','commission_nette_ke','reprise',null),
('mandatclose','apport_affaires_k','core.placement','montant_apport_affaires_ke','reprise',null),
('mandatclose','cooptation_talent','core.placement','montant_cooptation_talent_eur','reprise',null),
('mandatclose','tjm_final_marge_inclus','core.placement','tjm_facture_client_eur','reprise',null),
('mandatclose','tjm_final_talent','core.placement','tjm_verse_talent_eur','reprise',null),
('mandatclose','est_archive','core.placement','est_archive','reprise',null),
('mandatclose','created_by','core.placement','cree_par_id','reprise',null),
('mandatclose','agent_filtre_id','core.repartition_commission','agent_1_id','reprise',null),
('mandatclose','agent_2_filtre_id','core.repartition_commission','agent_2_id','reprise',null),
('mandatclose','note_user_ids','core.placement_utilisateur','utilisateur_id','reprise','éclaté en lignes'),
('mandatclose','split_id',null,null,'abandon','inverse de repartition.placement_id'),
('mandatclose','business_maker_coo_id',null,null,'abandon','apporteur non modélisé sur le placement'),
('mandatclose','business_maker_deal_id',null,null,'abandon','idem'),
('mandatclose','slug',null,null,'abandon','identifiant d''URL Bubble'),
-- ═══ note
('note','commentaire','core.note','commentaire','reprise',null),
('note','date_note','core.note','ecrite_le','reprise',null),
('note','note_automatique','core.note','est_automatique','reprise',null),
('note','note_event','core.note','evenement_id','reprise',null),
('note','note_event_value_prev','core.note','valeur_avant','reprise',null),
('note','note_event_value_new','core.note','valeur_apres','reprise',null),
('note','mandatclose_id','core.note','placement_id','reprise',null),
('note','note_event_type',null,null,'abandon','redondant, se lit par jointure'),
('note','note_user_tag_id',null,null,'abandon','0 valeur mesurée'),
('note','slug',null,null,'abandon','identifiant d''URL Bubble'),
-- ═══ task
('task','task_text','core.tache','texte','reprise',null),
('task','is_complete','core.tache','est_faite','reprise',null),
('task','due_date','core.tache','echeance_le','reprise',null),
('task','task_type','core.tache','type_tache_id','reprise',null),
('task','mandatclose_id','core.tache','placement_id','reprise',null),
('task','assigned_user_id','core.tache','assignee_collaborateur_id','reprise',null),
('task','creation_user_id','core.tache','creee_par_collaborateur_id','reprise',null),
('task','update_user_id','core.tache','maj_par_collaborateur_id','reprise',null),
('task','task_notif_id',null,null,'abandon','le repli de task_notif le rend inutile'),
('task','slug',null,null,'abandon','identifiant d''URL Bubble'),
('task_notif','is_sent','core.tache','notif_envoyee','reprise',null),
('task_notif','preview_text','core.tache','notif_apercu','reprise',null),
('task_notif','sent_email','core.tache','notif_email','reprise',null),
('task_notif','sent_text','core.tache','notif_texte','reprise',null),
('task_notif','task_type',null,null,'abandon','vide à 100 %'),
('task_notif','wf_id',null,null,'abandon','identifiant de workflow Bubble'),
('task_notif','slug',null,null,'abandon','identifiant d''URL Bubble');

-- l'auteur d'une candidature vit désormais dans deux colonnes
update audit_map set cible='core.candidature', cible_col='cree_par_fiche_talent_id'
 where src_tab='process' and src_col='created_by';

do $$
declare r record; s bigint; c bigint;
begin
  for r in select * from audit_map loop
    if r.nature = 'abandon' then
      execute format('select count(%I) from public.%I', r.src_col, r.src_tab) into s;
      insert into reprise.audit_valeur (src_tab,src_col,cible,cible_col,nature,motif,n_src,n_cible)
        values (r.src_tab,r.src_col,null,null,'abandon',r.motif,s,null);
    else
      execute format('select count(%I) from public.%I', r.src_col, r.src_tab) into s;
      execute format('select count(%I) from %s', r.cible_col, r.cible) into c;
      if r.src_tab='process' and r.src_col='created_by' then
        select count(*) into c from core.candidature
         where cree_par_id is not null or cree_par_fiche_talent_id is not null;
      end if;
      insert into reprise.audit_valeur (src_tab,src_col,cible,cible_col,nature,motif,n_src,n_cible)
        values (r.src_tab,r.src_col,r.cible,r.cible_col,r.nature,r.motif,s,c);
    end if;
  end loop;
end $$;

-- Le total des cellules non vides du miroir, pour rapporter l'écart à la masse.
insert into reprise.audit_valeur (src_tab, src_col, nature, n_src)
select '(TOTAL MIROIR)','(toutes colonnes)','recensement', sum(n) from (
  select (xpath('/row/c/text()', query_to_xml(
            format('select count(%I) c from public.%I', c.column_name, c.table_name),
            false,true,'')))[1]::text::bigint as n
  from information_schema.columns c
  join information_schema.tables x
    on x.table_schema=c.table_schema and x.table_name=c.table_name and x.table_type='BASE TABLE'
  where c.table_schema='public') z;
