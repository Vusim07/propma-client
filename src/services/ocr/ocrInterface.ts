export interface OcrResult {
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
	processedDate?: string;
	filePath?: string; // Add this to store the file path from storage
}

export interface OcrProvider {
	analyzeDocument(file: File, userId: string): Promise<OcrResult>;
	getName(): string;
}
