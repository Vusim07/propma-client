/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Get environment variables
const AZURE_ENDPOINT =
	Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT') || '';
const AZURE_API_KEY = Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_KEY') || '';

// Add proper logging for debugging
console.log(
	`Function initialized. Endpoint configured: ${AZURE_ENDPOINT ? 'Yes' : 'No'}`,
);

serve(async (req) => {
	// Handle CORS preflight requests
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		// Validate environment variables first
		if (!AZURE_ENDPOINT || !AZURE_API_KEY) {
			console.error('Missing required environment variables');
			return new Response(
				JSON.stringify({
					error: 'Server configuration error',
					details: 'Missing API credentials',
				}),
				{
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 500,
				},
			);
		}

		// Parse request body
		let requestData;
		try {
			requestData = await req.json();
		} catch (e) {
			console.error('Failed to parse request JSON:', e);
			return new Response(JSON.stringify({ error: 'Invalid request format' }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				status: 400,
			});
		}

		const { fileUrl } = requestData;

		if (!fileUrl) {
			return new Response(JSON.stringify({ error: 'Missing file URL' }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				status: 400,
			});
		}

		console.log(`Processing document from URL: ${fileUrl}`);

		// Call Azure Document Intelligence API
		const response = await fetch(
			`${AZURE_ENDPOINT}/documentintelligence/documentModels/prebuilt-document:analyze?api-version=2023-07-31`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Ocp-Apim-Subscription-Key': AZURE_API_KEY,
				},
				body: JSON.stringify({
					urlSource: fileUrl,
				}),
			},
		);

		// Check for API errors with detailed logging
		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Azure API error: ${response.status} - ${errorText}`);
			return new Response(
				JSON.stringify({
					error: 'Azure Document Intelligence API error',
					status: response.status,
					details: errorText,
				}),
				{
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 502, // Bad Gateway to indicate upstream service failure
				},
			);
		}

		const operationLocation = response.headers.get('Operation-Location');

		if (!operationLocation) {
			console.error('No operation location returned from Azure API');
			return new Response(
				JSON.stringify({
					error: 'Invalid Azure API response - missing operation location',
				}),
				{
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 502,
				},
			);
		}

		// Poll the operation with timeout protection
		let result;
		let status = 'running';
		let attempts = 0;
		const MAX_ATTEMPTS = 30; // 30 seconds timeout

		console.log('Polling operation at:', operationLocation);

		while (
			(status === 'running' || status === 'notStarted') &&
			attempts < MAX_ATTEMPTS
		) {
			attempts++;
			await new Promise((resolve) => setTimeout(resolve, 1000));

			const pollResponse = await fetch(operationLocation, {
				headers: {
					'Ocp-Apim-Subscription-Key': AZURE_API_KEY,
				},
			});

			if (!pollResponse.ok) {
				const pollErrorText = await pollResponse.text();
				console.error(`Poll error: ${pollResponse.status} - ${pollErrorText}`);
				return new Response(
					JSON.stringify({
						error: 'Azure polling failed',
						status: pollResponse.status,
						details: pollErrorText,
					}),
					{
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						status: 502,
					},
				);
			}

			result = await pollResponse.json();
			status = result.status;
			console.log(`Poll attempt ${attempts}: status = ${status}`);
		}

		if (attempts >= MAX_ATTEMPTS) {
			console.error('Document processing timed out');
			return new Response(
				JSON.stringify({ error: 'Document processing timed out' }),
				{
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 504, // Gateway Timeout
				},
			);
		}

		// Format the data following SA context requirements (POPI Act compliance)
		const sanitizedResult = sanitizeDocumentData(result);

		console.log('Document processing completed successfully');
		return new Response(JSON.stringify(sanitizedResult), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('Unhandled error in function:', error.message);
		return new Response(
			JSON.stringify({
				error: 'Internal server error',
				message: error.message,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				status: 500,
			},
		);
	}
});

// Helper function to sanitize the result data (POPI Act compliance)
function sanitizeDocumentData(result) {
	// Only extract what we need, removing any potentially sensitive data
	const sanitized = {
		documentType: result?.analyzeResult?.documentType || 'unknown',
		pages: result?.analyzeResult?.pages?.length || 0,
		extractedText: '',
		paragraphs: [],
		keyValuePairs: [],
		processedDate: new Date().toLocaleDateString('en-ZA'),
	};

	// Extract text content
	if (result?.analyzeResult?.paragraphs) {
		sanitized.paragraphs = result.analyzeResult.paragraphs.map((p) => ({
			content: p.content,
			boundingRegions: p.boundingRegions,
		}));
		sanitized.extractedText = sanitized.paragraphs
			.map((p) => p.content)
			.join('\n\n');
	}

	// Extract key-value pairs (useful for forms and documents)
	if (result?.analyzeResult?.keyValuePairs) {
		sanitized.keyValuePairs = result.analyzeResult.keyValuePairs.map((kvp) => ({
			key: kvp.key?.content || '',
			value: kvp.value?.content || '',
		}));
	}

	return sanitized;
}
