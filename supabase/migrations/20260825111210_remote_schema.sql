-- =====================================================================
-- État réel du schéma de production, capturé le 25/08/2026 par
--   supabase db dump --schema public,pivot
-- C'est la référence : les fichiers de « Bubble migration » décrivent
-- 105 tables et 667 colonnes, la production en a davantage. Ce fichier-ci
-- décrit ce qui existe, pas ce qu'on croit avoir appliqué.
--
-- PRÉREQUIS AJOUTÉ À LA MAIN
-- pg_dump exclut les extensions, parce que Supabase les gère lui-même.
-- Or trois index de `public` utilisent extensions.gin_trgm_ops. Sans ces
-- deux lignes, rejouer ce fichier sur une base vierge échoue.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "pivot";


ALTER SCHEMA "pivot" OWNER TO "postgres";


COMMENT ON SCHEMA "pivot" IS 'Base talent unifiée (pivot). Maître de la donnée talent ; Jarvi et l''app en sont les producteurs.';



CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."claim_next_sync_type"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    claimed _sync_state%ROWTYPE;
BEGIN
    UPDATE _sync_state
       SET last_run_status = 'running',
           last_run_at = now()
     WHERE type_name = (
         SELECT type_name FROM _sync_state
         WHERE last_run_status <> 'running'
            OR last_run_at < now() - interval '2 minutes'  -- libère un lock orphelin
         ORDER BY last_run_at NULLS FIRST
         LIMIT 1
         FOR UPDATE SKIP LOCKED
     )
     RETURNING * INTO claimed;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    RETURN to_jsonb(claimed);
END;
$$;


ALTER FUNCTION "public"."claim_next_sync_type"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."disable_fk"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    r RECORD;
BEGIN
    -- Sauvegarder les FK dans une table temporaire pour pouvoir les recréer
    CREATE TABLE IF NOT EXISTS public._fk_backup (
        id serial PRIMARY KEY,
        constraint_name text,
        table_name text,
        column_name text,
        ref_table text,
        ref_column text,
        on_delete text,
        on_update text
    );
    TRUNCATE public._fk_backup;

    FOR r IN
        SELECT
            tc.constraint_name,
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS ref_table,
            ccu.column_name AS ref_column,
            rc.delete_rule AS on_delete,
            rc.update_rule AS on_update
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
            AND tc.table_schema = ccu.table_schema
        JOIN information_schema.referential_constraints rc
            ON tc.constraint_name = rc.constraint_name
            AND tc.table_schema = rc.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
    LOOP
        INSERT INTO public._fk_backup (constraint_name, table_name, column_name, ref_table, ref_column, on_delete, on_update)
        VALUES (r.constraint_name, r.table_name, r.column_name, r.ref_table, r.ref_column, r.on_delete, r.on_update);

        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."disable_fk"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enable_fk"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    r RECORD;
    action_delete text;
    action_update text;
BEGIN
    FOR r IN SELECT * FROM public._fk_backup ORDER BY id
    LOOP
        action_delete := CASE r.on_delete
            WHEN 'CASCADE' THEN 'ON DELETE CASCADE'
            WHEN 'SET NULL' THEN 'ON DELETE SET NULL'
            WHEN 'SET DEFAULT' THEN 'ON DELETE SET DEFAULT'
            ELSE ''
        END;
        action_update := CASE r.on_update
            WHEN 'CASCADE' THEN 'ON UPDATE CASCADE'
            WHEN 'SET NULL' THEN 'ON UPDATE SET NULL'
            WHEN 'SET DEFAULT' THEN 'ON UPDATE SET DEFAULT'
            ELSE ''
        END;

        BEGIN
            EXECUTE format(
                'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(%I) %s %s',
                r.table_name, r.constraint_name, r.column_name, r.ref_table, r.ref_column,
                action_delete, action_update
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not recreate FK %: %', r.constraint_name, SQLERRM;
        END;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."enable_fk"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finish_sync_type"("p_type_name" "text", "p_status" "text", "p_last_modified" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_last_cursor" integer DEFAULT 0, "p_items_synced" integer DEFAULT 0, "p_error" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE _sync_state
       SET last_run_status = p_status,
           last_modified   = COALESCE(p_last_modified, last_modified),
           last_cursor     = p_last_cursor,
           items_synced    = items_synced + p_items_synced,
           error_message   = p_error,
           last_run_at     = now()
     WHERE type_name = p_type_name;
END;
$$;


ALTER FUNCTION "public"."finish_sync_type"("p_type_name" "text", "p_status" "text", "p_last_modified" timestamp with time zone, "p_last_cursor" integer, "p_items_synced" integer, "p_error" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_m2m"("p_table" "text", "p_parent_col" "text", "p_parent_id" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
    inserted int := 0;
    cols text;
    vals text;
    sql text;
    r jsonb;
BEGIN
    -- 1. Purge des M2M existants pour ce parent
    EXECUTE format('DELETE FROM %I WHERE %I = $1', p_table, p_parent_col)
        USING p_parent_id;

    -- 2. Re-insertion (les rows arrivent déjà avec parent_id rempli)
    IF jsonb_array_length(p_rows) = 0 THEN
        RETURN 0;
    END IF;

    -- Récupère les noms de colonnes depuis la 1re row
    SELECT string_agg(quote_ident(key), ',') INTO cols
      FROM jsonb_object_keys(p_rows->0) key;

    FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
    LOOP
        SELECT string_agg(quote_nullable(r->>key), ',') INTO vals
          FROM jsonb_object_keys(r) key;
        sql := format('INSERT INTO %I (%s) VALUES (%s) ON CONFLICT DO NOTHING',
                      p_table, cols, vals);
        EXECUTE sql;
        inserted := inserted + 1;
    END LOOP;

    RETURN inserted;
END;
$_$;


ALTER FUNCTION "public"."replace_m2m"("p_table" "text", "p_parent_col" "text", "p_parent_id" "text", "p_rows" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."replace_m2m"("p_table" "text", "p_parent_col" "text", "p_parent_id" "text", "p_rows" "jsonb") IS 'Remplace atomiquement toutes les lignes M2M d''un parent (DELETE + INSERT).
Utilisée par n8n quand un record Bubble est re-syncé pour gérer les éventuels
ajouts/retraits dans ses listes (tags, notes, jobs, etc.).';



CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."truncate_data_tables"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    r RECORD;
BEGIN
    -- Dropper les FK d'abord
    PERFORM public.disable_fk();

    -- Truncate toutes les tables public sauf _fk_backup
    FOR r IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename != '_fk_backup'
    LOOP
        EXECUTE format('TRUNCATE TABLE public.%I', r.tablename);
    END LOOP;

    -- Recréer les FK
    PERFORM public.enable_fk();
END;
$$;


ALTER FUNCTION "public"."truncate_data_tables"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "pivot"."attentes" (
    "talent_id" "text" NOT NULL,
    "metier_vise" "text",
    "univers_vise" "text",
    "contrats" "text"[],
    "localisations" "text"[],
    "remotes" "text"[],
    "secteurs" "text"[],
    "nogo" "text",
    "salaire_min" numeric,
    "salaire_souhaite" numeric,
    "tjm_min" numeric,
    "tjm_souhaite" numeric,
    "disponibilite" "text",
    "description" "text"
);


ALTER TABLE "pivot"."attentes" OWNER TO "postgres";


COMMENT ON COLUMN "pivot"."attentes"."salaire_min" IS 'En K€ : 3 264 valeurs harmonisées €→K€ en amont du chargement.';



COMMENT ON COLUMN "pivot"."attentes"."tjm_min" IS 'En euros par jour.';



CREATE TABLE IF NOT EXISTS "pivot"."conflit" (
    "conflit_id" bigint NOT NULL,
    "talent_id" "text" NOT NULL,
    "champ" "text" NOT NULL,
    "valeur_retenue" "text",
    "source_retenue" "text" NOT NULL,
    "valeur_ecartee" "text",
    "source_ecartee" "text" NOT NULL,
    "regle" "text" NOT NULL,
    "run_id" "text",
    "vu_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conflit_regle_check" CHECK (("regle" = ANY (ARRAY['matrice'::"text", 'R1'::"text", 'R2'::"text", 'concurrence'::"text", 'coexistence'::"text"])))
);


ALTER TABLE "pivot"."conflit" OWNER TO "postgres";


COMMENT ON TABLE "pivot"."conflit" IS 'Journal append-only des valeurs écartées par la préséance. Complète les colonnes *_src : celles-ci disent d''où vient ce qui est retenu, celle-ci dit ce qui a été écarté et par quelle règle.';



CREATE SEQUENCE IF NOT EXISTS "pivot"."conflit_conflit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "pivot"."conflit_conflit_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "pivot"."conflit_conflit_id_seq" OWNED BY "pivot"."conflit"."conflit_id";



CREATE TABLE IF NOT EXISTS "pivot"."email" (
    "id" bigint NOT NULL,
    "talent_id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "source" "text" NOT NULL,
    "generique" boolean DEFAULT false NOT NULL,
    CONSTRAINT "email_source_check" CHECK (("source" = ANY (ARRAY['jarvi'::"text", 'app'::"text"])))
);


ALTER TABLE "pivot"."email" OWNER TO "postgres";


COMMENT ON COLUMN "pivot"."email"."generique" IS 'Adresse de service (contact@, rh@) : conservée en donnée, mais exclue des clés d''union pour ne pas fusionner deux personnes distinctes.';



CREATE SEQUENCE IF NOT EXISTS "pivot"."email_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "pivot"."email_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "pivot"."email_id_seq" OWNED BY "pivot"."email"."id";



CREATE TABLE IF NOT EXISTS "pivot"."note_journal" (
    "id" bigint NOT NULL,
    "talent_id" "text" NOT NULL,
    "contenu" "text" NOT NULL,
    "source" "text" DEFAULT 'app'::"text" NOT NULL,
    "automatique" boolean DEFAULT false NOT NULL,
    "date_note" timestamp with time zone,
    "external_id" "text"
);


ALTER TABLE "pivot"."note_journal" OWNER TO "postgres";


COMMENT ON COLUMN "pivot"."note_journal"."automatique" IS 'Note générée par un automatisme, à distinguer d''une note rédigée par un recruteur.';



COMMENT ON COLUMN "pivot"."note_journal"."external_id" IS 'Identifiant de la note source : rend le chargement idempotent.';



CREATE SEQUENCE IF NOT EXISTS "pivot"."note_journal_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "pivot"."note_journal_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "pivot"."note_journal_id_seq" OWNED BY "pivot"."note_journal"."id";



CREATE TABLE IF NOT EXISTS "pivot"."parcours" (
    "talent_id" "text" NOT NULL,
    "experience" "text",
    "formation" "text",
    "competences" "text"
);


ALTER TABLE "pivot"."parcours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "pivot"."phone" (
    "id" bigint NOT NULL,
    "talent_id" "text" NOT NULL,
    "tel" "text" NOT NULL,
    "source" "text" NOT NULL,
    CONSTRAINT "phone_source_check" CHECK (("source" = ANY (ARRAY['jarvi'::"text", 'app'::"text"])))
);


ALTER TABLE "pivot"."phone" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "pivot"."phone_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "pivot"."phone_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "pivot"."phone_id_seq" OWNED BY "pivot"."phone"."id";



CREATE TABLE IF NOT EXISTS "pivot"."qualification" (
    "talent_id" "text" NOT NULL,
    "niveau_qualifie" "text",
    "univers" "text",
    "anglais" "text",
    "product" "text",
    "profil" "text",
    "seniorite" "text",
    "background" "text",
    "expertises" "text"[],
    "secteurs" "text"[]
);


ALTER TABLE "pivot"."qualification" OWNER TO "postgres";


COMMENT ON TABLE "pivot"."qualification" IS 'Qualification produite par les recruteurs : ce que l''ATS ne sait pas faire. Le genre est volontairement absent (minimisation RGPD).';



CREATE TABLE IF NOT EXISTS "pivot"."talent" (
    "talent_id" "text" NOT NULL,
    "type_fusion" "text" NOT NULL,
    "prenom" "text",
    "prenom_src" "text",
    "nom" "text",
    "nom_src" "text",
    "headline" "text",
    "localisation" "text",
    "localisation_src" "text",
    "url_linkedin" "text",
    "open_to" "text",
    "employeur_actuel" "text",
    "employeur_src" "text",
    "statut_jarvi" "text",
    "origine_jarvi" "text",
    "cv_url" "text",
    "notes_jarvi" "text",
    "notes_bloc" "text",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "talent_employeur_src_check" CHECK (("employeur_src" = ANY (ARRAY['jarvi'::"text", 'app'::"text"]))),
    CONSTRAINT "talent_localisation_src_check" CHECK (("localisation_src" = ANY (ARRAY['jarvi'::"text", 'app'::"text"]))),
    CONSTRAINT "talent_nom_src_check" CHECK (("nom_src" = ANY (ARRAY['jarvi'::"text", 'app'::"text"]))),
    CONSTRAINT "talent_prenom_src_check" CHECK (("prenom_src" = ANY (ARRAY['jarvi'::"text", 'app'::"text"]))),
    CONSTRAINT "talent_type_fusion_check" CHECK (("type_fusion" = ANY (ARRAY['merged'::"text", 'jarvi_only'::"text", 'app_only'::"text"])))
);


ALTER TABLE "pivot"."talent" OWNER TO "postgres";


COMMENT ON TABLE "pivot"."talent" IS 'Enregistrement doré : un par personne, après résolution d''entités.';



COMMENT ON COLUMN "pivot"."talent"."type_fusion" IS 'Origine : fusion des deux sources, Jarvi seul, ou app seule.';



COMMENT ON COLUMN "pivot"."talent"."prenom_src" IS 'Source retenue par la règle de préséance pour ce champ.';



COMMENT ON COLUMN "pivot"."talent"."notes_bloc" IS 'Consolidation LLM du journal de notes. Différée : le journal est conservé pour la rendre régénérable.';



CREATE OR REPLACE VIEW "pivot"."qa_completude" WITH ("security_invoker"='true') AS
 SELECT ( SELECT "count"(*) AS "count"
           FROM "pivot"."talent") AS "talents",
    ( SELECT "count"(*) AS "count"
           FROM "pivot"."talent"
          WHERE ("talent"."type_fusion" = 'merged'::"text")) AS "fusionnes",
    ( SELECT "count"(*) AS "count"
           FROM "pivot"."talent"
          WHERE ("talent"."type_fusion" = 'jarvi_only'::"text")) AS "jarvi_seul",
    ( SELECT "count"(*) AS "count"
           FROM "pivot"."talent"
          WHERE ("talent"."type_fusion" = 'app_only'::"text")) AS "app_seul",
    ( SELECT "count"(*) AS "count"
           FROM "pivot"."talent"
          WHERE (("talent"."nom" IS NOT NULL) OR ("talent"."prenom" IS NOT NULL))) AS "avec_identite",
    ( SELECT "count"(*) AS "count"
           FROM "pivot"."qualification") AS "avec_qualification",
    ( SELECT "count"(*) AS "count"
           FROM "pivot"."attentes") AS "avec_attentes",
    ( SELECT "count"(*) AS "count"
           FROM "pivot"."parcours") AS "avec_parcours",
    ( SELECT "count"(DISTINCT "email"."talent_id") AS "count"
           FROM "pivot"."email") AS "avec_email",
    ( SELECT "count"(DISTINCT "phone"."talent_id") AS "count"
           FROM "pivot"."phone") AS "avec_telephone",
    ( SELECT "count"(DISTINCT "note_journal"."talent_id") AS "count"
           FROM "pivot"."note_journal") AS "avec_notes",
    ( SELECT "count"(*) AS "count"
           FROM "pivot"."note_journal") AS "notes_total",
    ( SELECT "count"(*) AS "count"
           FROM "pivot"."talent"
          WHERE ("talent"."cv_url" IS NOT NULL)) AS "avec_cv";


ALTER VIEW "pivot"."qa_completude" OWNER TO "postgres";


COMMENT ON VIEW "pivot"."qa_completude" IS 'Une ligne : l''état de complétude de la base talent, recalculé à la demande.';



CREATE OR REPLACE VIEW "pivot"."qa_emails_generiques" WITH ("security_invoker"='true') AS
 SELECT "e"."talent_id",
    "e"."email",
    "e"."source",
    "t"."prenom",
    "t"."nom"
   FROM ("pivot"."email" "e"
     JOIN "pivot"."talent" "t" ON (("t"."talent_id" = "e"."talent_id")))
  WHERE ("e"."generique" IS TRUE);


ALTER VIEW "pivot"."qa_emails_generiques" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "pivot"."talent_source" (
    "talent_id" "text" NOT NULL,
    "source" "text" NOT NULL,
    "external_id" "text" NOT NULL,
    CONSTRAINT "talent_source_source_check" CHECK (("source" = ANY (ARRAY['jarvi'::"text", 'app'::"text"])))
);


ALTER TABLE "pivot"."talent_source" OWNER TO "postgres";


COMMENT ON TABLE "pivot"."talent_source" IS 'Base du matching déterministe et de la réversibilité de la fusion.';



CREATE OR REPLACE VIEW "pivot"."qa_multi_source" WITH ("security_invoker"='true') AS
 SELECT "s"."talent_id",
    "s"."source",
    "count"(*) AS "nb_liens",
    "t"."prenom",
    "t"."nom",
    "t"."employeur_actuel",
    "string_agg"("s"."external_id", ' | '::"text" ORDER BY "s"."external_id") AS "identifiants"
   FROM ("pivot"."talent_source" "s"
     JOIN "pivot"."talent" "t" ON (("t"."talent_id" = "s"."talent_id")))
  GROUP BY "s"."talent_id", "s"."source", "t"."prenom", "t"."nom", "t"."employeur_actuel"
 HAVING ("count"(*) > 1);


ALTER VIEW "pivot"."qa_multi_source" OWNER TO "postgres";


COMMENT ON VIEW "pivot"."qa_multi_source" IS 'Clusters à plusieurs liens vers une même source : doublons collapsés, à contrôler contre la sur-fusion.';



CREATE OR REPLACE VIEW "pivot"."qa_preseance_suspecte" WITH ("security_invoker"='true') AS
 SELECT "talent_id",
    "prenom",
    "nom",
    "type_fusion",
    "prenom_src",
    "nom_src",
    "localisation_src",
    "employeur_src"
   FROM "pivot"."talent" "t"
  WHERE (("type_fusion" = 'merged'::"text") AND (("prenom_src" = 'app'::"text") OR ("nom_src" = 'app'::"text") OR ("localisation_src" = 'app'::"text") OR ("employeur_src" = 'app'::"text")));


ALTER VIEW "pivot"."qa_preseance_suspecte" OWNER TO "postgres";


COMMENT ON VIEW "pivot"."qa_preseance_suspecte" IS 'Talents fusionnés dont un champ à préséance provient de l''app : légitime seulement si Jarvi était vide (R1).';



CREATE OR REPLACE VIEW "pivot"."qa_sans_contact" WITH ("security_invoker"='true') AS
 SELECT "talent_id",
    "prenom",
    "nom",
    "type_fusion",
    "url_linkedin",
    "employeur_actuel"
   FROM "pivot"."talent" "t"
  WHERE ((NOT (EXISTS ( SELECT 1
           FROM "pivot"."email" "e"
          WHERE ("e"."talent_id" = "t"."talent_id")))) AND (NOT (EXISTS ( SELECT 1
           FROM "pivot"."phone" "p"
          WHERE ("p"."talent_id" = "t"."talent_id")))));


ALTER VIEW "pivot"."qa_sans_contact" OWNER TO "postgres";


COMMENT ON VIEW "pivot"."qa_sans_contact" IS 'Talents injoignables : ni email ni téléphone.';



CREATE OR REPLACE VIEW "pivot"."qa_sans_identite" WITH ("security_invoker"='true') AS
 SELECT "talent_id",
    "type_fusion",
    "headline",
    "url_linkedin",
    "employeur_actuel",
    ( SELECT "count"(*) AS "count"
           FROM "pivot"."email" "e"
          WHERE ("e"."talent_id" = "t"."talent_id")) AS "nb_emails"
   FROM "pivot"."talent" "t"
  WHERE (("nom" IS NULL) AND ("prenom" IS NULL));


ALTER VIEW "pivot"."qa_sans_identite" OWNER TO "postgres";


COMMENT ON VIEW "pivot"."qa_sans_identite" IS 'Dorés sans nom ni prénom : file d''enrichissement ou d''archivage.';



CREATE TABLE IF NOT EXISTS "pivot"."sync_etat" (
    "source" "text" NOT NULL,
    "curseur" timestamp with time zone,
    "statut" "text" DEFAULT 'jamais_lance'::"text" NOT NULL,
    "demarre_le" timestamp with time zone,
    "termine_le" timestamp with time zone,
    "message_erreur" "text",
    "volume_dernier_run" integer,
    "runs_total" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "sync_etat_source_check" CHECK (("source" = ANY (ARRAY['app'::"text", 'ats'::"text"]))),
    CONSTRAINT "sync_etat_statut_check" CHECK (("statut" = ANY (ARRAY['jamais_lance'::"text", 'en_cours'::"text", 'ok'::"text", 'erreur'::"text"])))
);


ALTER TABLE "pivot"."sync_etat" OWNER TO "postgres";


COMMENT ON TABLE "pivot"."sync_etat" IS 'Curseur d''alimentation par source. Le curseur n''avance JAMAIS sur exception : une perte de synchronisation est silencieuse, donc le sens sûr de la défaillance est de ne pas progresser.';



CREATE TABLE IF NOT EXISTS "pivot"."sync_run" (
    "run_id" "text" NOT NULL,
    "source" "text" NOT NULL,
    "demarre_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "termine_le" timestamp with time zone,
    "statut" "text" DEFAULT 'en_cours'::"text" NOT NULL,
    "attendus" integer,
    "lus" integer DEFAULT 0 NOT NULL,
    "talents_crees" integer DEFAULT 0 NOT NULL,
    "talents_majs" integer DEFAULT 0 NOT NULL,
    "conflits" integer DEFAULT 0 NOT NULL,
    "curseur_avant" timestamp with time zone,
    "curseur_apres" timestamp with time zone,
    "message" "text",
    CONSTRAINT "sync_run_statut_check" CHECK (("statut" = ANY (ARRAY['en_cours'::"text", 'ok'::"text", 'erreur'::"text"])))
);


ALTER TABLE "pivot"."sync_run" OWNER TO "postgres";


COMMENT ON TABLE "pivot"."sync_run" IS 'Une ligne par exécution. Un run qui lit moins que le total annoncé est un run en erreur, même s''il n''a levé aucune exception.';



CREATE OR REPLACE VIEW "pivot"."talent_recherche" WITH ("security_invoker"='true') AS
 SELECT "t"."talent_id",
    "t"."type_fusion",
    "t"."prenom",
    "t"."nom",
    "t"."headline",
    "t"."localisation",
    "t"."employeur_actuel",
    "t"."url_linkedin",
    "t"."statut_jarvi",
    ("t"."cv_url" IS NOT NULL) AS "a_cv",
    "q"."univers",
    "q"."niveau_qualifie",
    "q"."seniorite",
    "q"."anglais",
    "q"."expertises",
    "q"."secteurs",
    "a"."metier_vise",
    "a"."univers_vise",
    "a"."contrats",
    "a"."salaire_min",
    "a"."salaire_souhaite",
    "a"."tjm_min",
    "a"."tjm_souhaite",
    "a"."disponibilite",
    ("q"."talent_id" IS NOT NULL) AS "est_qualifie",
    ("a"."talent_id" IS NOT NULL) AS "a_attentes",
    ( SELECT "count"(*) AS "count"
           FROM "pivot"."email" "e"
          WHERE ("e"."talent_id" = "t"."talent_id")) AS "nb_emails",
    ( SELECT "count"(*) AS "count"
           FROM "pivot"."talent_source" "s"
          WHERE ("s"."talent_id" = "t"."talent_id")) AS "nb_sources",
    ( SELECT "count"(*) AS "count"
           FROM "pivot"."note_journal" "n"
          WHERE ("n"."talent_id" = "t"."talent_id")) AS "nb_notes"
   FROM (("pivot"."talent" "t"
     LEFT JOIN "pivot"."qualification" "q" ON (("q"."talent_id" = "t"."talent_id")))
     LEFT JOIN "pivot"."attentes" "a" ON (("a"."talent_id" = "t"."talent_id")));


ALTER VIEW "pivot"."talent_recherche" OWNER TO "postgres";


COMMENT ON VIEW "pivot"."talent_recherche" IS 'Vue de sourcing : un talent, sa qualification et ses attentes en une ligne.';



CREATE TABLE IF NOT EXISTS "public"."_fk_backup" (
    "id" integer NOT NULL,
    "constraint_name" "text",
    "table_name" "text",
    "column_name" "text",
    "ref_table" "text",
    "ref_column" "text",
    "on_delete" "text",
    "on_update" "text"
);


ALTER TABLE "public"."_fk_backup" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."_fk_backup_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."_fk_backup_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."_fk_backup_id_seq" OWNED BY "public"."_fk_backup"."id";



CREATE TABLE IF NOT EXISTS "public"."_sync_ecart" (
    "id" bigint NOT NULL,
    "type_name" "text" NOT NULL,
    "supa_table" "text" NOT NULL,
    "bubble_id" "text" NOT NULL,
    "nature" "text" NOT NULL,
    "classement" "text",
    "detail" "text",
    "premiere_passe" bigint,
    "derniere_passe" bigint,
    "premier_constat" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dernier_constat" timestamp with time zone DEFAULT "now"() NOT NULL,
    "constats_consecutifs" integer DEFAULT 1 NOT NULL,
    "constats_cumules" integer DEFAULT 1 NOT NULL,
    "resolu_le" timestamp with time zone,
    CONSTRAINT "_sync_ecart_classement_chk" CHECK ((("classement" IS NULL) OR ("classement" = ANY (ARRAY['doublon_archive'::"text", 'sans_jumeau'::"text", 'ambigu'::"text"])))),
    CONSTRAINT "_sync_ecart_nature_chk" CHECK (("nature" = ANY (ARRAY['fantome'::"text", 'manquante'::"text", 'perimee'::"text"])))
);


ALTER TABLE "public"."_sync_ecart" OWNER TO "postgres";


COMMENT ON TABLE "public"."_sync_ecart" IS 'Écarts constatés entre le miroir et Bubble. Un écart n''est CONFIRMÉ que si resolu_le IS NULL, constats_consecutifs >= 2, et derniere_passe pointe la dernière passe complete. Ne jamais supprimer une ligne non résolue.';



COMMENT ON COLUMN "public"."_sync_ecart"."constats_consecutifs" IS '1 = non confirmé, n''en tirer AUCUNE conclusion et surtout ne rien supprimer.';



CREATE SEQUENCE IF NOT EXISTS "public"."_sync_ecart_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."_sync_ecart_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."_sync_ecart_id_seq" OWNED BY "public"."_sync_ecart"."id";



CREATE TABLE IF NOT EXISTS "public"."_sync_passe" (
    "id" bigint NOT NULL,
    "debut" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fin" timestamp with time zone,
    "types_demandes" integer DEFAULT 0 NOT NULL,
    "types_analyses" integer DEFAULT 0 NOT NULL,
    "complete" boolean DEFAULT false NOT NULL,
    "incidents" "text"
);


ALTER TABLE "public"."_sync_passe" OWNER TO "postgres";


COMMENT ON TABLE "public"."_sync_passe" IS 'Une ligne par exécution de reconcilier_periodique.py. Seule une passe complete=true peut servir à confirmer un écart.';



CREATE SEQUENCE IF NOT EXISTS "public"."_sync_passe_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."_sync_passe_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."_sync_passe_id_seq" OWNED BY "public"."_sync_passe"."id";



CREATE TABLE IF NOT EXISTS "public"."_sync_quarantine" (
    "id" bigint NOT NULL,
    "type_name" "text" NOT NULL,
    "bubble_id" "text" NOT NULL,
    "modified_date" timestamp with time zone,
    "motif" "text",
    "detecte_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."_sync_quarantine" OWNER TO "postgres";


COMMENT ON TABLE "public"."_sync_quarantine" IS 'Fiches sautées par le garde-fou anti-blocage du sync. Append-only : ne jamais UPDATE, ne jamais purger sans avoir traité la ligne.';



CREATE SEQUENCE IF NOT EXISTS "public"."_sync_quarantine_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."_sync_quarantine_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."_sync_quarantine_id_seq" OWNED BY "public"."_sync_quarantine"."id";



CREATE TABLE IF NOT EXISTS "public"."_sync_state" (
    "type_name" "text" NOT NULL,
    "supa_table" "text" NOT NULL,
    "last_modified" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_cursor" integer DEFAULT 0 NOT NULL,
    "last_run_at" timestamp with time zone,
    "last_run_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "items_synced" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    CONSTRAINT "_sync_state_status_chk" CHECK (("last_run_status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'ok'::"text", 'partial'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."_sync_state" OWNER TO "postgres";


COMMENT ON TABLE "public"."_sync_state" IS 'État du sync incrémental Bubble→Supabase piloté par n8n. Une ligne par data type.';



COMMENT ON COLUMN "public"."_sync_state"."last_modified" IS 'Watermark = max(Modified Date) déjà sync. NOW() au seed pour ne pas refaire l''initial.';



COMMENT ON COLUMN "public"."_sync_state"."last_cursor" IS '> 0 si le dernier run a été coupé par le watchdog mi-pagination ; reprend là.';



CREATE TABLE IF NOT EXISTS "public"."analyse" (
    "id" "text" NOT NULL,
    "description" "text",
    "mandat_id" "text",
    "niveau" "text",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."analyse" OWNER TO "postgres";


COMMENT ON TABLE "public"."analyse" IS 'Bubble: analyse — Analyses de mandat (3 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."business_maker" (
    "id" "text" NOT NULL,
    "candidat_id" "text",
    "prenom" "text",
    "nom" "text",
    "email" "text",
    "company_label" "text",
    "picture_url" "text",
    "siret" "text",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."business_maker" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_maker" IS 'Bubble: business_maker — Apporteurs d''affaires (7 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."candidat" (
    "id" "text" NOT NULL,
    "nom" "text",
    "prenom" "text",
    "prenom_lower" "text",
    "nom_lower" "text",
    "email_perso" "text",
    "linkedin" "text",
    "telephone" "text",
    "photo_url" "text",
    "cv_url" "text",
    "portfolio_file_url" "text",
    "genre" "text",
    "niveau_anglais" "text",
    "univers" "text",
    "opento" "text",
    "metier_actuel" "text",
    "statut" "text",
    "mindset" "text",
    "emoji_statut" "text",
    "contrat_actuel" "text",
    "salaire_max_souhait" numeric,
    "salaire_min_souhait" numeric,
    "tjm_max_souhait" numeric,
    "tjm_min_souhait" numeric,
    "est_qualifie" boolean DEFAULT false NOT NULL,
    "localisations" "jsonb",
    "localisations_filtre" "text",
    "experience_id" "text",
    "job_actuel_id" "text",
    "job_reve_id" "text",
    "business_maker_id" "text",
    "ajout_par_id" "text",
    "agent_pachamama_id" "text",
    "early_stage" "text",
    "grandes_ecoles" "text",
    "pachamama_like" "text",
    "pachamama_personnalite" "text",
    "note_interne" "text",
    "portfolio" "text",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."candidat" OWNER TO "postgres";


COMMENT ON TABLE "public"."candidat" IS 'Bubble: candidat — Talents (47 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."candidat_contrat" (
    "candidat_id" "text" NOT NULL,
    "contrat" "text" NOT NULL
);


ALTER TABLE "public"."candidat_contrat" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidat_expanded" (
    "id" "text" NOT NULL,
    "candidat_id" "text",
    "agent_id" "text",
    "is_complete" boolean DEFAULT false NOT NULL,
    "contrat" "text",
    "ecole" "text",
    "emoji" "text",
    "mindset" "text",
    "perso" "text",
    "portfolio" "text",
    "stage" "text",
    "statut" "text",
    "note_1" "text",
    "note_2" "text",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."candidat_expanded" OWNER TO "postgres";


COMMENT ON TABLE "public"."candidat_expanded" IS 'Bubble: candidat_expanded — Extension du profil candidat (13 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."candidat_expertise" (
    "candidat_id" "text" NOT NULL,
    "expertise" "text" NOT NULL
);


ALTER TABLE "public"."candidat_expertise" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidat_jobtype" (
    "candidat_id" "text" NOT NULL,
    "jobtype" "text" NOT NULL
);


ALTER TABLE "public"."candidat_jobtype" OWNER TO "postgres";


COMMENT ON TABLE "public"."candidat_jobtype" IS 'M2M: candidat.jobtype_list — OS jobtype_os non retrouvé dans les 59 OS';



CREATE TABLE IF NOT EXISTS "public"."candidat_mandat" (
    "candidat_id" "text" NOT NULL,
    "mandat_id" "text" NOT NULL
);


ALTER TABLE "public"."candidat_mandat" OWNER TO "postgres";


COMMENT ON TABLE "public"."candidat_mandat" IS 'M2M: candidat.jobs ↔ mandat.candidats (relation bidirectionnelle)';



CREATE TABLE IF NOT EXISTS "public"."candidat_note" (
    "candidat_id" "text" NOT NULL,
    "note_id" "text" NOT NULL
);


ALTER TABLE "public"."candidat_note" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidat_profile" (
    "candidat_id" "text" NOT NULL,
    "profile" "text" NOT NULL
);


ALTER TABLE "public"."candidat_profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidat_remote" (
    "candidat_id" "text" NOT NULL,
    "remote" "text" NOT NULL
);


ALTER TABLE "public"."candidat_remote" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidat_secteur" (
    "candidat_id" "text" NOT NULL,
    "secteur" "text" NOT NULL
);


ALTER TABLE "public"."candidat_secteur" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidat_tag" (
    "candidat_id" "text" NOT NULL,
    "tag_id" "text" NOT NULL
);


ALTER TABLE "public"."candidat_tag" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_template" (
    "id" "text" NOT NULL,
    "label" "text",
    "subject" "text",
    "body" "text",
    "is_agent_firstname" boolean DEFAULT false NOT NULL,
    "is_agent_lastname" boolean DEFAULT false NOT NULL,
    "is_company_name" boolean DEFAULT false NOT NULL,
    "is_firstname" boolean DEFAULT false NOT NULL,
    "is_custom" boolean DEFAULT false NOT NULL,
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."email_template" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_template" IS 'Bubble: email_template — Modèles d''email (8 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."entreprise" (
    "id" "text" NOT NULL,
    "nom" "text",
    "description" "text",
    "fondateur" "text",
    "serie" "text",
    "site_internet" "text",
    "siret" "text",
    "video" "text",
    "note" "text",
    "email_facturation" "text",
    "nom_structure_facturation" "text",
    "exclu_details" "text",
    "logo_url" "text",
    "localisation" "jsonb",
    "nb_employes" integer,
    "nb_techs" integer,
    "success_fee_pct" numeric(5,2),
    "success_fee_abs" numeric(12,2),
    "success_fee_is_absolute" boolean DEFAULT false NOT NULL,
    "apport_affaires" boolean DEFAULT false NOT NULL,
    "apport_affaires_pct" numeric(5,2),
    "exclu" boolean DEFAULT false NOT NULL,
    "duree_exclusivite_semaines" smallint,
    "nb_mois_garantie" smallint,
    "date_signature_contrat" timestamp with time zone,
    "date_fin_contrat" timestamp with time zone,
    "secteur" "text",
    "product_type" "text",
    "type_entreprise" "text",
    "statut" "text",
    "statut_contrat" "text",
    "formule" "text",
    "agence" "text",
    "niveau_anglais" "text",
    "recommandation" "text",
    "garantie" "text",
    "paiement" "text",
    "agent_en_charge_id" "text",
    "produit_id" "text",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text",
    CONSTRAINT "entreprise_garantie_check" CHECK (("garantie" = ANY (ARRAY['Remplacement'::"text", 'Remboursement'::"text"]))),
    CONSTRAINT "entreprise_paiement_check" CHECK (("paiement" = ANY (ARRAY['Sign date'::"text", 'Start date'::"text"])))
);


ALTER TABLE "public"."entreprise" OWNER TO "postgres";


COMMENT ON TABLE "public"."entreprise" IS 'Bubble: entreprise — Clients Pachamama (42 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."entreprise_mandat" (
    "entreprise_id" "text" NOT NULL,
    "mandat_id" "text" NOT NULL
);


ALTER TABLE "public"."entreprise_mandat" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entreprise_note" (
    "entreprise_id" "text" NOT NULL,
    "note_id" "text" NOT NULL
);


ALTER TABLE "public"."entreprise_note" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entreprise_remote" (
    "entreprise_id" "text" NOT NULL,
    "remote" "text" NOT NULL
);


ALTER TABLE "public"."entreprise_remote" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entreprise_tag" (
    "entreprise_id" "text" NOT NULL,
    "tag_id" "text" NOT NULL
);


ALTER TABLE "public"."entreprise_tag" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipe" (
    "id" "text" NOT NULL,
    "nom" "text",
    "prenom" "text",
    "email" "text",
    "description" "text",
    "photo_url" "text",
    "contact_principal" boolean DEFAULT false NOT NULL,
    "metier" "text",
    "univers" "text",
    "type_equipe" "text",
    "mandat_id" "text",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text",
    CONSTRAINT "equipe_type_equipe_check" CHECK (("type_equipe" = ANY (ARRAY['Manager'::"text", 'Recruteur'::"text"])))
);


ALTER TABLE "public"."equipe" OWNER TO "postgres";


COMMENT ON TABLE "public"."equipe" IS 'Bubble: equipe — Contacts client sur un mandat (10 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."experience" (
    "id" "text" NOT NULL,
    "candidat_id" "text",
    "entreprise_id" "text",
    "xp_pro" timestamp with time zone,
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."experience" OWNER TO "postgres";


COMMENT ON TABLE "public"."experience" IS 'Bubble: experience — Expérience pro du candidat (8 champs + 5 système). Listes option → M2M.';



CREATE TABLE IF NOT EXISTS "public"."experience_background" (
    "experience_id" "text" NOT NULL,
    "background" "text" NOT NULL
);


ALTER TABLE "public"."experience_background" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."experience_expertise" (
    "experience_id" "text" NOT NULL,
    "expertise" "text" NOT NULL
);


ALTER TABLE "public"."experience_expertise" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."experience_product" (
    "experience_id" "text" NOT NULL,
    "product" "text" NOT NULL
);


ALTER TABLE "public"."experience_product" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."experience_profile" (
    "experience_id" "text" NOT NULL,
    "profile" "text" NOT NULL
);


ALTER TABLE "public"."experience_profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."experience_secteur" (
    "experience_id" "text" NOT NULL,
    "secteur" "text" NOT NULL
);


ALTER TABLE "public"."experience_secteur" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_actuel" (
    "id" "text" NOT NULL,
    "entreprise_nom" "text",
    "candidat_id" "text",
    "entreprise_id" "text",
    "metier" "text",
    "univers" "text",
    "pourquoi" "text",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."job_actuel" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_actuel" IS 'Bubble: job_actuel — Poste actuel du candidat (6 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."job_reve" (
    "id" "text" NOT NULL,
    "candidat_id" "text",
    "metier" "text",
    "univers" "text",
    "description" "text",
    "disponibilite" "text",
    "info_localisation" "text",
    "infos_salaire" "text",
    "salaire" numeric,
    "salaire_maximum" numeric,
    "tjm_minimum" numeric,
    "tjm_maximum" numeric,
    "localisations" "jsonb",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."job_reve" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_reve" IS 'Bubble: job_reve — Job idéal du candidat (17 champs + 5 système). Listes option → M2M.';



CREATE TABLE IF NOT EXISTS "public"."job_reve_contrat" (
    "job_reve_id" "text" NOT NULL,
    "contrat" "text" NOT NULL
);


ALTER TABLE "public"."job_reve_contrat" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_reve_critere" (
    "job_reve_id" "text" NOT NULL,
    "critere" "text" NOT NULL
);


ALTER TABLE "public"."job_reve_critere" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_reve_remote" (
    "job_reve_id" "text" NOT NULL,
    "remote" "text" NOT NULL
);


ALTER TABLE "public"."job_reve_remote" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_reve_secteur" (
    "job_reve_id" "text" NOT NULL,
    "secteur" "text" NOT NULL
);


ALTER TABLE "public"."job_reve_secteur" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_reve_secteur_nogo" (
    "job_reve_id" "text" NOT NULL,
    "secteur" "text" NOT NULL
);


ALTER TABLE "public"."job_reve_secteur_nogo" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_reve_secteur_nogo" IS 'M2M: job_reve.nogo_list — secteurs exclus par le candidat';



CREATE TABLE IF NOT EXISTS "public"."mandat" (
    "id" "text" NOT NULL,
    "titre" "text",
    "description" "text",
    "description_manager" "text",
    "description_produit" "text",
    "missions" "text",
    "process_recrutement" "text",
    "pour_toi" "text",
    "pas_pour_toi" "text",
    "remote_infos" "text",
    "salaire_infos" "text",
    "format_mission" "text",
    "duree_mission" "text",
    "date_demarrage_mission" "text",
    "video_youtube" "text",
    "salaire_max" numeric,
    "salaire_min" numeric,
    "tjm_max" numeric,
    "tjm_min" numeric,
    "min_xp" smallint,
    "z_legacy_number" integer,
    "delivery" smallint,
    "discovery" smallint,
    "strategie" smallint,
    "ops" smallint,
    "management" smallint,
    "status_sort_order" smallint,
    "kickoff" timestamp with time zone,
    "job_anonyme" boolean DEFAULT false NOT NULL,
    "job_off_market" boolean DEFAULT false NOT NULL,
    "univers" "text",
    "metier" "text",
    "contrat" "text",
    "statut" "text",
    "equity" "text",
    "contributor_type" "text",
    "visibilite" "text",
    "exclu_pachamama" "text",
    "type_deal" "text",
    "source_marketing" "text",
    "lead_apporteur" "text",
    "entreprise_id" "text",
    "manager_id" "text",
    "recruteur_id" "text",
    "business_maker_id" "text",
    "personne_en_charge_id" "text",
    "agent_2_id" "text",
    "account_manager_id" "text",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text",
    CONSTRAINT "mandat_equity_check" CHECK (("equity" = ANY (ARRAY['actions gratuites'::"text", 'bspce'::"text", 'peut-être plus tard'::"text", 'non'::"text"]))),
    CONSTRAINT "mandat_exclu_pachamama_check" CHECK (("exclu_pachamama" = ANY (ARRAY['Oui'::"text", 'Non'::"text"]))),
    CONSTRAINT "mandat_type_deal_check" CHECK (("type_deal" = ANY (ARRAY['New Business'::"text", 'Existing Business'::"text"])))
);


ALTER TABLE "public"."mandat" OWNER TO "postgres";


COMMENT ON TABLE "public"."mandat" IS 'Bubble: mandat — Offres d''emploi / missions (55 champs + 5 système). Listes option → M2M.';



CREATE TABLE IF NOT EXISTS "public"."mandat_analyse" (
    "mandat_id" "text" NOT NULL,
    "analyse_id" "text" NOT NULL
);


ALTER TABLE "public"."mandat_analyse" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mandat_cible" (
    "mandat_id" "text" NOT NULL,
    "cible" "text" NOT NULL
);


ALTER TABLE "public"."mandat_cible" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mandat_equipe" (
    "mandat_id" "text" NOT NULL,
    "equipe_id" "text" NOT NULL
);


ALTER TABLE "public"."mandat_equipe" OWNER TO "postgres";


COMMENT ON TABLE "public"."mandat_equipe" IS 'M2M: mandat.contacts_list_custom_equipe';



CREATE TABLE IF NOT EXISTS "public"."mandat_note" (
    "mandat_id" "text" NOT NULL,
    "note_id" "text" NOT NULL
);


ALTER TABLE "public"."mandat_note" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mandat_remote" (
    "mandat_id" "text" NOT NULL,
    "remote" "text" NOT NULL
);


ALTER TABLE "public"."mandat_remote" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mandat_tag_job" (
    "mandat_id" "text" NOT NULL,
    "tag_job" "text" NOT NULL
);


ALTER TABLE "public"."mandat_tag_job" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mandatclose" (
    "id" "text" NOT NULL,
    "candidat_id" "text",
    "entreprise_id" "text",
    "mandat_id" "text",
    "process_id" "text",
    "split_id" "text",
    "business_maker_coo_id" "text",
    "business_maker_deal_id" "text",
    "univers" "text",
    "contributor_type" "text",
    "contrat" "text",
    "statut_contrat_freelance" "text",
    "statut_contrat_entreprise" "text",
    "date_closing" timestamp with time zone,
    "date_debut" timestamp with time zone,
    "date_fin_garantie" timestamp with time zone,
    "date_fin_mission" timestamp with time zone,
    "salaire_final" numeric(12,2),
    "commission" numeric(12,2),
    "commission_nette" numeric(12,2),
    "apport_affaires_k" numeric(12,2),
    "cooptation_talent" numeric(12,2),
    "tjm_final_marge_inclus" numeric(12,2),
    "tjm_final_talent" numeric(12,2),
    "note_user_ids" "text"[],
    "est_archive" boolean DEFAULT false NOT NULL,
    "agent_filtre_id" "text",
    "agent_2_filtre_id" "text",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."mandatclose" OWNER TO "postgres";


COMMENT ON TABLE "public"."mandatclose" IS 'Bubble: mandatclose — Placements réussis (28 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."mandatclose_note" (
    "mandatclose_id" "text" NOT NULL,
    "note_id" "text" NOT NULL
);


ALTER TABLE "public"."mandatclose_note" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mandate_closed_split" (
    "id" "text" NOT NULL,
    "mandatclose_id" "text",
    "agent_1_com" numeric(12,2),
    "agent_1_com_pct" numeric(5,2),
    "agent_1_com_is_absolute" boolean DEFAULT false NOT NULL,
    "agent_2_com" numeric(12,2),
    "agent_2_com_pct" numeric(5,2),
    "agent_2_com_is_absolute" boolean DEFAULT false NOT NULL,
    "bus_maker_coo_com" numeric(12,2),
    "bus_maker_coo_com_pct" numeric(5,2),
    "bus_maker_deal_com" numeric(12,2),
    "bus_maker_deal_com_pct" numeric(5,2),
    "pacha_com" numeric(12,2),
    "pacha_com_pct" numeric(5,2),
    "net" numeric(12,2),
    "net_pct" numeric(5,2),
    "total" numeric(12,2),
    "total_pct" numeric(5,2),
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."mandate_closed_split" OWNER TO "postgres";


COMMENT ON TABLE "public"."mandate_closed_split" IS 'Bubble: mandate_closed_split — Répartition des commissions (17 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."note" (
    "id" "text" NOT NULL,
    "commentaire" "text",
    "date_note" timestamp with time zone,
    "note_automatique" boolean DEFAULT false NOT NULL,
    "candidat_id" "text",
    "entreprise_id" "text",
    "mandat_id" "text",
    "mandatclose_id" "text",
    "note_event" "text",
    "note_event_type" "text",
    "note_event_value_new" "text",
    "note_event_value_prev" "text",
    "user_id" "text",
    "note_user_tag_id" "text",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text",
    CONSTRAINT "note_note_event_type_check" CHECK (("note_event_type" = ANY (ARRAY['contract'::"text", 'info'::"text", 'archive'::"text", 'task'::"text", 'team'::"text"])))
);


ALTER TABLE "public"."note" OWNER TO "postgres";


COMMENT ON TABLE "public"."note" IS 'Bubble: note — Notes internes (13 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."note_archivee" (
    "id" "text" NOT NULL,
    "commentaire" "text",
    "date_note" timestamp with time zone,
    "note_automatique" boolean DEFAULT false NOT NULL,
    "candidat_id" "text",
    "entreprise_id" "text",
    "mandat_id" "text",
    "mandatclose_id" "text",
    "user_id" "text",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."note_archivee" OWNER TO "postgres";


COMMENT ON TABLE "public"."note_archivee" IS 'Bubble: note_archivee — Notes archivées (8 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."nps_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bubble_contact_id" "text" NOT NULL,
    "bubble_mandat_id" "text" NOT NULL,
    "contact_email" "text" NOT NULL,
    "contact_firstname" "text",
    "job_title" "text",
    "company_name" "text",
    "candidate_firstname" "text",
    "nps_type" "text",
    "status" "text" DEFAULT 'sent'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "responded_at" timestamp with time zone,
    "reminder_sent_at" timestamp with time zone,
    CONSTRAINT "nps_tracking_nps_type_check" CHECK (("nps_type" = ANY (ARRAY['close'::"text", 'termine'::"text"]))),
    CONSTRAINT "nps_tracking_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'reminded'::"text", 'responded'::"text", 'ignored'::"text"])))
);


ALTER TABLE "public"."nps_tracking" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."process" (
    "id" "text" NOT NULL,
    "candidat_id" "text",
    "mandat_id" "text",
    "entreprise_id" "text",
    "etape" "text",
    "description" "text",
    "pachamama_like" "text",
    "pachamama_personnalite" "text",
    "plus_par_rapport_mission" "text",
    "moins_par_rapport_mission" "text",
    "infos_remuneration" "text",
    "salaire_minimum" numeric,
    "salaire_souhaite" numeric,
    "tjm_minimum" numeric,
    "tjm_souhaite" numeric,
    "date_statut_applicant" timestamp with time zone,
    "date_statut_ko" timestamp with time zone,
    "date_update_etape" timestamp with time zone,
    "next_step_date" timestamp with time zone,
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."process" OWNER TO "postgres";


COMMENT ON TABLE "public"."process" IS 'Bubble: process — Pipeline de recrutement candidat×mandat (19 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."process_mandatclose" (
    "process_id" "text" NOT NULL,
    "mandatclose_id" "text" NOT NULL
);


ALTER TABLE "public"."process_mandatclose" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."produit" (
    "id" "text" NOT NULL,
    "description" "text",
    "entreprise_id" "text",
    "maturite" "text",
    "txt_explicatif" "text",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."produit" OWNER TO "postgres";


COMMENT ON TABLE "public"."produit" IS 'Bubble: produit — Description produit de l''entreprise (4 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."ref_app_branding" (
    "value" "text" NOT NULL,
    "background_asset1" "text",
    "background_asset2" "text",
    "background_image" "text",
    "logo_url" "text",
    "logo_mini_url" "text",
    "police" "text",
    "web_site" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_app_branding" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_app_branding" IS 'OS: App_Branding — 1 option (Pachamama)';



CREATE TABLE IF NOT EXISTS "public"."ref_apporteur_affaires" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_apporteur_affaires" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_apporteur_affaires" IS 'OS: Z_Apporteur_Affaires_OS (alias apporteur_affaires_os) — 3 options';



CREATE TABLE IF NOT EXISTS "public"."ref_background" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_background" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_background" IS 'OS: Background_OS (alias background_talent_os) — 4 options';



CREATE TABLE IF NOT EXISTS "public"."ref_cible" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_cible" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_cible" IS 'OS: Cible_OS — 4 options (B2B, B2B2C, B2C, Users internes)';



CREATE TABLE IF NOT EXISTS "public"."ref_company_type" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_company_type" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_company_type" IS 'OS: Company_type_OS — 5 options';



CREATE TABLE IF NOT EXISTS "public"."ref_contract_status" (
    "value" "text" NOT NULL,
    "couleur" "text",
    "signature_required" boolean DEFAULT false NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_contract_status" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_contract_status" IS 'OS: OS Contract_status (alias contrat_statut_os) — 5 options';



CREATE TABLE IF NOT EXISTS "public"."ref_contrat" (
    "value" "text" NOT NULL,
    "color" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_contrat" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_contrat" IS 'OS: Contrat_OS — 2 options (CDI, Freelance) avec couleur';



CREATE TABLE IF NOT EXISTS "public"."ref_contributor_type" (
    "value" "text" NOT NULL,
    "full_display" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_contributor_type" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_contributor_type" IS 'OS: Contributor_type_OS — 4 entrées (IC ×2, Manager/C-level ×2 — doublons à nettoyer)';



CREATE TABLE IF NOT EXISTS "public"."ref_criteres" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_criteres" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_criteres" IS 'OS: Critères_OS (alias crit_res_os) — 32 options';



CREATE TABLE IF NOT EXISTS "public"."ref_email_config" (
    "value" "text" NOT NULL,
    "email_adresses" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_email_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_email_config" IS 'OS: Email_OS — 1 option (Emails Test)';



CREATE TABLE IF NOT EXISTS "public"."ref_emoji" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_emoji" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_emoji" IS 'OS: Emoji_OS (alias emoji_candidat_os) — 4 options';



CREATE TABLE IF NOT EXISTS "public"."ref_expertise" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_expertise" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_expertise" IS 'OS: Expertise_OS — 31 options (GenAI, NoCode, Growth, etc.)';



CREATE TABLE IF NOT EXISTS "public"."ref_expertise_univers" (
    "expertise_value" "text" NOT NULL,
    "univers_value" "text" NOT NULL
);


ALTER TABLE "public"."ref_expertise_univers" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_expertise_univers" IS 'M2M: Expertise_OS.univers → list of Univers_OS';



CREATE TABLE IF NOT EXISTS "public"."ref_fonction" (
    "value" "text" NOT NULL,
    "label_en" "text",
    "label_fr" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_fonction" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_fonction" IS 'OS: Fonction_OS (alias fonctions_os) — 2 options (career_agent, recruiter)';



CREATE TABLE IF NOT EXISTS "public"."ref_form_41" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_form_41" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_form_41" IS 'OS: Form_Entreprise_4.1_OS — 5 options';



CREATE TABLE IF NOT EXISTS "public"."ref_form_42" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_form_42" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_form_42" IS 'OS: Form_Entreprise_4.2_OS — 6 options';



CREATE TABLE IF NOT EXISTS "public"."ref_formule" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_formule" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_formule" IS 'OS: Formule_OS — 4 options';



CREATE TABLE IF NOT EXISTS "public"."ref_gender" (
    "value" "text" NOT NULL,
    "label_en" "text",
    "label_fr" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_gender" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_gender" IS 'OS: OS Gender (alias genre_os) — 3 options';



CREATE TABLE IF NOT EXISTS "public"."ref_image" (
    "value" "text" NOT NULL,
    "file_url" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_image" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_image" IS 'OS: OS Image — 1 option (mail_signature)';



CREATE TABLE IF NOT EXISTS "public"."ref_language" (
    "value" "text" NOT NULL,
    "label" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_language" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_language" IS 'OS: OS Language — 2 options (en_us, fr_fr)';



CREATE TABLE IF NOT EXISTS "public"."ref_mandate_status" (
    "value" "text" NOT NULL,
    "status_admin_label" "text",
    "status_color" "text",
    "status_sort_order" smallint,
    "sort_order" integer
);


ALTER TABLE "public"."ref_mandate_status" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_mandate_status" IS 'OS: OS Mandate_status — 4 options (Nouveau, En cours, Terminé, Closé par Pachamama)';



CREATE TABLE IF NOT EXISTS "public"."ref_mandate_visibility" (
    "value" "text" NOT NULL,
    "label_fr" "text",
    "tooltip_icon" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_mandate_visibility" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_mandate_visibility" IS 'OS: OS Mandate_visibility (alias visibilit__job_os) — 3 options';



CREATE TABLE IF NOT EXISTS "public"."ref_maturite_produit" (
    "value" "text" NOT NULL,
    "image_url" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_maturite_produit" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_maturite_produit" IS 'OS: Maturité_Produit_OS — 5 options (A→E)';



CREATE TABLE IF NOT EXISTS "public"."ref_metier" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_metier" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_metier" IS 'OS: Métier_OS (alias poste_os) — 273 options (273 entrées, 238 uniques — doublons à nettoyer)';



CREATE TABLE IF NOT EXISTS "public"."ref_metier_univers" (
    "metier_value" "text" NOT NULL,
    "univers_value" "text" NOT NULL
);


ALTER TABLE "public"."ref_metier_univers" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_metier_univers" IS 'M2M: Métier_OS.univers → list of Univers_OS';



CREATE TABLE IF NOT EXISTS "public"."ref_mindset" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_mindset" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_mindset" IS 'OS: Mindset_OS (alias satisfait_os) — 5 options';



CREATE TABLE IF NOT EXISTS "public"."ref_niveau_analyse" (
    "value" "text" NOT NULL,
    "color" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_niveau_analyse" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_niveau_analyse" IS 'OS: Niveau_Analyse_OS — 3 options (Bien, Moyen, Vigilance)';



CREATE TABLE IF NOT EXISTS "public"."ref_niveau_anglais" (
    "value" "text" NOT NULL,
    "candidat_display" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_niveau_anglais" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_niveau_anglais" IS 'OS: Niveau_Anglais_OS (alias anglais_os) — 4 options';



CREATE TABLE IF NOT EXISTS "public"."ref_note_event" (
    "value" "text" NOT NULL,
    "note_event_text" "text",
    "note_event_type" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_note_event" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_note_event" IS 'OS: OS Note_event — 24 options';



CREATE TABLE IF NOT EXISTS "public"."ref_note_event_type" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_note_event_type" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_note_event_type" IS 'OS: OS Note_event_type — 5 options (contract, info, archive, task, team)';



CREATE TABLE IF NOT EXISTS "public"."ref_process_etape" (
    "value" "text" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "is_in_kanban_view_company" boolean DEFAULT false NOT NULL,
    "is_in_kanban_view_pachamama" boolean DEFAULT false NOT NULL,
    "is_ko" boolean DEFAULT false NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "kanban_column_color" "text",
    "kanban_tag_color" "text",
    "public_display" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_process_etape" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_process_etape" IS 'OS: Process_Etape_OS (alias process_os) — 14 options';



CREATE TABLE IF NOT EXISTS "public"."ref_product" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_product" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_product" IS 'OS: Product_OS (alias product_talent_os) — 6 options';



CREATE TABLE IF NOT EXISTS "public"."ref_product_type" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_product_type" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_product_type" IS 'OS: Product_Type_OS (alias producttype_os) — 9 options';



CREATE TABLE IF NOT EXISTS "public"."ref_profile" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_profile" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_profile" IS 'OS: Profile_OS (alias profile_talent_os) — 4 options';



CREATE TABLE IF NOT EXISTS "public"."ref_remote" (
    "value" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_remote" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_remote" IS 'OS: Remote_OS (alias rythme_os) — 4 options (Hybride, Full Remote France/Europe/Worldwide)';



CREATE TABLE IF NOT EXISTS "public"."ref_role" (
    "value" "text" NOT NULL,
    "role_category" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_role" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_role" IS 'OS: Role_OS — 5 options (Admin, Candidat, Entreprise, Recruiter Core Team, Recruiter Support Crew)';



CREATE TABLE IF NOT EXISTS "public"."ref_role_category" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_role_category" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_role_category" IS 'OS: OS Role_category — 1 option (recruiter)';



CREATE TABLE IF NOT EXISTS "public"."ref_secteur" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_secteur" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_secteur" IS 'OS: Secteur_OS — 52 options (Adtech, Fintech, etc.)';



CREATE TABLE IF NOT EXISTS "public"."ref_sendgrid_template" (
    "value" "text" NOT NULL,
    "id_sendgrid" "text",
    "visible_pour_mandat" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_sendgrid_template" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_sendgrid_template" IS 'OS: Sendgrid_Template_OS — 6 options';



CREATE TABLE IF NOT EXISTS "public"."ref_slack_channel" (
    "value" "text" NOT NULL,
    "webhook" "text",
    "webhook_test" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_slack_channel" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_slack_channel" IS 'OS: OS Slack_channel — 2 options';



CREATE TABLE IF NOT EXISTS "public"."ref_source_marketing" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_source_marketing" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_source_marketing" IS 'OS: Z_Source_Marketing_OS — 12 options';



CREATE TABLE IF NOT EXISTS "public"."ref_statut_candidat" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_statut_candidat" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_statut_candidat" IS 'OS: Statut_Candidat_OS (alias statutcandidat_os) — 5 options';



CREATE TABLE IF NOT EXISTS "public"."ref_tag_job" (
    "value" "text" NOT NULL,
    "icone_url" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_tag_job" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_tag_job" IS 'OS: Tag_Job_OS (alias tagsjob_os) — 15 options';



CREATE TABLE IF NOT EXISTS "public"."ref_task_anchor" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_task_anchor" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_task_anchor" IS 'OS: OS Task_anchor — 3 options (creation_date, contract_start_date, guarantee_end_date)';



CREATE TABLE IF NOT EXISTS "public"."ref_task_event" (
    "value" "text" NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_task_event" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_task_event" IS 'OS: OS Task_event — 2 options (mandate_clo_free, mandate_clo_cdi)';



CREATE TABLE IF NOT EXISTS "public"."ref_task_type" (
    "value" "text" NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL,
    "relative_time" smallint,
    "task_anchor" "text",
    "task_event" "text",
    "task_text" "text",
    "sort_order" integer
);


ALTER TABLE "public"."ref_task_type" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_task_type" IS 'OS: OS Task_type (alias os_task_type) — 12 options';



CREATE TABLE IF NOT EXISTS "public"."ref_univers" (
    "value" "text" NOT NULL,
    "color" "text",
    "secondary_color" "text",
    "logo_url" "text",
    "logo_mini_url" "text",
    "talent_card_url" "text",
    "is_live" boolean DEFAULT false NOT NULL,
    "sort_order" integer
);


ALTER TABLE "public"."ref_univers" OWNER TO "postgres";


COMMENT ON TABLE "public"."ref_univers" IS 'OS: Univers_OS — 8 options (Product, Tech, Design, Data, Finance, People & Finance, Marketing, Sales)';



CREATE TABLE IF NOT EXISTS "public"."tag" (
    "id" "text" NOT NULL,
    "nom" "text",
    "description" "text",
    "type_tag" "text",
    "entreprise_id" "text",
    "mandat_id" "text",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text",
    CONSTRAINT "tag_type_tag_check" CHECK (("type_tag" = ANY (ARRAY['Candidat'::"text", 'Entreprise'::"text", 'Job'::"text"])))
);


ALTER TABLE "public"."tag" OWNER TO "postgres";


COMMENT ON TABLE "public"."tag" IS 'Bubble: tag — Tags sur candidats/entreprises/jobs (6 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."task" (
    "id" "text" NOT NULL,
    "task_text" "text",
    "is_complete" boolean DEFAULT false NOT NULL,
    "creation_date" timestamp with time zone,
    "due_date" timestamp with time zone,
    "task_type" "text",
    "mandatclose_id" "text",
    "task_notif_id" "text",
    "creation_user_id" "text",
    "update_user_id" "text",
    "assigned_user_id" "text",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."task" OWNER TO "postgres";


COMMENT ON TABLE "public"."task" IS 'Bubble: task — Tâches automatiques (10 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."task_notif" (
    "id" "text" NOT NULL,
    "task_id" "text",
    "is_sent" boolean DEFAULT false NOT NULL,
    "preview_text" "text",
    "sent_email" "text",
    "sent_text" "text",
    "wf_date" timestamp with time zone,
    "wf_id" "text",
    "task_type" "text",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."task_notif" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_notif" IS 'Bubble: task_notif — Notifications de tâches (8 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."user" (
    "id" "text" NOT NULL,
    "auth_id" "uuid",
    "nom" "text",
    "prenom" "text",
    "photo_url" "text",
    "candidat_id" "text",
    "entreprise_id" "text",
    "fonction" "text",
    "langue" "text",
    "user_lang" "text",
    "email_confirmed" boolean DEFAULT false NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "popup_pas_de_nouvelles" boolean DEFAULT true,
    "popup_trouve_bonheur" boolean DEFAULT true,
    "premiere_connexion_at" timestamp with time zone,
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user" OWNER TO "postgres";


COMMENT ON TABLE "public"."user" IS 'Bubble: user — Agents Pachamama, candidats, contacts entreprise';



COMMENT ON COLUMN "public"."user"."id" IS 'Bubble _id (text)';



COMMENT ON COLUMN "public"."user"."auth_id" IS 'FK vers auth.users.id — lien Supabase Auth';



CREATE TABLE IF NOT EXISTS "public"."user_partner" (
    "id" "text" NOT NULL,
    "user_id" "text",
    "univers" "text",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text"
);


ALTER TABLE "public"."user_partner" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_partner" IS 'Bubble: user_partner — Association user ↔ univers partenaire (2 champs + 5 système)';



CREATE TABLE IF NOT EXISTS "public"."user_role" (
    "user_id" "text" NOT NULL,
    "role" "text" NOT NULL
);


ALTER TABLE "public"."user_role" OWNER TO "postgres";


ALTER TABLE ONLY "pivot"."conflit" ALTER COLUMN "conflit_id" SET DEFAULT "nextval"('"pivot"."conflit_conflit_id_seq"'::"regclass");



ALTER TABLE ONLY "pivot"."email" ALTER COLUMN "id" SET DEFAULT "nextval"('"pivot"."email_id_seq"'::"regclass");



ALTER TABLE ONLY "pivot"."note_journal" ALTER COLUMN "id" SET DEFAULT "nextval"('"pivot"."note_journal_id_seq"'::"regclass");



ALTER TABLE ONLY "pivot"."phone" ALTER COLUMN "id" SET DEFAULT "nextval"('"pivot"."phone_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."_fk_backup" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."_fk_backup_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."_sync_ecart" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."_sync_ecart_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."_sync_passe" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."_sync_passe_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."_sync_quarantine" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."_sync_quarantine_id_seq"'::"regclass");



ALTER TABLE ONLY "pivot"."attentes"
    ADD CONSTRAINT "attentes_pkey" PRIMARY KEY ("talent_id");



ALTER TABLE ONLY "pivot"."conflit"
    ADD CONSTRAINT "conflit_pkey" PRIMARY KEY ("conflit_id");



ALTER TABLE ONLY "pivot"."email"
    ADD CONSTRAINT "email_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "pivot"."email"
    ADD CONSTRAINT "email_talent_id_email_key" UNIQUE ("talent_id", "email");



ALTER TABLE ONLY "pivot"."note_journal"
    ADD CONSTRAINT "note_journal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "pivot"."note_journal"
    ADD CONSTRAINT "note_journal_talent_id_external_id_key" UNIQUE ("talent_id", "external_id");



ALTER TABLE ONLY "pivot"."parcours"
    ADD CONSTRAINT "parcours_pkey" PRIMARY KEY ("talent_id");



ALTER TABLE ONLY "pivot"."phone"
    ADD CONSTRAINT "phone_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "pivot"."phone"
    ADD CONSTRAINT "phone_talent_id_tel_key" UNIQUE ("talent_id", "tel");



ALTER TABLE ONLY "pivot"."qualification"
    ADD CONSTRAINT "qualification_pkey" PRIMARY KEY ("talent_id");



ALTER TABLE ONLY "pivot"."sync_etat"
    ADD CONSTRAINT "sync_etat_pkey" PRIMARY KEY ("source");



ALTER TABLE ONLY "pivot"."sync_run"
    ADD CONSTRAINT "sync_run_pkey" PRIMARY KEY ("run_id");



ALTER TABLE ONLY "pivot"."talent"
    ADD CONSTRAINT "talent_pkey" PRIMARY KEY ("talent_id");



ALTER TABLE ONLY "pivot"."talent_source"
    ADD CONSTRAINT "talent_source_pkey" PRIMARY KEY ("talent_id", "source", "external_id");



ALTER TABLE ONLY "public"."_fk_backup"
    ADD CONSTRAINT "_fk_backup_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."_sync_ecart"
    ADD CONSTRAINT "_sync_ecart_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."_sync_ecart"
    ADD CONSTRAINT "_sync_ecart_unique" UNIQUE ("supa_table", "bubble_id", "nature");



ALTER TABLE ONLY "public"."_sync_passe"
    ADD CONSTRAINT "_sync_passe_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."_sync_quarantine"
    ADD CONSTRAINT "_sync_quarantine_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."_sync_state"
    ADD CONSTRAINT "_sync_state_pkey" PRIMARY KEY ("type_name");



ALTER TABLE ONLY "public"."analyse"
    ADD CONSTRAINT "analyse_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_maker"
    ADD CONSTRAINT "business_maker_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidat_contrat"
    ADD CONSTRAINT "candidat_contrat_pkey" PRIMARY KEY ("candidat_id", "contrat");



ALTER TABLE ONLY "public"."candidat_expanded"
    ADD CONSTRAINT "candidat_expanded_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidat_expertise"
    ADD CONSTRAINT "candidat_expertise_pkey" PRIMARY KEY ("candidat_id", "expertise");



ALTER TABLE ONLY "public"."candidat_jobtype"
    ADD CONSTRAINT "candidat_jobtype_pkey" PRIMARY KEY ("candidat_id", "jobtype");



ALTER TABLE ONLY "public"."candidat_mandat"
    ADD CONSTRAINT "candidat_mandat_pkey" PRIMARY KEY ("candidat_id", "mandat_id");



ALTER TABLE ONLY "public"."candidat_note"
    ADD CONSTRAINT "candidat_note_pkey" PRIMARY KEY ("candidat_id", "note_id");



ALTER TABLE ONLY "public"."candidat"
    ADD CONSTRAINT "candidat_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidat_profile"
    ADD CONSTRAINT "candidat_profile_pkey" PRIMARY KEY ("candidat_id", "profile");



ALTER TABLE ONLY "public"."candidat_remote"
    ADD CONSTRAINT "candidat_remote_pkey" PRIMARY KEY ("candidat_id", "remote");



ALTER TABLE ONLY "public"."candidat_secteur"
    ADD CONSTRAINT "candidat_secteur_pkey" PRIMARY KEY ("candidat_id", "secteur");



ALTER TABLE ONLY "public"."candidat_tag"
    ADD CONSTRAINT "candidat_tag_pkey" PRIMARY KEY ("candidat_id", "tag_id");



ALTER TABLE ONLY "public"."email_template"
    ADD CONSTRAINT "email_template_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entreprise_mandat"
    ADD CONSTRAINT "entreprise_mandat_pkey" PRIMARY KEY ("entreprise_id", "mandat_id");



ALTER TABLE ONLY "public"."entreprise_note"
    ADD CONSTRAINT "entreprise_note_pkey" PRIMARY KEY ("entreprise_id", "note_id");



ALTER TABLE ONLY "public"."entreprise"
    ADD CONSTRAINT "entreprise_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entreprise_remote"
    ADD CONSTRAINT "entreprise_remote_pkey" PRIMARY KEY ("entreprise_id", "remote");



ALTER TABLE ONLY "public"."entreprise_tag"
    ADD CONSTRAINT "entreprise_tag_pkey" PRIMARY KEY ("entreprise_id", "tag_id");



ALTER TABLE ONLY "public"."equipe"
    ADD CONSTRAINT "equipe_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."experience_background"
    ADD CONSTRAINT "experience_background_pkey" PRIMARY KEY ("experience_id", "background");



ALTER TABLE ONLY "public"."experience_expertise"
    ADD CONSTRAINT "experience_expertise_pkey" PRIMARY KEY ("experience_id", "expertise");



ALTER TABLE ONLY "public"."experience"
    ADD CONSTRAINT "experience_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."experience_product"
    ADD CONSTRAINT "experience_product_pkey" PRIMARY KEY ("experience_id", "product");



ALTER TABLE ONLY "public"."experience_profile"
    ADD CONSTRAINT "experience_profile_pkey" PRIMARY KEY ("experience_id", "profile");



ALTER TABLE ONLY "public"."experience_secteur"
    ADD CONSTRAINT "experience_secteur_pkey" PRIMARY KEY ("experience_id", "secteur");



ALTER TABLE ONLY "public"."job_actuel"
    ADD CONSTRAINT "job_actuel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_reve_contrat"
    ADD CONSTRAINT "job_reve_contrat_pkey" PRIMARY KEY ("job_reve_id", "contrat");



ALTER TABLE ONLY "public"."job_reve_critere"
    ADD CONSTRAINT "job_reve_critere_pkey" PRIMARY KEY ("job_reve_id", "critere");



ALTER TABLE ONLY "public"."job_reve"
    ADD CONSTRAINT "job_reve_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_reve_remote"
    ADD CONSTRAINT "job_reve_remote_pkey" PRIMARY KEY ("job_reve_id", "remote");



ALTER TABLE ONLY "public"."job_reve_secteur_nogo"
    ADD CONSTRAINT "job_reve_secteur_nogo_pkey" PRIMARY KEY ("job_reve_id", "secteur");



ALTER TABLE ONLY "public"."job_reve_secteur"
    ADD CONSTRAINT "job_reve_secteur_pkey" PRIMARY KEY ("job_reve_id", "secteur");



ALTER TABLE ONLY "public"."mandat_analyse"
    ADD CONSTRAINT "mandat_analyse_pkey" PRIMARY KEY ("mandat_id", "analyse_id");



ALTER TABLE ONLY "public"."mandat_cible"
    ADD CONSTRAINT "mandat_cible_pkey" PRIMARY KEY ("mandat_id", "cible");



ALTER TABLE ONLY "public"."mandat_equipe"
    ADD CONSTRAINT "mandat_equipe_pkey" PRIMARY KEY ("mandat_id", "equipe_id");



ALTER TABLE ONLY "public"."mandat_note"
    ADD CONSTRAINT "mandat_note_pkey" PRIMARY KEY ("mandat_id", "note_id");



ALTER TABLE ONLY "public"."mandat"
    ADD CONSTRAINT "mandat_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mandat_remote"
    ADD CONSTRAINT "mandat_remote_pkey" PRIMARY KEY ("mandat_id", "remote");



ALTER TABLE ONLY "public"."mandat_tag_job"
    ADD CONSTRAINT "mandat_tag_job_pkey" PRIMARY KEY ("mandat_id", "tag_job");



ALTER TABLE ONLY "public"."mandatclose_note"
    ADD CONSTRAINT "mandatclose_note_pkey" PRIMARY KEY ("mandatclose_id", "note_id");



ALTER TABLE ONLY "public"."mandatclose"
    ADD CONSTRAINT "mandatclose_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mandate_closed_split"
    ADD CONSTRAINT "mandate_closed_split_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."note_archivee"
    ADD CONSTRAINT "note_archivee_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."note"
    ADD CONSTRAINT "note_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nps_tracking"
    ADD CONSTRAINT "nps_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."process_mandatclose"
    ADD CONSTRAINT "process_mandatclose_pkey" PRIMARY KEY ("process_id", "mandatclose_id");



ALTER TABLE ONLY "public"."process"
    ADD CONSTRAINT "process_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produit"
    ADD CONSTRAINT "produit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ref_app_branding"
    ADD CONSTRAINT "ref_app_branding_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_apporteur_affaires"
    ADD CONSTRAINT "ref_apporteur_affaires_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_background"
    ADD CONSTRAINT "ref_background_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_cible"
    ADD CONSTRAINT "ref_cible_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_company_type"
    ADD CONSTRAINT "ref_company_type_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_contract_status"
    ADD CONSTRAINT "ref_contract_status_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_contrat"
    ADD CONSTRAINT "ref_contrat_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_contributor_type"
    ADD CONSTRAINT "ref_contributor_type_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_criteres"
    ADD CONSTRAINT "ref_criteres_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_email_config"
    ADD CONSTRAINT "ref_email_config_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_emoji"
    ADD CONSTRAINT "ref_emoji_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_expertise"
    ADD CONSTRAINT "ref_expertise_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_expertise_univers"
    ADD CONSTRAINT "ref_expertise_univers_pkey" PRIMARY KEY ("expertise_value", "univers_value");



ALTER TABLE ONLY "public"."ref_fonction"
    ADD CONSTRAINT "ref_fonction_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_form_41"
    ADD CONSTRAINT "ref_form_41_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_form_42"
    ADD CONSTRAINT "ref_form_42_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_formule"
    ADD CONSTRAINT "ref_formule_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_gender"
    ADD CONSTRAINT "ref_gender_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_image"
    ADD CONSTRAINT "ref_image_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_language"
    ADD CONSTRAINT "ref_language_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_mandate_status"
    ADD CONSTRAINT "ref_mandate_status_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_mandate_visibility"
    ADD CONSTRAINT "ref_mandate_visibility_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_maturite_produit"
    ADD CONSTRAINT "ref_maturite_produit_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_metier"
    ADD CONSTRAINT "ref_metier_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_metier_univers"
    ADD CONSTRAINT "ref_metier_univers_pkey" PRIMARY KEY ("metier_value", "univers_value");



ALTER TABLE ONLY "public"."ref_mindset"
    ADD CONSTRAINT "ref_mindset_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_niveau_analyse"
    ADD CONSTRAINT "ref_niveau_analyse_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_niveau_anglais"
    ADD CONSTRAINT "ref_niveau_anglais_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_note_event"
    ADD CONSTRAINT "ref_note_event_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_note_event_type"
    ADD CONSTRAINT "ref_note_event_type_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_process_etape"
    ADD CONSTRAINT "ref_process_etape_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_product"
    ADD CONSTRAINT "ref_product_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_product_type"
    ADD CONSTRAINT "ref_product_type_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_profile"
    ADD CONSTRAINT "ref_profile_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_remote"
    ADD CONSTRAINT "ref_remote_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_role_category"
    ADD CONSTRAINT "ref_role_category_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_role"
    ADD CONSTRAINT "ref_role_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_secteur"
    ADD CONSTRAINT "ref_secteur_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_sendgrid_template"
    ADD CONSTRAINT "ref_sendgrid_template_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_slack_channel"
    ADD CONSTRAINT "ref_slack_channel_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_source_marketing"
    ADD CONSTRAINT "ref_source_marketing_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_statut_candidat"
    ADD CONSTRAINT "ref_statut_candidat_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_tag_job"
    ADD CONSTRAINT "ref_tag_job_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_task_anchor"
    ADD CONSTRAINT "ref_task_anchor_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_task_event"
    ADD CONSTRAINT "ref_task_event_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_task_type"
    ADD CONSTRAINT "ref_task_type_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."ref_univers"
    ADD CONSTRAINT "ref_univers_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."tag"
    ADD CONSTRAINT "tag_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_notif"
    ADD CONSTRAINT "task_notif_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task"
    ADD CONSTRAINT "task_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user"
    ADD CONSTRAINT "user_auth_id_key" UNIQUE ("auth_id");



ALTER TABLE ONLY "public"."user_partner"
    ADD CONSTRAINT "user_partner_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user"
    ADD CONSTRAINT "user_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_role"
    ADD CONSTRAINT "user_role_pkey" PRIMARY KEY ("user_id", "role");



CREATE INDEX "conflit_champ_idx" ON "pivot"."conflit" USING "btree" ("champ", "vu_le" DESC);



CREATE INDEX "conflit_run_idx" ON "pivot"."conflit" USING "btree" ("run_id");



CREATE INDEX "conflit_talent_idx" ON "pivot"."conflit" USING "btree" ("talent_id", "vu_le" DESC);



CREATE INDEX "idx_attentes_contrats" ON "pivot"."attentes" USING "gin" ("contrats");



CREATE INDEX "idx_attentes_salaire" ON "pivot"."attentes" USING "btree" ("salaire_min");



CREATE INDEX "idx_attentes_tjm" ON "pivot"."attentes" USING "btree" ("tjm_min");



CREATE INDEX "idx_email_talent" ON "pivot"."email" USING "btree" ("talent_id");



CREATE INDEX "idx_note_talent" ON "pivot"."note_journal" USING "btree" ("talent_id");



CREATE INDEX "idx_phone_talent" ON "pivot"."phone" USING "btree" ("talent_id");



CREATE INDEX "idx_qualif_expertises" ON "pivot"."qualification" USING "gin" ("expertises");



CREATE INDEX "idx_qualif_niveau" ON "pivot"."qualification" USING "btree" ("niveau_qualifie");



CREATE INDEX "idx_qualif_secteurs" ON "pivot"."qualification" USING "gin" ("secteurs");



CREATE INDEX "idx_qualif_seniorite" ON "pivot"."qualification" USING "btree" ("seniorite");



CREATE INDEX "idx_qualif_univers" ON "pivot"."qualification" USING "btree" ("univers");



CREATE INDEX "idx_source_extid" ON "pivot"."talent_source" USING "btree" ("source", "external_id");



CREATE INDEX "idx_source_talent" ON "pivot"."talent_source" USING "btree" ("talent_id");



CREATE INDEX "idx_talent_employeur_trgm" ON "pivot"."talent" USING "gin" ("lower"("employeur_actuel") "extensions"."gin_trgm_ops");



CREATE INDEX "idx_talent_localisation" ON "pivot"."talent" USING "btree" ("lower"("localisation"));



CREATE INDEX "idx_talent_nom_trgm" ON "pivot"."talent" USING "gin" ("lower"("nom") "extensions"."gin_trgm_ops");



CREATE INDEX "idx_talent_prenom_trgm" ON "pivot"."talent" USING "gin" ("lower"("prenom") "extensions"."gin_trgm_ops");



CREATE INDEX "idx_talent_type_fusion" ON "pivot"."talent" USING "btree" ("type_fusion");



CREATE INDEX "sync_run_source_idx" ON "pivot"."sync_run" USING "btree" ("source", "demarre_le" DESC);



CREATE INDEX "idx_candidat_agent" ON "public"."candidat" USING "btree" ("agent_pachamama_id");



CREATE INDEX "idx_candidat_ajout_par" ON "public"."candidat" USING "btree" ("ajout_par_id");



CREATE INDEX "idx_candidat_created" ON "public"."candidat" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_candidat_expanded_candidat" ON "public"."candidat_expanded" USING "btree" ("candidat_id");



CREATE INDEX "idx_candidat_metier" ON "public"."candidat" USING "btree" ("metier_actuel");



CREATE INDEX "idx_candidat_nom" ON "public"."candidat" USING "btree" ("nom", "prenom");



CREATE INDEX "idx_candidat_statut" ON "public"."candidat" USING "btree" ("statut");



CREATE INDEX "idx_candidat_univers" ON "public"."candidat" USING "btree" ("univers");



CREATE INDEX "idx_entreprise_agent" ON "public"."entreprise" USING "btree" ("agent_en_charge_id");



CREATE INDEX "idx_entreprise_nom" ON "public"."entreprise" USING "btree" ("nom");



CREATE INDEX "idx_entreprise_secteur" ON "public"."entreprise" USING "btree" ("secteur");



CREATE INDEX "idx_equipe_mandat" ON "public"."equipe" USING "btree" ("mandat_id");



CREATE INDEX "idx_experience_candidat" ON "public"."experience" USING "btree" ("candidat_id");



CREATE INDEX "idx_experience_entreprise" ON "public"."experience" USING "btree" ("entreprise_id");



CREATE INDEX "idx_job_actuel_candidat" ON "public"."job_actuel" USING "btree" ("candidat_id");



CREATE INDEX "idx_job_reve_candidat" ON "public"."job_reve" USING "btree" ("candidat_id");



CREATE INDEX "idx_mandat_created" ON "public"."mandat" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_mandat_entreprise" ON "public"."mandat" USING "btree" ("entreprise_id");



CREATE INDEX "idx_mandat_personne" ON "public"."mandat" USING "btree" ("personne_en_charge_id");



CREATE INDEX "idx_mandat_statut" ON "public"."mandat" USING "btree" ("statut");



CREATE INDEX "idx_mandat_univers" ON "public"."mandat" USING "btree" ("univers");



CREATE INDEX "idx_mandatclose_candidat" ON "public"."mandatclose" USING "btree" ("candidat_id");



CREATE INDEX "idx_mandatclose_entreprise" ON "public"."mandatclose" USING "btree" ("entreprise_id");



CREATE INDEX "idx_mandatclose_mandat" ON "public"."mandatclose" USING "btree" ("mandat_id");



CREATE INDEX "idx_mandatclose_process" ON "public"."mandatclose" USING "btree" ("process_id");



CREATE INDEX "idx_note_arch_candidat" ON "public"."note_archivee" USING "btree" ("candidat_id");



CREATE INDEX "idx_note_arch_mandat" ON "public"."note_archivee" USING "btree" ("mandat_id");



CREATE INDEX "idx_note_candidat" ON "public"."note" USING "btree" ("candidat_id");



CREATE INDEX "idx_note_created" ON "public"."note" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_note_entreprise" ON "public"."note" USING "btree" ("entreprise_id");



CREATE INDEX "idx_note_mandat" ON "public"."note" USING "btree" ("mandat_id");



CREATE INDEX "idx_note_mandatclose" ON "public"."note" USING "btree" ("mandatclose_id");



CREATE INDEX "idx_note_user" ON "public"."note" USING "btree" ("user_id");



CREATE INDEX "idx_nps_status" ON "public"."nps_tracking" USING "btree" ("status");



CREATE INDEX "idx_process_candidat" ON "public"."process" USING "btree" ("candidat_id");



CREATE INDEX "idx_process_created" ON "public"."process" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_process_entreprise" ON "public"."process" USING "btree" ("entreprise_id");



CREATE INDEX "idx_process_etape" ON "public"."process" USING "btree" ("etape");



CREATE INDEX "idx_process_mandat" ON "public"."process" USING "btree" ("mandat_id");



CREATE INDEX "idx_split_mandatclose" ON "public"."mandate_closed_split" USING "btree" ("mandatclose_id");



CREATE INDEX "idx_sync_ecart_cle" ON "public"."_sync_ecart" USING "btree" ("supa_table", "bubble_id", "nature");



CREATE INDEX "idx_sync_ecart_ouvert" ON "public"."_sync_ecart" USING "btree" ("supa_table", "nature") WHERE ("resolu_le" IS NULL);



CREATE INDEX "idx_sync_quarantine_type" ON "public"."_sync_quarantine" USING "btree" ("type_name", "detecte_le" DESC);



CREATE INDEX "idx_tag_entreprise" ON "public"."tag" USING "btree" ("entreprise_id");



CREATE INDEX "idx_tag_mandat" ON "public"."tag" USING "btree" ("mandat_id");



CREATE INDEX "idx_task_assigned" ON "public"."task" USING "btree" ("assigned_user_id");



CREATE INDEX "idx_task_mandatclose" ON "public"."task" USING "btree" ("mandatclose_id");



CREATE INDEX "idx_task_notif_task" ON "public"."task_notif" USING "btree" ("task_id");



CREATE INDEX "idx_user_partner_univers" ON "public"."user_partner" USING "btree" ("univers");



CREATE INDEX "idx_user_partner_user" ON "public"."user_partner" USING "btree" ("user_id");



ALTER TABLE ONLY "pivot"."attentes"
    ADD CONSTRAINT "attentes_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "pivot"."talent"("talent_id") ON DELETE CASCADE;



ALTER TABLE ONLY "pivot"."conflit"
    ADD CONSTRAINT "conflit_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "pivot"."talent"("talent_id") ON DELETE CASCADE;



ALTER TABLE ONLY "pivot"."email"
    ADD CONSTRAINT "email_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "pivot"."talent"("talent_id") ON DELETE CASCADE;



ALTER TABLE ONLY "pivot"."note_journal"
    ADD CONSTRAINT "note_journal_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "pivot"."talent"("talent_id") ON DELETE CASCADE;



ALTER TABLE ONLY "pivot"."parcours"
    ADD CONSTRAINT "parcours_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "pivot"."talent"("talent_id") ON DELETE CASCADE;



ALTER TABLE ONLY "pivot"."phone"
    ADD CONSTRAINT "phone_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "pivot"."talent"("talent_id") ON DELETE CASCADE;



ALTER TABLE ONLY "pivot"."qualification"
    ADD CONSTRAINT "qualification_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "pivot"."talent"("talent_id") ON DELETE CASCADE;



ALTER TABLE ONLY "pivot"."talent_source"
    ADD CONSTRAINT "talent_source_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "pivot"."talent"("talent_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."_sync_ecart"
    ADD CONSTRAINT "_sync_ecart_derniere_passe_fkey" FOREIGN KEY ("derniere_passe") REFERENCES "public"."_sync_passe"("id");



ALTER TABLE ONLY "public"."_sync_ecart"
    ADD CONSTRAINT "_sync_ecart_premiere_passe_fkey" FOREIGN KEY ("premiere_passe") REFERENCES "public"."_sync_passe"("id");



ALTER TABLE ONLY "public"."candidat_contrat"
    ADD CONSTRAINT "candidat_contrat_candidat_id_fkey" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidat_expertise"
    ADD CONSTRAINT "candidat_expertise_candidat_id_fkey" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidat_expertise"
    ADD CONSTRAINT "candidat_expertise_expertise_fkey" FOREIGN KEY ("expertise") REFERENCES "public"."ref_expertise"("value") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidat_jobtype"
    ADD CONSTRAINT "candidat_jobtype_candidat_id_fkey" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidat_mandat"
    ADD CONSTRAINT "candidat_mandat_candidat_id_fkey" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidat_mandat"
    ADD CONSTRAINT "candidat_mandat_mandat_id_fkey" FOREIGN KEY ("mandat_id") REFERENCES "public"."mandat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidat_note"
    ADD CONSTRAINT "candidat_note_candidat_id_fkey" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidat_note"
    ADD CONSTRAINT "candidat_note_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "public"."note"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidat_profile"
    ADD CONSTRAINT "candidat_profile_candidat_id_fkey" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidat_profile"
    ADD CONSTRAINT "candidat_profile_profile_fkey" FOREIGN KEY ("profile") REFERENCES "public"."ref_profile"("value") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidat_remote"
    ADD CONSTRAINT "candidat_remote_candidat_id_fkey" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidat_secteur"
    ADD CONSTRAINT "candidat_secteur_candidat_id_fkey" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidat_secteur"
    ADD CONSTRAINT "candidat_secteur_secteur_fkey" FOREIGN KEY ("secteur") REFERENCES "public"."ref_secteur"("value") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidat_tag"
    ADD CONSTRAINT "candidat_tag_candidat_id_fkey" FOREIGN KEY ("candidat_id") REFERENCES "public"."candidat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidat_tag"
    ADD CONSTRAINT "candidat_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entreprise_mandat"
    ADD CONSTRAINT "entreprise_mandat_entreprise_id_fkey" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprise"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entreprise_mandat"
    ADD CONSTRAINT "entreprise_mandat_mandat_id_fkey" FOREIGN KEY ("mandat_id") REFERENCES "public"."mandat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entreprise_note"
    ADD CONSTRAINT "entreprise_note_entreprise_id_fkey" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprise"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entreprise_note"
    ADD CONSTRAINT "entreprise_note_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "public"."note"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entreprise_remote"
    ADD CONSTRAINT "entreprise_remote_entreprise_id_fkey" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprise"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entreprise_tag"
    ADD CONSTRAINT "entreprise_tag_entreprise_id_fkey" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprise"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entreprise_tag"
    ADD CONSTRAINT "entreprise_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."experience_background"
    ADD CONSTRAINT "experience_background_background_fkey" FOREIGN KEY ("background") REFERENCES "public"."ref_background"("value") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."experience_product"
    ADD CONSTRAINT "experience_product_product_fkey" FOREIGN KEY ("product") REFERENCES "public"."ref_product"("value") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."experience_profile"
    ADD CONSTRAINT "experience_profile_profile_fkey" FOREIGN KEY ("profile") REFERENCES "public"."ref_profile"("value") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."experience_secteur"
    ADD CONSTRAINT "experience_secteur_secteur_fkey" FOREIGN KEY ("secteur") REFERENCES "public"."ref_secteur"("value") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_reve_contrat"
    ADD CONSTRAINT "job_reve_contrat_job_reve_id_fkey" FOREIGN KEY ("job_reve_id") REFERENCES "public"."job_reve"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_reve_critere"
    ADD CONSTRAINT "job_reve_critere_critere_fkey" FOREIGN KEY ("critere") REFERENCES "public"."ref_criteres"("value") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_reve_critere"
    ADD CONSTRAINT "job_reve_critere_job_reve_id_fkey" FOREIGN KEY ("job_reve_id") REFERENCES "public"."job_reve"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_reve_remote"
    ADD CONSTRAINT "job_reve_remote_job_reve_id_fkey" FOREIGN KEY ("job_reve_id") REFERENCES "public"."job_reve"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_reve_remote"
    ADD CONSTRAINT "job_reve_remote_remote_fkey" FOREIGN KEY ("remote") REFERENCES "public"."ref_remote"("value") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_reve_secteur"
    ADD CONSTRAINT "job_reve_secteur_job_reve_id_fkey" FOREIGN KEY ("job_reve_id") REFERENCES "public"."job_reve"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_reve_secteur_nogo"
    ADD CONSTRAINT "job_reve_secteur_nogo_job_reve_id_fkey" FOREIGN KEY ("job_reve_id") REFERENCES "public"."job_reve"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_reve_secteur_nogo"
    ADD CONSTRAINT "job_reve_secteur_nogo_secteur_fkey" FOREIGN KEY ("secteur") REFERENCES "public"."ref_secteur"("value") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_reve_secteur"
    ADD CONSTRAINT "job_reve_secteur_secteur_fkey" FOREIGN KEY ("secteur") REFERENCES "public"."ref_secteur"("value") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mandat_analyse"
    ADD CONSTRAINT "mandat_analyse_analyse_id_fkey" FOREIGN KEY ("analyse_id") REFERENCES "public"."analyse"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mandat_analyse"
    ADD CONSTRAINT "mandat_analyse_mandat_id_fkey" FOREIGN KEY ("mandat_id") REFERENCES "public"."mandat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mandat_cible"
    ADD CONSTRAINT "mandat_cible_cible_fkey" FOREIGN KEY ("cible") REFERENCES "public"."ref_cible"("value") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mandat_cible"
    ADD CONSTRAINT "mandat_cible_mandat_id_fkey" FOREIGN KEY ("mandat_id") REFERENCES "public"."mandat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mandat_equipe"
    ADD CONSTRAINT "mandat_equipe_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipe"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mandat_equipe"
    ADD CONSTRAINT "mandat_equipe_mandat_id_fkey" FOREIGN KEY ("mandat_id") REFERENCES "public"."mandat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mandat_note"
    ADD CONSTRAINT "mandat_note_mandat_id_fkey" FOREIGN KEY ("mandat_id") REFERENCES "public"."mandat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mandat_remote"
    ADD CONSTRAINT "mandat_remote_mandat_id_fkey" FOREIGN KEY ("mandat_id") REFERENCES "public"."mandat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mandat_tag_job"
    ADD CONSTRAINT "mandat_tag_job_mandat_id_fkey" FOREIGN KEY ("mandat_id") REFERENCES "public"."mandat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."process_mandatclose"
    ADD CONSTRAINT "process_mandatclose_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "public"."process"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ref_expertise_univers"
    ADD CONSTRAINT "ref_expertise_univers_expertise_value_fkey" FOREIGN KEY ("expertise_value") REFERENCES "public"."ref_expertise"("value") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ref_expertise_univers"
    ADD CONSTRAINT "ref_expertise_univers_univers_value_fkey" FOREIGN KEY ("univers_value") REFERENCES "public"."ref_univers"("value") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ref_metier_univers"
    ADD CONSTRAINT "ref_metier_univers_metier_value_fkey" FOREIGN KEY ("metier_value") REFERENCES "public"."ref_metier"("value") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ref_metier_univers"
    ADD CONSTRAINT "ref_metier_univers_univers_value_fkey" FOREIGN KEY ("univers_value") REFERENCES "public"."ref_univers"("value") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ref_note_event"
    ADD CONSTRAINT "ref_note_event_note_event_type_fkey" FOREIGN KEY ("note_event_type") REFERENCES "public"."ref_note_event_type"("value");



ALTER TABLE ONLY "public"."ref_role"
    ADD CONSTRAINT "ref_role_role_category_fkey" FOREIGN KEY ("role_category") REFERENCES "public"."ref_role_category"("value");



ALTER TABLE ONLY "public"."ref_task_type"
    ADD CONSTRAINT "ref_task_type_task_anchor_fkey" FOREIGN KEY ("task_anchor") REFERENCES "public"."ref_task_anchor"("value");



ALTER TABLE ONLY "public"."ref_task_type"
    ADD CONSTRAINT "ref_task_type_task_event_fkey" FOREIGN KEY ("task_event") REFERENCES "public"."ref_task_event"("value");



ALTER TABLE ONLY "public"."user_role"
    ADD CONSTRAINT "user_role_role_fkey" FOREIGN KEY ("role") REFERENCES "public"."ref_role"("value") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_role"
    ADD CONSTRAINT "user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE;



ALTER TABLE "pivot"."attentes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "pivot"."conflit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "pivot"."email" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "pivot"."note_journal" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "pivot"."parcours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "pivot"."phone" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "pivot"."qualification" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "pivot"."sync_etat" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "pivot"."sync_run" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "pivot"."talent" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "pivot"."talent_source" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_fk_backup" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_sync_ecart" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_sync_passe" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_sync_quarantine" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_sync_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analyse" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_maker" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidat" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidat_contrat" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidat_expanded" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidat_expertise" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidat_jobtype" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidat_mandat" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidat_note" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidat_profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidat_remote" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidat_secteur" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidat_tag" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_template" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entreprise" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entreprise_mandat" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entreprise_note" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entreprise_remote" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entreprise_tag" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipe" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."experience" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."experience_background" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."experience_expertise" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."experience_product" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."experience_profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."experience_secteur" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_actuel" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_reve" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_reve_contrat" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_reve_critere" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_reve_remote" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_reve_secteur" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_reve_secteur_nogo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mandat" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mandat_analyse" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mandat_cible" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mandat_equipe" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mandat_note" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mandat_remote" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mandat_tag_job" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mandatclose" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mandatclose_note" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mandate_closed_split" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."note" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."note_archivee" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nps_tracking" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."process" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."process_mandatclose" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."produit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_app_branding" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_apporteur_affaires" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_background" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_cible" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_company_type" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_contract_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_contrat" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_contributor_type" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_criteres" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_email_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_emoji" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_expertise" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_expertise_univers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_fonction" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_form_41" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_form_42" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_formule" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_gender" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_image" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_language" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_mandate_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_mandate_visibility" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_maturite_produit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_metier" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_metier_univers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_mindset" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_niveau_analyse" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_niveau_anglais" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_note_event" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_note_event_type" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_process_etape" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_product" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_product_type" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_remote" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_role" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_role_category" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_secteur" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_sendgrid_template" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_slack_channel" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_source_marketing" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_statut_candidat" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_tag_job" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_task_anchor" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_task_event" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_task_type" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_univers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tag" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_notif" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_partner" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_role" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "pivot" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_next_sync_type"() TO "anon";
GRANT ALL ON FUNCTION "public"."claim_next_sync_type"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_next_sync_type"() TO "service_role";



GRANT ALL ON FUNCTION "public"."disable_fk"() TO "anon";
GRANT ALL ON FUNCTION "public"."disable_fk"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."disable_fk"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enable_fk"() TO "anon";
GRANT ALL ON FUNCTION "public"."enable_fk"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enable_fk"() TO "service_role";



GRANT ALL ON FUNCTION "public"."finish_sync_type"("p_type_name" "text", "p_status" "text", "p_last_modified" timestamp with time zone, "p_last_cursor" integer, "p_items_synced" integer, "p_error" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."finish_sync_type"("p_type_name" "text", "p_status" "text", "p_last_modified" timestamp with time zone, "p_last_cursor" integer, "p_items_synced" integer, "p_error" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finish_sync_type"("p_type_name" "text", "p_status" "text", "p_last_modified" timestamp with time zone, "p_last_cursor" integer, "p_items_synced" integer, "p_error" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."replace_m2m"("p_table" "text", "p_parent_col" "text", "p_parent_id" "text", "p_rows" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."replace_m2m"("p_table" "text", "p_parent_col" "text", "p_parent_id" "text", "p_rows" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_m2m"("p_table" "text", "p_parent_col" "text", "p_parent_id" "text", "p_rows" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."truncate_data_tables"() TO "anon";
GRANT ALL ON FUNCTION "public"."truncate_data_tables"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."truncate_data_tables"() TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."attentes" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."conflit" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "pivot"."conflit_conflit_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."email" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "pivot"."email_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."note_journal" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "pivot"."note_journal_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."parcours" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."phone" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "pivot"."phone_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."qualification" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."talent" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."qa_completude" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."qa_emails_generiques" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."talent_source" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."qa_multi_source" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."qa_preseance_suspecte" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."qa_sans_contact" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."qa_sans_identite" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."sync_etat" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."sync_run" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "pivot"."talent_recherche" TO "service_role";



GRANT ALL ON TABLE "public"."_fk_backup" TO "anon";
GRANT ALL ON TABLE "public"."_fk_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."_fk_backup" TO "service_role";



GRANT ALL ON SEQUENCE "public"."_fk_backup_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."_fk_backup_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."_fk_backup_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."_sync_ecart" TO "anon";
GRANT ALL ON TABLE "public"."_sync_ecart" TO "authenticated";
GRANT ALL ON TABLE "public"."_sync_ecart" TO "service_role";



GRANT ALL ON SEQUENCE "public"."_sync_ecart_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."_sync_ecart_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."_sync_ecart_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."_sync_passe" TO "anon";
GRANT ALL ON TABLE "public"."_sync_passe" TO "authenticated";
GRANT ALL ON TABLE "public"."_sync_passe" TO "service_role";



GRANT ALL ON SEQUENCE "public"."_sync_passe_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."_sync_passe_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."_sync_passe_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."_sync_quarantine" TO "anon";
GRANT ALL ON TABLE "public"."_sync_quarantine" TO "authenticated";
GRANT ALL ON TABLE "public"."_sync_quarantine" TO "service_role";



GRANT ALL ON SEQUENCE "public"."_sync_quarantine_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."_sync_quarantine_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."_sync_quarantine_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."_sync_state" TO "anon";
GRANT ALL ON TABLE "public"."_sync_state" TO "authenticated";
GRANT ALL ON TABLE "public"."_sync_state" TO "service_role";



GRANT ALL ON TABLE "public"."analyse" TO "anon";
GRANT ALL ON TABLE "public"."analyse" TO "authenticated";
GRANT ALL ON TABLE "public"."analyse" TO "service_role";



GRANT ALL ON TABLE "public"."business_maker" TO "anon";
GRANT ALL ON TABLE "public"."business_maker" TO "authenticated";
GRANT ALL ON TABLE "public"."business_maker" TO "service_role";



GRANT ALL ON TABLE "public"."candidat" TO "anon";
GRANT ALL ON TABLE "public"."candidat" TO "authenticated";
GRANT ALL ON TABLE "public"."candidat" TO "service_role";



GRANT ALL ON TABLE "public"."candidat_contrat" TO "anon";
GRANT ALL ON TABLE "public"."candidat_contrat" TO "authenticated";
GRANT ALL ON TABLE "public"."candidat_contrat" TO "service_role";



GRANT ALL ON TABLE "public"."candidat_expanded" TO "anon";
GRANT ALL ON TABLE "public"."candidat_expanded" TO "authenticated";
GRANT ALL ON TABLE "public"."candidat_expanded" TO "service_role";



GRANT ALL ON TABLE "public"."candidat_expertise" TO "anon";
GRANT ALL ON TABLE "public"."candidat_expertise" TO "authenticated";
GRANT ALL ON TABLE "public"."candidat_expertise" TO "service_role";



GRANT ALL ON TABLE "public"."candidat_jobtype" TO "anon";
GRANT ALL ON TABLE "public"."candidat_jobtype" TO "authenticated";
GRANT ALL ON TABLE "public"."candidat_jobtype" TO "service_role";



GRANT ALL ON TABLE "public"."candidat_mandat" TO "anon";
GRANT ALL ON TABLE "public"."candidat_mandat" TO "authenticated";
GRANT ALL ON TABLE "public"."candidat_mandat" TO "service_role";



GRANT ALL ON TABLE "public"."candidat_note" TO "anon";
GRANT ALL ON TABLE "public"."candidat_note" TO "authenticated";
GRANT ALL ON TABLE "public"."candidat_note" TO "service_role";



GRANT ALL ON TABLE "public"."candidat_profile" TO "anon";
GRANT ALL ON TABLE "public"."candidat_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."candidat_profile" TO "service_role";



GRANT ALL ON TABLE "public"."candidat_remote" TO "anon";
GRANT ALL ON TABLE "public"."candidat_remote" TO "authenticated";
GRANT ALL ON TABLE "public"."candidat_remote" TO "service_role";



GRANT ALL ON TABLE "public"."candidat_secteur" TO "anon";
GRANT ALL ON TABLE "public"."candidat_secteur" TO "authenticated";
GRANT ALL ON TABLE "public"."candidat_secteur" TO "service_role";



GRANT ALL ON TABLE "public"."candidat_tag" TO "anon";
GRANT ALL ON TABLE "public"."candidat_tag" TO "authenticated";
GRANT ALL ON TABLE "public"."candidat_tag" TO "service_role";



GRANT ALL ON TABLE "public"."email_template" TO "anon";
GRANT ALL ON TABLE "public"."email_template" TO "authenticated";
GRANT ALL ON TABLE "public"."email_template" TO "service_role";



GRANT ALL ON TABLE "public"."entreprise" TO "anon";
GRANT ALL ON TABLE "public"."entreprise" TO "authenticated";
GRANT ALL ON TABLE "public"."entreprise" TO "service_role";



GRANT ALL ON TABLE "public"."entreprise_mandat" TO "anon";
GRANT ALL ON TABLE "public"."entreprise_mandat" TO "authenticated";
GRANT ALL ON TABLE "public"."entreprise_mandat" TO "service_role";



GRANT ALL ON TABLE "public"."entreprise_note" TO "anon";
GRANT ALL ON TABLE "public"."entreprise_note" TO "authenticated";
GRANT ALL ON TABLE "public"."entreprise_note" TO "service_role";



GRANT ALL ON TABLE "public"."entreprise_remote" TO "anon";
GRANT ALL ON TABLE "public"."entreprise_remote" TO "authenticated";
GRANT ALL ON TABLE "public"."entreprise_remote" TO "service_role";



GRANT ALL ON TABLE "public"."entreprise_tag" TO "anon";
GRANT ALL ON TABLE "public"."entreprise_tag" TO "authenticated";
GRANT ALL ON TABLE "public"."entreprise_tag" TO "service_role";



GRANT ALL ON TABLE "public"."equipe" TO "anon";
GRANT ALL ON TABLE "public"."equipe" TO "authenticated";
GRANT ALL ON TABLE "public"."equipe" TO "service_role";



GRANT ALL ON TABLE "public"."experience" TO "anon";
GRANT ALL ON TABLE "public"."experience" TO "authenticated";
GRANT ALL ON TABLE "public"."experience" TO "service_role";



GRANT ALL ON TABLE "public"."experience_background" TO "anon";
GRANT ALL ON TABLE "public"."experience_background" TO "authenticated";
GRANT ALL ON TABLE "public"."experience_background" TO "service_role";



GRANT ALL ON TABLE "public"."experience_expertise" TO "anon";
GRANT ALL ON TABLE "public"."experience_expertise" TO "authenticated";
GRANT ALL ON TABLE "public"."experience_expertise" TO "service_role";



GRANT ALL ON TABLE "public"."experience_product" TO "anon";
GRANT ALL ON TABLE "public"."experience_product" TO "authenticated";
GRANT ALL ON TABLE "public"."experience_product" TO "service_role";



GRANT ALL ON TABLE "public"."experience_profile" TO "anon";
GRANT ALL ON TABLE "public"."experience_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."experience_profile" TO "service_role";



GRANT ALL ON TABLE "public"."experience_secteur" TO "anon";
GRANT ALL ON TABLE "public"."experience_secteur" TO "authenticated";
GRANT ALL ON TABLE "public"."experience_secteur" TO "service_role";



GRANT ALL ON TABLE "public"."job_actuel" TO "anon";
GRANT ALL ON TABLE "public"."job_actuel" TO "authenticated";
GRANT ALL ON TABLE "public"."job_actuel" TO "service_role";



GRANT ALL ON TABLE "public"."job_reve" TO "anon";
GRANT ALL ON TABLE "public"."job_reve" TO "authenticated";
GRANT ALL ON TABLE "public"."job_reve" TO "service_role";



GRANT ALL ON TABLE "public"."job_reve_contrat" TO "anon";
GRANT ALL ON TABLE "public"."job_reve_contrat" TO "authenticated";
GRANT ALL ON TABLE "public"."job_reve_contrat" TO "service_role";



GRANT ALL ON TABLE "public"."job_reve_critere" TO "anon";
GRANT ALL ON TABLE "public"."job_reve_critere" TO "authenticated";
GRANT ALL ON TABLE "public"."job_reve_critere" TO "service_role";



GRANT ALL ON TABLE "public"."job_reve_remote" TO "anon";
GRANT ALL ON TABLE "public"."job_reve_remote" TO "authenticated";
GRANT ALL ON TABLE "public"."job_reve_remote" TO "service_role";



GRANT ALL ON TABLE "public"."job_reve_secteur" TO "anon";
GRANT ALL ON TABLE "public"."job_reve_secteur" TO "authenticated";
GRANT ALL ON TABLE "public"."job_reve_secteur" TO "service_role";



GRANT ALL ON TABLE "public"."job_reve_secteur_nogo" TO "anon";
GRANT ALL ON TABLE "public"."job_reve_secteur_nogo" TO "authenticated";
GRANT ALL ON TABLE "public"."job_reve_secteur_nogo" TO "service_role";



GRANT ALL ON TABLE "public"."mandat" TO "anon";
GRANT ALL ON TABLE "public"."mandat" TO "authenticated";
GRANT ALL ON TABLE "public"."mandat" TO "service_role";



GRANT ALL ON TABLE "public"."mandat_analyse" TO "anon";
GRANT ALL ON TABLE "public"."mandat_analyse" TO "authenticated";
GRANT ALL ON TABLE "public"."mandat_analyse" TO "service_role";



GRANT ALL ON TABLE "public"."mandat_cible" TO "anon";
GRANT ALL ON TABLE "public"."mandat_cible" TO "authenticated";
GRANT ALL ON TABLE "public"."mandat_cible" TO "service_role";



GRANT ALL ON TABLE "public"."mandat_equipe" TO "anon";
GRANT ALL ON TABLE "public"."mandat_equipe" TO "authenticated";
GRANT ALL ON TABLE "public"."mandat_equipe" TO "service_role";



GRANT ALL ON TABLE "public"."mandat_note" TO "anon";
GRANT ALL ON TABLE "public"."mandat_note" TO "authenticated";
GRANT ALL ON TABLE "public"."mandat_note" TO "service_role";



GRANT ALL ON TABLE "public"."mandat_remote" TO "anon";
GRANT ALL ON TABLE "public"."mandat_remote" TO "authenticated";
GRANT ALL ON TABLE "public"."mandat_remote" TO "service_role";



GRANT ALL ON TABLE "public"."mandat_tag_job" TO "anon";
GRANT ALL ON TABLE "public"."mandat_tag_job" TO "authenticated";
GRANT ALL ON TABLE "public"."mandat_tag_job" TO "service_role";



GRANT ALL ON TABLE "public"."mandatclose" TO "anon";
GRANT ALL ON TABLE "public"."mandatclose" TO "authenticated";
GRANT ALL ON TABLE "public"."mandatclose" TO "service_role";



GRANT ALL ON TABLE "public"."mandatclose_note" TO "anon";
GRANT ALL ON TABLE "public"."mandatclose_note" TO "authenticated";
GRANT ALL ON TABLE "public"."mandatclose_note" TO "service_role";



GRANT ALL ON TABLE "public"."mandate_closed_split" TO "anon";
GRANT ALL ON TABLE "public"."mandate_closed_split" TO "authenticated";
GRANT ALL ON TABLE "public"."mandate_closed_split" TO "service_role";



GRANT ALL ON TABLE "public"."note" TO "anon";
GRANT ALL ON TABLE "public"."note" TO "authenticated";
GRANT ALL ON TABLE "public"."note" TO "service_role";



GRANT ALL ON TABLE "public"."note_archivee" TO "anon";
GRANT ALL ON TABLE "public"."note_archivee" TO "authenticated";
GRANT ALL ON TABLE "public"."note_archivee" TO "service_role";



GRANT ALL ON TABLE "public"."nps_tracking" TO "anon";
GRANT ALL ON TABLE "public"."nps_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."nps_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."process" TO "anon";
GRANT ALL ON TABLE "public"."process" TO "authenticated";
GRANT ALL ON TABLE "public"."process" TO "service_role";



GRANT ALL ON TABLE "public"."process_mandatclose" TO "anon";
GRANT ALL ON TABLE "public"."process_mandatclose" TO "authenticated";
GRANT ALL ON TABLE "public"."process_mandatclose" TO "service_role";



GRANT ALL ON TABLE "public"."produit" TO "anon";
GRANT ALL ON TABLE "public"."produit" TO "authenticated";
GRANT ALL ON TABLE "public"."produit" TO "service_role";



GRANT ALL ON TABLE "public"."ref_app_branding" TO "anon";
GRANT ALL ON TABLE "public"."ref_app_branding" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_app_branding" TO "service_role";



GRANT ALL ON TABLE "public"."ref_apporteur_affaires" TO "anon";
GRANT ALL ON TABLE "public"."ref_apporteur_affaires" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_apporteur_affaires" TO "service_role";



GRANT ALL ON TABLE "public"."ref_background" TO "anon";
GRANT ALL ON TABLE "public"."ref_background" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_background" TO "service_role";



GRANT ALL ON TABLE "public"."ref_cible" TO "anon";
GRANT ALL ON TABLE "public"."ref_cible" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_cible" TO "service_role";



GRANT ALL ON TABLE "public"."ref_company_type" TO "anon";
GRANT ALL ON TABLE "public"."ref_company_type" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_company_type" TO "service_role";



GRANT ALL ON TABLE "public"."ref_contract_status" TO "anon";
GRANT ALL ON TABLE "public"."ref_contract_status" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_contract_status" TO "service_role";



GRANT ALL ON TABLE "public"."ref_contrat" TO "anon";
GRANT ALL ON TABLE "public"."ref_contrat" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_contrat" TO "service_role";



GRANT ALL ON TABLE "public"."ref_contributor_type" TO "anon";
GRANT ALL ON TABLE "public"."ref_contributor_type" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_contributor_type" TO "service_role";



GRANT ALL ON TABLE "public"."ref_criteres" TO "anon";
GRANT ALL ON TABLE "public"."ref_criteres" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_criteres" TO "service_role";



GRANT ALL ON TABLE "public"."ref_email_config" TO "anon";
GRANT ALL ON TABLE "public"."ref_email_config" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_email_config" TO "service_role";



GRANT ALL ON TABLE "public"."ref_emoji" TO "anon";
GRANT ALL ON TABLE "public"."ref_emoji" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_emoji" TO "service_role";



GRANT ALL ON TABLE "public"."ref_expertise" TO "anon";
GRANT ALL ON TABLE "public"."ref_expertise" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_expertise" TO "service_role";



GRANT ALL ON TABLE "public"."ref_expertise_univers" TO "anon";
GRANT ALL ON TABLE "public"."ref_expertise_univers" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_expertise_univers" TO "service_role";



GRANT ALL ON TABLE "public"."ref_fonction" TO "anon";
GRANT ALL ON TABLE "public"."ref_fonction" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_fonction" TO "service_role";



GRANT ALL ON TABLE "public"."ref_form_41" TO "anon";
GRANT ALL ON TABLE "public"."ref_form_41" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_form_41" TO "service_role";



GRANT ALL ON TABLE "public"."ref_form_42" TO "anon";
GRANT ALL ON TABLE "public"."ref_form_42" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_form_42" TO "service_role";



GRANT ALL ON TABLE "public"."ref_formule" TO "anon";
GRANT ALL ON TABLE "public"."ref_formule" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_formule" TO "service_role";



GRANT ALL ON TABLE "public"."ref_gender" TO "anon";
GRANT ALL ON TABLE "public"."ref_gender" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_gender" TO "service_role";



GRANT ALL ON TABLE "public"."ref_image" TO "anon";
GRANT ALL ON TABLE "public"."ref_image" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_image" TO "service_role";



GRANT ALL ON TABLE "public"."ref_language" TO "anon";
GRANT ALL ON TABLE "public"."ref_language" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_language" TO "service_role";



GRANT ALL ON TABLE "public"."ref_mandate_status" TO "anon";
GRANT ALL ON TABLE "public"."ref_mandate_status" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_mandate_status" TO "service_role";



GRANT ALL ON TABLE "public"."ref_mandate_visibility" TO "anon";
GRANT ALL ON TABLE "public"."ref_mandate_visibility" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_mandate_visibility" TO "service_role";



GRANT ALL ON TABLE "public"."ref_maturite_produit" TO "anon";
GRANT ALL ON TABLE "public"."ref_maturite_produit" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_maturite_produit" TO "service_role";



GRANT ALL ON TABLE "public"."ref_metier" TO "anon";
GRANT ALL ON TABLE "public"."ref_metier" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_metier" TO "service_role";



GRANT ALL ON TABLE "public"."ref_metier_univers" TO "anon";
GRANT ALL ON TABLE "public"."ref_metier_univers" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_metier_univers" TO "service_role";



GRANT ALL ON TABLE "public"."ref_mindset" TO "anon";
GRANT ALL ON TABLE "public"."ref_mindset" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_mindset" TO "service_role";



GRANT ALL ON TABLE "public"."ref_niveau_analyse" TO "anon";
GRANT ALL ON TABLE "public"."ref_niveau_analyse" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_niveau_analyse" TO "service_role";



GRANT ALL ON TABLE "public"."ref_niveau_anglais" TO "anon";
GRANT ALL ON TABLE "public"."ref_niveau_anglais" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_niveau_anglais" TO "service_role";



GRANT ALL ON TABLE "public"."ref_note_event" TO "anon";
GRANT ALL ON TABLE "public"."ref_note_event" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_note_event" TO "service_role";



GRANT ALL ON TABLE "public"."ref_note_event_type" TO "anon";
GRANT ALL ON TABLE "public"."ref_note_event_type" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_note_event_type" TO "service_role";



GRANT ALL ON TABLE "public"."ref_process_etape" TO "anon";
GRANT ALL ON TABLE "public"."ref_process_etape" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_process_etape" TO "service_role";



GRANT ALL ON TABLE "public"."ref_product" TO "anon";
GRANT ALL ON TABLE "public"."ref_product" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_product" TO "service_role";



GRANT ALL ON TABLE "public"."ref_product_type" TO "anon";
GRANT ALL ON TABLE "public"."ref_product_type" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_product_type" TO "service_role";



GRANT ALL ON TABLE "public"."ref_profile" TO "anon";
GRANT ALL ON TABLE "public"."ref_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_profile" TO "service_role";



GRANT ALL ON TABLE "public"."ref_remote" TO "anon";
GRANT ALL ON TABLE "public"."ref_remote" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_remote" TO "service_role";



GRANT ALL ON TABLE "public"."ref_role" TO "anon";
GRANT ALL ON TABLE "public"."ref_role" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_role" TO "service_role";



GRANT ALL ON TABLE "public"."ref_role_category" TO "anon";
GRANT ALL ON TABLE "public"."ref_role_category" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_role_category" TO "service_role";



GRANT ALL ON TABLE "public"."ref_secteur" TO "anon";
GRANT ALL ON TABLE "public"."ref_secteur" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_secteur" TO "service_role";



GRANT ALL ON TABLE "public"."ref_sendgrid_template" TO "anon";
GRANT ALL ON TABLE "public"."ref_sendgrid_template" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_sendgrid_template" TO "service_role";



GRANT ALL ON TABLE "public"."ref_slack_channel" TO "anon";
GRANT ALL ON TABLE "public"."ref_slack_channel" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_slack_channel" TO "service_role";



GRANT ALL ON TABLE "public"."ref_source_marketing" TO "anon";
GRANT ALL ON TABLE "public"."ref_source_marketing" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_source_marketing" TO "service_role";



GRANT ALL ON TABLE "public"."ref_statut_candidat" TO "anon";
GRANT ALL ON TABLE "public"."ref_statut_candidat" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_statut_candidat" TO "service_role";



GRANT ALL ON TABLE "public"."ref_tag_job" TO "anon";
GRANT ALL ON TABLE "public"."ref_tag_job" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_tag_job" TO "service_role";



GRANT ALL ON TABLE "public"."ref_task_anchor" TO "anon";
GRANT ALL ON TABLE "public"."ref_task_anchor" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_task_anchor" TO "service_role";



GRANT ALL ON TABLE "public"."ref_task_event" TO "anon";
GRANT ALL ON TABLE "public"."ref_task_event" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_task_event" TO "service_role";



GRANT ALL ON TABLE "public"."ref_task_type" TO "anon";
GRANT ALL ON TABLE "public"."ref_task_type" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_task_type" TO "service_role";



GRANT ALL ON TABLE "public"."ref_univers" TO "anon";
GRANT ALL ON TABLE "public"."ref_univers" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_univers" TO "service_role";



GRANT ALL ON TABLE "public"."tag" TO "anon";
GRANT ALL ON TABLE "public"."tag" TO "authenticated";
GRANT ALL ON TABLE "public"."tag" TO "service_role";



GRANT ALL ON TABLE "public"."task" TO "anon";
GRANT ALL ON TABLE "public"."task" TO "authenticated";
GRANT ALL ON TABLE "public"."task" TO "service_role";



GRANT ALL ON TABLE "public"."task_notif" TO "anon";
GRANT ALL ON TABLE "public"."task_notif" TO "authenticated";
GRANT ALL ON TABLE "public"."task_notif" TO "service_role";



GRANT ALL ON TABLE "public"."user" TO "anon";
GRANT ALL ON TABLE "public"."user" TO "authenticated";
GRANT ALL ON TABLE "public"."user" TO "service_role";



GRANT ALL ON TABLE "public"."user_partner" TO "anon";
GRANT ALL ON TABLE "public"."user_partner" TO "authenticated";
GRANT ALL ON TABLE "public"."user_partner" TO "service_role";



GRANT ALL ON TABLE "public"."user_role" TO "anon";
GRANT ALL ON TABLE "public"."user_role" TO "authenticated";
GRANT ALL ON TABLE "public"."user_role" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "pivot" GRANT SELECT,USAGE ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "pivot" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







