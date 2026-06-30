-- Migration: 0037_rename_qsos_pack_ids
-- Phase 1A — Rename legacy qsos.* pack IDs → lados.* in live database.
--
-- The FK registered_nodes.pack_id → packs(id) is non-deferrable, so we
-- temporarily drop it, perform all renames, then recreate it.
-- Safe on a fresh DB — WHERE clauses are no-ops if old IDs don't exist.

BEGIN;

-- ── Step 1: Drop FK so we can rename freely ───────────────────────────────────

ALTER TABLE public.registered_nodes
  DROP CONSTRAINT IF EXISTS registered_nodes_pack_id_fkey;

-- ── Step 2: Rename in packs (parent) ─────────────────────────────────────────

UPDATE public.packs SET id = 'lados.core-pack'        WHERE id = 'qsos.core-pack';
UPDATE public.packs SET id = 'lados.qs-pack'          WHERE id = 'qsos.qs-pack';
UPDATE public.packs SET id = 'lados.document-pack'    WHERE id = 'qsos.document-pack';
UPDATE public.packs SET id = 'lados.procurement-pack' WHERE id = 'qsos.procurement-pack';
UPDATE public.packs SET id = 'lados.ai-pack'          WHERE id = 'qsos.ai-pack';

UPDATE public.packs SET author = 'Lados Platform'
  WHERE author = 'QS-OS' AND id LIKE 'lados.%';

-- ── Step 3: Rename in registered_nodes (child) ───────────────────────────────

UPDATE public.registered_nodes SET pack_id = 'lados.core-pack'        WHERE pack_id = 'qsos.core-pack';
UPDATE public.registered_nodes SET pack_id = 'lados.qs-pack'          WHERE pack_id = 'qsos.qs-pack';
UPDATE public.registered_nodes SET pack_id = 'lados.document-pack'    WHERE pack_id = 'qsos.document-pack';
UPDATE public.registered_nodes SET pack_id = 'lados.procurement-pack' WHERE pack_id = 'qsos.procurement-pack';
UPDATE public.registered_nodes SET pack_id = 'lados.ai-pack'          WHERE pack_id = 'qsos.ai-pack';

-- ── Step 4: Recreate FK ───────────────────────────────────────────────────────

ALTER TABLE public.registered_nodes
  ADD CONSTRAINT registered_nodes_pack_id_fkey
  FOREIGN KEY (pack_id) REFERENCES public.packs(id) ON DELETE CASCADE;

-- ── Step 5: Verify ────────────────────────────────────────────────────────────

DO $$
DECLARE
  legacy_packs integer;
  legacy_nodes integer;
BEGIN
  SELECT COUNT(*) INTO legacy_packs FROM public.packs            WHERE id      LIKE 'qsos.%';
  SELECT COUNT(*) INTO legacy_nodes FROM public.registered_nodes WHERE pack_id LIKE 'qsos.%';

  IF legacy_packs > 0 OR legacy_nodes > 0 THEN
    RAISE WARNING 'Phase 1A: % legacy qsos.* packs and % nodes remain — check manually', legacy_packs, legacy_nodes;
  ELSE
    RAISE NOTICE 'Phase 1A: all pack IDs renamed to lados.* namespace ✓';
  END IF;
END $$;

COMMIT;
