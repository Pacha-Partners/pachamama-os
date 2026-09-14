-- =====================================================================
-- REPRISE 03 — LA FICHE TALENT ET SES SATELLITES
--
-- Le cœur. public.candidat et ses quatre satellites 1:1 — candidat_expanded,
-- experience, job_actuel, job_reve — se replient dans une seule fiche.
--
-- DEUX RÈGLES DE FUSION MESURÉES S'APPLIQUENT ICI.
--
-- 1. LES MONTANTS (Décision 7). candidat et job_reve portent tous deux les
--    prétentions. Lire job_reve seul — ce que le modèle faisait — perdrait
--    737 montants et trancherait en silence 447 désaccords. Règle : union
--    d'abord, puis préséance au PLUS RÉCENT des deux updated_at. Elle n'est
--    pas neutre : sur 216 désaccords de salaire minimum, candidat est la
--    source la plus fraîche 167 fois, alors qu'il est deux fois moins rempli.
--
-- 2. LES SEPT CHAMPS DUPLIQUÉS avec candidat_expanded, systématiquement
--    mieux rempli : l'expanded gagne, candidat comble les trous.
--
-- talent_id reste NULL : la projection du pivot est alimentée par le
-- connecteur, pas par la reprise.
-- =====================================================================

insert into core.fiche_talent (
  id, bubble_id, prenom, nom, genre, photo_url, email_personnel, telephone, url_linkedin,
  localisation_texte, localisations_brut_json, cv_url, portfolio_url, portfolio_fichier_url,
  est_qualifie, niveau_anglais, univers_id, mindset, ecole, grande_ecole,
  appetence_early_stage, fiche_complete, debut_vie_professionnelle,
  poste_actuel_employeur, poste_actuel_entreprise_id, poste_actuel_metier_id,
  poste_actuel_univers_id, poste_actuel_contrat, poste_actuel_raison_depart,
  attentes_metier_id, attentes_univers_id,
  attentes_salaire_min_ke, attentes_salaire_max_ke, attentes_tjm_min_eur, attentes_tjm_max_eur,
  attentes_infos_salaire, attentes_disponibilite_texte, attentes_localisation_texte,
  attentes_localisations_brut_json, attentes_description,
  statut_relation, emoji_statut, agent_referent_id, actif,
  cree_par_legacy_bubble, synchro_cree_le, synchro_maj_le, cree_le, maj_le)
select
  reprise.uid(c.id), c.id, c.prenom, c.nom,
  reprise.code('ref_gender', c.genre)::ref.genre,
  c.photo_url, nullif(c.email_perso,''), c.telephone, c.linkedin,
  c.localisations_filtre, c.localisations, c.cv_url,
  coalesce(x.portfolio, c.portfolio), c.portfolio_file_url,
  coalesce(c.est_qualifie, false),
  reprise.code('ref_niveau_anglais', c.niveau_anglais)::ref.niveau_anglais,
  uc.id,
  -- l'expanded gagne, candidat comble
  reprise.code('ref_mindset', coalesce(x.mindset, c.mindset))::ref.mindset_talent,
  x.ecole, c.grandes_ecoles, coalesce(x.stage, c.early_stage),
  coalesce(x.is_complete, false),
  e.xp_pro::date,
  ja.entreprise_nom,
  (select en.id from core.entreprise en where en.id = reprise.uid(ja.entreprise_id)),
  mja.id, uja.id,
  reprise.code('ref_contrat', coalesce(x.contrat, c.contrat_actuel))::ref.type_contrat,
  ja.pourquoi,
  mjr.id, ujr.id,
  -- ═══ FUSION DES MONTANTS : union, puis le plus récent l'emporte ═══
  case when jr.salaire is null then reprise.ke(c.salaire_min_souhait)
       when c.salaire_min_souhait is null then reprise.ke(jr.salaire)
       when coalesce(c.updated_at,'-infinity'::timestamptz)
          > coalesce(jr.updated_at,'-infinity'::timestamptz) then reprise.ke(c.salaire_min_souhait)
       else reprise.ke(jr.salaire) end,
  case when jr.salaire_maximum is null then reprise.ke(c.salaire_max_souhait)
       when c.salaire_max_souhait is null then reprise.ke(jr.salaire_maximum)
       when coalesce(c.updated_at,'-infinity'::timestamptz)
          > coalesce(jr.updated_at,'-infinity'::timestamptz) then reprise.ke(c.salaire_max_souhait)
       else reprise.ke(jr.salaire_maximum) end,
  case when jr.tjm_minimum is null then c.tjm_min_souhait
       when c.tjm_min_souhait is null then jr.tjm_minimum
       when coalesce(c.updated_at,'-infinity'::timestamptz)
          > coalesce(jr.updated_at,'-infinity'::timestamptz) then c.tjm_min_souhait
       else jr.tjm_minimum end,
  case when jr.tjm_maximum is null then c.tjm_max_souhait
       when c.tjm_max_souhait is null then jr.tjm_maximum
       when coalesce(c.updated_at,'-infinity'::timestamptz)
          > coalesce(jr.updated_at,'-infinity'::timestamptz) then c.tjm_max_souhait
       else jr.tjm_maximum end,
  jr.infos_salaire, jr.disponibilite, jr.info_localisation, jr.localisations, jr.description,
  reprise.code('ref_statut_candidat', coalesce(x.statut, c.statut))::ref.statut_relation,
  reprise.code('ref_emoji', coalesce(x.emoji, c.emoji_statut))::ref.emoji_statut,
  (select k.id from core.collaborateur k
    where k.id = reprise.uid(coalesce(x.agent_id, c.agent_pachamama_id))),
  true,
  c.created_by, c.created_at, c.updated_at,
  coalesce(c.created_at, now()), coalesce(c.updated_at, now())
from public.candidat c
left join public.candidat_expanded x on x.candidat_id = c.id
left join public.experience        e on e.candidat_id = c.id
left join public.job_actuel        ja on ja.candidat_id = c.id
left join public.job_reve          jr on jr.candidat_id = c.id
left join ref.univers uc  on uc.code  = reprise.code('ref_univers', c.univers)
left join ref.univers uja on uja.code = reprise.code('ref_univers', ja.univers)
left join ref.univers ujr on ujr.code = reprise.code('ref_univers', jr.univers)
left join ref.metier  mja on mja.code = reprise.code('ref_metier',  ja.metier)
left join ref.metier  mjr on mjr.code = reprise.code('ref_metier',  jr.metier)
on conflict (id) do nothing;

select reprise.noter('03','core.fiche_talent',
  (select count(*) from public.candidat),
  (select count(*) from core.fiche_talent), 0, null);
