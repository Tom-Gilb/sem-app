-- Migration: 001_workspace_model
-- Spec: S.EvoStep4.WorkspaceModel
-- Creates workspace RBAC schema and RLS policies for SEM App multi-user capability.
-- Idempotent: all CREATE TABLE and CREATE POLICY statements are guarded with IF NOT EXISTS.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Enum type for workspace roles
-- ────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE workspace_role AS ENUM ('owner', 'contributor', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. workspaces table
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. workspace_members table
--    Stores per-user role within each workspace.
--    Role is a column (not user metadata) so changes are auditable.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspace_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         workspace_role NOT NULL DEFAULT 'contributor',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. sem_entries table
--    Stores SEM triples and their generated spec blocks.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sem_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stakes         TEXT NOT NULL,
  ends           TEXT NOT NULL,
  means          TEXT NOT NULL,
  spec_block     JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. spec_collisions table
--    Logs identifier collisions resolved by auto-suffix strategy.
--    Spec: S.SupabaseAuthConfig — auto-suffix up to _99; error above 99.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS spec_collisions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  original_id  TEXT NOT NULL,
  suffixed_id  TEXT NOT NULL,
  logged_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  logged_by    UUID NOT NULL REFERENCES auth.users(id)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Enable Row-Level Security on every table
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE workspaces       ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sem_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE spec_collisions   ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. RLS policies — workspaces
-- ────────────────────────────────────────────────────────────────────────────

-- Members can see workspaces they belong to
DROP POLICY IF EXISTS workspaces_select_members ON workspaces;
CREATE POLICY workspaces_select_members ON workspaces
  FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Only the creator can update or delete their workspace
DROP POLICY IF EXISTS workspaces_update_owner ON workspaces;
CREATE POLICY workspaces_update_owner ON workspaces
  FOR UPDATE
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS workspaces_delete_owner ON workspaces;
CREATE POLICY workspaces_delete_owner ON workspaces
  FOR DELETE
  USING (created_by = auth.uid());

-- Any authenticated user can create a workspace
DROP POLICY IF EXISTS workspaces_insert_authenticated ON workspaces;
CREATE POLICY workspaces_insert_authenticated ON workspaces
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ────────────────────────────────────────────────────────────────────────────
-- 8. RLS policies — workspace_members
--    Spec: SELECT open to all workspace members; INSERT/DELETE owner only.
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS wm_select_members ON workspace_members;
CREATE POLICY wm_select_members ON workspace_members
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Only owners may add or remove members
DROP POLICY IF EXISTS wm_insert_owner ON workspace_members;
CREATE POLICY wm_insert_owner ON workspace_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = workspace_members.workspace_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
    OR NOT EXISTS (
      -- Allow first-member insert (workspace creator bootstrapping)
      SELECT 1 FROM workspace_members
      WHERE workspace_id = workspace_members.workspace_id
    )
  );

DROP POLICY IF EXISTS wm_delete_owner ON workspace_members;
CREATE POLICY wm_delete_owner ON workspace_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = workspace_members.workspace_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 9. RLS policies — sem_entries
--    INSERT: owner and contributor only (viewer blocked → 403).
--    SELECT: all workspace members.
--    DELETE: owner only.
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS sem_entries_select_members ON sem_entries;
CREATE POLICY sem_entries_select_members ON sem_entries
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS sem_entries_insert_contributor ON sem_entries;
CREATE POLICY sem_entries_insert_contributor ON sem_entries
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = sem_entries.workspace_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'contributor')
    )
  );

DROP POLICY IF EXISTS sem_entries_delete_owner ON sem_entries;
CREATE POLICY sem_entries_delete_owner ON sem_entries
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = sem_entries.workspace_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 10. RLS policies — spec_collisions (owner-only read)
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS collisions_select_owner ON spec_collisions;
CREATE POLICY collisions_select_owner ON spec_collisions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = spec_collisions.workspace_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

DROP POLICY IF EXISTS collisions_insert_system ON spec_collisions;
CREATE POLICY collisions_insert_system ON spec_collisions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = spec_collisions.workspace_id
        AND user_id = auth.uid()
    )
  );
