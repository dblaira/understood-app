-- Ontology layer: life domains on entries, axioms, inferred insights, weekly summary view
-- Run in Supabase SQL Editor (matches repo pattern of root *.sql migrations)

-- -----------------------------------------------------------------------------
-- 1. Enum type for analytic life domains (distinct from sidebar "life area" labels)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE life_domain AS ENUM (
    'Exercise',
    'Sleep',
    'Nutrition',
    'Ambition',
    'Health',
    'Work',
    'Social',
    'Learning',
    'Purchase',
    'Belief',
    'Affect',
    'Insight',
    'Entertainment'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ontology_axiom_status AS ENUM (
    'candidate',
    'confirmed',
    'rejected',
    'retired'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ontology_axiom_scope AS ENUM (
    'personal',
    'starter_hypothesis',
    'demo'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ontology_relationship_type AS ENUM (
    'supports',
    'predicts',
    'conflicts_with',
    'follows',
    'amplifies',
    'inhibits',
    'correlates_with'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 2. entries.life_domains
-- -----------------------------------------------------------------------------
ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS life_domains life_domain[] NOT NULL DEFAULT '{}'::life_domain[];

-- -----------------------------------------------------------------------------
-- 3. ontology_axioms — global rows use user_id IS NULL; personal rows set user_id
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ontology_axioms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  antecedent TEXT NOT NULL,
  consequent TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  status ontology_axiom_status NOT NULL DEFAULT 'candidate',
  scope ontology_axiom_scope NOT NULL DEFAULT 'personal',
  relationship_type ontology_relationship_type NOT NULL DEFAULT 'predicts',
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_entry_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  evidence_count INTEGER NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  sources TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ
);

ALTER TABLE ontology_axioms
  ADD COLUMN IF NOT EXISTS status ontology_axiom_status NOT NULL DEFAULT 'candidate',
  ADD COLUMN IF NOT EXISTS scope ontology_axiom_scope NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS relationship_type ontology_relationship_type NOT NULL DEFAULT 'predicts',
  ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_entry_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS evidence_count INTEGER NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ontology_axioms_user_id ON ontology_axioms(user_id);
CREATE INDEX IF NOT EXISTS idx_ontology_axioms_user_status ON ontology_axioms(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ontology_axioms_scope_status ON ontology_axioms(scope, status) WHERE user_id IS NULL;

ALTER TABLE ontology_axioms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ontology_axioms_select_own_or_global" ON ontology_axioms;
CREATE POLICY "ontology_axioms_select_own_or_global"
  ON ontology_axioms FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    OR (user_id IS NULL AND scope = 'starter_hypothesis')
  );

DROP POLICY IF EXISTS "ontology_axioms_insert_own" ON ontology_axioms;
CREATE POLICY "ontology_axioms_insert_own"
  ON ontology_axioms FOR INSERT
  WITH CHECK (
    user_id IS NOT NULL
    AND (SELECT auth.uid()) = user_id
    AND scope = 'personal'
  );

DROP POLICY IF EXISTS "ontology_axioms_update_own" ON ontology_axioms;
CREATE POLICY "ontology_axioms_update_own"
  ON ontology_axioms FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND scope = 'personal'
  );

DROP POLICY IF EXISTS "ontology_axioms_delete_own" ON ontology_axioms;
CREATE POLICY "ontology_axioms_delete_own"
  ON ontology_axioms FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- 4. inferred_insights — tied to an entry (user scope via entries RLS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inferred_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  insight_text TEXT NOT NULL,
  related_axioms UUID[],
  confidence NUMERIC(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inferred_insights_entry_id ON inferred_insights(entry_id);

ALTER TABLE inferred_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inferred_insights_select_via_entry" ON inferred_insights;
CREATE POLICY "inferred_insights_select_via_entry"
  ON inferred_insights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM entries e
      WHERE e.id = inferred_insights.entry_id
        AND e.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "inferred_insights_insert_via_entry" ON inferred_insights;
CREATE POLICY "inferred_insights_insert_via_entry"
  ON inferred_insights FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entries e
      WHERE e.id = inferred_insights.entry_id
        AND e.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "inferred_insights_update_via_entry" ON inferred_insights;
CREATE POLICY "inferred_insights_update_via_entry"
  ON inferred_insights FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM entries e
      WHERE e.id = inferred_insights.entry_id
        AND e.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entries e
      WHERE e.id = inferred_insights.entry_id
        AND e.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "inferred_insights_delete_via_entry" ON inferred_insights;
CREATE POLICY "inferred_insights_delete_via_entry"
  ON inferred_insights FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM entries e
      WHERE e.id = inferred_insights.entry_id
        AND e.user_id = (SELECT auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- 5. Weekly summary per user (regular view; RLS on entries applies when queried)
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS weekly_ontology_summary;
CREATE VIEW weekly_ontology_summary
WITH (security_invoker = true)
AS
SELECT
  e.user_id,
  (date_trunc('week', e.created_at AT TIME ZONE 'UTC'))::date AS week_start,
  COUNT(DISTINCT e.id)::bigint AS entry_count,
  COALESCE(
    ARRAY_AGG(DISTINCT d) FILTER (WHERE d IS NOT NULL),
    '{}'::life_domain[]
  ) AS active_domains
FROM entries e
LEFT JOIN LATERAL unnest(COALESCE(e.life_domains, '{}'::life_domain[])) AS d ON TRUE
GROUP BY e.user_id, (date_trunc('week', e.created_at AT TIME ZONE 'UTC'))::date;

-- -----------------------------------------------------------------------------
-- 6. Seed Adam demo axioms (user_id NULL + scope demo).
-- These are proof/benchmark rows, not starter truths for other users.
-- -----------------------------------------------------------------------------
INSERT INTO ontology_axioms (user_id, name, description, antecedent, consequent, confidence, status, scope, relationship_type, provenance, evidence_count, sources, confirmed_at)
SELECT NULL, 'Learning Master Key', 'Learning strongly predicts positive affect, ambition, and insight', 'High Learning', '↑ Affect (67%), ↑ Ambition (65%), ↑ Insight (62%)', 0.67, 'confirmed', 'demo', 'predicts', '{"corpus":"adam_example","purpose":"benchmark"}'::jsonb, 8069, ARRAY['journal', 'youtube']::TEXT[], NOW()
WHERE NOT EXISTS (SELECT 1 FROM ontology_axioms o WHERE o.user_id IS NULL AND o.name = 'Learning Master Key');

INSERT INTO ontology_axioms (user_id, name, description, antecedent, consequent, confidence, status, scope, relationship_type, provenance, evidence_count, sources, confirmed_at)
SELECT NULL, 'Exercise-Sleep Synergy', 'High exercise combined with high sleep creates excellent stress recovery', 'High Exercise + High Sleep', 'StressRecoveryPattern_Excellent', 0.57, 'confirmed', 'demo', 'predicts', '{"corpus":"adam_example","purpose":"benchmark"}'::jsonb, 8069, ARRAY['apple_health', 'journal']::TEXT[], NOW()
WHERE NOT EXISTS (SELECT 1 FROM ontology_axioms o WHERE o.user_id IS NULL AND o.name = 'Exercise-Sleep Synergy');

INSERT INTO ontology_axioms (user_id, name, description, antecedent, consequent, confidence, status, scope, relationship_type, provenance, evidence_count, sources, confirmed_at)
SELECT NULL, 'Belief to Entertainment Lag', 'High belief activity predicts higher entertainment two weeks later', 'High Belief week N', '↑ Entertainment week N+2', 0.60, 'confirmed', 'demo', 'predicts', '{"corpus":"adam_example","purpose":"benchmark"}'::jsonb, 8069, ARRAY['journal']::TEXT[], NOW()
WHERE NOT EXISTS (SELECT 1 FROM ontology_axioms o WHERE o.user_id IS NULL AND o.name = 'Belief to Entertainment Lag');

INSERT INTO ontology_axioms (user_id, name, description, antecedent, consequent, confidence, status, scope, relationship_type, provenance, evidence_count, sources, confirmed_at)
SELECT NULL, 'Zero Negative Impact', 'No life domain shows strong negative correlation with any other', 'Any Domain High', 'No Strong Negative Impact on Other Domains', 0.95, 'confirmed', 'demo', 'conflicts_with', '{"corpus":"adam_example","purpose":"benchmark"}'::jsonb, 8069, ARRAY['all_sources']::TEXT[], NOW()
WHERE NOT EXISTS (SELECT 1 FROM ontology_axioms o WHERE o.user_id IS NULL AND o.name = 'Zero Negative Impact');

UPDATE ontology_axioms
SET
  status = 'confirmed',
  scope = 'demo',
  provenance = provenance || '{"corpus":"adam_example","purpose":"benchmark"}'::jsonb,
  confirmed_at = COALESCE(confirmed_at, created_at)
WHERE user_id IS NULL
  AND name IN ('Learning Master Key', 'Exercise-Sleep Synergy', 'Belief to Entertainment Lag', 'Zero Negative Impact');

-- -----------------------------------------------------------------------------
-- 7. Knowledge graph migration path
-- -----------------------------------------------------------------------------
-- The current product stores ontology facts as reviewed axioms. A later graph store
-- can project confirmed personal rows into deterministic nodes and edges:
--   concept:{slug(antecedent)} -[relationship_type, confidence, axiom_id]-> concept:{slug(consequent)}
-- Keep `evidence_entry_ids`, `evidence_count`, and `provenance` populated so Neo4j,
-- RDF/OWL, or GraphRAG exports can preserve traceability back to entries.
