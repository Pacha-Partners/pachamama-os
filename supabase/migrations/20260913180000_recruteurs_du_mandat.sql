-- ═══════════════════════════════════════════════════════════════════════════
-- Le client voit son Account Manager, jamais ses recruteurs.
--
-- Retour du commanditaire : « vous indiquez sur une offre l'Account Manager
-- mais jamais vous n'indiquez le ou les recruteurs ».
--
-- Et il a raison sur toute la chaîne : le modèle les porte
-- (`core.mandat.agent_en_charge_id` et `.agent_2_id` → `core.collaborateur`),
-- la policy les prévoyait DÉJÀ — `api.mes_agents_client()` (migration 098000)
-- interroge explicitement `array[m.account_manager_id, m.agent_en_charge_id,
-- m.agent_2_id]` — et le cadrage P0 en fait une feature `must` :
-- « Affectation d'équipe sur le mandat (AM + agents) ». Seule la VUE ne les
-- projetait pas. Le droit était ouvert, la porte n'existait pas.
--
-- ── LE VOCABULAIRE, ET LE PIÈGE QU'IL RECOUVRE ─────────────────────────
-- `agent_en_charge_id` est le premier recruteur, `agent_2_id` le second — c'est
-- la reprise de `mand_agent_1` / `mand_agent_2` de Bubble. À NE PAS CONFONDRE
-- avec `mandat.contact_recruteur_id`, qui pointe vers `core.contact_client` :
-- mesuré à la reprise, le « recruteur » du miroir désigne l'interlocuteur
-- CÔTÉ CLIENT, pas un recruteur Pachamama. Projeter celui-là aurait montré au
-- client son propre collègue en croyant lui montrer notre équipe.
--
-- ── CE QUI SORT, ET CE QUI NE SORT PAS ─────────────────────────────────
-- Le prénom, le nom, la photo et la fonction. Pas l'adresse électronique : le
-- client passe par son Account Manager, qui est son point d'entrée unique —
-- c'est la même règle que pour les coordonnées d'un candidat (D-14). Un
-- recruteur nommé et joignable directement, c'est un canal parallèle que
-- personne n'a décidé d'ouvrir.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace view api.mandat_client with (security_invoker = true) as
select m.id,
       coalesce(p.libelle_public, m.titre) as intitule,
       m.statut::text,
       u.libelle_fr as univers, mt.libelle_fr as metier, m.contrat::text,
       m.salaire_min_ke, m.salaire_max_ke, m.tjm_min_eur, m.tjm_max_eur,
       m.localisation, m.kickoff_le, m.cree_le, m.est_anonyme,
       (p.id is not null) as est_publie,
       (select count(*) from core.candidature c join ref.etape_process x on x.id = c.etape_id
         where c.mandat_id = m.id and x.visible_client) as candidatures,
       (select count(*) from core.candidature c join ref.etape_process x on x.id = c.etape_id
         where c.mandat_id = m.id and x.visible_client
           and not x.est_ko and not x.est_terminale) as en_cours,
       (select count(*) from core.candidature c join ref.etape_process x on x.id = c.etape_id
         where c.mandat_id = m.id and x.visible_client) as presentes,
       k.prenom || ' ' || k.nom as agent_nom, k.photo_url as agent_photo,
       k.fonction::text as agent_fonction,
       -- ── ce que cette migration ajoute : l'équipe qui cherche ──────────
       r1.prenom || ' ' || r1.nom   as recruteur_nom,
       r1.photo_url                 as recruteur_photo,
       r1.fonction::text            as recruteur_fonction,
       r2.prenom || ' ' || r2.nom   as recruteur_2_nom,
       r2.photo_url                 as recruteur_2_photo,
       r2.fonction::text            as recruteur_2_fonction
from core.mandat m
left join ref.univers u on u.id = m.univers_id
left join ref.metier mt on mt.id = m.metier_id
left join app.mandat_publication p
       on p.mandat_id = m.id and p.retire_le is null and p.canal = 'job_board_public'
left join core.entreprise e on e.id = m.entreprise_id
left join core.collaborateur k  on k.id  = coalesce(m.account_manager_id, e.account_manager_id)
left join core.collaborateur r1 on r1.id = m.agent_en_charge_id
left join core.collaborateur r2 on r2.id = m.agent_2_id
where (select api.est_service())
   or (api.a_portail('entreprise') and m.entreprise_id in (select api.mes_entreprises()));

comment on view api.mandat_client is
  'Les mandats de MON entreprise. Les trois compteurs parlent du même ensemble — les candidatures visibles du client. L''équipe Pachamama y figure en entier : l''Account Manager (le point d''entrée) et les un ou deux recruteurs qui cherchent. Nom, photo et fonction seulement — aucune adresse : le client passe par son AM.';

grant select on api.mandat_client to authenticated, service_role;

notify pgrst, 'reload schema';
