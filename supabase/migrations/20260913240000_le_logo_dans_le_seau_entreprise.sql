-- ═══════════════════════════════════════════════════════════════════════════
-- LE LOGO DE L'ENTREPRISE, DANS LE MÊME SEAU.
--
-- LE DÉFAUT
-- ─────────
-- L'écran « Profil entreprise » demande le logo sous forme d'ADRESSE, avec pour
-- toute aide « Adresse d'image. Ceux repris de l'ancien outil commencent par
-- « // » : c'est normal. » C'est le même défaut que la photo du contact, avec
-- une circonstance aggravante : on explique à quelqu'un la forme d'une URL
-- héritée d'un outil qu'il n'a jamais utilisé, au lieu de lui laisser choisir
-- un fichier.
--
-- CE QUE FAIT CETTE MIGRATION
-- ───────────────────────────
-- Elle ÉLARGIT les quatre policies de `documents-entreprise` à un second
-- propriétaire. Le seau accueillait `<contact client>/photo/…` ; il accueille
-- désormais aussi `<entreprise>/logo/…`.
--
-- ⚠ DEUX CLÉS DE CLOISONNEMENT, ET C'EST VOULU. Une photo appartient à UNE
-- PERSONNE — `api.mon_contact_client()` ; un logo appartient à une ENTREPRISE,
-- que plusieurs contacts partagent — `api.mes_entreprises()`. Employer la clé
-- de la personne pour le logo aurait enfermé le fichier dans le dossier de
-- celui qui l'a déposé : son collègue ne l'aurait pas relu, et le remplacer
-- après un départ aurait été impossible.
--
-- ⚠ LA LISTE BLANCHE DU DEUXIÈME DOSSIER EST APPARIÉE À LA PREMIÈRE CLÉ.
-- `<contact>/logo/…` et `<entreprise>/photo/…` sont refusés tous les deux :
-- sans cet appariement, un contact pourrait déposer sous l'identifiant de son
-- entreprise dans `photo/`, et l'écran du compte irait chercher là une image
-- qui n'est celle de personne.
--
-- ⚠ PAS DE SVG, MALGRÉ L'USAGE. Un logo est le cas où l'on veut du vectoriel,
-- et le wireframe écrit « PNG ou SVG ». Un SVG est un document EXÉCUTABLE : il
-- porte du script, et une URL signée s'ouvre dans un onglet comme n'importe
-- quelle autre. Le seau garde donc ses trois types matriciels. C'est une perte
-- de netteté assumée, dite à l'écran, et non un oubli.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists contact_lit_ses_documents      on storage.objects;
drop policy if exists contact_depose_ses_documents   on storage.objects;
drop policy if exists contact_remplace_ses_documents on storage.objects;
drop policy if exists contact_retire_ses_documents   on storage.objects;

-- Le couple (premier dossier, second dossier) admis, en un seul endroit : les
-- quatre policies le répètent, et une divergence entre elles est exactement le
-- genre de défaut qu'on ne voit qu'en production.
create or replace function api.dossier_entreprise_permis(p_nom text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select case (storage.foldername(p_nom))[2]
           when 'photo' then (storage.foldername(p_nom))[1] = (select api.mon_contact_client())::text
           when 'logo'  then (storage.foldername(p_nom))[1]
                             in (select m::text from api.mes_entreprises() m)
           else false
         end;
$$;
revoke execute on function api.dossier_entreprise_permis(text) from public, anon;
grant  execute on function api.dossier_entreprise_permis(text) to authenticated, service_role;
comment on function api.dossier_entreprise_permis(text) is
  'Le couple (propriétaire, nature) admis dans documents-entreprise : photo/ appartient à la personne, logo/ à l''entreprise. INVOKER : elle ne fait qu''appeler deux fonctions DEFINER qui portent déjà leur propre garde.';

create policy contact_lit_ses_documents on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents-entreprise'
    and (select api.dossier_entreprise_permis(name))
  );

create policy contact_depose_ses_documents on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents-entreprise'
    and (select api.dossier_entreprise_permis(name))
  );

create policy contact_remplace_ses_documents on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents-entreprise'
    and (select api.dossier_entreprise_permis(name))
  )
  with check (
    bucket_id = 'documents-entreprise'
    and (select api.dossier_entreprise_permis(name))
  );

create policy contact_retire_ses_documents on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents-entreprise'
    and (select api.dossier_entreprise_permis(name))
  );

-- ═══════════════════════════════════════════════════════════════════════
-- Contrôle de migration.
-- ═══════════════════════════════════════════════════════════════════════
do $$
declare v integer;
begin
  select count(*) into v
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'storage' and c.relname = 'objects'
     and p.polname like 'contact\_%';
  if v <> 4 then
    raise exception 'attendu 4 policies contact sur storage.objects, trouvé %', v;
  end if;

  -- La fonction doit REFUSER ce qui n'est ni photo/ ni logo/, sans session.
  if api.dossier_entreprise_permis('abc/cv/x.pdf') is not false then
    raise exception 'un dossier hors liste blanche n''est pas refusé';
  end if;
  if api.dossier_entreprise_permis('abc/x.png') is not false then
    raise exception 'un chemin sans second dossier n''est pas refusé';
  end if;
end $$;
