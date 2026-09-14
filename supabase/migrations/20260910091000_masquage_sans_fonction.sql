-- =====================================================================
-- LE MASQUAGE SANS FONCTION APPELABLE
--
-- La migration précédente a fermé l'oracle en révoquant EXECUTE. Elle a
-- du même coup cassé la vue : mesuré, `select=entreprise` rendait
-- « 42501 permission denied for function client_visible ».
--
-- CE QUE J'AVAIS MAL COMPRIS. Une vue non-invoker encapsule les droits
-- sur les TABLES qu'elle lit — pas sur les FONCTIONS qu'elle appelle.
-- PostgreSQL vérifie EXECUTE contre l'appelant, propriétaire de vue ou
-- non. Passer la vue en security_definer ne pouvait donc pas suffire :
-- soit anon peut exécuter la fonction, et l'oracle est ouvert ; soit il
-- ne peut pas, et la vue tombe. Il n'y a pas de troisième terme tant que
-- le masquage passe par une fonction.
--
-- LA SORTIE : plus de fonction du tout dans la vue. Le masquage devient
-- une expression, et la vue lit `core.entreprise` avec les droits de son
-- propriétaire — ce que le mode non-invoker permet, lui, pleinement.
-- `anon` n'obtient toujours aucun droit sur les 851 clients, et il n'y a
-- plus rien à interroger : une expression ne s'appelle pas.
--
-- Le motif est calculé UNE fois par ligne, en latéral, au lieu d'être
-- reconstruit à chaque colonne. Les frontières de mots restent
-- obligatoires : sans elles « Uber » se trouve dans « Kubernetes » et
-- « Join » dans « rejoindre », trois faux positifs mesurés.
-- =====================================================================

drop view if exists api.offre_publique;

create view api.offre_publique with (security_invoker = false) as
select
  p.mandat_id        as id,
  p.libelle_public   as intitule,
  u.code             as univers_code,
  u.libelle_fr       as univers,
  mt.libelle_fr      as metier,
  case when m.est_anonyme then null else e.nom end as entreprise,
  m.contrat::text    as contrat,
  (select l.libelles->>'fr' from ref.libelle l
    where l.domaine = 'type_contrat' and l.code = m.contrat::text) as contrat_libelle,
  m.type_contributeur::text as management,
  (select l.libelles->>'fr' from ref.libelle l
    where l.domaine = 'type_contributeur' and l.code = m.type_contributeur::text) as management_libelle,
  coalesce(m.exclusivite_pachamama, false) as exclusivite_pachamama,
  m.salaire_min_ke, m.salaire_max_ke, m.tjm_min_eur, m.tjm_max_eur,
  p.salaire_affiche,
  m.localisation,
  m.departement,
  (select array_agg(r.remote::text order by r.remote::text)
     from core.mandat_remote r where r.mandat_id = m.id) as remote,
  (select string_agg(coalesce(l.libelles->>'fr', r.remote::text), ' · ' order by l.ordre nulls last)
     from core.mandat_remote r
     left join ref.libelle l on l.domaine = 'rythme_remote' and l.code = r.remote::text
    where r.mandat_id = m.id) as remote_libelle,
  case when z.motif is not null and m.description   ~* z.motif then null else m.description   end as description,
  case when z.motif is not null and m.missions      ~* z.motif then null else m.missions      end as missions,
  case when z.motif is not null and m.pour_toi      ~* z.motif then null else m.pour_toi      end as pour_toi,
  case when z.motif is not null and m.pas_pour_toi  ~* z.motif then null else m.pas_pour_toi  end as pas_pour_toi,
  case when z.motif is not null and m.remote_infos  ~* z.motif then null else m.remote_infos  end as remote_infos,
  case when z.motif is not null and m.salaire_infos ~* z.motif then null else m.salaire_infos end as salaire_infos,
  m.experience_min_annees,
  (select array_agg(tj.emoji || ' ' || tj.libelle_fr order by tj.ordre)
     from core.mandat_tag_job x join ref.tag_job tj on tj.id = x.tag_job_id
    where x.mandat_id = m.id) as tags,
  p.publie_le
from app.mandat_publication p
join core.mandat m on m.id = p.mandat_id
left join core.entreprise e on e.id = m.entreprise_id
left join ref.univers u  on u.id = m.univers_id
left join ref.metier  mt on mt.id = m.metier_id
cross join lateral (
  select case
           when m.est_anonyme and e.nom is not null and length(e.nom) >= 4
           then '\m' || regexp_replace(e.nom, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M'
         end as motif
) z
where p.retire_le is null and p.canal = 'job_board_public';

alter view api.offre_publique owner to postgres;

comment on view api.offre_publique is
  'Le job board. Une offre y est parce qu''un ACTE de publication existe et n''a pas été retiré. N''expose JAMAIS mandat.titre — 11 des 12 le contiennent. Le masquage du client est une EXPRESSION et non une fonction : une fonction exécutable par anon serait un oracle, mesuré le 10/09.';

grant select on api.offre_publique to anon, authenticated, service_role;

-- Les deux fonctions ne servent plus la vue. On les garde pour un usage
-- interne éventuel, sans aucun droit public — et sans qu'un `create or
-- replace` futur puisse leur en rendre par PUBLIC sans qu'on le voie.
revoke execute on function api.masquer_client(text, uuid) from public, anon, authenticated;
revoke execute on function api.client_visible(uuid)       from public, anon, authenticated;
