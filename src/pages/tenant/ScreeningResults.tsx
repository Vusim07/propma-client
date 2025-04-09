/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { usePageTitle } from '../../context/PageTitleContext';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
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
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';

const ScreeningResults: React.FC = () => {
	const { user } = useAuthStore();
	const { setPageTitle } = usePageTitle();
	const {
		screeningReport,
		profile,
		fetchScreeningReport,
		fetchProfile,
		isLoading,
	} = useTenantStore();
	const navigate = useNavigate();

	useEffect(() => {
		setPageTitle('Screening');
		if (user) {
			fetchScreeningReport(user.id);
			fetchProfile(user.id);
		}
	}, [user, fetchScreeningReport, fetchProfile, setPageTitle]);

	if (isLoading) {
		return (
			<div className='flex justify-center items-center h-64'>
				<Spinner size='lg' />
			</div>
		);
	}

	if (!screeningReport) {
		return (
			<div className='mb-6'>
				<h1 className='text-2xl font-bold text-gray-900 mb-6'>
					Screening Results
				</h1>
				<Alert variant='info'>
					Your screening report is not available yet. Please check back later or
					contact support for assistance.
				</Alert>
			</div>
		);
	}

	const getCreditScoreCategory = (score: number) => {
		if (score >= 750) return { label: 'Excellent', color: 'success' };
		if (score >= 700) return { label: 'Good', color: 'success' };
		if (score >= 650) return { label: 'Fair', color: 'warning' };
		if (score >= 600) return { label: 'Poor', color: 'warning' };
		return { label: 'Very Poor', color: 'danger' };
	};

	const getAffordabilityCategory = (ratio: number) => {
		if (ratio <= 0.28) return { label: 'Excellent', color: 'success' };
		if (ratio <= 0.36) return { label: 'Good', color: 'success' };
		if (ratio <= 0.43) return { label: 'Fair', color: 'warning' };
		return { label: 'Poor', color: 'danger' };
	};

	const creditCategory = getCreditScoreCategory(
		screeningReport.credit_score || 0,
	);
	const affordabilityCategory = getAffordabilityCategory(
		screeningReport.affordability_score || 0,
	);

	return (
		<div>
			<div className='mb-6'>
				<h1 className='text-2xl font-bold text-gray-900'>Screening Results</h1>
				<p className='text-gray-600 mt-1'>
					Review your rental application screening report
				</p>
			</div>

			{/* Pre-approval Status */}
			<div className='mb-8'>
				<div
					className={`p-6 rounded-lg border ${
						screeningReport.pre_approval_status === 'approved'
							? 'bg-green-50 border-green-200'
							: screeningReport.pre_approval_status === 'rejected'
							? 'bg-red-50 border-red-200'
							: 'bg-yellow-50 border-yellow-200'
					}`}
				>
					<div className='flex items-center'>
						{screeningReport.pre_approval_status === 'approved' ? (
							<CheckCircle className='h-8 w-8 text-green-500 mr-4' />
						) : screeningReport.pre_approval_status === 'rejected' ? (
							<XCircle className='h-8 w-8 text-red-500 mr-4' />
						) : (
							<AlertCircle className='h-8 w-8 text-yellow-500 mr-4' />
						)}
						<div>
							<h2 className='text-lg font-semibold'>
								{screeningReport.pre_approval_status === 'approved'
									? 'Pre-Approved'
									: screeningReport.pre_approval_status === 'rejected'
									? 'Not Approved'
									: 'Pending Review'}
							</h2>
							<p
								className={`${
									screeningReport.pre_approval_status === 'approved'
										? 'text-green-700'
										: screeningReport.pre_approval_status === 'rejected'
										? 'text-red-700'
										: 'text-yellow-700'
								}`}
							>
								{screeningReport.pre_approval_status === 'approved'
									? 'Congratulations! Your application has been pre-approved.'
									: screeningReport.pre_approval_status === 'rejected'
									? 'Unfortunately, your application did not meet our current criteria.'
									: 'Your application is currently under review.'}
							</p>
						</div>
					</div>

					{/* Add Schedule Viewing button for approved applications */}
					{screeningReport.pre_approval_status === 'approved' && (
						<div className='mt-6 flex justify-end'>
							<Button
								variant='primary'
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
						<div className='flex items-center justify-between mb-4'>
							<div>
								<p className='text-3xl font-bold'>
									{screeningReport.credit_score}
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
									{Math.round(
										((screeningReport.credit_score || 0) / 850) * 100,
									)}
									%
								</span>
							</div>
						</div>
						<div className='w-full bg-gray-200 rounded-full h-2.5 mb-4'>
							<div
								className='h-2.5 rounded-full'
								style={{
									width: `${
										((screeningReport.credit_score || 0) / 850) * 100
									}%`,
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
								<p className='text-3xl font-bold'>
									{(screeningReport.affordability_score || 0 * 100).toFixed(0)}%
								</p>
								<Badge variant={affordabilityCategory.color as any}>
									{affordabilityCategory.label}
								</Badge>
							</div>
							<div className='text-right'>
								<p className='text-sm text-gray-500'>Rent-to-Income Ratio</p>
								<p className='text-lg font-medium'>
									{profile
										? `R${(
												profile.monthly_income *
												(screeningReport.affordability_score || 0)
										  ).toFixed(0)}/R${profile.monthly_income}`
										: 'N/A'}
								</p>
							</div>
						</div>
						<div className='w-full bg-gray-200 rounded-full h-2.5 mb-4'>
							<div
								className='h-2.5 rounded-full'
								style={{
									width: `${(screeningReport.affordability_score || 0) * 100}%`,
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
								: 'Your rent-to-income ratio is high, which may make this rental difficult to afford.'}
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
								{screeningReport.income_verification ? (
									<CheckCircle className='h-5 w-5 text-green-500 mr-2' />
								) : (
									<XCircle className='h-5 w-5 text-red-500 mr-2' />
								)}
								<span
									className={
										screeningReport.income_verification
											? 'text-green-700'
											: 'text-red-700'
									}
								>
									{screeningReport.income_verification
										? 'Verified'
										: 'Not Verified'}
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
								{screeningReport.background_check_status === 'passed' ? (
									<CheckCircle className='h-5 w-5 text-green-500 mr-2' />
								) : screeningReport.background_check_status === 'failed' ? (
									<XCircle className='h-5 w-5 text-red-500 mr-2' />
								) : (
									<AlertCircle className='h-5 w-5 text-yellow-500 mr-2' />
								)}
								<span
									className={
										screeningReport.background_check_status === 'passed'
											? 'text-green-700'
											: screeningReport.background_check_status === 'failed'
											? 'text-red-700'
											: 'text-yellow-700'
									}
								>
									{screeningReport.background_check_status
										? screeningReport.background_check_status
												.charAt(0)
												.toUpperCase() +
										  screeningReport.background_check_status.slice(1)
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
						{screeningReport.pre_approval_status === 'approved' ? (
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
						) : screeningReport.pre_approval_status === 'rejected' ? (
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
		</div>
	);
};

export default ScreeningResults;
