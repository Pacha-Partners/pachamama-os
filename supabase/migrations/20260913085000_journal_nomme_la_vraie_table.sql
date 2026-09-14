-- ═══════════════════════════════════════════════════════════════════════════
-- `api.maj_mes_listes` journalisait une table qui n'existe pas.
--
-- CONSTATÉ EN RELISANT app.journal_ecriture APRÈS LE PREMIER PASSAGE DU
-- HARNAIS J4 — pas dans le code, dans la donnée :
--
--   select distinct entite from app.journal_ecriture
--     → … core.fiche_talent_contrat, core.fiche_talent_remote …
--
-- Ces deux tables N'EXISTENT PAS. Elles s'appellent
-- `core.fiche_talent_contrat_souhaite` et `core.fiche_talent_remote_souhaite`.
-- La fonction construisait le nom par concaténation — `'core.fiche_talent_' ||
-- p_type` — et deux des six `p_type` ne coïncident pas avec leur table.
--
-- Pourquoi ça compte : `app.journal_ecriture.entite` est ce sur quoi
-- s'appuiera toute reconstitution d'un historique — « qu'est-ce qui a changé
-- sur cette table ». Un nom qui ne joint aucune table produit un trou
-- silencieux, du même genre que celui de D-12 (le LEFT JOIN qui rend NULL).
-- Deux lignes de journal l'ont déjà porté ; elles restent, la table est en
-- append pur.
--
-- Le nom vient désormais d'une CORRESPONDANCE EXPLICITE, et la fonction
-- refuse de journaliser un nom qui ne désigne aucune table — de sorte que le
-- septième `p_type` qu'on ajoutera un jour se signale au premier appel plutôt
-- qu'au premier audit.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function api.maj_mes_listes(
  p_type            text,
  p_codes           text[],
  p_cle_idempotence text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_fiche    uuid;
  v_lot      uuid := gen_random_uuid();
  v_rejeu    jsonb;
  v_codes    text[];
  v_avant    text[];
  v_apres    text[];
  v_conflit  text;
  v_inconnu  text;
  v_resultat jsonb;
  v_n_avant  integer;
  v_n_apres  integer;
  v_table    text;
begin
  v_fiche := app.ma_fiche_unique();

  if p_type is null or p_type not in ('secteur_vise','secteur_nogo','critere',
                                      'contrat','remote','expertise') then
    raise exception 'p_type vaut « secteur_vise », « secteur_nogo », « critere », « contrat », « remote » ou « expertise » — reçu « % »',
      coalesce(p_type, 'NULL') using errcode = '22023';
  end if;

  -- La table réelle, nommée et non déduite. Les deux dernières ne suivent pas
  -- la convention de nommage des quatre premières.
  v_table := case p_type
               when 'secteur_vise' then 'core.fiche_talent_secteur_vise'
               when 'secteur_nogo' then 'core.fiche_talent_secteur_nogo'
               when 'critere'      then 'core.fiche_talent_critere'
               when 'expertise'    then 'core.fiche_talent_expertise'
               when 'contrat'      then 'core.fiche_talent_contrat_souhaite'
               when 'remote'       then 'core.fiche_talent_remote_souhaite'
             end;
  if to_regclass(v_table) is null then
    raise exception 'la table « % » n''existe pas : le journal porterait un nom sans référent', v_table
      using errcode = '42P01';
  end if;

  -- Dédoublonnage et nettoyage : une liste envoyée deux fois le même code
  -- ferait sauter la clé primaire du satellite.
  select coalesce(array_agg(distinct c order by c), '{}'::text[]) into v_codes
    from unnest(coalesce(p_codes, '{}'::text[])) c
   where nullif(btrim(c), '') is not null;

  if array_length(v_codes, 1) > 50 then
    raise exception 'liste trop longue : % codes pour 50 au plus', array_length(v_codes, 1)
      using errcode = '22001';
  end if;

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', v_fiche::text, p_type, array_to_string(v_codes, ','))));
  if v_rejeu is not null then return v_rejeu; end if;

  if p_type in ('secteur_vise','secteur_nogo') then
    select string_agg(c, ', ') into v_inconnu from unnest(v_codes) c
     where not exists (select 1 from ref.secteur s where s.code = c and s.actif);
    if v_inconnu is not null then
      raise exception 'secteur(s) inconnu(s) : % — voir api.mon_referentiel', v_inconnu
        using errcode = '23503';
    end if;

    if p_type = 'secteur_vise' then
      select string_agg(s.libelle_fr, ', ') into v_conflit
        from core.fiche_talent_secteur_nogo fn
        join ref.secteur s on s.id = fn.secteur_id
       where fn.fiche_talent_id = v_fiche and s.code = any (v_codes);
    else
      select string_agg(s.libelle_fr, ', ') into v_conflit
        from core.fiche_talent_secteur_vise fv
        join ref.secteur s on s.id = fv.secteur_id
       where fv.fiche_talent_id = v_fiche and s.code = any (v_codes);
    end if;
    if v_conflit is not null then
      raise exception 'un secteur ne peut pas être à la fois visé et no-go : % — retirez-le de l''autre liste d''abord',
        v_conflit using errcode = '23514';
    end if;
  end if;

  if p_type = 'secteur_vise' then
    select coalesce(array_agg(s.code order by s.code), '{}') into v_avant
      from core.fiche_talent_secteur_vise fv join ref.secteur s on s.id = fv.secteur_id
     where fv.fiche_talent_id = v_fiche;
    delete from core.fiche_talent_secteur_vise where fiche_talent_id = v_fiche;
    insert into core.fiche_talent_secteur_vise (fiche_talent_id, secteur_id, origine)
    select v_fiche, s.id, 'declare'::ref.origine_valeur
      from ref.secteur s where s.code = any (v_codes) and s.actif;

  elsif p_type = 'secteur_nogo' then
    select coalesce(array_agg(s.code order by s.code), '{}') into v_avant
      from core.fiche_talent_secteur_nogo fn join ref.secteur s on s.id = fn.secteur_id
     where fn.fiche_talent_id = v_fiche;
    delete from core.fiche_talent_secteur_nogo where fiche_talent_id = v_fiche;
    insert into core.fiche_talent_secteur_nogo (fiche_talent_id, secteur_id, origine)
    select v_fiche, s.id, 'declare'::ref.origine_valeur
      from ref.secteur s where s.code = any (v_codes) and s.actif;

  elsif p_type = 'critere' then
    select string_agg(c, ', ') into v_inconnu from unnest(v_codes) c
     where not exists (select 1 from ref.critere r where r.code = c and r.actif);
    if v_inconnu is not null then
      raise exception 'critère(s) inconnu(s) : % — voir api.mon_referentiel', v_inconnu
        using errcode = '23503';
    end if;
    select coalesce(array_agg(r.code order by r.code), '{}') into v_avant
      from core.fiche_talent_critere fc join ref.critere r on r.id = fc.critere_id
     where fc.fiche_talent_id = v_fiche;
    delete from core.fiche_talent_critere where fiche_talent_id = v_fiche;
    insert into core.fiche_talent_critere (fiche_talent_id, critere_id, origine)
    select v_fiche, r.id, 'declare'::ref.origine_valeur
      from ref.critere r where r.code = any (v_codes) and r.actif;

  elsif p_type = 'expertise' then
    select string_agg(c, ', ') into v_inconnu from unnest(v_codes) c
     where not exists (select 1 from ref.expertise x
                        where x.code = c and x.actif and x.fusionne_vers_id is null);
    if v_inconnu is not null then
      raise exception 'expertise(s) inconnue(s) : % — voir api.mon_referentiel', v_inconnu
        using errcode = '23503';
    end if;
    select coalesce(array_agg(x.code order by x.code), '{}') into v_avant
      from core.fiche_talent_expertise fe join ref.expertise x on x.id = fe.expertise_id
     where fe.fiche_talent_id = v_fiche;
    delete from core.fiche_talent_expertise where fiche_talent_id = v_fiche;
    insert into core.fiche_talent_expertise (fiche_talent_id, expertise_id, origine)
    select v_fiche, x.id, 'declare'::ref.origine_valeur
      from ref.expertise x
     where x.code = any (v_codes) and x.actif and x.fusionne_vers_id is null;

  elsif p_type = 'contrat' then
    select string_agg(c, ', ') into v_inconnu from unnest(v_codes) c
     where not exists (select 1 from ref.libelle l
                        where l.domaine = 'type_contrat' and l.code = c and l.actif);
    if v_inconnu is not null then
      raise exception 'type(s) de contrat inconnu(s) : % — voir api.mon_referentiel', v_inconnu
        using errcode = '23503';
    end if;
    select coalesce(array_agg(ct.contrat::text order by ct.contrat::text), '{}') into v_avant
      from core.fiche_talent_contrat_souhaite ct where ct.fiche_talent_id = v_fiche;
    delete from core.fiche_talent_contrat_souhaite where fiche_talent_id = v_fiche;
    insert into core.fiche_talent_contrat_souhaite (fiche_talent_id, contrat, origine)
    select v_fiche, c::ref.type_contrat, 'declare'::ref.origine_valeur
      from unnest(v_codes) c;

  else  -- 'remote'
    select string_agg(c, ', ') into v_inconnu from unnest(v_codes) c
     where not exists (select 1 from ref.libelle l
                        where l.domaine = 'rythme_remote' and l.code = c
                          and l.actif and l.code not like '%_legacy');
    if v_inconnu is not null then
      raise exception 'rythme(s) de remote inconnu(s) : % — voir api.mon_referentiel', v_inconnu
        using errcode = '23503';
    end if;
    select coalesce(array_agg(rm.remote::text order by rm.remote::text), '{}') into v_avant
      from core.fiche_talent_remote_souhaite rm where rm.fiche_talent_id = v_fiche;
    delete from core.fiche_talent_remote_souhaite where fiche_talent_id = v_fiche;
    insert into core.fiche_talent_remote_souhaite (fiche_talent_id, remote, origine)
    select v_fiche, c::ref.rythme_remote, 'declare'::ref.origine_valeur
      from unnest(v_codes) c;
  end if;

  v_apres    := v_codes;
  v_n_avant  := coalesce(array_length(v_avant, 1), 0);
  v_n_apres  := coalesce(array_length(v_apres, 1), 0);

  -- Une liste est UN champ : une seule ligne de journal, sur la VRAIE table.
  perform app.journaliser(v_lot, v_table, v_fiche, 'update',
                          p_type, to_jsonb(v_avant), to_jsonb(v_apres));

  update core.fiche_talent set modifie_par_le_talent_le = now() where id = v_fiche;

  v_resultat := jsonb_build_object('fiche_talent_id', v_fiche, 'type', p_type,
                                   'table', v_table,
                                   'avant', to_jsonb(v_avant), 'apres', to_jsonb(v_apres),
                                   'nombre_avant', v_n_avant, 'nombre_apres', v_n_apres,
                                   'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.maj_mes_listes(text,text[],text) is
  'Remplace UNE des six listes déclaratives : secteur_vise, secteur_nogo, critere, contrat, remote, expertise. Refuse un code inconnu, refuse un secteur à la fois visé et no-go, et journalise sous le NOM RÉEL de la table (contrat et remote ne suivent pas la convention). fiche_talent_tag est délibérément hors d''atteinte.';

-- `create or replace function` vient de réaccorder EXECUTE à PUBLIC.
revoke execute on function api.maj_mes_listes(text,text[],text) from public, anon;
grant  execute on function api.maj_mes_listes(text,text[],text) to authenticated, service_role;

notify pgrst, 'reload schema';

do $$
begin
  if has_function_privilege('anon', 'api.maj_mes_listes(text,text[],text)', 'execute') then
    raise exception 'api.maj_mes_listes exécutable par anon';
  end if;
end $$;
