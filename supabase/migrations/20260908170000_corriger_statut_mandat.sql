-- =====================================================================
-- CORRECTION — L'APPARIEMENT DES STATUTS DE MANDAT ÉTAIT FAUX
--
-- Trouvé par la reprise le 08/09/2026, et il aurait mal étiqueté les
-- 533 mandats.
--
-- L'amorçage appariait les valeurs du miroir aux étiquettes de l'énuméré
-- PAR POSITION. C'est correct tant que les valeurs ajoutées le sont en
-- FIN d'énuméré — ce qui est le cas de type_contrat, type_produit_entreprise
-- et rythme_remote, vérifiés indemnes.
--
-- Mais statut_mandat reçoit 'en_pause' et 'reprise' AU MILIEU, entre
-- 'en_cours' et 'termine', parce que l'ordre d'affichage l'exigeait. Le
-- décalage a produit :
--     Terminé              → en_pause          (au lieu de termine)
--     Closé par Pachamama  → reprise           (au lieu de close_pachamama)
-- soit 271 mandats terminés devenus « en pause » et 206 closés devenus
-- « repris ».
--
-- CE QUI A ARRÊTÉ L'ERREUR : la contrainte
--     CHECK (statut <> 'en_pause' OR mis_en_pause_le IS NOT NULL)
-- posée parce que 'en_pause' était une valeur neuve sans aucune ligne.
-- Elle a refusé le premier mandat mal étiqueté. Sans elle, la reprise
-- passait en silence.
-- =====================================================================

update ref.correspondance set code_cible = 'termine'
 where referentiel = 'ref_mandate_status' and libelle_miroir = 'Terminé';
update ref.correspondance set code_cible = 'close_pachamama'
 where referentiel = 'ref_mandate_status' and libelle_miroir = 'Closé par Pachamama';

-- ref.libelle portait le même décalage : les libellés d'affichage
-- étaient collés aux mauvais codes.
delete from ref.libelle where domaine = 'statut_mandat';
insert into ref.libelle (domaine, code, libelles, couleur, ordre, actif) values
  ('statut_mandat','nouveau',         '{"fr":"Nouveau"}',              null, 1, true),
  ('statut_mandat','en_cours',        '{"fr":"En cours"}',             null, 2, true),
  ('statut_mandat','en_pause',        '{"fr":"En pause"}',             null, 3, true),
  ('statut_mandat','reprise',         '{"fr":"Reprise"}',              null, 4, true),
  ('statut_mandat','termine',         '{"fr":"Terminé"}',              null, 5, true),
  ('statut_mandat','close_pachamama', '{"fr":"Closé par Pachamama"}',  null, 6, true);

-- Garde-fou : que l'appariement positionnel ne puisse plus se tromper en
-- silence. Si un libellé du miroir se traduit par un code absent de
-- l'énuméré, ou si deux libellés visent le même code, on veut le savoir.
create or replace view ref.v_correspondance_suspecte as
select referentiel, code_cible, count(*) as libelles_visant_ce_code,
       string_agg(libelle_miroir, ' | ') as libelles
from ref.correspondance
where referentiel <> 'equipe.absorbee'   -- repli volontaire des contacts, pas un décalage
group by referentiel, code_cible having count(*) > 1;
comment on view ref.v_correspondance_suspecte is
  'Deux libellés du miroir qui visent le même code cible : soit une fusion voulue, soit un appariement décalé comme celui des statuts de mandat, trouvé le 08/09/2026.';
