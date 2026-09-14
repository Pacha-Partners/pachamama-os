-- ═══════════════════════════════════════════════════════════════════════════
-- Ce que le client lit vraiment d'un candidat, et son propre compte.
--
-- Quatre défauts mesurés sur le portail livré, tous visibles à l'écran :
--
--  1. `expertises` REVIENT VIDE au client. `api.candidat_presente` la calcule
--     par une sous-requête sur `core.fiche_talent_expertise` — et il n'existe
--     AUCUNE policy client sur ce satellite. La vue étant `security_invoker`,
--     la sous-requête rend zéro ligne. Mesuré : la clé de service lit
--     `['Data']`, le jeton client lit `null`. C'est encore le mode d'échec de
--     D-12 : une lecture fermée par RLS ne lève pas d'erreur, elle rend vide.
--
--  2. `poste_actuel_employeur` AFFICHE UN IDENTIFIANT BUBBLE.
--     Mesuré sur les 7 023 fiches actives : 1 298 portent un employeur, dont
--     **873 (67 %) de la forme `1694609297157x182158973721116670`**. Le client
--     lit donc cela à la place d'un nom d'entreprise. La colonne
--     `poste_actuel_entreprise_id` existe à côté, prévue pour ça.
--
--  3. `niveau_anglais` sort en CODE BRUT (`courant_quotidien`). `ref.libelle`
--     porte le domaine `niveau_anglais` et personne ne le joignait.
--
--  4. `api.mandat_client.en_cours` COMPTE PLUS QUE `presentes`. « 5 dont 8 en
--     cours », « 9 dont 11 en cours » : `en_cours` comptait toutes les
--     candidatures non-KO, y compris celles d'amont que le client ne voit pas,
--     alors que `presentes` ne compte que les visibles. Un sous-total plus
--     grand que son total.
--
-- Et une demande : l'utilisateur connecté doit voir son nom et pouvoir
-- corriger ses informations. Rien ne l'exposait.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- 1. RÉPARER L'EMPLOYEUR — la donnée d'abord, l'affichage ensuite
-- ═══════════════════════════════════════════════════════════════════════
-- Le texte contient l'identifiant Bubble d'une entreprise que `core.entreprise`
-- connaît déjà par son `bubble_id`. On rattache et on écrit le nom : masquer un
-- identifiant à l'affichage laisserait la donnée fausse pour le prochain lecteur.
do $$
declare v_reparables integer; v_restants integer;
begin
  select count(*) into v_reparables
    from core.fiche_talent f
    join core.entreprise e on e.bubble_id = f.poste_actuel_employeur
   where f.poste_actuel_employeur ~ '^\d{13}x\d{15,}$';

  update core.fiche_talent f
     set poste_actuel_entreprise_id = coalesce(f.poste_actuel_entreprise_id, e.id),
         poste_actuel_employeur     = e.nom
    from core.entreprise e
   where e.bubble_id = f.poste_actuel_employeur
     and f.poste_actuel_employeur ~ '^\d{13}x\d{15,}$';

  select count(*) into v_restants
    from core.fiche_talent
   where poste_actuel_employeur ~ '^\d{13}x\d{15,}$';

  raise notice 'employeurs rattachés : % · identifiants Bubble restants (entreprise inconnue) : %',
    v_reparables, v_restants;
end $$;

-- Ceux qui restent ne correspondent à aucune entreprise connue : la vue ne les
-- montrera pas. Un identifiant n'est pas un nom, et mieux vaut un blanc.

-- ═══════════════════════════════════════════════════════════════════════
-- 2. LES SATELLITES QUE LE CLIENT A LE DROIT DE LIRE
-- ═══════════════════════════════════════════════════════════════════════
-- Même motif DEFINER que `api.mes_talents_presentes()` : rompre le cycle de
-- policies, pas élargir un droit. On réutilise la fonction existante.
--
-- ⚠ `core.fiche_talent_tag` reste EXCLU, comme il l'est déjà pour le talent
-- lui-même : un tag est un acte du cabinet, pas un fait sur la personne.
do $$
declare r record;
begin
  for r in
    select unnest(array[
      'fiche_talent_expertise', 'fiche_talent_secteur_xp', 'fiche_talent_secteur_vise',
      'fiche_talent_background', 'fiche_talent_profil', 'fiche_talent_produit_xp',
      'fiche_talent_contrat_souhaite', 'fiche_talent_remote_souhaite', 'fiche_talent_critere'
    ]) as t
  loop
    execute format('drop policy if exists client_satellites_presentes on core.%I', r.t);
    execute format(
      'create policy client_satellites_presentes on core.%I for select to authenticated
         using (fiche_talent_id in (select api.mes_talents_presentes()))', r.t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. LA FICHE, ENRICHIE
-- ═══════════════════════════════════════════════════════════════════════
-- La demande est explicite : « il faudrait que l'on puisse voir plus de détails
-- sur cette fiche, c'est important pour l'entreprise ». Ce qui entre est
-- FACTUEL — un fait sur le parcours, pas un jugement du cabinet.
--
-- Ce qui reste fermé, et ne bougera pas :
--   · les MOYENS DE CONTACT — e-mail, téléphone, LinkedIn. On joint quelqu'un
--     par le cabinet, c'est le métier.
--   · `grande_ecole` — un marqueur de tri social, pas un fait utile.
--   · `poste_actuel_raison_depart` — ce que le candidat a confié au cabinet
--     sur son départ ne lui appartient plus s'il part chez le client.
--   · `est_qualifie`, `mindset`, `statut_relation`, `emoji_statut`,
--     `agent_referent`, `score_completude`, `resume_ia` — la qualification.
--   · les six colonnes de jugement de `core.candidature`.
create or replace view api.candidat_presente with (security_invoker = true) as
select c.id                       as candidature_id,
       c.mandat_id,
       c.reference_pseudonyme,
       c.argumentaire_client,
       ep.emoji || ' ' || ep.libelle_client as etape,
       ep.code            as etape_code,
       ep.ordre           as etape_ordre,
       ep.couleur_pastille as etape_couleur,
       ep.est_ko, ep.est_terminale,
       c.date_entree_pipeline, c.date_dernier_changement_etape,
       c.date_prochaine_echeance, c.presente_le,
       f.prenom,
       f.localisation_texte,
       f.niveau_anglais::text  as niveau_anglais,
       -- L'employeur : le nom rattaché d'abord, le texte ensuite, et JAMAIS un
       -- identifiant Bubble — 873 fiches en portaient un, et ceux qui ne
       -- correspondent à aucune entreprise connue laissent un blanc. Mieux vaut
       -- un blanc qu'un identifiant : un blanc se lit « on ne sait pas ».
       coalesce(
         emp.nom,
         case when f.poste_actuel_employeur ~ '^\d{13}x\d{15,}$' then null
              else nullif(btrim(f.poste_actuel_employeur), '') end
       ) as poste_actuel_employeur,
       mt.libelle_fr as metier_actuel,
       u.libelle_fr  as univers,
       (select array_agg(x.libelle_fr order by x.libelle_fr)
          from core.fiche_talent_expertise fe
          join ref.expertise x on x.id = fe.expertise_id
         where fe.fiche_talent_id = f.id) as expertises,
       f.attentes_salaire_min_ke, f.attentes_salaire_max_ke,
       f.attentes_tjm_min_eur, f.attentes_tjm_max_eur,
       f.attentes_disponibilite_texte,
       f.cv_url, f.photo_url,
       f.nom,
       -- ── ce que cette migration ajoute ────────────────────────────────
       f.portfolio_url,
       f.seniorite,
       f.ecole,
       f.debut_vie_professionnelle,
       -- Les années d'expérience, calculées : c'est le chiffre que le
       -- recruteur du client cherche, et personne ne le stocke.
       case when f.debut_vie_professionnelle is not null
            then greatest(0, extract(year from age(current_date, f.debut_vie_professionnelle))::integer)
       end as annees_experience,
       f.poste_actuel_depuis_le,
       f.poste_actuel_contrat::text as poste_actuel_contrat,
       lang.libelles->>'fr' as niveau_anglais_libelle,
       amt.libelle_fr as attentes_metier,
       aun.libelle_fr as attentes_univers,
       f.attentes_localisation_texte,
       f.attentes_description,
       (select array_agg(s.libelle_fr order by s.libelle_fr)
          from core.fiche_talent_secteur_xp sx
          join ref.secteur s on s.id = sx.secteur_id
         where sx.fiche_talent_id = f.id) as secteurs_experience,
       (select array_agg(s.libelle_fr order by s.libelle_fr)
          from core.fiche_talent_secteur_vise sv
          join ref.secteur s on s.id = sv.secteur_id
         where sv.fiche_talent_id = f.id) as secteurs_vises,
       (select array_agg(coalesce(lb.libelles->>'fr', b.background::text) order by b.background)
          from core.fiche_talent_background b
          left join ref.libelle lb
                 on lb.domaine = 'background_talent' and lb.code = b.background::text
         where b.fiche_talent_id = f.id) as parcours_type,
       (select array_agg(coalesce(lp.libelles->>'fr', p.profil::text) order by p.profil)
          from core.fiche_talent_profil p
          left join ref.libelle lp
                 on lp.domaine = 'profil_talent' and lp.code = p.profil::text
         where p.fiche_talent_id = f.id) as profils,
       (select array_agg(coalesce(lx.libelles->>'fr', px.type_produit::text) order by px.type_produit)
          from core.fiche_talent_produit_xp px
          left join ref.libelle lx
                 on lx.domaine = 'type_produit_xp' and lx.code = px.type_produit::text
         where px.fiche_talent_id = f.id) as produits_connus,
       (select array_agg(coalesce(lc.libelles->>'fr', ct.contrat::text) order by ct.contrat)
          from core.fiche_talent_contrat_souhaite ct
          left join ref.libelle lc
                 on lc.domaine = 'type_contrat' and lc.code = ct.contrat::text
         where ct.fiche_talent_id = f.id) as contrats_souhaites,
       (select array_agg(coalesce(lr.libelles->>'fr', rs.remote::text) order by rs.remote)
          from core.fiche_talent_remote_souhaite rs
          left join ref.libelle lr
                 on lr.domaine = 'rythme_remote' and lr.code = rs.remote::text
         where rs.fiche_talent_id = f.id) as remotes_souhaites,
       (select array_agg(cr.libelle_fr order by cr.ordre)
          from core.fiche_talent_critere fc
          join ref.critere cr on cr.id = fc.critere_id
         where fc.fiche_talent_id = f.id) as criteres
from core.candidature c
join ref.etape_process ep on ep.id = c.etape_id
left join core.fiche_talent f on f.id = c.fiche_talent_id
left join ref.metier  mt on mt.id = f.poste_actuel_metier_id
left join ref.univers u  on u.id  = f.univers_id
left join core.entreprise emp on emp.id = f.poste_actuel_entreprise_id
left join ref.metier  amt on amt.id = f.attentes_metier_id
left join ref.univers aun on aun.id = f.attentes_univers_id
left join ref.libelle lang on lang.domaine = 'niveau_anglais'
                          and lang.code = f.niveau_anglais::text
where ep.visible_client
  and ((select api.est_service())
       or (api.a_portail('entreprise') and c.entreprise_id in (select api.mes_entreprises())));

comment on view api.candidat_presente is
  'Le profil d''un candidat PRÉSENTÉ : identité, parcours, expertises, secteurs, attentes. Tout y est FACTUEL. Jamais les moyens de contact — on joint quelqu''un par le cabinet. Jamais la qualification du cabinet, jamais grande_ecole, jamais la raison de départ, jamais les six colonnes de jugement de la candidature.';

-- ═══════════════════════════════════════════════════════════════════════
-- 4. DES COMPTEURS QUI DISENT LA MÊME VÉRITÉ
-- ═══════════════════════════════════════════════════════════════════════
-- `en_cours` devient un sous-ensemble de `presentes` : visible du client, ni
-- écarté ni abouti. Le compteur du cabinet (toutes candidatures non-KO) n'a
-- rien à faire dans une vue client — il l'informait d'un travail qu'il ne voit
-- pas, avec un nombre qu'il ne pouvait pas rapprocher.
create or replace view api.mandat_client with (security_invoker = true) as
select m.id,
       coalesce(p.libelle_public, m.titre) as intitule,
       m.statut::text,
       u.libelle_fr as univers, mt.libelle_fr as metier, m.contrat::text,
       m.salaire_min_ke, m.salaire_max_ke, m.tjm_min_eur, m.tjm_max_eur,
       m.localisation, m.kickoff_le, m.cree_le, m.est_anonyme,
       (p.id is not null) as est_publie,
       -- `candidatures` et `presentes` comptent désormais le MÊME ensemble.
       -- Le doublon est conservé parce que les écrans livrés lisent les deux ;
       -- il n'y a plus qu'une vérité derrière.
       (select count(*) from core.candidature c join ref.etape_process x on x.id = c.etape_id
         where c.mandat_id = m.id and x.visible_client) as candidatures,
       (select count(*) from core.candidature c join ref.etape_process x on x.id = c.etape_id
         where c.mandat_id = m.id and x.visible_client
           and not x.est_ko and not x.est_terminale) as en_cours,
       (select count(*) from core.candidature c join ref.etape_process x on x.id = c.etape_id
         where c.mandat_id = m.id and x.visible_client) as presentes,
       k.prenom || ' ' || k.nom as agent_nom, k.photo_url as agent_photo,
       k.fonction::text as agent_fonction
from core.mandat m
left join ref.univers u on u.id = m.univers_id
left join ref.metier mt on mt.id = m.metier_id
left join app.mandat_publication p
       on p.mandat_id = m.id and p.retire_le is null and p.canal = 'job_board_public'
left join core.entreprise e on e.id = m.entreprise_id
left join core.collaborateur k on k.id = coalesce(m.account_manager_id, e.account_manager_id)
where (select api.est_service())
   or (api.a_portail('entreprise') and m.entreprise_id in (select api.mes_entreprises()));

comment on view api.mandat_client is
  'Les mandats de MON entreprise. Les trois compteurs parlent du MÊME ensemble — les candidatures visibles du client : `presentes` le total, `en_cours` celles qui vivent encore. Un compteur du cabinet n''a rien à faire ici : il annonçait un travail invisible avec un nombre qu''on ne pouvait pas rapprocher.';

-- ═══════════════════════════════════════════════════════════════════════
-- 5. MON COMPTE — qui je suis, et ce que je peux corriger
-- ═══════════════════════════════════════════════════════════════════════
create or replace function api.mon_contact_client() returns uuid
language sql stable security definer set search_path = '' as $$
  select a.contact_client_id
    from app.acces a
   where a.compte_id = api.compte_id()
     and a.actif
     and a.portail = 'entreprise'
     and a.contact_client_id is not null
   limit 1;
$$;
revoke execute on function api.mon_contact_client() from public, anon;
grant  execute on function api.mon_contact_client() to authenticated, service_role;
comment on function api.mon_contact_client() is
  'La personne derrière le compte, côté client. DEFINER parce que app.acces n''ouvre au compte que sa propre ligne et que la policy de core.contact_client la rappellerait.';

create or replace view api.mon_compte with (security_invoker = true) as
select ct.id,
       ct.prenom, ct.nom, ct.email::text as email,
       ct.description, ct.photo_url,
       mt.code       as metier_code,
       mt.libelle_fr as metier,
       ct.est_referent_entreprise,
       e.nom         as entreprise,
       e.id          as entreprise_id
from core.contact_client ct
left join ref.metier mt on mt.id = ct.metier_id
left join core.entreprise e on e.id = ct.entreprise_id
where ct.id = api.mon_contact_client();

comment on view api.mon_compte is
  'L''utilisateur connecté, côté client. L''adresse est en LECTURE : c''est l''identité d''authentification, la changer est un autre acte que corriger son nom.';

grant select on api.mon_compte to authenticated, service_role;

-- La policy de lecture existe déjà (`client_ses_contacts`). Il manque l'écriture.
drop policy if exists client_maj_son_contact on core.contact_client;
create policy client_maj_son_contact on core.contact_client
  for update to authenticated
  using (id = api.mon_contact_client())
  with check (id = api.mon_contact_client());

comment on policy client_maj_son_contact on core.contact_client is
  'On corrige SA fiche, pas celle de ses collègues. Les colonnes autorisées sont bornées par GRANT UPDATE, une policy ne filtrant jamais les colonnes.';

-- Liste blanche par colonne. `email` n'y est pas : c'est l'identité
-- d'authentification. `est_referent_entreprise`, `actif` et `entreprise_id`
-- non plus : ce sont des décisions du cabinet.
grant update (prenom, nom, description, photo_url, metier_id)
  on core.contact_client to authenticated;

create or replace function api.maj_mon_compte(
  p_prenom          text default null,
  p_nom             text default null,
  p_description     text default null,
  p_photo_url       text default null,
  p_metier_code     text default null,
  p_cle_idempotence text default null
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_ct      uuid := api.mon_contact_client();
  v_compte  uuid := api.compte_id();
  v_metier  uuid;
  v_rejeu   jsonb;
  v_lot     uuid;
  v_avant   jsonb;
  v_apres   jsonb;
  v_n       integer;
  v_res     jsonb;
begin
  if v_compte is null then
    raise exception 'aucun compte : la modification exige une session ouverte' using errcode = '42501';
  end if;
  if v_ct is null then
    raise exception 'ce compte n''est rattaché à aucune fiche de contact' using errcode = '42501';
  end if;

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence, 'maj_mon_compte');
  if v_rejeu is not null then return v_rejeu; end if;

  -- Le prénom et le nom sont les deux seules valeurs dont l'absence casse
  -- l'affichage : on les exige non vides plutôt que d'écrire un blanc.
  if btrim(coalesce(p_prenom, '')) = '' or btrim(coalesce(p_nom, '')) = '' then
    raise exception 'le prénom et le nom sont attendus' using errcode = '22023';
  end if;

  if p_metier_code is not null then
    select id into v_metier from ref.metier where code = p_metier_code and actif;
    if v_metier is null then
      raise exception 'métier inconnu : « % »', p_metier_code using errcode = '22023';
    end if;
  end if;

  select to_jsonb(x) into v_avant
    from (select prenom, nom, description, photo_url, metier_id
            from core.contact_client where id = v_ct) x;

  update core.contact_client
     set prenom      = btrim(p_prenom),
         nom         = btrim(p_nom),
         description = nullif(btrim(coalesce(p_description, '')), ''),
         photo_url   = nullif(btrim(coalesce(p_photo_url, '')), ''),
         metier_id   = v_metier
   where id = v_ct;

  if not found then
    raise exception 'fiche de contact introuvable ou fermée' using errcode = '42501';
  end if;

  select to_jsonb(x) into v_apres
    from (select prenom, nom, description, photo_url, metier_id
            from core.contact_client where id = v_ct) x;

  v_lot := gen_random_uuid();
  v_n := app.journaliser_diff(v_lot, 'core.contact_client', v_ct, v_avant, v_apres);

  v_res := jsonb_build_object('contact_client_id', v_ct, 'champs_modifies', v_n, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_res);
  return v_res;
end $$;

revoke execute on function api.maj_mon_compte(text,text,text,text,text,text) from public, anon;
grant  execute on function api.maj_mon_compte(text,text,text,text,text,text) to authenticated;

comment on function api.maj_mon_compte(text,text,text,text,text,text) is
  'Corriger ses propres informations. Cinq colonnes, liste blanche. L''adresse n''en fait pas partie : elle est l''identité d''authentification.';

notify pgrst, 'reload schema';
