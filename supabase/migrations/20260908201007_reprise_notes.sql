-- =====================================================================
-- REPRISE 07 — LES NOTES
--
-- La pièce la plus délicate. Trois traitements se superposent.
--
-- 1. LA FUSION. public.note et public.note_archivee ne partagent AUCUN
--    identifiant : l'archivage crée une ligne neuve. Rapprochées par leur
--    CONTENU (cible, commentaire, date, auteur), elles ont ~5 060
--    empreintes communes. Sans ce rapprochement on créerait 5 060 doublons.
--
-- 2. L'AUTEUR. Mesuré sur 50 452 notes : 67,8 % d'un interne, 31,4 % d'un
--    candidat, 23 d'un contact. Deux clés étrangères nullables résolvent
--    99,25 % ; le reste garde son identifiant Bubble.
--
-- 3. L'ANCRAGE. Les notes portant candidat + entreprise + mandat sont la
--    signature d'une candidature : 98,1 % se résolvent contre process et
--    migrent sur candidature_id, les trois clés brutes laissées à NULL.
-- =====================================================================

create temporary table t_note as
select n.id, n.commentaire, n.date_note, n.note_automatique, n.candidat_id,
       n.entreprise_id, n.mandat_id, n.mandatclose_id, n.note_event,
       n.note_event_value_prev, n.note_event_value_new, n.user_id,
       n.created_at, n.updated_at, false as archivee,
       md5(coalesce(n.candidat_id,'')||'|'||coalesce(n.entreprise_id,'')||'|'||
           coalesce(n.mandat_id,'')||'|'||coalesce(n.mandatclose_id,'')||'|'||
           coalesce(n.commentaire,'')||'|'||coalesce(n.date_note::text,'')||'|'||
           coalesce(n.user_id,'')) as empreinte
from public.note n
union all
select a.id, a.commentaire, a.date_note, a.note_automatique, a.candidat_id,
       a.entreprise_id, a.mandat_id, a.mandatclose_id, null, null, null, a.user_id,
       a.created_at, a.updated_at, true,
       md5(coalesce(a.candidat_id,'')||'|'||coalesce(a.entreprise_id,'')||'|'||
           coalesce(a.mandat_id,'')||'|'||coalesce(a.mandatclose_id,'')||'|'||
           coalesce(a.commentaire,'')||'|'||coalesce(a.date_note::text,'')||'|'||
           coalesce(a.user_id,''))
from public.note_archivee a;

create index on t_note (empreinte);

-- Une seule ligne par empreinte : la courante gagne, l'archivée ne sert
-- qu'à dater l'archivage quand elle est seule.
create temporary table t_note_fusion as
select distinct on (empreinte) *
from t_note order by empreinte, archivee;   -- false avant true

-- Les internes, pour départager les auteurs.
create temporary table t_interne as
select distinct user_id id from public.user_role
 where role in ('Admin','Recruiter Core Team','Recruiter Support Crew');

insert into core.note (
  id, bubble_id, fiche_talent_id, entreprise_id, mandat_id, placement_id, candidature_id,
  commentaire, evenement_id, valeur_avant, valeur_apres, est_automatique,
  auteur_collaborateur_id, auteur_fiche_talent_id, auteur_bubble_id,
  ecrite_le, archivee_le, cree_le, maj_le)
select
  reprise.uid(n.id), n.id,
  -- l'ancrage : si le triple résout une candidature, les clés brutes s'effacent
  case when cd.id is null then (select f.id from core.fiche_talent f where f.id = reprise.uid(n.candidat_id)) end,
  case when cd.id is null then (select e.id from core.entreprise   e where e.id = reprise.uid(n.entreprise_id)) end,
  case when cd.id is null then (select m.id from core.mandat       m where m.id = reprise.uid(n.mandat_id)) end,
  (select p.id from core.placement p where p.id = reprise.uid(n.mandatclose_id)),
  cd.id,
  n.commentaire,
  ev.id, n.note_event_value_prev, n.note_event_value_new,
  coalesce(n.note_automatique, false),
  -- l'auteur : interne, sinon talent, sinon repli textuel
  case when n.user_id in (select id from t_interne)
       then (select c.id from core.collaborateur c where c.id = reprise.uid(n.user_id)) end,
  case when n.user_id is not null and n.user_id not in (select id from t_interne)
       then (select f.id from core.fiche_talent f
              where f.id = reprise.uid((select u.candidat_id from public."user" u where u.id = n.user_id))) end,
  case when n.user_id is not null
        and n.user_id not in (select id from t_interne)
        and not exists (select 1 from public."user" u join core.fiche_talent f
                          on f.id = reprise.uid(u.candidat_id) where u.id = n.user_id)
       then n.user_id end,
  n.date_note,
  case when n.archivee then coalesce(n.updated_at, n.created_at) end,
  coalesce(n.created_at, now()), coalesce(n.updated_at, now())
from t_note_fusion n
left join ref.evenement_note ev on ev.code = n.note_event
left join core.candidature cd
       on n.candidat_id is not null and n.mandat_id is not null and n.entreprise_id is not null
      and cd.id = (select c.id from core.candidature c
                    where c.fiche_talent_id = reprise.uid(n.candidat_id)
                      and c.mandat_id       = reprise.uid(n.mandat_id) limit 1)
on conflict (id) do nothing;

select reprise.noter('07','core.note',
  (select count(*) from t_note_fusion),
  (select count(*) from core.note),
  (select count(*) from t_note) - (select count(*) from t_note_fusion),
  format('%s lignes sources fondues en %s notes par leur empreinte de contenu',
         (select count(*) from t_note), (select count(*) from t_note_fusion)));

-- ── les colonnes qualitatives de la fiche deviennent des notes typées
insert into core.note (id, fiche_talent_id, commentaire, est_automatique, ecrite_le, cree_le, maj_le)
select reprise.uid(c.id || '#' || src.champ), reprise.uid(c.id),
       src.valeur, false, coalesce(c.updated_at, c.created_at),
       coalesce(c.created_at, now()), coalesce(c.updated_at, now())
from public.candidat c
join core.fiche_talent f on f.id = reprise.uid(c.id)
cross join lateral (values
    ('pachamama_like',        c.pachamama_like),
    ('pachamama_personnalite',c.pachamama_personnalite),
    ('note_interne',          c.note_interne)) as src(champ, valeur)
where nullif(trim(coalesce(src.valeur,'')),'') is not null
on conflict (id) do nothing;

insert into core.note (id, fiche_talent_id, commentaire, est_automatique, ecrite_le, cree_le, maj_le)
select reprise.uid(x.id || '#' || src.champ), reprise.uid(x.candidat_id),
       src.valeur, false, coalesce(x.updated_at, x.created_at),
       coalesce(x.created_at, now()), coalesce(x.updated_at, now())
from public.candidat_expanded x
join core.fiche_talent f on f.id = reprise.uid(x.candidat_id)
cross join lateral (values
    ('perso',  x.perso),
    ('note_1', x.note_1),
    ('note_2', x.note_2)) as src(champ, valeur)
where nullif(trim(coalesce(src.valeur,'')),'') is not null
on conflict (id) do nothing;

select reprise.noter('07','core.note (colonnes qualitatives de la fiche)',
  (select (select count(*) from public.candidat where nullif(trim(coalesce(pachamama_like,'')),'') is not null)
        + (select count(*) from public.candidat where nullif(trim(coalesce(pachamama_personnalite,'')),'') is not null)
        + (select count(*) from public.candidat where nullif(trim(coalesce(note_interne,'')),'') is not null)
        + (select count(*) from public.candidat_expanded where nullif(trim(coalesce(perso,'')),'') is not null)
        + (select count(*) from public.candidat_expanded where nullif(trim(coalesce(note_1,'')),'') is not null)
        + (select count(*) from public.candidat_expanded where nullif(trim(coalesce(note_2,'')),'') is not null)),
  (select count(*) from core.note where bubble_id is null), 0,
  'appréciations qualitatives sorties de la fiche vers le journal métier');

-- ---------------------------------------------------------------------
-- ⚠ AVERTISSEMENT DE MISE AU POINT, à lire avant de conclure sur les
-- chiffres obtenus en développement.
--
-- L'anonymisation VIDE toute la prose : commentaire, pachamama_like,
-- note_interne, perso, note_1, note_2 sont à zéro dans la base de dev.
-- Deux conséquences.
--
-- 1. L'empreinte de fusion perd son composant le plus discriminant. En
--    dev, deux notes qui ne différaient que par leur texte se fondent ;
--    en production elles resteront distinctes. Le compte de dev est donc
--    un PLANCHER : mesuré sur la production le 28/08, les empreintes
--    communes étaient 5 060, contre 5 322 ici. La production produira
--    ~260 notes de plus.
--
-- 2. Les notes issues des colonnes qualitatives donnent 0 en dev. En
--    production elles en produisent 4 834 — mesuré : pachamama_like 503,
--    pachamama_personnalite 742, note_interne 135, perso 2 152,
--    note_1 459, note_2 843.
--
-- Le script est correct ; ce sont les DONNÉES de mise au point qui sont
-- muettes. Ne pas conclure d'un écart de volume entre dev et production
-- que la reprise a dysfonctionné.
-- ---------------------------------------------------------------------

select reprise.noter('07','AVERTISSEMENT prose anonymisée', 4834, 0, 0,
  'en dev toute la prose est vide : les notes qualitatives donnent 0 et la fusion sur-fusionne d''environ 260. Attendu en production : ~4 834 notes qualitatives et ~5 060 fusions.');
