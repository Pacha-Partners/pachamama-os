-- =====================================================================
-- Rendre à service_role ce que le revoke sur PUBLIC lui a pris
--
-- La migration précédente a révoqué EXECUTE sur PUBLIC pour toutes les
-- fonctions de `api` — c'est la parade obligatoire au fait que
-- `create or replace function` réaccorde à PUBLIC. Mais `service_role`
-- n'avait JAMAIS eu de grant explicite sur ces fonctions : il héritait par
-- PUBLIC. Il s'est donc retrouvé sans droit, et api.moi lui répondait
-- « permission denied for function mes_portails ».
--
-- Leçon à retenir pour les prochaines : après un revoke sur PUBLIC, il faut
-- ré-accorder à CHAQUE rôle qui en dépendait, pas au seul `authenticated`.
-- service_role contourne la RLS, pas les droits d'exécution.
-- =====================================================================

grant execute on function api.compte_id(), api.est_interne(), api.role_interne(),
                          api.ma_fiche_talent(), api.mes_entreprises(),
                          api.mes_portails(), api.a_portail(text), api.role_sur(text)
                       to service_role;
