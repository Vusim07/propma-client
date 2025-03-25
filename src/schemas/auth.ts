import * as z from 'zod';

export const loginSchema = z.object({
	email: z.string().email({ message: 'Please enter a valid email address' }),
	password: z
		.string()
		.min(6, { message: 'Password must be at least 6 characters' }),
});

// Update the registration schema to remove role requirement
export const registerSchema = z
	.object({
		email: z
			.string()
			.min(1, { message: 'Email is required' })
			.email({ message: 'Please enter a valid email address' })
			.transform((email) => email.trim().toLowerCase()), // Normalize email
		password: z
			.string()
			.min(6, { message: 'Password must be at least 6 characters' }),
		confirmPassword: z
			.string()
			.min(6, { message: 'Password must be at least 6 characters' }),
		// Role is removed from here
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	});

// Make sure form value types are updated
export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
