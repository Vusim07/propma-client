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
	filePath?: string; // Path in storage
	fileName?: string; // Original file name
	fileSize?: number; // File size in bytes
	fileType?: string; // MIME type
	operationId?: string; // Unique ID for this operation
	processedBy?: string; // Which OCR engine processed this
}

export interface OcrProvider {
	analyzeDocument(file: File, userId: string): Promise<OcrResult>;
	getName(): string;
}
