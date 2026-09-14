-- ═══════════════════════════════════════════════════════════════════════════
-- LE STOCKAGE DES DOCUMENTS DU TALENT — CV, photo, portfolio.
--
-- ⚠ MESURÉ AVANT D'ÉCRIRE : `select count(*) from storage.buckets` rend **0**.
-- Il n'existe aucun seau sur le projet de développement, et aucune policy sur
-- `storage.objects` — dont la RLS est pourtant activée. Autrement dit : le
-- stockage était intégralement fermé, et l'écran « Mon profil » n'avait aucune
-- destination où déposer un fichier. C'est le seul motif de cette migration.
--
-- ─────────────────────────────────────────────────────────────────────────
-- UN SEUL SEAU, PRIVÉ
-- ─────────────────────────────────────────────────────────────────────────
-- `public = false`. Un seau public sert ses objets par URL devinable et sans
-- session : un CV est le document le plus identifiant du vivier — mesuré en
-- phase 1, **1 145 des 1 414 `cv_url` d'un seul client portent le patronyme
-- dans leur chemin** (D-14). Il n'a rien à faire derrière une adresse publique.
-- La lecture passe donc par une URL SIGNÉE, à durée courte, fabriquée côté
-- serveur par `frontend/lib/talent/stockage.ts`.
--
-- Un seul seau et non trois (cv / photo / portfolio) : le cloisonnement utile
-- n'est pas par nature de document, il est **par personne**. Trois seaux
-- auraient triplé les policies pour la même règle.
--
-- ─────────────────────────────────────────────────────────────────────────
-- LA RÈGLE D'ACCÈS : LE PREMIER DOSSIER EST L'IDENTIFIANT DE LA FICHE
-- ─────────────────────────────────────────────────────────────────────────
--     <fiche_talent_id>/cv/<horodatage>-<nom de fichier>
--     <fiche_talent_id>/photo/<horodatage>-<nom de fichier>
--     <fiche_talent_id>/portfolio/<horodatage>-<nom de fichier>
--
-- Les quatre policies comparent `(storage.foldername(name))[1]` à
-- `api.ma_fiche_talent()`. C'est la même fonction que celle qui filtre
-- `api.ma_fiche` : une seule source pour « quelle fiche est la mienne », donc
-- pas de divergence possible entre le droit de lire sa fiche et le droit de
-- lire ses fichiers. Elle est `security definer` et `stable` — le planificateur
-- l'évalue une fois par requête, pas une fois par ligne — et `EXECUTE` est déjà
-- accordé à `authenticated` (vérifié).
--
-- ⚠ `api.ma_fiche_talent()` NE REGARDE PAS LE PORTAIL de l'accès. La garde de
-- portail vit dans les vues (`20260913084000`) ; ici elle serait redondante et,
-- surtout, elle ferait dépendre l'accès à un fichier déjà déposé d'un droit
-- révocable — un talent dont l'accès est fermé ne doit pas voir ses documents
-- devenir illisibles pour le cabinet lui-même. Le cabinet, justement, passe par
-- `service_role`, qui contourne la RLS : aucun besoin de policy pour lui.
--
-- ─────────────────────────────────────────────────────────────────────────
-- CE QUI EST ACCEPTÉ, ET POURQUOI CES VALEURS
-- ─────────────────────────────────────────────────────────────────────────
-- 10 Mo, et sept types MIME. Le plafond est celui d'un CV avec ses visuels ;
-- au-delà, ce n'est plus un CV. Les types couvrent le PDF (le format d'un CV
-- transmis à un client), les deux formats Word (ce que les gens ont sous la
-- main), et JPEG / PNG / WebP pour la photo. Ni SVG — un SVG est un document
-- exécutable — ni HEIC, que rien côté client ne saurait afficher.
--
-- Le seau CONTRAINT ces deux limites lui-même : `frontend/components/pacha/
-- Televersement.tsx` les annonce et les tient déjà côté navigateur, mais un
-- garde d'interface n'est pas un garde. Ici, un `curl` les rencontre aussi.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents-talent',
  'documents-talent',
  false,
  10 * 1024 * 1024,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
-- Idempotente : la migration doit pouvoir être rejouée sur un projet où le
-- seau a été créé à la main depuis la console.
on conflict (id) do update
   set public             = excluded.public,
       file_size_limit    = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

-- ═══════════════════════════════════════════════════════════════════════
-- Les quatre policies. Une par verbe : `for all` aurait mélangé la clause
-- `using` (quelles lignes je vois) et `with check` (quelles lignes je peux
-- écrire), et c'est précisément la distinction qui compte ici.
-- ═══════════════════════════════════════════════════════════════════════

drop policy if exists talent_lit_ses_documents      on storage.objects;
drop policy if exists talent_depose_ses_documents   on storage.objects;
drop policy if exists talent_remplace_ses_documents on storage.objects;
drop policy if exists talent_retire_ses_documents   on storage.objects;

create policy talent_lit_ses_documents on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents-talent'
    and (storage.foldername(name))[1] = (select api.ma_fiche_talent())::text
  );

-- ⚠ LE DOSSIER EST CONTRAINT À L'ÉCRITURE, PAS SEULEMENT À LA LECTURE.
-- Sans `with check`, un talent pourrait déposer un fichier dans le dossier de
-- quelqu'un d'autre : il ne le relirait pas, mais il l'aurait écrit — et sur un
-- seau de CV, écrire chez autrui suffit à nuire.
create policy talent_depose_ses_documents on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents-talent'
    and (storage.foldername(name))[1] = (select api.ma_fiche_talent())::text
    -- Le deuxième dossier nomme la nature du document. Fermé par liste
    -- BLANCHE : un dossier inattendu naît refusé, ce qui est le sens sûr.
    and (storage.foldername(name))[2] in ('cv', 'photo', 'portfolio')
  );

create policy talent_remplace_ses_documents on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents-talent'
    and (storage.foldername(name))[1] = (select api.ma_fiche_talent())::text
  )
  with check (
    bucket_id = 'documents-talent'
    and (storage.foldername(name))[1] = (select api.ma_fiche_talent())::text
    and (storage.foldername(name))[2] in ('cv', 'photo', 'portfolio')
  );

create policy talent_retire_ses_documents on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents-talent'
    and (storage.foldername(name))[1] = (select api.ma_fiche_talent())::text
  );

-- ═══════════════════════════════════════════════════════════════════════
-- Contrôle de migration — elle échoue plutôt que de mentir.
-- ═══════════════════════════════════════════════════════════════════════
do $$
declare v_seau integer; v_policies integer;
begin
  select count(*) into v_seau
    from storage.buckets
   where id = 'documents-talent' and public is false;
  if v_seau <> 1 then
    raise exception 'le seau documents-talent est absent ou public';
  end if;

  select count(*) into v_policies
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'storage' and c.relname = 'objects'
     and p.polname like 'talent\_%';
  if v_policies <> 4 then
    raise exception 'attendu 4 policies talent sur storage.objects, trouvé %', v_policies;
  end if;
end $$;
