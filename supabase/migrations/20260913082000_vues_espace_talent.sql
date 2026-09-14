-- ═══════════════════════════════════════════════════════════════════════════
-- LES QUATRE VUES DE L'ESPACE TALENT.
--
-- Le patron est celui de 20260912095000 : `security_invoker = true`, colonnes
-- ÉNUMÉRÉES, et la garde `(select api.est_service()) or api.a_portail('talent')`
-- — `est_service()` pour que la vue reste auditable (D-11), `a_portail` parce
-- qu'un GRANT ne sait pas cloisonner par portail (D-10).
--
-- RAPPEL DE LA LEÇON N°1 DE LA PHASE 1 (D-15) : une colonne SÉLECTIONNÉE part
-- dans le HTML, même si rien ne l'affiche. Ce qui n'est pas construit ici ne
-- peut pas fuir plus loin. C'est pour ça que ces vues énumèrent, et que la
-- liste de ce qu'elles ne portent PAS est écrite en toutes lettres.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- 0. CORRECTIF — `mindset` sort de api.ma_fiche
-- ═══════════════════════════════════════════════════════════════════════
-- D-06 nomme trois colonnes comme étant « sa propre fiche telle que le cabinet
-- la qualifie » : `est_qualifie`, `statut_relation` et `mindset`. La fuite a
-- été refermée sur `api.talent_recherche` ; elle est restée ouverte sur
-- `api.ma_fiche`, qui projette `f.mindset::text` depuis le J1.
--
-- `ref.mindset_talent` vaut pas_en_recherche | en_veille | recherche_6_mois |
-- recherche_3_mois | recherche_active : c'est la lecture que le cabinet fait
-- de l'intensité de recherche d'une personne, pas une case qu'elle a cochée.
-- La personne, elle, déclare `recherche_active` — qui reste projetée.
--
-- Vérifié avant de retirer : `mindset` n'est lu nulle part dans `frontend/`
-- (2 occurrences, toutes deux dans des commentaires et une liste d'interdits).
-- `create or replace view` ne sait pas RETIRER une colonne : il faut détruire
-- et refaire, donc reposer les droits.
drop view if exists api.ma_fiche;
create view api.ma_fiche with (security_invoker = true) as
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
       -- AJOUTS de ce lot : les formulaires ont besoin des CODES, pas
       -- seulement des libellés, pour repositionner une liste déroulante.
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
where (select api.est_service()) or f.id = (select api.ma_fiche_talent());

comment on view api.ma_fiche is
  'La fiche d''un talent, vue par lui. NE PORTE PAS : est_qualifie, statut_relation, mindset, seniorite, emoji_statut, agent_referent_id, resume_ia — la qualification que le cabinet porte sur lui.';

-- ═══════════════════════════════════════════════════════════════════════
-- 1. api.ma_candidature_detail — une candidature, vue du talent
-- ═══════════════════════════════════════════════════════════════════════
-- CE QU'ELLE NE PORTE PAS, ET NE PORTERA PAS :
--   c.argumentaire_client         — l'argumentaire que le cabinet sert au client
--   c.compte_rendu                — le compte rendu d'entretien interne
--   c.appreciation_like           — l'appréciation du cabinet
--   c.appreciation_personnalite   — idem
--   c.points_forts / points_faibles
--   c.infos_remuneration          — la négociation menée pour lui, pas avec lui
--   c.salaire_min_ke / salaire_souhaite_ke / tjm_min_eur / tjm_souhaite_eur
--   m.titre                       — le titre INTERNE du mandat (« SantéVet -
--                                   Lead PM »), qui a déjà fait fuir le nom du
--                                   client sur 11 offres anonymes sur 12 (D-06)
--   ep.libelle_interne            — « 🙅🏻‍♀️ KO by Pachamama »
--
-- L'ENTREPRISE EST MASQUÉE DEUX FOIS, comme l'exige D-12 : la vue teste
-- `m.est_anonyme`, ET la policy `talent_entreprises_de_ses_candidatures`
-- (via `api.mes_entreprises_talent()`) exclut déjà les mandats anonymes.
-- Une seule barrière ne suffit pas : l'anonymat a fui deux fois.
--
-- L'AGENT PASSE PAR LA FICHE, PAS PAR LE MANDAT. La seule policy qui ouvre
-- `core.collaborateur` à un talent est `talent_son_agent`
-- (`id = api.mon_agent_talent()`, c'est-à-dire `fiche.agent_referent_id`).
-- Joindre `m.agent_en_charge_id` rendrait NULL en silence — c'est la leçon
-- n°2 de la phase 1, payée trois fois en une journée.
create or replace view api.ma_candidature_detail with (security_invoker = true) as
select c.id,
       c.mandat_id,
       c.reference_pseudonyme,
       coalesce(p.libelle_public, mt.libelle_fr, 'Poste') as poste,
       case when m.est_anonyme then null else e.nom end       as entreprise,
       case when m.est_anonyme then null else e.logo_url end  as entreprise_logo,
       m.est_anonyme,
       ep.emoji || ' ' || ep.libelle_talent as etape,
       ep.code    as etape_code,
       ep.ordre   as etape_ordre,
       ep.couleur_pastille as etape_couleur,
       ep.est_ko, ep.est_terminale,
       c.est_spontanee,
       c.date_entree_pipeline,
       c.date_dernier_changement_etape,
       c.date_prochaine_echeance,
       c.presente_le,
       c.retire_par_talent_le,
       c.motif_retrait,
       mko.libelle_fr as motif_retrait_libelle,
       c.cree_le,
       -- L'agent référent : à qui parler.
       k.prenom    as agent_prenom,
       k.nom       as agent_nom,
       k.photo_url as agent_photo,
       k.fonction  as agent_fonction,
       -- Le REGISTRE PUBLIC du mandat : ce à quoi la personne a postulé, tel
       -- qu'elle l'a lu sur le job board. Rien de plus que api.offre_detail.
       m.missions        as mandat_missions,
       m.pour_toi        as mandat_pour_toi,
       m.pas_pour_toi    as mandat_pas_pour_toi,
       m.remote_infos    as mandat_remote,
       m.salaire_infos   as mandat_salaire_infos,
       m.salaire_min_ke  as mandat_salaire_min_ke,
       m.salaire_max_ke  as mandat_salaire_max_ke,
       m.tjm_min_eur     as mandat_tjm_min_eur,
       m.tjm_max_eur     as mandat_tjm_max_eur,
       m.contrat::text   as mandat_contrat,
       m.localisation    as mandat_localisation,
       um.libelle_fr     as mandat_univers,
       p.salaire_affiche          as mandat_salaire_affiche,
       p.mode_de_travail_affiche  as mandat_remote_affiche,
       (p.id is not null) as offre_encore_publiee
from core.candidature c
left join core.mandat    m  on m.id = c.mandat_id
left join core.entreprise e on e.id = m.entreprise_id
left join ref.metier     mt on mt.id = m.metier_id
left join ref.univers    um on um.id = m.univers_id
left join ref.etape_process ep on ep.id = c.etape_id
left join ref.motif_ko   mko on mko.code = c.motif_retrait and mko.categorie = 'candidat'
left join app.mandat_publication p
       on p.mandat_id = m.id and p.retire_le is null and p.canal = 'job_board_public'
left join core.fiche_talent f on f.id = c.fiche_talent_id
left join core.collaborateur k on k.id = f.agent_referent_id
where (select api.est_service())
   or (api.a_portail('talent') and c.fiche_talent_id = (select api.ma_fiche_talent()));

comment on view api.ma_candidature_detail is
  'Une candidature vue du talent : libellé PUBLIC du poste, entreprise masquée si l''offre est anonyme, étape en registre talent, agent référent, et le registre public du mandat. Aucune colonne de jugement, aucun titre interne.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2. api.mes_postes — la frise d'expériences
-- ═══════════════════════════════════════════════════════════════════════
-- `core.fiche_talent_poste` porte 0 ligne et n'a AUCUNE source : le
-- `public.experience` du miroir n'était pas une liste de postes. Tout ce qui
-- entrera ici sera saisi par la personne, et `origine` le dira.
create or replace view api.mes_postes with (security_invoker = true) as
select p.id,
       p.fiche_talent_id,
       p.intitule,
       p.entreprise_nom,
       p.debut_le,
       p.fin_le,
       p.en_cours,
       p.description,
       p.ordre,
       p.origine::text,
       p.cree_le,
       p.maj_le
from core.fiche_talent_poste p
where (select api.est_service())
   or (api.a_portail('talent') and p.fiche_talent_id = (select api.ma_fiche_talent()));

comment on view api.mes_postes is
  'La frise d''expériences d''un talent. Table vide à ce jour : saisie neuve, pas une reprise. `entreprise_id` n''est pas projetée — le rapprochement avec core.entreprise est un acte du cabinet.';

-- ═══════════════════════════════════════════════════════════════════════
-- 3. api.ma_note_partagee — ce que le cabinet lui a écrit
-- ═══════════════════════════════════════════════════════════════════════
-- L'AUTEUR EST UN LIBELLÉ, JAMAIS UN IDENTIFIANT, et jamais un nom.
-- `api.note_partagee` (côté client) nomme le collaborateur, parce que le
-- client travaille avec une équipe qu'il connaît. Côté talent, la relation
-- passe par UN agent : le nommer note par note n'apporte rien et multiplie
-- les surfaces où un nom de collaborateur peut fuir. Le nom et la photo de
-- l'agent sont servis une fois, par `api.ma_candidature_detail`.
--
-- 0 ligne à ce jour : `core.note` porte 45 685 notes et AUCUNE n'est
-- `visible_talent` — D-04 a explicitement refusé le backfill.
create or replace view api.ma_note_partagee with (security_invoker = true) as
select n.id,
       n.candidature_id,
       n.mandat_id,
       n.commentaire,
       coalesce(n.ecrite_le, n.cree_le) as ecrite_le,
       case
         when n.auteur_fiche_talent_id is not null
              and n.auteur_fiche_talent_id = (select api.ma_fiche_talent()) then 'Vous'
         when n.auteur_collaborateur_id is not null
              and n.auteur_collaborateur_id = (select api.mon_agent_talent()) then 'Votre agent'
         when n.auteur_collaborateur_id is not null then 'Pachamama'
         when n.est_automatique then 'Suivi automatique'
         else 'Pachamama'
       end as auteur,
       (n.auteur_fiche_talent_id is not null
        and n.auteur_fiche_talent_id = (select api.ma_fiche_talent())) as auteur_est_moi,
       ev.libelle_fr as evenement,
       n.est_automatique,
       n.cree_le
from core.note n
left join ref.evenement_note ev on ev.id = n.evenement_id
where n.visible_talent
  and n.archivee_le is null
  and ((select api.est_service())
       or (api.a_portail('talent')
           and (n.fiche_talent_id = (select api.ma_fiche_talent())
                or n.candidature_id in (select c.id from core.candidature c
                                         where c.fiche_talent_id = (select api.ma_fiche_talent())))));

comment on view api.ma_note_partagee is
  'Les notes que le cabinet a explicitement partagées avec le talent (visible_talent). Auteur en LIBELLÉ — « Vous », « Votre agent », « Pachamama » — jamais un identifiant ni un nom. Ne porte ni entreprise_id (qui dé-anonymiserait une offre) ni valeur_avant/apres.';

-- ═══════════════════════════════════════════════════════════════════════
-- 4. api.mon_referentiel — le vocabulaire des formulaires
-- ═══════════════════════════════════════════════════════════════════════
-- La phase 1 s'est terminée sur ce constat, écrit dans le journal :
-- « trois référentiels (étapes visibles, motifs de refus, univers) sont
-- recopiés en dur côté front faute de api.etape_client et api.motif_ko_client ».
-- Le schéma `ref` n'est pas exposé à PostgREST — mesuré : `Accept-Profile: ref`
-- ne répond pas. Une vue unique, en lignes plutôt qu'en colonnes, évite d'en
-- créer huit et de les faire diverger.
--
-- Les deux référentiels qui sont des ENUM PostgreSQL et non des tables —
-- `ref.type_contrat` et `ref.rythme_remote` — tirent leur libellé français de
-- `ref.libelle`, qui les porte déjà (domaines `type_contrat`, `rythme_remote`).
-- Les valeurs `*_legacy` du rythme de remote sont exclues : elles viennent de
-- la reprise Bubble et n'ont aucun sens dans un formulaire.
create or replace view api.mon_referentiel with (security_invoker = true) as
with vocabulaire as (
  select 'metier'::text as referentiel, m.code, m.libelle_fr as libelle,
         m.ordre, null::text as groupe
    from ref.metier m
   where m.actif and m.fusionne_vers_id is null
  union all
  select 'univers', u.code, u.libelle_fr, u.ordre, null
    from ref.univers u where u.actif
  union all
  -- Quel métier se rattache à quel univers : sans ça, le formulaire sert 255
  -- métiers d'un coup. Une ligne par couple, `groupe` porte l'univers.
  select 'metier_univers', m.code, m.libelle_fr, m.ordre, u.code
    from ref.metier_univers mu
    join ref.metier  m on m.id = mu.metier_id  and m.actif and m.fusionne_vers_id is null
    join ref.univers u on u.id = mu.univers_id and u.actif
  union all
  select 'secteur', s.code, s.libelle_fr, s.ordre, null
    from ref.secteur s where s.actif
  union all
  select 'critere', cr.code, cr.libelle_fr, cr.ordre, null
    from ref.critere cr where cr.actif
  union all
  select 'expertise', x.code, x.libelle_fr, x.ordre, null
    from ref.expertise x where x.actif and x.fusionne_vers_id is null
  union all
  select 'contrat', l.code, coalesce(l.libelles ->> 'fr', l.code), l.ordre, null
    from ref.libelle l where l.domaine = 'type_contrat' and l.actif
  union all
  select 'remote', l.code, coalesce(l.libelles ->> 'fr', l.code), l.ordre, null
    from ref.libelle l
   where l.domaine = 'rythme_remote' and l.actif and l.code not like '%_legacy'
  union all
  -- Les 7 motifs de retrait qu'un candidat peut invoquer, et eux seuls :
  -- `api.retirer_ma_candidature` refuse tout code hors de cette catégorie.
  select 'motif_retrait', mk.code, mk.libelle_fr, mk.ordre, null
    from ref.motif_ko mk where mk.actif and mk.categorie = 'candidat'
  union all
  -- Les 14 étapes en REGISTRE TALENT (D-02), pour que l'écran de suivi
  -- affiche une frise sans réinventer les libellés.
  select 'etape', ep.code, ep.emoji || ' ' || ep.libelle_talent, ep.ordre, null
    from ref.etape_process ep where ep.actif and ep.libelle_talent is not null
)
select v.referentiel, v.code, v.libelle, v.ordre, v.groupe
from vocabulaire v
where (select api.est_service()) or api.a_portail('talent');

comment on view api.mon_referentiel is
  'Le vocabulaire que les formulaires du talent doivent proposer, en lignes : metier, univers, metier_univers, secteur, critere, expertise, contrat, remote, motif_retrait, etape. Remplace la recopie en dur côté front constatée à la clôture de la phase 1.';

-- ═══════════════════════════════════════════════════════════════════════
-- 5. Droits — vue par vue, jamais `all tables in schema`
-- ═══════════════════════════════════════════════════════════════════════
-- D-06 : le `grant select on all tables in schema api` a été révoqué, et la
-- clause `alter default privileges` retirée. Une vue naît fermée.
grant select on api.ma_fiche,
                api.ma_candidature_detail,
                api.mes_postes,
                api.ma_note_partagee,
                api.mon_referentiel
  to authenticated, service_role;

-- ── Contrôle : aucune colonne de jugement n'est projetée ───────────────
do $$
declare
  v_interdite text;
  v_fuite     text := null;
begin
  foreach v_interdite in array array[
    'argumentaire_client','compte_rendu','appreciation_like',
    'appreciation_personnalite','points_forts','points_faibles',
    'infos_remuneration','salaire_min_ke','salaire_souhaite_ke',
    'tjm_souhaite_eur','titre','libelle_interne','est_qualifie',
    'statut_relation','mindset','seniorite','emoji_statut',
    'agent_referent_id','resume_ia','entreprise_id','fiche_talent_id']
  loop
    if exists (select 1 from pg_attribute a
                where a.attrelid = 'api.ma_candidature_detail'::regclass
                  and a.attnum > 0 and not a.attisdropped
                  and a.attname = v_interdite) then
      v_fuite := concat_ws(', ', v_fuite, v_interdite);
    end if;
  end loop;
  if v_fuite is not null then
    raise exception 'api.ma_candidature_detail projette des colonnes interdites : %', v_fuite;
  end if;

  foreach v_interdite in array array[
    'mindset','est_qualifie','statut_relation','seniorite','emoji_statut',
    'agent_referent_id','resume_ia','date_dernier_contact','anonymise_le']
  loop
    if exists (select 1 from pg_attribute a
                where a.attrelid = 'api.ma_fiche'::regclass
                  and a.attnum > 0 and not a.attisdropped
                  and a.attname = v_interdite) then
      raise exception 'api.ma_fiche projette « % », qui est une qualification du cabinet', v_interdite;
    end if;
  end loop;

  -- La réciproque : le registre public du mandat est bien là, sinon la vue
  -- ne remplit pas son office (« relire à quoi il a postulé »).
  if not exists (select 1 from pg_attribute a
                  where a.attrelid = 'api.ma_candidature_detail'::regclass
                    and a.attname = 'mandat_missions') then
    raise exception 'api.ma_candidature_detail ne porte pas le registre public du mandat';
  end if;
end $$;

notify pgrst, 'reload schema';
