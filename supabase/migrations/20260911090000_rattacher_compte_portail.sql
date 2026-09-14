-- =====================================================================
-- api.rattacher_compte écrivait un accès SANS portail
--
-- LE DÉFAUT. La fonction crée un compte et son accès quand l'adresse d'une
-- inscription correspond à une personne qui n'en a pas — le cas des contacts
-- entreprise, que la reprise n'a pas pu rattacher. Ses deux `insert` ne
-- mentionnaient pas `portail` : c'était juste tant que la colonne était
-- GÉNÉRÉE, et c'est devenu faux le jour où elle est devenue déclarée, puis
-- franchement cassé quand elle est passée NOT NULL (20260910310000).
--
-- Conséquence si on ne le corrige pas : la toute première inscription d'un
-- contact entreprise échoue sur une violation de contrainte, à l'intérieur
-- d'un déclencheur AFTER INSERT sur auth.users — donc l'inscription entière
-- part en erreur, sans message compréhensible pour qui la subit.
--
-- Passé inaperçu parce qu'aucun test n'exerce ce chemin : les 4 158 comptes
-- ont été rattachés par IDENTIFIANT (api.lier_compte), pas par courriel.
-- =====================================================================

create or replace function api.rattacher_compte(p_auth_id uuid, p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_compte uuid; v_personne uuid; v_type text;
begin
  select id into v_compte from app.compte where auth_id = p_auth_id;
  if found then return v_compte; end if;

  -- Un compte existe-t-il déjà pour une personne portant cette adresse ?
  -- L'ordre est délibéré : collaborateur, puis talent, puis contact.
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
    -- La garde : un compte déjà rattaché ne change jamais de main.
    update app.compte set auth_id = p_auth_id, maj_le = now()
     where id = v_compte and auth_id is null;
    if not found then return null; end if;
    return v_compte;
  end if;

  -- Sinon : la personne existe-t-elle SANS compte ?
  select k.id, 'contact' into v_personne, v_type
    from core.contact_client k where lower(k.email::text) = lower(p_email) limit 1;
  if v_personne is null then
    select f.id, 'talent' into v_personne, v_type
      from core.fiche_talent f where lower(f.email_personnel) = lower(p_email) limit 1;
  end if;
  if v_personne is null then return null; end if;

  insert into app.compte (auth_id, actif) values (p_auth_id, true) returning id into v_compte;
  -- LE PORTAIL EST DÉCLARÉ, et NOT NULL : il doit être écrit ici.
  if v_type = 'contact' then
    insert into app.acces (compte_id, contact_client_id, portail, actif)
    values (v_compte, v_personne, 'entreprise', true);
  else
    insert into app.acces (compte_id, fiche_talent_id, portail, actif)
    values (v_compte, v_personne, 'talent', true);
  end if;
  return v_compte;
end;
$$;

comment on function api.rattacher_compte(uuid, text) is
  'Rattache une connexion à son compte pré-provisionné, par l''e-mail, UNE SEULE FOIS : un compte déjà rattaché n''est jamais réattribué. Crée le compte et l''accès — portail compris — si la personne existe sans compte.';

revoke all on function api.rattacher_compte(uuid, text) from public, anon, authenticated;
