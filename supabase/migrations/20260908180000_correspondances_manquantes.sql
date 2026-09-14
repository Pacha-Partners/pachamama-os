-- =====================================================================
-- CORRECTION — LES VALEURS AJOUTÉES AUX ÉNUMÉRÉS N'AVAIENT PAS DE
-- CORRESPONDANCE
--
-- Deuxième défaut de la même famille que celui des statuts de mandat,
-- trouvé par la reprise le 08/09/2026.
--
-- Quatre énumérés reçoivent des valeurs absentes de leur référentiel
-- source : elles ont bien été créées dans le TYPE et dans ref.libelle,
-- mais l'amorçage n'a pas écrit leur ligne de correspondance. Traduire
-- « Télétravail » renvoyait donc NULL, et la liaison était perdue en
-- silence — 26 rattachements de télétravail sur les mandats.
--
-- Le contrôle de non-perte du 28/08 ne l'avait pas vu : il vérifiait que
-- chaque LIBELLÉ employé par les données avait une traduction, et ces
-- libellés-là en avaient une… dans le sens table→données. Ce qui manquait
-- était la ligne de correspondance elle-même, pour les seules valeurs
-- découvertes hors référentiel.
-- =====================================================================

insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees) values
  -- rythme_remote : 3 vocabulaires anciens, 526 lignes au total
  ('ref_remote','Télétravail','teletravail_legacy','hors_referentiel', 398),
  ('ref_remote','Présentiel','presentiel_legacy','hors_referentiel', 51),
  ('ref_remote','Indifférent','indifferent_legacy','hors_referentiel', 77),
  -- type_contrat : 37 lignes réelles
  ('ref_contrat','Entrepreneur','entrepreneur','hors_referentiel', 37),
  -- type_produit_entreprise : 5 valeurs mesurées dans les données
  ('ref_product_type','Hybride Hardware Software','hybride_hardware_software','hors_referentiel', 9),
  ('ref_product_type','Média','media','hors_referentiel', 2),
  ('ref_product_type','On-Premise','on_premise','hors_referentiel', 2),
  ('ref_product_type','Hybride On Premise-SaaS','hybride_onpremise_saas','hors_referentiel', 2),
  ('ref_product_type','Jeux-vidéos','jeux_video','hors_referentiel', 1)
on conflict (referentiel, libelle_miroir) do update set code_cible = excluded.code_cible;

-- ---------------------------------------------------------------------
-- Garde-fou durable : toute valeur d'un énuméré qui n'a AUCUNE ligne de
-- correspondance est signalée. C'est ce contrôle qui manquait.
-- ---------------------------------------------------------------------

create or replace view ref.v_enum_sans_correspondance as
select t.typname as enumere, e.enumlabel as valeur
from pg_type t
join pg_namespace n on n.oid = t.typnamespace and n.nspname = 'ref'
join pg_enum e on e.enumtypid = t.oid
where t.typtype = 'e'
  and not exists (select 1 from ref.correspondance c where c.code_cible = e.enumlabel)
  and exists (select 1 from ref.correspondance c2
               where c2.code_cible in (select enumlabel from pg_enum where enumtypid = t.oid));
comment on view ref.v_enum_sans_correspondance is
  'Une valeur d''énuméré sans ligne de correspondance : la reprise la traduira en NULL et perdra la liaison en silence. C''est le contrôle qui manquait le 28/08 — il n''avait vérifié que le sens données→traduction.';
