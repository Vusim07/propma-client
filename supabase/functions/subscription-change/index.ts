/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers':
		'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ChangeSubscriptionRequest {
	subscriptionId: string;
	newPlanId: string;
	userId: string;
	teamId?: string;
}

serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		const supabaseUrl = Deno.env.get('SUPABASE_URL');
		const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
		const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');

		if (!supabaseUrl || !supabaseServiceKey || !paystackSecretKey) {
			throw new Error('Missing required environment variables');
		}

		const supabase = createClient(supabaseUrl, supabaseServiceKey);

		// Verify authentication
		const authHeader = req.headers.get('Authorization');
		if (!authHeader) {
			throw new Error('Missing Authorization header');
		}

		const token = authHeader.replace('Bearer ', '');
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser(token);
		if (authError || !user) {
			throw new Error('Invalid authentication');
		}

		const {
			subscriptionId,
			newPlanId,
			userId,
			teamId,
		}: ChangeSubscriptionRequest = await req.json();

		// Get current subscription
		const { data: currentSub, error: subError } = await supabase
			.from('subscriptions')
			.select('*')
			.eq('id', subscriptionId)
			.single();

		if (subError || !currentSub) {
			throw new Error('Subscription not found');
		}

		// Calculate remaining days in current billing cycle
		const now = new Date();
		const endDate = new Date(currentSub.end_date);
		const remainingDays = Math.max(
			0,
			Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
		);

		// Calculate remaining value of current subscription
		const remainingValue = (remainingDays / 30) * currentSub.plan_price;

		// Determine new plan details
		const planDetails = {
			'starter-individual': { price: 500, credits: 20 },
			'growth-individual': { price: 950, credits: 40 },
			'scale-individual': { price: 1900, credits: 80 },
			'starter-team': { price: 1500, credits: 60 },
			'growth-team': { price: 2850, credits: 120 },
			'enterprise-team': { price: 5700, credits: 240 },
		}[newPlanId];

		if (!planDetails) {
			throw new Error('Invalid plan ID');
		}

		// Calculate prorated amount
		const proratedAmount = Math.max(0, planDetails.price - remainingValue);

		// Calculate credit transfer
		const unusedCredits = Math.max(
			0,
			currentSub.usage_limit - currentSub.current_usage,
		);
		const creditValue =
			(unusedCredits / currentSub.usage_limit) * currentSub.plan_price;

		// Final amount to charge is prorated amount minus credit value
		const finalAmount = Math.max(0, proratedAmount - creditValue);

		// Create Paystack transaction for the upgrade
		const transactionResponse = await fetch(
			'https://api.paystack.co/transaction/initialize',
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${paystackSecretKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					email: user.email,
					amount: Math.round(finalAmount * 100), // Convert to cents
					metadata: {
						userId,
						teamId,
						subscriptionId,
						newPlanId,
						isUpgrade: true,
						previousPlanId: currentSub.plan_name,
						unusedCredits,
						proratedAmount,
						creditValue,
					},
				}),
			},
		);

		if (!transactionResponse.ok) {
			throw new Error('Failed to initialize payment');
		}

		const { data: transactionData } = await transactionResponse.json();

		return new Response(
			JSON.stringify({
				success: true,
				proratedAmount: finalAmount,
				unusedCredits,
				authorizationUrl: transactionData.authorization_url,
				reference: transactionData.reference,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			},
		);
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 400,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
});
