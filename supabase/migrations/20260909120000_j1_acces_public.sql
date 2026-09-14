-- =====================================================================
-- J1 — CE QU'IL FAUT POUR QU'UN VISITEUR VOIE LES OFFRES
--
-- Défaut trouvé avant l'exposition du schéma. Les vues sont en
-- security_invoker : elles s'exécutent avec les droits de l'APPELANT, qui
-- doit donc pouvoir lire les tables de base. Or `anon` n'a aucun droit
-- sur `app` ni `core`. Le job board aurait renvoyé un tableau vide — et
-- c'est précisément la forme que prend une politique manquante, celle que
-- le ticket exige de savoir distinguer d'une base vide.
--
-- DEUX FAÇONS DE LE RÉSOUDRE, ET POURQUOI CELLE-CI.
--
-- La plus simple serait une vue en SECURITY DEFINER : elle s'exécuterait
-- avec les droits du propriétaire et `anon` n'aurait besoin de rien. Mais
-- alors la vue serait le SEUL rempart, et une erreur dans son WHERE
-- exposerait les 533 mandats.
--
-- La voie retenue garde deux remparts : `anon` reçoit des droits
-- minimaux, ET des policies qui ne lui montrent que les mandats
-- effectivement publiés. Une erreur dans la vue ne peut pas dépasser ce
-- que les policies autorisent.
-- =====================================================================

grant usage on schema app to anon;

grant select on app.mandat_publication to anon;
grant select on core.mandat, core.mandat_remote, core.mandat_tag_job to anon;

-- ── un visiteur ne voit QUE les publications actives du job board
create policy visiteur_publications on app.mandat_publication
  for select to anon
  using (retire_le is null and canal = 'job_board_public');

-- ── et QUE les mandats qui portent une telle publication
create policy visiteur_mandats_publies on core.mandat
  for select to anon
  using (exists (select 1 from app.mandat_publication p
                  where p.mandat_id = core.mandat.id
                    and p.retire_le is null
                    and p.canal = 'job_board_public'));

create policy visiteur_remote on core.mandat_remote
  for select to anon
  using (exists (select 1 from app.mandat_publication p
                  where p.mandat_id = core.mandat_remote.mandat_id
                    and p.retire_le is null and p.canal = 'job_board_public'));

create policy visiteur_tags on core.mandat_tag_job
  for select to anon
  using (exists (select 1 from app.mandat_publication p
                  where p.mandat_id = core.mandat_tag_job.mandat_id
                    and p.retire_le is null and p.canal = 'job_board_public'));

-- ---------------------------------------------------------------------
-- LE PARADOXE DU MASQUAGE, ET SA SOLUTION
--
-- Pour CACHER le nom du client, il faut le LIRE. Si le masquage recevait
-- ce nom par la vue, `anon` aurait besoin d'un droit de lecture sur
-- core.entreprise — donner accès aux 851 clients pour en cacher douze.
--
-- Les deux fonctions ci-dessous vont chercher le nom elles-mêmes, en
-- SECURITY DEFINER. `anon` n'obtient aucun droit sur core.entreprise, et
-- le masquage fonctionne quand même. Elles ne rendent jamais le nom d'un
-- client d'une offre anonyme : l'une le remplace par NULL, l'autre ne le
-- rend que si l'offre est ouverte.
-- ---------------------------------------------------------------------

drop view if exists api.offre_publique;
drop function if exists api.sans_nom_client(text, text);

create or replace function api.masquer_client(texte text, p_mandat_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when texte is null then null
    when not exists (select 1 from core.mandat m where m.id = p_mandat_id and m.est_anonyme) then texte
    when exists (
      select 1 from core.mandat m join core.entreprise e on e.id = m.entreprise_id
       where m.id = p_mandat_id and length(e.nom) >= 4
         and texte ~* ('\m' || regexp_replace(e.nom, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M'))
      then null
    else texte end;
$$;
comment on function api.masquer_client(text, uuid) is
  'Annule un texte qui nomme le client de son offre anonyme. SECURITY DEFINER : le nom est lu ici, jamais exposé à l''appelant. Frontières de mots obligatoires — sans elles « Uber » se trouve dans « Kubernetes » et « Join » dans « rejoindre », trois faux positifs mesurés.';

create or replace function api.client_visible(p_mandat_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select e.nom from core.mandat m join core.entreprise e on e.id = m.entreprise_id
   where m.id = p_mandat_id and not m.est_anonyme;
$$;
comment on function api.client_visible(uuid) is
  'Le nom du client, et NULL si l''offre est anonyme. Seule voie par laquelle une raison sociale peut atteindre le job board.';

-- ---------------------------------------------------------------------

create or replace view api.offre_publique with (security_invoker = true) as
select
  p.mandat_id        as id,
  p.libelle_public   as intitule,
  u.libelle_fr       as univers,
  mt.libelle_fr      as metier,
  api.client_visible(m.id) as entreprise,
  m.contrat::text    as contrat,
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

grant select on api.offre_publique to anon, authenticated;
grant execute on function api.masquer_client(text, uuid), api.client_visible(uuid) to anon, authenticated;
