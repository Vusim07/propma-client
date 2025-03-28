import { OcrProvider } from './ocrInterface';
import { AzureOcrProvider } from './azureOcrProvider';
import { TesseractOcrProvider } from './tesseractOcrProvider';

// Default to Tesseract as requested
const DEFAULT_PROVIDER = 'tesseract';

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
	// If a file is provided, check if it's a PDF and Tesseract is requested
	if (file && providerName.toLowerCase() === 'tesseract') {
		const isPdf =
			file.type === 'application/pdf' ||
			(file.name && file.name.toLowerCase().endsWith('.pdf'));

		if (isPdf) {
			console.log(
				'PDF detected - automatically using Azure provider for better PDF support',
			);
			return new AzureOcrProvider();
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
