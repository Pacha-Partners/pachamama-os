-- Les scorecards : 84 mandats les portent dans le miroir. Et dans le modèle ?
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'fiche', 'core.mandat.scorecard_discovery (tous)',
       (select count(*) from public.mandat where discovery is not null),
       count(*) filter (where scorecard_discovery is not null), 0,
       'les pastilles de pourcentage de la maquette'
  from core.mandat;
