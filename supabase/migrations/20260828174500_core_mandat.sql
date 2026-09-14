-- =====================================================================
-- SCHÉMA core, domaine MANDAT / CANDIDATURE / PLACEMENT — 10 tables
--
--   core.mandat                 534 missions confiées par un client
--   core.mandat_cible / _remote / _secteur_nogo / _tag_job   4 liaisons
--   core.candidature            7 243 rencontres talent × mandat
--   core.analyse                les analyses de mandat
--   core.placement              227 deals closés — l'entité de revenu
--   core.placement_utilisateur  qui suit quel placement
--   core.repartition_commission 266 répartitions, jusqu'à 5 par placement
--
-- core.vivier_mandat N'EST PAS CRÉÉE : sa définition métier est attendue.
-- 2 603 couples dont 2 596 sont déjà des candidatures — la table dit-elle
-- « pressenti, pas encore approché » ou est-ce un vestige de shortlist ?
-- Tant que la réponse manque, la créer serait figer une ambiguïté.
--
-- ─────────────────────────────────────────────────────────────────────
-- LES CINQ CONTRAINTES QUE LE DÉTAIL LAISSAIT « À MESURER »
-- Mesurées le 28/08/2026 sur la production. Trois sont refusées.
--
--   mandat     salaire_min <= salaire_max     373 ok, 2 VIOLENT  → REFUSÉE
--   mandat     tjm_min <= tjm_max              99 ok, 0 violent  → posée
--   placement  fin_mission >= debut_mission    78 ok, 1 VIOLENT  → REFUSÉE
--   placement  fin_garantie >= date_closing   159 ok, 1 VIOLENT  → REFUSÉE
--   répartition  les 6 _pct dans [0,100]      267 ok, 0 hors     → posées
--
-- Les trois refusées sont écrites en commentaire à leur place, avec les
-- lignes fautives à corriger. Elles se posent APRÈS la reprise, en
-- NOT VALID — jamais avant, une contrainte posée d'avance vérifie les
-- insertions et ferait échouer le chargement.
-- ─────────────────────────────────────────────────────────────────────
-- =====================================================================

-- Trois énumérés issus de CHECK inline du miroir, absents des 47 tables ref_*.
create type ref.equity_mandat as enum ('actions_gratuites','bspce','peut_etre_plus_tard','non');
create type ref.type_deal     as enum ('new_business','existing_business');
-- Sans source au miroir : exigé par la génération de factures.
create type ref.statut_paiement as enum ('a_facturer','facture','paye','avoir');

-- ---------------------------------------------------------------------

create table core.mandat (
  id                             uuid primary key default gen_random_uuid(),
  bubble_id                      text,
  titre                          text,
  description                    text,
  description_manager            text,
  description_produit            text,
  missions                       text,
  process_recrutement            text,
  pour_toi                       text,
  pas_pour_toi                   text,
  remote_infos                   text,
  salaire_infos                  text,
  format_mission                 text,
  duree_mission                  text,
  date_demarrage_souhaitee       date,
  video_youtube                  text,
  salaire_min_ke                 numeric(12,2),
  salaire_max_ke                 numeric(12,2),
  tjm_min                        numeric(12,2),
  tjm_max                        numeric(12,2),
  experience_min_annees          smallint,
  scorecard_delivery             smallint,
  scorecard_discovery            smallint,
  scorecard_strategie            smallint,
  scorecard_ops                  smallint,
  scorecard_management           smallint,
  kickoff_le                     timestamptz,
  est_anonyme                    boolean     not null default false,
  est_hors_marche                boolean     not null default false,
  visibilite                     ref.visibilite_mandat,
  statut                         ref.statut_mandat,
  mandat_origine_id              uuid references core.mandat(id)        on delete set null,
  mis_en_pause_le                timestamptz,
  equity                         ref.equity_mandat,
  type_contributeur              ref.type_contributeur,
  contrat                        ref.type_contrat,
  exclusivite_pachamama          boolean,
  type_deal                      ref.type_deal,
  source_marketing               ref.source_marketing,
  type_apporteur                 ref.type_apporteur,
  univers_id                     uuid references ref.univers(id)        on delete restrict,
  metier_id                      uuid references ref.metier(id)         on delete restrict,
  entreprise_id                  uuid references core.entreprise(id)    on delete restrict,
  contact_manager_id             uuid references core.contact_client(id) on delete set null,
  -- NOMMÉE contact_recruteur_id et NON recruteur_id : mesuré le 27/08/2026,
  -- les 36 valeurs distinctes de public.mandat.recruteur_id ne se trouvent
  -- ni dans public.user ni dans business_maker — elles se résolvent toutes
  -- dans public.equipe. Ce n'est PAS un recruteur de Pachamama, c'est
  -- l'interlocuteur qui recrute CÔTÉ CLIENT. Le nom du miroir est trompeur.
  contact_recruteur_id           uuid references core.contact_client(id) on delete set null,
  agent_en_charge_id             uuid references core.collaborateur(id) on delete set null,
  agent_2_id                     uuid references core.collaborateur(id) on delete set null,
  account_manager_id             uuid references core.collaborateur(id) on delete set null,
  localisation                   text,
  departement                    text,
  stack                          text[],
  presentation_equipe            text,
  contexte_equipe                text,
  raison_du_recrutement          text,
  confidentiel                   boolean     not null default false,
  must_have                      jsonb,
  nice_to_have                   jsonb,
  cloture_demandee_le            timestamptz,
  cloture_demandee_par_compte_id uuid,   -- FK → app.compte, différée
  valide_par_am_le               timestamptz,
  cree_par_id                    uuid references core.collaborateur(id) on delete set null,
  cree_le                        timestamptz not null default now(),
  maj_le                         timestamptz not null default now(),
  constraint mandat_pas_auto_origine check (mandat_origine_id is distinct from id),
  -- Sûre : 'en_pause' est une valeur neuve, 0 ligne existante.
  constraint mandat_pause_datee      check (statut <> 'en_pause' or mis_en_pause_le is not null),
  -- MESURÉ 99 ok / 0 violation.
  constraint mandat_tjm_ordre        check (tjm_min is null or tjm_max is null or tjm_min <= tjm_max)
  -- REFUSÉE, à poser NOT VALID après la reprise ET après correction des
  -- 2 lignes fautives (100 > 90 et 75 > 60) :
  --   check (salaire_min_ke is null or salaire_max_ke is null
  --          or salaire_min_ke <= salaire_max_ke)
  -- PROPOSÉE, à arbitrer : check (confidentiel = false or est_anonyme = true).
  -- AUCUN NOT NULL sur titre / entreprise_id / statut / visibilite :
  -- 1 ligne vide sur chacune, à nettoyer avant.
);
comment on table core.mandat is
  'La mission confiée par un client, 534 lignes. La mise en ligne n''est PLUS un état du mandat : c''est un acte enregistré dans app.mandat_publication (Décision 7 de l''étude — 24 combinaisons de drapeaux gouvernaient l''exposition d''une offre). ⚠ mandat.titre est un titre INTERNE et ne doit jamais être projeté vers un client.';
create unique index mandat_bubble_unique on core.mandat (bubble_id) where bubble_id is not null;
create index mandat_statut  on core.mandat (statut);
-- Le poste recruteur ne travaille que les mandats vivants.
create index mandat_agent_vivants on core.mandat (agent_en_charge_id)
  where statut in ('nouveau','en_cours','en_pause');
create index mandat_job_board on core.mandat (univers_id, metier_id);
create index mandat_origine   on core.mandat (mandat_origine_id) where mandat_origine_id is not null;
create index mandat_entreprise on core.mandat (entreprise_id);

-- ---------------------------------------------------------------------
-- Les quatre liaisons du mandat. Exception assumée à la règle « id uuid
-- partout » : listes à deux colonnes, la clé naturelle suffit et interdit
-- le doublon.
-- ---------------------------------------------------------------------

create table core.mandat_cible (
  mandat_id uuid not null references core.mandat(id) on delete cascade,
  cible     ref.cible_produit not null,
  primary key (mandat_id, cible)
);

create table core.mandat_remote (
  mandat_id uuid not null references core.mandat(id) on delete cascade,
  remote    ref.rythme_remote not null,
  primary key (mandat_id, remote)
);
create index mandat_remote_inverse on core.mandat_remote (remote);

create table core.mandat_secteur_nogo (
  mandat_id  uuid not null references core.mandat(id)  on delete cascade,
  secteur_id uuid not null references ref.secteur(id)  on delete restrict,
  primary key (mandat_id, secteur_id)
);
comment on table core.mandat_secteur_nogo is 'Aucune ligne à migrer : la donnée n''existe pas dans le miroir.';

create table core.mandat_tag_job (
  mandat_id  uuid not null references core.mandat(id)  on delete cascade,
  tag_job_id uuid not null references ref.tag_job(id)  on delete restrict,
  primary key (mandat_id, tag_job_id)
);
comment on table core.mandat_tag_job is
  'BLOCAGE DE REPRISE À LEVER : 830 lignes à migrer, mais la 16e valeur « Job exclu » (18 mandats) n''a jamais existé dans le référentiel Bubble. ref.tag_job doit la porter avant le chargement, sinon la clé étrangère rejette ces 18 lignes.';
create index mandat_tag_job_inverse on core.mandat_tag_job (tag_job_id);

-- ---------------------------------------------------------------------

create table core.candidature (
  id                            uuid primary key default gen_random_uuid(),
  bubble_id                     text,
  fiche_talent_id               uuid references core.fiche_talent(id)  on delete set null,
  talent_id                     uuid references core.talent(id)        on delete set null,
  mandat_id                     uuid references core.mandat(id)        on delete cascade,
  entreprise_id                 uuid references core.entreprise(id)    on delete set null,
  etape_id                      uuid references ref.etape_process(id)  on delete restrict,
  compte_rendu                  text,
  appreciation_like             text,
  appreciation_personnalite     text,
  points_forts                  text,
  points_faibles                text,
  infos_remuneration            text,
  salaire_min_ke                numeric(12,2),
  salaire_souhaite_ke           numeric(12,2),
  tjm_min                       numeric(12,2),
  tjm_souhaite                  numeric(12,2),
  date_entree_pipeline          timestamptz,
  date_ko                       timestamptz,
  date_dernier_changement_etape timestamptz,
  date_prochaine_echeance       timestamptz,
  reference_pseudonyme          text,
  -- Reste en text : ref.motif_ko N'EXISTE PAS et doit être créé. C'est la
  -- donnée la plus manquante du domaine — 6 287 KO sur 7 243 candidatures,
  -- aucun motif nulle part.
  motif_ko_code                 text,
  motif_ko_commentaire          text,
  argumentaire_client           text,
  retire_par_talent_le          timestamptz,
  motif_retrait                 text,
  feedback_fin_process          jsonb,
  est_spontanee                 boolean     not null default false,
  cree_par_id                   uuid references core.collaborateur(id) on delete set null,
  cree_le                       timestamptz not null default now(),
  maj_le                        timestamptz not null default now(),
  constraint candidature_spontanee_sans_mandat check (not est_spontanee or mandat_id is null)
  -- PAS d'UNIQUE (talent_id, mandat_id) : la mesure ne l'autorise pas.
  -- Une vue de contrôle des doublons de couple remplace la contrainte.
  -- date_ko >= cree_le : mesurée VACUE — date_statut_ko n'est renseignée
  -- sur aucune ligne du miroir. Non posée faute d'objet.
);
comment on table core.candidature is
  'La rencontre entre un talent et un mandat — l''entité, pas le trait. 7 243 lignes, 1,74 candidature par talent jusqu''à 26, 15,3 par mandat jusqu''à 240. ⚠ RGPD : compte_rendu, les deux appréciations, les points forts et faibles et l''argumentaire client portent des jugements sur des personnes. Le ON DELETE SET NULL vers la fiche préserve l''historique commercial, ce qui implique que l''effacement doit ANONYMISER ces six champs par un acte distinct.';
create unique index candidature_bubble_unique on core.candidature (bubble_id) where bubble_id is not null;
create unique index candidature_pseudo_unique on core.candidature (reference_pseudonyme) where reference_pseudonyme is not null;
create index candidature_kanban on core.candidature (mandat_id, etape_id);
-- Détection des candidatures bloquées (aging / SLA).
create index candidature_aging  on core.candidature (date_dernier_changement_etape) where date_ko is null;
create index candidature_motif_ko on core.candidature (motif_ko_code) where motif_ko_code is not null;
create index candidature_fiche   on core.candidature (fiche_talent_id);

-- ---------------------------------------------------------------------

create table core.analyse (
  id        uuid primary key default gen_random_uuid(),
  bubble_id text,
  mandat_id uuid references core.mandat(id)        on delete cascade,
  contenu   text        not null,
  niveau    ref.niveau_analyse,
  auteur_id uuid references core.collaborateur(id) on delete set null,
  cree_le   timestamptz not null default now(),
  maj_le    timestamptz not null default now()
);
create unique index analyse_bubble_unique on core.analyse (bubble_id) where bubble_id is not null;
create index analyse_fil       on core.analyse (mandat_id, cree_le desc);
create index analyse_vigilance on core.analyse (niveau) where niveau = 'vigilance';

-- ---------------------------------------------------------------------

create table core.placement (
  id                             uuid primary key default gen_random_uuid(),
  bubble_id                      text,
  fiche_talent_id                uuid references core.fiche_talent(id)      on delete set null,
  talent_id                      uuid references core.talent(id)            on delete set null,
  entreprise_id                  uuid references core.entreprise(id)        on delete restrict,
  mandat_id                      uuid references core.mandat(id)            on delete restrict,
  candidature_id                 uuid references core.candidature(id)       on delete set null,
  apporteur_cooptation_id        uuid references core.apporteur_affaires(id) on delete set null,
  apporteur_deal_id              uuid references core.apporteur_affaires(id) on delete set null,
  univers_id                     uuid references ref.univers(id)            on delete restrict,
  type_contributeur              ref.type_contributeur,
  contrat                        ref.type_contrat,
  statut_contrat_freelance_id    uuid references ref.statut_contrat(id)     on delete restrict,
  statut_contrat_entreprise_id   uuid references ref.statut_contrat(id)     on delete restrict,
  date_closing                   timestamptz not null,
  date_debut_mission             timestamptz,
  date_fin_garantie              timestamptz,
  date_fin_mission               timestamptz,
  salaire_final_ke               numeric(12,2),
  commission                     numeric(12,2),
  commission_nette               numeric(12,2),
  montant_apport_affaires        numeric(12,2),
  montant_cooptation_talent      numeric(12,2),
  tjm_facture_client             numeric(12,2),
  tjm_verse_talent               numeric(12,2),
  est_archive                    boolean     not null default false,
  statut_paiement                ref.statut_paiement,
  montant_remboursement_garantie numeric(12,2),
  rembourse_le                   timestamptz,
  cree_par_id                    uuid references core.collaborateur(id)     on delete set null,
  cree_le                        timestamptz not null default now(),
  maj_le                         timestamptz not null default now()
  -- PAS d'UNIQUE (candidature_id) : 2 candidatures partagent un placement.
  -- PAS de CHECK de positivité sur les montants : un avoir est négatif.
  -- REFUSÉES, à poser NOT VALID après la reprise et correction d'1 ligne
  -- chacune :
  --   check (date_fin_mission is null or date_debut_mission is null
  --          or date_fin_mission >= date_debut_mission)     -- 78 ok, 1 violent
  --   check (date_fin_garantie is null or date_fin_garantie >= date_closing)
  --                                                          -- 159 ok, 1 violent
);
comment on table core.placement is
  'L''ex public.mandatclose, 227 lignes : la candidature qui aboutit, et l''entité de revenu. date_closing est NOT NULL (227/227 mesurés), ce qui fait de « placement = deal closé » une règle de la base — à refuser si l''application doit pouvoir préparer un placement avant signature. ⚠ UNITÉS NON VÉRIFIÉES : salaire_final est en K€ depuis l''harmonisation du 01/07, mais commission, commission_nette et l''apport d''affaires ne l''ont pas été. Une erreur d''unité ici fausse tout le reporting financier.';
create unique index placement_bubble_unique on core.placement (bubble_id) where bubble_id is not null;
create index placement_mandat    on core.placement (mandat_id);
create index placement_fiche     on core.placement (fiche_talent_id);
create index placement_closing   on core.placement (date_closing desc);
create index placement_paiement  on core.placement (statut_paiement) where est_archive = false;
create index placement_ent_date  on core.placement (entreprise_id, date_closing);

create table core.placement_utilisateur (
  placement_id uuid not null references core.placement(id)     on delete cascade,
  utilisateur_id uuid not null references core.collaborateur(id) on delete cascade,
  cree_le      timestamptz not null default now(),
  primary key (placement_id, utilisateur_id)
);
comment on table core.placement_utilisateur is
  'CONTRÔLE DE REPRISE : mandatclose.note_user_ids est renseigné sur 227/227 lignes — vérifier qu''aucun élément du tableau ne pointe un utilisateur inexistant avant de charger, la clé étrangère les rejetterait.';
create index placement_util_inverse on core.placement_utilisateur (utilisateur_id);

-- ---------------------------------------------------------------------

create table core.repartition_commission (
  id                           uuid primary key default gen_random_uuid(),
  bubble_id                    text,
  placement_id                 uuid references core.placement(id)      on delete cascade,
  agent_1_id                   uuid references core.collaborateur(id)  on delete set null,
  agent_1_montant              numeric(12,2),
  agent_1_pct                  numeric(5,2),
  agent_1_est_absolu           boolean     not null default false,
  agent_2_id                   uuid references core.collaborateur(id)  on delete set null,
  agent_2_montant              numeric(12,2),
  agent_2_pct                  numeric(5,2),
  agent_2_est_absolu           boolean     not null default false,
  apporteur_cooptation_montant numeric(12,2),
  apporteur_cooptation_pct     numeric(5,2),
  apporteur_deal_montant       numeric(12,2),
  apporteur_deal_pct           numeric(5,2),
  pachamama_montant            numeric(12,2),
  pachamama_pct                numeric(5,2),
  net_montant                  numeric(12,2),
  net_pct                      numeric(5,2),
  total_montant                numeric(12,2),
  total_pct                    numeric(5,2),
  cree_par_id                  uuid references core.collaborateur(id)  on delete set null,
  cree_le                      timestamptz not null default now(),
  maj_le                       timestamptz not null default now(),
  -- MESURÉ sur les 267 lignes : toutes les valeurs sont dans [0, 100].
  -- Maxima observés : agent_1 75, agent_2 60, cooptation 6,25, deal 25, pacha 100.
  constraint repart_agent1_pct     check (agent_1_pct               is null or agent_1_pct               between 0 and 100),
  constraint repart_agent2_pct     check (agent_2_pct               is null or agent_2_pct               between 0 and 100),
  constraint repart_coopt_pct      check (apporteur_cooptation_pct  is null or apporteur_cooptation_pct  between 0 and 100),
  constraint repart_deal_pct       check (apporteur_deal_pct        is null or apporteur_deal_pct        between 0 and 100),
  constraint repart_pacha_pct      check (pachamama_pct             is null or pachamama_pct             between 0 and 100)
  -- net_pct et total_pct NON contraints : la convention (0–1 ou 0–100) et la
  -- formule d'agrégation sont inconnues. Une vue de contrôle des écarts vaut
  -- mieux qu'une contrainte fausse qui bloquerait 266 lignes.
);
create unique index repart_bubble_unique on core.repartition_commission (bubble_id) where bubble_id is not null;
create index repart_placement on core.repartition_commission (placement_id);
create index repart_agent1    on core.repartition_commission (agent_1_id);
create index repart_agent2    on core.repartition_commission (agent_2_id);

-- ---------------------------------------------------------------------
-- LES QUATRE CLÉS ÉTRANGÈRES QUE LE MANDAT ET LE PLACEMENT DÉBLOQUENT
-- ---------------------------------------------------------------------

alter table core.mandat_contact_client
  add constraint mcc_mandat_fk foreign key (mandat_id) references core.mandat(id) on delete cascade;

alter table core.tag
  add constraint tag_mandat_fk foreign key (mandat_id) references core.mandat(id) on delete cascade;

alter table core.enquete_nps
  add constraint nps_mandat_fk foreign key (mandat_id) references core.mandat(id) on delete set null;

alter table core.enquete_nps
  add constraint nps_placement_fk foreign key (placement_id) references core.placement(id) on delete set null;

-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['mandat','candidature','analyse','placement','repartition_commission']
  loop
    execute format(
      'create trigger %I before update on core.%I for each row execute function core.touche_maj_le()',
      t || '_maj_le', t);
  end loop;
end $$;

grant select on all tables in schema core to authenticated;
grant all    on all tables in schema core to service_role;
