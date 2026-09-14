-- =====================================================================
-- JALON 2 — la liste des comptes à activer, et ce qui les en empêche
--
-- Les 4 158 comptes de `app.compte` sont PRÉ-PROVISIONNÉS : la reprise les
-- a créés depuis les utilisateurs Bubble, avec leurs accès, mais sans
-- `auth_id` — aucun n'a jamais été relié à un utilisateur Supabase.
-- `api.compte_id()` rend donc NULL pour tout le monde, et les 68 policies
-- de `core` refusent tout. Personne ne peut se connecter.
--
-- Pour les activer il faut créer, dans `auth.users`, un utilisateur portant
-- LA MÊME ADRESSE que la personne derrière l'accès : le déclencheur
-- `rattacher_compte` (schema_api.sql:143) fait le reste.
--
-- Cette vue dit, pour chaque compte dormant, quelle adresse employer et
-- d'où elle vient. Elle sert deux fois : à mesurer avant d'agir, et à
-- alimenter le script d'activation. Elle est aussi le support du rapport
-- de rattachement demandé par le ticket J2.
--
-- ⚠ ELLE EXPOSE DES ADRESSES NOMINATIVES. Le schéma `api` porte un
-- `grant select on all tables … to authenticated` doublé d'un
-- ALTER DEFAULT PRIVILEGES : toute vue qu'on y crée est lisible par tout
-- compte connecté SANS RIEN DEMANDER. On révoque donc explicitement, et on
-- n'accorde qu'à `service_role`. C'est la contrepartie de créer une vue ici.
-- =====================================================================

create or replace view api.compte_a_activer
with (security_invoker = true) as
select
  c.id                                                    as compte_id,
  a.id                                                    as acces_id,
  a.portail,
  a.role_interne,
  -- Une seule des trois jointures est non nulle : `acces_exactement_une_personne`
  -- le garantit par contrainte (schema_app.sql:105).
  coalesce(col.email, ft.email_personnel, cc.email::text) as email,
  coalesce(col.prenom, ft.prenom, cc.prenom)              as prenom,
  coalesce(col.nom, ft.nom, cc.nom)                       as nom,
  case
    when a.collaborateur_id  is not null then 'collaborateur'
    when a.fiche_talent_id   is not null then 'fiche_talent'
    else 'contact_client'
  end                                                     as source_email
from app.compte c
join app.acces a            on a.compte_id = c.id and a.actif
left join core.collaborateur  col on col.id = a.collaborateur_id
left join core.fiche_talent   ft  on ft.id  = a.fiche_talent_id
left join core.contact_client cc  on cc.id  = a.contact_client_id
where c.auth_id is null
  and c.actif;

comment on view api.compte_a_activer is
  'Les comptes pré-provisionnés qui attendent leur utilisateur Supabase, avec l''adresse à employer et sa provenance. Réservée à service_role : elle projette des adresses nominatives.';

-- L'ordre compte : révoquer APRÈS la création, sinon le grant global du
-- schéma api reprend le dessus.
revoke all on api.compte_a_activer from anon, authenticated;
grant select on api.compte_a_activer to service_role;
