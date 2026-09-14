-- ═══════════════════════════════════════════════════════════════════════════
-- Sortir la RLS IMBRIQUÉE des policies client — un défaut de PERFORMANCE qui
-- se présente comme un défaut de sécurité.
--
-- CE QUI A ÉTÉ MESURÉ, LE 12/09, AVEC DE VRAIS JETONS
--   GET api.candidature_client, jeton TALENT, Prefer: count=exact
--     → HTTP 500, code 57014, « canceling statement due to statement
--       timeout », après 8,2 s. Sur une vue censée rendre ZÉRO ligne.
--   POST api.rpc/decider_candidature, jeton ENTREPRISE
--     → même 57014, même 8 s.
-- Et `api.candidature_client` existe depuis le 12/09 au matin : ce n'est pas
-- une régression des vues de ce jalon, c'est un défaut qui dormait parce que
-- personne n'avait encore demandé un compte exact ni écrit une ligne.
--
-- LA CAUSE
-- `client_ses_candidatures` sur core.candidature s'écrivait :
--     mandat_id in (select m.id from core.mandat m
--                    where m.entreprise_id in (select api.mes_entreprises()))
-- La sous-requête interroge `core.mandat`, qui porte CINQ policies, dont
-- `talent_offres_publiees` qui fait un EXISTS sur `app.mandat_publication`,
-- elle-même sous RLS. PostgreSQL doit donc, pour CHACUNE des 7 236
-- candidatures, dérouler la RLS de core.mandat puis celle de
-- app.mandat_publication — et il le fait pour tous les comptes, y compris ceux
-- pour qui la policy est fausse d'avance, parce que les policies d'une table
-- sont un OR : aucune n'est écartée avant d'être évaluée.
--
-- LA RÉPONSE, DÉJÀ ÉCRITE DANS CE PROJET
-- D-12 : « api.mes_entreprises() est security definer pour cette raison
-- exacte ». Un DEFINER s'exécute avec les droits de son propriétaire, pour qui
-- la RLS ne s'applique pas : la cascade s'arrête net. Deux fonctions de plus,
-- de même nature — elles ne rendent RIEN que le compte ne possède déjà, et
-- rendent l'ensemble vide à un talent comme à un recruteur.
--
-- MESURÉ AVANT DE DIMENSIONNER : 25 mandats et 564 candidatures pour
-- l'entreprise la plus fournie, 112 candidatures au 95ᵉ centile. Un `in
-- (select …)` sur un ensemble de cette taille devient un InitPlan haché,
-- évalué une fois par requête.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function api.mes_mandats_client() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.id from core.mandat m
   where m.entreprise_id in (select api.mes_entreprises());
$$;
revoke execute on function api.mes_mandats_client() from public, anon;
grant  execute on function api.mes_mandats_client() to authenticated, service_role;
comment on function api.mes_mandats_client() is
  'Les mandats de MON entreprise. DEFINER pour rompre la cascade de RLS imbriquée qui faisait expirer les requêtes (57014, mesuré le 12/09), pas pour élargir un droit.';

create or replace function api.mes_candidatures_client() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select c.id from core.candidature c
   where c.entreprise_id in (select api.mes_entreprises());
$$;
revoke execute on function api.mes_candidatures_client() from public, anon;
grant  execute on function api.mes_candidatures_client() to authenticated, service_role;
comment on function api.mes_candidatures_client() is
  'Les candidatures de MON entreprise, toutes étapes confondues. Le filtre de visibilité (six étapes sur quatorze) est celui des VUES, pas celui du périmètre.';

-- ═══════════════════════════════════════════════════════════════════════
-- 1. core.candidature — la policy à l'origine du blocage
-- ═══════════════════════════════════════════════════════════════════════
-- ÉQUIVALENCE VÉRIFIÉE AVANT DE RÉÉCRIRE, ce n'est pas une simplification à
-- vue : sur les 7 236 candidatures, ZÉRO ligne a un `entreprise_id` qui
-- diverge de `mandat.entreprise_id`, et les 20 candidatures sans mandat sont
-- exactement les 20 qui n'ont pas d'entreprise — elles étaient déjà invisibles
-- avec l'ancienne formulation. Le périmètre est identique, au chiffre près.
drop policy if exists client_ses_candidatures on core.candidature;
create policy client_ses_candidatures on core.candidature
  for select to authenticated
  using (entreprise_id in (select api.mes_entreprises()));

-- ═══════════════════════════════════════════════════════════════════════
-- 2. core.note — trois sous-requêtes imbriquées d'un coup
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists client_notes_partagees on core.note;
create policy client_notes_partagees on core.note
  for select to authenticated
  using (visible_client
         and (   entreprise_id  in (select api.mes_entreprises())
              or mandat_id      in (select api.mes_mandats_client())
              or candidature_id in (select api.mes_candidatures_client())));

drop policy if exists client_ecrit_une_note on core.note;
create policy client_ecrit_une_note on core.note
  for insert to authenticated
  with check (visible_client
              and not visible_talent
              and auteur_compte_id = api.compte_id()
              and auteur_collaborateur_id is null
              and auteur_fiche_talent_id  is null
              and not est_automatique
              and (   candidature_id in (select api.mes_candidatures_client())
                   or mandat_id      in (select api.mes_mandats_client())
                   or entreprise_id  in (select api.mes_entreprises())));

-- ═══════════════════════════════════════════════════════════════════════
-- 3. app.decision_client
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists client_ses_decisions on app.decision_client;
create policy client_ses_decisions on app.decision_client
  for select to authenticated
  using (candidature_id in (select api.mes_candidatures_client()));

drop policy if exists client_decide on app.decision_client;
create policy client_decide on app.decision_client
  for insert to authenticated
  with check (compte_id = api.compte_id()
              and candidature_id in (select api.mes_candidatures_client()));

-- ═══════════════════════════════════════════════════════════════════════
-- 4. app.transition_etape
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists client_transition on app.transition_etape;
create policy client_transition on app.transition_etape
  for insert to authenticated
  with check (origine = 'client'::app.origine_transition
              and auteur_compte_id = api.compte_id()
              and candidature_id in (select api.mes_candidatures_client()));

drop policy if exists client_ses_transitions on app.transition_etape;
create policy client_ses_transitions on app.transition_etape
  for select to authenticated
  using (candidature_id in (select api.mes_candidatures_client()));

notify pgrst, 'reload schema';

-- ── Contrôle : plus aucune policy client ne traverse une table sous RLS ──
do $$
declare v_reste text;
begin
  select string_agg(schemaname || '.' || tablename || '.' || policyname, ', ')
    into v_reste
    from pg_policies
   where policyname in ('client_ses_candidatures','client_notes_partagees',
                        'client_ecrit_une_note','client_ses_decisions','client_decide',
                        'client_transition','client_ses_transitions')
     and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'FROM core\.(mandat|candidature)';
  if v_reste is not null then
    raise exception 'policies encore imbriquées sur une table RLS : %', v_reste;
  end if;
end $$;
