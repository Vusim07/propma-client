import { supabase } from '../supabase';
import { OcrProvider, OcrResult } from './ocrInterface';
import {
	AzureKeyCredential,
	DocumentAnalysisClient,
} from '@azure/ai-form-recognizer';

// Azure Document Intelligence credentials
const AZURE_ENDPOINT =
	import.meta.env.VITE_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || '';
const AZURE_API_KEY =
	import.meta.env.VITE_AZURE_DOCUMENT_INTELLIGENCE_KEY || '';

export class AzureOcrProvider implements OcrProvider {
	async analyzeDocument(file: File, userId: string): Promise<OcrResult> {
		try {
			// Validate Azure credentials
			if (!AZURE_ENDPOINT || !AZURE_API_KEY) {
				console.error('Missing Azure Document Intelligence credentials');
				throw new Error('Azure Document Intelligence configuration is missing');
			}

			// Generate a unique ID for this document operation
			const operationId = crypto.randomUUID();

			// Create a unique filename using timestamp and operation ID
			const fileExt = file.name.split('.').pop();
			const originalFileName = file.name;
			// Include operation ID in the file path to ensure uniqueness
			const fileName = `${userId}_${Date.now()}_${operationId}.${fileExt}`;
			const filePath = `${userId}/${fileName}`;

			console.log('Uploading file to storage with unique path:', filePath);

			// Upload file - using upsert to prevent conflicts
			const { data: uploadData, error: uploadError } = await supabase.storage
				.from('tenant_documents')
				.upload(filePath, file, {
					cacheControl: '3600',
					upsert: true,
					contentType: file.type,
				});

			console.log('Upload data:', uploadData);

			if (uploadError) {
				console.error('Upload error:', uploadError);
				throw new Error(`Upload error: ${uploadError.message}`);
			}

			// Get public URL for the file
			const { data: publicUrlData } = await supabase.storage
				.from('tenant_documents')
				.createSignedUrl(filePath, 60 * 60); // URL valid for 1 hour

			if (!publicUrlData || !publicUrlData.signedUrl) {
				throw new Error('Failed to generate signed URL for document');
			}

			const fileUrl = publicUrlData.signedUrl;
			console.log('Processing document from URL:', fileUrl);

			// 2. Use Azure Document Analysis SDK directly
			const client = new DocumentAnalysisClient(
				AZURE_ENDPOINT,
				new AzureKeyCredential(AZURE_API_KEY),
			);

			// Start the document analysis and wait for it to complete
			const poller = await client.beginAnalyzeDocumentFromUrl(
				'prebuilt-layout',
				fileUrl,
			);

			const result = await poller.pollUntilDone();
			console.log('Document analysis completed:', result);

			// Format current date in South African format (DD/MM/YYYY)
			const currentDate = new Date().toLocaleDateString('en-ZA', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric',
			});

			// 3. Extract and format the results
			const paragraphs =
				result.paragraphs?.map((paragraph) => ({
					content: paragraph.content,
					boundingRegions: paragraph.boundingRegions?.map((region) => ({
						polygon: region.polygon || [],
					})),
				})) || [];

			// Extract text from all paragraphs
			const content = paragraphs.map((p) => p.content).join('\n\n');

			// Extract key-value pairs if available
			const keyValuePairs =
				result.keyValuePairs?.map((kvp) => ({
					key: kvp.key?.content || '',
					value: kvp.value?.content || '',
				})) || [];

			// Add more metadata to the result for better tracking
			return {
				content,
				paragraphs,
				keyValuePairs,
				documentType: 'document',
				processedDate: currentDate,
				filePath: uploadData?.path || filePath,
				fileName: originalFileName,
				fileSize: file.size,
				fileType: file.type,
				operationId: operationId,
				processedBy: 'Azure Document Intelligence',
			};
		} catch (error) {
			console.error('Azure OCR analysis failed:', error);
			throw error;
		}
	}

	getName(): string {
		return 'Azure Document Intelligence';
	}
}
