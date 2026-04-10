-- ============================================================
--  NimbusVault — Supabase Database Setup
--  Run this entire script in:
--  Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- 1. FILES TABLE
--    Stores metadata for every file uploaded by users.
--    The actual file bytes live in Supabase Storage (bucket: user-files).

CREATE TABLE IF NOT EXISTS public.files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  size         BIGINT DEFAULT 0,        -- bytes
  type         TEXT DEFAULT '',         -- MIME type
  storage_path TEXT NOT NULL,           -- path inside the storage bucket
  is_public    BOOLEAN DEFAULT FALSE,   -- whether a public share link is active
  trashed      BOOLEAN DEFAULT FALSE,   -- soft-delete flag
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.files;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.files
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 2. ROW LEVEL SECURITY (RLS)
--    Each user can only see / modify their own rows.

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Users can read their own files
CREATE POLICY "Users can view own files"
  ON public.files FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert rows for themselves
CREATE POLICY "Users can insert own files"
  ON public.files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own files
CREATE POLICY "Users can update own files"
  ON public.files FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
  ON public.files FOR DELETE
  USING (auth.uid() = user_id);

-- Optional: Allow anyone to READ a file record that is marked is_public
--           (so sharing links with metadata work without login)
CREATE POLICY "Anyone can view public files"
  ON public.files FOR SELECT
  USING (is_public = TRUE);

-- 3. INDEXES for common query patterns
CREATE INDEX IF NOT EXISTS idx_files_user_id    ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_trashed    ON public.files(user_id, trashed);
CREATE INDEX IF NOT EXISTS idx_files_is_public  ON public.files(is_public);

-- ============================================================
-- STORAGE BUCKET SETUP (do this in the Supabase Dashboard UI)
-- ============================================================
-- 1. Go to Storage in the left sidebar
-- 2. Click "New bucket"
-- 3. Name it exactly:  user-files
-- 4. Set it to PRIVATE (we control access via signed URLs)
-- 5. Add the following storage policies:

-- Storage policy (run in SQL editor):

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to read their own files
CREATE POLICY "Users can read own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to delete their own files
CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read for public files (needed for share links)
-- This works when the bucket is set to public OR you use signed URLs.
-- For simplicity, make the bucket public after creating it:
--   Storage → user-files → Settings → Make Public ✓
