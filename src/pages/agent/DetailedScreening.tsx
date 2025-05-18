/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../services/supabase';
import { Tables } from '../../services/database.types';

import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { ArrowLeft } from 'lucide-react';
import AffordabilityCard from '@/components/agent/ScreeningReport/AffordabilityCard';
import BackgroundCheckCard from '@/components/agent/ScreeningReport/BackgroundCheckCard';
import CreditReportCard from '@/components/agent/ScreeningReport/CreditReportCard';
import DocumentAnalysisCard from '@/components/agent/ScreeningReport/DocumentAnalysisCard';
import ScreeningHeader from '@/components/agent/ScreeningReport/ScreeningHeader';
import TenantInfoCard from '@/components/agent/ScreeningReport/TenantInfoCard';
import { usePageTitle } from '@/context/PageTitleContext';

type ScreeningReportWithDetails = Tables<'screening_reports'> & {
	tenant_profiles: Tables<'tenant_profiles'> | null;
	documents: Tables<'documents'>[] | null;
	credit_reports: Tables<'credit_reports'>[] | null;
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
	const { setPageTitle } = usePageTitle();

	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { user } = useAuthStore();
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	const [screeningData, setScreeningData] =
		useState<ScreeningReportWithDetails | null>(null);
	const [monthlyRent, setMonthlyRent] = useState<number | null>(null);

	useEffect(() => {
		setPageTitle('Detailed Screening Report');
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
            applications:applications!inner(property_id, tenant_id, properties!inner(monthly_rent)),
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
					setMonthlyRent(null);
				} else if (data) {
					const fetchedRent =
						(data as any).applications?.properties?.monthly_rent ?? null;
					setMonthlyRent(fetchedRent);

					const creditScoreFromData = (data as any).credit_score;
					const tenantProfile =
						(data as any).tenant_profiles?.tenant_profiles ??
						(data as any).tenant_profiles ??
						null;
					const tenantUserId = tenantProfile?.tenant_id;

					let tenantDocuments: any[] = [];
					if (tenantUserId) {
						const { data: docs, error: docsError } = await supabase
							.from('documents')
							.select('*')
							.eq('user_id', tenantUserId)
							.order('created_at', { ascending: false });
						if (!docsError && docs) {
							tenantDocuments = docs;
						}
					}

					const reportData = (() => {
						try {
							return typeof (data as any).report_data === 'string'
								? JSON.parse((data as any).report_data)
								: (data as any).report_data;
						} catch {
							return null;
						}
					})();

					const combinedData: ScreeningReportWithDetails = {
						...(data as any),
						credit_report: {
							score: creditScoreFromData ?? 720,
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
						tenant_profiles: tenantProfile,
						documents: tenantDocuments,
						report_data: reportData,
					};
					setScreeningData(combinedData);
				} else {
					setError(`Screening report not found for application ID: ${id}`);
					setScreeningData(null);
					setMonthlyRent(null);
				}
			} catch (error: any) {
				console.error('Error fetching screening data:', error);
				let errorMessage = 'Failed to load screening data.';
				if (error && error.message)
					errorMessage += ` Message: ${error.message}`;
				if (error && error.details)
					errorMessage += ` Details: ${error.details}`;
				if (error && error.hint) errorMessage += ` Hint: ${error.hint}`;
				if (error && error.code) errorMessage += ` Code: ${error.code}`;
				setError(errorMessage);
				setScreeningData(null);
				setMonthlyRent(null);
			} finally {
				setIsLoading(false);
			}
		};

		fetchScreeningData();
	}, [id, user]);

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

				<ScreeningHeader
					screeningData={screeningData}
					tenantProfile={screeningData.tenant_profiles}
				/>
			</div>

			<TenantInfoCard
				tenantProfile={screeningData.tenant_profiles}
				createdAt={screeningData.created_at}
			/>

			{/* Affordability Card - Full width */}
			<div className='mb-6'>
				<AffordabilityCard
					affordabilityScore={screeningData.affordability_score}
					monthlyRent={monthlyRent}
					tenantProfile={screeningData.tenant_profiles}
					reportData={screeningData.report_data}
					incomeVerification={screeningData.income_verification}
				/>
			</div>

			{/* Credit Report and Background Check - Side by side */}
			<div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6'>
				<CreditReportCard
					creditScore={screeningData.credit_score}
					creditReport={screeningData.credit_report}
					creditReports={screeningData.credit_reports as any}
				/>

				<BackgroundCheckCard
					backgroundCheckStatus={screeningData.background_check_status}
					backgroundCheck={screeningData.background_check}
					idVerificationStatus={screeningData.id_verification_status}
				/>
			</div>

			{/* Documents - Full width */}
			<DocumentAnalysisCard documents={screeningData.documents ?? []} />
		</div>
	);
};

export default DetailedScreening;
