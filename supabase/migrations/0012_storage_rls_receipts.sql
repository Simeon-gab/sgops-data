-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Migration: 0012_storage_rls_receipts
-- Purpose:   Lock down storage.objects for the 'receipts' bucket.
--
-- Folder convention enforced by these policies:
--   receipts/admin/{receipt_id}.{ext}       — admin uploads
--   receipts/{dealer_id}/{receipt_id}.{ext} — dealer uploads
--
-- Depends on:
--   public.auth_user_role()      TEXT  — returns 'admin' | 'dealer' | ...
--   public.auth_user_dealer_id() UUID  — returns the calling dealer's UUID
--
-- Re-runnable: DROP POLICY IF EXISTS precedes every CREATE POLICY.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ── 1. Enable RLS on storage.objects (no-op if already enabled) ──────────────
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;


-- ── 2. INSERT — admin can upload to any path inside receipts ─────────────────
--   USING clause does not apply to INSERT; all access control is via WITH CHECK.

DROP POLICY IF EXISTS "admin_can_upload_anywhere_to_receipts" ON storage.objects;

CREATE POLICY "admin_can_upload_anywhere_to_receipts"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND public.auth_user_role() = 'admin'
  );


-- ── 3. INSERT — dealer can only upload to their own folder ───────────────────
--   (storage.foldername(name))[1] is the first path segment, e.g. the dealer UUID.
--   For a path like '{dealer_id}/receipt_123.pdf', this evaluates to '{dealer_id}'.

DROP POLICY IF EXISTS "dealer_can_upload_to_own_folder" ON storage.objects;

CREATE POLICY "dealer_can_upload_to_own_folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND public.auth_user_role() = 'dealer'
    AND (storage.foldername(name))[1] = public.auth_user_dealer_id()::text
  );


-- ── 4. SELECT — admin can read any object in receipts ───────────────────────

DROP POLICY IF EXISTS "admin_can_read_all_receipts" ON storage.objects;

CREATE POLICY "admin_can_read_all_receipts"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND public.auth_user_role() = 'admin'
  );


-- ── 5. SELECT — dealer can only read their own folder ───────────────────────

DROP POLICY IF EXISTS "dealer_can_read_own_folder" ON storage.objects;

CREATE POLICY "dealer_can_read_own_folder"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND public.auth_user_role() = 'dealer'
    AND (storage.foldername(name))[1] = public.auth_user_dealer_id()::text
  );


-- ── 6. UPDATE — admin only; dealers cannot update (receipts are immutable) ──
--   USING:      row must already satisfy this to be visible for UPDATE.
--   WITH CHECK: the row after update must still satisfy this.

DROP POLICY IF EXISTS "admin_can_update_receipts" ON storage.objects;

CREATE POLICY "admin_can_update_receipts"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'receipts'
    AND public.auth_user_role() = 'admin'
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND public.auth_user_role() = 'admin'
  );


-- ── 7. DELETE — admin only; dealers cannot delete ───────────────────────────

DROP POLICY IF EXISTS "admin_can_delete_receipts" ON storage.objects;

CREATE POLICY "admin_can_delete_receipts"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'receipts'
    AND public.auth_user_role() = 'admin'
  );
