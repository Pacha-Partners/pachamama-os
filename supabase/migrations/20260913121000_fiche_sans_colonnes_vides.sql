-- ═══════════════════════════════════════════════════════════════════════════
-- Retirer deux colonnes que la mesure vide de sens.
--
-- Elles ont été ajoutées à la migration précédente sans être mesurées d'abord —
-- exactement la faute que le projet a déjà payée trois fois. Mesuré ensuite,
-- sur les 1 893 candidatures visibles d'un client :
--
--   · `ecole` — 787 valeurs renseignées, **DEUX valeurs distinctes : « yes » et
--     « no »**. Ce n'est pas le nom d'une école, c'est un booléen déguisé en
--     texte, et sa sémantique réelle est celle de `grande_ecole` — le marqueur
--     de tri social que j'avais explicitement écarté du portail client.
--     L'afficher aurait été à la fois inutile et contraire à la décision.
--   · `seniorite` — **0 valeur sur 1 893**. Une colonne vide dans une vue
--     exposée est une promesse que l'écran ne peut pas tenir.
--
-- `create or replace view` ne sait pas SUPPRIMER une colonne (42P16) : il faut
-- détruire la vue et la recréer, puis réaccorder les droits que le `drop`
-- emporte.
-- ═══════════════════════════════════════════════════════════════════════════

drop view if exists api.candidat_presente;

create view api.candidat_presente with (security_invoker = true) as
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
       -- L'employeur : le nom rattaché d'abord, le texte ensuite, et JAMAIS un
       -- identifiant Bubble — 873 fiches en portaient un, et ceux qui ne
       -- correspondent à aucune entreprise connue laissent un blanc. Mieux vaut
       -- un blanc qu'un identifiant : un blanc se lit « on ne sait pas ».
       coalesce(
         emp.nom,
         case when f.poste_actuel_employeur ~ '^\d{13}x\d{15,}$' then null
              else nullif(btrim(f.poste_actuel_employeur), '') end
       ) as poste_actuel_employeur,
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
       f.nom,
       -- ── ce que cette migration ajoute ────────────────────────────────
       f.portfolio_url,
       f.debut_vie_professionnelle,
       -- Les années d'expérience, calculées : c'est le chiffre que le
       -- recruteur du client cherche, et personne ne le stocke.
       case when f.debut_vie_professionnelle is not null
            then greatest(0, extract(year from age(current_date, f.debut_vie_professionnelle))::integer)
       end as annees_experience,
       f.poste_actuel_depuis_le,
       f.poste_actuel_contrat::text as poste_actuel_contrat,
       lang.libelles->>'fr' as niveau_anglais_libelle,
       amt.libelle_fr as attentes_metier,
       aun.libelle_fr as attentes_univers,
       f.attentes_localisation_texte,
       f.attentes_description,
       (select array_agg(s.libelle_fr order by s.libelle_fr)
          from core.fiche_talent_secteur_xp sx
          join ref.secteur s on s.id = sx.secteur_id
         where sx.fiche_talent_id = f.id) as secteurs_experience,
       (select array_agg(s.libelle_fr order by s.libelle_fr)
          from core.fiche_talent_secteur_vise sv
          join ref.secteur s on s.id = sv.secteur_id
         where sv.fiche_talent_id = f.id) as secteurs_vises,
       (select array_agg(coalesce(lb.libelles->>'fr', b.background::text) order by b.background)
          from core.fiche_talent_background b
          left join ref.libelle lb
                 on lb.domaine = 'background_talent' and lb.code = b.background::text
         where b.fiche_talent_id = f.id) as parcours_type,
       (select array_agg(coalesce(lp.libelles->>'fr', p.profil::text) order by p.profil)
          from core.fiche_talent_profil p
          left join ref.libelle lp
                 on lp.domaine = 'profil_talent' and lp.code = p.profil::text
         where p.fiche_talent_id = f.id) as profils,
       (select array_agg(coalesce(lx.libelles->>'fr', px.type_produit::text) order by px.type_produit)
          from core.fiche_talent_produit_xp px
          left join ref.libelle lx
                 on lx.domaine = 'type_produit_xp' and lx.code = px.type_produit::text
         where px.fiche_talent_id = f.id) as produits_connus,
       (select array_agg(coalesce(lc.libelles->>'fr', ct.contrat::text) order by ct.contrat)
          from core.fiche_talent_contrat_souhaite ct
          left join ref.libelle lc
                 on lc.domaine = 'type_contrat' and lc.code = ct.contrat::text
         where ct.fiche_talent_id = f.id) as contrats_souhaites,
       (select array_agg(coalesce(lr.libelles->>'fr', rs.remote::text) order by rs.remote)
          from core.fiche_talent_remote_souhaite rs
          left join ref.libelle lr
                 on lr.domaine = 'rythme_remote' and lr.code = rs.remote::text
         where rs.fiche_talent_id = f.id) as remotes_souhaites,
       (select array_agg(cr.libelle_fr order by cr.ordre)
          from core.fiche_talent_critere fc
          join ref.critere cr on cr.id = fc.critere_id
         where fc.fiche_talent_id = f.id) as criteres
from core.candidature c
join ref.etape_process ep on ep.id = c.etape_id
left join core.fiche_talent f on f.id = c.fiche_talent_id
left join ref.metier  mt on mt.id = f.poste_actuel_metier_id
left join ref.univers u  on u.id  = f.univers_id
left join core.entreprise emp on emp.id = f.poste_actuel_entreprise_id
left join ref.metier  amt on amt.id = f.attentes_metier_id
left join ref.univers aun on aun.id = f.attentes_univers_id
left join ref.libelle lang on lang.domaine = 'niveau_anglais'
                          and lang.code = f.niveau_anglais::text
where ep.visible_client
  and ((select api.est_service())
       or (api.a_portail('entreprise') and c.entreprise_id in (select api.mes_entreprises())));

comment on view api.candidat_presente is
  'Le profil d''un candidat PRÉSENTÉ : identité, parcours, expertises, secteurs, attentes, années d''expérience calculées. Tout y est FACTUEL et MESURÉ NON VIDE. Jamais les moyens de contact — on joint quelqu''un par le cabinet. Jamais la qualification du cabinet, jamais le marqueur grande école, jamais la raison de départ, jamais les six colonnes de jugement de la candidature.';

grant select on api.candidat_presente to authenticated, service_role;

notify pgrst, 'reload schema';
