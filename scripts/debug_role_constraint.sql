-- Check what's in the users table
SELECT * FROM public.users LIMIT 10;

-- Check the constraint definition
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass AND contype = 'c';

-- Check the table definition
\d public.users

-- Try a simple insert with an allowed role to test
DO $$ 
BEGIN
    BEGIN
        INSERT INTO public.users (id, email, first_name, last_name, role)
        VALUES ('test-id', 'test@example.com', 'Test', 'User', 'tenant');
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error inserting: %', SQLERRM;
    END;
END $$;
