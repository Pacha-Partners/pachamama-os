-- ═══════════════════════════════════════════════════════════════════════════
-- Pourquoi on perd un candidat : un référentiel, pas un texte libre.
--
-- 6 285 candidatures sur 7 236 sont en KO et aucune colonne ne dit pourquoi.
-- `core.candidature.motif_ko_code` est un `text` sans référentiel ni clé
-- étrangère ; le commentaire de la migration d'origine dit lui-même « à créer ».
-- L'ADR 0002 impose des motifs structurés et journalisés : le Chasseur s'en
-- nourrira, et un texte libre ne se compte pas.
--
-- Les 6 285 KO historiques restent SANS motif. La donnée n'existe pas ;
-- l'inventer serait pire que l'absence. Décision D-05.
-- ═══════════════════════════════════════════════════════════════════════════

create table ref.motif_ko (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  libelle_fr text not null,
  libelle_en text,
  -- Aligné sur les trois étapes de perte déjà présentes au référentiel :
  -- ko_by_pachamama, ko_by_client, ko_by_candidat.
  categorie  text not null check (categorie in ('pachamama','client','candidat')),
  actif      boolean not null default true,
  ordre      integer not null,
  cree_le    timestamptz not null default now(),
  maj_le     timestamptz not null default now(),
  unique (ordre)
);

comment on table ref.motif_ko is
  'Pourquoi une candidature s''arrête. Ouvert : un vocabulaire métier grandit — ref.metier l''a montré (238 entrées).';

insert into ref.motif_ko (code, libelle_fr, categorie, ordre) values
  -- Le cabinet écarte
  ('competences_insuffisantes', 'Compétences insuffisantes',            'pachamama',  1),
  ('seniorite_inadaptee',       'Séniorité inadaptée au poste',         'pachamama',  2),
  ('pretentions_hors_budget',   'Prétentions hors budget',              'pachamama',  3),
  ('localisation_incompatible', 'Localisation ou remote incompatibles', 'pachamama',  4),
  ('disponibilite_trop_lointaine','Disponibilité trop lointaine',       'pachamama',  5),
  ('sans_reponse',              'Sans réponse après relances',          'pachamama',  6),
  ('doublon_process',           'Déjà en process sur un autre mandat',  'pachamama',  7),
  -- Le client écarte
  ('client_competences',        'Compétences jugées insuffisantes',     'client',    10),
  ('client_seniorite',          'Séniorité jugée inadaptée',            'client',    11),
  ('client_culture',            'Adéquation culturelle',                'client',    12),
  ('client_remuneration',       'Désaccord sur la rémunération',        'client',    13),
  ('client_profil_prefere',     'Un autre profil a été préféré',        'client',    14),
  ('client_poste_pourvu',       'Poste pourvu autrement',               'client',    15),
  ('client_poste_annule',       'Poste annulé ou gelé',                 'client',    16),
  -- Le candidat se retire
  ('candidat_contre_offre',     'Contre-offre de son employeur',        'candidat',  20),
  ('candidat_autre_offre',      'A accepté une autre offre',            'candidat',  21),
  ('candidat_remuneration',     'Rémunération insuffisante',            'candidat',  22),
  ('candidat_projet',           'Projet ou missions peu attractifs',    'candidat',  23),
  ('candidat_localisation',     'Localisation ou remote',               'candidat',  24),
  ('candidat_renonce',          'Renonce à changer de poste',           'candidat',  25),
  ('candidat_injoignable',      'Devenu injoignable',                   'candidat',  26);

-- ── La clé étrangère. `motif_ko_code` porte déjà le bon type (text) et est
-- vide sur les 7 236 lignes : la contrainte peut être posée VALIDÉE sans
-- risque, il n'y a rien à valider. On le vérifie plutôt que de le supposer.
do $$
declare n integer;
begin
  select count(*) into n from core.candidature where motif_ko_code is not null;
  if n <> 0 then
    raise exception 'motif_ko_code renseigné sur % lignes : vérifier les codes avant de poser la FK', n;
  end if;
end $$;

alter table core.candidature
  add constraint candidature_motif_ko_fk
  foreign key (motif_ko_code) references ref.motif_ko (code)
  on update cascade on delete restrict;

comment on column core.candidature.motif_ko_code is
  'Référence ref.motif_ko.code. Vide sur les 6 285 KO historiques : le motif n''a jamais été saisi et ne se devine pas.';

-- Le vocabulaire se lit comme les autres référentiels.
alter table ref.motif_ko enable row level security;
create policy lecture_vocabulaire on ref.motif_ko for select to anon, authenticated using (true);
grant select on ref.motif_ko to anon, authenticated;

create trigger motif_ko_maj_le before update on ref.motif_ko
  for each row execute function ref.touche_maj_le();
