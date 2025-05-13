import { DocumentAnalysisResult } from '../documentService';

export interface AzureDocumentAnalysisResult {
	paragraphs?: Array<{
		content: string;
		boundingRegions?: Array<{
			polygon: number[];
		}>;
	}>;
	keyValuePairs?: Array<{
		key?: {
			content: string;
		};
		value?: {
			content: string;
		};
	}>;
}

export interface AzureOcrResponse {
	content: string;
	paragraphs: AzureDocumentAnalysisResult['paragraphs'];
	keyValuePairs: AzureDocumentAnalysisResult['keyValuePairs'];
	documentType: DocumentAnalysisResult['documentType'];
}
