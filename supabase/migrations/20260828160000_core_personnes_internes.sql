-- =====================================================================
-- SCHÉMA core, domaine des PERSONNES INTERNES — 3 tables
--
--   core.collaborateur         les gens de Pachamama
--   core.collaborateur_univers leur rattachement aux verticales
--   core.apporteur_affaires    la casquette apporteur / cooptant, 20 lignes
--
-- Décision 4 de l'ADR 0003 : comptes et personnes sont deux choses.
-- public.user n'est PAS la table des employés, c'est la table de tout le
-- monde — 4 605 lignes dont 4 214 candidats et 347 contacts client.
-- core.collaborateur ne reprend que les internes.
--
-- COMBIEN D'INTERNES, EXACTEMENT. Le chiffre de 41 qui circule est celui
-- des LIGNES de public.user_role (Admin 10, Recruiter Core Team 13,
-- Recruiter Support Crew 18). Mesuré le 27/08/2026 : cela fait
-- 38 PERSONNES distinctes, certaines cumulant deux rôles.
--
-- ET IL FAUT Y AJOUTER LES ANCIENS. candidat.agent_pachamama_id et
-- candidat_expanded.agent_id désignent 4 personnes qui n'ont plus aucun
-- rôle interne — d'anciens membres de l'équipe, dont 3 portent un
-- candidat_id et sont donc aussi des talents. Les exclure orphelinerait
-- 1 959 fiches. D'où le couple actif / est_supprime : la table porte les
-- anciens, le drapeau dit qui est en poste.
-- =====================================================================

create table core.collaborateur (
  id                    uuid primary key default gen_random_uuid(),
  bubble_id             text,
  nom                   text,
  prenom                text,
  email                 text,
  photo_url             text,
  fonction              ref.fonction_utilisateur,
  langue                ref.langue,
  talent_id             uuid references core.talent(id) on delete set null,
  actif                 boolean     not null default true,
  est_supprime          boolean     not null default false,
  premiere_connexion_le timestamptz,
  derniere_connexion_le timestamptz,
  cree_le               timestamptz not null default now(),
  maj_le_source         timestamptz,
  maj_le                timestamptz not null default now(),
  constraint collab_supprime_pas_actif check (not (est_supprime and actif))
  -- PAS de NOT NULL sur nom / prenom / email malgré l'évidence métier :
  -- non mesuré sur les internes, et l'e-mail n'existe NULLE PART dans le
  -- miroir — les 18 colonnes de public.user n'en comportent aucune, elle
  -- vit dans auth.users. Le seed devra la rapprocher par ailleurs.
);
comment on table core.collaborateur is
  'La personne qui travaille chez Pachamama : 38 en poste, plus les anciens encore référencés sur des fiches. Le collaborateur survit à la disparition de la projection — un effacement RGPD côté talent n''efface pas un employé. Le détail écrit `ref.fonction_user` : l''énuméré s''appelle ref.fonction_utilisateur, c''est ce nom qui est employé ici.';
create unique index collab_bubble_unique on core.collaborateur (bubble_id);
-- Clé de rapprochement avec auth.users, insensible à la casse.
create unique index collab_email_unique  on core.collaborateur (lower(email)) where email is not null;
create index collab_talent on core.collaborateur (talent_id) where talent_id is not null;
create index collab_actif  on core.collaborateur (actif) where actif;
create index collab_nom    on core.collaborateur (nom, prenom);

-- ---------------------------------------------------------------------

create table core.collaborateur_univers (
  collaborateur_id          uuid not null references core.collaborateur(id) on delete cascade,
  univers_id                uuid not null references ref.univers(id)        on delete restrict,
  bubble_id                 text,
  cree_le                   timestamptz not null default now(),
  cree_par_collaborateur_id uuid references core.collaborateur(id) on delete set null,
  primary key (collaborateur_id, univers_id)
);
comment on table core.collaborateur_univers is
  'TABLE DE LIAISON, et non une colonne. La Décision 4 annonçait que user_partner « se replie dans le collaborateur, ce n''est pas une entité ». La mesure la contredit sur ce point de forme : 8 lignes pour 2 utilisateurs distincts, soit jusqu''à 7 univers pour une personne. Un repli en colonne unique perdrait 6 des 8 lignes.';
create unique index collab_univers_bubble_unique on core.collaborateur_univers (bubble_id);
create index collab_univers_inverse on core.collaborateur_univers (univers_id);

-- ---------------------------------------------------------------------
-- core.apporteur_affaires
--
-- ARBITRAGE EN ATTENTE, et choix REVERSIBLE fait ici. Deux versions
-- s'opposent dans le détail :
--
--   STRICTE   — aucune identité propre, CHECK (talent_id IS NOT NULL),
--               les 5 apporteurs qui ne sont pas des talents devant être
--               créés au pivot AVANT la reprise. Respecte la Décision 5
--               à la lettre. C'est la version recommandée par le détail,
--               MAIS elle a un préalable qui n'est pas dans le plan.
--   TOLÉRANTE — nom_affichage et email_contact renseignés seulement quand
--               talent_id est nul. Réintroduit deux colonnes que la
--               décision voulait supprimer.
--
-- La version tolérante est retenue ICI, et voici pourquoi : elle ne
-- ferme aucune porte. Passer ensuite au strict est une petite migration
-- (resserrer le CHECK, supprimer deux colonnes) une fois les 5 talents
-- créés au pivot. Choisir le strict maintenant, en revanche, ferait
-- échouer la reprise tant que ce préalable n'est pas exécuté — et
-- perdrait l'identité de ces 5 personnes si on l'oubliait.
-- ---------------------------------------------------------------------

create table core.apporteur_affaires (
  id                        uuid primary key default gen_random_uuid(),
  bubble_id                 text,
  talent_id                 uuid references core.talent(id)        on delete set null,
  raison_sociale            text,
  siret                     text,
  taux_commission_pct       numeric(5,2),
  conditions_texte          text,
  nom_affichage             text,
  email_contact             text,
  cree_par_collaborateur_id uuid references core.collaborateur(id) on delete set null,
  cree_le                   timestamptz not null default now(),
  maj_le_source             timestamptz,
  maj_le                    timestamptz not null default now(),
  constraint apporteur_taux check (taux_commission_pct is null or taux_commission_pct between 0 and 100),
  -- Version TOLÉRANTE. En version stricte : check (talent_id is not null).
  constraint apporteur_identifiable check (talent_id is not null or nom_affichage is not null)
);
comment on table core.apporteur_affaires is
  'La casquette apporteur d''affaires ou cooptant, 20 lignes. Elle NE RECOPIE PLUS l''identité : le miroir dupliquait prénom, nom, e-mail et photo d''une personne déjà présente dans candidat. ON DELETE SET NULL et jamais CASCADE vers le talent : un apporteur est une contrepartie contractuelle, son enregistrement ne disparaît pas parce que la projection s''est rafraîchie. La ligne survit orpheline et une vue de contrôle la signale. La photo du miroir (business_maker.picture_url) n''est pas reprise — pour les 5 apporteurs qui ne sont pas des talents, elle devra naître au pivot si la version stricte est retenue.';
create unique index apporteur_bubble_unique on core.apporteur_affaires (bubble_id);
create index apporteur_talent on core.apporteur_affaires (talent_id)          where talent_id is not null;
create index apporteur_email  on core.apporteur_affaires (lower(email_contact)) where email_contact is not null;

-- ---------------------------------------------------------------------
-- LES SEPT CLÉS ÉTRANGÈRES QUE core.collaborateur DÉBLOQUE
-- ---------------------------------------------------------------------

alter table core.fiche_talent
  add constraint fiche_agent_referent_fk
  foreign key (agent_referent_id) references core.collaborateur(id) on delete set null;

alter table core.fiche_talent
  add constraint fiche_apporteur_fk
  foreign key (apporteur_affaires_id) references core.apporteur_affaires(id) on delete set null;

alter table core.entreprise
  add constraint ent_account_manager_fk
  foreign key (account_manager_id) references core.collaborateur(id) on delete set null;

alter table core.entreprise
  add constraint ent_cree_par_fk
  foreign key (cree_par_id) references core.collaborateur(id) on delete set null;

alter table core.contact_client
  add constraint contact_cree_par_fk
  foreign key (cree_par_id) references core.collaborateur(id) on delete set null;

alter table core.produit
  add constraint produit_cree_par_fk
  foreign key (cree_par_id) references core.collaborateur(id) on delete set null;

alter table core.tag
  add constraint tag_cree_par_fk
  foreign key (cree_par_id) references core.collaborateur(id) on delete set null;

-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['collaborateur','apporteur_affaires']
  loop
    execute format(
      'create trigger %I before update on core.%I for each row execute function core.touche_maj_le()',
      t || '_maj_le', t);
  end loop;
end $$;

grant select on all tables in schema core to authenticated;
grant all    on all tables in schema core to service_role;
