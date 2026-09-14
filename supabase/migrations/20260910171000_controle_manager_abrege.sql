-- La troncature rend-elle bien « Prénom I. », et traite-t-elle les cas limites ?
do $$
declare r record;
begin
  for r in
    select cm.prenom, cm.nom,
           nullif(btrim(
             coalesce(cm.prenom, '')
             || case when nullif(btrim(coalesce(cm.prenom,'')), '') is not null
                          and nullif(btrim(coalesce(cm.nom,'')), '') is not null
                     then ' ' || upper(left(btrim(cm.nom), 1)) || '.'
                     when nullif(btrim(coalesce(cm.prenom,'')), '') is null
                     then coalesce(btrim(cm.nom), '')
                     else '' end
           ), '') as abrege
      from core.mandat m join core.contact_client cm on cm.id = m.contact_manager_id
     limit 6
  loop
    insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
    values ('manager', 'abrégé', null, null, 0,
            coalesce(r.prenom,'∅') || ' / ' || coalesce(r.nom,'∅') || '  →  ' || coalesce(r.abrege,'NULL'));
  end loop;
end $$;
