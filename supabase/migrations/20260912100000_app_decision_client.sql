-- ═══════════════════════════════════════════════════════════════════════════
-- app.decision_client — la décision d'un client sur une candidature.
--
-- Le ticket J3 la veut « dans une table dont l'application est seule
-- maîtresse ». Elle va donc dans `app`, jamais dans `core` : `core` porte le
-- métier repris de Bubble, `app` porte les actes que l'application produit
-- elle-même — au même titre que `app.mandat_publication` (l'acte de publier)
-- et `app.transition_etape` (l'acte de faire avancer).
--
-- POURQUOI `sens` EST UN text + CHECK ET NON UN ÉNUMÉRÉ
-- Précédent : `app.journal_ecriture.operation`. Motif : un ALTER TYPE ne peut
-- pas être suivi d'un usage de la nouvelle valeur dans la même transaction —
-- piège déjà payé deux fois sur ce projet (app.portail, D-04). Trois valeurs
-- aujourd'hui, et la quatrième (« en_attente », « à revoir ») est plausible.
--
-- POURQUOI `compte_id` EST NULLABLE ET EN `on delete set null`
-- Même règle que `app.journal_ecriture.auteur_compte_id` et
-- `app.transition_etape.auteur_compte_id` : effacer l'AUTEUR ne doit pas
-- effacer l'ACTE. `app.compte.auth_id` référence `auth.users` en CASCADE :
-- un `on delete restrict` ici rendrait impossible la suppression d'un compte
-- d'authentification, ce que COMPTES_DE_TEST.md décrit comme le geste normal.
-- La colonne est néanmoins TOUJOURS remplie à l'écriture — la policy
-- d'insertion l'exige (`compte_id = api.compte_id()`).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists app.decision_client (
  id             uuid primary key default gen_random_uuid(),
  candidature_id uuid not null references core.candidature(id) on delete cascade,
  compte_id      uuid references app.compte(id) on delete set null,
  sens           text not null,
  -- Le référentiel créé par 20260912091000_ref_motif_ko.sql. `on update
  -- cascade` parce que le code EST la clé : un renommage doit se propager.
  motif_ko_code  text references ref.motif_ko(code) on update cascade on delete restrict,
  commentaire    text,
  decidee_le     timestamptz not null default now(),
  cree_le        timestamptz not null default now(),
  constraint decision_sens_connu
    check (sens in ('valide','refuse','entretien_demande')),
  -- Un refus sans motif est exactement ce que D-05 refuse : 6 285 KO muets.
  constraint decision_refus_motive
    check (sens <> 'refuse' or motif_ko_code is not null),
  constraint decision_motif_reserve_au_refus
    check (motif_ko_code is null or sens = 'refuse')
);

comment on table app.decision_client is
  'La décision d''un client sur une candidature qui lui a été présentée. Table de l''application, jamais alimentée par la synchro Bubble. Elle est le JOURNAL de la décision : la conséquence — étape avancée, note partagée — vit dans core.candidature et core.note, et n''est pas rejouable depuis ici.';
comment on column app.decision_client.sens is
  'valide (signal positif, n''avance pas l''étape) · entretien_demande (send_out → interview_1) · refuse (→ ko_by_client, motif exigé).';
comment on column app.decision_client.compte_id is
  'Le compte client auteur. Nullable UNIQUEMENT pour survivre à la suppression de son auteur ; la policy d''insertion le rend obligatoire à l''écriture.';

create index if not exists decision_candidature on app.decision_client (candidature_id, decidee_le desc);
create index if not exists decision_compte      on app.decision_client (compte_id, decidee_le desc) where compte_id is not null;
create index if not exists decision_motif       on app.decision_client (motif_ko_code) where motif_ko_code is not null;

-- ── RLS ────────────────────────────────────────────────────────────────
-- Fermeture par défaut : la table naît sans policy, donc muette.
alter table app.decision_client enable row level security;

-- Le client lit et écrit les décisions de SES candidatures. Le périmètre
-- passe par core.candidature.entreprise_id — la colonne que le modèle
-- garantit désormais par clé étrangère, contrairement au miroir.
drop policy if exists client_ses_decisions on app.decision_client;
create policy client_ses_decisions on app.decision_client
  for select to authenticated
  using (candidature_id in (
           select c.id from core.candidature c
            where c.entreprise_id in (select api.mes_entreprises())));

drop policy if exists client_decide on app.decision_client;
create policy client_decide on app.decision_client
  for insert to authenticated
  with check (
        compte_id = api.compte_id()
    and candidature_id in (
          select c.id from core.candidature c
           where c.entreprise_id in (select api.mes_entreprises())));

-- L'interne lit tout. Il n'écrit pas ici : une décision CLIENT écrite par
-- Pachamama serait un faux.
drop policy if exists interne_lecture on app.decision_client;
create policy interne_lecture on app.decision_client
  for select to authenticated
  using (api.est_interne());

-- ── Droits ─────────────────────────────────────────────────────────────
-- `alter default privileges in schema app grant select on tables to
-- authenticated` (migration 20260828213000) accorde déjà le SELECT. On le
-- nomme quand même : un droit hérité d'une clause posée trois semaines plus
-- tôt n'est pas un droit lisible.
grant select on app.decision_client to authenticated, service_role;
grant insert (candidature_id, compte_id, sens, motif_ko_code, commentaire, decidee_le)
  on app.decision_client to authenticated;
grant all on app.decision_client to service_role;

-- ── Contrôle ───────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'app' and c.relname = 'decision_client' and c.relrowsecurity) then
    raise exception 'app.decision_client sans RLS : la table serait ouverte à tout compte connecté';
  end if;
  if (select count(*) from pg_policies where schemaname = 'app' and tablename = 'decision_client') <> 3 then
    raise exception 'app.decision_client : 3 policies attendues, % trouvées',
      (select count(*) from pg_policies where schemaname = 'app' and tablename = 'decision_client');
  end if;
end $$;
