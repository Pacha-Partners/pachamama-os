-- ═══════════════════════════════════════════════════════════════════════════
-- « Identité & contact de l'Account Manager » est une feature must du portail
-- entreprise. Mesuré : `api.mandat_client.agent_nom` rend NULL sur les 7
-- mandats du compte de test.
--
-- Cause : aucune policy client sur `core.collaborateur`. La jointure de la vue
-- ne rend rien, silencieusement — un LEFT JOIN sur une table fermée par RLS ne
-- lève pas d'erreur, il rend NULL. C'est le mode d'échec le plus traître de ce
-- modèle, et le troisième que cette série de migrations rencontre.
--
-- Ce qu'on ouvre est étroit : le collaborateur qui suit MON entreprise ou MES
-- mandats. Pas l'annuaire. Et l'identité d'un agent est déjà publique sur le
-- job board (`api.offre_detail` projette agent_nom et agent_photo pour anon).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function api.mes_agents_client() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct k
    from (
      select e.account_manager_id as k
        from core.entreprise e
       where e.id in (select api.mes_entreprises())
      union all
      select unnest(array[m.account_manager_id, m.agent_en_charge_id, m.agent_2_id])
        from core.mandat m
       where m.entreprise_id in (select api.mes_entreprises())
    ) t
   where k is not null;
$$;
revoke execute on function api.mes_agents_client() from public, anon;
grant  execute on function api.mes_agents_client() to authenticated, service_role;
comment on function api.mes_agents_client() is
  'Les collaborateurs Pachamama qui suivent le client courant : l''AM de son entreprise, et les agents de ses mandats. DEFINER pour ne pas dépendre d''une policy de core.collaborateur qui n''existe pas.';

create policy client_ses_agents on core.collaborateur
  for select to authenticated
  using (id in (select api.mes_agents_client()));

comment on policy client_ses_agents on core.collaborateur is
  'Le client voit qui s''occupe de lui, pas l''annuaire du cabinet.';

-- ── Symétrie côté talent : l'agent référent de sa fiche ────────────────
-- Le cadrage ne l'exige pas, mais la fiche du talent porte `agent_referent_id`
-- et l'espace talent affichera « votre interlocuteur ». Même étroitesse.
create or replace function api.mon_agent_talent() returns uuid
language sql stable security definer set search_path = '' as $$
  select f.agent_referent_id from core.fiche_talent f
   where f.id = api.ma_fiche_talent();
$$;
revoke execute on function api.mon_agent_talent() from public, anon;
grant  execute on function api.mon_agent_talent() to authenticated, service_role;

create policy talent_son_agent on core.collaborateur
  for select to authenticated
  using (id = api.mon_agent_talent());
