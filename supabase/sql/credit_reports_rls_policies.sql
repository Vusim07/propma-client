-- Drop existing policies
drop policy if exists "Tenants can insert their own credit reports" on public.credit_reports;
drop policy if exists "Allow user to view own or associated credit reports" on public.credit_reports;
drop policy if exists "Allow user to update own credit reports" on public.credit_reports;
drop policy if exists "Allow user to delete own credit reports" on public.credit_reports;
drop policy if exists "Allow user to insert own credit reports" on public.credit_reports;
drop policy if exists "Service role has full access" on public.credit_reports;

-- Enable RLS on the credit_reports table
ALTER TABLE public.credit_reports ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated service role access
CREATE POLICY "Service role has full access"
ON public.credit_reports
FOR ALL
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- Allow users to view credit reports they own or are associated with
CREATE POLICY "Allow user to view own or associated credit reports"
ON public.credit_reports
FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT id 
        FROM public.tenant_profiles 
        WHERE tenant_profiles.tenant_id = auth.uid()
    )
    OR 
    EXISTS (
        SELECT 1
        FROM public.applications a
        JOIN public.tenant_profiles tp ON tp.id = a.tenant_id
        WHERE tp.id = credit_reports.tenant_id
        AND a.agent_id = auth.uid()
    )
);

-- Allow users to insert credit reports for their tenant profiles
CREATE POLICY "Allow user to insert own credit reports"
ON public.credit_reports
FOR INSERT
TO authenticated
WITH CHECK (
    tenant_id IN (
        SELECT id 
        FROM public.tenant_profiles 
        WHERE tenant_profiles.tenant_id = auth.uid()
    )
);

-- Allow users to update their own credit reports
CREATE POLICY "Allow user to update own credit reports"
ON public.credit_reports
FOR UPDATE
TO authenticated
USING (
    tenant_id IN (
        SELECT id 
        FROM public.tenant_profiles 
        WHERE tenant_profiles.tenant_id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT id 
        FROM public.tenant_profiles 
        WHERE tenant_profiles.tenant_id = auth.uid()
    )
);

-- Allow users to delete their own credit reports
CREATE POLICY "Allow user to delete own credit reports"
ON public.credit_reports
FOR DELETE
TO authenticated
USING (
    tenant_id IN (
        SELECT id 
        FROM public.tenant_profiles 
        WHERE tenant_profiles.tenant_id = auth.uid()
    )
);
