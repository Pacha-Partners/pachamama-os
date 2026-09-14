-- ═══════════════════════════════════════════════════════════════════════════
-- La demande de suppression d'un talent — une TRACE, pas une gâchette.
--
-- POURQUOI UNE TABLE ET PAS UN `delete`
-- La cascade héritée de Bubble détruit, depuis `core.fiche_talent`, les
-- `process` (candidatures), les `note` et les `contact`. Mesuré sur le miroir :
-- 7 236 candidatures et 45 685 notes pendent à ces fiches. Un bouton qui
-- effacerait pour de bon serait, au premier clic maladroit, une perte de
-- données irréversible pour le cabinet ET pour les clients dont la candidature
-- disparaîtrait du pipeline.
--
-- Le droit à l'effacement du RGPD n'exige pas l'immédiateté : il exige que la
-- demande soit reçue, tracée et honorée. C'est ce que cette table fait.
-- L'effacement réel reste un acte administré — une décision humaine, hors
-- application, sur un périmètre qu'on aura d'abord regardé.
--
-- Ce que la fonction `api.demander_ma_suppression` en fera :
--   1. une ligne ici ;
--   2. `core.fiche_talent.actif = false` — la fiche sort des vues de recherche
--      du cabinet (`api.talent_recherche` filtre déjà sur `f.actif`) ;
--   3. une ligne de journal.
-- Rien d'autre. Rien n'est détruit.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists app.demande_suppression (
  id                    uuid primary key default gen_random_uuid(),
  fiche_talent_id       uuid not null references core.fiche_talent(id) on delete cascade,
  compte_id             uuid not null references app.compte(id),
  motif                 text,
  demandee_le           timestamptz not null default now(),
  traitee_le            timestamptz,
  traitee_par_compte_id uuid references app.compte(id),
  suite_donnee          text,
  constraint demande_suppression_traitee_coherente
    check ((traitee_le is null) = (traitee_par_compte_id is null))
);

comment on table app.demande_suppression is
  'Le droit à l''effacement, reçu et tracé. N''efface RIEN : la cascade Bubble détruirait candidatures et notes. L''effacement réel est un acte administré.';
comment on column app.demande_suppression.suite_donnee is
  'Ce que le cabinet a fait de la demande, en clair. Rempli à la main au traitement.';

-- Une seule demande ouverte à la fois : la deuxième n'apporte rien et
-- brouillerait le décompte des demandes à traiter.
create unique index if not exists demande_suppression_une_ouverte
  on app.demande_suppression (fiche_talent_id) where traitee_le is null;

create index if not exists demande_suppression_a_traiter
  on app.demande_suppression (demandee_le) where traitee_le is null;

alter table app.demande_suppression enable row level security;

-- ── Qui voit quoi ──────────────────────────────────────────────────────
drop policy if exists talent_sa_demande         on app.demande_suppression;
drop policy if exists talent_demande_suppression on app.demande_suppression;
drop policy if exists interne_lecture           on app.demande_suppression;
drop policy if exists interne_ecriture          on app.demande_suppression;

create policy talent_sa_demande on app.demande_suppression
  for select to authenticated
  using (fiche_talent_id = (select api.ma_fiche_talent()));

create policy talent_demande_suppression on app.demande_suppression
  for insert to authenticated
  with check (fiche_talent_id = (select api.ma_fiche_talent())
              and compte_id   = (select api.compte_id())
              -- Une demande naît ouverte. Se déclarer soi-même « traité »
              -- viderait la file du cabinet sans que personne n'ait rien fait.
              and traitee_le is null
              and traitee_par_compte_id is null
              and suite_donnee is null);

create policy interne_lecture on app.demande_suppression
  for select to authenticated using ((select api.est_interne()));

create policy interne_ecriture on app.demande_suppression
  for all to authenticated
  using ((select api.est_interne())) with check ((select api.est_interne()));

-- ── Droits, colonne par colonne ────────────────────────────────────────
grant select on app.demande_suppression to authenticated, service_role;
grant insert (fiche_talent_id, compte_id, motif) on app.demande_suppression to authenticated;
-- `traitee_le`, `traitee_par_compte_id` et `suite_donnee` ne sont accordées à
-- personne : le traitement se fait à la clé de service, comme l'effacement.

-- ── Contrôle ───────────────────────────────────────────────────────────
do $$
begin
  if has_column_privilege('authenticated', 'app.demande_suppression', 'traitee_le', 'insert')
     or has_column_privilege('authenticated', 'app.demande_suppression', 'traitee_le', 'update') then
    raise exception 'app.demande_suppression.traitee_le est écrivable par authenticated : la file du cabinet est falsifiable';
  end if;
  if not has_column_privilege('authenticated', 'app.demande_suppression', 'motif', 'insert') then
    raise exception 'app.demande_suppression n''est pas écrivable : api.demander_ma_suppression échouera';
  end if;
end $$;
