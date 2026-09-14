-- =====================================================================
-- SCHÉMA app — ce que l'application possède en propre — 6 tables
--
--   app.compte             l'identité d'authentification, et rien d'autre
--   app.acces              une ligne par CONTEXTE : c'est lui qui porte les droits
--   app.mandat_publication l'ACTE de publication d'une offre
--   app.transition_etape   l'historique des changements d'étape
--   app.journal_ecriture   ce qui a changé, quand, par qui
--   app.idempotence        une écriture rejouée ne produit qu'un effet
--
-- Décision 4 de l'ADR 0003 : comptes et personnes sont deux choses, et
-- les droits sont accrochés à l'ACCÈS, jamais à la personne. Sans quoi
-- une candidate devenue cliente verrait les notes écrites sur elle.
-- =====================================================================

create schema if not exists app;
comment on schema app is
  'Ce que l''application possède : authentification, droits, actes, journaux. Écrit par l''application seule.';

create type app.portail          as enum ('talent','entreprise','interne');
-- OUVERT : le cadrage demande un niveau superadmin au-dessus d'admin. Le
-- parti n'en énumère que trois. À trancher — quatrième valeur d'énuméré,
-- ou booléen sur l'accès interne ? Mais jamais une colonne sur la
-- personne, ce qui remettrait un droit sur la personne.
create type app.role_interne     as enum ('admin','recruteur','support');
create type app.canal_publication as enum ('job_board_public','espace_talent');
create type app.origine_transition as enum ('app','ats','client','talent','import','automatique');

create or replace function app.touche_maj_le() returns trigger
language plpgsql as $$
begin
  new.maj_le := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------

create table app.compte (
  id                    uuid primary key default gen_random_uuid(),
  -- NULLABLE, contre correspondance.json qui en fait la clé primaire.
  -- Deux mesures l'imposent : public.user.auth_id est vide sur 4 605
  -- lignes, et seuls 7 comptes d'authentification existent. Sans cette
  -- nullabilité, aucun accès interne n'est migrable.
  auth_id               uuid references auth.users(id) on delete cascade,
  actif                 boolean     not null default true,
  desactive_le          timestamptz,
  derniere_connexion_le timestamptz,
  cree_le               timestamptz not null default now(),
  maj_le                timestamptz not null default now(),
  constraint compte_desactivation_datee check (actif or desactive_le is not null)
);
comment on table app.compte is
  'L''identité d''authentification, et rien d''autre : ni personne, ni entreprise, ni droit. Supabase Auth est indexé sur l''e-mail, donc UNE PERSONNE A UN COMPTE ET UN SEUL — « deux comptes pour la même personne » n''est pas un état atteignable. Un compte sans auth_id est PRÉ-PROVISIONNÉ : état lisible, à purger s''il n''est jamais activé.';
create unique index compte_auth_unique on app.compte (auth_id);
create index compte_desactives on app.compte (actif) where not actif;

-- « Un compte sans accès est impossible » (Décision 4) n'est PAS exprimable
-- par une contrainte de table : c'est un cycle, insertion compte → insertion
-- accès. La fonction est créée ici, le déclencheur NE L'EST PAS.
--
-- Motif, et c'est le même que pour les contraintes NOT VALID du domaine
-- entreprise : un CONSTRAINT TRIGGER DEFERRABLE ne vérifie qu'au COMMIT,
-- ce qui suppose que comptes et accès soient chargés DANS LA MÊME
-- TRANSACTION. Une reprise qui charge table par table échouerait. À
-- attacher APRÈS le chargement, par :
--
--   create constraint trigger compte_a_un_acces
--     after insert on app.compte deferrable initially deferred
--     for each row execute function app.verifier_compte_a_un_acces();
create or replace function app.verifier_compte_a_un_acces() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from app.acces where compte_id = new.id) then
    raise exception 'le compte % n''a aucun accès : un compte sans contexte n''ouvre rien', new.id
      using errcode = '23514';
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------

create table app.acces (
  id                 uuid primary key default gen_random_uuid(),
  compte_id          uuid not null references app.compte(id)          on delete cascade,
  -- Le lien d'identité entre casquettes NE PASSE PAS par ici (Décision 5) :
  -- sur les 11 contacts qui sont aussi candidats, 8 n'ont pas de compte.
  -- Il vit entre les PERSONNES — contact_client.talent_id, etc.
  fiche_talent_id    uuid references core.fiche_talent(id)            on delete cascade,
  contact_client_id  uuid references core.contact_client(id)          on delete cascade,
  collaborateur_id   uuid references core.collaborateur(id)           on delete cascade,
  portail            app.portail generated always as (
                       case when fiche_talent_id   is not null then 'talent'::app.portail
                            when contact_client_id is not null then 'entreprise'::app.portail
                            else 'interne'::app.portail end) stored,
  role_interne       app.role_interne,
  actif              boolean     not null default true,
  cle_correspondance text,
  cree_par_compte_id uuid references app.compte(id)                   on delete set null,
  cree_le            timestamptz not null default now(),
  maj_le             timestamptz not null default now(),
  -- LA contrainte centrale de la Décision 4. La base sait vérifier trois
  -- liens ; elle ne saurait pas vérifier un couple « type + identifiant ».
  constraint acces_exactement_une_personne
    check (num_nonnulls(fiche_talent_id, contact_client_id, collaborateur_id) = 1),
  -- Le pouvoir interne n'existe que sur un accès interne, et un accès
  -- interne en porte toujours un.
  constraint acces_role_si_interne
    check ((collaborateur_id is not null) = (role_interne is not null))
);
comment on table app.acces is
  'UNE LIGNE PAR CONTEXTE. Un accès rattache un compte à exactement une personne, et c''est lui — jamais la personne — qui porte les droits. Un candidat placé qui devient responsable de recrutement chez son nouvel employeur AJOUTE une ligne : rien de ce qui existait ne bouge. Corollaire : être un talent ne donne pas l''accès talent. ⚠ Cette table reçoit user_role.user_id et sert de point d''atterrissage au rapprochement fondé sur user.entreprise_id (344 valeurs), qui n''est pas une colonne cible mais une clé de reprise.';

-- L'index le plus chaud du schéma : lu à chaque requête authentifiée.
create index acces_compte on app.acces (compte_id);
create index acces_matrice on app.acces (portail, role_interne) where actif;
create unique index acces_fiche_unique   on app.acces (fiche_talent_id)   where fiche_talent_id is not null;
create unique index acces_contact_unique on app.acces (contact_client_id) where contact_client_id is not null;
create unique index acces_collab_unique  on app.acces (collaborateur_id)  where collaborateur_id is not null;

-- ---------------------------------------------------------------------

create table app.mandat_publication (
  id                      uuid primary key default gen_random_uuid(),
  -- Vraie clé étrangère, contrairement au « text non contraint » de
  -- correspondance.json : l'interdit de la Décision 1 vise public, réécrit
  -- par la synchro, pas core que l'application possède.
  mandat_id               uuid not null references core.mandat(id) on delete restrict,
  canal                   app.canal_publication not null,
  libelle_public          text,
  salaire_affiche         text,
  mode_de_travail_affiche text,
  publie_le               timestamptz not null default now(),
  publie_par_compte_id    uuid references app.compte(id) on delete set null,
  retire_le               timestamptz,
  retire_par_compte_id    uuid references app.compte(id) on delete set null,
  motif_retrait           text,
  cree_le                 timestamptz not null default now(),
  maj_le                  timestamptz not null default now(),
  constraint publication_retrait_apres check (retire_le is null or retire_le >= publie_le)
);
comment on table app.mandat_publication is
  'L''ACTE de publication. Un mandat est publié parce qu''une ligne existe ici et que retire_le est nul — plus jamais parce que quatre drapeaux s''alignent. Corrige le défaut mesuré : 24 combinaisons de job_anonyme × job_off_market × statut × visibilite gouvernaient l''exposition d''une offre, dont 15 mandats publics ET clos. Reprise : 35 mandats ''public'' → job_board_public, 2 ''talent_only'' → espace_talent, 496 ''private'' → aucune ligne. ON DELETE RESTRICT et non CASCADE : la ligne porte de la saisie manuelle — libellé public, salaire affiché — qu''un CASCADE détruirait.';
-- Interdit STRUCTURELLEMENT deux publications actives sur le même canal.
create unique index publication_active_unique on app.mandat_publication (mandat_id, canal) where retire_le is null;
create index publication_fraicheur on app.mandat_publication (publie_le desc) where retire_le is null;
create index publication_mandat on app.mandat_publication (mandat_id);

-- ---------------------------------------------------------------------

create table app.transition_etape (
  id               uuid primary key default gen_random_uuid(),
  candidature_id   uuid not null references core.candidature(id)  on delete cascade,
  etape_avant_id   uuid references ref.etape_process(id)          on delete restrict,
  etape_apres_id   uuid not null references ref.etape_process(id) on delete restrict,
  survenue_le      timestamptz not null default now(),
  origine          app.origine_transition not null,
  auteur_compte_id uuid references app.compte(id)                 on delete set null,
  -- FK vers ref.motif_ko À POSER quand ce référentiel existera : il n'est
  -- pas encore créé, et c'est la donnée la plus manquante du domaine.
  motif_ko_code    text,
  commentaire      text,
  constraint transition_change_etape check (etape_avant_id is distinct from etape_apres_id),
  constraint transition_auto_sans_auteur check (origine <> 'automatique' or auteur_compte_id is null)
);
comment on table app.transition_etape is
  'L''historique des changements d''étape. Entité NEUVE et nécessaire : les deux colonnes du miroir censées porter ces dates — process.date_statut_applicant et date_statut_ko — sont mesurées à 0 %, donc aucune durée par étape n''est calculable aujourd''hui. AUCUNE REPRISE POSSIBLE : la table naît vide, l''historique antérieur est définitivement perdu. Le motif de KO se saisit AU MOMENT de la transition ; core.candidature.motif_ko_code n''en est que l''état courant.';
create index transition_fil     on app.transition_etape (candidature_id, survenue_le desc);
create index transition_funnel  on app.transition_etape (etape_apres_id, survenue_le);
create index transition_periode on app.transition_etape (survenue_le);

-- ---------------------------------------------------------------------

create table app.journal_ecriture (
  id               bigint generated always as identity primary key,
  lot_id           uuid        not null,
  -- Aucune clé étrangère sur (entite, entite_id) : la référence est
  -- volontairement polymorphe et textuelle, sans quoi le journal serait
  -- détruit par la disparition de ce qu'il journalise.
  entite           text        not null,
  entite_id        uuid        not null,
  champ            text,
  valeur_avant     jsonb,
  valeur_apres     jsonb,
  operation        text        not null,
  origine          ref.origine_valeur not null,
  -- Pas de cascade : effacer l'AUTEUR ne doit pas effacer le journal.
  -- C'est l'effacement du SUJET qui l'emporte, et le sujet n'est pas
  -- atteignable par une clé étrangère.
  auteur_compte_id uuid references app.compte(id) on delete set null,
  survenu_le       timestamptz not null default now(),
  cible_ats        text,
  statut_http      smallint,
  etat             text,
  constraint journal_operation check (operation in ('insert','update','delete')),
  -- À sens unique : automatique implique sans auteur, mais un import peut
  -- très bien en avoir un.
  constraint journal_auto_sans_auteur check (origine <> 'automatique' or auteur_compte_id is null),
  constraint journal_update_a_un_champ check (operation <> 'update' or champ is not null),
  constraint journal_statut_http check (statut_http is null or statut_http between 100 and 599)
);
comment on table app.journal_ecriture is
  'UN SEUL journal, pas deux — l''historique de la fiche talent y passe aussi, une vue le filtre pour l''affichage. Deux mécanismes de journalisation divergeraient, c''est la leçon du bug employeur_actuel_src. ⚠ DONNÉES PERSONNELLES : valeur_avant et valeur_apres contiennent noms, coordonnées, salaires et appréciations. (1) L''effacement d''une personne doit emporter son historique, or il n''y a pas de FK donc pas de CASCADE : il faut une procédure de purge sur (entite, entite_id). (2) L''anonymisation de la base de dev DOIT couvrir ces deux colonnes — c''est typiquement ce qu''on oublie. (3) RLS stricte : aucun portail talent ou entreprise ne lit cette table en direct.';
create index journal_ligne  on app.journal_ecriture (entite, entite_id, survenu_le desc);
create index journal_lot    on app.journal_ecriture (lot_id);
create index journal_auteur on app.journal_ecriture (auteur_compte_id, survenu_le desc) where auteur_compte_id is not null;
-- Table en APPEND PUR : la purge par ancienneté et les fenêtres temporelles
-- n'ont pas besoin d'un btree complet.
create index journal_periode_brin on app.journal_ecriture using brin (survenu_le);
create index journal_etat on app.journal_ecriture (etat) where etat is not null;

-- ---------------------------------------------------------------------

create table app.idempotence (
  cle              text primary key,
  compte_id        uuid references app.compte(id) on delete cascade,
  empreinte_charge text        not null,
  resultat         jsonb,
  cree_le          timestamptz not null default now(),
  expire_le        timestamptz not null,
  constraint idempotence_expiration check (expire_le > cree_le)
);
comment on table app.idempotence is
  'Garantir qu''une écriture rejouée ne produit qu''UN SEUL effet et renvoie le MÊME résultat — pas seulement « ne rien faire ». ⚠ PURGE OBLIGATOIRE : une tâche planifiée doit supprimer WHERE expire_le < now(). Sans elle la table croît indéfiniment et son index primaire devient le coût de chaque écriture.';
create index idempotence_purge  on app.idempotence (expire_le);
create index idempotence_compte on app.idempotence (compte_id) where compte_id is not null;

-- ---------------------------------------------------------------------
-- LES QUATRE DERNIÈRES CLÉS ÉTRANGÈRES DIFFÉRÉES DE core
-- ---------------------------------------------------------------------

alter table core.fiche_talent
  add constraint fiche_cree_par_compte_fk
  foreign key (cree_par_compte_id) references app.compte(id) on delete set null;

alter table core.fiche_talent_tag
  add constraint ft_tag_pose_par_fk
  foreign key (pose_par_compte_id) references app.compte(id) on delete set null;

alter table core.mandat
  add constraint mandat_cloture_par_fk
  foreign key (cloture_demandee_par_compte_id) references app.compte(id) on delete set null;

alter table core.tache
  add constraint tache_notif_destinataire_fk
  foreign key (notif_destinataire_compte_id) references app.compte(id) on delete set null;

-- Et celle que config.modele_email attendait depuis sa création.
alter table config.modele_email
  add constraint modele_email_cree_par_fk
  foreign key (cree_par_compte_id) references app.compte(id) on delete set null;

-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['compte','acces','mandat_publication']
  loop
    execute format(
      'create trigger %I before update on app.%I for each row execute function app.touche_maj_le()',
      t || '_maj_le', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- DROITS. app est le schéma le plus sensible : le journal porte des
-- données personnelles, l'accès porte les droits. Aucune lecture anon.
-- ---------------------------------------------------------------------

grant usage on schema app to authenticated, service_role;
grant select on all tables in schema app to authenticated;
grant all    on all tables in schema app to service_role;
alter default privileges in schema app grant select on tables to authenticated;
alter default privileges in schema app grant all    on tables to service_role;

revoke all on app.journal_ecriture from authenticated;
revoke all on app.idempotence      from authenticated;
