-- La chaîne du « Futur.e manager » est-elle complète là où elle existe ?
-- Le nom vient de core.contact_client, le titre de son metier_id via ref.metier.
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'manager', 'mandats avec un contact_manager_id',
       (select count(*) from public.mandat where manager_id is not null),
       count(*) filter (where contact_manager_id is not null), 0,
       'la reprise a-t-elle tout transmis ?'
  from core.mandat;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'manager', 'dont le contact a un nom exploitable',
       count(*), count(*) filter (where btrim(coalesce(c.prenom,'') || coalesce(c.nom,'')) <> ''), 0,
       'sans nom, la section afficherait un tiret malgré la liaison'
  from core.mandat m join core.contact_client c on c.id = m.contact_manager_id;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'manager', 'dont le contact a une photo',
       count(*), count(*) filter (where c.photo_url is not null), 0, null
  from core.mandat m join core.contact_client c on c.id = m.contact_manager_id;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'manager', 'dont le contact a un métier (le titre affiché)',
       count(*), count(*) filter (where c.metier_id is not null), 0,
       'ref.metier.libelle_fr — « Lead Product Manager » sur la maquette'
  from core.mandat m join core.contact_client c on c.id = m.contact_manager_id;
