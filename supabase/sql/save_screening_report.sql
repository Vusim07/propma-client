-- Drop the function first to ensure clean update
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT 'DROP FUNCTION IF EXISTS public.save_screening_report(' ||
               pg_get_function_identity_arguments(p.oid) || ');' AS drop_stmt
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = 'save_screening_report'
          AND n.nspname = 'public'
    LOOP
        EXECUTE r.drop_stmt;
    END LOOP;
END $$;

-- Recreate the function with proper application status update
CREATE OR REPLACE FUNCTION public.save_screening_report(
    p_application_id uuid,
    p_agent_id_val uuid,
    p_tenant_id_val uuid,
    p_affordability_score numeric,
    p_affordability_notes text,
    p_income_verification boolean,
    p_pre_approval_status text,
    p_recommendation text,
    p_report_data jsonb,
    p_background_check_status text,
    p_credit_score integer,
    p_monthly_income numeric,
    p_credit_report_id uuid
)
RETURNS SETOF screening_reports AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;