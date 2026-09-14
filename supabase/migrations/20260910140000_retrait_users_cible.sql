-- =====================================================================
-- RETRAIT de « Users cible » de la fiche publique.
--
-- La ligne figurait dans le bloc « Contexte » de la maquette, et je
-- l'avais branchée sur `core.mandat_cible` — une propriété du MANDAT, là
-- où les sept autres lignes décrivent l'ENTREPRISE. Le commanditaire
-- tranche : la ligne est retirée.
--
-- On la retire aussi de la VUE, pas seulement de l'affichage. Une
-- colonne exposée que rien ne lit reste une donnée de ciblage servie à
-- la clé publique sans raison : la surface publique se réduit à ce qui
-- sert. `core.mandat_cible` n'est pas touchée, elle reste dans le modèle.
-- =====================================================================

-- `CREATE OR REPLACE VIEW` refuse de RETIRER une colonne (42P16) : il sait en
-- ajouter, jamais en enlever ni en renommer. D'où la suppression préalable,
-- suivie du rétablissement explicite du propriétaire et des droits — les deux
-- disparaissent avec la vue.
drop view if exists api.offre_detail;

create view api.offre_detail with (security_invoker = false) as
select
  p.mandat_id      as id,
  p.libelle_public as intitule,
  u.code           as univers_code,
  u.libelle_fr     as univers,
  mt.libelle_fr    as metier,
  m.est_anonyme,
  coalesce(m.exclusivite_pachamama, false) as exclusivite_pachamama,

  -- ── l'identité du client : tout ou rien
  case when m.est_anonyme then null else e.nom                end as entreprise,
  case when m.est_anonyme then null else e.logo_url           end as entreprise_logo,
  case when m.est_anonyme then null else e.description        end as entreprise_ambition,
  case when m.est_anonyme then null else e.localisation_texte end as entreprise_localisation,
  case when m.est_anonyme then null else e.fondateur          end as entreprise_fondateur,
  case when m.est_anonyme then null else e.serie_financement  end as entreprise_serie,
  case when m.est_anonyme then null else e.type_produit::text end as entreprise_produit,
  case when m.est_anonyme then null else e.nb_employes        end as entreprise_salaries,
  case when m.est_anonyme then null else e.nb_techs           end as entreprise_equipe_tech,
  case when m.est_anonyme then null else e.site_web           end as entreprise_site,

  -- ── le futur manager : un contact du client, donc soumis à l'anonymat
  case when m.est_anonyme then null else
    nullif(btrim(coalesce(cm.prenom,'') || ' ' || coalesce(cm.nom,'')), '') end as manager_nom,
  case when m.est_anonyme then null else cm.photo_url   end as manager_photo,
  case when m.est_anonyme then null else mmt.libelle_fr end as manager_titre,

  -- ── l'agent Pachamama : notre salarié, visible en toutes circonstances
  nullif(btrim(coalesce(ag.prenom,'') || ' ' || coalesce(ag.nom,'')), '') as agent_nom,
  ag.photo_url as agent_photo,

  m.contrat::text as contrat,
  (select l.libelles->>'fr' from ref.libelle l
    where l.domaine = 'type_contrat' and l.code = m.contrat::text) as contrat_libelle,
  m.salaire_min_ke, m.salaire_max_ke, m.tjm_min_eur, m.tjm_max_eur,
  p.salaire_affiche, m.localisation,
  (select string_agg(coalesce(l.libelles->>'fr', r.remote::text), ' · ' order by l.ordre nulls last)
     from core.mandat_remote r
     left join ref.libelle l on l.domaine = 'rythme_remote' and l.code = r.remote::text
    where r.mandat_id = m.id) as remote_libelle,
  (select array_agg(tj.emoji || ' ' || tj.libelle_fr order by tj.ordre)
     from core.mandat_tag_job x join ref.tag_job tj on tj.id = x.tag_job_id
    where x.mandat_id = m.id) as tags,

  case when z.motif is not null and m.description        ~* z.motif then null else m.description        end as description,
  case when z.motif is not null and m.missions           ~* z.motif then null else m.missions           end as missions,
  case when z.motif is not null and m.pour_toi           ~* z.motif then null else m.pour_toi           end as pour_toi,
  case when z.motif is not null and m.pas_pour_toi       ~* z.motif then null else m.pas_pour_toi       end as pas_pour_toi,
  case when z.motif is not null and m.remote_infos       ~* z.motif then null else m.remote_infos       end as remote_infos,
  case when z.motif is not null and m.salaire_infos      ~* z.motif then null else m.salaire_infos      end as salaire_infos,
  case when z.motif is not null and m.process_recrutement ~* z.motif then null else m.process_recrutement end as process_recrutement,

  m.scorecard_discovery, m.scorecard_delivery, m.scorecard_strategie,
  m.scorecard_management, m.scorecard_ops,
  m.video_youtube,
  p.publie_le
from app.mandat_publication p
join core.mandat m on m.id = p.mandat_id
left join core.entreprise   e   on e.id  = m.entreprise_id
left join core.contact_client cm on cm.id = m.contact_manager_id
left join ref.metier       mmt on mmt.id = cm.metier_id
left join core.collaborateur ag on ag.id = m.agent_en_charge_id
left join ref.univers u  on u.id = m.univers_id
left join ref.metier  mt on mt.id = m.metier_id
cross join lateral (
  select case
           when m.est_anonyme and e.nom is not null and length(e.nom) >= 4
           then '\m' || regexp_replace(e.nom, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M'
         end as motif
) z
where p.retire_le is null and p.canal = 'job_board_public';

alter view api.offre_detail owner to postgres;
grant select on api.offre_detail to anon, authenticated, service_role;
