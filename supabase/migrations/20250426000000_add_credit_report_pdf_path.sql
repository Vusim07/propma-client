-- Add pdf_path column to credit_reports table
ALTER TABLE credit_reports 
ADD COLUMN IF NOT EXISTS pdf_path TEXT;

-- Create function to migrate existing base64 PDFs to stored files
CREATE OR REPLACE FUNCTION migrate_credit_report_pdfs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    report RECORD;
    pdf_blob BYTEA;
    file_path TEXT;
BEGIN
    FOR report IN SELECT id, tenant_id, pdf_file FROM credit_reports WHERE pdf_file IS NOT NULL AND pdf_path IS NULL
    LOOP
        -- Convert base64 to bytea
        pdf_blob := decode(report.pdf_file, 'base64');
        
        -- Generate unique filename using tenant_id and timestamp
        file_path := report.tenant_id || '/' || extract(epoch from now()) || '_credit_report.pdf';
        
        -- Upload to storage bucket using storage.upload
        PERFORM storage.upload('tenant_documents', file_path, pdf_blob, 'application/pdf');
        
        -- Update record with new path and clear base64 data
        UPDATE credit_reports 
        SET pdf_path = file_path,
            pdf_file = NULL,
            updated_at = now()
        WHERE id = report.id;
    END LOOP;
END;
$$;

-- Run the migration function
SELECT migrate_credit_report_pdfs();

-- Drop the migration function as it's no longer needed
DROP FUNCTION migrate_credit_report_pdfs();

-- Add comment to pdf_file column indicating it's deprecated
COMMENT ON COLUMN credit_reports.pdf_file IS 'DEPRECATED: Use pdf_path instead. This column will be removed in a future migration.';