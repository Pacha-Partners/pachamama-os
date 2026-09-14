-- ═══════════════════════════════════════════════════════════════════════════
-- `api.maj_entreprise` refusait la donnée qui est DÉJÀ dans la base.
--
-- CE QUI A ÉTÉ MESURÉ, LE 12/09, SUR LES 851 ENTREPRISES
--
--   colonne     remplies   http(s)://   //hôte   autre forme
--   site_web       259        126          0        133   « kiliba.com »
--   video_url       47          0          0         47   « wCPJ5VNpqzQ »
--   logo_url       363         88        275          0   « //…cdn.bubble.io/… »
--
-- Trois formes, aucune commune. `video_url` ne contient PAS d'URL : c'est un
-- identifiant YouTube nu, sur les 47 lignes remplies — sans exception. Et
-- `logo_url` est protocole-relatif dans 275 cas sur 363, séquelle de Bubble.
--
-- La première version de cette fonction exigeait `^https?://` sur les trois.
-- Conséquence, éprouvée avec le compte de test N2J Soft : le client ne pouvait
-- PAS enregistrer son formulaire, même sans y toucher — la fonction refusait
-- de lui rendre sa propre donnée. Une validation qui interdit l'état actuel
-- n'est pas une validation, c'est une porte fermée.
--
-- LA RÈGLE RETENUE, ALIGNÉE SUR LA MESURE
--   site_web   : pas d'espace, au moins un point. « kiliba.com » passe.
--   logo_url   : pas d'espace, commence par http:// https:// // ou /.
--   video_url  : pas d'espace, et soit une URL, soit un identifiant nu
--                [A-Za-z0-9_-] de 8 à 64 caractères.
--
-- CE QUE ÇA LAISSE OUVERT, ET QUI N'EST PAS RÉGLÉ ICI : l'hétérogénéité
-- elle-même. Un écran qui affiche `video_url` doit savoir qu'il reçoit tantôt
-- un identifiant, tantôt une URL. Normaliser les trois colonnes est un chantier
-- de reprise de données, pas une validation de formulaire.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function api.maj_entreprise(
  p_description        text    default null,
  p_fondateur          text    default null,
  p_serie_financement  text    default null,
  p_site_web           text    default null,
  p_siret              text    default null,
  p_video_url          text    default null,
  p_logo_url           text    default null,
  p_localisation_texte text    default null,
  p_nb_employes        integer default null,
  p_nb_techs           integer default null,
  p_cle_idempotence    text    default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_compte   uuid := api.compte_id();
  v_ent      uuid;
  v_lot      uuid := gen_random_uuid();
  v_rejeu    jsonb;
  v_avant    jsonb;
  v_apres    jsonb;
  v_n        integer;
  v_resultat jsonb;
  v_siret    text := nullif(regexp_replace(coalesce(p_siret, ''), '\s', '', 'g'), '');
  -- Les entrées sont ROGNÉES avant contrôle : une entreprise de la base
  -- portait « https://www.francetelevisions.fr/ », espace final compris, et
  -- se voyait refuser sa propre valeur.
  v_site     text := nullif(btrim(coalesce(p_site_web, '')), '');
  v_logo     text := nullif(btrim(coalesce(p_logo_url, '')), '');
  v_video    text := nullif(btrim(coalesce(p_video_url, '')), '');
begin
  if v_compte is null then
    raise exception 'aucun compte : la modification exige une session ouverte' using errcode = '42501';
  end if;
  if v_siret is not null and v_siret !~ '^[0-9]{14}$' then
    raise exception 'un SIRET compte 14 chiffres — reçu « % »', v_siret using errcode = '22023';
  end if;

  -- Les trois formes mesurées, et rien de plus permissif.
  if v_site is not null
     and (v_site ~ '\s' or v_site !~ '\.' or length(v_site) > 500) then
    raise exception 'p_site_web : une adresse sans espace et comportant un point — reçu « % »', v_site
      using errcode = '22023';
  end if;
  if v_logo is not null
     and (v_logo ~ '\s' or v_logo !~* '^(https?:)?//|^/' or length(v_logo) > 1000) then
    raise exception 'p_logo_url : une URL http://, https://, //hôte ou /chemin — reçu « % »', v_logo
      using errcode = '22023';
  end if;
  if v_video is not null
     and (v_video ~ '\s'
          or (v_video !~* '^(https?:)?//' and v_video !~ '^[A-Za-z0-9_-]{8,64}$')
          or length(v_video) > 500) then
    raise exception 'p_video_url : une URL, ou un identifiant de vidéo nu — reçu « % »', v_video
      using errcode = '22023';
  end if;

  if p_nb_employes is not null and (p_nb_employes < 0 or p_nb_employes > 5000000) then
    raise exception 'p_nb_employes hors bornes : %', p_nb_employes using errcode = '22003';
  end if;
  if p_nb_techs is not null and (p_nb_techs < 0 or p_nb_techs > 5000000) then
    raise exception 'p_nb_techs hors bornes : %', p_nb_techs using errcode = '22003';
  end if;
  if length(coalesce(p_description, '')) > 10000 then
    raise exception 'description trop longue : % caractères pour 10 000 au plus', length(p_description)
      using errcode = '22001';
  end if;

  v_ent := app.mon_entreprise_unique();

  v_rejeu := app.idempotence_rejeu(p_cle_idempotence,
    md5(concat_ws('|', v_ent::text, p_description, p_fondateur, p_serie_financement,
                  v_site, v_siret, v_video, v_logo, p_localisation_texte,
                  p_nb_employes::text, p_nb_techs::text)));
  if v_rejeu is not null then return v_rejeu; end if;

  select to_jsonb(x) into v_avant from (
    select e.description, e.fondateur, e.serie_financement, e.site_web, e.siret,
           e.video_url, e.logo_url, e.localisation_texte, e.nb_employes, e.nb_techs
      from core.entreprise e where e.id = v_ent) x;
  if v_avant is null then
    raise exception 'entreprise % illisible : la policy de lecture ne la couvre pas', v_ent
      using errcode = '42501';
  end if;

  update core.entreprise
     set description        = p_description,
         fondateur          = p_fondateur,
         serie_financement  = p_serie_financement,
         site_web           = v_site,
         siret              = v_siret,
         video_url          = v_video,
         logo_url           = v_logo,
         localisation_texte = p_localisation_texte,
         nb_employes        = p_nb_employes,
         nb_techs           = p_nb_techs
   where id = v_ent;
  if not found then
    raise exception 'entreprise % non modifiable : hors de votre périmètre', v_ent using errcode = '42501';
  end if;

  select to_jsonb(x) into v_apres from (
    select e.description, e.fondateur, e.serie_financement, e.site_web, e.siret,
           e.video_url, e.logo_url, e.localisation_texte, e.nb_employes, e.nb_techs
      from core.entreprise e where e.id = v_ent) x;

  v_n := app.journaliser_diff(v_lot, 'core.entreprise', v_ent, v_avant, v_apres);

  v_resultat := jsonb_build_object('entreprise_id', v_ent, 'champs_modifies', v_n, 'lot_id', v_lot);
  perform app.idempotence_resultat(p_cle_idempotence, v_resultat);
  return v_resultat;
end $$;

comment on function api.maj_entreprise(text,text,text,text,text,text,text,text,integer,integer,text) is
  'La vitrine de MON entreprise. Liste blanche stricte de dix colonnes ; les conditions commerciales et la qualification du cabinet n''y sont pas et aucun GRANT ne les couvre. ⚠ Enregistre un FORMULAIRE ENTIER : un argument nul efface la valeur. video_url accepte un identifiant nu — c''est la forme des 47 lignes remplies en base.';

-- `create or replace function` vient de réaccorder EXECUTE à PUBLIC.
revoke execute on function api.maj_entreprise(text,text,text,text,text,text,text,text,integer,integer,text)
  from public, anon;
grant  execute on function api.maj_entreprise(text,text,text,text,text,text,text,text,integer,integer,text)
  to authenticated, service_role;

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════
-- LA RÉPARATION DES DEUX LIGNES QUE LA MESURE A SORTIES
--
-- Elles ne sont pas des cas limites de la validation : ce sont deux défauts de
-- donnée, restés invisibles tant que personne n'écrivait.
--
--   France TV  site_web = « https://www.francetelevisions.fr/ » — espace final.
--   CEDE LABS  site_web = « 229 RUE SAINT-HONORE 75001 PARIS » — une adresse
--              postale rangée dans le champ site web, et localisation_texte
--              vide à côté.
--
-- Les corriger ici plutôt que d'assouplir la règle : une règle taillée pour
-- accepter une adresse postale dans un champ « site web » n'en est plus une.
-- ═══════════════════════════════════════════════════════════════════════

update core.entreprise
   set site_web = btrim(site_web)
 where site_web is not null and site_web <> btrim(site_web);

-- Le contenu n'est pas jeté : il descend là où il aurait dû être saisi.
update core.entreprise
   set localisation_texte = coalesce(localisation_texte, btrim(site_web)),
       site_web           = null
 where site_web is not null
   and btrim(site_web) <> ''
   and (btrim(site_web) ~ '\s' or btrim(site_web) !~ '\.');

-- ── Contrôle : la donnée déjà en base passe la validation ──────────────
-- On ne se contente pas de relire la fonction : on éprouve les 851 lignes
-- réelles contre les trois règles. Une validation qu'aucune donnée existante
-- ne satisfait est le défaut qu'on vient de corriger ; qu'elle ne se
-- represente pas.
do $$
declare v_refusees integer;
begin
  select count(*) into v_refusees from core.entreprise e
   where (e.site_web  is not null and (e.site_web ~ '\s' or e.site_web !~ '\.'))
      or (e.logo_url  is not null and (e.logo_url ~ '\s' or e.logo_url !~* '^(https?:)?//|^/'))
      or (e.video_url is not null and (e.video_url ~ '\s'
            or (e.video_url !~* '^(https?:)?//' and e.video_url !~ '^[A-Za-z0-9_-]{8,64}$')));
  if v_refusees > 0 then
    raise exception '% entreprises ne pourraient pas enregistrer leur propre fiche', v_refusees;
  end if;
end $$;
