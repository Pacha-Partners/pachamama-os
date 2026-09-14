-- ═══════════════════════════════════════════════════════════════════════════
-- Rendre les vues cloisonnées auditables par la clé de service.
--
-- La garde `api.a_portail(...)` posée à la migration précédente ferme aussi la
-- vue à `service_role` : `auth.uid()` est nul, donc `api.compte_id()` l'est,
-- donc la garde est fausse. Or la définition de « fini » d'un jalon
-- (docs/DECOUPAGE_PHASE2.md) exige un test qui « compare le résultat obtenu
-- avec le jeton de l'utilisateur au résultat obtenu avec la clé de service ».
-- Sans référence, il n'y a pas de comparaison possible.
--
-- Ce n'est pas une réouverture : `service_role` contourne déjà la RLS et lit
-- les tables de `core` directement. On lui rend seulement la vue, pour que
-- l'audit porte sur l'objet qu'on veut auditer.
--
-- `auth.role()` est encapsulé dans un `(select ...)` : PostgreSQL évalue alors
-- l'expression une fois par requête au lieu d'une fois par ligne.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function api.est_service() returns boolean
language sql stable security invoker set search_path = '' as $$
  select coalesce(current_setting('request.jwt.claim.role', true),
                  (current_setting('request.jwt.claims', true)::jsonb ->> 'role')) = 'service_role';
$$;
revoke execute on function api.est_service() from public, anon;
grant  execute on function api.est_service() to authenticated, service_role;
comment on function api.est_service() is
  'Vrai pour la clé de service. Sert UNIQUEMENT à rendre les vues cloisonnées auditables : service_role lit déjà les tables de core sans passer par elles.';

create or replace view api.mandat_client with (security_invoker = true) as
select m.id,
       coalesce(p.libelle_public, m.titre) as intitule,
       m.statut::text,
       u.libelle_fr as univers, mt.libelle_fr as metier, m.contrat::text,
       m.salaire_min_ke, m.salaire_max_ke, m.tjm_min_eur, m.tjm_max_eur,
       m.localisation, m.kickoff_le, m.cree_le, m.est_anonyme,
       (p.id is not null) as est_publie,
       (select count(*) from core.candidature c where c.mandat_id = m.id) as candidatures,
       (select count(*) from core.candidature c join ref.etape_process x on x.id = c.etape_id
         where c.mandat_id = m.id and not x.est_ko) as en_cours,
       (select count(*) from core.candidature c join ref.etape_process x on x.id = c.etape_id
         where c.mandat_id = m.id and x.visible_client) as presentes,
       k.prenom || ' ' || k.nom as agent_nom, k.photo_url as agent_photo,
       k.fonction::text as agent_fonction
from core.mandat m
left join ref.univers u on u.id = m.univers_id
left join ref.metier mt on mt.id = m.metier_id
left join app.mandat_publication p
       on p.mandat_id = m.id and p.retire_le is null and p.canal = 'job_board_public'
left join core.entreprise e on e.id = m.entreprise_id
left join core.collaborateur k on k.id = coalesce(m.account_manager_id, e.account_manager_id)
where (select api.est_service())
   or (api.a_portail('entreprise') and m.entreprise_id in (select api.mes_entreprises()));

create or replace view api.candidature_client with (security_invoker = true) as
select c.id, c.mandat_id, c.reference_pseudonyme,
       ep.emoji || ' ' || ep.libelle_client as etape,
       c.argumentaire_client, c.date_entree_pipeline,
       ep.code as etape_code, ep.ordre as etape_ordre,
       ep.couleur_pastille as etape_couleur, ep.est_terminale, ep.est_ko,
       c.date_dernier_changement_etape, c.date_prochaine_echeance, c.presente_le
from core.candidature c
join ref.etape_process ep on ep.id = c.etape_id
where ep.visible_client
  and ((select api.est_service())
       or (api.a_portail('entreprise') and c.entreprise_id in (select api.mes_entreprises())));

create or replace view api.kanban with (security_invoker = true) as
select c.mandat_id, ep.ordre, ep.emoji || ' ' || ep.libelle_interne as etape,
       c.id as candidature_id, f.prenom, f.nom, c.salaire_min_ke as pretention_ke,
       c.date_dernier_changement_etape,
       ep.code as etape_code, ep.couleur_pastille as etape_couleur,
       ep.est_ko, ep.est_terminale, c.reference_pseudonyme, c.presente_le,
       c.date_prochaine_echeance, c.salaire_souhaite_ke, f.photo_url,
       c.appreciation_like::text, f.id as fiche_talent_id
from core.candidature c
join ref.etape_process ep on ep.id = c.etape_id
left join core.fiche_talent f on f.id = c.fiche_talent_id
where ep.visible_interne
  and ((select api.est_service())
       or api.a_portail('recruteur') or api.a_portail('backoffice'));

create or replace view api.talent_recherche with (security_invoker = true) as
select f.id, f.prenom, f.nom, f.email_personnel, f.telephone, f.url_linkedin,
       f.localisation_texte, f.est_qualifie, f.mindset::text, f.statut_relation::text,
       f.attentes_salaire_min_ke, f.attentes_salaire_max_ke,
       f.poste_actuel_employeur, mt.libelle_fr as metier_actuel, u.libelle_fr as univers,
       k.prenom as referent,
       (select array_agg(x.libelle_fr) from core.fiche_talent_expertise fe
          join ref.expertise x on x.id = fe.expertise_id where fe.fiche_talent_id = f.id) as expertises,
       (select count(*) from core.candidature c where c.fiche_talent_id = f.id) as candidatures,
       f.photo_url, f.cv_url, f.score_completude, f.seniorite::text,
       f.niveau_anglais::text, f.recherche_active, f.attentes_tjm_min_eur,
       f.attentes_tjm_max_eur, f.date_dernier_contact, f.emoji_statut
from core.fiche_talent f
left join ref.metier mt on mt.id = f.poste_actuel_metier_id
left join ref.univers u on u.id = f.univers_id
left join core.collaborateur k on k.id = f.agent_referent_id
where f.actif
  and ((select api.est_service())
       or api.a_portail('recruteur') or api.a_portail('backoffice'));

create or replace view api.ma_candidature with (security_invoker = true) as
select c.id,
       coalesce(p.libelle_public, mt.libelle_fr, 'Poste') as poste,
       case when m.est_anonyme then null else e.nom end as entreprise,
       ep.emoji || ' ' || ep.libelle_talent as etape,
       ep.est_terminale, c.date_entree_pipeline, c.date_prochaine_echeance,
       c.mandat_id, ep.code as etape_code, ep.ordre as etape_ordre,
       ep.couleur_pastille as etape_couleur, ep.est_ko,
       c.retire_par_talent_le, c.date_dernier_changement_etape
from core.candidature c
left join core.mandat m on m.id = c.mandat_id
left join core.entreprise e on e.id = m.entreprise_id
left join ref.metier mt on mt.id = m.metier_id
left join ref.etape_process ep on ep.id = c.etape_id
left join app.mandat_publication p
       on p.mandat_id = m.id and p.retire_le is null and p.canal = 'job_board_public'
where (select api.est_service())
   or (api.a_portail('talent') and c.fiche_talent_id = api.ma_fiche_talent());

create or replace view api.ma_fiche with (security_invoker = true) as
select f.id, f.prenom, f.nom, f.email_personnel, f.telephone, f.url_linkedin,
       f.localisation_texte, f.cv_url, f.portfolio_url, f.photo_url,
       f.mindset::text, f.niveau_anglais::text, f.recherche_active,
       f.attentes_salaire_min_ke, f.attentes_salaire_max_ke,
       f.attentes_tjm_min_eur, f.attentes_tjm_max_eur,
       f.attentes_disponibilite_texte, f.attentes_description,
       f.fiche_complete, f.score_completude,
       (select array_agg(x.libelle_fr) from core.fiche_talent_expertise fe
          join ref.expertise x on x.id = fe.expertise_id where fe.fiche_talent_id = f.id) as expertises,
       (select array_agg(s.libelle_fr) from core.fiche_talent_secteur_vise fs
          join ref.secteur s on s.id = fs.secteur_id where fs.fiche_talent_id = f.id) as secteurs_vises,
       f.cv_depose_le, f.attentes_localisation_texte,
       mt.libelle_fr as attentes_metier, u.libelle_fr as attentes_univers,
       f.champs_manquants, f.consentement_donne_le, f.actif,
       f.modifie_par_le_talent_le,
       (select array_agg(s.libelle_fr) from core.fiche_talent_secteur_nogo fn
          join ref.secteur s on s.id = fn.secteur_id where fn.fiche_talent_id = f.id) as secteurs_nogo,
       (select array_agg(cr.libelle_fr) from core.fiche_talent_critere fc
          join ref.critere cr on cr.id = fc.critere_id where fc.fiche_talent_id = f.id) as criteres
from core.fiche_talent f
left join ref.metier  mt on mt.id = f.attentes_metier_id
left join ref.univers u  on u.id  = f.attentes_univers_id
where (select api.est_service()) or f.id = api.ma_fiche_talent();

grant select on api.ma_fiche, api.ma_candidature, api.mandat_client,
                api.candidature_client, api.talent_recherche, api.kanban
  to authenticated, service_role;
