-- ═══════════════════════════════════════════════════════════════════════════
-- Le talent voit l'équipe DU MANDAT, pas seulement son agent référent.
--
-- Retour du commanditaire, en deux temps : « on n'affiche pas le ou les
-- recruteurs, alors qu'ils sont plus actifs en général que l'Account Manager »,
-- puis la précision qui change tout : « l'agent, ce n'est pas sur le candidat
-- mais sur le Mandat ».
--
-- ── CE QUE L'ÉCRAN MONTRAIT, ET POURQUOI C'ÉTAIT LE MAUVAIS OBJET ───────
-- `api.ma_candidature_detail` joignait `core.fiche_talent.agent_referent_id` :
-- l'agent qui suit LA PERSONNE, dans l'absolu. La carte s'intitule pourtant
-- « Qui suit cette candidature » — donc l'équipe DU PROCESS, qui vit sur
-- `core.mandat`.
--
-- ── MESURÉ AVANT D'ÉCRIRE ──────────────────────────────────────────────
--   candidatures                                  7 236
--   dont la fiche porte un agent référent         3 050  (42,2 %)
--   mandats                                         533
--   dont un 1er recruteur (agent_en_charge_id)      475  (89,1 %)
--   dont un 2e recruteur (agent_2_id)                25  ( 4,7 %)
--   dont un Account Manager                         402  (75,4 %)
-- La carte était donc vide pour près de six candidatures sur dix, alors que le
-- mandat porte un recruteur neuf fois sur dix. Le commanditaire a raison sur
-- les deux points : mauvais objet, et le mieux renseigné est le recruteur.
--
-- ── ⚠ LE DROIT N'ÉTAIT PAS OUVERT, ET IL AURAIT ÉCHOUÉ EN SILENCE ──────
-- `talent_son_agent` (migration 098000) n'ouvre QUE `id = mon_agent_talent()`,
-- l'agent référent de la fiche. Ajouter les jointures sans toucher à la policy
-- aurait rendu NULL sur toutes les lignes — une LEFT JOIN sur une table fermée
-- par RLS ne lève pas, elle rend NULL. C'est la cinquième fois que ce projet
-- rencontre ce piège ; on ouvre donc le droit AVANT d'ouvrir la porte.
--
-- ── CE QUI SORT, ET CE QUI NE SORT PAS ─────────────────────────────────
-- Prénom, nom, photo, fonction. Pas d'adresse électronique : le talent a un
-- point d'entrée, son interlocuteur, et un recruteur joignable en direct serait
-- un canal parallèle que personne n'a décidé d'ouvrir. Même règle que côté
-- client (migration 180000).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Le droit : les collaborateurs des mandats où je suis en process ──
create or replace function api.mes_agents_talent() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct k
    from (
      select unnest(array[m.account_manager_id, m.agent_en_charge_id, m.agent_2_id]) as k
        from core.candidature c
        join core.mandat m on m.id = c.mandat_id
       where c.fiche_talent_id = (select api.ma_fiche_talent())
    ) t
   where k is not null;
$$;
revoke execute on function api.mes_agents_talent() from public, anon;
grant  execute on function api.mes_agents_talent() to authenticated, service_role;
comment on function api.mes_agents_talent() is
  'Les collaborateurs Pachamama attachés aux MANDATS où le talent courant est en process : leur AM et leurs un ou deux recruteurs. DEFINER, pour ne pas dépendre d''une policy de core.mandat côté talent — le talent n''a aucun droit de lecture sur les mandats en tant que tels.';

-- La policy existante `talent_son_agent` reste : l'agent référent de la fiche
-- garde sa raison d'être sur « Mon espace », où la carte parle de la PERSONNE
-- et non d'un process. Les deux policies sont permissives, donc elles
-- s'additionnent.
drop policy if exists talent_agents_de_ses_mandats on core.collaborateur;
create policy talent_agents_de_ses_mandats on core.collaborateur
  for select to authenticated
  using (id in (select api.mes_agents_talent()));

comment on policy talent_agents_de_ses_mandats on core.collaborateur is
  'Le talent voit qui travaille sur les mandats où il est en process. Pas l''annuaire du cabinet : la liste est bornée à ses propres candidatures.';

-- ── 2. La porte : les colonnes, ajoutées EN FIN de vue ──────────────────
-- ⚠ `create or replace view` ne sait ni renommer, ni réordonner, ni retirer une
-- colonne (42P16). On ne peut qu'ajouter, et à la fin. La liste ci-dessous
-- reprend donc la vue à l'identique, aux six dernières lignes près.
create or replace view api.ma_candidature_detail with (security_invoker = true) as
select c.id,
       c.mandat_id,
       c.reference_pseudonyme,
       coalesce(p.libelle_public, mt.libelle_fr, 'Poste') as poste,
       case when m.est_anonyme then null else e.nom end       as entreprise,
       case when m.est_anonyme then null else e.logo_url end  as entreprise_logo,
       m.est_anonyme,
       ep.emoji || ' ' || ep.libelle_talent as etape,
       ep.code    as etape_code,
       ep.ordre   as etape_ordre,
       ep.couleur_pastille as etape_couleur,
       ep.est_ko, ep.est_terminale,
       c.est_spontanee,
       c.date_entree_pipeline,
       c.date_dernier_changement_etape,
       c.date_prochaine_echeance,
       c.presente_le,
       c.retire_par_talent_le,
       c.motif_retrait,
       mko.libelle_fr as motif_retrait_libelle,
       c.cree_le,
       -- L'agent référent de la FICHE : qui suit la personne, hors process.
       k.prenom    as agent_prenom,
       k.nom       as agent_nom,
       k.photo_url as agent_photo,
       k.fonction  as agent_fonction,
       m.missions        as mandat_missions,
       m.pour_toi        as mandat_pour_toi,
       m.pas_pour_toi    as mandat_pas_pour_toi,
       m.remote_infos    as mandat_remote,
       m.salaire_infos   as mandat_salaire_infos,
       m.salaire_min_ke  as mandat_salaire_min_ke,
       m.salaire_max_ke  as mandat_salaire_max_ke,
       m.tjm_min_eur     as mandat_tjm_min_eur,
       m.tjm_max_eur     as mandat_tjm_max_eur,
       m.contrat::text   as mandat_contrat,
       m.localisation    as mandat_localisation,
       um.libelle_fr     as mandat_univers,
       p.salaire_affiche          as mandat_salaire_affiche,
       p.mode_de_travail_affiche  as mandat_remote_affiche,
       (p.id is not null) as offre_encore_publiee,
       -- ── ce que cette migration ajoute : l'équipe DU MANDAT ────────────
       -- L'ordre des colonnes dit l'ordre d'affichage voulu : les recruteurs
       -- d'abord, ce sont eux qui font avancer le process.
       r1.prenom    as recruteur_prenom,
       r1.nom       as recruteur_nom,
       r1.photo_url as recruteur_photo,
       r1.fonction  as recruteur_fonction,
       r2.prenom    as recruteur_2_prenom,
       r2.nom       as recruteur_2_nom,
       r2.photo_url as recruteur_2_photo,
       r2.fonction  as recruteur_2_fonction,
       am.prenom    as mandat_am_prenom,
       am.nom       as mandat_am_nom,
       am.photo_url as mandat_am_photo,
       am.fonction  as mandat_am_fonction
from core.candidature c
left join core.mandat    m  on m.id = c.mandat_id
left join core.entreprise e on e.id = m.entreprise_id
left join ref.metier     mt on mt.id = m.metier_id
left join ref.univers    um on um.id = m.univers_id
left join ref.etape_process ep on ep.id = c.etape_id
left join ref.motif_ko   mko on mko.code = c.motif_retrait and mko.categorie = 'candidat'
left join app.mandat_publication p
       on p.mandat_id = m.id and p.retire_le is null and p.canal = 'job_board_public'
left join core.fiche_talent f on f.id = c.fiche_talent_id
left join core.collaborateur k  on k.id  = f.agent_referent_id
left join core.collaborateur r1 on r1.id = m.agent_en_charge_id
left join core.collaborateur r2 on r2.id = m.agent_2_id
left join core.collaborateur am on am.id = coalesce(m.account_manager_id, e.account_manager_id)
where (select api.est_service())
   or (api.a_portail('talent') and c.fiche_talent_id = (select api.ma_fiche_talent()));

comment on view api.ma_candidature_detail is
  'Le détail d''UN process du talent courant : son étape en registre talent, le registre public du mandat, et l''équipe Pachamama qui le suit — les un ou deux recruteurs du mandat, son Account Manager, et l''agent référent de la fiche. Nom, photo et fonction seulement : aucune adresse, le talent passe par son interlocuteur.';

grant select on api.ma_candidature_detail to authenticated, service_role;
