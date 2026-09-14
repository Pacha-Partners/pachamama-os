-- Le champ « agent en charge » : présent sur 477 mandats du miroir, et dans
-- le modèle ? Comptage sur l'ensemble, pas seulement sur les offres publiées.
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'fiche', 'core.mandat.agent_en_charge_id (tous)',
       (select count(*) from public.mandat where personne_en_charge_id is not null),
       count(*) filter (where agent_en_charge_id is not null), 0,
       'le miroir le porte : la reprise l''a-t-elle transmis ?'
  from core.mandat;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'fiche', 'core.mandat.contact_manager_id (tous)',
       (select count(*) from public.mandat where manager_id is not null),
       count(*) filter (where contact_manager_id is not null), 0,
       'idem pour le futur manager'
  from core.mandat;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'fiche', 'core.mandat.video_youtube (tous)',
       null, count(*) filter (where video_youtube is not null), 0,
       'la vidéo de la review, sur les 533 mandats'
  from core.mandat;
