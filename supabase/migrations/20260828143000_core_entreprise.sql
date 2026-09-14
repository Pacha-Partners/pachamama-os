-- =====================================================================
-- SCHÉMA core, domaine ENTREPRISE ET CONTACTS — 6 tables
--
--   core.entreprise             850 lignes, le client
--   core.contact_client         ~427 personnes, la moitié « personne »
--   core.mandat_contact_client  ~714 participations, la moitié « rencontre »
--   core.produit                103 produits
--   core.tag                    110 tags
--   core.enquete_nps            118 enquêtes
--
-- Décision 6 de l'ADR 0003 : le contact client est scindé en deux. La
-- personne d'un côté, sa participation à un mandat de l'autre — parce que
-- « contact principal » varie par mandat pour 41 personnes et n'est donc
-- pas un attribut de la personne.
--
-- ─────────────────────────────────────────────────────────────────────
-- ÉCART DÉLIBÉRÉ AVEC LE DÉTAIL, ET SA JUSTIFICATION
--
-- Le détail écrit les vocabulaires de ce domaine en « _code text », alors
-- que core.fiche_talent type les MÊMES notions par leur énuméré. Deux
-- domaines, deux conventions, pour une seule réalité. Mesuré le 28/08/2026
-- sur les 851 lignes de public.entreprise, colonne par colonne :
--
--   statut          832 renseignés,  5 distincts → tient dans ref.statut_relation
--   formule          59,             4           → ref.formule_mission
--   agence           58,             5           → ref.form_concurrence
--   recommandation   59,             5           → ref.form_provenance
--   niveau_anglais   63,             4           → ref.niveau_anglais
--   product_type    145,            11           → ref.type_produit_entreprise
--   type_entreprise   0,             0           → ref.type_entreprise
--   statut_contrat  195,             3           → table ref.statut_contrat (FK)
--
-- ZÉRO orpheline. Les colonnes sont donc typées par leur énuméré ou par
-- une vraie clé étrangère. Restent en text + CHECK les seuls vocabulaires
-- sans référentiel : garantie (2 valeurs) et paiement (2 valeurs), qui
-- pourront être promus quand on décidera de leur donner un type.
-- ─────────────────────────────────────────────────────────────────────
--
-- DEUX CONTRAINTES SONT VOLONTAIREMENT REPORTÉES APRÈS LA REPRISE, et ce
-- n'est pas un oubli : « NOT VALID » n'exempte que les lignes DÉJÀ dans la
-- table, jamais les insertions suivantes. Les poser maintenant ferait
-- échouer le chargement qu'elles étaient censées ne pas gêner. Mesuré.
--
-- Clés étrangères encore différées : vers core.collaborateur (5 colonnes),
-- core.mandat (3) et core.placement (1). En revanche cette migration POSE
-- trois des six clés que le domaine talent avait laissées en attente.
-- =====================================================================

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------

create table core.entreprise (
  id                         uuid primary key default gen_random_uuid(),
  bubble_id                  text,
  nom                        text,
  raison_sociale             text,
  description                text,
  fondateur                  text,
  serie_financement          text,
  site_web                   text,
  domaine_normalise          text,
  siret                      text,
  video_url                  text,
  logo_url                   text,
  note_interne               text,
  localisation_json          jsonb,
  localisation_texte         text,
  nb_employes                integer,
  nb_techs                   integer,
  secteur_id                 uuid references ref.secteur(id)         on delete restrict,
  type_produit               ref.type_produit_entreprise,
  type_entreprise            ref.type_entreprise,
  exigence_anglais           ref.niveau_anglais,
  remote                     ref.rythme_remote,
  statut_relation            ref.statut_relation,
  statut_contrat_id          uuid references ref.statut_contrat(id)  on delete restrict,
  formule                    ref.formule_mission,
  agence                     ref.form_concurrence,
  recommandation             ref.form_provenance,
  success_fee_pct            numeric(5,2),
  success_fee_abs            numeric(12,2),
  success_fee_est_absolu     boolean     not null default false,
  apport_affaires            boolean     not null default false,
  apport_affaires_pct        numeric(5,2),
  exclusivite                boolean     not null default false,
  exclusivite_details        text,
  duree_exclusivite_semaines smallint,
  nb_mois_garantie           smallint,
  type_garantie_code         text,
  base_paiement_code         text,
  date_signature_contrat     timestamptz,
  date_fin_contrat           timestamptz,
  email_facturation          text,
  raison_sociale_facturation text,
  adresse_facturation        jsonb,
  account_manager_id         uuid,   -- FK → core.collaborateur, différée
  hs_company_id              text,
  actif                      boolean     not null default true,
  fusionnee_vers_id          uuid references core.entreprise(id)     on delete set null,
  cree_par_id                uuid,   -- FK → core.collaborateur, différée
  cree_le                    timestamptz not null default now(),
  maj_le                     timestamptz not null default now(),
  constraint ent_fee_pct     check (success_fee_pct     is null or success_fee_pct     between 0 and 100),
  constraint ent_apport_pct  check (apport_affaires_pct is null or apport_affaires_pct between 0 and 100),
  constraint ent_fee_abs     check (success_fee_abs     is null or success_fee_abs     >= 0),
  constraint ent_employes    check (nb_employes         is null or nb_employes         >= 0),
  constraint ent_techs       check (nb_techs            is null or nb_techs            >= 0),
  constraint ent_exclu_duree check (duree_exclusivite_semaines is null or duree_exclusivite_semaines > 0),
  constraint ent_garantie_nb check (nb_mois_garantie    is null or nb_mois_garantie    >= 0),
  constraint ent_pas_autofus check (fusionnee_vers_id is distinct from id),
  constraint ent_dates       check (date_fin_contrat is null or date_signature_contrat is null
                                    or date_fin_contrat >= date_signature_contrat),
  -- Vocabulaires fermés SANS référentiel au miroir : CHECK du miroir repris
  -- tel quel. Promouvables en énumérés le jour où on leur donne un type.
  constraint ent_type_garantie check (type_garantie_code is null or type_garantie_code in ('remplacement','remboursement')),
  constraint ent_base_paiement check (base_paiement_code is null or base_paiement_code in ('sign_date','start_date'))
);
comment on table core.entreprise is
  'Le client. 850 lignes. domaine_normalise sert la détection de doublons mais N''EST PAS unique : 303 fiches dormantes en double restent à traiter, une unicité échouerait à la reprise.';

create unique index ent_bubble_unique on core.entreprise (bubble_id);
create unique index ent_hs_unique     on core.entreprise (hs_company_id) where hs_company_id is not null;
create index ent_domaine        on core.entreprise (domaine_normalise);
create index ent_nom_trgm       on core.entreprise using gin (nom extensions.gin_trgm_ops);
create index ent_account_mgr    on core.entreprise (account_manager_id) where account_manager_id is not null;
create index ent_secteur        on core.entreprise (secteur_id);
create index ent_statut         on core.entreprise (statut_relation);
create index ent_actif          on core.entreprise (actif) where actif;
create index ent_fin_contrat    on core.entreprise (date_fin_contrat) where date_fin_contrat is not null;
create index ent_fusion         on core.entreprise (fusionnee_vers_id) where fusionnee_vers_id is not null;

-- ---------------------------------------------------------------------

create table core.contact_client (
  id                      uuid primary key default gen_random_uuid(),
  bubble_id               text,
  entreprise_id           uuid references core.entreprise(id) on delete cascade,
  nom                     text,
  prenom                  text,
  email                   extensions.citext,
  description             text,
  photo_url               text,
  metier_id               uuid references ref.metier(id)  on delete restrict,
  univers_id              uuid references ref.univers(id) on delete restrict,
  talent_id               uuid references core.talent(id) on delete set null,
  est_referent_entreprise boolean     not null default false,
  actif                   boolean     not null default true,
  cree_par_id             uuid,   -- FK → core.collaborateur, différée
  cree_le                 timestamptz not null default now(),
  maj_le                  timestamptz not null default now(),
  constraint contact_referent_a_une_entreprise
    check (est_referent_entreprise = false or entreprise_id is not null)
);
comment on table core.contact_client is
  'LA PERSONNE — moitié « personne » de la scission de la Décision 6. talent_id N''EST PAS unique : une personne peut être contact chez deux entreprises, et 374 talents du pivot sont nés de fusions. bubble_id n''est pas injectif non plus : 766 lignes equipe se replient sur ~427 contacts, la provenance des lignes absorbées vit sur mandat_contact_client.bubble_id.';

-- CONTRAINTE VOLONTAIREMENT ABSENTE ICI, à poser APRÈS la reprise :
--   alter table core.contact_client add constraint contact_identifiable
--     check (nom is not null or prenom is not null or email is not null) not valid;
-- Le détail prescrivait de la poser NOT VALID « pour ne pas bloquer la
-- reprise ». MESURÉ le 28/08/2026 : c'est faux. NOT VALID dispense les
-- lignes DÉJÀ PRÉSENTES du contrôle, mais toute insertion ultérieure est
-- vérifiée — la reprise, qui insère, serait donc rejetée sur les 42 sans
-- nom, 29 sans prénom et 92 sans e-mail. L'ordre correct est : charger,
-- PUIS ajouter la contrainte NOT VALID, qui exempte alors le chargé et
-- protège l'avenir.

create unique index contact_bubble_unique on core.contact_client (bubble_id);
create index contact_entreprise on core.contact_client (entreprise_id);
-- Une personne, une entreprise, un e-mail. À VALIDER après déduplication.
create unique index contact_email_entreprise on core.contact_client (email, entreprise_id) where email is not null;
create index contact_email  on core.contact_client (email)     where email is not null;
create index contact_talent on core.contact_client (talent_id) where talent_id is not null;
create unique index contact_referent_unique on core.contact_client (entreprise_id) where est_referent_entreprise;
create index contact_actif on core.contact_client (actif) where actif;

-- ---------------------------------------------------------------------

create table core.mandat_contact_client (
  id                    uuid primary key default gen_random_uuid(),
  bubble_id             text,
  mandat_id             uuid not null,   -- FK → core.mandat, différée
  contact_client_id     uuid not null references core.contact_client(id) on delete cascade,
  est_contact_principal boolean     not null default false,
  type_equipe_code      text,
  cree_le               timestamptz not null default now(),
  maj_le                timestamptz not null default now()
  -- NON POSÉE, à mesurer d'abord : UNIQUE (mandat_id) WHERE est_contact_principal.
  -- « Au plus un contact principal par mandat » n'a jamais été mesuré.
);
comment on table core.mandat_contact_client is
  'LA PARTICIPATION — moitié « rencontre » de la Décision 6, et le domicile de « contact principal », qui varie par mandat pour 41 personnes. ~714 lignes attendues, union de mandat_equipe (705) et equipe (644). Les ~70 venues du seul mandat_equipe naissent avec est_contact_principal = false et type_equipe_code NULL : cette table du miroir est une jonction nue, sans attribut ni horodatage. Perte assumée sur 10 % des lignes.';
create unique index mcc_paire_unique on core.mandat_contact_client (mandat_id, contact_client_id);
create index mcc_contact on core.mandat_contact_client (contact_client_id);

-- ---------------------------------------------------------------------

create table core.produit (
  id            uuid primary key default gen_random_uuid(),
  bubble_id     text,
  nom           text,
  entreprise_id uuid not null references core.entreprise(id)      on delete cascade,
  description   text,
  texte_annonce text,
  maturite_id   uuid references ref.maturite_produit(id)          on delete restrict,
  cree_par_id   uuid,   -- FK → core.collaborateur, différée
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now()
);
comment on table core.produit is
  '103 produits. `nom` est un AJOUT signalé : le miroir n''identifie un produit que par son texte explicatif (83,5 %) et une description vide à 100 %. Pas d''unicité (entreprise_id, nom) : la colonne n''est pas peuplée, la contrainte n''aurait rien à défendre. maturite_id est une vraie clé étrangère et non un code texte — ref.maturite_produit est une table, le détail du domaine produit écrivait « maturite_code » là où le domaine des référentiels prévoyait la clé.';
create unique index produit_bubble_unique on core.produit (bubble_id);
create index produit_entreprise on core.produit (entreprise_id);
create index produit_maturite   on core.produit (maturite_id);

-- ---------------------------------------------------------------------

create table core.tag (
  id            uuid primary key default gen_random_uuid(),
  bubble_id     text,
  libelle       text        not null,
  description   text,
  portee_code   text        not null,
  entreprise_id uuid references core.entreprise(id) on delete cascade,
  mandat_id     uuid,   -- FK → core.mandat, différée
  actif         boolean     not null default true,
  ordre         smallint,
  cree_par_id   uuid,   -- FK → core.collaborateur, différée
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now(),
  constraint tag_portee check (portee_code in ('candidat','entreprise','job')),
  constraint tag_ordre  check (ordre is null or ordre >= 0)
);
-- CONTRAINTE VOLONTAIREMENT ABSENTE ICI, à poser APRÈS la reprise, même
-- raison que sur core.contact_client :
--   alter table core.tag add constraint tag_une_seule_attache
--     check (num_nonnulls(entreprise_id, mandat_id) <= 1) not valid;
-- Le recouvrement des 5 entreprise_id et des 16 mandat_id n'a pas été croisé.
comment on table core.tag is
  '110 tags. NON POSÉE, à vérifier d''abord : UNIQUE (lower(libelle), portee_code) — le nettoyage de taxonomie est un chantier ouvert et les doublons de libellé n''ont pas été mesurés.';
create unique index tag_bubble_unique on core.tag (bubble_id);
create index tag_portee_actif on core.tag (portee_code, actif);
create index tag_entreprise   on core.tag (entreprise_id) where entreprise_id is not null;
create index tag_mandat       on core.tag (mandat_id)     where mandat_id is not null;
create index tag_ordre        on core.tag (ordre);

-- ---------------------------------------------------------------------

create table core.enquete_nps (
  id                       uuid primary key default gen_random_uuid(),
  contact_client_id        uuid references core.contact_client(id) on delete set null,
  contact_bubble_id_source text,
  mandat_id                uuid,   -- FK → core.mandat, différée
  placement_id             uuid,   -- FK → core.placement, différée
  cible_bubble_id_source   text,
  contact_email            extensions.citext not null,
  contact_prenom           text,
  intitule_poste_envoye    text,
  raison_sociale_envoyee   text,
  prenom_talent_envoye     text,
  type_campagne_code       text,
  statut_code              text        not null,
  envoye_le                timestamptz,
  relance_le               timestamptz,
  repondu_le               timestamptz,
  score                    smallint,
  commentaire              text,
  cree_le                  timestamptz not null default now(),
  maj_le                   timestamptz not null default now(),
  -- La cible est un mandat OU un placement, jamais les deux.
  -- <= 1 et non = 1 : 15 lignes ne désignent rien.
  constraint nps_une_cible   check (num_nonnulls(mandat_id, placement_id) <= 1),
  constraint nps_score       check (score is null or score between 0 and 10),
  constraint nps_relance     check (relance_le is null or envoye_le is null or relance_le >= envoye_le),
  constraint nps_reponse     check (repondu_le is null or envoye_le is null or repondu_le >= envoye_le),
  constraint nps_type        check (type_campagne_code is null or type_campagne_code in ('close','termine')),
  constraint nps_statut      check (statut_code in ('sent','reminded','responded','ignored'))
  -- NON POSÉE : statut 'responded' ⇒ repondu_le ET score renseignés.
  -- repondu_le est VIDE à 100 % au miroir.
);
comment on table core.enquete_nps is
  '118 enquêtes. Les colonnes _envoye figent ce qui a RÉELLEMENT été envoyé au client — un intitulé de poste changé après coup ne doit pas réécrire l''historique. type_campagne_code est l''arbitre probable du polymorphisme mandat/placement : à croiser avec la résolution par identifiant avant de s''y fier.';
create index nps_contact   on core.enquete_nps (contact_client_id) where contact_client_id is not null;
create index nps_placement on core.enquete_nps (placement_id)      where placement_id is not null;
create index nps_mandat    on core.enquete_nps (mandat_id)         where mandat_id is not null;
create index nps_attente   on core.enquete_nps (statut_code, envoye_le desc);
create index nps_email     on core.enquete_nps (contact_email);
create index nps_serie     on core.enquete_nps (envoye_le desc);

-- ---------------------------------------------------------------------
-- TROIS DES SIX CLÉS ÉTRANGÈRES QUE LE DOMAINE TALENT AVAIT DIFFÉRÉES
-- ---------------------------------------------------------------------

alter table core.fiche_talent
  add constraint fiche_poste_actuel_entreprise_fk
  foreign key (poste_actuel_entreprise_id) references core.entreprise(id) on delete set null;

alter table core.fiche_talent_poste
  add constraint ft_poste_entreprise_fk
  foreign key (entreprise_id) references core.entreprise(id) on delete set null;

alter table core.fiche_talent_tag
  add constraint ft_tag_tag_fk
  foreign key (tag_id) references core.tag(id) on delete cascade;

-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['entreprise','contact_client','mandat_contact_client',
                           'produit','tag','enquete_nps']
  loop
    execute format(
      'create trigger %I before update on core.%I for each row execute function core.touche_maj_le()',
      t || '_maj_le', t);
  end loop;
end $$;

grant select on all tables in schema core to authenticated;
grant all    on all tables in schema core to service_role;
