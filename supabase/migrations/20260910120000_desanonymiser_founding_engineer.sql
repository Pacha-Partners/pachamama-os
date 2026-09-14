-- =====================================================================
-- DÉSANONYMISER « Founding Engineer », à la demande du commanditaire.
--
-- Les 12 offres publiées sont toutes anonymes : la VUE PLEINE de la
-- maquette — logo du client, huit lignes de contexte, ambition, futur
-- manager — était donc écrite et testée par le code, sans avoir jamais
-- été vue avec de vraies données. Cette bascule sert à la valider.
--
-- C'est un changement de DONNÉE, pas de schéma, et il est réversible :
-- `update core.mandat set est_anonyme = true where id = '76c0510e-…'`.
--
-- Conséquence à connaître : le nom du client, son site internet et sa
-- fiche complète deviennent PUBLICS sur cette offre. C'est le
-- comportement voulu d'une offre non anonyme, et c'est bien le sens de
-- la demande — mais il vaut d'être écrit ici plutôt que découvert.
-- =====================================================================

update core.mandat
   set est_anonyme = false
 where id = '76c0510e-73f0-5368-8e07-1b5710def9ba'
   -- La contrainte `mandat_salaire_ordre` est NOT VALID : elle ne se
   -- réveille qu'à la mise à jour de la ligne. On vérifie avant de
   -- toucher, plutôt que de faire échouer la migration entière.
   and not (salaire_min_ke is not null and salaire_max_ke is not null
            and salaire_min_ke > salaire_max_ke);

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'anonymat', 'Founding Engineer désanonymisé', 1,
       count(*) filter (where not est_anonyme), 0,
       'bascule demandée pour valider la vue pleine de la maquette'
  from core.mandat where id = '76c0510e-73f0-5368-8e07-1b5710def9ba';
