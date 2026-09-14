-- ═══════════════════════════════════════════════════════════════════════════
-- CONTRÔLE DE LA FERMETURE DE `core.fiche_talent` — CELUI QUI ÉCHOUE SI ON
-- RETIRE LA FERMETURE.
--
--   cd /path/to/pachamama-os
--   supabase db query --linked -f frontend/tests/j4-frontiere-colonnes.sql
--
-- Ce script est appelé par `frontend/tests/j4-espace-talent.mjs` quand la CLI
-- Supabase est disponible. Il ne peut pas être écrit en JavaScript : PostgREST
-- n'expose pas le schéma `core` — mesuré, `Accept-Profile: core` répond 406 —
-- et c'est précisément dans `core` que la fermeture se joue.
--
-- CE QU'IL PROUVE, EN DEUX TEMPS
--   1. LA CEINTURE — `authenticated` n'a AUCUN droit d'UPDATE au niveau de la
--      table `core.fiche_talent`, et aucune des 35 colonnes de qualification
--      n'est écrivable.
--   2. LES BRETELLES — on RETIRE la ceinture (`grant update on
--      core.fiche_talent to authenticated`), on prend le jeton d'un vrai
--      compte talent, et on essaie d'écrire les huit colonnes que le cabinet
--      porte SUR la personne. Les huit doivent être refusées par le
--      déclencheur `core.frontiere_declarative_fiche_talent`, en 42501.
--      Si on retire ce déclencheur, ce script échoue.
--
-- ⚠ IL N'ÉCRIT RIEN. Tout se passe dans une transaction close par `rollback`,
-- y compris le GRANT temporaire — la DDL est transactionnelle sous
-- PostgreSQL. Vérifié : après exécution,
-- `has_table_privilege('authenticated','core.fiche_talent','update')` = false.
--
-- ⚠ AUCUNE ADRESSE, AUCUN IDENTIFIANT EN DUR (D-20) : le compte de contrôle
-- est choisi dans `app.acces`, et rien de nominatif n'est affiché.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ═══════════════════════════════════════════════════════════════════════
-- 0. LES SIX VUES SONT CLOISONNÉES, ET AUDITABLES
--    D-10 : le garde-fou descend dans le WHERE, parce qu'un GRANT ne sait
--    pas cloisonner par portail — tous les comptes partagent `authenticated`.
--    D-11 : `api.est_service()` garde la vue auditable, sinon la définition
--    de « fini » d'un jalon n'a plus de référence à quoi comparer.
-- ═══════════════════════════════════════════════════════════════════════
do $$
declare
  v_vue text;
  v_def text;
  v_sans_garde   text := null;
  v_sans_service text := null;
  v_sans_invoker text := null;
begin
  foreach v_vue in array array['api.ma_fiche','api.ma_candidature','api.ma_candidature_detail',
                               'api.mes_postes','api.ma_note_partagee','api.mon_referentiel'] loop
    v_def := pg_get_viewdef(v_vue::regclass, true);
    if v_def not like '%a_portail%' then v_sans_garde   := concat_ws(', ', v_sans_garde, v_vue); end if;
    if v_def not like '%est_service%' then v_sans_service := concat_ws(', ', v_sans_service, v_vue); end if;
    if not exists (select 1 from pg_class c
                    where c.oid = v_vue::regclass
                      and c.reloptions::text like '%security_invoker=true%') then
      v_sans_invoker := concat_ws(', ', v_sans_invoker, v_vue);
    end if;
  end loop;
  if v_sans_garde is not null then
    raise exception 'vue(s) du talent SANS garde de portail : %', v_sans_garde;
  end if;
  if v_sans_service is not null then
    raise exception 'vue(s) du talent NON auditables à la clé de service (D-11) : %', v_sans_service;
  end if;
  if v_sans_invoker is not null then
    raise exception 'vue(s) du talent qui ne sont PAS en security_invoker : %', v_sans_invoker;
  end if;

  -- `mindset` est nommée par D-06 comme une qualification du cabinet, au même
  -- titre qu'est_qualifie et statut_relation. Elle ne revient pas.
  if pg_get_viewdef('api.ma_fiche'::regclass, true) like '%mindset%' then
    raise exception 'api.ma_fiche projette de nouveau `mindset`';
  end if;

  raise notice '0. les six vues : garde de portail, auditables, security_invoker';
end $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 1. LA CEINTURE
-- ═══════════════════════════════════════════════════════════════════════
do $$
declare
  v_col   text;
  v_fuite text := null;
  v_qualification constant text[] := array[
    'est_qualifie','statut_relation','agent_referent_id','seniorite','mindset',
    'emoji_statut','score_completude','champs_manquants','fiche_complete',
    'resume_ia','parse_par_ia_le','source_import','apporteur_affaires_id',
    'univers_id','niveau_anglais','anonymise_le','fusionnee_vers_fiche_id',
    'talent_id','bubble_id','date_dernier_contact','ecole','grande_ecole',
    'appetence_early_stage','debut_vie_professionnelle',
    'poste_actuel_employeur','poste_actuel_entreprise_id','poste_actuel_metier_id',
    'poste_actuel_univers_id','poste_actuel_contrat','poste_actuel_depuis_le',
    'poste_actuel_raison_depart','poste_actuel_origine','genre','genre_origine',
    'cree_par_compte_id'];
begin
  if has_table_privilege('authenticated', 'core.fiche_talent', 'update') then
    raise exception E'CEINTURE ROMPUE : UPDATE accordé au NIVEAU TABLE sur core.fiche_talent.\n'
      '  La policy talent_maj_sa_fiche redevient alors un droit d''écriture sur les 81 colonnes.';
  end if;
  if has_table_privilege('authenticated', 'core.fiche_talent', 'insert')
     or has_table_privilege('authenticated', 'core.fiche_talent', 'delete') then
    raise exception 'CEINTURE ROMPUE : INSERT ou DELETE accordé sur core.fiche_talent';
  end if;

  foreach v_col in array v_qualification loop
    if has_column_privilege('authenticated', 'core.fiche_talent', v_col, 'update') then
      v_fuite := concat_ws(', ', v_fuite, v_col);
    end if;
  end loop;
  if v_fuite is not null then
    raise exception 'CEINTURE ROMPUE : colonnes de qualification écrivables — %', v_fuite;
  end if;

  -- Et la réciproque, sinon « fermé » voudrait juste dire « cassé ».
  if not has_column_privilege('authenticated', 'core.fiche_talent', 'prenom', 'update')
     or not has_column_privilege('authenticated', 'core.fiche_talent', 'consentement_donne_le', 'update') then
    raise exception 'les colonnes déclaratives ne sont PAS écrivables : les fonctions api.* échoueraient';
  end if;

  raise notice '1. ceinture : aucun UPDATE de table, 0/% colonne de qualification écrivable, colonnes déclaratives ouvertes', array_length(v_qualification, 1);
end $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. LES BRETELLES — on retire la ceinture pour de vrai
-- ═══════════════════════════════════════════════════════════════════════
grant update on core.fiche_talent to authenticated;
grant update on core.candidature  to authenticated;

do $$
declare
  -- (colonne, expression garantie DIFFÉRENTE de la valeur en place)
  v_essais constant text[][] := array[
    array['est_qualifie',      'not est_qualifie'],
    array['statut_relation',   'case when statut_relation = ''client'' then ''lead'' else ''client'' end::ref.statut_relation'],
    array['agent_referent_id', '''00000000-0000-0000-0000-000000000001''::uuid'],
    array['seniorite',         'coalesce(seniorite, '''') || ''x'''],
    array['emoji_statut',      'case when emoji_statut = ''feu'' then ''yeux'' else ''feu'' end::ref.emoji_statut'],
    array['score_completude',  'case when coalesce(score_completude, 0) >= 50 then 1 else 99 end'],
    array['resume_ia',         'coalesce(resume_ia, '''') || ''x'''],
    array['mindset',           'case when mindset = ''en_veille'' then ''recherche_active'' else ''en_veille'' end::ref.mindset_talent']
  ];
  v_auth    uuid;
  v_fiche   uuid;
  v_i       integer;
  v_col     text;
  v_expr    text;
  v_accepte text := null;
  v_mauvais text := null;
  v_refus   integer := 0;
  v_message text;
begin
  select c.auth_id, a.fiche_talent_id into v_auth, v_fiche
    from app.acces a
    join app.compte c on c.id = a.compte_id
    join core.fiche_talent f on f.id = a.fiche_talent_id
   where a.portail = 'talent' and a.actif and c.actif and c.auth_id is not null
   order by c.cree_le
   limit 1;
  if v_auth is null then
    raise exception 'aucun compte talent actif rattaché à une fiche : le contrôle des bretelles est impossible';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_auth::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  for v_i in 1 .. array_length(v_essais, 1) loop
    v_col  := v_essais[v_i][1];
    v_expr := v_essais[v_i][2];
    begin
      execute format('update core.fiche_talent set %I = %s where id = %L', v_col, v_expr, v_fiche);
      -- Arriver ici, c'est que l'écriture a été ACCEPTÉE.
      v_accepte := concat_ws(', ', v_accepte, v_col);
    exception when others then
      if sqlstate = '42501' and sqlerrm like '%réservées au cabinet%' then
        v_refus := v_refus + 1;
      else
        v_mauvais := concat_ws(' ; ', v_mauvais, v_col || ' → ' || sqlstate || ' ' || sqlerrm);
      end if;
    end;
  end loop;

  -- Une colonne DÉCLARATIVE doit, elle, passer : sinon le déclencheur ne
  -- protège pas, il bloque tout, et le portail serait muet.
  begin
    update core.fiche_talent set modifie_par_le_talent_le = now() where id = v_fiche;
    v_message := 'colonne déclarative acceptée';
  exception when others then
    v_message := 'ÉCHEC : la colonne déclarative modifie_par_le_talent_le est refusée — '
                 || sqlstate || ' ' || sqlerrm;
  end;

  reset role;

  if v_accepte is not null then
    raise exception E'BRETELLES ROMPUES : ceinture retirée, ces colonnes de qualification ont été ÉCRITES par un jeton talent — %\n'
      '  Le déclencheur core.frontiere_declarative_fiche_talent ne joue plus son rôle.', v_accepte;
  end if;
  if v_mauvais is not null then
    raise exception 'refus obtenu pour une AUTRE raison que le déclencheur — %', v_mauvais;
  end if;
  if v_message not like 'colonne déclarative acceptée' then
    raise exception '%', v_message;
  end if;

  raise notice '2. bretelles : ceinture retirée, % colonnes de qualification sur % refusées en 42501 par le déclencheur ; %',
    v_refus, array_length(v_essais, 1), v_message;
end $$;

-- ── Et la même frontière sur la candidature ────────────────────────────
do $$
declare
  v_auth        uuid;
  v_fiche       uuid;
  v_candidature uuid;
  v_etat        text;
begin
  select c.auth_id, a.fiche_talent_id, cd.id into v_auth, v_fiche, v_candidature
    from app.acces a
    join app.compte c  on c.id = a.compte_id
    join core.candidature cd on cd.fiche_talent_id = a.fiche_talent_id
   where a.portail = 'talent' and a.actif and c.actif and c.auth_id is not null
   order by c.cree_le, cd.cree_le
   limit 1;
  if v_candidature is null then
    raise notice '3. frontière candidature : aucun compte talent porteur d''une candidature — contrôle sauté';
    return;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_auth::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update core.candidature
       set argumentaire_client = 'contrôle J4'
     where id = v_candidature;
    v_etat := 'ACCEPTÉE';
  exception when others then
    v_etat := sqlstate;
  end;
  reset role;

  if v_etat = 'ACCEPTÉE' then
    raise exception 'FRONTIÈRE ROMPUE : un jeton talent a écrit core.candidature.argumentaire_client';
  end if;
  raise notice '3. frontière candidature : argumentaire_client refusé (%)', v_etat;
end $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. TOUT EST ANNULÉ, GRANT TEMPORAIRE COMPRIS
-- ═══════════════════════════════════════════════════════════════════════
rollback;

-- Preuve que le rollback a bien remis la ceinture. Hors transaction : si la
-- ligne dit `true`, la fermeture a été perdue et le harnais doit le voir.
select has_table_privilege('authenticated', 'core.fiche_talent', 'update') as grant_table_persistant,
       has_column_privilege('authenticated', 'core.fiche_talent', 'est_qualifie', 'update') as qualification_ecrivable,
       has_column_privilege('authenticated', 'core.fiche_talent', 'prenom', 'update')       as declaratif_ecrivable;
