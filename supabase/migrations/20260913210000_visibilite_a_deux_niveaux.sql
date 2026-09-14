-- ═══════════════════════════════════════════════════════════════════════════
-- La visibilité d'un mandat n'a plus que deux niveaux : privé, ou public.
--
-- Décision du commanditaire : « nous n'avons gardé que private et public, les
-- talent_only sont considérés comme private ; ceux qui sont affichés dans le
-- job board public sont des publics. »
--
-- ── CE QUE LA MESURE DIT, AVANT D'ÉCRIRE ───────────────────────────────
--   core.mandat, 533 lignes
--     private      496
--     public        34
--     talent_only    2      ← à replier sur « private »
--     NULL           1      ← un troisième état de fait, non déclaré
--
--   app.mandat_publication, 36 lignes
--     job_board_public  34, dont 12 VIVANTES (retire_le nul)
--     espace_talent      2, dont  0 vivante — le canal est déjà mort
--
--   Croisement : les 12 publications vivantes portent toutes sur un mandat
--   « public ». 22 mandats « public » n'ont aucune publication vivante, ce qui
--   est légitime : l'intention de publier n'est pas l'acte de publier.
--
-- La règle est donc DÉJÀ VRAIE dans les faits. Cette migration l'inscrit, pour
-- qu'elle ne puisse plus cesser de l'être.
--
-- ── LES DEUX OBJETS NE DISENT PAS LA MÊME CHOSE, ET C'EST VOULU ────────
-- `core.mandat.visibilite` est l'INTENTION : ce que le cabinet veut pour ce
-- mandat. `app.mandat_publication` est l'ACTE : une ligne, une date, un auteur.
-- Le miroir confondait les deux et le payait — 24 combinaisons de quatre
-- drapeaux gouvernaient l'exposition, dont 15 mandats publics ET clos.
--
-- Les garder distincts n'est tenable qu'à une condition : qu'ils ne puissent
-- pas se contredire dans le sens dangereux. Une offre EN LIGNE sur un mandat
-- déclaré privé, ce serait le défaut de 2024 qui revient. D'où le déclencheur
-- ci-dessous. L'inverse — « public » sans publication vivante — reste permis :
-- c'est une intention qui n'a pas encore été exécutée, ou une offre retirée.
--
-- ⚠ ON NE SUPPRIME PAS LES DEUX LIGNES `espace_talent`. Elles sont retirées, et
-- elles portent la trace d'une publication qui a eu lieu. Le commentaire de la
-- table le dit déjà pour les suppressions en cascade : la ligne porte de la
-- saisie manuelle et une date. On ferme le canal aux publications VIVANTES,
-- on ne réécrit pas l'histoire.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Replier les deux « talent_only », et le NULL ─────────────────────
-- Le NULL n'est pas un troisième niveau, c'est une valeur jamais déclarée à la
-- reprise. Sous un modèle à deux niveaux il ne peut que valoir « privé » : la
-- posture du projet est le refus par défaut, et cette colonne n'ouvre rien
-- qu'elle ne déclare.
update core.mandat set visibilite = 'private'
 where visibilite = 'talent_only' or visibilite is null;

-- ── 2. Le type n'a plus que deux valeurs ────────────────────────────────
-- PostgreSQL ne sait pas retirer une valeur d'un enum : on recrée le type et
-- on y bascule la colonne. Aucune vue ni fonction ne dépend de ce type — seule
-- `core.mandat.visibilite` l'emploie, vérifié sur l'ensemble des migrations.
alter type ref.visibilite_mandat rename to visibilite_mandat_ancien;
create type ref.visibilite_mandat as enum ('private','public');

alter table core.mandat
  alter column visibilite drop default,
  alter column visibilite type ref.visibilite_mandat
        using visibilite::text::ref.visibilite_mandat;

drop type ref.visibilite_mandat_ancien;

-- Deux niveaux, et pas de troisième par l'absence de valeur.
alter table core.mandat
  alter column visibilite set default 'private',
  alter column visibilite set not null;

comment on column core.mandat.visibilite is
  'L''INTENTION : ce que le cabinet veut pour ce mandat. Deux niveaux depuis le 13/09/2026 — « private » (rien n''est exposé) et « public » (l''offre a vocation à paraître sur le job board). Ce n''est PAS ce qui met une offre en ligne : l''acte est une ligne vivante dans app.mandat_publication. Le troisième niveau « talent_only » a été replié sur « private », son canal n''ayant jamais été lu par aucune vue.';

-- ── 3. Le libellé du niveau disparu sort des listes ─────────────────────
-- Désactivé et non supprimé : des écrans d'historique peuvent encore vouloir
-- traduire la valeur qu'une archive porte.
update ref.libelle
   set actif = false
 where domaine = 'visibilite_mandat' and code = 'talent_only';

-- ── 4. Le garde-fou : une offre en ligne est sur un mandat public ───────
-- Un CHECK ne sait pas traverser deux tables. Un déclencheur CONSTRAINT, si —
-- et il s'applique à toute écriture, quelle qu'en soit l'origine, ce qui est
-- exactement la doctrine du projet : une règle dans le code applicatif se
-- contourne en modifiant le code.
create or replace function app.publication_exige_mandat_public() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_vis text;
begin
  if new.retire_le is not null then return new; end if;   -- une retirée n'expose rien
  select m.visibilite::text into v_vis from core.mandat m where m.id = new.mandat_id;
  if v_vis is distinct from 'public' then
    raise exception
      'publication vivante refusée : le mandat % est « % », pas « public »', new.mandat_id, coalesce(v_vis, 'non déclaré')
      using errcode = '23514',
            hint = 'Déclarez le mandat public avant de publier l''offre : l''intention précède l''acte.';
  end if;
  return new;
end $$;

comment on function app.publication_exige_mandat_public() is
  'Interdit qu''une offre soit EN LIGNE sur un mandat qui ne se déclare pas public. Le sens inverse reste permis : un mandat public sans publication vivante est une intention non exécutée, ou une offre retirée.';

drop trigger if exists publication_exige_mandat_public on app.mandat_publication;
create constraint trigger publication_exige_mandat_public
  after insert or update of mandat_id, retire_le on app.mandat_publication
  deferrable initially immediate
  for each row execute function app.publication_exige_mandat_public();

-- ── 5. On vérifie ce qu'on vient d'écrire ───────────────────────────────
do $$
declare v_restant int; v_nul int; v_contradiction int; v_valeurs int;
begin
  select count(*) into v_nul from core.mandat where visibilite is null;
  select count(*) into v_valeurs from pg_enum e
    join pg_type t on t.oid = e.enumtypid
   where t.typname = 'visibilite_mandat';
  select count(*) into v_contradiction
    from app.mandat_publication p join core.mandat m on m.id = p.mandat_id
   where p.retire_le is null and m.visibilite <> 'public';
  select count(*) into v_restant
    from app.mandat_publication where retire_le is null and canal <> 'job_board_public';

  if v_nul > 0 then raise exception 'il reste % mandat(s) sans visibilité', v_nul; end if;
  if v_valeurs <> 2 then raise exception 'le type porte % valeurs, pas 2', v_valeurs; end if;
  if v_contradiction > 0 then
    raise exception '% publication(s) vivante(s) sur un mandat non public', v_contradiction;
  end if;
  if v_restant > 0 then
    raise exception '% publication(s) vivante(s) hors du job board public', v_restant;
  end if;
  raise notice 'visibilité à deux niveaux : type à 2 valeurs, 0 mandat sans visibilité, 0 contradiction.';
end $$;
