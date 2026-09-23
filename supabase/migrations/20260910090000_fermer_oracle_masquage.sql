-- =====================================================================
-- FERMER L'ORACLE DU MASQUAGE
--
-- DÉFAUT, reproduit avec la clé publique avant d'écrire cette migration :
--
--   POST /rest/v1/rpc/masquer_client  {"texte":"<nom du client>",
--                                      "p_mandat_id":"b13112db-…"}
--   → 200, corps « null »
--
--   Le même appel avec un nom quelconque renvoie ce nom. La fonction dit
--   donc si le nom soumis EST celui du client. C'est un oracle : on lui
--   soumet des candidats, elle désigne le bon. Le nom du client d'une
--   offre anonyme tombe en une requête dès qu'on le devine, et une liste
--   de raisons sociales n'est pas un secret.
--
-- POURQUOI LE DROIT AVAIT ÉTÉ DONNÉ. La vue est en `security_invoker` :
-- elle s'exécute avec les droits de l'appelant, qui doit donc pouvoir
-- exécuter les fonctions qu'elle appelle. Le choix de deux remparts
-- — droits minimaux ET policies — imposait mécaniquement ce `grant`.
-- L'intention était juste ; sa conséquence ne l'était pas.
--
-- CE QUE FAIT CE CORRECTIF. La vue repasse en `security_definer` : plus
-- personne n'a besoin d'exécuter les fonctions, et le droit est révoqué.
-- On perd le second rempart, et c'est un renoncement assumé : un oracle
-- ouvert vaut moins qu'un rempart de moins. Le WHERE de la vue tient en
-- deux lignes, il est sous harnais, et les policies restent en place —
-- elles ne coûtent rien et protègent encore le chemin direct.
-- =====================================================================

-- ── 1. LE POINT QUI FAIT TOUT : révoquer à PUBLIC, pas seulement à anon.
-- PostgreSQL accorde EXECUTE à PUBLIC sur toute fonction créée. Le `grant`
-- nominatif de la migration d'origine était donc redondant, et le révoquer
-- seul n'aurait rien changé — anon aurait gardé le droit par PUBLIC.
revoke execute on function api.masquer_client(text, uuid) from public, anon, authenticated;
revoke execute on function api.client_visible(uuid)       from public, anon, authenticated;

-- ── 2. La vue n'a plus besoin des droits de l'appelant.
alter view api.offre_publique set (security_invoker = false);
alter view api.offre_publique owner to postgres;

-- ── 3. En profondeur : même si le droit revenait, les fonctions ne
-- répondraient plus que pour les mandats PUBLIÉS. SECURITY DEFINER
-- traverse la RLS : sans cette condition elles renseignent sur les 533
-- mandats, publiés ou non. L'oracle passerait de 533 cibles à 12.
create or replace function api.masquer_client(texte text, p_mandat_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when texte is null then null
    when not exists (
      select 1 from app.mandat_publication p
       where p.mandat_id = p_mandat_id
         and p.retire_le is null and p.canal = 'job_board_public') then null
    when not exists (select 1 from core.mandat m where m.id = p_mandat_id and m.est_anonyme) then texte
    when exists (
      select 1 from core.mandat m join core.entreprise e on e.id = m.entreprise_id
       where m.id = p_mandat_id and length(e.nom) >= 4
         and texte ~* ('\m' || regexp_replace(e.nom, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M'))
      then null
    else texte end;
$$;

create or replace function api.client_visible(p_mandat_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select e.nom
    from core.mandat m
    join core.entreprise e on e.id = m.entreprise_id
   where m.id = p_mandat_id
     and not m.est_anonyme
     and exists (select 1 from app.mandat_publication p
                  where p.mandat_id = m.id
                    and p.retire_le is null and p.canal = 'job_board_public');
$$;

-- `create or replace` réaccorde EXECUTE à PUBLIC : il faut re-révoquer APRÈS.
revoke execute on function api.masquer_client(text, uuid) from public, anon, authenticated;
revoke execute on function api.client_visible(uuid)       from public, anon, authenticated;

-- ── 4. Les droits de lecture directe sur core ne servaient qu'à la vue
-- invoker. Ils n'ont plus d'objet : autant réduire la surface.
revoke select on core.mandat, core.mandat_remote, core.mandat_tag_job from anon;

comment on function api.masquer_client(text, uuid) is
  'Annule un texte qui nomme le client de son offre anonyme. NON EXÉCUTABLE PAR anon : appelée avec ce droit, elle est un oracle qui désigne le client sur simple soumission de candidats — reproduit le 10/09. Elle n''est appelée que par api.offre_publique, en security_definer.';
