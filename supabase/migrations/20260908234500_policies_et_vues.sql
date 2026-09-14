-- =====================================================================
-- LES POLICIES ET LES VUES — CE QUI REND LE MODÈLE UTILISABLE
--
-- Deux mécanismes qui ne font pas la même chose, et c'est important :
--   · la POLICY choisit les LIGNES qu'un appelant peut voir ;
--   · la VUE choisit les COLONNES qu'elle lui montre.
-- Une candidate voit sa candidature (policy) mais pas l'appréciation
-- qu'un recruteur y a écrite (vue). Les deux sont nécessaires.
-- =====================================================================

-- ---------------------------------------------------------------------
-- LE PORTAIL INTERNE — les 42 collaborateurs voient le métier
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'entreprise','contact_client','mandat_contact_client','produit','tag',
    'fiche_talent','fiche_talent_background','fiche_talent_profil','fiche_talent_expertise',
    'fiche_talent_secteur_xp','fiche_talent_secteur_vise','fiche_talent_secteur_nogo',
    'fiche_talent_critere','fiche_talent_contrat_souhaite','fiche_talent_remote_souhaite',
    'fiche_talent_produit_xp','fiche_talent_tag','fiche_talent_poste','talent',
    'mandat','mandat_cible','mandat_remote','mandat_secteur_nogo','mandat_tag_job',
    'candidature','analyse','placement','placement_utilisateur','repartition_commission',
    'note','tache','collaborateur','collaborateur_univers','apporteur_affaires','enquete_nps']
  loop
    execute format(
      'create policy interne_lecture on core.%I for select to authenticated using (api.est_interne())', t);
  end loop;
end $$;

-- L'écriture interne : tout sauf la projection, qui reste en lecture seule.
do $$
declare t text;
begin
  foreach t in array array[
    'entreprise','contact_client','mandat_contact_client','produit','tag','fiche_talent',
    'fiche_talent_background','fiche_talent_profil','fiche_talent_expertise',
    'fiche_talent_secteur_xp','fiche_talent_secteur_vise','fiche_talent_secteur_nogo',
    'fiche_talent_critere','fiche_talent_contrat_souhaite','fiche_talent_remote_souhaite',
    'fiche_talent_produit_xp','fiche_talent_tag','fiche_talent_poste',
    'mandat','mandat_cible','mandat_remote','mandat_secteur_nogo','mandat_tag_job',
    'candidature','analyse','placement','placement_utilisateur','repartition_commission',
    'note','tache','apporteur_affaires','enquete_nps']
  loop
    execute format(
      'create policy interne_ecriture on core.%I for all to authenticated using (api.est_interne()) with check (api.est_interne())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- LE PORTAIL TALENT — sa fiche, ses satellites, ses candidatures
--
-- Il ne voit JAMAIS les notes écrites sur lui : aucune policy talent sur
-- core.note. C'est la raison d'être de la Décision 4.
-- ---------------------------------------------------------------------

create policy talent_sa_fiche on core.fiche_talent
  for select to authenticated using (id = api.ma_fiche_talent());
create policy talent_maj_sa_fiche on core.fiche_talent
  for update to authenticated using (id = api.ma_fiche_talent()) with check (id = api.ma_fiche_talent());

do $$
declare t text;
begin
  foreach t in array array[
    'fiche_talent_background','fiche_talent_profil','fiche_talent_expertise',
    'fiche_talent_secteur_xp','fiche_talent_secteur_vise','fiche_talent_secteur_nogo',
    'fiche_talent_critere','fiche_talent_contrat_souhaite','fiche_talent_remote_souhaite',
    'fiche_talent_produit_xp','fiche_talent_poste']
  loop
    execute format(
      'create policy talent_ses_satellites on core.%I for all to authenticated
         using (fiche_talent_id = api.ma_fiche_talent())
         with check (fiche_talent_id = api.ma_fiche_talent())', t);
  end loop;
end $$;

create policy talent_ses_candidatures on core.candidature
  for select to authenticated using (fiche_talent_id = api.ma_fiche_talent());

-- Les offres publiées sont visibles de tout talent connecté.
create policy talent_offres_publiees on core.mandat
  for select to authenticated using (
    api.ma_fiche_talent() is not null
    and exists (select 1 from app.mandat_publication p
                 where p.mandat_id = core.mandat.id and p.retire_le is null));

-- ---------------------------------------------------------------------
-- LE PORTAIL ENTREPRISE — ses mandats, et les candidatures qui s'y rattachent
-- ---------------------------------------------------------------------

create policy client_son_entreprise on core.entreprise
  for select to authenticated using (id in (select api.mes_entreprises()));

create policy client_ses_mandats on core.mandat
  for select to authenticated using (entreprise_id in (select api.mes_entreprises()));

create policy client_ses_candidatures on core.candidature
  for select to authenticated using (
    mandat_id in (select m.id from core.mandat m where m.entreprise_id in (select api.mes_entreprises())));

create policy client_ses_contacts on core.contact_client
  for select to authenticated using (entreprise_id in (select api.mes_entreprises()));

-- ---------------------------------------------------------------------
-- app : chacun voit SON compte et SES accès, rien d'autre.
-- Le journal et l'idempotence restent hors de portée : aucune policy.
-- ---------------------------------------------------------------------

create policy son_compte on app.compte
  for select to authenticated using (id = api.compte_id());
create policy ses_acces on app.acces
  for select to authenticated using (compte_id = api.compte_id());
create policy publication_interne on app.mandat_publication
  for all to authenticated using (api.est_interne()) with check (api.est_interne());
create policy publication_lecture on app.mandat_publication
  for select to authenticated using (retire_le is null);
create policy transition_interne on app.transition_etape
  for all to authenticated using (api.est_interne()) with check (api.est_interne());

-- =====================================================================
-- LES VUES — toutes en security_invoker, pour que la RLS s'applique à
-- l'APPELANT et non au propriétaire de la vue.
-- =====================================================================

create or replace view api.moi with (security_invoker = true) as
select api.compte_id() as compte_id,
       api.est_interne() as est_interne,
       api.role_interne() as role_interne,
       api.ma_fiche_talent() as fiche_talent_id,
       (select array_agg(e) from api.mes_entreprises() e) as entreprise_ids;
comment on view api.moi is 'Qui suis-je et que puis-je voir. Le premier appel de toute session.';

-- ── le job board public
create or replace view api.offre with (security_invoker = true) as
select p.id as publication_id, m.id as mandat_id,
       coalesce(p.libelle_public, m.titre) as intitule,
       case when m.est_anonyme then null else e.nom end as entreprise,
       coalesce(p.salaire_affiche,
                nullif(concat_ws('–', m.salaire_min_ke, m.salaire_max_ke),'')) as salaire,
       u.libelle_fr as univers, mt.libelle_fr as metier,
       m.localisation, m.contrat::text, m.description, m.missions, m.pour_toi,
       (select array_agg(tj.emoji || ' ' || tj.libelle_fr order by tj.ordre)
          from core.mandat_tag_job x join ref.tag_job tj on tj.id = x.tag_job_id
         where x.mandat_id = m.id) as tags,
       p.publie_le
from app.mandat_publication p
join core.mandat m on m.id = p.mandat_id
left join core.entreprise e on e.id = m.entreprise_id
left join ref.univers u on u.id = m.univers_id
left join ref.metier mt on mt.id = m.metier_id
where p.retire_le is null;
comment on view api.offre is 'Le job board. Une offre y est parce qu''un ACTE de publication existe, jamais parce que des drapeaux s''alignent.';

-- ── le portail talent : sa fiche, sans rien de ce que le cabinet pense de lui
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
          join ref.secteur s on s.id = fs.secteur_id where fs.fiche_talent_id = f.id) as secteurs_vises
from core.fiche_talent f;
comment on view api.ma_fiche is 'La fiche que le talent voit et modifie. N''expose NI la qualification du cabinet, NI les appréciations, NI le référent.';

create or replace view api.ma_candidature with (security_invoker = true) as
select c.id, m.titre as poste,
       case when m.est_anonyme then null else e.nom end as entreprise,
       ep.emoji || ' ' || coalesce(ep.libelle_talent, ep.libelle_interne) as etape,
       ep.est_terminale, c.date_entree_pipeline, c.date_prochaine_echeance
from core.candidature c
left join core.mandat m on m.id = c.mandat_id
left join core.entreprise e on e.id = m.entreprise_id
left join ref.etape_process ep on ep.id = c.etape_id;
comment on view api.ma_candidature is 'Où en est ma candidature. Le compte rendu, les appréciations et les points faibles ne sont PAS exposés — ils appartiennent au cabinet.';

-- ── le portail entreprise : ses mandats et les candidats présentés
create or replace view api.mandat_client with (security_invoker = true) as
select m.id, m.titre, m.statut::text, u.libelle_fr as univers, mt.libelle_fr as metier,
       m.salaire_min_ke, m.salaire_max_ke, m.localisation, m.kickoff_le,
       (select count(*) from core.candidature c where c.mandat_id = m.id) as candidatures,
       (select count(*) from core.candidature c join ref.etape_process x on x.id = c.etape_id
         where c.mandat_id = m.id and not x.est_ko) as en_cours
from core.mandat m
left join ref.univers u on u.id = m.univers_id
left join ref.metier mt on mt.id = m.metier_id;

create or replace view api.candidature_client with (security_invoker = true) as
select c.id, c.mandat_id, c.reference_pseudonyme,
       ep.emoji || ' ' || coalesce(ep.libelle_client, ep.libelle_interne) as etape,
       c.argumentaire_client, c.date_entree_pipeline
from core.candidature c
left join ref.etape_process ep on ep.id = c.etape_id;
comment on view api.candidature_client is 'Ce qu''un client voit d''une candidature : le pseudonyme, l''étape et l''argumentaire. Jamais l''identité du talent tant qu''elle n''est pas révélée.';

-- ── le poste recruteur : la recherche de talents
create or replace view api.talent_recherche with (security_invoker = true) as
select f.id, f.prenom, f.nom, f.email_personnel, f.telephone, f.url_linkedin,
       f.localisation_texte, f.est_qualifie, f.mindset::text, f.statut_relation::text,
       f.attentes_salaire_min_ke, f.attentes_salaire_max_ke,
       f.poste_actuel_employeur, mt.libelle_fr as metier_actuel, u.libelle_fr as univers,
       k.prenom as referent,
       (select array_agg(x.libelle_fr) from core.fiche_talent_expertise fe
          join ref.expertise x on x.id = fe.expertise_id where fe.fiche_talent_id = f.id) as expertises,
       (select count(*) from core.candidature c where c.fiche_talent_id = f.id) as candidatures
from core.fiche_talent f
left join ref.metier mt on mt.id = f.poste_actuel_metier_id
left join ref.univers u on u.id = f.univers_id
left join core.collaborateur k on k.id = f.agent_referent_id
where f.actif;

create or replace view api.kanban with (security_invoker = true) as
select c.mandat_id, ep.ordre, ep.emoji || ' ' || ep.libelle_interne as etape,
       c.id as candidature_id, f.prenom, f.nom, c.salaire_min_ke as pretention_ke,
       c.date_dernier_changement_etape
from core.candidature c
join ref.etape_process ep on ep.id = c.etape_id
left join core.fiche_talent f on f.id = c.fiche_talent_id;
comment on view api.kanban is 'Le pipeline d''un mandat, trié par l''ordre du référentiel d''étapes.';

grant select on all tables in schema api to authenticated;
grant select on api.offre to anon;
alter default privileges in schema api grant select on tables to authenticated;
