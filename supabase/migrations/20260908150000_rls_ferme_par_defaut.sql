-- =====================================================================
-- SÉCURITÉ AU NIVEAU LIGNE — FERMÉ PAR DÉFAUT
--
-- Constat du 08/09/2026 : les 64 tables sont sans RLS et sans policy. Un
-- utilisateur authentifié y lit tout, y compris les commissions et les
-- notes écrites sur lui.
--
-- Ce n'est pas encore une faille — aucun de ces schémas n'est déployé en
-- production, ils n'existent qu'en développement. Mais c'est un piège de
-- calendrier : une base ouverte par défaut le reste. Si l'application se
-- construit contre un schéma où tout est lisible, chaque requête est
-- écrite en supposant qu'elle voit tout, et poser la RLS ensuite casse
-- l'application en cent endroits.
--
-- CE QUE CETTE MIGRATION FAIT, ET CE QU'ELLE NE FAIT PAS
--
-- Elle ne pose PAS les policies métier. Celles-ci liront app.acces à
-- travers les fonctions d'authentification qui vivront dans le schéma
-- api, lequel n'existe pas encore et attend le retrait des schémas
-- exposés dans le tableau de bord.
--
-- Elle inverse la posture : RLS activée partout, donc TOUT EST REFUSÉ
-- tant qu'une policy n'autorise pas explicitement. Chaque droit futur
-- sera un ajout délibéré, jamais un rattrapage sur une porte ouverte.
--
-- MESURÉ avant d'écrire : RLS activée sans policy renvoie 0 ligne à
-- anon et à authenticated, et service_role — qui porte BYPASSRLS chez
-- Supabase — continue de tout lire. La reprise n'est donc pas gênée.
--
-- SEULE EXCEPTION, et elle est raisonnée : les vocabulaires. Une liste
-- de métiers ou de secteurs ne porte aucun secret de ligne, et le job
-- board public doit pouvoir les afficher. ref.correspondance en est
-- exclue : c'est une trace de migration, elle n'intéresse personne
-- d'autre que le service.
-- =====================================================================

do $$
declare r record;
begin
  for r in
    select n.nspname as s, c.relname as t
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname in ('ref','config','core','app')
    order by 1, 2
  loop
    execute format('alter table %I.%I enable row level security', r.s, r.t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Les vocabulaires restent lisibles : aucun secret de ligne, et le job
-- board en a besoin pour afficher une offre.
-- ---------------------------------------------------------------------

do $$
declare r record;
begin
  for r in
    select c.relname as t
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname = 'ref' and c.relname <> 'correspondance'
  loop
    execute format(
      'create policy %I on ref.%I for select to anon, authenticated using (true)',
      'lecture_vocabulaire', r.t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Le paramétrage est lisible par un utilisateur authentifié, SAUF les
-- deux tables qui peuvent porter des secrets : la référence aux clés
-- d'intégration et l'interrupteur de redirection des e-mails.
-- config.branding et config.asset restent lisibles sans compte — le job
-- board public affiche le logo et la police.
-- ---------------------------------------------------------------------

do $$
declare r record;
begin
  for r in
    select c.relname as t
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname = 'config'
      and c.relname not in ('parametre','integration')
  loop
    execute format(
      'create policy %I on config.%I for select to authenticated using (true)',
      'lecture_parametrage', r.t);
  end loop;
end $$;

create policy lecture_publique on config.branding for select to anon using (true);
create policy lecture_publique on config.asset    for select to anon using (true);

-- ---------------------------------------------------------------------
-- core et app ne reçoivent AUCUNE policy : entièrement fermés jusqu'à ce
-- que la couche api existe. C'est délibéré, et c'est visible — une
-- requête applicative qui renvoie zéro ligne dira tout de suite qu'il
-- manque une autorisation, plutôt que de laisser croire que tout va bien.
-- ---------------------------------------------------------------------

comment on schema core is
  'Le métier. Écrit par l''application, sauf core.talent qui est une projection en lecture seule alimentée par le connecteur pivot→app. ⚠ RLS ACTIVÉE ET AUCUNE POLICY au 08/09/2026 : fermé par défaut, en attendant que la couche api porte les fonctions d''authentification qui liront app.acces.';
comment on schema app is
  'Ce que l''application possède : authentification, droits, actes, journaux. ⚠ RLS ACTIVÉE ET AUCUNE POLICY au 08/09/2026 : fermé par défaut. C''est le schéma le plus sensible — le journal porte des données personnelles, l''accès porte les droits.';
