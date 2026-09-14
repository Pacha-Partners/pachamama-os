-- =====================================================================
-- SUITE DES CORRECTIFS D'AUDIT — séparée de la précédente parce qu'elle
-- EMPLOIE la valeur d'énuméré que celle-ci CRÉE, ce que PostgreSQL
-- interdit dans une même transaction.
-- =====================================================================

insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine, occurrences_mesurees)
values ('ref_niveau_anglais','Bon niveau global mais pas au quotidien','bon_niveau_non_quotidien','hors_referentiel',59)
on conflict (referentiel, libelle_miroir) do update set code_cible = excluded.code_cible;

insert into ref.libelle (domaine, code, libelles, ordre, actif)
values ('niveau_anglais','bon_niveau_non_quotidien','{"fr":"Bon niveau global mais pas au quotidien"}',4,true)
on conflict (domaine, code) do nothing;

update core.fiche_talent f
   set niveau_anglais = 'bon_niveau_non_quotidien'
from public.candidat c
where f.bubble_id = c.id and c.niveau_anglais = 'Bon niveau global mais pas au quotidien';

-- ── DÉFAUT 3 : la reprise des contacts cherchait le métier au seul
-- référentiel, sans le repli sur les valeurs découvertes en données.
-- « Program Manager » existait bien, la requête ne le trouvait pas.
update core.contact_client k
   set metier_id = m.id
from public.equipe e
join ref.metier m on m.code = coalesce(reprise.code('ref_metier', e.metier),
                                       reprise.code('donnees.metier', e.metier))
where k.bubble_id = e.id and k.metier_id is null and e.metier is not null;

-- ---------------------------------------------------------------------
-- DÉFAUT 4 — LE REPLI SUR LES MÉTIERS DÉCOUVERTS MANQUAIT EN TROIS ENDROITS
--
-- Les 17 métiers saisis au clavier par les recruteurs ont été ajoutés à
-- ref.metier avec origine 'decouvert_en_donnees', et leur correspondance
-- est enregistrée sous le référentiel 'donnees.metier'. Mais trois
-- requêtes de reprise interrogeaient le seul 'ref_metier' : elles
-- laissaient donc à NULL les métiers ainsi découverts.
-- Mesuré : 26 sur job_actuel, 13 sur job_reve, 1 sur equipe.
-- ---------------------------------------------------------------------

update core.fiche_talent f
   set poste_actuel_metier_id = m.id
from public.job_actuel j
join ref.metier m on m.code = coalesce(reprise.code('ref_metier', j.metier),
                                       reprise.code('donnees.metier', j.metier))
where f.bubble_id = j.candidat_id and f.poste_actuel_metier_id is null and j.metier is not null;

update core.fiche_talent f
   set attentes_metier_id = m.id
from public.job_reve j
join ref.metier m on m.code = coalesce(reprise.code('ref_metier', j.metier),
                                       reprise.code('donnees.metier', j.metier))
where f.bubble_id = j.candidat_id and f.attentes_metier_id is null and j.metier is not null;

-- ---------------------------------------------------------------------
-- DÉFAUT 5 — LES CONTACTS ABSORBÉS PAR LA DÉDUPLICATION
--
-- mandat.manager_id et mandat.recruteur_id désignent une ligne de
-- public.equipe. Or la déduplication a fondu 764 lignes en 524 contacts :
-- une référence vers une ligne ABSORBÉE ne trouve plus son contact par
-- bubble_id. ref.correspondance garde la trace de ces absorptions —
-- c'est précisément à cela qu'elle sert.
-- ---------------------------------------------------------------------

update core.mandat m
   set contact_manager_id = k.id
from public.mandat o
join ref.correspondance c on c.referentiel = 'equipe.absorbee' and c.libelle_miroir = o.manager_id
join core.contact_client k on k.bubble_id = c.code_cible
where m.bubble_id = o.id and m.contact_manager_id is null and o.manager_id is not null;

update core.mandat m
   set contact_recruteur_id = k.id
from public.mandat o
join ref.correspondance c on c.referentiel = 'equipe.absorbee' and c.libelle_miroir = o.recruteur_id
join core.contact_client k on k.bubble_id = c.code_cible
where m.bubble_id = o.id and m.contact_recruteur_id is null and o.recruteur_id is not null;
-- La trace d'absorption ne couvrait que les lignes equipe rattachées à un
-- mandat. Les autres, fondues elles aussi, n'étaient pas traçables — d'où
-- 9 références de manager qui ne retrouvaient pas leur contact.
insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine)
select 'equipe.absorbee', e.id, k.bubble_id, 'hors_referentiel'
from public.equipe e
join core.contact_client k on lower(k.email::text) = lower(e.email)
where e.email is not null
  and not exists (select 1 from core.contact_client c2 where c2.bubble_id = e.id)
on conflict (referentiel, libelle_miroir) do nothing;

update core.mandat m set contact_manager_id = k.id
from public.mandat o
join ref.correspondance c on c.referentiel='equipe.absorbee' and c.libelle_miroir=o.manager_id
join core.contact_client k on k.bubble_id = c.code_cible
where m.bubble_id = o.id and m.contact_manager_id is null and o.manager_id is not null;

update core.mandat m set contact_recruteur_id = k.id
from public.mandat o
join ref.correspondance c on c.referentiel='equipe.absorbee' and c.libelle_miroir=o.recruteur_id
join core.contact_client k on k.bubble_id = c.code_cible
where m.bubble_id = o.id and m.contact_recruteur_id is null and o.recruteur_id is not null;
