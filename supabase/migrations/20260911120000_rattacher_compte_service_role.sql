-- =====================================================================
-- Rendre api.rattacher_compte appelable par service_role
--
-- Elle n'était exécutable que par le déclencheur, ce qui rend tout
-- diagnostic impossible : GoTrue masque l'erreur SQL derrière un
-- « Database error creating new user » sans détail. L'accorder à
-- service_role permet de la rejouer depuis l'outillage et de LIRE l'erreur,
-- et de rattacher à la main un compte qui aurait échoué.
--
-- Le risque est nul en pratique : la garde « auth_id is null » empêche
-- de réattribuer un compte déjà pris, et service_role contourne déjà la RLS.
-- =====================================================================

grant execute on function api.rattacher_compte(uuid, text) to service_role;
