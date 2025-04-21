/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Deno-specific imports that won't be resolved by the TS compiler in VS Code
// but will work in the Supabase Edge Function environment
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

console.log('Hello from Functions!');

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers':
		'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
	event: string;
	data: {
		id: number;
		reference: string;
		status: string;
		metadata?: {
			userId?: string;
			planName?: string;
			usageLimit?: number;
		};
	};
}

serve(async (req: Request) => {
	// Handle CORS preflight requests
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		console.log('Received webhook request');

		// Create Supabase client
		const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
		const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

		if (!supabaseUrl || !supabaseServiceKey) {
			throw new Error('Missing Supabase environment variables');
		}

		const supabase = createClient(supabaseUrl, supabaseServiceKey);

		// Verify Paystack signature
		// In a production environment, you should verify the request signature
		// using the Paystack signature header

		// Parse the webhook payload
		const payload: WebhookPayload = await req.json();
		console.log('Received webhook event:', payload.event);

		// Only process successful charge events
		if (payload.event === 'charge.success') {
			const { reference, status, metadata } = payload.data;

			if (status !== 'success') {
				return new Response(
					JSON.stringify({ message: 'Payment not successful' }),
					{
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						status: 200,
					},
				);
			}

			console.log(`Processing successful payment: ${reference}`);

			// Try to find subscription by reference
			const { data: subscriptionsByRef, error: refError } = await supabase
				.from('subscriptions')
				.select('*')
				.eq('paystack_subscription_id', reference);

			if (refError) {
				console.error('Error finding subscription by reference:', refError);
			}

			// If found by reference, update status
			if (subscriptionsByRef && subscriptionsByRef.length > 0) {
				console.log(
					`Found subscription by reference: ${subscriptionsByRef[0].id}`,
				);

				const { data: updatedSub, error: updateError } = await supabase
					.from('subscriptions')
					.update({ status: 'active' })
					.eq('id', subscriptionsByRef[0].id)
					.select()
					.single();

				if (updateError) {
					console.error('Error updating subscription:', updateError);
					throw new Error('Failed to update subscription status');
				}

				console.log('Successfully updated subscription:', updatedSub);
				return new Response(
					JSON.stringify({ success: true, subscription: updatedSub }),
					{
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						status: 200,
					},
				);
			}

			// If not found by reference but we have userId in metadata, try that
			if (metadata && metadata.userId) {
				console.log(`Finding subscription by user ID: ${metadata.userId}`);

				// Find most recent inactive subscription for this user
				const { data: userSubs, error: userError } = await supabase
					.from('subscriptions')
					.select('*')
					.eq('user_id', metadata.userId)
					.eq('status', 'inactive')
					.order('created_at', { ascending: false })
					.limit(1);

				if (userError) {
					console.error('Error finding subscription by user ID:', userError);
				}

				if (userSubs && userSubs.length > 0) {
					console.log(`Found subscription by user ID: ${userSubs[0].id}`);

					const { data: updatedSub, error: updateError } = await supabase
						.from('subscriptions')
						.update({
							status: 'active',
							paystack_subscription_id: reference,
						})
						.eq('id', userSubs[0].id)
						.select()
						.single();

					if (updateError) {
						console.error('Error updating subscription:', updateError);
						throw new Error('Failed to update subscription status');
					}

					console.log('Successfully updated subscription:', updatedSub);
					return new Response(
						JSON.stringify({ success: true, subscription: updatedSub }),
						{
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
							status: 200,
						},
					);
				}
			}

			// Last resort: find the most recent inactive subscription
			console.log('Trying fallback: most recent inactive subscription');

			const { data: recentSubs, error: recentError } = await supabase
				.from('subscriptions')
				.select('*')
				.eq('status', 'inactive')
				.order('created_at', { ascending: false })
				.limit(1);

			if (recentError) {
				console.error('Error finding recent subscriptions:', recentError);
				throw new Error('Failed to find any subscription to update');
			}

			if (!recentSubs || recentSubs.length === 0) {
				console.error('No inactive subscriptions found to update');
				return new Response(
					JSON.stringify({
						success: false,
						message: 'No inactive subscriptions found',
					}),
					{
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						status: 404,
					},
				);
			}

			// Update the most recent subscription
			console.log(
				`Using most recent subscription as fallback: ${recentSubs[0].id}`,
			);

			const { data: updatedSub, error: updateError } = await supabase
				.from('subscriptions')
				.update({
					status: 'active',
					paystack_subscription_id: reference,
				})
				.eq('id', recentSubs[0].id)
				.select()
				.single();

			if (updateError) {
				console.error('Error updating fallback subscription:', updateError);
				throw new Error('Failed to update subscription');
			}

			console.log('Successfully updated fallback subscription:', updatedSub);
			return new Response(
				JSON.stringify({ success: true, subscription: updatedSub }),
				{
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					status: 200,
				},
			);
		}

		// For other events, just acknowledge receipt
		return new Response(
			JSON.stringify({ message: 'Webhook received but not processed' }),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				status: 200,
			},
		);
	} catch (error) {
		console.error('Error processing webhook:', error);

		return new Response(JSON.stringify({ error: error.message }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			status: 500,
		});
	}
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/paystack-webhook' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
