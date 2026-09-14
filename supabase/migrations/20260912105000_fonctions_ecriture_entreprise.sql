-- ═══════════════════════════════════════════════════════════════════════════
-- LES NEUF FONCTIONS D'ÉCRITURE DU PORTAIL ENTREPRISE — ADR 0005.
--
-- Le modèle, identique pour chacune :
--   security invoker           la RLS de l'appelant s'applique DANS la fonction
--   set search_path = ''       tout est qualifié, rien n'est capturable
--   validation d'abord         raise exception explicite, en français
--   colonnes nommées une à une jamais un update de ligne entière
--   app.journal_ecriture       une ligne par champ changé, sous un lot_id
--   p_cle_idempotence          honorée via app.idempotence, dernier argument
--
-- ⚠ LE PIÈGE QUE CE PROJET A DÉJÀ PAYÉ DEUX FOIS : `create or replace
-- function` RÉACCORDE EXECUTE à PUBLIC. Le déclencheur d'événement
-- `securite.fermer_fonctions_nouvelles` ne couvre que le schéma `public`.
-- Chaque fonction est donc suivie de son revoke, à la main, en bas de fichier.
--
-- LE CONTRAT DES FONCTIONS « maj_ » : ELLES ENREGISTRENT UN FORMULAIRE ENTIER.
-- `api.maj_entreprise` et `api.maj_mandat` écrivent TOUTE leur liste blanche à
-- chaque appel : un argument nul EFFACE la valeur. C'est le comportement d'un
-- écran « enregistrer la fiche », et c'est un choix.
--   Pourquoi pas « ne toucher qu'aux arguments fournis » : en SQL, une fonction
--   ne distingue pas « non fourni » de « mis à NULL ». Le contourner demanderait
--   soit un sentinel, soit un tableau `p_champs` — deux mécanismes qui ajoutent
--   chacun leur propre mode d'échec silencieux.
--   Ce que ça coûte : une Server Action qui n'envoie qu'une moitié du
--   formulaire efface l'autre. Le journal garde l'avant, donc c'est réparable,
--   mais c'est à savoir. Les écrans à champ unique — facturation, produit,
--   pause, clôture — ont leur propre fonction pour cette raison.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── L'entreprise du compte, résolue une fois ───────────────────────────
-- Dans `app` et non dans `api` : PostgREST expose `api`, et cet utilitaire
-- n'a rien à faire sur le réseau.
create or replace function app.mon_entreprise_unique() returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare v_ids uuid[];
begin
  select array_agg(x) into v_ids from api.mes_entreprises() x;
  if v_ids is null or array_length(v_ids, 1) = 0 then
    raise exception 'aucune entreprise n''est rattachée à ce compte'
      using errcode = '42501';
  end if;
  if array_length(v_ids, 1) > 1 then
    raise exception 'ce compte est rattaché à % entreprises : préciser laquelle n''est pas prévu par cette fonction',
      array_length(v_ids, 1) using errcode = '21000';
  end if;
  return v_ids[1];
end $$;
revoke execute on function app.mon_entreprise_unique() from public, anon;
grant  execute on function app.mon_entreprise_unique() to authenticated, service_role;

-- ── Le contrôle d'un brief, écrit une fois pour creer_mandat et maj_mandat ──
-- Les bornes de salaire ne sont pas cosmétiques : la convention « numeric pour
-- l'argent, avec l'unité écrite dans le nom » a été posée APRÈS qu'une
-- conversion €→K€ a gelé la synchronisation 43 jours. Un client qui saisit
-- « 55000 » dans un champ nommé salaire_min_ke doit être arrêté ici, pas
-- découvert six mois plus tard dans un rapport.
create or replace function app.controler_brief(
  p_titre                 text,
  p_metier_code           text,
  p_univers_code          text,
  p_contrat               text,
  p_salaire_min_ke        numeric,
  p_salaire_max_ke        numeric,
  p_tjm_min_eur           numeric,
  p_tjm_max_eur           numeric,
  p_experience_min_annees integer,
  p_must_have             jsonb,
  p_nice_to_have          jsonb
) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if p_titre is null or btrim(p_titre) = '' then
    raise exception 'le brief doit porter un intitulé' using errcode = '22004';
  end if;
  if length(btrim(p_titre)) > 200 then
    raise exception 'intitulé trop long : % caractères pour 200 au plus', length(btrim(p_titre))
      using errcode = '22001';
  end if;
  if p_contrat is not null and p_contrat not in ('cdi','freelance','entrepreneur') then
    raise exception 'p_contrat vaut « cdi », « freelance » ou « entrepreneur » — reçu « % »', p_contrat
      using errcode = '22023';
  end if;

  if p_salaire_min_ke is not null and (p_salaire_min_ke < 0 or p_salaire_min_ke > 1000) then
    raise exception 'p_salaire_min_ke s''exprime en MILLIERS d''euros : % est hors des bornes 0–1 000', p_salaire_min_ke
      using errcode = '22003';
  end if;
  if p_salaire_max_ke is not null and (p_salaire_max_ke < 0 or p_salaire_max_ke > 1000) then
    raise exception 'p_salaire_max_ke s''exprime en MILLIERS d''euros : % est hors des bornes 0–1 000', p_salaire_max_ke
      using errcode = '22003';
  end if;
  if p_salaire_min_ke is not null and p_salaire_max_ke is not null
     and p_salaire_min_ke > p_salaire_max_ke then
    raise exception 'salaire minimum (%) supérieur au maximum (%)', p_salaire_min_ke, p_salaire_max_ke
      using errcode = '22003';
  end if;

  if p_tjm_min_eur is not null and (p_tjm_min_eur < 0 or p_tjm_min_eur > 10000) then
    raise exception 'p_tjm_min_eur s''exprime en euros par jour : % est hors des bornes 0–10 000', p_tjm_min_eur
      using errcode = '22003';
  end if;
  if p_tjm_max_eur is not null and (p_tjm_max_eur < 0 or p_tjm_max_eur > 10000) then
    raise exception 'p_tjm_max_eur s''exprime en euros par jour : % est hors des bornes 0–10 000', p_tjm_max_eur
      using errcode = '22003';
  end if;
  if p_tjm_min_eur is not null and p_tjm_max_eur is not null
     and p_tjm_min_eur > p_tjm_max_eur then
    raise exception 'TJM minimum (%) supérieur au maximum (%)', p_tjm_min_eur, p_tjm_max_eur
      using errcode = '22003';
  end if;

  if p_experience_min_annees is not null
     and (p_experience_min_annees < 0 or p_experience_min_annees > 50) then
    raise exception 'p_experience_min_annees hors des bornes 0–50 : %', p_experience_min_annees
      using errcode = '22003';
  end if;

  if p_must_have is not null and jsonb_typeof(p_must_have) not in ('array','object') then
    raise exception 'p_must_have doit être un tableau ou un objet JSON, reçu %', jsonb_typeof(p_must_have)
      using errcode = '22023';
  end if;
  if p_nice_to_have is not null and jsonb_typeof(p_nice_to_have) not in ('array','object') then
    raise exception 'p_nice_to_have doit être un tableau ou un objet JSON, reçu %', jsonb_typeof(p_nice_to_have)
      using errcode = '22023';
  end if;
end $$;

comment on function app.controler_brief(text,text,text,text,numeric,numeric,numeric,numeric,integer,jsonb,jsonb) is
  'Les règles d''un brief, écrites une fois. Employée par api.creer_mandat et api.maj_mandat pour qu''elles ne puissent pas diverger.';

-- ═══════════════════════════════════════════════════════════════════════
-- 1. api.decider_candidature
-- ═══════════════════════════════════════════════════════════════════════
-- La feature la plus lourde du portail. Elle fait TROIS choses en une
-- transaction : elle enregistre la décision, elle en laisse une trace lisible
-- des deux côtés (une note partagée), et elle fait avancer la machine à états.
--
-- La règle d'avancement, mot pour mot du ticket :
--   entretien_demande → interview_1, SI ET SEULEMENT SI l'étape est send_out
--   refuse            → ko_by_client, avec le motif
--   valide            → n'avance rien. C'est un signal, pas une transition :
--                       après un send-out validé, c'est le client qui décide
--                       de la suite, et il le dira par « entretien_demande ».
create or replace function api.decider_candidature(
  p_candidature_id  uuid,
  p_sens            text,
  p_motif_ko_code   text default null,
  p_commentaire     text default null,
  p_cle_idempotence text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_compte        uuid := api.compte_id();
  v_lot           uuid := gen_random_uuid();
  v_rejeu         jsonb;
  v_mandat        uuid;
  v_entreprise    uuid;
  v_etape_avant   uuid;
  v_code_avant    text;
  v_visible       boolean;
  v_terminale     boolean;
  v_code_cible    text;
  v_etape_cible   uuid;
  v_libelle_motif text;
  v_decision      uuid;
  v_note          uuid;
  v_texte         text;
  v_resultat      jsonb;
begin
  -- 1 ── validation des arguments
  if v_compte is null then
    raise exception 'aucun compte : une décision exige une session ouverte' using errcode = '42501';
  end if;
  if p_candidature_id is null then
    raise exception 'p_candidature_id est obligatoire' using errcode = '22004';
  end if;
  if p_sens is null or p_sens not in ('valide','refuse','entretien_demande') then
    raise exception 'p_sens vaut « valide », « refuse » ou « entretien_demande » — reçu « % »',
      coalesce(p_sens, 'NULL') using errcode = '22023';
  end if;
  if p_sens = 'refuse' and p_motif_ko_code is null then
    raise exception 'un refus exige un motif : p_motif_ko_code est obligatoire quand p_sens vaut « refuse »'
      using errcode = '23514';
  end if;
  if p_sens <> 'refuse' and p_motif_ko_code is not null then
    raise exception 'p_motif_ko_code ne s''emploie qu''avec un refus' using errcode = '22023';
  end if;
  if p_motif_ko_code is not null then
    select m.libelle_fr into v_libelle_motif
      from ref.motif_ko m
     where m.code = p_motif_ko_code and m.actif and m.categorie = 'client';
    if not found then
      raise exception 'motif de refus inconnu ou hors du registre client : « % »', p_motif_ko_code
        using errcode = '23503';
    end if;
  end if;
  if length(coalesce(p_commentaire, '')) > 5000 then
    raise exception 'commentaire trop long : % caractères pour 5 000 au plus', length(p_commentaire)
      using errcode = '22001';
  end if;

  -- 2 ── idempotence, AVANT toute écriture
  v_rejeu := app.idempotence_rejeu(
    p_cle_idempotence,
    md5(coalesce(p_candidature_id::text, '') || '|' || p_sens || '|'
        || coalesce(p_motif_ko_code, '') || '|' || coalesce(p_commentaire, '')));
  if v_rejeu is not null then
    return v_rejeu;
  end if;

  -- 3 ── la candidature, lue sous la RLS de l'appelant
  select c.mandat_id, c.entreprise_id, c.etape_id, ep.code, ep.visible_client, ep.est_terminale
    into v_mandat, v_entreprise, v_etape_avant, v_code_avant, v_visible, v_terminale
    from core.candidature c
    join ref.etape_process ep on ep.id = c.etape_id
   where c.id = p_candidature_id;
  if not found then
    raise exception 'candidature % introuvable dans votre périmètre', p_candidature_id
      using errcode = '42501';
  end if;
  if not v_visible then
    raise exception 'cette candidature ne vous a pas été présentée : aucune décision n''est possible'
      using errcode = '42501';
  end if;
  if v_terminale then
    raise exception 'cette candidature est close (étape « % ») : elle n''attend plus de décision', v_code_avant
      using errcode = '23514';
  end if;

  -- 4 ── l'étape cible
  v_code_cible := case
                    when p_sens = 'refuse' then 'ko_by_client'
                    when p_sens = 'entretien_demande' and v_code_avant = 'send_out' then 'interview_1'
                    else null
                  end;

  -- 5 ── la décision
  insert into app.decision_client (candidature_id, compte_id, sens, motif_ko_code, commentaire)
  values (p_candidature_id, v_compte, p_sens, p_motif_ko_code, p_commentaire)
  returning id into v_decision;

  -- 6 ── la trace lisible des deux côtés
  v_texte := case p_sens
               when 'valide'            then 'Profil validé.'
               when 'entretien_demande' then 'Entretien demandé.'
               when 'refuse'            then 'Profil écarté — ' || v_libelle_motif || '.'
             end
             || coalesce(chr(10) || p_commentaire, '');

  insert into core.note (candidature_id, mandat_id, entreprise_id, commentaire,
                         ecrite_le, visible_client, auteur_compte_id)
  values (p_candidature_id, v_mandat, v_entreprise, v_texte, now(), true, v_compte)
  returning id into v_note;

  -- 7 ── la transition, si transition il y a
  if v_code_cible is not null then
    select ep.id into v_etape_cible from ref.etape_process ep where ep.code = v_code_cible;
    if v_etape_cible is null then
      raise exception 'étape « % » absente de ref.etape_process', v_code_cible using errcode = '23503';
    end if;

    insert into app.transition_etape (candidature_id, etape_avant_id, etape_apres_id,
                                      origine, auteur_compte_id, motif_ko_code, commentaire)
    values (p_candidature_id, v_etape_avant, v_etape_cible,
            'client'::app.origine_transition, v_compte, p_motif_ko_code, p_commentaire);

    update core.candidature
       set etape_id                      = v_etape_cible,
           date_dernier_changement_etape = now(),
           motif_ko_code                 = case when p_sens = 'refuse' then p_motif_ko_code
                                                else motif_ko_code end,
           motif_ko_commentaire          = case when p_sens = 'refuse' then p_commentaire
                                                else motif_ko_commentaire end,
           date_ko                       = case when p_sens = 'refuse' then now()
                                                else date_ko end
     where id = p_candidature_id;
  end if;

  -- 8 ── le journal, une ligne par effet
  perform app.journaliser(v_lot, 'app.decision_client', v_decision, 'insert', null, null,
    jsonb_build_object('candidature_id', p_candidature_id, 'sens', p_sens,
                       'motif_ko_code', p_motif_ko_code, 'commentaire', p_commentaire));
  perform app.journaliser(v_lot, 'core.note', v_note, 'insert', null, null,
    jsonb_build_object('candidature_id', p_candidature_id, 'visible_client', true));
  if v_code_cible is not null then
    perform app.journaliser(v_lot, 'core.candidature', p_candidature_id, 'update',
      'etape_id', to_jsonb(v_code_avant), to_jsonb(v_code_cible));
  end if;

  v_resultat := jsonb_build_object(
    'decision_id', v_decision, 'note_id', v_note,
    'etape_avant', v_code_avant, 'etape_apres', coalesce(v_code_cible, v_code_avant),
    'etape_changee', v_code_cible is not null, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.decider_candidature(uuid,text,text,text,text) is
  'La décision d''un client sur un candidat présenté. Écrit app.decision_client, une note visible_client, et fait avancer l''étape : entretien_demande → interview_1 depuis send_out ; refuse → ko_by_client avec motif du registre « client » ; valide n''avance rien.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2. api.commenter_candidature
-- ═══════════════════════════════════════════════════════════════════════
create or replace function api.commenter_candidature(
  p_candidature_id  uuid,
  p_commentaire     text,
  p_cle_idempotence text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_compte     uuid := api.compte_id();
  v_lot        uuid := gen_random_uuid();
  v_rejeu      jsonb;
  v_mandat     uuid;
  v_entreprise uuid;
  v_visible    boolean;
  v_note       uuid;
  v_resultat   jsonb;
begin
  if v_compte is null then
    raise exception 'aucun compte : un commentaire exige une session ouverte' using errcode = '42501';
  end if;
  if p_candidature_id is null then
    raise exception 'p_candidature_id est obligatoire' using errcode = '22004';
  end if;
  if p_commentaire is null or btrim(p_commentaire) = '' then
    raise exception 'un commentaire vide n''est pas un commentaire' using errcode = '22004';
  end if;
  if length(p_commentaire) > 5000 then
    raise exception 'commentaire trop long : % caractères pour 5 000 au plus', length(p_commentaire)
      using errcode = '22001';
  end if;

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(coalesce(p_candidature_id::text, '') || '|' || p_commentaire));
  if v_rejeu is not null then return v_rejeu; end if;

  select c.mandat_id, c.entreprise_id, ep.visible_client
    into v_mandat, v_entreprise, v_visible
    from core.candidature c
    join ref.etape_process ep on ep.id = c.etape_id
   where c.id = p_candidature_id;
  if not found then
    raise exception 'candidature % introuvable dans votre périmètre', p_candidature_id
      using errcode = '42501';
  end if;
  if not v_visible then
    raise exception 'cette candidature ne vous a pas été présentée' using errcode = '42501';
  end if;

  insert into core.note (candidature_id, mandat_id, entreprise_id, commentaire,
                         ecrite_le, visible_client, auteur_compte_id)
  values (p_candidature_id, v_mandat, v_entreprise, btrim(p_commentaire), now(), true, v_compte)
  returning id into v_note;

  perform app.journaliser(v_lot, 'core.note', v_note, 'insert', null, null,
    jsonb_build_object('candidature_id', p_candidature_id, 'visible_client', true));

  v_resultat := jsonb_build_object('note_id', v_note, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.commenter_candidature(uuid,text,text) is
  'Un commentaire libre du client sur une candidature qui lui a été présentée. Note visible_client, signée du compte client, jamais partagée avec le talent.';

-- ═══════════════════════════════════════════════════════════════════════
-- 3. api.maj_entreprise — LISTE BLANCHE STRICTE
-- ═══════════════════════════════════════════════════════════════════════
-- Ne peuvent PAS être écrites ici, et aucun GRANT ne les couvre :
-- success_fee_*, apport_affaires*, exclusivite*, nb_mois_garantie,
-- statut_contrat_id, date_signature_contrat, date_fin_contrat,
-- account_manager_id, actif, statut_relation, note_interne, nom,
-- raison_sociale, secteur_id, type_entreprise, type_produit.
create or replace function api.maj_entreprise(
  p_description        text    default null,
  p_fondateur          text    default null,
  p_serie_financement  text    default null,
  p_site_web           text    default null,
  p_siret              text    default null,
  p_video_url          text    default null,
  p_logo_url           text    default null,
  p_localisation_texte text    default null,
  p_nb_employes        integer default null,
  p_nb_techs           integer default null,
  p_cle_idempotence    text    default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_compte  uuid := api.compte_id();
  v_ent     uuid;
  v_lot     uuid := gen_random_uuid();
  v_rejeu   jsonb;
  v_avant   jsonb;
  v_apres   jsonb;
  v_n       integer;
  v_resultat jsonb;
  v_siret   text := nullif(regexp_replace(coalesce(p_siret, ''), '\s', '', 'g'), '');
begin
  if v_compte is null then
    raise exception 'aucun compte : la modification exige une session ouverte' using errcode = '42501';
  end if;
  if v_siret is not null and v_siret !~ '^[0-9]{14}$' then
    raise exception 'un SIRET compte 14 chiffres — reçu « % »', v_siret using errcode = '22023';
  end if;
  if p_site_web  is not null and p_site_web  !~* '^https?://' then
    raise exception 'p_site_web doit commencer par http:// ou https://' using errcode = '22023';
  end if;
  if p_video_url is not null and p_video_url !~* '^https?://' then
    raise exception 'p_video_url doit commencer par http:// ou https://' using errcode = '22023';
  end if;
  if p_logo_url  is not null and p_logo_url  !~* '^https?://' then
    raise exception 'p_logo_url doit commencer par http:// ou https://' using errcode = '22023';
  end if;
  if p_nb_employes is not null and (p_nb_employes < 0 or p_nb_employes > 5000000) then
    raise exception 'p_nb_employes hors bornes : %', p_nb_employes using errcode = '22003';
  end if;
  if p_nb_techs is not null and (p_nb_techs < 0 or p_nb_techs > 5000000) then
    raise exception 'p_nb_techs hors bornes : %', p_nb_techs using errcode = '22003';
  end if;
  if length(coalesce(p_description, '')) > 10000 then
    raise exception 'description trop longue : % caractères pour 10 000 au plus', length(p_description)
      using errcode = '22001';
  end if;

  v_ent := app.mon_entreprise_unique();

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', v_ent::text, p_description, p_fondateur, p_serie_financement,
                  p_site_web, v_siret, p_video_url, p_logo_url, p_localisation_texte,
                  p_nb_employes::text, p_nb_techs::text)));
  if v_rejeu is not null then return v_rejeu; end if;

  select to_jsonb(x) into v_avant from (
    select e.description, e.fondateur, e.serie_financement, e.site_web, e.siret,
           e.video_url, e.logo_url, e.localisation_texte, e.nb_employes, e.nb_techs
      from core.entreprise e where e.id = v_ent) x;
  if v_avant is null then
    raise exception 'entreprise % illisible : la policy de lecture ne la couvre pas', v_ent
      using errcode = '42501';
  end if;

  update core.entreprise
     set description        = p_description,
         fondateur          = p_fondateur,
         serie_financement  = p_serie_financement,
         site_web           = p_site_web,
         siret              = v_siret,
         video_url          = p_video_url,
         logo_url           = p_logo_url,
         localisation_texte = p_localisation_texte,
         nb_employes        = p_nb_employes,
         nb_techs           = p_nb_techs
   where id = v_ent;
  if not found then
    raise exception 'entreprise % non modifiable : hors de votre périmètre', v_ent using errcode = '42501';
  end if;

  select to_jsonb(x) into v_apres from (
    select e.description, e.fondateur, e.serie_financement, e.site_web, e.siret,
           e.video_url, e.logo_url, e.localisation_texte, e.nb_employes, e.nb_techs
      from core.entreprise e where e.id = v_ent) x;

  v_n := app.journaliser_diff(v_lot, 'core.entreprise', v_ent, v_avant, v_apres);

  v_resultat := jsonb_build_object('entreprise_id', v_ent, 'champs_modifies', v_n, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.maj_entreprise(text,text,text,text,text,text,text,text,integer,integer,text) is
  'La vitrine de MON entreprise. Liste blanche stricte de dix colonnes ; les conditions commerciales et la qualification du cabinet n''y sont pas et aucun GRANT ne les couvre. ⚠ Enregistre un FORMULAIRE ENTIER : un argument nul efface la valeur.';

-- ═══════════════════════════════════════════════════════════════════════
-- 4. api.maj_facturation
-- ═══════════════════════════════════════════════════════════════════════
create or replace function api.maj_facturation(
  p_email_facturation           text  default null,
  p_raison_sociale_facturation  text  default null,
  p_adresse_facturation         jsonb default null,
  p_cle_idempotence             text  default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_compte uuid := api.compte_id();
  v_ent    uuid;
  v_lot    uuid := gen_random_uuid();
  v_rejeu  jsonb;
  v_avant  jsonb;
  v_apres  jsonb;
  v_n      integer;
  v_resultat jsonb;
begin
  if v_compte is null then
    raise exception 'aucun compte : la modification exige une session ouverte' using errcode = '42501';
  end if;
  if p_email_facturation is not null and p_email_facturation !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'p_email_facturation n''est pas une adresse : « % »', p_email_facturation
      using errcode = '22023';
  end if;
  if p_adresse_facturation is not null
     and jsonb_typeof(p_adresse_facturation) <> 'object' then
    raise exception 'p_adresse_facturation doit être un objet JSON, reçu %',
      jsonb_typeof(p_adresse_facturation) using errcode = '22023';
  end if;

  v_ent := app.mon_entreprise_unique();

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', v_ent::text, p_email_facturation, p_raison_sociale_facturation,
                  p_adresse_facturation::text)));
  if v_rejeu is not null then return v_rejeu; end if;

  select to_jsonb(x) into v_avant from (
    select e.email_facturation, e.raison_sociale_facturation, e.adresse_facturation
      from core.entreprise e where e.id = v_ent) x;
  if v_avant is null then
    raise exception 'entreprise % illisible', v_ent using errcode = '42501';
  end if;

  update core.entreprise
     set email_facturation          = p_email_facturation,
         raison_sociale_facturation = p_raison_sociale_facturation,
         adresse_facturation        = p_adresse_facturation
   where id = v_ent;
  if not found then
    raise exception 'entreprise % non modifiable : hors de votre périmètre', v_ent using errcode = '42501';
  end if;

  select to_jsonb(x) into v_apres from (
    select e.email_facturation, e.raison_sociale_facturation, e.adresse_facturation
      from core.entreprise e where e.id = v_ent) x;

  v_n := app.journaliser_diff(v_lot, 'core.entreprise', v_ent, v_avant, v_apres);

  v_resultat := jsonb_build_object('entreprise_id', v_ent, 'champs_modifies', v_n, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.maj_facturation(text,text,jsonb,text) is
  'Les coordonnées de facturation de MON entreprise. Trois colonnes, pas une de plus.';

-- ═══════════════════════════════════════════════════════════════════════
-- 5. api.maj_produit
-- ═══════════════════════════════════════════════════════════════════════
create or replace function api.maj_produit(
  p_produit_id      uuid,
  p_description     text default null,
  p_texte_annonce   text default null,
  p_maturite_code   text default null,
  p_cle_idempotence text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_compte   uuid := api.compte_id();
  v_lot      uuid := gen_random_uuid();
  v_rejeu    jsonb;
  v_maturite uuid;
  v_avant    jsonb;
  v_apres    jsonb;
  v_n        integer;
  v_resultat jsonb;
begin
  if v_compte is null then
    raise exception 'aucun compte : la modification exige une session ouverte' using errcode = '42501';
  end if;
  if p_produit_id is null then
    raise exception 'p_produit_id est obligatoire' using errcode = '22004';
  end if;
  if p_maturite_code is not null then
    select m.id into v_maturite from ref.maturite_produit m
     where m.code = p_maturite_code and m.actif;
    if not found then
      raise exception 'maturité de produit inconnue : « % »', p_maturite_code using errcode = '23503';
    end if;
  end if;

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', p_produit_id::text, p_description, p_texte_annonce, p_maturite_code)));
  if v_rejeu is not null then return v_rejeu; end if;

  select to_jsonb(x) into v_avant from (
    select p.description, p.texte_annonce, p.maturite_id
      from core.produit p where p.id = p_produit_id) x;
  if v_avant is null then
    raise exception 'produit % introuvable dans votre périmètre', p_produit_id using errcode = '42501';
  end if;

  update core.produit
     set description   = p_description,
         texte_annonce = p_texte_annonce,
         maturite_id   = v_maturite
   where id = p_produit_id;
  if not found then
    raise exception 'produit % non modifiable : hors de votre périmètre', p_produit_id using errcode = '42501';
  end if;

  select to_jsonb(x) into v_apres from (
    select p.description, p.texte_annonce, p.maturite_id
      from core.produit p where p.id = p_produit_id) x;

  v_n := app.journaliser_diff(v_lot, 'core.produit', p_produit_id, v_avant, v_apres);

  v_resultat := jsonb_build_object('produit_id', p_produit_id, 'champs_modifies', v_n, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.maj_produit(uuid,text,text,text,text) is
  'Le produit de MON entreprise : description, texte d''annonce, maturité. Le nom du produit reste au cabinet.';

-- ═══════════════════════════════════════════════════════════════════════
-- 6. api.creer_mandat — le brief en self-service
-- ═══════════════════════════════════════════════════════════════════════
-- Naît en statut `nouveau`, SANS publication et SANS validation :
-- `valide_par_am_le` reste nul, et aucun GRANT ne permet de l'écrire. La
-- validation est un acte interne, et la publication en est un autre —
-- `app.mandat_publication` est réservée à `api.est_interne()`.
create or replace function api.creer_mandat(
  p_titre                 text,
  p_metier_code           text    default null,
  p_univers_code          text    default null,
  p_contrat               text    default null,
  p_salaire_min_ke        numeric default null,
  p_salaire_max_ke        numeric default null,
  p_tjm_min_eur           numeric default null,
  p_tjm_max_eur           numeric default null,
  p_experience_min_annees integer default null,
  p_missions              text    default null,
  p_remote_infos          text    default null,
  p_localisation          text    default null,
  p_must_have             jsonb   default null,
  p_nice_to_have          jsonb   default null,
  p_cle_idempotence       text    default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_compte  uuid := api.compte_id();
  v_ent     uuid;
  v_lot     uuid := gen_random_uuid();
  v_rejeu   jsonb;
  v_metier  uuid;
  v_univers uuid;
  v_mandat  uuid;
  v_resultat jsonb;
begin
  if v_compte is null then
    raise exception 'aucun compte : la création exige une session ouverte' using errcode = '42501';
  end if;
  perform app.controler_brief(p_titre, p_metier_code, p_univers_code, p_contrat,
                              p_salaire_min_ke, p_salaire_max_ke,
                              p_tjm_min_eur, p_tjm_max_eur,
                              p_experience_min_annees, p_must_have, p_nice_to_have);

  if p_metier_code is not null then
    select m.id into v_metier from ref.metier m where m.code = p_metier_code and m.actif;
    if not found then
      raise exception 'métier inconnu : « % »', p_metier_code using errcode = '23503';
    end if;
  end if;
  if p_univers_code is not null then
    select u.id into v_univers from ref.univers u where u.code = p_univers_code and u.actif;
    if not found then
      raise exception 'univers inconnu : « % »', p_univers_code using errcode = '23503';
    end if;
  end if;

  v_ent := app.mon_entreprise_unique();

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', v_ent::text, p_titre, p_metier_code, p_univers_code, p_contrat,
                  p_salaire_min_ke::text, p_salaire_max_ke::text,
                  p_tjm_min_eur::text, p_tjm_max_eur::text,
                  p_experience_min_annees::text, p_missions, p_remote_infos,
                  p_localisation, p_must_have::text, p_nice_to_have::text)));
  if v_rejeu is not null then return v_rejeu; end if;

  insert into core.mandat
    (titre, entreprise_id, statut, metier_id, univers_id, contrat,
     salaire_min_ke, salaire_max_ke, tjm_min_eur, tjm_max_eur,
     experience_min_annees, missions, remote_infos, localisation,
     must_have, nice_to_have)
  values
    (btrim(p_titre), v_ent, 'nouveau'::ref.statut_mandat, v_metier, v_univers,
     p_contrat::ref.type_contrat,
     p_salaire_min_ke, p_salaire_max_ke, p_tjm_min_eur, p_tjm_max_eur,
     p_experience_min_annees::smallint, p_missions, p_remote_infos, p_localisation,
     p_must_have, p_nice_to_have)
  returning id into v_mandat;

  perform app.journaliser(v_lot, 'core.mandat', v_mandat, 'insert', null, null,
    jsonb_build_object('titre', btrim(p_titre), 'entreprise_id', v_ent, 'statut', 'nouveau',
                       'metier_code', p_metier_code, 'univers_code', p_univers_code,
                       'contrat', p_contrat, 'origine', 'self-service client'));

  v_resultat := jsonb_build_object('mandat_id', v_mandat, 'statut', 'nouveau',
                                   'valide_par_am', false, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.creer_mandat(text,text,text,text,numeric,numeric,numeric,numeric,integer,text,text,text,jsonb,jsonb,text) is
  'Un brief déposé par le client. Statut « nouveau », jamais publié, valide_par_am_le nul : la validation est un acte interne.';

-- ═══════════════════════════════════════════════════════════════════════
-- 7. api.maj_mandat — tant que le brief est neuf
-- ═══════════════════════════════════════════════════════════════════════
create or replace function api.maj_mandat(
  p_mandat_id             uuid,
  p_titre                 text    default null,
  p_metier_code           text    default null,
  p_univers_code          text    default null,
  p_contrat               text    default null,
  p_salaire_min_ke        numeric default null,
  p_salaire_max_ke        numeric default null,
  p_tjm_min_eur           numeric default null,
  p_tjm_max_eur           numeric default null,
  p_experience_min_annees integer default null,
  p_missions              text    default null,
  p_remote_infos          text    default null,
  p_localisation          text    default null,
  p_must_have             jsonb   default null,
  p_nice_to_have          jsonb   default null,
  p_cle_idempotence       text    default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_compte  uuid := api.compte_id();
  v_lot     uuid := gen_random_uuid();
  v_rejeu   jsonb;
  v_statut  text;
  v_metier  uuid;
  v_univers uuid;
  v_avant   jsonb;
  v_apres   jsonb;
  v_n       integer;
  v_resultat jsonb;
begin
  if v_compte is null then
    raise exception 'aucun compte : la modification exige une session ouverte' using errcode = '42501';
  end if;
  if p_mandat_id is null then
    raise exception 'p_mandat_id est obligatoire' using errcode = '22004';
  end if;
  perform app.controler_brief(p_titre, p_metier_code, p_univers_code, p_contrat,
                              p_salaire_min_ke, p_salaire_max_ke,
                              p_tjm_min_eur, p_tjm_max_eur,
                              p_experience_min_annees, p_must_have, p_nice_to_have);

  select m.statut::text into v_statut from core.mandat m where m.id = p_mandat_id;
  if not found then
    raise exception 'mandat % introuvable dans votre périmètre', p_mandat_id using errcode = '42501';
  end if;
  if v_statut <> 'nouveau' then
    raise exception 'le mandat est en statut « % » : il n''est modifiable que tant qu''il est « nouveau ». Passez par votre Account Manager.', v_statut
      using errcode = '23514';
  end if;

  if p_metier_code is not null then
    select m.id into v_metier from ref.metier m where m.code = p_metier_code and m.actif;
    if not found then raise exception 'métier inconnu : « % »', p_metier_code using errcode = '23503'; end if;
  end if;
  if p_univers_code is not null then
    select u.id into v_univers from ref.univers u where u.code = p_univers_code and u.actif;
    if not found then raise exception 'univers inconnu : « % »', p_univers_code using errcode = '23503'; end if;
  end if;

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', p_mandat_id::text, p_titre, p_metier_code, p_univers_code, p_contrat,
                  p_salaire_min_ke::text, p_salaire_max_ke::text,
                  p_tjm_min_eur::text, p_tjm_max_eur::text,
                  p_experience_min_annees::text, p_missions, p_remote_infos,
                  p_localisation, p_must_have::text, p_nice_to_have::text)));
  if v_rejeu is not null then return v_rejeu; end if;

  select to_jsonb(x) into v_avant from (
    select m.titre, m.metier_id, m.univers_id, m.contrat, m.salaire_min_ke, m.salaire_max_ke,
           m.tjm_min_eur, m.tjm_max_eur, m.experience_min_annees, m.missions,
           m.remote_infos, m.localisation, m.must_have, m.nice_to_have
      from core.mandat m where m.id = p_mandat_id) x;

  update core.mandat
     set titre                 = btrim(p_titre),
         metier_id             = v_metier,
         univers_id            = v_univers,
         contrat               = p_contrat::ref.type_contrat,
         salaire_min_ke        = p_salaire_min_ke,
         salaire_max_ke        = p_salaire_max_ke,
         tjm_min_eur           = p_tjm_min_eur,
         tjm_max_eur           = p_tjm_max_eur,
         experience_min_annees = p_experience_min_annees::smallint,
         missions              = p_missions,
         remote_infos          = p_remote_infos,
         localisation          = p_localisation,
         must_have             = p_must_have,
         nice_to_have          = p_nice_to_have
   where id = p_mandat_id;
  if not found then
    raise exception 'mandat % non modifiable : hors de votre périmètre', p_mandat_id using errcode = '42501';
  end if;

  select to_jsonb(x) into v_apres from (
    select m.titre, m.metier_id, m.univers_id, m.contrat, m.salaire_min_ke, m.salaire_max_ke,
           m.tjm_min_eur, m.tjm_max_eur, m.experience_min_annees, m.missions,
           m.remote_infos, m.localisation, m.must_have, m.nice_to_have
      from core.mandat m where m.id = p_mandat_id) x;

  v_n := app.journaliser_diff(v_lot, 'core.mandat', p_mandat_id, v_avant, v_apres);

  v_resultat := jsonb_build_object('mandat_id', p_mandat_id, 'champs_modifies', v_n, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.maj_mandat(uuid,text,text,text,text,numeric,numeric,numeric,numeric,integer,text,text,text,jsonb,jsonb,text) is
  'Retoucher un brief tant qu''il est en statut « nouveau ». ⚠ Enregistre un FORMULAIRE ENTIER : un argument nul efface la valeur.';

-- ═══════════════════════════════════════════════════════════════════════
-- 8. api.demander_cloture_mandat
-- ═══════════════════════════════════════════════════════════════════════
-- DEMANDER, pas clore. Le statut ne bouge pas : clore un mandat engage une
-- facturation, c'est un acte du cabinet. La demande, elle, est datée et signée.
create or replace function api.demander_cloture_mandat(
  p_mandat_id       uuid,
  p_motif           text default null,
  p_cle_idempotence text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_compte  uuid := api.compte_id();
  v_lot     uuid := gen_random_uuid();
  v_rejeu   jsonb;
  v_statut  text;
  v_deja    timestamptz;
  v_ent     uuid;
  v_note    uuid;
  v_resultat jsonb;
begin
  if v_compte is null then
    raise exception 'aucun compte : la demande exige une session ouverte' using errcode = '42501';
  end if;
  if p_mandat_id is null then
    raise exception 'p_mandat_id est obligatoire' using errcode = '22004';
  end if;
  if length(coalesce(p_motif, '')) > 2000 then
    raise exception 'motif trop long : % caractères pour 2 000 au plus', length(p_motif)
      using errcode = '22001';
  end if;

  select m.statut::text, m.cloture_demandee_le, m.entreprise_id
    into v_statut, v_deja, v_ent
    from core.mandat m where m.id = p_mandat_id;
  if not found then
    raise exception 'mandat % introuvable dans votre périmètre', p_mandat_id using errcode = '42501';
  end if;
  if v_statut in ('termine','close_pachamama') then
    raise exception 'le mandat est déjà clos (statut « % »)', v_statut using errcode = '23514';
  end if;
  if v_deja is not null then
    raise exception 'une clôture a déjà été demandée le %', to_char(v_deja, 'DD/MM/YYYY')
      using errcode = '23505';
  end if;

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', p_mandat_id::text, p_motif)));
  if v_rejeu is not null then return v_rejeu; end if;

  update core.mandat
     set cloture_demandee_le            = now(),
         cloture_demandee_par_compte_id = v_compte
   where id = p_mandat_id;
  if not found then
    raise exception 'mandat % non modifiable : hors de votre périmètre', p_mandat_id using errcode = '42501';
  end if;

  -- Le motif n'a pas de colonne sur core.mandat : il vit comme note partagée,
  -- où l'Account Manager le lira. Créer une colonne pour un texte libre qu'une
  -- seule personne lira une fois serait du modèle inutile.
  if p_motif is not null and btrim(p_motif) <> '' then
    insert into core.note (mandat_id, entreprise_id, commentaire, ecrite_le,
                           visible_client, auteur_compte_id)
    values (p_mandat_id, v_ent, 'Demande de clôture du mandat.' || chr(10) || btrim(p_motif),
            now(), true, v_compte)
    returning id into v_note;
    perform app.journaliser(v_lot, 'core.note', v_note, 'insert', null, null,
      jsonb_build_object('mandat_id', p_mandat_id, 'visible_client', true));
  end if;

  perform app.journaliser(v_lot, 'core.mandat', p_mandat_id, 'update',
    'cloture_demandee_le', to_jsonb(v_deja), to_jsonb(now()));

  v_resultat := jsonb_build_object('mandat_id', p_mandat_id, 'note_id', v_note,
                                   'statut', v_statut, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.demander_cloture_mandat(uuid,text,text) is
  'Le client DEMANDE la clôture : cloture_demandee_le et cloture_demandee_par_compte_id sont datés et signés, le statut ne bouge pas. Clore engage une facturation — c''est un acte du cabinet.';

-- ═══════════════════════════════════════════════════════════════════════
-- 9. api.mettre_en_pause_mandat
-- ═══════════════════════════════════════════════════════════════════════
create or replace function api.mettre_en_pause_mandat(
  p_mandat_id       uuid,
  p_cle_idempotence text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_compte uuid := api.compte_id();
  v_lot    uuid := gen_random_uuid();
  v_rejeu  jsonb;
  v_statut text;
  v_resultat jsonb;
begin
  if v_compte is null then
    raise exception 'aucun compte : la mise en pause exige une session ouverte' using errcode = '42501';
  end if;
  if p_mandat_id is null then
    raise exception 'p_mandat_id est obligatoire' using errcode = '22004';
  end if;

  select m.statut::text into v_statut from core.mandat m where m.id = p_mandat_id;
  if not found then
    raise exception 'mandat % introuvable dans votre périmètre', p_mandat_id using errcode = '42501';
  end if;
  if v_statut = 'en_pause' then
    raise exception 'le mandat est déjà en pause' using errcode = '23505';
  end if;
  if v_statut not in ('nouveau','en_cours','reprise') then
    raise exception 'un mandat en statut « % » ne se met pas en pause', v_statut using errcode = '23514';
  end if;

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence, md5(p_mandat_id::text || '|pause'));
  if v_rejeu is not null then return v_rejeu; end if;

  update core.mandat
     set statut         = 'en_pause'::ref.statut_mandat,
         mis_en_pause_le = now()
   where id = p_mandat_id;
  if not found then
    raise exception 'mandat % non modifiable : hors de votre périmètre', p_mandat_id using errcode = '42501';
  end if;

  perform app.journaliser(v_lot, 'core.mandat', p_mandat_id, 'update',
    'statut', to_jsonb(v_statut), to_jsonb('en_pause'::text));

  v_resultat := jsonb_build_object('mandat_id', p_mandat_id, 'statut_avant', v_statut,
                                   'statut', 'en_pause', 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.mettre_en_pause_mandat(uuid,text) is
  'Met un mandat en pause. La contrainte mandat_pause_datee exige la date : elle est posée dans le même ordre.';

-- ═══════════════════════════════════════════════════════════════════════
-- LES DROITS D'EXÉCUTION — À LA MAIN, PARCE QUE `create or replace
-- function` VIENT DE RÉACCORDER EXECUTE À PUBLIC SUR CHACUNE.
-- Le déclencheur `securite.fermer_fonctions_nouvelles` ne couvre que `public`.
-- ═══════════════════════════════════════════════════════════════════════
do $$
declare
  v_sig text;
begin
  foreach v_sig in array array[
    'api.decider_candidature(uuid,text,text,text,text)',
    'api.commenter_candidature(uuid,text,text)',
    'api.maj_entreprise(text,text,text,text,text,text,text,text,integer,integer,text)',
    'api.maj_facturation(text,text,jsonb,text)',
    'api.maj_produit(uuid,text,text,text,text)',
    'api.creer_mandat(text,text,text,text,numeric,numeric,numeric,numeric,integer,text,text,text,jsonb,jsonb,text)',
    'api.maj_mandat(uuid,text,text,text,text,numeric,numeric,numeric,numeric,integer,text,text,text,jsonb,jsonb,text)',
    'api.demander_cloture_mandat(uuid,text,text)',
    'api.mettre_en_pause_mandat(uuid,text)',
    'app.controler_brief(text,text,text,text,numeric,numeric,numeric,numeric,integer,jsonb,jsonb)'
  ] loop
    execute format('revoke execute on function %s from public, anon', v_sig);
    execute format('grant  execute on function %s to authenticated, service_role', v_sig);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ── Contrôle ───────────────────────────────────────────────────────────
do $$
declare
  v_ouverte text;
begin
  select string_agg(p.proname, ', ') into v_ouverte
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'api'
     and p.proname in ('decider_candidature','commenter_candidature','maj_entreprise',
                       'maj_facturation','maj_produit','creer_mandat','maj_mandat',
                       'demander_cloture_mandat','mettre_en_pause_mandat')
     and has_function_privilege('anon', p.oid, 'execute');
  if v_ouverte is not null then
    raise exception 'fonctions d''écriture exécutables par anon : %', v_ouverte;
  end if;

  select string_agg(p.proname, ', ') into v_ouverte
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'api' and p.prosecdef
     and p.proname in ('decider_candidature','commenter_candidature','maj_entreprise',
                       'maj_facturation','maj_produit','creer_mandat','maj_mandat',
                       'demander_cloture_mandat','mettre_en_pause_mandat');
  if v_ouverte is not null then
    raise exception 'fonctions d''écriture en SECURITY DEFINER — l''ADR 0005 l''interdit : %', v_ouverte;
  end if;

  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'api'
         and p.proname in ('decider_candidature','commenter_candidature','maj_entreprise',
                           'maj_facturation','maj_produit','creer_mandat','maj_mandat',
                           'demander_cloture_mandat','mettre_en_pause_mandat')) <> 9 then
    raise exception 'les neuf fonctions d''écriture ne sont pas toutes en place';
  end if;
end $$;
