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
