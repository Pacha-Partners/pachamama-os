-- =====================================================================
-- RAFRAÎCHIR LES COPIES D'IDENTITÉ DE `core` — 08/09/2026
--
-- POURQUOI. `core` n'est pas une vue : la reprise (20260908201001 à
-- 20260908201008) y a MATÉRIALISÉ des copies de ce que porte le miroir
-- `public`. Aucun déclencheur ne relie les deux — mesuré : zéro trigger sur
-- `public` et `pivot`. Restaurer les vraies valeurs dans le miroir laisse donc
-- `core` — et tout ce que l'application lit à travers lui — sur les valeurs
-- fictives du peupleur. La carte « Agent.e Pachamama » de la fiche d'offre
-- affichait encore « Loïc Pelletier » là où la production dit autre chose.
--
-- CE QUE FAIT CETTE MIGRATION, ET CE QU'ELLE NE FAIT PAS. Uniquement des
-- `update` sur des lignes existantes, jointes par `bubble_id` (ou par
-- `reprise.uid`, qui est déterministe). Aucune insertion, aucune suppression :
-- les mandats, les candidatures et les placements ne sont pas reconstruits, et
-- la reprise n'est pas rejouée. Chaque expression est reprise TELLE QUELLE du
-- script de reprise correspondant, y compris ses `coalesce`, ses traductions
-- de référentiel et ses règles de fusion — recopier la donnée sans recopier la
-- règle produirait un `core` qui ne dit plus la même chose que sa source.
--
-- Chaque `update` est gardé par un `is distinct from` : les lignes déjà justes
-- ne sont pas réécrites, la migration est donc idempotente et son compte de
-- lignes touchées est une mesure, pas une estimation.
--
-- SUR LE LIVE. Cette migration y serait un quasi non-opérant : les valeurs de
-- `core` y viennent déjà du vrai miroir. Elle y rafraîchirait au plus les
-- lignes que la synchro a modifiées dans `public` depuis la reprise, ce qui est
-- le comportement voulu de toute façon.
--
-- CE QUI N'EST PAS TRAITÉ ICI, ET POURQUOI — trois écarts mesurés, déclarés
-- plutôt que corrigés en passant, parce que chacun est une INSERTION, pas un
-- rafraîchissement, et relève d'une décision distincte :
--
--  1. `core.note` : les blocs 2 et 3 de la reprise 07 fabriquent des notes
--     typées depuis `candidat.pachamama_like / pachamama_personnalite /
--     note_interne` et `candidat_expanded.perso / note_1 / note_2`. Ces six
--     colonnes étaient VIDÉES : la reprise n'a créé aucune de ces lignes dans
--     le dev. Elles n'existeront qu'en rejouant ces deux blocs.
--  2. `core.note`, encore : le dédoublonnage entre `note` et `note_archivee`
--     se fait sur une empreinte md5 dont `commentaire` est un composant. Elle
--     a été calculée sur des commentaires vides ; la fusion du dev est donc
--     plus agressive que celle du réel. Seul un rejeu du bloc 1 ajouterait les
--     lignes indûment fondues.
--  3. `core.contact_client` : les 790 lignes de `public.equipe` ont été
--     repliées sur 524 contacts en groupant par `lower(email)`. Les courriels
--     de substitution étant une fonction déterministe du réel, le groupement
--     est identique ; mais les lignes absorbées n'ont pas de `bubble_id` et ne
--     sont donc pas rafraîchies — elles n'existent pas comme lignes.
-- =====================================================================

-- ── core.collaborateur ← public."user" ───────────────────────────────
-- La source de `api.offre_detail.agent_nom` et `agent_photo`.
-- `email` n'est pas repris : `public."user"` n'a pas de colonne courriel,
-- l'adresse vit dans `auth.users`. Restaurer le miroir n'y change rien.
update core.collaborateur c
   set nom = u.nom, prenom = u.prenom, photo_url = u.photo_url
  from public."user" u
 where u.id = c.bubble_id
   and (c.nom, c.prenom, c.photo_url) is distinct from (u.nom, u.prenom, u.photo_url);

-- ── core.contact_client ← public.equipe ──────────────────────────────
-- La source de `api.offre_detail.manager_nom` (abrégé « Prénom I. » DANS la
-- vue) et `manager_photo`.
--
-- COLLISION MESURÉE, ET CE QU'ELLE RÉVÈLE. Un index unique porte sur
-- `(email, entreprise_id)`, et `email` est un `citext` — donc insensible à la
-- casse. Le repliage de la reprise 02 groupe les 790 lignes d'`equipe` par
-- `lower(email)`, mais il a tourné sur les courriels SUBSTITUÉS, et
-- `substituts.email()` hache la valeur BRUTE : « Cory.chaplin@… » et
-- « cory.chaplin@… » ont reçu deux substituts distincts et sont restés deux
-- contacts, là où le réel n'en aurait fait qu'un. Deux groupes sont dans ce cas,
-- soit deux lignes en trop sur 524 — un artefact de la pseudonymisation, que la
-- restauration ne fait que révéler.
--
-- Les fondre serait une SUPPRESSION, hors du périmètre d'un rafraîchissement.
-- Le courriel va donc à la ligne la plus ancienne du groupe — celle que la
-- reprise aurait retenue — et le doublon garde nom, prénom et photo, sans
-- courriel. Il reste identifiable, et le contrôle plus bas le compte.
with source as (
  select k.id, k.entreprise_id, e.nom, e.prenom, e.description, e.photo_url,
         nullif(e.email, '')::extensions.citext as email, e.created_at
    from core.contact_client k
    join public.equipe e on e.id = k.bubble_id
), retenu as (
  select distinct on (lower(email::text), entreprise_id) id
    from source
   where email is not null and entreprise_id is not null
   order by lower(email::text), entreprise_id, created_at nulls last, id
), cible as (
  select s.id, s.nom, s.prenom, s.description, s.photo_url,
         case when s.entreprise_id is null or s.id in (select id from retenu)
              then s.email end as email
    from source s
   -- 20 contacts n'ont, dans le miroir, ni nom, ni prénom, ni courriel. La
   -- contrainte `contact_identifiable` est posée NOT VALID : ces lignes ont pu
   -- être insérées, mais toute mise à jour les ferait échouer. Elles n'ont de
   -- toute façon aucune identité à restaurer — seule une description, sur une
   -- seule d'entre elles, resterait vide. On les laisse, et on les compte.
   where s.nom is not null or s.prenom is not null or s.email is not null
)
update core.contact_client k
   set nom = c.nom, prenom = c.prenom, email = c.email,
       description = c.description, photo_url = c.photo_url
  from cible c
 where c.id = k.id
   and (k.nom, k.prenom, k.email, k.description, k.photo_url)
       is distinct from (c.nom, c.prenom, c.email, c.description, c.photo_url);

-- ── core.apporteur_affaires ← public.business_maker ──────────────────
-- `nom_affichage` est une CONCATÉNATION avec repli, pas une copie : la
-- recalculer, sans quoi elle garderait le couple substitué.
update core.apporteur_affaires a
   set raison_sociale = b.company_label,
       siret          = b.siret,
       email_contact  = b.email,
       nom_affichage  = coalesce(
         nullif(trim(coalesce(b.prenom, '') || ' ' || coalesce(b.nom, '')), ''),
         b.company_label, '(apporteur sans identité au miroir)')
  from public.business_maker b
 where b.id = a.bubble_id
   and (a.raison_sociale, a.siret, a.email_contact, a.nom_affichage)
       is distinct from (
         b.company_label, b.siret, b.email,
         coalesce(nullif(trim(coalesce(b.prenom, '') || ' ' || coalesce(b.nom, '')), ''),
                  b.company_label, '(apporteur sans identité au miroir)'));

-- ── core.entreprise ← public.entreprise ──────────────────────────────
-- `fondateur` est publié par `api.offre_detail.entreprise_fondateur`.
-- `recommandation` passe par le référentiel : un libellé absent de
-- `ref.correspondance` deviendrait NULL en silence — c'est mesuré plus bas.
update core.entreprise ce
   set fondateur         = e.fondateur,
       siret             = e.siret,
       note_interne      = e.note,
       email_facturation = e.email_facturation,
       recommandation    = reprise.code('ref_form_42', e.recommandation)::ref.form_provenance
  from public.entreprise e
 where e.id = ce.bubble_id
   and (ce.fondateur, ce.siret, ce.note_interne, ce.email_facturation, ce.recommandation)
       is distinct from (
         e.fondateur, e.siret, e.note, e.email_facturation,
         reprise.code('ref_form_42', e.recommandation)::ref.form_provenance);

-- ── core.fiche_talent ← candidat (+ expanded, job_actuel, job_reve) ──
-- Les deux règles de fusion de la reprise 03 sont reprises intactes :
-- l'expanded gagne sur `portfolio`, et les montants vont au plus récent des
-- deux `updated_at` entre `candidat` et `job_reve`, normalisés en K€.
-- Seul `update` sans garde `is distinct from` : vingt-deux expressions, dont
-- quatre `case` de fusion, écrites deux fois seraient deux fois une occasion de
-- diverger. Le résultat reste idempotent, seule la réécriture ne l'est pas, et
-- elle porte sur 7 023 lignes.
update core.fiche_talent f
   set prenom                           = c.prenom,
       nom                              = c.nom,
       genre                            = reprise.code('ref_gender', c.genre)::ref.genre,
       photo_url                        = c.photo_url,
       -- `fiche_email_arobase` exige un « @ » ailleurs qu'en tête. Deux fiches
       -- de production portent une URL LinkedIn dans `email_perso` : la
       -- contrainte avait été validée sur des courriels de substitution, tous
       -- bien formés, et le réel la met en défaut. Elles sont laissées vides et
       -- comptées plus bas plutôt que de bloquer les 7 021 autres.
       email_personnel                  =
         case when position('@' in coalesce(c.email_perso, '')) > 1
              then nullif(c.email_perso, '') end,
       telephone                        = c.telephone,
       url_linkedin                     = c.linkedin,
       localisation_texte               = c.localisations_filtre,
       localisations_brut_json          = c.localisations,
       cv_url                           = c.cv_url,
       portfolio_url                    = coalesce(x.portfolio, c.portfolio),
       portfolio_fichier_url            = c.portfolio_file_url,
       ecole                            = x.ecole,
       grande_ecole                     = c.grandes_ecoles,
       poste_actuel_employeur           = ja.entreprise_nom,
       poste_actuel_entreprise_id       =
         (select en.id from core.entreprise en where en.id = reprise.uid(ja.entreprise_id)),
       poste_actuel_raison_depart       = ja.pourquoi,
       attentes_infos_salaire           = jr.infos_salaire,
       attentes_localisation_texte      = jr.info_localisation,
       attentes_localisations_brut_json = jr.localisations,
       attentes_description             = jr.description,
       attentes_salaire_min_ke =
         case when jr.salaire is null then reprise.ke(c.salaire_min_souhait)
              when c.salaire_min_souhait is null then reprise.ke(jr.salaire)
              when coalesce(c.updated_at, '-infinity'::timestamptz)
                 > coalesce(jr.updated_at, '-infinity'::timestamptz)
                   then reprise.ke(c.salaire_min_souhait)
              else reprise.ke(jr.salaire) end,
       attentes_salaire_max_ke =
         case when jr.salaire_maximum is null then reprise.ke(c.salaire_max_souhait)
              when c.salaire_max_souhait is null then reprise.ke(jr.salaire_maximum)
              when coalesce(c.updated_at, '-infinity'::timestamptz)
                 > coalesce(jr.updated_at, '-infinity'::timestamptz)
                   then reprise.ke(c.salaire_max_souhait)
              else reprise.ke(jr.salaire_maximum) end,
       attentes_tjm_min_eur =
         case when jr.tjm_minimum is null then c.tjm_min_souhait
              when c.tjm_min_souhait is null then jr.tjm_minimum
              when coalesce(c.updated_at, '-infinity'::timestamptz)
                 > coalesce(jr.updated_at, '-infinity'::timestamptz)
                   then c.tjm_min_souhait
              else jr.tjm_minimum end,
       attentes_tjm_max_eur =
         case when jr.tjm_maximum is null then c.tjm_max_souhait
              when c.tjm_max_souhait is null then jr.tjm_maximum
              when coalesce(c.updated_at, '-infinity'::timestamptz)
                 > coalesce(jr.updated_at, '-infinity'::timestamptz)
                   then c.tjm_max_souhait
              else jr.tjm_maximum end
  from public.candidat c
  left join public.candidat_expanded x on x.candidat_id = c.id
  left join public.job_actuel       ja on ja.candidat_id = c.id
  left join public.job_reve         jr on jr.candidat_id = c.id
 where c.id = f.bubble_id;

-- ── core.candidature ← public.process ────────────────────────────────
update core.candidature k
   set compte_rendu              = p.description,
       appreciation_like         = p.pachamama_like,
       appreciation_personnalite = p.pachamama_personnalite,
       points_forts              = p.plus_par_rapport_mission,
       points_faibles            = p.moins_par_rapport_mission,
       infos_remuneration        = p.infos_remuneration,
       salaire_min_ke            = reprise.ke(p.salaire_minimum),
       salaire_souhaite_ke       = reprise.ke(p.salaire_souhaite),
       tjm_min_eur               = p.tjm_minimum,
       tjm_souhaite_eur          = p.tjm_souhaite
  from public.process p
 where p.id = k.bubble_id
   and (k.compte_rendu, k.appreciation_like, k.appreciation_personnalite,
        k.points_forts, k.points_faibles, k.infos_remuneration,
        k.salaire_min_ke, k.salaire_souhaite_ke, k.tjm_min_eur, k.tjm_souhaite_eur)
       is distinct from (
        p.description, p.pachamama_like, p.pachamama_personnalite,
        p.plus_par_rapport_mission, p.moins_par_rapport_mission, p.infos_remuneration,
        reprise.ke(p.salaire_minimum), reprise.ke(p.salaire_souhaite),
        p.tjm_minimum, p.tjm_souhaite);

-- ── core.note ← public.note ∪ public.note_archivee ───────────────────
-- Les notes issues des blocs 2 et 3 de la reprise 07 portent `bubble_id` NULL :
-- la jointure les laisse tranquilles, ce qui est voulu.
update core.note cn
   set commentaire  = s.commentaire,
       valeur_avant = s.valeur_avant,
       valeur_apres = s.valeur_apres
  from (
    select id, commentaire,
           note_event_value_prev as valeur_avant,
           note_event_value_new  as valeur_apres
      from public.note
    union all
    select id, commentaire, null, null from public.note_archivee
  ) s
 where s.id = cn.bubble_id
   and (cn.commentaire, cn.valeur_avant, cn.valeur_apres)
       is distinct from (s.commentaire, s.valeur_avant, s.valeur_apres);

-- ── core.enquete_nps ← public.nps_tracking ───────────────────────────
-- Pas de `bubble_id` ici : `nps_tracking.id` est un uuid natif, la reprise
-- l'a passé par `reprise.uid(... ::text)`. On refait le même calcul.
update core.enquete_nps q
   set contact_email       = n.contact_email::extensions.citext,
       contact_prenom      = n.contact_firstname,
       prenom_talent_envoye = n.candidate_firstname
  from public.nps_tracking n
 where q.id = reprise.uid(n.id::text)
   and (q.contact_email, q.contact_prenom, q.prenom_talent_envoye)
       is distinct from (n.contact_email::extensions.citext,
                         n.contact_firstname, n.candidate_firstname);

-- ── core.tache ← public.task (+ task_notif replié) ───────────────────
update core.tache t
   set texte        = pt.task_text,
       notif_apercu = tn.preview_text,
       notif_email  = tn.sent_email,
       notif_texte  = tn.sent_text
  from public.task pt
  left join public.task_notif tn on tn.task_id = pt.id
 where pt.id = t.bubble_id
   and (t.texte, t.notif_apercu, t.notif_email, t.notif_texte)
       is distinct from (pt.task_text, tn.preview_text, tn.sent_email, tn.sent_text);

-- ── core.analyse ← public.analyse ────────────────────────────────────
-- `contenu` est NOT NULL : la reprise remplace l'absence par un littéral. Sans
-- ce rafraîchissement, les 501 analyses vidées resteraient figées dessus.
update core.analyse ca
   set contenu = coalesce(a.description, '(sans contenu)')
  from public.analyse a
 where a.id = ca.bubble_id
   and ca.contenu is distinct from coalesce(a.description, '(sans contenu)');

-- =====================================================================
-- CONTRÔLES — ce qui reste faux se compte, sinon il se cache.
-- =====================================================================

-- Aucun substitut du peupleur ne doit survivre dans les copies de `core`.
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'restauration', 'core — substituts « exemple.test » restants', 0,
       (select count(*) from core.collaborateur where photo_url like '%exemple.test%')
     + (select count(*) from core.contact_client
         where photo_url like '%exemple.test%' or email::text like '%exemple.test%')
     + (select count(*) from core.apporteur_affaires where email_contact like '%exemple.test%')
     + (select count(*) from core.fiche_talent
         where photo_url like '%exemple.test%' or cv_url like '%exemple.test%'
            or email_personnel like '%exemple.test%'
            or portfolio_fichier_url like '%exemple.test%')
     + (select count(*) from core.enquete_nps where contact_email::text like '%exemple.test%'),
       0,
       'un reste > 0 désigne des lignes que la restauration n''a pas pu apparier (créées ou supprimées depuis la capture)';

-- Les contacts que le repliage aurait dû fondre, et qui restent en double.
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'restauration', 'core.contact_client — doublons révélés par la restauration',
       0, count(*), count(*),
       'même courriel réel (à la casse près) et même entreprise : le repliage de la reprise 02 avait groupé sur les courriels substitués. Le doublon garde nom et prénom, son courriel est laissé nul.'
  from (
    select 1 from core.contact_client k
     where k.email is null and k.entreprise_id is not null
       and exists (select 1 from public.equipe e
                    where e.id = k.bubble_id and nullif(e.email, '') is not null)
  ) d;

-- Les contacts sans aucune identité au miroir, écartés du rafraîchissement.
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'restauration', 'core.contact_client — sans identité au miroir', 0, 0, count(*),
       'ni nom, ni prénom, ni courriel dans public.equipe : la contrainte contact_identifiable (NOT VALID) interdit de les mettre à jour. Rien à restaurer sur elles.'
  from core.contact_client k
  join public.equipe e on e.id = k.bubble_id
 where e.nom is null and e.prenom is null and nullif(e.email, '') is null;

-- Les courriels de talent que la contrainte de format refuse.
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'restauration', 'core.fiche_talent.email_personnel refusé au format', 0, 0, count(*),
       'email_perso du miroir sans « @ » (une URL LinkedIn, mesuré) : fiche_email_arobase le refuse, la fiche est restaurée sans son courriel'
  from public.candidat c
 where nullif(c.email_perso, '') is not null
   and position('@' in c.email_perso) <= 1;

-- `recommandation` passe par un référentiel : ce qui n'y est pas devient NULL.
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'restauration', 'core.entreprise.recommandation non traduite', 0, count(*), count(*),
       'libellé présent dans le miroir mais absent de ref.correspondance (ref_form_42)'
  from public.entreprise e
  join core.entreprise ce on ce.bubble_id = e.id
 where e.recommandation is not null and ce.recommandation is null;

-- Idem pour le genre de la fiche talent.
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'restauration', 'core.fiche_talent.genre non traduit', 0, count(*), count(*),
       'libellé présent dans le miroir mais absent de ref.correspondance (ref_gender)'
  from public.candidat c
  join core.fiche_talent f on f.bubble_id = c.id
 where c.genre is not null and f.genre is null;

-- Les notes typées que la reprise n'a jamais pu créer, faute de source.
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'restauration', 'core.note — notes typées manquantes',
       (select count(*) from public.candidat
         where pachamama_like is not null or pachamama_personnalite is not null
            or note_interne is not null)
     + (select count(*) from public.candidat_expanded
         where perso is not null or note_1 is not null or note_2 is not null),
       (select count(*) from core.note where bubble_id is null), 0,
       'les blocs 2 et 3 de la reprise 07 n''ont rien produit : leurs sources étaient vidées. Les recréer est une INSERTION, hors du périmètre de ce rafraîchissement.';
