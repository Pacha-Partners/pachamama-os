-- ═══════════════════════════════════════════════════════════════════════════
-- `api.ma_fiche` était la seule vue du talent sans garde de portail.
--
-- LES CINQ AUTRES vues de l'espace talent portent
-- `(select api.est_service()) or api.a_portail('talent')` — c'est D-10 : un
-- GRANT ne sait pas cloisonner par portail, tous les comptes partagent le rôle
-- `authenticated`, donc le garde-fou descend dans le WHERE.
--
-- `api.ma_fiche`, héritée du J1, se contentait de
-- `f.id = api.ma_fiche_talent()`. Or `api.ma_fiche_talent()` lit
-- `app.acces.fiche_talent_id` SANS regarder le portail de l'accès : un compte
-- rattaché à une fiche par un accès `recruteur` ou `entreprise`, sans accès
-- `talent`, lisait la vue.
--
-- CE QUE ÇA CHANGE AUJOURD'HUI : RIEN, et c'est mesuré. Sur les 4 153 accès
-- porteurs d'une `fiche_talent_id`, 4 153 portent le portail `talent` et 0
-- comptes ont une fiche sans accès talent actif. La garde n'a donc aucun effet
-- observable — elle ferme une porte qui n'a pas encore été poussée. C'est le
-- sens de marche de D-06 : une vue naît fermée, on ne la referme pas après
-- l'incident.
--
-- ⚠ MESURE À REMONTER, ET QUI CONTREDIT LE TICKET J4. Le ticket demande
-- qu'« un compte recruteur rende 0 ligne sur chaque vue talent ». C'est
-- impossible, et ce n'est pas un défaut : la plupart des collaborateurs
-- portent DEUX accès — `recruteur` (ou `backoffice`) ET `talent`, avec leur
-- propre fiche. Le compte recruteur de test est dans ce cas. Ce qu'on peut
-- exiger, et que le harnais exige, c'est qu'un tel compte ne voie QUE sa
-- propre fiche et QUE ses propres candidatures.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace view api.ma_fiche with (security_invoker = true) as
select f.id, f.prenom, f.nom, f.email_personnel, f.telephone, f.url_linkedin,
       f.localisation_texte, f.cv_url, f.portfolio_url, f.photo_url,
       f.niveau_anglais::text, f.recherche_active,
       f.attentes_salaire_min_ke, f.attentes_salaire_max_ke,
       f.attentes_tjm_min_eur, f.attentes_tjm_max_eur,
       f.attentes_disponibilite_texte, f.attentes_description,
       f.fiche_complete, f.score_completude,
       (select array_agg(x.libelle_fr order by x.libelle_fr)
          from core.fiche_talent_expertise fe
          join ref.expertise x on x.id = fe.expertise_id
         where fe.fiche_talent_id = f.id) as expertises,
       (select array_agg(s.libelle_fr order by s.libelle_fr)
          from core.fiche_talent_secteur_vise fs
          join ref.secteur s on s.id = fs.secteur_id
         where fs.fiche_talent_id = f.id) as secteurs_vises,
       f.cv_depose_le, f.attentes_localisation_texte,
       mt.libelle_fr as attentes_metier, u.libelle_fr as attentes_univers,
       f.champs_manquants, f.consentement_donne_le, f.actif,
       f.modifie_par_le_talent_le,
       (select array_agg(s.libelle_fr order by s.libelle_fr)
          from core.fiche_talent_secteur_nogo fn
          join ref.secteur s on s.id = fn.secteur_id
         where fn.fiche_talent_id = f.id) as secteurs_nogo,
       (select array_agg(cr.libelle_fr order by cr.libelle_fr)
          from core.fiche_talent_critere fc
          join ref.critere cr on cr.id = fc.critere_id
         where fc.fiche_talent_id = f.id) as criteres,
       mt.code as attentes_metier_code, u.code as attentes_univers_code,
       (select array_agg(s.code order by s.code)
          from core.fiche_talent_secteur_vise fs
          join ref.secteur s on s.id = fs.secteur_id
         where fs.fiche_talent_id = f.id) as secteurs_vises_codes,
       (select array_agg(s.code order by s.code)
          from core.fiche_talent_secteur_nogo fn
          join ref.secteur s on s.id = fn.secteur_id
         where fn.fiche_talent_id = f.id) as secteurs_nogo_codes,
       (select array_agg(cr.code order by cr.code)
          from core.fiche_talent_critere fc
          join ref.critere cr on cr.id = fc.critere_id
         where fc.fiche_talent_id = f.id) as criteres_codes,
       (select array_agg(x.code order by x.code)
          from core.fiche_talent_expertise fe
          join ref.expertise x on x.id = fe.expertise_id
         where fe.fiche_talent_id = f.id) as expertises_codes,
       (select array_agg(ct.contrat::text order by ct.contrat::text)
          from core.fiche_talent_contrat_souhaite ct
         where ct.fiche_talent_id = f.id) as contrats_souhaites,
       (select array_agg(rm.remote::text order by rm.remote::text)
          from core.fiche_talent_remote_souhaite rm
         where rm.fiche_talent_id = f.id) as remote_souhaites
from core.fiche_talent f
left join ref.metier  mt on mt.id = f.attentes_metier_id
left join ref.univers u  on u.id  = f.attentes_univers_id
where (select api.est_service())
   or (api.a_portail('talent') and f.id = (select api.ma_fiche_talent()));

comment on view api.ma_fiche is
  'La fiche d''un talent, vue par lui, et seulement depuis le portail talent. NE PORTE PAS : est_qualifie, statut_relation, mindset, seniorite, emoji_statut, agent_referent_id, resume_ia.';

grant select on api.ma_fiche to authenticated, service_role;

notify pgrst, 'reload schema';

do $$
begin
  if pg_get_viewdef('api.ma_fiche'::regclass, true) not like '%a_portail%' then
    raise exception 'api.ma_fiche n''a pas de garde de portail';
  end if;
  if pg_get_viewdef('api.ma_fiche'::regclass, true) like '%mindset%' then
    raise exception 'api.ma_fiche projette de nouveau mindset';
  end if;
end $$;
