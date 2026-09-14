-- ═══════════════════════════════════════════════════════════════════════════
-- Donner au client un moyen de désigner un candidat sans le nommer.
--
-- `core.candidature.reference_pseudonyme` existe depuis la reprise et est NULL
-- sur les 7 236 lignes : aucune migration, aucun script ne l'écrit. La seule
-- occurrence hors DDL est sa projection dans `api.candidature_client` — le
-- client lit donc une colonne vide, et ne peut désigner personne.
--
-- Forme retenue : une numérotation PAR MANDAT, « #001 », « #002 »…
--   · lisible et citable au téléphone, contrairement à un fragment d'uuid ;
--   · repart à 1 sur chaque mandat, donc deux clients ne peuvent pas recouper
--     leurs listes pour deviner qu'il s'agit de la même personne ;
--   · stable, parce qu'elle est calculée une fois puis stockée.
-- Décision D-03 du journal.
--
-- ── L'unicité était GLOBALE, et ne pouvait pas l'être ───────────────────
-- `candidature_pseudo_unique` était un index unique partiel sur la colonne
-- entière. Il a été écrit quand la colonne était vide et n'a jamais été
-- éprouvé : la première tentative de peuplement l'a fait sauter sur « #001 ».
--
-- Une numérotation globale forcerait « #4271 », qui ne se cite pas, et qui
-- révélerait au passage la taille du vivier et l'ancienneté relative d'un
-- candidat. Un pseudonyme n'a de sens que dans le périmètre où il est employé :
-- le mandat. C'est ce qui en fait un pseudonyme et non un identifiant.
--
-- ⚠ L'ordre compte, et je m'y suis repris à deux fois : l'index unique ne peut
-- être créé qu'APRÈS le remplissage. Posé avant, la clause `nulls not distinct`
-- fait collisionner les 7 236 lignes encore vides entre elles.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Libérer la contrainte globale, qui interdirait le remplissage.
drop index if exists core.candidature_pseudo_unique;

-- ── 2. L'historique. L'ordre d'attribution suit l'entrée en pipeline, et
-- départage par identifiant : sans ce départage, deux candidatures entrées le
-- même jour changeraient de numéro d'un rejeu à l'autre.
with numerotees as (
  select id,
         row_number() over (
           partition by mandat_id
           order by date_entree_pipeline asc nulls last, id asc
         ) as rang
  from core.candidature
)
update core.candidature c
   set reference_pseudonyme = '#' || lpad(n.rang::text, 3, '0')
  from numerotees n
 where n.id = c.id
   and c.reference_pseudonyme is null;

-- ── 3. Le verrou. La colonne ne peut plus être vide : c'est le seul
-- identifiant qu'un client puisse employer.
do $$
declare n integer;
begin
  select count(*) into n from core.candidature where reference_pseudonyme is null;
  if n <> 0 then
    raise exception 'reference_pseudonyme encore NULL sur % lignes', n;
  end if;
end $$;

alter table core.candidature alter column reference_pseudonyme set not null;

-- ── 4. L'unicité, maintenant qu'il y a de la matière à indexer.
-- `nulls not distinct` porte sur `mandat_id` : sans cette clause, deux
-- candidatures sans mandat pourraient porter le même numéro, deux NULL n'étant
-- jamais égaux dans un index unique ordinaire.
create unique index candidature_pseudo_unique
  on core.candidature (mandat_id, reference_pseudonyme) nulls not distinct;

-- ── 5. Pour la suite : le numéro se pose tout seul. Sans ce déclencheur, la
-- colonne redeviendrait NULL dès la première candidature créée par l'app —
-- et le NOT NULL ci-dessus ferait échouer l'insertion.
create or replace function core.attribuer_reference_pseudonyme()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_rang integer;
begin
  if new.reference_pseudonyme is not null then
    return new;
  end if;
  select coalesce(max(substring(reference_pseudonyme from '\d+')::integer), 0) + 1
    into v_rang
    from core.candidature
   where mandat_id is not distinct from new.mandat_id
     and reference_pseudonyme ~ '^#\d+$';
  new.reference_pseudonyme := '#' || lpad(v_rang::text, 3, '0');
  return new;
end;
$$;

-- `create or replace function` réaccorde EXECUTE à PUBLIC : on re-révoque
-- APRÈS. Ce n'est pas une fonction appelable, c'est un déclencheur.
revoke execute on function core.attribuer_reference_pseudonyme() from public, anon, authenticated;

create trigger candidature_reference_pseudonyme
  before insert on core.candidature
  for each row execute function core.attribuer_reference_pseudonyme();

comment on column core.candidature.reference_pseudonyme is
  'Le nom qu''un client donne à un candidat qu''il n''a pas le droit de nommer. Numérotation par mandat, posée par déclencheur, jamais NULL, unique dans son mandat.';
