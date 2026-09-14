-- ════════════════════════════════════════════════════════════════════════════
-- L'EXPORT RGPD ÉNUMÈRE SES COLONNES
--
-- `api.exporter_mes_donnees` construisait la section `candidatures` par
-- `to_jsonb(c)` sur `api.ma_candidature_detail` : l'équivalent SQL exact d'un
-- `select('*')`, dans le seul endroit du produit qui fabrique un document que
-- la personne TÉLÉCHARGE ET GARDE.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CE QUI A ÉTÉ MESURÉ, le 09/09, avec le jeton du compte talent de test
-- ─────────────────────────────────────────────────────────────────────────────
-- L'export rendait les 41 colonnes de la vue. Parmi elles :
--
--   · `etape_code` = « ko_by_pachamama » sur QUATRE de ses six candidatures,
--     là où `etape` dit « 🙅🏻‍♀️ Candidature close ». C'est précisément le
--     collapse que D-02 a construit : `ko`, `ko_by_pachamama` et `ko_by_client`
--     partagent un seul libellé talent POUR NE PAS DIRE QUI A FERMÉ le dossier.
--     Le code le dit. `etape_ordre` aussi, par son numéro — 11, 12 ou 13.
--
--   · `reference_pseudonyme` = « #003 ». C'est le nom d'emprunt sous lequel le
--     CLIENT voit la personne. `lib/domaine/talent.ts` l'écarte de l'écran en
--     toutes lettres — « le lui montrer n'apprend rien et expose une mécanique
--     interne » — et l'export le livrait quand même.
--
--   · `agent_fonction` = « career_agent », un code de rôle interne ;
--     `mandat_salaire_infos` = « 60+5 », la notation abrégée du recruteur, alors
--     que `mandat_salaire_affiche` porte déjà la phrase publique du job board.
--
-- Et l'export porte cette phrase, dans son propre champ `avertissement` :
--   « Il ne contient aucune appréciation interne du cabinet. »
-- Elle était fausse. Entre corriger la phrase et corriger la donnée, D-06
-- tranche : « une colonne interne n'a rien à faire dans une vue exposée ; la
-- refermer par les droits ne suffit pas, il faut ne pas la construire. »
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POURQUOI LES DEUX HARNAIS ÉTAIENT VERTS
-- ─────────────────────────────────────────────────────────────────────────────
-- `j4-espace-talent.mjs` cherchait 22 NOMS DE COLONNES du cabinet, puis le
-- motif `/KO by |Send-out|Screen Pachamama/i` — c'est-à-dire les
-- `libelle_interne`. `ko_by_pachamama` n'est ni l'un ni l'autre : ce n'est pas
-- un nom de colonne, et ce n'est pas le libellé. Le même angle mort existait
-- deux fois, dans les deux harnais. Les contrôles ajoutés avec cette migration
-- portent sur les CODES, pas seulement sur les libellés.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CE QUE CETTE MIGRATION RETIRE, ET CE QU'ELLE GARDE
-- ─────────────────────────────────────────────────────────────────────────────
-- Retirées — 8 colonnes sur 41, toutes des mécaniques du cabinet ou du mandat,
-- aucune n'étant une donnée déclarée par la personne :
--   reference_pseudonyme · etape_code · etape_ordre · agent_fonction
--   mandat_salaire_infos · mandat_remote · date_prochaine_echeance
--   entreprise_logo
--
-- Gardées — 33 colonnes : l'identifiant, le poste en LIBELLÉ PUBLIC, le nom de
-- l'entreprise (NULL sur une offre anonyme, décidé par la vue), l'étape dans le
-- REGISTRE TALENT, toutes les dates de son propre suivi, le motif de son propre
-- retrait, le prénom et le nom de son interlocuteur, et la description du poste
-- telle que le job board la publie. La personne conserve donc tout ce qui la
-- concerne : on ne retire que l'encodage interne, jamais un fait.
--
-- ⚠ CE QUE CE CHOIX COÛTE, ET QUI DEVRA LE TRANCHER
-- Retirer `etape_code` retire au talent la possibilité de distinguer, dans son
-- export, une candidature fermée par Pachamama d'une candidature fermée par le
-- client. C'est une information qui le concerne, et un juriste pourrait
-- soutenir qu'elle entre dans le droit d'accès de l'article 15. D-07 dit que le
-- RGPD est instruit CÔTÉ PRODUIT : si produit décide qu'il doit le savoir, la
-- réponse n'est pas de rouvrir le code brut, c'est d'ajouter un
-- `libelle_talent` qui le dise en français — c'est-à-dire d'étendre le registre
-- talent, pas de le contourner.
--
-- `fiche`, `experiences` et `notes_partagees` gardent `to_jsonb` : ces trois
-- vues ne portent QUE la déclaration de la personne (`api.ma_fiche` a perdu
-- `mindset` au J4), sa propre saisie de frise, et les notes qu'un agent a
-- explicitement rendues visibles (D-04, `visible_talent`, 0 backfill). Le jour
-- où l'une d'elles gagnera une colonne de jugement, c'est ici qu'il faudra
-- l'énumérer aussi.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function api.exporter_mes_donnees()
  returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v_fiche    uuid;
  v_lot      uuid := gen_random_uuid();
  v_resultat jsonb;
begin
  v_fiche := app.ma_fiche_unique();

  select jsonb_build_object(
    'exporte_le', now(),
    'fiche_talent_id', v_fiche,
    'avertissement', 'Export des données que vous avez déclarées et du suivi de vos candidatures. Il ne contient aucune appréciation interne du cabinet.',
    'fiche', (select to_jsonb(f) from api.ma_fiche f where f.id = v_fiche),
    'experiences', coalesce((select jsonb_agg(to_jsonb(p) order by p.ordre, p.debut_le)
                               from api.mes_postes p), '[]'::jsonb),

    -- ⚠ COLONNES ÉNUMÉRÉES, UNE À UNE. Une colonne ajoutée demain à
    -- `api.ma_candidature_detail` NAÎT DONC HORS DE L'EXPORT — c'est la posture
    -- de D-06, l'inverse du défaut que ce fichier corrige.
    'candidatures', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id',                            c.id,
               'mandat_id',                     c.mandat_id,
               'poste',                         c.poste,
               'entreprise',                    c.entreprise,
               'est_anonyme',                   c.est_anonyme,
               'etape',                         c.etape,
               'etape_couleur',                 c.etape_couleur,
               'est_ko',                        c.est_ko,
               'est_terminale',                 c.est_terminale,
               'est_spontanee',                 c.est_spontanee,
               'date_entree_pipeline',          c.date_entree_pipeline,
               'date_dernier_changement_etape', c.date_dernier_changement_etape,
               'presente_le',                   c.presente_le,
               'retire_par_talent_le',          c.retire_par_talent_le,
               'motif_retrait',                 c.motif_retrait,
               'motif_retrait_libelle',          c.motif_retrait_libelle,
               'cree_le',                       c.cree_le,
               'agent_prenom',                  c.agent_prenom,
               'agent_nom',                     c.agent_nom,
               'agent_photo',                   c.agent_photo,
               'mandat_missions',               c.mandat_missions,
               'mandat_pour_toi',               c.mandat_pour_toi,
               'mandat_pas_pour_toi',           c.mandat_pas_pour_toi,
               'mandat_contrat',                c.mandat_contrat,
               'mandat_localisation',           c.mandat_localisation,
               'mandat_univers',                c.mandat_univers,
               'mandat_salaire_min_ke',         c.mandat_salaire_min_ke,
               'mandat_salaire_max_ke',         c.mandat_salaire_max_ke,
               'mandat_tjm_min_eur',            c.mandat_tjm_min_eur,
               'mandat_tjm_max_eur',            c.mandat_tjm_max_eur,
               'mandat_salaire_affiche',        c.mandat_salaire_affiche,
               'mandat_remote_affiche',         c.mandat_remote_affiche,
               'offre_encore_publiee',          c.offre_encore_publiee
             ) order by c.date_entree_pipeline)
        from api.ma_candidature_detail c), '[]'::jsonb),

    'notes_partagees', coalesce((select jsonb_agg(to_jsonb(n) order by n.ecrite_le)
                                   from api.ma_note_partagee n), '[]'::jsonb),
    'demandes_de_suppression', coalesce((select jsonb_agg(jsonb_build_object(
                                            'demandee_le', d.demandee_le,
                                            'motif', d.motif,
                                            'traitee_le', d.traitee_le))
                                          from app.demande_suppression d
                                         where d.fiche_talent_id = v_fiche), '[]'::jsonb)
  ) into v_resultat;

  perform app.journaliser(v_lot, 'rgpd.export', v_fiche, 'insert', null, null,
    jsonb_build_object('experiences', jsonb_array_length(v_resultat -> 'experiences'),
                       'candidatures', jsonb_array_length(v_resultat -> 'candidatures'),
                       'notes', jsonb_array_length(v_resultat -> 'notes_partagees')));

  return v_resultat || jsonb_build_object('lot_id', v_lot);
end $$;

-- ⚠ APRÈS CHAQUE `create or replace function` : RE-RÉVOQUER. Un `replace`
-- réinstalle les droits par défaut de PostgreSQL, qui accorde EXECUTE à
-- `public`. Sans ces deux lignes, la fonction redeviendrait appelable par
-- n'importe qui — la règle est écrite dans l'ADR 0005 et vaut ici comme
-- ailleurs.
revoke execute on function api.exporter_mes_donnees() from public;
revoke execute on function api.exporter_mes_donnees() from anon;
grant  execute on function api.exporter_mes_donnees() to authenticated;

-- ── Le contrôle : l'export ne nomme plus le registre interne ────────────────
--
-- ⚠ IL PORTE SUR LE CORPS DE LA FONCTION, ET C'EST VOULU.
-- On ne peut pas APPELER `api.exporter_mes_donnees()` ici pour l'inspecter :
-- elle passe par `app.ma_fiche_unique()`, donc par `api.compte_id()`, et une
-- migration tourne sous `postgres` sans session — l'appel lèverait une
-- exception au lieu de mesurer quoi que ce soit. Le contrôle lit donc le
-- `pg_get_functiondef` et refuse la migration si l'une des colonnes écartées
-- y est encore projetée.
--
-- Il PEUT échouer, et c'est ce qui le rend utile : remettre une seule ligne
-- `'etape_code', c.etape_code,` dans le `jsonb_build_object` ci-dessus fait
-- tomber cette migration. Éprouvé en écrivant ce fichier.
do $$
declare
  v_interdits text[] := array[
    'reference_pseudonyme', 'etape_code', 'etape_ordre', 'agent_fonction',
    'mandat_salaire_infos', 'mandat_remote', 'date_prochaine_echeance',
    'entreprise_logo'
  ];
  v_cle    text;
  v_corps  text;
  v_vus    text[] := '{}';
begin
  select pg_get_functiondef(p.oid)
    into v_corps
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'api' and p.proname = 'exporter_mes_donnees';

  if v_corps is null then
    raise exception 'api.exporter_mes_donnees est introuvable : la migration n''a rien remplacé';
  end if;

  -- On cherche la PROJECTION (`c.<colonne>`), pas le nom nu : les commentaires
  -- de ce fichier nomment ces colonnes en toutes lettres, et un contrôle qui
  -- tomberait sur sa propre documentation serait ingérable.
  --
  -- ⚠ `\M` — FIN DE MOT — N'EST PAS UN ORNEMENT.
  -- La première version de ce contrôle utilisait `position('c.' || v_cle ...)`,
  -- et il a REFUSÉ CETTE MIGRATION : `c.mandat_remote` est un préfixe de
  -- `c.mandat_remote_affiche`, que l'export garde délibérément. Le contrôle
  -- avait raison de crier et tort sur la raison. C'est la démonstration qu'il
  -- peut échouer — et le rappel qu'une recherche de sous-chaîne sur des noms de
  -- colonnes dont l'un préfixe l'autre ne mesure pas ce qu'on croit.
  foreach v_cle in array v_interdits loop
    if v_corps ~ ('c\.' || v_cle || '\M') then
      v_vus := v_vus || v_cle;
    end if;
  end loop;

  if array_length(v_vus, 1) > 0 then
    raise exception 'REGISTRE INTERNE DANS L''EXPORT : % encore projetée(s)',
      array_to_string(v_vus, ', ');
  end if;

  -- Contre-épreuve : le contrôle sait-il voir une colonne PRÉSENTE ? Si
  -- `c.etape` — qui doit y être, et qui est le VOISIN EXACT des colonnes
  -- écartées `c.etape_code` et `c.etape_ordre` — n'est pas trouvée avec la même
  -- règle de fin de mot, c'est le détecteur qui est cassé, et son silence ne
  -- vaut rien.
  if v_corps !~ 'c\.etape\M' then
    raise exception 'DÉTECTEUR CASSÉ : « c.etape » devrait être projetée et n''est pas trouvée';
  end if;
  if v_corps !~ 'c\.mandat_remote_affiche\M' then
    raise exception 'DÉTECTEUR CASSÉ : « c.mandat_remote_affiche » doit rester dans l''export';
  end if;

  raise notice 'export RGPD : % colonnes internes absentes de la projection, détecteur éprouvé',
    array_length(v_interdits, 1);
end $$;

comment on function api.exporter_mes_donnees() is
  'Export RGPD (D-07). Colonnes ÉNUMÉRÉES pour la section candidatures : le '
  'registre interne des étapes (etape_code, etape_ordre) et le pseudonyme '
  'client n''en sortent pas. Voir 20260913190000.';
