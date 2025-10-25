-- Enable guest mode: allow anonymous inserts for rides and requests
-- 1) Relax NOT NULL constraints
ALTER TABLE public.rides
  ALTER COLUMN driver_id DROP NOT NULL;

ALTER TABLE public.requests
  ALTER COLUMN passenger_id DROP NOT NULL;

-- 2) Add guest contact fields
-- Also ensure baseline ride columns exist in case the base schema wasn't applied
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS start_location TEXT,
  ADD COLUMN IF NOT EXISTS end_location TEXT,
  ADD COLUMN IF NOT EXISTS departure_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrival_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seats_available INTEGER,
  ADD COLUMN IF NOT EXISTS available_seats INTEGER,
  ADD COLUMN IF NOT EXISTS total_seats INTEGER,
  ADD COLUMN IF NOT EXISTS cost_per_person NUMERIC;

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT;

-- If legacy columns exist (origin/destination), relax NOT NULL and keep them in sync
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rides' AND column_name='origin'
  ) THEN
    BEGIN
      ALTER TABLE public.rides ALTER COLUMN origin DROP NOT NULL;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rides' AND column_name='destination'
  ) THEN
    BEGIN
      ALTER TABLE public.rides ALTER COLUMN destination DROP NOT NULL;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rides' AND column_name='arrival_time'
  ) THEN
    BEGIN
      ALTER TABLE public.rides ALTER COLUMN arrival_time DROP NOT NULL;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rides' AND column_name='total_seats'
  ) THEN
    BEGIN
      ALTER TABLE public.rides ALTER COLUMN total_seats DROP NOT NULL;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rides' AND column_name='available_seats'
  ) THEN
    BEGIN
      ALTER TABLE public.rides ALTER COLUMN available_seats DROP NOT NULL;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rides' AND column_name='cost_per_person'
  ) THEN
    BEGIN
      ALTER TABLE public.rides ALTER COLUMN cost_per_person DROP NOT NULL;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;
END $$;

-- Keep seats aliases in sync: total_seats <-> seats_available
CREATE OR REPLACE FUNCTION public.rides_sync_seats_aliases()
RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    -- Prefer to fill from any provided value across the aliases
    IF NEW.available_seats IS NULL AND NEW.seats_available IS NOT NULL THEN
      NEW.available_seats := NEW.seats_available;
    END IF;
    IF NEW.seats_available IS NULL AND NEW.available_seats IS NOT NULL THEN
      NEW.seats_available := NEW.available_seats;
    END IF;

    IF NEW.total_seats IS NULL THEN
      IF NEW.available_seats IS NOT NULL THEN
        NEW.total_seats := NEW.available_seats;
      ELSIF NEW.seats_available IS NOT NULL THEN
        NEW.total_seats := NEW.seats_available;
      END IF;
    END IF;

    IF NEW.available_seats IS NULL AND NEW.total_seats IS NOT NULL THEN
      NEW.available_seats := NEW.total_seats;
    END IF;
    IF NEW.seats_available IS NULL AND NEW.total_seats IS NOT NULL THEN
      NEW.seats_available := NEW.total_seats;
    END IF;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='rides_sync_seats_aliases_trigger'
  ) THEN
    CREATE TRIGGER rides_sync_seats_aliases_trigger
    BEFORE INSERT OR UPDATE ON public.rides
    FOR EACH ROW EXECUTE FUNCTION public.rides_sync_seats_aliases();
  END IF;
END $$;

-- Sync alias columns so inserts using either pair work seamlessly
CREATE OR REPLACE FUNCTION public.rides_sync_location_aliases()
RETURNS trigger AS $$
BEGIN
  -- Copy provided start/end into legacy origin/destination when missing
  IF TG_OP IN ('INSERT','UPDATE') THEN
    IF NEW.origin IS NULL AND NEW.start_location IS NOT NULL THEN
      NEW.origin := NEW.start_location;
    END IF;
    IF NEW.destination IS NULL AND NEW.end_location IS NOT NULL THEN
      NEW.destination := NEW.end_location;
    END IF;
    -- Also back-fill start/end from legacy columns if app fields are missing
    IF NEW.start_location IS NULL AND NEW.origin IS NOT NULL THEN
      NEW.start_location := NEW.origin;
    END IF;
    IF NEW.end_location IS NULL AND NEW.destination IS NOT NULL THEN
      NEW.end_location := NEW.destination;
    END IF;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='rides_sync_location_aliases_trigger'
  ) THEN
    CREATE TRIGGER rides_sync_location_aliases_trigger
    BEFORE INSERT OR UPDATE ON public.rides
    FOR EACH ROW EXECUTE FUNCTION public.rides_sync_location_aliases();
  END IF;
END $$;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT;

-- 3) Row Level Security: add guest insert policies
-- Guests can create rides when unauthenticated and driver_id is NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rides'
      AND policyname = 'Guests can create rides'
  ) THEN
    CREATE POLICY "Guests can create rides"
      ON public.rides FOR INSERT
      WITH CHECK (auth.uid() IS NULL AND driver_id IS NULL);
  END IF;
END $$;

-- Guests can create requests when unauthenticated and passenger_id is NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'requests'
      AND policyname = 'Guests can create requests'
  ) THEN
    CREATE POLICY "Guests can create requests"
      ON public.requests FOR INSERT
      WITH CHECK (auth.uid() IS NULL AND passenger_id IS NULL);
  END IF;
END $$;

-- Note: Existing select/update/delete policies remain unchanged.
-- Drivers continue to manage requests for their rides.

-- 4) Realtime: already enabled for rides/requests; no change required.

-- 5) Ensure anon/auth roles can see and use new columns/tables
-- Grants are complementary to RLS: RLS still governs row-level access.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rides TO anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.requests TO anon, authenticated;

-- Optional: future tables in public inherit these grants
DO $$
BEGIN
  BEGIN
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO anon, authenticated;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;