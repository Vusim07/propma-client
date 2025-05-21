/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Deno-specific imports that won't be resolved by the TS compiler in VS Code
// but will work in the Supabase Edge Function environment
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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
			isUpgrade?: boolean;
			subscriptionId?: number;
			newPlanId?: string;
			unusedCredits?: number;
			proratedAmount?: number;
			teamId?: number;
		};
	};
}

serve(async (req: Request) => {
	// Handle CORS preflight requests
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		// Create Supabase client
		const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
		const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

		if (!supabaseUrl || !supabaseServiceKey) {
			throw new Error('Missing Supabase environment variables');
		}

		const supabase = createClient(supabaseUrl, supabaseServiceKey);

		// Parse the webhook payload
		const payload: WebhookPayload = await req.json();

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

			// Handle plan upgrade payment
			if (metadata?.isUpgrade) {
				const { subscriptionId, newPlanId, unusedCredits, proratedAmount } =
					metadata;

				// Update the existing subscription
				const { data: subscription, error: subError } = await supabase
					.from('subscriptions')
					.select('*')
					.eq('id', subscriptionId)
					.single();

				if (subError || !subscription) {
					throw new Error('Subscription not found for upgrade');
				}

				// Calculate new start/end dates
				const now = new Date();
				const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

				// Update subscription with new plan details
				const { error: updateError } = await supabase
					.from('subscriptions')
					.update({
						plan_name: newPlanId,
						plan_price: proratedAmount,
						usage_limit: subscription.usage_limit + Number(unusedCredits || 0),
						paystack_subscription_id: reference,
						start_date: now.toISOString(),
						end_date: endDate.toISOString(),
					})
					.eq('id', subscriptionId);

				if (updateError) {
					throw new Error('Failed to update subscription for upgrade');
				}

				// If this is a team plan upgrade, update team limits
				if (metadata.teamId) {
					const maxMembers = {
						'starter-team': 3,
						'growth-team': 10,
						'enterprise-team': 25,
					}[newPlanId];

					if (maxMembers) {
						const { error: teamError } = await supabase
							.from('teams')
							.update({
								max_members: maxMembers,
								plan_type: newPlanId.split('-')[0], // starter, growth, or enterprise
							})
							.eq('id', metadata.teamId);

						if (teamError) {
							console.error('Failed to update team limits:', teamError);
						}
					}
				}

				return new Response(
					JSON.stringify({ success: true, type: 'upgrade' }),
					{
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						status: 200,
					},
				);
			}

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
