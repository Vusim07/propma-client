-- First, let's examine the current constraint to see what values are allowed
DO $$ 
DECLARE
    constraint_def text;
BEGIN
    SELECT pg_get_constraintdef(oid) INTO constraint_def
    FROM pg_constraint
    WHERE conname = 'profiles_role_check';
    
    RAISE NOTICE 'Current constraint definition: %', constraint_def;
END $$;

-- Remove the old constraint if it exists
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add a new constraint that includes 'pending' as a valid role
ALTER TABLE public.users
ADD CONSTRAINT users_role_check
CHECK (role IN ('tenant', 'agent', 'landlord', 'pending'));

-- Update auth.users trigger to reference the correct table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name, role)
  VALUES (new.id, new.email, '', '', 'pending');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- If an existing trigger exists pointing to 'profiles', drop it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the correct trigger pointing to the 'users' table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
