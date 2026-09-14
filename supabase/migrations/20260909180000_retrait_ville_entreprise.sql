-- =====================================================================
-- RETRAIT — la localisation ne vient PAS de l'entreprise
--
-- La migration 20260909170000 faisait dire à la carte d'offre la ville du
-- SIÈGE DU CLIENT, faute de trouver la donnée sur le mandat. C'était une
-- substitution de sens, pas un repli : le lieu d'un poste et l'adresse de
-- l'entreprise qui recrute sont deux informations distinctes. Une offre
-- affichait « Montreuil » sans que rien n'atteste que le poste s'y trouve.
--
-- La vraie source est un champ `Localisations` sur le mandat lui-même,
-- saisi à la création — une LISTE de villes, ce qui explique le « Paris,
-- Lyon ou Nantes » de la maquette. Il est renseigné sur 442 des 524
-- mandats de Bubble et n'est PAS synchronisé dans le miroir : ni colonne
-- sur public.mandat, ni table de liaison.
--
-- On revient donc à une ligne vide plutôt qu'à une ligne fausse, en
-- attendant la décision sur la reprise de ce champ.
-- =====================================================================

drop view if exists api.offre_publique;
drop function if exists api.ville_du_mandat(uuid);

create view api.offre_publique with (security_invoker = true) as
select
  p.mandat_id        as id,
  p.libelle_public   as intitule,
  u.code             as univers_code,
  u.libelle_fr       as univers,
  mt.libelle_fr      as metier,
  api.client_visible(m.id) as entreprise,
  m.contrat::text    as contrat,
  (select l.libelles->>'fr' from ref.libelle l
    where l.domaine = 'type_contrat' and l.code = m.contrat::text) as contrat_libelle,
  m.type_contributeur::text as management,
  (select l.libelles->>'fr' from ref.libelle l
    where l.domaine = 'type_contributeur' and l.code = m.type_contributeur::text) as management_libelle,
  coalesce(m.exclusivite_pachamama, false) as exclusivite_pachamama,
  m.salaire_min_ke, m.salaire_max_ke, m.tjm_min_eur, m.tjm_max_eur,
  p.salaire_affiche,
  -- ⚠ VIDE, ET C'EST EXACT. `core.mandat.localisation` n'a jamais eu de
  -- source : le champ `Localisations` du mandat Bubble n'est pas
  -- synchronisé dans le miroir. Tant qu'il ne l'est pas, la carte n'affiche
  -- pas de lieu — plutôt qu'un lieu emprunté à une autre entité.
  m.localisation,
  m.departement,
  (select array_agg(r.remote::text order by r.remote::text)
     from core.mandat_remote r where r.mandat_id = m.id) as remote,
  (select string_agg(coalesce(l.libelles->>'fr', r.remote::text), ' · ' order by l.ordre nulls last)
     from core.mandat_remote r
     left join ref.libelle l on l.domaine = 'rythme_remote' and l.code = r.remote::text
    where r.mandat_id = m.id) as remote_libelle,
  api.masquer_client(m.description,   m.id) as description,
  api.masquer_client(m.missions,      m.id) as missions,
  api.masquer_client(m.pour_toi,      m.id) as pour_toi,
  api.masquer_client(m.pas_pour_toi,  m.id) as pas_pour_toi,
  api.masquer_client(m.remote_infos,  m.id) as remote_infos,
  api.masquer_client(m.salaire_infos, m.id) as salaire_infos,
  m.experience_min_annees,
  (select array_agg(tj.emoji || ' ' || tj.libelle_fr order by tj.ordre)
     from core.mandat_tag_job x join ref.tag_job tj on tj.id = x.tag_job_id
    where x.mandat_id = m.id) as tags,
  p.publie_le
from app.mandat_publication p
join core.mandat m on m.id = p.mandat_id
left join ref.univers u  on u.id = m.univers_id
left join ref.metier  mt on mt.id = m.metier_id
where p.retire_le is null and p.canal = 'job_board_public';

comment on view api.offre_publique is
  'Le job board. Une offre y est parce qu''un ACTE de publication existe et n''a pas été retiré. N''expose JAMAIS mandat.titre. La localisation reste vide tant que le champ Localisations du mandat n''est pas synchronisé depuis Bubble.';

grant select on api.offre_publique to anon, authenticated, service_role;
