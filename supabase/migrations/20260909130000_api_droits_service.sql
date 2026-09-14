-- =====================================================================
-- LE SERVICE_ROLE N'AVAIT AUCUN DROIT SUR api
--
-- Trouvé par le harnais J1 : le contrôle « le nombre d'offres servi à la
-- clé publique égale celui obtenu avec la clé de service » échouait, non
-- parce que les comptes différaient, mais parce que la clé de service
-- recevait un 403.
--
-- La cause : les vues de api sont en security_invoker, donc l'appelant
-- doit avoir SELECT dessus — et service_role, qui contourne la RLS, ne
-- contourne pas les DROITS. Je les avais accordés à anon et authenticated
-- en oubliant celui qui sert précisément à vérifier les deux autres.
--
-- C'est le contrôle croisé du ticket qui l'a révélé : sans lui, le job
-- board fonctionnait et personne n'aurait vu que la vérification, elle,
-- ne fonctionnait pas.
-- =====================================================================

grant select on all tables in schema api to service_role;
alter default privileges in schema api grant select on tables to service_role;
grant execute on all functions in schema api to service_role;
