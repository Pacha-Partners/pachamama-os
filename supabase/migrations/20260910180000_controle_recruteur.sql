-- Le bloc « Agent.e Pachamama » désigne le RECRUTEUR du mandat.
-- Où en est cette donnée, et que valent ses champs d'affichage ?
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'recruteur', 'core.mandat.contact_recruteur_id (tous)',
       (select count(*) from public.mandat where recruteur_id is not null),
       count(*) filter (where contact_recruteur_id is not null), 0,
       'la reprise a-t-elle transmis le recruteur ?'
  from core.mandat;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'recruteur', 'offres publiées avec un recruteur', 12,
       count(*) filter (where m.contact_recruteur_id is not null), 0, null
  from app.mandat_publication p join core.mandat m on m.id = p.mandat_id
 where p.retire_le is null;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'recruteur', 'dont le recruteur a un nom', count(*),
       count(*) filter (where btrim(coalesce(c.prenom,'') || coalesce(c.nom,'')) <> ''), 0, null
  from app.mandat_publication p
  join core.mandat m on m.id = p.mandat_id
  join core.contact_client c on c.id = m.contact_recruteur_id
 where p.retire_le is null;

-- Et pour comparaison : ce que j'affichais, l'agent en charge.
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'recruteur', 'un exemple : recruteur vs agent en charge', null, null, 0,
       'recruteur=' || coalesce(nullif(btrim(coalesce(cr.prenom,'') || ' ' || coalesce(cr.nom,'')),''), '∅')
       || ' | agent_en_charge=' || coalesce(nullif(btrim(coalesce(ag.prenom,'') || ' ' || coalesce(ag.nom,'')),''), '∅')
  from app.mandat_publication p
  join core.mandat m on m.id = p.mandat_id
  left join core.contact_client cr on cr.id = m.contact_recruteur_id
  left join core.collaborateur  ag on ag.id = m.agent_en_charge_id
 where p.retire_le is null and m.contact_recruteur_id is not null
 limit 1;
