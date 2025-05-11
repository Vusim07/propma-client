export const roleOptions = [
	{ value: 'tenant', label: 'Tenant' },
	{ value: 'agent', label: 'Agent' },
	{ value: 'landlord', label: 'Landlord' },
] as const;

export const employmentStatusOptions = [
	{ value: 'full-time', label: 'Full-time employed' },
	{ value: 'part-time', label: 'Part-time employed' },
	{ value: 'self-employed', label: 'Self-employed' },
	{ value: 'unemployed', label: 'Unemployed' },
	{ value: 'student', label: 'Student' },
	{ value: 'retired', label: 'Retired' },
] as const;

export const teamPlanOptions = [
	{ value: 'starter', label: 'Starter (3 members)' },
	{ value: 'growth', label: 'Growth (10 members)' },
	{ value: 'scale', label: 'Scale (25 members)' },
	{ value: 'enterprise', label: 'Enterprise (Custom)' },
] as const;

export type RoleOption = (typeof roleOptions)[number]['value'];
export type EmploymentStatusOption =
	(typeof employmentStatusOptions)[number]['value'];
export type TeamPlanOption = (typeof teamPlanOptions)[number]['value'];

export interface TeamSetupFields {
	isTeamSetup: boolean;
	teamName?: string;
	teamPlanType?: TeamPlanOption;
}

export interface TenantFields {
	id_number: string;
	employment_status: EmploymentStatusOption;
	monthly_income: number;
	current_address: string;
	employer: string;
	employment_duration: number;
	tenant_id: string;
}
