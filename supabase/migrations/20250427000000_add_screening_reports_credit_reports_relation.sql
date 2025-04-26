-- Add credit_report_id column to screening_reports table
ALTER TABLE screening_reports 
ADD COLUMN IF NOT EXISTS credit_report_id UUID REFERENCES credit_reports(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_screening_reports_credit_report_id 
ON screening_reports(credit_report_id);

-- Update RLS policy for credit_reports to allow access via screening_reports
ALTER POLICY "Allow user to view own or associated credit reports"
ON public.credit_reports
USING (
    EXISTS (
        SELECT 1
        FROM public.tenant_profiles
        WHERE tenant_profiles.id = credit_reports.tenant_id
        AND tenant_profiles.tenant_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1
        FROM public.applications
        JOIN public.screening_reports ON applications.id = screening_reports.application_id
        WHERE screening_reports.credit_report_id = credit_reports.id
        AND applications.agent_id = auth.uid()
    )
);

-- Add comment explaining the relationship
COMMENT ON COLUMN screening_reports.credit_report_id IS 'References the credit report associated with this screening report.';