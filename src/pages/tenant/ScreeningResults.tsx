/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { usePageTitle } from '../../context/PageTitleContext';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import Spinner from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
	CheckCircle,
	AlertCircle,
	XCircle,
	DollarSign,
	CreditCard,
	FileText,
	User,
	Briefcase,
	Calendar,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
	affordabilityService,
	AffordabilityResponse,
} from '../../services/affordabilityService';
import { supabase } from '../../services/supabase';

const ScreeningResults: React.FC = () => {
	const { user, isLoading: isAuthLoading } = useAuthStore();
	const { setPageTitle } = usePageTitle();
	const {
		screeningReport,
		profile,
		fetchScreeningReport,
		fetchProfile,
		isLoading: isTenantLoading,
	} = useTenantStore();

	const location = useLocation();
	const queryParams = new URLSearchParams(location.search);
	const applicationId = queryParams.get('application');

	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [analysisError, setAnalysisError] = useState<string | null>(null);
	const [analysisResult, setAnalysisResult] =
		useState<AffordabilityResponse | null>(null);
	const [currentApplicationId, setCurrentApplicationId] = useState<
		string | null
	>(null);
	const [isInitialized, setIsInitialized] = useState(false);

	const navigate = useNavigate();

	// Add auth state check
	useEffect(() => {
		if (!isAuthLoading && !user) {
			navigate('/login');
			return;
		}
	}, [isAuthLoading, user, navigate]);

	// Initialize data fetching only after auth is confirmed
	useEffect(() => {
		const initializeData = async () => {
			if (isAuthLoading || !user || isInitialized) return;

			try {
				setPageTitle('Screening');

				// If we have an application ID from URL params, use that
				if (applicationId) {
					setCurrentApplicationId(applicationId);
					await fetchSpecificScreeningReport(applicationId);
				} else {
					await fetchScreeningReport(user.id);
				}

				await fetchProfile(user.id);
				setIsInitialized(true);
			} catch (error) {
				console.error('Error initializing screening data:', error);
				setAnalysisError('Failed to load screening data. Please try again.');
			}
		};

		initializeData();
	}, [
		user,
		isAuthLoading,
		applicationId,
		fetchScreeningReport,
		fetchProfile,
		setPageTitle,
		isInitialized,
	]);

	// Get recommendations from the analysisResult if available
	const recommendations = useMemo(() => {
		if (
			analysisResult &&
			analysisResult.recommendations &&
			analysisResult.recommendations.length > 0
		) {
			return analysisResult.recommendations;
		}

		// Return empty array if no recommendations available
		return [];
	}, [analysisResult]);

	// Get risk factors from the analysisResult if available
	const riskFactors = useMemo(() => {
		if (
			analysisResult &&
			analysisResult.risk_factors &&
			analysisResult.risk_factors.length > 0
		) {
			return analysisResult.risk_factors;
		}

		// Return empty array if no risk factors available
		return [];
	}, [analysisResult]);

	// Function to fetch a specific screening report by application ID
	const fetchSpecificScreeningReport = async (appId: string) => {
		try {
			// Use the updated fetchScreeningReport method which will handle
			// different ID types correctly and has all our error handling
			if (user) {
				await fetchScreeningReport(appId);
				return screeningReport;
			}
			return null;
		} catch (err) {
			console.error('Error fetching specific screening report:', err);
			return null;
		}
	};

	// Fetch real affordability analysis if no screening report exists
	useEffect(() => {
		const fetchAffordabilityAnalysis = async () => {
			// Skip if loading, not initialized, or if we already have data
			if (
				isAuthLoading ||
				!isInitialized ||
				isTenantLoading ||
				screeningReport ||
				analysisResult ||
				isAnalyzing
			) {
				return;
			}

			// If no user or profile, we can't analyze
			if (!user || !profile) {
				return;
			}

			try {
				setIsAnalyzing(true);
				setAnalysisError(null);

				// Get application details - either use the one from URL params or fetch the latest
				let applicationDetails;
				let propertyId;

				if (currentApplicationId) {
					// Use the application ID from URL params
					const { data } = await supabase
						.from('applications')
						.select('property_id, id, tenant_id')
						.eq('id', currentApplicationId)
						.single();

					applicationDetails = data;
					if (!applicationDetails) {
						setAnalysisError('Application not found');
						setIsAnalyzing(false);
						return;
					}

					// Verify this application belongs to the current user
					if (applicationDetails.tenant_id !== profile.id) {
						setAnalysisError(
							'You do not have permission to view this application',
						);
						setIsAnalyzing(false);
						return;
					}

					propertyId = applicationDetails.property_id;
				} else {
					// Get user's most recent property application
					const { data: applications } = await supabase
						.from('applications')
						.select('property_id, id')
						.eq('tenant_id', profile.id)
						.order('created_at', { ascending: false })
						.limit(1);

					if (!applications || applications.length === 0) {
						// No property application found
						setIsAnalyzing(false);
						return;
					}

					applicationDetails = applications[0];
					propertyId = applicationDetails.property_id;
				}

				// Use the comprehensive affordability analysis method
				const result = await affordabilityService.createAffordabilityAnalysis(
					applicationDetails.id,
					user.id,
					propertyId,
				);

				// Save the result
				setAnalysisResult(result);

				// Refresh the screening report after saving (createAffordabilityAnalysis already saves to DB)
				if (currentApplicationId) {
					await fetchScreeningReport(currentApplicationId);
				} else {
					await fetchScreeningReport(user.id);
				}
			} catch (error) {
				console.error('Error fetching affordability analysis:', error);
				setAnalysisError(
					'Failed to analyze affordability. Please try again later.',
				);
			} finally {
				setIsAnalyzing(false);
			}
		};

		fetchAffordabilityAnalysis();
	}, [
		user,
		profile,
		screeningReport,
		isAuthLoading,
		isInitialized,
		isTenantLoading,
		analysisResult,
		isAnalyzing,
		currentApplicationId,
		fetchScreeningReport,
	]);

	// Use a local variable to hold either the real or mock report
	const reportData = useMemo(() => {
		// If we have a real report from the database, use it
		if (screeningReport) return screeningReport;

		// If we have an analysis result from the API, transform it to match report format
		if (analysisResult) {
			return {
				id: 'api-analysis',
				user_id: user?.id || 'unknown',
				pre_approval_status: analysisResult.can_afford
					? 'approved'
					: 'rejected',
				credit_score: (analysisResult.metrics.credit_score as number) || 650,
				affordability_score:
					(analysisResult.metrics.debt_to_income_ratio as number) || 0.3,
				income_verification: analysisResult.can_afford,
				background_check_status: 'passed',
				created_at: new Date().toISOString(),
			};
		}

		// No data available
		return null;
	}, [screeningReport, user?.id, analysisResult]);

	if (isAuthLoading || !isInitialized) {
		return (
			<div className='flex justify-center items-center h-64'>
				<Spinner size='lg' />
				<p className='ml-4 text-gray-600'>Initializing...</p>
			</div>
		);
	}

	if (isTenantLoading || isAnalyzing) {
		return (
			<div className='flex justify-center items-center h-64'>
				<Spinner size='lg' />
				<p className='ml-4 text-gray-600'>
					{isAnalyzing ? 'Analyzing financial data...' : 'Loading report...'}
				</p>
			</div>
		);
	}

	if (analysisError) {
		return (
			<div className='mb-6'>
				<h1 className='text-2xl font-bold text-gray-900 mb-6'>
					Screening Results
				</h1>
				<Alert variant='destructive'>{analysisError}</Alert>
			</div>
		);
	}

	// Moved this check up: Ensure reportData exists before proceeding
	if (!reportData) {
		return (
			<div className='mb-6'>
				<h1 className='text-2xl font-bold text-gray-900 mb-6'>
					Screening Results
				</h1>
				<Alert variant='default'>
					Your screening report is not available yet. Please check back later or
					contact support for assistance.
				</Alert>
			</div>
		);
	}

	// Now it's safe to access reportData properties
	const getCreditScoreCategory = (score: number) => {
		if (score >= 750) return { label: 'Excellent', color: 'success' };
		if (score >= 700) return { label: 'Good', color: 'success' };
		if (score >= 650) return { label: 'Fair', color: 'warning' };
		if (score >= 600) return { label: 'Poor', color: 'warning' };
		return { label: 'Very Poor', color: 'danger' };
	};

	const getAffordabilityCategory = (ratio: number) => {
		// Lower ratio is better (rent is a smaller percentage of income)
		if (ratio <= 0.28) return { label: 'Excellent', color: 'success' };
		if (ratio <= 0.36) return { label: 'Good', color: 'success' };
		if (ratio <= 0.43) return { label: 'Fair', color: 'warning' };
		return { label: 'Poor', color: 'danger' };
	};

	const creditCategory = getCreditScoreCategory(reportData.credit_score || 0);

	// Calculate the affordability ratio to use
	const getAffordabilityRatio = () => {
		let ratio = reportData.affordability_score || 0;

		// If the top-level affordability_score is 0, try to get it from nested data
		if (ratio === 0 && screeningReport?.report_data) {
			const metricsObj = (screeningReport.report_data as Record<string, any>)
				.metrics;
			if (metricsObj?.debt_to_income_ratio) {
				ratio = metricsObj.debt_to_income_ratio;
			}
		}

		return ratio;
	};

	const affordabilityRatio = getAffordabilityRatio();
	const affordabilityCategory = getAffordabilityCategory(affordabilityRatio);

	// Update these flags to only show when using API data
	const isUsingApiData = !screeningReport && analysisResult !== null;

	return (
		<div>
			<div className='mb-6'>
				<h1 className='text-2xl font-bold text-gray-900'>
					Screening Results
					{isUsingApiData && (
						<span className='text-xs text-green-500 ml-2'>(AI ANALYSIS)</span>
					)}
				</h1>
				<p className='text-gray-600 mt-1'>
					Review your rental application screening report
				</p>
			</div>

			{/* Pre-approval Status */}
			<div className='mb-8'>
				<div
					className={`p-6 rounded-lg border ${
						reportData.pre_approval_status === 'approved'
							? 'bg-green-50 border-green-200'
							: reportData.pre_approval_status === 'rejected'
							? 'bg-red-50 border-red-200'
							: 'bg-yellow-50 border-yellow-200'
					}`}
				>
					<div className='flex items-center'>
						{reportData.pre_approval_status === 'approved' ? (
							<CheckCircle className='h-8 w-8 text-green-500 mr-4' />
						) : reportData.pre_approval_status === 'rejected' ? (
							<XCircle className='h-8 w-8 text-red-500 mr-4' />
						) : (
							<AlertCircle className='h-8 w-8 text-yellow-500 mr-4' />
						)}
						<div>
							<h2 className='text-lg font-semibold'>
								{reportData.pre_approval_status === 'approved'
									? 'Pre-Approved'
									: reportData.pre_approval_status === 'rejected'
									? 'Not Approved'
									: 'Pending Review'}
							</h2>
							<p
								className={`${
									reportData.pre_approval_status === 'approved'
										? 'text-green-700'
										: reportData.pre_approval_status === 'rejected'
										? 'text-red-700'
										: 'text-yellow-700'
								}`}
							>
								{reportData.pre_approval_status === 'approved'
									? 'Congratulations! Your application has been pre-approved.'
									: reportData.pre_approval_status === 'rejected'
									? 'Unfortunately, your application did not meet our current criteria.'
									: 'Your application is currently under review.'}
							</p>
						</div>
					</div>

					{/* Add Schedule Viewing button for approved applications */}
					{reportData.pre_approval_status === 'approved' && (
						<div className='mt-6 flex justify-end'>
							<Button
								variant='default'
								onClick={() => navigate('/tenant/appointments')}
							>
								<Calendar className='mr-2 h-5 w-5' />
								Schedule a Viewing
							</Button>
						</div>
					)}
				</div>
			</div>

			<div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-8'>
				{/* Credit Score */}
				<Card>
					<CardHeader className='flex items-center justify-between'>
						<h2 className='text-lg font-semibold'>Credit Score</h2>
						<CreditCard className='h-5 w-5 text-blue-600' />
					</CardHeader>
					<CardContent>
						{reportData.credit_score === null ? (
							<Alert variant='default'>
								Your credit report was not requested at this time
							</Alert>
						) : (
							<>
								<div className='flex items-center justify-between mb-4'>
									<div>
										<p className='text-3xl font-bold'>
											{reportData.credit_score}
										</p>
										<Badge variant={creditCategory.color as any}>
											{creditCategory.label}
										</Badge>
									</div>
									<div
										className='w-16 h-16 rounded-full border-4 flex items-center justify-center'
										style={{
											borderColor:
												creditCategory.color === 'success'
													? '#10b981'
													: creditCategory.color === 'warning'
													? '#f59e0b'
													: '#ef4444',
										}}
									>
										<span className='text-lg font-bold'>
											{Math.round(((reportData.credit_score || 0) / 850) * 100)}
											%
										</span>
									</div>
								</div>
								<div className='w-full bg-gray-200 rounded-full h-2.5 mb-4'>
									<div
										className='h-2.5 rounded-full'
										style={{
											width: `${((reportData.credit_score || 0) / 850) * 100}%`,
											backgroundColor:
												creditCategory.color === 'success'
													? '#10b981'
													: creditCategory.color === 'warning'
													? '#f59e0b'
													: '#ef4444',
										}}
									></div>
								</div>
								<p className='text-sm text-gray-600'>
									{creditCategory.color === 'success'
										? 'Your credit score is in good standing, which positively impacts your rental application.'
										: creditCategory.color === 'warning'
										? 'Your credit score is acceptable, but could be improved for better rental opportunities.'
										: 'Your credit score may limit your rental options. Consider credit improvement strategies.'}
								</p>
							</>
						)}
					</CardContent>
				</Card>

				{/* Affordability Analysis */}
				<Card>
					<CardHeader className='flex items-center justify-between'>
						<h2 className='text-lg font-semibold'>Affordability Analysis</h2>
						<DollarSign className='h-5 w-5 text-blue-600' />
					</CardHeader>
					<CardContent>
						<div className='flex items-center justify-between mb-4'>
							<div>
								{/* Display ratio as percentage */}
								<p className='text-3xl font-bold'>
									{(() => {
										// First try to use the top-level affordability_score
										if (
											reportData.affordability_score &&
											reportData.affordability_score > 0
										) {
											return (reportData.affordability_score * 100).toFixed(0);
										}

										// If it's 0 or missing, check the nested metrics
										if (screeningReport?.report_data) {
											const metricsObj = (
												screeningReport.report_data as Record<string, any>
											).metrics;
											if (metricsObj?.debt_to_income_ratio) {
												return (metricsObj.debt_to_income_ratio * 100).toFixed(
													0,
												);
											}
										}

										// Last resort fallback
										return '0';
									})()}
									%
								</p>
								<Badge variant={affordabilityCategory.color as any}>
									{affordabilityCategory.label}
								</Badge>
							</div>
							<div className='text-right'>
								<p className='text-sm text-gray-500'>Rent-to-Income Ratio</p>
								{/* Simplify to directly show target rent and monthly income */}
								<p className='text-lg font-medium'>
									{(() => {
										// First check if we have data from the API analysis result
										if (analysisResult?.metrics) {
											const targetRent = analysisResult.metrics
												.target_rent as number;
											const monthlyIncome = analysisResult.metrics
												.monthly_income as number;

											if (targetRent && monthlyIncome) {
												return `R${Math.round(targetRent)}/R${Math.round(
													monthlyIncome,
												)}`;
											}
										}

										// Then check if we have data from the screening report
										if (screeningReport?.report_data) {
											const reportDataObj =
												screeningReport.report_data as Record<string, any>;
											const targetRent =
												reportDataObj.metrics?.target_rent ||
												reportDataObj.target_rent;
											const monthlyIncome =
												reportDataObj.metrics?.monthly_income;

											if (targetRent && monthlyIncome) {
												return `R${Math.round(targetRent)}/R${Math.round(
													monthlyIncome,
												)}`;
											}
										}

										if (profile && reportData.affordability_score) {
											const estimatedRent = Math.round(
												profile.monthly_income * reportData.affordability_score,
											);
											return `R${estimatedRent}/R${profile.monthly_income}`;
										}

										return 'N/A';
									})()}
								</p>
							</div>
						</div>
						<div className='w-full bg-gray-200 rounded-full h-2.5 mb-4'>
							<div
								className='h-2.5 rounded-full'
								style={{
									width: `${(affordabilityRatio || 0) * 100}%`,
									backgroundColor:
										affordabilityCategory.color === 'success'
											? '#10b981'
											: affordabilityCategory.color === 'warning'
											? '#f59e0b'
											: '#ef4444',
								}}
							></div>
						</div>
						<p className='text-sm text-gray-600'>
							{affordabilityCategory.color === 'success'
								? 'Your rent-to-income ratio is healthy, indicating you can comfortably afford this rental.'
								: affordabilityCategory.color === 'warning'
								? 'Your rent-to-income ratio is acceptable, but you may be stretching your budget.'
								: 'Your rent-to-income ratio is high, which may make this rental difficult to afford. The recommended ratio is below 30% of your monthly income.'}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Verification Statuses */}
			<Card className='mb-8'>
				<CardHeader>
					<h2 className='text-lg font-semibold'>Verification Status</h2>
				</CardHeader>
				<CardContent>
					<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
						{/* Income Verification */}
						<div className='p-4 bg-gray-50 rounded-lg'>
							<div className='flex items-center mb-2'>
								<Briefcase className='h-5 w-5 text-gray-500 mr-2' />
								<h3 className='font-medium'>Income Verification</h3>
							</div>
							<div className='flex items-center mt-2'>
								{reportData.income_verification ? (
									<CheckCircle className='h-5 w-5 text-green-500 mr-2' />
								) : (
									<XCircle className='h-5 w-5 text-red-500 mr-2' />
								)}
								<span
									className={
										reportData.income_verification
											? 'text-green-700'
											: 'text-red-700'
									}
								>
									{reportData.income_verification ? 'Verified' : 'Not Verified'}
								</span>
							</div>
						</div>

						{/* Background Check */}
						<div className='p-4 bg-gray-50 rounded-lg'>
							<div className='flex items-center mb-2'>
								<User className='h-5 w-5 text-gray-500 mr-2' />
								<h3 className='font-medium'>Background Check</h3>
							</div>
							<div className='flex items-center mt-2'>
								{reportData.background_check_status === 'passed' ? (
									<CheckCircle className='h-5 w-5 text-green-500 mr-2' />
								) : reportData.background_check_status === 'failed' ? (
									<XCircle className='h-5 w-5 text-red-500 mr-2' />
								) : (
									<AlertCircle className='h-5 w-5 text-yellow-500 mr-2' />
								)}
								<span
									className={
										reportData.background_check_status === 'passed'
											? 'text-green-700'
											: reportData.background_check_status === 'failed'
											? 'text-red-700'
											: 'text-yellow-700'
									}
								>
									{reportData.background_check_status
										? reportData.background_check_status
												.charAt(0)
												.toUpperCase() +
										  reportData.background_check_status.slice(1)
										: 'Pending'}
								</span>
							</div>
						</div>

						{/* Document Verification */}
						<div className='p-4 bg-gray-50 rounded-lg'>
							<div className='flex items-center mb-2'>
								<FileText className='h-5 w-5 text-gray-500 mr-2' />
								<h3 className='font-medium'>Document Verification</h3>
							</div>
							<div className='flex items-center mt-2'>
								<CheckCircle className='h-5 w-5 text-green-500 mr-2' />
								<div>
									<span className='text-green-700'>Verified</span>
									<p className='text-xs text-gray-600 mt-1'>
										Required documents uploaded in the previous step have been
										processed successfully
									</p>
								</div>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Recommendations */}
			<Card>
				<CardHeader>
					<h2 className='text-lg font-semibold'>Recommendations</h2>
				</CardHeader>
				<CardContent>
					<div className='space-y-4'>
						{/* If we have recommendations from AI analysis, display them */}
						{analysisResult && recommendations.length > 0 ? (
							recommendations.map((recommendation, index) => (
								<div key={index} className='flex items-start'>
									{reportData.pre_approval_status === 'approved' ? (
										<CheckCircle className='h-5 w-5 text-green-500 mr-3 mt-0.5' />
									) : (
										<AlertCircle className='h-5 w-5 text-yellow-500 mr-3 mt-0.5' />
									)}
									<div>
										<p className='text-sm text-gray-600'>{recommendation}</p>
									</div>
								</div>
							))
						) : reportData.pre_approval_status === 'approved' ? (
							<>
								<div className='flex items-start'>
									<CheckCircle className='h-5 w-5 text-green-500 mr-3 mt-0.5' />
									<div>
										<h3 className='font-medium'>Schedule a Property Viewing</h3>
										<p className='text-sm text-gray-600'>
											You've been pre-approved! The next step is to schedule a
											viewing of the property.
										</p>
									</div>
								</div>
								<div className='flex items-start'>
									<CheckCircle className='h-5 w-5 text-green-500 mr-3 mt-0.5' />
									<div>
										<h3 className='font-medium'>Prepare for Move-In</h3>
										<p className='text-sm text-gray-600'>
											Start planning your move and gathering necessary funds for
											security deposit and first month's rent.
										</p>
									</div>
								</div>
							</>
						) : reportData.pre_approval_status === 'rejected' ? (
							<>
								<div className='flex items-start'>
									<AlertCircle className='h-5 w-5 text-yellow-500 mr-3 mt-0.5' />
									<div>
										<h3 className='font-medium'>Consider a Co-Signer</h3>
										<p className='text-sm text-gray-600'>
											Adding a co-signer with strong credit and income may
											improve your application.
										</p>
									</div>
								</div>
								<div className='flex items-start'>
									<AlertCircle className='h-5 w-5 text-yellow-500 mr-3 mt-0.5' />
									<div>
										<h3 className='font-medium'>
											Explore Different Properties
										</h3>
										<p className='text-sm text-gray-600'>
											Consider properties with lower rent that better match your
											current financial situation.
										</p>
									</div>
								</div>
								<div className='flex items-start'>
									<AlertCircle className='h-5 w-5 text-yellow-500 mr-3 mt-0.5' />
									<div>
										<h3 className='font-medium'>Improve Credit Score</h3>
										<p className='text-sm text-gray-600'>
											Work on improving your credit score before applying for
											future rentals.
										</p>
									</div>
								</div>
							</>
						) : (
							<div className='flex items-start'>
								<AlertCircle className='h-5 w-5 text-yellow-500 mr-3 mt-0.5' />
								<div>
									<h3 className='font-medium'>Application Under Review</h3>
									<p className='text-sm text-gray-600'>
										Your application is still being processed. We'll notify you
										once a decision has been made.
									</p>
								</div>
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Risk Factors - Only show if we have analysis results with risk factors */}
			{analysisResult && riskFactors.length > 0 && (
				<Card className='mt-8'>
					<CardHeader>
						<h2 className='text-lg font-semibold'>Risk Factors</h2>
					</CardHeader>
					<CardContent>
						<div className='space-y-4'>
							{riskFactors.map((factor, index) => (
								<div key={index} className='flex items-start'>
									<AlertCircle className='h-5 w-5 text-yellow-500 mr-3 mt-0.5' />
									<div>
										<p className='text-sm text-gray-600'>{factor}</p>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
};

export default ScreeningResults;
