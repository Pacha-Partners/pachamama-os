-- ═══════════════════════════════════════════════════════════════════════════
-- Rendre écrivables `app.journal_ecriture` et `app.idempotence`.
--
-- LE CONSTAT, MESURÉ AVANT D'ÉCRIRE
-- Les deux tables existent, sont VIDES, et rien ne les écrit. La migration
-- 20260828213000 se termine par :
--     revoke all on app.journal_ecriture from authenticated;
--     revoke all on app.idempotence      from authenticated;
-- et 20260908150000 a activé la RLS partout. Résultat mesuré le 12/09 :
-- `authenticated` n'a AUCUN droit sur ces deux tables et aucune policy ne les
-- ouvre. Une fonction `api.*` en SECURITY INVOKER — c'est l'ADR 0005 — ne peut
-- donc y écrire NI le journal NI la clé d'idempotence, alors que la définition
-- de « fini » de J3 exige les deux.
--
-- CE QU'ON CORRIGE, ET CE QU'ON NE CORRIGE PAS
-- On corrige les DROITS. On ne touche NI à la forme des tables, NI à leurs
-- contraintes : le journal reste en append pur, l'idempotence reste à purger
-- par tâche planifiée.
--
-- LE JOURNAL RESTE ILLISIBLE PAR UN PORTAIL. Son commentaire de table le dit :
-- « valeur_avant et valeur_apres contiennent noms, coordonnées, salaires et
-- appréciations ». On ouvre l'INSERT, pas le SELECT.
--
-- L'IDEMPOTENCE, ELLE, DOIT ÊTRE RELUE — c'est sa raison d'être : « renvoie le
-- MÊME résultat », pas seulement « ne rien faire ». Le SELECT est donc ouvert,
-- mais borné au compte qui a posé la clé.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. app.journal_ecriture : on écrit, on ne relit pas ────────────────
-- Colonnes nommées une à une. `id` est une identité générée : PostgreSQL ne
-- vérifie aucun droit de séquence pour une colonne IDENTITY, contrairement à
-- un `serial`.
grant insert (lot_id, entite, entite_id, champ, valeur_avant, valeur_apres,
              operation, origine, auteur_compte_id, survenu_le)
  on app.journal_ecriture to authenticated;

drop policy if exists journalise_ses_ecritures on app.journal_ecriture;
create policy journalise_ses_ecritures on app.journal_ecriture
  for insert to authenticated
  with check (auteur_compte_id = api.compte_id());

comment on policy journalise_ses_ecritures on app.journal_ecriture is
  'Un compte connecté peut inscrire une ligne de journal À SON NOM, et rien d''autre : ni relire le journal, ni le signer du nom d''un autre.';

-- ── 2. app.idempotence : poser une clé, la relire, y déposer le résultat ─
grant select on app.idempotence to authenticated;
grant insert (cle, compte_id, empreinte_charge, resultat, expire_le)
  on app.idempotence to authenticated;
grant update (resultat) on app.idempotence to authenticated;

drop policy if exists sa_idempotence   on app.idempotence;
drop policy if exists pose_idempotence on app.idempotence;
drop policy if exists maj_idempotence  on app.idempotence;

create policy sa_idempotence on app.idempotence
  for select to authenticated using (compte_id = api.compte_id());
create policy pose_idempotence on app.idempotence
  for insert to authenticated with check (compte_id = api.compte_id());
create policy maj_idempotence on app.idempotence
  for update to authenticated
  using (compte_id = api.compte_id())
  with check (compte_id = api.compte_id());

-- ═══════════════════════════════════════════════════════════════════════
-- 3. LES DEUX OUTILS QUE TOUTE FONCTION D'ÉCRITURE EMPLOIE
--
-- Ils vivent dans `app` et NON dans `api`, pour une raison mesurable :
-- PostgREST expose `api` — toute fonction qu'on y déclare devient une route
-- /rpc/ appelable au navigateur. Mesuré le 12/09 : `Accept-Profile: core` et
-- `Accept-Profile: app` répondent 406, seul `api` répond 200. Un utilitaire de
-- journalisation n'a rien à faire sur le réseau.
--
-- SECURITY INVOKER : c'est l'appelant qui doit avoir le droit d'écrire son
-- journal. Une fonction DEFINER ici rendrait le journal falsifiable.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function app.journaliser(
  p_lot       uuid,
  p_entite    text,
  p_entite_id uuid,
  p_operation text,
  p_champ     text default null,
  p_avant     jsonb default null,
  p_apres     jsonb default null
) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  insert into app.journal_ecriture
    (lot_id, entite, entite_id, champ, valeur_avant, valeur_apres,
     operation, origine, auteur_compte_id)
  values
    (p_lot, p_entite, p_entite_id, p_champ, p_avant, p_apres,
     p_operation, 'declare'::ref.origine_valeur, api.compte_id());
end $$;

comment on function app.journaliser(uuid,text,uuid,text,text,jsonb,jsonb) is
  'Une ligne de journal, au nom de l''appelant. origine = declare : la valeur vient de la personne elle-même, pas d''un import ni d''un automate.';

-- Une ligne par champ RÉELLEMENT changé. La table l''impose :
-- `journal_update_a_un_champ check (operation <> ''update'' or champ is not null)`.
create or replace function app.journaliser_diff(
  p_lot       uuid,
  p_entite    text,
  p_entite_id uuid,
  p_avant     jsonb,
  p_apres     jsonb
) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  v_paire record;
  v_n     integer := 0;
begin
  for v_paire in select key, value from jsonb_each(coalesce(p_apres, '{}'::jsonb)) loop
    if (p_avant -> v_paire.key) is distinct from v_paire.value then
      perform app.journaliser(p_lot, p_entite, p_entite_id, 'update',
                              v_paire.key, p_avant -> v_paire.key, v_paire.value);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

comment on function app.journaliser_diff(uuid,text,uuid,jsonb,jsonb) is
  'Journalise le DELTA entre deux états, une ligne par champ modifié, sous un même lot_id. Rend le nombre de champs effectivement changés — zéro quand le formulaire a été renvoyé sans modification.';

-- ── L'idempotence, en deux temps ───────────────────────────────────────
-- Temps 1 : réserver la clé. Rend NULL si c'est la première fois (il faut
-- alors travailler), ou le résultat déjà produit si c'est un rejeu.
--
-- LA CLÉ EST PRÉFIXÉE PAR LE COMPTE. `app.idempotence.cle` est une clé
-- primaire GLOBALE : sans préfixe, deux comptes qui emploient « creation-1 »
-- entreraient en collision, et la RLS rendrait la collision INVISIBLE — le
-- second verrait un conflit sur une ligne qu'il ne peut pas lire.
create or replace function app.idempotence_rejeu(
  p_cle       text,
  p_empreinte text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_compte uuid := api.compte_id();
  v_cle    text;
  v_res    jsonb;
  v_emp    text;
begin
  if p_cle is null or btrim(p_cle) = '' then
    return null;                            -- pas de clé : pas d'idempotence
  end if;
  if v_compte is null then
    raise exception 'aucun compte : une clé d''idempotence exige une session'
      using errcode = '42501';
  end if;

  v_cle := v_compte::text || ':' || p_cle;

  insert into app.idempotence (cle, compte_id, empreinte_charge, expire_le)
  values (v_cle, v_compte, p_empreinte, now() + interval '24 hours')
  on conflict (cle) do nothing;

  if found then
    return null;                            -- première fois : au travail
  end if;

  select i.resultat, i.empreinte_charge into v_res, v_emp
    from app.idempotence i where i.cle = v_cle;

  if not found then
    -- Conflit sur une ligne invisible : impossible avec le préfixe, sauf
    -- corruption. On refuse bruyamment plutôt que de rejouer l'écriture.
    raise exception 'clé d''idempotence « % » déjà posée hors de votre périmètre', p_cle
      using errcode = '42501';
  end if;

  if v_emp is distinct from p_empreinte then
    raise exception 'la clé d''idempotence « % » a déjà servi pour une charge différente', p_cle
      using errcode = '23505';
  end if;

  return coalesce(v_res, jsonb_build_object('rejeu', true, 'etat', 'en_cours'));
end $$;

comment on function app.idempotence_rejeu(text,text) is
  'Réserve une clé d''idempotence. NULL = première fois, il faut écrire. Non-NULL = rejeu, il faut rendre ce résultat sans rien écrire. Refuse une même clé employée avec une charge différente.';

-- Temps 2 : déposer le résultat, pour que le rejeu rende le MÊME.
create or replace function app.idempotence_resultat(
  p_cle      text,
  p_resultat jsonb
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare v_compte uuid := api.compte_id();
begin
  if p_cle is null or btrim(p_cle) = '' or v_compte is null then
    return;
  end if;
  update app.idempotence
     set resultat = p_resultat
   where cle = v_compte::text || ':' || p_cle;
end $$;

comment on function app.idempotence_resultat(text,jsonb) is
  'Dépose le résultat d''une écriture sous sa clé, pour qu''un rejeu rende le même. ⚠ PURGE : une tâche planifiée doit supprimer app.idempotence where expire_le < now().';

-- ── Droits d'exécution ─────────────────────────────────────────────────
-- `create or replace function` réaccorde EXECUTE à PUBLIC. Le déclencheur
-- d'événement `securite.fermer_fonctions_nouvelles` ne couvre QUE le schéma
-- `public` — mesuré dans 20260826072934. Ici, c'est à la main.
revoke execute on function app.journaliser(uuid,text,uuid,text,text,jsonb,jsonb) from public, anon;
revoke execute on function app.journaliser_diff(uuid,text,uuid,jsonb,jsonb)       from public, anon;
revoke execute on function app.idempotence_rejeu(text,text)                        from public, anon;
revoke execute on function app.idempotence_resultat(text,jsonb)                    from public, anon;

grant execute on function app.journaliser(uuid,text,uuid,text,text,jsonb,jsonb) to authenticated, service_role;
grant execute on function app.journaliser_diff(uuid,text,uuid,jsonb,jsonb)       to authenticated, service_role;
grant execute on function app.idempotence_rejeu(text,text)                        to authenticated, service_role;
grant execute on function app.idempotence_resultat(text,jsonb)                    to authenticated, service_role;

-- ── Contrôle ───────────────────────────────────────────────────────────
do $$
begin
  if has_table_privilege('authenticated', 'app.journal_ecriture', 'select') then
    raise exception 'app.journal_ecriture redevenue lisible par authenticated : elle porte des données personnelles';
  end if;
  if not has_column_privilege('authenticated', 'app.journal_ecriture', 'lot_id', 'insert') then
    raise exception 'app.journal_ecriture toujours pas écrivable : les fonctions INVOKER échoueront';
  end if;
  if not has_column_privilege('authenticated', 'app.idempotence', 'cle', 'insert') then
    raise exception 'app.idempotence toujours pas écrivable';
  end if;
  if has_function_privilege('anon', 'app.idempotence_rejeu(text,text)', 'execute') then
    raise exception 'app.idempotence_rejeu exécutable par anon';
  end if;
end $$;
