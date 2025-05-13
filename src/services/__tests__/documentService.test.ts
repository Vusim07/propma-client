import fs from 'fs';
import path from 'path';
import { AzureOcrProvider } from '@/services/ocr/azureOcrProvider'; // Correct import
import { describe, it, expect } from 'vitest';

describe('DocumentService', () => {
	it('should analyze a document using Azure OCR and save the results', async () => {
		// Ensure the necessary environment variables are set
		if (
			!process.env.VITE_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT ||
			!process.env.VITE_AZURE_DOCUMENT_INTELLIGENCE_KEY
		) {
			console.warn(
				'Skipping test because AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT or AZURE_DOCUMENT_INTELLIGENCE_KEY is not set.',
			);
			return;
		}

		// Read the PDF file into a buffer
		const pdfPath = path.join(__dirname, '__fixtures__', 'October 2023.pdf');
		let pdfBuffer: Buffer;

		try {
			pdfBuffer = fs.readFileSync(pdfPath);
		} catch (error) {
			console.error(`Error reading PDF file: ${error}`);
			throw error; // Re-throw the error to fail the test
		}

		if (!pdfBuffer || pdfBuffer.length === 0) {
			throw new Error(
				'PDF buffer is empty.  Check that the PDF file was read successfully.',
			);
		}

		// Call azureOcrProvider.ts
		const azureOcrProvider = new AzureOcrProvider(); // Instantiate the provider
		const result = await azureOcrProvider.analyzeDocument(
			new File([pdfBuffer], 'October 2023.pdf', { type: 'application/pdf' }),
			'test-user',
		);

		// Ensure __test-output directory exists
		const outputDir = path.join(__dirname, '__test-output__');
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir);
		}

		// Save the results to the __test-output directory
		const outputPath = path.join(outputDir, 'azure-ocr-result.json');
		fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

		// Add assertions to check if the analysis was successful
		expect(result).toBeDefined();
		expect(result.content).toBeDefined(); // Changed to check content
		expect(result.documentType).toBeDefined(); // Added check for documentType
	}, 30000); // Increased timeout to 30 seconds
});
