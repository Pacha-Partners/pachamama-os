-- ═══════════════════════════════════════════════════════════════════════════
-- Qui est connecté : le nom, et de quoi le modifier.
--
-- Demande du commanditaire, formulée deux fois : « il me paraît logique que
-- l'utilisateur ait son nom affiché quelque part, et ait la possibilité de
-- modifier ses infos ». Aujourd'hui rien ne l'expose : `api.moi` rend des
-- identifiants et des droits, pas une personne.
--
-- POURQUOI DANS `api.moi` ET PAS DANS UNE VUE PAR PORTAIL
-- La coquille des écrans connectés (`CoquilleConnectee`) est partagée par les
-- QUATRE portails. Lui faire lire une vue différente selon le portail lui
-- demanderait de savoir dans lequel elle se trouve — or elle ne le sait pas,
-- c'est chaque page qui le sait. Une seule fonction résout la personne, quelle
-- que soit la casquette.
--
-- LES TROIS TABLES DE PERSONNE
-- `app.acces` pointe vers l'une de trois tables, et une seule à la fois
-- (contrainte `acces_exactement_une_personne`) : `core.contact_client`,
-- `core.fiche_talent`, `core.collaborateur`. Un compte peut cumuler plusieurs
-- accès — 3 personnes portent deux casquettes internes — mais c'est la MÊME
-- personne derrière : on prend donc le premier accès actif, sans arbitrer.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function api.mon_identite() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'prenom',    coalesce(ct.prenom, ft.prenom, co.prenom),
           'nom',       coalesce(ct.nom,    ft.nom,    co.nom),
           'photo_url', coalesce(ct.photo_url, ft.photo_url, co.photo_url),
           'source',    case
                          when ct.id is not null then 'contact_client'
                          when ft.id is not null then 'fiche_talent'
                          when co.id is not null then 'collaborateur'
                        end)
    from app.acces a
    left join core.contact_client ct on ct.id = a.contact_client_id
    left join core.fiche_talent   ft on ft.id = a.fiche_talent_id
    left join core.collaborateur  co on co.id = a.collaborateur_id
   where a.compte_id = api.compte_id()
     and a.actif
   order by a.cree_le nulls last, a.id
   limit 1;
$$;
revoke execute on function api.mon_identite() from public, anon;
grant  execute on function api.mon_identite() to authenticated, service_role;
comment on function api.mon_identite() is
  'Le prénom, le nom et la photo de la personne derrière le compte, quelle que soit sa casquette. DEFINER parce que app.acces n''ouvre au compte que sa propre ligne et que les trois tables de personne ont chacune leurs policies.';

-- `create or replace view` ne sait qu'AJOUTER des colonnes à la fin (42P16).
-- Les trois nouvelles y vont, l'ordre existant est intact.
create or replace view api.moi with (security_invoker = true) as
select api.compte_id()                as compte_id,
       api.mes_portails()             as portails,
       api.est_interne()              as est_interne,
       api.role_sur('recruteur')      as role_recruteur,
       api.role_sur('backoffice')     as role_backoffice,
       api.role_interne()             as role_interne,
       api.ma_fiche_talent()          as fiche_talent_id,
       (select array_agg(e) from api.mes_entreprises() e) as entreprise_ids,
       api.mon_identite()->>'prenom'    as prenom,
       api.mon_identite()->>'nom'       as nom,
       api.mon_identite()->>'photo_url' as photo_url;

comment on view api.moi is
  'Qui suis-je et que puis-je voir. Le premier appel de toute session. Porte désormais l''identité de la personne, pour que la coquille des écrans connectés puisse dire à qui elle parle sans savoir dans quel portail elle se trouve.';

grant select on api.moi to authenticated, service_role;

notify pgrst, 'reload schema';
