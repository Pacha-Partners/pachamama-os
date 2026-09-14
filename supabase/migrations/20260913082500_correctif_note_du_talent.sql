-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECTIF de 20260913081000 — la policy `talent_ecrit_sa_note` demandait
-- une ligne que la table interdit.
--
-- CE QUE LA CONTRAINTE DIT, ET QUE JE N'AVAIS PAS LU AVANT D'ÉCRIRE :
--
--   note_auteur_compte_exclusif
--     CHECK (auteur_compte_id IS NULL
--            OR num_nonnulls(auteur_collaborateur_id, auteur_fiche_talent_id) = 0)
--
-- Un auteur, et un seul, parmi trois colonnes. La policy posée exigeait
-- `auteur_fiche_talent_id = ma_fiche_talent()` ET `auteur_compte_id =
-- compte_id()` : toute note de talent aurait été refusée par la contrainte,
-- après être passée par la policy. Un échec 23514 au lieu d'un 42501 — donc
-- une fonction qui plante au lieu de refuser proprement, ce qui est pire.
--
-- La policy `client_ecrit_une_note` de la phase 1 était, elle, cohérente :
-- `auteur_compte_id = compte_id()` avec les deux autres à NULL.
--
-- LA RÈGLE RETENUE : côté talent, l'auteur est la FICHE, pas le compte. C'est
-- l'identité qui compte dans une relation candidat, elle survit à un
-- changement de compte, et c'est celle que `api.ma_note_partagee` interroge
-- déjà pour rendre le libellé « Vous ».
--
-- Écrit dans une migration séparée et non par correction de 20260913081000 :
-- cette dernière est DÉJÀ APPLIQUÉE sur le dev. Réécrire un fichier appliqué
-- ferait diverger le dépôt et la base, et le projet a déjà payé « vérifier
-- le schéma en prod, pas dans le .sql ».
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists talent_ecrit_sa_note on core.note;
create policy talent_ecrit_sa_note on core.note
  for insert to authenticated
  with check (
        visible_talent
    and not visible_client
        -- L'auteur est la fiche, et elle seule. Les deux autres colonnes
        -- d'auteur sont nulles, comme la contrainte l'exige.
    and auteur_fiche_talent_id  = (select api.ma_fiche_talent())
    and auteur_collaborateur_id is null
    and auteur_compte_id        is null
    and not est_automatique
    and fiche_talent_id = (select api.ma_fiche_talent())
    and entreprise_id is null
    and placement_id  is null
    and evenement_id  is null
    and valeur_avant  is null
    and valeur_apres  is null
    and (candidature_id is null
         or candidature_id in (select c.id from core.candidature c
                                where c.fiche_talent_id = (select api.ma_fiche_talent()))));

comment on policy talent_ecrit_sa_note on core.note is
  'Le message d''accompagnement d''une candidature. Signé de la FICHE (contrainte note_auteur_compte_exclusif : un seul auteur sur trois colonnes), visible du talent, JAMAIS du client — partager au client est une décision distincte, et elle appartient au cabinet (miroir de D-04).';

-- ── Contrôle : la ligne que la policy décrit passe la contrainte ───────
-- On l'éprouve pour de vrai, dans une transaction annulée, avec la première
-- fiche de la base. Une policy cohérente avec une contrainte, ça se mesure.
do $$
declare v_fiche uuid;
begin
  select id into v_fiche from core.fiche_talent order by cree_le limit 1;
  if v_fiche is null then
    raise notice 'aucune fiche talent : contrôle sauté';
    return;
  end if;
  begin
    insert into core.note (fiche_talent_id, commentaire, ecrite_le,
                           visible_talent, visible_client,
                           auteur_fiche_talent_id, est_automatique)
    values (v_fiche, 'contrôle de contrainte, annulé', now(),
            true, false, v_fiche, false);
    raise exception 'controle_ok';
  exception
    when raise_exception then
      if sqlerrm <> 'controle_ok' then raise; end if;
    when others then
      raise exception 'la forme de note décrite par talent_ecrit_sa_note est refusée par la base : % (%)', sqlerrm, sqlstate;
  end;
end $$;
