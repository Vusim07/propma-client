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
				// Fall back to Azure for PDFs
				const azureProvider = new AzureOcrProvider();
				return await azureProvider.analyzeDocument(file, userId);
			}

			// Generate a unique ID for this document operation
			const operationId = crypto.randomUUID();

			// Create a unique filename using timestamp and operation ID
			const fileExt = file.name.split('.').pop();
			const originalFileName = file.name;
			// Include operation ID in the file path to ensure uniqueness
			const fileName = `${userId}_${Date.now()}_${operationId}.${fileExt}`;
			const filePath = `${userId}/${fileName}`;

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

			// Check file size - Azure Document Intelligence has a 5MB limit for PDFs
			if (file.size > 5 * 1024 * 1024) {
				console.error('File exceeds 5MB, using Tesseract for processing');
			}

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
				filePath: uploadData?.path || filePath,
				// Add original file name and metadata
				fileName: originalFileName,
				fileSize: file.size,
				fileType: file.type,
				operationId: operationId,
				processedBy: 'Tesseract OCR',
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

		const operationId = crypto.randomUUID();

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
			fileName: file.name,
			fileSize: file.size,
			fileType: file.type,
			operationId: operationId,
			processedBy: 'Tesseract OCR (Offline)',
		};
	}
}
