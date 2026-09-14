-- =====================================================================
-- JALON 2 — clôture du chargement : le déclencheur reprend son service
--
-- Les 4 158 comptes pré-provisionnés ont été rattachés par IDENTIFIANT
-- (api.lier_compte), pas par courriel : 4 158 utilisateurs créés dans
-- auth.users, 4 158 comptes liés, 0 échec, 0 compte dormant restant.
--
-- Le déclencheur, retiré le temps du chargement pour que deux mécanismes
-- n'écrivent pas en même temps sur app.compte, reprend son rôle : rattacher
-- les inscriptions FUTURES. Il s'appuie désormais sur la version gardée de
-- api.rattacher_compte, qui ne réattribue jamais un compte déjà pris.
--
-- CE QUI RESTE OUVERT, et qui ne se règle pas ici :
--   · le déclencheur s'exécute AFTER INSERT, donc avant confirmation de
--     l'adresse. La garde empêche le vol d'un compte existant, elle
--     n'empêche pas la création d'un compte neuf sur une adresse non
--     confirmée. Le remède est ailleurs : fermer l'auto-inscription.
--   · 4 158 adresses occupent désormais auth.users : s'inscrire avec l'une
--     d'elles est refusé par Supabase. La surface restante, ce sont les
--     adresses INCONNUES du modèle — pour lesquelles rattacher_compte rend
--     NULL et ne crée rien.
-- =====================================================================

drop trigger if exists rattacher_compte on auth.users;
create trigger rattacher_compte
  after insert on auth.users
  for each row execute function api.au_nouvel_utilisateur();

do $$
declare n_auth integer; n_lies integer; n_dormants integer;
begin
  select count(*) into n_auth from auth.users;
  select count(*) into n_lies from app.compte where auth_id is not null;
  select count(*) into n_dormants from app.compte where auth_id is null and actif;

  insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
  values ('activation_comptes', 'auth.users + app.compte',
          4158, n_lies, n_dormants,
          format('chargement initial : %s utilisateurs dans auth.users, %s comptes rattachés, '
                 '%s encore dormants. Rattachement par identifiant '
                 '(app.compte.id = reprise.uid(''compte#''||user_id)), adresses tirées de '
                 'l''API Bubble faute de colonne courriel dans le miroir.',
                 n_auth, n_lies, n_dormants));

  raise notice 'activation : % utilisateurs, % comptes liés, % dormants', n_auth, n_lies, n_dormants;
end
$$;
