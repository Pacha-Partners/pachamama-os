-- =====================================================================
-- SCHÉMA core, domaine du JOURNAL ET DU TRAVAIL — 2 tables
--
--   core.note   ~50 900 lignes après fusion et reprise des colonnes
--               qualitatives de la fiche
--   core.tache  1 141 tâches, task_notif replié dedans
--
-- Décision 8 de l'ADR 0003. Ces deux entités portent des fonctionnalités
-- DÉJÀ EN PRODUCTION et n'avaient aucune cible avant le 27/08/2026.
--
-- core.note À NE PAS CONFONDRE AVEC app.journal_ecriture : la note est un
-- contenu rédigé, relu par un recruteur ; le journal d'écriture est une
-- trace machine des changements de champ. Deux publics, deux durées de vie.
-- =====================================================================

create table core.note (
  id                      uuid primary key default gen_random_uuid(),
  bubble_id               text,
  -- Les cinq ancrages. Aucune contrainte « au moins une cible » : 540 notes
  -- n'en portent aucune. Elles migrent telles quelles et une vue de contrôle
  -- les signale ; les supprimer serait une décision de produit.
  fiche_talent_id         uuid references core.fiche_talent(id) on delete cascade,
  entreprise_id           uuid references core.entreprise(id)   on delete cascade,
  mandat_id               uuid references core.mandat(id)       on delete cascade,
  placement_id            uuid references core.placement(id)    on delete cascade,
  candidature_id          uuid references core.candidature(id)  on delete cascade,
  commentaire             text,
  evenement_id            uuid references ref.evenement_note(id) on delete restrict,
  valeur_avant            text,
  valeur_apres            text,
  est_automatique         boolean     not null default false,
  -- L'AUTEUR. Mesuré sur 50 452 notes : 67,8 % viennent des internes,
  -- 31,4 % d'un candidat, 23 notes d'un contact entreprise. L'auteur n'est
  -- jamais quelconque — deux clés étrangères nullables résolvent 99,25 %
  -- des cas, les 378 restants gardent leur identifiant Bubble.
  auteur_collaborateur_id uuid references core.collaborateur(id) on delete set null,
  -- SET NULL et non CASCADE, contrairement à fiche_talent_id ci-dessus :
  -- une note écrite PAR une personne survit à son effacement, une note
  -- écrite SUR elle non. Deux clés vers la même table, deux politiques
  -- opposées — c'est voulu, et c'est la seule subtilité de cette entité.
  auteur_fiche_talent_id  uuid references core.fiche_talent(id)  on delete set null,
  auteur_bubble_id        text,
  ecrite_le               timestamptz,
  archivee_le             timestamptz,
  cree_le                 timestamptz not null default now(),
  maj_le                  timestamptz not null default now(),
  constraint note_un_seul_auteur
    check (num_nonnulls(auteur_collaborateur_id, auteur_fiche_talent_id) <= 1),
  constraint note_repli_sans_auteur_resolu
    check (auteur_bubble_id is null
           or num_nonnulls(auteur_collaborateur_id, auteur_fiche_talent_id) = 0),
  constraint note_archivage check (archivee_le is null or archivee_le >= cree_le)
);
comment on table core.note is
  'Le journal métier. Fusionne public.note (25 805) et public.note_archivee (25 318), qui ne partagent AUCUN identifiant — l''archivage crée une ligne neuve, à ~1 500 par mois. Rapprochées par leur contenu : 5 060 empreintes communes, donc 46 063 notes et non 51 123. S''y ajoutent 4 834 notes typées issues de colonnes de la fiche. Les quatre tables de liaison du miroir sont ABANDONNÉES : candidat_note porte 0 ligne, et entreprise_note (991), mandat_note (2 013), mandatclose_note (1 292) sont toutes plus petites que les colonnes scalaires équivalentes — des N-N de façade. ⚠ DONNÉES PERSONNELLES : commentaire porte des appréciations sur des personnes, même périmètre d''effacement et d''anonymisation que app.journal_ecriture.';
comment on column core.note.candidature_id is
  'Les 2 067 notes à trois cibles du miroir portent TOUJOURS la même combinaison candidat + entreprise + mandat, signature d''une candidature : 2 028 (98,1 %) se résolvent contre process et migrent ici, les trois clés brutes laissées à NULL puisque dérivables. Les 39 sans process conservent candidat_id et mandat_id.';

create unique index note_bubble_unique on core.note (bubble_id) where bubble_id is not null;
-- La lecture réelle : les notes de cette personne, les plus récentes d'abord.
create index note_fiche_fil       on core.note (fiche_talent_id, ecrite_le desc);
create index note_candidature_fil on core.note (candidature_id, ecrite_le desc);
create index note_entreprise      on core.note (entreprise_id) where entreprise_id is not null;
create index note_mandat          on core.note (mandat_id)     where mandat_id is not null;
create index note_placement       on core.note (placement_id)  where placement_id is not null;
create index note_auteur_collab   on core.note (auteur_collaborateur_id) where auteur_collaborateur_id is not null;
create index note_evenement       on core.note (evenement_id)  where evenement_id is not null;
create index note_archivees       on core.note (archivee_le)   where archivee_le is not null;

-- ---------------------------------------------------------------------

create table core.tache (
  id                           uuid primary key default gen_random_uuid(),
  bubble_id                    text,
  texte                        text,
  type_tache_id                uuid references ref.type_tache(id)     on delete restrict,
  est_faite                    boolean     not null default false,
  placement_id                 uuid references core.placement(id)     on delete cascade,
  -- Les quatre rattachements ci-dessous sont A_CREER : le miroir ne porte
  -- que mandatclose_id. Exigés par la « file de travail unifiée ».
  mandat_id                    uuid references core.mandat(id)        on delete cascade,
  candidature_id               uuid references core.candidature(id)   on delete cascade,
  fiche_talent_id              uuid references core.fiche_talent(id)  on delete cascade,
  entreprise_id                uuid references core.entreprise(id)    on delete cascade,
  echeance_le                  timestamptz,
  -- 100 % des créateurs et des assignés sont parmi les internes : mesuré,
  -- ce qui autorise ici des clés étrangères strictes là où la note a dû
  -- rester souple.
  assignee_collaborateur_id    uuid references core.collaborateur(id) on delete set null,
  creee_par_collaborateur_id   uuid references core.collaborateur(id) on delete set null,
  maj_par_collaborateur_id     uuid references core.collaborateur(id) on delete set null,
  -- task_notif replié : cardinalité 1:1 MESURÉE — 1 141 task_id distincts
  -- pour 1 141 tâches, aucune tâche à plusieurs notifications.
  notif_envoyee                boolean     not null default false,
  notif_apercu                 text,
  notif_email                  text,
  notif_texte                  text,
  notif_envoyee_le             timestamptz,
  notif_bubble_id              text,
  notif_canal                  ref.canal_notification,
  notif_destinataire_compte_id uuid,   -- FK → app.compte, différée
  notif_lue_le                 timestamptz,
  notif_statut_delivrabilite   text,
  cree_le                      timestamptz not null default now(),
  maj_le                       timestamptz not null default now(),
  -- MESURÉ le 28/08/2026 : 984 notifications envoyées, 0 sans wf_date.
  constraint tache_notif_datee check (not notif_envoyee or notif_envoyee_le is not null),
  constraint tache_notif_lue   check (notif_lue_le is null or notif_envoyee)
);
comment on table core.tache is
  'La to-do opérationnelle du recruteur : relances, onboarding après placement, échéances de garantie. 1 141 lignes, 820 ouvertes et 321 faites, dont 1 104 (96,8 %) rattachées à un closing. public.task_notif s''y replie sur une cardinalité 1:1 mesurée. PRIX DÉCLARÉ DU REPLI : 16 notifications orphelines (task_id nul) n''ont pas de tâche d''accueil et sont perdues. Colonnes abandonnées : task.slug, task_notif.slug, task.task_notif_id (le repli le rend inutile), task_notif.task_type (vide à 100 %), task_notif.wf_id (identifiant de workflow Bubble, meurt avec Bubble).';

create unique index tache_bubble_unique on core.tache (bubble_id) where bubble_id is not null;
-- La seule lecture chaude : mes tâches ouvertes, par échéance.
create index tache_ouvertes  on core.tache (assignee_collaborateur_id, echeance_le) where not est_faite;
create index tache_placement on core.tache (placement_id) where placement_id is not null;
create index tache_type      on core.tache (type_tache_id);

-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['note','tache']
  loop
    execute format(
      'create trigger %I before update on core.%I for each row execute function core.touche_maj_le()',
      t || '_maj_le', t);
  end loop;
end $$;

grant select on all tables in schema core to authenticated;
grant all    on all tables in schema core to service_role;
