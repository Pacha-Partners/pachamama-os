-- ═══════════════════════════════════════════════════════════════════════════
-- Un talent doit pouvoir lire le poste auquel il a postulé.
--
-- Symptôme mesuré : `api.ma_candidature` rend « Poste » pour les six
-- candidatures du compte de test, au lieu de l'intitulé.
--
-- Cause : la seule policy talent sur `core.mandat` est `talent_offres_publiees`,
-- qui n'ouvre que les 12 mandats PUBLIÉS. Les candidatures d'un talent portent
-- sur des mandats qui, pour l'essentiel, ne le sont pas. Le `left join` de la
-- vue rend donc NULL, la jointure sur `ref.metier` rend NULL à son tour, et le
-- repli terminal s'affiche. Ce n'était pas un défaut de la vue.
--
-- Ce n'est pas non plus un cas marginal : 4 mandats sur 533 seulement n'ont pas
-- de métier renseigné. Une fois le mandat lisible, 99 % des candidatures
-- affichent un intitulé.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Le mandat auquel j'ai postulé ──────────────────────────────────────
create policy talent_mandats_de_ses_candidatures on core.mandat
  for select to authenticated
  using (
    id in (
      select c.mandat_id from core.candidature c
       where c.fiche_talent_id = api.ma_fiche_talent()
         and c.mandat_id is not null
    )
  );

comment on policy talent_mandats_de_ses_candidatures on core.mandat is
  'Sans elle, un candidat ne peut pas lire le poste auquel il a postulé. Ne donne accès qu''aux mandats où il a une candidature — jamais au catalogue.';

-- ── L'entreprise derrière ce mandat, SI l'offre n'est pas anonyme ──────
-- La vue masque déjà le nom sur les offres anonymes (`case when est_anonyme`).
-- La policy le masque aussi, pour que le masquage ne repose pas sur la seule
-- vue : sur ce projet, l'anonymat d'une offre a déjà fui deux fois.
create policy talent_entreprises_de_ses_candidatures on core.entreprise
  for select to authenticated
  using (
    id in (
      select m.entreprise_id
        from core.candidature c
        join core.mandat m on m.id = c.mandat_id
       where c.fiche_talent_id = api.ma_fiche_talent()
         and not m.est_anonyme
         and m.entreprise_id is not null
    )
  );

comment on policy talent_entreprises_de_ses_candidatures on core.entreprise is
  'Le nom du client, et rien d''autre de la fiche, et seulement quand l''offre n''est pas anonyme. La vue le masque déjà : ceci est la deuxième barrière.';
