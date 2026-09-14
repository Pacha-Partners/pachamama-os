-- =====================================================================
-- RATTRAPAGE — l'agent en charge du mandat
--
-- TROISIÈME TROU DE REPRISE de la même famille que la localisation et le
-- champ Remplacement : la colonne existait, rien ne la remplissait.
--
-- La reprise du mandat (20260908201005) liste `agent_2_id` et
-- `account_manager_id`, jamais `agent_en_charge_id`. Or c'est
-- `public.mandat.personne_en_charge_id` qui porte l'agent Pachamama, sur
-- 477 des 533 mandats — contre 25 pour `agent_2_id`. Le mauvais des deux
-- champs avait été repris.
--
-- Conséquence visible : la carte « Agent.e Pachamama » de la fiche
-- d'offre n'avait aucune donnée. Elle en manquait PAR PERTE et non par
-- absence — la distinction décide si un bloc se construit ou s'abandonne.
--
-- DEUX EXCLUSIONS, toutes deux comptées plutôt que tues :
--
-- 1. Les agents absents de `core.collaborateur`. Une clé étrangère vers
--    un collaborateur inexistant échouerait, et un agent inconnu du
--    modèle n'a rien à faire sur une fiche publique.
--
-- 2. Les mandats dont le salaire minimum dépasse le maximum. La
--    contrainte `mandat_salaire_ordre` a été posée NOT VALID : les lignes
--    existantes n'ont jamais été vérifiées, et le défaut ne se réveille
--    qu'à la première mise à jour de la ligne. Deux mandats sont dans ce
--    cas — mesurés, aucun n'est publié. Les corriger serait une décision
--    sur la donnée, sans rapport avec l'agent : on ne mélange pas.
-- =====================================================================

update core.mandat m
   set agent_en_charge_id = c.id
  from public.mandat pm
  join core.collaborateur c on c.id = reprise.uid(pm.personne_en_charge_id)
 where pm.id = m.bubble_id
   and pm.personne_en_charge_id is not null
   and m.agent_en_charge_id is null
   and not (m.salaire_min_ke is not null and m.salaire_max_ke is not null
            and m.salaire_min_ke > m.salaire_max_ke);

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'agent', 'core.mandat.agent_en_charge_id',
       (select count(*) from public.mandat where personne_en_charge_id is not null),
       count(*) filter (where agent_en_charge_id is not null), 0,
       'rattrapage du champ oublié par la reprise 05'
  from core.mandat;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'agent', 'restés sans agent — collaborateur inconnu', 0, count(*), count(*),
       'personne_en_charge_id pointe hors de core.collaborateur'
  from public.mandat pm
  join core.mandat m on m.bubble_id = pm.id
  left join core.collaborateur c on c.id = reprise.uid(pm.personne_en_charge_id)
 where pm.personne_en_charge_id is not null and c.id is null;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'agent', 'restés sans agent — salaire inversé', 0, count(*), count(*),
       'écartés par la contrainte mandat_salaire_ordre, à traiter à part'
  from public.mandat pm
  join core.mandat m on m.bubble_id = pm.id
 where pm.personne_en_charge_id is not null
   and m.agent_en_charge_id is null
   and m.salaire_min_ke > m.salaire_max_ke;
