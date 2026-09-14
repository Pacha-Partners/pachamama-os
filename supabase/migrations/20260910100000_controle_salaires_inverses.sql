-- Combien de mandats portent un salaire minimum SUPÉRIEUR au maximum ?
-- La contrainte mandat_salaire_ordre a été posée NOT VALID : les lignes
-- existantes n'ont jamais été vérifiées, et le défaut ne se révèle qu'à la
-- première mise à jour de la ligne — ce qui a bloqué le rattrapage de
-- l'agent, sans aucun rapport avec lui.
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'salaire', 'mandats à salaire min > max', 0, count(*), count(*),
       string_agg(distinct m.titre, ' | ' order by m.titre) filter (where true)
  from core.mandat m
 where m.salaire_min_ke is not null and m.salaire_max_ke is not null
   and m.salaire_min_ke > m.salaire_max_ke;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'salaire', 'mandats à TJM min > max', 0, count(*), count(*), null
  from core.mandat m
 where m.tjm_min_eur is not null and m.tjm_max_eur is not null and m.tjm_min_eur > m.tjm_max_eur;
