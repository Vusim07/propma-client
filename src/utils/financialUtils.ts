import { AffordabilityResponse } from '../services/affordabilityService';

/**
 * Calculate and validate rent-to-income ratio from different data sources
 */
export const calculateRentToIncomeRatio = (
	targetRent: number | null,
	monthlyIncome: number | null,
	analysis: AffordabilityResponse,
): { ratio: number; source: 'calculated' | 'analysis' | 'default' } => {
	// Try to calculate from provided values
	if (targetRent !== null && monthlyIncome !== null && monthlyIncome > 0) {
		return {
			ratio: targetRent / monthlyIncome,
			source: 'calculated',
		};
	}

	// Try to use AI's analysis
	if (typeof analysis.metrics?.rent_to_income_ratio === 'number') {
		let ratio = analysis.metrics.rent_to_income_ratio;
		// Convert percentage to decimal if necessary
		if (ratio > 1) {
			ratio = ratio / 100;
		}
		return {
			ratio,
			source: 'analysis',
		};
	}

	// Use default fallback
	return {
		ratio: 0.3,
		source: 'default',
	};
};

/**
 * Generate affordability notes based on analysis results
 */
export const generateAffordabilityNotes = (
	analysis: AffordabilityResponse,
	defaultMessage?: string,
): string => {
	if (analysis.transaction_analysis?.summary) {
		return analysis.transaction_analysis.summary as string;
	}

	return (
		defaultMessage ||
		(analysis.can_afford
			? 'Tenant can likely afford this property based on income and expense patterns.'
			: 'Tenant may have difficulty affording this property based on income and expense patterns.')
	);
};

/**
 * Generate recommendation text from analysis results
 */
export const generateRecommendationText = (
	analysis: AffordabilityResponse,
	preApprovalStatus: string,
): string => {
	if (analysis.recommendations && analysis.recommendations.length > 0) {
		const firstRec = analysis.recommendations[0];
		return String(firstRec).substring(0, 250);
	}

	const defaultText =
		preApprovalStatus === 'approved'
			? 'Review details for approval.'
			: 'Review details for rejection.';

	return defaultText;
};
