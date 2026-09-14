-- =====================================================================
-- ÉPREUVE DE LA CHAÎNE « FUTUR.E MANAGER », BOUT EN BOUT.
--
-- `api.offre_detail` ne contient que les mandats PUBLIÉS, et aucun des 12
-- n'a de manager : les jointures et les expressions qui composent le nom
-- et le titre n'ont donc jamais été exécutées sur de la donnée réelle.
-- Une jointure fausse rendrait `null` sans erreur, exactement comme une
-- donnée absente — les deux sont indiscernables à l'affichage.
--
-- Ce contrôle rejoue les expressions MOT POUR MOT sur un mandat pris
-- parmi les 77 qui ont un manager, sans rien publier ni modifier.
-- =====================================================================

do $$
declare r record; n int;
begin
  select nullif(btrim(coalesce(cm.prenom,'') || ' ' || coalesce(cm.nom,'')), '') as manager_nom,
         cm.photo_url  as manager_photo,
         mmt.libelle_fr as manager_titre,
         p.libelle_public as offre
    into r
    from core.mandat m
    join core.contact_client cm on cm.id = m.contact_manager_id
    left join ref.metier mmt on mmt.id = cm.metier_id
    left join app.mandat_publication p on p.mandat_id = m.id
   where m.contact_manager_id is not null
     and cm.photo_url is not null
     and cm.metier_id is not null
     and btrim(coalesce(cm.prenom,'') || coalesce(cm.nom,'')) <> ''
   limit 1;

  insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
  values ('manager', 'les trois expressions de la vue rendent une valeur', 3,
          (case when r.manager_nom is not null then 1 else 0 end)
        + (case when r.manager_photo is not null then 1 else 0 end)
        + (case when r.manager_titre is not null then 1 else 0 end),
          0,
          'nom=' || coalesce(r.manager_nom,'∅')
          || ' · titre=' || coalesce(r.manager_titre,'∅')
          || ' · photo=' || case when r.manager_photo is null then '∅'
                                 else left(r.manager_photo, 28) end);

  -- Et l'anonymat : la même chaîne doit rendre NULL sur un mandat anonyme.
  select count(*) into n
    from core.mandat m
    join core.contact_client cm on cm.id = m.contact_manager_id
   where m.est_anonyme;

  insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
  values ('manager', 'mandats anonymes ayant pourtant un manager en base', null, n, 0,
          'ce sont eux que le masquage catégorique doit taire');
end $$;
