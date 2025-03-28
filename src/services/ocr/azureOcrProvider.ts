import { supabase } from '../supabase';
import { OcrProvider, OcrResult } from './ocrInterface';

export class AzureOcrProvider implements OcrProvider {
	async analyzeDocument(file: File, userId: string): Promise<OcrResult> {
		try {
			// 1. Upload file to Supabase Storage to get a URL
			const fileExt = file.name.split('.').pop();
			const fileName = `${userId}_${Date.now()}.${fileExt}`;
			const filePath = `temp/${fileName}`;

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
			const { data: signedUrlData, error: signedUrlError } =
				await supabase.storage
					.from('tenant_documents')
					.createSignedUrl(filePath, 60 * 60); // URL valid for 1 hour

			if (signedUrlError) {
				throw new Error(
					`Failed to generate signed URL: ${signedUrlError.message}`,
				);
			}

			// Call the Edge Function to analyze the document
			console.log('Sending request to Edge Function with body:', {
				fileUrl: signedUrlData.signedUrl,
			});

			const { data, error } = await supabase.functions.invoke(
				'analyze-document',
				{
					body: { fileUrl: signedUrlData.signedUrl },
				},
			);

			if (error) {
				console.error('Edge Function invocation error:', error);
				throw new Error(`Edge Function error: ${error.message}`);
			}

			if (!data) {
				throw new Error('No data returned from document analysis');
			}

			// Clean up the temporary file after processing
			const { error: cleanupError } = await supabase.storage
				.from('tenant_documents')
				.remove([filePath]);

			if (cleanupError) {
				console.warn('Temporary file cleanup error:', cleanupError);
			}

			return {
				content: data.extractedText || '',
				paragraphs: data.paragraphs || [],
				keyValuePairs: data.keyValuePairs || [],
				documentType: data.documentType,
				processedDate: data.processedDate,
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
