-- =====================================================================
-- JALON 2 — préparer l'activation des 4 158 comptes pré-provisionnés
--
-- Trois gestes, dans cet ordre.
--
-- 1. FERMER LA REPRISE DE COMPTE. `api.rattacher_compte` écrivait
--    « update app.compte set auth_id = p_auth_id where id = v_compte »
--    sans vérifier que la place était libre. L'inscription étant ouverte et
--    la base portant désormais les VRAIES adresses, s'inscrire avec celle
--    d'un collaborateur réattribuait son compte — donc ses accès internes,
--    qui commandent 68 policies de lecture ET d'écriture sur core. Le
--    déclencheur s'exécute de surcroît AFTER INSERT, avant confirmation de
--    l'adresse. On ajoute « and auth_id is null » : le premier arrivé garde
--    sa place, et un second n'obtient rien plutôt que de prendre celle-ci.
--
-- 2. AJOUTER UNE LIAISON PAR IDENTIFIANT. Le rattachement par courriel ne
--    convient pas pour le chargement initial. Mesuré sur les 4 195 accès :
--    4 067 portent dans `core` la même adresse que Bubble, mais 69 en
--    portent une AUTRE et 59 n'en portent aucune — dont les 42 accès
--    internes, `public.user` n'ayant jamais eu de colonne courriel. Sur ces
--    128 cas, la fonction ne trouverait rien et CRÉERAIT un second compte.
--    L'appariement par identifiant, lui, est exact : app.compte.id vaut
--    reprise.uid('compte#'||user_id) (reprise 08:71), et les 4 158 comptes
--    retombent sur les 4 158 utilisateurs Bubble, sans trou ni doublon.
--
-- 3. RETIRER LE DÉCLENCHEUR le temps du chargement. Il sera remis, avec sa
--    garde, par la migration suivante. Le laisser ferait travailler les
--    deux mécanismes en même temps sur la même table.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La garde
-- ---------------------------------------------------------------------
create or replace function api.rattacher_compte(p_auth_id uuid, p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_compte uuid; v_personne uuid; v_type text;
begin
  select id into v_compte from app.compte where auth_id = p_auth_id;
  if found then return v_compte; end if;

  select a.compte_id into v_compte
    from app.acces a
    join core.collaborateur c on c.id = a.collaborateur_id
   where lower(c.email) = lower(p_email) limit 1;

  if v_compte is null then
    select a.compte_id into v_compte
      from app.acces a
      join core.fiche_talent f on f.id = a.fiche_talent_id
     where lower(f.email_personnel) = lower(p_email) limit 1;
  end if;

  if v_compte is null then
    select a.compte_id into v_compte
      from app.acces a
      join core.contact_client k on k.id = a.contact_client_id
     where lower(k.email::text) = lower(p_email) limit 1;
  end if;

  if v_compte is not null then
    -- LA GARDE. Un compte déjà rattaché ne change pas de main.
    update app.compte set auth_id = p_auth_id, maj_le = now()
     where id = v_compte and auth_id is null;
    if not found then return null; end if;
    return v_compte;
  end if;

  select k.id, 'contact' into v_personne, v_type
    from core.contact_client k where lower(k.email::text) = lower(p_email) limit 1;
  if v_personne is null then
    select f.id, 'talent' into v_personne, v_type
      from core.fiche_talent f where lower(f.email_personnel) = lower(p_email) limit 1;
  end if;
  if v_personne is null then return null; end if;

  insert into app.compte (auth_id, actif) values (p_auth_id, true) returning id into v_compte;
  if v_type = 'contact' then
    insert into app.acces (compte_id, contact_client_id, actif) values (v_compte, v_personne, true);
  else
    insert into app.acces (compte_id, fiche_talent_id, actif) values (v_compte, v_personne, true);
  end if;
  return v_compte;
end;
$$;

comment on function api.rattacher_compte(uuid, text) is
  'Rattache une connexion à son compte pré-provisionné, par l''e-mail, UNE SEULE FOIS : un compte déjà rattaché n''est jamais réattribué. Crée le compte et l''accès si la personne existe sans compte.';

-- `create or replace function` réaccorde EXECUTE à PUBLIC : on re-révoque
-- APRÈS, sinon anon récupère le droit au passage.
revoke all on function api.rattacher_compte(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. La liaison par identifiant, réservée au chargement
-- ---------------------------------------------------------------------
create or replace function api.lier_compte(p_compte uuid, p_auth uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_ok boolean;
begin
  update app.compte set auth_id = p_auth, maj_le = now()
   where id = p_compte and auth_id is null;
  get diagnostics v_ok = row_count;
  return v_ok;
end;
$$;

comment on function api.lier_compte(uuid, uuid) is
  'Rattache un compte pré-provisionné à son utilisateur d''authentification PAR IDENTIFIANT, pour le chargement initial. Rend false si le compte est inconnu ou déjà rattaché — donc rejouable sans risque. Réservée à service_role.';

revoke all on function api.lier_compte(uuid, uuid) from public, anon, authenticated;
grant execute on function api.lier_compte(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------
-- 3. Le déclencheur, mis de côté
-- ---------------------------------------------------------------------
drop trigger if exists rattacher_compte on auth.users;
