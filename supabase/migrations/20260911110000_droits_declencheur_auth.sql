-- =====================================================================
-- Rendre au rôle de GoTrue le droit d'exécuter le déclencheur
--
-- SYMPTÔME MESURÉ. Créer un utilisateur dont l'adresse correspond à un
-- contact entreprise rendait « Database error creating new user » (HTTP 500),
-- alors qu'une adresse ne correspondant à personne passait. Appelée
-- directement en SQL avec un `auth_id` réel, et en laissant commiter,
-- `api.rattacher_compte` fait pourtant exactement son travail : compte créé,
-- un accès posé, contrainte différée satisfaite.
--
-- La seule différence restante était le RÔLE. L'API d'authentification
-- s'exécute en `supabase_auth_admin`, pas en `postgres`. Or `revoke execute
-- on all functions in schema api from public` — présent depuis la création du
-- schéma, et rejoué le 10/09 — lui retire le droit d'exécuter le déclencheur
-- et la fonction qu'il appelle, puisqu'il n'en avait pas d'autre que celui
-- hérité de PUBLIC.
--
-- Pourquoi une adresse inconnue passait quand même : la fonction ne fait
-- alors AUCUNE écriture. C'est l'insertion dans app.compte et app.acces qui
-- butait, pas la lecture.
--
-- Même leçon que pour service_role le 10/09 : un revoke sur PUBLIC doit être
-- suivi d'un grant à CHAQUE rôle qui en dépendait. Ici il y en avait trois.
-- =====================================================================

grant usage on schema api to supabase_auth_admin;
grant execute on function api.au_nouvel_utilisateur(), api.rattacher_compte(uuid, text)
                       to supabase_auth_admin;
