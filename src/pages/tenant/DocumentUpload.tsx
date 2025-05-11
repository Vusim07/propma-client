/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useLocation, useNavigate } from 'react-router-dom';
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
} from '@/components/ui/select';
import {
	Upload,
	FileText,
	Trash2,
	CheckCircle,
	Plus,
	ChevronRight,
} from 'lucide-react';
import { showToast } from '@/utils/toast';
import { documentService } from '@/services/documentService';
import { supabase } from '@/services/supabase';
// import { getOcrProvider } from '@/services/ocr';

// Interface for files in the upload queue
interface QueuedFile {
	file: File;
	documentType: string;
	isProcessing: boolean;
	error?: string;
}

// Required document types for a complete application
const REQUIRED_DOCUMENT_TYPES = ['id_document', 'bank_statement', 'payslip'];

// Helper to determine if a document is valid (uploaded in the last 30 days)
const isDocumentValid = (docDate: string): boolean => {
	const createdAt = new Date(docDate);
	const now = new Date();
	const diff = now.getTime() - createdAt.getTime();
	const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
	return diff <= THIRTY_DAYS;
};

const DocumentUpload: React.FC = () => {
	const { user } = useAuthStore();
	const { setPageTitle } = usePageTitle();
	const navigate = useNavigate();
	const {
		documents,
		fetchDocuments,
		uploadDocument,
		completeApplicationWithDocuments,
		isLoading,
	} = useTenantStore();
	const location = useLocation();

	// Use a queue of files instead of a single file
	const [fileQueue, setFileQueue] = useState<QueuedFile[]>([]);
	const [documentType, setDocumentType] = useState<
		'id_document' | 'bank_statement' | 'payslip' | 'other'
	>('id_document');
	const [isProcessing, setIsProcessing] = useState(false);
	const [isCompleting, setIsCompleting] = useState(false);
	const [error, setError] = useState('');
	const [showProfileCompletionMessage, setShowProfileCompletionMessage] =
		useState(false);
	const [applicationId, setApplicationId] = useState<string | null>(null);

	// Parse query parameters
	useEffect(() => {
		const queryParams = new URLSearchParams(location.search);
		const profileId = queryParams.get('profileId');
		const applicationId = queryParams.get('application');

		// If there's a profileId, the user is coming from profile completion
		if (profileId) {
			setShowProfileCompletionMessage(true);
			// Remove the profile completion message after 5 seconds
			const timer = setTimeout(() => {
				setShowProfileCompletionMessage(false);
			}, 5000);

			return () => clearTimeout(timer);
		}

		// Handle application ID from query params
		if (applicationId) {
			console.log('Application ID from query params:', applicationId);

			// Check if this is a placeholder ID (will be fixed server-side soon)
			if (applicationId === 'placeholder') {
				console.warn(
					'Received placeholder application ID - this means the backend RLS policies need updating',
				);
				// Could display a message to the user or admin about this
			} else {
				// Store the application ID for document uploads
				setApplicationId(applicationId);
			}
		}
	}, [location]);

	useEffect(() => {
		setPageTitle('Documents');
		if (user) {
			fetchDocuments(user.id);
		}
	}, [user, fetchDocuments, setPageTitle]);

	useEffect(() => {
		console.log('Documents state changed:', documents);
	}, [documents]);

	// Add this effect to log applicationId changes
	useEffect(() => {
		if (applicationId) {
			console.log('Current application ID:', applicationId);
		}
	}, [applicationId]);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		accept: {
			'image/*': ['.jpeg', '.jpg', '.png'],
			'application/pdf': ['.pdf'],
		},
		maxSize: 5242880, // 5MB
		onDrop: (acceptedFiles) => {
			if (acceptedFiles.length > 0) {
				// Add accepted files to queue with current document type
				const newQueueItems = acceptedFiles.map((file) => ({
					file,
					documentType,
					isProcessing: false,
				}));

				setFileQueue((prev) => [...prev, ...newQueueItems]);
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

	// Remove file from queue
	const removeFromQueue = (index: number) => {
		setFileQueue((prev) => prev.filter((_, i) => i !== index));
	};

	// Update document type for a queued file
	const updateQueueItemType = (index: number, newType: string) => {
		setFileQueue((prev) =>
			prev.map((item, i) =>
				i === index ? { ...item, documentType: newType as any } : item,
			),
		);
	};

	// Process a single document
	const processDocument = async (queueItem: QueuedFile, index: number) => {
		if (!user) {
			showToast.error('No user found. Please log in again.');
			return;
		}

		if (!applicationId) {
			showToast.error('Application ID is missing. Please try again.');
			console.error('Missing application ID when processing document');
			return;
		}

		console.log('Processing document for application:', applicationId);

		// Update queue item status
		setFileQueue((prev) =>
			prev.map((item, i) =>
				i === index ? { ...item, isProcessing: true, error: undefined } : item,
			),
		);

		try {
			// Get OCR provider and process document
			const result = await documentService.analyzeDocument(
				queueItem.file,
				user.id,
			);

			// Prepare document data with explicit application ID
			const documentData = {
				user_id: user.id,
				application_id: applicationId,
				document_type: queueItem.documentType,
				file_name: queueItem.file.name,
				file_size: queueItem.file.size,
				notes: null,
				file_path: result.filePath || queueItem.file.name,
				verification_status: 'pending',
				file: queueItem.file,
				extracted_data: {
					text: result.content,
					file_name: queueItem.file.name,
					file_type: queueItem.file.type,
					file_size: queueItem.file.size,
					processed_at: new Date().toISOString(),
					application_id: applicationId, // Add applicationId here too
				},
			};

			console.log('Uploading document with data:', {
				type: documentData.document_type,
				application_id: documentData.application_id,
				file_name: documentData.file_name,
			});

			// Upload document to database
			await uploadDocument(documentData as any);

			// Update queue item as processed
			setFileQueue((prev) =>
				prev.map((item, i) =>
					i === index ? { ...item, isProcessing: false } : item,
				),
			);

			// Remove processed item from queue
			setTimeout(() => {
				setFileQueue((prev) => prev.filter((_, i) => i !== index));
			}, 1000);

			showToast.success(
				`Document ${queueItem.file.name} processed successfully!`,
			);

			// Refresh documents list
			await fetchDocuments(user.id);
		} catch (err) {
			console.error('Document processing error:', err);
			// Update queue item with error
			setFileQueue((prev) =>
				prev.map((item, i) =>
					i === index
						? {
								...item,
								isProcessing: false,
								error: 'Failed to process document',
						  }
						: item,
				),
			);
			showToast.error(
				`Failed to process ${queueItem.file.name}. Please try again.`,
			);
		}
	};

	// Process all queued documents
	const processAllDocuments = async () => {
		if (fileQueue.length === 0 || !user) return;

		setIsProcessing(true);
		const toastId = showToast.loading('Processing documents...');

		try {
			// Process each document in the queue sequentially
			for (let i = 0; i < fileQueue.length; i++) {
				await processDocument(fileQueue[i], i);
			}

			showToast.dismiss(toastId as any);
			showToast.success('All documents processed successfully!');
			setIsProcessing(false);

			// Clear the queue
			setFileQueue([]);
		} catch (err) {
			console.error('Batch processing error:', err);
			showToast.dismiss(toastId as any);
			showToast.error('Some documents failed to process. Please try again.');
			setIsProcessing(false);
		}
	};

	// Check which required documents are missing
	const checkRequiredDocuments = () => {
		// Only consider documents that are valid (within 30 days)
		const validDocs = documents.filter((doc) =>
			isDocumentValid(doc.created_at),
		);
		const uploadedTypes = validDocs.map((doc) =>
			doc.document_type.toLowerCase().replace(/[_\s-]/g, ''),
		);
		return REQUIRED_DOCUMENT_TYPES.filter((requiredType) => {
			const normRequired = requiredType.toLowerCase().replace(/[_\s-]/g, '');
			return !uploadedTypes.includes(normRequired);
		});
	};

	// Complete the application process
	const completeApplication = async (forceComplete = false) => {
		if (!applicationId || !user) {
			showToast.error('Missing application information');
			return;
		}

		console.log('Attempting to complete application:', applicationId);
		console.log('Document count:', documents.length);
		console.log(
			'Documents for this application:',
			documents.filter((doc) => doc.application_id === applicationId),
		);

		// Skip document check if forcing completion
		if (!forceComplete) {
			// Check for missing documents before API call
			const missingDocs = checkRequiredDocuments();
			if (missingDocs.length > 0) {
				showToast.error(
					`Missing documents: ${missingDocs
						.map((type) => getDocumentTypeLabel(type))
						.join(', ')}`,
				);
				return;
			}
		}

		setIsCompleting(true);
		const toastId = showToast.loading(
			forceComplete
				? 'Force completing application...'
				: 'Finalizing your application...',
		);

		try {
			// Check if we have all required document types
			const result = await completeApplicationWithDocuments(
				applicationId,
				REQUIRED_DOCUMENT_TYPES,
				forceComplete,
			);

			showToast.dismiss(toastId as any);

			if (result) {
				showToast.success(
					'Application submitted successfully! Login to view results.',
				);

				// Verify session is still active before navigating
				try {
					// Check if we still have a valid session
					const { data } = await supabase.auth.getSession();
					if (!data.session) {
						console.error('Session lost during application completion');
						// Refresh auth state before redirecting
						await useAuthStore.getState().checkAuth();
					}
				} catch (sessionError) {
					console.error('Error checking session:', sessionError);
				}

				// Navigate to dashboard
				navigate('/tenant/dashboard');
			} else {
				showToast.error(
					'Please upload all required documents before completing your application.',
				);
				setIsCompleting(false);
			}
		} catch (err) {
			console.error('Error completing application:', err);
			showToast.dismiss(toastId as any);
			showToast.error('Failed to complete application. Please try again.');
			setIsCompleting(false);
		}
	};

	// Update document type options to match database constraints
	const documentTypeOptions = [
		{ value: 'id_document', label: "ID/Driver's License/Passport" },
		{ value: 'bank_statement', label: '3 Months Bank Statement' },
		{ value: 'payslip', label: 'Recent Pay Slip' },
		{ value: 'other', label: 'Other' },
	];

	// Get label for document type
	const getDocumentTypeLabel = (type: string) => {
		return (
			documentTypeOptions.find((option) => option.value === type)?.label || type
		);
	};

	return (
		<div>
			<div className='mb-6'>
				<h1 className='text-2xl font-bold text-gray-900'>Document Upload</h1>
				<p className='text-gray-600 mt-1'>
					Upload and process your documents for verification
				</p>
			</div>

			{showProfileCompletionMessage && (
				<Alert variant='success' className='mb-6'>
					<CheckCircle className='h-5 w-5 mr-2' />
					<div>
						<p className='font-medium'>Profile completed successfully!</p>
						<p className='text-sm'>
							Now please upload your verification documents to complete your
							application.
						</p>
					</div>
				</Alert>
			)}

			{error && (
				<Alert variant='error' className='mb-6'>
					{error}
				</Alert>
			)}

			{/* Debug information - only shown in development */}
			{import.meta.env.VITE_NODE_ENV === 'development' && (
				<div className='bg-gray-100 p-3 rounded-lg mb-6 text-xs font-mono'>
					<h4 className='font-bold mb-1'>Debug Info:</h4>
					<div>Application ID: {applicationId || 'Not set'}</div>
					<div>Total Documents: {documents.length}</div>
					<div>
						Application Documents:{' '}
						{documents.filter((d) => d.application_id === applicationId).length}
					</div>
					<div>
						Doc Types:{' '}
						{documents
							.filter((d) => d.application_id === applicationId)
							.map((d) => d.document_type)
							.join(', ')}
					</div>
					<div>Missing Types: {checkRequiredDocuments().join(', ')}</div>

					<div className='mt-2 flex flex-wrap gap-2'>
						<Button
							size='sm'
							variant='outline'
							onClick={() =>
								navigate(
									`/tenant/screening-results?application=${applicationId}`,
								)
							}
							disabled={!applicationId}
						>
							Skip to Results
						</Button>
						<Button
							size='sm'
							variant='outline'
							onClick={() => navigate('/tenant/dashboard')}
						>
							Dashboard
						</Button>
						<Button
							size='sm'
							variant='outline'
							onClick={() => {
								if (applicationId) {
									// Log all docs for debugging
									console.log('All documents:', documents);
									console.log(
										'Documents with this application:',
										documents.filter((d) => d.application_id === applicationId),
									);
									console.log(
										'Document types:',
										documents
											.filter((d) => d.application_id === applicationId)
											.map((d) => d.document_type),
									);
								}
							}}
						>
							Log Docs
						</Button>
						<Button
							size='sm'
							variant='outline'
							className='bg-yellow-100'
							onClick={() => completeApplication(true)}
							disabled={!applicationId}
						>
							Force Complete
						</Button>
					</div>
				</div>
			)}

			<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
				{/* Upload Section */}
				<Card>
					<CardHeader>
						<h2 className='text-lg font-semibold'>Upload Documents</h2>
					</CardHeader>
					<CardContent>
						{/* <div className='mb-4'>
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
							<p className='text-sm text-gray-500 mt-1'>
								Select document type before uploading
							</p>
						</div> */}

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
								<p className='text-blue-500'>Drop the files here...</p>
							) : (
								<div>
									<p className='text-gray-600 mb-2'>
										Drag & drop files here, or click to select
									</p>
									<p className='text-sm text-gray-500'>
										Supported formats: JPG, PNG, PDF (max 5MB)
									</p>
								</div>
							)}
						</div>

						{/* Queued Files */}
						{fileQueue.length > 0 && (
							<div className='mt-4'>
								<div className='flex justify-between items-center mb-2'>
									<h3 className='font-medium'>Files to Process</h3>
									<Button
										variant='outline'
										size='sm'
										onClick={processAllDocuments}
										disabled={isProcessing}
									>
										{isProcessing ? (
											<>
												<Spinner size='sm' className='mr-2' />
												Processing...
											</>
										) : (
											<>
												<Upload size={16} className='mr-2' />
												Process All
											</>
										)}
									</Button>
								</div>
								<div className='space-y-3 max-h-60 overflow-y-auto'>
									{fileQueue.map((queueItem, index) => (
										<div
											key={`${queueItem.file.name}-${index}`}
											className='p-3 bg-gray-50 rounded-lg'
										>
											<div className='flex items-center justify-between'>
												<div className='flex items-center flex-grow mr-2'>
													<FileText className='h-5 w-5 text-blue-500 mr-2 flex-shrink-0' />
													<div className='min-w-0'>
														<p className='font-medium text-gray-900 truncate'>
															{queueItem.file.name}
														</p>
														<p className='text-xs text-gray-500'>
															{(queueItem.file.size / 1024).toFixed(1)} KB
														</p>
													</div>
												</div>
												<div className='flex items-center'>
													<Select
														value={queueItem.documentType}
														onValueChange={(value) =>
															updateQueueItemType(index, value)
														}
													>
														<SelectTrigger className='h-8 mr-2 px-2'>
															<SelectValue
																placeholder='Type'
																className='text-xs'
															/>
														</SelectTrigger>
														<SelectContent>
															{documentTypeOptions.map((option) => (
																<SelectItem
																	key={option.value}
																	value={option.value}
																>
																	{option.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
													<button
														onClick={() => removeFromQueue(index)}
														className='text-gray-500 hover:text-red-500 p-1'
														aria-label='Remove file'
													>
														<Trash2 size={16} />
													</button>
												</div>
											</div>
											{queueItem.isProcessing && (
												<div className='flex items-center mt-2 text-sm text-blue-600'>
													<Spinner size='sm' className='mr-2' />
													Processing...
												</div>
											)}
											{queueItem.error && (
												<div className='mt-2 text-sm text-red-600'>
													{queueItem.error}
												</div>
											)}
											<div className='mt-2'>
												<Button
													onClick={() => processDocument(queueItem, index)}
													variant='outline'
													size='sm'
													className='w-full'
													disabled={queueItem.isProcessing}
												>
													Process Document
												</Button>
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Document Status */}
				<Card>
					<CardHeader>
						<h2 className='text-lg font-semibold'>Required Documents</h2>
					</CardHeader>
					<CardContent>
						<div className='space-y-4'>
							{REQUIRED_DOCUMENT_TYPES.map((type) => {
								const validUploaded = documents.some(
									(doc) =>
										isDocumentValid(doc.created_at) &&
										doc.document_type
											.toLowerCase()
											.replace(/[_\s-]/g, '')
											.includes(type.toLowerCase().replace(/[_\s-]/g, '')),
								);
								return (
									<div
										key={type}
										className={`p-4 rounded-lg border ${
											validUploaded
												? 'border-green-200 bg-green-50'
												: 'border-gray-200 bg-gray-50'
										}`}
									>
										<div className='flex items-center'>
											{validUploaded ? (
												<CheckCircle className='h-5 w-5 text-green-500 mr-3 flex-shrink-0' />
											) : (
												<Plus className='h-5 w-5 text-gray-400 mr-3 flex-shrink-0' />
											)}
											<div>
												<p className='font-medium'>
													{getDocumentTypeLabel(type)}
												</p>
												<p className='text-sm text-gray-600'>
													{validUploaded ? 'Uploaded (Valid)' : 'Required'}
												</p>
											</div>
										</div>
									</div>
								);
							})}
						</div>

						{documents.length > 0 && (
							<div className='mt-6'>
								<Button
									onClick={() => completeApplication()}
									variant='primary'
									className='w-full'
									isLoading={isCompleting}
									disabled={isCompleting || checkRequiredDocuments().length > 0}
								>
									{checkRequiredDocuments().length > 0 ? (
										'Upload All Required Documents to Continue'
									) : (
										<>
											Complete Application{' '}
											<ChevronRight className='ml-2 h-4 w-4' />
										</>
									)}
								</Button>
								{checkRequiredDocuments().length > 0 && (
									<p className='text-sm text-orange-600 mt-2'>
										Missing required documents:{' '}
										{checkRequiredDocuments()
											.map((type) => getDocumentTypeLabel(type))
											.join(', ')}
									</p>
								)}
							</div>
						)}
					</CardContent>
				</Card>

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
															{getDocumentTypeLabel(doc.document_type)}
														</span>
													</div>
												</div>
											</div>
											<div className='flex items-center'>
												{doc.verification_status === 'pending' && (
													<span className='text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full mr-3'>
														Pending Verification
													</span>
												)}
												{doc.verification_status === 'verified' && (
													<span className='text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full mr-3'>
														Verified
													</span>
												)}
												<Button variant='outline' size='sm'>
													View
												</Button>
											</div>
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
		</div>
	);
};

export default DocumentUpload;
