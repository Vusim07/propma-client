/**
 * Formats a number as South African Rand (ZAR)
 * @param amount - Amount to format
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number): string => {
	return new Intl.NumberFormat('en-ZA', {
		style: 'currency',
		currency: 'ZAR',
		minimumFractionDigits: 2,
	}).format(amount);
};

/**
 * Formats a date string to DD/MM/YYYY format (South African standard)
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export const formatDate = (dateString: string): string => {
	const date = new Date(dateString);
	return new Intl.DateTimeFormat('en-ZA', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	}).format(date);
};

/**
 * Parses a DD/MM/YYYY formatted date string to ISO format
 * @param dateString - Date in DD/MM/YYYY format
 * @returns ISO date string
 */
export const parseDateString = (dateString: string): string => {
	const [day, month, year] = dateString.split('/');
	return `${year}-${month}-${day}`;
};
