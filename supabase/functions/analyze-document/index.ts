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
			console.log('Request headers:', req.headers);
			console.log('Request method:', req.method);

			const bodyText = await req.text(); // Read the raw body as text
			console.log('Raw request body:', bodyText);

			if (!bodyText) {
				throw new Error('Request body is empty');
			}

			requestData = JSON.parse(bodyText); // Parse the JSON
			console.log('Parsed request data:', requestData);
		} catch (e) {
			console.error('Failed to parse request JSON:', e.message);
			return new Response(JSON.stringify({ error: 'Invalid request format' }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				status: 400,
			});
		}

		const { fileUrl } = requestData;

		if (!fileUrl) {
			console.error('Missing file URL in request data');
			return new Response(JSON.stringify({ error: 'Missing file URL' }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				status: 400,
			});
		}

		console.log(`Processing document from URL: ${fileUrl}`);

		// Call Azure Document Intelligence API
		const response = await fetch(
			`https://amara-di.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=2024-02-29-preview`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Ocp-Apim-Subscription-Key': AZURE_API_KEY,
					Accept: 'application/json', // Added to match SDK example
				},
				body: JSON.stringify({
					urlSource: fileUrl, // Keep URL source if using public URL
					features: ['ocr.highResolution'], // Add recommended feature
				}),
			},
		);

		if (response.status >= 400) {
			const errorData = await response.json();
			console.error('Azure API error:', errorData.error);
			return new Response(
				JSON.stringify({
					error: 'Azure API Error',
					details: errorData.error,
				}),
				{ headers: corsHeaders, status: 502 },
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
		// Replace the polling loop with:
		let result;
		const startTime = Date.now();
		const TIMEOUT = 120000; // 2 minutes

		do {
			const pollResponse = await fetch(operationLocation, {
				headers: {
					'Ocp-Apim-Subscription-Key': AZURE_API_KEY,
					Accept: 'application/json',
				},
			});

			if (!pollResponse.ok) {
				const errorData = await pollResponse.json();
				throw new Error(`Polling failed: ${errorData.error.message}`);
			}

			result = await pollResponse.json();
			await new Promise((resolve) => setTimeout(resolve, 1000));
		} while (
			(result.status === 'running' || result.status === 'notStarted') &&
			Date.now() - startTime < TIMEOUT
		);

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
