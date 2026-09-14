-- =====================================================================
-- REPRISE 02 — LES CONTACTS CLIENTS
--
-- La Décision 6 scinde public.equipe en deux : la PERSONNE d'un côté, sa
-- PARTICIPATION à un mandat de l'autre. Le miroir mélangeait les deux, ce
-- qui obligeait à recréer une ligne par mandat pour la même personne.
--
-- MESURÉ sur les 764 lignes : 430 e-mails distincts, 92 lignes sans
-- e-mail, et seulement 2 e-mails apparaissant sous deux entreprises —
-- ces deux-là deviennent deux contacts, un par entreprise, ce que le
-- modèle prévoit explicitement.
--
-- CLÉ DE DÉDUPLICATION, corrigée après un premier essai. La clé
-- (entreprise, e-mail) semblait naturelle : elle est fausse. Une même
-- personne apparaît tantôt sur une ligne rattachée à un mandat, tantôt
-- sur une ligne qui n'en a pas — et l'entreprise vaut alors NULL. Cette
-- clé la dédoublait. Mesuré : 544 contacts au lieu des ~430 attendus.
--
-- La clé retenue est donc l'E-MAIL SEUL, avec une exception : quand un
-- même e-mail porte DEUX entreprises réellement différentes, on scinde
-- par entreprise. C'est le cas des 2 personnes qui interviennent pour
-- deux clients, que le modèle prévoit explicitement en deux contacts.
--
-- Une ligne sans e-mail n'est pas dédoublonnable et reste seule : deux
-- homonymes sans adresse ne peuvent pas être distingués, et les fondre
-- serait pire que de les garder en double.
-- =====================================================================

create temporary table t_contact as
with base as (
  select e.*, m.entreprise_id
  from public.equipe e left join public.mandat m on m.id = e.mandat_id
),
multi as (   -- les e-mails portant plus d'une entreprise réelle
  select lower(email) mail from base
  where email is not null and entreprise_id is not null
  group by 1 having count(distinct entreprise_id) > 1
),
cle as (
  select b.*,
         case when b.email is null then 'ligne|' || b.id
              when lower(b.email) in (select mail from multi)
                   then 'multi|' || lower(b.email) || '|' || coalesce(b.entreprise_id,'~')
              else 'mail|' || lower(b.email) end as cle
  from base b
),
canon as (   -- la ligne la plus ancienne représente le groupe…
  select distinct on (cle) cle, id, nom, prenom, email, description, photo_url,
         metier, univers, created_at, updated_at, created_by
  from cle order by cle, created_at nulls last, id
),
entreprise_du_groupe as (  -- …mais l'entreprise vient de n'importe quelle ligne qui en a une
  select cle, min(entreprise_id) entreprise_id from cle
  where entreprise_id is not null group by cle
)
select c.*, g.entreprise_id
from canon c left join entreprise_du_groupe g using (cle);

insert into core.contact_client (
  id, bubble_id, entreprise_id, nom, prenom, email, description, photo_url,
  metier_id, univers_id, est_referent_entreprise, actif, cree_par_id, cree_le, maj_le)
select reprise.uid(c.id), c.id,
       (select e.id from core.entreprise e where e.id = reprise.uid(c.entreprise_id)),
       c.nom, c.prenom, nullif(c.email,'')::extensions.citext, c.description, c.photo_url,
       mt.id, un.id,
       false, true,
       (select k.id from core.collaborateur k where k.id = reprise.uid(c.created_by)),
       coalesce(c.created_at, now()), coalesce(c.updated_at, now())
from t_contact c
left join ref.metier  mt on mt.code = reprise.code('ref_metier',  c.metier)
left join ref.univers un on un.code = reprise.code('ref_univers', c.univers)
on conflict (id) do nothing;

select reprise.noter('02','core.contact_client',
  (select count(*) from t_contact),
  (select count(*) from core.contact_client), 0,
  format('%s lignes equipe repliées sur %s personnes',
         (select count(*) from public.equipe), (select count(*) from core.contact_client)));

-- ---------------------------------------------------------------------
-- La provenance des lignes ABSORBÉES, que bubble_id ne peut pas porter :
-- il n'y a qu'une colonne pour plusieurs identifiants d'origine. Elles
-- sont enregistrées dans la correspondance, qui est faite pour ça.
-- ---------------------------------------------------------------------

insert into ref.correspondance (referentiel, libelle_miroir, code_cible, origine)
select 'equipe.absorbee', e.id, c.bubble_id, 'hors_referentiel'
from public.equipe e
join public.mandat m on m.id = e.mandat_id
join core.contact_client c
  on c.entreprise_id = reprise.uid(m.entreprise_id)
 and lower(c.email::text) = lower(e.email)
where e.email is not null and c.bubble_id <> e.id
on conflict (referentiel, libelle_miroir) do nothing;

select reprise.noter('02','ref.correspondance (equipe absorbées)',
  (select count(*) from public.equipe) - (select count(*) from core.contact_client),
  (select count(*) from ref.correspondance where referentiel='equipe.absorbee'), 0,
  'la provenance des lignes fondues, que bubble_id ne peut pas porter seule');
