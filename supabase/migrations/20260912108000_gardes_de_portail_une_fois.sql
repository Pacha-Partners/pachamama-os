-- ═══════════════════════════════════════════════════════════════════════════
-- Même correctif, l'autre moitié : les GARDES DE PORTAIL dans les vues.
--
-- La migration précédente a enveloppé les appels des POLICIES. Il en reste dans
-- les VUES : `api.a_portail('entreprise')` est écrit nu dans le WHERE de neuf
-- vues, donc appelé une fois par ligne traversée. Sur `api.candidat_presente`
-- vu par un compte recruteur, cela restait 1 896 appels pour rendre zéro ligne
-- — mesuré à 363 ms après la correction des policies, contre 1 464 ms avant.
--
-- La migration 20260912095000 avait déjà fait ce geste, mais pour une seule
-- fonction, et elle disait pourquoi : « auth.role() est encapsulé dans un
-- (select …) : PostgreSQL évalue alors l'expression une fois par requête au
-- lieu d'une fois par ligne. » Ce qui valait pour `est_service()` vaut pour
-- `a_portail()`, `compte_id()` et `ma_fiche_talent()`. On finit le geste.
--
-- Méthode : relecture de `pg_get_viewdef` et `create or replace view`, qui
-- conserve les droits et impose de ne changer ni le nom ni l'ordre des
-- colonnes — c'est le garde-fou qu'on veut ici (42P16 en cas d'écart).
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v         record;
  v_def     text;
  v_avant   jsonb;
  v_apres   jsonb;
  v_n       integer := 0;
begin
  select jsonb_object_agg(relname, n) into v_avant
    from (select c.relname,
                 (select count(*) from pg_attribute a
                   where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as n
            from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
           where ns.nspname = 'api' and c.relkind = 'v') t;

  for v in
    select c.oid, c.relname,
           coalesce((select option_value from pg_options_to_table(c.reloptions)
                      where option_name = 'security_invoker'), 'false') as invoker
      from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'api' and c.relkind = 'v'
       and pg_get_viewdef(c.oid, true) ~
           '(?<!SELECT )api\.(a_portail\(|compte_id\(\)|ma_fiche_talent\(\))'
     order by c.relname
  loop
    v_def := pg_get_viewdef(v.oid, true);
    v_def := regexp_replace(v_def, '(?<!SELECT )api\.a_portail\(([^()]*)\)',
                            '( SELECT api.a_portail(\1))', 'g');
    v_def := regexp_replace(v_def, '(?<!SELECT )api\.compte_id\(\)',
                            '( SELECT api.compte_id())', 'g');
    v_def := regexp_replace(v_def, '(?<!SELECT )api\.ma_fiche_talent\(\)',
                            '( SELECT api.ma_fiche_talent())', 'g');

    execute format('create or replace view api.%I with (security_invoker = %s) as %s',
                   v.relname, v.invoker, v_def);
    v_n := v_n + 1;
  end loop;

  select jsonb_object_agg(relname, n) into v_apres
    from (select c.relname,
                 (select count(*) from pg_attribute a
                   where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as n
            from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
           where ns.nspname = 'api' and c.relkind = 'v') t;

  if v_avant is distinct from v_apres then
    raise exception 'la forme des vues a changé — avant % / après %', v_avant, v_apres;
  end if;
  raise notice '% vues réécrites, colonnes inchangées', v_n;
end $$;

notify pgrst, 'reload schema';

-- ── Contrôle ───────────────────────────────────────────────────────────
do $$
declare v_reste text;
begin
  select string_agg(c.relname, ', ') into v_reste
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'api' and c.relkind = 'v'
     and pg_get_viewdef(c.oid, true) ~
         '(?<!SELECT )api\.(a_portail\(|compte_id\(\)|ma_fiche_talent\(\))';
  if v_reste is not null then
    raise exception 'vues encore évaluées par ligne : %', v_reste;
  end if;

  -- Les droits survivent-ils au create or replace ? On le vérifie, parce que
  -- `drop view` les aurait emportés et que la nuance est facile à oublier.
  if not has_table_privilege('authenticated', 'api.candidat_presente', 'select')
     or not has_table_privilege('authenticated', 'api.mandat_client', 'select')
     or not has_table_privilege('anon', 'api.offre_publique', 'select') then
    raise exception 'des droits de lecture ont disparu à la réécriture des vues';
  end if;
end $$;
