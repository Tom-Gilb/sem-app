-- Migration: 002_evo_plans
-- Spec: S.Evo7.EvoPlanPersistence
-- Creates the evo_plans table for persisting confirmed Evo Step Plans.
-- Each workspace stores one confirmed plan at a time (unique on workspace_id).
-- Idempotent: all statements guarded with IF NOT EXISTS / DROP POLICY IF EXISTS.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. evo_plans table
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS evo_plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  spec_block     JSONB,
  plan           JSONB NOT NULL,
  confirmed_at   TIMESTAMPTZ NOT NULL,
  confirmed_by   UUID NOT NULL REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One confirmed plan per workspace — upsert replaces the previous plan
  UNIQUE (workspace_id)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Enable Row-Level Security
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE evo_plans ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. RLS policies
--    SELECT: open to all workspace members (contributors and viewers can read)
--    INSERT/UPDATE: restricted to owner role only
-- ────────────────────────────────────────────────────────────────────────────

-- All workspace members can view the confirmed Evo plan
DROP POLICY IF EXISTS evo_plans_select_members ON evo_plans;
CREATE POLICY evo_plans_select_members ON evo_plans
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Only workspace owners may insert a new confirmed plan
DROP POLICY IF EXISTS evo_plans_insert_owner ON evo_plans;
CREATE POLICY evo_plans_insert_owner ON evo_plans
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = evo_plans.workspace_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- Only workspace owners may update (re-confirm) an existing plan
DROP POLICY IF EXISTS evo_plans_update_owner ON evo_plans;
CREATE POLICY evo_plans_update_owner ON evo_plans
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = evo_plans.workspace_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );
