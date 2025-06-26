/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export const delay = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

export async function retryOperation<T>(
	operation: () => Promise<T>,
	operationName: string,
	maxRetries: number = MAX_RETRIES,
): Promise<T> {
	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error as Error;
			console.warn(
				`Attempt ${attempt}/${maxRetries} failed for ${operationName}:`,
				error,
			);

			if (attempt < maxRetries) {
				const delayMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
				await delay(delayMs);
			}
		}
	}

	throw new Error(
		`Operation ${operationName} failed after ${maxRetries} attempts. Last error: ${lastError?.message}`,
	);
}

export function sanitizeEmailBody(body: string): string {
	let normalized = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	normalized = normalized.replace(/\n{3,}/g, '\n\n');
	normalized = normalized.replace(/([.!?])\n/g, '$1\n\n');
	normalized = normalized.replace(/[ \t]+/g, ' ').trim();
	normalized = normalized.replace(
		/\n(Best regards|Sincerely|Regards|Thank you)/gi,
		'\n\n$1',
	);
	normalized = normalized
		.split('\n')
		.map((line) => line.trimRight())
		.join('\n');
	return normalized.trim() + '\n';
}

export function extractEmailAddress(formattedEmail: string): string {
	const matchAngleBrackets = formattedEmail.match(/<([^>]+)>/);
	if (matchAngleBrackets) return matchAngleBrackets[1];

	const matchQuotes = formattedEmail.match(/"([^"]+)"/);
	if (matchQuotes) return matchQuotes[1];

	return formattedEmail.trim();
}

export function isValidEmail(email: string | null): boolean {
	if (!email) return false;
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
