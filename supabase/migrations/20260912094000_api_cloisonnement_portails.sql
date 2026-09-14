-- ═══════════════════════════════════════════════════════════════════════════
-- Cloisonner les vues `api` par portail. Trois fuites mesurées, pas déduites.
--
-- Sondées le 09/09/2026 avec de vrais jetons des comptes de COMPTES_DE_TEST.md :
--
--  1. UN COMPTE TALENT LIT LE NOM RÉEL DES CLIENTS. `api.mandat_client` rend
--     12 lignes à un talent — la policy `talent_offres_publiees` ouvre les
--     mandats publiés — et projette `titre`, qui est INTERNE :
--     « SantéVet - Lead PM », « N2J Soft - Product Manager ».
--     Or 11 des 12 offres publiées sont ANONYMES sur le job board.
--     C'est l'incident v_fuite_client rouvert par une autre porte.
--
--  2. UN COMPTE ENTREPRISE LIT LES PRÉTENTIONS SALARIALES DES CANDIDATS.
--     `api.kanban` rend 26, 93 et 223 lignes aux trois comptes clients de test,
--     avec `pretention_ke` renseigné et le libellé d'étape interne. Le ticket
--     J3 interdit explicitement les deux.
--
--  3. UN COMPTE TALENT ATTEINT `api.talent_recherche` et y lit sa fiche telle
--     que le cabinet la qualifie : est_qualifie, statut_relation, mindset, le
--     prénom de son référent. Exactement ce que `api.ma_fiche` avait été conçue
--     pour ne pas montrer.
--
-- LA CAUSE : `grant select on all tables in schema api to authenticated`. La
-- migration qui l'a posé le dit elle-même — « toute vue qu'on y crée est
-- lisible par tout compte connecté sans rien demander ».
--
-- POURQUOI LE CORRECTIF N'EST PAS UN GRANT : tous les comptes, quel que soit
-- leur portail, partagent le même rôle PostgreSQL `authenticated`. Il n'existe
-- pas de rôle par portail. Un GRANT ne peut donc PAS cloisonner ici — c'est une
-- erreur que j'ai faite avant de la mesurer. Le garde-fou va dans le WHERE des
-- vues, où `api.a_portail()` est évaluable : les vues sont en security_invoker,
-- la fonction est STABLE, le planificateur l'évalue une fois.
--
-- Ce qu'on garde du GRANT : on retire la clause ALTER DEFAULT PRIVILEGES, pour
-- qu'une vue FUTURE naisse fermée au lieu de naître ouverte.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. Une vue neuve ne sera plus lisible par défaut ────────────────────
alter default privileges in schema api revoke select on tables from authenticated;

-- ── 1. Le résidu `anon` sur `app` ───────────────────────────────────────
-- Posé quand `offre_publique` était en security_invoker. Elle est passée en
-- definer le 10/09 : ces droits n'ont plus d'objet, et laissent un visiteur
-- lire les lignes de publication (dont publie_par_compte_id, motif_retrait).
revoke select on app.mandat_publication from anon;
revoke usage on schema app from anon;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. PORTAIL TALENT
-- ═══════════════════════════════════════════════════════════════════════

-- `api.ma_fiche` n'avait AUCUN WHERE : elle s'en remettait entièrement à la
-- policy. Pour un compte interne, `interne_lecture` la fait donc rendre les
-- 7 023 fiches — mesuré. Une vue nommée « ma fiche » qui rend toute la base
-- est un piège pour le premier écran qui l'emploiera.
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
       -- ajouts en fin de liste : `create or replace view` ne sait qu'ajouter
       -- à la fin, jamais renommer ni réordonner (42P16).
       f.cv_depose_le,
       f.attentes_localisation_texte,
       mt.libelle_fr as attentes_metier,
       u.libelle_fr  as attentes_univers,
       f.champs_manquants,
       f.consentement_donne_le,
       f.actif,
       f.modifie_par_le_talent_le,
       (select array_agg(s.libelle_fr) from core.fiche_talent_secteur_nogo fn
          join ref.secteur s on s.id = fn.secteur_id where fn.fiche_talent_id = f.id) as secteurs_nogo,
       (select array_agg(cr.libelle_fr) from core.fiche_talent_critere fc
          join ref.critere cr on cr.id = fc.critere_id where fc.fiche_talent_id = f.id) as criteres
from core.fiche_talent f
left join ref.metier  mt on mt.id = f.attentes_metier_id
left join ref.univers u  on u.id  = f.attentes_univers_id
where f.id = api.ma_fiche_talent();

comment on view api.ma_fiche is
  'La fiche que le talent voit et modifie — LA SIENNE, et une seule. N''expose ni la qualification du cabinet, ni les appréciations, ni le référent.';

-- `api.ma_candidature` projetait `m.titre`, le titre INTERNE : un candidat y
-- lisait le nom du client d'une offre anonyme. Remplacé par le libellé public
-- de la publication, avec repli sur le métier — jamais sur le titre interne.
create or replace view api.ma_candidature with (security_invoker = true) as
select c.id,
       coalesce(p.libelle_public, mt.libelle_fr, 'Poste') as poste,
       case when m.est_anonyme then null else e.nom end as entreprise,
       ep.emoji || ' ' || ep.libelle_talent as etape,
       ep.est_terminale, c.date_entree_pipeline, c.date_prochaine_echeance,
       -- ajouts en fin de liste
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
where api.a_portail('talent')
  and c.fiche_talent_id = api.ma_fiche_talent();

comment on view api.ma_candidature is
  'Où en est MA candidature. Libellé d''étape en registre talent. Le titre interne du mandat n''est pas projeté : il nomme le client d''une offre anonyme.';

-- ═══════════════════════════════════════════════════════════════════════
-- 3. PORTAIL ENTREPRISE
-- ═══════════════════════════════════════════════════════════════════════

-- Renommage `titre` → `intitule` : `create or replace` refuse (42P16).
drop view if exists api.mandat_client;

create view api.mandat_client with (security_invoker = true) as
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
       -- ce que le client voit RÉELLEMENT de son pipeline : les autres
       -- compteurs disent la vérité du cabinet, celui-ci dit la sienne.
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
where api.a_portail('entreprise')
  and m.entreprise_id in (select api.mes_entreprises());

comment on view api.mandat_client is
  'Les mandats de MON entreprise. Le titre interne ne sort que vers le client qui en est propriétaire, et seulement faute de libellé public.';

-- `api.candidature_client` ne filtrait NI le portail NI l''étape : le ticket J3
-- exige que les étapes antérieures au send-out rendent zéro ligne. Le filtre
-- n''existait nulle part.
create or replace view api.candidature_client with (security_invoker = true) as
select c.id, c.mandat_id, c.reference_pseudonyme,
       ep.emoji || ' ' || ep.libelle_client as etape,
       c.argumentaire_client, c.date_entree_pipeline,
       -- ajouts en fin de liste
       ep.code as etape_code, ep.ordre as etape_ordre,
       ep.couleur_pastille as etape_couleur, ep.est_terminale, ep.est_ko,
       c.date_dernier_changement_etape, c.date_prochaine_echeance, c.presente_le
from core.candidature c
join ref.etape_process ep on ep.id = c.etape_id
where api.a_portail('entreprise')
  and ep.visible_client
  and c.entreprise_id in (select api.mes_entreprises());

comment on view api.candidature_client is
  'Ce qu''un client voit d''une candidature : le pseudonyme, l''étape en registre client, l''argumentaire. Les étapes d''amont ne sortent pas — six étapes sur quatorze sont visibles.';

-- ═══════════════════════════════════════════════════════════════════════
-- 4. PORTAILS INTERNES
-- ═══════════════════════════════════════════════════════════════════════

create or replace view api.talent_recherche with (security_invoker = true) as
select f.id, f.prenom, f.nom, f.email_personnel, f.telephone, f.url_linkedin,
       f.localisation_texte, f.est_qualifie, f.mindset::text, f.statut_relation::text,
       f.attentes_salaire_min_ke, f.attentes_salaire_max_ke,
       f.poste_actuel_employeur, mt.libelle_fr as metier_actuel, u.libelle_fr as univers,
       k.prenom as referent,
       (select array_agg(x.libelle_fr) from core.fiche_talent_expertise fe
          join ref.expertise x on x.id = fe.expertise_id where fe.fiche_talent_id = f.id) as expertises,
       (select count(*) from core.candidature c where c.fiche_talent_id = f.id) as candidatures,
       -- ajouts en fin de liste
       f.photo_url, f.cv_url, f.score_completude, f.seniorite::text,
       f.niveau_anglais::text, f.recherche_active, f.attentes_tjm_min_eur,
       f.attentes_tjm_max_eur, f.date_dernier_contact, f.emoji_statut
from core.fiche_talent f
left join ref.metier mt on mt.id = f.poste_actuel_metier_id
left join ref.univers u on u.id = f.univers_id
left join core.collaborateur k on k.id = f.agent_referent_id
where f.actif
  and (api.a_portail('recruteur') or api.a_portail('backoffice'));

comment on view api.talent_recherche is
  'Le vivier, vu du poste recruteur. Portails internes SEULEMENT : un talent y lisait sa propre qualification cabinet.';

create or replace view api.kanban with (security_invoker = true) as
select c.mandat_id, ep.ordre, ep.emoji || ' ' || ep.libelle_interne as etape,
       c.id as candidature_id, f.prenom, f.nom, c.salaire_min_ke as pretention_ke,
       c.date_dernier_changement_etape,
       -- ajouts en fin de liste
       ep.code as etape_code, ep.couleur_pastille as etape_couleur,
       ep.est_ko, ep.est_terminale, c.reference_pseudonyme, c.presente_le,
       c.date_prochaine_echeance, c.salaire_souhaite_ke, f.photo_url,
       c.appreciation_like::text, f.id as fiche_talent_id
from core.candidature c
join ref.etape_process ep on ep.id = c.etape_id
left join core.fiche_talent f on f.id = c.fiche_talent_id
where ep.visible_interne
  and (api.a_portail('recruteur') or api.a_portail('backoffice'));

comment on view api.kanban is
  'Le pipeline d''un mandat, vu de l''intérieur. Portails internes SEULEMENT : un compte entreprise y lisait les prétentions salariales et le vocabulaire interne.';

-- ── 5. Les droits, réaccordés explicitement ─────────────────────────────
-- `drop view` a emporté ceux de mandat_client ; les autres sont intacts, mais
-- on les nomme pour qu'un lecteur sache que la liste est voulue.
grant select on api.moi, api.offre_publique, api.offre_detail,
                api.ma_fiche, api.ma_candidature,
                api.mandat_client, api.candidature_client,
                api.talent_recherche, api.kanban
  to authenticated;
grant select on api.offre_publique, api.offre_detail to anon;
