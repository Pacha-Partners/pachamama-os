-- =====================================================================
-- TROIS DÉFAUTS TROUVÉS PAR L'AUDIT NIVEAU VALEUR — 09/09/2026
--
-- Le rapprochement par lignes ne prouve rien : une ligne peut entrer avec
-- toutes ses colonnes vides. L'audit a donc comparé, pour 188 colonnes du
-- miroir, le nombre de valeurs renseignées de chaque côté. 170 colonnes
-- sont conservées. 18 étaient en retrait ; trois causes réelles s'en
-- dégagent, corrigées ici.
-- =====================================================================

-- ---------------------------------------------------------------------
-- DÉFAUT 1 — L'AUTEUR D'UNE CANDIDATURE N'EST PAS TOUJOURS UN INTERNE
--
-- 7 228 candidatures portent un created_by. Seules 3 469 se résolvent en
-- collaborateur : les 3 714 autres désignent un utilisateur qui EXISTE
-- mais n'est pas interne — un candidat qui a créé sa propre candidature.
-- 45 seulement pointent un compte supprimé.
--
-- C'est exactement le cas de l'auteur des notes, résolu là-bas par deux
-- clés étrangères nullables. La même solution s'applique, et pour la même
-- raison : l'auteur n'est jamais quelconque, il est interne OU talent.
-- ---------------------------------------------------------------------

alter table core.candidature
  add column if not exists cree_par_fiche_talent_id uuid
    references core.fiche_talent(id) on delete set null;

comment on column core.candidature.cree_par_fiche_talent_id is
  'La candidature créée par le talent lui-même — une candidature spontanée. MESURÉ : 3 714 des 7 228 created_by du miroir désignent un candidat et non un interne. Sans cette colonne, cette information était perdue.';

alter table core.candidature
  add constraint candidature_un_seul_createur
  check (num_nonnulls(cree_par_id, cree_par_fiche_talent_id) <= 1) not valid;

update core.candidature c
   set cree_par_fiche_talent_id = reprise.uid(u.candidat_id)
from public.process p
join public."user" u on u.id = p.created_by
where c.bubble_id = p.id
  and c.cree_par_id is null
  and u.candidat_id is not null
  and exists (select 1 from core.fiche_talent f where f.id = reprise.uid(u.candidat_id));

create index if not exists candidature_createur_talent
  on core.candidature (cree_par_fiche_talent_id) where cree_par_fiche_talent_id is not null;

-- ---------------------------------------------------------------------
-- DÉFAUT 2 — UN CINQUIÈME NIVEAU D'ANGLAIS EXISTE DANS LES DONNÉES
--
-- « Bon niveau global mais pas au quotidien », 59 candidats. Absent du
-- référentiel ref_niveau_anglais, donc traduit en NULL et perdu.
--
-- Le balayage exhaustif des 48 colonnes adossées à un énuméré n'a trouvé
-- que celle-ci — la campagne « valeurs découvertes » du 28/08 n'avait
-- balayé que les métiers et les expertises.
--
-- Rang : entre l'usage occasionnel et l'usage quotidien, ce que dit le
-- libellé. Déclaré AVANT courant_quotidien pour que l'ordre reste celui
-- de l'intensité.
-- ---------------------------------------------------------------------

alter type ref.niveau_anglais add value if not exists 'bon_niveau_non_quotidien' before 'courant_quotidien';

-- ⚠ ALTER TYPE ... ADD VALUE ne peut pas être suivi, DANS LA MÊME
-- TRANSACTION, d'un usage de la valeur créée. La suite est donc dans la
-- migration 20260909091000. Découvert en testant : la mise au point
-- locale, faite en deux passes, ne l'avait pas révélé.
