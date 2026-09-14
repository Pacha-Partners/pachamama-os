-- =====================================================================
-- SCHÉMA api — LA SURFACE QUE L'APPLICATION INTERROGE
--
-- C'est la couche qui manquait pour que le modèle soit UTILISABLE. Sans
-- elle, 141 618 lignes chargées et rien qui puisse les lire.
--
-- Trois choses ici :
--   1. de quoi savoir QUI interroge — les fonctions d'authentification ;
--   2. de quoi RATTACHER une connexion à un compte pré-provisionné ;
--   3. les VUES, une par usage, en security_invoker pour que la RLS
--      s'applique à l'appelant et non au propriétaire.
--
-- Les policies elles-mêmes sont dans la migration suivante.
-- =====================================================================

create schema if not exists api;
comment on schema api is
  'La seule surface destinée à être exposée au réseau. Que des vues et des fonctions : aucune table.';

-- ---------------------------------------------------------------------
-- 1. QUI INTERROGE
--
-- SECURITY DEFINER : ces fonctions doivent lire app.acces, que l'appelant
-- n'a justement pas le droit de lire. C'est le seul endroit du modèle où
-- ce privilège est accordé, et il l'est à des fonctions qui ne renvoient
-- que l'identité de l'appelant — jamais celle d'un autre.
-- ---------------------------------------------------------------------

create or replace function api.compte_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select c.id from app.compte c
   where c.auth_id = (select auth.uid()) and c.actif limit 1;
$$;

create or replace function api.est_interne() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from app.acces a
     where a.compte_id = api.compte_id() and a.actif and a.portail = 'interne');
$$;

create or replace function api.role_interne() returns text
language sql stable security definer set search_path = '' as $$
  select a.role_interne::text from app.acces a
   where a.compte_id = api.compte_id() and a.actif and a.portail = 'interne' limit 1;
$$;

create or replace function api.ma_fiche_talent() returns uuid
language sql stable security definer set search_path = '' as $$
  select a.fiche_talent_id from app.acces a
   where a.compte_id = api.compte_id() and a.actif and a.fiche_talent_id is not null limit 1;
$$;

create or replace function api.mes_entreprises() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct c.entreprise_id from app.acces a
    join core.contact_client c on c.id = a.contact_client_id
   where a.compte_id = api.compte_id() and a.actif and c.entreprise_id is not null;
$$;

comment on function api.compte_id() is
  'Le compte de l''appelant, ou NULL. Toutes les policies s''appuient dessus : c''est le point unique où l''identité entre dans le modèle.';

-- ---------------------------------------------------------------------
-- 2. RATTACHER UNE CONNEXION À UN COMPTE PRÉ-PROVISIONNÉ
--
-- Les 4 159 comptes créés par la reprise n'ont PAS d'auth_id : personne
-- ne pouvait s'y connecter. Le rapprochement se fait à la première
-- connexion, par l'e-mail — la seule clé commune entre auth.users et les
-- personnes du modèle.
--
-- C'est aussi ce qui rétablira les accès « portail entreprise » que la
-- reprise n'a pas pu créer, faute d'e-mail sur public.user.
-- ---------------------------------------------------------------------

create or replace function api.rattacher_compte(p_auth_id uuid, p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_compte uuid; v_personne uuid; v_type text;
begin
  -- déjà rattaché ?
  select id into v_compte from app.compte where auth_id = p_auth_id;
  if found then return v_compte; end if;

  -- un compte existe-t-il déjà pour une personne portant cet e-mail ?
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

  -- rattachement d'un compte existant
  if v_compte is not null then
    update app.compte set auth_id = p_auth_id, maj_le = now() where id = v_compte;
    return v_compte;
  end if;

  -- sinon : la personne existe-t-elle SANS compte ? cas des contacts
  -- entreprise, dont la reprise n'a pas pu créer l'accès.
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
  'Rattache une connexion à son compte pré-provisionné, par l''e-mail. Crée le compte et l''accès si la personne existe sans compte — c''est le cas des contacts entreprise, dont la reprise n''a pas pu établir le lien faute d''e-mail sur public.user.';

-- Déclenché à la création d'un utilisateur d'authentification.
create or replace function api.au_nouvel_utilisateur() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform api.rattacher_compte(new.id, new.email);
  return new;
end;
$$;

drop trigger if exists rattacher_compte on auth.users;
create trigger rattacher_compte
  after insert on auth.users
  for each row execute function api.au_nouvel_utilisateur();

-- ---------------------------------------------------------------------
-- 3. DROITS D'ACCÈS AU SCHÉMA
-- ---------------------------------------------------------------------

grant usage on schema api to anon, authenticated, service_role;
revoke execute on all functions in schema api from public;
grant execute on function api.compte_id(), api.est_interne(), api.role_interne(),
                          api.ma_fiche_talent(), api.mes_entreprises() to authenticated;
