-- ═══════════════════════════════════════════════════════════════════════════
-- Les cinq vues qui manquaient au portail Entreprise.
--
-- Toutes sur le patron de `api.mandat_client` (20260912095000) :
--   · security_invoker = true      → la RLS de l'appelant s'applique
--   · colonnes ÉNUMÉRÉES           → jamais select *
--   · garde de portail dans le WHERE, doublée de la garde de périmètre :
--       (select api.est_service()) or (api.a_portail('entreprise') and …)
--     `est_service()` rend la vue auditable (D-11) ; le `(select …)` fait
--     évaluer l'expression une fois par requête et non une fois par ligne.
--
-- LEÇON D-12 APPLIQUÉE PARTOUT ICI : un LEFT JOIN sur une table fermée par
-- RLS ne lève pas d'erreur, il rend NULL. Chaque table jointe ci-dessous a
-- donc sa policy client, posée dans cette même migration quand elle manquait :
--   core.produit   → client_ses_produits      (n'existait pas)
--   core.placement → client_ses_placements    (n'existait pas)
--   core.fiche_talent → client_talents_presentes (n'existait pas)
-- core.entreprise, core.mandat, core.candidature, core.collaborateur et
-- core.note ont déjà les leurs.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- 1. LES POLICIES DE LECTURE QUI MANQUAIENT
-- ═══════════════════════════════════════════════════════════════════════

drop policy if exists client_ses_produits on core.produit;
create policy client_ses_produits on core.produit
  for select to authenticated
  using (entreprise_id in (select api.mes_entreprises()));

drop policy if exists client_ses_placements on core.placement;
create policy client_ses_placements on core.placement
  for select to authenticated
  using (entreprise_id in (select api.mes_entreprises()));

comment on policy client_ses_placements on core.placement is
  'Le client lit SES placements — sa facturation. core.repartition_commission reste fermée : elle porte le partage INTERNE de la commission entre agents et apporteurs, qui ne le regarde pas.';

-- ── La policy la plus délicate du portail : le client sur core.fiche_talent
--
-- POURQUOI UNE FONCTION DEFINER PLUTÔT QU'UNE SOUS-REQUÊTE
-- Écrite en direct, la policy interrogerait `core.candidature`, dont la
-- policy `client_ses_candidatures` interroge `core.mandat` : c'est le cycle
-- qui a produit `42P17, infinite recursion` le 09/09 (D-12). Le projet a déjà
-- sa réponse — `api.mes_mandats_talent()`, `api.mes_entreprises_talent()`,
-- `api.mes_agents_client()` sont DEFINER pour cette raison exacte.
-- Un DEFINER n'est légitime ici que parce qu'il ROMPT LE CYCLE : il ne rend
-- rien que le compte ne possède déjà, et rend l'ensemble vide à un talent
-- comme à un recruteur — `api.mes_entreprises()` leur rend zéro ligne.
create or replace function api.mes_talents_presentes() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select distinct c.fiche_talent_id
    from core.candidature c
    join ref.etape_process ep on ep.id = c.etape_id
   where ep.visible_client
     and c.fiche_talent_id is not null
     and c.entreprise_id in (select api.mes_entreprises());
$$;
revoke execute on function api.mes_talents_presentes() from public, anon;
grant  execute on function api.mes_talents_presentes() to authenticated, service_role;
comment on function api.mes_talents_presentes() is
  'Les fiches talent que MON entreprise a le droit de voir : celles dont une candidature est à une étape visible_client. DEFINER pour rompre la récursion de policies (42P17, D-12), pas pour élargir un droit.';

drop policy if exists client_talents_presentes on core.fiche_talent;
create policy client_talents_presentes on core.fiche_talent
  for select to authenticated
  using (id in (select api.mes_talents_presentes()));

comment on policy client_talents_presentes on core.fiche_talent is
  'Ouvre la LIGNE, pas les colonnes — une policy ne filtre jamais les colonnes. C''est api.candidat_presente qui énumère ce qui sort, et elle seule : core n''est pas exposé par PostgREST (Accept-Profile: core → 406, mesuré le 12/09).';

-- ═══════════════════════════════════════════════════════════════════════
-- 2. api.mon_entreprise — identité, vitrine, contrat, facturation, AM
-- ═══════════════════════════════════════════════════════════════════════
-- Le contrat est en LECTURE SEULE ici et le restera : `api.maj_entreprise`
-- n'accepte aucun de ces champs, et aucun GRANT UPDATE ne les couvre.
create or replace view api.mon_entreprise with (security_invoker = true) as
select e.id,
       -- identité et vitrine
       e.nom, e.raison_sociale, e.description, e.fondateur, e.serie_financement,
       e.site_web, e.siret, e.video_url, e.logo_url, e.localisation_texte,
       e.nb_employes, e.nb_techs,
       s.libelle_fr        as secteur,
       e.type_produit::text   as type_produit,
       e.type_entreprise::text as type_entreprise,
       -- le contrat, en lecture
       sc.code             as statut_contrat_code,
       sc.libelle_fr       as statut_contrat,
       e.success_fee_pct, e.success_fee_abs_ke, e.success_fee_est_absolu,
       e.apport_affaires, e.exclusivite, e.duree_exclusivite_semaines,
       e.nb_mois_garantie, e.date_signature_contrat, e.date_fin_contrat,
       -- la facturation
       e.email_facturation, e.raison_sociale_facturation, e.adresse_facturation,
       -- l'Account Manager
       nullif(concat_ws(' ', k.prenom, k.nom), '') as am_nom,
       k.photo_url        as am_photo,
       k.fonction::text   as am_fonction,
       k.email            as am_email
from core.entreprise e
left join ref.secteur         s  on s.id  = e.secteur_id
left join ref.statut_contrat  sc on sc.id = e.statut_contrat_id
left join core.collaborateur  k  on k.id  = e.account_manager_id
where (select api.est_service())
   or (api.a_portail('entreprise') and e.id in (select api.mes_entreprises()));

comment on view api.mon_entreprise is
  'La fiche de MON entreprise : vitrine modifiable, contrat en lecture seule, facturation, Account Manager. N''expose ni note_interne, ni statut_relation, ni hs_company_id, ni domaine_normalise, ni fusionnee_vers_id — ce sont les colonnes du cabinet SUR le client.';

-- ═══════════════════════════════════════════════════════════════════════
-- 3. api.mon_produit
-- ═══════════════════════════════════════════════════════════════════════
create or replace view api.mon_produit with (security_invoker = true) as
select p.id, p.entreprise_id, p.nom, p.description, p.texte_annonce,
       m.code       as maturite_code,
       m.libelle_fr as maturite,
       m.image_url  as maturite_image,
       p.cree_le, p.maj_le
from core.produit p
left join ref.maturite_produit m on m.id = p.maturite_id
where (select api.est_service())
   or (api.a_portail('entreprise') and p.entreprise_id in (select api.mes_entreprises()));

comment on view api.mon_produit is
  'Le ou les produits de MON entreprise. 103 lignes en base, une seule entreprise de test en porte un.';

-- ═══════════════════════════════════════════════════════════════════════
-- 4. api.ma_facturation — les placements facturés
-- ═══════════════════════════════════════════════════════════════════════
-- ⚠ UNITÉS. Mesuré sur les 260 répartitions : le ratio médian
--   repartition_commission.total_montant_eur / placement.commission_ke = 1000.
--   `core.placement` est en K€, `core.repartition_commission` en €. Le suffixe
--   du nom de colonne porte l'unité, sans exception — c'est la convention qui
--   a coûté 43 jours de synchro gelée quand elle n'existait pas.
--
-- Ce qui NE SORT PAS, et pourquoi :
--   commission_nette_ke, montant_apport_affaires_ke,
--   montant_cooptation_talent_eur, tjm_verse_talent_eur
--     → c'est la marge de Pachamama et le partage interne. Le client paie
--       `commission_ke` ; ce qu'il en advient ensuite ne le regarde pas.
--   core.repartition_commission entière → jamais ouverte au portail.
create or replace view api.ma_facturation with (security_invoker = true) as
select pl.id,
       pl.mandat_id,
       coalesce(pub.libelle_public, m.titre) as mandat_intitule,
       mt.libelle_fr        as metier,
       c.reference_pseudonyme,
       pl.contrat::text     as contrat,
       pl.date_closing, pl.date_debut_mission,
       pl.date_fin_garantie, pl.date_fin_mission,
       pl.salaire_final_ke,
       pl.commission_ke,
       pl.tjm_facture_client_eur,
       pl.statut_paiement::text as statut_paiement,
       pl.montant_remboursement_garantie_ke,
       pl.rembourse_le,
       pl.est_archive,
       pl.cree_le
from core.placement pl
left join core.mandat m       on m.id  = pl.mandat_id
left join ref.metier  mt      on mt.id = m.metier_id
left join core.candidature c  on c.id  = pl.candidature_id
left join app.mandat_publication pub
       on pub.mandat_id = m.id and pub.retire_le is null and pub.canal = 'job_board_public'
where (select api.est_service())
   or (api.a_portail('entreprise') and pl.entreprise_id in (select api.mes_entreprises()));

comment on view api.ma_facturation is
  'Les placements facturés à MON entreprise. Montants en K€ (suffixe _ke) sauf le TJM facturé, en € (suffixe _eur). La répartition interne de la commission n''est pas projetée.';

-- ═══════════════════════════════════════════════════════════════════════
-- 5. api.candidat_presente — LA VUE LA PLUS SENSIBLE DU PORTAIL
-- ═══════════════════════════════════════════════════════════════════════
-- Elle ne projette QUE ce que le ticket J3 autorise, et rien de plus.
--
-- CE QUI N'EN SORT PAS, ÉNUMÉRÉ POUR QU'UNE RELECTURE PUISSE LE VÉRIFIER :
--   de core.fiche_talent : nom, email_personnel, telephone, url_linkedin,
--     est_qualifie, mindset, statut_relation, emoji_statut, agent_referent_id,
--     score_completude, seniorite, ecole, grande_ecole, resume_ia
--   de core.candidature  : compte_rendu, appreciation_like,
--     appreciation_personnalite, points_forts, points_faibles,
--     infos_remuneration  — les six colonnes de JUGEMENT
--   de core.candidature  : salaire_min_ke, salaire_souhaite_ke,
--     tjm_min_eur, tjm_souhaite_eur — la négociation en cours. C'est la fuite
--     n°2 de D-06 (`api.kanban.pretention_ke` servi à trois comptes clients).
--
-- ⚠ CE QUI EN SORT ET QUI MÉRITE UN ARBITRAGE HUMAIN : les ATTENTES
-- salariales déclarées par le candidat (fiche_talent.attentes_*). Le ticket J3
-- les autorise explicitement ; D-06 dit que « le ticket J3 interdit les
-- prétentions salariales » à propos d'une AUTRE colonne
-- (candidature.salaire_min_ke, la négociation menée par le cabinet). Ce sont
-- deux choses différentes — une attente déclarée n'est pas une négociation en
-- cours — mais la tension est réelle et signalée plutôt qu'arbitrée en
-- silence.
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
       -- de la fiche talent : le strict minimum d'un profil présenté
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
       f.cv_url, f.photo_url
from core.candidature c
join ref.etape_process ep on ep.id = c.etape_id
left join core.fiche_talent f on f.id = c.fiche_talent_id
left join ref.metier  mt on mt.id = f.poste_actuel_metier_id
left join ref.univers u  on u.id  = f.univers_id
where ep.visible_client
  and ((select api.est_service())
       or (api.a_portail('entreprise') and c.entreprise_id in (select api.mes_entreprises())));

comment on view api.candidat_presente is
  'Le profil CONTRÔLÉ d''un candidat présenté. Prénom seul, jamais le nom ni les coordonnées ; aucune des six colonnes de jugement de la candidature ; aucune qualification du cabinet. Ne rend que les candidatures à une étape visible_client — six sur quatorze.';

-- ═══════════════════════════════════════════════════════════════════════
-- 6. api.note_partagee — le fil visible du client
-- ═══════════════════════════════════════════════════════════════════════
-- L'auteur est un LIBELLÉ, jamais un identifiant : le client n'a pas à
-- reconstruire qui est qui côté Pachamama.
--   auteur_compte_id = le mien        → « Vous »
--   auteur_compte_id = un autre       → « Votre équipe » — app.acces est
--       fermée aux accès d'autrui (policy `ses_acces`), donc le prénom d'un
--       collègue n'est PAS lisible, et le fabriquer demanderait d'ouvrir
--       app.acces. On préfère un libellé honnête à une ouverture.
--   auteur_collaborateur_id           → prénom + nom, avec repli « Pachamama »
--       si la policy `client_ses_agents` ne couvre pas ce collaborateur —
--       sans ce repli, la colonne rendrait NULL en silence (D-12).
create or replace view api.note_partagee with (security_invoker = true) as
select n.id,
       n.candidature_id, n.mandat_id, n.entreprise_id,
       n.commentaire,
       coalesce(n.ecrite_le, n.cree_le) as ecrite_le,
       case
         when n.auteur_compte_id is not null and n.auteur_compte_id = api.compte_id() then 'Vous'
         when n.auteur_compte_id is not null then 'Votre équipe'
         else coalesce(nullif(concat_ws(' ', k.prenom, k.nom), ''), 'Pachamama')
       end                                as auteur,
       (n.auteur_compte_id is not null)   as auteur_est_client,
       case when n.auteur_compte_id is null then k.photo_url end as auteur_photo,
       c.reference_pseudonyme,
       ev.libelle_fr as evenement,
       n.est_automatique,
       n.cree_le
from core.note n
left join core.collaborateur k  on k.id = n.auteur_collaborateur_id
left join core.candidature   c  on c.id = n.candidature_id
left join ref.evenement_note ev on ev.id = n.evenement_id
where n.visible_client
  and n.archivee_le is null
  and ((select api.est_service())
       or (api.a_portail('entreprise')
           and (   n.entreprise_id  in (select api.mes_entreprises())
                or n.mandat_id      in (select m.id from core.mandat m
                                         where m.entreprise_id in (select api.mes_entreprises()))
                or n.candidature_id in (select c2.id from core.candidature c2
                                         where c2.entreprise_id in (select api.mes_entreprises())))));

comment on view api.note_partagee is
  'Les notes explicitement partagées avec le client (visible_client), non archivées, dans son périmètre. Les 45 685 notes reprises sont toutes fermées : D-04, aucun backfill.';

-- ═══════════════════════════════════════════════════════════════════════
-- 7. LES DROITS. Une vue neuve naît FERMÉE depuis 20260912094000
--    (`alter default privileges in schema api revoke select … from
--    authenticated`). Il faut donc les accorder, un par un.
-- ═══════════════════════════════════════════════════════════════════════
grant select on api.mon_entreprise, api.mon_produit, api.ma_facturation,
                api.candidat_presente, api.note_partagee
  to authenticated, service_role;

notify pgrst, 'reload schema';

-- ── Contrôle ───────────────────────────────────────────────────────────
do $$
declare
  v_interdites text[] := array[
    'nom','email','email_personnel','telephone','url_linkedin','est_qualifie',
    'mindset','statut_relation','emoji_statut','agent_referent','agent_referent_id',
    'score_completude','compte_rendu','appreciation_like','appreciation_personnalite',
    'points_forts','points_faibles','infos_remuneration','seniorite',
    'salaire_min_ke','salaire_souhaite_ke','tjm_souhaite_eur'];
  v_trouvee text;
begin
  select string_agg(a.attname, ', ') into v_trouvee
    from pg_attribute a
   where a.attrelid = 'api.candidat_presente'::regclass
     and a.attnum > 0 and not a.attisdropped
     and a.attname = any (v_interdites);
  if v_trouvee is not null then
    raise exception 'api.candidat_presente projette des colonnes interdites : %', v_trouvee;
  end if;

  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'api' and c.relkind = 'v'
         and c.relname in ('mon_entreprise','mon_produit','ma_facturation',
                           'candidat_presente','note_partagee')
         and coalesce((select option_value from pg_options_to_table(c.reloptions)
                        where option_name = 'security_invoker'), 'false') = 'true') <> 5 then
    raise exception 'une des cinq vues du portail entreprise n''est pas en security_invoker';
  end if;
end $$;
