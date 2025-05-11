import { z } from 'zod';

export const profileCompletionSchema = z
	.object({
		firstName: z.string().min(1, 'First name is required'),
		lastName: z.string().min(1, 'Last name is required'),
		role: z.enum(['tenant', 'agent', 'landlord'], {
			required_error: 'Please select a role',
		}),
		phone: z.string().optional(),
		companyName: z.string().optional(),
		id_number: z.string().optional(),
		employment_status: z.string().optional(),
		monthly_income: z.coerce.number().optional(),
		current_address: z.string().optional(),
		employer: z.string().optional(),
		employment_duration: z.coerce.number().optional(),
		tenant_id: z.string().optional(),
		isTeamSetup: z.boolean().optional(),
		teamName: z.string().optional(),
		teamPlanType: z
			.enum(['starter', 'growth', 'scale', 'enterprise'])
			.optional(),
	})
	.superRefine((data, ctx) => {
		if (data.role === 'tenant') {
			if (!data.id_number) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'ID number is required for tenants',
					path: ['id_number'],
				});
			}

			if (!data.employment_status) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Employment status is required for tenants',
					path: ['employment_status'],
				});
			}

			if (!data.monthly_income) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Monthly income is required for tenants',
					path: ['monthly_income'],
				});
			}

			if (!data.current_address) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Current address is required for tenants',
					path: ['current_address'],
				});
			}

			if (!data.employer) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Employer name is required for tenants',
					path: ['employer'],
				});
			}

			if (!data.employment_duration) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Employment duration is required for tenants',
					path: ['employment_duration'],
				});
			}

			if (!data.tenant_id) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Session error: Please refresh the page or log in again',
					path: ['tenant_id'],
				});
			}
		}

		if (
			(data.role === 'agent' || data.role === 'landlord') &&
			data.isTeamSetup &&
			!data.teamName
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Team name is required when creating a team',
				path: ['teamName'],
			});
		}

		if (
			(data.role === 'agent' || data.role === 'landlord') &&
			data.isTeamSetup &&
			!data.teamPlanType
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Please select a plan type',
				path: ['teamPlanType'],
			});
		}
	});

export type ProfileCompletionValues = z.infer<typeof profileCompletionSchema>;
