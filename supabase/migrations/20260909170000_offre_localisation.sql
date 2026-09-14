-- =====================================================================
-- LA LOCALISATION DES OFFRES — elle existait, je la lisais au mauvais
-- endroit
--
-- La carte du job board porte une ligne « Localisation » restée vide sur
-- les 12 offres. J'en avais conclu que la donnée manquait. C'est faux :
-- elle n'est simplement PAS sur le mandat.
--
-- MESURÉ : `public.mandat` n'a aucune colonne de lieu — ni au miroir, ni
-- donc dans `core.mandat.localisation`, que la reprise n'a jamais pu
-- alimenter. Le lieu d'un poste est celui de son CLIENT, et il vit dans
-- `public.entreprise.localisation`, un JSON Google Maps
-- {lat, lng, address}. Repris sous `core.entreprise.localisation_json`,
-- il est renseigné sur 121 des 851 entreprises — et sur 9 des 12 offres
-- publiées.
--
-- ⚠ ON N'EXPOSE QUE LA VILLE, JAMAIS L'ADRESSE.
-- Les adresses réelles sont précises : « 114 Rue Marceau, 93100
-- Montreuil, France ». Sur une offre ANONYME — et les 12 le sont — une
-- rue et un numéro suffisent à retrouver le client en une recherche.
-- Publier l'adresse du siège reviendrait à contourner par la porte de
-- derrière l'anonymat que la vue défend par la grande.
-- La maquette dit d'ailleurs la même chose : « Paris, Lyon ou Nantes ».
-- =====================================================================

/**
 * La ville du client d'un mandat, extraite de son adresse.
 *
 * SECURITY DEFINER, pour la même raison que `masquer_client` : pour rendre
 * une ville il faut lire `core.entreprise`, table sur laquelle le visiteur
 * n'a — et ne doit avoir — aucun droit. La fonction lit à sa place et ne
 * rend jamais que la ville.
 *
 * L'extraction prend l'avant-dernier segment de l'adresse (le dernier
 * étant le pays) puis retire un code postal de tête. Vérifié sur les
 * quatre formes rencontrées :
 *   « Paris, France »                              → Paris
 *   « 91190 Saint-Aubin, France »                  → Saint-Aubin
 *   « 114 Rue Marceau, 93100 Montreuil, France »   → Montreuil
 *   « 01000 Bourg-en-Bresse, France »              → Bourg-en-Bresse
 */
create or replace function api.ville_du_mandat(p_mandat_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  with adresse as (
    select e.localisation_json->>'address' as a
    from core.mandat m
    join core.entreprise e on e.id = m.entreprise_id
    where m.id = p_mandat_id
  )
  select nullif(
    btrim(regexp_replace(
      split_part(
        a, ',',
        greatest(1, array_length(string_to_array(a, ','), 1) - 1)
      ),
      '^\s*\d{4,5}\s+', ''
    )),
  '')
  from adresse
  where a is not null;
$$;

comment on function api.ville_du_mandat(uuid) is
  'La VILLE du client, jamais son adresse : sur une offre anonyme, une rue et un numéro suffisent à retrouver l''entreprise. SECURITY DEFINER — le visiteur n''a aucun droit sur core.entreprise.';

grant execute on function api.ville_du_mandat(uuid) to anon, authenticated, service_role;

-- ── la vue lit désormais la ville, et non une colonne sans source
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
  p.salaire_affiche,
  -- `m.localisation` reste vide faute de source ; la ville vient du client.
  coalesce(nullif(btrim(m.localisation), ''), api.ville_du_mandat(m.id)) as localisation,
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
  'Le job board. Une offre y est parce qu''un ACTE de publication existe et n''a pas été retiré. N''expose JAMAIS mandat.titre ni l''adresse du client — seulement sa ville.';

grant select on api.offre_publique to anon, authenticated, service_role;
