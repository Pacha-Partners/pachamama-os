-- =====================================================================
-- 03_verifier.sql — contrôle du clone. LECTURE SEULE.
-- À exécuter juste après 02_cloner.sql.
--
-- Règle appliquée : un contrôle qui passe au vert sur une base vide ne
-- prouve rien. Chaque ligne affiche la valeur mesurée, pas seulement un
-- verdict, et le total de lignes doit être NON NUL pour valoir preuve.
--
-- Lire la colonne « verdict » :
--   ARRÊT  — le clone n'est pas utilisable en l'état
--   ÉCART  — à comprendre avant de continuer
--   À LIRE — attendu dans certains cas, mais à regarder
--   OK / INFO
--
-- Un écart de quelques lignes sur les tables alimentées par la synchro
-- n8n (candidat, mandat, note, _sync_*) est NORMAL : la production a
-- continué d'écrire depuis l'instantané. Un écart sur une table ref_* ou
-- sur le schéma pivot ne l'est pas.
-- =====================================================================

WITH paires(src, dst) AS (
    VALUES ('public', 'public_test'), ('pivot', 'pivot_test')
),
appaire AS (
    SELECT p.src, p.dst, c.relname, c.relkind, c.oid AS src_oid,
           to_regclass(format('%I.%I', p.dst, c.relname)) AS dst_oid
      FROM paires p
      JOIN pg_namespace n ON n.nspname = p.src
      JOIN pg_class c     ON c.relnamespace = n.oid AND c.relkind IN ('r','v','m')
),
comptes AS (
    SELECT a.*,
           (xpath('/row/c/text()',
                  query_to_xml(format('SELECT count(*) AS c FROM %I.%I', a.src, a.relname),
                               false, true, '')))[1]::text::bigint AS n_src,
           CASE WHEN a.dst_oid IS NULL THEN NULL ELSE
           (xpath('/row/c/text()',
                  query_to_xml(format('SELECT count(*) AS c FROM %I.%I', a.dst, a.relname),
                               false, true, '')))[1]::text::bigint END AS n_dst,
           (SELECT count(*) FROM pg_attribute at
             WHERE at.attrelid = a.src_oid AND at.attnum > 0 AND NOT at.attisdropped) AS col_src,
           (SELECT count(*) FROM pg_attribute at
             WHERE at.attrelid = a.dst_oid AND at.attnum > 0 AND NOT at.attisdropped) AS col_dst
      FROM appaire a
),
agg AS (
    SELECT n.nspname,
           (SELECT count(*) FROM pg_constraint co
              JOIN pg_class c2 ON c2.oid = co.conrelid
             WHERE c2.relnamespace = n.oid AND co.contype IN ('p','u','c','f')) AS contraintes,
           (SELECT count(*) FROM pg_index i
              JOIN pg_class c2 ON c2.oid = i.indrelid
             WHERE c2.relnamespace = n.oid)                                       AS index_,
           (SELECT count(*) FROM pg_class c2
             WHERE c2.relnamespace = n.oid AND c2.relkind = 'r'
               AND c2.relrowsecurity)                                             AS rls,
           (SELECT count(*) FROM pg_policy p2
              JOIN pg_class c2 ON c2.oid = p2.polrelid
             WHERE c2.relnamespace = n.oid)                                       AS policies,
           (SELECT count(*) FROM pg_class c2
             WHERE c2.relnamespace = n.oid AND c2.relkind = 'S')                  AS sequences
      FROM pg_namespace n
     WHERE n.nspname IN ('public','pivot','public_test','pivot_test')
),
duo AS (
    SELECT p.src, p.dst,
           a1.contraintes AS c_src, COALESCE(a2.contraintes, -1) AS c_dst,
           a1.index_      AS i_src, COALESCE(a2.index_,      -1) AS i_dst,
           a1.rls         AS r_src, COALESCE(a2.rls,         -1) AS r_dst,
           a1.policies    AS p_src, COALESCE(a2.policies,    -1) AS p_dst,
           a1.sequences   AS s_src, COALESCE(a2.sequences,   -1) AS s_dst
      FROM paires p
      JOIN agg a1      ON a1.nspname = p.src
      LEFT JOIN agg a2 ON a2.nspname = p.dst
)

SELECT * FROM (

SELECT 1 AS ord, '(global)'::text AS perimetre,
       'schémas de test présents'::text AS controle,
       COALESCE((SELECT string_agg(nspname, ', ' ORDER BY nspname) FROM pg_namespace
                  WHERE nspname IN ('public_test','pivot_test')), '— AUCUN —')::text AS mesure,
       CASE WHEN (SELECT count(*) FROM pg_namespace
                   WHERE nspname IN ('public_test','pivot_test')) = 2
            THEN 'OK' ELSE 'ARRÊT' END::text AS verdict

UNION ALL
SELECT 2, c.src, 'relations : source / clone',
       format('%s / %s', count(*), count(*) FILTER (WHERE c.dst_oid IS NOT NULL)),
       CASE WHEN count(*) = count(*) FILTER (WHERE c.dst_oid IS NOT NULL)
            THEN 'OK' ELSE 'ARRÊT' END
FROM comptes c GROUP BY c.src

UNION ALL
SELECT 3, c.src, 'relations MANQUANTES dans le clone',
       COALESCE(string_agg(c.relname, ', ' ORDER BY c.relname)
                FILTER (WHERE c.dst_oid IS NULL), '— aucune —'),
       CASE WHEN count(*) FILTER (WHERE c.dst_oid IS NULL) = 0 THEN 'OK' ELSE 'ARRÊT' END
FROM comptes c GROUP BY c.src

UNION ALL
SELECT 4, c.src, 'lignes copiées : source / clone (doit être NON NUL)',
       format('%s / %s', SUM(c.n_src), SUM(COALESCE(c.n_dst, 0))),
       CASE WHEN SUM(COALESCE(c.n_dst, 0)) = 0 THEN 'ARRÊT'
            WHEN SUM(c.n_src) = SUM(COALESCE(c.n_dst, 0)) THEN 'OK'
            ELSE 'À LIRE' END
FROM comptes c GROUP BY c.src

UNION ALL
SELECT 5, c.src, 'relations au compte différent (delta clone − source)',
       COALESCE(string_agg(format('%s %s%s', c.relname,
                    CASE WHEN c.n_dst - c.n_src > 0 THEN '+' ELSE '' END,
                    c.n_dst - c.n_src), ', ' ORDER BY abs(c.n_dst - c.n_src) DESC)
                FILTER (WHERE c.dst_oid IS NOT NULL AND c.n_src IS DISTINCT FROM c.n_dst),
                '— aucune —'),
       CASE WHEN count(*) FILTER (WHERE c.dst_oid IS NOT NULL
                                    AND c.n_src IS DISTINCT FROM c.n_dst) = 0
            THEN 'OK' ELSE 'À LIRE' END
FROM comptes c GROUP BY c.src

UNION ALL
SELECT 6, c.src, 'relations dont le nombre de colonnes diffère',
       COALESCE(string_agg(c.relname, ', ' ORDER BY c.relname)
                FILTER (WHERE c.col_src <> c.col_dst), '— aucune —'),
       CASE WHEN count(*) FILTER (WHERE c.col_src <> c.col_dst) = 0
            THEN 'OK' ELSE 'ARRÊT' END
FROM comptes c WHERE c.dst_oid IS NOT NULL GROUP BY c.src

UNION ALL
SELECT 7, d.src, 'contraintes PK/unique/check/FK : source vs clone',
       format('%s vs %s', d.c_src, d.c_dst),
       CASE WHEN d.c_src = d.c_dst THEN 'OK' ELSE 'ÉCART' END
FROM duo d

UNION ALL
SELECT 8, d.src, 'index : source vs clone',
       format('%s vs %s', d.i_src, d.i_dst),
       CASE WHEN d.i_src = d.i_dst THEN 'OK' ELSE 'ÉCART' END
FROM duo d

UNION ALL
SELECT 9, d.src, 'tables avec RLS activée : source vs clone',
       format('%s vs %s', d.r_src, d.r_dst),
       CASE WHEN d.r_src = d.r_dst THEN 'OK' ELSE 'ARRÊT' END
FROM duo d

UNION ALL
SELECT 10, d.src, 'policies RLS : source vs clone',
       format('%s vs %s', d.p_src, d.p_dst),
       CASE WHEN d.p_src = d.p_dst THEN 'OK' ELSE 'ÉCART' END
FROM duo d

UNION ALL
SELECT 11, d.src, 'séquences : source vs clone',
       format('%s vs %s', d.s_src, d.s_dst),
       CASE WHEN d.s_src = d.s_dst THEN 'OK' ELSE 'ÉCART' END
FROM duo d

-- ---- la partie sécurité : le clone doit être fermé ----
UNION ALL
SELECT 20, p.dst, 'vues du clone SANS security_invoker',
       COALESCE((SELECT string_agg(c.relname, ', ') FROM pg_class c
                   JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = p.dst AND c.relkind = 'v'
                    AND NOT COALESCE(array_to_string(c.reloptions, ',')
                                     LIKE '%security_invoker=t%', false)),
                '— toutes protégées —'),
       CASE WHEN (SELECT count(*) FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                   WHERE n.nspname = p.dst AND c.relkind = 'v'
                     AND NOT COALESCE(array_to_string(c.reloptions, ',')
                                      LIKE '%security_invoker=t%', false)) = 0
            THEN 'OK' ELSE 'ARRÊT' END
FROM paires p

-- Une vue matérialisée n'accepte pas security_invoker et ne porte pas de RLS :
-- elle s'exécute toujours avec les droits de son propriétaire. S'il y en a une
-- dans le clone, elle ouvre ce que les tables ferment — à traiter par les droits.
UNION ALL
SELECT 20, p.dst, 'vues MATÉRIALISÉES du clone (hors RLS par nature)',
       COALESCE((SELECT string_agg(c.relname, ', ') FROM pg_class c
                   JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = p.dst AND c.relkind = 'm'), '— aucune —'),
       CASE WHEN (SELECT count(*) FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                   WHERE n.nspname = p.dst AND c.relkind = 'm') = 0
            THEN 'OK' ELSE 'À LIRE' END
FROM paires p

UNION ALL
SELECT 21, p.dst, 'droits de table accordés à anon / authenticated (attendu 0)',
       (SELECT count(*)::text FROM information_schema.role_table_grants
         WHERE table_schema = p.dst AND grantee IN ('anon','authenticated')),
       CASE WHEN (SELECT count(*) FROM information_schema.role_table_grants
                   WHERE table_schema = p.dst AND grantee IN ('anon','authenticated')) = 0
            THEN 'OK' ELSE 'ARRÊT' END
FROM paires p

UNION ALL
SELECT 22, p.dst, 'USAGE du schéma pour anon (attendu false)',
       CASE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
            THEN 'rôle anon absent'
            ELSE has_schema_privilege('anon', p.dst, 'USAGE')::text END,
       CASE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN 'OK'
            WHEN has_schema_privilege('anon', p.dst, 'USAGE') THEN 'ARRÊT'
            ELSE 'OK' END
FROM paires p

UNION ALL
SELECT 23, p.dst, 'déclencheurs dans le clone (attendu 0, non clonés)',
       (SELECT count(*)::text FROM pg_trigger t
          JOIN pg_class c     ON c.oid = t.tgrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = p.dst AND NOT t.tgisinternal),
       'INFO'
FROM paires p

UNION ALL
SELECT 24, '(global)', 'taille des schémas de test',
       COALESCE((SELECT string_agg(x.nspname || ' ' || pg_size_pretty(x.t), ', ' ORDER BY x.nspname)
                   FROM (SELECT n.nspname, SUM(pg_total_relation_size(c.oid)) AS t
                           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                          WHERE n.nspname IN ('public_test','pivot_test')
                            AND c.relkind IN ('r','m')
                          GROUP BY n.nspname) x), '—'),
       'INFO'

UNION ALL
SELECT 25, '(global)', 'taille totale de la base après clonage',
       pg_size_pretty(pg_database_size(current_database())), 'INFO'

) q ORDER BY ord, perimetre;
