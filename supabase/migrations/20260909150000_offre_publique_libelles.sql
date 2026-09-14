-- =====================================================================
-- api.offre_publique — LES LIBELLÉS D'AFFICHAGE TRAVERSENT LA VUE
--
-- La page jobs affiche « Hybride », pas « hybride » ; « CDI », pas « cdi ».
-- Ces libellés vivent dans ref.libelle, mais `ref` N'EST PAS un schéma
-- exposé : seul `api` l'est. Le navigateur ne peut donc pas aller les
-- chercher lui-même, et les recopier en dur dans le front créerait une
-- seconde vérité qui divergerait au premier ajout de valeur.
--
-- Ils passent donc par la vue, jointe sur (domaine, code).
--
-- MESURÉ sur les 12 offres : le télétravail vaut 'hybride' (9) ou
-- 'full_remote_fr' (3) ; le contrat 'cdi' (11) ou 'freelance' (1).
--
-- ⚠ CE QUE LA DONNÉE N'A PAS : la localisation est VIDE sur les 12 offres.
-- La maquette montre « Paris, Lyon ou Nantes », qui est du texte de
-- remplissage. La carte masquera donc la ligne plutôt que d'afficher un
-- tiret. C'est un trou de saisie côté Bubble, pas un défaut d'affichage.
-- =====================================================================

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
  (select l.libelles->>'fr' from ref.libelle l
    where l.domaine = 'type_contrat' and l.code = m.contrat::text) as contrat_libelle,
  m.type_contributeur::text as management,
  (select l.libelles->>'fr' from ref.libelle l
    where l.domaine = 'type_contributeur' and l.code = m.type_contributeur::text) as management_libelle,
  coalesce(m.exclusivite_pachamama, false) as exclusivite_pachamama,
  m.salaire_min_ke, m.salaire_max_ke, m.tjm_min_eur, m.tjm_max_eur,
  p.salaire_affiche, m.localisation, m.departement,
  (select array_agg(r.remote::text order by r.remote::text)
     from core.mandat_remote r where r.mandat_id = m.id) as remote,
  -- Un mandat peut porter plusieurs rythmes ; la carte n'a qu'une ligne.
  -- Les libellés sont donc joints ici, dans l'ordre du référentiel.
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
  'Le job board. Une offre y est parce qu''un ACTE de publication existe et n''a pas été retiré. N''expose JAMAIS mandat.titre — mesuré, 11 des 12 titres contiennent la raison sociale du client. Porte ses propres libellés d''affichage, ref n''étant pas un schéma exposé.';

grant select on api.offre_publique to anon, authenticated, service_role;
