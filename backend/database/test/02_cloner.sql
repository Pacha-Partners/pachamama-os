-- =====================================================================
-- 02_cloner.sql — crée public_test et pivot_test.
--
-- Prérequis : 00_etat_des_lieux.sql lu (surtout la ligne « PLACE QUE
-- PRENDRAIT LE CLONE »), et 01_outillage_clonage.sql exécuté.
--
-- Les deux appels tiennent dans UNE transaction : soit les deux schémas
-- existent à la fin, soit aucun. Et comme une transaction voit un seul
-- instantané, le clone est cohérent même si la synchro n8n écrit pendant
-- ce temps. Les lectures ne prennent qu'un verrou partagé : la synchro
-- n'est pas bloquée.
--
-- Durée attendue : quelques dizaines de secondes pour ~415 000 lignes.
-- =====================================================================

SET statement_timeout = '900s';
SET lock_timeout      = '15s';

SELECT rapport FROM (
    VALUES
        (1, outillage.cloner_schema(
                p_source       => 'public',
                p_cible        => 'public_test',
                p_avec_donnees => true,
                p_ecraser      => false)),
        (2, outillage.cloner_schema(
                p_source       => 'pivot',
                p_cible        => 'pivot_test',
                p_avec_donnees => true,
                p_ecraser      => false))
) AS t(ordre, rapport)
ORDER BY ordre;

-- ---------------------------------------------------------------------
-- RAFRAÎCHIR plus tard (le clone dérive, la production continue) :
-- reprendre le même appel avec p_ecraser => true. Le schéma de test est
-- alors DÉTRUIT puis reconstruit — tout ce qui y aura été développé
-- (policies, tables de travail) est perdu. À ne faire qu'en connaissance
-- de cause.
--
--   SELECT outillage.cloner_schema('public', 'public_test', true, true);
--   SELECT outillage.cloner_schema('pivot',  'pivot_test',  true, true);
--
-- STRUCTURE SEULE, sans données (base de test vierge) :
--   SELECT outillage.cloner_schema('public', 'public_test', false, true);
-- ---------------------------------------------------------------------
