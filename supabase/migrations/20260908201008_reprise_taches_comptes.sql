-- =====================================================================
-- REPRISE 08 — LES TÂCHES, LES COMPTES ET LES ACCÈS
-- =====================================================================

-- ── core.tache — task avec task_notif REPLIÉ (cardinalité 1:1 mesurée)
insert into core.tache (
  id, bubble_id, texte, type_tache_id, est_faite, placement_id, echeance_le,
  assignee_collaborateur_id, creee_par_collaborateur_id, maj_par_collaborateur_id,
  notif_envoyee, notif_apercu, notif_email, notif_texte, notif_envoyee_le, notif_bubble_id,
  cree_le, maj_le)
select reprise.uid(t.id), t.id, t.task_text, tt.id, coalesce(t.is_complete,false),
       (select p.id from core.placement p where p.id = reprise.uid(t.mandatclose_id)),
       t.due_date,
       (select c.id from core.collaborateur c where c.id = reprise.uid(t.assigned_user_id)),
       (select c.id from core.collaborateur c where c.id = reprise.uid(t.creation_user_id)),
       (select c.id from core.collaborateur c where c.id = reprise.uid(t.update_user_id)),
       coalesce(tn.is_sent,false), tn.preview_text, tn.sent_email, tn.sent_text,
       case when coalesce(tn.is_sent,false) then coalesce(tn.wf_date, tn.updated_at, tn.created_at) end,
       tn.id,
       coalesce(t.creation_date, t.created_at, now()), coalesce(t.updated_at, now())
from public.task t
left join ref.type_tache tt on tt.code = t.task_type
left join public.task_notif tn on tn.task_id = t.id
on conflict (id) do nothing;

select reprise.noter('08','core.tache',(select count(*) from public.task),
  (select count(*) from core.tache),
  (select count(*) from public.task_notif where task_id is null),
  'task_notif replié ; les notifications orphelines (task_id nul) sont perdues, perte déclarée');

-- ---------------------------------------------------------------------
-- app.compte et app.acces — CONSTRUITS, pas repris.
--
-- Le miroir n'a pas de notion de compte séparée de la personne : c'est
-- toute la Décision 4. On la construit ici.
--
-- UN COMPTE PAR UTILISATEUR BUBBLE qui a une casquette identifiable, et
-- UN ACCÈS PAR CASQUETTE. auth_id reste NULL : les comptes sont
-- PRÉ-PROVISIONNÉS, l'identité d'authentification arrivera à la première
-- connexion. Mesuré : public.user.auth_id est vide sur les 4 605 lignes.
-- ---------------------------------------------------------------------

create temporary table t_casquette as
select u.id as user_id,
       (select c.id from core.collaborateur c where c.id = reprise.uid(u.id))        as collaborateur_id,
       (select f.id from core.fiche_talent  f where f.id = reprise.uid(u.candidat_id)) as fiche_talent_id,
       -- ⚠ LE LIEN UTILISATEUR → CONTACT CLIENT EST IRRECONSTITUABLE.
       -- Le détail prévoyait de le rebâtir « par l'e-mail ». Or MESURÉ :
       -- les 18 colonnes de public.user n'en comportent AUCUNE. Un premier
       -- essai rattachait un contact quelconque de la bonne entreprise —
       -- tous les utilisateurs d'un même client visaient alors la même
       -- personne, et l'unicité de l'accès en écartait 187, laissant autant
       -- de comptes n'ouvrant sur rien.
       -- Aucun rattachement n'est donc fait : il se rétablira à la première
       -- connexion, par l'e-mail que porte auth.users.
       null::uuid                                                                    as contact_client_id,
       (select r.role from public.user_role r
         where r.user_id = u.id
           and r.role in ('Admin','Recruiter Core Team','Recruiter Support Crew') limit 1) as role_interne_src
from public."user" u;

-- DÉDOUBLONNAGE : deux utilisateurs Bubble pointent le même candidat.
-- Une personne, un compte — le second n'en reçoit pas, sans quoi il
-- resterait un compte n'ouvrant sur rien, ce que le modèle interdira.
create temporary table t_compte as
select distinct on (coalesce(k.fiche_talent_id::text, k.collaborateur_id::text, k.user_id))
       k.user_id, k.collaborateur_id, k.fiche_talent_id, k.contact_client_id, k.role_interne_src
from t_casquette k
where num_nonnulls(k.collaborateur_id, k.fiche_talent_id, k.contact_client_id) >= 1
order by coalesce(k.fiche_talent_id::text, k.collaborateur_id::text, k.user_id), k.user_id;

insert into app.compte (id, actif, cree_le, maj_le)
select reprise.uid('compte#'||k.user_id), true, now(), now()
from t_compte k
on conflict (id) do nothing;

select reprise.noter('08','app.compte',
  (select count(*) from t_compte),
  (select count(*) from app.compte), 0,
  'auth_id NULL : comptes PRÉ-PROVISIONNÉS, l''authentification arrive à la première connexion');

-- Un accès par casquette. La contrainte exige EXACTEMENT une personne
-- par ligne : trois insertions distinctes, pas une seule.
insert into app.acces (compte_id, collaborateur_id, role_interne, actif, cree_le, maj_le)
select reprise.uid('compte#'||k.user_id), k.collaborateur_id,
       (case k.role_interne_src
          when 'Admin' then 'admin'
          when 'Recruiter Core Team' then 'recruteur'
          when 'Recruiter Support Crew' then 'support'
          else 'recruteur' end)::app.role_interne,
       true, now(), now()
from t_compte k
join app.compte c on c.id = reprise.uid('compte#'||k.user_id)
where k.collaborateur_id is not null
on conflict do nothing;

insert into app.acces (compte_id, fiche_talent_id, actif, cree_le, maj_le)
select reprise.uid('compte#'||k.user_id), k.fiche_talent_id, true, now(), now()
from t_compte k
join app.compte c on c.id = reprise.uid('compte#'||k.user_id)
where k.fiche_talent_id is not null
on conflict do nothing;

insert into app.acces (compte_id, contact_client_id, actif, cree_le, maj_le)
select reprise.uid('compte#'||k.user_id), k.contact_client_id, true, now(), now()
from t_compte k
join app.compte c on c.id = reprise.uid('compte#'||k.user_id)
where k.contact_client_id is not null and k.fiche_talent_id is null
on conflict do nothing;

select reprise.noter('08','app.acces', null, (select count(*) from app.acces), 0,
  format('%s internes · %s talents · 0 contact — le lien utilisateur→contact est irreconstituable, il se rétablira à la connexion',
    (select count(*) from app.acces where collaborateur_id is not null),
    (select count(*) from app.acces where fiche_talent_id is not null)));

-- Contrôle : un compte sans accès n'ouvre sur rien. Le modèle l'interdira
-- par un déclencheur, posé APRÈS la reprise. Ici on vérifie qu'il n'y en a
-- aucun avant de le poser.
select reprise.noter('08','comptes sans accès', 0,
  (select count(*) from app.compte c where not exists (select 1 from app.acces a where a.compte_id=c.id)),
  0, 'doit valoir 0 : sinon le déclencheur compte_a_un_acces échouera');

-- Les 344 utilisateurs rattachés à une entreprise, dont l'accès portail
-- entreprise devra être recréé à la connexion.
insert into reprise.quarantaine (cible, bubble_id, motif, donnees)
select 'app.acces', u.id,
       'utilisateur rattaché à une entreprise sans contact identifiable — accès portail entreprise à recréer à la première connexion, par l''e-mail de auth.users',
       jsonb_build_object('entreprise_bubble_id', u.entreprise_id)
from public."user" u
where u.entreprise_id is not null and u.candidat_id is null
  and not exists (select 1 from core.collaborateur c where c.id = reprise.uid(u.id))
on conflict do nothing;
