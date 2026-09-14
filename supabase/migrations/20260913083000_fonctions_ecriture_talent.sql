-- ═══════════════════════════════════════════════════════════════════════════
-- LES DOUZE FONCTIONS D'ÉCRITURE DE L'ESPACE TALENT — ADR 0005.
--
-- Le modèle, identique pour chacune, et identique à celui du portail
-- entreprise (20260912105000) :
--   security invoker           la RLS de l'appelant s'applique DANS la fonction
--   set search_path = ''       tout est qualifié, rien n'est capturable
--   validation d'abord         raise exception explicite, en français
--   colonnes nommées une à une jamais un update de ligne entière
--   app.journaliser            une ligne par champ changé, sous un lot_id
--   p_cle_idempotence          honorée via app.idempotence, dernier argument
--
-- ⚠ `create or replace function` RÉACCORDE EXECUTE À PUBLIC. Le déclencheur
-- d'événement `securite.fermer_fonctions_nouvelles` ne couvre que le schéma
-- `public`. Chaque fonction est donc suivie de sa révocation, en bas de
-- fichier, à la main. Le projet a déjà payé ce piège deux fois.
--
-- ── LES RÈGLES DE VALIDATION SONT ÉCRITES D'APRÈS LA DONNÉE MESURÉE ────
-- Sur les 7 023 fiches du dev, le 13/09 :
--
--   colonne          remplies   http(s)://   //hôte   autre
--   cv_url             3 926         0        3 926      0
--   photo_url          3 429        92        3 337      0
--   url_linkedin       5 675      5 468           0    207   « linkedin.com/in/… »
--   portfolio_url        737       657            0     80   « www.baruuu.fr »,
--                                                            « Disponible sur mon
--                                                              profil linkedin »
--
-- Un `^https?://` aurait fermé la porte à 3 926 personnes sur leur CV et à
-- 3 337 sur leur photo — c'est-à-dire à TOUTES celles qui en ont un. C'est
-- exactement le défaut réparé au J3 par D-17 (le SIREN) et par
-- 20260912109000 (les URLs de l'entreprise) : une règle écrite d'après ce
-- qu'on croit que la donnée contient.
--
--   cv_url, photo_url : pas d'espace, commence par http:// https:// // ou /
--                       → refuse 0 ligne sur 3 926 et 0 sur 3 429.
--   url_linkedin      : pas d'espace, au moins un point
--                       → refuse 34 lignes sur 5 675 : « ok », « t »,
--                         « test », trois prénoms. Ce sont des saisies
--                         accidentelles dans un champ LinkedIn, et la
--                         personne les a sous les yeux quand on les refuse.
--   portfolio_url     : LONGUEUR SEULEMENT. La mesure dit que ce champ porte
--                       de la prose (« à présenter en visio, trop de NDA
--                       signés »), deux liens dans une même case, et des mots
--                       de passe. Lui imposer une forme d'URL, ce serait
--                       écrire une règle contre la donnée.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- 0. LES DEUX OUTILS PARTAGÉS
-- ═══════════════════════════════════════════════════════════════════════
-- Dans `app` et non dans `api` : PostgREST expose `api`, et un utilitaire de
-- résolution n'a rien à faire sur le réseau.
create or replace function app.ma_fiche_unique() returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare v_fiche uuid;
begin
  if api.compte_id() is null then
    raise exception 'aucun compte : cette action exige une session ouverte'
      using errcode = '42501';
  end if;
  v_fiche := api.ma_fiche_talent();
  if v_fiche is null then
    raise exception 'aucune fiche talent n''est rattachée à ce compte'
      using errcode = '42501';
  end if;
  return v_fiche;
end $$;
revoke execute on function app.ma_fiche_unique() from public, anon;
grant  execute on function app.ma_fiche_unique() to authenticated, service_role;

-- Les bornes des attentes, écrites une fois pour maj_mes_attentes.
-- La convention « numeric pour l'argent, avec l'unité dans le nom » a été
-- posée APRÈS qu'une conversion €→K€ a gelé la synchronisation 43 jours.
-- Quelqu'un qui tape « 55000 » dans un champ nommé _ke doit être arrêté ici.
create or replace function app.controler_attentes_talent(
  p_salaire_min_ke numeric,
  p_salaire_max_ke numeric,
  p_tjm_min_eur    numeric,
  p_tjm_max_eur    numeric
) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
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
end $$;

comment on function app.controler_attentes_talent(numeric,numeric,numeric,numeric) is
  'Les bornes des prétentions d''un talent, écrites une fois. ⚠ 21 fiches portent déjà attentes_salaire_min_ke > max : ces personnes devront corriger leur fourchette pour enregistrer, et c''est bien le but.';

-- ═══════════════════════════════════════════════════════════════════════
-- 1. api.maj_ma_fiche — identité et coordonnées
-- ═══════════════════════════════════════════════════════════════════════
-- LE CONTRAT DES FONCTIONS « maj_ » : ELLES ENREGISTRENT UN FORMULAIRE
-- ENTIER. Un argument nul EFFACE la valeur. Même contrat que
-- `api.maj_entreprise`, et pour la même raison : en SQL, une fonction ne
-- distingue pas « non fourni » de « mis à NULL ».
--
-- HORS LISTE, ET AUCUN GRANT NE LES COUVRE : est_qualifie, statut_relation,
-- agent_referent_id, seniorite, mindset, emoji_statut, score_completude,
-- champs_manquants, fiche_complete, resume_ia, niveau_anglais, genre, ecole,
-- les 8 colonnes poste_actuel_*, univers_id, apporteur_affaires_id,
-- date_dernier_contact, anonymise_le. Le déclencheur
-- core.frontiere_declarative_fiche_talent les refuse une deuxième fois.
create or replace function api.maj_ma_fiche(
  p_prenom             text default null,
  p_nom                text default null,
  p_email_personnel    text default null,
  p_telephone          text default null,
  p_url_linkedin       text default null,
  p_localisation_texte text default null,
  p_photo_url          text default null,
  p_cv_url             text default null,
  p_portfolio_url      text default null,
  p_cle_idempotence    text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_fiche     uuid;
  v_lot       uuid := gen_random_uuid();
  v_rejeu     jsonb;
  v_avant     jsonb;
  v_apres     jsonb;
  v_n         integer;
  v_resultat  jsonb;
  -- Rognées AVANT contrôle : une valeur de la base portait un espace final
  -- et se voyait refuser sa propre donnée (20260912109000).
  v_prenom    text := nullif(btrim(coalesce(p_prenom, '')), '');
  v_nom       text := nullif(btrim(coalesce(p_nom, '')), '');
  v_email     text := nullif(btrim(lower(coalesce(p_email_personnel, ''))), '');
  v_tel       text := nullif(btrim(coalesce(p_telephone, '')), '');
  v_linkedin  text := nullif(btrim(coalesce(p_url_linkedin, '')), '');
  v_lieu      text := nullif(btrim(coalesce(p_localisation_texte, '')), '');
  v_photo     text := nullif(btrim(coalesce(p_photo_url, '')), '');
  v_cv        text := nullif(btrim(coalesce(p_cv_url, '')), '');
  v_portfolio text := nullif(btrim(coalesce(p_portfolio_url, '')), '');
  v_cv_avant  text;
begin
  v_fiche := app.ma_fiche_unique();

  -- ── validation ────────────────────────────────────────────────────
  -- Le prénom et le nom sont exigés : c'est sous ce nom que le cabinet
  -- présente quelqu'un à un client (D-14), et une fiche sans nom n'est
  -- présentable à personne. 51 fiches ont un prénom vide et 56 un nom vide ;
  -- ces personnes devront le saisir — c'est le champ qu'elles ont sous les
  -- yeux, pas un SIRET oublié (D-17).
  if v_prenom is null then
    raise exception 'le prénom est obligatoire' using errcode = '22004';
  end if;
  if v_nom is null then
    raise exception 'le nom est obligatoire' using errcode = '22004';
  end if;
  if length(v_prenom) > 120 or length(v_nom) > 120 then
    raise exception 'prénom et nom : 120 caractères au plus' using errcode = '22001';
  end if;
  -- La contrainte fiche_email_arobase exige position('@') > 1. On la double
  -- ici pour rendre un message lisible au lieu d'un 23514.
  if v_email is not null and (position('@' in v_email) <= 1
                              or v_email ~ '\s' or length(v_email) > 320) then
    raise exception 'p_email_personnel : une adresse électronique — reçu « % »', v_email
      using errcode = '22023';
  end if;
  if v_tel is not null and length(v_tel) > 40 then
    raise exception 'p_telephone : 40 caractères au plus' using errcode = '22001';
  end if;
  if v_linkedin is not null
     and (v_linkedin ~ '\s' or v_linkedin !~ '\.' or length(v_linkedin) > 500) then
    raise exception 'p_url_linkedin : une adresse sans espace et comportant un point — reçu « % »', v_linkedin
      using errcode = '22023';
  end if;
  if v_lieu is not null and length(v_lieu) > 300 then
    raise exception 'p_localisation_texte : 300 caractères au plus' using errcode = '22001';
  end if;
  -- La forme mesurée : `//hôte/...` sur 3 337 photos et 3 926 CV.
  if v_photo is not null
     and (v_photo ~ '\s' or v_photo !~* '^(https?:)?//|^/' or length(v_photo) > 1000) then
    raise exception 'p_photo_url : une URL http://, https://, //hôte ou /chemin — reçu « % »', v_photo
      using errcode = '22023';
  end if;
  if v_cv is not null
     and (v_cv ~ '\s' or v_cv !~* '^(https?:)?//|^/' or length(v_cv) > 1000) then
    raise exception 'p_cv_url : une URL http://, https://, //hôte ou /chemin — reçu « % »', v_cv
      using errcode = '22023';
  end if;
  -- Le portfolio accepte de la prose : c'est ce que la base contient.
  if v_portfolio is not null and length(v_portfolio) > 1000 then
    raise exception 'p_portfolio_url : 1 000 caractères au plus' using errcode = '22001';
  end if;

  -- ── idempotence, AVANT toute écriture ─────────────────────────────
  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', v_fiche::text, v_prenom, v_nom, v_email, v_tel,
                  v_linkedin, v_lieu, v_photo, v_cv, v_portfolio)));
  if v_rejeu is not null then return v_rejeu; end if;

  select to_jsonb(x), x.cv_url into v_avant, v_cv_avant from (
    select f.prenom, f.nom, f.email_personnel, f.telephone, f.url_linkedin,
           f.localisation_texte, f.photo_url, f.cv_url, f.portfolio_url
      from core.fiche_talent f where f.id = v_fiche) x;
  if v_avant is null then
    raise exception 'fiche % illisible : la policy de lecture ne la couvre pas', v_fiche
      using errcode = '42501';
  end if;

  update core.fiche_talent
     set prenom               = v_prenom,
         nom                  = v_nom,
         email_personnel      = v_email,
         telephone            = v_tel,
         url_linkedin         = v_linkedin,
         localisation_texte   = v_lieu,
         photo_url            = v_photo,
         cv_url               = v_cv,
         portfolio_url        = v_portfolio,
         -- L'origine dit d'où vient la valeur. `declare` = de la personne
         -- elle-même, et c'est ce qui permettra plus tard de ne pas écraser
         -- une saisie humaine par un import.
         prenom_origine       = 'declare'::ref.origine_valeur,
         nom_origine          = 'declare'::ref.origine_valeur,
         email_origine        = 'declare'::ref.origine_valeur,
         telephone_origine    = 'declare'::ref.origine_valeur,
         url_linkedin_origine = 'declare'::ref.origine_valeur,
         localisation_origine = 'declare'::ref.origine_valeur,
         photo_origine        = 'declare'::ref.origine_valeur,
         cv_origine           = 'declare'::ref.origine_valeur,
         portfolio_origine    = 'declare'::ref.origine_valeur,
         -- Un CV nouveau est un CV daté ; un CV inchangé garde sa date.
         cv_depose_le         = case when v_cv is null then null
                                     when v_cv is distinct from v_cv_avant then now()
                                     else cv_depose_le end,
         modifie_par_le_talent_le = now()
   where id = v_fiche;
  if not found then
    raise exception 'fiche % non modifiable : hors de votre périmètre', v_fiche
      using errcode = '42501';
  end if;

  select to_jsonb(x) into v_apres from (
    select f.prenom, f.nom, f.email_personnel, f.telephone, f.url_linkedin,
           f.localisation_texte, f.photo_url, f.cv_url, f.portfolio_url
      from core.fiche_talent f where f.id = v_fiche) x;

  v_n := app.journaliser_diff(v_lot, 'core.fiche_talent', v_fiche, v_avant, v_apres);

  v_resultat := jsonb_build_object('fiche_talent_id', v_fiche,
                                   'champs_modifies', v_n, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.maj_ma_fiche(text,text,text,text,text,text,text,text,text,text) is
  'Identité et coordonnées, telles que la personne les déclare. Liste blanche de neuf colonnes + leurs origines. ⚠ Enregistre un FORMULAIRE ENTIER : un argument nul efface la valeur.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2. api.maj_mes_attentes — ce qu'elle cherche
-- ═══════════════════════════════════════════════════════════════════════
create or replace function api.maj_mes_attentes(
  p_metier_code          text    default null,
  p_univers_code         text    default null,
  p_salaire_min_ke       numeric default null,
  p_salaire_max_ke       numeric default null,
  p_tjm_min_eur          numeric default null,
  p_tjm_max_eur          numeric default null,
  p_disponibilite_texte  text    default null,
  p_localisation_texte   text    default null,
  p_description          text    default null,
  p_recherche_active     boolean default null,
  p_cle_idempotence      text    default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_fiche      uuid;
  v_lot        uuid := gen_random_uuid();
  v_rejeu      jsonb;
  v_avant      jsonb;
  v_apres      jsonb;
  v_n          integer;
  v_resultat   jsonb;
  v_metier_id  uuid;
  v_univers_id uuid;
  v_dispo      text := nullif(btrim(coalesce(p_disponibilite_texte, '')), '');
  v_lieu       text := nullif(btrim(coalesce(p_localisation_texte, '')), '');
  v_desc       text := nullif(btrim(coalesce(p_description, '')), '');
begin
  v_fiche := app.ma_fiche_unique();

  perform app.controler_attentes_talent(p_salaire_min_ke, p_salaire_max_ke,
                                        p_tjm_min_eur, p_tjm_max_eur);

  if p_metier_code is not null then
    select m.id into v_metier_id from ref.metier m
     where m.code = p_metier_code and m.actif and m.fusionne_vers_id is null;
    if v_metier_id is null then
      raise exception 'métier inconnu ou fusionné : « % » — voir api.mon_referentiel', p_metier_code
        using errcode = '23503';
    end if;
  end if;
  if p_univers_code is not null then
    select u.id into v_univers_id from ref.univers u
     where u.code = p_univers_code and u.actif;
    if v_univers_id is null then
      raise exception 'univers inconnu : « % » — voir api.mon_referentiel', p_univers_code
        using errcode = '23503';
    end if;
  end if;
  if length(coalesce(v_desc, '')) > 10000 then
    raise exception 'description trop longue : % caractères pour 10 000 au plus', length(v_desc)
      using errcode = '22001';
  end if;
  if length(coalesce(v_dispo, '')) > 500 or length(coalesce(v_lieu, '')) > 500 then
    raise exception 'disponibilité et localisation : 500 caractères au plus' using errcode = '22001';
  end if;

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', v_fiche::text, p_metier_code, p_univers_code,
                  p_salaire_min_ke::text, p_salaire_max_ke::text,
                  p_tjm_min_eur::text, p_tjm_max_eur::text,
                  v_dispo, v_lieu, v_desc, p_recherche_active::text)));
  if v_rejeu is not null then return v_rejeu; end if;

  select to_jsonb(x) into v_avant from (
    select f.attentes_metier_id, f.attentes_univers_id,
           f.attentes_salaire_min_ke, f.attentes_salaire_max_ke,
           f.attentes_tjm_min_eur, f.attentes_tjm_max_eur,
           f.attentes_disponibilite_texte, f.attentes_localisation_texte,
           f.attentes_description, f.recherche_active
      from core.fiche_talent f where f.id = v_fiche) x;
  if v_avant is null then
    raise exception 'fiche % illisible', v_fiche using errcode = '42501';
  end if;

  update core.fiche_talent
     set attentes_metier_id           = v_metier_id,
         attentes_univers_id          = v_univers_id,
         attentes_salaire_min_ke      = p_salaire_min_ke,
         attentes_salaire_max_ke      = p_salaire_max_ke,
         attentes_tjm_min_eur         = p_tjm_min_eur,
         attentes_tjm_max_eur         = p_tjm_max_eur,
         attentes_disponibilite_texte = v_dispo,
         attentes_localisation_texte  = v_lieu,
         attentes_description         = v_desc,
         -- Formulaire entier, ici aussi : un p_recherche_active nul remet la
         -- colonne à NULL, c'est-à-dire « non renseigné ». L'écran doit donc
         -- toujours envoyer l'état du bouton, jamais l'omettre.
         recherche_active             = p_recherche_active,
         attentes_origine             = 'declare'::ref.origine_valeur,
         modifie_par_le_talent_le     = now()
   where id = v_fiche;
  if not found then
    raise exception 'fiche % non modifiable', v_fiche using errcode = '42501';
  end if;

  select to_jsonb(x) into v_apres from (
    select f.attentes_metier_id, f.attentes_univers_id,
           f.attentes_salaire_min_ke, f.attentes_salaire_max_ke,
           f.attentes_tjm_min_eur, f.attentes_tjm_max_eur,
           f.attentes_disponibilite_texte, f.attentes_localisation_texte,
           f.attentes_description, f.recherche_active
      from core.fiche_talent f where f.id = v_fiche) x;

  v_n := app.journaliser_diff(v_lot, 'core.fiche_talent', v_fiche, v_avant, v_apres);
  v_resultat := jsonb_build_object('fiche_talent_id', v_fiche,
                                   'champs_modifies', v_n, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.maj_mes_attentes(text,text,numeric,numeric,numeric,numeric,text,text,text,boolean,text) is
  'Le job rêvé : métier et univers visés, fourchettes, disponibilité, localisation, description, et le mode passif (recherche_active). ⚠ Formulaire entier.';

-- ═══════════════════════════════════════════════════════════════════════
-- 3. api.maj_mes_listes — les six listes déclaratives
-- ═══════════════════════════════════════════════════════════════════════
-- Un seul point d'entrée pour six satellites, parce qu'ils ont tous la même
-- forme (une clé, une liste de codes) et le même geste (remplacer la liste).
--
-- ⚠ `fiche_talent_tag` N'EN EST PAS. Un tag porte `pose_par_compte_id` : il
-- est posé PAR le cabinet SUR la personne. Aucun `p_type` ne l'atteint, et
-- aucun GRANT ne le couvre.
--
-- LE SECTEUR À LA FOIS VISÉ ET NO-GO EST REFUSÉ. `core.v_secteur_vise_et_nogo`
-- en signale 4 en base : ce sont des reprises Bubble, pas des saisies. Les
-- personnes concernées devront retirer le secteur d'une des deux listes avant
-- d'enregistrer l'autre, et le message dit lequel.
create or replace function api.maj_mes_listes(
  p_type            text,
  p_codes           text[],
  p_cle_idempotence text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_fiche    uuid;
  v_lot      uuid := gen_random_uuid();
  v_rejeu    jsonb;
  v_codes    text[];
  v_avant    text[];
  v_apres    text[];
  v_conflit  text;
  v_inconnu  text;
  v_resultat jsonb;
  v_n_avant  integer;
  v_n_apres  integer;
begin
  v_fiche := app.ma_fiche_unique();

  if p_type is null or p_type not in ('secteur_vise','secteur_nogo','critere',
                                      'contrat','remote','expertise') then
    raise exception 'p_type vaut « secteur_vise », « secteur_nogo », « critere », « contrat », « remote » ou « expertise » — reçu « % »',
      coalesce(p_type, 'NULL') using errcode = '22023';
  end if;

  -- Dédoublonnage et nettoyage : une liste envoyée deux fois le même code
  -- ferait sauter la clé primaire du satellite.
  select coalesce(array_agg(distinct c order by c), '{}'::text[]) into v_codes
    from unnest(coalesce(p_codes, '{}'::text[])) c
   where nullif(btrim(c), '') is not null;

  if array_length(v_codes, 1) > 50 then
    raise exception 'liste trop longue : % codes pour 50 au plus', array_length(v_codes, 1)
      using errcode = '22001';
  end if;

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', v_fiche::text, p_type, array_to_string(v_codes, ','))));
  if v_rejeu is not null then return v_rejeu; end if;

  -- ── un aiguillage par satellite ───────────────────────────────────
  if p_type in ('secteur_vise','secteur_nogo') then
    select string_agg(c, ', ') into v_inconnu from unnest(v_codes) c
     where not exists (select 1 from ref.secteur s where s.code = c and s.actif);
    if v_inconnu is not null then
      raise exception 'secteur(s) inconnu(s) : % — voir api.mon_referentiel', v_inconnu
        using errcode = '23503';
    end if;

    -- La règle croisée, éprouvée contre la liste STOCKÉE de l'autre côté.
    if p_type = 'secteur_vise' then
      select string_agg(s.libelle_fr, ', ') into v_conflit
        from core.fiche_talent_secteur_nogo fn
        join ref.secteur s on s.id = fn.secteur_id
       where fn.fiche_talent_id = v_fiche and s.code = any (v_codes);
    else
      select string_agg(s.libelle_fr, ', ') into v_conflit
        from core.fiche_talent_secteur_vise fv
        join ref.secteur s on s.id = fv.secteur_id
       where fv.fiche_talent_id = v_fiche and s.code = any (v_codes);
    end if;
    if v_conflit is not null then
      raise exception 'un secteur ne peut pas être à la fois visé et no-go : % — retirez-le de l''autre liste d''abord',
        v_conflit using errcode = '23514';
    end if;
  end if;

  if p_type = 'secteur_vise' then
    select coalesce(array_agg(s.code order by s.code), '{}') into v_avant
      from core.fiche_talent_secteur_vise fv join ref.secteur s on s.id = fv.secteur_id
     where fv.fiche_talent_id = v_fiche;
    delete from core.fiche_talent_secteur_vise where fiche_talent_id = v_fiche;
    insert into core.fiche_talent_secteur_vise (fiche_talent_id, secteur_id, origine)
    select v_fiche, s.id, 'declare'::ref.origine_valeur
      from ref.secteur s where s.code = any (v_codes) and s.actif;

  elsif p_type = 'secteur_nogo' then
    select coalesce(array_agg(s.code order by s.code), '{}') into v_avant
      from core.fiche_talent_secteur_nogo fn join ref.secteur s on s.id = fn.secteur_id
     where fn.fiche_talent_id = v_fiche;
    delete from core.fiche_talent_secteur_nogo where fiche_talent_id = v_fiche;
    insert into core.fiche_talent_secteur_nogo (fiche_talent_id, secteur_id, origine)
    select v_fiche, s.id, 'declare'::ref.origine_valeur
      from ref.secteur s where s.code = any (v_codes) and s.actif;

  elsif p_type = 'critere' then
    select string_agg(c, ', ') into v_inconnu from unnest(v_codes) c
     where not exists (select 1 from ref.critere r where r.code = c and r.actif);
    if v_inconnu is not null then
      raise exception 'critère(s) inconnu(s) : % — voir api.mon_referentiel', v_inconnu
        using errcode = '23503';
    end if;
    select coalesce(array_agg(r.code order by r.code), '{}') into v_avant
      from core.fiche_talent_critere fc join ref.critere r on r.id = fc.critere_id
     where fc.fiche_talent_id = v_fiche;
    delete from core.fiche_talent_critere where fiche_talent_id = v_fiche;
    insert into core.fiche_talent_critere (fiche_talent_id, critere_id, origine)
    select v_fiche, r.id, 'declare'::ref.origine_valeur
      from ref.critere r where r.code = any (v_codes) and r.actif;

  elsif p_type = 'expertise' then
    select string_agg(c, ', ') into v_inconnu from unnest(v_codes) c
     where not exists (select 1 from ref.expertise x
                        where x.code = c and x.actif and x.fusionne_vers_id is null);
    if v_inconnu is not null then
      raise exception 'expertise(s) inconnue(s) : % — voir api.mon_referentiel', v_inconnu
        using errcode = '23503';
    end if;
    select coalesce(array_agg(x.code order by x.code), '{}') into v_avant
      from core.fiche_talent_expertise fe join ref.expertise x on x.id = fe.expertise_id
     where fe.fiche_talent_id = v_fiche;
    delete from core.fiche_talent_expertise where fiche_talent_id = v_fiche;
    insert into core.fiche_talent_expertise (fiche_talent_id, expertise_id, origine)
    select v_fiche, x.id, 'declare'::ref.origine_valeur
      from ref.expertise x
     where x.code = any (v_codes) and x.actif and x.fusionne_vers_id is null;

  elsif p_type = 'contrat' then
    -- Un ENUM, pas une table : on éprouve le code contre ref.libelle, qui
    -- porte le vocabulaire, et le cast fera foi.
    select string_agg(c, ', ') into v_inconnu from unnest(v_codes) c
     where not exists (select 1 from ref.libelle l
                        where l.domaine = 'type_contrat' and l.code = c and l.actif);
    if v_inconnu is not null then
      raise exception 'type(s) de contrat inconnu(s) : % — voir api.mon_referentiel', v_inconnu
        using errcode = '23503';
    end if;
    select coalesce(array_agg(ct.contrat::text order by ct.contrat::text), '{}') into v_avant
      from core.fiche_talent_contrat_souhaite ct where ct.fiche_talent_id = v_fiche;
    delete from core.fiche_talent_contrat_souhaite where fiche_talent_id = v_fiche;
    insert into core.fiche_talent_contrat_souhaite (fiche_talent_id, contrat, origine)
    select v_fiche, c::ref.type_contrat, 'declare'::ref.origine_valeur
      from unnest(v_codes) c;

  else  -- 'remote'
    -- Les valeurs `*_legacy` sont exclues : elles viennent de la reprise
    -- Bubble et api.mon_referentiel ne les propose pas.
    select string_agg(c, ', ') into v_inconnu from unnest(v_codes) c
     where not exists (select 1 from ref.libelle l
                        where l.domaine = 'rythme_remote' and l.code = c
                          and l.actif and l.code not like '%_legacy');
    if v_inconnu is not null then
      raise exception 'rythme(s) de remote inconnu(s) : % — voir api.mon_referentiel', v_inconnu
        using errcode = '23503';
    end if;
    select coalesce(array_agg(rm.remote::text order by rm.remote::text), '{}') into v_avant
      from core.fiche_talent_remote_souhaite rm where rm.fiche_talent_id = v_fiche;
    delete from core.fiche_talent_remote_souhaite where fiche_talent_id = v_fiche;
    insert into core.fiche_talent_remote_souhaite (fiche_talent_id, remote, origine)
    select v_fiche, c::ref.rythme_remote, 'declare'::ref.origine_valeur
      from unnest(v_codes) c;
  end if;

  v_apres    := v_codes;
  v_n_avant  := coalesce(array_length(v_avant, 1), 0);
  v_n_apres  := coalesce(array_length(v_apres, 1), 0);

  -- Une liste est UN champ : une seule ligne de journal, avec l'avant et
  -- l'après en toutes lettres.
  perform app.journaliser(v_lot, 'core.fiche_talent_' || p_type, v_fiche, 'update',
                          p_type, to_jsonb(v_avant), to_jsonb(v_apres));

  update core.fiche_talent set modifie_par_le_talent_le = now() where id = v_fiche;

  v_resultat := jsonb_build_object('fiche_talent_id', v_fiche, 'type', p_type,
                                   'avant', to_jsonb(v_avant), 'apres', to_jsonb(v_apres),
                                   'nombre_avant', v_n_avant, 'nombre_apres', v_n_apres,
                                   'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.maj_mes_listes(text,text[],text) is
  'Remplace UNE des six listes déclaratives : secteur_vise, secteur_nogo, critere, contrat, remote, expertise. Refuse un code inconnu, et refuse un secteur à la fois visé et no-go. fiche_talent_tag est délibérément hors d''atteinte : un tag est un acte du cabinet.';

-- ═══════════════════════════════════════════════════════════════════════
-- 4. api.postuler
-- ═══════════════════════════════════════════════════════════════════════
-- LE DOUBLON EST REFUSÉ. `core.v_candidature_en_double` en compte 109 en
-- base : ce sont des reprises Bubble, et personne n'en fabriquera de
-- nouvelles par cette porte. Le refus nomme la candidature existante pour
-- que l'écran puisse y renvoyer plutôt que d'afficher une erreur muette.
--
-- L'OFFRE DOIT ÊTRE PUBLIÉE. On ne postule pas à un mandat qu'on n'a pas pu
-- lire : la policy `talent_offres_publiees` n'ouvre que les mandats de
-- `app.mandat_publication`, et la vérification est refaite ici explicitement.
--
-- `entreprise_id` N'EST PAS PASSÉE. Le déclencheur
-- core.candidature_entreprise_du_mandat la déduit du mandat. Sans cela, un
-- talent pourrait déposer sa candidature dans le pipeline du client de son
-- choix — la colonne n'est d'ailleurs pas dans le GRANT INSERT.
create or replace function api.postuler(
  p_mandat_id       uuid,
  p_message         text default null,
  p_cle_idempotence text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_fiche      uuid;
  v_lot        uuid := gen_random_uuid();
  v_rejeu      jsonb;
  v_etape      uuid;
  v_existante  uuid;
  v_publiee    boolean;
  v_candidature uuid;
  v_pseudo     text;
  v_note       uuid;
  v_message    text := nullif(btrim(coalesce(p_message, '')), '');
  v_resultat   jsonb;
begin
  v_fiche := app.ma_fiche_unique();

  if p_mandat_id is null then
    raise exception 'p_mandat_id est obligatoire — pour une candidature sans offre, employer api.candidature_spontanee'
      using errcode = '22004';
  end if;
  if length(coalesce(v_message, '')) > 5000 then
    raise exception 'message trop long : % caractères pour 5 000 au plus', length(v_message)
      using errcode = '22001';
  end if;

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', v_fiche::text, p_mandat_id::text, v_message)));
  if v_rejeu is not null then return v_rejeu; end if;

  -- L'offre existe, et elle est publiée — lu sous la RLS de l'appelant.
  select exists (select 1 from app.mandat_publication p
                  where p.mandat_id = p_mandat_id and p.retire_le is null
                    and p.canal = 'job_board_public')
    into v_publiee;
  if not exists (select 1 from core.mandat m where m.id = p_mandat_id) then
    raise exception 'offre % introuvable', p_mandat_id using errcode = '42501';
  end if;
  if not v_publiee then
    raise exception 'l''offre % n''est plus publiée : la candidature est refusée', p_mandat_id
      using errcode = '23514';
  end if;

  -- Le doublon, nommé.
  select c.id into v_existante from core.candidature c
   where c.fiche_talent_id = v_fiche and c.mandat_id = p_mandat_id
   order by c.cree_le limit 1;
  if v_existante is not null then
    raise exception 'vous avez déjà postulé à cette offre (candidature %)', v_existante
      using errcode = '23505';
  end if;

  select ep.id into v_etape from ref.etape_process ep where ep.code = 'applicant';
  if v_etape is null then
    raise exception 'étape « applicant » absente de ref.etape_process' using errcode = '23503';
  end if;

  insert into core.candidature (fiche_talent_id, mandat_id, etape_id, est_spontanee,
                                cree_par_fiche_talent_id, date_entree_pipeline,
                                date_dernier_changement_etape)
  values (v_fiche, p_mandat_id, v_etape, false, v_fiche, now(), now())
  returning id, reference_pseudonyme into v_candidature, v_pseudo;

  -- Le message d'accompagnement atterrit dans une note signée de la fiche,
  -- visible du talent, NON visible du client : le partager au client est une
  -- décision distincte, et elle appartient au cabinet (miroir de D-04).
  if v_message is not null then
    insert into core.note (fiche_talent_id, candidature_id, mandat_id, commentaire,
                           ecrite_le, visible_talent, visible_client,
                           auteur_fiche_talent_id)
    values (v_fiche, v_candidature, p_mandat_id, v_message, now(), true, false, v_fiche)
    returning id into v_note;
  end if;

  perform app.journaliser(v_lot, 'core.candidature', v_candidature, 'insert', null, null,
    jsonb_build_object('mandat_id', p_mandat_id, 'etape', 'applicant',
                       'est_spontanee', false, 'reference_pseudonyme', v_pseudo));
  if v_note is not null then
    perform app.journaliser(v_lot, 'core.note', v_note, 'insert', null, null,
      jsonb_build_object('candidature_id', v_candidature, 'visible_talent', true));
  end if;

  v_resultat := jsonb_build_object('candidature_id', v_candidature,
                                   'reference_pseudonyme', v_pseudo,
                                   'etape', 'applicant', 'note_id', v_note,
                                   'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.postuler(uuid,text,text) is
  'Une candidature à une offre PUBLIÉE, à l''étape applicant. Refuse le doublon en le nommant. reference_pseudonyme est posée par le déclencheur candidature_reference_pseudonyme, entreprise_id par candidature_entreprise_du_mandat.';

-- ═══════════════════════════════════════════════════════════════════════
-- 5. api.candidature_spontanee
-- ═══════════════════════════════════════════════════════════════════════
-- `candidature_spontanee_sans_mandat` l'exige : est_spontanee ⇒ mandat_id nul.
-- Une seule candidature spontanée ouverte à la fois — la deuxième n'apporte
-- rien et encombrerait le poste de travail du recruteur.
create or replace function api.candidature_spontanee(
  p_message         text default null,
  p_cle_idempotence text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_fiche       uuid;
  v_lot         uuid := gen_random_uuid();
  v_rejeu       jsonb;
  v_etape       uuid;
  v_ouverte     uuid;
  v_candidature uuid;
  v_pseudo      text;
  v_note        uuid;
  v_message     text := nullif(btrim(coalesce(p_message, '')), '');
  v_resultat    jsonb;
begin
  v_fiche := app.ma_fiche_unique();

  if length(coalesce(v_message, '')) > 5000 then
    raise exception 'message trop long : % caractères pour 5 000 au plus', length(v_message)
      using errcode = '22001';
  end if;

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', v_fiche::text, 'spontanee', v_message)));
  if v_rejeu is not null then return v_rejeu; end if;

  select c.id into v_ouverte
    from core.candidature c join ref.etape_process ep on ep.id = c.etape_id
   where c.fiche_talent_id = v_fiche and c.est_spontanee and not ep.est_terminale
   order by c.cree_le limit 1;
  if v_ouverte is not null then
    raise exception 'une candidature spontanée est déjà en cours (candidature %)', v_ouverte
      using errcode = '23505';
  end if;

  select ep.id into v_etape from ref.etape_process ep where ep.code = 'applicant';
  if v_etape is null then
    raise exception 'étape « applicant » absente de ref.etape_process' using errcode = '23503';
  end if;

  insert into core.candidature (fiche_talent_id, mandat_id, etape_id, est_spontanee,
                                cree_par_fiche_talent_id, date_entree_pipeline,
                                date_dernier_changement_etape)
  values (v_fiche, null, v_etape, true, v_fiche, now(), now())
  returning id, reference_pseudonyme into v_candidature, v_pseudo;

  if v_message is not null then
    insert into core.note (fiche_talent_id, candidature_id, commentaire, ecrite_le,
                           visible_talent, visible_client, auteur_fiche_talent_id)
    values (v_fiche, v_candidature, v_message, now(), true, false, v_fiche)
    returning id into v_note;
  end if;

  perform app.journaliser(v_lot, 'core.candidature', v_candidature, 'insert', null, null,
    jsonb_build_object('mandat_id', null, 'etape', 'applicant',
                       'est_spontanee', true, 'reference_pseudonyme', v_pseudo));
  if v_note is not null then
    perform app.journaliser(v_lot, 'core.note', v_note, 'insert', null, null,
      jsonb_build_object('candidature_id', v_candidature, 'visible_talent', true));
  end if;

  v_resultat := jsonb_build_object('candidature_id', v_candidature,
                                   'reference_pseudonyme', v_pseudo,
                                   'etape', 'applicant', 'est_spontanee', true,
                                   'note_id', v_note, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.candidature_spontanee(text,text) is
  'Une candidature sans offre. Une seule ouverte à la fois. est_spontanee = true et mandat_id nul, comme candidature_spontanee_sans_mandat l''exige.';

-- ═══════════════════════════════════════════════════════════════════════
-- 6. api.retirer_ma_candidature
-- ═══════════════════════════════════════════════════════════════════════
-- Le motif vient de `ref.motif_ko` CATÉGORIE `candidat` — 7 codes. Un motif
-- du registre `pachamama` ou `client` est refusé : ce ne sont pas les mots de
-- la personne, et les employer ici brouillerait la lecture du funnel.
create or replace function api.retirer_ma_candidature(
  p_candidature_id  uuid,
  p_motif_code      text,
  p_commentaire     text default null,
  p_cle_idempotence text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_fiche       uuid;
  v_lot         uuid := gen_random_uuid();
  v_rejeu       jsonb;
  v_etape_avant uuid;
  v_code_avant  text;
  v_terminale   boolean;
  v_cible       uuid;
  v_libelle     text;
  v_commentaire text := nullif(btrim(coalesce(p_commentaire, '')), '');
  v_resultat    jsonb;
begin
  v_fiche := app.ma_fiche_unique();

  if p_candidature_id is null then
    raise exception 'p_candidature_id est obligatoire' using errcode = '22004';
  end if;
  if p_motif_code is null then
    raise exception 'un retrait exige un motif : p_motif_code est obligatoire' using errcode = '23514';
  end if;
  select m.libelle_fr into v_libelle from ref.motif_ko m
   where m.code = p_motif_code and m.actif and m.categorie = 'candidat';
  if v_libelle is null then
    raise exception 'motif inconnu ou hors du registre candidat : « % » — voir api.mon_referentiel (referentiel = motif_retrait)',
      p_motif_code using errcode = '23503';
  end if;
  if length(coalesce(v_commentaire, '')) > 5000 then
    raise exception 'commentaire trop long : % caractères pour 5 000 au plus', length(v_commentaire)
      using errcode = '22001';
  end if;

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', p_candidature_id::text, p_motif_code, v_commentaire)));
  if v_rejeu is not null then return v_rejeu; end if;

  select c.etape_id, ep.code, ep.est_terminale
    into v_etape_avant, v_code_avant, v_terminale
    from core.candidature c
    left join ref.etape_process ep on ep.id = c.etape_id
   where c.id = p_candidature_id and c.fiche_talent_id = v_fiche;
  if not found then
    raise exception 'candidature % introuvable dans votre périmètre', p_candidature_id
      using errcode = '42501';
  end if;
  if coalesce(v_terminale, false) then
    raise exception 'cette candidature est déjà close (étape « % ») : il n''y a rien à retirer', v_code_avant
      using errcode = '23514';
  end if;

  select ep.id into v_cible from ref.etape_process ep where ep.code = 'ko_by_candidat';
  if v_cible is null then
    raise exception 'étape « ko_by_candidat » absente de ref.etape_process' using errcode = '23503';
  end if;

  -- La transition s'inscrit : `app.origine_transition` porte la valeur
  -- `talent`, posée pour ce cas exact. D-03 fait dépendre de ce remplissage
  -- la correction du filtre de visibilité côté client.
  insert into app.transition_etape (candidature_id, etape_avant_id, etape_apres_id,
                                    origine, auteur_compte_id, motif_ko_code, commentaire)
  values (p_candidature_id, v_etape_avant, v_cible,
          'talent'::app.origine_transition, api.compte_id(), p_motif_code, v_commentaire);

  update core.candidature
     set etape_id                      = v_cible,
         retire_par_talent_le          = now(),
         motif_retrait                 = p_motif_code,
         motif_ko_code                 = p_motif_code,
         motif_ko_commentaire          = v_commentaire,
         date_ko                       = now(),
         date_dernier_changement_etape = now()
   where id = p_candidature_id;
  if not found then
    raise exception 'candidature % non modifiable : hors de votre périmètre', p_candidature_id
      using errcode = '42501';
  end if;

  perform app.journaliser(v_lot, 'core.candidature', p_candidature_id, 'update',
    'etape_id', to_jsonb(v_code_avant), to_jsonb('ko_by_candidat'::text));
  perform app.journaliser(v_lot, 'core.candidature', p_candidature_id, 'update',
    'motif_retrait', to_jsonb(null::text), to_jsonb(p_motif_code));

  v_resultat := jsonb_build_object('candidature_id', p_candidature_id,
                                   'etape_avant', v_code_avant,
                                   'etape_apres', 'ko_by_candidat',
                                   'motif_code', p_motif_code,
                                   'motif_libelle', v_libelle, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.retirer_ma_candidature(uuid,text,text,text) is
  'Le désistement. Étape ko_by_candidat, retire_par_talent_le horodatée, motif pris dans ref.motif_ko catégorie candidat (7 codes), et une ligne dans app.transition_etape avec origine = talent.';

-- ═══════════════════════════════════════════════════════════════════════
-- 7. api.enregistrer_mon_consentement
-- ═══════════════════════════════════════════════════════════════════════
-- D-07 : le cadrage RGPD est déclaré BLOQUANT avant toute mise en production
-- et n'est pas instruit — base légale, rétention, registre des traitements
-- appartiennent au dirigeant. Ce qui est construit ici, c'est le mécanisme :
-- `consentement_donne_le` existe depuis la reprise et n'a JAMAIS été écrite.
--
-- Le retrait remet la colonne à NULL. Il n'existe pas de troisième état :
-- « a refusé » et « n'a jamais répondu » sont indiscernables dans cette
-- colonne, et c'est une limite assumée du modèle existant — la nuance, si
-- elle devient nécessaire, se lira dans app.journal_ecriture, qui garde
-- l'avant et l'après de chaque bascule.
create or replace function api.enregistrer_mon_consentement(
  p_donne           boolean,
  p_cle_idempotence text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_fiche    uuid;
  v_lot      uuid := gen_random_uuid();
  v_rejeu    jsonb;
  v_avant    timestamptz;
  v_apres    timestamptz;
  v_resultat jsonb;
begin
  v_fiche := app.ma_fiche_unique();

  if p_donne is null then
    raise exception 'p_donne est obligatoire : « true » pour consentir, « false » pour retirer'
      using errcode = '22004';
  end if;

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', v_fiche::text, p_donne::text)));
  if v_rejeu is not null then return v_rejeu; end if;

  select f.consentement_donne_le into v_avant
    from core.fiche_talent f where f.id = v_fiche;

  update core.fiche_talent
     set consentement_donne_le = case when p_donne then now() else null end,
         modifie_par_le_talent_le = now()
   where id = v_fiche
  returning consentement_donne_le into v_apres;
  if not found then
    raise exception 'fiche % non modifiable', v_fiche using errcode = '42501';
  end if;

  perform app.journaliser(v_lot, 'core.fiche_talent', v_fiche, 'update',
    'consentement_donne_le', to_jsonb(v_avant), to_jsonb(v_apres));

  v_resultat := jsonb_build_object('fiche_talent_id', v_fiche, 'consenti', p_donne,
                                   'consentement_donne_le', v_apres, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.enregistrer_mon_consentement(boolean,text) is
  'Écrit core.fiche_talent.consentement_donne_le — colonne présente depuis la reprise et jamais écrite jusqu''ici. Le retrait la remet à NULL ; la bascule est tracée dans app.journal_ecriture.';

-- ═══════════════════════════════════════════════════════════════════════
-- 8. api.exporter_mes_donnees — le droit d'accès
-- ═══════════════════════════════════════════════════════════════════════
-- ELLE NE LIT QUE LES VUES `api`, jamais les tables. Trois raisons :
--   · les vues sont en security_invoker, donc la RLS de la personne
--     s'applique — l'export ne peut pas rendre ce qu'elle n'a pas le droit
--     de lire ;
--   · les vues ÉNUMÈRENT leurs colonnes : rien du cabinet ne peut se glisser
--     dans l'export par l'ajout d'une colonne à `core.fiche_talent` ;
--   · le jour où une vue est resserrée, l'export l'est aussi, sans y toucher.
--
-- CE QUE L'EXPORT NE CONTIENT PAS : est_qualifie, statut_relation, mindset,
-- seniorite, emoji_statut, score de qualification, resume_ia, l'agent
-- référent en tant qu'identifiant, l'argumentaire client, le compte rendu, les
-- deux appréciations, les points forts et faibles, infos_remuneration, et les
-- 45 685 notes internes. Le droit d'accès porte sur les données de la
-- personne, pas sur l'appréciation qu'un tiers en fait.
--
-- Journalisée en `insert` sur l'entité `rgpd.export` : `journal_operation`
-- n'autorise que insert/update/delete, et un export mérite une trace — c'est
-- la preuve d'avoir honoré une demande.
create or replace function api.exporter_mes_donnees() returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_fiche    uuid;
  v_lot      uuid := gen_random_uuid();
  v_resultat jsonb;
begin
  v_fiche := app.ma_fiche_unique();

  select jsonb_build_object(
    'exporte_le', now(),
    'fiche_talent_id', v_fiche,
    'avertissement', 'Export des données que vous avez déclarées et du suivi de vos candidatures. Il ne contient aucune appréciation interne du cabinet.',
    'fiche', (select to_jsonb(f) from api.ma_fiche f where f.id = v_fiche),
    'experiences', coalesce((select jsonb_agg(to_jsonb(p) order by p.ordre, p.debut_le)
                               from api.mes_postes p), '[]'::jsonb),
    'candidatures', coalesce((select jsonb_agg(to_jsonb(c) order by c.date_entree_pipeline)
                                from api.ma_candidature_detail c), '[]'::jsonb),
    'notes_partagees', coalesce((select jsonb_agg(to_jsonb(n) order by n.ecrite_le)
                                   from api.ma_note_partagee n), '[]'::jsonb),
    'demandes_de_suppression', coalesce((select jsonb_agg(jsonb_build_object(
                                            'demandee_le', d.demandee_le,
                                            'motif', d.motif,
                                            'traitee_le', d.traitee_le))
                                          from app.demande_suppression d
                                         where d.fiche_talent_id = v_fiche), '[]'::jsonb)
  ) into v_resultat;

  perform app.journaliser(v_lot, 'rgpd.export', v_fiche, 'insert', null, null,
    jsonb_build_object('experiences', jsonb_array_length(v_resultat -> 'experiences'),
                       'candidatures', jsonb_array_length(v_resultat -> 'candidatures'),
                       'notes', jsonb_array_length(v_resultat -> 'notes_partagees')));

  return v_resultat || jsonb_build_object('lot_id', v_lot);
end $$;

comment on function api.exporter_mes_donnees() is
  'Le droit d''accès RGPD, construit UNIQUEMENT à partir des vues api du talent — donc borné par leur énumération de colonnes et par la RLS. Ne contient rien du cabinet.';

-- ═══════════════════════════════════════════════════════════════════════
-- 9. api.demander_ma_suppression — n'efface rien
-- ═══════════════════════════════════════════════════════════════════════
create or replace function api.demander_ma_suppression(
  p_motif           text default null,
  p_cle_idempotence text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_fiche    uuid;
  v_lot      uuid := gen_random_uuid();
  v_rejeu    jsonb;
  v_demande  uuid;
  v_ouverte  uuid;
  v_motif    text := nullif(btrim(coalesce(p_motif, '')), '');
  v_actif    boolean;
  v_resultat jsonb;
begin
  v_fiche := app.ma_fiche_unique();

  if length(coalesce(v_motif, '')) > 5000 then
    raise exception 'motif trop long : % caractères pour 5 000 au plus', length(v_motif)
      using errcode = '22001';
  end if;

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', v_fiche::text, 'suppression', v_motif)));
  if v_rejeu is not null then return v_rejeu; end if;

  select d.id into v_ouverte from app.demande_suppression d
   where d.fiche_talent_id = v_fiche and d.traitee_le is null limit 1;
  if v_ouverte is not null then
    raise exception 'une demande de suppression est déjà enregistrée (demande %) et attend son traitement', v_ouverte
      using errcode = '23505';
  end if;

  insert into app.demande_suppression (fiche_talent_id, compte_id, motif)
  values (v_fiche, api.compte_id(), v_motif)
  returning id into v_demande;

  select f.actif into v_actif from core.fiche_talent f where f.id = v_fiche;

  update core.fiche_talent
     set actif = false,
         modifie_par_le_talent_le = now()
   where id = v_fiche;
  if not found then
    raise exception 'fiche % non modifiable', v_fiche using errcode = '42501';
  end if;

  perform app.journaliser(v_lot, 'app.demande_suppression', v_demande, 'insert', null, null,
    jsonb_build_object('fiche_talent_id', v_fiche, 'motif', v_motif));
  perform app.journaliser(v_lot, 'core.fiche_talent', v_fiche, 'update',
    'actif', to_jsonb(v_actif), to_jsonb(false));

  v_resultat := jsonb_build_object(
    'demande_id', v_demande, 'fiche_talent_id', v_fiche, 'actif', false,
    'suite', 'Votre fiche est retirée du vivier. La suppression définitive est traitée à la main : la cascade détruirait aussi vos candidatures et l''historique des clients.',
    'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.demander_ma_suppression(text,text) is
  'Enregistre une demande de suppression et bascule actif = false. N''EFFACE RIEN : la cascade héritée de Bubble détruirait candidatures, notes et contacts. L''effacement est un acte administré.';

-- ═══════════════════════════════════════════════════════════════════════
-- 10-12. La frise d'expériences
-- ═══════════════════════════════════════════════════════════════════════
-- `core.fiche_talent_poste` porte 0 ligne et n'a aucune source. Les deux
-- contraintes de la table commandent la validation :
--   poste_dates     : fin_le >= debut_le
--   poste_en_cours  : en_cours ⇒ fin_le nul
--
-- On les double en amont pour rendre un message lisible au lieu d'un 23514,
-- et on écrit la règle UNE fois pour l'ajout et la retouche, afin qu'elles ne
-- puissent pas diverger.
create or replace function app.controler_poste(
  p_intitule       text,
  p_entreprise_nom text,
  p_debut_le       date,
  p_fin_le         date,
  p_en_cours       boolean,
  p_description    text
) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if p_intitule is null then
    raise exception 'un poste doit porter un intitulé' using errcode = '22004';
  end if;
  if length(p_intitule) > 200 then
    raise exception 'intitulé trop long : % caractères pour 200 au plus', length(p_intitule)
      using errcode = '22001';
  end if;
  if length(coalesce(p_entreprise_nom, '')) > 200 then
    raise exception 'nom d''employeur trop long : % caractères pour 200 au plus', length(p_entreprise_nom)
      using errcode = '22001';
  end if;
  if length(coalesce(p_description, '')) > 10000 then
    raise exception 'description trop longue : % caractères pour 10 000 au plus', length(p_description)
      using errcode = '22001';
  end if;
  if p_debut_le is not null and p_debut_le < date '1950-01-01' then
    raise exception 'p_debut_le antérieure à 1950 : %', p_debut_le using errcode = '22007';
  end if;
  -- Une date de début dans le futur est une faute de frappe, pas un projet.
  if p_debut_le is not null and p_debut_le > (now()::date + 1) then
    raise exception 'p_debut_le est dans le futur : %', p_debut_le using errcode = '22007';
  end if;
  if p_fin_le is not null and p_debut_le is not null and p_fin_le < p_debut_le then
    raise exception 'la fin (%) précède le début (%)', p_fin_le, p_debut_le using errcode = '22007';
  end if;
  if coalesce(p_en_cours, false) and p_fin_le is not null then
    raise exception 'un poste « en cours » n''a pas de date de fin — reçu %', p_fin_le
      using errcode = '23514';
  end if;
end $$;

comment on function app.controler_poste(text,text,date,date,boolean,text) is
  'Les règles d''un poste de frise, écrites une fois. Double les contraintes poste_dates et poste_en_cours pour rendre un message lisible plutôt qu''un 23514.';

create or replace function api.ajouter_mon_poste(
  p_intitule        text,
  p_entreprise_nom  text    default null,
  p_debut_le        date    default null,
  p_fin_le          date    default null,
  p_en_cours        boolean default false,
  p_description     text    default null,
  p_ordre           integer default null,
  p_cle_idempotence text    default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_fiche    uuid;
  v_lot      uuid := gen_random_uuid();
  v_rejeu    jsonb;
  v_poste    uuid;
  v_intitule text := nullif(btrim(coalesce(p_intitule, '')), '');
  v_employeur text := nullif(btrim(coalesce(p_entreprise_nom, '')), '');
  v_desc     text := nullif(btrim(coalesce(p_description, '')), '');
  v_en_cours boolean := coalesce(p_en_cours, false);
  v_ordre    integer;
  v_resultat jsonb;
begin
  v_fiche := app.ma_fiche_unique();
  perform app.controler_poste(v_intitule, v_employeur, p_debut_le, p_fin_le,
                              v_en_cours, v_desc);

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', v_fiche::text, v_intitule, v_employeur,
                  p_debut_le::text, p_fin_le::text, v_en_cours::text, v_desc)));
  if v_rejeu is not null then return v_rejeu; end if;

  -- L'ordre par défaut : à la suite, pour que la frise ne dépende pas de
  -- l'écran. Lu sous la RLS de l'appelant, donc borné à ses propres postes.
  v_ordre := coalesce(p_ordre,
    (select coalesce(max(p.ordre), 0) + 1 from core.fiche_talent_poste p
      where p.fiche_talent_id = v_fiche));

  insert into core.fiche_talent_poste (fiche_talent_id, intitule, entreprise_nom,
                                       debut_le, fin_le, en_cours, description,
                                       ordre, origine)
  values (v_fiche, v_intitule, v_employeur, p_debut_le,
          case when v_en_cours then null else p_fin_le end,
          v_en_cours, v_desc, v_ordre, 'declare'::ref.origine_valeur)
  returning id into v_poste;

  perform app.journaliser(v_lot, 'core.fiche_talent_poste', v_poste, 'insert', null, null,
    jsonb_build_object('intitule', v_intitule, 'entreprise_nom', v_employeur,
                       'debut_le', p_debut_le, 'fin_le', p_fin_le,
                       'en_cours', v_en_cours, 'ordre', v_ordre));
  update core.fiche_talent set modifie_par_le_talent_le = now() where id = v_fiche;

  v_resultat := jsonb_build_object('poste_id', v_poste, 'ordre', v_ordre, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

create or replace function api.maj_mon_poste(
  p_poste_id        uuid,
  p_intitule        text,
  p_entreprise_nom  text    default null,
  p_debut_le        date    default null,
  p_fin_le          date    default null,
  p_en_cours        boolean default false,
  p_description     text    default null,
  p_ordre           integer default null,
  p_cle_idempotence text    default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_fiche    uuid;
  v_lot      uuid := gen_random_uuid();
  v_rejeu    jsonb;
  v_avant    jsonb;
  v_apres    jsonb;
  v_n        integer;
  v_intitule text := nullif(btrim(coalesce(p_intitule, '')), '');
  v_employeur text := nullif(btrim(coalesce(p_entreprise_nom, '')), '');
  v_desc     text := nullif(btrim(coalesce(p_description, '')), '');
  v_en_cours boolean := coalesce(p_en_cours, false);
  v_resultat jsonb;
begin
  v_fiche := app.ma_fiche_unique();
  if p_poste_id is null then
    raise exception 'p_poste_id est obligatoire' using errcode = '22004';
  end if;
  perform app.controler_poste(v_intitule, v_employeur, p_debut_le, p_fin_le,
                              v_en_cours, v_desc);

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', p_poste_id::text, v_intitule, v_employeur,
                  p_debut_le::text, p_fin_le::text, v_en_cours::text, v_desc,
                  p_ordre::text)));
  if v_rejeu is not null then return v_rejeu; end if;

  select to_jsonb(x) into v_avant from (
    select p.intitule, p.entreprise_nom, p.debut_le, p.fin_le, p.en_cours,
           p.description, p.ordre
      from core.fiche_talent_poste p
     where p.id = p_poste_id and p.fiche_talent_id = v_fiche) x;
  if v_avant is null then
    raise exception 'poste % introuvable dans votre parcours', p_poste_id using errcode = '42501';
  end if;

  update core.fiche_talent_poste
     set intitule       = v_intitule,
         entreprise_nom = v_employeur,
         debut_le       = p_debut_le,
         fin_le         = case when v_en_cours then null else p_fin_le end,
         en_cours       = v_en_cours,
         description    = v_desc,
         ordre          = coalesce(p_ordre, ordre)
   where id = p_poste_id and fiche_talent_id = v_fiche;
  if not found then
    raise exception 'poste % non modifiable', p_poste_id using errcode = '42501';
  end if;

  select to_jsonb(x) into v_apres from (
    select p.intitule, p.entreprise_nom, p.debut_le, p.fin_le, p.en_cours,
           p.description, p.ordre
      from core.fiche_talent_poste p where p.id = p_poste_id) x;

  v_n := app.journaliser_diff(v_lot, 'core.fiche_talent_poste', p_poste_id, v_avant, v_apres);
  update core.fiche_talent set modifie_par_le_talent_le = now() where id = v_fiche;

  v_resultat := jsonb_build_object('poste_id', p_poste_id, 'champs_modifies', v_n, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

create or replace function api.supprimer_mon_poste(
  p_poste_id        uuid,
  p_cle_idempotence text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_fiche    uuid;
  v_lot      uuid := gen_random_uuid();
  v_rejeu    jsonb;
  v_avant    jsonb;
  v_resultat jsonb;
begin
  v_fiche := app.ma_fiche_unique();
  if p_poste_id is null then
    raise exception 'p_poste_id est obligatoire' using errcode = '22004';
  end if;

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', p_poste_id::text, 'suppression')));
  if v_rejeu is not null then return v_rejeu; end if;

  select to_jsonb(x) into v_avant from (
    select p.intitule, p.entreprise_nom, p.debut_le, p.fin_le, p.en_cours, p.ordre
      from core.fiche_talent_poste p
     where p.id = p_poste_id and p.fiche_talent_id = v_fiche) x;
  if v_avant is null then
    raise exception 'poste % introuvable dans votre parcours', p_poste_id using errcode = '42501';
  end if;

  delete from core.fiche_talent_poste where id = p_poste_id and fiche_talent_id = v_fiche;
  if not found then
    raise exception 'poste % non supprimable', p_poste_id using errcode = '42501';
  end if;

  perform app.journaliser(v_lot, 'core.fiche_talent_poste', p_poste_id, 'delete',
                          null, v_avant, null);
  update core.fiche_talent set modifie_par_le_talent_le = now() where id = v_fiche;

  v_resultat := jsonb_build_object('poste_id', p_poste_id, 'supprime', true, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.ajouter_mon_poste(text,text,date,date,boolean,text,integer,text) is
  'Un poste dans la frise. `ordre` se pose à la suite si l''appelant ne le donne pas ; `entreprise_id` reste hors d''atteinte, le rapprochement avec core.entreprise est un acte du cabinet.';
comment on function api.maj_mon_poste(uuid,text,text,date,date,boolean,text,integer,text) is
  'Retouche un poste de SA frise. ⚠ Formulaire entier : un argument nul efface la valeur, sauf p_ordre qui conserve l''ordre existant.';
comment on function api.supprimer_mon_poste(uuid,text) is
  'Retire un poste de SA frise. Le journal garde l''avant : la suppression est réparable.';

-- ═══════════════════════════════════════════════════════════════════════
-- LES DROITS D'EXÉCUTION — À LA MAIN
-- `create or replace function` vient de réaccorder EXECUTE à PUBLIC sur
-- chacune. Le déclencheur `securite.fermer_fonctions_nouvelles` ne couvre
-- que le schéma `public`.
-- ═══════════════════════════════════════════════════════════════════════
do $$
declare v_sig text;
begin
  foreach v_sig in array array[
    'app.ma_fiche_unique()',
    'app.controler_attentes_talent(numeric,numeric,numeric,numeric)',
    'app.controler_poste(text,text,date,date,boolean,text)',
    'api.maj_ma_fiche(text,text,text,text,text,text,text,text,text,text)',
    'api.maj_mes_attentes(text,text,numeric,numeric,numeric,numeric,text,text,text,boolean,text)',
    'api.maj_mes_listes(text,text[],text)',
    'api.postuler(uuid,text,text)',
    'api.candidature_spontanee(text,text)',
    'api.retirer_ma_candidature(uuid,text,text,text)',
    'api.enregistrer_mon_consentement(boolean,text)',
    'api.exporter_mes_donnees()',
    'api.demander_ma_suppression(text,text)',
    'api.ajouter_mon_poste(text,text,date,date,boolean,text,integer,text)',
    'api.maj_mon_poste(uuid,text,text,date,date,boolean,text,integer,text)',
    'api.supprimer_mon_poste(uuid,text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', v_sig);
    execute format('grant  execute on function %s to authenticated, service_role', v_sig);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ── Contrôle ───────────────────────────────────────────────────────────
do $$
declare v_ouverte text;
begin
  select string_agg(p.proname, ', ') into v_ouverte
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'api'
     and p.proname in ('maj_ma_fiche','maj_mes_attentes','maj_mes_listes','postuler',
                       'candidature_spontanee','retirer_ma_candidature',
                       'enregistrer_mon_consentement','exporter_mes_donnees',
                       'demander_ma_suppression','ajouter_mon_poste',
                       'maj_mon_poste','supprimer_mon_poste')
     and has_function_privilege('anon', p.oid, 'execute');
  if v_ouverte is not null then
    raise exception 'fonctions d''écriture du talent exécutables par anon : %', v_ouverte;
  end if;

  -- Les douze sont bien là, et exécutables par un compte connecté.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'api'
         and p.proname in ('maj_ma_fiche','maj_mes_attentes','maj_mes_listes','postuler',
                           'candidature_spontanee','retirer_ma_candidature',
                           'enregistrer_mon_consentement','exporter_mes_donnees',
                           'demander_ma_suppression','ajouter_mon_poste',
                           'maj_mon_poste','supprimer_mon_poste')) <> 12 then
    raise exception 'il manque une des douze fonctions d''écriture du talent';
  end if;

  -- Aucune n'est en SECURITY DEFINER : l'ADR 0005 l'interdit sans amendement.
  select string_agg(p.proname, ', ') into v_ouverte
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'api' and p.prosecdef
     and p.proname in ('maj_ma_fiche','maj_mes_attentes','maj_mes_listes','postuler',
                       'candidature_spontanee','retirer_ma_candidature',
                       'enregistrer_mon_consentement','exporter_mes_donnees',
                       'demander_ma_suppression','ajouter_mon_poste',
                       'maj_mon_poste','supprimer_mon_poste');
  if v_ouverte is not null then
    raise exception 'fonction d''écriture en SECURITY DEFINER, contre l''ADR 0005 : %', v_ouverte;
  end if;
end $$;
