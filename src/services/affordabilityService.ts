/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '../services/supabase';
import { Tables, Json } from './database.types';
import {
	calculateRentToIncomeRatio,
	generateAffordabilityNotes,
	generateRecommendationText,
} from '../utils/financialUtils';
import {
	getTransactionsFromDocuments,
	fetchDocuments,
} from '../utils/documentUtils';
import { trackScreeningUsage } from './subscriptionService';

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

export interface CreditReportAccounts {
	total: number;
	good_standing: number;
	negative: number;
}

export interface EmploymentRecord {
	employerName: string;
	startDate: string;
	endDate?: string;
}

export interface PublicRecord {
	type: string;
	date: string;
	amount?: number;
}

export interface CreditReportData {
	creditScore: number;
	reportDate: string;
	accountsSummary?: {
		totalAccounts: number;
		accountsInGoodStanding: number;
		negativeAccounts: number;
	};
	employmentHistory?: Array<EmploymentRecord>;
	publicRecords?: Array<PublicRecord>;
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
			? 'https://ai.agentamara.com/analyze-affordability'
			: 'http://localhost:8000/analyze-affordability';

	/**
	 * Creates a comprehensive affordability analysis for a tenant application
	 */
	async createAffordabilityAnalysis(
		applicationId: string,
		tenantId: string,
		propertyId: string,
	): Promise<AffordabilityResponse> {
		try {
			// Enhanced session state logging
			const { data: initialSessionData } = await supabase.auth.getSession();

			const originalAccessToken = initialSessionData.session?.access_token;
			const originalRefreshToken = initialSessionData.session?.refresh_token;

			// Modified: Retrieve both tenant_id and agent_id from the application record
			const { data: application, error: appError } = await supabase
				.from('applications')
				.select('tenant_id, agent_id')
				.eq('id', applicationId)
				.single();

			if (appError) {
				console.error('Error fetching application:', appError);
				throw appError;
			}
			const agentId = application.agent_id;

			// Updated: Fetch subscription and join plan to get includes_credit_check
			const { data: subscription, error: subError } = await supabase
				.from('subscriptions')
				.select('*, plan:plans(*)')
				.eq('user_id', agentId)
				.eq('status', 'active')
				.single();
			if (subError || !subscription) {
				console.error('No active subscription found for screening.', {
					agentId,
					subError,
					subscription,
				});
				throw new Error('No active subscription found for screening.');
			}
			if (subscription.current_usage >= subscription.usage_limit) {
				console.error('Subscription usage limit exceeded.', {
					agentId,
					current_usage: subscription.current_usage,
					usage_limit: subscription.usage_limit,
				});
				throw new Error('Subscription usage limit exceeded.');
			}

			// Determine if credit check is included in the plan
			const includesCreditCheck =
				subscription.plan?.includes_credit_check === true;

			// 1. Get transactions AND raw bank statement data
			const documents = await fetchDocuments(
				tenantId,
				'bank_statement',
				undefined, // Do not filter by applicationId, allow reuse of valid documents
			);

			// Optionally: filter for most recent valid document(s) if needed
			// (e.g., by created_at, verification_status, etc.)

			const transactions = await getTransactionsFromDocuments(documents);

			const rawBankStatementData =
				documents.length > 0 ? documents.map((d) => d.extracted_data) : null;

			// 2. Get payslip data (also do not filter by applicationId)
			const { data: payslipDocs } = await supabase
				.from('documents')
				.select('*')
				.eq('user_id', tenantId)
				.eq('document_type', 'payslip')
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle();
			const rawPayslipData = payslipDocs?.extracted_data || null;

			// 3. Get tenant income information
			const tenantIncome = await this.getTenantIncomeData(
				tenantId,
				applicationId,
			);

			// 4. Conditionally generate credit report using the tenant profile ID
			let creditReport: CreditReportData | undefined = undefined;
			if (includesCreditCheck) {
				creditReport = await this.generateCreditReport(application.tenant_id);
			}

			// 5. Get target rent amount
			const targetRent = await this.getTargetRent(propertyId);

			// 6. Analyze affordability with all data
			const affordabilityRequest: AffordabilityRequest = {
				transactions,
				target_rent: targetRent,
				payslip_data: rawPayslipData,
				bank_statement_data: rawBankStatementData,
				tenant_income: tenantIncome || undefined,
				credit_report: creditReport,
				analysis_type: 'comprehensive',
			};

			const affordabilityResponse = await this.analyzeAffordability(
				affordabilityRequest,
			);

			// Ensure credit score is in metrics
			if (!affordabilityResponse.metrics.credit_score && creditReport) {
				affordabilityResponse.metrics.credit_score = creditReport.creditScore;
			}

			// Ensure target rent is in metrics
			if (!affordabilityResponse.metrics.target_rent) {
				affordabilityResponse.metrics.target_rent = targetRent;
			}

			await this.saveAnalysisResultsViaRpc(
				applicationId,
				affordabilityResponse,
			);

			// Enhanced session restoration
			if (originalAccessToken && originalRefreshToken) {
				try {
					const { error: restoreError } = await supabase.auth.setSession({
						access_token: originalAccessToken,
						refresh_token: originalRefreshToken as any,
					});

					if (restoreError) {
						console.error(
							'[Affordability] Session restore error:',
							restoreError,
						);
					}
				} catch (restoreError) {
					console.error(
						'[Affordability] Session restore failed:',
						restoreError,
					);
				}
			}

			// New: Increment subscription usage after a successful screening
			const usageResult = await trackScreeningUsage(agentId);
			if (!usageResult?.success) {
				throw new Error(
					`Screening usage tracking failed: ${
						usageResult?.message || 'Unknown error'
					}`,
				);
			}

			return affordabilityResponse;
		} catch (error) {
			// Log session state on error
			const { data: errorSessionData } = await supabase.auth.getSession();
			console.error('[Affordability] Error occurred. Session state:', {
				hasSession: !!errorSessionData.session,
				expiresAt: errorSessionData.session?.expires_at,
				userId: errorSessionData.session?.user?.id,
				accessToken: errorSessionData.session?.access_token
					? 'present'
					: 'missing',
				refreshToken: errorSessionData.session?.refresh_token
					? 'present'
					: 'missing',
			});
			console.error('Error creating affordability analysis:', error);
			throw error;
		}
	}

	/**
	 * Analyzes affordability with provided data
	 */
	async analyzeAffordability(
		requestData: AffordabilityRequest,
	): Promise<AffordabilityResponse> {
		try {
			const response = await fetch(this.API_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestData),
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error('CrewAI API error:', errorText);
				throw new Error(`API error: ${response.status} - ${errorText}`);
			}

			const data = await response.json();

			return data as AffordabilityResponse;
		} catch (error) {
			console.error('Affordability analysis error:', error);
			throw error;
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
			// Get tenant profile information
			const { data: profile, error: profileError } = await supabase
				.from('tenant_profiles')
				.select('id, monthly_income, employment_status')
				.eq('tenant_id', tenantId)
				.maybeSingle();

			if (profileError) {
				console.error('Error fetching tenant profile:', profileError);
			}

			const incomeData: Partial<TenantIncomeData> = {
				statedMonthlyIncome: profile?.monthly_income ?? 0,
				employmentStatus: profile?.employment_status || 'Unknown',
			};

			let tenantProfileId = profile?.id;

			if (applicationId) {
				const { data: application, error: appError } = await supabase
					.from('applications')
					.select('employer, employment_duration, monthly_income, tenant_id')
					.eq('id', applicationId)
					.single();

				if (appError) {
					console.error('Error fetching application details:', appError);
				} else if (application) {
					incomeData.employer = application.employer;
					incomeData.employmentDuration = application.employment_duration;
					if (
						application.monthly_income &&
						application.monthly_income !== incomeData.statedMonthlyIncome
					) {
						incomeData.statedMonthlyIncome = application.monthly_income;
					}
					if (!tenantProfileId) {
						tenantProfileId = application.tenant_id;
					}
				}
			}

			if (!profile && tenantProfileId) {
				const { data: profileFallback, error: profileFallbackError } =
					await supabase
						.from('tenant_profiles')
						.select('monthly_income, employment_status')
						.eq('id', tenantProfileId)
						.maybeSingle();

				if (profileFallbackError) {
					console.error(
						'Error in profile fallback fetch:',
						profileFallbackError,
					);
				} else if (profileFallback) {
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

			const finalIncome = Number(incomeData.statedMonthlyIncome) || 0;

			return finalIncome > 0
				? {
						statedMonthlyIncome: finalIncome,
						employmentStatus: incomeData.employmentStatus || 'Unknown',
						employer: incomeData.employer,
						employmentDuration: incomeData.employmentDuration,
				  }
				: undefined;
		} catch (error) {
			console.error('Error getting tenant income data:', error);
			return undefined;
		}
	}

	/**
	 * Gets the target rent for a property
	 */
	async getTargetRent(propertyId: string): Promise<number> {
		try {
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
	 * Save analysis results to database using RPC
	 */
	async saveAnalysisResultsViaRpc(
		applicationId: string,
		analysis: AffordabilityResponse,
	): Promise<Tables<'screening_reports'> | null> {
		try {
			// Get values needed for calculations
			const targetRent =
				typeof analysis.metrics?.target_rent === 'number'
					? analysis.metrics.target_rent
					: null;

			const monthlyIncome =
				typeof analysis.metrics?.monthly_income === 'number'
					? analysis.metrics.monthly_income
					: null;

			const creditScore =
				typeof analysis.metrics?.credit_score === 'number'
					? analysis.metrics.credit_score
					: null;

			// Calculate rent-to-income ratio
			const { ratio: rentToIncomeRatio } = calculateRentToIncomeRatio(
				targetRent,
				monthlyIncome,
				analysis,
			);

			// Update metrics if needed
			if (analysis.metrics.rent_to_income_ratio !== rentToIncomeRatio) {
				analysis.metrics.rent_to_income_ratio = rentToIncomeRatio;
			}

			// Ensure all required metrics are present
			if (targetRent !== null && !analysis.metrics.target_rent) {
				analysis.metrics.target_rent = targetRent;
			}
			if (monthlyIncome !== null && !analysis.metrics.monthly_income) {
				analysis.metrics.monthly_income = monthlyIncome;
			}

			// Get the application to find the tenant ID and agent ID
			const { data: application, error: appError } = await supabase
				.from('applications')
				.select('tenant_id, agent_id')
				.eq('id', applicationId)
				.single();

			if (appError) {
				console.error('Error fetching application:', appError);
				throw appError;
			}

			// NEW: Get tenant profile ID (which may differ from user ID)
			const { data: tenantProfile, error: tenantProfileError } = await supabase
				.from('tenant_profiles')
				.select('*')
				.eq('id', application.tenant_id)
				.maybeSingle();
			if (tenantProfileError || !tenantProfile) {
				throw new Error('No tenant profile found for this user');
			}

			// Get the most recent credit report for this tenant
			const { data: creditReport, error: creditError } = await supabase
				.from('credit_reports')
				.select('id')
				.eq('tenant_id', application.tenant_id)
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle();

			if (creditError) {
				console.error('Error fetching credit report:', creditError);
			}

			// Generate affordability notes and recommendation
			const affordabilityNotes = generateAffordabilityNotes(analysis);
			const preApprovalStatus = analysis.can_afford ? 'approved' : 'rejected';
			const recommendationText = generateRecommendationText(
				analysis,
				preApprovalStatus,
			);

			const reportPayload = {
				p_application_id: applicationId,
				p_agent_id_val: application.agent_id, // renamed key
				p_tenant_id_val: tenantProfile.id, // renamed key
				p_affordability_score: rentToIncomeRatio,
				p_affordability_notes: affordabilityNotes,
				p_income_verification:
					analysis.income_verification?.is_verified ?? analysis.can_afford,
				p_pre_approval_status: preApprovalStatus,
				p_recommendation: recommendationText,
				p_report_data: analysis,
				p_background_check_status: 'passed',
				p_credit_score: creditScore,
				p_monthly_income: monthlyIncome,
				p_credit_report_id: creditReport?.id || null,
			};

			const { data, error } = await supabase.rpc(
				'save_screening_report',
				reportPayload,
			);

			if (error) {
				// Enhanced error logging
				console.error('RPC Error Details:', {
					code: error.code,
					message: error.message,
					details: error.details,
					hint: error.hint,
					payload: reportPayload, // Log the exact payload that caused the error
				});
				throw error;
			}

			return data as Tables<'screening_reports'>;
		} catch (error) {
			console.error('Error saving analysis results via RPC:', error);
			return null;
		}
	}

	/**
	 * Generate credit report from VerifyID API or database
	 */
	private async generateCreditReport(
		tenantProfileId: string, // Changed parameter to accept tenant profile ID
	): Promise<CreditReportData | undefined> {
		try {
			// First check if we have a recent credit report
			const { data: existingReport, error: reportError } = await supabase
				.from('credit_reports')
				.select('*')
				.eq('tenant_id', tenantProfileId)
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle();

			if (reportError) {
				console.error('Error fetching existing credit report:', reportError);
			} else if (existingReport) {
				const accounts = existingReport.accounts as CreditReportAccounts | null;
				const employers = existingReport.employers as EmploymentRecord[] | null;
				const publicRecords = existingReport.public_records as
					| PublicRecord[]
					| null;
				const rawData = existingReport.raw_data as Record<
					string,
					unknown
				> | null;

				// Convert stored report to CreditReportData format
				return {
					creditScore: existingReport.credit_score || 0,
					reportDate: existingReport.report_date,
					accountsSummary: accounts
						? {
								totalAccounts: accounts.total || 0,
								accountsInGoodStanding: accounts.good_standing || 0,
								negativeAccounts: accounts.negative || 0,
						  }
						: undefined,
					employmentHistory: employers || undefined,
					publicRecords: publicRecords || undefined,
					raw: rawData || undefined,
				};
			}

			// Get tenant profile data for VerifyID API
			const { data: tenantProfile, error: profileError } = await supabase
				.from('tenant_profiles')
				.select('id_number, first_name, last_name')
				.eq('id', tenantProfileId)
				.single();

			if (profileError || !tenantProfile) {
				throw new Error('Unable to fetch tenant profile data');
			}

			// Get access token for secure Edge Function call
			const { data: sessionData, error: sessionError } =
				await supabase.auth.getSession();
			if (sessionError || !sessionData.session?.access_token) {
				throw new Error('Unable to retrieve user session for VerifyID call');
			}
			const accessToken = sessionData.session.access_token;

			// Call VerifyID API endpoint with tenant profile data
			const response = await fetch(
				'https://ixltqflrvgsirvrzgqtq.supabase.co/functions/v1/verifyid-credit-report',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${accessToken}`,
					},
					body: JSON.stringify({
						tenant_id: tenantProfileId,
						id_number: tenantProfile.id_number,
						first_name: tenantProfile.first_name,
						surname: tenantProfile.last_name,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`VerifyID API error: ${response.statusText}`);
			}

			const creditReport = await response.json();

			// Store PDF file if it exists in the response
			let pdfPath: string | undefined;
			if (creditReport.pdf_file) {
				try {
					// Convert base64 PDF to Blob
					const pdfBlob = await fetch(
						`data:application/pdf;base64,${creditReport.pdf_file}`,
					).then((res) => res.blob());

					// Generate unique filename
					const fileName = `${tenantProfileId}/${Date.now()}_credit_report.pdf`;

					// Upload to Supabase storage
					const { data: fileData, error: uploadError } = await supabase.storage
						.from('tenant_documents')
						.upload(fileName, pdfBlob, {
							contentType: 'application/pdf',
							cacheControl: '3600',
							upsert: false,
						});

					if (uploadError) {
						console.error('Error uploading credit report PDF:', uploadError);
					} else {
						pdfPath = fileData?.path;
					}
				} catch (uploadError) {
					console.error('Error processing PDF file:', uploadError);
				}
			}

			// Save credit report data to database
			const { data: savedReport, error: saveError } = await supabase
				.from('credit_reports')
				.insert({
					tenant_id: tenantProfileId,
					credit_score: creditReport.credit_score,
					risk_type: creditReport.risk_type,
					status: creditReport.status,
					accounts: creditReport.accounts,
					employers: creditReport.employers,
					public_records: creditReport.public_records,
					payment_history: creditReport.payment_history,
					raw_data: creditReport.raw_data,
					pdf_path: pdfPath, // Store the path to the PDF
					report_date: new Date().toISOString(),
				})
				.select()
				.single();

			if (saveError) {
				console.error('Error saving credit report:', saveError);
				throw saveError;
			}

			// Return formatted credit report data
			return {
				creditScore: savedReport.credit_score || 0,
				reportDate: savedReport.report_date,
				accountsSummary: savedReport.accounts
					? {
							totalAccounts: savedReport.accounts.total || 0,
							accountsInGoodStanding: savedReport.accounts.good_standing || 0,
							negativeAccounts: savedReport.accounts.negative || 0,
					  }
					: undefined,
				employmentHistory: savedReport.employers || undefined,
				publicRecords: savedReport.public_records || undefined,
				raw: savedReport.raw_data || undefined,
			};
		} catch (error) {
			console.error('Error generating credit report:', error);
			return undefined;
		}
	}
}

export const affordabilityService = new AffordabilityService();
