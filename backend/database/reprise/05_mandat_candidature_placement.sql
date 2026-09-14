-- =====================================================================
-- REPRISE 05 — MANDATS, CANDIDATURES, PLACEMENTS
--
-- mandat.recruteur_id devient contact_recruteur_id et pointe un CONTACT
-- CLIENT : mesuré, aucune de ses 36 valeurs n'est un utilisateur
-- Pachamama, toutes se résolvent dans equipe. Le nom du miroir trompait.
--
-- La publication d'une offre n'est plus un état : les 35 mandats
-- 'public' et les 2 'talent_only' deviennent des ACTES dans
-- app.mandat_publication ; les 496 'private' n'en produisent aucun.
-- =====================================================================

insert into core.mandat (
  id, bubble_id, titre, description, description_manager, description_produit, missions,
  process_recrutement, pour_toi, pas_pour_toi, remote_infos, salaire_infos,
  format_mission, duree_mission, video_youtube,
  salaire_min_ke, salaire_max_ke, tjm_min_eur, tjm_max_eur, experience_min_annees,
  scorecard_delivery, scorecard_discovery, scorecard_strategie, scorecard_ops, scorecard_management,
  kickoff_le, est_anonyme, est_hors_marche, est_exclu, visibilite, statut,
  equity, type_contributeur, contrat, exclusivite_pachamama, type_deal, source_marketing,
  univers_id, metier_id, entreprise_id, contact_manager_id, contact_recruteur_id,
  agent_2_id, account_manager_id, cree_par_id, cree_le, maj_le)
select
  reprise.uid(m.id), m.id, m.titre, m.description, m.description_manager, m.description_produit,
  m.missions, m.process_recrutement, m.pour_toi, m.pas_pour_toi, m.remote_infos, m.salaire_infos,
  m.format_mission, m.duree_mission, m.video_youtube,
  reprise.ke(m.salaire_min), reprise.ke(m.salaire_max), m.tjm_min, m.tjm_max, m.min_xp,
  m.delivery, m.discovery, m.strategie, m.ops, m.management,
  m.kickoff, coalesce(m.job_anonyme,false), coalesce(m.job_off_market,false),
  exists (select 1 from public.mandat_tag_job t where t.mandat_id=m.id and t.tag_job='Job exclu'),
  reprise.code('ref_mandate_visibility', m.visibilite)::ref.visibilite_mandat,
  reprise.code('ref_mandate_status',     m.statut)::ref.statut_mandat,
  -- equity et type_deal viennent de CHECK EN LIGNE du miroir, pas d'une
  -- table ref_ : ils n'ont donc aucune correspondance amorcée, et la
  -- traduction est faite ici, explicitement.
  (case m.equity when 'actions gratuites' then 'actions_gratuites'
                 when 'bspce' then 'bspce'
                 when 'peut-être plus tard' then 'peut_etre_plus_tard'
                 when 'non' then 'non' end)::ref.equity_mandat,
  reprise.code('ref_contributor_type',   m.contributor_type)::ref.type_contributeur,
  reprise.code('ref_contrat',            m.contrat)::ref.type_contrat,
  -- exclu_pachamama est du TEXTE dans le miroir : Oui 134 / Non 265 / vide 134
  (case m.exclu_pachamama when 'Oui' then true when 'Non' then false end),
  (case m.type_deal when 'New Business' then 'new_business'
                    when 'Existing Business' then 'existing_business' end)::ref.type_deal,
  reprise.code('ref_source_marketing',   m.source_marketing)::ref.source_marketing,
  u.id, mt.id,
  (select e.id from core.entreprise e where e.id = reprise.uid(m.entreprise_id)),
  (select c.id from core.contact_client c where c.bubble_id = m.manager_id),
  (select c.id from core.contact_client c where c.bubble_id = m.recruteur_id),
  (select k.id from core.collaborateur k where k.id = reprise.uid(m.agent_2_id)),
  (select k.id from core.collaborateur k where k.id = reprise.uid(m.account_manager_id)),
  (select k.id from core.collaborateur k where k.id = reprise.uid(m.created_by)),
  coalesce(m.created_at, now()), coalesce(m.updated_at, now())
from public.mandat m
left join ref.univers u  on u.code  = reprise.code('ref_univers', m.univers)
left join ref.metier  mt on mt.code = coalesce(reprise.code('ref_metier', m.metier),
                                               reprise.code('donnees.metier', m.metier))
on conflict (id) do nothing;

select reprise.noter('05','core.mandat',(select count(*) from public.mandat),
  (select count(*) from core.mandat), 0, null);

-- ── les liaisons du mandat
insert into core.mandat_tag_job (mandat_id, tag_job_id)
select reprise.uid(t.mandat_id), tj.id
from public.mandat_tag_job t
join core.mandat m on m.id = reprise.uid(t.mandat_id)
join ref.tag_job tj on tj.code = reprise.code('mandat_tag_job', t.tag_job)
on conflict do nothing;

insert into core.mandat_remote (mandat_id, remote)
select reprise.uid(r.mandat_id), reprise.code('ref_remote', r.remote)::ref.rythme_remote
from public.mandat_remote r join core.mandat m on m.id = reprise.uid(r.mandat_id)
where reprise.code('ref_remote', r.remote) is not null on conflict do nothing;

insert into core.mandat_cible (mandat_id, cible)
select reprise.uid(c.mandat_id), reprise.code('ref_cible', c.cible)::ref.cible_produit
from public.mandat_cible c join core.mandat m on m.id = reprise.uid(c.mandat_id)
where reprise.code('ref_cible', c.cible) is not null on conflict do nothing;

select reprise.noter('05','liaisons du mandat',
  (select (select count(*) from public.mandat_tag_job)+(select count(*) from public.mandat_remote)
         +(select count(*) from public.mandat_cible)),
  (select (select count(*) from core.mandat_tag_job)+(select count(*) from core.mandat_remote)
         +(select count(*) from core.mandat_cible)), 0, null);

-- ── la participation des contacts, union des deux sources
insert into core.mandat_contact_client (mandat_id, contact_client_id, bubble_id, est_contact_principal, type_equipe_code, cree_le)
select distinct on (reprise.uid(e.mandat_id), c.id)
       reprise.uid(e.mandat_id), c.id, e.id, coalesce(e.contact_principal,false),
       lower(regexp_replace(coalesce(e.type_equipe,''), '[^A-Za-z0-9]+','_','g')) , coalesce(e.created_at, now())
from public.equipe e
join core.mandat m on m.id = reprise.uid(e.mandat_id)
join core.contact_client c on c.bubble_id = e.id or c.email::text = lower(e.email)
where e.mandat_id is not null
on conflict do nothing;

insert into core.mandat_contact_client (mandat_id, contact_client_id, est_contact_principal, cree_le)
select distinct reprise.uid(me.mandat_id), c.id, false, now()
from public.mandat_equipe me
join core.mandat m on m.id = reprise.uid(me.mandat_id)
join core.contact_client c on c.bubble_id = me.equipe_id
on conflict do nothing;

select reprise.noter('05','core.mandat_contact_client',
  null, (select count(*) from core.mandat_contact_client), 0,
  'union de equipe.mandat_id et de mandat_equipe, dédoublonnée par la paire');

-- ── la publication comme ACTE
insert into app.mandat_publication (mandat_id, canal, libelle_public, publie_le, cree_le, maj_le)
select reprise.uid(m.id),
       case m.visibilite when 'public' then 'job_board_public' else 'espace_talent' end::app.canal_publication,
       m.titre, coalesce(m.created_at, now()), coalesce(m.created_at, now()), now()
from public.mandat m join core.mandat cm on cm.id = reprise.uid(m.id)
where m.visibilite in ('public','talent_only')
on conflict do nothing;

select reprise.noter('05','app.mandat_publication',
  (select count(*) from public.mandat where visibilite in ('public','talent_only')),
  (select count(*) from app.mandat_publication), 0,
  'les 496 mandats privés ne produisent AUCUNE ligne : ne pas être publié n''est plus un drapeau');

-- ── les candidatures
insert into core.candidature (
  id, bubble_id, fiche_talent_id, mandat_id, entreprise_id, etape_id,
  compte_rendu, appreciation_like, appreciation_personnalite, points_forts, points_faibles,
  infos_remuneration, salaire_min_ke, salaire_souhaite_ke, tjm_min_eur, tjm_souhaite_eur,
  date_entree_pipeline, date_ko, date_dernier_changement_etape, date_prochaine_echeance,
  est_spontanee, cree_par_id, cree_le, maj_le)
select reprise.uid(p.id), p.id,
       (select f.id from core.fiche_talent f where f.id = reprise.uid(p.candidat_id)),
       (select m.id from core.mandat m where m.id = reprise.uid(p.mandat_id)),
       (select e.id from core.entreprise e where e.id = reprise.uid(p.entreprise_id)),
       ep.id,
       p.description, p.pachamama_like, p.pachamama_personnalite,
       p.plus_par_rapport_mission, p.moins_par_rapport_mission, p.infos_remuneration,
       reprise.ke(p.salaire_minimum), reprise.ke(p.salaire_souhaite), p.tjm_minimum, p.tjm_souhaite,
       p.date_statut_applicant, p.date_statut_ko, p.date_update_etape, p.next_step_date,
       p.mandat_id is null,
       (select k.id from core.collaborateur k where k.id = reprise.uid(p.created_by)),
       coalesce(p.created_at, now()), coalesce(p.updated_at, now())
from public.process p
left join ref.etape_process ep on ep.code = reprise.code('process.etape', p.etape)
on conflict (id) do nothing;

select reprise.noter('05','core.candidature',(select count(*) from public.process),
  (select count(*) from core.candidature), 0, null);

-- ── les placements
insert into core.placement (
  id, bubble_id, fiche_talent_id, entreprise_id, mandat_id, candidature_id,
  univers_id, type_contributeur, contrat, statut_contrat_freelance_id, statut_contrat_entreprise_id,
  date_closing, date_debut_mission, date_fin_garantie, date_fin_mission,
  salaire_final_ke, commission_ke, commission_nette_ke, montant_apport_affaires_ke,
  montant_cooptation_talent_eur, tjm_facture_client_eur, tjm_verse_talent_eur,
  est_archive, cree_par_id, cree_le, maj_le)
select reprise.uid(k.id), k.id,
       (select f.id from core.fiche_talent f where f.id = reprise.uid(k.candidat_id)),
       (select e.id from core.entreprise e where e.id = reprise.uid(k.entreprise_id)),
       (select m.id from core.mandat m where m.id = reprise.uid(k.mandat_id)),
       (select c.id from core.candidature c where c.id = reprise.uid(k.process_id)),
       u.id,
       reprise.code('ref_contributor_type', k.contributor_type)::ref.type_contributeur,
       reprise.code('ref_contrat', k.contrat)::ref.type_contrat,
       scf.id, sce.id,
       coalesce(k.date_closing, k.created_at, now()),
       k.date_debut, k.date_fin_garantie, k.date_fin_mission,
       k.salaire_final, k.commission, k.commission_nette, k.apport_affaires_k,
       k.cooptation_talent, k.tjm_final_marge_inclus, k.tjm_final_talent,
       coalesce(k.est_archive,false),
       (select c.id from core.collaborateur c where c.id = reprise.uid(k.created_by)),
       coalesce(k.created_at, now()), coalesce(k.updated_at, now())
from public.mandatclose k
left join ref.univers u on u.code = reprise.code('ref_univers', k.univers)
left join ref.statut_contrat scf on scf.code = reprise.code('ref_contract_status', k.statut_contrat_freelance)
left join ref.statut_contrat sce on sce.code = reprise.code('ref_contract_status', k.statut_contrat_entreprise)
on conflict (id) do nothing;

select reprise.noter('05','core.placement',(select count(*) from public.mandatclose),
  (select count(*) from core.placement), 0, null);

-- ── la répartition. L'IDENTITÉ des agents ne vient PAS de la ligne de
--    répartition, qui ne porte que des montants : elle vient du placement.
insert into core.repartition_commission (
  id, bubble_id, placement_id, agent_1_id, agent_1_montant_eur, agent_1_pct, agent_1_est_absolu,
  agent_2_id, agent_2_montant_eur, agent_2_pct, agent_2_est_absolu,
  apporteur_cooptation_montant_eur, apporteur_cooptation_pct,
  apporteur_deal_montant_eur, apporteur_deal_pct,
  pachamama_montant_eur, pachamama_pct, net_montant_eur, net_pct,
  total_montant_eur, total_pct, cree_le, maj_le)
select reprise.uid(s.id), s.id, reprise.uid(s.mandatclose_id),
       (select c.id from core.collaborateur c where c.id = reprise.uid(k.agent_filtre_id)),
       s.agent_1_com, s.agent_1_com_pct, coalesce(s.agent_1_com_is_absolute,false),
       (select c.id from core.collaborateur c where c.id = reprise.uid(k.agent_2_filtre_id)),
       s.agent_2_com, s.agent_2_com_pct, coalesce(s.agent_2_com_is_absolute,false),
       s.bus_maker_coo_com, s.bus_maker_coo_com_pct,
       s.bus_maker_deal_com, s.bus_maker_deal_com_pct,
       s.pacha_com, s.pacha_com_pct, s.net, s.net_pct, s.total, s.total_pct,
       coalesce(s.created_at, now()), coalesce(s.updated_at, now())
from public.mandate_closed_split s
join core.placement p on p.id = reprise.uid(s.mandatclose_id)
left join public.mandatclose k on k.id = s.mandatclose_id
on conflict (id) do nothing;

select reprise.noter('05','core.repartition_commission',
  (select count(*) from public.mandate_closed_split),
  (select count(*) from core.repartition_commission), 0,
  'l''identité des agents vient du placement : la ligne de répartition ne porte que des montants');
