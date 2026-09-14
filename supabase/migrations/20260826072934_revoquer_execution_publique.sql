-- =====================================================================
-- Retirer aux clés publiques le droit d'exécuter les fonctions de `public`.
--
-- LE CONSTAT
-- La clé `anon` — celle qui part dans le code de la page, donc lisible par
-- n'importe quel visiteur — peut appeler les 7 fonctions du schéma `public`.
-- Mesuré par GET uniquement : 405 avec le code PostgreSQL 25006, « impossible
-- d'écrire dans une transaction en lecture seule ». Ce code prouve que LE
-- CONTRÔLE DE DROIT EST DÉJÀ PASSÉ — un refus aurait rendu 401 ou 403. Et
-- `enable_fk` a répondu 204 : elle s'est réellement exécutée.
--
-- CE QUE ÇA OUVRE
-- `truncate_data_tables()` est en SECURITY DEFINER — elle s'exécute avec les
-- droits de son propriétaire et contourne toute règle de sécurité — et son
-- corps supprime les clés étrangères puis vide TOUTES les tables du schéma.
--
-- CE QUI NE MARCHE PAS, ET QU'IL FAUT SAVOIR
-- `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` est
-- SANS EFFET. Vérifié sur PostgreSQL 17.11 : après cet ordre, une fonction
-- créée ensuite porte quand même `=X/postgres` — le droit câblé de PostgreSQL
-- pour PUBLIC — et `anon` en hérite. Testé aussi sur une base vierge, sans
-- entrée préalable dans pg_default_acl : même résultat. On ne peut pas retirer
-- ce défaut par ce moyen.
-- La protection des fonctions FUTURES passe donc par un déclencheur
-- d'événement, seul mécanisme qui agisse après la création.
--
-- Cette migration ne touche aucune donnée.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Les fonctions qui existent aujourd'hui
--    PUBLIC d'abord : c'est lui qui porte le droit implicite.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;

-- ---------------------------------------------------------------------
-- 2. Ce dont la synchronisation a besoin, rendu explicite
--    Recensé : les 11 fichiers du projet qui appellent une route /rpc/
--    utilisent tous la clé service_role. Sans ce GRANT, la synchro casserait.
-- ---------------------------------------------------------------------
grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------------------
-- 3. Les droits PAR DÉFAUT accordés explicitement à anon et authenticated
--    Ceux-là, contrairement au défaut câblé, se retirent bien.
-- ---------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke all on functions from anon;
alter default privileges for role postgres in schema public
  revoke all on functions from authenticated;

-- ---------------------------------------------------------------------
-- 4. Les fonctions FUTURES
--    Le déclencheur vit dans un schéma NON exposé par l'API : posé dans
--    `public`, il deviendrait lui-même une route /rpc/.
--    Il est limité au schéma `public` — ce projet est partagé avec une autre
--    application, qui crée ses fonctions dans ses propres schémas.
-- ---------------------------------------------------------------------
create schema if not exists securite;
comment on schema securite is
  'Outils de sécurité. Non exposé par l''API. Aucun droit public.';
revoke all on schema securite from public;

create or replace function securite.fermer_fonctions_nouvelles()
  returns event_trigger
  language plpgsql
as $fn$
declare
  cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
     where schema_name = 'public' and object_type = 'function'
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      cmd.object_identity);
    raise notice 'fonction fermee aux cles publiques : %', cmd.object_identity;
  end loop;
end
$fn$;

drop event trigger if exists fermer_fonctions_nouvelles;
create event trigger fermer_fonctions_nouvelles
  on ddl_command_end
  when tag in ('CREATE FUNCTION')
  execute function securite.fermer_fonctions_nouvelles();

-- ---------------------------------------------------------------------
-- 5. Le contrôle. Une migration de sécurité qui réussit sans effet est pire
--    qu'une migration qui échoue : elle laisse croire que c'est réglé.
-- ---------------------------------------------------------------------
do $$
declare
  reste text;
begin
  -- 5a. plus aucune fonction de `public` exécutable par une clé publique
  select string_agg(p.proname, ', ' order by p.proname) into reste
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute'));
  if reste is not null then
    raise exception
      'Revocation incomplete : anon ou authenticated peut encore executer %', reste;
  end if;

  -- 5b. la synchro doit continuer de fonctionner
  select string_agg(f, ', ') into reste
    from unnest(array['claim_next_sync_type', 'finish_sync_type', 'replace_m2m']) as f
   where not exists (
     select 1 from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = f
        and has_function_privilege('service_role', p.oid, 'execute'));
  if reste is not null then
    raise exception
      'La synchro casserait : service_role ne peut plus executer %', reste;
  end if;

  -- 5c. LA PREUVE POUR LES FONCTIONS FUTURES.
  --     On n'inspecte pas les catalogues : on crée réellement une fonction et
  --     on regarde si anon peut l'appeler. C'est le contrôle que la version
  --     précédente de cette migration n'avait pas, et qui aurait laissé passer
  --     une partie 3 sans effet.
  execute 'create function public._essai_droits_() returns int language sql as ''select 1''';
  if has_function_privilege('anon', 'public._essai_droits_()', 'execute')
     or has_function_privilege('authenticated', 'public._essai_droits_()', 'execute') then
    raise exception
      'Une fonction creee maintenant serait executable par une cle publique : '
      'la protection des fonctions FUTURES ne fonctionne pas';
  end if;
  execute 'drop function public._essai_droits_()';
end $$;

-- Recharge le cache de schéma de PostgREST pour que les droits prennent effet
-- sans attendre.
notify pgrst, 'reload schema';
