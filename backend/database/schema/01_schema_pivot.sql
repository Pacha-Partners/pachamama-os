-- =====================================================================
-- Pachamama OS — Base talent unifiée : le schéma « pivot »
-- Projet annuel Bachelor Data & BI · Chef de projet web · RNCP40857
-- Claude Menye · NEXA Digital School Lyon · août 2026
-- =====================================================================
-- Ce script matérialise en PostgreSQL le modèle de données conçu en
-- tâche 2, peuplé par le moteur d'inclusion de la tâche 3 et le dataset
-- réconcilié de la tâche 4 (30 829 enregistrements dorés).
--
-- POURQUOI UN SCHÉMA DÉDIÉ, ET NON UN PRÉFIXE DANS public
-- Le principe verrouillé du projet est une base pivot INDÉPENDANTE. Des
-- tables `pivot_*` posées au milieu des ~104 tables du miroir Bubble
-- n'auraient donné qu'une séparation nominale. Un schéma la rend
-- structurelle : le miroir est la photographie de l'outil actuel, le
-- pivot est la base cible, et les droits, la sauvegarde et la suppression
-- de l'un se pilotent sans jamais toucher l'autre.
--
-- SÉCURITÉ — refus par défaut
-- RLS activée sur les 8 tables, AUCUNE policy créée, et retrait explicite
-- des droits pour anon et authenticated. Conséquence : aucun accès depuis
-- un navigateur. Seul le serveur applicatif, porteur de la clé de service
-- (qui contourne RLS), peut lire. Ce choix vient d'un constat fait sur
-- l'outil actuel : une API laissée ouverte expose l'intégralité du CRM.
--
-- REJOUABLE : le script peut être relancé sans effet de bord (testé).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Schéma et extension
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS pivot;
COMMENT ON SCHEMA pivot IS
  'Base talent unifiée (pivot). Maître de la donnée talent ; Jarvi et l''app en sont les producteurs.';

-- pg_trgm alimente la recherche floue sur les noms. On l'installe là où
-- Supabase range ses extensions si ce schéma existe, sinon dans public —
-- jamais dans `pivot`, qui ne doit contenir que le modèle métier.
DO $$
DECLARE cible text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    SELECT nspname INTO cible FROM pg_namespace
      WHERE nspname IN ('extensions', 'public')
      ORDER BY (nspname = 'extensions') DESC LIMIT 1;
    EXECUTE format('CREATE EXTENSION pg_trgm WITH SCHEMA %I', cible);
  END IF;
END $$;

-- Le search_path nomme les trois emplacements possibles : `gin_trgm_ops`
-- se résout quel que soit le schéma où l'extension a atterri. Un schéma
-- absent du serveur est simplement ignoré.
SET search_path TO pivot, public, extensions;

DROP VIEW  IF EXISTS pivot.talent_recherche CASCADE;
DROP TABLE IF EXISTS pivot.note_journal     CASCADE;
DROP TABLE IF EXISTS pivot.attentes         CASCADE;
DROP TABLE IF EXISTS pivot.qualification    CASCADE;
DROP TABLE IF EXISTS pivot.parcours         CASCADE;
DROP TABLE IF EXISTS pivot.phone            CASCADE;
DROP TABLE IF EXISTS pivot.email            CASCADE;
DROP TABLE IF EXISTS pivot.talent_source    CASCADE;
DROP TABLE IF EXISTS pivot.talent           CASCADE;

-- ---------------------------------------------------------------------
-- 1. pivot.talent — l'enregistrement doré (un par personne)
-- ---------------------------------------------------------------------
-- Les colonnes *_src portent la PROVENANCE : quelle source a remporté
-- l'arbitrage de préséance. C'est le journal de conflit rendu
-- interrogeable — chaque valeur affichée est auditable.
CREATE TABLE pivot.talent (
  talent_id         text PRIMARY KEY,
  type_fusion       text NOT NULL
                    CHECK (type_fusion IN ('merged','jarvi_only','app_only')),
  prenom            text,
  prenom_src        text CHECK (prenom_src IN ('jarvi','app')),
  nom               text,
  nom_src           text CHECK (nom_src IN ('jarvi','app')),
  headline          text,
  localisation      text,
  localisation_src  text CHECK (localisation_src IN ('jarvi','app')),
  url_linkedin      text,
  open_to           text,
  employeur_actuel  text,
  employeur_src     text CHECK (employeur_src IN ('jarvi','app')),
  statut_jarvi      text,
  origine_jarvi     text,
  cv_url            text,
  notes_jarvi       text,
  notes_bloc        text,
  cree_le           timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE  pivot.talent IS 'Enregistrement doré : un par personne, après résolution d''entités.';
COMMENT ON COLUMN pivot.talent.type_fusion IS 'Origine : fusion des deux sources, Jarvi seul, ou app seule.';
COMMENT ON COLUMN pivot.talent.prenom_src  IS 'Source retenue par la règle de préséance pour ce champ.';
COMMENT ON COLUMN pivot.talent.notes_bloc  IS 'Consolidation LLM du journal de notes. Différée : le journal est conservé pour la rendre régénérable.';

-- ---------------------------------------------------------------------
-- 2. pivot.talent_source — traçabilité et matching
-- ---------------------------------------------------------------------
-- Un lien par système d'origine. Un talent peut porter PLUSIEURS liens
-- vers la même source : ce sont les doublons internes collapsés par la
-- clôture transitive. La clé primaire intègre donc l'identifiant externe.
CREATE TABLE pivot.talent_source (
  talent_id   text NOT NULL REFERENCES pivot.talent(talent_id) ON DELETE CASCADE,
  source      text NOT NULL CHECK (source IN ('jarvi','app')),
  external_id text NOT NULL,
  PRIMARY KEY (talent_id, source, external_id)
);
COMMENT ON TABLE pivot.talent_source IS 'Base du matching déterministe et de la réversibilité de la fusion.';

-- ---------------------------------------------------------------------
-- 3. pivot.email / pivot.phone — coordonnées (n par talent)
-- ---------------------------------------------------------------------
CREATE TABLE pivot.email (
  id         bigserial PRIMARY KEY,
  talent_id  text NOT NULL REFERENCES pivot.talent(talent_id) ON DELETE CASCADE,
  email      text NOT NULL,
  source     text NOT NULL CHECK (source IN ('jarvi','app')),
  generique  boolean NOT NULL DEFAULT false,
  UNIQUE (talent_id, email)
);
COMMENT ON COLUMN pivot.email.generique IS
  'Adresse de service (contact@, rh@) : conservée en donnée, mais exclue des clés d''union pour ne pas fusionner deux personnes distinctes.';

CREATE TABLE pivot.phone (
  id         bigserial PRIMARY KEY,
  talent_id  text NOT NULL REFERENCES pivot.talent(talent_id) ON DELETE CASCADE,
  tel        text NOT NULL,
  source     text NOT NULL CHECK (source IN ('jarvi','app')),
  UNIQUE (talent_id, tel)
);

-- ---------------------------------------------------------------------
-- 4. pivot.qualification — les compléments Pacha (1-1)
-- ---------------------------------------------------------------------
CREATE TABLE pivot.qualification (
  talent_id       text PRIMARY KEY REFERENCES pivot.talent(talent_id) ON DELETE CASCADE,
  niveau_qualifie text,
  univers         text,
  anglais         text,
  product         text,
  profil          text,
  seniorite       text,
  background      text,
  expertises      text[],
  secteurs        text[]
);
COMMENT ON TABLE pivot.qualification IS
  'Qualification produite par les recruteurs : ce que l''ATS ne sait pas faire. Le genre est volontairement absent (minimisation RGPD).';

-- ---------------------------------------------------------------------
-- 5. pivot.attentes — le projet du talent (1-1)
-- ---------------------------------------------------------------------
CREATE TABLE pivot.attentes (
  talent_id        text PRIMARY KEY REFERENCES pivot.talent(talent_id) ON DELETE CASCADE,
  metier_vise      text,
  univers_vise     text,
  contrats         text[],
  localisations    text[],
  remotes          text[],
  secteurs         text[],
  nogo             text,
  salaire_min      numeric,
  salaire_souhaite numeric,
  tjm_min          numeric,
  tjm_souhaite     numeric,
  disponibilite    text,
  description      text
);
COMMENT ON COLUMN pivot.attentes.salaire_min IS 'En K€ : 3 264 valeurs harmonisées €→K€ en amont du chargement.';
COMMENT ON COLUMN pivot.attentes.tjm_min     IS 'En euros par jour.';

-- ---------------------------------------------------------------------
-- 6. pivot.parcours — socle de parcours (v1 : export plat Jarvi)
-- ---------------------------------------------------------------------
-- Choix assumé : l'export self-service de Jarvi livre le parcours en
-- texte aplati, sans dates. On le conserve tel quel plutôt que de
-- fabriquer des dates fausses. L'éclatement en position / education /
-- skill datées viendra avec l'API live Jarvi : le modèle le prévoit,
-- aucune réécriture ne sera nécessaire.
CREATE TABLE pivot.parcours (
  talent_id    text PRIMARY KEY REFERENCES pivot.talent(talent_id) ON DELETE CASCADE,
  experience   text,
  formation    text,
  competences  text
);

-- ---------------------------------------------------------------------
-- 7. pivot.note_journal — matière première des notes
-- ---------------------------------------------------------------------
-- Conservée pour que notes_bloc reste RÉGÉNÉRABLE : un bloc dérivé dont
-- on a perdu la source devient irréparable.
CREATE TABLE pivot.note_journal (
  id          bigserial PRIMARY KEY,
  talent_id   text NOT NULL REFERENCES pivot.talent(talent_id) ON DELETE CASCADE,
  contenu     text NOT NULL,
  source      text NOT NULL DEFAULT 'app',
  automatique boolean NOT NULL DEFAULT false,
  date_note   timestamptz,
  external_id text,
  UNIQUE (talent_id, external_id)
);
COMMENT ON COLUMN pivot.note_journal.external_id IS 'Identifiant de la note source : rend le chargement idempotent.';
COMMENT ON COLUMN pivot.note_journal.automatique IS 'Note générée par un automatisme, à distinguer d''une note rédigée par un recruteur.';

-- ---------------------------------------------------------------------
-- 8. Index — dimensionnés sur les axes de recherche réels du sourcing
-- ---------------------------------------------------------------------
-- Recherche par nom : trigram, pour tolérer les fautes de frappe.
CREATE INDEX idx_talent_nom_trgm       ON pivot.talent USING gin (lower(nom) gin_trgm_ops);
CREATE INDEX idx_talent_prenom_trgm    ON pivot.talent USING gin (lower(prenom) gin_trgm_ops);
CREATE INDEX idx_talent_employeur_trgm ON pivot.talent USING gin (lower(employeur_actuel) gin_trgm_ops);
-- Filtres à faible cardinalité : b-tree.
CREATE INDEX idx_talent_type_fusion    ON pivot.talent (type_fusion);
CREATE INDEX idx_talent_localisation   ON pivot.talent (lower(localisation));
CREATE INDEX idx_qualif_univers        ON pivot.qualification (univers);
CREATE INDEX idx_qualif_niveau         ON pivot.qualification (niveau_qualifie);
CREATE INDEX idx_qualif_seniorite      ON pivot.qualification (seniorite);
-- Tableaux : GIN, pour les opérateurs de contenance.
CREATE INDEX idx_qualif_expertises     ON pivot.qualification USING gin (expertises);
CREATE INDEX idx_qualif_secteurs       ON pivot.qualification USING gin (secteurs);
CREATE INDEX idx_attentes_contrats     ON pivot.attentes USING gin (contrats);
-- Fourchettes de rémunération : filtres numériques fréquents.
CREATE INDEX idx_attentes_salaire      ON pivot.attentes (salaire_min);
CREATE INDEX idx_attentes_tjm          ON pivot.attentes (tjm_min);
-- Satellites : accès par talent.
CREATE INDEX idx_email_talent          ON pivot.email (talent_id);
CREATE INDEX idx_phone_talent          ON pivot.phone (talent_id);
CREATE INDEX idx_source_talent         ON pivot.talent_source (talent_id);
CREATE INDEX idx_source_extid          ON pivot.talent_source (source, external_id);
CREATE INDEX idx_note_talent           ON pivot.note_journal (talent_id);

-- ---------------------------------------------------------------------
-- 9. Vue de sourcing — dénormalisation en lecture
-- ---------------------------------------------------------------------
-- Le portail interroge cette vue plutôt que de recomposer quatre
-- jointures à chaque frappe : le coût est payé une fois par requête, pas
-- une fois par composant d'interface.
--
-- ⚠️ security_invoker : SANS cette option, une vue s'exécute avec les
-- droits de son PROPRIÉTAIRE et contourne donc la RLS des tables
-- sous-jacentes. La vue rouvrirait ce que les tables protègent.
CREATE OR REPLACE VIEW pivot.talent_recherche
WITH (security_invoker = true) AS
SELECT
  t.talent_id, t.type_fusion, t.prenom, t.nom, t.headline,
  t.localisation, t.employeur_actuel, t.url_linkedin, t.statut_jarvi,
  (t.cv_url IS NOT NULL)    AS a_cv,
  q.univers, q.niveau_qualifie, q.seniorite, q.anglais,
  q.expertises, q.secteurs,
  a.metier_vise, a.univers_vise, a.contrats,
  a.salaire_min, a.salaire_souhaite, a.tjm_min, a.tjm_souhaite,
  a.disponibilite,
  (q.talent_id IS NOT NULL) AS est_qualifie,
  (a.talent_id IS NOT NULL) AS a_attentes,
  (SELECT count(*) FROM pivot.email e        WHERE e.talent_id = t.talent_id) AS nb_emails,
  (SELECT count(*) FROM pivot.talent_source s WHERE s.talent_id = t.talent_id) AS nb_sources,
  (SELECT count(*) FROM pivot.note_journal n  WHERE n.talent_id = t.talent_id) AS nb_notes
FROM pivot.talent t
LEFT JOIN pivot.qualification q ON q.talent_id = t.talent_id
LEFT JOIN pivot.attentes      a ON a.talent_id = t.talent_id;

COMMENT ON VIEW pivot.talent_recherche IS
  'Vue de sourcing : un talent, sa qualification et ses attentes en une ligne.';

-- ---------------------------------------------------------------------
-- 10. Sécurité — refus par défaut, droits explicites
-- ---------------------------------------------------------------------
ALTER TABLE pivot.talent        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pivot.talent_source ENABLE ROW LEVEL SECURITY;
ALTER TABLE pivot.email         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pivot.phone         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pivot.qualification ENABLE ROW LEVEL SECURITY;
ALTER TABLE pivot.attentes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pivot.parcours      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pivot.note_journal  ENABLE ROW LEVEL SECURITY;
-- Aucune POLICY n'est créée : RLS active sans policy = refus pour tous
-- les rôles applicatifs. Seul service_role contourne RLS.

-- Droits : tout est retiré à anon et authenticated, accordé au seul rôle
-- serveur. Les rôles sont testés avant usage pour que le script tourne
-- aussi hors Supabase. Rien n'est appliqué au schéma public : les ~104
-- tables du miroir ne sont pas concernées.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES    IN SCHEMA pivot FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA pivot FROM %I', r);
      EXECUTE format('REVOKE ALL ON SCHEMA pivot FROM %I', r);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA pivot TO service_role';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pivot TO service_role';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pivot TO service_role';
    -- Les objets créés PLUS TARD dans ce schéma hériteront des mêmes droits.
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA pivot GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA pivot GRANT USAGE, SELECT ON SEQUENCES TO service_role';
  END IF;
END $$;

COMMIT;

-- Demande à l'API REST de recharger son cache de schéma, pour que les
-- nouvelles tables soient visibles sans attendre.
NOTIFY pgrst, 'reload schema';
