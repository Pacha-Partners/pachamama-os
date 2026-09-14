-- La localisation de l'entreprise existe-t-elle dans le modèle ?
-- Le miroir la porte en JSON ; `core.entreprise` a DEUX colonnes,
-- `localisation_json` et `localisation_texte`. La vue lit la seconde.
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'fiche', 'core.entreprise.localisation_json',
       (select count(*) from public.entreprise where localisation is not null),
       count(*) filter (where localisation_json is not null), 0,
       'la forme brute, reprise depuis le miroir'
  from core.entreprise;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'fiche', 'core.entreprise.localisation_texte',
       (select count(*) from public.entreprise where localisation is not null),
       count(*) filter (where localisation_texte is not null), 0,
       'la forme lisible, celle que la fiche affiche'
  from core.entreprise;

-- et les autres lignes du bloc Contexte, sur les seules offres publiées
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'fiche', 'offres publiées dont le client a une ' || champ, 12, n, 0, null
  from (
    select 'description' as champ, count(*) filter (where e.description is not null) as n
      from app.mandat_publication p join core.mandat m on m.id=p.mandat_id
      left join core.entreprise e on e.id=m.entreprise_id where p.retire_le is null
    union all select 'fondateur', count(*) filter (where e.fondateur is not null)
      from app.mandat_publication p join core.mandat m on m.id=p.mandat_id
      left join core.entreprise e on e.id=m.entreprise_id where p.retire_le is null
    union all select 'localisation_texte', count(*) filter (where e.localisation_texte is not null)
      from app.mandat_publication p join core.mandat m on m.id=p.mandat_id
      left join core.entreprise e on e.id=m.entreprise_id where p.retire_le is null
    union all select 'localisation_json', count(*) filter (where e.localisation_json is not null)
      from app.mandat_publication p join core.mandat m on m.id=p.mandat_id
      left join core.entreprise e on e.id=m.entreprise_id where p.retire_le is null
  ) z;
