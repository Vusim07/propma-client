/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { createWorker } from 'tesseract.js';
import { useAuthStore } from '@/stores/authStore';
import { useTenantStore } from '@/stores/tenantStore';
import { usePageTitle } from '@/context/PageTitleContext';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/Select';
import { Upload, FileText, Trash2, Check } from 'lucide-react';
import { showToast } from '@/utils/toast';

const DocumentUpload: React.FC = () => {
	const { user } = useAuthStore();
	const { setPageTitle } = usePageTitle();
	const { documents, fetchDocuments, uploadDocument, isLoading } =
		useTenantStore();

	const [file, setFile] = useState<File | null>(null);
	const [documentType, setDocumentType] = useState<
		'id' | 'bank_statement' | 'payslip' | 'other'
	>('id');
	const [ocrText, setOcrText] = useState('');
	const [ocrProgress, setOcrProgress] = useState(0);
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		setPageTitle('Documents');
		if (user) {
			fetchDocuments(user.id);
		}
	}, [user, fetchDocuments, setPageTitle]);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		accept: {
			'image/*': ['.jpeg', '.jpg', '.png'],
			'application/pdf': ['.pdf'],
		},
		maxSize: 5242880, // 5MB
		maxFiles: 1,
		onDrop: (acceptedFiles) => {
			if (acceptedFiles.length > 0) {
				setFile(acceptedFiles[0]);
				setError('');
			}
		},
		onDropRejected: (fileRejections) => {
			const rejection = fileRejections[0];
			if (rejection.errors[0].code === 'file-too-large') {
				setError('File is too large. Maximum size is 5MB.');
				showToast.error('File is too large. Maximum size is 5MB.');
			} else {
				setError('Invalid file. Please upload a PDF or image file.');
				showToast.error('Invalid file. Please upload a PDF or image file.');
			}
		},
	});

	const processOCR = async () => {
		if (!file) return;

		setIsProcessing(true);
		setOcrProgress(0);

		const toastId = showToast.loading('Processing document...');

		try {
			const worker = await createWorker({
				logger: (progress: { status: string; progress: number }) => {
					if (progress.status === 'recognizing text') {
						setOcrProgress(parseInt(progress.progress * 100 + '', 10));
					}
				},
			});

			await worker.loadLanguage('eng');
			await worker.initialize('eng');

			const {
				data: { text },
			} = await worker.recognize(file);
			setOcrText(text);

			await worker.terminate();
			setIsProcessing(false);
			showToast.dismiss(toastId);
			showToast.success('Document processed successfully!');
		} catch (err) {
			console.error('OCR processing error:', err);
			setError('Failed to process document. Please try again.');
			setIsProcessing(false);
			showToast.dismiss(toastId);
			showToast.error('Failed to process document. Please try again.');
		}
	};

	const handleUpload = async () => {
		if (!file || !user) return;

		try {
			await uploadDocument({
				user_id: user.id,
				file_name: file.name,
				file_type: file.type,
				file_size: file.size,
				file_path: `/storage/documents/${user.id}/${file.name}`,
				document_type: documentType,
				ocr_text: ocrText,
			});

			showToast.success('Document uploaded successfully!');

			// Reset form
			setFile(null);
			setOcrText('');
			setOcrProgress(0);
		} catch (err) {
			console.error('Upload error:', err);
			setError('Failed to upload document. Please try again.');
			showToast.error('Failed to upload document. Please try again.');
		}
	};

	const documentTypeOptions = [
		{ value: 'id', label: "ID/Driver's License" },
		{ value: 'bank_statement', label: 'Bank Statement' },
		{ value: 'payslip', label: 'Pay Slip' },
		{ value: 'other', label: 'Other' },
	];

	return (
		<div>
			<div className='mb-6'>
				<h1 className='text-2xl font-bold text-gray-900'>Document Upload</h1>
				<p className='text-gray-600 mt-1'>
					Upload and process your documents for verification
				</p>
			</div>

			{error && (
				<Alert variant='error' className='mb-6'>
					{error}
				</Alert>
			)}

			<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
				{/* Upload Section */}
				<Card>
					<CardHeader>
						<h2 className='text-lg font-semibold'>Upload Document</h2>
					</CardHeader>
					<CardContent>
						<div
							{...getRootProps()}
							className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
								isDragActive
									? 'border-blue-500 bg-blue-50'
									: 'border-gray-300 hover:border-blue-400'
							}`}
						>
							<input {...getInputProps()} />
							<Upload className='h-12 w-12 text-gray-400 mx-auto mb-4' />
							{isDragActive ? (
								<p className='text-blue-500'>Drop the file here...</p>
							) : (
								<div>
									<p className='text-gray-600 mb-2'>
										Drag & drop a file here, or click to select
									</p>
									<p className='text-sm text-gray-500'>
										Supported formats: JPG, PNG, PDF (max 5MB)
									</p>
								</div>
							)}
						</div>

						{file && (
							<div className='mt-4 p-4 bg-gray-50 rounded-lg'>
								<div className='flex items-center justify-between'>
									<div className='flex items-center'>
										<FileText className='h-5 w-5 text-blue-500 mr-2' />
										<div>
											<p className='font-medium text-gray-900 truncate max-w-xs'>
												{file.name}
											</p>
											<p className='text-sm text-gray-500'>
												{(file.size / 1024).toFixed(1)} KB
											</p>
										</div>
									</div>
									<button
										onClick={(e) => {
											e.stopPropagation();
											setFile(null);
											setOcrText('');
										}}
										className='text-gray-500 hover:text-red-500'
										aria-label='Remove file'
									>
										<Trash2 size={18} />
									</button>
								</div>

								<div className='mt-4'>
									<label
										htmlFor='document-type'
										className='text-sm font-medium text-gray-700 block mb-1'
									>
										Document Type
									</label>
									<Select
										value={documentType}
										onValueChange={(value) => setDocumentType(value as any)}
									>
										<SelectTrigger className='w-full'>
											<SelectValue placeholder='Select document type' />
										</SelectTrigger>
										<SelectContent>
											{documentTypeOptions.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className='mt-4'>
									{!ocrText && !isProcessing ? (
										<Button
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												processOCR();
											}}
											fullWidth
										>
											Process Document
										</Button>
									) : isProcessing ? (
										<div>
											<div className='flex items-center justify-between mb-2'>
												<span className='text-sm text-gray-600'>
													Processing...
												</span>
												<span className='text-sm font-medium text-blue-600'>
													{ocrProgress}%
												</span>
											</div>
											<div className='w-full bg-gray-200 rounded-full h-2.5'>
												<div
													className='bg-blue-600 h-2.5 rounded-full'
													style={{ width: `${ocrProgress}%` }}
												></div>
											</div>
										</div>
									) : (
										<Button
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												handleUpload();
											}}
											variant='primary'
											fullWidth
											isLoading={isLoading}
										>
											<Check size={18} className='mr-2' />
											Upload Document
										</Button>
									)}
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* OCR Preview */}
				<Card>
					<CardHeader>
						<h2 className='text-lg font-semibold'>Document Preview</h2>
					</CardHeader>
					<CardContent>
						{isProcessing ? (
							<div className='flex flex-col items-center justify-center h-64'>
								<Spinner size='lg' className='mb-4' />
								<p className='text-gray-600'>Processing document...</p>
							</div>
						) : ocrText ? (
							<div>
								<div className='p-4 bg-gray-50 rounded-lg mb-4'>
									<h3 className='font-medium text-gray-900 mb-2'>
										Extracted Text:
									</h3>
									<div className='bg-white border border-gray-200 rounded p-3 max-h-64 overflow-y-auto'>
										<pre className='text-sm text-gray-700 whitespace-pre-wrap'>
											{ocrText}
										</pre>
									</div>
								</div>
								<Alert variant='info'>
									Review the extracted text for accuracy before uploading.
								</Alert>
							</div>
						) : (
							<div className='flex flex-col items-center justify-center h-64 text-center'>
								<FileText className='h-12 w-12 text-gray-300 mb-4' />
								<p className='text-gray-500'>
									Upload and process a document to see the extracted text here
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Uploaded Documents */}
			<Card className='mt-6'>
				<CardHeader>
					<h2 className='text-lg font-semibold'>Uploaded Documents</h2>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className='flex justify-center py-8'>
							<Spinner />
						</div>
					) : documents.length > 0 ? (
						<div className='divide-y divide-gray-200'>
							{documents.map((doc) => (
								<div key={doc.id} className='py-4 first:pt-0 last:pb-0'>
									<div className='flex items-start justify-between'>
										<div className='flex items-center'>
											<FileText className='h-5 w-5 text-blue-500 mr-3' />
											<div>
												<p className='font-medium text-gray-900'>
													{doc.file_name}
												</p>
												<div className='flex items-center mt-1'>
													<span className='text-sm text-gray-500 mr-3'>
														{new Date(doc.created_at).toLocaleDateString()}
													</span>
													<span className='text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full'>
														{doc.document_type.replace('_', ' ')}
													</span>
												</div>
											</div>
										</div>
										<Button variant='outline' size='sm'>
											View
										</Button>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className='text-center py-8'>
							<p className='text-gray-500'>No documents uploaded yet</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
};

export default DocumentUpload;
