-- =====================================================================
-- LA FICHE D'OFFRE — surface publique
--
-- Vue séparée du job board, et non colonnes ajoutées à `offre_publique` :
-- le board lit douze lignes et n'a que faire de l'entreprise ni de
-- l'agent ; la fiche en lit une et joint six tables de plus. Les mêler
-- ferait payer à chaque visite du board le coût de la fiche.
--
-- L'ANONYMAT EST CATÉGORIQUE, et c'est la leçon de l'oracle du 10/09.
-- Sur une offre anonyme, les champs d'identification ne sont pas masqués
-- un à un : ils ne sont pas construits. Masquer le seul NOM ne servirait
-- à rien — le site internet, renseigné sur 12 offres publiées sur 12, le
-- fondateur ou la localisation du siège réidentifient le client en zéro
-- recherche, et aucun masquage lexical ne les voit.
--
-- Ce qui reste visible sur une offre anonyme, et pourquoi :
--   · l'agent Pachamama — c'est notre salarié, pas celui du client ;
--   · `remote_infos` — porté par le MANDAT, pas par l'entreprise ;
--   · les textes libres du mandat, au masquage lexical près.
-- Ce qui disparaît : les huit lignes de contexte, l'ambition, le logo, et
-- le futur manager, qui est un contact du client.
--
-- Comme `offre_publique`, aucune FONCTION n'est appelée : le masquage est
-- une expression. Une fonction exécutable par `anon` serait un oracle.
-- =====================================================================

create or replace view api.offre_detail with (security_invoker = false) as
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
  case when m.est_anonyme then null else
    (select array_agg(coalesce(l.libelles->>'fr', c.cible::text) order by c.cible::text)
       from core.mandat_cible c
       left join ref.libelle l on l.domaine = 'cible_produit' and l.code = c.cible::text
      where c.mandat_id = m.id) end as entreprise_cibles,

  -- ── le futur manager : un contact du client, donc soumis à l'anonymat
  case when m.est_anonyme then null else
    nullif(btrim(coalesce(cm.prenom,'') || ' ' || coalesce(cm.nom,'')), '') end as manager_nom,
  case when m.est_anonyme then null else cm.photo_url   end as manager_photo,
  case when m.est_anonyme then null else mmt.libelle_fr end as manager_titre,

  -- ── l'agent Pachamama : notre salarié, visible en toutes circonstances
  nullif(btrim(coalesce(ag.prenom,'') || ' ' || coalesce(ag.nom,'')), '') as agent_nom,
  ag.photo_url as agent_photo,

  -- ── ce que le board expose déjà, repris à l'identique
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

  -- ── les textes du mandat, au masquage lexical près
  case when z.motif is not null and m.description        ~* z.motif then null else m.description        end as description,
  case when z.motif is not null and m.missions           ~* z.motif then null else m.missions           end as missions,
  case when z.motif is not null and m.pour_toi           ~* z.motif then null else m.pour_toi           end as pour_toi,
  case when z.motif is not null and m.pas_pour_toi       ~* z.motif then null else m.pas_pour_toi       end as pas_pour_toi,
  case when z.motif is not null and m.remote_infos       ~* z.motif then null else m.remote_infos       end as remote_infos,
  case when z.motif is not null and m.salaire_infos      ~* z.motif then null else m.salaire_infos      end as salaire_infos,
  case when z.motif is not null and m.process_recrutement ~* z.motif then null else m.process_recrutement end as process_recrutement,

  -- ── la scorecard. Une valeur à 0 EST une donnée : c'est l'absence des
  -- cinq qui fait disparaître le bloc, pas un zéro.
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

comment on view api.offre_detail is
  'La fiche d''une offre publiée. Anonymat CATÉGORIQUE : sur est_anonyme, les champs qui identifient le client ne sont pas construits — masquer le seul nom laisserait passer le site internet, renseigné 12/12. L''agent Pachamama reste visible : c''est notre salarié.';

grant select on api.offre_detail to anon, authenticated, service_role;
