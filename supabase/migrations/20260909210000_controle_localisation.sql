-- =====================================================================
-- CONTRÔLE — la localisation est-elle réellement en place, des deux côtés ?
--
-- Comptée en base et non estimée depuis un export : les textes longs du
-- mandat contiennent des retours à la ligne qui faussent tout comptage
-- fait sur le fichier de sauvegarde.
-- =====================================================================

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'loc', 'public.mandat.localisations (miroir)',
       442, count(*) filter (where localisations is not null), 0,
       'Bubble en porte 442 ; les manquants sont des mandats absents du miroir'
  from public.mandat;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'loc', 'core.mandat.localisations_brut_json',
       (select count(*) from public.mandat where localisations is not null),
       count(*) filter (where localisations_brut_json is not null), 0,
       'la liste brute, avec les coordonnées'
  from core.mandat;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'loc', 'core.mandat.localisation (villes)',
       (select count(*) from public.mandat where localisations is not null),
       count(*) filter (where localisation is not null), 0,
       'la chaîne lisible, ville seule'
  from core.mandat;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'loc', 'offres publiées avec un lieu',
       (select count(*) from app.mandat_publication where retire_le is null),
       count(*), 0, 'ce que voit le job board'
  from app.mandat_publication p
  join core.mandat m on m.id = p.mandat_id
 where p.retire_le is null and m.localisation is not null;
