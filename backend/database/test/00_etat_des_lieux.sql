-- =====================================================================
-- 00_etat_des_lieux.sql
-- Inventaire avant clonage des schémas de test. LECTURE SEULE.
-- Ne crée rien, ne modifie rien, ne pose aucun verrou d'écriture.
--
-- À exécuter dans l'éditeur SQL Supabase, et à lire AVANT 02_cloner.sql.
-- Trois lignes décident si on peut y aller : la taille de la base,
-- la place que prendrait le clone, et la présence de déclencheurs.
-- =====================================================================

WITH sch AS (
    SELECT unnest(ARRAY['public','pivot']) AS nsp
),
rel AS (
    SELECT n.nspname AS nsp, c.oid, c.relname, c.relkind,
           c.relrowsecurity, c.relforcerowsecurity, c.reloptions
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public','pivot')
),
att AS (
    SELECT r.nsp, r.relname, a.attname, a.attidentity, a.attgenerated,
           t.typtype, tn.nspname AS type_nsp, format_type(a.atttypid, a.atttypmod) AS type_nom
    FROM rel r
    JOIN pg_attribute a ON a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped
    JOIN pg_type t      ON t.oid = a.atttypid
    JOIN pg_namespace tn ON tn.oid = t.typnamespace
    WHERE r.relkind IN ('r','p')
)

SELECT * FROM (

-- ---------- la base ----------
SELECT 1 AS ord, '(base)'::text AS schema, 'version PostgreSQL'::text AS mesure,
       substring(version() from 'PostgreSQL [0-9.]+')::text AS valeur
UNION ALL
SELECT 2, '(base)', 'taille totale de la base',
       pg_size_pretty(pg_database_size(current_database()))
UNION ALL
SELECT 3, '(base)', 'rôle qui exécute ce script', current_user::text
UNION ALL
SELECT 4, '(base)', 'PLACE QUE PRENDRAIT LE CLONE',
       pg_size_pretty(COALESCE((SELECT SUM(pg_total_relation_size(oid))
                                FROM rel WHERE relkind IN ('r','p','m')),0))
UNION ALL
SELECT 5, '(base)', 'schémas *_test déjà présents',
       COALESCE((SELECT string_agg(nspname, ', ' ORDER BY nspname) FROM pg_namespace
                 WHERE nspname LIKE '%\_test'), '— aucun —')
UNION ALL
SELECT 6, '(base)', 'extensions installées',
       COALESCE((SELECT string_agg(e.extname || '@' || n.nspname, ', ' ORDER BY e.extname)
                 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace), '—')

-- ---------- par schéma : le volume ----------
UNION ALL
SELECT 10, s.nsp, 'tables / vues / vues matérialisées / partitionnées',
       format('%s / %s / %s / %s',
              count(*) FILTER (WHERE r.relkind = 'r'),
              count(*) FILTER (WHERE r.relkind = 'v'),
              count(*) FILTER (WHERE r.relkind = 'm'),
              count(*) FILTER (WHERE r.relkind = 'p'))
FROM sch s LEFT JOIN rel r ON r.nsp = s.nsp GROUP BY s.nsp
UNION ALL
SELECT 11, s.nsp, 'taille du schéma (tables + index)',
       pg_size_pretty(COALESCE(SUM(pg_total_relation_size(r.oid)),0))
FROM sch s LEFT JOIN rel r ON r.nsp = s.nsp AND r.relkind IN ('r','p','m') GROUP BY s.nsp
UNION ALL
SELECT 12, s.nsp, 'les 3 plus grosses tables',
       COALESCE((SELECT string_agg(x.relname || ' ' || pg_size_pretty(x.t), ', ' ORDER BY x.t DESC)
                 FROM (SELECT r2.relname, pg_total_relation_size(r2.oid) AS t
                       FROM rel r2 WHERE r2.nsp = s.nsp AND r2.relkind = 'r'
                       ORDER BY 2 DESC LIMIT 3) x), '—')
FROM sch s

-- ---------- par schéma : ce que le clonage doit reproduire ----------
UNION ALL
SELECT 20, s.nsp, 'séquences (dont liées à une colonne identity)',
       format('%s (dont %s)',
              (SELECT count(*) FROM rel r WHERE r.nsp = s.nsp AND r.relkind = 'S'),
              (SELECT count(*) FROM rel r WHERE r.nsp = s.nsp AND r.relkind = 'S'
                 AND EXISTS (SELECT 1 FROM pg_depend d
                             WHERE d.classid = 'pg_class'::regclass
                               AND d.objid = r.oid AND d.deptype = 'i')))
FROM sch s
UNION ALL
SELECT 21, s.nsp, 'colonnes identity / générées / à défaut nextval',
       format('%s / %s / %s',
              (SELECT count(*) FROM att a WHERE a.nsp = s.nsp AND a.attidentity <> ''),
              (SELECT count(*) FROM att a WHERE a.nsp = s.nsp AND a.attgenerated <> ''),
              (SELECT count(*) FROM pg_attrdef ad
                 JOIN rel r ON r.oid = ad.adrelid
                WHERE r.nsp = s.nsp
                  AND pg_get_expr(ad.adbin, ad.adrelid) LIKE '%nextval%'))
FROM sch s
UNION ALL
SELECT 22, s.nsp, 'contraintes PK / unique / check / FK / exclusion',
       format('%s / %s / %s / %s / %s',
              count(*) FILTER (WHERE co.contype = 'p'),
              count(*) FILTER (WHERE co.contype = 'u'),
              count(*) FILTER (WHERE co.contype = 'c'),
              count(*) FILTER (WHERE co.contype = 'f'),
              count(*) FILTER (WHERE co.contype = 'x'))
FROM sch s
LEFT JOIN rel r ON r.nsp = s.nsp
LEFT JOIN pg_constraint co ON co.conrelid = r.oid
GROUP BY s.nsp
UNION ALL
SELECT 23, s.nsp, 'FK qui SORTENT du schéma (à surveiller)',
       COALESCE((SELECT string_agg(DISTINCT r2.relname || ' -> ' || cn.nspname, ', ')
                 FROM rel r2
                 JOIN pg_constraint co2 ON co2.conrelid = r2.oid AND co2.contype = 'f'
                 JOIN pg_class cc ON cc.oid = co2.confrelid
                 JOIN pg_namespace cn ON cn.oid = cc.relnamespace
                 WHERE r2.nsp = s.nsp AND cn.nspname <> s.nsp), '— aucune —')
FROM sch s
UNION ALL
SELECT 24, s.nsp, 'index (hors ceux des PK/unique)',
       (SELECT count(*) FROM pg_index i JOIN rel r ON r.oid = i.indrelid
        WHERE r.nsp = s.nsp AND NOT i.indisprimary AND NOT i.indisunique)::text
FROM sch s
UNION ALL
SELECT 25, s.nsp, 'types non standard utilisés par des colonnes',
       COALESCE((SELECT string_agg(DISTINCT a.type_nom, ', ')
                 FROM att a WHERE a.nsp = s.nsp
                   AND a.type_nsp NOT IN ('pg_catalog','information_schema')), '— aucun —')
FROM sch s

-- ---------- par schéma : la sécurité ----------
UNION ALL
SELECT 30, s.nsp, 'tables avec RLS activée / total tables',
       format('%s / %s',
              count(*) FILTER (WHERE r.relkind = 'r' AND r.relrowsecurity),
              count(*) FILTER (WHERE r.relkind = 'r'))
FROM sch s LEFT JOIN rel r ON r.nsp = s.nsp GROUP BY s.nsp
UNION ALL
SELECT 31, s.nsp, 'policies RLS existantes',
       COALESCE((SELECT string_agg(c2.relname || '.' || p.polname, ', ')
                 FROM pg_policy p JOIN rel c2 ON c2.oid = p.polrelid
                 WHERE c2.nsp = s.nsp), '— aucune —')
FROM sch s
UNION ALL
SELECT 32, s.nsp, 'vues SANS security_invoker (contournent la RLS)',
       COALESCE((SELECT string_agg(r2.relname, ', ')
                 FROM rel r2 WHERE r2.nsp = s.nsp AND r2.relkind IN ('v','m')
                   AND NOT COALESCE(array_to_string(r2.reloptions,',') LIKE '%security_invoker=t%', false)),
                '— toutes protégées —')
FROM sch s

-- ---------- par schéma : ce que le clonage NE reprendra PAS ----------
UNION ALL
SELECT 40, s.nsp, 'DÉCLENCHEURS (non clonés — à lire)',
       COALESCE((SELECT string_agg(r2.relname || '.' || t.tgname, ', ')
                 FROM pg_trigger t JOIN rel r2 ON r2.oid = t.tgrelid
                 WHERE r2.nsp = s.nsp AND NOT t.tgisinternal), '— aucun —')
FROM sch s
UNION ALL
SELECT 41, s.nsp, 'fonctions du schéma (non clonées)',
       format('%s, dont %s en SECURITY DEFINER',
              (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = s.nsp),
              (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = s.nsp AND p.prosecdef))
FROM sch s
UNION ALL
SELECT 42, s.nsp, 'fonctions SECURITY DEFINER, par nom',
       COALESCE((SELECT string_agg(p.proname, ', ' ORDER BY p.proname)
                 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = s.nsp AND p.prosecdef), '— aucune —')
FROM sch s

) q ORDER BY ord, schema;
