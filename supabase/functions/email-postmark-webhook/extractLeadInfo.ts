import { ExtractedLeadInfo } from './types.ts';
import { isValidEmail } from './utils.ts';

export function extractLeadInfo(body: string): ExtractedLeadInfo {
	const result: ExtractedLeadInfo = {
		email: null,
		name: null,
		phone: null,
		message: null,
	};

	if (!body) return result;

	// Email patterns (ordered by specificity)
	const emailPatterns = [
		/Email:\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i,
		/Email Address:\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i,
		/From:\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i,
		/Contact Email:\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i,
		/([^\s@]+@[^\s@]+\.[^\s@]+)/,
	];

	// Name patterns
	const namePatterns = [
		/Name:\s*(.+)/i,
		/Full Name:\s*(.+)/i,
		/From:\s*(.+?)\s*</i,
		/Contact Name:\s*(.+)/i,
	];

	// Phone patterns
	const phonePatterns = [
		/Phone:\s*(.+)/i,
		/Phone Number:\s*(.+)/i,
		/Telephone:\s*(.+)/i,
		/Contact Phone:\s*(.+)/i,
		/(\+?\d[\d\s\-()]{7,}\d)/,
	];

	// Extract email
	for (const pattern of emailPatterns) {
		const match = body.match(pattern);
		if (match?.[1]) {
			const extracted = match[1].trim();
			if (isValidEmail(extracted)) {
				result.email = extracted;
				break;
			}
		}
	}

	// Extract name
	for (const pattern of namePatterns) {
		const match = body.match(pattern);
		if (match?.[1]) {
			result.name = match[1].trim();
			break;
		}
	}

	// Extract phone
	for (const pattern of phonePatterns) {
		const match = body.match(pattern);
		if (match?.[1]) {
			result.phone = match[1].trim();
			break;
		}
	}

	// Extract message
	const messageMatch = body.match(/Message:\s*([\s\S]*?)(?=\n\w+:|$)/i);
	result.message = messageMatch?.[1]?.trim() || body.trim();

	return result;
}
