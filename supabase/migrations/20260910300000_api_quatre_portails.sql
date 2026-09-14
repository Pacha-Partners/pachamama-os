-- =====================================================================
-- Les fonctions et la vue api, après la séparation des portails
--
-- `api.est_interne()` testait `portail = 'interne'`, une valeur qui n'est
-- plus employée. Sans cette migration, TOUTES les policies internes
-- rendraient faux : plus personne ne lirait core. C'est le corollaire
-- direct de la migration précédente, et il n'est pas optionnel.
--
-- `api.role_interne()` posait un problème que le cumul rend concret : elle
-- fait `limit 1`. Avec deux accès internes — désormais possibles, et déjà
-- réels pour trois personnes — elle rendait un rôle au hasard. Elle est
-- conservée pour ne rien casser, mais rendue DÉTERMINISTE (le back-office
-- l'emporte) et signalée comme héritée. Ce qu'il faut employer désormais,
-- c'est `api.a_portail()`, sans ambiguïté possible.
--
-- ⚠ `create or replace function` RÉACCORDE execute à PUBLIC. On révoque
-- donc APRÈS chaque définition, jamais avant.
-- =====================================================================

-- ── ce que j'ai comme portails ─────────────────────────────────────────
create or replace function api.mes_portails() returns text[]
language sql stable security definer set search_path = '' as $$
  select array_agg(distinct a.portail::text order by a.portail::text)
    from app.acces a
   where a.compte_id = api.compte_id() and a.actif;
$$;
comment on function api.mes_portails() is
  'Les surfaces ouvertes au compte courant. C''est ce que l''application doit lire pour décider où l''envoyer.';

-- ── ai-je CE portail ───────────────────────────────────────────────────
create or replace function api.a_portail(p_portail text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from app.acces a
     where a.compte_id = api.compte_id() and a.actif and a.portail::text = p_portail);
$$;
comment on function api.a_portail(text) is
  'Le test sans ambiguïté, à préférer à role_interne() : un compte peut porter plusieurs portails internes.';

-- ── mon rôle SUR un portail donné ──────────────────────────────────────
create or replace function api.role_sur(p_portail text) returns text
language sql stable security definer set search_path = '' as $$
  select a.role_interne::text from app.acces a
   where a.compte_id = api.compte_id() and a.actif and a.portail::text = p_portail
   limit 1;
$$;
comment on function api.role_sur(text) is
  'La graduation du compte À L''INTÉRIEUR d''un portail : recruteur|support, ou admin|superadmin.';

-- ── interne = l'un des deux portails internes ──────────────────────────
create or replace function api.est_interne() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from app.acces a
     where a.compte_id = api.compte_id() and a.actif
       and a.portail in ('recruteur','backoffice'));
$$;
comment on function api.est_interne() is
  'Le compte porte-t-il un accès interne, quel qu''il soit. Les 4 policies de core s''appuient dessus : élargir cette fonction a suffi à les faire suivre.';

-- ── hérité, mais déterministe ──────────────────────────────────────────
create or replace function api.role_interne() returns text
language sql stable security definer set search_path = '' as $$
  select a.role_interne::text from app.acces a
   where a.compte_id = api.compte_id() and a.actif
     and a.portail in ('recruteur','backoffice')
   order by case a.portail when 'backoffice' then 0 else 1 end
   limit 1;
$$;
comment on function api.role_interne() is
  'HÉRITÉE. Rend le rôle du portail le plus puissant quand le compte en porte plusieurs — le back-office l''emporte. Employer api.a_portail() ou api.role_sur() dans tout code neuf.';

-- ── qui suis-je ────────────────────────────────────────────────────────
-- `create or replace view` ne sait NI renommer NI réordonner une colonne
-- (42P16) : la vue gagne `portails` et deux `role_*`, il faut donc la
-- supprimer puis la recréer, et lui redonner ses droits juste après.
drop view if exists api.moi;
create view api.moi with (security_invoker = true) as
select api.compte_id()                as compte_id,
       api.mes_portails()             as portails,
       api.est_interne()              as est_interne,
       api.role_sur('recruteur')      as role_recruteur,
       api.role_sur('backoffice')     as role_backoffice,
       api.role_interne()             as role_interne,
       api.ma_fiche_talent()          as fiche_talent_id,
       (select array_agg(e) from api.mes_entreprises() e) as entreprise_ids;
comment on view api.moi is
  'Qui suis-je et que puis-je voir. Le premier appel de toute session. `portails` est la réponse à « où puis-je aller » ; les deux `role_*` disent la graduation sur chacun.';

-- ── les droits, APRÈS les définitions ──────────────────────────────────
-- On révoque sur PUBLIC seulement. Révoquer sur `anon` casserait le job
-- board : api.sans_nom_client lui est accordée explicitement.
revoke execute on all functions in schema api from public;
grant execute on function api.compte_id(), api.est_interne(), api.role_interne(),
                          api.ma_fiche_talent(), api.mes_entreprises(),
                          api.mes_portails(), api.a_portail(text), api.role_sur(text)
                       to authenticated;
grant execute on function api.lier_compte(uuid, uuid) to service_role;
grant select on api.moi to authenticated;

-- La vue de contrôle qualité ne redevient pas lisible au passage.
revoke all on api.v_fuite_client from anon, authenticated;
grant select on api.v_fuite_client to service_role;
revoke all on api.compte_a_activer from anon, authenticated;
grant select on api.compte_a_activer to service_role;

do $$
declare n_bo integer; n_rec integer; n_cumul integer;
begin
  select count(*) into n_bo   from app.acces where portail = 'backoffice' and actif;
  select count(*) into n_rec  from app.acces where portail = 'recruteur'  and actif;
  select count(*) into n_cumul from (
    select compte_id from app.acces where portail in ('recruteur','backoffice') and actif
     group by compte_id having count(*) > 1) x;
  insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
  values ('portails_separes', 'app.acces', 42, n_bo + n_rec, 0,
          format('backoffice %s · recruteur %s · comptes cumulant les deux %s',
                 n_bo, n_rec, n_cumul));
  raise notice 'backoffice % · recruteur % · cumuls %', n_bo, n_rec, n_cumul;
end
$$;
