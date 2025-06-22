/* eslint-disable @typescript-eslint/no-explicit-any */
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import DocumentViewerSheet from '@/components/agent/DocumentViewerSheet';
import { Button } from '@/components/ui/button';
import { CreditCard, Eye } from 'lucide-react';

interface CreditReportCardProps {
	creditScore: number | null;
	creditReport?: {
		score: number;
		payment_history: string;
		derogatory_marks: number;
		accounts: number;
		hard_inquiries: number;
		credit_age: string;
		credit_utilization: string;
	} | null;
	creditReports:
		| {
				id: string;
				pdf_path: string;
		  }[]
		| null;
	planIncludesCreditCheck?: boolean | null;
	checkingPlan?: boolean;
}

const getCreditScoreCategory = (score: number | null) => {
	if (score === null || score === undefined)
		return { label: 'Error retrieving credit score', color: 'danger' };
	if (score >= 750) return { label: 'Excellent', color: 'success' };
	if (score >= 700) return { label: 'Good', color: 'success' };
	if (score >= 650) return { label: 'Fair', color: 'warning' };
	if (score >= 600) return { label: 'Poor', color: 'warning' };
	return { label: 'Very Poor', color: 'danger' };
};

const getWidthClass = (percent: number) => {
	if (percent >= 100) return 'w-full';
	if (percent >= 90) return 'w-11/12';
	if (percent >= 83) return 'w-10/12';
	if (percent >= 75) return 'w-9/12';
	if (percent >= 67) return 'w-8/12';
	if (percent >= 58) return 'w-7/12';
	if (percent >= 50) return 'w-6/12';
	if (percent >= 42) return 'w-5/12';
	if (percent >= 33) return 'w-4/12';
	if (percent >= 25) return 'w-3/12';
	if (percent >= 17) return 'w-2/12';
	if (percent >= 8) return 'w-1/12';
	return 'w-0';
};

const CreditReportCard = ({
	creditScore,
	creditReport,
	creditReports,
	planIncludesCreditCheck = true,
	checkingPlan = false,
}: CreditReportCardProps) => {
	const creditCategory = getCreditScoreCategory(creditScore);

	if (planIncludesCreditCheck === false && !checkingPlan) {
		return (
			<Card>
				<CardHeader>
					<h2 className='text-lg font-semibold flex items-center'>
						<CreditCard className='h-5 w-5 text-dusty_grey mr-2' />
						Experian Credit Report
					</h2>
				</CardHeader>
				<CardContent>
					<Alert variant='default' className='mb-2'>
						Your plan does not include Credit Reports.
					</Alert>
					<Button asChild variant='default' className='w-full md:w-auto'>
						<a href='/agent/settings'>Upgrade to Access Credit Reports</a>
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<h2 className='text-lg font-semibold flex items-center'>
					<CreditCard className='h-5 w-5 text-dusty_grey mr-2' />
					Experian Credit Report
				</h2>
			</CardHeader>
			<CardContent>
				<div className='flex items-center justify-between mb-4'>
					<div>
						<p className='text-3xl font-bold'>{creditScore ?? '0'}</p>
						<Badge variant={creditCategory.color as any}>
							{creditCategory.label}
						</Badge>
					</div>
					{creditScore !== null && creditReport && (
						<div
							className={`w-16 h-16 rounded-full border-4 flex items-center justify-center ${
								creditCategory.color === 'success'
									? 'border-green-500'
									: creditCategory.color === 'warning'
									? 'border-yellow-500'
									: creditCategory.color === 'danger'
									? 'border-red-500'
									: 'border-gray-400'
							}`}
						>
							<span className='text-lg font-bold'>
								{Math.round((creditScore / 850) * 100)}%
							</span>
						</div>
					)}
				</div>

				{creditScore !== null && creditReport && (
					<div className='w-full bg-gray-200 rounded-full h-2.5 mb-4'>
						<div
							className={`h-2.5 rounded-full ${
								creditCategory.color === 'success'
									? 'bg-green-500'
									: creditCategory.color === 'warning'
									? 'bg-yellow-500'
									: creditCategory.color === 'danger'
									? 'bg-red-500'
									: 'bg-gray-400'
							} ${getWidthClass((creditScore / 850) * 100)}`}
						></div>
					</div>
				)}

				{/* Check if creditReport exists and has a score before rendering details */}
				{creditReport &&
				creditReport.score !== undefined &&
				creditReport.score !== null ? (
					<div className='grid grid-cols-2 gap-4 mt-6'>
						<div>
							<p className='text-sm text-gray-500'>Payment History</p>
							<p className='font-medium'>{creditReport.payment_history}</p>
						</div>
						<div>
							<p className='text-sm text-gray-500'>Derogatory Marks</p>
							<p className='font-medium'>{creditReport.derogatory_marks}</p>
						</div>
						<div>
							<p className='text-sm text-gray-500'>Accounts</p>
							<p className='font-medium'>{creditReport.accounts}</p>
						</div>
						<div>
							<p className='text-sm text-gray-500'>Hard Inquiries</p>
							<p className='font-medium'>{creditReport.hard_inquiries}</p>
						</div>
						<div>
							<p className='text-sm text-gray-500'>Credit Age</p>
							<p className='font-medium'>{creditReport.credit_age}</p>
						</div>
						<div>
							<p className='text-sm text-gray-500'>Credit Utilization</p>
							<p className='font-medium'>{creditReport.credit_utilization}</p>
						</div>
						<div className='col-span-2'>
							{creditReports && creditReports.length > 0 && (
								<DocumentViewerSheet
									document={{
										id: creditReports[0].id,
										file_name: 'Credit Report.pdf',
										document_type: 'credit_report',
										file_path: creditReports[0].pdf_path,
									}}
									trigger={
										<Button
											variant='outline'
											size='sm'
											className='w-full md:w-auto'
										>
											<Eye size={16} className='mr-1.5' />
											View Credit Report
										</Button>
									}
								/>
							)}
						</div>
					</div>
				) : (
					<Alert variant='default'>
						Detailed credit report information not available.
					</Alert>
				)}
			</CardContent>
		</Card>
	);
};

export default CreditReportCard;
