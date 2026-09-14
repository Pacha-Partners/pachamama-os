-- ═══════════════════════════════════════════════════════════════════════════
-- LE STOCKAGE DE LA PHOTO D'UN CONTACT CLIENT.
--
-- LE DÉFAUT QU'ELLE CORRIGE
-- ─────────────────────────
-- L'écran « Mes informations » demandait la photo sous forme d'ADRESSE : un
-- champ de texte, avec « Adresse d'image » pour toute aide. Personne ne colle
-- une URL quand on lui demande sa photo — on choisit un fichier. Le champ était
-- donc inutilisable en pratique, et mesuré : `photo_url` est renseigné sur
-- 0 des contacts du compte de test.
--
-- Le motif invoqué pour ne pas faire mieux était qu'aucun seau n'accueillait le
-- portail entreprise. C'est une raison d'en créer un, pas de servir un champ
-- d'URL. Celui-ci est le pendant exact de `documents-talent`
-- (20260913170000) : mêmes principes, une seule différence de règle.
--
-- ─────────────────────────────────────────────────────────────────────────
-- CE QUI CHANGE PAR RAPPORT AU SEAU DU TALENT
-- ─────────────────────────────────────────────────────────────────────────
-- 1. LA CLÉ DE CLOISONNEMENT. `api.mon_contact_client()` et non
--    `api.ma_fiche_talent()`. C'est la même fonction que celle qui filtre
--    `api.mon_compte` et que `api.maj_mon_compte` interroge pour savoir quelle
--    ligne écrire : une seule vérité pour « quelle fiche de contact est la
--    mienne », donc aucune divergence possible entre le droit de corriger son
--    nom et le droit de déposer sa photo.
--
-- 2. UNE SEULE NATURE DE DOCUMENT : `photo`. Le talent dépose trois choses
--    (CV, photo, portfolio) ; un contact client n'en dépose qu'une. La liste
--    blanche du deuxième dossier ne contient donc qu'une valeur. Elle reste
--    une liste blanche : un dossier inattendu naît refusé.
--
-- 3. DEUX MÉGAOCTETS, ET TROIS TYPES D'IMAGE. Le seau du talent plafonne à
--    10 Mo parce qu'il accueille des CV. Ici il n'y a qu'un avatar de 56px de
--    côté : 2 Mo est déjà généreux, et c'est la limite que l'écran annonce.
--    Ni PDF ni Word — ce ne sont pas des images. Ni SVG : un SVG est un
--    document exécutable. Ni HEIC : rien côté navigateur ne saurait l'afficher.
--
-- ⚠ PRIVÉ, COMME L'AUTRE. Un seau public sert ses objets par URL devinable et
-- sans session, pour toujours. Le chemin porte le nom du fichier d'origine, et
-- un fichier de photo s'appelle très souvent du patronyme de la personne. La
-- lecture passe donc par une URL SIGNÉE à durée courte, fabriquée côté serveur
-- par `frontend/lib/stockage.ts`.
--
-- ⚠ AUCUNE POLICY POUR LE CABINET. `service_role` contourne la RLS ; les
-- recruteurs lisent par là, comme pour les documents du talent.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents-entreprise',
  'documents-entreprise',
  false,
  2 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
-- Idempotente : rejouable sur un projet où le seau existerait déjà.
on conflict (id) do update
   set public             = excluded.public,
       file_size_limit    = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

-- ═══════════════════════════════════════════════════════════════════════
-- Les quatre policies. Une par verbe, pour que `using` (ce que je vois) et
-- `with check` (ce que je peux écrire) restent distincts — c'est justement
-- la distinction qui compte sur un seau partagé entre des centaines de
-- contacts clients.
-- ═══════════════════════════════════════════════════════════════════════

drop policy if exists contact_lit_ses_documents      on storage.objects;
drop policy if exists contact_depose_ses_documents   on storage.objects;
drop policy if exists contact_remplace_ses_documents on storage.objects;
drop policy if exists contact_retire_ses_documents   on storage.objects;

create policy contact_lit_ses_documents on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents-entreprise'
    and (storage.foldername(name))[1] = (select api.mon_contact_client())::text
  );

-- ⚠ LE DOSSIER EST CONTRAINT À L'ÉCRITURE AUSSI. Sans `with check`, un compte
-- pourrait déposer un fichier dans le dossier d'un autre contact : il ne le
-- relirait pas, mais il l'aurait écrit — et écrire chez autrui suffit à nuire,
-- ne serait-ce qu'en consommant son quota ou en devançant son propre dépôt.
create policy contact_depose_ses_documents on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents-entreprise'
    and (storage.foldername(name))[1] = (select api.mon_contact_client())::text
    and (storage.foldername(name))[2] = 'photo'
  );

create policy contact_remplace_ses_documents on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents-entreprise'
    and (storage.foldername(name))[1] = (select api.mon_contact_client())::text
  )
  with check (
    bucket_id = 'documents-entreprise'
    and (storage.foldername(name))[1] = (select api.mon_contact_client())::text
    and (storage.foldername(name))[2] = 'photo'
  );

create policy contact_retire_ses_documents on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents-entreprise'
    and (storage.foldername(name))[1] = (select api.mon_contact_client())::text
  );

-- ═══════════════════════════════════════════════════════════════════════
-- Contrôle de migration — elle échoue plutôt que de mentir.
-- ═══════════════════════════════════════════════════════════════════════
do $$
declare v_seau integer; v_policies integer;
begin
  select count(*) into v_seau
    from storage.buckets
   where id = 'documents-entreprise'
     and public is false
     and file_size_limit = 2 * 1024 * 1024;
  if v_seau <> 1 then
    raise exception 'le seau documents-entreprise est absent, public, ou mal plafonné';
  end if;

  select count(*) into v_policies
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'storage' and c.relname = 'objects'
     and p.polname like 'contact\_%';
  if v_policies <> 4 then
    raise exception 'attendu 4 policies contact sur storage.objects, trouvé %', v_policies;
  end if;

  -- Les policies du talent doivent être intactes : cette migration ne touche
  -- pas à son seau, et un `drop policy` mal nommé se verrait ici.
  select count(*) into v_policies
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'storage' and c.relname = 'objects'
     and p.polname like 'talent\_%';
  if v_policies <> 4 then
    raise exception 'les 4 policies talent ont été perdues : trouvé %', v_policies;
  end if;
end $$;
