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
	isOneTime?: boolean; // Flag to indicate if this is a one-time payment
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
			let planCode: string | undefined;

			// For recurring subscriptions, create or fetch a plan
			if (!params.isOneTime) {
				// Step 1: Create or fetch the Paystack plan
				const planName = `${params.planName}-${params.usageLimit}`;

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
			}

			// Step 2: Initialize a transaction with or without a plan
			interface TransactionData {
				email: string;
				amount: number;
				metadata: {
					userId: string;
					planName: string;
					planPrice: number;
					usageLimit: number;
					isOneTime: boolean;
					planCode?: string;
				};
				plan?: string;
			}

			const transactionData: TransactionData = {
				email: params.email,
				amount: params.planPrice * 100, // Payment amount in kobo (ZAR cents)
				metadata: {
					userId: params.userId,
					planName: params.planName,
					planPrice: params.planPrice,
					usageLimit: params.usageLimit,
					isOneTime: params.isOneTime || false,
				},
			};

			// Only add plan code for recurring subscriptions
			if (planCode && !params.isOneTime) {
				transactionData.plan = planCode;
				transactionData.metadata.planCode = planCode;
			}

			const response = await this.makeRequest<{
				data: {
					reference: string;
					authorization_url: string;
				};
			}>('POST', '/transaction/initialize', transactionData);

			// Step 3: Save initial subscription record
			const startDate = new Date();
			const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

			const subscriptionData: InsertSubscription = {
				user_id: params.userId,
				plan_name: params.planName,
				plan_price: params.planPrice,
				usage_limit: params.usageLimit,
				current_usage: 0,
				status: 'inactive',
				is_team: false, // Add missing required field
				team_id: null, // Add null for non-team subscriptions
				plan_type: params.isOneTime ? 'one-time' : 'recurring', // Set plan type based on subscription type
				paystack_subscription_id: response.data.reference,
				start_date: startDate.toISOString(),
				end_date: params.isOneTime ? undefined : endDate.toISOString(),
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
		console.log(
			`Starting payment callback handling for reference: ${reference}`,
		);
		try {
			// Verify the transaction with Paystack
			console.log(`Verifying transaction with Paystack...`);
			const transactionData = await this.verifyTransaction(reference);
			console.log(
				'Verification response:',
				JSON.stringify(transactionData, null, 2),
			);

			if (transactionData.status !== 'success') {
				const errorMessage = `Payment failed: ${String(
					transactionData.gateway_response || 'Unknown error',
				)}`;
				console.error(errorMessage);
				throw new Error(errorMessage);
			}

			console.log(
				'Payment verification successful, looking for subscription record',
			);

			// Try to find subscription by reference
			const { data: subscriptionsByRef } = await supabase
				.from('subscriptions')
				.select('*')
				.eq('paystack_subscription_id', reference);

			if (subscriptionsByRef && subscriptionsByRef.length > 0) {
				// Found subscription by reference
				console.log(
					`Found subscription with reference: ${subscriptionsByRef[0].id}`,
				);

				// Update the subscription
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

				console.log('Subscription successfully updated:', updatedSub);
				return updatedSub;
			}

			// If we're here, we couldn't find the subscription by reference
			console.log(
				'Subscription not found by reference, trying metadata lookup',
			);

			// Check if we have user ID in metadata
			const userId = transactionData.metadata?.userId as string | undefined;

			if (userId) {
				console.log(
					`Found userId in metadata: ${userId}, searching by user_id`,
				);

				// Try to find by user ID
				const { data: subscriptionsByUser } = await supabase
					.from('subscriptions')
					.select('*')
					.eq('user_id', userId)
					.eq('status', 'inactive')
					.order('created_at', { ascending: false })
					.limit(1);

				if (subscriptionsByUser && subscriptionsByUser.length > 0) {
					console.log(
						`Found subscription by user_id: ${subscriptionsByUser[0].id}`,
					);

					// Update the subscription with the correct reference and status
					const { data: updatedSub, error: updateError } = await supabase
						.from('subscriptions')
						.update({
							status: 'active',
							paystack_subscription_id: reference,
						})
						.eq('id', subscriptionsByUser[0].id)
						.select()
						.single();

					if (updateError) {
						console.error('Error updating subscription:', updateError);
						throw new Error('Failed to update subscription status');
					}

					console.log('Subscription successfully updated:', updatedSub);
					return updatedSub;
				}
			}

			// Last resort: find the most recent inactive subscription
			console.log('Trying last resort: most recent inactive subscription');

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
				throw new Error('No inactive subscriptions found to update');
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

			console.log('Fallback subscription successfully updated:', updatedSub);
			return updatedSub;
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
		const { data: subscription } = await supabase
			.from('subscriptions')
			.select('*')
			.eq('id', subscriptionId)
			.single();

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
		const { data: subscription } = await supabase
			.from('subscriptions')
			.select('*')
			.eq('id', subscriptionId)
			.single();
		if (!subscription) {
			throw new Error('Subscription not found');
		}

		return (
			subscription.current_usage < subscription.usage_limit &&
			subscription.status === 'active'
		);
	}

	async upgradeSubscription(params: {
		subscriptionId: string;
		newPlanId: string;
		userId: string;
		teamId?: string;
	}): Promise<{ authorizationUrl: string; proratedAmount: number }> {
		try {
			const response = await fetch(
				`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/subscription-change`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${
							(
								await supabase.auth.getSession()
							).data.session?.access_token
						}`,
					},
					body: JSON.stringify(params),
				},
			);

			if (!response.ok) {
				throw new Error('Failed to calculate upgrade cost');
			}

			const data = await response.json();
			if (!data.success) {
				throw new Error(data.error || 'Unknown error occurred');
			}

			// Store the upgrade reference for later use
			sessionStorage.setItem('paystack_upgrade_reference', data.reference);

			return {
				authorizationUrl: data.authorizationUrl,
				proratedAmount: data.proratedAmount,
			};
		} catch (error) {
			console.error('Error in upgradeSubscription:', error);
			throw error;
		}
	}
}

export default new PaystackService();
