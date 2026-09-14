-- =====================================================================
-- Fermer api.v_fuite_client aux comptes connectés
--
-- MESURÉ, avec un vrai jeton d'utilisateur, le 10/09/2026 : un compte
-- authentifié lit 11 lignes de cette vue, dont une colonne `client` qui
-- NOMME l'entreprise derrière des offres publiées comme anonymes. C'est
-- exactement ce que api.offre_publique et api.offre_detail passent leur
-- temps à masquer.
--
-- Deux causes, cumulées :
--   · la vue n'a pas de clause `security_invoker`, donc elle vaut DEFINER et
--     traverse la RLS de l'appelant ;
--   · 20260909110000_j1_job_board.sql:142 lui accorde explicitement SELECT à
--     `authenticated`, et le `grant select on all tables in schema api to
--     authenticated` de 20260908234500:228 le referait de toute façon.
--
-- Elle n'a jamais eu vocation à servir un utilisateur : c'est un CONTRÔLE
-- QUALITÉ, qui doit rester à zéro et qu'on regarde depuis l'outillage. Elle
-- reste donc lisible par service_role, et par personne d'autre.
--
-- Tant qu'aucun compte ne pouvait se connecter, le défaut était théorique.
-- Il a cessé de l'être aujourd'hui : 4 158 comptes existent désormais.
-- =====================================================================

revoke all on api.v_fuite_client from anon, authenticated;
grant select on api.v_fuite_client to service_role;

comment on view api.v_fuite_client is
  'Les champs d''une offre anonyme qui nomment son propre client. CONTRÔLE QUALITÉ, réservé à service_role : elle contient précisément ce que le job board masque. Ne jamais l''accorder à authenticated.';
