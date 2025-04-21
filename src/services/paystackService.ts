import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import { supabase } from './supabase';
import { Subscription, InsertSubscription } from '../types';

interface CreatePlanParams {
	name: string;
	price: number; // In currency units (will be converted to kobo)
	interval: string; // 'daily', 'weekly', 'monthly', 'quarterly', 'biannually', 'annually'
}

interface InitializeSubscriptionParams {
	userId: string;
	planName: string;
	planPrice: number;
	email: string;
	usageLimit: number;
}

interface VerifyTransactionResult {
	status: string;
	reference: string;
	amount: number;
	customer: {
		email: string;
	};
	metadata: Record<string, unknown>;
	[key: string]: unknown;
}

interface PaystackErrorResponse {
	message?: string;
	data?: unknown;
}

class PaystackService {
	private baseUrl: string;
	private secretKey: string;

	constructor() {
		this.baseUrl = 'https://api.paystack.co';
		this.secretKey = import.meta.env.VITE_PAYSTACK_SECRET_KEY || '';
	}

	private async makeRequest<T>(
		method: string,
		endpoint: string,
		data?: unknown,
	): Promise<T> {
		console.log(`Making request to Paystack: ${method} ${endpoint}`);
		console.log('Request data:', JSON.stringify(data, null, 2));
		try {
			const response = await axios({
				method,
				url: `${this.baseUrl}${endpoint}`,
				headers: {
					Authorization: `Bearer ${this.secretKey}`,
					'Content-Type': 'application/json',
				},
				data,
			});
			console.log(
				'Paystack API response:',
				JSON.stringify(response.data, null, 2),
			);
			return response.data;
		} catch (error) {
			const axiosError = error as AxiosError<PaystackErrorResponse>;
			console.error(
				'Paystack API error:',
				axiosError.response?.data || axiosError.message,
			);
			console.error('Full error object:', JSON.stringify(error, null, 2));
			throw new Error(
				(axiosError.response?.data?.message as string) || 'Paystack API error',
			);
		}
	}

	async createPlan(planParams: CreatePlanParams): Promise<string> {
		const response = await this.makeRequest<{ data: { plan_code: string } }>(
			'POST',
			'/plan',
			{
				name: planParams.name,
				amount: Math.round(planParams.price * 100), // Paystack expects amount in kobo (ZAR cents)
				interval: planParams.interval,
				currency: 'ZAR', // South African Rand
			},
		);
		return response.data.plan_code;
	}

	async createSubscription(
		params: InitializeSubscriptionParams,
	): Promise<{ subscriptionId: string; authorizationUrl: string }> {
		try {
			// Step 1: Create or fetch the Paystack plan
			const planName = `${params.planName}-${params.usageLimit}`;
			let planCode: string;

			try {
				// Try to create the plan (this will fail if it already exists)
				planCode = await this.createPlan({
					name: planName,
					price: params.planPrice,
					interval: 'monthly', // Set to monthly recurring
				});
				console.log(`Created new plan with code: ${planCode}`);
			} catch (error) {
				// Plan might already exist, so fetch plans and find matching one
				console.log(
					`Plan creation failed, checking if plan already exists: ${error}`,
				);
				const plansResponse = await this.makeRequest<{
					data: Array<{ name: string; plan_code: string }>;
				}>('GET', '/plan');

				const existingPlan = plansResponse.data.find(
					(plan) => plan.name === planName,
				);
				if (!existingPlan) {
					throw new Error('Failed to create plan and no matching plan found');
				}

				planCode = existingPlan.plan_code;
				console.log(`Using existing plan with code: ${planCode}`);
			}

			// Step 2: Initialize a transaction to get authorization for the subscription
			const response = await this.makeRequest<{
				data: {
					reference: string;
					authorization_url: string;
				};
			}>('POST', '/transaction/initialize', {
				email: params.email,
				amount: params.planPrice * 100, // First payment amount
				metadata: {
					userId: params.userId,
					planName: params.planName,
					planPrice: params.planPrice,
					usageLimit: params.usageLimit,
					planCode: planCode, // Store the plan code for subscription creation
				},
				plan: planCode, // Include the plan code
			});

			// Step 3: Save initial subscription record
			const startDate = new Date();
			const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

			const subscriptionData: InsertSubscription = {
				user_id: params.userId,
				plan_name: params.planName,
				plan_price: params.planPrice,
				usage_limit: params.usageLimit,
				current_usage: 0,
				status: 'pending',
				paystack_subscription_id: response.data.reference,
				start_date: startDate.toISOString(),
				end_date: endDate.toISOString(),
			};

			const { data: subscription, error } = await supabase
				.from('subscriptions')
				.insert(subscriptionData)
				.select()
				.single();

			if (error) {
				console.error('Error creating subscription in Supabase:', error);
				throw error;
			}

			return {
				subscriptionId: subscription.id,
				authorizationUrl: response.data.authorization_url,
			};
		} catch (error) {
			console.error('Error creating subscription:', error);
			throw error;
		}
	}

	async cancelSubscription(
		subscriptionId: string,
		paystackSubscriptionId: string,
	): Promise<void> {
		try {
			// First, verify the subscription status
			const subscriptionStatus = await this.verifySubscription(
				paystackSubscriptionId,
			);

			if (subscriptionStatus === 'active') {
				// Only try to cancel if it's active
				await this.makeRequest('POST', '/subscription/disable', {
					code: paystackSubscriptionId,
					token: paystackSubscriptionId,
				});
			} else {
				console.log(
					`Subscription ${paystackSubscriptionId} is already ${subscriptionStatus}`,
				);
			}

			// Update the database record regardless of Paystack's response
			const { error } = await supabase
				.from('subscriptions')
				.update({ status: 'cancelled' })
				.eq('id', subscriptionId);

			if (error) {
				console.error('Error updating subscription in Supabase:', error);
				throw error;
			}
		} catch (error) {
			console.error('Error in cancelSubscription:', error);
			const axiosError = error as AxiosError<PaystackErrorResponse>;

			if (
				axiosError.response?.data?.message ===
				'Subscription with code not found or already inactive'
			) {
				// If Paystack says it's not found or inactive, we'll still update our database
				const { error } = await supabase
					.from('subscriptions')
					.update({ status: 'cancelled' })
					.eq('id', subscriptionId);

				if (error) {
					console.error('Error updating subscription in Supabase:', error);
					throw error;
				}
			} else {
				throw new Error('Failed to cancel subscription');
			}
		}
	}

	async verifySubscription(paystackSubscriptionId: string): Promise<string> {
		try {
			const response = await this.makeRequest<{ data: { status: string } }>(
				'GET',
				`/subscription/${paystackSubscriptionId}`,
			);
			return response.data.status;
		} catch (error) {
			console.error('Error verifying subscription:', error);
			return 'unknown';
		}
	}

	async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
		const response = await this.makeRequest<{ data: VerifyTransactionResult }>(
			'GET',
			`/transaction/verify/${reference}`,
		);
		return response.data;
	}

	async handlePaymentCallback(reference: string): Promise<Subscription> {
		try {
			// Verify the transaction with Paystack
			const transactionData = await this.verifyTransaction(reference);

			if (transactionData.status !== 'success') {
				throw new Error(
					`Payment failed: ${String(transactionData.gateway_response)}`,
				);
			}

			// Find the subscription in our database
			const { data: subscription, error: fetchError } = await supabase
				.from('subscriptions')
				.select('*')
				.eq('paystack_subscription_id', reference)
				.single();

			if (fetchError) {
				console.error('Error finding subscription:', fetchError);
				throw new Error('Subscription not found');
			}

			// Update the subscription status to active
			const { data: updatedSubscription, error: updateError } = await supabase
				.from('subscriptions')
				.update({ status: 'active' })
				.eq('id', subscription.id)
				.select()
				.single();

			if (updateError) {
				console.error('Error updating subscription:', updateError);
				throw new Error('Failed to update subscription');
			}

			return updatedSubscription;
		} catch (error) {
			console.error('Error in handlePaymentCallback:', error);
			throw error;
		}
	}

	verifyWebhook(signature: string, rawBody: string): boolean {
		const hash = crypto
			.createHmac('sha512', this.secretKey)
			.update(JSON.stringify(rawBody))
			.digest('hex');
		return hash === signature;
	}

	// Increment usage for a subscription
	async incrementUsage(subscriptionId: string): Promise<void> {
		const { data: subscription, error: fetchError } = await supabase
			.from('subscriptions')
			.select('*')
			.eq('id', subscriptionId)
			.single();

		if (fetchError) {
			console.error('Error finding subscription:', fetchError);
			throw new Error('Subscription not found');
		}

		const { error: updateError } = await supabase
			.from('subscriptions')
			.update({ current_usage: subscription.current_usage + 1 })
			.eq('id', subscriptionId);

		if (updateError) {
			console.error('Error updating usage:', updateError);
			throw new Error('Failed to increment usage');
		}
	}

	// Check if a subscription has available usage
	async checkUsageAvailability(subscriptionId: string): Promise<boolean> {
		const { data: subscription, error } = await supabase
			.from('subscriptions')
			.select('*')
			.eq('id', subscriptionId)
			.single();

		if (error) {
			console.error('Error finding subscription:', error);
			throw new Error('Subscription not found');
		}

		return (
			subscription.current_usage < subscription.usage_limit &&
			subscription.status === 'active'
		);
	}
}

export default new PaystackService();
