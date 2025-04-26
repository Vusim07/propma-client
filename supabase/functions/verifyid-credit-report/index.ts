/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers':
		'authorization, x-client-info, apikey, content-type',
};

interface VerifyIdRequest {
	tenant_id: string;
	id_number: string;
	first_name: string;
	surname: string;
}

serve(async (req) => {
	// Handle CORS preflight requests
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		const VERIFYID_BASE_URL =
			Deno.env.get('VERIFYID_BASE_URL') ||
			'https://www.verifyid.co.za/webservice/experian_consumer_credit_report';
		const VERIFYID_API_KEY = Deno.env.get('VERIFYID_API_KEY');

		if (!VERIFYID_API_KEY) {
			throw new Error('VERIFYID_API_KEY is required');
		}

		// Get the authorization header
		const authHeader = req.headers.get('Authorization');
		if (!authHeader) {
			throw new Error('Missing Authorization header');
		}

		// Create Supabase client
		const supabaseClient = createClient(
			Deno.env.get('SUPABASE_URL') ?? '',
			Deno.env.get('SUPABASE_ANON_KEY') ?? '',
			{
				global: {
					headers: { Authorization: authHeader },
				},
			},
		);

		// Get request payload
		const { tenant_id, id_number, first_name, surname } =
			(await req.json()) as VerifyIdRequest;

		if (!tenant_id || !id_number || !first_name || !surname) {
			throw new Error('Missing required fields');
		}

		// Prepare form data for VerifyID API
		const formData = new FormData();
		formData.append('api_key', VERIFYID_API_KEY);
		formData.append('id_number', id_number);
		formData.append('firstName', first_name);
		formData.append('surname', surname);
		formData.append('enquiry_reason', 'AffordabilityAssessment');

		// Call VerifyID API
		const verifyIdResponse = await fetch(VERIFYID_BASE_URL, {
			method: 'POST',
			body: formData,
		});

		if (!verifyIdResponse.ok) {
			throw new Error(`VerifyID API error: ${verifyIdResponse.statusText}`);
		}

		const creditReport = await verifyIdResponse.json();

		// Handle unsuccessful credit report
		if (creditReport.Status !== 'Success') {
			throw new Error(`Credit report error: ${creditReport.Status}`);
		}

		// Extract relevant data from credit report
		const compuScore = creditReport.Results?.CC_RESULTS?.EnqCC_CompuSCORE?.[0];
		if (!compuScore) {
			throw new Error('No credit score data available');
		}

		// Prepare credit report data for database
		const creditReportData = {
			tenant_id,
			status: creditReport.Status,
			risk_type: compuScore.RISK_TYPE,
			risk_color: `${compuScore.RISK_COLOUR_R},${compuScore.RISK_COLOUR_G},${compuScore.RISK_COLOUR_B}`,
			credit_score: parseInt(compuScore.SCORE),
			thin_file_indicator: compuScore.THIN_FILE_INDICATOR === 'Y',
			score_version: compuScore.VERSION,
			score_type: compuScore.SCORE_TYPE,
			decline_reasons: [
				compuScore.DECLINE_R_1,
				compuScore.DECLINE_R_2,
				compuScore.DECLINE_R_3,
				compuScore.DECLINE_R_4,
				compuScore.DECLINE_R_5,
			].filter(Boolean),
			enquiry_counts:
				creditReport.Results?.CC_RESULTS?.EnqCC_ENQ_COUNTS?.[0] || null,
			addresses: creditReport.Results?.CC_RESULTS?.EnqCC_ADDRESS || null,
			employers: creditReport.Results?.CC_RESULTS?.EnqCC_EMPLOYER || null,
			accounts: creditReport.Results?.CC_RESULTS?.EnqCC_CPA_ACCOUNTS || null,
			public_records: {
				judgements: creditReport.Results?.CC_RESULTS?.EnqCC_JUDGEMENTS || [],
				notices: creditReport.Results?.CC_RESULTS?.EnqCC_NOTICES || [],
				collections: creditReport.Results?.CC_RESULTS?.EnqCC_COLLECTIONS || [],
			},
			payment_history: creditReport.Results?.PAYMENTHIST || false,
			property_details:
				creditReport.Results?.CC_RESULTS?.EnqCC_Deeds_DATA || null,
			directors: creditReport.Results?.CC_RESULTS?.EnqCC_Directors_DATA || null,
			nlr_summary: creditReport.Results?.CC_RESULTS?.NLR_SUMMARY || null,
			raw_data: creditReport.Results,
			pdf_file: creditReport.Pdf_file,
			report_date: new Date().toISOString(),
		};

		// Save credit report to database
		const { error: insertError } = await supabaseClient
			.from('credit_reports')
			.insert(creditReportData);

		if (insertError) {
			throw new Error(`Database error: ${insertError.message}`);
		}

		// Return success response
		return new Response(
			JSON.stringify({
				status: 'success',
				data: creditReportData,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			},
		);
	} catch (error) {
		// If API fails, attempt to return mock data
		try {
			const { data: mockData } = await import('./mock-credit-report.ts');
			return new Response(
				JSON.stringify({
					status: 'success',
					data: mockData,
					isMock: true,
					error: error.message,
				}),
				{
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				},
			);
		} catch (mockError) {
			// If even mock data fails, return error
			return new Response(
				JSON.stringify({
					status: 'error',
					message: error.message,
				}),
				{
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 500,
				},
			);
		}
	}
});
