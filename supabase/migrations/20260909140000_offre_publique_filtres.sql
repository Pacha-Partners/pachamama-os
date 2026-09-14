-- =====================================================================
-- api.offre_publique — LES TROIS COLONNES QU'EXIGE LA PAGE JOBS
--
-- La maquette de la page jobs demande trois choses que la vue ne portait
-- pas : le CODE de l'univers (le libellé ne suffit pas, il faut une clé
-- stable pour filtrer et pour choisir la teinte du tag), le type de
-- contributeur — c'est le filtre « Management » — et l'exclusivité, qui
-- porte le badge « Exclu Pachamama » en pied de carte.
--
-- MESURÉ sur les 12 offres publiées avant d'écrire :
--   univers          Tech 6 · Product 5 · Sales 1
--   contributeur     IC 9 · Manager / C-level 3
-- Et sur les 533 mandats : Product 269, Tech 132, Sales 40,
-- People & Finance 13, Marketing 5 — les 3 autres univers du référentiel
-- (design, data, finance) n'ont aucun mandat.
--
-- Le titre reste hors de la vue, comme toujours : 11 des 12 le remplissent
-- avec la raison sociale du client.
-- =====================================================================

-- DROP puis CREATE, et non CREATE OR REPLACE : PostgreSQL refuse de renommer
-- une colonne de vue existante (« cannot change name of view column »), et la
-- colonne « univers » devient ici « univers_code ». Les droits sont donc
-- réaccordés en fin de migration.
drop view if exists api.offre_publique;

create view api.offre_publique with (security_invoker = true) as
select
  p.mandat_id        as id,
  p.libelle_public   as intitule,
  u.code             as univers_code,
  u.libelle_fr       as univers,
  mt.libelle_fr      as metier,
  api.client_visible(m.id) as entreprise,
  m.contrat::text    as contrat,
  -- Le filtre « Management » de la maquette. Deux valeurs au référentiel :
  -- 'ic' et 'manager_c_level'.
  m.type_contributeur::text as management,
  -- Le badge de pied de carte.
  coalesce(m.exclusivite_pachamama, false) as exclusivite_pachamama,
  m.salaire_min_ke, m.salaire_max_ke, m.tjm_min_eur, m.tjm_max_eur,
  p.salaire_affiche, m.localisation, m.departement,
  (select array_agg(r.remote::text) from core.mandat_remote r where r.mandat_id = m.id) as remote,
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
  'Le job board. Une offre y est parce qu''un ACTE de publication existe et n''a pas été retiré. N''expose JAMAIS mandat.titre — mesuré, 11 des 12 titres contiennent la raison sociale du client.';

grant select on api.offre_publique to anon, authenticated, service_role;
