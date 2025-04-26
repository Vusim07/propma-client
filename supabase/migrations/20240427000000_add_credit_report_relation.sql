-- Add credit_report_id column to screening_reports table
ALTER TABLE screening_reports
ADD COLUMN credit_report_id UUID REFERENCES credit_reports(id);

-- Create an index on credit_report_id for better query performance
CREATE INDEX idx_screening_reports_credit_report_id ON screening_reports(credit_report_id);

-- Update RLS policies to allow access to credit reports through screening reports
CREATE POLICY "Users can view their own credit reports through screening reports"
    ON credit_reports
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM screening_reports sr
            JOIN applications a ON sr.application_id = a.id
            WHERE sr.credit_report_id = credit_reports.id
            AND a.tenant_id = auth.uid()
        )
        OR tenant_id = auth.uid()
    );

-- Allow agents to view credit reports for their tenants
CREATE POLICY "Agents can view credit reports for their tenants"
    ON credit_reports
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM screening_reports sr
            JOIN applications a ON sr.application_id = a.id
            JOIN properties p ON a.property_id = p.id
            WHERE sr.credit_report_id = credit_reports.id
            AND p.agent_id = auth.uid()
        )
    );