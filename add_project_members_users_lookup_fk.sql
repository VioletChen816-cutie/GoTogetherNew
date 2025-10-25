-- Establish FK for Supabase join: project_members.user_id -> users_lookup.user_id
-- Idempotent and guarded; raises helpful errors if data prevents uniqueness.

DO $$
DECLARE
  has_project_members_user_id BOOLEAN;
  has_users_lookup_user_id BOOLEAN;
  has_unique_on_users_lookup BOOLEAN;
  has_fk BOOLEAN;
BEGIN
  -- Check columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'project_members' AND column_name = 'user_id'
  ) INTO has_project_members_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users_lookup' AND column_name = 'user_id'
  ) INTO has_users_lookup_user_id;

  IF NOT (has_project_members_user_id AND has_users_lookup_user_id) THEN
    RAISE NOTICE 'Skipping FK creation: required columns missing (project_members.user_id or users_lookup.user_id)';
    RETURN;
  END IF;

  -- Ensure users_lookup.user_id is unique/primary (required for FK target)
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'users_lookup' AND c.contype IN ('u','p')
      AND (
        SELECT string_agg(att.attname, ',')
        FROM unnest(c.conkey) AS k
        JOIN pg_attribute att ON att.attrelid = t.oid AND att.attnum = k
      ) = 'user_id'
  ) INTO has_unique_on_users_lookup;

  IF NOT has_unique_on_users_lookup THEN
    -- Guard against duplicates before adding a UNIQUE constraint
    IF EXISTS (
      SELECT 1 FROM public.users_lookup ul
      GROUP BY ul.user_id HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION 'Cannot add UNIQUE(users_lookup.user_id): duplicates exist. Clean data first.';
    END IF;

    BEGIN
      ALTER TABLE public.users_lookup
        ADD CONSTRAINT users_lookup_user_id_unique UNIQUE (user_id);
    EXCEPTION WHEN duplicate_table THEN
      -- Constraint name collision; create unique index fallback
      CREATE UNIQUE INDEX IF NOT EXISTS users_lookup_user_id_idx ON public.users_lookup(user_id);
    END;
  END IF;

  -- Add FK from project_members.user_id to users_lookup.user_id if missing
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'project_members' AND c.contype = 'f'
      AND c.conname = 'project_members_user_id_fkey'
  ) INTO has_fk;

  IF NOT has_fk THEN
    ALTER TABLE public.project_members
      ADD CONSTRAINT project_members_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.users_lookup (user_id)
      ON UPDATE CASCADE
      ON DELETE CASCADE;
  END IF;
END $$;

-- Refresh PostgREST schema cache so relationships are recognized immediately
NOTIFY pgrst, 'reload schema';

-- Optional: grant basic access (adjust to your security needs), guarded by existence
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='project_members'
  ) THEN
    GRANT SELECT ON TABLE public.project_members TO anon, authenticated;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='users_lookup'
  ) THEN
    GRANT SELECT ON TABLE public.users_lookup TO anon, authenticated;
  END IF;
END $$;