import { OcrProvider } from './ocrInterface';
import { AzureOcrProvider } from './azureOcrProvider';
import { TesseractOcrProvider } from './tesseractOcrProvider';

// Default to Tesseract as requested
const DEFAULT_PROVIDER = 'tesseract';

// Azure Document Intelligence has a 5MB limit for PDFs
const MAX_AZURE_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Factory function to get the appropriate OCR provider
 * @param providerName Optional provider name, defaults to Tesseract
 * @param file Optional file to determine best provider for file type
 * @returns OcrProvider instance
 */
export function getOcrProvider(
	providerName: string = DEFAULT_PROVIDER,
	file?: File,
): OcrProvider {
	// If a file is provided, make intelligent provider selection
	if (file) {
		const isPdf =
			file.type === 'application/pdf' ||
			(file.name && file.name.toLowerCase().endsWith('.pdf'));

		// Use Azure for PDFs (if not too large)
		if (isPdf && file.size <= MAX_AZURE_FILE_SIZE) {
			console.log('PDF detected - using Azure provider for better PDF support');
			return new AzureOcrProvider();
		}

		// For large files, use Tesseract
		if (file.size > MAX_AZURE_FILE_SIZE) {
			console.log('Large file detected - using Tesseract for better handling');
			return new TesseractOcrProvider();
		}
	}

	// Otherwise use the requested provider
	switch (providerName.toLowerCase()) {
		case 'azure':
			return new AzureOcrProvider();
		case 'tesseract':
		default:
			return new TesseractOcrProvider();
	}
}

export * from './ocrInterface';
