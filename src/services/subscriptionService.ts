import { supabase } from './supabase';
import { showToast } from '../utils/toast';

export const trackScreeningUsage = async (agentId: string) => {
	const { data, error } = await supabase.rpc('increment_screening_usage', {
		agent_id: agentId,
	});

	if (error) {
		console.error('Error tracking screening usage:', error);
		showToast.error(
			'Failed to process screening. Please check your subscription.',
		);
		return {
			success: false,
			message: error.message,
		};
	}

	if (!data.success) {
		// Handle usage limit reached
		if (data.message === 'Usage limit reached') {
			const isTeam = data.is_team;
			const upgradeMessage = isTeam
				? 'Your team has reached the screening limit. Please upgrade your plan.'
				: 'You have reached your screening limit. Please upgrade your subscription.';

			showToast.error(upgradeMessage);
		} else {
			showToast.error(data.message || 'Subscription check failed');
		}
	}

	// Display remaining credits notification if below 20% of limit
	if (data.success && data.remaining && data.usage_limit) {
		const usagePercentage = (data.current_usage / data.usage_limit) * 100;
		if (usagePercentage > 80) {
			showToast.warning(
				`You have ${data.remaining} screening credits remaining.`,
			);
		}
	}

	return data;
};

/**
 * Track inbox (email/conversation) usage for the current agent or team.
 * Enforces the inbox_count/conversation limit as per the active subscription plan.
 * Throws or blocks if the limit is reached, and notifies the user.
 */
export const trackInboxUsage = async (context: {
	agentId?: string;
	teamId?: string;
}) => {
	const { agentId, teamId } = context;
	const params: Record<string, string> = {};
	if (teamId) params.p_team_id = teamId;
	if (agentId) params.p_user_id = agentId;

	const { data, error } = await supabase.rpc('increment_inbox_usage', params);

	if (error) {
		console.error('Error tracking inbox usage:', error);
		showToast.error(
			'Failed to process conversation. Please check your subscription.',
		);
		return {
			success: false,
			message: error.message,
		};
	}

	if (!data.success) {
		if (data.message === 'Inbox limit reached') {
			const isTeam = data.is_team;
			const upgradeMessage = isTeam
				? 'Your team has reached the conversation limit. Please upgrade your plan.'
				: 'You have reached your conversation limit. Please upgrade your subscription.';
			showToast.error(upgradeMessage);
		} else {
			showToast.error(data.message || 'Inbox usage check failed');
		}
	}

	// Display remaining conversations notification if below 20% of limit
	if (data.success && data.remaining && data.usage_limit) {
		const usagePercentage = (data.current_usage / data.usage_limit) * 100;
		if (usagePercentage > 80) {
			showToast.warning(
				`You have ${data.remaining} conversations remaining in your plan.`,
			);
		}
	}

	return data;
};

/**
 * Create a new subscription for a user (agent) to a given plan.
 * If a subscription already exists and is active, do nothing.
 */
export const createSubscription = async ({
	userId,
	planId,
}: {
	userId: string;
	planId: string;
}): Promise<{ success: boolean; message?: string }> => {
	// Check for existing active subscription
	const { data: existing, error: existingError } = await supabase
		.from('subscriptions')
		.select('*')
		.eq('user_id', userId)
		.eq('status', 'active')
		.maybeSingle();
	if (existingError) {
		return { success: false, message: existingError.message };
	}
	if (existing) {
		return { success: true, message: 'Already subscribed' };
	}

	// Fetch plan details
	const { data: plan, error: planError } = await supabase
		.from('plans')
		.select('*')
		.eq('id', planId)
		.single();
	if (planError || !plan) {
		return { success: false, message: planError?.message || 'Plan not found' };
	}

	// Insert new subscription
	const now = new Date().toISOString();
	const { error: insertError } = await supabase.from('subscriptions').insert({
		user_id: userId,
		plan_id: plan.id,
		plan_name: plan.id,
		plan_price: plan.price,
		usage_limit: plan.usage_limit,
		current_usage: 0,
		inbox_limit: plan.inbox_limit,
		inbox_usage: 0,
		status: 'active',
		paystack_subscription_id: '',
		is_team: plan.is_team_plan,
		team_id: null,
		plan_type: null,
		add_ons: null,
		start_date: now,
		end_date: null,
		created_at: now,
		updated_at: now,
	});
	if (insertError) {
		return { success: false, message: insertError.message };
	}
	return { success: true };
};
