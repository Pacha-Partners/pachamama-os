-- ════════════════════════════════════════════════════════════════════════════
-- LE BRIEF DU MANDAT, RENDU À L'ENTREPRISE QUI L'A ÉCRIT
-- ════════════════════════════════════════════════════════════════════════════
--
-- LE DÉFAUT
-- ─────────
-- L'écran « Le poste » porte une section « L'annonce » qui lisait
-- `api.offre_detail` — la vue du JOB BOARD PUBLIC. Elle ne contient donc que
-- les mandats effectivement publiés. Mesuré sur le compte de test : la section
-- s'affichait sur 2 mandats sur 9, et disparaissait sur les 7 autres.
--
-- Or ces trois textes ne sont pas la propriété du job board : c'est le BRIEF,
-- que l'entreprise a rédigé elle-même dans « Ouvrir un poste » (les missions,
-- ce qui est indispensable, ce qui est apprécié). Le lui cacher parce que le
-- cabinet n'a pas encore publié l'annonce revient à lui retirer son propre
-- texte — y compris sur un poste en cours de sourcing, où c'est précisément ce
-- qu'on vient relire.
--
-- CE QUE FAIT CETTE MIGRATION
-- ───────────────────────────
-- Elle ajoute `missions`, `pour_toi` et `pas_pour_toi` à `api.mandat_client`.
-- Rien d'autre ne change : mêmes jointures, même clause de cloisonnement, mêmes
-- colonnes dans le même ordre.
--
-- ⚠ LES TROIS COLONNES SONT AJOUTÉES À LA FIN, ET C'EST OBLIGATOIRE.
-- `create or replace view` refuse de renommer, réordonner ou retirer une
-- colonne — PostgreSQL rend 42P16, « cannot change name of view column ». On ne
-- peut qu'APPENDRE. Les six colonnes d'équipe de la migration précédente sont
-- donc recopiées à l'identique avant les nouvelles.
--
-- ⚠ AUCUN ÉLARGISSEMENT DE CLOISONNEMENT. Le `where` est inchangé : un compte
-- entreprise ne voit que les mandats de ses propres entreprises, et le rôle de
-- service passe partout. Ces trois textes sont déjà servis au TALENT par
-- `api.ma_candidature_detail` (colonnes `mandat_missions`, `mandat_pour_toi`,
-- `mandat_pas_pour_toi`) : les rendre au client qui les a écrits n'ouvre rien
-- qui ne le soit déjà ailleurs.
-- ════════════════════════════════════════════════════════════════════════════

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
       r1.prenom || ' ' || r1.nom   as recruteur_nom,
       r1.photo_url                 as recruteur_photo,
       r1.fonction::text            as recruteur_fonction,
       r2.prenom || ' ' || r2.nom   as recruteur_2_nom,
       r2.photo_url                 as recruteur_2_photo,
       r2.fonction::text            as recruteur_2_fonction,
       -- ── ce que cette migration ajoute : le brief, à qui l'a écrit ──────
       m.missions,
       m.pour_toi,
       m.pas_pour_toi
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
  'Les mandats de MON entreprise. Les trois compteurs parlent du même ensemble — les candidatures visibles du client. L''équipe Pachamama y figure en entier : l''Account Manager (le point d''entrée) et les un ou deux recruteurs qui cherchent. Nom, photo et fonction seulement — aucune adresse : le client passe par son AM. Le brief (missions, pour_toi, pas_pour_toi) est rendu au client QU''IL SOIT PUBLIÉ OU NON : c''est son texte, pas celui du job board.';

grant select on api.mandat_client to authenticated, service_role;

notify pgrst, 'reload schema';
