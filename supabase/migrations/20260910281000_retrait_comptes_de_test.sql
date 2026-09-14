-- =====================================================================
-- Retirer les deux comptes de test posés par 20260910270000
--
-- Ils n'ont pas d'usage : le dirigeant ne les a pas demandés sous cette
-- forme. On les retire avant de restructurer les portails, pour que la
-- migration suivante travaille sur les seules données réelles.
--
-- L'ordre compte. `app.compte.auth_id` référence auth.users ON DELETE
-- CASCADE, et `app.acces.compte_id` référence app.compte ON DELETE CASCADE :
-- supprimer l'utilisateur d'authentification emporte donc le compte et ses
-- accès. Les quatre fiches de personne, elles, ne sont rattachées à rien
-- d'autre et se suppriment ensuite.
-- =====================================================================

do $$
begin
  if to_regnamespace('avant_garde') is not null then
    raise warning 'retrait IGNORÉ : schéma avant_garde présent, donc PRODUCTION.';
    return;
  end if;

  delete from auth.users
   where email in ('test-pacha@pachamama.pm', 'test-recruteur@pachamama.pm');

  -- Filet : si un compte survivait sans utilisateur d'authentification.
  delete from app.compte
   where id in (reprise.uid('test#compte-pacha'), reprise.uid('test#compte-recruteur'));

  delete from core.collaborateur
   where id in (reprise.uid('test#collab-admin'), reprise.uid('test#collab-recruteur'));
  delete from core.fiche_talent   where id = reprise.uid('test#talent');
  delete from core.contact_client where id = reprise.uid('test#contact');

  raise notice 'comptes de test retirés';
end
$$;
