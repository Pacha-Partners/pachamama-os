-- Les quatre personnes rattachables à un mandat : laquelle est renseignée,
-- sur l'ensemble et sur les 12 offres publiées ?
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'personnes', 'agent_en_charge_id → core.collaborateur',
       (select count(*) from core.mandat where agent_en_charge_id is not null),
       count(*) filter (where m.agent_en_charge_id is not null), 0,
       'Bubble : personne_en_charge — ce que j''affiche aujourd''hui'
  from app.mandat_publication p join core.mandat m on m.id = p.mandat_id where p.retire_le is null;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'personnes', 'contact_recruteur_id → core.contact_client',
       (select count(*) from core.mandat where contact_recruteur_id is not null),
       count(*) filter (where m.contact_recruteur_id is not null), 0,
       'Bubble : recruteur — une ligne de public.equipe'
  from app.mandat_publication p join core.mandat m on m.id = p.mandat_id where p.retire_le is null;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'personnes', 'account_manager_id → core.collaborateur',
       (select count(*) from core.mandat where account_manager_id is not null),
       count(*) filter (where m.account_manager_id is not null), 0, 'Bubble : account_manager'
  from app.mandat_publication p join core.mandat m on m.id = p.mandat_id where p.retire_le is null;

