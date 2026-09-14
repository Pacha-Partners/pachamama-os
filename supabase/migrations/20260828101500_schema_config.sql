-- =====================================================================
-- SCHÉMA config — le paramétrage
--
-- 8 tables. Dérivé de docs/MODELE_V1_DETAIL.md, ADR 0003.
-- Écrit après ref, dont il consomme le type statut_mandat.
--
-- Ce que config N'EST PAS : un référentiel métier. Ce sont les réglages
-- que l'administration change sans migration — identité de marque,
-- gabarits d'e-mail, canaux, interrupteurs. Plusieurs de ces tables
-- viennent d'option sets Bubble à UNE ligne, qui n'avaient de référentiel
-- que le nom.
-- =====================================================================

create schema if not exists config;
comment on schema config is
  'Paramétrage de l''application : branding, gabarits, intégrations, interrupteurs. Écrit par l''administration.';

create or replace function config.touche_maj_le() returns trigger
language plpgsql as $$
begin
  new.maj_le := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------

create table config.branding (
  id                    uuid primary key default gen_random_uuid(),
  cle                   text        not null,
  libelle               text        not null,
  logo_url              text,
  logo_mini_url         text,
  background_image_url  text,
  background_asset1_url text,
  background_asset2_url text,
  police                text,
  site_web              text,
  cree_le               timestamptz not null default now(),
  maj_le                timestamptz not null default now(),
  constraint branding_site_https check (site_web is null or site_web ~ '^https://')
);
comment on table config.branding is
  'SINGLETON — l''identité de marque. 1 ligne, 7 attributs hétérogènes : ce n''est pas un référentiel, c''est de la configuration déguisée en option set Bubble. ref_app_branding.sort_order est abandonnée : un ordre n''a pas de sens sur une table à une ligne.';
-- La garantie de singleton exprimée par la base, et non par une convention.
create unique index branding_singleton on config.branding ((true));
create unique index branding_cle_unique on config.branding (cle);

create table config.asset (
  id          uuid primary key default gen_random_uuid(),
  cle         text        not null,
  url         text,
  description text,
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now(),
  constraint asset_cle_slug check (cle ~ '^[a-z0-9_]+$')
);
comment on table config.asset is
  'Registre des assets applicatifs. Reçoit ref_image : 1 ligne, 0 consommateur, 1 URL. Une table ref_* pour un fichier est du bruit dans le modèle métier. Pas de contrainte de forme sur url : la valeur du miroir est une URL relative au protocole (« //…cdn.bubble.io/… »).';
create unique index asset_cle_unique on config.asset (cle);

create table config.parametre (
  id          uuid primary key default gen_random_uuid(),
  cle         text        not null,
  valeur      text,
  description text,
  sensible    boolean     not null default false,
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now(),
  constraint parametre_cle_slug check (cle ~ '^[a-z0-9_]+$')
);
comment on table config.parametre is
  'Clé/valeur des paramètres d''exécution. Reçoit ref_email_config : un interrupteur de sécurité qui redirige les envois vers une adresse de test.';
create unique index parametre_cle_unique on config.parametre (cle);
-- L'anonymisation de la base de dev doit pouvoir trouver ces lignes.
create index parametre_sensible on config.parametre (sensible) where sensible;

create table config.canal_notification (
  id      uuid primary key default gen_random_uuid(),
  code    text        not null,
  libelle text        not null,
  actif   boolean     not null default true,
  cree_le timestamptz not null default now(),
  maj_le  timestamptz not null default now(),
  constraint canal_code_slug check (code ~ '^[a-z0-9_]+$')
);
comment on table config.canal_notification is
  'Les 2 canaux Slack de notification (#notifs-jobs, #notifs-closing). À NE PAS confondre avec le type ref.canal_notification, qui énumère les SUPPORTS d''envoi. AUCUNE colonne de cette table ne doit pouvoir accueillir une URL de webhook : les 4 webhooks du miroir ne sont pas des données, ce sont des identifiants d''authentification, et ils restent hors du modèle.';
create unique index canal_code_unique on config.canal_notification (code);

create table config.integration (
  id                     uuid primary key default gen_random_uuid(),
  code                   text        not null,
  libelle                text        not null,
  actif                  boolean     not null default true,
  reference_secret       text,
  date_derniere_rotation timestamptz,
  cree_le                timestamptz not null default now(),
  maj_le                 timestamptz not null default now(),
  constraint integration_code_slug check (code ~ '^[a-z0-9_]+$'),
  -- Garde-fou, pas coffre-fort : refuse structurellement qu'un webhook ou
  -- une clé soit collé dans le champ censé porter une RÉFÉRENCE au secret.
  constraint integration_pas_de_secret_en_clair
    check (reference_secret is null or reference_secret !~ '^(https?:|SG\.|xox|B0)')
);
comment on table config.integration is
  'ENTIÈREMENT À CRÉER, aucune source au miroir. Déclare les canaux externes (SendGrid, Slack, HubSpot, signature, calendrier). NOTE DE PÉRIMÈTRE : les identifiants HubSpot d''entreprise ou d''affaire n''appartiennent PAS ici, ce sont des attributs des entités concernées.';
create unique index integration_code_unique on config.integration (code);
create index integration_actif on config.integration (actif) where actif;

create table config.modele_email (
  id                   uuid primary key default gen_random_uuid(),
  bubble_id            text,
  libelle              text        not null,
  objet                text,
  corps                text        not null,
  jeton_agent_prenom   boolean     not null default false,
  jeton_agent_nom      boolean     not null default false,
  jeton_entreprise_nom boolean     not null default false,
  jeton_talent_prenom  boolean     not null default false,
  jeton_personnalise   boolean     not null default false,
  actif                boolean     not null default true,
  -- FK vers app.compte(id) ON DELETE SET NULL À AJOUTER par la migration
  -- du schéma app : la table n'existe pas encore. Jamais de FK vers
  -- public.user (Décision 1, interdit absolu).
  cree_par_compte_id   uuid,
  cree_le              timestamptz not null default now(),
  maj_le               timestamptz not null default now(),
  constraint modele_email_corps_non_vide check (corps <> '')
);
comment on table config.modele_email is
  'Les 4 modèles d''e-mail et leurs jetons de personnalisation. Seule table de ce schéma qui vienne d''une VRAIE table Bubble (public.email_template) et non d''un option set. email_template.slug est abandonnée : artefact de plateforme, 0/4 renseigné.';
-- Plusieurs NULL restent permis : c'est le comportement voulu pour une provenance facultative.
create unique index modele_email_bubble_unique on config.modele_email (bubble_id);
create index modele_email_actif on config.modele_email (actif);

create table config.sendgrid_template (
  id          uuid primary key default gen_random_uuid(),
  code        text        not null,
  libelle_fr  text        not null,
  emoji       text,
  template_id text        not null,
  ordre       integer     not null,
  actif       boolean     not null default true,
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now(),
  constraint sendgrid_code_slug check (code ~ '^[a-z0-9_]+$'),
  -- Forme VÉRIFIÉE sur les 6 valeurs réelles le 28/08/2026 : 6/6 conformes.
  constraint sendgrid_template_id_forme check (template_id ~ '^d-[0-9a-f]{32}$')
);
comment on table config.sendgrid_template is
  'TABLE D''INTÉGRATION — 6 correspondances vers les gabarits SendGrid. Six valeurs, mais ce n''est pas un vocabulaire métier : c''est une correspondance vers un prestataire externe. La clé d''API SendGrid n''est pas au miroir et ne doit pas y entrer.';
create unique index sendgrid_code_unique on config.sendgrid_template (code);
create unique index sendgrid_template_id_unique on config.sendgrid_template (template_id);
create index sendgrid_ordre_actif on config.sendgrid_template (ordre) where actif;

create table config.sendgrid_template_statut_mandat (
  id                   uuid primary key default gen_random_uuid(),
  sendgrid_template_id uuid              not null references config.sendgrid_template(id) on delete cascade,
  statut               ref.statut_mandat not null,
  cree_le              timestamptz       not null default now(),
  maj_le               timestamptz       not null default now()
);
comment on table config.sendgrid_template_statut_mandat is
  'TABLE DE LIAISON — remplace ref_sendgrid_template.visible_pour_mandat, qui encodait une LISTE DANS UNE CHAÎNE séparée par un pipe (« En cours », « Closé », « En cours|Closé »). Éclatement MESURÉ le 28/08/2026 : 7 lignes attendues pour 6 gabarits. « Closé » se résout en close_pachamama.';
create unique index sendgrid_statut_unique on config.sendgrid_template_statut_mandat (sendgrid_template_id, statut);
-- La lecture réelle est « quels gabarits proposer sur un mandat En cours ».
create index sendgrid_statut_inverse on config.sendgrid_template_statut_mandat (statut);

-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'branding','asset','parametre','canal_notification','integration',
    'modele_email','sendgrid_template','sendgrid_template_statut_mandat']
  loop
    execute format(
      'create trigger %I before update on config.%I for each row execute function config.touche_maj_le()',
      t || '_maj_le', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- DROITS — même règle que ref : lecture pour les rôles applicatifs
-- (nécessaire au security_invoker des vues api), schéma NON exposé.
-- ---------------------------------------------------------------------

grant usage on schema config to anon, authenticated, service_role;
grant select on all tables in schema config to anon, authenticated;
grant all    on all tables in schema config to service_role;
alter default privileges in schema config grant select on tables to anon, authenticated;
alter default privileges in schema config grant all    on tables to service_role;

-- config.parametre peut porter des valeurs sensibles : pas de lecture anon.
revoke select on config.parametre from anon;
revoke select on config.integration from anon;
