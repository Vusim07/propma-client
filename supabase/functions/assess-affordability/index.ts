/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface AffordabilityAssessment {
	monthlyIncome: number;
	monthlyExpenses: number;
	debtToIncomeRatio: number;
	savingsRate: number;
	recommendedRent: number;
	riskScore: number;
	financialHealth: 'excellent' | 'good' | 'fair' | 'poor';
	recommendations: string[];
	aiAnalysis?: {
		transactionPatterns: string[];
		incomeStability: number;
		expenseBreakdown: Record<string, number>;
		riskFactors: string[];
		confidence: number;
	};
}

interface DocumentAnalysis {
	document_type: string;
	analysis_result: {
		income?: number;
		expenses?: number;
		savings?: number;
		debt_obligations?: number;
		account_payments?: number;
		raw_transactions?: string[];
		[key: string]: any;
	};
}

serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		const supabaseClient = createClient(
			Deno.env.get('SUPABASE_URL') ?? '',
			Deno.env.get('SUPABASE_ANON_KEY') ?? '',
			{
				global: {
					headers: { Authorization: req.headers.get('Authorization')! },
				},
			},
		);

		const { profile_id } = await req.json();

		// Get all document analyses for the profile
		const { data: documents, error: documentsError } = await supabaseClient
			.from('document_analyses')
			.select('*')
			.eq('profile_id', profile_id);

		if (documentsError) throw documentsError;

		// Find bank statement documents
		const bankStatements = documents.filter(
			(doc) =>
				doc.document_type === 'bank_statement' &&
				doc.analysis_result?.raw_transactions,
		);

		// Perform AI analysis on bank statements
		let aiAnalysis = null;
		if (bankStatements.length > 0) {
			// Collect all transactions from bank statements
			const allTransactions = bankStatements.flatMap(
				(doc) => doc.analysis_result.raw_transactions || [],
			);

			// Get property details for affordability assessment
			const { data: propertyData } = await supabaseClient
				.from('applications')
				.select('property_id')
				.eq('tenant_id', profile_id)
				.single();

			if (propertyData) {
				const { data: property } = await supabaseClient
					.from('properties')
					.select('monthly_rent')
					.eq('id', propertyData.property_id)
					.single();

				if (property) {
					// Call our Python FastAPI service
					const aiServiceUrl =
						Deno.env.get('AI_SERVICE_URL') ?? 'http://localhost:8000';
					const response = await fetch(
						`${aiServiceUrl}/analyze-affordability`,
						{
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								transactions: allTransactions,
								target_rent: property.monthly_rent,
							}),
						},
					);

					if (!response.ok) {
						throw new Error(`AI service error: ${await response.text()}`);
					}

					const aiResult = await response.json();
					aiAnalysis = {
						transactionPatterns: aiResult.transaction_analysis?.patterns || [],
						incomeStability: aiResult.metrics?.income_stability || 0,
						expenseBreakdown: aiResult.metrics?.expenses_by_category || {},
						riskFactors: aiResult.risk_factors || [],
						confidence: aiResult.confidence || 0,
					};
				}
			}
		}

		// Aggregate financial data from all documents
		const financialData = aggregateFinancialData(documents);

		// Perform basic affordability assessment
		const assessment = performAffordabilityAssessment(financialData);

		// Combine traditional assessment with AI analysis
		const finalAssessment = {
			...assessment,
			aiAnalysis: aiAnalysis,
		};

		return new Response(JSON.stringify(finalAssessment), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			status: 400,
		});
	}
});

function aggregateFinancialData(documents: DocumentAnalysis[]) {
	return documents.reduce((acc, doc) => {
		const result = doc.analysis_result;
		return {
			income: (acc.income || 0) + (result.income || 0),
			expenses: (acc.expenses || 0) + (result.expenses || 0),
			savings: (acc.savings || 0) + (result.savings || 0),
			debtObligations:
				(acc.debtObligations || 0) + (result.debt_obligations || 0),
			accountPayments:
				(acc.accountPayments || 0) + (result.account_payments || 0),
		};
	}, {} as Record<string, number>);
}

function performAffordabilityAssessment(
	data: Record<string, number>,
): AffordabilityAssessment {
	const monthlyIncome = data.income || 0;
	const monthlyExpenses = data.expenses || 0;
	const monthlyDebt = data.debtObligations || 0;
	const monthlySavings = data.savings || 0;

	// Calculate key metrics
	const debtToIncomeRatio =
		monthlyIncome > 0 ? (monthlyDebt / monthlyIncome) * 100 : 0;
	const savingsRate =
		monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;

	// Calculate recommended rent (30% of income)
	const recommendedRent = monthlyIncome * 0.3;

	// Calculate risk score (0-100)
	const riskScore = calculateRiskScore({
		debtToIncomeRatio,
		savingsRate,
		monthlyExpenses,
		monthlyIncome,
	});

	// Determine financial health
	const financialHealth = determineFinancialHealth(riskScore);

	// Generate recommendations
	const recommendations = generateRecommendations({
		debtToIncomeRatio,
		savingsRate,
		monthlyExpenses,
		monthlyIncome,
		financialHealth,
	});

	return {
		monthlyIncome,
		monthlyExpenses,
		debtToIncomeRatio,
		savingsRate,
		recommendedRent,
		riskScore,
		financialHealth,
		recommendations,
	};
}

function calculateRiskScore(metrics: Record<string, number>): number {
	let score = 0;

	// Debt-to-Income Ratio (40% weight)
	if (metrics.debtToIncomeRatio > 43) score += 40;
	else if (metrics.debtToIncomeRatio > 36) score += 30;
	else if (metrics.debtToIncomeRatio > 28) score += 20;
	else score += 10;

	// Savings Rate (30% weight)
	if (metrics.savingsRate < 5) score += 30;
	else if (metrics.savingsRate < 10) score += 20;
	else if (metrics.savingsRate < 15) score += 10;

	// Expense-to-Income Ratio (30% weight)
	const expenseRatio = (metrics.monthlyExpenses / metrics.monthlyIncome) * 100;
	if (expenseRatio > 90) score += 30;
	else if (expenseRatio > 80) score += 20;
	else if (expenseRatio > 70) score += 10;

	return score;
}

function determineFinancialHealth(
	riskScore: number,
): 'excellent' | 'good' | 'fair' | 'poor' {
	if (riskScore <= 20) return 'excellent';
	if (riskScore <= 40) return 'good';
	if (riskScore <= 60) return 'fair';
	return 'poor';
}

function generateRecommendations(
	metrics: Record<string, number> & { financialHealth: string },
): string[] {
	const recommendations: string[] = [];

	if (metrics.debtToIncomeRatio > 36) {
		recommendations.push(
			'Consider reducing debt obligations to improve your debt-to-income ratio.',
		);
	}

	if (metrics.savingsRate < 10) {
		recommendations.push(
			'Aim to increase your savings rate to at least 10% of your income.',
		);
	}

	if (metrics.monthlyExpenses > metrics.monthlyIncome * 0.8) {
		recommendations.push(
			'Review and reduce discretionary spending to improve your financial health.',
		);
	}

	if (metrics.financialHealth === 'poor') {
		recommendations.push(
			'Consider consulting with a financial advisor to improve your financial situation.',
		);
	}

	return recommendations;
}
