-- Fix for profile creation issues
-- This function will be called to ensure profile creation works properly

-- Ensure required enum and table exist
DO $$
BEGIN
  -- Create enum type for user roles if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'user_role' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.user_role AS ENUM ('passenger', 'driver');
  END IF;

  -- Create profiles table if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    CREATE TABLE public.profiles (
      id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
      full_name TEXT,
      role public.user_role NOT NULL DEFAULT 'passenger',
      phone TEXT,
      rating NUMERIC DEFAULT 0,
      total_ratings INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create improved function with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  role_text TEXT;
  safe_role public.user_role;
  name_text TEXT;
BEGIN
  role_text := NEW.raw_user_meta_data->>'role';
  name_text := NEW.raw_user_meta_data->>'full_name';

  IF role_text IS NULL OR role_text NOT IN ('passenger','driver') THEN
    safe_role := 'passenger';
  ELSE
    -- Safe cast only when value is valid
    safe_role := role_text::public.user_role;
  END IF;

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(name_text, 'User'),
    safe_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.handle_new_user() SET search_path = public, auth;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;

-- Create a function that users can call to create their profile if the trigger fails
CREATE OR REPLACE FUNCTION create_user_profile(
  user_id UUID,
  full_name TEXT,
  user_role user_role DEFAULT 'passenger',
  phone_number TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Only allow users to create their own profile
  IF auth.uid() != user_id THEN
    RAISE EXCEPTION 'You can only create your own profile';
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, phone)
  VALUES (user_id, full_name, user_role, phone_number)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    phone = COALESCE(EXCLUDED.phone, profiles.phone);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;