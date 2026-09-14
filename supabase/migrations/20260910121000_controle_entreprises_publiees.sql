-- Quelle offre publiée a le client le MIEUX renseigné ? C'est celle dont la
-- désanonymisation montrerait réellement la vue pleine de la maquette.
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'fiche',
       'client le mieux renseigné parmi les offres publiées',
       8, max(n), 0,
       (array_agg(titre order by n desc))[1]
  from (
    select p.libelle_public as titre,
           (case when e.localisation_texte is not null then 1 else 0 end)
         + (case when e.fondateur         is not null then 1 else 0 end)
         + (case when e.serie_financement is not null then 1 else 0 end)
         + (case when e.type_produit      is not null then 1 else 0 end)
         + (case when e.nb_employes       is not null then 1 else 0 end)
         + (case when e.nb_techs          is not null then 1 else 0 end)
         + (case when e.site_web          is not null then 1 else 0 end)
         + (case when e.description       is not null then 1 else 0 end) as n
      from app.mandat_publication p
      join core.mandat m on m.id = p.mandat_id
      left join core.entreprise e on e.id = m.entreprise_id
     where p.retire_le is null
  ) z;
