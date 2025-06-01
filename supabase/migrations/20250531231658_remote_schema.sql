

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgsodium";






CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."email_priority" AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


ALTER TYPE "public"."email_priority" OWNER TO "postgres";


CREATE TYPE "public"."email_status" AS ENUM (
    'received',
    'sent',
    'draft',
    'archived',
    'deleted',
    'bounced',
    'failed'
);


ALTER TYPE "public"."email_status" OWNER TO "postgres";


CREATE TYPE "public"."plan_type" AS ENUM (
    'individual',
    'team'
);


ALTER TYPE "public"."plan_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_tenant_create_application"("user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users WHERE id = user_id AND role = 'tenant'
  );
END;
$$;


ALTER FUNCTION "public"."can_tenant_create_application"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_application"("user_id" "uuid", "application_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get the user's role directly without using any policies
  SELECT role INTO user_role FROM users WHERE id = user_id;
  
  -- If user is a tenant, they can only view their own applications
  IF user_role = 'tenant' THEN
    RETURN EXISTS (
      SELECT 1 
      FROM tenant_profiles 
      WHERE tenant_id = user_id 
      AND id = application_tenant_id
    );
  -- If user is agent or landlord, they can view applications for their properties
  -- This is handled by a separate policy
  ELSIF user_role IN ('agent', 'landlord') THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."can_view_application"("user_id" "uuid", "application_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_application_exists"("tenant_id_param" "uuid", "property_id_param" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM applications 
    WHERE tenant_id = tenant_id_param 
    AND property_id = property_id_param
  );
END;
$$;


ALTER FUNCTION "public"."check_application_exists"("tenant_id_param" "uuid", "property_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_team_member_limit"("p_team_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    max_members integer;
    current_members integer;
    pending_invites integer;
BEGIN
    SELECT t.max_members INTO max_members FROM teams t WHERE t.id = p_team_id;
    SELECT COUNT(*) INTO current_members FROM team_members WHERE team_id = p_team_id;
    SELECT COUNT(*) INTO pending_invites FROM team_invitations WHERE team_id = p_team_id AND status = 'pending';
    RETURN (current_members + pending_invites) < max_members;
END;
$$;


ALTER FUNCTION "public"."check_team_member_limit"("p_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_team_subscription"("p_team_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE has_active_sub boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM teams t
        JOIN subscriptions s ON t.subscription_id = s.id
        WHERE t.id = p_team_id AND s.status = 'active'
    ) INTO has_active_sub;
    RETURN has_active_sub;
END;
$$;


ALTER FUNCTION "public"."check_team_subscription"("p_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_profile_from_auth"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    first_name, 
    last_name, 
    role, 
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id, 
    NEW.email, -- Use auth email directly
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'tenant'),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_profile_from_auth"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_tenant_profile"("p_tenant_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text" DEFAULT NULL::"text", "p_current_address" "text" DEFAULT NULL::"text", "p_id_number" "text" DEFAULT NULL::"text", "p_employment_status" "text" DEFAULT 'employed'::"text", "p_monthly_income" numeric DEFAULT 0) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_profile_id UUID;
BEGIN
  -- Check if a profile already exists
  SELECT id INTO new_profile_id FROM tenant_profiles WHERE tenant_id = p_tenant_id LIMIT 1;
  
  -- If a profile exists, just return its ID
  IF new_profile_id IS NOT NULL THEN
    RETURN new_profile_id;
  END IF;
  
  -- Otherwise create a new profile
  INSERT INTO tenant_profiles (
    tenant_id,
    first_name,
    last_name,
    email,
    phone,
    current_address,
    id_number,
    employment_status,
    monthly_income
  ) VALUES (
    p_tenant_id,
    p_first_name,
    p_last_name,
    p_email,
    p_phone,
    p_current_address,
    p_id_number,
    p_employment_status,
    p_monthly_income
  )
  RETURNING id INTO new_profile_id;
  
  RETURN new_profile_id;
END;
$$;


ALTER FUNCTION "public"."create_tenant_profile"("p_tenant_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_current_address" "text", "p_id_number" "text", "p_employment_status" "text", "p_monthly_income" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_agent_email_address"("p_first_name" "text", "p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    -- Sanitize first name: lowercase and remove spaces
    RETURN LOWER(REGEXP_REPLACE(p_first_name, '\s+', '', 'g')) || '-' || p_user_id || '@n.agentamara.com';
END;
$$;


ALTER FUNCTION "public"."generate_agent_email_address"("p_first_name" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_team_email_address"("p_company_name" "text", "p_team_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    -- Sanitize company name: lowercase, remove spaces and special characters
    RETURN LOWER(REGEXP_REPLACE(p_company_name, '[^a-zA-Z0-9]', '', 'g')) 
           || '-' || p_team_id || '@n.agentamara.com';
END;
$$;


ALTER FUNCTION "public"."generate_team_email_address"("p_company_name" "text", "p_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_app_setting"("setting_key" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN (SELECT value FROM app_settings WHERE key = setting_key);
END;
$$;


ALTER FUNCTION "public"."get_app_setting"("setting_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_application_id_if_exists"("tenant_id_param" "uuid", "property_id_param" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  application_id UUID;
BEGIN
  SELECT id INTO application_id
  FROM applications 
  WHERE tenant_id = tenant_id_param 
  AND property_id = property_id_param
  LIMIT 1;
  
  RETURN application_id;
END;
$$;


ALTER FUNCTION "public"."get_application_id_if_exists"("tenant_id_param" "uuid", "property_id_param" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."applications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "monthly_income" numeric(10,2) NOT NULL,
    "employer" "text" NOT NULL,
    "employment_duration" integer NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('UTC'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('UTC'::"text", "now"()) NOT NULL,
    "team_id" "uuid",
    "decision_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "applications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'screening'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."applications" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_existing_application"("p_tenant_id" "uuid", "p_property_id" "uuid") RETURNS "public"."applications"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_application applications;
BEGIN
  -- Get the most recent application for this tenant/property pair
  SELECT *
  INTO v_application
  FROM applications
  WHERE tenant_id = p_tenant_id 
    AND property_id = p_property_id
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_application;
END;
$$;


ALTER FUNCTION "public"."get_existing_application"("p_tenant_id" "uuid", "p_property_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "address" "text" NOT NULL,
    "suburb" "text" NOT NULL,
    "city" "text" NOT NULL,
    "province" "text" NOT NULL,
    "postal_code" "text" NOT NULL,
    "property_type" "text" NOT NULL,
    "bedrooms" smallint NOT NULL,
    "bathrooms" smallint NOT NULL,
    "monthly_rent" numeric(10,2) NOT NULL,
    "deposit_amount" numeric(10,2) NOT NULL,
    "available_from" "date" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('UTC'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('UTC'::"text", "now"()) NOT NULL,
    "square_feet" integer NOT NULL,
    "description" "text" NOT NULL,
    "amenities" "text"[] DEFAULT '{}'::"text"[],
    "images" "text"[] DEFAULT '{}'::"text"[],
    "application_link" "text",
    "web_reference" "text",
    "team_id" "uuid",
    CONSTRAINT "properties_province_check" CHECK (("province" = ANY (ARRAY['Eastern Cape'::"text", 'Free State'::"text", 'Gauteng'::"text", 'KwaZulu-Natal'::"text", 'Limpopo'::"text", 'Mpumalanga'::"text", 'Northern Cape'::"text", 'North West'::"text", 'Western Cape'::"text"]))),
    CONSTRAINT "properties_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'rented'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."properties" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_property_by_token"("token_param" "text") RETURNS SETOF "public"."properties"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT * FROM properties 
  WHERE application_link ILIKE CONCAT('%', token_param, '%')
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_property_by_token"("token_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_screening_report"("id_param" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result jsonb;
BEGIN
  -- First, try to find by application_id
  SELECT row_to_json(sr)::jsonb INTO result
  FROM screening_reports sr
  WHERE sr.application_id = id_param
  LIMIT 1;
  
  -- If not found by application_id, try tenant_id
  IF result IS NULL THEN
    SELECT row_to_json(sr)::jsonb INTO result
    FROM screening_reports sr
    WHERE sr.tenant_id = id_param
    LIMIT 1;
  END IF;
  
  -- If still not found, try to find by auth user ID
  -- (translate auth user ID to tenant profile ID)
  IF result IS NULL THEN
    SELECT row_to_json(sr)::jsonb INTO result
    FROM screening_reports sr
    JOIN tenant_profiles tp ON sr.tenant_id = tp.id
    WHERE tp.tenant_id = id_param
    ORDER BY sr.created_at DESC
    LIMIT 1;
  END IF;
  
  -- If still not found, try to find via applications
  IF result IS NULL THEN
    -- First, find tenant_profile_id from auth user ID
    DECLARE tenant_profile_id TEXT;
    BEGIN
      SELECT tp.id INTO tenant_profile_id
      FROM tenant_profiles tp
      WHERE tp.tenant_id = id_param
      LIMIT 1;
      
      IF tenant_profile_id IS NOT NULL THEN
        -- Find most recent application for this tenant
        DECLARE application_id TEXT;
        BEGIN
          SELECT a.id INTO application_id
          FROM applications a
          WHERE a.tenant_id = tenant_profile_id
          ORDER BY a.created_at DESC
          LIMIT 1;
          
          IF application_id IS NOT NULL THEN
            -- Get screening report for this application
            SELECT row_to_json(sr)::jsonb INTO result
            FROM screening_reports sr
            WHERE sr.application_id = application_id
            LIMIT 1;
          END IF;
        END;
      END IF;
    END;
  END IF;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_screening_report"("id_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tenant_applications_for_property"("tenant_id_param" "uuid", "property_id_param" "uuid") RETURNS SETOF "public"."applications"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
    SELECT * 
    FROM applications 
    WHERE tenant_id = tenant_id_param 
    AND property_id = property_id_param;
END;
$$;


ALTER FUNCTION "public"."get_tenant_applications_for_property"("tenant_id_param" "uuid", "property_id_param" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "id_number" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "current_address" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('UTC'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('UTC'::"text", "now"()) NOT NULL,
    "tenant_id" "uuid",
    "employment_status" "text" NOT NULL,
    "monthly_income" integer NOT NULL,
    "employer" "text",
    "employment_duration" smallint
);


ALTER TABLE "public"."tenant_profiles" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tenant_profile_for_user"("user_id" "uuid") RETURNS SETOF "public"."tenant_profiles"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT * FROM tenant_profiles WHERE tenant_id = user_id;
$$;


ALTER FUNCTION "public"."get_tenant_profile_for_user"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_test_email_address"("p_user_id" "uuid" DEFAULT NULL::"uuid", "p_team_id" "uuid" DEFAULT NULL::"uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_email TEXT;
    v_user_role TEXT;
    v_user_first_name TEXT;
    v_team_has_admin BOOLEAN;
BEGIN
    IF p_user_id IS NOT NULL THEN
        -- Get user's role and first name
        SELECT role, first_name INTO v_user_role, v_user_first_name
        FROM users
        WHERE id = p_user_id;

        -- Only return email if user has complete profile
        IF v_user_role != 'pending' AND v_user_first_name IS NOT NULL AND v_user_first_name != '' THEN
            SELECT email_address INTO v_email
            FROM email_addresses
            WHERE user_id = p_user_id
            AND is_active = true
            LIMIT 1;
        END IF;
    ELSIF p_team_id IS NOT NULL THEN
        -- Check if team has an admin with company name
        SELECT EXISTS (
            SELECT 1 FROM users u
            JOIN team_members tm ON u.id = tm.user_id
            WHERE tm.team_id = p_team_id 
            AND tm.role = 'admin'
            AND u.company_name IS NOT NULL
            AND u.company_name != ''
        ) INTO v_team_has_admin;

        -- Only return email if team has valid admin
        IF v_team_has_admin THEN
            SELECT email_address INTO v_email
            FROM email_addresses
            WHERE team_id = p_team_id
            AND is_active = true
            LIMIT 1;
        END IF;
    END IF;
    
    RETURN v_email;
END;
$$;


ALTER FUNCTION "public"."get_test_email_address"("p_user_id" "uuid", "p_team_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_test_email_address"("p_user_id" "uuid", "p_team_id" "uuid") IS 'Returns email address only for users with complete profiles (non-pending role and non-empty first name) or teams with valid admin';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name, role)
  VALUES (new.id, new.email, '', '', 'pending');
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_profile_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Only proceed if this is an update and the role is changing from 'pending'
    IF TG_OP = 'UPDATE' AND OLD.role = 'pending' AND NEW.role != 'pending' THEN
        -- Check if user already has an email address
        IF NOT EXISTS (
            SELECT 1 FROM email_addresses 
            WHERE user_id = NEW.id AND is_active = true
        ) THEN
            -- Create new email address
            INSERT INTO email_addresses (user_id, is_primary)
            VALUES (NEW.id, true);
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_profile_completion"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_profile_completion"() IS 'Automatically creates email address when a user completes their profile by updating their role from pending';



CREATE OR REPLACE FUNCTION "public"."handle_subscription_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF OLD.plan_name != NEW.plan_name THEN
        INSERT INTO subscription_changes (
            subscription_id,
            previous_plan_name,
            new_plan_name,
            prorated_amount,
            unused_credits,
            credit_value,
            final_amount,
            user_id,
            team_id
        ) VALUES (
            NEW.id,
            OLD.plan_name,
            NEW.plan_name,
            NEW.plan_price,
            (OLD.usage_limit - OLD.current_usage),
            (OLD.usage_limit - OLD.current_usage) * (OLD.plan_price / OLD.usage_limit),
            NEW.plan_price,
            NEW.user_id,
            NEW.team_id
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_subscription_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_subscription_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    functions_url text;
    service_key text;
BEGIN
    -- Only send notification for new subscriptions
    IF TG_OP = 'INSERT' THEN
        -- Get the required settings from app_settings table
        SELECT value INTO functions_url FROM app_settings WHERE key = 'supabase_functions_url';
        SELECT value INTO service_key FROM app_settings WHERE key = 'service_role_key';

        -- Only proceed if we have both required settings
        IF functions_url IS NOT NULL AND service_key IS NOT NULL THEN
            -- Call the Slack notification function using the correct schema
            PERFORM
                net.http_post(
                    url := CONCAT(functions_url, '/slack-notifications'),
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', CONCAT('Bearer ', service_key)
                    ),
                    body := jsonb_build_object(
                        'type', 'subscription_created',
                        'id', NEW.id,
                        'user_id', NEW.user_id,
                        'plan_name', NEW.plan_name,
                        'plan_price', NEW.plan_price,
                        'team_id', NEW.team_id,
                        'plan_type', NEW.plan_type,
                        'is_team', NEW.is_team,
                        'usage_limit', NEW.usage_limit,
                        'current_usage', NEW.current_usage,
                        'status', NEW.status,
                        'paystack_subscription_id', NEW.paystack_subscription_id,
                        'start_date', NEW.start_date,
                        'end_date', NEW.end_date
                    )
                );
        ELSE
            -- Log warning if settings are missing
            RAISE WARNING 'Missing required settings for Slack notification. Please check app_settings table.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_subscription_notification"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_subscription_notification"() IS 'Sends Slack notifications when new subscriptions are created, using settings from app_settings table and pg_net extension';



CREATE OR REPLACE FUNCTION "public"."handle_user_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    functions_url text;
    service_key text;
BEGIN
    -- Skip notification for initial user creation (empty names)
    IF NEW.first_name = '' AND NEW.last_name = '' THEN
        RETURN NEW;
    END IF;

    -- Get the required settings from app_settings table
    SELECT value INTO functions_url FROM app_settings WHERE key = 'supabase_functions_url';
    SELECT value INTO service_key FROM app_settings WHERE key = 'service_role_key';

    -- Only proceed if we have both required settings
    IF functions_url IS NOT NULL AND service_key IS NOT NULL THEN
        -- Call the Slack notification function using the correct schema
        PERFORM
            net.http_post(
                url := CONCAT(functions_url, '/slack-notifications'),
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', CONCAT('Bearer ', service_key)
                ),
                body := jsonb_build_object(
                    'type', CASE 
                        WHEN TG_OP = 'INSERT' THEN 'user_created'
                        WHEN TG_OP = 'UPDATE' THEN 'user_updated'
                    END,
                    'first_name', NEW.first_name,
                    'last_name', NEW.last_name,
                    'email', NEW.email,
                    'company_name', NEW.company_name,
                    'role', NEW.role,
                    'phone', NEW.phone
                )
            );
    ELSE
        -- Log warning if settings are missing
        RAISE WARNING 'Missing required settings for Slack notification. Please check app_settings table.';
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_user_notification"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_user_notification"() IS 'Sends Slack notifications when users are created or updated, using settings from app_settings table and pg_net extension';



CREATE OR REPLACE FUNCTION "public"."increment_screening_usage"("p_agent_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_subscription_id uuid;
BEGIN
    -- Get the active subscription for this agent
    SELECT s.id INTO v_subscription_id
    FROM subscriptions s
    WHERE s.user_id = p_agent_id AND s.status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1;
    
    IF v_subscription_id IS NOT NULL THEN
        -- Update usage count using explicit parameter reference
        UPDATE subscriptions
        SET 
            current_usage = (
                SELECT count(*) 
                FROM screening_reports
                WHERE agent_id = p_agent_id
                AND created_at >= date_trunc('month', current_timestamp)
            ),
            updated_at = now()
        WHERE id = v_subscription_id;
        
        RAISE NOTICE 'Updated usage count for subscription: %', v_subscription_id;
    ELSE
        RAISE NOTICE 'No active subscription found for agent_id: %', p_agent_id;
    END IF;
END;
$$;


ALTER FUNCTION "public"."increment_screening_usage"("p_agent_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_application"("p_property_id" "uuid", "p_agent_id" "uuid", "p_tenant_id" "uuid", "p_employer" "text", "p_employment_duration" numeric, "p_monthly_income" numeric, "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_application_id UUID;
  existing_application_id UUID;
BEGIN
  -- First check if an application already exists
  SELECT id INTO existing_application_id
  FROM applications
  WHERE tenant_id = p_tenant_id AND property_id = p_property_id
  LIMIT 1;
  
  -- If application exists, update it instead of creating a new one
  IF existing_application_id IS NOT NULL THEN
    UPDATE applications
    SET 
      employer = p_employer,
      employment_duration = p_employment_duration,
      monthly_income = p_monthly_income,
      notes = p_notes,
      updated_at = NOW()
    WHERE id = existing_application_id;
    
    RETURN existing_application_id;
  END IF;

  -- Otherwise insert a new application
  INSERT INTO applications (
    property_id,
    agent_id,
    tenant_id,
    employer,
    employment_duration,
    monthly_income,
    notes,
    status,
    created_at
  ) VALUES (
    p_property_id,
    p_agent_id,
    p_tenant_id,
    p_employer,
    p_employment_duration,
    p_monthly_income,
    p_notes,
    'pending',
    NOW()
  )
  RETURNING id INTO new_application_id;
  
  RETURN new_application_id;
END;
$$;


ALTER FUNCTION "public"."insert_application"("p_property_id" "uuid", "p_agent_id" "uuid", "p_tenant_id" "uuid", "p_employer" "text", "p_employment_duration" numeric, "p_monthly_income" numeric, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_application_safe"("p_property_id" "uuid", "p_agent_id" "uuid", "p_tenant_id" "uuid", "p_employer" "text", "p_employment_duration" integer, "p_monthly_income" numeric, "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_application_id UUID;
BEGIN
  -- Lock the potential application record to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text || p_property_id::text));
  
  -- Check for existing application
  SELECT id INTO v_application_id
  FROM applications
  WHERE tenant_id = p_tenant_id 
    AND property_id = p_property_id
  ORDER BY created_at DESC
  LIMIT 1;
    
  -- Return existing application if found
  IF v_application_id IS NOT NULL THEN
    RETURN v_application_id;
  END IF;
  
  -- Insert new application if none exists
  INSERT INTO applications (
    property_id,
    agent_id,
    tenant_id,
    employer,
    employment_duration,
    monthly_income,
    notes,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_property_id,
    p_agent_id,
    p_tenant_id,
    p_employer,
    p_employment_duration,
    p_monthly_income,
    p_notes,
    'pending',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_application_id;
  
  RETURN v_application_id;
END;
$$;


ALTER FUNCTION "public"."insert_application_safe"("p_property_id" "uuid", "p_agent_id" "uuid", "p_tenant_id" "uuid", "p_employer" "text", "p_employment_duration" integer, "p_monthly_income" numeric, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_admin"("p_team_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = p_team_id
    AND tm.user_id = p_user_id
    AND tm.role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_team_admin"("p_team_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_admin_safe"("p_team_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
    AND user_id = auth.uid()
    AND role = 'admin'
    -- Bypass RLS for this specific query
    OFFSET 0
  );
$$;


ALTER FUNCTION "public"."is_team_admin_safe"("p_team_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."screening_reports" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "application_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "affordability_score" real,
    "affordability_notes" "text",
    "id_verification_status" "text",
    "credit_score" integer,
    "recommendation" "text",
    "report_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('UTC'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('UTC'::"text", "now"()) NOT NULL,
    "income_verification" boolean DEFAULT false,
    "background_check_status" "text" NOT NULL,
    "pre_approval_status" "text" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "credit_report_id" "uuid",
    "monthly_income" numeric,
    "team_id" "uuid",
    CONSTRAINT "screening_reports_affordability_score_check" CHECK ((("affordability_score" >= (0)::double precision) AND ("affordability_score" <= (100)::double precision))),
    CONSTRAINT "screening_reports_background_check_status_check" CHECK (("background_check_status" = ANY (ARRAY['pending'::"text", 'passed'::"text", 'failed'::"text"]))),
    CONSTRAINT "screening_reports_id_verification_status_check" CHECK (("id_verification_status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'failed'::"text"]))),
    CONSTRAINT "screening_reports_pre_approval_status_check" CHECK (("pre_approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."screening_reports" OWNER TO "postgres";


COMMENT ON COLUMN "public"."screening_reports"."credit_report_id" IS 'References the credit report associated with this screening report.';



CREATE OR REPLACE FUNCTION "public"."save_screening_report"("p_application_id" "uuid", "p_agent_id_val" "uuid", "p_tenant_id_val" "uuid", "p_affordability_score" numeric, "p_affordability_notes" "text", "p_income_verification" boolean, "p_pre_approval_status" "text", "p_recommendation" "text", "p_report_data" "jsonb", "p_background_check_status" "text", "p_credit_score" integer, "p_monthly_income" numeric, "p_credit_report_id" "uuid") RETURNS SETOF "public"."screening_reports"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
#variable_conflict use_column
DECLARE
    v_report screening_reports%ROWTYPE;
    v_app_status text;
    v_current_time timestamptz := now();
BEGIN
    -- Enhanced debug logging
    RAISE NOTICE 'Starting save_screening_report with parameters: %', jsonb_build_object(
        'application_id', p_application_id,
        'agent_id', p_agent_id_val,
        'tenant_id', p_tenant_id_val,
        'pre_approval_status', p_pre_approval_status
    );

    -- Map pre_approval_status to application status
    IF p_pre_approval_status = 'approved' THEN 
        v_app_status := 'approved';
    ELSIF p_pre_approval_status = 'rejected' THEN 
        v_app_status := 'rejected';
    ELSE 
        v_app_status := 'pending';
    END IF;
    
    RAISE NOTICE 'Mapping pre_approval_status % to application status %', 
                 p_pre_approval_status, v_app_status;

    -- Insert or update screening report first
    INSERT INTO screening_reports AS sr (
        application_id,
        agent_id,
        tenant_id,
        affordability_score,
        affordability_notes,
        income_verification,
        pre_approval_status,
        recommendation,
        report_data,
        background_check_status,
        credit_score,
        monthly_income,
        credit_report_id,
        created_at,
        updated_at
    )
    VALUES (
        p_application_id,
        p_agent_id_val,
        p_tenant_id_val,
        p_affordability_score,
        p_affordability_notes,
        p_income_verification,
        p_pre_approval_status,
        p_recommendation,
        p_report_data,
        p_background_check_status,
        p_credit_score,
        p_monthly_income,
        p_credit_report_id,
        v_current_time,
        v_current_time
    )
    ON CONFLICT (application_id) 
    DO UPDATE SET
        agent_id = p_agent_id_val,
        tenant_id = p_tenant_id_val,
        affordability_score = p_affordability_score,
        affordability_notes = p_affordability_notes,
        income_verification = p_income_verification,
        pre_approval_status = p_pre_approval_status,
        recommendation = p_recommendation,
        report_data = p_report_data,
        background_check_status = p_background_check_status,
        credit_score = p_credit_score,
        monthly_income = p_monthly_income,
        credit_report_id = p_credit_report_id,
        updated_at = v_current_time
    RETURNING * INTO v_report;
    
    RAISE NOTICE 'Successfully saved screening report, now updating application status';

    -- Now update the application status
    UPDATE applications
    SET 
        status = v_app_status,
        updated_at = v_current_time,
        decision_at = CASE 
                        WHEN v_app_status IN ('approved', 'rejected') THEN v_current_time
                        ELSE decision_at -- Keep existing value if not changing to final state
                      END
    WHERE id = p_application_id;
    
    -- Verify if the update actually changed anything
    IF FOUND THEN
        RAISE NOTICE 'Updated application %: status = %, decision_at = % (if applicable)', 
                    p_application_id, v_app_status, 
                    CASE WHEN v_app_status IN ('approved', 'rejected') THEN v_current_time::text ELSE 'unchanged' END;
    ELSE
        RAISE WARNING 'Application % not found!', p_application_id;
    END IF;

    -- Log successful execution
    RAISE NOTICE 'Successfully completed save_screening_report for application_id: %', p_application_id;

    RETURN NEXT v_report;
    RETURN;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in save_screening_report: %, SQLSTATE: %', SQLERRM, SQLSTATE;
    RAISE;
END;
$$;


ALTER FUNCTION "public"."save_screening_report"("p_application_id" "uuid", "p_agent_id_val" "uuid", "p_tenant_id_val" "uuid", "p_affordability_score" numeric, "p_affordability_notes" "text", "p_income_verification" boolean, "p_pre_approval_status" "text", "p_recommendation" "text", "p_report_data" "jsonb", "p_background_check_status" "text", "p_credit_score" integer, "p_monthly_income" numeric, "p_credit_report_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_agent_email_address"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    user_first_name TEXT;
    user_role TEXT;
BEGIN
    -- For individual users
    IF NEW.user_id IS NOT NULL THEN
        -- Get user's first name and role
        SELECT first_name, role INTO user_first_name, user_role
        FROM users WHERE id = NEW.user_id;

        -- Only generate email for complete profiles (non-empty first name and non-pending role)
        IF user_first_name IS NOT NULL AND user_first_name != '' AND user_role != 'pending' THEN
            NEW.email_address := generate_agent_email_address(user_first_name, NEW.user_id);
        ELSE
            -- Raise an error if trying to create email for incomplete profile
            RAISE EXCEPTION 'Cannot create email address for user with incomplete profile (first_name: %, role: %)', 
                user_first_name, user_role;
        END IF;

    -- For teams
    ELSIF NEW.team_id IS NOT NULL THEN
        -- Get team admin's company name
        SELECT company_name INTO user_first_name
        FROM users u
        JOIN team_members tm ON u.id = tm.user_id
        WHERE tm.team_id = NEW.team_id AND tm.role = 'admin'
        LIMIT 1;

        -- Only generate email if company name exists
        IF user_first_name IS NOT NULL AND user_first_name != '' THEN
            NEW.email_address := generate_team_email_address(user_first_name, NEW.team_id);
        ELSE
            -- Raise an error if trying to create email for team without company name
            RAISE EXCEPTION 'Cannot create email address for team without company name';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_agent_email_address"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_agent_email_address"() IS 'Generates email addresses only for users with complete profiles (non-empty first name and non-pending role)';



CREATE OR REPLACE FUNCTION "public"."trg_incr_usage_from_screening_report"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM increment_screening_usage(NEW.agent_id);
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_incr_usage_from_screening_report"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_modified_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_modified_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_plans_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_plans_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_team_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF TG_TABLE_NAME = 'team_members' THEN
        INSERT INTO team_stats (team_id, member_count)
        VALUES (COALESCE(NEW.team_id, OLD.team_id), 
               (SELECT COUNT(*) FROM team_members 
                WHERE team_id = COALESCE(NEW.team_id, OLD.team_id)))
        ON CONFLICT (team_id) DO UPDATE SET
            member_count = EXCLUDED.member_count,
            last_updated = now();
    ELSIF TG_TABLE_NAME = 'team_invitations' THEN
        INSERT INTO team_stats (team_id, pending_invites)
        VALUES (COALESCE(NEW.team_id, OLD.team_id),
               (SELECT COUNT(*) FROM team_invitations 
                WHERE team_id = COALESCE(NEW.team_id, OLD.team_id)
                AND status = 'pending'))
        ON CONFLICT (team_id) DO UPDATE SET
            pending_invites = EXCLUDED.pending_invites,
            last_updated = now();
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_team_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."app_settings" IS 'Application settings for internal services like Slack notifications';



CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "property_id" "uuid",
    "agent_id" "uuid",
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "status" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "calendar_event_id" "text",
    CONSTRAINT "appointments_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'cancelled'::"text", 'completed'::"text"])))
);

ALTER TABLE ONLY "public"."appointments" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_integrations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "access_token" "text",
    "token_expiry" timestamp with time zone,
    "calendar_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."calendar_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "risk_type" "text",
    "risk_color" "text",
    "credit_score" integer,
    "thin_file_indicator" boolean DEFAULT false,
    "score_version" "text",
    "score_type" "text",
    "decline_reasons" "jsonb",
    "enquiry_counts" "jsonb",
    "addresses" "jsonb",
    "employers" "jsonb",
    "accounts" "jsonb",
    "public_records" "jsonb",
    "payment_history" boolean,
    "property_details" "jsonb",
    "directors" "jsonb",
    "nlr_summary" "jsonb",
    "raw_data" "jsonb",
    "pdf_file" "text",
    "report_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pdf_path" "text"
);


ALTER TABLE "public"."credit_reports" OWNER TO "postgres";


COMMENT ON COLUMN "public"."credit_reports"."pdf_file" IS 'DEPRECATED: Use pdf_path instead. This column will be removed in a future migration.';



CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "application_id" "uuid",
    "document_type" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "verification_status" "text" NOT NULL,
    "extracted_data" "jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('UTC'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('UTC'::"text", "now"()) NOT NULL,
    "user_id" "uuid",
    "file_name" "text" NOT NULL,
    "file_size" integer NOT NULL,
    "team_id" "uuid",
    CONSTRAINT "documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['id_document'::"text", 'bank_statement'::"text", 'payslip'::"text", 'other'::"text"]))),
    CONSTRAINT "documents_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_addresses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "team_id" "uuid",
    "email_address" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "email_address_format" CHECK (((("user_id" IS NOT NULL) AND ("email_address" ~ '^[a-z]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@n\.agentamara\.com$'::"text")) OR (("team_id" IS NOT NULL) AND ("email_address" ~ '^[a-z0-9]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@n\.agentamara\.com$'::"text")))),
    CONSTRAINT "email_address_owner" CHECK (((("user_id" IS NOT NULL) AND ("team_id" IS NULL)) OR (("user_id" IS NULL) AND ("team_id" IS NOT NULL))))
);


ALTER TABLE "public"."email_addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_ai_suggestions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "message_id" "uuid",
    "suggestion_type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "confidence_score" double precision,
    "is_applied" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_ai_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_attachments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "message_id" "uuid",
    "file_name" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_size" integer NOT NULL,
    "storage_path" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_delivery_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "message_id" "uuid",
    "event_type" "text" NOT NULL,
    "recipient" "text" NOT NULL,
    "status" "text" NOT NULL,
    "error_message" "text",
    "raw_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_delivery_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "access_token" "text",
    "token_expiry" timestamp with time zone,
    "email_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "active" boolean DEFAULT false
);


ALTER TABLE "public"."email_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "thread_id" "uuid",
    "message_id" "text",
    "from_address" "text" NOT NULL,
    "from_name" "text",
    "to_address" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "body_html" "text",
    "status" "public"."email_status" DEFAULT 'received'::"public"."email_status",
    "is_read" boolean DEFAULT false,
    "has_attachments" boolean DEFAULT false,
    "in_reply_to" "text",
    "sent_at" timestamp with time zone,
    "received_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_raw_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "text" NOT NULL,
    "raw_content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_raw_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_raw_messages" IS 'Stores raw email content for future processing and analysis';



COMMENT ON COLUMN "public"."email_raw_messages"."message_id" IS 'References the message_id from email_messages table';



COMMENT ON COLUMN "public"."email_raw_messages"."raw_content" IS 'The complete raw email content including headers and body';



CREATE TABLE IF NOT EXISTS "public"."email_threads" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "team_id" "uuid",
    "subject" "text" NOT NULL,
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "status" "public"."email_status" DEFAULT 'received'::"public"."email_status",
    "priority" "public"."email_priority" DEFAULT 'normal'::"public"."email_priority",
    "needs_follow_up" boolean DEFAULT false,
    "lead_source" "text",
    "property_id" "uuid",
    "tenant_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "email_thread_owner" CHECK (((("user_id" IS NOT NULL) AND ("team_id" IS NULL)) OR (("user_id" IS NULL) AND ("team_id" IS NOT NULL))))
);


ALTER TABLE "public"."email_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_workflows" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "trigger_event" character varying(100) DEFAULT 'email_received'::character varying,
    "email_template" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "email_filter" "jsonb" DEFAULT '{}'::"jsonb",
    "actions" "jsonb" DEFAULT '{}'::"jsonb",
    "team_id" "uuid"
);


ALTER TABLE "public"."email_workflows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "price" integer NOT NULL,
    "usage_limit" integer NOT NULL,
    "description" "text" NOT NULL,
    "extra_usage" "text",
    "is_team_plan" boolean DEFAULT false NOT NULL,
    "max_team_size" integer,
    "popular" boolean DEFAULT false,
    "features" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_paygo" boolean DEFAULT false NOT NULL,
    "price_per_screening" "text"
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."processed_emails" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email_id" "text" NOT NULL,
    "workflow_id" "uuid",
    "processed_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."processed_emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_changes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "subscription_id" "uuid",
    "previous_plan_name" "text" NOT NULL,
    "new_plan_name" "text" NOT NULL,
    "prorated_amount" numeric(10,2) NOT NULL,
    "unused_credits" integer NOT NULL,
    "credit_value" numeric(10,2) NOT NULL,
    "final_amount" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "team_id" "uuid"
);


ALTER TABLE "public"."subscription_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_name" "text" NOT NULL,
    "plan_price" integer NOT NULL,
    "usage_limit" integer NOT NULL,
    "current_usage" integer DEFAULT 0,
    "status" "text" NOT NULL,
    "paystack_subscription_id" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "team_id" "uuid",
    "plan_type" "text",
    "is_team" boolean DEFAULT false,
    CONSTRAINT "subscriptions_plan_type_check" CHECK (("plan_type" = ANY (ARRAY['starter'::"text", 'growth'::"text", 'scale'::"text", 'enterprise'::"text"]))),
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_invitations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "team_id" "uuid",
    "email" "text" NOT NULL,
    "token" "text" NOT NULL,
    "role" "text" DEFAULT 'member'::"text",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    CONSTRAINT "team_invitations_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text"]))),
    CONSTRAINT "team_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."team_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "user_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "role" "text",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "team_members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_stats" (
    "team_id" "uuid" NOT NULL,
    "member_count" integer DEFAULT 0,
    "pending_invites" integer DEFAULT 0,
    "last_updated" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."team_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "subscription_id" "uuid",
    "plan_type" "text",
    "max_members" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "teams_plan_type_check" CHECK (("plan_type" = ANY (ARRAY['starter'::"text", 'growth'::"text", 'scale'::"text", 'enterprise'::"text"])))
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "phone" "text",
    "company_name" "text",
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('UTC'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('UTC'::"text", "now"()) NOT NULL,
    "full_name" "text",
    "user_type" "text",
    "active_team_id" "uuid",
    "is_individual" boolean DEFAULT true,
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['tenant'::"text", 'agent'::"text", 'landlord'::"text", 'pending'::"text"])))
);

ALTER TABLE ONLY "public"."users" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workflow_id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "application_id" "uuid",
    "triggered_at" timestamp with time zone DEFAULT "now"(),
    "status" character varying(50) NOT NULL,
    "error_message" "text",
    "email_subject" "text",
    "email_from" character varying(255),
    "action_taken" "text"
);


ALTER TABLE "public"."workflow_logs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_integrations"
    ADD CONSTRAINT "calendar_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_reports"
    ADD CONSTRAINT "credit_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_addresses"
    ADD CONSTRAINT "email_addresses_email_address_key" UNIQUE ("email_address");



ALTER TABLE ONLY "public"."email_addresses"
    ADD CONSTRAINT "email_addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_ai_suggestions"
    ADD CONSTRAINT "email_ai_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_attachments"
    ADD CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_delivery_logs"
    ADD CONSTRAINT "email_delivery_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_integrations"
    ADD CONSTRAINT "email_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_messages"
    ADD CONSTRAINT "email_messages_message_id_key" UNIQUE ("message_id");



ALTER TABLE ONLY "public"."email_messages"
    ADD CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_raw_messages"
    ADD CONSTRAINT "email_raw_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_threads"
    ADD CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_workflows"
    ADD CONSTRAINT "email_workflows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."processed_emails"
    ADD CONSTRAINT "processed_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."screening_reports"
    ADD CONSTRAINT "screening_reports_application_id_unique" UNIQUE ("application_id");



ALTER TABLE ONLY "public"."screening_reports"
    ADD CONSTRAINT "screening_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_changes"
    ADD CONSTRAINT "subscription_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("user_id", "team_id");



ALTER TABLE ONLY "public"."team_stats"
    ADD CONSTRAINT "team_stats_pkey" PRIMARY KEY ("team_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_profiles"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "unique_tenant_property_application" UNIQUE ("tenant_id", "property_id");



ALTER TABLE ONLY "public"."workflow_logs"
    ADD CONSTRAINT "workflow_logs_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_applications_team_id" ON "public"."applications" USING "btree" ("team_id");



CREATE INDEX "idx_applications_tenant_property" ON "public"."applications" USING "btree" ("tenant_id", "property_id");



CREATE INDEX "idx_credit_reports_tenant_id" ON "public"."credit_reports" USING "btree" ("tenant_id");



CREATE INDEX "idx_documents_team_id" ON "public"."documents" USING "btree" ("team_id");



CREATE INDEX "idx_documents_user_id" ON "public"."documents" USING "btree" ("user_id");



CREATE INDEX "idx_email_messages_is_read" ON "public"."email_messages" USING "btree" ("is_read");



CREATE INDEX "idx_email_messages_received_at" ON "public"."email_messages" USING "btree" ("received_at");



CREATE INDEX "idx_email_messages_sent_at" ON "public"."email_messages" USING "btree" ("sent_at");



CREATE INDEX "idx_email_messages_status" ON "public"."email_messages" USING "btree" ("status");



CREATE INDEX "idx_email_messages_thread_id" ON "public"."email_messages" USING "btree" ("thread_id");



CREATE INDEX "idx_email_raw_messages_message_id" ON "public"."email_raw_messages" USING "btree" ("message_id");



CREATE INDEX "idx_email_threads_needs_follow_up" ON "public"."email_threads" USING "btree" ("needs_follow_up");



CREATE INDEX "idx_email_threads_status" ON "public"."email_threads" USING "btree" ("status");



CREATE INDEX "idx_email_threads_team_id" ON "public"."email_threads" USING "btree" ("team_id");



CREATE INDEX "idx_properties_team_id" ON "public"."properties" USING "btree" ("team_id");



CREATE INDEX "idx_screening_reports_credit_report_id" ON "public"."screening_reports" USING "btree" ("credit_report_id");



CREATE INDEX "idx_screening_reports_team_id" ON "public"."screening_reports" USING "btree" ("team_id");



CREATE INDEX "idx_screening_reports_tenant_id" ON "public"."screening_reports" USING "btree" ("tenant_id");



CREATE INDEX "idx_subscription_changes_subscription_id" ON "public"."subscription_changes" USING "btree" ("subscription_id");



CREATE INDEX "idx_subscription_changes_team_id" ON "public"."subscription_changes" USING "btree" ("team_id");



CREATE INDEX "idx_subscriptions_user_id" ON "public"."subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_team_invitations_email" ON "public"."team_invitations" USING "btree" ("email");



CREATE INDEX "idx_team_invitations_team_id" ON "public"."team_invitations" USING "btree" ("team_id");



CREATE INDEX "idx_team_invitations_token" ON "public"."team_invitations" USING "btree" ("token");



CREATE INDEX "idx_team_members_role" ON "public"."team_members" USING "btree" ("role");



CREATE INDEX "idx_team_members_team_id" ON "public"."team_members" USING "btree" ("team_id");



CREATE INDEX "idx_team_members_user_id" ON "public"."team_members" USING "btree" ("user_id");



CREATE INDEX "idx_team_members_user_team" ON "public"."team_members" USING "btree" ("user_id", "team_id");



CREATE INDEX "team_members_team_user_idx" ON "public"."team_members" USING "btree" ("team_id", "user_id");



CREATE OR REPLACE TRIGGER "on_profile_completion" AFTER UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_profile_completion"();



CREATE OR REPLACE TRIGGER "on_subscription_notification" AFTER INSERT ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_subscription_notification"();



CREATE OR REPLACE TRIGGER "on_user_notification" AFTER INSERT OR UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_user_notification"();



CREATE OR REPLACE TRIGGER "set_agent_email_address_trigger" BEFORE INSERT ON "public"."email_addresses" FOR EACH ROW EXECUTE FUNCTION "public"."set_agent_email_address"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."email_addresses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."email_ai_suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."email_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."email_raw_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."email_threads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "subscription_change_trigger" AFTER UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_subscription_change"();



CREATE OR REPLACE TRIGGER "trg_after_ins_screening_reports" AFTER INSERT ON "public"."screening_reports" FOR EACH ROW EXECUTE FUNCTION "public"."trg_incr_usage_from_screening_report"();



CREATE OR REPLACE TRIGGER "update_applications_modtime" BEFORE UPDATE ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_documents_modtime" BEFORE UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_plans_updated_at" BEFORE UPDATE ON "public"."plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_plans_updated_at"();



CREATE OR REPLACE TRIGGER "update_profiles_modtime" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_properties_modtime" BEFORE UPDATE ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_screening_reports_modtime" BEFORE UPDATE ON "public"."screening_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_team_invitation_stats" AFTER INSERT OR DELETE OR UPDATE ON "public"."team_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."update_team_stats"();



CREATE OR REPLACE TRIGGER "update_team_member_stats" AFTER INSERT OR DELETE OR UPDATE ON "public"."team_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_team_stats"();



CREATE OR REPLACE TRIGGER "update_teams_updated_at" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tenants_modtime" BEFORE UPDATE ON "public"."tenant_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant_profiles"("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_integrations"
    ADD CONSTRAINT "calendar_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."credit_reports"
    ADD CONSTRAINT "credit_reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_addresses"
    ADD CONSTRAINT "email_addresses_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_addresses"
    ADD CONSTRAINT "email_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_ai_suggestions"
    ADD CONSTRAINT "email_ai_suggestions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_attachments"
    ADD CONSTRAINT "email_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_delivery_logs"
    ADD CONSTRAINT "email_delivery_logs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_integrations"
    ADD CONSTRAINT "email_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."email_messages"
    ADD CONSTRAINT "email_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_raw_messages"
    ADD CONSTRAINT "email_raw_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("message_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_threads"
    ADD CONSTRAINT "email_threads_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_threads"
    ADD CONSTRAINT "email_threads_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_threads"
    ADD CONSTRAINT "email_threads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_threads"
    ADD CONSTRAINT "email_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_workflows"
    ADD CONSTRAINT "email_workflows_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_workflows"
    ADD CONSTRAINT "email_workflows_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."processed_emails"
    ADD CONSTRAINT "processed_emails_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."email_workflows"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."screening_reports"
    ADD CONSTRAINT "screening_reports_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."screening_reports"
    ADD CONSTRAINT "screening_reports_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id");



ALTER TABLE ONLY "public"."screening_reports"
    ADD CONSTRAINT "screening_reports_credit_report_id_fkey" FOREIGN KEY ("credit_report_id") REFERENCES "public"."credit_reports"("id");



ALTER TABLE ONLY "public"."screening_reports"
    ADD CONSTRAINT "screening_reports_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."screening_reports"
    ADD CONSTRAINT "screening_reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant_profiles"("id");



ALTER TABLE ONLY "public"."subscription_changes"
    ADD CONSTRAINT "subscription_changes_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id");



ALTER TABLE ONLY "public"."subscription_changes"
    ADD CONSTRAINT "subscription_changes_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."subscription_changes"
    ADD CONSTRAINT "subscription_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_stats"
    ADD CONSTRAINT "team_stats_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id");



ALTER TABLE ONLY "public"."tenant_profiles"
    ADD CONSTRAINT "tenants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_active_team_id_fkey" FOREIGN KEY ("active_team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."workflow_logs"
    ADD CONSTRAINT "workflow_logs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id");



ALTER TABLE ONLY "public"."workflow_logs"
    ADD CONSTRAINT "workflow_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant_profiles"("id");



ALTER TABLE ONLY "public"."workflow_logs"
    ADD CONSTRAINT "workflow_logs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "public"."email_workflows"("id") ON DELETE CASCADE;



CREATE POLICY "Agents and Tenants can update their appointments" ON "public"."appointments" FOR UPDATE TO "authenticated" USING ((((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'agent'::"text")))) AND ("agent_id" = "auth"."uid"())) OR ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'tenant'::"text")))) AND (EXISTS ( SELECT 1
   FROM "public"."tenant_profiles" "tp"
  WHERE (("tp"."id" = "appointments"."tenant_id") AND ("tp"."tenant_id" = "auth"."uid"()))))))) WITH CHECK ((((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'agent'::"text")))) AND ("agent_id" = "auth"."uid"())) OR ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'tenant'::"text")))) AND (EXISTS ( SELECT 1
   FROM "public"."tenant_profiles" "tp"
  WHERE (("tp"."id" = "appointments"."tenant_id") AND ("tp"."tenant_id" = "auth"."uid"())))))));



CREATE POLICY "Agents and landlords can view screening reports" ON "public"."screening_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role" = 'agent'::"text") OR ("users"."role" = 'landlord'::"text"))))));



CREATE POLICY "Agents can delete their appointments" ON "public"."appointments" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'agent'::"text")))) AND ("agent_id" = "auth"."uid"())));



CREATE POLICY "Agents can delete their properties" ON "public"."properties" FOR DELETE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can insert applications for their properties" ON "public"."applications" FOR INSERT WITH CHECK ((("agent_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."properties"
  WHERE (("properties"."id" = "applications"."property_id") AND ("properties"."agent_id" = "auth"."uid"()))))));



CREATE POLICY "Agents can insert screening reports for their applications" ON "public"."screening_reports" FOR INSERT WITH CHECK ((("agent_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."applications"
  WHERE (("applications"."id" = "screening_reports"."application_id") AND ("applications"."agent_id" = "auth"."uid"()))))));



CREATE POLICY "Agents can insert their properties" ON "public"."properties" FOR INSERT WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can manage appointments" ON "public"."appointments" TO "authenticated" USING ((("auth"."uid"() = "agent_id") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"text", 'landlord'::"text"])))))));



CREATE POLICY "Agents can manage their properties" ON "public"."properties" TO "authenticated" USING (((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = ANY (ARRAY['agent'::"text", 'landlord'::"text"])) AND ("agent_id" = "auth"."uid"()))) WITH CHECK (((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = ANY (ARRAY['agent'::"text", 'landlord'::"text"])) AND ("agent_id" = "auth"."uid"())));



CREATE POLICY "Agents can update applications for their properties" ON "public"."applications" FOR UPDATE TO "authenticated" USING (((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = ANY (ARRAY['agent'::"text", 'landlord'::"text"])) AND (("agent_id" = "auth"."uid"()) OR ("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."agent_id" = "auth"."uid"()))))));



CREATE POLICY "Agents can update tenants from their applications" ON "public"."tenant_profiles" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."applications"
  WHERE (("applications"."tenant_id" = "tenant_profiles"."id") AND ("applications"."agent_id" = "auth"."uid"())))));



CREATE POLICY "Agents can update their applications" ON "public"."applications" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can update their properties" ON "public"."properties" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can update their screening reports" ON "public"."screening_reports" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view applications for their properties" ON "public"."applications" FOR SELECT TO "authenticated" USING (((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = ANY (ARRAY['agent'::"text", 'landlord'::"text"])) AND (("agent_id" = "auth"."uid"()) OR ("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."agent_id" = "auth"."uid"()))))));



CREATE POLICY "Agents can view credit reports for their tenants" ON "public"."credit_reports" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."screening_reports" "sr"
     JOIN "public"."applications" "a" ON (("sr"."application_id" = "a"."id")))
     JOIN "public"."properties" "p" ON (("a"."property_id" = "p"."id")))
  WHERE (("sr"."credit_report_id" = "credit_reports"."id") AND ("p"."agent_id" = "auth"."uid"())))));



CREATE POLICY "Agents can view documents for their applications" ON "public"."documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."applications"
  WHERE (("applications"."id" = "documents"."application_id") AND ("applications"."agent_id" = "auth"."uid"())))));



CREATE POLICY "Agents can view tenant profiles" ON "public"."tenant_profiles" FOR SELECT TO "authenticated" USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = ANY (ARRAY['agent'::"text", 'landlord'::"text"])));



CREATE POLICY "Agents can view tenants from their applications" ON "public"."tenant_profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."applications"
  WHERE (("applications"."tenant_id" = "tenant_profiles"."id") AND ("applications"."agent_id" = "auth"."uid"())))));



CREATE POLICY "Agents can view their applications" ON "public"."applications" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view their properties" ON "public"."properties" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Agents can view their screening reports" ON "public"."screening_reports" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "Allow agents to insert reports" ON "public"."screening_reports" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "applications"."agent_id"
   FROM "public"."applications"
  WHERE ("applications"."id" = "screening_reports"."application_id"))));



CREATE POLICY "Allow agents to update reports" ON "public"."screening_reports" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "applications"."agent_id"
   FROM "public"."applications"
  WHERE ("applications"."id" = "screening_reports"."application_id"))));



CREATE POLICY "Allow authenticated users to select their appointments" ON "public"."appointments" FOR SELECT TO "authenticated" USING ((((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'agent'::"text")))) AND ("agent_id" = "auth"."uid"())) OR ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'tenant'::"text")))) AND (EXISTS ( SELECT 1
   FROM "public"."tenant_profiles" "tp"
  WHERE (("tp"."id" = "appointments"."tenant_id") AND ("tp"."tenant_id" = "auth"."uid"())))))));



CREATE POLICY "Allow read access to all authenticated users" ON "public"."plans" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow tenant to insert appointment for approved application" ON "public"."appointments" FOR INSERT TO "authenticated" WITH CHECK ((("id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."applications" "app"
  WHERE (("app"."id" = "auth"."uid"()) AND ("app"."property_id" = "appointments"."property_id") AND ("app"."status" = 'approved'::"text"))))));



CREATE POLICY "Allow tenants to insert reports" ON "public"."screening_reports" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "applications"."tenant_id"
   FROM "public"."applications"
  WHERE ("applications"."id" = "screening_reports"."application_id"))));



CREATE POLICY "Allow user to delete own credit reports" ON "public"."credit_reports" FOR DELETE TO "authenticated" USING (("tenant_id" IN ( SELECT "tenant_profiles"."id"
   FROM "public"."tenant_profiles"
  WHERE ("tenant_profiles"."tenant_id" = "auth"."uid"()))));



CREATE POLICY "Allow user to delete own subscriptions" ON "public"."subscriptions" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Allow user to insert own credit reports" ON "public"."credit_reports" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" IN ( SELECT "tenant_profiles"."id"
   FROM "public"."tenant_profiles"
  WHERE ("tenant_profiles"."tenant_id" = "auth"."uid"()))));



CREATE POLICY "Allow user to update own credit reports" ON "public"."credit_reports" FOR UPDATE TO "authenticated" USING (("tenant_id" IN ( SELECT "tenant_profiles"."id"
   FROM "public"."tenant_profiles"
  WHERE ("tenant_profiles"."tenant_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "tenant_profiles"."id"
   FROM "public"."tenant_profiles"
  WHERE ("tenant_profiles"."tenant_id" = "auth"."uid"()))));



CREATE POLICY "Allow user to update own subscriptions" ON "public"."subscriptions" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Allow user to view own or associated credit reports" ON "public"."credit_reports" FOR SELECT TO "authenticated" USING ((("tenant_id" IN ( SELECT "tenant_profiles"."id"
   FROM "public"."tenant_profiles"
  WHERE ("tenant_profiles"."tenant_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM ("public"."applications" "a"
     JOIN "public"."tenant_profiles" "tp" ON (("tp"."id" = "a"."tenant_id")))
  WHERE (("tp"."id" = "credit_reports"."tenant_id") AND ("a"."agent_id" = "auth"."uid"()))))));



CREATE POLICY "Allow user to view own subscriptions" ON "public"."subscriptions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Allow users to view their own reports" ON "public"."screening_reports" FOR SELECT USING ((("auth"."uid"() IN ( SELECT "applications"."tenant_id"
   FROM "public"."applications"
  WHERE ("applications"."id" = "screening_reports"."application_id"))) OR ("auth"."uid"() IN ( SELECT "applications"."agent_id"
   FROM "public"."applications"
  WHERE ("applications"."id" = "screening_reports"."application_id")))));



CREATE POLICY "Allow view of own data or any agent" ON "public"."users" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR ("role" = 'agent'::"text")));



CREATE POLICY "Anyone can insert documents" ON "public"."documents" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert tenants" ON "public"."tenant_profiles" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can read available properties" ON "public"."properties" FOR SELECT USING (("status" = 'available'::"text"));



CREATE POLICY "Anyone can view properties with application links" ON "public"."properties" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Owners can delete their properties" ON "public"."properties" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "agent_id"));



CREATE POLICY "Owners can read their properties" ON "public"."properties" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "agent_id"));



CREATE POLICY "Owners can update their properties" ON "public"."properties" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "agent_id"));



CREATE POLICY "Property owners can manage appointments" ON "public"."appointments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."properties"
  WHERE (("properties"."id" = "appointments"."property_id") AND ("properties"."agent_id" = "auth"."uid"())))));



CREATE POLICY "Service role can access all settings" ON "public"."app_settings" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role has full access" ON "public"."credit_reports" TO "authenticated", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service roles have full access to applications" ON "public"."applications" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service roles have full access to properties" ON "public"."properties" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service roles have full access to tenant_profiles" ON "public"."tenant_profiles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Team admins can delete their teams" ON "public"."teams" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "teams"."id") AND ("team_members"."user_id" = "auth"."uid"()) AND ("team_members"."role" = 'admin'::"text")))));



CREATE POLICY "Team admins can update their teams" ON "public"."teams" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "teams"."id") AND ("team_members"."user_id" = "auth"."uid"()) AND ("team_members"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "teams"."id") AND ("team_members"."user_id" = "auth"."uid"()) AND ("team_members"."role" = 'admin'::"text")))));



CREATE POLICY "Team members can access team documents" ON "public"."documents" USING (((("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "documents"."team_id") AND ("team_members"."user_id" = "auth"."uid"()))))) OR (("team_id" IS NULL) AND ("user_id" = "auth"."uid"())))) WITH CHECK (((("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "documents"."team_id") AND ("team_members"."user_id" = "auth"."uid"()))))) OR (("team_id" IS NULL) AND ("user_id" = "auth"."uid"()))));



CREATE POLICY "Team members can access team properties" ON "public"."properties" USING (((("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "properties"."team_id") AND ("team_members"."user_id" = "auth"."uid"()))))) OR (("team_id" IS NULL) AND ("agent_id" = "auth"."uid"())))) WITH CHECK (((("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "properties"."team_id") AND ("team_members"."user_id" = "auth"."uid"()))))) OR (("team_id" IS NULL) AND ("agent_id" = "auth"."uid"()))));



CREATE POLICY "Team members can access team workflows" ON "public"."email_workflows" USING (((("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "email_workflows"."team_id") AND ("team_members"."user_id" = "auth"."uid"()))))) OR (("team_id" IS NULL) AND ("agent_id" = "auth"."uid"())))) WITH CHECK (((("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "email_workflows"."team_id") AND ("team_members"."user_id" = "auth"."uid"()))))) OR (("team_id" IS NULL) AND ("agent_id" = "auth"."uid"()))));



CREATE POLICY "Team members can view their team's raw messages" ON "public"."email_raw_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."email_messages" "em"
     JOIN "public"."email_threads" "et" ON (("em"."thread_id" = "et"."id")))
  WHERE (("em"."message_id" = "email_raw_messages"."message_id") AND ("et"."team_id" IN ( SELECT "team_members"."team_id"
           FROM "public"."team_members"
          WHERE ("team_members"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Tenants can access own profile" ON "public"."tenant_profiles" FOR SELECT TO "authenticated" USING (("tenant_id" = "auth"."uid"()));



CREATE POLICY "Tenants can create appointments for their profile" ON "public"."appointments" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'tenant'::"text")))) AND (EXISTS ( SELECT 1
   FROM "public"."tenant_profiles" "tp"
  WHERE (("tp"."id" = "appointments"."tenant_id") AND ("tp"."tenant_id" = "auth"."uid"()))))));



CREATE POLICY "Tenants can create own profile" ON "public"."tenant_profiles" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "auth"."uid"()));



CREATE POLICY "Tenants can create their own applications" ON "public"."applications" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_tenant_create_application"("auth"."uid"()));



CREATE POLICY "Tenants can insert their own screening reports" ON "public"."screening_reports" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tenant_profiles"
  WHERE (("tenant_profiles"."id" = "screening_reports"."tenant_id") AND ("tenant_profiles"."tenant_id" = "auth"."uid"())))));



CREATE POLICY "Tenants can read own profile" ON "public"."tenant_profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "tenant_id"));



CREATE POLICY "Tenants can update own profile" ON "public"."tenant_profiles" FOR UPDATE TO "authenticated" USING (("tenant_id" = "auth"."uid"()));



CREATE POLICY "Tenants can view own screening reports" ON "public"."screening_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tenant_profiles"
  WHERE (("tenant_profiles"."tenant_id" = "auth"."uid"()) AND ("tenant_profiles"."id" = "screening_reports"."tenant_id")))));



CREATE POLICY "Tenants can view their own applications" ON "public"."applications" FOR SELECT TO "authenticated" USING ("public"."can_view_application"("auth"."uid"(), "tenant_id"));



CREATE POLICY "Tenants can view their own screening reports" ON "public"."screening_reports" FOR SELECT USING ((("auth"."uid"() = "tenant_id") OR ("auth"."uid"() IN ( SELECT "applications"."agent_id"
   FROM "public"."applications"
  WHERE ("applications"."id" = "screening_reports"."application_id")))));



CREATE POLICY "Users can create own profile" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can delete own calendar integrations" ON "public"."calendar_integrations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own documents" ON "public"."documents" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own email integrations" ON "public"."email_integrations" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own documents" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own email addresses" ON "public"."email_addresses" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR (("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "email_addresses"."team_id") AND ("team_members"."user_id" = "auth"."uid"()) AND ("team_members"."role" = 'admin'::"text")))))));



CREATE POLICY "Users can insert their own email integrations" ON "public"."email_integrations" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own email messages" ON "public"."email_messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."email_threads"
     JOIN "public"."team_members" ON (("team_members"."team_id" = "email_threads"."team_id")))
  WHERE (("email_threads"."id" = "email_messages"."thread_id") AND ("team_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own email threads" ON "public"."email_threads" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "email_threads"."team_id") AND ("team_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can read own documents" ON "public"."documents" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their appointments" ON "public"."appointments" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "tenant_id") OR ("auth"."uid"() = "agent_id") OR (EXISTS ( SELECT 1
   FROM "public"."properties"
  WHERE (("properties"."id" = "appointments"."property_id") AND ("properties"."agent_id" = "auth"."uid"()))))));



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own documents" ON "public"."documents" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own email addresses" ON "public"."email_addresses" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "email_addresses"."team_id") AND ("team_members"."user_id" = "auth"."uid"()) AND ("team_members"."role" = 'admin'::"text")))))));



CREATE POLICY "Users can update their own email integrations" ON "public"."email_integrations" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own email messages" ON "public"."email_messages" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."email_threads"
     JOIN "public"."team_members" ON (("team_members"."team_id" = "email_threads"."team_id")))
  WHERE (("email_threads"."id" = "email_messages"."thread_id") AND ("team_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own email threads" ON "public"."email_threads" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "email_threads"."team_id") AND ("team_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can update their own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can upload own documents" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view members of their teams" ON "public"."team_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."team_members" "my_teams"
  WHERE (("my_teams"."team_id" = "team_members"."team_id") AND ("my_teams"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own calendar integrations" ON "public"."calendar_integrations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their appointments" ON "public"."appointments" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "tenant_id") OR (("auth"."uid"() = "agent_id") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['agent'::"text", 'landlord'::"text"])))))) OR (EXISTS ( SELECT 1
   FROM "public"."properties"
  WHERE (("properties"."id" = "appointments"."property_id") AND ("properties"."agent_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view their own credit reports through screening repor" ON "public"."credit_reports" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM ("public"."screening_reports" "sr"
     JOIN "public"."applications" "a" ON (("sr"."application_id" = "a"."id")))
  WHERE (("sr"."credit_report_id" = "credit_reports"."id") AND ("a"."tenant_id" = "auth"."uid"())))) OR ("tenant_id" = "auth"."uid"())));



CREATE POLICY "Users can view their own documents" ON "public"."documents" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own email addresses" ON "public"."email_addresses" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("team_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "email_addresses"."team_id") AND ("team_members"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view their own email integrations" ON "public"."email_integrations" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own email messages" ON "public"."email_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."email_threads"
  WHERE (("email_threads"."id" = "email_messages"."thread_id") AND (("email_threads"."user_id" = "auth"."uid"()) OR ("email_threads"."team_id" IN ( SELECT "team_members"."team_id"
           FROM "public"."team_members"
          WHERE ("team_members"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Users can view their own email threads" ON "public"."email_threads" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "email_threads"."team_id") AND ("team_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view their own profile" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users view own subscription changes" ON "public"."subscription_changes" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("team_id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE ("team_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "admins_manage_invitations" ON "public"."team_invitations" TO "authenticated" USING ("public"."is_team_admin"("team_id", "auth"."uid"()));



CREATE POLICY "agents_delete_own_workflows" ON "public"."email_workflows" FOR DELETE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "agents_insert_own_workflows" ON "public"."email_workflows" FOR INSERT WITH CHECK (("agent_id" = "auth"."uid"()));



CREATE POLICY "agents_select_own_workflows" ON "public"."email_workflows" FOR SELECT USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "agents_update_own_workflows" ON "public"."email_workflows" FOR UPDATE USING (("agent_id" = "auth"."uid"()));



CREATE POLICY "agents_view_own_workflow_logs" ON "public"."workflow_logs" FOR SELECT USING (("workflow_id" IN ( SELECT "email_workflows"."id"
   FROM "public"."email_workflows"
  WHERE ("email_workflows"."agent_id" = "auth"."uid"()))));



ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_ai_suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_delivery_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_raw_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_workflows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enforce_team_member_limit_on_invite" ON "public"."team_invitations" FOR INSERT TO "authenticated" WITH CHECK (("public"."check_team_member_limit"("team_id") AND (EXISTS ( SELECT 1
   FROM "public"."team_members" "tm"
  WHERE (("tm"."team_id" = "team_invitations"."team_id") AND ("tm"."user_id" = "auth"."uid"()) AND ("tm"."role" = 'admin'::"text"))))));



CREATE POLICY "enforce_team_member_limit_on_join" ON "public"."team_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."check_team_member_limit"("team_id"));



ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."processed_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "require_active_subscription_for_invite" ON "public"."team_invitations" FOR INSERT TO "authenticated" WITH CHECK ("public"."check_team_subscription"("team_id"));



ALTER TABLE "public"."screening_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_full_access" ON "public"."processed_emails" USING (((("current_setting"('request.jwt.claims'::"text", true))::"json" ->> 'role'::"text") = 'service_role'::"text"));



ALTER TABLE "public"."subscription_changes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions_policy" ON "public"."subscriptions" USING (true);



ALTER TABLE "public"."team_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_member_management" ON "public"."team_members" TO "authenticated" USING ("public"."is_team_admin_safe"("team_id")) WITH CHECK ("public"."is_team_admin_safe"("team_id"));



CREATE POLICY "team_resource_access_applications" ON "public"."applications" TO "authenticated" USING ((("agent_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "applications"."team_id") AND ("team_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "team_resource_access_documents" ON "public"."documents" TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "documents"."team_id") AND ("team_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "team_resource_access_properties" ON "public"."properties" TO "authenticated" USING ((("agent_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "properties"."team_id") AND ("team_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "team_resource_access_screening_reports" ON "public"."screening_reports" TO "authenticated" USING ((("agent_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "screening_reports"."team_id") AND ("team_members"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_read_access" ON "public"."processed_emails" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."email_workflows"
  WHERE (("email_workflows"."id" = "processed_emails"."workflow_id") AND ("email_workflows"."agent_id" = "auth"."uid"())))));



CREATE POLICY "user_teams_view" ON "public"."teams" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "teams"."id") AND ("team_members"."user_id" = "auth"."uid"()))
 OFFSET 0)));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_can_create_teams" ON "public"."teams" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "users_view_own_invitations" ON "public"."team_invitations" FOR SELECT TO "authenticated" USING (("email" = ( SELECT "users"."email"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "users_view_own_team_memberships" ON "public"."team_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_view_own_team_stats" ON "public"."team_stats" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "team_stats"."team_id") AND ("team_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "users_view_own_teams" ON "public"."teams" FOR SELECT TO "authenticated" USING ((("id" IN ( SELECT "team_members"."team_id"
   FROM "public"."team_members"
  WHERE ("team_members"."user_id" = "auth"."uid"()))) OR ("created_by" = "auth"."uid"())));



ALTER TABLE "public"."workflow_logs" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;















GRANT ALL ON FUNCTION "public"."can_tenant_create_application"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_tenant_create_application"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_tenant_create_application"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_view_application"("user_id" "uuid", "application_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_application"("user_id" "uuid", "application_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_application"("user_id" "uuid", "application_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_application_exists"("tenant_id_param" "uuid", "property_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_application_exists"("tenant_id_param" "uuid", "property_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_application_exists"("tenant_id_param" "uuid", "property_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_team_member_limit"("p_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_team_member_limit"("p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_team_member_limit"("p_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_team_subscription"("p_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_team_subscription"("p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_team_subscription"("p_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_profile_from_auth"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_profile_from_auth"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_profile_from_auth"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_tenant_profile"("p_tenant_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_current_address" "text", "p_id_number" "text", "p_employment_status" "text", "p_monthly_income" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."create_tenant_profile"("p_tenant_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_current_address" "text", "p_id_number" "text", "p_employment_status" "text", "p_monthly_income" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_tenant_profile"("p_tenant_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_current_address" "text", "p_id_number" "text", "p_employment_status" "text", "p_monthly_income" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_agent_email_address"("p_first_name" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_agent_email_address"("p_first_name" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_agent_email_address"("p_first_name" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_team_email_address"("p_company_name" "text", "p_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_team_email_address"("p_company_name" "text", "p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_team_email_address"("p_company_name" "text", "p_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_app_setting"("setting_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_app_setting"("setting_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_app_setting"("setting_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_application_id_if_exists"("tenant_id_param" "uuid", "property_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_application_id_if_exists"("tenant_id_param" "uuid", "property_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_application_id_if_exists"("tenant_id_param" "uuid", "property_id_param" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."applications" TO "anon";
GRANT ALL ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_existing_application"("p_tenant_id" "uuid", "p_property_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_existing_application"("p_tenant_id" "uuid", "p_property_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_existing_application"("p_tenant_id" "uuid", "p_property_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."properties" TO "anon";
GRANT ALL ON TABLE "public"."properties" TO "authenticated";
GRANT ALL ON TABLE "public"."properties" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_property_by_token"("token_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_property_by_token"("token_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_property_by_token"("token_param" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_screening_report"("id_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_screening_report"("id_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_screening_report"("id_param" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tenant_applications_for_property"("tenant_id_param" "uuid", "property_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tenant_applications_for_property"("tenant_id_param" "uuid", "property_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tenant_applications_for_property"("tenant_id_param" "uuid", "property_id_param" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."tenant_profiles" TO "anon";
GRANT ALL ON TABLE "public"."tenant_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_profiles" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tenant_profile_for_user"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tenant_profile_for_user"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tenant_profile_for_user"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_test_email_address"("p_user_id" "uuid", "p_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_test_email_address"("p_user_id" "uuid", "p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_test_email_address"("p_user_id" "uuid", "p_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_profile_completion"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_profile_completion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_profile_completion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_subscription_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_subscription_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_subscription_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_subscription_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_subscription_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_subscription_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_user_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_user_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_user_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_screening_usage"("p_agent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_screening_usage"("p_agent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_screening_usage"("p_agent_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_application"("p_property_id" "uuid", "p_agent_id" "uuid", "p_tenant_id" "uuid", "p_employer" "text", "p_employment_duration" numeric, "p_monthly_income" numeric, "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_application"("p_property_id" "uuid", "p_agent_id" "uuid", "p_tenant_id" "uuid", "p_employer" "text", "p_employment_duration" numeric, "p_monthly_income" numeric, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_application"("p_property_id" "uuid", "p_agent_id" "uuid", "p_tenant_id" "uuid", "p_employer" "text", "p_employment_duration" numeric, "p_monthly_income" numeric, "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_application_safe"("p_property_id" "uuid", "p_agent_id" "uuid", "p_tenant_id" "uuid", "p_employer" "text", "p_employment_duration" integer, "p_monthly_income" numeric, "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_application_safe"("p_property_id" "uuid", "p_agent_id" "uuid", "p_tenant_id" "uuid", "p_employer" "text", "p_employment_duration" integer, "p_monthly_income" numeric, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_application_safe"("p_property_id" "uuid", "p_agent_id" "uuid", "p_tenant_id" "uuid", "p_employer" "text", "p_employment_duration" integer, "p_monthly_income" numeric, "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_admin"("p_team_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_admin"("p_team_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_admin"("p_team_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_admin_safe"("p_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_admin_safe"("p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_admin_safe"("p_team_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."screening_reports" TO "anon";
GRANT ALL ON TABLE "public"."screening_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."screening_reports" TO "service_role";



GRANT ALL ON FUNCTION "public"."save_screening_report"("p_application_id" "uuid", "p_agent_id_val" "uuid", "p_tenant_id_val" "uuid", "p_affordability_score" numeric, "p_affordability_notes" "text", "p_income_verification" boolean, "p_pre_approval_status" "text", "p_recommendation" "text", "p_report_data" "jsonb", "p_background_check_status" "text", "p_credit_score" integer, "p_monthly_income" numeric, "p_credit_report_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."save_screening_report"("p_application_id" "uuid", "p_agent_id_val" "uuid", "p_tenant_id_val" "uuid", "p_affordability_score" numeric, "p_affordability_notes" "text", "p_income_verification" boolean, "p_pre_approval_status" "text", "p_recommendation" "text", "p_report_data" "jsonb", "p_background_check_status" "text", "p_credit_score" integer, "p_monthly_income" numeric, "p_credit_report_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_screening_report"("p_application_id" "uuid", "p_agent_id_val" "uuid", "p_tenant_id_val" "uuid", "p_affordability_score" numeric, "p_affordability_notes" "text", "p_income_verification" boolean, "p_pre_approval_status" "text", "p_recommendation" "text", "p_report_data" "jsonb", "p_background_check_status" "text", "p_credit_score" integer, "p_monthly_income" numeric, "p_credit_report_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_agent_email_address"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_agent_email_address"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_agent_email_address"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_incr_usage_from_screening_report"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_incr_usage_from_screening_report"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_incr_usage_from_screening_report"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_plans_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_plans_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_plans_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_team_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_team_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_team_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



























GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_integrations" TO "anon";
GRANT ALL ON TABLE "public"."calendar_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."credit_reports" TO "anon";
GRANT ALL ON TABLE "public"."credit_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_reports" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."email_addresses" TO "anon";
GRANT ALL ON TABLE "public"."email_addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."email_addresses" TO "service_role";



GRANT ALL ON TABLE "public"."email_ai_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."email_ai_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."email_ai_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."email_attachments" TO "anon";
GRANT ALL ON TABLE "public"."email_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."email_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."email_delivery_logs" TO "anon";
GRANT ALL ON TABLE "public"."email_delivery_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."email_delivery_logs" TO "service_role";



GRANT ALL ON TABLE "public"."email_integrations" TO "anon";
GRANT ALL ON TABLE "public"."email_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."email_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."email_messages" TO "anon";
GRANT ALL ON TABLE "public"."email_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."email_messages" TO "service_role";



GRANT ALL ON TABLE "public"."email_raw_messages" TO "anon";
GRANT ALL ON TABLE "public"."email_raw_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."email_raw_messages" TO "service_role";



GRANT ALL ON TABLE "public"."email_threads" TO "anon";
GRANT ALL ON TABLE "public"."email_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."email_threads" TO "service_role";



GRANT ALL ON TABLE "public"."email_workflows" TO "anon";
GRANT ALL ON TABLE "public"."email_workflows" TO "authenticated";
GRANT ALL ON TABLE "public"."email_workflows" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."processed_emails" TO "anon";
GRANT ALL ON TABLE "public"."processed_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."processed_emails" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_changes" TO "anon";
GRANT ALL ON TABLE "public"."subscription_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_changes" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."team_invitations" TO "anon";
GRANT ALL ON TABLE "public"."team_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."team_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."team_stats" TO "anon";
GRANT ALL ON TABLE "public"."team_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."team_stats" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_logs" TO "anon";
GRANT ALL ON TABLE "public"."workflow_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_logs" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
