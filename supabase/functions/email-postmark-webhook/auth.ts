/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { corsHeaders } from '../_shared/cors.ts';

export async function authenticateRequest(
	req: Request,
): Promise<Response | null> {
	// Handle CORS preflight
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	// Check auth token
	const url = new URL(req.url);
	const authToken = url.searchParams.get('auth');
	const webhookSecret = Deno.env.get('WEBHOOK_SECRET');

	if (!authToken || !webhookSecret || authToken !== webhookSecret) {
		return new Response(
			JSON.stringify({
				error: 'Unauthorized',
				message: 'Invalid or missing authentication token',
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				status: 401,
			},
		);
	}

	return null;
}
