import Badge from '@/components/ui/Badge';

interface ScreeningHeaderProps {
	screeningData: {
		pre_approval_status?: string | null;
		created_at: string;
	};
	tenantProfile: {
		first_name?: string | null;
		last_name?: string | null;
	} | null;
}

const ScreeningHeader = ({
	screeningData,
	tenantProfile,
}: ScreeningHeaderProps) => {
	return (
		<div className='flex items-center justify-between'>
			<div>
				{/* <h1 className='text-2xl font-bold text-gray-900'>
					Detailed Screening Report
				</h1> */}
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
	);
};

export default ScreeningHeader;
