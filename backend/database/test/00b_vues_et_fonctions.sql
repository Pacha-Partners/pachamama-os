-- =====================================================================
-- 00b_vues_et_fonctions.sql — LECTURE SEULE. À exécuter avec le 00.
--
-- Séparé du 00 pour une raison précise : c'est le seul contrôle que je
-- n'ai pas pu exécuter sur un PostgreSQL local avant de vous le donner.
-- S'il échoue, l'inventaire du 00 reste valable.
--
-- Ce qu'il cherche, et pourquoi :
--   le clonage vérifie par pg_depend qu'aucune vue du clone ne lit une
--   table de la source. Mais PostgreSQL n'enregistre AUCUNE dépendance
--   sur le corps d'une fonction. Si une vue appelle une fonction dont le
--   corps nomme « public.x » en dur, la vue clonée lira la PRODUCTION et
--   rien ne le signalera.
--
-- Cette requête doit renvoyer « — aucune — » sur les deux schémas.
-- Sinon : lire le corps des fonctions citées avant de cloner.
-- =====================================================================

WITH sch AS (SELECT unnest(ARRAY['public','pivot']) AS nsp)
SELECT s.nsp AS schema,
       COALESCE((SELECT string_agg(DISTINCT x.relname || ' -> ' || p.proname || '()', ', ')
                   FROM (SELECT c.relname, pg_get_viewdef(c.oid, true) AS def
                           FROM pg_class c
                           JOIN pg_namespace n ON n.oid = c.relnamespace
                          WHERE n.nspname = s.nsp AND c.relkind IN ('v','m')
                          OFFSET 0) x
                   JOIN pg_proc p
                     ON p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = s.nsp)
                  WHERE x.def ~ ('\m' || p.proname || '\s*\(')),
                '- aucune -') AS vues_appelant_une_fonction
  FROM sch s
 ORDER BY 1;
