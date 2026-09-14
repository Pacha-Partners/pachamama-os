-- =====================================================================
-- Un accès entreprise pour le compte professionnel, chez Pachamama
--
-- Pachamama porte 3 mandats en tant qu'ENTREPRISE — ses propres
-- recrutements — et deux contacts y sont déjà rattachés. Aucun n'est
-- Claude Menye : plutôt que de détourner la fiche de quelqu'un d'autre, on
-- en crée une, ce qui n'invente rien puisqu'il EST un contact de Pachamama.
--
-- C'est le quatrième portail de son compte : talent, recruteur, back-office
-- et maintenant entreprise. Aucun compte de la base n'en portait autant.
--
-- ⚠ DEV UNIQUEMENT. Le projet de production porte le schéma `avant_garde`,
-- que le dev n'a pas.
--
-- POUR REVENIR EN ARRIÈRE :
--   delete from app.acces where compte_id = '0731dba3-8ed1-57ff-92d9-492aae8a1abc'
--                           and portail = 'entreprise';
--   delete from core.contact_client where id = reprise.uid('contact#claude-pachamama');
-- =====================================================================

do $$
declare
  v_compte constant uuid := '0731dba3-8ed1-57ff-92d9-492aae8a1abc';
  v_contact constant uuid := reprise.uid('contact#claude-pachamama');
  v_entreprise uuid;
begin
  if to_regnamespace('avant_garde') is not null then
    raise warning 'accès entreprise IGNORÉ : schéma avant_garde présent, donc PRODUCTION.';
    return;
  end if;

  -- ⚠ ET LE GARDE SYMÉTRIQUE : UNE BASE SANS REPRISE.
  -- Celui du dessus protège la PRODUCTION ; celui-ci protège le VIDE. Cette
  -- migration pose des FIXTURES, pas du schéma : sur une base neuve — un
  -- `supabase start`, la CI qui rejoue les 127 migrations pour détecter une
  -- collision — elle n'a rien à poser, et doit le DIRE plutôt qu'échouer.
  -- Sans ce garde, l'historique n'est pas rejouable, et le contrôle qui
  -- attrape deux branches recréant la même vue ne peut pas exister.
  if not exists (select 1 from core.entreprise limit 1) then
    raise warning 'accès entreprise IGNORÉ : core.entreprise est vide — base sans reprise.';
    return;
  end if;

  select id into v_entreprise from core.entreprise
   where bubble_id = '1758517190985x882278528737869800';   -- « Pachamama »
  if v_entreprise is null then
    raise exception 'entreprise Pachamama introuvable';
  end if;

  insert into core.contact_client (id, entreprise_id, nom, prenom, email, actif)
  values (v_contact, v_entreprise, 'Menye', 'Claude', 'le compte professionnel', true)
  on conflict (id) do update
    set entreprise_id = excluded.entreprise_id, email = excluded.email, actif = true;

  insert into app.acces (compte_id, contact_client_id, portail, actif)
  values (v_compte, v_contact, 'entreprise', true)
  on conflict do nothing;

  raise notice 'accès entreprise posé · portails du compte : %',
    (select string_agg(portail::text, ' + ' order by portail::text)
       from app.acces where compte_id = v_compte and actif);
end
$$;
