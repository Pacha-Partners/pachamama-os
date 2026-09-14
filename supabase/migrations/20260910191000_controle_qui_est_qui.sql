-- `personne_en_charge` et `recruteur` désignent-ils la même population ?
-- Le domaine des e-mails tranche : un salarié Pachamama ou un contact client.
insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'qui', 'agents des offres publiées (core.collaborateur)', null, null, 0,
       string_agg(distinct coalesce(split_part(ag.email::text, '@', 2), '∅'), ', ')
  from app.mandat_publication p
  join core.mandat m on m.id = p.mandat_id
  join core.collaborateur ag on ag.id = m.agent_en_charge_id
 where p.retire_le is null;

insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
select 'qui', 'recruteurs du modèle (core.contact_client)', null, null, 0,
       string_agg(distinct coalesce(split_part(c.email::text, '@', 2), '∅'), ', ')
  from core.mandat m join core.contact_client c on c.id = m.contact_recruteur_id;

