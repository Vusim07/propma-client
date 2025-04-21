-- Enable RLS on the credit_reports table
ALTER TABLE public.credit_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to view credit reports linked to their tenant profile or their applications
CREATE POLICY "Allow user to view own or associated credit reports"
ON public.credit_reports
FOR SELECT
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
        WHERE applications.tenant_id = credit_reports.tenant_id
        AND applications.agent_id = auth.uid()
    )
);

-- Policy: Allow users to insert credit reports linked to their tenant profile
CREATE POLICY "Allow user to insert own credit reports"
ON public.credit_reports
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.tenant_profiles
        WHERE tenant_profiles.id = credit_reports.tenant_id
        AND tenant_profiles.tenant_id = auth.uid()
    )
);

-- Policy: Allow users to update credit reports linked to their tenant profile
CREATE POLICY "Allow user to update own credit reports"
ON public.credit_reports
FOR UPDATE
USING (
    EXISTS (
        SELECT 1
        FROM public.tenant_profiles
        WHERE tenant_profiles.id = credit_reports.tenant_id
        AND tenant_profiles.tenant_id = auth.uid()
    )
);

-- Policy: Allow users to delete credit reports linked to their tenant profile (if needed)
CREATE POLICY "Allow user to delete own credit reports"
ON public.credit_reports
FOR DELETE
USING (
    EXISTS (
        SELECT 1
        FROM public.tenant_profiles
        WHERE tenant_profiles.id = credit_reports.tenant_id
        AND tenant_profiles.tenant_id = auth.uid()
    )
);
