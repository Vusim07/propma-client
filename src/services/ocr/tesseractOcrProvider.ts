import { createWorker } from 'tesseract.js';
import { OcrProvider, OcrResult } from './ocrInterface';
import { AzureOcrProvider } from './azureOcrProvider';
import { supabase } from '../supabase';

export class TesseractOcrProvider implements OcrProvider {
	async analyzeDocument(file: File, userId: string): Promise<OcrResult> {
		try {
			// Check if file is PDF - Tesseract doesn't support PDF files
			const isPdf =
				file.type === 'application/pdf' ||
				file.name.toLowerCase().endsWith('.pdf');

			if (isPdf) {
				console.log('PDF detected. Tesseract cannot process PDFs directly.');

				// Fall back to Azure for PDFs
				console.log('Falling back to Azure OCR for PDF processing');
				const azureProvider = new AzureOcrProvider();
				return await azureProvider.analyzeDocument(file, userId);
			}

			console.log('Processing document with Tesseract OCR');

			// Upload file to persistent storage first (not temporary)
			// This ensures the file is stored even if we're using Tesseract
			const fileExt = file.name.split('.').pop();
			const fileName = `${userId}_${Date.now()}.${fileExt}`;
			const filePath = `${userId}/${fileName}`; // Not using temp folder - permanent storage

			console.log('Uploading file to permanent storage:', filePath);

			// Upload file - using upsert to prevent conflicts
			const { data: uploadData, error: uploadError } = await supabase.storage
				.from('tenant_documents')
				.upload(filePath, file, {
					cacheControl: '3600',
					upsert: true,
					contentType: file.type,
				});

			if (uploadError) {
				console.error('Storage upload error:', uploadError);
				throw new Error(`Upload error: ${uploadError.message}`);
			}

			console.log('File uploaded successfully to storage:', uploadData);

			// Proceed with Tesseract OCR for image files
			const worker = await createWorker('eng');

			// Use FileReader to convert the file to a data URL
			const imageData = await this.readFileAsDataURL(file);

			// Process the image with Tesseract
			const { data } = await worker.recognize(imageData);

			// Format current date in South African format (DD/MM/YYYY)
			const currentDate = new Date().toLocaleDateString('en-ZA', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric',
			});

			// Clean up resources
			await worker.terminate();

			// Extract paragraphs by splitting on double newlines
			const paragraphs = data.text
				.split(/\n\s*\n/)
				.filter((p) => p.trim().length > 0)
				.map((content) => ({ content }));

			// Create simple key-value pairs from file metadata
			const fileSizeKB = (file.size / 1024).toFixed(2);
			const keyValuePairs = [
				{ key: 'Filename', value: file.name },
				{ key: 'Date', value: currentDate },
				{ key: 'Size', value: `${fileSizeKB} KB` },
			];

			return {
				content: data.text,
				paragraphs,
				keyValuePairs,
				documentType: 'document',
				processedDate: currentDate,
				// Add file path to result so it can be used when saving to database
				filePath: uploadData?.path || filePath,
			};
		} catch (error) {
			console.error('Tesseract OCR analysis failed:', error);

			// Provide a fallback result in case of failure
			return this.generateFallbackResult(file);
		}
	}

	// Helper method to read file as data URL
	private async readFileAsDataURL(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(new Error('Failed to read file'));
			reader.readAsDataURL(file);
		});
	}

	getName(): string {
		return 'Tesseract OCR';
	}

	private generateFallbackResult(file: File): OcrResult {
		// Format date in South African format (DD/MM/YYYY)
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
}
