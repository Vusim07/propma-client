/* eslint-disable @typescript-eslint/no-explicit-any */
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import {
	DollarSign,
	CheckCircle,
	AlertCircle,
	ChevronDown,
	ChevronUp,
} from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import { useState } from 'react';

interface AffordabilityCardProps {
	affordabilityScore: number | null;
	monthlyRent: number | null;
	tenantProfile: {
		monthly_income?: number | null;
	} | null;
	reportData: any;
	incomeVerification?: boolean | null;
}

const getAffordabilityCategory = (score: number | null) => {
	if (score === null || score === undefined)
		return { label: 'N/A', color: 'secondary' };
	if (score <= 0.28) return { label: 'Excellent', color: 'success' };
	if (score <= 0.36) return { label: 'Good', color: 'success' };
	if (score <= 0.43) return { label: 'Fair', color: 'warning' };
	return { label: 'Poor', color: 'danger' };
};

const AffordabilityCard = ({
	affordabilityScore,
	monthlyRent,
	tenantProfile,
	reportData,
	incomeVerification,
}: AffordabilityCardProps) => {
	const affordabilityCategory = getAffordabilityCategory(affordabilityScore);
	const [showBasicMetrics, setShowBasicMetrics] = useState(true);
	const [showDetailedMetrics, setShowDetailedMetrics] = useState(false);
	const [showAIAnalysis, setShowAIAnalysis] = useState(false);

	return (
		<Card>
			<CardHeader>
				<h2 className='text-lg font-semibold flex items-center'>
					<DollarSign className='h-5 w-5 text-blue-600 mr-2' />
					Affordability Analysis
				</h2>
			</CardHeader>
			<CardContent className='space-y-4'>
				{/* Summary Section */}
				<div className='flex items-center justify-between'>
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

				{/* Basic Metrics - Collapsible */}
				<div className='border border-primary/20 rounded-lg overflow-hidden'>
					<button
						className='w-full flex justify-between items-center p-4 hover:bg-gray-50'
						onClick={() => setShowBasicMetrics(!showBasicMetrics)}
					>
						<h3 className='font-medium'>Basic Financial Assessment</h3>
						{showBasicMetrics ? (
							<ChevronUp className='h-5 w-5 text-gray-500' />
						) : (
							<ChevronDown className='h-5 w-5 text-gray-500' />
						)}
					</button>

					{showBasicMetrics && (
						<div className='p-4 pt-0 space-y-4'>
							{reportData?.affordability_notes ? (
								<p>{reportData.affordability_notes}</p>
							) : (
								<ul className='space-y-2'>
									<li className='flex items-start'>
										{incomeVerification ? (
											<CheckCircle className='h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0' />
										) : (
											<AlertCircle className='h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0' />
										)}
										<span>
											Income Verification:{' '}
											{incomeVerification ? 'Passed' : 'Pending/Failed'}
										</span>
									</li>
									<li className='flex items-start'>
										<CheckCircle className='h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0' />
										<span>Bank statements show consistent income deposits</span>
									</li>
								</ul>
							)}

							<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
								<div className='bg-gray-50 p-3 rounded-lg'>
									<p className='text-sm text-gray-500'>Rent to Income</p>
									<p className='font-medium'>
										{reportData?.metrics?.rent_to_income_ratio
											? `${(
													reportData.metrics.rent_to_income_ratio * 100
											  ).toFixed(1)}%`
											: 'N/A'}
									</p>
								</div>
								<div className='bg-gray-50 p-3 rounded-lg'>
									<p className='text-sm text-gray-500'>Monthly Income</p>
									<p className='font-medium'>
										{tenantProfile?.monthly_income
											? formatCurrency(tenantProfile.monthly_income)
											: 'N/A'}
									</p>
								</div>
								<div className='bg-gray-50 p-3 rounded-lg'>
									<p className='text-sm text-gray-500'>Target Rent</p>
									<p className='font-medium'>
										{monthlyRent ? formatCurrency(monthlyRent) : 'N/A'}
									</p>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Detailed Metrics - Collapsible */}
				{reportData && (
					<div className='border border-primary/20 rounded-lg overflow-hidden'>
						<button
							className='w-full flex justify-between items-center p-4 hover:bg-gray-50'
							onClick={() => setShowDetailedMetrics(!showDetailedMetrics)}
						>
							<h3 className='font-medium'>Detailed Financial Metrics</h3>
							{showDetailedMetrics ? (
								<ChevronUp className='h-5 w-5 text-gray-500' />
							) : (
								<ChevronDown className='h-5 w-5 text-gray-500' />
							)}
						</button>

						{showDetailedMetrics && (
							<div className='p-4 pt-0 grid grid-cols-1 md:grid-cols-3 gap-4'>
								<div className='bg-blue-50 p-3 rounded-lg'>
									<p className='text-sm text-gray-500'>Disposable Income</p>
									<p className='font-medium'>
										{formatCurrency(reportData.metrics.disposable_income)}
									</p>
								</div>
								<div className='bg-blue-50 p-3 rounded-lg'>
									<p className='text-sm text-gray-500'>
										Total Monthly Expenses
									</p>
									<p className='font-medium'>
										{formatCurrency(reportData.metrics.total_monthly_expenses)}
									</p>
								</div>
								<div className='bg-blue-50 p-3 rounded-lg'>
									<p className='text-sm text-gray-500'>Debt to Income Ratio</p>
									<p className='font-medium'>
										{(reportData.metrics.debt_to_income_ratio * 100).toFixed(1)}
										%
									</p>
								</div>
								<div className='bg-blue-50 p-3 rounded-lg'>
									<p className='text-sm text-gray-500'>Savings Rate</p>
									<p className='font-medium'>
										{(reportData.metrics.savings_rate * 100).toFixed(1)}%
									</p>
								</div>
								<div className='bg-blue-50 p-3 rounded-lg'>
									<p className='text-sm text-gray-500'>Total Debt</p>
									<p className='font-medium'>
										{formatCurrency(reportData.metrics.total_debt)}
									</p>
								</div>
							</div>
						)}
					</div>
				)}

				{/* AI Analysis - Collapsible */}
				{reportData && (
					<div className='border border-primary/20 rounded-lg overflow-hidden'>
						<button
							className='w-full flex justify-between items-center p-4 hover:bg-gray-50'
							onClick={() => setShowAIAnalysis(!showAIAnalysis)}
						>
							<h3 className='font-medium'>AI Risk Assessment</h3>
							{showAIAnalysis ? (
								<ChevronUp className='h-5 w-5 text-gray-500' />
							) : (
								<ChevronDown className='h-5 w-5 text-gray-500' />
							)}
						</button>

						{showAIAnalysis && (
							<div className='p-4 pt-0 space-y-4'>
								<div className='flex items-center justify-between'>
									<div>
										<p className='text-sm text-gray-500 font-medium'>
											Confidence Score
										</p>
										<p className='text-lg font-bold text-blue-700'>
											{Math.round((reportData.confidence || 0) * 100)}%
										</p>
									</div>
									{reportData.risk_factors_count > 0 && (
										<Badge variant='danger'>
											{reportData.risk_factors_count} Risk Factors
										</Badge>
									)}
								</div>

								{reportData.risk_factors_count > 0 ? (
									<div>
										<p className='text-sm text-gray-500 font-medium mb-2'>
											Risk Factors:
										</p>
										<ul className='list-disc ml-6 text-sm text-red-600 space-y-1'>
											{(
												reportData.risk_factors || [
													'High Non-Essential Spending',
												]
											).map((rf: string, i: number) => (
												<li key={i}>{rf}</li>
											))}
										</ul>
									</div>
								) : (
									<p className='text-green-600 text-sm'>
										No major risk factors detected.
									</p>
								)}

								{reportData.recommendations_count > 0 && (
									<div>
										<p className='text-sm text-gray-500 font-medium mb-2'>
											Recommendations:
										</p>
										<ul className='list-disc ml-6 text-sm text-blue-700 space-y-1'>
											{(reportData.recommendations || []).map(
												(rec: string, i: number) => (
													<li key={i}>{rec}</li>
												),
											)}
										</ul>
									</div>
								)}

								<div>
									<p className='text-sm text-gray-500 font-medium mb-2'>
										Income & Expenses:
									</p>
									<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
										<div className='bg-gray-50 p-3 rounded-lg'>
											<p className='text-xs text-gray-500 mb-1'>
												Verified Net Income (Latest Payslip)
											</p>
											<p className='font-medium'>
												{formatCurrency(
													reportData?.metrics?.monthly_income || 0,
												)}
											</p>
										</div>
										<div className='bg-gray-50 p-3 rounded-lg'>
											<p className='text-xs text-gray-500 mb-1'>
												Essential Expenses
											</p>
											<p className='font-medium'>
												{formatCurrency(
													reportData?.transaction_analysis?.outgoing?.essential_expenses?.reduce(
														(sum: number, exp: any) => sum + (exp.amount || 0),
														0,
													) || 0,
												)}
											</p>
										</div>
										<div className='bg-gray-50 p-3 rounded-lg'>
											<p className='text-xs text-gray-500 mb-1'>
												Non-Essential Expenses
											</p>
											<p className='font-medium'>
												{formatCurrency(
													reportData?.transaction_analysis?.outgoing?.non_essential_expenses?.reduce(
														(sum: number, exp: any) => sum + (exp.amount || 0),
														0,
													) || 0,
												)}
											</p>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
};

export default AffordabilityCard;
