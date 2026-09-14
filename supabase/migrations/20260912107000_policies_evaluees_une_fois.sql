-- ═══════════════════════════════════════════════════════════════════════════
-- Une fonction appelée dans une policy est évaluée UNE FOIS PAR LIGNE.
-- La même, enveloppée dans `(select …)`, l'est UNE FOIS PAR REQUÊTE.
--
-- CE QUI A ÉTÉ MESURÉ, LE 12/09, EXPLAIN ANALYZE À L'APPUI
-- `select count(*) from api.candidat_presente` sous le jeton d'un compte
-- RECRUTEUR — une requête qui doit rendre ZÉRO — met 1 464 ms, et 8 s par
-- PostgREST avec `Prefer: count=exact`, jusqu'à l'expiration (57014).
-- Le plan montre pourquoi :
--
--   Index Scan on candidature c (actual rows=0 loops=6)
--     Filter: ((fiche_talent_id = api.ma_fiche_talent())
--              OR api.est_interne() OR api.est_interne() OR …)
--     Rows Removed by Filter: 316
--
-- `api.ma_fiche_talent()` et `api.est_interne()` — deux fois — sont dans le
-- FILTRE, donc appelées pour chacune des 1 896 lignes traversées. Chacune fait
-- une requête sur `app.acces` et `app.compte`. Environ 7 600 sous-requêtes pour
-- rendre zéro ligne.
--
-- Dans la même requête, `(select api.est_service())` — la seule qui était déjà
-- enveloppée, par la migration 20260912095000 — apparaît en `InitPlan 1` :
-- évaluée une fois. La différence tient à ces sept caractères.
--
-- CE QUE FAIT CETTE MIGRATION
-- Elle enveloppe `api.est_interne()`, `api.ma_fiche_talent()`,
-- `api.compte_id()` et `api.mon_agent_talent()` dans un `(select …)`, dans
-- TOUTES les policies de `core` et `app`. La sémantique est strictement
-- identique — ces quatre fonctions sont STABLE, leur valeur ne change pas
-- pendant une requête. Seul le nombre d'appels change.
--
-- Elle procède par relecture de `pg_policies` et recréation, plutôt que par
-- une cinquantaine de `create policy` recopiés à la main : recopier, c'est
-- l'occasion de se tromper sur une clause qu'on n'a pas relue.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  p          record;
  v_qual     text;
  v_check    text;
  v_sql      text;
  v_roles    text;
  v_traitees integer := 0;
  v_avant    integer;
  v_apres    integer;
begin
  select count(*) into v_avant from pg_policies where schemaname in ('core','app');

  for p in
    select schemaname, tablename, policyname, cmd, roles, qual, with_check
      from pg_policies
     where schemaname in ('core','app')
       and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~
           '(?<!SELECT )api\.(est_interne|ma_fiche_talent|compte_id|mon_agent_talent)\(\)'
     order by schemaname, tablename, policyname
  loop
    v_qual  := p.qual;
    v_check := p.with_check;

    -- L'enveloppement, quatre fonctions, deux expressions.
    foreach v_sql in array array['est_interne','ma_fiche_talent','compte_id','mon_agent_talent'] loop
      v_qual  := regexp_replace(coalesce(v_qual, ''),
                   '(?<!SELECT )api\.' || v_sql || '\(\)',
                   '(select api.' || v_sql || '())', 'g');
      v_check := regexp_replace(coalesce(v_check, ''),
                   '(?<!SELECT )api\.' || v_sql || '\(\)',
                   '(select api.' || v_sql || '())', 'g');
    end loop;
    v_qual  := nullif(v_qual, '');
    v_check := nullif(v_check, '');

    v_roles := array_to_string(p.roles, ', ');

    v_sql := format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    execute v_sql;

    v_sql := format('create policy %I on %I.%I for %s to %s',
                    p.policyname, p.schemaname, p.tablename,
                    case p.cmd when 'ALL' then 'all' else lower(p.cmd) end,
                    v_roles);
    if v_qual is not null then
      v_sql := v_sql || format(' using (%s)', v_qual);
    end if;
    if v_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_check);
    end if;
    execute v_sql;

    v_traitees := v_traitees + 1;
  end loop;

  select count(*) into v_apres from pg_policies where schemaname in ('core','app');
  if v_avant <> v_apres then
    raise exception 'perte de policies : % avant, % après', v_avant, v_apres;
  end if;
  raise notice '% policies réécrites, % au total, inchangé', v_traitees, v_apres;
end $$;

-- ── Contrôle : plus aucun appel nu ─────────────────────────────────────
do $$
declare v_reste text;
begin
  select string_agg(schemaname || '.' || tablename || '.' || policyname, ', ')
    into v_reste
    from pg_policies
   where schemaname in ('core','app')
     and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~
         '(?<!SELECT )api\.(est_interne|ma_fiche_talent|compte_id|mon_agent_talent)\(\)';
  if v_reste is not null then
    raise exception 'policies encore évaluées par ligne : %', v_reste;
  end if;
end $$;

-- ── Les policies de `ref` n'appellent aucune fonction : rien à y faire.
-- Leur `using (true)` est déjà une constante.

notify pgrst, 'reload schema';
