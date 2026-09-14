-- =====================================================================
-- JALON 2 — deux comptes de test, quatre accès, tous les portails
--
-- POURQUOI DEUX COMPTES ET NON QUATRE. Un compte porte plusieurs accès
-- (Décision 4), et un accès pointe vers EXACTEMENT UNE personne
-- (acces_exactement_une_personne). Trois portails pour un même humain, ce
-- sont donc trois fiches de personne sur un seul compte — pas trois comptes.
--
-- Une chose ne se cumule pas : admin et recruteur ne sont pas deux accès,
-- c'est le même portail interne avec un `role_interne` différent, et
-- api.role_interne() fait `limit 1`. Deux accès internes sur un compte
-- rendraient un rôle tiré au hasard. Comme un admin voit déjà /recruteur ET
-- /backoffice, observer ce que voit un recruteur SIMPLE exige un second
-- compte. D'où deux, et pas un.
--
--   test-pacha@pachamama.pm      collaborateur(admin) + fiche talent
--                                + contact client → Pachamama
--                                → Recruteur · Back-office · Entreprise · Talent
--   test-recruteur@pachamama.pm  collaborateur(recruteur)
--                                → Recruteur
--
-- Les identifiants sont DÉTERMINISTES (reprise.uid) : la migration se rejoue
-- sans créer de doublon, et un script peut recalculer les mêmes valeurs.
--
-- ⚠ DEV UNIQUEMENT. Ce sont des personnes inventées. Le projet de production
-- porte le schéma `avant_garde` (application Avant-garde) que le dev n'a pas :
-- la migration s'y contente d'un avertissement.
--
-- POUR RETIRER CES COMPTES :
--   delete from app.compte where id in (reprise.uid('test#compte-pacha'),
--                                       reprise.uid('test#compte-recruteur'));
--   -- les accès partent en cascade ; puis les trois fiches de personne :
--   delete from core.collaborateur  where id in (reprise.uid('test#collab-admin'),
--                                                reprise.uid('test#collab-recruteur'));
--   delete from core.fiche_talent   where id = reprise.uid('test#talent');
--   delete from core.contact_client where id = reprise.uid('test#contact');
-- =====================================================================

do $$
declare
  v_entreprise uuid;
  v_compte_a constant uuid := reprise.uid('test#compte-pacha');
  v_compte_b constant uuid := reprise.uid('test#compte-recruteur');
begin
  if to_regnamespace('avant_garde') is not null then
    raise warning 'comptes de test IGNORÉS : schéma avant_garde présent, donc PRODUCTION.';
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
    raise warning 'comptes de test IGNORÉS : core.entreprise est vide — base sans reprise.';
    return;
  end if;

  select id into v_entreprise from core.entreprise
   where bubble_id = '1758517190985x882278528737869800';   -- « Pachamama »
  if v_entreprise is null then
    raise exception 'entreprise Pachamama introuvable dans core.entreprise : '
                    'le contact client n''aurait aucune entreprise, et api.mes_entreprises() '
                    'ne rendrait rien — le portail entreprise ne s''ouvrirait pas.';
  end if;

  -- ── les quatre fiches de personne ───────────────────────────────────
  insert into core.collaborateur (id, nom, prenom, email, actif)
  values (reprise.uid('test#collab-admin'),     'Test', 'Admin',     'test-pacha@pachamama.pm',     true),
         (reprise.uid('test#collab-recruteur'), 'Test', 'Recruteur', 'test-recruteur@pachamama.pm', true)
  on conflict (id) do update
    set nom = excluded.nom, prenom = excluded.prenom, email = excluded.email, actif = true;

  insert into core.fiche_talent (id, nom, prenom, email_personnel, actif)
  values (reprise.uid('test#talent'), 'Test', 'Talent', 'test-pacha@pachamama.pm', true)
  on conflict (id) do update
    set nom = excluded.nom, prenom = excluded.prenom,
        email_personnel = excluded.email_personnel, actif = true;

  insert into core.contact_client (id, entreprise_id, nom, prenom, email, actif)
  values (reprise.uid('test#contact'), v_entreprise, 'Test', 'Entreprise',
          'test-pacha@pachamama.pm', true)
  on conflict (id) do update
    set entreprise_id = excluded.entreprise_id, nom = excluded.nom,
        prenom = excluded.prenom, email = excluded.email, actif = true;

  -- ── les comptes ─────────────────────────────────────────────────────
  -- `auth_id` reste NULL : l'utilisateur d'authentification est créé ensuite,
  -- et c'est le rattachement par courriel qui les relie.
  insert into app.compte (id, actif) values (v_compte_a, true), (v_compte_b, true)
  on conflict (id) do nothing;

  -- ── les accès. Ils DOIVENT être posés dans la même transaction que les
  --    comptes : le déclencheur `compte_a_un_acces` est DEFERRABLE INITIALLY
  --    DEFERRED et vérifie au COMMIT qu'aucun compte n'est orphelin.
  insert into app.acces (id, compte_id, collaborateur_id, role_interne, actif)
  values (reprise.uid('test#acces-admin'),     v_compte_a, reprise.uid('test#collab-admin'),     'admin',     true),
         (reprise.uid('test#acces-recruteur'), v_compte_b, reprise.uid('test#collab-recruteur'), 'recruteur', true)
  on conflict (id) do nothing;

  insert into app.acces (id, compte_id, fiche_talent_id, actif)
  values (reprise.uid('test#acces-talent'), v_compte_a, reprise.uid('test#talent'), true)
  on conflict (id) do nothing;

  insert into app.acces (id, compte_id, contact_client_id, actif)
  values (reprise.uid('test#acces-contact'), v_compte_a, reprise.uid('test#contact'), true)
  on conflict (id) do nothing;

  insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
  values ('comptes_de_test_j2', 'app.compte + app.acces', 2,
          (select count(*) from app.compte where id in (v_compte_a, v_compte_b)),
          0,
          format('comptes de test DEV : %s accès posés, entreprise Pachamama %s',
                 (select count(*) from app.acces where compte_id in (v_compte_a, v_compte_b)),
                 v_entreprise));

  raise notice 'comptes de test posés : % accès',
    (select count(*) from app.acces where compte_id in (v_compte_a, v_compte_b));
end
$$;
