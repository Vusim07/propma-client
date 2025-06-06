import { EmailAddress } from '../types/inbox';

/**
 * Validates an email address format
 * @param email - The email address to validate
 * @returns boolean indicating if the email is valid
 */
export const isValidEmailFormat = (email: string): boolean => {
	// Basic email format validation
	const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
	return emailRegex.test(email);
};

/**
 * Validates if an email address is a valid @mail.agentamara.com address
 * @param email - The email address to validate
 * @returns boolean indicating if it's a valid agent email
 */
export const isValidAgentEmail = (email: string): boolean => {
	const agentEmailRegex = /^[a-zA-Z0-9-]+-[a-zA-Z0-9]+@mail\.agentamara\.com$/;
	return agentEmailRegex.test(email);
};

/**
 * Generates an agent email address based on first name and user ID
 * @param firstName - The agent's first name
 * @param userId - The agent's user ID
 * @returns The generated email address
 */
export const generateAgentEmailAddress = (
	firstName: string,
	userId: string,
): string => {
	// Sanitize first name: lowercase, remove special chars, replace spaces with hyphens
	const sanitizedName = firstName
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '')
		.replace(/\s+/g, '-');

	// Take first 20 chars of sanitized name to keep email length reasonable
	const truncatedName = sanitizedName.slice(0, 20);

	// Generate email address
	return `${truncatedName}-${userId}@mail.agentamara.com`;
};

/**
 * Generates a team email address based on company name and team ID
 * @param companyName - The team's company name
 * @param teamId - The team's ID
 * @returns The generated email address
 */
export const generateTeamEmailAddress = (
	companyName: string,
	teamId: string,
): string => {
	// Sanitize company name: lowercase, remove special chars, replace spaces with hyphens
	const sanitizedName = companyName
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '')
		.replace(/\s+/g, '-');

	// Take first 20 chars of sanitized name to keep email length reasonable
	const truncatedName = sanitizedName.slice(0, 20);

	// Generate email address
	return `${truncatedName}-${teamId}@mail.agentamara.com`;
};

/**
 * Validates if an email address is unique in the system
 * @param email - The email address to check
 * @param existingEmails - Array of existing email addresses
 * @returns boolean indicating if the email is unique
 */
export const isUniqueEmailAddress = (
	email: string,
	existingEmails: EmailAddress[],
): boolean => {
	return !existingEmails.some((existing) => existing.email_address === email);
};

/**
 * Extracts user ID from an agent email address
 * @param email - The agent email address
 * @returns The user ID or null if invalid format
 */
export const extractUserIdFromEmail = (email: string): string | null => {
	const match = email.match(
		/^[a-zA-Z0-9-]+-([a-zA-Z0-9]+)@mail\.agentamara\.com$/,
	);
	return match ? match[1] : null;
};

/**
 * Extracts team ID from a team email address
 * @param email - The team email address
 * @returns The team ID or null if invalid format
 */
export const extractTeamIdFromEmail = (email: string): string | null => {
	const match = email.match(
		/^[a-zA-Z0-9-]+-([a-zA-Z0-9]+)@mail\.agentamara\.com$/,
	);
	return match ? match[1] : null;
};

/**
 * Validates an email address for the system
 * @param email - The email address to validate
 * @param existingEmails - Array of existing email addresses
 * @returns Object containing validation result and any error messages
 */
export interface EmailValidationResult {
	isValid: boolean;
	errors: {
		format?: string;
		uniqueness?: string;
		domain?: string;
	};
}

export const validateEmailAddress = (
	email: string,
	existingEmails: EmailAddress[],
): EmailValidationResult => {
	const result: EmailValidationResult = {
		isValid: true,
		errors: {},
	};

	// Check basic format
	if (!isValidEmailFormat(email)) {
		result.isValid = false;
		result.errors.format = 'Invalid email format';
	}

	// Check domain
	if (!email.endsWith('@mail.agentamara.com')) {
		result.isValid = false;
		result.errors.domain = 'Email must be from @mail.agentamara.com domain';
	}

	// Check uniqueness
	if (!isUniqueEmailAddress(email, existingEmails)) {
		result.isValid = false;
		result.errors.uniqueness = 'Email address already exists';
	}

	return result;
};
