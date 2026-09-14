-- ═══════════════════════════════════════════════════════════════════════════
-- Le candidat présenté porte un nom. Décision D-14.
--
-- ── CE QUI A ÉTÉ MESURÉ ────────────────────────────────────────────────
-- `api.candidat_presente` projette `prenom` et `cv_url`, et l'écran fait du
-- second un lien « Ouvrir le CV ». Or `core.fiche_talent.cv_url` porte le nom
-- du candidat DANS LE CHEMIN DU FICHIER :
--
--   .../2025-09-22_MALAKH Sarah_CV_EN_Pachamama.pdf
--   .../CV-Fr-Nicolas-Lerolle.pdf
--
-- Mesure du 09/09/2026 sur les 1 893 candidatures visibles d'un client :
-- 1 414 portent un `cv_url`, dont **1 145 (81 %) contiennent un patronyme du
-- vivier**. Le nom part donc dans le HTML servi, sans même un clic. 1 683
-- portent en plus une `photo_url`.
--
-- ── POURQUOI CE N'EST PAS UNE FUITE À COLMATER ─────────────────────────
-- Le cadrage P0 décrit cette feature mot pour mot :
--
--   « Fiche candidat présentée (profil contrôlé) — Vue d'un candidat
--     shortlisté : prénom/nom (ou anonymisé selon étape), photo, CV,
--     expériences, métier actuel, anglais, prétentions, SANS LES NOTES
--     INTERNES NI L'AVIS PACHAMAMA. »
--
-- Le garde-fou nommé par le métier est « l'avis interne jamais exposé », pas
-- « l'identité jamais exposée ». Un client qui reçoit un profil va rencontrer
-- cette personne : lui cacher son nom tout en lui envoyant son CV est le pire
-- des deux mondes — on ne protège rien et on fuit par accident.
--
-- ── LA RÈGLE RETENUE ───────────────────────────────────────────────────
-- Deux surfaces, deux régimes :
--   · LISTE et KANBAN  → le pseudonyme SEUL. Parcourir un entonnoir ne demande
--     pas d'identité, et 200 noms à l'écran sont 200 données personnelles de
--     plus exposées sans raison.
--   · FICHE d'un candidat présenté → l'identité : prénom, NOM, photo, CV.
--
-- Il n'y a pas d'étape où le client verrait un candidat sans avoir le droit de
-- savoir qui : `visible_client` commence au send-out, et un send-out EST l'acte
-- de présenter la personne.
--
-- Ce qui reste interdit, et ne bouge pas : e-mail, téléphone, LinkedIn — le
-- client passe par le cabinet pour joindre quelqu'un, c'est le métier — ainsi
-- que les six colonnes de jugement de la candidature et toute la qualification
-- cabinet (est_qualifie, mindset, statut_relation, agent_referent, emoji).
--
-- ── LA RÉSERVE, ÉCRITE ─────────────────────────────────────────────────
-- Transmettre le CV d'une personne à un client relève du consentement. Le
-- cadrage porte « Consentement RGPD » en must côté talent, et le cadrage RGPD
-- est déclaré BLOQUANT AVANT TOUTE MISE EN PRODUCTION. Cette migration rend le
-- produit conforme au métier ; elle ne rend pas le traitement licite. La
-- colonne `core.fiche_talent.consentement_donne_le` existe et n'est écrite
-- nulle part : c'est le chantier de la phase Talent.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace view api.candidat_presente with (security_invoker = true) as
select c.id                       as candidature_id,
       c.mandat_id,
       c.reference_pseudonyme,
       c.argumentaire_client,
       ep.emoji || ' ' || ep.libelle_client as etape,
       ep.code            as etape_code,
       ep.ordre           as etape_ordre,
       ep.couleur_pastille as etape_couleur,
       ep.est_ko, ep.est_terminale,
       c.date_entree_pipeline, c.date_dernier_changement_etape,
       c.date_prochaine_echeance, c.presente_le,
       f.prenom,
       f.localisation_texte,
       f.niveau_anglais::text  as niveau_anglais,
       f.poste_actuel_employeur,
       mt.libelle_fr as metier_actuel,
       u.libelle_fr  as univers,
       (select array_agg(x.libelle_fr order by x.libelle_fr)
          from core.fiche_talent_expertise fe
          join ref.expertise x on x.id = fe.expertise_id
         where fe.fiche_talent_id = f.id) as expertises,
       f.attentes_salaire_min_ke, f.attentes_salaire_max_ke,
       f.attentes_tjm_min_eur, f.attentes_tjm_max_eur,
       f.attentes_disponibilite_texte,
       f.cv_url, f.photo_url,
       -- ajout en fin de liste : `create or replace view` ne sait qu'ajouter à
       -- la fin, jamais renommer ni réordonner (42P16).
       f.nom
from core.candidature c
join ref.etape_process ep on ep.id = c.etape_id
left join core.fiche_talent f on f.id = c.fiche_talent_id
left join ref.metier  mt on mt.id = f.poste_actuel_metier_id
left join ref.univers u  on u.id  = f.univers_id
where ep.visible_client
  and ((select api.est_service())
       or (api.a_portail('entreprise') and c.entreprise_id in (select api.mes_entreprises())));

comment on view api.candidat_presente is
  'Le profil d''un candidat PRÉSENTÉ : identité (prénom, nom, photo, CV), parcours et attentes. Jamais les coordonnées — e-mail, téléphone, LinkedIn passent par le cabinet. Jamais les six colonnes de jugement de la candidature, jamais la qualification cabinet. Six étapes sur quatorze y donnent accès. La LISTE et le KANBAN, eux, ne montrent que le pseudonyme (D-14).';
