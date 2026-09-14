-- ═══════════════════════════════════════════════════════════════════════════
-- Une note peut être écrite par un CLIENT. Il faut donc pouvoir le dire.
--
-- LE CONSTAT, MESURÉ AVANT D'ÉCRIRE
-- `core.note` ne connaît que deux auteurs possibles :
--     auteur_collaborateur_id  → core.collaborateur (l'équipe Pachamama)
--     auteur_fiche_talent_id   → core.fiche_talent  (le candidat)
-- et la contrainte `note_un_seul_auteur` interdit d'en remplir deux.
-- Aucune colonne ne désigne un COMPTE CLIENT. Or J3 demande deux écritures
-- signées d'un client — `api.commenter_candidature` (« auteur = le compte
-- client ») et la note que `api.decider_candidature` dépose — et
-- `api.note_partagee` doit rendre « vous » quand l'auteur est le lecteur.
-- Sans cette colonne, ces notes seraient anonymes, donc indistinguables des
-- 45 685 notes reprises sans auteur résolu.
--
-- POURQUOI PAS `core.contact_client` COMME AUTEUR
-- Parce que la Décision 4 de l'ADR 0003 est explicite : les droits — et donc
-- les actes — s'accrochent à l'ACCÈS, jamais à la personne. Le compte est ce
-- qui a agi ; le contact est qui il est. C'est aussi ce que font déjà
-- `app.mandat_publication.publie_par_compte_id` et
-- `core.mandat.cloture_demandee_par_compte_id`.
--
-- Additif : aucune ligne existante n'est touchée, aucune contrainte n'est
-- remplacée. La nouvelle contrainte ÉLARGIT l'exclusion mutuelle sans
-- réécrire `note_un_seul_auteur`, qu'elle laisse en place.
-- ═══════════════════════════════════════════════════════════════════════════

alter table core.note
  add column if not exists auteur_compte_id uuid references app.compte(id) on delete set null;

comment on column core.note.auteur_compte_id is
  'Le compte qui a écrit la note quand ce n''est ni un collaborateur ni un talent — aujourd''hui : un contact client depuis le portail Entreprise. NULL sur les 45 685 notes reprises. on delete set null : effacer l''auteur n''efface pas la note.';

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'core.note'::regclass
                    and conname = 'note_auteur_compte_exclusif') then
    alter table core.note add constraint note_auteur_compte_exclusif
      check (auteur_compte_id is null
             or num_nonnulls(auteur_collaborateur_id, auteur_fiche_talent_id) = 0);
  end if;
end $$;

create index if not exists note_auteur_compte
  on core.note (auteur_compte_id, cree_le desc) where auteur_compte_id is not null;

-- Contrôle : la contrainte doit être valide sur les 45 685 lignes existantes,
-- sans NOT VALID — elles ont toutes auteur_compte_id nul.
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'core.note'::regclass
                    and conname = 'note_auteur_compte_exclusif' and convalidated) then
    raise exception 'note_auteur_compte_exclusif non validée';
  end if;
end $$;
