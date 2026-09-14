-- ═══════════════════════════════════════════════════════════════════════════
-- Ouvrir l'écriture au portail Entreprise — le strict nécessaire, pas un pouce
-- de plus.
--
-- L'ADR 0005 fait porter le cloisonnement à PostgreSQL : les fonctions
-- d'écriture sont en SECURITY INVOKER, donc la RLS de l'appelant s'applique
-- DEDANS. Une fonction buguée écrit moins, elle n'écrit pas ailleurs. Le prix
-- de ce choix, c'est cette migration : il faut ouvrir des policies d'écriture
-- et des GRANT par colonne, portail par portail.
--
-- LES DEUX ÉTAGES, ET POURQUOI IL EN FAUT DEUX
--   · la POLICY choisit des LIGNES — « mes candidatures », « mon entreprise » ;
--   · le GRANT par colonne choisit des COLONNES — une policy ne sait pas le
--     faire, et c'est précisément le trou que `talent_maj_sa_fiche` laisse
--     ouvert depuis le J2 (un talent y réécrit `est_qualifie`).
-- Aucune des deux ne suffit seule.
--
-- UN TROISIÈME ÉTAGE, MESURÉ ET NON SUPPOSÉ : `core` et `app` ne sont PAS
-- exposés par PostgREST. Mesuré le 12/09 avec la clé de service —
-- `Accept-Profile: core` → 406, `Accept-Profile: app` → 406,
-- `Accept-Profile: api` → 200. Un compte connecté ne peut donc pas atteindre
-- ces tables en direct, quel que soit son GRANT. Les grants ci-dessous sont la
-- ceinture ; l'exposition est la bretelle. On garde les deux : le jour où
-- quelqu'un exposera `core` pour dépanner, la ceinture tiendra.
--
-- CONSTAT DE PASSAGE, À REMONTER : les policies `interne_ecriture` posées sur
-- 25 tables de `core` sont INERTES. `authenticated` n'a que SELECT sur ces
-- tables — mesuré le 12/09 sur information_schema.role_table_grants. Un
-- recruteur connecté ne peut rien écrire aujourd'hui, policy ou pas. Les
-- GRANT ci-dessous lui rendent l'écriture sur les seules colonnes qu'ils
-- nomment ; le reste du poste recruteur reste à ouvrir au J5.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- 1. core.entreprise — la vitrine et la facturation, jamais le contrat
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists client_maj_son_entreprise on core.entreprise;
create policy client_maj_son_entreprise on core.entreprise
  for update to authenticated
  using      (id in (select api.mes_entreprises()))
  with check (id in (select api.mes_entreprises()));

-- La liste blanche, tenue ici et nulle part ailleurs.
-- HORS LISTE, DÉLIBÉRÉMENT : success_fee_pct, success_fee_abs_ke,
-- success_fee_est_absolu, apport_affaires, apport_affaires_pct, exclusivite,
-- duree_exclusivite_semaines, nb_mois_garantie, statut_contrat_id,
-- date_signature_contrat, date_fin_contrat, account_manager_id, actif,
-- statut_relation, note_interne, nom, raison_sociale, secteur_id,
-- type_entreprise, type_produit, fusionnee_vers_id, hs_company_id.
-- Ce sont les conditions commerciales et la qualification du cabinet : un
-- client qui se baisse son propre success fee est le scénario que cette liste
-- rend impossible en base, pas seulement dans le formulaire.
grant update (description, fondateur, serie_financement, site_web, siret,
              video_url, logo_url, localisation_texte, nb_employes, nb_techs,
              email_facturation, raison_sociale_facturation, adresse_facturation)
  on core.entreprise to authenticated;
-- `maj_le` n'est pas dans la liste : le déclencheur `entreprise_maj_le` s'en
-- charge, et il tourne avec les droits du propriétaire de la fonction.

-- ═══════════════════════════════════════════════════════════════════════
-- 2. core.produit
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists client_maj_son_produit on core.produit;
create policy client_maj_son_produit on core.produit
  for update to authenticated
  using      (entreprise_id in (select api.mes_entreprises()))
  with check (entreprise_id in (select api.mes_entreprises()));

-- `nom` reste fermé : c'est la clé de lecture du produit côté cabinet, et le
-- ticket ne demande que description, texte d'annonce et maturité.
grant update (description, texte_annonce, maturite_id) on core.produit to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. core.mandat — créer un brief, le retoucher tant qu'il est neuf,
--    demander sa clôture, le mettre en pause
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists client_cree_un_mandat on core.mandat;
create policy client_cree_un_mandat on core.mandat
  for insert to authenticated
  with check (entreprise_id in (select api.mes_entreprises())
              and statut = 'nouveau'::ref.statut_mandat
              -- La validation par l'Account Manager est un acte INTERNE. Un
              -- mandat qui naîtrait validé court-circuiterait le cabinet.
              and valide_par_am_le is null);

drop policy if exists client_maj_son_mandat on core.mandat;
create policy client_maj_son_mandat on core.mandat
  for update to authenticated
  using      (entreprise_id in (select api.mes_entreprises())
              and statut in ('nouveau','en_cours','en_pause','reprise'))
  with check (entreprise_id in (select api.mes_entreprises())
              -- `termine` et `close_pachamama` sont hors d'atteinte : clore un
              -- mandat est un acte du cabinet, et c'est ce qui déclenche — ou
              -- pas — une facturation.
              and statut in ('nouveau','en_cours','en_pause','reprise'));

grant insert (titre, entreprise_id, statut, metier_id, univers_id, contrat,
              salaire_min_ke, salaire_max_ke, tjm_min_eur, tjm_max_eur,
              experience_min_annees, missions, remote_infos, localisation,
              must_have, nice_to_have)
  on core.mandat to authenticated;

grant update (titre, metier_id, univers_id, contrat,
              salaire_min_ke, salaire_max_ke, tjm_min_eur, tjm_max_eur,
              experience_min_annees, missions, remote_infos, localisation,
              must_have, nice_to_have,
              statut, mis_en_pause_le,
              cloture_demandee_le, cloture_demandee_par_compte_id)
  on core.mandat to authenticated;
-- HORS LISTE : valide_par_am_le, est_anonyme, est_hors_marche, visibilite,
-- confidentiel, exclusivite_pachamama, type_deal, les 5 scorecards, les 3
-- colonnes d'agent, entreprise_id (en update : un mandat ne change pas de
-- propriétaire).

-- ═══════════════════════════════════════════════════════════════════════
-- 4. core.candidature — l'étape, et rien que l'étape
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists client_maj_ses_candidatures on core.candidature;
create policy client_maj_ses_candidatures on core.candidature
  for update to authenticated
  using      (entreprise_id in (select api.mes_entreprises()))
  with check (entreprise_id in (select api.mes_entreprises())
              -- Un client ne peut déplacer une candidature que vers une étape
              -- QU'IL VOIT. Il ne peut donc pas la renvoyer au « Screen
              -- Pachamama » ni la marquer « KO by Pachamama ».
              and etape_id in (select ep.id from ref.etape_process ep
                                where ep.visible_client));

grant update (etape_id, motif_ko_code, motif_ko_commentaire,
              date_dernier_changement_etape, date_ko)
  on core.candidature to authenticated;
-- HORS LISTE : les six colonnes de jugement, l'argumentaire_client (écrit par
-- le cabinet), les prétentions, presente_le, fiche_talent_id, mandat_id.

-- ═══════════════════════════════════════════════════════════════════════
-- 5. core.note — le client commente, et signe
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists client_ecrit_une_note on core.note;
create policy client_ecrit_une_note on core.note
  for insert to authenticated
  with check (
        -- une note écrite par un client est partagée par construction : la
        -- garder secrète du cabinet n'aurait pas de sens
        visible_client
        -- elle n'est PAS partagée avec le talent : c'est une décision
        -- distincte, et elle appartient au cabinet
    and not visible_talent
    and auteur_compte_id = api.compte_id()
    and auteur_collaborateur_id is null
    and auteur_fiche_talent_id  is null
    and not est_automatique
    and (   candidature_id in (select c.id from core.candidature c
                                where c.entreprise_id in (select api.mes_entreprises()))
         or mandat_id      in (select m.id from core.mandat m
                                where m.entreprise_id in (select api.mes_entreprises()))
         or entreprise_id  in (select api.mes_entreprises())));

grant insert (candidature_id, mandat_id, entreprise_id, commentaire,
              ecrite_le, visible_client, auteur_compte_id)
  on core.note to authenticated;
-- HORS LISTE : fiche_talent_id et placement_id (un client n'ancre pas une note
-- sur une personne ni sur un placement), visible_talent, evenement_id,
-- valeur_avant/apres, est_automatique, les deux autres colonnes d'auteur.

-- ═══════════════════════════════════════════════════════════════════════
-- 6. app.transition_etape — l'historique que D-03 attendait
-- ═══════════════════════════════════════════════════════════════════════
-- AJOUT PAR RAPPORT AU TICKET, ASSUMÉ ET MOTIVÉ. Le ticket J3 n'énumère pas
-- cette table dans les policies à ouvrir. Mais `app.origine_transition` porte
-- déjà la valeur `client`, mise là pour ce cas exact ; D-03 constate que
-- « app.transition_etape est vide et l'historique d'étapes n'existe nulle
-- part » et fait dépendre de son remplissage la correction du filtre de
-- visibilité ; et §2.8 du plan dit qu'aucune métrique ne démarrera avant les
-- transitions FUTURES. Faire avancer une étape sans l'inscrire ici, c'est
-- fabriquer aujourd'hui le trou qu'on déplore depuis trois jours.
drop policy if exists client_transition on app.transition_etape;
create policy client_transition on app.transition_etape
  for insert to authenticated
  with check (origine = 'client'::app.origine_transition
              and auteur_compte_id = api.compte_id()
              and candidature_id in (select c.id from core.candidature c
                                      where c.entreprise_id in (select api.mes_entreprises())));

drop policy if exists client_ses_transitions on app.transition_etape;
create policy client_ses_transitions on app.transition_etape
  for select to authenticated
  using (candidature_id in (select c.id from core.candidature c
                             where c.entreprise_id in (select api.mes_entreprises())));

grant insert (candidature_id, etape_avant_id, etape_apres_id, survenue_le,
              origine, auteur_compte_id, motif_ko_code, commentaire)
  on app.transition_etape to authenticated;

-- ── Contrôle : aucune colonne interdite n'a fui dans un GRANT ──────────
do $$
declare
  v_fuite text;
begin
  select string_agg(g.table_name || '.' || g.column_name, ', ')
    into v_fuite
    from information_schema.column_privileges g
   where g.grantee = 'authenticated'
     and g.privilege_type in ('UPDATE','INSERT')
     and (   (g.table_schema = 'core' and g.table_name = 'entreprise'
              and g.column_name in ('success_fee_pct','success_fee_abs_ke','apport_affaires',
                                    'statut_contrat_id','account_manager_id','actif',
                                    'statut_relation','note_interne','exclusivite',
                                    'nb_mois_garantie','date_signature_contrat','date_fin_contrat'))
          or (g.table_schema = 'core' and g.table_name = 'mandat'
              and g.column_name in ('valide_par_am_le','agent_en_charge_id','agent_2_id',
                                    'account_manager_id','est_anonyme','visibilite'))
          or (g.table_schema = 'core' and g.table_name = 'candidature'
              and g.column_name in ('compte_rendu','appreciation_like','points_forts',
                                    'points_faibles','infos_remuneration','argumentaire_client'))
          or (g.table_schema = 'core' and g.table_name = 'note'
              and g.column_name in ('visible_talent','auteur_collaborateur_id',
                                    'auteur_fiche_talent_id','est_automatique')));
  if v_fuite is not null then
    raise exception 'colonnes hors liste blanche accordées à authenticated : %', v_fuite;
  end if;

  -- Et la réciproque : ce qui DOIT être écrivable l'est.
  if not has_column_privilege('authenticated', 'core.entreprise', 'description', 'update')
     or not has_column_privilege('authenticated', 'core.mandat', 'titre', 'insert')
     or not has_column_privilege('authenticated', 'core.note', 'commentaire', 'insert')
     or not has_column_privilege('authenticated', 'core.candidature', 'etape_id', 'update')
     or not has_column_privilege('authenticated', 'app.transition_etape', 'etape_apres_id', 'insert') then
    raise exception 'une écriture attendue reste fermée : les fonctions api.* échoueraient';
  end if;
end $$;
