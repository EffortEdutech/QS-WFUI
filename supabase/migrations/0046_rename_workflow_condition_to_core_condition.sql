-- Migration 0046: Rename workflow.condition → core.condition
--
-- The node executor now registers BOTH 'core.condition' (canonical) and
-- 'workflow.condition' (backward-compat alias), so existing workflows
-- that reference workflow.condition continue to function unchanged.
-- The registered_nodes row is renamed to the canonical type.
--
-- Phase 14 / Icon fix sprint

UPDATE registered_nodes
SET    type       = 'core.condition',
       updated_at = now()
WHERE  type = 'workflow.condition';
