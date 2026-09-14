-- La chaîne de l'agent, offre publiée par offre publiée : que dit le miroir,
-- que dit le modèle, et quel nom la vue finit-elle par servir ?
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'chaine', 'offre : ' || p.libelle_public, null, null, 0,
       'miroir.personne_en_charge=' || coalesce(pm.personne_en_charge_id, '∅')
    || ' | miroir.recruteur=' || coalesce(pm.recruteur_id, '∅')
    || ' | core.agent_en_charge=' || coalesce(m.agent_en_charge_id::text, '∅')
    || ' | nom servi=' || coalesce(nullif(btrim(coalesce(ag.prenom,'') || ' ' || coalesce(ag.nom,'')),''), '∅')
    || ' | collaborateur.bubble_id=' || coalesce(ag.bubble_id, '∅')
  from app.mandat_publication p
  join core.mandat m on m.id = p.mandat_id
  left join public.mandat pm on pm.id = m.bubble_id
  left join core.collaborateur ag on ag.id = m.agent_en_charge_id
 where p.retire_le is null
 order by p.libelle_public;
