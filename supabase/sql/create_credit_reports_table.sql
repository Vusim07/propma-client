CREATE TABLE public.credit_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenant_profiles (id) ON DELETE CASCADE,
    status TEXT NOT NULL, -- Status of the report (e.g., "Success")
    risk_type TEXT, -- Risk type (e.g., "AVERAGE RISK")
    risk_color TEXT, -- Risk color (e.g., "245,236,86")
    credit_score INTEGER, -- Credit score (e.g., 636)
    thin_file_indicator BOOLEAN DEFAULT FALSE, -- Indicates if the file is thin
    score_version TEXT, -- Version of the score (e.g., "2")
    score_type TEXT, -- Type of the score (e.g., "CPA")
    decline_reasons JSONB, -- Decline reasons as JSON array
    enquiry_counts JSONB, -- JSON object for enquiry counts (e.g., "EnqCC_ENQ_COUNTS")
    addresses JSONB, -- JSON array for addresses (e.g., "EnqCC_ADDRESS")
    employers JSONB, -- JSON array for employer history (e.g., "EnqCC_EMPLOYER")
    accounts JSONB, -- JSON array for account details (e.g., "EnqCC_CPA_ACCOUNTS")
    public_records JSONB, -- JSON array for public records (e.g., "EnqCC_JUDGEMENTS")
    payment_history BOOLEAN, -- Indicates if payment history is available
    property_details JSONB, -- JSON object for property details (e.g., "EnqCC_Deeds_DATA")
    directors JSONB, -- JSON array for director information (e.g., "EnqCC_Directors_DATA")
    nlr_summary JSONB, -- JSON object for NLR summary (e.g., "NLR_SUMMARY")
    raw_data JSONB, -- Full raw JSON response for future-proofing
    pdf_file TEXT, -- Base64-encoded PDF file
    report_date DATE NOT NULL DEFAULT CURRENT_DATE, -- Date of the report
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add an index for faster lookups by tenant_id
CREATE INDEX idx_credit_reports_tenant_id ON public.credit_reports (tenant_id);
