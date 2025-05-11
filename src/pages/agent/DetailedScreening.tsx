/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Badge from '@/components/ui/Badge';
import Alert from '@/components/ui/Alert';
import { supabase } from '../../services/supabase';
import { Tables } from '../../services/database.types';
import { formatCurrency } from '../../utils/formatters';
import {
	FileText,
	User,
	CreditCard,
	DollarSign,
	CheckCircle,
	XCircle,
	AlertCircle,
	ArrowLeft,
	Home,
	Eye,
} from 'lucide-react';
import DocumentViewerSheet from '@/components/agent/DocumentViewerSheet';

type ScreeningReportWithDetails = Tables<'screening_reports'> & {
	tenant_profiles: Tables<'tenant_profiles'> | null;
	documents: Tables<'documents'>[] | null;
	credit_reports: Tables<'credit_reports'>[] | null;
	// Add nested property details
	applications: {
		properties: {
			monthly_rent: number | null;
		} | null;
	} | null;
	credit_report?: {
		score: number;
		payment_history: string;
		derogatory_marks: number;
		accounts: number;
		hard_inquiries: number;
		credit_age: string;
		credit_utilization: string;
	};
	background_check?: {
		criminal_record: boolean;
		eviction_history: boolean;
		verification_date: string;
	};
	rental_history?: {
		address: string;
		start_date: string;
		end_date: string;
		landlord_name: string;
		landlord_contact: string;
		rent_amount: number;
		payment_history: string;
		reason_for_leaving: string;
	}[];
};

const DetailedScreening: React.FC = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { user } = useAuthStore();
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	const [screeningData, setScreeningData] =
		useState<ScreeningReportWithDetails | null>(null);
	const [monthlyRent, setMonthlyRent] = useState<number | null>(null); // State for monthly rent

	useEffect(() => {
		const fetchScreeningData = async () => {
			if (!id || !user) {
				setError('Missing application ID or user information.');
				setIsLoading(false);
				return;
			}

			setIsLoading(true);
			setError('');

			try {
				const { data, error: fetchError } = await supabase
					.from('screening_reports')
					.select(
						`
						*,
						tenant_profiles:applications!inner(tenant_profiles(*)),
						applications:applications!inner(property_id, properties!inner(monthly_rent)),
						documents:applications!inner(documents(*)),
						credit_reports(*)
					`,
					)
					.eq('application_id', id)
					.eq('agent_id', user.id)
					.single();

				if (fetchError) {
					if (fetchError.code === 'PGRST116') {
						setError(`Screening report not found for application ID: ${id}`);
					} else {
						throw fetchError;
					}
					setScreeningData(null);
					setMonthlyRent(null); // Reset rent on error
				} else if (data) {
					// Extract monthly rent - adjust path based on the new query structure
					const fetchedRent =
						(data as any).applications?.properties?.monthly_rent ?? null;
					setMonthlyRent(fetchedRent);

					// Access credit_score directly from data, assuming the main query succeeds
					const creditScoreFromData = (data as any).credit_score;

					const combinedData: ScreeningReportWithDetails = {
						...(data as any),
						credit_report: {
							score: creditScoreFromData ?? 720, // Use score from data
							payment_history: 'Good',
							derogatory_marks: 0,
							accounts: 5,
							hard_inquiries: 2,
							credit_age: '5 years',
							credit_utilization: '15%',
						},
						background_check: {
							criminal_record: false,
							eviction_history: false,
							verification_date: new Date().toISOString(),
						},
						rental_history: [
							{
								address: '456 Elm St, Anytown, South Africa',
								start_date: '2020-01-01',
								end_date: '2022-12-31',
								landlord_name: 'Jane Smith',
								landlord_contact: '555-987-6543',
								rent_amount: 1800,
								payment_history: 'On-time payments',
								reason_for_leaving: 'Relocated for work',
							},
						],
						tenant_profiles:
							(data as any).tenant_profiles?.tenant_profiles ?? null,
						applications: (data as any).applications, // Assign potentially updated applications structure
						documents: (data as any).documents?.documents ?? [],
					};
					setScreeningData(combinedData);
				} else {
					setError(`Screening report not found for application ID: ${id}`);
					setScreeningData(null);
					setMonthlyRent(null); // Reset rent if not found
				}
			} catch (error: any) {
				console.error('Error fetching screening data:', error); // Log the full error object
				let errorMessage = 'Failed to load screening data.';
				if (error && error.message) {
					errorMessage += ` Message: ${error.message}`;
				}
				if (error && error.details) {
					errorMessage += ` Details: ${error.details}`;
				}
				if (error && error.hint) {
					errorMessage += ` Hint: ${error.hint}`;
				}
				if (error && error.code) {
					errorMessage += ` Code: ${error.code}`;
				}
				setError(errorMessage);
				setScreeningData(null);
				setMonthlyRent(null); // Reset rent on general error
			} finally {
				setIsLoading(false);
			}
		};

		console.log(
			`Fetching screening data for application ID: ${id} and agent ID: ${user?.id}`,
		); // Log IDs
		fetchScreeningData();
	}, [id, user]);

	// Helper function to determine credit score category and color
	const getCreditScoreCategory = (score: number | null) => {
		// First line handles null/undefined, subsequent checks are safe
		if (score === null || score === undefined)
			return { label: 'N/A', color: 'secondary' };
		if (score >= 750) return { label: 'Excellent', color: 'success' };
		if (score >= 700) return { label: 'Good', color: 'success' };
		if (score >= 650) return { label: 'Fair', color: 'warning' };
		if (score >= 600) return { label: 'Poor', color: 'warning' };
		return { label: 'Very Poor', color: 'danger' };
	};

	// Helper function to determine affordability category and color
	const getAffordabilityCategory = (score: number | null) => {
		// First line handles null/undefined, subsequent checks are safe
		// Assuming score is a ratio (e.g., 0.28). Adjust logic if it's a different metric.
		if (score === null || score === undefined)
			return { label: 'N/A', color: 'secondary' };
		if (score <= 0.28) return { label: 'Excellent', color: 'success' };
		if (score <= 0.36) return { label: 'Good', color: 'success' };
		if (score <= 0.43) return { label: 'Fair', color: 'warning' };
		return { label: 'Poor', color: 'danger' };
	};

	if (isLoading) {
		return (
			<div className='flex justify-center items-center h-64'>
				<Spinner size='lg' />
			</div>
		);
	}

	if (error) {
		return (
			<div className='mb-6'>
				<Button
					variant='outline'
					size='sm'
					onClick={() => navigate('/agent/applications')}
					className='mb-4'
				>
					<ArrowLeft size={16} className='mr-2' />
					Back to Applications
				</Button>
				<Alert variant='error'>{error}</Alert>
			</div>
		);
	}

	if (!screeningData) {
		return (
			<div className='mb-6'>
				<Button
					variant='outline'
					size='sm'
					onClick={() => navigate('/agent/applications')}
					className='mb-4'
				>
					<ArrowLeft size={16} className='mr-2' />
					Back to Applications
				</Button>
				<Alert variant='info'>
					Screening report not found or still processing.
				</Alert>
			</div>
		);
	}

	const tenantProfile = screeningData.tenant_profiles;
	const documents = screeningData.documents ?? [];
	const creditScore = screeningData.credit_score;
	const affordabilityScore = screeningData.affordability_score;
	const creditCategory = getCreditScoreCategory(creditScore);
	const affordabilityCategory = getAffordabilityCategory(affordabilityScore);

	const creditReportDetails = screeningData.credit_report;
	const backgroundCheckDetails = screeningData.background_check;
	const rentalHistoryDetails = screeningData.rental_history;

	return (
		<div>
			<div className='mb-6'>
				<Button
					variant='outline'
					size='sm'
					onClick={() => navigate('/agent/applications')}
					className='mb-4'
				>
					<ArrowLeft size={16} className='mr-2' />
					Back to Applications
				</Button>

				<div className='flex items-center justify-between'>
					<div>
						<h1 className='text-2xl font-bold text-gray-900'>
							Detailed Screening Report
						</h1>
						<p className='text-gray-600 mt-1'>
							{tenantProfile
								? `${tenantProfile.first_name} ${tenantProfile.last_name}`
								: 'Tenant Name Unavailable'}
						</p>
					</div>
					<Badge
						variant={
							screeningData.pre_approval_status === 'approved'
								? 'success'
								: screeningData.pre_approval_status === 'rejected'
								? 'danger'
								: 'warning'
						}
						className='text-sm px-3 py-1'
					>
						{screeningData.pre_approval_status?.toUpperCase() ?? 'UNKNOWN'}
					</Badge>
				</div>
			</div>

			<Card className='mb-6'>
				<CardHeader>
					<h2 className='text-lg font-semibold flex items-center'>
						<User className='h-5 w-5 text-blue-600 mr-2' />
						Tenant Information
					</h2>
				</CardHeader>
				<CardContent>
					{tenantProfile ? (
						<div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
							<div>
								<p className='text-sm text-gray-500'>Full Name</p>
								<p className='font-medium'>
									{tenantProfile.first_name} {tenantProfile.last_name}
								</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Phone</p>
								<p className='font-medium'>
									{tenantProfile.phone ?? 'Not Provided'}
								</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Current Address</p>
								<p className='font-medium'>
									{tenantProfile.current_address ?? 'Not Provided'}
								</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Employment Status</p>
								<p className='font-medium'>
									{tenantProfile.employment_status ?? 'Not Provided'}
								</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Monthly Income</p>
								<p className='font-medium'>
									{tenantProfile.monthly_income != null
										? formatCurrency(tenantProfile.monthly_income)
										: 'Not Provided'}
								</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Application Date</p>
								<p className='font-medium'>
									{new Date(screeningData.created_at).toLocaleDateString()}
								</p>
							</div>
						</div>
					) : (
						<Alert variant='info'>
							Tenant profile information not available.
						</Alert>
					)}
				</CardContent>
			</Card>

			<div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6'>
				<Card>
					<CardHeader>
						<h2 className='text-lg font-semibold flex items-center'>
							<CreditCard className='h-5 w-5 text-blue-600 mr-2' />
							Experian Credit Report
						</h2>
					</CardHeader>
					<CardContent>
						<div className='flex items-center justify-between mb-4'>
							<div>
								<p className='text-3xl font-bold'>{creditScore ?? 'N/A'}</p>
								<Badge variant={creditCategory.color as any}>
									{creditCategory.label}
								</Badge>
							</div>
							{creditScore !== null && creditReportDetails && (
								<div
									className='w-16 h-16 rounded-full border-4 flex items-center justify-center'
									style={{
										borderColor:
											creditCategory.color === 'success'
												? '#10b981'
												: creditCategory.color === 'warning'
												? '#f59e0b'
												: creditCategory.color === 'danger'
												? '#ef4444'
												: '#6b7280',
									}}
								>
									<span className='text-lg font-bold'>
										{Math.round((creditScore / 850) * 100)}%
									</span>
								</div>
							)}
						</div>

						{creditScore !== null && creditReportDetails && (
							<div className='w-full bg-gray-200 rounded-full h-2.5 mb-4'>
								<div
									className='h-2.5 rounded-full'
									style={{
										width: `${(creditScore / 850) * 100}%`,
										backgroundColor:
											creditCategory.color === 'success'
												? '#10b981'
												: creditCategory.color === 'warning'
												? '#f59e0b'
												: creditCategory.color === 'danger'
												? '#ef4444'
												: '#6b7280',
									}}
								></div>
							</div>
						)}

						{creditReportDetails ? (
							<div className='grid grid-cols-2 gap-4 mt-6'>
								<div>
									<p className='text-sm text-gray-500'>Payment History</p>
									<p className='font-medium'>
										{creditReportDetails.payment_history}
									</p>
								</div>
								<div>
									<p className='text-sm text-gray-500'>Derogatory Marks</p>
									<p className='font-medium'>
										{creditReportDetails.derogatory_marks}
									</p>
								</div>
								<div>
									<p className='text-sm text-gray-500'>Accounts</p>
									<p className='font-medium'>{creditReportDetails.accounts}</p>
								</div>
								<div>
									<p className='text-sm text-gray-500'>Hard Inquiries</p>
									<p className='font-medium'>
										{creditReportDetails.hard_inquiries}
									</p>
								</div>
								<div>
									<p className='text-sm text-gray-500'>Credit Age</p>
									<p className='font-medium'>
										{creditReportDetails.credit_age}
									</p>
								</div>
								<div>
									<p className='text-sm text-gray-500'>Credit Utilization</p>
									<p className='font-medium'>
										{creditReportDetails.credit_utilization}
									</p>
								</div>
								<div>
									<p className='text-sm text-gray-500'>
										Detailed Credit Report
									</p>
									<DocumentViewerSheet
										document={{
											id: screeningData.credit_reports?.[0]?.id ?? '',
											file_name: 'Credit Report.pdf',
											document_type: 'credit_report',
											file_path:
												screeningData.credit_reports?.[0]?.pdf_path ?? '',
										}}
										trigger={
											<Button variant='outline' size='sm'>
												<Eye size={16} className='mr-1.5' />
												View Credit Report
											</Button>
										}
									/>
								</div>
							</div>
						) : (
							<Alert variant='info'>
								Detailed credit report information not available.
							</Alert>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<h2 className='text-lg font-semibold flex items-center'>
							<DollarSign className='h-5 w-5 text-blue-600 mr-2' />
							Affordability Analysis
						</h2>
					</CardHeader>
					<CardContent>
						<div className='flex items-center justify-between mb-4'>
							<div>
								<p className='text-3xl font-bold'>
									{affordabilityScore !== null
										? `${(affordabilityScore * 100).toFixed(0)}%`
										: 'N/A'}
								</p>
								<Badge variant={affordabilityCategory.color as any}>
									{affordabilityCategory.label}
								</Badge>
							</div>
							{/* Use monthlyRent state and tenantProfile income */}
							{tenantProfile?.monthly_income != null && monthlyRent != null && (
								<div className='text-right'>
									<p className='text-sm text-gray-500'>
										Target Rent / Monthly Income
									</p>
									<p className='text-lg font-medium'>
										{formatCurrency(monthlyRent)}
										{' / '}
										{formatCurrency(tenantProfile.monthly_income)}
									</p>
								</div>
							)}
						</div>

						{/* Update progress bar logic if needed based on monthlyRent */}
						{tenantProfile?.monthly_income != null &&
							monthlyRent != null &&
							tenantProfile.monthly_income > 0 && (
								<div className='w-full bg-gray-200 rounded-full h-2.5 mb-4'>
									<div
										className='h-2.5 rounded-full'
										style={{
											width: `${Math.min(
												(monthlyRent / tenantProfile.monthly_income) * 100,
												100,
											)}%`,
											backgroundColor:
												affordabilityCategory.color === 'success'
													? '#10b981'
													: affordabilityCategory.color === 'warning'
													? '#f59e0b'
													: affordabilityCategory.color === 'danger'
													? '#ef4444'
													: '#6b7280',
										}}
									></div>
								</div>
							)}

						<div className='bg-gray-50 p-4 rounded-lg mt-6'>
							<h3 className='font-medium mb-2'>Financial Assessment</h3>
							{screeningData.affordability_notes ? (
								<p>{screeningData.affordability_notes}</p>
							) : (
								<ul className='space-y-2'>
									<li className='flex items-start'>
										{screeningData.income_verification ? (
											<CheckCircle className='h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0' />
										) : (
											<AlertCircle className='h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0' />
										)}
										<span>
											Income Verification:{' '}
											{screeningData.income_verification
												? 'Passed'
												: 'Pending/Failed'}
										</span>
									</li>
									<li className='flex items-start'>
										<CheckCircle className='h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0' />
										<span>
											Bank statements show consistent income deposits (Mock)
										</span>
									</li>
								</ul>
							)}
						</div>
					</CardContent>
				</Card>
			</div>

			<div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6'>
				<Card>
					<CardHeader>
						<h2 className='text-lg font-semibold flex items-center'>
							<User className='h-5 w-5 text-blue-600 mr-2' />
							Background Check
						</h2>
					</CardHeader>
					<CardContent>
						<div className='flex items-center mb-4'>
							{screeningData.background_check_status === 'passed' ? (
								<div className='bg-green-100 text-green-800 p-3 rounded-full mr-4'>
									<CheckCircle className='h-6 w-6' />
								</div>
							) : screeningData.background_check_status === 'failed' ? (
								<div className='bg-red-100 text-red-800 p-3 rounded-full mr-4'>
									<XCircle className='h-6 w-6' />
								</div>
							) : (
								<div className='bg-yellow-100 text-yellow-800 p-3 rounded-full mr-4'>
									<AlertCircle className='h-6 w-6' />
								</div>
							)}
							<div>
								<p className='font-medium text-lg'>
									{screeningData.background_check_status === 'passed'
										? 'Passed'
										: screeningData.background_check_status === 'failed'
										? 'Failed'
										: 'Pending/Unavailable'}
								</p>
								{backgroundCheckDetails && (
									<p className='text-sm text-gray-500'>
										Verified on{' '}
										{new Date(
											backgroundCheckDetails.verification_date,
										).toLocaleDateString()}
									</p>
								)}
							</div>
						</div>

						{backgroundCheckDetails ? (
							<div className='grid grid-cols-1 gap-4 mt-6'>
								<div className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
									<div className='flex items-center'>
										<span className='font-medium'>Criminal Record</span>
									</div>
									{backgroundCheckDetails.criminal_record ? (
										<Badge variant='danger'>Found</Badge>
									) : (
										<Badge variant='success'>None</Badge>
									)}
								</div>

								<div className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
									<div className='flex items-center'>
										<span className='font-medium'>Eviction History</span>
									</div>
									{backgroundCheckDetails.eviction_history ? (
										<Badge variant='danger'>Found</Badge>
									) : (
										<Badge variant='success'>None</Badge>
									)}
								</div>

								<div className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
									<div className='flex items-center'>
										<span className='font-medium'>Identity Verification</span>
									</div>
									<Badge
										variant={
											screeningData.id_verification_status === 'verified'
												? 'success'
												: screeningData.id_verification_status === 'failed'
												? 'danger'
												: 'warning'
										}
									>
										{screeningData.id_verification_status?.toUpperCase() ??
											'PENDING'}
									</Badge>
								</div>
							</div>
						) : (
							<Alert variant='info'>
								Detailed background check information not available.
							</Alert>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<h2 className='text-lg font-semibold flex items-center'>
							<Home className='h-5 w-5 text-blue-600 mr-2' />
							Rental History
						</h2>
					</CardHeader>
					<CardContent>
						{rentalHistoryDetails && rentalHistoryDetails.length > 0 ? (
							<div className='space-y-4'>
								{rentalHistoryDetails.map((rental: any, index: number) => (
									<div
										key={index}
										className='border border-gray-200 rounded-lg p-4'
									>
										<div className='flex items-center justify-between mb-2'>
											<h3 className='font-medium'>{rental.address}</h3>
											<Badge variant='info'>Previous</Badge>
										</div>

										<div className='grid grid-cols-2 gap-2 mb-3'>
											<div>
												<p className='text-sm text-gray-500'>Period</p>
												<p className='text-sm'>
													{new Date(rental.start_date).toLocaleDateString()} -{' '}
													{new Date(rental.end_date).toLocaleDateString()}
												</p>
											</div>
											<div>
												<p className='text-sm text-gray-500'>Monthly Rent</p>
												<p className='text-sm'>
													{formatCurrency(rental.rent_amount)}
												</p>
											</div>
										</div>

										<div className='mb-3'>
											<p className='text-sm text-gray-500'>Landlord</p>
											<p className='text-sm'>
												{rental.landlord_name} • {rental.landlord_contact}
											</p>
										</div>

										<div className='grid grid-cols-2 gap-2'>
											<div>
												<p className='text-sm text-gray-500'>Payment History</p>
												<p className='text-sm'>{rental.payment_history}</p>
											</div>
											<div>
												<p className='text-sm text-gray-500'>
													Reason for Leaving
												</p>
												<p className='text-sm'>{rental.reason_for_leaving}</p>
											</div>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className='text-center py-6 text-gray-500'>
								No rental history available (Mock Data)
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<h2 className='text-lg font-semibold flex items-center'>
						<FileText className='h-5 w-5 text-blue-600 mr-2' />
						Document Analysis
					</h2>
				</CardHeader>
				<CardContent>
					{documents && documents.length > 0 ? (
						<div className='space-y-4'>
							{documents.map((doc: Tables<'documents'>) => (
								<div
									key={doc.id}
									className='border border-gray-200 rounded-lg overflow-hidden'
								>
									<div className='bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2'>
										<div className='flex items-center flex-grow'>
											<FileText className='h-5 w-5 text-blue-500 mr-3 flex-shrink-0' />
											<div className='flex-grow'>
												<p className='font-medium text-sm'>
													{doc.file_name ?? 'Unknown File'}
												</p>
												<p className='text-xs text-gray-500'>
													{new Date(doc.created_at).toLocaleDateString()} •{' '}
													{doc.file_size
														? `${(doc.file_size / 1024).toFixed(1)} KB`
														: ''}{' '}
													•{' '}
													<span className='capitalize'>
														{doc.document_type?.replace('_', ' ') ??
															'Unknown Type'}
													</span>
												</p>
											</div>
										</div>
										<DocumentViewerSheet
											document={doc}
											trigger={
												<Button variant='outline' size='sm'>
													<Eye size={16} className='mr-1.5' />
													View Document
												</Button>
											}
										/>
									</div>
								</div>
							))}
						</div>
					) : (
						<Alert variant='info'>
							No documents found for this application.
						</Alert>
					)}
				</CardContent>
			</Card>
		</div>
	);
};

export default DetailedScreening;
