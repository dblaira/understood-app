-- Presentation interceptor: cognitive traits → format rules (graph-shaped rows)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS presentation_constraints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trait_key text NOT NULL,
  trait_label text NOT NULL,
  relation text NOT NULL CHECK (relation IN ('requires_format', 'forbids_element')),
  target text NOT NULL,
  target_label text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, trait_key, relation, target)
);

CREATE INDEX IF NOT EXISTS idx_presentation_constraints_user
  ON presentation_constraints(user_id, enabled);

ALTER TABLE presentation_constraints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presentation_constraints_select_own" ON presentation_constraints;
CREATE POLICY "presentation_constraints_select_own"
  ON presentation_constraints FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "presentation_constraints_insert_own" ON presentation_constraints;
CREATE POLICY "presentation_constraints_insert_own"
  ON presentation_constraints FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "presentation_constraints_update_own" ON presentation_constraints;
CREATE POLICY "presentation_constraints_update_own"
  ON presentation_constraints FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "presentation_constraints_delete_own" ON presentation_constraints;
CREATE POLICY "presentation_constraints_delete_own"
  ON presentation_constraints FOR DELETE
  USING (auth.uid() = user_id);
