-- =====================================================================
-- SCHÉMA ref — les référentiels
--
-- 30 types énumérés et 15 tables. Dérivé de docs/MODELE_V1_DETAIL.md,
-- ADR 0003. Premier schéma écrit parce qu'il n'a aucun arbitrage ouvert
-- et que tout le reste du modèle y pointe.
--
-- RÈGLE D'ORDRE DES ÉNUMÉRÉS (décision du 27/08/2026) : les valeurs sont
-- déclarées dans la séquence du sort_order de la table source du miroir,
-- parce que PostgreSQL trie un énuméré par ordre de déclaration. C'est ce
-- qui préserve l'ordre d'affichage vu par les recruteurs sans ajouter la
-- moindre colonne. Insérer une valeur au milieu se fera plus tard par
-- ALTER TYPE ... ADD VALUE ... BEFORE/AFTER.
-- =====================================================================

create schema if not exists ref;
comment on schema ref is
  'Référentiels : vocabulaires fermés (types énumérés) et référentiels ouverts (tables). Écrit par l''administration, jamais par l''application.';

-- ---------------------------------------------------------------------
-- 1. LES TYPES ÉNUMÉRÉS
--    28 repris du miroir, dans l'ordre de leur sort_order,
--     2 créés pour le modèle (origine_valeur, canal_notification).
-- ---------------------------------------------------------------------

create type ref.background_talent as enum ('business','tech','data','marketing');
create type ref.cible_produit     as enum ('b2b','b2b2c','b2c','users_internes');
create type ref.type_entreprise   as enum ('startup','scaleup','eti','corporate','vc_private_equity');
create type ref.type_apporteur    as enum ('pacha_partners','head_of_bu','collectif');

create type ref.source_marketing as enum (
  'avant_garde','collectif','emailing','events','inbound','linkedin',
  'nurturing','outbound','partner_bizmaker','recommendation',
  'communaute_metier','website');

-- 'entrepreneur' n'est pas au référentiel mais porte 37 lignes réelles
-- (job_reve_contrat 17, candidat_contrat 20) : sans lui la reprise échoue.
create type ref.type_contrat      as enum ('cdi','freelance','entrepreneur');

create type ref.type_contributeur as enum ('ic','manager_c_level');
create type ref.emoji_statut      as enum ('feu','pouce_haut','yeux','pouce_bas');
create type ref.fonction_utilisateur as enum ('career_agent','recruiter');
create type ref.genre             as enum ('male','female','non_binary');

-- sort_order du miroir : en_us d'abord. Conservé tel quel.
create type ref.langue            as enum ('en_us','fr_fr');

-- 'en_pause' et 'reprise' n'existent ni au référentiel ni dans les données :
-- ils sont ajoutés sur consigne métier explicite — en_pause = mandat suspendu
-- dont le process s'est arrêté sans être closé ; reprise = mandat issu d'un
-- autre mandat. Placés à leur rang logique et non en fin d'énuméré, parce
-- qu'ils doivent s'afficher entre « en cours » et « terminé ».
create type ref.statut_mandat as enum (
  'nouveau','en_cours','en_pause','reprise','termine','close_pachamama');

create type ref.visibilite_mandat as enum ('private','talent_only','public');

create type ref.mindset_talent as enum (
  'pas_en_recherche','en_veille','recherche_6_mois','recherche_3_mois','recherche_active');

create type ref.niveau_analyse as enum ('bien','moyen','vigilance');
create type ref.niveau_anglais as enum (
  'aucun','ecrit_seulement','courant_occasionnel','courant_quotidien');

-- sort_order du miroir : archive en 3e position, pas en fin.
create type ref.type_note_event as enum ('contract','info','archive','task','team');

create type ref.type_produit_xp as enum ('b2b','b2c','b2b2c','marketplace','saas','api');

-- 9 valeurs du référentiel + 5 mesurées dans les données et absentes de
-- celui-ci (16 lignes au total) : Hybride Hardware Software 9, Média 2,
-- On-Premise 2, Hybride On Premise-SaaS 2, Jeux-vidéos 1.
create type ref.type_produit_entreprise as enum (
  'saas_b2b','marketplace_b2b2c','app_mobile','api_b2d','e_commerce',
  'hardware','digital_transformation','ia','b2c',
  'hybride_hardware_software','media','on_premise','hybride_onpremise_saas','jeux_video');

create type ref.profil_talent as enum ('ic','manager','entrepreneur','agence');

-- 4 valeurs du référentiel + 3 vocabulaires anciens encore présents dans
-- les données (candidat_remote 490 lignes, mandat_remote 26, entreprise_remote 10).
create type ref.rythme_remote as enum (
  'hybride','full_remote_fr','full_remote_eu','full_remote_ww',
  'teletravail_legacy','presentiel_legacy','indifferent_legacy');

create type ref.role_utilisateur as enum (
  'admin','candidat','entreprise','recruiter_core_team','recruiter_support_crew');

create type ref.statut_relation as enum ('nouveau','qualifie','non_qualifie','lead','client');

create type ref.form_concurrence as enum (
  'pachamama_en_premier','plusieurs_agences_simultanees','autres_agences_recent',
  'autres_agences_sans_resultat','autre');

create type ref.form_provenance as enum (
  'ancien_talent','deja_client','recommandation','article_podcast','evenement','linkedin');

create type ref.formule_mission as enum (
  'recrutement_cdi','recrutement_freelance','rpo_conseil','a_definir');

create type ref.ancre_tache     as enum ('creation_date','contract_start_date','guarantee_end_date');
create type ref.evenement_tache as enum ('mandate_clo_free','mandate_clo_cdi');

-- Créés par le modèle, sans source au miroir.
-- origine_valeur : la provenance d'une valeur déclarable (Décision 3).
-- Le détail l'écrit 25 fois « ref.origine_valeur » et 1 fois
-- « app.origine_valeur » ; c'est ref qui l'emporte, app.journal_ecriture
-- utilisera ce type-ci.
create type ref.origine_valeur as enum (
  'declare','recruteur','pre_rempli','import','automatique');

-- canal_notification : le support d'envoi d'une notification. À NE PAS
-- confondre avec la table config.canal_notification, qui liste les 2 canaux
-- Slack et n'est pas un vocabulaire de support.
create type ref.canal_notification as enum ('email','in_app','push','slack');

-- ---------------------------------------------------------------------
-- 2. HORODATAGE
-- ---------------------------------------------------------------------

create or replace function ref.touche_maj_le() returns trigger
language plpgsql as $$
begin
  new.maj_le := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. LES TABLES
-- ---------------------------------------------------------------------

create table ref.univers (
  id                 uuid primary key default gen_random_uuid(),
  code               text        not null,
  libelle_fr         text        not null,
  couleur_primaire   text,
  couleur_secondaire text,
  logo_url           text,
  logo_mini_url      text,
  talent_card_url    text,
  est_ouvert         boolean     not null default true,
  ordre              integer     not null,
  actif              boolean     not null default true,
  cree_le            timestamptz not null default now(),
  maj_le             timestamptz not null default now(),
  constraint univers_code_slug   check (code ~ '^[a-z0-9_]+$'),
  constraint univers_coul_1_hexa check (couleur_primaire   is null or couleur_primaire   ~ '^#[0-9A-Fa-f]{6}$'),
  constraint univers_coul_2_hexa check (couleur_secondaire is null or couleur_secondaire ~ '^#[0-9A-Fa-f]{6}$')
);
comment on table ref.univers is '8 verticales métier. Table et non énuméré : 6 attributs propres, dont 3 URLs d''assets et un drapeau d''ouverture commerciale que l''application lit.';
create unique index univers_code_unique on ref.univers (code);
create index univers_ordre_actif on ref.univers (ordre) where actif;

create table ref.metier (
  id               uuid primary key default gen_random_uuid(),
  code             text        not null,
  libelle_fr       text        not null,
  ordre            integer     not null,
  actif            boolean     not null default true,
  origine          text        not null default 'referentiel',
  fusionne_vers_id uuid references ref.metier(id) on delete set null,
  cree_le          timestamptz not null default now(),
  maj_le           timestamptz not null default now(),
  constraint metier_code_slug    check (code ~ '^[a-z0-9_]+$'),
  constraint metier_origine      check (origine in ('referentiel','decouvert_en_donnees')),
  constraint metier_pas_autofus  check (fusionne_vers_id is null or fusionne_vers_id <> id),
  constraint metier_fusion_inactif check (fusionne_vers_id is null or not actif)
);
comment on table ref.metier is '238 métiers. Référentiel OUVERT : les recruteurs en saisissent au clavier, d''où origine et fusionne_vers_id.';
create unique index metier_code_unique on ref.metier (code);
create index metier_ordre_actif on ref.metier (ordre) where actif;
-- 238 valeurs saisies au clavier : la recherche par préfixe est le seul usage chaud.
create index metier_libelle_trgm on ref.metier using gin (libelle_fr extensions.gin_trgm_ops);

create table ref.metier_univers (
  id         uuid primary key default gen_random_uuid(),
  metier_id  uuid not null references ref.metier(id)  on delete cascade,
  univers_id uuid not null references ref.univers(id) on delete restrict,
  cree_le    timestamptz not null default now(),
  maj_le     timestamptz not null default now()
);
comment on table ref.metier_univers is 'N-N authentique. Aucune contrainte de couverture : 237 métiers sur 238 sont rattachés, la contrainte échouerait sur la ligne restante.';
create unique index metier_univers_unique on ref.metier_univers (metier_id, univers_id);
create index metier_univers_inverse on ref.metier_univers (univers_id);

create table ref.expertise (
  id               uuid primary key default gen_random_uuid(),
  code             text        not null,
  libelle_fr       text        not null,
  ordre            integer     not null,
  actif            boolean     not null default true,
  origine          text        not null default 'referentiel',
  fusionne_vers_id uuid references ref.expertise(id) on delete set null,
  cree_le          timestamptz not null default now(),
  maj_le           timestamptz not null default now(),
  constraint expertise_code_slug   check (code ~ '^[a-z0-9_]+$'),
  constraint expertise_origine     check (origine in ('referentiel','decouvert_en_donnees')),
  constraint expertise_pas_autofus check (fusionne_vers_id is null or fusionne_vers_id <> id)
);
create unique index expertise_code_unique on ref.expertise (code);
create index expertise_ordre_actif on ref.expertise (ordre) where actif;

create table ref.expertise_univers (
  id           uuid primary key default gen_random_uuid(),
  expertise_id uuid not null references ref.expertise(id) on delete cascade,
  univers_id   uuid not null references ref.univers(id)   on delete restrict,
  cree_le      timestamptz not null default now(),
  maj_le       timestamptz not null default now()
);
create unique index expertise_univers_unique on ref.expertise_univers (expertise_id, univers_id);
create index expertise_univers_inverse on ref.expertise_univers (univers_id);

create table ref.secteur (
  id         uuid primary key default gen_random_uuid(),
  code       text        not null,
  libelle_fr text        not null,
  ordre      integer     not null,
  actif      boolean     not null default true,
  cree_le    timestamptz not null default now(),
  maj_le     timestamptz not null default now(),
  constraint secteur_code_slug check (code ~ '^[a-z0-9_]+$')
);
create unique index secteur_code_unique on ref.secteur (code);
create index secteur_ordre_actif on ref.secteur (ordre) where actif;

create table ref.critere (
  id         uuid primary key default gen_random_uuid(),
  code       text        not null,
  libelle_fr text        not null,
  ordre      integer     not null,
  actif      boolean     not null default true,
  cree_le    timestamptz not null default now(),
  maj_le     timestamptz not null default now(),
  constraint critere_code_slug check (code ~ '^[a-z0-9_]+$')
);
comment on table ref.critere is '32 critères de choix. 8 882 lignes de job_reve_critere, 32/32 valeurs utilisées, zéro orpheline.';
create unique index critere_code_unique on ref.critere (code);
create index critere_ordre_actif on ref.critere (ordre) where actif;

create table ref.etape_process (
  id               uuid primary key default gen_random_uuid(),
  code             text        not null,
  libelle_interne  text        not null,
  emoji            text,
  libelle_talent   text,
  libelle_client   text,
  visible_client   boolean,
  visible_interne  boolean,
  est_ko           boolean     not null default false,
  est_terminale    boolean     not null default false,
  est_publique     boolean,
  actif            boolean     not null default true,
  ordre            integer     not null,
  couleur_colonne  text,
  couleur_pastille text,
  cree_le          timestamptz not null default now(),
  maj_le           timestamptz not null default now(),
  constraint etape_code_slug     check (code ~ '^[a-z0-9_]+$'),
  constraint etape_coul_col_hexa check (couleur_colonne  is null or couleur_colonne  ~ '^#[0-9A-Fa-f]{6}$'),
  constraint etape_coul_pas_hexa check (couleur_pastille is null or couleur_pastille ~ '^#[0-9A-Fa-f]{6}$')
  -- NON POSÉE : CHECK (not est_ko or est_terminale). Elle encode une règle
  -- métier et non une mesure ; à confirmer avant de l'ajouter.
);
comment on table ref.etape_process is '14 étapes du pipeline. 5 drapeaux du miroir ont été détruits ; seul est_ko se reconstruit avec certitude, par le préfixe des libellés (6 287 candidatures KO, soit les 87 % mesurés).';
create unique index etape_code_unique  on ref.etape_process (code);
create unique index etape_ordre_unique on ref.etape_process (ordre);
create index etape_ko on ref.etape_process (est_ko) where est_ko;

create table ref.evenement_note (
  id             uuid primary key default gen_random_uuid(),
  code           text                 not null,
  type_evenement ref.type_note_event  not null,
  libelle_fr     text,
  ordre          integer              not null,
  actif          boolean              not null default true,
  cree_le        timestamptz          not null default now(),
  maj_le         timestamptz          not null default now(),
  constraint evenement_note_code_slug check (code ~ '^[a-z0-9_]+$'),
  constraint evenement_note_prefixe
    check (code = 'archive' or code like type_evenement::text || '_%')
);
comment on table ref.evenement_note is '24 événements journalisables. Table et non énuméré parce que le référentiel grandit à chaque nouveau champ tracé.';
create unique index evenement_note_code_unique on ref.evenement_note (code);
create index evenement_note_type_ordre on ref.evenement_note (type_evenement, ordre) where actif;

create table ref.type_tache (
  id                  uuid primary key default gen_random_uuid(),
  code                text                 not null,
  libelle_fr          text,
  gabarit_texte       text                 not null,
  est_admin           boolean              not null default false,
  delai_relatif_jours smallint             not null,
  ancre               ref.ancre_tache,
  evenement           ref.evenement_tache  not null,
  ordre               integer              not null,
  actif               boolean              not null default true,
  cree_le             timestamptz          not null default now(),
  maj_le              timestamptz          not null default now(),
  constraint type_tache_prefixe check (code like evenement::text || '_%'),
  constraint type_tache_delai   check (delai_relatif_jours between -365 and 365)
);
comment on table ref.type_tache is '12 types de tâche. La ligne EST une règle de planification exécutable : gabarit, décalage en jours, ancre temporelle. Ce n''est pas un vocabulaire, c''est de la configuration.';
create unique index type_tache_code_unique on ref.type_tache (code);
create index type_tache_evt_ordre on ref.type_tache (evenement, ordre) where actif;

create table ref.statut_contrat (
  id                uuid primary key default gen_random_uuid(),
  code              text        not null,
  libelle_fr        text        not null,
  emoji             text,
  couleur           text,
  signature_requise boolean     not null default false,
  ordre             integer     not null,
  actif             boolean     not null default true,
  cree_le           timestamptz not null default now(),
  maj_le            timestamptz not null default now(),
  constraint statut_contrat_code_slug check (code ~ '^[a-z0-9_]+$'),
  constraint statut_contrat_coul_hexa check (couleur is null or couleur ~ '^#[0-9A-Fa-f]{6}$')
);
create unique index statut_contrat_code_unique on ref.statut_contrat (code);
create index statut_contrat_ordre_actif on ref.statut_contrat (ordre) where actif;

create table ref.tag_job (
  id         uuid primary key default gen_random_uuid(),
  code       text        not null,
  libelle_fr text        not null,
  emoji      text,
  icone_url  text,
  ordre      integer     not null,
  actif      boolean     not null default true,
  origine    text        not null default 'referentiel',
  cree_le    timestamptz not null default now(),
  maj_le     timestamptz not null default now(),
  constraint tag_job_code_slug check (code ~ '^[a-z0-9_]+$'),
  constraint tag_job_origine   check (origine in ('referentiel','hors_referentiel'))
);
comment on table ref.tag_job is '74 tags. icone_url est conservée VIDE et documentée : 0/74 renseigné au miroir, contenu entièrement perdu. La colonne dit ce qui manque.';
create unique index tag_job_code_unique on ref.tag_job (code);
create index tag_job_ordre_actif on ref.tag_job (ordre) where actif;

create table ref.maturite_produit (
  id         uuid primary key default gen_random_uuid(),
  code       text        not null,
  libelle_fr text,
  image_url  text,
  ordre      integer     not null,
  actif      boolean     not null default true,
  cree_le    timestamptz not null default now(),
  maj_le     timestamptz not null default now(),
  constraint maturite_code_ferme check (code ~ '^[a-e]$')
);
create unique index maturite_code_unique on ref.maturite_produit (code);
create index maturite_ordre on ref.maturite_produit (ordre);

create table ref.libelle (
  id            uuid primary key default gen_random_uuid(),
  domaine       text        not null,
  code          text        not null,
  libelles      jsonb       not null default '{}'::jsonb,
  emoji         text,
  couleur       text,
  icone_url     text,
  ordre         integer     not null,
  actif         boolean     not null default true,
  est_recruteur boolean,
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now(),
  constraint libelle_code_slug check (code ~ '^[a-z0-9_]+$'),
  constraint libelle_coul_hexa check (couleur is null or couleur ~ '^#[0-9A-Fa-f]{6}$'),
  constraint libelle_est_objet check (jsonb_typeof(libelles) = 'object'),
  constraint libelle_cles      check (
    libelles = '{}'::jsonb
    or libelles ?| array['fr','en','court','long','candidat','recruteur','public']),
  -- À défaut d'une clé étrangère vers un type, qui n'existe pas en PostgreSQL.
  constraint libelle_domaine check (domaine in (
    'background_talent','cible_produit','type_entreprise','type_apporteur',
    'source_marketing','type_contrat','type_contributeur','emoji_statut',
    'fonction_utilisateur','genre','langue','statut_mandat','visibilite_mandat',
    'mindset_talent','niveau_analyse','niveau_anglais','type_note_event',
    'type_produit_xp','type_produit_entreprise','profil_talent','rythme_remote',
    'role_utilisateur','statut_relation','form_concurrence','form_provenance',
    'formule_mission','ancre_tache','evenement_tache'))
);
comment on table ref.libelle is
  'Table de PRÉSENTATION des 28 types énumérés : libellé, emoji, couleur, ordre. C''est elle qui permet de passer de 47 tables ref_* à 15. Référencée par valeur (domaine, code), jamais par clé étrangère — PostgreSQL ne peut pas contraindre une table vers un type. La validité de la valeur est déjà garantie par l''énuméré côté données.';
create unique index libelle_domaine_code_unique on ref.libelle (domaine, code);
create index libelle_domaine_ordre on ref.libelle (domaine, ordre) where actif;

create table ref.correspondance (
  id                   uuid primary key default gen_random_uuid(),
  referentiel          text        not null,
  libelle_miroir       text        not null,
  code_cible           text        not null,
  origine              text        not null,
  occurrences_mesurees integer,
  cree_le              timestamptz not null default now(),
  maj_le               timestamptz not null default now(),
  constraint corresp_origine     check (origine in ('referentiel','hors_referentiel')),
  constraint corresp_code_slug   check (code_cible ~ '^[a-z0-9_]+$'),
  constraint corresp_occurrences check (occurrences_mesurees is null or occurrences_mesurees >= 0)
);
comment on table ref.correspondance is
  'La trace « ce libellé Bubble est devenu ce code ». AUCUNE clé étrangère, délibérément : la table doit survivre à la suppression d''un code cible pour rester une preuve d''audit — une FK la rendrait fragile exactement au moment où elle sert.';
create unique index corresp_ref_libelle_unique on ref.correspondance (referentiel, libelle_miroir);
create index corresp_ref_code on ref.correspondance (referentiel, code_cible);

-- ---------------------------------------------------------------------
-- 4. HORODATAGE AUTOMATIQUE
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'univers','metier','metier_univers','expertise','expertise_univers','secteur',
    'critere','etape_process','evenement_note','type_tache','statut_contrat',
    'tag_job','maturite_produit','libelle','correspondance']
  loop
    execute format(
      'create trigger %I before update on ref.%I for each row execute function ref.touche_maj_le()',
      t || '_maj_le', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. DROITS
--    Lecture pour les rôles applicatifs : nécessaire au security_invoker
--    des vues api. Le schéma ref n'est PAS exposé dans les réglages de
--    l'API : PostgREST ne sait donc pas y router directement.
--    L'écriture reste au service_role (administration).
-- ---------------------------------------------------------------------

grant usage on schema ref to anon, authenticated, service_role;
grant select on all tables in schema ref to anon, authenticated;
grant all    on all tables in schema ref to service_role;
alter default privileges in schema ref grant select on tables to anon, authenticated;
alter default privileges in schema ref grant all    on tables to service_role;
