-- =====================================================================
-- Pachamama OS — Le pivot vivant : journal des conflits et état de sync
-- Claude Menye · août 2026 · migration 03
-- =====================================================================
-- Cette migration rend le pivot capable de s'alimenter en continu. Elle
-- n'ajoute aucune donnée métier : elle ajoute ce qui permet de savoir ce
-- que l'alimentation a fait, et de reprendre là où elle s'est arrêtée.
--
-- Elle est REJOUABLE : un second passage ne casse rien et ne duplique
-- rien.
--
-- POURQUOI CES DEUX TABLES AVANT LE CONNECTEUR
-- Une synchronisation continue produit des conflits en continu et échoue
-- tôt ou tard. Sans journal, on ne saurait ni ce qui a été écarté, ni si
-- le moteur se comporte comme prévu ; sans état, un run interrompu
-- repartirait de zéro ou, pire, sauterait des enregistrements. Ce sont
-- les instruments de mesure du chantier : ils doivent exister avant ce
-- qu'ils mesurent.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. pivot.conflit — le journal des valeurs écartées
-- ---------------------------------------------------------------------
-- La tâche 3 exige que la politique de conflit tranche « de façon définie
-- ET JOURNALISÉE ». Elle tranche : la matrice de préséance est
-- déterministe. Elle ne journalisait pas : la valeur perdante était
-- simplement abandonnée. On savait donc d'où venait chaque valeur retenue
-- — les colonnes `*_src` le portent — mais pas ce qui avait été écarté.
--
-- Le glossaire de la note d'architecture définit d'ailleurs la provenance
-- par champ comme incluant « la valeur écartée ». Cette table complète la
-- promesse.
--
-- C'est un JOURNAL, pas un état : on n'y met jamais à jour une ligne, on
-- en ajoute. Un conflit est un événement daté ; le réécrire effacerait
-- l'histoire qu'il sert à conserver.
CREATE TABLE IF NOT EXISTS pivot.conflit (
  conflit_id      bigserial PRIMARY KEY,

  -- CASCADE, et c'est une décision de conformité avant d'être une décision
  -- d'intégrité. Ce journal porte des DONNÉES PERSONNELLES : les valeurs
  -- retenues et écartées sont des noms, des employeurs, des localisations.
  -- Un talent effacé doit donc emporter ses conflits, sinon le droit à
  -- l'effacement laisserait derrière lui un journal qui le décrit encore.
  talent_id       text NOT NULL REFERENCES pivot.talent(talent_id) ON DELETE CASCADE,
  champ           text NOT NULL,

  valeur_retenue  text,
  source_retenue  text NOT NULL,
  valeur_ecartee  text,
  source_ecartee  text NOT NULL,

  -- La règle qui a tranché. Rendre la règle explicite permet de mesurer
  -- son usage réel : si « concurrence » domine, c'est que les sources se
  -- marchent dessus et que le problème est en amont, pas dans l'arbitrage.
  regle           text NOT NULL
                  CHECK (regle IN ('matrice','R1','R2','concurrence','coexistence')),

  -- Le run qui a produit ce conflit : sans lui, impossible de distinguer
  -- un conflit isolé d'une régression introduite par un déploiement.
  run_id          text,
  vu_le           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE pivot.conflit IS
  'Journal append-only des valeurs écartées par la préséance. Complète les '
  'colonnes *_src : celles-ci disent d''où vient ce qui est retenu, celle-ci '
  'dit ce qui a été écarté et par quelle règle.';

-- Les trois axes de lecture réels : l'historique d'un talent, la santé
-- d'un champ, et le bilan d'un run.
CREATE INDEX IF NOT EXISTS conflit_talent_idx ON pivot.conflit (talent_id, vu_le DESC);
CREATE INDEX IF NOT EXISTS conflit_champ_idx  ON pivot.conflit (champ, vu_le DESC);
CREATE INDEX IF NOT EXISTS conflit_run_idx    ON pivot.conflit (run_id);

-- ---------------------------------------------------------------------
-- 2. pivot.sync_etat — le curseur, une ligne par source
-- ---------------------------------------------------------------------
-- Quatre règles sont encodées ici, chacune payée par un incident réel de
-- ce projet. Elles sont écrites dans les commentaires des colonnes parce
-- qu'un curseur mal manipulé ne produit pas d'erreur : il produit une
-- perte silencieuse, et c'est précisément ce qui est arrivé.
CREATE TABLE IF NOT EXISTS pivot.sync_etat (
  source              text PRIMARY KEY CHECK (source IN ('app','ats')),

  -- RÈGLE 1 — ne jamais avancer ce curseur sur exception. L'avancer à
  -- « maintenant » alors que rien n'a été ingéré rend tous les
  -- enregistrements antérieurs structurellement inatteignables par
  -- l'incrémental. C'est ce qui a coûté 396 enregistrements au miroir.
  --
  -- RÈGLE 2 — le reculer d'une milliseconde sur les chemins de succès.
  -- La comparaison stricte « > curseur » exclut l'enregistrement portant
  -- exactement cette date, ainsi que tous ses ex æquo.
  curseur             timestamptz,

  statut              text NOT NULL DEFAULT 'jamais_lance'
                      CHECK (statut IN ('jamais_lance','en_cours','ok','erreur')),

  -- Un statut « en_cours » qui traîne signale un run interrompu : c'est le
  -- seul moyen de distinguer « rien à faire » de « mort en chemin ».
  demarre_le          timestamptz,
  termine_le          timestamptz,

  message_erreur      text,
  volume_dernier_run  integer,
  runs_total          bigint NOT NULL DEFAULT 0
);

COMMENT ON TABLE pivot.sync_etat IS
  'Curseur d''alimentation par source. Le curseur n''avance JAMAIS sur '
  'exception : une perte de synchronisation est silencieuse, donc le sens '
  'sûr de la défaillance est de ne pas progresser.';

INSERT INTO pivot.sync_etat (source) VALUES ('app'), ('ats')
  ON CONFLICT (source) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. pivot.sync_run — la trace de chaque exécution
-- ---------------------------------------------------------------------
-- Cinq des six incidents de ce projet étaient des défaillances
-- SILENCIEUSES : le système répondait « ok ». Une supervision de
-- disponibilité n'en aurait vu aucune. La supervision retenue porte donc
-- sur des invariants de données — et cette table est ce qui les rend
-- observables dans le temps.
CREATE TABLE IF NOT EXISTS pivot.sync_run (
  run_id          text PRIMARY KEY,
  source          text NOT NULL,
  demarre_le      timestamptz NOT NULL DEFAULT now(),
  termine_le      timestamptz,
  statut          text NOT NULL DEFAULT 'en_cours'
                  CHECK (statut IN ('en_cours','ok','erreur')),

  -- RÈGLE 3 — le total annoncé par la source est lu AVANT de commencer,
  -- et comparé au total réellement lu. Une condition d'arrêt confiante
  -- (« page incomplète, on sort ») avait fait écrire 13 073
  -- enregistrements au lieu de 19 381, sans lever la moindre erreur.
  attendus        integer,
  lus             integer NOT NULL DEFAULT 0,

  talents_crees   integer NOT NULL DEFAULT 0,
  talents_majs    integer NOT NULL DEFAULT 0,
  conflits        integer NOT NULL DEFAULT 0,

  curseur_avant   timestamptz,
  curseur_apres   timestamptz,
  message         text
);

COMMENT ON TABLE pivot.sync_run IS
  'Une ligne par exécution. Un run qui lit moins que le total annoncé est '
  'un run en erreur, même s''il n''a levé aucune exception.';

CREATE INDEX IF NOT EXISTS sync_run_source_idx ON pivot.sync_run (source, demarre_le DESC);

-- ---------------------------------------------------------------------
-- 4. Sécurité — même régime que le reste du schéma
-- ---------------------------------------------------------------------
-- RLS active, AUCUNE policy : refus par défaut pour tout rôle applicatif.
-- Seul service_role, qui contourne la RLS, accède à ces tables. Le
-- ALTER DEFAULT PRIVILEGES posé en migration 01 couvre déjà les droits
-- de service_role sur les nouvelles tables ; le retrait pour anon et
-- authenticated, lui, doit être explicite.
ALTER TABLE pivot.conflit   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pivot.sync_etat ENABLE ROW LEVEL SECURITY;
ALTER TABLE pivot.sync_run  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON pivot.conflit, pivot.sync_etat, pivot.sync_run FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA pivot FROM %I', r);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON pivot.conflit, pivot.sync_etat, pivot.sync_run TO service_role';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pivot TO service_role';
  END IF;
END $$;

COMMIT;

-- Recharge le cache de schéma de l'API REST, pour que les nouvelles
-- tables soient visibles sans attendre.
NOTIFY pgrst, 'reload schema';
