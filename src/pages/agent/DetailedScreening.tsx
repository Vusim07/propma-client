/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
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
} from 'lucide-react';

const DetailedScreening: React.FC = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { user } = useAuthStore();
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');

	// Mock screening data for MVP
	const [screeningData, setScreeningData] = useState<any>(null);

	useEffect(() => {
		const fetchScreeningData = async () => {
			setIsLoading(true);
			setError('');

			try {
				// In a real app, we would fetch from Supabase
				// const { data, error } = await supabase
				//   .from('screening_reports')
				//   .select('*, tenant_profiles(*), documents(*)')
				//   .eq('id', id)
				//   .single();
				// if (error) throw error;

				// For MVP, we'll use mock data
				await new Promise((resolve) => setTimeout(resolve, 800));

				// Mock data
				const mockData = {
					id: id,
					tenant_id: '1',
					credit_score: 720,
					income_verification: true,
					background_check_status: 'passed',
					affordability_ratio: 0.28,
					pre_approval_status: 'approved',
					notes: 'Tenant has good credit and income verification passed.',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					tenant_profile: {
						id: '1',
						user_id: '1',
						first_name: 'John',
						last_name: 'Doe',
						phone: '555-123-4567',
						current_address: '123 Main St, Anytown, USA',
						employment_status: 'Employed',
						monthly_income: 5000,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					},
					documents: [
						{
							id: '1',
							user_id: '1',
							file_name: 'drivers_license.jpg',
							file_type: 'image/jpeg',
							file_size: 1024000,
							file_path: '/storage/documents/drivers_license.jpg',
							document_type: 'id',
							ocr_text:
								'DRIVER LICENSE\nJOHN DOE\nDOB: 01/01/1985\n123 MAIN ST\nANYTOWN, USA',
							created_at: new Date().toISOString(),
						},
						{
							id: '2',
							user_id: '1',
							file_name: 'pay_stub.pdf',
							file_type: 'application/pdf',
							file_size: 512000,
							file_path: '/storage/documents/pay_stub.pdf',
							document_type: 'payslip',
							ocr_text:
								'ACME CORP\nPAY PERIOD: 01/01/2023 - 01/15/2023\nEMPLOYEE: JOHN DOE\nGROSS PAY: $2,500.00\nNET PAY: $1,875.00',
							created_at: new Date().toISOString(),
						},
						{
							id: '3',
							user_id: '1',
							file_name: 'bank_statement.pdf',
							file_type: 'application/pdf',
							file_size: 768000,
							file_path: '/storage/documents/bank_statement.pdf',
							document_type: 'bank_statement',
							ocr_text:
								'BANK OF AMERICA\nACCOUNT STATEMENT\nJOHN DOE\nACCOUNT: XXXX-XXXX-1234\nBALANCE: $12,450.75',
							created_at: new Date().toISOString(),
						},
					],
					credit_report: {
						score: 720,
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
							address: '456 Elm St, Anytown, USA',
							start_date: '2020-01-01',
							end_date: '2022-12-31',
							landlord_name: 'Jane Smith',
							landlord_contact: '555-987-6543',
							rent_amount: 1800,
							payment_history: 'On-time payments',
							reason_for_leaving: 'Relocated for work',
						},
					],
				};

				setScreeningData(mockData);
				setIsLoading(false);
			} catch (error) {
				console.error('Error fetching screening data:', error);
				setError('Failed to load screening data. Please try again.');
				setIsLoading(false);
			}
		};

		if (id) {
			fetchScreeningData();
		}
	}, [id]);

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
				<Alert variant='error'>Screening report not found.</Alert>
			</div>
		);
	}

	const creditCategory = getCreditScoreCategory(screeningData.credit_score);
	const affordabilityCategory = getAffordabilityCategory(
		screeningData.affordability_ratio,
	);

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
							{screeningData.tenant_profile.first_name}{' '}
							{screeningData.tenant_profile.last_name}
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
						{screeningData.pre_approval_status.toUpperCase()}
					</Badge>
				</div>
			</div>

			{/* Tenant Information */}
			<Card className='mb-6'>
				<CardHeader>
					<h2 className='text-lg font-semibold flex items-center'>
						<User className='h-5 w-5 text-blue-600 mr-2' />
						Tenant Information
					</h2>
				</CardHeader>
				<CardContent>
					<div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
						<div>
							<p className='text-sm text-gray-500'>Full Name</p>
							<p className='font-medium'>
								{screeningData.tenant_profile.first_name}{' '}
								{screeningData.tenant_profile.last_name}
							</p>
						</div>
						<div>
							<p className='text-sm text-gray-500'>Phone</p>
							<p className='font-medium'>
								{screeningData.tenant_profile.phone}
							</p>
						</div>
						<div>
							<p className='text-sm text-gray-500'>Current Address</p>
							<p className='font-medium'>
								{screeningData.tenant_profile.current_address}
							</p>
						</div>
						<div>
							<p className='text-sm text-gray-500'>Employment Status</p>
							<p className='font-medium'>
								{screeningData.tenant_profile.employment_status}
							</p>
						</div>
						<div>
							<p className='text-sm text-gray-500'>Monthly Income</p>
							<p className='font-medium'>
								R{screeningData.tenant_profile.monthly_income.toLocaleString()}
							</p>
						</div>
						<div>
							<p className='text-sm text-gray-500'>Application Date</p>
							<p className='font-medium'>
								{new Date(screeningData.created_at).toLocaleDateString()}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Credit & Financial */}
			<div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6'>
				{/* Credit Score */}
				<Card>
					<CardHeader>
						<h2 className='text-lg font-semibold flex items-center'>
							<CreditCard className='h-5 w-5 text-blue-600 mr-2' />
							Credit Report
						</h2>
					</CardHeader>
					<CardContent>
						<div className='flex items-center justify-between mb-4'>
							<div>
								<p className='text-3xl font-bold'>
									{screeningData.credit_score}
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
									{Math.round((screeningData.credit_score / 850) * 100)}%
								</span>
							</div>
						</div>

						<div className='w-full bg-gray-200 rounded-full h-2.5 mb-4'>
							<div
								className='h-2.5 rounded-full'
								style={{
									width: `${(screeningData.credit_score / 850) * 100}%`,
									backgroundColor:
										creditCategory.color === 'success'
											? '#10b981'
											: creditCategory.color === 'warning'
											? '#f59e0b'
											: '#ef4444',
								}}
							></div>
						</div>

						<div className='grid grid-cols-2 gap-4 mt-6'>
							<div>
								<p className='text-sm text-gray-500'>Payment History</p>
								<p className='font-medium'>
									{screeningData.credit_report.payment_history}
								</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Derogatory Marks</p>
								<p className='font-medium'>
									{screeningData.credit_report.derogatory_marks}
								</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Accounts</p>
								<p className='font-medium'>
									{screeningData.credit_report.accounts}
								</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Hard Inquiries</p>
								<p className='font-medium'>
									{screeningData.credit_report.hard_inquiries}
								</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Credit Age</p>
								<p className='font-medium'>
									{screeningData.credit_report.credit_age}
								</p>
							</div>
							<div>
								<p className='text-sm text-gray-500'>Credit Utilization</p>
								<p className='font-medium'>
									{screeningData.credit_report.credit_utilization}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Affordability Analysis */}
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
									{(screeningData.affordability_ratio * 100).toFixed(0)}%
								</p>
								<Badge variant={affordabilityCategory.color as any}>
									{affordabilityCategory.label}
								</Badge>
							</div>
							<div className='text-right'>
								<p className='text-sm text-gray-500'>Rent-to-Income Ratio</p>
								<p className='text-lg font-medium'>
									R
									{(
										screeningData.tenant_profile.monthly_income *
										screeningData.affordability_ratio
									).toFixed(0)}
									/R{screeningData.tenant_profile.monthly_income}
								</p>
							</div>
						</div>

						<div className='w-full bg-gray-200 rounded-full h-2.5 mb-4'>
							<div
								className='h-2.5 rounded-full'
								style={{
									width: `${screeningData.affordability_ratio * 100}%`,
									backgroundColor:
										affordabilityCategory.color === 'success'
											? '#10b981'
											: affordabilityCategory.color === 'warning'
											? '#f59e0b'
											: '#ef4444',
								}}
							></div>
						</div>

						<div className='bg-gray-50 p-4 rounded-lg mt-6'>
							<h3 className='font-medium mb-2'>Financial Assessment</h3>
							<ul className='space-y-2'>
								<li className='flex items-start'>
									<CheckCircle className='h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0' />
									<span>
										Monthly income is{' '}
										{(1 / screeningData.affordability_ratio).toFixed(1)}x the
										monthly rent
									</span>
								</li>
								<li className='flex items-start'>
									<CheckCircle className='h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0' />
									<span>Income verification documents match stated income</span>
								</li>
								<li className='flex items-start'>
									<CheckCircle className='h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0' />
									<span>Bank statements show consistent income deposits</span>
								</li>
								<li className='flex items-start'>
									<CheckCircle className='h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0' />
									<span>
										Sufficient savings for security deposit and first month's
										rent
									</span>
								</li>
							</ul>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Background Check & Rental History */}
			<div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6'>
				{/* Background Check */}
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
										: 'Pending'}
								</p>
								<p className='text-sm text-gray-500'>
									Verified on{' '}
									{new Date(
										screeningData.background_check.verification_date,
									).toLocaleDateString()}
								</p>
							</div>
						</div>

						<div className='grid grid-cols-1 gap-4 mt-6'>
							<div className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
								<div className='flex items-center'>
									<span className='font-medium'>Criminal Record</span>
								</div>
								{screeningData.background_check.criminal_record ? (
									<Badge variant='danger'>Found</Badge>
								) : (
									<Badge variant='success'>None</Badge>
								)}
							</div>

							<div className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
								<div className='flex items-center'>
									<span className='font-medium'>Eviction History</span>
								</div>
								{screeningData.background_check.eviction_history ? (
									<Badge variant='danger'>Found</Badge>
								) : (
									<Badge variant='success'>None</Badge>
								)}
							</div>

							<div className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
								<div className='flex items-center'>
									<span className='font-medium'>Identity Verification</span>
								</div>
								<Badge variant='success'>Verified</Badge>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Rental History */}
				<Card>
					<CardHeader>
						<h2 className='text-lg font-semibold flex items-center'>
							<Home className='h-5 w-5 text-blue-600 mr-2' />
							Rental History
						</h2>
					</CardHeader>
					<CardContent>
						{screeningData.rental_history.length > 0 ? (
							<div className='space-y-4'>
								{screeningData.rental_history.map(
									(rental: any, index: number) => (
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
													<p className='text-sm'>R{rental.rent_amount}</p>
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
													<p className='text-sm text-gray-500'>
														Payment History
													</p>
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
									),
								)}
							</div>
						) : (
							<div className='text-center py-6 text-gray-500'>
								No rental history available
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Document Analysis */}
			<Card>
				<CardHeader>
					<h2 className='text-lg font-semibold flex items-center'>
						<FileText className='h-5 w-5 text-blue-600 mr-2' />
						Document Analysis
					</h2>
				</CardHeader>
				<CardContent>
					<div className='space-y-6'>
						{screeningData.documents.map((doc: any) => (
							<div
								key={doc.id}
								className='border border-gray-200 rounded-lg overflow-hidden'
							>
								<div className='bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between'>
									<div className='flex items-center'>
										<FileText className='h-5 w-5 text-blue-500 mr-2' />
										<div>
											<p className='font-medium'>{doc.file_name}</p>
											<p className='text-xs text-gray-500'>
												{new Date(doc.created_at).toLocaleDateString()} •{' '}
												{(doc.file_size / 1024).toFixed(1)} KB
											</p>
										</div>
									</div>
									<Badge variant='info' className='capitalize'>
										{doc.document_type.replace('_', ' ')}
									</Badge>
								</div>
								<div className='p-4'>
									<h3 className='text-sm font-medium mb-2'>
										Extracted Text (OCR)
									</h3>
									<div className='bg-gray-50 p-3 rounded border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap'>
										{doc.ocr_text}
									</div>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export default DetailedScreening;
