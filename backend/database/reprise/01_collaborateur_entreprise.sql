-- =====================================================================
-- REPRISE 01 — LES COLLABORATEURS ET LES CLIENTS
-- =====================================================================

-- ---------------------------------------------------------------------
-- core.collaborateur — PÉRIMÈTRE MESURÉ : 42 personnes
--
-- 38 portent un rôle interne. 4 de plus sont désignées quelque part
-- comme agent, account manager ou assignée d'une tâche sans avoir de
-- rôle : ce sont d'anciens membres de l'équipe, et les exclure
-- orphelinerait les fiches dont ils restent référents.
--
-- 77 autres identifiants sont référencés mais N'EXISTENT PAS dans
-- public.user — des comptes supprimés. Leurs références deviendront
-- NULL, ce qui est le comportement voulu de tous les ON DELETE SET NULL.
-- ---------------------------------------------------------------------

with interne as (
  select distinct user_id id from public.user_role
   where role in ('Admin','Recruiter Core Team','Recruiter Support Crew')
), acteur as (
  select agent_en_charge_id id from public.entreprise where agent_en_charge_id is not null
  union select account_manager_id from public.mandat  where account_manager_id is not null
  union select agent_2_id         from public.mandat  where agent_2_id is not null
  union select manager_id         from public.mandat  where manager_id is not null
  union select agent_pachamama_id from public.candidat where agent_pachamama_id is not null
  union select agent_id           from public.candidat_expanded where agent_id is not null
  union select agent_filtre_id    from public.mandatclose where agent_filtre_id is not null
  union select agent_2_filtre_id  from public.mandatclose where agent_2_filtre_id is not null
  union select assigned_user_id   from public.task where assigned_user_id is not null
  union select creation_user_id   from public.task where creation_user_id is not null
  union select update_user_id     from public.task where update_user_id is not null
), perimetre as (
  select id from interne union select id from acteur
)
insert into core.collaborateur (
  id, bubble_id, nom, prenom, photo_url, fonction, langue,
  actif, est_supprime, premiere_connexion_le, cree_le, maj_le_source, maj_le)
select reprise.uid(u.id), u.id, u.nom, u.prenom, u.photo_url,
       reprise.code('ref_fonction', u.fonction)::ref.fonction_utilisateur,
       reprise.code('ref_language', coalesce(u.langue, u.user_lang))::ref.langue,
       not coalesce(u.is_deleted, false),          -- actif = NOT supprimé
       coalesce(u.is_deleted, false),
       u.premiere_connexion_at, coalesce(u.created_at, now()), u.updated_at, now()
from public."user" u
where u.id in (select id from perimetre)
on conflict (id) do nothing;

select reprise.noter('01','core.collaborateur',
  (select count(*) from (
     select distinct user_id id from public.user_role where role in ('Admin','Recruiter Core Team','Recruiter Support Crew')
     union
     select id from (select agent_en_charge_id id from public.entreprise where agent_en_charge_id is not null
       union select account_manager_id from public.mandat where account_manager_id is not null
       union select agent_2_id from public.mandat where agent_2_id is not null
       union select manager_id from public.mandat where manager_id is not null
       union select agent_pachamama_id from public.candidat where agent_pachamama_id is not null
       union select agent_id from public.candidat_expanded where agent_id is not null
       union select agent_filtre_id from public.mandatclose where agent_filtre_id is not null
       union select agent_2_filtre_id from public.mandatclose where agent_2_filtre_id is not null
       union select assigned_user_id from public.task where assigned_user_id is not null
       union select creation_user_id from public.task where creation_user_id is not null
       union select update_user_id from public.task where update_user_id is not null) a
     where exists (select 1 from public."user" u where u.id=a.id)) z),
  (select count(*) from core.collaborateur), 0,
  'les identifiants référencés mais absents de public.user deviennent NULL chez leurs consommateurs');

-- ---------------------------------------------------------------------
-- core.collaborateur_univers — user_partner, jusqu'à 7 univers par personne
-- ---------------------------------------------------------------------

insert into core.collaborateur_univers (collaborateur_id, univers_id, bubble_id, cree_le)
select reprise.uid(p.user_id), u.id, p.id, coalesce(p.created_at, now())
from public.user_partner p
join core.collaborateur c on c.id = reprise.uid(p.user_id)
join ref.univers u on u.code = reprise.code('ref_univers', p.univers)
on conflict do nothing;

select reprise.noter('01','core.collaborateur_univers',
  (select count(*) from public.user_partner),
  (select count(*) from core.collaborateur_univers), 0,
  'écart normal : un rattachement dont l''utilisateur n''est pas collaborateur est ignoré');

-- ---------------------------------------------------------------------
-- core.entreprise — 850 clients
--
-- success_fee_abs est NORMALISÉ : la source mélangeait deux unités sur
-- quatre valeurs (10 · 11,5 en K€, 10 000 · 18 000 en euros). Règle
-- écrite, pas devinée : au-delà de 1000 c'était des euros.
-- ---------------------------------------------------------------------

insert into core.entreprise (
  id, bubble_id, nom, description, fondateur, serie_financement, site_web, siret,
  video_url, logo_url, note_interne, localisation_json, nb_employes, nb_techs,
  secteur_id, type_produit, type_entreprise, exigence_anglais, remote,
  statut_relation, statut_contrat_id, formule, agence, recommandation,
  success_fee_pct, success_fee_abs_ke, success_fee_est_absolu,
  apport_affaires, apport_affaires_pct, exclusivite, exclusivite_details,
  duree_exclusivite_semaines, nb_mois_garantie, type_garantie_code, base_paiement_code,
  date_signature_contrat, date_fin_contrat, email_facturation, raison_sociale_facturation,
  account_manager_id, actif, cree_par_id, cree_le, maj_le)
select
  reprise.uid(e.id), e.id, e.nom, e.description, e.fondateur, e.serie, e.site_internet, e.siret,
  e.video, e.logo_url, e.note, e.localisation, e.nb_employes, e.nb_techs,
  s.id,
  reprise.code('ref_product_type',    e.product_type)::ref.type_produit_entreprise,
  reprise.code('ref_company_type',    e.type_entreprise)::ref.type_entreprise,
  reprise.code('ref_niveau_anglais',  e.niveau_anglais)::ref.niveau_anglais,
  (select reprise.code('ref_remote', er.remote)::ref.rythme_remote
     from public.entreprise_remote er where er.entreprise_id = e.id limit 1),
  reprise.code('ref_statut_candidat', e.statut)::ref.statut_relation,
  sc.id,
  reprise.code('ref_formule',         e.formule)::ref.formule_mission,
  reprise.code('ref_form_41',         e.agence)::ref.form_concurrence,
  reprise.code('ref_form_42',         e.recommandation)::ref.form_provenance,
  e.success_fee_pct,
  case when e.success_fee_abs >= 1000 then e.success_fee_abs / 1000 else e.success_fee_abs end,
  coalesce(e.success_fee_is_absolute, false),
  coalesce(e.apport_affaires, false), e.apport_affaires_pct,
  coalesce(e.exclu, false), e.exclu_details,
  e.duree_exclusivite_semaines, e.nb_mois_garantie,
  case e.garantie when 'Remplacement' then 'remplacement' when 'Remboursement' then 'remboursement' end,
  case e.paiement  when 'Sign date'   then 'sign_date'    when 'Start date'    then 'start_date'    end,
  e.date_signature_contrat, e.date_fin_contrat, e.email_facturation, e.nom_structure_facturation,
  (select c.id from core.collaborateur c where c.id = reprise.uid(e.agent_en_charge_id)),
  true,
  (select c.id from core.collaborateur c where c.id = reprise.uid(e.created_by)),
  coalesce(e.created_at, now()), coalesce(e.updated_at, now())
from public.entreprise e
left join ref.secteur        s  on s.code  = reprise.code('ref_secteur', e.secteur)
left join ref.statut_contrat sc on sc.code = reprise.code('ref_contract_status', e.statut_contrat)
on conflict (id) do nothing;

select reprise.noter('01','core.entreprise',
  (select count(*) from public.entreprise),
  (select count(*) from core.entreprise), 0, null);

-- ---------------------------------------------------------------------
-- core.produit — 103, entreprise_id obligatoire et mesuré à 100 %
-- ---------------------------------------------------------------------

insert into core.produit (id, bubble_id, entreprise_id, description, texte_annonce,
                          maturite_id, cree_par_id, cree_le, maj_le)
select reprise.uid(p.id), p.id, reprise.uid(p.entreprise_id), p.description, p.txt_explicatif,
       m.id,
       (select c.id from core.collaborateur c where c.id = reprise.uid(p.created_by)),
       coalesce(p.created_at, now()), coalesce(p.updated_at, now())
from public.produit p
join core.entreprise e on e.id = reprise.uid(p.entreprise_id)
left join ref.maturite_produit m on m.code = reprise.code('ref_maturite_produit', p.maturite)
on conflict (id) do nothing;

select reprise.noter('01','core.produit',
  (select count(*) from public.produit),
  (select count(*) from core.produit),
  (select count(*) from public.produit p where not exists
     (select 1 from core.entreprise e where e.id = reprise.uid(p.entreprise_id))),
  'écartés : produits dont l''entreprise n''existe pas');
