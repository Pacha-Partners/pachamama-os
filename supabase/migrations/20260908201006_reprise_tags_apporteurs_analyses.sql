-- =====================================================================
-- REPRISE 06 — TAGS, APPORTEURS, ANALYSES, ET LES LIAISONS RESTANTES
-- =====================================================================

-- ── core.tag — 110, portée déduite de type_tag
insert into core.tag (id, bubble_id, libelle, description, portee_code,
                      entreprise_id, mandat_id, actif, cree_par_id, cree_le, maj_le)
select reprise.uid(t.id), t.id, coalesce(t.nom,'(sans libellé)'), t.description,
       case lower(coalesce(t.type_tag,''))
            when 'candidat'   then 'candidat'
            when 'entreprise' then 'entreprise'
            when 'job'        then 'job'
            else 'candidat' end,
       (select e.id from core.entreprise e where e.id = reprise.uid(t.entreprise_id)),
       (select m.id from core.mandat m where m.id = reprise.uid(t.mandat_id)),
       true,
       (select c.id from core.collaborateur c where c.id = reprise.uid(t.created_by)),
       coalesce(t.created_at, now()), coalesce(t.updated_at, now())
from public.tag t on conflict (id) do nothing;

select reprise.noter('06','core.tag',(select count(*) from public.tag),
  (select count(*) from core.tag), 0,
  'portée par défaut « candidat » quand type_tag est vide — à revoir avec le nettoyage de taxonomie');

-- ── core.fiche_talent_tag — 86 poses
insert into core.fiche_talent_tag (fiche_talent_id, tag_id, cree_le)
select reprise.uid(ct.candidat_id), reprise.uid(ct.tag_id), now()
from public.candidat_tag ct
join core.fiche_talent f on f.id = reprise.uid(ct.candidat_id)
join core.tag g on g.id = reprise.uid(ct.tag_id)
on conflict do nothing;

select reprise.noter('06','core.fiche_talent_tag',(select count(*) from public.candidat_tag),
  (select count(*) from core.fiche_talent_tag), 0, null);

-- ── core.apporteur_affaires — 20
--
-- LA REPRISE A EXPOSÉ UNE TENSION DE CONCEPTION, et voici comment elle
-- est résolue. La Décision 5 veut que l'apporteur ne recopie plus
-- l'identité : elle doit venir du talent, par talent_id. Mais talent_id
-- pointe core.talent, qui est la PROJECTION DU PIVOT — vide tant que le
-- connecteur n'a pas tourné. À la reprise, aucun lien d'identité n'est
-- donc établissable, et la contrainte « identifiable » rejette les 15
-- apporteurs qui sont pourtant des candidats connus.
--
-- Ce n'est pas propre à l'apporteur : collaborateur.talent_id et
-- contact_client.talent_id sont dans le même cas. Les CASQUETTES se
-- rattachent au talent, et le talent arrive après.
--
-- RÈGLE RETENUE : nom_affichage et email_contact sont renseignés pour
-- TOUS à la reprise — c'est la seule identité disponible, et une ligne
-- sans identité serait pire qu'une redondance temporaire. Le connecteur
-- pivot→app renseignera talent_id, et une passe de nettoyage videra
-- alors nom_affichage pour ceux qui sont des talents. La redondance est
-- datée et réversible, l'absence d'identité ne l'aurait pas été.
insert into core.apporteur_affaires (
  id, bubble_id, raison_sociale, siret, nom_affichage, email_contact,
  cree_par_collaborateur_id, cree_le, maj_le_source, maj_le)
select reprise.uid(b.id), b.id, b.company_label, b.siret,
       coalesce(nullif(trim(coalesce(b.prenom,'')||' '||coalesce(b.nom,'')),''),
                b.company_label, '(apporteur sans identité au miroir)'),
       b.email,
       (select c.id from core.collaborateur c where c.id = reprise.uid(b.created_by)),
       coalesce(b.created_at, now()), b.updated_at, now()
from public.business_maker b
on conflict (id) do nothing;

select reprise.noter('06','core.apporteur_affaires',(select count(*) from public.business_maker),
  (select count(*) from core.apporteur_affaires), 0,
  'nom_affichage renseigné pour tous : talent_id vient du pivot, pas de la reprise. Redondance temporaire à purger après le connecteur.');

-- Trace des apporteurs dont l'identité devra être effacée une fois le
-- talent rattaché : ceux qui sont déjà un candidat du miroir.
insert into reprise.quarantaine (cible, bubble_id, motif, donnees)
select 'core.apporteur_affaires', b.id,
       'identité recopiée temporairement — à effacer quand le connecteur aura renseigné talent_id',
       jsonb_build_object('candidat_bubble_id', b.candidat_id)
from public.business_maker b
where b.candidat_id is not null
  and exists (select 1 from core.fiche_talent f where f.id = reprise.uid(b.candidat_id));

-- ── le lien apporteur → fiche talent, dans le sens retenu par le modèle
update core.fiche_talent f
   set apporteur_affaires_id = reprise.uid(c.business_maker_id)
from public.candidat c
where f.bubble_id = c.id and c.business_maker_id is not null
  and exists (select 1 from core.apporteur_affaires a where a.id = reprise.uid(c.business_maker_id));

select reprise.noter('06','fiche_talent.apporteur_affaires_id',
  (select count(*) from public.candidat where business_maker_id is not null),
  (select count(*) from core.fiche_talent where apporteur_affaires_id is not null), 0, null);

-- ── core.analyse — 501
insert into core.analyse (id, bubble_id, mandat_id, contenu, niveau, auteur_id, cree_le, maj_le)
select reprise.uid(a.id), a.id,
       (select m.id from core.mandat m where m.id = reprise.uid(a.mandat_id)),
       coalesce(a.description,'(sans contenu)'),
       reprise.code('ref_niveau_analyse', a.niveau)::ref.niveau_analyse,
       (select c.id from core.collaborateur c where c.id = reprise.uid(a.created_by)),
       coalesce(a.created_at, now()), coalesce(a.updated_at, now())
from public.analyse a on conflict (id) do nothing;

select reprise.noter('06','core.analyse',(select count(*) from public.analyse),
  (select count(*) from core.analyse), 0, null);

-- ── core.placement_utilisateur — depuis le tableau note_user_ids
insert into core.placement_utilisateur (placement_id, utilisateur_id, cree_le)
select distinct reprise.uid(k.id), c.id, now()
from public.mandatclose k
-- note_user_ids est DÉJÀ un text[] dans le miroir, pas une chaîne à parser.
cross join lateral unnest(coalesce(k.note_user_ids, array[]::text[])) as u(uid)
join core.placement p on p.id = reprise.uid(k.id)
join core.collaborateur c on c.id = reprise.uid(u.uid)
on conflict do nothing;

select reprise.noter('06','core.placement_utilisateur',
  (select count(*) from public.mandatclose where coalesce(array_length(note_user_ids,1),0) > 0),
  (select count(distinct placement_id) from core.placement_utilisateur), 0,
  'un placement peut être suivi par plusieurs collaborateurs : le compte porte sur les placements couverts');

-- ── core.enquete_nps — 118
insert into core.enquete_nps (
  id, contact_client_id, contact_bubble_id_source, mandat_id, placement_id,
  cible_bubble_id_source, contact_email, contact_prenom, intitule_poste_envoye,
  raison_sociale_envoyee, prenom_talent_envoye, type_campagne_code, statut_code,
  envoye_le, relance_le, repondu_le, cree_le, maj_le)
-- nps_tracking.id est un uuid natif, pas un identifiant Bubble textuel.
select reprise.uid(n.id::text),
       (select c.id from core.contact_client c where c.bubble_id = n.bubble_contact_id),
       n.bubble_contact_id,
       (select m.id from core.mandat m where m.id = reprise.uid(n.bubble_mandat_id)),
       (select p.id from core.placement p where p.id = reprise.uid(n.bubble_mandat_id)),
       n.bubble_mandat_id,
       n.contact_email::extensions.citext, n.contact_firstname, n.job_title,
       n.company_name, n.candidate_firstname,
       case lower(coalesce(n.nps_type,'')) when 'close' then 'close' when 'termine' then 'termine' end,
       case lower(coalesce(n.status,'sent'))
            when 'sent' then 'sent' when 'reminded' then 'reminded'
            when 'responded' then 'responded' when 'ignored' then 'ignored' else 'sent' end,
       n.created_at, n.reminder_sent_at, n.responded_at,
       coalesce(n.created_at, now()), now()
from public.nps_tracking n on conflict (id) do nothing;

select reprise.noter('06','core.enquete_nps',(select count(*) from public.nps_tracking),
  (select count(*) from core.enquete_nps), 0,
  'la cible est un mandat OU un placement : bubble_mandat_id est polymorphe, résolu des deux côtés');
