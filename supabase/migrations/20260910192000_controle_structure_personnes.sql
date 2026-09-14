-- Argument STRUCTUREL, indépendant du contenu des colonnes :
-- `core.contact_client` est-elle rattachée à une entreprise cliente ?
-- Si oui, un « recruteur » qui y vit est un contact DU CLIENT, et ne peut pas
-- être l'« Agent.e Pachamama » de la maquette.
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'structure', 'core.contact_client rattachés à une entreprise',
       count(*), count(*) filter (where entreprise_id is not null), 0,
       'la table décrit des contacts CHEZ LE CLIENT'
  from core.contact_client;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'structure', 'core.collaborateur : colonne entreprise_id ?', null,
       count(*), 0, 'aucune colonne d''entreprise = ce sont des salariés Pachamama'
  from information_schema.columns
 where table_schema = 'core' and table_name = 'collaborateur' and column_name = 'entreprise_id';

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'structure', 'recruteurs distincts, et leurs entreprises', null, count(distinct c.id), 0,
       'entreprises distinctes : ' || count(distinct c.entreprise_id)::text
  from core.mandat m join core.contact_client c on c.id = m.contact_recruteur_id;
