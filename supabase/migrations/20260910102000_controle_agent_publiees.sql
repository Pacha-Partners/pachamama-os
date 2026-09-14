-- L'agent est-il désormais présent sur les offres du job board ?
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'agent', 'offres publiées avec un agent',
       count(*), count(*) filter (where m.agent_en_charge_id is not null), 0,
       'la carte « Agent.e Pachamama » a-t-elle de quoi s''afficher ?'
  from app.mandat_publication p join core.mandat m on m.id = p.mandat_id
 where p.retire_le is null;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'agent', 'dont l''agent a une photo',
       count(*) filter (where m.agent_en_charge_id is not null),
       count(*) filter (where c.photo_url is not null), 0,
       'le bloc disparaît si la photo manque'
  from app.mandat_publication p
  join core.mandat m on m.id = p.mandat_id
  left join core.collaborateur c on c.id = m.agent_en_charge_id
 where p.retire_le is null;
