-- =====================================================================
-- Porter l'identité interne de Claude Menye sur son compte professionnel
--
-- ÉTAT AVANT. Deux comptes pour un même humain, hérités de deux
-- utilisateurs Bubble :
--   le compte personnel hérité  → talent + backoffice(admin)
--   le compte professionnel     → talent
-- La fiche collaborateur `c3880f25…` (« Claude Menye ») porte l'accès
-- back-office, et elle est rattachée au PREMIER compte.
--
-- CE QU'ON FAIT, ET POURQUOI AINSI. On DÉPLACE l'accès back-office vers
-- le compte professionnel, et on ajoute un accès recruteur sur la même fiche.
-- L'alternative — créer un second collaborateur « Claude Menye » — aurait
-- introduit une personne en double dans une table qui décrit l'équipe
-- réelle. Déplacer respecte « une personne, un compte » mieux que l'état
-- actuel, et n'invente rien.
--
-- Le rôle passe à `superadmin`, demandé. C'est la première ligne à porter
-- cette valeur, présente dans l'énuméré depuis le 29/08 et jamais employée.
--
-- Le compte personnel conserve son accès talent : il garde donc un
-- accès, et `compte_a_un_acces` reste satisfaite.
--
-- ⚠ DEV UNIQUEMENT. Le projet de production porte le schéma `avant_garde`,
-- que le dev n'a pas : la migration s'y contente d'un avertissement.
--
-- POUR REVENIR EN ARRIÈRE :
--   delete from app.acces where compte_id = '0731dba3-8ed1-57ff-92d9-492aae8a1abc'
--                           and portail = 'recruteur';
--   update app.acces set compte_id = 'ecf4f61f-936b-5556-8fba-51a7d3acd89f',
--                        role_interne = 'admin'
--    where id = '5920d054-f2e9-4cac-b727-ba1032638e69';
-- =====================================================================

do $$
declare
  v_compte  constant uuid := '0731dba3-8ed1-57ff-92d9-492aae8a1abc'; -- le compte professionnel
  v_collab  constant uuid := 'c3880f25-3597-55c8-8c5f-eb18ac931c73'; -- « Claude Menye »
  n_deplace integer;
  n_ajoute  integer;
begin
  if to_regnamespace('avant_garde') is not null then
    raise warning 'accès internes IGNORÉS : schéma avant_garde présent, donc PRODUCTION.';
    return;
  end if;

  if not exists (select 1 from app.compte where id = v_compte) then
    raise exception 'compte professionnel introuvable';
  end if;
  if not exists (select 1 from core.collaborateur where id = v_collab) then
    raise exception 'fiche collaborateur « Claude Menye » introuvable';
  end if;

  update app.acces
     set compte_id = v_compte, role_interne = 'superadmin', maj_le = now()
   where collaborateur_id = v_collab and portail = 'backoffice';
  get diagnostics n_deplace = row_count;

  insert into app.acces (compte_id, collaborateur_id, portail, role_interne, actif)
  values (v_compte, v_collab, 'recruteur', 'recruteur', true)
  on conflict do nothing;
  get diagnostics n_ajoute = row_count;

  insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
  values ('acces_internes_claude', 'app.acces', 2, n_deplace + n_ajoute, 0,
          format('back-office déplacé (%s) et accès recruteur ajouté (%s) sur le compte professionnel ; '
                 'rôle superadmin, première occurrence de cette valeur', n_deplace, n_ajoute));

  raise notice 'back-office déplacé % · recruteur ajouté %', n_deplace, n_ajoute;
end
$$;
