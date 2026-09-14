-- ═══════════════════════════════════════════════════════════════════════════
-- Corriger la récursion introduite par la migration précédente.
--
-- Erreur mesurée : 42P17, « infinite recursion detected in policy for relation
-- candidature ». La policy `talent_mandats_de_ses_candidatures` posée sur
-- `core.mandat` interroge `core.candidature` ; la policy de `core.candidature`
-- interroge `core.mandat` ; PostgreSQL tourne en rond.
--
-- Le projet a déjà la réponse : `api.mes_entreprises()` est une fonction
-- SECURITY DEFINER précisément parce qu'une policy ne peut pas interroger une
-- table dont la policy la rappelle. On applique le même motif — c'est la seule
-- raison légitime d'un DEFINER ici : sortir du cycle, pas élargir un droit.
-- Les deux fonctions ne rendent que ce que le compte appelant possède déjà.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists talent_mandats_de_ses_candidatures on core.mandat;
drop policy if exists talent_entreprises_de_ses_candidatures on core.entreprise;

-- ── Les mandats sur lesquels j'ai une candidature ──────────────────────
create or replace function api.mes_mandats_talent() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct c.mandat_id
    from core.candidature c
   where c.fiche_talent_id = api.ma_fiche_talent()
     and c.mandat_id is not null;
$$;
revoke execute on function api.mes_mandats_talent() from public, anon;
grant  execute on function api.mes_mandats_talent() to authenticated, service_role;
comment on function api.mes_mandats_talent() is
  'Les mandats où le compte courant a candidaté. DEFINER pour rompre le cycle de policies entre candidature et mandat — n''élargit aucun droit.';

-- ── Les entreprises derrière ces mandats, offres anonymes exclues ──────
create or replace function api.mes_entreprises_talent() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct m.entreprise_id
    from core.candidature c
    join core.mandat m on m.id = c.mandat_id
   where c.fiche_talent_id = api.ma_fiche_talent()
     and not m.est_anonyme
     and m.entreprise_id is not null;
$$;
revoke execute on function api.mes_entreprises_talent() from public, anon;
grant  execute on function api.mes_entreprises_talent() to authenticated, service_role;
comment on function api.mes_entreprises_talent() is
  'Le client derrière un mandat où j''ai candidaté, et seulement si l''offre n''est pas anonyme. L''anonymat est ainsi tenu par la policy ET par la vue.';

create policy talent_mandats_de_ses_candidatures on core.mandat
  for select to authenticated
  using (id in (select api.mes_mandats_talent()));

create policy talent_entreprises_de_ses_candidatures on core.entreprise
  for select to authenticated
  using (id in (select api.mes_entreprises_talent()));
