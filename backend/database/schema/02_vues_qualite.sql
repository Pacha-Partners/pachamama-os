-- =====================================================================
-- Pachamama OS — Vues de qualité de la base talent unifiée
-- =====================================================================
-- Chaque vue matérialise une anomalie identifiée pendant la
-- réconciliation. Le principe : une file de revue doit être
-- INTERROGEABLE et se recalculer d'elle-même, pas dormir dans un
-- markdown qui périme dès la première correction.
-- =====================================================================

BEGIN;
SET search_path TO pivot, public, extensions;

-- ---------------------------------------------------------------------
-- 1. Dorés sans identité exploitable
-- ---------------------------------------------------------------------
-- Un talent sans nom ni prénom n'est pas sourçable. Ces fiches viennent
-- de sources dépourvues de clé forte : à enrichir ou à archiver.
CREATE OR REPLACE VIEW pivot.qa_sans_identite
WITH (security_invoker = true) AS
SELECT t.talent_id, t.type_fusion, t.headline, t.url_linkedin, t.employeur_actuel,
       (SELECT count(*) FROM pivot.email e WHERE e.talent_id = t.talent_id) AS nb_emails
FROM pivot.talent t
WHERE t.nom IS NULL AND t.prenom IS NULL;
COMMENT ON VIEW pivot.qa_sans_identite IS 'Dorés sans nom ni prénom : file d''enrichissement ou d''archivage.';

-- ---------------------------------------------------------------------
-- 2. Clusters portant plusieurs liens vers UNE MÊME source
-- ---------------------------------------------------------------------
-- Conséquence normale de la clôture transitive : des doublons internes
-- ont été collapsés. Mais un cluster multi-Jarvi peut aussi révéler une
-- SUR-FUSION (couple partageant un email, adresse d'assistant). À
-- valider humainement avant de figer.
CREATE OR REPLACE VIEW pivot.qa_multi_source
WITH (security_invoker = true) AS
SELECT s.talent_id, s.source, count(*) AS nb_liens,
       t.prenom, t.nom, t.employeur_actuel,
       string_agg(s.external_id, ' | ' ORDER BY s.external_id) AS identifiants
FROM pivot.talent_source s
JOIN pivot.talent t ON t.talent_id = s.talent_id
GROUP BY s.talent_id, s.source, t.prenom, t.nom, t.employeur_actuel
HAVING count(*) > 1;
COMMENT ON VIEW pivot.qa_multi_source IS 'Clusters à plusieurs liens vers une même source : doublons collapsés, à contrôler contre la sur-fusion.';

-- ---------------------------------------------------------------------
-- 3. Talents sans aucun moyen de contact
-- ---------------------------------------------------------------------
-- Ni email ni téléphone : injoignables, donc inexploitables pour du
-- sourcing tant qu'ils ne sont pas enrichis.
CREATE OR REPLACE VIEW pivot.qa_sans_contact
WITH (security_invoker = true) AS
SELECT t.talent_id, t.prenom, t.nom, t.type_fusion, t.url_linkedin, t.employeur_actuel
FROM pivot.talent t
WHERE NOT EXISTS (SELECT 1 FROM pivot.email e WHERE e.talent_id = t.talent_id)
  AND NOT EXISTS (SELECT 1 FROM pivot.phone p WHERE p.talent_id = t.talent_id);
COMMENT ON VIEW pivot.qa_sans_contact IS 'Talents injoignables : ni email ni téléphone.';

-- ---------------------------------------------------------------------
-- 4. Emails génériques
-- ---------------------------------------------------------------------
-- contact@, rh@ : conservés en donnée mais exclus des clés de matching.
-- Les exposer permet de vérifier que cette exclusion est bien appliquée.
CREATE OR REPLACE VIEW pivot.qa_emails_generiques
WITH (security_invoker = true) AS
SELECT e.talent_id, e.email, e.source, t.prenom, t.nom
FROM pivot.email e
JOIN pivot.talent t ON t.talent_id = e.talent_id
WHERE e.generique IS TRUE;

-- ---------------------------------------------------------------------
-- 5. Audit de préséance
-- ---------------------------------------------------------------------
-- La règle : quand Jarvi renseigne un champ, il gagne. Une valeur
-- étiquetée 'app' sur un talent qui possède une source Jarvi est donc
-- suspecte — sauf si Jarvi était vide, cas légitime (règle R1 : le vide
-- n'est pas autoritaire). Cette vue liste les cas à examiner.
CREATE OR REPLACE VIEW pivot.qa_preseance_suspecte
WITH (security_invoker = true) AS
SELECT t.talent_id, t.prenom, t.nom, t.type_fusion,
       t.prenom_src, t.nom_src, t.localisation_src, t.employeur_src
FROM pivot.talent t
WHERE t.type_fusion = 'merged'
  AND (t.prenom_src = 'app' OR t.nom_src = 'app'
       OR t.localisation_src = 'app' OR t.employeur_src = 'app');
COMMENT ON VIEW pivot.qa_preseance_suspecte IS
  'Talents fusionnés dont un champ à préséance provient de l''app : légitime seulement si Jarvi était vide (R1).';

-- ---------------------------------------------------------------------
-- 6. Tableau de bord de complétude
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW pivot.qa_completude
WITH (security_invoker = true) AS
SELECT
  (SELECT count(*) FROM pivot.talent)                                    AS talents,
  (SELECT count(*) FROM pivot.talent WHERE type_fusion = 'merged')       AS fusionnes,
  (SELECT count(*) FROM pivot.talent WHERE type_fusion = 'jarvi_only')   AS jarvi_seul,
  (SELECT count(*) FROM pivot.talent WHERE type_fusion = 'app_only')     AS app_seul,
  (SELECT count(*) FROM pivot.talent WHERE nom IS NOT NULL OR prenom IS NOT NULL) AS avec_identite,
  (SELECT count(*) FROM pivot.qualification)                            AS avec_qualification,
  (SELECT count(*) FROM pivot.attentes)                                  AS avec_attentes,
  (SELECT count(*) FROM pivot.parcours)                                  AS avec_parcours,
  (SELECT count(DISTINCT talent_id) FROM pivot.email)                    AS avec_email,
  (SELECT count(DISTINCT talent_id) FROM pivot.phone)                    AS avec_telephone,
  (SELECT count(DISTINCT talent_id) FROM pivot.note_journal)             AS avec_notes,
  (SELECT count(*) FROM pivot.note_journal)                              AS notes_total,
  (SELECT count(*) FROM pivot.talent WHERE cv_url IS NOT NULL)           AS avec_cv;
COMMENT ON VIEW pivot.qa_completude IS 'Une ligne : l''état de complétude de la base talent, recalculé à la demande.';

-- Droits : mêmes règles que le reste du schéma (refus par défaut).
DO $$
DECLARE r text; v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['qa_sans_identite','qa_multi_source','qa_sans_contact',
                           'qa_emails_generiques','qa_preseance_suspecte','qa_completude'] LOOP
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON TABLE pivot.%I FROM %I', v, r);
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT SELECT ON TABLE pivot.%I TO service_role', v);
    END IF;
  END LOOP;
END $$;

COMMIT;
NOTIFY pgrst, 'reload schema';
