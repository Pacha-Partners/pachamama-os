-- ═══════════════════════════════════════════════════════════════════════════
-- Une note peut être partagée. Il faut donc pouvoir dire avec qui.
--
-- `core.note` porte 45 685 lignes et AUCUNE colonne de visibilité. Trois
-- features en dépendent — notes partagées en lecture côté client, commentaires
-- libres du client, fil d'échange avec l'Account Manager — et aucune ne peut
-- exister sans distinguer une note interne d'une note partagée.
--
-- Deux booléens plutôt qu'un énuméré : une note peut légitimement être partagée
-- avec le client ET avec le candidat (un compte rendu d'entretien). Un énuméré
-- à valeur unique l'interdirait, et l'élargir plus tard coûte un ALTER TYPE qui
-- ne peut pas être suivi d'un usage dans la même transaction — piège déjà payé
-- sur app.portail. Décision D-04.
-- ═══════════════════════════════════════════════════════════════════════════

alter table core.note
  add column if not exists visible_client boolean not null default false,
  add column if not exists visible_talent boolean not null default false;

comment on column core.note.visible_client is
  'Partagée avec le contact client. FAUX par défaut, et faux sur les 45 685 notes reprises : elles ont été écrites sans que personne n''envisage qu''un client les lise.';
comment on column core.note.visible_talent is
  'Partagée avec le talent concerné. Même règle : fermé par défaut, aucun backfill.';

-- Aucun backfill. L'ouverture rétroactive de 45 685 notes écrites en confiance
-- serait exactement le genre de décision silencieuse que ce projet refuse.

-- ── L'index qui sert les deux portails. Partiel : les notes partagées sont
-- une petite minorité, et le resteront.
create index if not exists note_partagee_client
  on core.note (entreprise_id, mandat_id, candidature_id)
  where visible_client;

create index if not exists note_partagee_talent
  on core.note (fiche_talent_id, candidature_id)
  where visible_talent;

-- ── Les policies de lecture. Elles n'existaient pas : il n'y a aujourd'hui
-- AUCUNE policy talent ni client sur core.note.
--
-- Côté client : une note partagée, rattachée à une entité de son périmètre.
create policy client_notes_partagees on core.note
  for select to authenticated
  using (
    visible_client
    and (
         entreprise_id in (select api.mes_entreprises())
      or mandat_id in (select m.id from core.mandat m where m.entreprise_id in (select api.mes_entreprises()))
      or candidature_id in (select c.id from core.candidature c where c.entreprise_id in (select api.mes_entreprises()))
    )
  );

-- Côté talent : une note partagée, qui parle de lui.
create policy talent_notes_partagees on core.note
  for select to authenticated
  using (
    visible_talent
    and (
         fiche_talent_id = api.ma_fiche_talent()
      or candidature_id in (select c.id from core.candidature c where c.fiche_talent_id = api.ma_fiche_talent())
    )
  );
