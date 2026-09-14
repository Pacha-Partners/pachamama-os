-- =====================================================================
-- CONTRÔLE — les champs de la fiche d'offre sont-ils RENSEIGNÉS ?
--
-- Les colonnes existent toutes dans core.mandat : ce n'est pas la
-- question. La question est de savoir combien des offres PUBLIÉES les
-- remplissent, car un bloc de la maquette dont la donnée est vide sur
-- douze offres sur douze n'est pas un bloc à construire.
-- =====================================================================

do $$
declare
  n_pub int;
  c text;
  n int;
  champs text[] := array[
    'missions','process_recrutement','pour_toi','pas_pour_toi','video_youtube',
    'salaire_infos','remote_infos','scorecard_discovery','scorecard_delivery',
    'scorecard_strategie','scorecard_management','scorecard_ops',
    'contact_manager_id','agent_en_charge_id','entreprise_id'
  ];
begin
  select count(*) into n_pub
    from app.mandat_publication p where p.retire_le is null;

  foreach c in array champs loop
    execute format(
      'select count(*) from app.mandat_publication p
         join core.mandat m on m.id = p.mandat_id
        where p.retire_le is null and m.%I is not null', c) into n;
    insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
    values ('fiche', 'core.mandat.' || c, n_pub, n, 0, 'renseigné sur les offres publiées');
  end loop;

  -- les deux drapeaux, comptés pour ce qu'ils valent
  insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
  select 'fiche', 'offres anonymes', n_pub, count(*) filter (where m.est_anonyme), 0, 'est_anonyme'
    from app.mandat_publication p join core.mandat m on m.id = p.mandat_id where p.retire_le is null;

  insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
  select 'fiche', 'dont exclusives Pachamama', count(*) filter (where m.est_anonyme),
         count(*) filter (where m.est_anonyme and m.exclusivite_pachamama), 0,
         'l''encart d''anonymat promet une exclusivité : est-ce vrai ?'
    from app.mandat_publication p join core.mandat m on m.id = p.mandat_id where p.retire_le is null;

  -- le site internet du client, qui réidentifie sans qu'aucun masquage lexical le voie
  insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
  select 'fiche', 'entreprise.site_web renseigné', n_pub, count(*) filter (where e.site_web is not null), 0,
         'vecteur de réidentification sur offre anonyme'
    from app.mandat_publication p
    join core.mandat m on m.id = p.mandat_id
    left join core.entreprise e on e.id = m.entreprise_id
   where p.retire_le is null;
end $$;
