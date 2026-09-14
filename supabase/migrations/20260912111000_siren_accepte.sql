-- ═══════════════════════════════════════════════════════════════════════════
-- Accepter le SIREN, pas seulement le SIRET.
--
-- Trouvé par la revue de la phase 1, puis vérifié : `api.maj_entreprise` et le
-- schéma de saisie exigeaient tous deux `^[0-9]{14}$`. Or **34 des 851
-- entreprises portent une valeur qui échoue à cette règle** — 32 sont des SIREN
-- à 9 chiffres, plus deux saisies libres.
--
-- Le contrat des fonctions « maj_ » est d'enregistrer un formulaire ENTIER : ces
-- 34 clients ne pouvaient donc modifier ni leur description, ni leur logo, ni
-- leur effectif sans corriger d'abord un champ qu'ils n'avaient pas touché, sur
-- un message qui désignait le SIRET.
--
-- C'est exactement le défaut déjà réparé pour `site_web`, `video_url` et
-- `logo_url` à la migration 109000 : une règle écrite d'après ce qu'on CROIT que
-- la donnée contient, jamais mesurée. La mesure d'abord, la règle ensuite.
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
  -- 32 des 851 entreprises portent un SIREN à 9 chiffres et non un SIRET.
  -- Exiger 14 chiffres empêchait 34 clients d'enregistrer la moindre
  -- modification de leur fiche : le formulaire renvoie le champ entier, donc
  -- leur propre valeur — jamais touchée — faisait échouer l'enregistrement sur
  -- un message parlant du SIRET.
  if v_siret is not null and v_siret !~ '^[0-9]{9}$' and v_siret !~ '^[0-9]{14}$' then
    raise exception 'un SIREN compte 9 chiffres, un SIRET 14 — reçu « % »', v_siret using errcode = '22023';
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

-- `create or replace function` réaccorde EXECUTE à PUBLIC : on re-révoque APRÈS.
revoke execute on function api.maj_entreprise(text,text,text,text,text,text,text,text,integer,integer,text)
  from public, anon;
grant  execute on function api.maj_entreprise(text,text,text,text,text,text,text,text,integer,integer,text)
  to authenticated, service_role;

notify pgrst, 'reload schema';

-- ── Le contrôle : qui reste incapable d'enregistrer sa propre fiche ? ──
do $$
declare v_refusees integer;
begin
  select count(*) into v_refusees
    from core.entreprise e
   where e.siret is not null
     and replace(e.siret, ' ', '') !~ '^[0-9]{9}$'
     and replace(e.siret, ' ', '') !~ '^[0-9]{14}$';
  if v_refusees > 0 then
    raise notice '% entreprises portent un siret hors format : elles devront le corriger pour enregistrer leur fiche', v_refusees;
  end if;
end $$;
