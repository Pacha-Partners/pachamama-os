-- =====================================================================
-- J1 — LE JOB BOARD PUBLIC : DEUX CORRECTIFS ET UNE VUE
--
-- La confrontation du ticket J1 avec ce que la reprise avait produit a
-- révélé deux défauts. Tous deux mesurés, tous deux corrigés ici.
-- =====================================================================

-- ---------------------------------------------------------------------
-- CORRECTIF 1 — LA REPRISE AVAIT PUBLIÉ DES MANDATS MORTS
--
-- Elle créait une publication pour tout mandat en visibilité 'public' ou
-- 'talent_only', SANS REGARDER SON STATUT. Résultat : 36 publications
-- actives, dont 11 sur des mandats closés et 12 sur des mandats terminés.
-- Le job board aurait affiché 23 offres périmées — exactement le défaut
-- que « publier est un acte » devait corriger, réintroduit au chargement.
--
-- Le modèle donne la bonne façon de le dire : l'acte a bien eu lieu, il a
-- pris fin avec le mandat. On ne supprime donc pas la publication, on la
-- RETIRE — l'historique reste, et seules les offres vivantes s'affichent.
-- ---------------------------------------------------------------------

update app.mandat_publication p
   set retire_le = coalesce(m.maj_le, now()),
       motif_retrait = 'mandat ' || m.statut::text || ' — retrait rétroactif à la reprise'
from core.mandat m
where m.id = p.mandat_id
  and p.retire_le is null
  and (m.statut is distinct from 'en_cours' or m.est_hors_marche);

-- ---------------------------------------------------------------------
-- CORRECTIF 2 — LE LIBELLÉ PUBLIC PORTAIT LE NOM DU CLIENT
--
-- La reprise avait rempli libelle_public avec mandat.titre. Or MESURÉ :
-- 11 des 12 titres contiennent la raison sociale du client — « Advanthink
-- - Product Marketing Manager », « Kiro-D1-Tech-Head of Data » — et les 12
-- mandats sont marqués anonymes. Publier ce champ exposait chaque client
-- sur la seule page destinée à être indexée.
--
-- Le libellé est donc RECALCULÉ depuis le métier, jamais depuis le titre.
-- Les 12 offres ont toutes un métier renseigné, vérifié.
-- ---------------------------------------------------------------------

update app.mandat_publication p
   set libelle_public = coalesce(mt.libelle_fr, u.libelle_fr || ' — poste à pourvoir')
from core.mandat m
left join ref.metier  mt on mt.id = m.metier_id
left join ref.univers u  on u.id  = m.univers_id
where m.id = p.mandat_id;

comment on column app.mandat_publication.libelle_public is
  'Le titre tel qu''il paraît. CALCULÉ depuis le métier, JAMAIS depuis mandat.titre — mesuré, 11 des 12 titres contiennent la raison sociale du client.';

-- ---------------------------------------------------------------------
-- LE MASQUAGE DU NOM DU CLIENT DANS LES TEXTES LIBRES
--
-- Les descriptions sont écrites à la main par des recruteurs, et l'une
-- d'elles nomme son propre client : « pas le contexte Topograph à ce
-- stade ». Un contrôle ponctuel ne suffit pas — la prochaine rédaction
-- peut recommencer.
--
-- La fonction masque le texte quand il contient le nom du client de
-- l'offre, en respectant les FRONTIÈRES DE MOTS. Sans elles, « Uber » se
-- trouve dans « Kubernetes » et « Join » dans « rejoindre » : trois faux
-- positifs mesurés sur les 12 offres.
-- ---------------------------------------------------------------------

create or replace function api.sans_nom_client(texte text, nom_client text)
returns text language sql immutable parallel safe as $$
  select case
    when texte is null or nom_client is null or length(nom_client) < 4 then texte
    when texte ~* ('\m' || regexp_replace(nom_client, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M')
      then null
    else texte end;
$$;
comment on function api.sans_nom_client(text, text) is
  'Rend NULL un texte qui nomme le client de son offre. Frontières de mots obligatoires : sans elles « Uber » se trouve dans « Kubernetes ».';

-- ---------------------------------------------------------------------
-- LA VUE DU JOB BOARD
--
-- Nommée api.offre_publique comme le ticket la nomme. security_invoker,
-- donc soumise à la RLS de l'appelant. Elle n'expose JAMAIS mandat.titre.
-- ---------------------------------------------------------------------

drop view if exists api.offre;

create or replace view api.offre_publique with (security_invoker = true) as
select
  p.mandat_id                       as id,
  p.libelle_public                  as intitule,
  u.libelle_fr                      as univers,
  mt.libelle_fr                     as metier,
  -- le client n'est nommé que si l'offre n'est PAS anonyme
  case when m.est_anonyme then null else e.nom end as entreprise,
  m.contrat::text                   as contrat,
  m.salaire_min_ke, m.salaire_max_ke,
  m.tjm_min_eur, m.tjm_max_eur,
  p.salaire_affiche,
  m.localisation, m.departement,
  (select array_agg(r.remote::text) from core.mandat_remote r where r.mandat_id = m.id) as remote,
  api.sans_nom_client(m.description,   case when m.est_anonyme then e.nom end) as description,
  api.sans_nom_client(m.missions,      case when m.est_anonyme then e.nom end) as missions,
  api.sans_nom_client(m.pour_toi,      case when m.est_anonyme then e.nom end) as pour_toi,
  api.sans_nom_client(m.pas_pour_toi,  case when m.est_anonyme then e.nom end) as pas_pour_toi,
  api.sans_nom_client(m.remote_infos,  case when m.est_anonyme then e.nom end) as remote_infos,
  api.sans_nom_client(m.salaire_infos, case when m.est_anonyme then e.nom end) as salaire_infos,
  m.experience_min_annees,
  (select array_agg(tj.emoji || ' ' || tj.libelle_fr order by tj.ordre)
     from core.mandat_tag_job x join ref.tag_job tj on tj.id = x.tag_job_id
    where x.mandat_id = m.id) as tags,
  p.publie_le
from app.mandat_publication p
join core.mandat m       on m.id = p.mandat_id
left join core.entreprise e on e.id = m.entreprise_id
left join ref.univers u  on u.id = m.univers_id
left join ref.metier  mt on mt.id = m.metier_id
where p.retire_le is null
  and p.canal = 'job_board_public';

comment on view api.offre_publique is
  'Le job board. Une offre y est parce qu''un ACTE de publication existe et n''a pas été retiré. N''expose JAMAIS mandat.titre, qui contient la raison sociale dans 11 cas sur 12.';

-- ---------------------------------------------------------------------
-- LE CONTRÔLE, qui doit rester à zéro
-- ---------------------------------------------------------------------

create or replace view api.v_fuite_client as
select p.mandat_id, e.nom as client, x.champ
from app.mandat_publication p
join core.mandat m on m.id = p.mandat_id
join core.entreprise e on e.id = m.entreprise_id
cross join lateral (values
  ('titre', m.titre), ('description', m.description), ('missions', m.missions),
  ('pour_toi', m.pour_toi), ('pas_pour_toi', m.pas_pour_toi),
  ('remote_infos', m.remote_infos), ('salaire_infos', m.salaire_infos)) as x(champ, valeur)
where p.retire_le is null and m.est_anonyme
  and x.valeur ~* ('\m' || regexp_replace(e.nom, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M');
comment on view api.v_fuite_client is
  'Les champs d''une offre anonyme qui nomment son propre client. La vue publique les masque, mais la source reste à corriger côté Bubble.';

grant select on api.offre_publique to anon, authenticated;
grant select on api.v_fuite_client to authenticated;
grant execute on function api.sans_nom_client(text, text) to anon, authenticated;
