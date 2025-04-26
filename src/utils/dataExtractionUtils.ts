import { Json } from '../services/database.types';

/**
 * Extract a numeric value from extracted document data using multiple possible keys
 */
export const extractNumericValue = (
	data: Record<string, unknown>,
	possibleKeys: string[],
): number | null => {
	for (const key of possibleKeys) {
		const value = data[key];
		if (value !== undefined) {
			// Handle different types of values
			if (typeof value === 'number') {
				return value;
			} else if (typeof value === 'string') {
				// Try to parse numeric value from string, removing currency symbols
				const numStr = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
				const parsed = parseFloat(numStr);
				if (!isNaN(parsed)) {
					return parsed;
				}
			}
		}
	}
	return null;
};

/**
 * Extract a string value from extracted document data using multiple possible keys
 */
export const extractStringValue = (
	data: Record<string, unknown>,
	possibleKeys: string[],
): string | null => {
	for (const key of possibleKeys) {
		const value = data[key];
		if (
			value !== undefined &&
			(typeof value === 'string' || typeof value === 'number')
		) {
			return String(value);
		}
	}
	return null;
};

/**
 * Format raw payslip data into a structured format
 */
export const formatPayslipData = (rawData: Json | null) => {
	if (
		!rawData ||
		typeof rawData !== 'object' ||
		rawData === null ||
		Array.isArray(rawData)
	) {
		return undefined;
	}

	return {
		employer:
			extractStringValue(rawData, ['employer', 'company_name']) || 'Unknown',
		employeeName:
			extractStringValue(rawData, ['employee_name', 'employee']) ||
			'Unknown Employee',
		employeeId: extractStringValue(rawData, ['employee_id', 'employee_number']),
		payPeriod: extractStringValue(rawData, ['pay_period', 'payment_period']),
		grossIncome:
			extractNumericValue(rawData, [
				'gross_income',
				'gross_pay',
				'total_earnings',
			]) || 0,
		netIncome:
			extractNumericValue(rawData, [
				'net_income',
				'net_pay',
				'take_home_pay',
			]) || 0,
		incomeFrequency: 'monthly' as const,
	};
};
