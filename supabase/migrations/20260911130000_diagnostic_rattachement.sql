-- Vue de diagnostic du rattachement par courriel, réservée à service_role.
-- Elle dit, pour une adresse : quelle personne la porte, dans quelle table,
-- et si cette personne a déjà un accès. C'est ce que api.rattacher_compte
-- regarde, rendu lisible — GoTrue masquant l'erreur SQL derrière un 500 muet.
create or replace view api.diagnostic_rattachement with (security_invoker = true) as
select lower(k.email::text) as courriel, 'contact_client' as source, k.id as personne_id,
       exists (select 1 from app.acces a where a.contact_client_id = k.id) as a_un_acces
  from core.contact_client k where k.email is not null
union all
select lower(f.email_personnel), 'fiche_talent', f.id,
       exists (select 1 from app.acces a where a.fiche_talent_id = f.id)
  from core.fiche_talent f where f.email_personnel is not null
union all
select lower(c.email), 'collaborateur', c.id,
       exists (select 1 from app.acces a where a.collaborateur_id = c.id)
  from core.collaborateur c where c.email is not null;

revoke all on api.diagnostic_rattachement from anon, authenticated;
grant select on api.diagnostic_rattachement to service_role;
