/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Deno-specific imports that won't be resolved by the TS compiler in VS Code
// but will work in the Supabase Edge Function environment
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log('Hello from Functions!');

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY =
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Create a Supabase client with the service role key for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
	try {
		// Get the signature from the headers
		const signature = req.headers.get('x-paystack-signature');
		if (!signature) {
			return new Response('Missing signature', { status: 400 });
		}

		// Get the raw body
		const rawBody = await req.text();

		// Verify signature (hash the request body with HMAC using your secret key)
		const hash = await crypto.subtle.digest(
			'SHA-512',
			new TextEncoder().encode(PAYSTACK_SECRET_KEY + rawBody),
		);
		const computedSignature = Array.from(new Uint8Array(hash))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');

		if (computedSignature !== signature) {
			return new Response('Invalid signature', { status: 401 });
		}

		// Parse the body as JSON
		const event = JSON.parse(rawBody);
		const eventType = event.event;
		const data = event.data;

		console.log(`Processing Paystack webhook: ${eventType}`);

		// Handle different event types
		switch (eventType) {
			case 'charge.success':
				await handleChargeSuccess(data);
				break;

			case 'subscription.create':
				await handleSubscriptionCreate(data);
				break;

			case 'subscription.disable':
				await handleSubscriptionDisable(data);
				break;

			case 'invoice.payment_failed':
				await handlePaymentFailed(data);
				break;

			default:
				console.log(`Unhandled event type: ${eventType}`);
		}

		return new Response(JSON.stringify({ received: true }), {
			headers: { 'Content-Type': 'application/json' },
			status: 200,
		});
	} catch (error) {
		console.error('Error processing webhook:', error.message);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
			headers: { 'Content-Type': 'application/json' },
			status: 500,
		});
	}
});

// Handle successful payment
async function handleChargeSuccess(data) {
	const reference = data.reference;

	// Find subscription by reference
	const { data: subscription, error } = await supabase
		.from('subscriptions')
		.select('*')
		.eq('paystack_subscription_id', reference)
		.single();

	if (error) {
		console.error('Error finding subscription:', error);
		return;
	}

	// Update subscription status
	const { error: updateError } = await supabase
		.from('subscriptions')
		.update({
			status: 'active',
			// Store the Paystack customer code for future transactions
			paystack_customer_code: data.customer?.customer_code || null,
		})
		.eq('id', subscription.id);

	if (updateError) {
		console.error('Error updating subscription:', updateError);
	}
}

// Handle new subscription creation
async function handleSubscriptionCreate(data) {
	// The reference from initial transaction is in metadata
	const metadata = data.metadata || {};
	const reference = metadata.reference;

	if (!reference) {
		console.error('No reference in subscription data');
		return;
	}

	// Update the subscription with the actual Paystack subscription code
	const { error } = await supabase
		.from('subscriptions')
		.update({
			paystack_subscription_id: data.subscription_code,
			status: 'active',
		})
		.eq('paystack_subscription_id', reference);

	if (error) {
		console.error('Error updating subscription with subscription code:', error);
	}
}

// Handle subscription cancellation
async function handleSubscriptionDisable(data) {
	const subscriptionCode = data.subscription_code;

	// Update subscription status
	const { error } = await supabase
		.from('subscriptions')
		.update({ status: 'cancelled' })
		.eq('paystack_subscription_id', subscriptionCode);

	if (error) {
		console.error('Error updating cancelled subscription:', error);
	}
}

// Handle failed payments
async function handlePaymentFailed(data) {
	const subscriptionCode = data.subscription?.subscription_code;

	if (!subscriptionCode) {
		console.error('No subscription code in payment failed data');
		return;
	}

	// Update subscription status
	const { error } = await supabase
		.from('subscriptions')
		.update({ status: 'payment_failed' })
		.eq('paystack_subscription_id', subscriptionCode);

	if (error) {
		console.error('Error updating subscription with payment failure:', error);
	}
}

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/paystack-webhook' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
