-- =====================================================================
-- SCHÉMA core, domaine du TALENT — 14 tables
--
--   core.talent          la PROJECTION du pivot, lecture seule, ~31 000 lignes
--   core.fiche_talent    l'enregistrement de l'application, le SEUL modifiable
--   12 satellites        les valeurs multiples de la fiche
--
-- Décision 2 de l'ADR 0003 : trois niveaux pour le talent. La projection
-- sert à CHERCHER, la fiche à ÉDITER. Un attribut que le pivot ne porte pas
-- ne peut pas figurer dans la projection ; un attribut que la personne
-- déclare ne peut pas être écrasé par la projection.
--
-- Les clés étrangères vers core.entreprise, core.collaborateur,
-- core.apporteur_affaires, core.tag et app.compte NE SONT PAS posées ici :
-- ces tables n'existent pas encore. Une migration « liens » les ajoutera.
-- Les colonnes, elles, existent.
--
-- ÉCART ASSUMÉ avec le détail : les montants sont en numeric(12,2) et non
-- en numeric nu, pour s'aligner sur core.candidature et core.placement et
-- fermer la porte aux arrondis flottants sur des salaires.
-- =====================================================================

create schema if not exists core;
comment on schema core is
  'Le métier. Écrit par l''application, sauf core.talent qui est une projection en lecture seule alimentée par le connecteur pivot→app.';

create or replace function core.touche_maj_le() returns trigger
language plpgsql as $$
begin
  new.maj_le := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. LA PROJECTION
-- ---------------------------------------------------------------------

create table core.talent (
  id                           uuid primary key default gen_random_uuid(),
  pivot_talent_id              text not null,
  type_fusion                  text not null,
  prenom                       text,
  prenom_src                   text,
  nom                          text,
  nom_src                      text,
  headline                     text,
  localisation                 text,
  localisation_src             text,
  url_linkedin                 text,
  open_to                      text,
  employeur_actuel             text,
  employeur_src                text,
  statut_jarvi                 text,
  origine_jarvi                text,
  cv_url                       text,
  notes_jarvi                  text,
  notes_bloc                   text,
  email_principal              text,
  emails                       text[],
  emails_generiques            text[],
  telephones                   text[],
  parcours_experience          text,
  parcours_formation           text,
  parcours_competences         text,
  qualif_niveau                text,
  qualif_univers               text,
  qualif_anglais               text,
  qualif_seniorite             text,
  qualif_profil                text,
  qualif_background            text,
  qualif_produit               text,
  qualif_expertises            text[],
  qualif_secteurs              text[],
  attentes_metier_vise         text,
  attentes_univers_vise        text,
  attentes_contrats            text[],
  attentes_remotes             text[],
  attentes_localisations       text[],
  attentes_secteurs            text[],
  attentes_nogo                text,
  attentes_salaire_min_ke      numeric(12,2),
  attentes_salaire_souhaite_ke numeric(12,2),
  attentes_tjm_min             numeric(12,2),
  attentes_tjm_souhaite        numeric(12,2),
  attentes_disponibilite       text,
  attentes_description         text,
  recherche                    tsvector,
  pivot_cree_le                timestamptz,
  projete_le                   timestamptz not null default now(),
  cree_le                      timestamptz not null default now(),
  maj_le                       timestamptz not null default now(),
  constraint talent_type_fusion check (type_fusion in ('merged','jarvi_only','app_only')),
  constraint talent_prenom_src  check (prenom_src       is null or prenom_src       in ('jarvi','app')),
  constraint talent_nom_src     check (nom_src          is null or nom_src          in ('jarvi','app')),
  constraint talent_loc_src     check (localisation_src is null or localisation_src in ('jarvi','app')),
  constraint talent_empl_src    check (employeur_src    is null or employeur_src    in ('jarvi','app')),
  constraint talent_sal_min     check (attentes_salaire_min_ke      is null or attentes_salaire_min_ke      >= 0),
  constraint talent_sal_souh    check (attentes_salaire_souhaite_ke is null or attentes_salaire_souhaite_ke >= 0),
  constraint talent_tjm_min     check (attentes_tjm_min             is null or attentes_tjm_min             >= 0),
  constraint talent_tjm_souh    check (attentes_tjm_souhaite        is null or attentes_tjm_souhaite        >= 0)
);
comment on table core.talent is
  'PROJECTION du pivot, LECTURE SEULE. Alimentée par le connecteur pivot→app, jamais par l''application. Elle sert à chercher, pas à éditer. Les valeurs multiples y sont des text[] et non des tables de liaison : la projection est en lecture seule, une FK n''y protégerait rien, et une ligne plate sur 31 000 personnes est ce que la recherche du poste recruteur demande. Aucune contrainte de base ne garantit donc que ces codes existent au référentiel — la vue core.v_projection_code_inconnu le rend visible.';

create unique index talent_pivot_unique on core.talent (pivot_talent_id);
create index talent_recherche_gin on core.talent using gin (recherche);
create index talent_expertises_gin     on core.talent using gin (qualif_expertises);
create index talent_secteurs_gin       on core.talent using gin (qualif_secteurs);
create index talent_att_contrats_gin   on core.talent using gin (attentes_contrats);
create index talent_att_remotes_gin    on core.talent using gin (attentes_remotes);
create index talent_att_localis_gin    on core.talent using gin (attentes_localisations);
create index talent_att_secteurs_gin   on core.talent using gin (attentes_secteurs);
create index talent_emails_gin         on core.talent using gin (emails);

-- LECTURE SEULE, deuxième verrou. Le REVOKE plus bas suffit contre les rôles
-- applicatifs ; ce déclencheur protège en plus des écritures faites depuis un
-- rôle privilégié par inadvertance. À RESSERRER : la liste devrait ne contenir
-- que le rôle dédié du connecteur, qui reste à créer.
create or replace function core.talent_lecture_seule() returns trigger
language plpgsql as $$
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception
      'core.talent est une projection en lecture seule : elle ne s''écrit que par le connecteur pivot→app (rôle courant : %)', current_user
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger talent_lecture_seule
  before insert or update or delete on core.talent
  for each row execute function core.talent_lecture_seule();

-- ---------------------------------------------------------------------
-- 2. LA FICHE
-- ---------------------------------------------------------------------

create table core.fiche_talent (
  id                               uuid primary key default gen_random_uuid(),
  bubble_id                        text,
  -- NULLABLE ET NON UNIQUE : une fiche créée à l'inscription n'a pas encore
  -- été ingérée par le pivot, et 374 talents sont nés de la fusion de 769
  -- candidats — une unicité échouerait dès le premier jour.
  talent_id                        uuid references core.talent(id) on delete set null,

  prenom                           text,
  prenom_origine                   ref.origine_valeur,
  nom                              text,
  nom_origine                      ref.origine_valeur,
  genre                            ref.genre,
  genre_origine                    ref.origine_valeur,
  photo_url                        text,
  photo_origine                    ref.origine_valeur,
  email_personnel                  text,
  email_origine                    ref.origine_valeur,
  telephone                        text,
  telephone_origine                ref.origine_valeur,
  url_linkedin                     text,
  url_linkedin_origine             ref.origine_valeur,
  localisation_texte               text,
  localisation_origine             ref.origine_valeur,
  localisations_brut_json          jsonb,
  cv_url                           text,
  cv_origine                       ref.origine_valeur,
  cv_depose_le                     timestamptz,
  portfolio_url                    text,
  portfolio_fichier_url            text,
  portfolio_origine                ref.origine_valeur,

  est_qualifie                     boolean not null default false,
  niveau_anglais                   ref.niveau_anglais,
  univers_id                       uuid references ref.univers(id) on delete restrict,
  seniorite                        text,
  mindset                          ref.mindset_talent,
  ecole                            text,
  grande_ecole                     text,
  appetence_early_stage            text,
  fiche_complete                   boolean not null default false,
  debut_vie_professionnelle        date,

  poste_actuel_employeur           text,
  poste_actuel_entreprise_id       uuid,   -- FK → core.entreprise, différée
  poste_actuel_metier_id           uuid references ref.metier(id)  on delete restrict,
  poste_actuel_univers_id          uuid references ref.univers(id) on delete restrict,
  poste_actuel_contrat             ref.type_contrat,
  poste_actuel_depuis_le           date,
  poste_actuel_raison_depart       text,
  poste_actuel_origine             ref.origine_valeur,

  attentes_metier_id               uuid references ref.metier(id)  on delete restrict,
  attentes_univers_id              uuid references ref.univers(id) on delete restrict,
  attentes_salaire_min_ke          numeric(12,2),
  attentes_salaire_max_ke          numeric(12,2),
  attentes_tjm_min                 numeric(12,2),
  attentes_tjm_max                 numeric(12,2),
  attentes_infos_salaire           text,
  attentes_disponibilite_texte     text,
  attentes_localisation_texte      text,
  attentes_localisations_brut_json jsonb,
  attentes_description             text,
  recherche_active                 boolean,
  attentes_origine                 ref.origine_valeur,

  statut_relation                  ref.statut_relation,
  emoji_statut                     ref.emoji_statut,
  agent_referent_id                uuid,   -- FK → core.collaborateur, différée
  apporteur_affaires_id            uuid,   -- FK → core.apporteur_affaires, différée
  actif                            boolean not null default true,

  consentement_donne_le            timestamptz,
  anonymise_le                     timestamptz,
  date_dernier_contact             timestamptz,
  modifie_par_le_talent_le         timestamptz,
  confirme_sans_changement_le      timestamptz,

  score_completude                 numeric(5,2),
  champs_manquants                 text[],
  source_import                    text,
  parse_par_ia_le                  timestamptz,
  resume_ia                        text,
  fusionnee_vers_fiche_id          uuid references core.fiche_talent(id) on delete set null,

  cree_par_origine                 ref.origine_valeur,
  cree_par_compte_id               uuid,   -- FK → app.compte, différée
  cree_par_legacy_bubble           text,
  synchro_cree_le                  timestamptz,
  synchro_maj_le                   timestamptz,
  bubble_modifie_le                timestamptz,
  cree_le                          timestamptz not null default now(),
  maj_le                           timestamptz not null default now(),

  constraint fiche_sal_min_pos  check (attentes_salaire_min_ke is null or attentes_salaire_min_ke >= 0),
  constraint fiche_sal_max_pos  check (attentes_salaire_max_ke is null or attentes_salaire_max_ke >= 0),
  constraint fiche_tjm_min_pos  check (attentes_tjm_min        is null or attentes_tjm_min        >= 0),
  constraint fiche_tjm_max_pos  check (attentes_tjm_max        is null or attentes_tjm_max        >= 0),
  constraint fiche_completude   check (score_completude is null or score_completude between 0 and 100),
  constraint fiche_pas_autofus  check (fusionnee_vers_fiche_id is distinct from id),
  constraint fiche_source       check (source_import is null or source_import in ('cv','linkedin','saisie','bubble')),
  -- Contrôle minimal et volontairement laxiste : une regex stricte
  -- rejetterait des adresses réelles parmi les 6 702 mesurées.
  constraint fiche_email_arobase check (email_personnel is null or position('@' in email_personnel) > 1)
  -- NON POSÉE : CHECK (attentes_salaire_min_ke <= attentes_salaire_max_ke).
  -- L'ordre réel du couple Bubble « Salaire minimum » / « Salaire souhaité »
  -- doit être remesuré APRÈS la fusion candidat + job_reve, sur la colonne
  -- fusionnée et non sur job_reve seul (Décision 7).
);
comment on table core.fiche_talent is
  'LE CŒUR. L''enregistrement de l''application sur une personne, le SEUL modifiable. Cible de migration de public.candidat et de ses quatre satellites : 7 028 fiches. Elle naît vide et se remplit par le candidat ou par un recruteur. Chaque champ déclarable porte sa colonne _origine, pour que le moteur d''inclusion arbitre sans reconstituer le journal.';
comment on column core.fiche_talent.attentes_salaire_min_ke is
  'FUSION MESURÉE job_reve.salaire + candidat.salaire_min_souhait. Règle (Décision 7) : union d''abord, puis préséance au plus récent des deux updated_at. Sur les 216 désaccords mesurés, candidat est la source la plus fraîche 167 fois.';

create unique index fiche_bubble_unique on core.fiche_talent (bubble_id);
create index fiche_talent_id      on core.fiche_talent (talent_id) where talent_id is not null;
create index fiche_email          on core.fiche_talent (lower(email_personnel)) where email_personnel is not null;
create index fiche_referent       on core.fiche_talent (agent_referent_id) where agent_referent_id is not null;
create index fiche_actif_qualifie on core.fiche_talent (est_qualifie) where actif;
create index fiche_nom_trgm       on core.fiche_talent using gin (nom extensions.gin_trgm_ops);
create index fiche_prenom_trgm    on core.fiche_talent using gin (prenom extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 3. LES SATELLITES
-- ---------------------------------------------------------------------

create table core.fiche_talent_background (
  fiche_talent_id uuid not null references core.fiche_talent(id) on delete cascade,
  background      ref.background_talent not null,
  origine         ref.origine_valeur,
  cree_le         timestamptz not null default now(),
  primary key (fiche_talent_id, background)
);
comment on table core.fiche_talent_background is 'Remontée au pivot LOSSY : pivot.qualification.background est un text unique pour ces 5 218 lignes.';
create index ft_background_inverse on core.fiche_talent_background (background);

create table core.fiche_talent_profil (
  fiche_talent_id uuid not null references core.fiche_talent(id) on delete cascade,
  profil          ref.profil_talent not null,
  origine         ref.origine_valeur,
  bloc_legacy     text,
  cree_le         timestamptz not null default now(),
  primary key (fiche_talent_id, profil),
  constraint ft_profil_bloc check (bloc_legacy is null or bloc_legacy in ('candidat','experience','fusion'))
);
create index ft_profil_inverse on core.fiche_talent_profil (profil);

create table core.fiche_talent_produit_xp (
  fiche_talent_id uuid not null references core.fiche_talent(id) on delete cascade,
  type_produit    ref.type_produit_xp not null,
  origine         ref.origine_valeur,
  cree_le         timestamptz not null default now(),
  primary key (fiche_talent_id, type_produit)
);
comment on table core.fiche_talent_produit_xp is 'Remontée au pivot LOSSY : pivot.qualification.product est un text unique pour ces 11 350 lignes.';
create index ft_produit_inverse on core.fiche_talent_produit_xp (type_produit);

create table core.fiche_talent_expertise (
  fiche_talent_id uuid not null references core.fiche_talent(id) on delete cascade,
  expertise_id    uuid not null references ref.expertise(id)     on delete restrict,
  origine         ref.origine_valeur,
  bloc_legacy     text,
  cree_le         timestamptz not null default now(),
  primary key (fiche_talent_id, expertise_id),
  constraint ft_expertise_bloc check (bloc_legacy is null or bloc_legacy in ('candidat','experience','fusion'))
);
create index ft_expertise_inverse on core.fiche_talent_expertise (expertise_id);

create table core.fiche_talent_secteur_xp (
  fiche_talent_id uuid not null references core.fiche_talent(id) on delete cascade,
  secteur_id      uuid not null references ref.secteur(id)       on delete restrict,
  origine         ref.origine_valeur,
  bloc_legacy     text,
  cree_le         timestamptz not null default now(),
  primary key (fiche_talent_id, secteur_id),
  constraint ft_secteur_xp_bloc check (bloc_legacy is null or bloc_legacy in ('candidat','experience','fusion'))
);
create index ft_secteur_xp_inverse on core.fiche_talent_secteur_xp (secteur_id);

create table core.fiche_talent_secteur_vise (
  fiche_talent_id uuid not null references core.fiche_talent(id) on delete cascade,
  secteur_id      uuid not null references ref.secteur(id)       on delete restrict,
  origine         ref.origine_valeur,
  cree_le         timestamptz not null default now(),
  primary key (fiche_talent_id, secteur_id)
);
comment on table core.fiche_talent_secteur_vise is
  'AUCUNE contrainte croisée avec secteur_nogo : un secteur à la fois visé et interdit est une incohérence de saisie RÉELLE. À faire remonter par une vue de contrôle, pas à rejeter — la migration échouerait.';
create index ft_secteur_vise_inverse on core.fiche_talent_secteur_vise (secteur_id);

create table core.fiche_talent_secteur_nogo (
  fiche_talent_id uuid not null references core.fiche_talent(id) on delete cascade,
  secteur_id      uuid not null references ref.secteur(id)       on delete restrict,
  origine         ref.origine_valeur,
  motif           text,
  cree_le         timestamptz not null default now(),
  primary key (fiche_talent_id, secteur_id)
);
create index ft_secteur_nogo_inverse on core.fiche_talent_secteur_nogo (secteur_id);

create table core.fiche_talent_critere (
  fiche_talent_id uuid not null references core.fiche_talent(id) on delete cascade,
  critere_id      uuid not null references ref.critere(id)       on delete restrict,
  origine         ref.origine_valeur,
  cree_le         timestamptz not null default now(),
  primary key (fiche_talent_id, critere_id)
);
create index ft_critere_inverse on core.fiche_talent_critere (critere_id);

create table core.fiche_talent_contrat_souhaite (
  fiche_talent_id uuid not null references core.fiche_talent(id) on delete cascade,
  contrat         ref.type_contrat not null,
  origine         ref.origine_valeur,
  bloc_legacy     text,
  cree_le         timestamptz not null default now(),
  primary key (fiche_talent_id, contrat),
  constraint ft_contrat_bloc check (bloc_legacy is null or bloc_legacy in ('candidat','job_reve','fusion'))
);
comment on table core.fiche_talent_contrat_souhaite is
  'Fusionne deux tables du miroir qui disent la même chose à deux niveaux : candidat_contrat (2 460) et job_reve_contrat (6 444). La PK composite dédoublonne la fusion.';
create index ft_contrat_inverse on core.fiche_talent_contrat_souhaite (contrat);

create table core.fiche_talent_remote_souhaite (
  fiche_talent_id uuid not null references core.fiche_talent(id) on delete cascade,
  remote          ref.rythme_remote not null,
  origine         ref.origine_valeur,
  bloc_legacy     text,
  cree_le         timestamptz not null default now(),
  primary key (fiche_talent_id, remote),
  constraint ft_remote_bloc check (bloc_legacy is null or bloc_legacy in ('candidat','job_reve','fusion'))
);
create index ft_remote_inverse on core.fiche_talent_remote_souhaite (remote);

create table core.fiche_talent_tag (
  fiche_talent_id    uuid not null references core.fiche_talent(id) on delete cascade,
  tag_id             uuid not null,   -- FK → core.tag, différée
  pose_par_compte_id uuid,            -- FK → app.compte, différée
  cree_le            timestamptz not null default now(),
  primary key (fiche_talent_id, tag_id)
);
comment on table core.fiche_talent_tag is
  'Pas de colonne origine, délibérément : un tag est toujours un acte du cabinet, jamais une déclaration de la personne.';
create index ft_tag_inverse on core.fiche_talent_tag (tag_id);

create table core.fiche_talent_poste (
  id              uuid primary key default gen_random_uuid(),
  fiche_talent_id uuid not null references core.fiche_talent(id) on delete cascade,
  intitule        text,
  entreprise_nom  text,
  entreprise_id   uuid,   -- FK → core.entreprise, différée
  debut_le        date,
  fin_le          date,
  en_cours        boolean not null default false,
  description     text,
  ordre           integer,
  origine         ref.origine_valeur,
  cree_le         timestamptz not null default now(),
  maj_le          timestamptz not null default now(),
  constraint poste_dates    check (fin_le is null or debut_le is null or fin_le >= debut_le),
  constraint poste_en_cours check (not en_cours or fin_le is null)
);
comment on table core.fiche_talent_poste is
  'AJOUT ENTIÈREMENT NOUVEAU. La liste datée des expériences professionnelles, que le miroir ne porte PAS : malgré son nom, public.experience est un bloc de colonnes de qualification en bijection avec le candidat, pas une liste de postes. Clé de substitution obligatoire — deux postes chez le même employeur aux mêmes dates existent (temps partiel, changement d''intitulé).';
create index ft_poste_timeline   on core.fiche_talent_poste (fiche_talent_id, debut_le desc);
create index ft_poste_entreprise on core.fiche_talent_poste (entreprise_id) where entreprise_id is not null;

-- ---------------------------------------------------------------------
-- 4. HORODATAGE
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['talent','fiche_talent','fiche_talent_poste']
  loop
    execute format(
      'create trigger %I before update on core.%I for each row execute function core.touche_maj_le()',
      t || '_maj_le', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. DROITS
-- ---------------------------------------------------------------------

grant usage on schema core to anon, authenticated, service_role;
grant select on all tables in schema core to authenticated;
grant all    on all tables in schema core to service_role;
alter default privileges in schema core grant select on tables to authenticated;
alter default privileges in schema core grant all    on tables to service_role;

-- La projection ne s'écrit jamais depuis l'application (premier verrou).
revoke insert, update, delete on core.talent from anon, authenticated;
