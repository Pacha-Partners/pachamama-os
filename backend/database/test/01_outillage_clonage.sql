-- =====================================================================
-- 01_outillage_clonage.sql
-- Installe outillage.cloner_schema(). N'exécute aucun clonage.
--
-- Pourquoi un schéma « outillage » et pas « public » :
--   toute fonction posée dans public devient une route /rpc/ de PostgREST,
--   et PostgreSQL accorde EXECUTE à PUBLIC par défaut. C'est exactement
--   la faille de truncate_data_tables. Le schéma outillage n'est pas exposé
--   par l'API, et les droits sont retirés explicitement plus bas.
--
-- Ce que la fonction reproduit :
--   séquences, tables, colonnes, valeurs par défaut (redirigées vers les
--   séquences du clone), identity, colonnes générées, PK, unique, check,
--   exclusion, index, commentaires, clés étrangères, RLS, policies,
--   vues et vues matérialisées (avec security_invoker), et les données.
--
-- Ce qu'elle ne reproduit PAS, volontairement :
--   les déclencheurs et les fonctions — leur corps peut viser « public »
--   en dur, et un déclencheur cloné écrirait alors en production ;
--   les droits d'accès — le clone est fermé à anon et authenticated.
--     Ouvrir les accès est le travail du jalon 1, pas celui du clonage.
--
-- Garde-fou : la fonction refuse d'écrire dans un schéma dont le nom ne
-- se termine pas par _test. Une faute de frappe ne peut pas viser public.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS outillage;
COMMENT ON SCHEMA outillage IS
  'Outils d''administration. Non exposé par l''API. Aucun droit public.';
REVOKE ALL ON SCHEMA outillage FROM PUBLIC;

CREATE OR REPLACE FUNCTION outillage.cloner_schema(
    p_source       text,
    p_cible        text,
    p_avec_donnees boolean DEFAULT true,
    p_ecraser      boolean DEFAULT false
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE
    r          record;
    rr         record;
    v_sql      text;
    v_cols     text;
    v_over     text;
    v_def      text;
    v_seq      text;
    v_parts    text[];
    v_fk       text[] := '{}';
    v_pol      text[] := '{}';
    v_alertes  text[] := '{}';
    v_err_vue  text := '';
    v_audit    text;
    v_n        bigint;
    v_reste    int;
    v_avant    int;
    n_seq      int := 0;
    n_tables   int := 0;
    n_vues     int := 0;
    n_fk       int := 0;
    n_pol      int := 0;
    n_rls      int := 0;
    n_trig     int := 0;
    n_fonc     int := 0;
    n_lignes   bigint := 0;
BEGIN
    ------------------------------------------------------------------
    -- 0. garde-fous
    ------------------------------------------------------------------
    IF p_cible !~ '_test$' THEN
        RAISE EXCEPTION 'REFUS : le schéma cible « % » ne finit pas par _test. '
                        'Cette fonction n''écrit que dans un schéma de test.', p_cible;
    END IF;
    IF p_source = p_cible THEN
        RAISE EXCEPTION 'REFUS : source et cible identiques (%).', p_source;
    END IF;
    IF to_regnamespace(p_source) IS NULL THEN
        RAISE EXCEPTION 'Le schéma source « % » n''existe pas.', p_source;
    END IF;

    IF to_regnamespace(p_cible) IS NOT NULL THEN
        IF NOT p_ecraser THEN
            RAISE EXCEPTION 'Le schéma « % » existe déjà. Rappeler avec '
                            'p_ecraser => true pour le remplacer.', p_cible;
        END IF;
        EXECUTE format('DROP SCHEMA %I CASCADE', p_cible);
    END IF;
    EXECUTE format('CREATE SCHEMA %I', p_cible);

    -- objets que la fonction ne sait pas traiter
    SELECT count(*) INTO v_n
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = p_source AND c.relkind IN ('p','f');
    IF v_n > 0 THEN
        v_alertes := v_alertes || format('%s table(s) partitionnée(s) ou distante(s) IGNORÉE(S)', v_n);
    END IF;

    ------------------------------------------------------------------
    -- 1. séquences autonomes (celles des colonnes identity sont
    --    recréées par LIKE INCLUDING IDENTITY, il ne faut pas les doubler)
    ------------------------------------------------------------------
    FOR r IN
        SELECT s.sequencename AS nom, s.data_type, s.start_value, s.min_value,
               s.max_value, s.increment_by, s.cycle, s.cache_size, s.last_value
          FROM pg_sequences s
          JOIN pg_class c      ON c.relname = s.sequencename AND c.relkind = 'S'
          JOIN pg_namespace n  ON n.oid = c.relnamespace AND n.nspname = s.schemaname
         WHERE s.schemaname = p_source
           AND NOT EXISTS (SELECT 1 FROM pg_depend d
                            WHERE d.classid = 'pg_class'::regclass
                              AND d.objid = c.oid AND d.deptype = 'i')
    LOOP
        EXECUTE format(
            'CREATE SEQUENCE %I.%I AS %s INCREMENT BY %s MINVALUE %s MAXVALUE %s '
            'START WITH %s CACHE %s %s',
            p_cible, r.nom, r.data_type, r.increment_by, r.min_value, r.max_value,
            r.start_value, r.cache_size,
            CASE WHEN r.cycle THEN 'CYCLE' ELSE 'NO CYCLE' END);
        IF r.last_value IS NOT NULL THEN
            EXECUTE format('SELECT setval(%L::regclass, %s, true)',
                           format('%I.%I', p_cible, r.nom), r.last_value);
        END IF;
        n_seq := n_seq + 1;
    END LOOP;

    ------------------------------------------------------------------
    -- 2. tables : structure, défauts, RLS
    ------------------------------------------------------------------
    FOR r IN
        SELECT c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = p_source AND c.relkind = 'r'
         ORDER BY c.relname
    LOOP
        EXECUTE format('CREATE TABLE %I.%I (LIKE %I.%I INCLUDING ALL)',
                       p_cible, r.relname, p_source, r.relname);
        n_tables := n_tables + 1;

        -- INCLUDING DEFAULTS recopie le texte du défaut : il pointe encore
        -- sur la séquence de la SOURCE. On le redirige vers celle du clone.
        FOR rr IN
            SELECT a.attname, pg_get_expr(ad.adbin, ad.adrelid) AS def
              FROM pg_attrdef ad
              JOIN pg_attribute a ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
             WHERE ad.adrelid = format('%I.%I', p_cible, r.relname)::regclass
               AND pg_get_expr(ad.adbin, ad.adrelid) LIKE 'nextval(%'
        LOOP
            v_seq := substring(rr.def from 'nextval\(''([^'']+)''');
            IF v_seq IS NOT NULL THEN
                v_parts := parse_ident(v_seq);
                v_seq   := v_parts[array_length(v_parts, 1)];
                IF to_regclass(format('%I.%I', p_cible, v_seq)) IS NOT NULL THEN
                    EXECUTE format(
                        'ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT nextval(%L::regclass)',
                        p_cible, r.relname, rr.attname, format('%I.%I', p_cible, v_seq));
                    EXECUTE format('ALTER SEQUENCE %I.%I OWNED BY %I.%I.%I',
                                   p_cible, v_seq, p_cible, r.relname, rr.attname);
                ELSE
                    v_alertes := v_alertes ||
                        format('défaut nextval non redirigé : %s.%s', r.relname, rr.attname);
                END IF;
            END IF;
        END LOOP;

        -- LIKE ne reprend jamais la RLS : sans cette étape le clone serait
        -- ouvert là où la source est fermée.
        IF r.relrowsecurity THEN
            EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', p_cible, r.relname);
            n_rls := n_rls + 1;
        END IF;
        IF r.relforcerowsecurity THEN
            EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', p_cible, r.relname);
        END IF;
    END LOOP;

    ------------------------------------------------------------------
    -- 3. données — un seul instantané, la fonction tient dans une
    --    transaction, donc le clone est cohérent même si la synchro écrit
    ------------------------------------------------------------------
    IF p_avec_donnees THEN
        FOR r IN
            SELECT c.oid, c.relname
              FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = p_source AND c.relkind = 'r'
             ORDER BY c.relname
        LOOP
            SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum),
                   CASE WHEN bool_or(a.attidentity = 'a')
                        THEN 'OVERRIDING SYSTEM VALUE' ELSE '' END
              INTO v_cols, v_over
              FROM pg_attribute a
             WHERE a.attrelid = r.oid AND a.attnum > 0
               AND NOT a.attisdropped
               AND a.attgenerated = '';   -- une colonne générée se recalcule

            CONTINUE WHEN v_cols IS NULL;

            EXECUTE format('INSERT INTO %I.%I (%s) %s SELECT %s FROM %I.%I',
                           p_cible, r.relname, v_cols, v_over, v_cols,
                           p_source, r.relname);
            GET DIAGNOSTICS v_n = ROW_COUNT;
            n_lignes := n_lignes + v_n;
        END LOOP;

        -- Recaler chaque séquence du clone sur son homologue de la source.
        -- LIKE INCLUDING IDENTITY recrée la séquence d'une colonne identity
        -- avec ses paramètres mais repartie de START WITH : sans ce recalage,
        -- le premier INSERT du clone viole la clé primaire.
        -- On reprend la position de la source plutôt que MAX(colonne) + 1 :
        -- avec un pas différent de 1, MAX + 1 n'est pas la valeur suivante.
        FOR r IN
            SELECT sc.sequencename AS nom, ss.last_value
              FROM pg_sequences sc
              LEFT JOIN pg_sequences ss
                     ON ss.schemaname = p_source AND ss.sequencename = sc.sequencename
             WHERE sc.schemaname = p_cible
        LOOP
            IF r.last_value IS NOT NULL THEN
                EXECUTE format('SELECT setval(%L::regclass, %s, true)',
                               format('%I.%I', p_cible, r.nom), r.last_value);
            END IF;
        END LOOP;
    END IF;

    ------------------------------------------------------------------
    -- 4. clés étrangères
    --    pg_get_constraintdef qualifie ou non selon le search_path :
    --    lu sous la source, « REFERENCES talent(...) » sort sans schéma ;
    --    exécuté sous la cible, il se résout dans le clone.
    ------------------------------------------------------------------
    PERFORM set_config('search_path', quote_ident(p_source), true);
    FOR r IN
        SELECT c.relname, co.conname, pg_get_constraintdef(co.oid) AS def,
               cn.nspname AS ref_nsp
          FROM pg_constraint co
          JOIN pg_class c      ON c.oid = co.conrelid
          JOIN pg_namespace n  ON n.oid = c.relnamespace
          JOIN pg_class cc     ON cc.oid = co.confrelid
          JOIN pg_namespace cn ON cn.oid = cc.relnamespace
         WHERE n.nspname = p_source AND co.contype = 'f'
    LOOP
        v_fk := v_fk || format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s',
                               p_cible, r.relname, r.conname, r.def);
        IF r.ref_nsp <> p_source THEN
            v_alertes := v_alertes || format(
                'FK %s.%s pointe hors du schéma (%s) : le clone reste rattaché à la source',
                r.relname, r.conname, r.ref_nsp);
        END IF;
    END LOOP;

    PERFORM set_config('search_path', quote_ident(p_cible) || ', ' || quote_ident(p_source), true);
    FOREACH v_sql IN ARRAY v_fk LOOP
        EXECUTE v_sql;
        n_fk := n_fk + 1;
    END LOOP;

    ------------------------------------------------------------------
    -- 5. vues et vues matérialisées, par passes successives :
    --    une vue peut en référencer une autre, l'ordre n'est pas connu
    ------------------------------------------------------------------
    v_reste := -1;
    LOOP
        v_avant := v_reste;
        v_reste := 0;
        FOR r IN
            SELECT c.relname, c.relkind, c.reloptions
              FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = p_source AND c.relkind IN ('v','m')
               AND to_regclass(format('%I.%I', p_cible, c.relname)) IS NULL
             ORDER BY c.relname
        LOOP
            PERFORM set_config('search_path', quote_ident(p_source), true);
            v_def := rtrim(rtrim(pg_get_viewdef(
                        format('%I.%I', p_source, r.relname)::regclass, true)), ';');
            PERFORM set_config('search_path', quote_ident(p_cible) || ', ' || quote_ident(p_source), true);
            BEGIN
                IF r.relkind = 'v' THEN
                    -- security_invoker vient de reloptions : sans lui la vue
                    -- s'exécute avec les droits de son propriétaire et
                    -- contourne la RLS des tables qu'elle lit
                    EXECUTE format('CREATE VIEW %I.%I %s AS %s',
                        p_cible, r.relname,
                        CASE WHEN r.reloptions IS NULL THEN ''
                             ELSE 'WITH (' || array_to_string(r.reloptions, ', ') || ')' END,
                        v_def);
                ELSE
                    EXECUTE format('CREATE MATERIALIZED VIEW %I.%I AS %s WITH NO DATA',
                                   p_cible, r.relname, v_def);
                    IF p_avec_donnees THEN
                        EXECUTE format('REFRESH MATERIALIZED VIEW %I.%I', p_cible, r.relname);
                    END IF;
                END IF;
                n_vues := n_vues + 1;
            EXCEPTION WHEN others THEN
                v_reste   := v_reste + 1;
                v_err_vue := format('%s : %s', r.relname, SQLERRM);
            END;
        END LOOP;
        EXIT WHEN v_reste = 0;
        IF v_reste = v_avant THEN
            RAISE EXCEPTION 'Vues impossibles à cloner (% restante(s)). Dernière erreur — %',
                            v_reste, v_err_vue;
        END IF;
    END LOOP;

    ------------------------------------------------------------------
    -- 6. policies RLS
    ------------------------------------------------------------------
    PERFORM set_config('search_path', quote_ident(p_source), true);
    FOR r IN
        SELECT c.relname, p.polname, p.polpermissive, p.polcmd,
               pg_get_expr(p.polqual, p.polrelid)      AS qual,
               pg_get_expr(p.polwithcheck, p.polrelid) AS wc,
               COALESCE((SELECT string_agg(quote_ident(ro.rolname), ', ')
                           FROM pg_roles ro WHERE ro.oid = ANY(p.polroles)), 'PUBLIC') AS roles
          FROM pg_policy p
          JOIN pg_class c     ON c.oid = p.polrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = p_source
    LOOP
        v_pol := v_pol || format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s %s %s',
            r.polname, p_cible, r.relname,
            CASE WHEN r.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
            CASE r.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                          WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
                          ELSE 'ALL' END,
            r.roles,
            CASE WHEN r.qual IS NULL THEN '' ELSE 'USING (' || r.qual || ')' END,
            CASE WHEN r.wc   IS NULL THEN '' ELSE 'WITH CHECK (' || r.wc || ')' END);
    END LOOP;

    PERFORM set_config('search_path', quote_ident(p_cible) || ', ' || quote_ident(p_source), true);
    FOREACH v_sql IN ARRAY v_pol LOOP
        EXECUTE v_sql;
        n_pol := n_pol + 1;
    END LOOP;

    ------------------------------------------------------------------
    -- 6 ter. commentaires
    --   LIKE INCLUDING COMMENTS ne reprend que ceux des colonnes, des
    --   contraintes et des index : ni celui de la table, ni ceux des vues
    --   et des séquences.
    ------------------------------------------------------------------
    FOR r IN
        SELECT c.relname, c.relkind, obj_description(c.oid, 'pg_class') AS cmt
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = p_source
           AND c.relkind IN ('r','v','m','S')
           AND obj_description(c.oid, 'pg_class') IS NOT NULL
    LOOP
        EXECUTE format('COMMENT ON %s %I.%I IS %L',
            CASE r.relkind WHEN 'r' THEN 'TABLE'
                           WHEN 'v' THEN 'VIEW'
                           WHEN 'm' THEN 'MATERIALIZED VIEW'
                           ELSE 'SEQUENCE' END,
            p_cible, r.relname, r.cmt);
    END LOOP;

    FOR r IN
        SELECT c.relname, a.attname, col_description(c.oid, a.attnum) AS cmt
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
         WHERE n.nspname = p_source
           AND c.relkind IN ('v','m')
           AND col_description(c.oid, a.attnum) IS NOT NULL
    LOOP
        EXECUTE format('COMMENT ON COLUMN %I.%I.%I IS %L',
                       p_cible, r.relname, r.attname, r.cmt);
    END LOOP;

    ------------------------------------------------------------------
    -- 6 bis. audit de rattachement
    --   Le search_path « cible puis source » laisse une relation non clonée
    --   se résoudre dans la SOURCE, sans erreur. Une vue du clone lirait
    --   alors la production. On le vérifie au lieu de l'espérer.
    ------------------------------------------------------------------
    SELECT string_agg(DISTINCT format('%s lit %s.%s', v.relname, sn.nspname, sr.relname), ', ')
      INTO v_audit
      FROM pg_depend d
      JOIN pg_rewrite rw  ON rw.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
      JOIN pg_class v     ON v.oid = rw.ev_class
      JOIN pg_namespace vn ON vn.oid = v.relnamespace AND vn.nspname = p_cible
      JOIN pg_class sr    ON sr.oid = d.refobjid AND d.refclassid = 'pg_class'::regclass
      JOIN pg_namespace sn ON sn.oid = sr.relnamespace AND sn.nspname = p_source
     WHERE sr.oid <> v.oid;
    IF v_audit IS NOT NULL THEN
        RAISE EXCEPTION 'Vue(s) du clone rattachée(s) à la source : %', v_audit;
    END IF;

    SELECT string_agg(format('%s.%s -> %s', c.relname, co.conname, sn.nspname), ', ')
      INTO v_audit
      FROM pg_constraint co
      JOIN pg_class c      ON c.oid = co.conrelid
      JOIN pg_namespace n  ON n.oid = c.relnamespace AND n.nspname = p_cible
      JOIN pg_class cc     ON cc.oid = co.confrelid
      JOIN pg_namespace sn ON sn.oid = cc.relnamespace AND sn.nspname = p_source
     WHERE co.contype = 'f';
    IF v_audit IS NOT NULL THEN
        RAISE EXCEPTION 'Clé(s) étrangère(s) du clone pointant sur la source : %', v_audit;
    END IF;

    ------------------------------------------------------------------
    -- 7. droits : le clone naît fermé
    ------------------------------------------------------------------
    PERFORM set_config('search_path', 'pg_catalog, pg_temp', true);
    EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC', p_cible);
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM PUBLIC', p_cible);

    FOR r IN SELECT unnest(ARRAY['anon','authenticated']) AS rolename LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r.rolename) THEN
            EXECUTE format('REVOKE ALL ON SCHEMA %I FROM %I', p_cible, r.rolename);
            EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %I', p_cible, r.rolename);
            EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM %I', p_cible, r.rolename);
        END IF;
    END LOOP;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE format('GRANT USAGE ON SCHEMA %I TO service_role', p_cible);
        EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO service_role', p_cible);
        EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO service_role', p_cible);
    END IF;

    ------------------------------------------------------------------
    -- 8. ce qui reste en dehors du clone
    ------------------------------------------------------------------
    SELECT count(*) INTO n_trig
      FROM pg_trigger t
      JOIN pg_class c     ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = p_source AND NOT t.tgisinternal;

    SELECT count(*) INTO n_fonc
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = p_source;

    IF n_trig > 0 THEN
        v_alertes := v_alertes || format('%s déclencheur(s) NON cloné(s)', n_trig);
    END IF;
    IF n_fonc > 0 THEN
        v_alertes := v_alertes || format('%s fonction(s) NON clonée(s)', n_fonc);
    END IF;

    EXECUTE format('COMMENT ON SCHEMA %I IS %L', p_cible,
        format('Clone de %s pris le %s. Sans déclencheurs ni fonctions. '
               'Fermé à anon et authenticated.', p_source, now()::timestamptz(0)));

    RETURN format(
        E'%s -> %s\n  %s séquences, %s tables, %s vues, %s clés étrangères, %s policies\n  %s tables avec RLS activée\n  %s lignes copiées\n  %s',
        p_source, p_cible, n_seq, n_tables, n_vues, n_fk, n_pol, n_rls, n_lignes,
        CASE WHEN cardinality(v_alertes) = 0 THEN 'aucune alerte'
             ELSE 'ALERTES : ' || array_to_string(v_alertes, ' | ') END);
END;
$fn$;

REVOKE ALL ON FUNCTION outillage.cloner_schema(text, text, boolean, boolean) FROM PUBLIC;

COMMENT ON FUNCTION outillage.cloner_schema(text, text, boolean, boolean) IS
  'Clone un schéma vers un schéma *_test. Refuse toute cible ne finissant pas par _test.';
