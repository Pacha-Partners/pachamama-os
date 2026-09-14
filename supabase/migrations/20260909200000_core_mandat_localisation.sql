-- =====================================================================
-- LE MODÈLE REPREND LA LOCALISATION DES MANDATS
--
-- `core.mandat.localisation` existait depuis le premier jour et n'avait
-- jamais rien reçu : sa source n'arrivait pas jusqu'au miroir. Elle y est
-- désormais (migration 20260909190000), et la reprise peut faire son
-- travail.
--
-- DEUX COLONNES, COMME POUR LE TALENT. `core.fiche_talent` garde la liste
-- brute dans `localisations_brut_json` et la version lisible dans
-- `localisation_texte`. Le mandat suit la même règle : on ne jette pas la
-- structure d'origine — les coordonnées géographiques serviront à une
-- recherche par rayon — et on ne fait pas non plus recalculer une chaîne
-- d'affichage à chaque lecture.
--
-- ON N'EXPOSE QUE LA VILLE. Mesuré sur les 467 lieux de Bubble : 5
-- contiennent une rue numérotée (« 4 Rue Jules Lefebvre, 75009 Paris ») et
-- 41 commencent par un code postal. Les 12 offres publiées étant TOUTES
-- anonymes, une rue et un numéro suffiraient à retrouver le client. La
-- chaîne lisible ne retient donc que la ville — ce que montre d'ailleurs
-- la maquette. L'adresse complète reste dans le JSON, hors de la vue
-- publique.
-- =====================================================================

alter table core.mandat
  add column if not exists localisations_brut_json jsonb;

comment on column core.mandat.localisations_brut_json is
  'La liste de lieux telle que Bubble la porte : {address, lat, lng}. Conservée pour les coordonnées, qu''une recherche par rayon exigera. N''est PAS exposée par api.offre_publique — les adresses y sont parfois précises à la rue.';

comment on column core.mandat.localisation is
  'La ou les VILLES du poste, lisibles, séparées par une virgule. Dérivée du JSON : l''avant-dernier segment de l''adresse, code postal retiré. Jamais la rue.';

-- ── la liste brute
update core.mandat cm
   set localisations_brut_json = pm.localisations
  from public.mandat pm
 where pm.id = cm.bubble_id
   and pm.localisations is not null;

-- ── la chaîne lisible, dans l'ordre de saisie, sans doublon
with villes as (
  select cm.id            as mandat_id,
         min(e.ord)       as rang,
         btrim(regexp_replace(
           split_part(
             e.lieu->>'address', ',',
             greatest(1, array_length(string_to_array(e.lieu->>'address', ','), 1) - 1)
           ),
           '^\s*\d{4,5}\s+', ''
         ))              as ville
    from core.mandat cm
    join public.mandat pm on pm.id = cm.bubble_id
   cross join lateral jsonb_array_elements(pm.localisations) with ordinality e(lieu, ord)
   where pm.localisations is not null
   group by 1, 3
)
update core.mandat m
   set localisation = z.texte
  from (
    select mandat_id, string_agg(ville, ', ' order by rang) as texte
      from villes
     where ville is not null and ville <> ''
     group by mandat_id
  ) z
 where m.id = z.mandat_id;
