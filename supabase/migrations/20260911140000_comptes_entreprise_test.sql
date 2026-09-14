-- =====================================================================
-- Trois comptes entreprise, pour éprouver un portail qui n'a jamais servi
--
-- Les trois entreprises retenues sont celles qui portent le plus de mandats
-- parmi les 80 plus récents : Hublo (7), Prose (7), N2J Soft (4). Pour
-- chacune, le contact principal.
--
-- POURQUOI PAR MIGRATION, ET NON PAR LE DÉCLENCHEUR. `api.rattacher_compte`
-- sait créer compte et accès quand la personne n'en a pas — c'est son rôle.
-- Appelée directement, elle le fait sans faute. Mais lorsqu'elle s'exécute
-- DEPUIS LE DÉCLENCHEUR de GoTrue, son chemin d'INSERTION échoue : la
-- création rend « Database error creating new user », alors qu'une adresse
-- ne correspondant à personne passe. La lecture fonctionne, l'écriture non.
-- La cause n'est pas élucidée à ce jour et reste à instruire.
--
-- On pose donc compte et accès ICI, avec auth_id NULL. À la création de
-- l'utilisateur, le déclencheur empruntera sa branche « un compte existe
-- déjà pour cette adresse » — celle qui se contente d'un UPDATE, et qui
-- fonctionne : c'est par elle que les 42 comptes internes ont été rattachés.
--
-- ⚠ DEV UNIQUEMENT. Ce sont de VRAIS contacts de clients réels. Aucun
-- courriel ne leur est envoyé — l'API d'administration crée en silence — et
-- rien de tout ceci n'atteint la production, que la garde `avant_garde`
-- protège.
--
-- POUR RETIRER : supprimer les trois utilisateurs de auth.users (la cascade
-- emporte comptes et accès).
-- =====================================================================

do $$
declare
  r record;
  n integer := 0;
begin
  if to_regnamespace('avant_garde') is not null then
    raise warning 'comptes entreprise IGNORÉS : schéma avant_garde présent, donc PRODUCTION.';
    return;
  end if;

  for r in
    select k.id as contact_id, lower(k.email::text) as courriel
      from core.contact_client k
     -- ⚠ LES ADRESSES NE SONT PAS DANS CE FICHIER, ET C'EST DÉLIBÉRÉ.
     -- Elles désignent trois personnes réelles chez trois clients réels ;
     -- ce dépôt est PUBLIC. Elles sont fournies au moment de la poussée :
     --   psql> set pacha.comptes_entreprise_test = 'a@x.fr,b@y.fr,c@z.fr';
     -- ou, côté CI, par une variable de dépôt. Absent le réglage, la
     -- migration ne fait rien et le dit — elle n'échoue pas : un dépôt
     -- cloné doit pouvoir rejouer l'historique entier sans ces comptes.
     where lower(k.email::text) = any (
             string_to_array(
               coalesce(nullif(current_setting('pacha.comptes_entreprise_test', true), ''), ''),
               ','))
  loop
    -- Identifiant déterministe : la migration se rejoue sans doublonner.
    insert into app.compte (id, actif) values (reprise.uid('compte#entreprise#'||r.courriel), true)
    on conflict (id) do nothing;

    insert into app.acces (compte_id, contact_client_id, portail, actif)
    values (reprise.uid('compte#entreprise#'||r.courriel), r.contact_id, 'entreprise', true)
    on conflict do nothing;

    n := n + 1;
  end loop;

  if coalesce(nullif(current_setting('pacha.comptes_entreprise_test', true), ''), '') = '' then
    raise warning 'comptes entreprise IGNORÉS : le réglage pacha.comptes_entreprise_test est absent.';
    return;
  end if;
  if n = 0 then
    raise exception 'aucun contact trouvé pour les adresses fournies : vérifier le réglage';
  end if;

  raise notice '% comptes entreprise pré-provisionnés', n;
end
$$;
