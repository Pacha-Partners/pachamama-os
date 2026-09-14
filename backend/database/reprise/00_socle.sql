-- =====================================================================
-- REPRISE — LE SOCLE
--
-- Trois outils, et une décision de conception qui commande tout le reste.
--
-- L'IDENTIFIANT. Un identifiant Bubble devient un uuid par un calcul
-- DÉTERMINISTE (uuid v5), et non par tirage aléatoire suivi d'une table
-- de correspondance. Conséquences, et c'est pour elles que ce choix est
-- fait :
--   · la reprise est REJOUABLE — la relancer produit le même résultat ;
--   · elle est PARTIELLE — on peut recharger une table seule, ses clés
--     étrangères se recalculent et retombent juste ;
--   · aucune table de correspondance à maintenir vivante, donc un point
--     de fragilité en moins.
--
-- LE CONTRÔLE. Chaque étape écrit ce qu'elle attendait, ce qu'elle a
-- inséré et ce qu'elle a écarté. Sans ce rapprochement, « la reprise a
-- réussi » ne veut rien dire.
--
-- LA QUARANTAINE. Une ligne que le modèle refuse n'arrête pas la reprise :
-- elle est mise de côté AVEC SON MOTIF. Sur 60 000 lignes, s'arrêter au
-- premier rejet est impraticable ; mais une quarantaine qu'on ne regarde
-- pas revient à perdre en silence, d'où le contrôle ci-dessus.
-- =====================================================================

create schema if not exists reprise;
comment on schema reprise is
  'Machinerie de migration Bubble → modèle cible. Destinée à être SUPPRIMÉE après la coupure : elle ne fait pas partie du modèle.';

-- ---------------------------------------------------------------------

create or replace function reprise.uid(bubble_id text) returns uuid
language sql immutable strict parallel safe as $$
  select extensions.uuid_generate_v5(
           extensions.uuid_ns_url(),
           'https://pachamama.pm/bubble/' || bubble_id);
$$;
comment on function reprise.uid(text) is
  'Un identifiant Bubble donne toujours le même uuid. C''est ce qui rend la reprise rejouable et partielle.';

-- ---------------------------------------------------------------------

create table if not exists reprise.controle (
  id        bigint generated always as identity primary key,
  etape     text        not null,
  cible     text        not null,
  attendu   bigint,
  insere    bigint,
  ecarte    bigint      not null default 0,
  motif     text,
  fait_le   timestamptz not null default now()
);

create table if not exists reprise.quarantaine (
  id        bigint generated always as identity primary key,
  cible     text        not null,
  bubble_id text,
  motif     text        not null,
  donnees   jsonb,
  vu_le     timestamptz not null default now()
);
create index if not exists quarantaine_cible on reprise.quarantaine (cible);

-- ---------------------------------------------------------------------
-- Résoudre un libellé du miroir vers le code cible, via la table de
-- correspondance amorcée. Renvoie NULL si le libellé n'a pas été traduit,
-- ce qui doit rester impossible : le contrôle de non-perte a vérifié que
-- les 60 618 valeurs employées par les données sont toutes traduites.
-- ---------------------------------------------------------------------

create or replace function reprise.code(referentiel text, libelle text) returns text
language sql stable as $$
  select c.code_cible from ref.correspondance c
   where c.referentiel = $1 and c.libelle_miroir = $2;
$$;

create or replace function reprise.noter(
  p_etape text, p_cible text, p_attendu bigint, p_insere bigint,
  p_ecarte bigint default 0, p_motif text default null) returns void
language sql as $$
  insert into reprise.controle (etape, cible, attendu, insere, ecarte, motif)
  values (p_etape, p_cible, p_attendu, p_insere, p_ecarte, p_motif);
$$;

-- ---------------------------------------------------------------------
-- NORMALISATION DES SALAIRES EN K€
--
-- Découvert par la reprise, le 08/09/2026 : le miroir contient encore
-- ~200 salaires exprimés en EUROS, 3 valeurs négatives, et une double
-- conversion (0,065 pour 65 K€).
--
-- Et ce n'est pas un reliquat de l'harmonisation du 01/07 : MESURÉ,
-- 64 des 65 valeurs en euros de job_reve ont été modifiées APRÈS cette
-- date. La source continue d'en produire, et continuera jusqu'à la
-- coupure de Bubble.
--
-- Bornes du raisonnement : ces montants sont des salaires ANNUELS en K€.
-- Au-delà de 1000, il faudrait un salaire d'un million d'euros — c'est
-- donc des euros. En dessous de 1, il faudrait moins de mille euros par
-- an — c'est une double conversion. Un montant négatif n'a aucun sens.
--
-- ⚠ NE JAMAIS APPLIQUER AUX TJM : un taux journalier de 400 à 1 400 €
-- est normal, et la règle du millier le détruirait.
-- ---------------------------------------------------------------------

create or replace function reprise.ke(v numeric) returns numeric
language sql immutable parallel safe as $$
  select case
    when v is null   then null
    when v < 0       then null          -- aberrant, écarté
    when v > 1000    then v / 1000      -- saisi en euros
    when v > 0 and v < 1 then v * 1000  -- double conversion
    else v end;
$$;
comment on function reprise.ke(numeric) is
  'Normalise un salaire ANNUEL en K€. Ne jamais appliquer à un TJM.';
