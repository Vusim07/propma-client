import { supabase } from '../services/supabase';
import { Tables, Json } from './database.types';

export interface Transaction {
	description: string;
	amount: number;
	date: string; // Format: DD/MM/YYYY (South African format)
	type: string; // "credit" or "debit"
}

export interface PayslipData {
	employer: string;
	employeeName: string;
	employeeId?: string;
	payPeriod?: string;
	grossIncome: number;
	netIncome: number;
	deductions?: Record<string, number>;
	incomeFrequency: 'weekly' | 'bi-weekly' | 'monthly' | 'unknown';
}

export interface CreditReportData {
	creditScore: number;
	reportDate: string;
	accountsSummary?: {
		totalAccounts: number;
		accountsInGoodStanding: number;
		negativeAccounts: number;
	};
	employmentHistory?: Array<{
		employerName: string;
		startDate: string;
		endDate?: string;
	}>;
	publicRecords?: Array<{
		type: string;
		date: string;
		amount?: number;
	}>;
	raw?: Record<string, unknown>;
}

export interface TenantIncomeData {
	statedMonthlyIncome: number;
	employmentStatus: string;
	employer?: string;
	employmentDuration?: number;
}

export interface AffordabilityRequest {
	transactions: Transaction[];
	target_rent: number; // In ZAR
	payslip_data?: Json | null;
	bank_statement_data?: Json | null;
	tenant_income?: TenantIncomeData;
	credit_report?: CreditReportData;
	analysis_type?: 'standard' | 'comprehensive' | 'quick';
}

export interface AffordabilityResponse {
	can_afford: boolean;
	confidence: number; // 0.0 to 1.0
	risk_factors: string[];
	recommendations: string[];
	metrics: Record<string, unknown>; // Includes financial metrics
	transaction_analysis: Record<string, unknown>; // Categorized transactions
	income_verification?: {
		is_verified: boolean;
		confidence: number;
		stated_vs_documented_ratio: number;
		notes: string;
	};
	credit_analysis?: {
		score_category: string;
		risk_level: string;
		notes: string;
	};
}

/**
 * Service for analyzing rental affordability using the CrewAI service
 */
class AffordabilityService {
	private readonly API_URL =
		process.env.NODE_ENV === 'production'
			? 'https://api.tryamara.com/analyze-affordability'
			: 'http://localhost:8000/analyze-affordability';

	/**
	 * Creates a comprehensive affordability analysis for a tenant application
	 *
	 * @param applicationId Application ID to analyze
	 * @param tenantId Tenant ID for fetching profile information
	 * @param propertyId Property ID for fetching rental information
	 * @returns Complete affordability analysis
	 */
	async createAffordabilityAnalysis(
		applicationId: string,
		tenantId: string,
		propertyId: string,
	): Promise<AffordabilityResponse> {
		try {
			console.log(
				`Creating affordability analysis for application ${applicationId}`,
			);

			// 1. Get transactions AND raw bank statement data
			const { transactions, rawBankStatementData } =
				await this.getTransactionsAndRawData(tenantId, applicationId);
			console.log(
				`Found ${
					transactions.length
				} transactions. Has raw bank statement data: ${!!rawBankStatementData}`,
			);

			// 2. Get payslip data AND raw payslip data
			const { payslipData, rawPayslipData } = await this.getPayslipAndRawData(
				tenantId,
				applicationId,
			);
			console.log(
				`Payslip data found: ${
					payslipData !== null
				}. Has raw payslip data: ${!!rawPayslipData}`,
			);

			// 3. Get tenant income information from profile
			const tenantIncome = await this.getTenantIncomeData(
				tenantId,
				applicationId,
			);
			console.log(`Tenant income data: ${JSON.stringify(tenantIncome)}`);

			// 4. Generate mock credit report
			const creditReport = await this.generateCreditReport(tenantId);
			console.log('Generated credit report');

			// 5. Get target rent amount
			const targetRent = await this.getTargetRent(propertyId);
			console.log(`Target rent: R${targetRent}`);

			// 6. Analyze affordability with all data, including raw extracted data
			const affordabilityResponse = await this.analyzeAffordability({
				transactions,
				target_rent: targetRent,
				payslip_data: rawPayslipData,
				bank_statement_data: rawBankStatementData,
				tenant_income: tenantIncome || undefined,
				credit_report: creditReport,
				analysis_type: 'comprehensive',
			});

			// 7. Save results to database (Modified to use RPC call)
			await this.saveAnalysisResultsViaRpc(
				applicationId,
				affordabilityResponse,
			);

			return affordabilityResponse;
		} catch (error) {
			console.error('Error creating affordability analysis:', error);
			throw error;
		}
	}

	/**
	 * Analyzes affordability with provided data
	 *
	 * @param requestData Complete request data with all financial information
	 * @returns Analysis results including affordability assessment
	 */
	async analyzeAffordability(
		requestData: AffordabilityRequest,
	): Promise<AffordabilityResponse> {
		try {
			console.log('Sending data to CrewAI:', {
				transactions_count: requestData.transactions.length,
				target_rent: requestData.target_rent,
				has_payslip: !!requestData.payslip_data,
				has_bank_statement: !!requestData.bank_statement_data,
				has_credit_report: !!requestData.credit_report,
				has_tenant_income: !!requestData.tenant_income,
				analysis_type: requestData.analysis_type,
			});

			const response = await fetch(this.API_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestData),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`API error: ${response.status} - ${errorText}`);
			}

			const data = await response.json();
			console.log('Received analysis from CrewAI:', {
				can_afford: data.can_afford,
				confidence: data.confidence,
				risk_factors_count: data.risk_factors?.length,
				recommendations_count: data.recommendations?.length,
			});

			return data as AffordabilityResponse;
		} catch (error) {
			console.error('Affordability analysis error:', error);
			throw error;
		}
	}

	/**
	 * Extracts transactions and raw data from bank statement documents
	 *
	 * @param tenantId Tenant ID for fetching documents
	 * @param applicationId Optional application ID to filter documents
	 * @returns Formatted transactions and raw extracted data for analysis
	 */
	async getTransactionsAndRawData(
		tenantId: string,
		applicationId?: string,
	): Promise<{
		transactions: Transaction[];
		rawBankStatementData: Json | null;
	}> {
		let rawData: Json | null = null; // Store combined raw data

		try {
			// Build query for bank statement documents
			let query = supabase
				.from('documents')
				.select('*')
				.eq('user_id', tenantId)
				.eq('document_type', 'bank_statement');

			// Add application filter if provided
			if (applicationId) {
				query = query.eq('application_id', applicationId);
			}

			// Execute query
			const { data: documents, error } = await query;

			if (error) throw error;

			if (!documents || documents.length === 0) {
				console.log('No bank statement documents found');
				return { transactions: [], rawBankStatementData: null };
			}

			console.log(`Found ${documents.length} bank statement documents`);

			// Extract and format transactions from document data
			const transactions: Transaction[] = [];
			const allExtractedData: Json[] = []; // Array to hold raw data from each doc

			for (const doc of documents) {
				console.log(
					`Processing document ${doc.id} for raw data and transactions`,
				);
				const extractedData = doc.extracted_data; // Keep as Json

				if (extractedData) {
					// Store the raw extracted data
					allExtractedData.push(extractedData);

					// Attempt to parse transactions from the raw data if possible
					if (
						typeof extractedData === 'object' &&
						extractedData !== null &&
						'transactions' in extractedData &&
						Array.isArray(extractedData.transactions)
					) {
						const docTransactions = (
							extractedData.transactions as Record<string, unknown>[]
						).map((t: Record<string, unknown>) => ({
							description:
								(t.description as string) || (t.narrative as string) || '',
							amount: parseFloat(
								((t.amount as string) || '0').replace(/[^0-9.-]+/g, ''),
							),
							date: t.date as string, // Assuming date is already string DD/MM/YYYY
							type:
								parseFloat(
									((t.amount as string) || '0').replace(/[^0-9.-]+/g, ''),
								) >= 0
									? 'credit'
									: 'debit',
						}));
						console.log(
							`Added ${docTransactions.length} transactions from document ${doc.id}`,
						);
						transactions.push(...docTransactions);
					} else {
						console.log(
							`No standard 'transactions' array found in extracted data for doc ${doc.id}`,
						);
					}
				} else {
					console.log(`No extracted_data found in document ${doc.id}`);
				}
			}

			// Combine raw data from all documents into a single JSON object or array if needed
			// For simplicity, let's send an array of the extracted data objects.
			// The Python backend might need adjustment to handle an array.
			rawData = allExtractedData.length > 0 ? allExtractedData : null;

			return { transactions, rawBankStatementData: rawData };
		} catch (error) {
			console.error('Error fetching transactions and raw data:', error);
			return { transactions: [], rawBankStatementData: null };
		}
	}

	/**
	 * Extracts payslip data and raw data from uploaded documents
	 */
	async getPayslipAndRawData(
		tenantId: string,
		applicationId: string,
	): Promise<{ payslipData?: PayslipData; rawPayslipData: Json | null }> {
		let rawData: Json | null = null;
		let formattedPayslipData: PayslipData | undefined = undefined;

		try {
			// Get payslip documents
			const { data: documents, error } = await supabase
				.from('documents')
				.select('*')
				.eq('user_id', tenantId)
				.eq('application_id', applicationId)
				.eq('document_type', 'payslip');

			if (error) throw error;
			if (!documents || documents.length === 0)
				return { payslipData: undefined, rawPayslipData: null };

			// Use the most recent payslip for both raw and formatted data
			const latestPayslip = documents.sort(
				(a, b) =>
					new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
			)[0];

			rawData = latestPayslip.extracted_data; // Store raw JSON data

			if (
				rawData &&
				typeof rawData === 'object' &&
				rawData !== null &&
				!Array.isArray(rawData)
			) {
				// Attempt to format into PayslipData interface from raw data
				formattedPayslipData = {
					employer:
						this.extractStringValue(rawData, ['employer', 'company_name']) ||
						'Unknown',
					employeeName:
						this.extractStringValue(rawData, ['employee_name', 'employee']) ||
						'Unknown Employee',
					employeeId:
						this.extractStringValue(rawData, [
							'employee_id',
							'employee_number',
						]) || undefined,
					payPeriod:
						this.extractStringValue(rawData, [
							'pay_period',
							'payment_period',
						]) || undefined,
					grossIncome:
						this.extractNumericValue(rawData, [
							'gross_income',
							'gross_pay',
							'total_earnings',
						]) || 0,
					netIncome:
						this.extractNumericValue(rawData, [
							'net_income',
							'net_pay',
							'take_home_pay',
						]) || 0,
					// Deductions might be complex, handle basic case or leave out
					// deductions: rawData.deductions as Record<string, number> || undefined,
					incomeFrequency: 'monthly', // Assuming monthly, might need parsing from doc
				};
			}

			return { payslipData: formattedPayslipData, rawPayslipData: rawData };
		} catch (error) {
			console.error('Error getting payslip data:', error);
			return { payslipData: undefined, rawPayslipData: null };
		}
	}

	/**
	 * Gets tenant income data from their profile and application
	 */
	async getTenantIncomeData(
		tenantId: string,
		applicationId?: string,
	): Promise<TenantIncomeData | undefined> {
		try {
			// Get tenant profile information - Ensure this fetches the correct profile ID
			const { data: profile, error: profileError } = await supabase
				.from('tenant_profiles')
				.select('id, monthly_income, employment_status') // Select id too
				.eq('tenant_id', tenantId) // Query by the user's auth ID
				.maybeSingle(); // Use maybeSingle to avoid error if profile doesn't exist yet

			if (profileError) {
				console.error('Error fetching tenant profile:', profileError);
				// Don't throw, maybe income comes only from application
			}

			// Start with data potentially from the profile
			const incomeData: Partial<TenantIncomeData> = {
				statedMonthlyIncome: profile?.monthly_income ?? 0,
				employmentStatus: profile?.employment_status || 'Unknown',
			};

			let tenantProfileId = profile?.id; // Get profile ID if it exists

			// Try to get employer information from the specific application
			if (applicationId) {
				const { data: application, error: appError } = await supabase
					.from('applications')
					.select('employer, employment_duration, monthly_income, tenant_id') // Fetch income from application too, and tenant_id (which should be profile_id)
					.eq('id', applicationId)
					.single();

				if (appError) {
					console.error('Error fetching application details:', appError);
				} else if (application) {
					incomeData.employer = application.employer;
					incomeData.employmentDuration = application.employment_duration;
					// Override profile income if application income is present and different
					if (
						application.monthly_income &&
						application.monthly_income !== incomeData.statedMonthlyIncome
					) {
						console.log(
							`Using monthly income from application (${application.monthly_income}) instead of profile (${incomeData.statedMonthlyIncome})`,
						);
						incomeData.statedMonthlyIncome = application.monthly_income;
					}
					// Use the tenant_id from the application if profile wasn't found
					if (!tenantProfileId) {
						tenantProfileId = application.tenant_id;
					}
				}
			}

			// If we still don't have a profile ID (e.g., only application ID provided), try to get profile again using tenant_id from application
			if (!profile && tenantProfileId) {
				const { data: profileFallback, error: profileFallbackError } =
					await supabase
						.from('tenant_profiles')
						.select('monthly_income, employment_status')
						.eq('id', tenantProfileId) // Query by the profile ID stored in application.tenant_id
						.maybeSingle();

				if (profileFallbackError) {
					console.error(
						'Error in profile fallback fetch:',
						profileFallbackError,
					);
				} else if (profileFallback) {
					// Only update if profile income wasn't already set from application
					if (
						!incomeData.statedMonthlyIncome &&
						profileFallback.monthly_income
					) {
						incomeData.statedMonthlyIncome = profileFallback.monthly_income;
					}
					if (
						incomeData.employmentStatus === 'Unknown' &&
						profileFallback.employment_status
					) {
						incomeData.employmentStatus = profileFallback.employment_status;
					}
				}
			}

			// Ensure statedMonthlyIncome is a number
			const finalIncome = Number(incomeData.statedMonthlyIncome) || 0;

			// Return structured data only if income is positive
			if (finalIncome > 0) {
				return {
					statedMonthlyIncome: finalIncome,
					employmentStatus: incomeData.employmentStatus || 'Unknown',
					employer: incomeData.employer,
					employmentDuration: incomeData.employmentDuration,
				};
			}

			return undefined; // Return undefined if no valid income found
		} catch (error) {
			console.error('Error getting tenant income data:', error);
			return undefined;
		}
	}

	/**
	 * Generates a mock credit report based on tenant information
	 *
	 * @param tenantId Tenant ID for generating the report
	 * @returns Mock credit report data
	 */
	async generateCreditReport(tenantId: string): Promise<CreditReportData> {
		try {
			// This is where we would integrate with a real credit bureau API
			// For now, we'll generate a mock report based on the template in verifyId-credit-resport-api-response.json

			// Get tenant profile data for more realistic mock
			const { data: profile } = await supabase
				.from('tenant_profiles')
				.select('*')
				.eq('tenant_id', tenantId)
				.single();

			// Generate a credit score between 580-820
			// Higher income = better score (simplistic but works for mock)
			let baseScore = 650;
			if (profile?.monthly_income) {
				// Adjust score based on income (higher income, higher score)
				const incomeScore = Math.min(
					150,
					Math.floor((profile.monthly_income / 20000) * 150),
				);
				baseScore += incomeScore;
			}

			// Keep score within reasonable bounds
			const creditScore = Math.max(580, Math.min(820, baseScore));

			// Get employment history from mock data template
			const employmentHistory: Array<{
				employerName: string;
				startDate: string;
				endDate?: string;
			}> = [];

			// Template for raw credit report data based on verifyId-credit-resport-api-response.json
			const rawTemplate = {
				Status: 'Success',
				Results: {
					CC_RESULTS: {
						EnqCC_EMPLOYER: [
							{
								EMP_NAME: profile?.employment_status || 'CURRENT EMPLOYER',
								EMP_DATE: new Date().toLocaleDateString('en-ZA'),
								OCCUPATION: 'PROFESSIONAL',
							},
						],
						EnqCC_CompuSCORE: [
							{
								RISK_TYPE:
									creditScore > 700
										? 'LOW RISK'
										: creditScore > 650
										? 'AVERAGE RISK'
										: 'HIGH RISK',
								SCORE: creditScore.toString(),
								THIN_FILE_INDICATOR: 'N',
								VERSION: '2',
								SCORE_TYPE: 'CPA',
							},
						],
					},
					CREDITS: -1,
				},
			};

			// Create the credit report data
			return {
				creditScore,
				reportDate: new Date().toISOString().split('T')[0],
				accountsSummary: {
					totalAccounts: 3,
					accountsInGoodStanding: 3,
					negativeAccounts: 0,
				},
				employmentHistory,
				raw: rawTemplate,
			};
		} catch (error) {
			console.error('Error generating credit report:', error);
			// If we fail, still return a basic credit report
			return {
				creditScore: 650, // Default middle-of-the-road score
				reportDate: new Date().toISOString().split('T')[0],
			};
		}
	}

	/**
	 * Gets the target rent for a property
	 *
	 * @param propertyId ID of the property
	 * @returns Monthly rent amount
	 */
	async getTargetRent(propertyId: string): Promise<number> {
		try {
			// Fetch property details to get target rent
			const { data: property, error } = await supabase
				.from('properties')
				.select('monthly_rent')
				.eq('id', propertyId)
				.single();

			if (error) throw error;

			return property ? property.monthly_rent : 0;
		} catch (error) {
			console.error('Error fetching target rent:', error);
			return 0;
		}
	}

	/**
	 * Saves analysis results to the screening report using an RPC function to bypass RLS.
	 * NOTE: You need to create the `save_screening_report` function in your Supabase SQL editor.
	 *
	 * @param applicationId Application ID to link the report
	 * @param analysis Analysis results from the API
	 * @returns The saved screening report or null on error
	 */
	async saveAnalysisResultsViaRpc(
		applicationId: string,
		analysis: AffordabilityResponse,
	): Promise<Tables<'screening_reports'> | null> {
		try {
			// Extract credit score with better fallback handling
			// Credit score could be in metrics or in credit_analysis
			const creditScore =
				typeof analysis.metrics?.credit_score === 'number'
					? analysis.metrics.credit_score
					: analysis.credit_analysis?.score_category
					? Number(analysis.credit_analysis.score_category) ||
					  analysis.credit_analysis.score_category === 'Good'
						? 700
						: analysis.credit_analysis.score_category === 'Excellent'
						? 750
						: 650
					: null;

			// Calculate affordability score (debt-to-income ratio)
			// This should be a decimal value like 0.3 (meaning 30%)
			const affordabilityScore =
				typeof analysis.metrics?.debt_to_income_ratio === 'number'
					? analysis.metrics.debt_to_income_ratio
					: null;

			// Extract monthly income from metrics with fallback
			const monthlyIncome =
				typeof analysis.metrics?.monthly_income === 'number'
					? analysis.metrics.monthly_income
					: null;

			// Get affordability notes, defaulting to transaction analysis summary if available
			const affordabilityNotes =
				(analysis.transaction_analysis?.summary as string) ||
				(analysis.can_afford
					? 'Tenant can likely afford this property based on income and expense patterns.'
					: 'Tenant may have difficulty affording this property based on income and expense patterns.');

			// Determine pre-approval status based on the analysis result
			const preApprovalStatus = analysis.can_afford ? 'approved' : 'rejected';

			// Format the text recommendation - use the first recommendation from the AI analysis
			let recommendationText: string | null = null;
			if (analysis.recommendations && analysis.recommendations.length > 0) {
				// Take the first recommendation, ensure it's a string, and limit length
				const firstRec = analysis.recommendations[0];
				recommendationText = String(firstRec).substring(0, 250); // Limit to 250 chars
			} else {
				// Provide a generic default if AI gives no recommendation
				recommendationText =
					preApprovalStatus === 'approved'
						? 'Review financial details for final decision.'
						: 'Affordability concerns identified. Review income and expenses.';
			}

			// Ensure recommendation is not trivially short (adjust min length if needed)
			if (recommendationText && recommendationText.length < 10) {
				recommendationText =
					preApprovalStatus === 'approved'
						? 'Review details for approval.'
						: 'Review details for rejection.';
			}

			console.log('Using text recommendation:', recommendationText);
			console.log('Using pre-approval status:', preApprovalStatus);

			// Prepare the data payload for the RPC function
			const reportPayload = {
				p_application_id: applicationId,
				p_affordability_score: affordabilityScore,
				p_affordability_notes: affordabilityNotes,
				p_income_verification:
					analysis.income_verification?.is_verified ?? analysis.can_afford,
				p_pre_approval_status: preApprovalStatus, // Correctly mapped status
				p_recommendation: recommendationText, // Correctly mapped AI text recommendation
				p_report_data: analysis, // Send the full analysis object as JSON
				p_background_check_status: 'passed', // Assuming default 'passed'
				p_credit_score: creditScore,
				p_monthly_income: monthlyIncome, // Pass monthly income explicitly
			};

			console.log(
				'Calling RPC save_screening_report with payload:',
				reportPayload,
			);

			// Call the RPC function
			const { data, error } = await supabase.rpc(
				'save_screening_report', // Name of your RPC function
				reportPayload,
			);

			if (error) {
				console.error('Error calling save_screening_report RPC:', error);
				throw error;
			}

			console.log('RPC save_screening_report successful, returned:', data);

			// The RPC function should return the inserted/updated screening report row
			// If it returns just an ID or boolean, you might need to fetch the report separately
			// Assuming the RPC returns the full row:
			return data as Tables<'screening_reports'>;
		} catch (error) {
			console.error('Error saving analysis results via RPC:', error);
			return null;
		}
	}

	/**
	 * Creates a mock API response for testing
	 *
	 * @param targetRent Target monthly rent amount
	 * @returns Mock affordability analysis
	 */
	createMockResponse(targetRent: number): AffordabilityResponse {
		// Calculate a reasonable income based on the target rent
		const estimatedIncome = targetRent * 3;
		const affordabilityRatio = targetRent / estimatedIncome;

		// Determine affordability based on the 30% rule
		const canAfford = affordabilityRatio <= 0.3;

		return {
			can_afford: canAfford,
			confidence: canAfford ? 0.85 : 0.65,
			risk_factors: canAfford
				? ['Limited credit history', 'Recent change in employment']
				: [
						'High debt-to-income ratio',
						'Inconsistent income',
						'Recent bounced payments',
				  ],
			recommendations: canAfford
				? [
						'Consider setting up automatic payments to ensure rent is paid on time',
						"Build emergency savings of at least 3 months' rent",
				  ]
				: [
						'Look for more affordable rental options',
						'Increase income through additional sources',
						'Reduce existing debt obligations',
				  ],
			metrics: {
				monthly_income: estimatedIncome,
				monthly_expenses: estimatedIncome * 0.6,
				debt_to_income_ratio: affordabilityRatio,
				savings_rate: 0.1,
				credit_score: canAfford ? 720 : 630,
			},
			transaction_analysis: {
				income_stability: canAfford ? 'Stable' : 'Inconsistent',
				expense_categories: {
					housing: targetRent,
					utilities: estimatedIncome * 0.15,
					food: estimatedIncome * 0.2,
					transportation: estimatedIncome * 0.1,
					entertainment: estimatedIncome * 0.05,
					debt_payments: estimatedIncome * 0.1,
				},
				summary: canAfford
					? 'Based on transaction analysis, the applicant has stable income and responsible spending habits.'
					: 'Transaction analysis shows inconsistent income and high existing debt obligations.',
			},
			income_verification: {
				is_verified: canAfford,
				confidence: canAfford ? 0.9 : 0.6,
				stated_vs_documented_ratio: canAfford ? 1.05 : 1.35, // >1 means stated income is higher than documented
				notes: canAfford
					? 'Stated income matches bank deposits and payslip information'
					: 'Stated income is significantly higher than documented income',
			},
			credit_analysis: {
				score_category: canAfford ? 'Good' : 'Fair',
				risk_level: canAfford ? 'Low' : 'Medium',
				notes: canAfford
					? 'Credit history shows responsible financial management'
					: 'Credit history shows some areas of concern',
			},
		};
	}

	/**
	 * Helper method to extract a numeric value from extracted data
	 */
	private extractNumericValue(
		data: Record<string, unknown>,
		possibleKeys: string[],
	): number | null {
		for (const key of possibleKeys) {
			const value = data[key];
			if (value !== undefined) {
				// Handle different types of values
				if (typeof value === 'number') {
					return value;
				} else if (typeof value === 'string') {
					// Try to parse numeric value from string, removing currency symbols
					const numStr = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
					const parsed = parseFloat(numStr);
					if (!isNaN(parsed)) {
						return parsed;
					}
				}
			}
		}
		return null;
	}

	/**
	 * Helper method to extract a string value from extracted data
	 */
	private extractStringValue(
		data: Record<string, unknown>,
		possibleKeys: string[],
	): string | null {
		for (const key of possibleKeys) {
			const value = data[key];
			if (
				value !== undefined &&
				(typeof value === 'string' || typeof value === 'number')
			) {
				return String(value);
			}
		}
		return null;
	}
}

export const affordabilityService = new AffordabilityService();
