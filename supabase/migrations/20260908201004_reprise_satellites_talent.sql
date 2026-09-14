-- =====================================================================
-- REPRISE 04 — LES SATELLITES DE LA FICHE, ET UNE ANOMALIE SIGNALÉE
-- =====================================================================

-- ---------------------------------------------------------------------
-- SIGNALEMENT, pas correction. La normalisation en K€ laisse une
-- population de salaires entre 250 et 1000 dont la valeur trahit un TJM
-- saisi dans le champ salaire : 600, 650, 670, 700, 750 — exactement la
-- fourchette des taux journaliers mesurée ailleurs (400 à 1 360, médiane
-- 630). Diviser par mille donnerait 0,7 K€, tout aussi faux.
--
-- Ces lignes sont chargées TELLES QUELLES et mises en quarantaine pour
-- examen : c'est une erreur de saisie métier, pas une erreur d'unité, et
-- aucune règle automatique ne peut deviner l'intention.
-- ---------------------------------------------------------------------

insert into reprise.quarantaine (cible, bubble_id, motif, donnees)
select 'core.fiche_talent', f.bubble_id,
       'salaire annuel implausible — valeur dans la fourchette des TJM, probable saisie dans le mauvais champ',
       jsonb_build_object('salaire_min_ke', f.attentes_salaire_min_ke,
                          'salaire_max_ke', f.attentes_salaire_max_ke)
from core.fiche_talent f
where f.attentes_salaire_min_ke > 250 or f.attentes_salaire_max_ke > 250;

select reprise.noter('04','quarantaine salaires implausibles', null,
  (select count(*) from reprise.quarantaine where cible='core.fiche_talent'), 0,
  'chargés tels quels, signalés pour examen métier');

-- ── background : experience_background, source unique
insert into core.fiche_talent_background (fiche_talent_id, background, cree_le)
select reprise.uid(e.candidat_id),
       reprise.code('ref_background', eb.background)::ref.background_talent, now()
from public.experience_background eb
join public.experience e on e.id = eb.experience_id
join core.fiche_talent f on f.id = reprise.uid(e.candidat_id)
where reprise.code('ref_background', eb.background) is not null
on conflict do nothing;

-- ── profil : candidat_profile + experience_profile fusionnés
insert into core.fiche_talent_profil (fiche_talent_id, profil, bloc_legacy, cree_le)
select reprise.uid(cp.candidat_id), reprise.code('ref_profile', cp.profile)::ref.profil_talent, 'candidat', now()
from public.candidat_profile cp join core.fiche_talent f on f.id = reprise.uid(cp.candidat_id)
where reprise.code('ref_profile', cp.profile) is not null
on conflict do nothing;
insert into core.fiche_talent_profil (fiche_talent_id, profil, bloc_legacy, cree_le)
select reprise.uid(e.candidat_id), reprise.code('ref_profile', ep.profile)::ref.profil_talent, 'experience', now()
from public.experience_profile ep join public.experience e on e.id = ep.experience_id
join core.fiche_talent f on f.id = reprise.uid(e.candidat_id)
where reprise.code('ref_profile', ep.profile) is not null
on conflict do nothing;

-- ── expertise : candidat_expertise + experience_expertise
insert into core.fiche_talent_expertise (fiche_talent_id, expertise_id, bloc_legacy, cree_le)
select reprise.uid(ce.candidat_id), x.id, 'candidat', now()
from public.candidat_expertise ce join core.fiche_talent f on f.id = reprise.uid(ce.candidat_id)
join ref.expertise x on x.code = reprise.code('ref_expertise', ce.expertise)
on conflict do nothing;
insert into core.fiche_talent_expertise (fiche_talent_id, expertise_id, bloc_legacy, cree_le)
select reprise.uid(e.candidat_id), x.id, 'experience', now()
from public.experience_expertise xe join public.experience e on e.id = xe.experience_id
join core.fiche_talent f on f.id = reprise.uid(e.candidat_id)
join ref.expertise x on x.code = coalesce(reprise.code('ref_expertise', xe.expertise),
                                          reprise.code('donnees.expertise', xe.expertise))
on conflict do nothing;

-- ── secteurs : vécu, visé, no-go
insert into core.fiche_talent_secteur_xp (fiche_talent_id, secteur_id, bloc_legacy, cree_le)
select reprise.uid(e.candidat_id), s.id, 'experience', now()
from public.experience_secteur es join public.experience e on e.id = es.experience_id
join core.fiche_talent f on f.id = reprise.uid(e.candidat_id)
join ref.secteur s on s.code = reprise.code('ref_secteur', es.secteur)
on conflict do nothing;
insert into core.fiche_talent_secteur_vise (fiche_talent_id, secteur_id, cree_le)
select reprise.uid(j.candidat_id), s.id, now()
from public.job_reve_secteur js join public.job_reve j on j.id = js.job_reve_id
join core.fiche_talent f on f.id = reprise.uid(j.candidat_id)
join ref.secteur s on s.code = reprise.code('ref_secteur', js.secteur)
on conflict do nothing;
insert into core.fiche_talent_secteur_nogo (fiche_talent_id, secteur_id, cree_le)
select reprise.uid(j.candidat_id), s.id, now()
from public.job_reve_secteur_nogo jn join public.job_reve j on j.id = jn.job_reve_id
join core.fiche_talent f on f.id = reprise.uid(j.candidat_id)
join ref.secteur s on s.code = reprise.code('ref_secteur', jn.secteur)
on conflict do nothing;

-- ── critères, contrats, remote, produits
insert into core.fiche_talent_critere (fiche_talent_id, critere_id, cree_le)
select reprise.uid(j.candidat_id), c.id, now()
from public.job_reve_critere jc join public.job_reve j on j.id = jc.job_reve_id
join core.fiche_talent f on f.id = reprise.uid(j.candidat_id)
join ref.critere c on c.code = reprise.code('ref_criteres', jc.critere)
on conflict do nothing;

insert into core.fiche_talent_contrat_souhaite (fiche_talent_id, contrat, bloc_legacy, cree_le)
select reprise.uid(cc.candidat_id), reprise.code('ref_contrat', cc.contrat)::ref.type_contrat, 'candidat', now()
from public.candidat_contrat cc join core.fiche_talent f on f.id = reprise.uid(cc.candidat_id)
where reprise.code('ref_contrat', cc.contrat) is not null on conflict do nothing;
insert into core.fiche_talent_contrat_souhaite (fiche_talent_id, contrat, bloc_legacy, cree_le)
select reprise.uid(j.candidat_id), reprise.code('ref_contrat', jc.contrat)::ref.type_contrat, 'job_reve', now()
from public.job_reve_contrat jc join public.job_reve j on j.id = jc.job_reve_id
join core.fiche_talent f on f.id = reprise.uid(j.candidat_id)
where reprise.code('ref_contrat', jc.contrat) is not null on conflict do nothing;

insert into core.fiche_talent_remote_souhaite (fiche_talent_id, remote, bloc_legacy, cree_le)
select reprise.uid(cr.candidat_id), reprise.code('ref_remote', cr.remote)::ref.rythme_remote, 'candidat', now()
from public.candidat_remote cr join core.fiche_talent f on f.id = reprise.uid(cr.candidat_id)
where reprise.code('ref_remote', cr.remote) is not null on conflict do nothing;
insert into core.fiche_talent_remote_souhaite (fiche_talent_id, remote, bloc_legacy, cree_le)
select reprise.uid(j.candidat_id), reprise.code('ref_remote', jr.remote)::ref.rythme_remote, 'job_reve', now()
from public.job_reve_remote jr join public.job_reve j on j.id = jr.job_reve_id
join core.fiche_talent f on f.id = reprise.uid(j.candidat_id)
where reprise.code('ref_remote', jr.remote) is not null on conflict do nothing;

insert into core.fiche_talent_produit_xp (fiche_talent_id, type_produit, cree_le)
select reprise.uid(e.candidat_id), reprise.code('ref_product', ep.product)::ref.type_produit_xp, now()
from public.experience_product ep join public.experience e on e.id = ep.experience_id
join core.fiche_talent f on f.id = reprise.uid(e.candidat_id)
where reprise.code('ref_product', ep.product) is not null on conflict do nothing;

select reprise.noter('04','satellites de la fiche', null,
 (select (select count(*) from core.fiche_talent_background)+(select count(*) from core.fiche_talent_profil)
        +(select count(*) from core.fiche_talent_expertise)+(select count(*) from core.fiche_talent_secteur_xp)
        +(select count(*) from core.fiche_talent_secteur_vise)+(select count(*) from core.fiche_talent_secteur_nogo)
        +(select count(*) from core.fiche_talent_critere)+(select count(*) from core.fiche_talent_contrat_souhaite)
        +(select count(*) from core.fiche_talent_remote_souhaite)+(select count(*) from core.fiche_talent_produit_xp)),
 0, 'les doublons entre blocs candidat et experience sont fondus par la clé composite');
