import { getOcrProvider } from './ocr';

export interface DocumentAnalysisResult {
	content: string;
	paragraphs?: Array<{
		content: string;
		boundingRegions?: Array<{
			polygon: number[];
		}>;
	}>;
	keyValuePairs?: Array<{
		key: string;
		value: string;
	}>;
	documentType?: string;
	filePath?: string; // Add this to store the file path from storage
	processedDate?: string;
}

export const documentService = {
	async analyzeDocument(
		file: File,
		userId: string,
	): Promise<DocumentAnalysisResult> {
		try {
			// Use the OCR provider with file information for better selection
			const ocrProvider = getOcrProvider('tesseract', file);
			console.log(`Using OCR provider: ${ocrProvider.getName()}`);

			// Process the document using the provider
			const result = await ocrProvider.analyzeDocument(file, userId);
			console.log('Document analysis result:', result);

			return result;
		} catch (error) {
			console.error('Document analysis failed:', error);

			// For offline-first requirement, provide fallback if API call fails
			return generateFallbackAnalysis(file);
		}
	},
};

// Provide offline fallback for document processing
function generateFallbackAnalysis(file: File): DocumentAnalysisResult {
	const currentDate = new Date().toLocaleDateString('en-ZA', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	});

	const fileSizeKB = (file.size / 1024).toFixed(2);

	return {
		content: `Document Analysis (Offline Mode)\nProcessed on: ${currentDate}\nFile: ${file.name}\nSize: ${fileSizeKB} KB`,
		paragraphs: [
			{ content: `Document: ${file.name}` },
			{ content: `Processed on: ${currentDate}` },
			{ content: `File type: ${file.type}` },
			{ content: `Size: ${fileSizeKB} KB` },
		],
		keyValuePairs: [
			{ key: 'Filename', value: file.name },
			{ key: 'Date', value: currentDate },
			{ key: 'Size', value: `${fileSizeKB} KB` },
		],
		documentType: 'document',
		processedDate: currentDate,
	};
}
