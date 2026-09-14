-- ═══════════════════════════════════════════════════════════════════════════
-- REFERMER LE TROU DE `talent_maj_sa_fiche`, ET OUVRIR L'ÉCRITURE DU TALENT
-- SUR CE QU'IL DÉCLARE DE LUI — RIEN DE PLUS.
--
-- ── LA MESURE, AVANT D'ÉCRIRE (13/09, projet dev xavnvkpgbpczblmwlaxk) ──
--
-- Le brief annonce « révoque l'UPDATE global de authenticated sur
-- core.fiche_talent ». IL N'Y EN A PAS. Mesuré trois fois, de trois façons :
--
--   1. `pg_class.relacl` de core.fiche_talent :
--        postgres=arwdDxtm/postgres | authenticated=r/postgres | service_role=arwdDxtm/postgres
--      → `authenticated` porte `r` (SELECT) et RIEN d'autre.
--   2. `has_table_privilege('authenticated','core.fiche_talent','update')` = false ;
--      0 colonne sur 81 passe `has_column_privilege(... ,'update')`.
--   3. Un vrai PATCH, avec le jeton du compte talent de test :
--        PATCH core/fiche_talent            → 406 PGRST106 « Invalid schema: core »
--        PATCH api/ma_fiche {est_qualifie}  → 400 PGRST204 (colonne non projetée)
--        PATCH api/ma_fiche?id=eq.<moi>     → 500 55000 « not automatically updatable »
--
-- LE TROU N'EST DONC PAS OUVERT : IL EST ARMÉ. `talent_maj_sa_fiche` est une
-- policy `for update` posée sur une table où `authenticated` n'a aucun droit
-- d'update — elle est inerte, comme les 25 policies `interne_ecriture` que la
-- migration 20260912104000 a déjà constatées inertes pour la même raison.
--
-- Ce qui le déclenche est PRÉCISÉMENT ce que cette phase doit faire :
-- `api.maj_ma_fiche` est en SECURITY INVOKER (ADR 0005), donc elle n'écrit
-- qu'avec les droits de l'appelant, donc il FAUT un GRANT UPDATE. Le geste
-- naturel — `grant update on core.fiche_talent to authenticated` — arme la
-- policy sur les 81 colonnes d'un coup, `est_qualifie`, `statut_relation`,
-- `agent_referent_id` et `seniorite` comprises. C'est le motif n°1 de
-- l'ADR 0005, et c'est le geste que cette migration rend impossible.
--
-- ── LES TROIS ÉTAGES ────────────────────────────────────────────────────
--   1. la POLICY choisit des LIGNES  — `talent_maj_sa_fiche`, déjà là ;
--   2. le GRANT par colonne choisit des COLONNES — ci-dessous, 34 colonnes
--      sur 81, jamais au niveau de la table ;
--   3. un DÉCLENCHEUR de frontière refuse, à l'exécution, toute colonne hors
--      liste blanche. Il survit à un `grant update on … to authenticated`
--      posé par mégarde un jour de dépannage.
--
-- Pourquoi trois et pas deux : sur ce projet, l'anonymat d'une offre a fui
-- deux fois (D-12), et la conclusion écrite était « une seule barrière ne
-- suffit pas ». Le trou dont il est question ici est de la même famille.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- 1. core.fiche_talent — 34 colonnes déclaratives, et pas une de plus
-- ═══════════════════════════════════════════════════════════════════════
-- La policy existe déjà et choisit la bonne ligne. On la repose à l'identique
-- pour que ce fichier soit lisible seul, sans avoir à remonter au J2.
drop policy if exists talent_maj_sa_fiche on core.fiche_talent;
create policy talent_maj_sa_fiche on core.fiche_talent
  for update to authenticated
  using      (id = (select api.ma_fiche_talent()))
  with check (id = (select api.ma_fiche_talent()));

comment on policy talent_maj_sa_fiche on core.fiche_talent is
  'Choisit LA ligne du talent. Ne choisit AUCUNE colonne — une policy ne sait pas le faire. Les colonnes sont tenues par le GRANT ci-dessous et par le déclencheur core.frontiere_declarative_fiche_talent.';

-- ── Identité et coordonnées, telles que la personne les déclare ────────
grant update (prenom, nom, email_personnel, telephone, url_linkedin,
              localisation_texte, photo_url, cv_url, portfolio_url,
              cv_depose_le,
              prenom_origine, nom_origine, email_origine, telephone_origine,
              url_linkedin_origine, localisation_origine, photo_origine,
              cv_origine, portfolio_origine)
  on core.fiche_talent to authenticated;

-- ── Ce qu'elle cherche ─────────────────────────────────────────────────
grant update (attentes_metier_id, attentes_univers_id,
              attentes_salaire_min_ke, attentes_salaire_max_ke,
              attentes_tjm_min_eur, attentes_tjm_max_eur,
              attentes_disponibilite_texte, attentes_localisation_texte,
              attentes_description, recherche_active, attentes_origine)
  on core.fiche_talent to authenticated;

-- ── Sa présence dans le vivier, et son consentement ────────────────────
grant update (actif, consentement_donne_le, confirme_sans_changement_le,
              modifie_par_le_talent_le)
  on core.fiche_talent to authenticated;

-- HORS LISTE, ET C'EST TOUT L'OBJET DE CETTE MIGRATION :
--   est_qualifie, statut_relation, agent_referent_id, seniorite, mindset,
--   emoji_statut, score_completude, champs_manquants, fiche_complete,
--   resume_ia, parse_par_ia_le, source_import, apporteur_affaires_id,
--   univers_id, niveau_anglais, ecole, grande_ecole, appetence_early_stage,
--   debut_vie_professionnelle, les 8 colonnes poste_actuel_*, genre,
--   date_dernier_contact, anonymise_le, fusionnee_vers_fiche_id, talent_id,
--   bubble_id, les 3 colonnes cree_par_*, synchro_*, cree_le, maj_le.
-- Ce sont, dans l'ordre : la qualification que le cabinet porte SUR la
-- personne, les valeurs calculées, l'identifiant de synchronisation, et
-- l'horodatage tenu par le déclencheur fiche_talent_maj_le.
--
-- `niveau_anglais` est hors liste alors qu'il est déclaratif : le brief ne le
-- fait porter par aucune fonction de ce lot. Fermé par défaut, à ouvrir le
-- jour où un écran le demande — c'est le sens de marche de D-06.

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Les six listes déclaratives — et `fiche_talent_tag` qui n'en est pas
-- ═══════════════════════════════════════════════════════════════════════
-- La policy `talent_ses_satellites` (for all, fiche_talent_id = la sienne)
-- est déjà posée sur les 11 satellites. Elle est inerte pour la même raison
-- que la précédente : aucun droit d'écriture derrière. On en ouvre SIX.
--
-- `origine` est accordée parce que la fonction y écrit 'declare' : c'est ce
-- qui distinguera plus tard un secteur choisi par la personne d'un secteur
-- déduit par un import.

grant insert (fiche_talent_id, secteur_id, origine) on core.fiche_talent_secteur_vise     to authenticated;
grant insert (fiche_talent_id, secteur_id, origine, motif) on core.fiche_talent_secteur_nogo to authenticated;
grant insert (fiche_talent_id, critere_id, origine) on core.fiche_talent_critere           to authenticated;
grant insert (fiche_talent_id, contrat,    origine) on core.fiche_talent_contrat_souhaite  to authenticated;
grant insert (fiche_talent_id, remote,     origine) on core.fiche_talent_remote_souhaite   to authenticated;
grant insert (fiche_talent_id, expertise_id, origine) on core.fiche_talent_expertise       to authenticated;

-- DELETE n'a pas de granularité par colonne : c'est un droit de table. La
-- policy `talent_ses_satellites` borne les lignes à celles de la personne.
grant delete on core.fiche_talent_secteur_vise,
                core.fiche_talent_secteur_nogo,
                core.fiche_talent_critere,
                core.fiche_talent_contrat_souhaite,
                core.fiche_talent_remote_souhaite,
                core.fiche_talent_expertise
  to authenticated;

-- ⚠ `core.fiche_talent_tag` NE REÇOIT RIEN. Un tag est un acte du cabinet :
-- il porte `pose_par_compte_id`, et la policy `talent_ses_satellites` ne le
-- couvre déjà pas. Les quatre autres satellites — background, profil,
-- produit_xp, secteur_xp — restent également fermés : ce lot ne leur donne
-- aucun écran, et un droit sans usage est un droit à révoquer plus tard.

-- ═══════════════════════════════════════════════════════════════════════
-- 3. core.fiche_talent_poste — la frise, saisie neuve
-- ═══════════════════════════════════════════════════════════════════════
-- 0 ligne en base, aucune source : `public.experience` du miroir n'était pas
-- une liste de postes. Tout ce qui entrera ici sera saisi par la personne.
grant insert (fiche_talent_id, intitule, entreprise_nom, debut_le, fin_le,
              en_cours, description, ordre, origine)
  on core.fiche_talent_poste to authenticated;
grant update (intitule, entreprise_nom, debut_le, fin_le,
              en_cours, description, ordre)
  on core.fiche_talent_poste to authenticated;
grant delete on core.fiche_talent_poste to authenticated;
-- HORS LISTE : `entreprise_id`. Rattacher un poste à une `core.entreprise`
-- réelle est un rapprochement du cabinet, pas une saisie de formulaire ;
-- 851 entreprises dont 303 doublons dormants attendent d'ailleurs ce
-- rapprochement. `entreprise_nom` porte le texte libre en attendant.

-- ═══════════════════════════════════════════════════════════════════════
-- 4. core.candidature — postuler, et se retirer
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists talent_cree_sa_candidature on core.candidature;
create policy talent_cree_sa_candidature on core.candidature
  for insert to authenticated
  with check (
        fiche_talent_id          = (select api.ma_fiche_talent())
    and cree_par_fiche_talent_id = (select api.ma_fiche_talent())
        -- `candidature_un_seul_createur` l'exige déjà ; on le dit ici aussi
        -- pour que la policy se lise sans aller chercher la contrainte.
    and cree_par_id is null
        -- Une candidature entre TOUJOURS à `applicant`. Personne ne se
        -- pousse soi-même au send-out.
    and etape_id = (select ep.id from ref.etape_process ep where ep.code = 'applicant')
    and presente_le is null
    and retire_par_talent_le is null
        -- Les six colonnes de jugement et l'argumentaire naissent vides :
        -- elles appartiennent au cabinet.
    and compte_rendu is null and appreciation_like is null
    and appreciation_personnalite is null and points_forts is null
    and points_faibles is null and infos_remuneration is null
    and argumentaire_client is null);

comment on policy talent_cree_sa_candidature on core.candidature is
  'Un talent crée SA candidature, à l''étape applicant, vierge de tout jugement. entreprise_id n''est pas accordée : le déclencheur core.candidature_entreprise_du_mandat la déduit du mandat.';

drop policy if exists talent_retire_sa_candidature on core.candidature;
create policy talent_retire_sa_candidature on core.candidature
  for update to authenticated
  using      (fiche_talent_id = (select api.ma_fiche_talent()))
  with check (fiche_talent_id = (select api.ma_fiche_talent())
              -- La seule modification qu'un talent puisse faire sur sa
              -- candidature est de la retirer. Il ne se fait pas passer en
              -- entretien final, et il ne revient pas en arrière.
              and etape_id = (select ep.id from ref.etape_process ep
                               where ep.code = 'ko_by_candidat')
              and retire_par_talent_le is not null);

grant insert (fiche_talent_id, mandat_id, etape_id, est_spontanee,
              cree_par_fiche_talent_id, date_entree_pipeline,
              date_dernier_changement_etape)
  on core.candidature to authenticated;
-- `entreprise_id` N'EST PAS ACCORDÉE. Sans elle, un talent ne peut pas
-- déposer une candidature dans le pipeline d'un client qu'il aurait choisi ;
-- elle est déduite du mandat par un déclencheur (§6).

grant update (retire_par_talent_le, motif_retrait)
  on core.candidature to authenticated;
-- `etape_id`, `motif_ko_code`, `motif_ko_commentaire`, `date_ko` et
-- `date_dernier_changement_etape` sont déjà accordées depuis 20260912104000
-- (portail entreprise) — un GRANT est porté par le rôle `authenticated`, qui
-- est partagé par tous les portails. Ce sont les policies et le déclencheur
-- de frontière (§6) qui séparent ce qu'un client et ce qu'un talent peuvent
-- en faire.

-- ═══════════════════════════════════════════════════════════════════════
-- 5. core.note et app.transition_etape
-- ═══════════════════════════════════════════════════════════════════════
-- Le message d'accompagnement d'une candidature doit atterrir quelque part,
-- sinon la fonction ment à celui qui l'écrit. Il atterrit dans une note
-- signée du talent, visible du talent (il doit pouvoir la relire) et NON
-- visible du client — exactement le miroir de D-04 côté entreprise : partager
-- au client est une décision distincte, et elle appartient au cabinet.
drop policy if exists talent_ecrit_sa_note on core.note;
create policy talent_ecrit_sa_note on core.note
  for insert to authenticated
  with check (
        visible_talent
    and not visible_client
    and auteur_fiche_talent_id = (select api.ma_fiche_talent())
    and auteur_compte_id       = (select api.compte_id())
    and auteur_collaborateur_id is null
    and not est_automatique
    and fiche_talent_id = (select api.ma_fiche_talent())
    and entreprise_id is null            -- une note de talent ne vise pas un client
    and placement_id  is null
    and (candidature_id is null
         or candidature_id in (select c.id from core.candidature c
                                where c.fiche_talent_id = (select api.ma_fiche_talent()))));

grant insert (fiche_talent_id, visible_talent, auteur_fiche_talent_id)
  on core.note to authenticated;
-- Les autres colonnes de l'insert — candidature_id, mandat_id, commentaire,
-- ecrite_le, auteur_compte_id — sont déjà accordées depuis 20260912104000.

-- ⚠ RESSERREMENT D'UNE POLICY DE LA PHASE 1, ASSUMÉ.
-- 20260912104000 écrit en toutes lettres « HORS LISTE : fiche_talent_id […]
-- un client n'ancre pas une note sur une personne », mais ne l'interdisait
-- que par l'absence de GRANT. Le GRANT ci-dessus, porté par le rôle partagé
-- `authenticated`, vient de rendre la colonne insérable pour tout le monde.
-- On remet l'interdit là où il aurait dû être dès le départ : dans la policy.
drop policy if exists client_ecrit_une_note on core.note;
create policy client_ecrit_une_note on core.note
  for insert to authenticated
  with check (
        visible_client
    and not visible_talent
    and auteur_compte_id = (select api.compte_id())
    and auteur_collaborateur_id is null
    and auteur_fiche_talent_id  is null
    and fiche_talent_id is null          -- ← l'ajout
    and placement_id    is null          -- ← l'ajout, même motif
    and not est_automatique
    and (   candidature_id in (select c.id from core.candidature c
                                where c.entreprise_id in (select api.mes_entreprises()))
         or mandat_id      in (select m.id from core.mandat m
                                where m.entreprise_id in (select api.mes_entreprises()))
         or entreprise_id  in (select api.mes_entreprises())));

-- Le retrait d'une candidature est une transition, et elle s'inscrit —
-- `app.origine_transition` porte déjà la valeur `talent`, posée pour ce cas.
drop policy if exists talent_transition on app.transition_etape;
create policy talent_transition on app.transition_etape
  for insert to authenticated
  with check (origine = 'talent'::app.origine_transition
              and auteur_compte_id = (select api.compte_id())
              and candidature_id in (select c.id from core.candidature c
                                      where c.fiche_talent_id = (select api.ma_fiche_talent())));

drop policy if exists talent_ses_transitions on app.transition_etape;
create policy talent_ses_transitions on app.transition_etape
  for select to authenticated
  using (candidature_id in (select c.id from core.candidature c
                             where c.fiche_talent_id = (select api.ma_fiche_talent())));
-- Le GRANT INSERT par colonne est déjà posé par 20260912104000.

-- ═══════════════════════════════════════════════════════════════════════
-- 6. LE TROISIÈME ÉTAGE — deux déclencheurs de frontière
-- ═══════════════════════════════════════════════════════════════════════
-- Ils n'inspectent QUE le rôle du réseau (`authenticated`). La
-- synchronisation, les migrations et la clé de service passent sans être
-- regardées : elles tournent sous `postgres` ou `service_role`, et leur
-- interdire d'écrire `est_qualifie` serait absurde.
--
-- La liste est une LISTE BLANCHE comparée en jsonb, pas une liste noire de
-- colonnes interdites. Une liste noire vieillit mal : la 82ᵉ colonne de
-- `core.fiche_talent` naîtrait écrivable. Une liste blanche la fait naître
-- fermée, ce qui est le sens de marche du projet depuis D-06.

create or replace function core.frontiere_declarative_fiche_talent()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  v_permis constant text[] := array[
    'prenom','nom','email_personnel','telephone','url_linkedin',
    'localisation_texte','photo_url','cv_url','portfolio_url','cv_depose_le',
    'prenom_origine','nom_origine','email_origine','telephone_origine',
    'url_linkedin_origine','localisation_origine','photo_origine',
    'cv_origine','portfolio_origine',
    'attentes_metier_id','attentes_univers_id',
    'attentes_salaire_min_ke','attentes_salaire_max_ke',
    'attentes_tjm_min_eur','attentes_tjm_max_eur',
    'attentes_disponibilite_texte','attentes_localisation_texte',
    'attentes_description','recherche_active','attentes_origine',
    'actif','consentement_donne_le','confirme_sans_changement_le',
    'modifie_par_le_talent_le',
    'maj_le'   -- posée par le déclencheur core.touche_maj_le
  ];
  v_avant jsonb;
  v_apres jsonb;
  v_cle   text;
  v_hors  text[] := '{}';
begin
  if current_user <> 'authenticated' then return new; end if;
  if (select api.est_interne()) then return new; end if;

  v_avant := to_jsonb(old);
  v_apres := to_jsonb(new);
  for v_cle in select key from jsonb_each(v_apres) loop
    if not (v_cle = any (v_permis))
       and (v_avant -> v_cle) is distinct from (v_apres -> v_cle) then
      v_hors := v_hors || v_cle;
    end if;
  end loop;

  if array_length(v_hors, 1) > 0 then
    raise exception
      'colonnes réservées au cabinet : % — un talent ne réécrit pas la qualification portée sur lui',
      array_to_string(v_hors, ', ')
      using errcode = '42501';
  end if;
  return new;
end $$;

comment on function core.frontiere_declarative_fiche_talent() is
  'Troisième étage du cloisonnement de core.fiche_talent : refuse à l''exécution toute colonne hors liste blanche déclarative, même si un GRANT UPDATE de table venait à être posé. N''inspecte que le rôle authenticated non interne.';

drop trigger if exists fiche_talent_frontiere_declarative on core.fiche_talent;
create trigger fiche_talent_frontiere_declarative
  before update on core.fiche_talent
  for each row execute function core.frontiere_declarative_fiche_talent();

-- ── La candidature : deux frontières, selon qui écrit ──────────────────
create or replace function core.frontiere_candidature()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  -- Ce qu'un CLIENT peut toucher : l'étape et son motif (api.decider_candidature).
  v_client  constant text[] := array[
    'etape_id','motif_ko_code','motif_ko_commentaire',
    'date_dernier_changement_etape','date_ko','maj_le'];
  -- Ce qu'un TALENT peut toucher : se retirer, et rien d'autre.
  v_talent  constant text[] := array[
    'etape_id','motif_ko_code','motif_ko_commentaire',
    'date_dernier_changement_etape','date_ko','maj_le',
    'retire_par_talent_le','motif_retrait'];
  v_permis  text[];
  v_avant   jsonb;
  v_apres   jsonb;
  v_cle     text;
  v_hors    text[] := '{}';
  v_ma_fiche uuid;
begin
  if current_user <> 'authenticated' then return new; end if;
  if (select api.est_interne()) then return new; end if;

  v_ma_fiche := (select api.ma_fiche_talent());
  v_permis := case when v_ma_fiche is not null and new.fiche_talent_id = v_ma_fiche
                   then v_talent else v_client end;

  v_avant := to_jsonb(old);
  v_apres := to_jsonb(new);
  for v_cle in select key from jsonb_each(v_apres) loop
    if not (v_cle = any (v_permis))
       and (v_avant -> v_cle) is distinct from (v_apres -> v_cle) then
      v_hors := v_hors || v_cle;
    end if;
  end loop;

  if array_length(v_hors, 1) > 0 then
    raise exception 'colonnes non modifiables depuis un portail : %',
      array_to_string(v_hors, ', ') using errcode = '42501';
  end if;
  return new;
end $$;

comment on function core.frontiere_candidature() is
  'Sépare ce qu''un client et ce qu''un talent peuvent modifier sur une candidature — le GRANT, lui, est porté par le rôle authenticated que les deux partagent. Un client ne peut donc pas écrire retire_par_talent_le.';

drop trigger if exists candidature_frontiere on core.candidature;
create trigger candidature_frontiere
  before update on core.candidature
  for each row execute function core.frontiere_candidature();

-- ── L'entreprise d'une candidature se déduit du mandat, jamais du client ──
create or replace function core.candidature_entreprise_du_mandat()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Ne concerne QUE les candidatures créées par un talent. Les reprises et la
  -- synchronisation posent leur `entreprise_id` elles-mêmes.
  if new.cree_par_fiche_talent_id is null then return new; end if;
  if new.mandat_id is null then
    new.entreprise_id := null;           -- candidature spontanée
  else
    select m.entreprise_id into new.entreprise_id
      from core.mandat m where m.id = new.mandat_id;
  end if;
  return new;
end $$;

comment on function core.candidature_entreprise_du_mandat() is
  'SECURITY DEFINER pour lire core.mandat sans dépendre de la RLS de l''appelant, et pour rompre le cycle candidature→mandat→candidature (42P17). N''élargit aucun droit : elle DÉDUIT une valeur que l''appelant n''a pas le droit d''écrire.';

revoke execute on function core.candidature_entreprise_du_mandat() from public, anon, authenticated;

drop trigger if exists candidature_entreprise_du_mandat on core.candidature;
create trigger candidature_entreprise_du_mandat
  before insert on core.candidature
  for each row execute function core.candidature_entreprise_du_mandat();

-- ═══════════════════════════════════════════════════════════════════════
-- 7. CONTRÔLE — cette migration échoue si la fermeture ne tient pas
-- ═══════════════════════════════════════════════════════════════════════
do $$
declare
  v_fuite      text;
  v_interdites constant text[] := array[
    'est_qualifie','statut_relation','agent_referent_id','seniorite','mindset',
    'emoji_statut','score_completude','champs_manquants','fiche_complete',
    'resume_ia','parse_par_ia_le','source_import','apporteur_affaires_id',
    'univers_id','niveau_anglais','anonymise_le','fusionnee_vers_fiche_id',
    'talent_id','bubble_id','date_dernier_contact','ecole','grande_ecole',
    'poste_actuel_employeur','poste_actuel_entreprise_id','poste_actuel_metier_id',
    'poste_actuel_univers_id','poste_actuel_contrat','poste_actuel_depuis_le',
    'poste_actuel_raison_depart','poste_actuel_origine','genre','genre_origine',
    'cree_par_compte_id','cree_par_origine','cree_par_legacy_bubble'];
  v_col text;
begin
  -- 7a. Aucun droit d'UPDATE au niveau de la TABLE. C'est le geste qui armerait
  --     la policy sur les 81 colonnes ; on veut qu'il soit visible s'il revient.
  if has_table_privilege('authenticated', 'core.fiche_talent', 'update') then
    raise exception 'UPDATE accordé au niveau TABLE sur core.fiche_talent : la policy talent_maj_sa_fiche redevient un droit sur 81 colonnes';
  end if;
  if has_table_privilege('authenticated', 'core.fiche_talent', 'insert')
     or has_table_privilege('authenticated', 'core.fiche_talent', 'delete') then
    raise exception 'INSERT ou DELETE accordé sur core.fiche_talent : un talent ne crée ni n''efface une fiche';
  end if;

  -- 7b. Aucune colonne de qualification n'est écrivable.
  v_fuite := null;
  foreach v_col in array v_interdites loop
    if has_column_privilege('authenticated', 'core.fiche_talent', v_col, 'update') then
      v_fuite := concat_ws(', ', v_fuite, v_col);
    end if;
  end loop;
  if v_fuite is not null then
    raise exception 'colonnes de qualification cabinet écrivables par authenticated : %', v_fuite;
  end if;

  -- 7c. Et la réciproque : ce qui DOIT être écrivable l'est, sinon les
  --     fonctions api.* échoueraient sans que rien ne le dise ici.
  if not has_column_privilege('authenticated', 'core.fiche_talent', 'prenom', 'update')
     or not has_column_privilege('authenticated', 'core.fiche_talent', 'recherche_active', 'update')
     or not has_column_privilege('authenticated', 'core.fiche_talent', 'consentement_donne_le', 'update')
     or not has_column_privilege('authenticated', 'core.fiche_talent', 'actif', 'update')
     or not has_column_privilege('authenticated', 'core.fiche_talent_secteur_vise', 'secteur_id', 'insert')
     or not has_column_privilege('authenticated', 'core.fiche_talent_poste', 'intitule', 'insert')
     or not has_column_privilege('authenticated', 'core.candidature', 'retire_par_talent_le', 'update')
     or not has_column_privilege('authenticated', 'core.candidature', 'cree_par_fiche_talent_id', 'insert')
     or not has_column_privilege('authenticated', 'core.note', 'auteur_fiche_talent_id', 'insert') then
    raise exception 'une écriture attendue du talent reste fermée : les fonctions api.* échoueraient';
  end if;

  -- 7d. Le tag reste un acte du cabinet.
  if has_any_column_privilege('authenticated', 'core.fiche_talent_tag', 'insert')
     or has_table_privilege('authenticated', 'core.fiche_talent_tag', 'delete') then
    raise exception 'core.fiche_talent_tag est devenu écrivable : un tag est posé PAR le cabinet, pas par le talent';
  end if;

  -- 7e. `entreprise_id` d'une candidature n'est pas au clavier du talent.
  if has_column_privilege('authenticated', 'core.candidature', 'entreprise_id', 'insert') then
    raise exception 'core.candidature.entreprise_id est insérable : un talent pourrait déposer sa candidature dans le pipeline du client de son choix';
  end if;

  -- 7f. Les six colonnes de jugement restent fermées, en insert comme en update.
  foreach v_col in array array['compte_rendu','appreciation_like','appreciation_personnalite',
                               'points_forts','points_faibles','infos_remuneration',
                               'argumentaire_client','presente_le'] loop
    if has_column_privilege('authenticated', 'core.candidature', v_col, 'insert')
       or has_column_privilege('authenticated', 'core.candidature', v_col, 'update') then
      raise exception 'core.candidature.% est écrivable depuis un portail', v_col;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
