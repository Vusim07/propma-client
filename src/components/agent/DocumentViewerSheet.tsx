import React, { useState, useEffect } from 'react';
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/alert';
import { supabase } from '@/services/supabase';
import { Tables } from '@/services/database.types';
import { ExternalLink } from 'lucide-react';

// Core viewer
import { Viewer, Worker } from '@react-pdf-viewer/core';
// Plugins
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface DocumentViewerSheetProps {
	document: Pick<
		Tables<'documents'>,
		'id' | 'file_name' | 'document_type' | 'file_path'
	> | null;
	trigger: React.ReactNode;
}

const DocumentViewerSheet: React.FC<DocumentViewerSheetProps> = ({
	document,
	trigger,
}) => {
	const [documentUrl, setDocumentUrl] = useState<string | null>(null);
	const [isLoadingUrl, setIsLoadingUrl] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const defaultLayoutPluginInstance = defaultLayoutPlugin(); // Initialize the plugin

	useEffect(() => {
		if (!isOpen) {
			setDocumentUrl(null);
			setError(null);
			setIsLoadingUrl(false);
		} else if (document?.file_path && isOpen) {
			const fetchUrl = async () => {
				setIsLoadingUrl(true);
				setError(null);
				setDocumentUrl(null);
				try {
					// Use createSignedUrl for private buckets

					const expiresIn = 60; // URL valid for 60 seconds
					const { data, error: signedUrlError } = await supabase.storage
						.from('tenant_documents')
						.createSignedUrl(document.file_path, expiresIn);

					if (signedUrlError) {
						console.error('Error creating signed URL:', signedUrlError);
						// Check for specific errors, e.g., RLS denial
						if (signedUrlError.message.includes('forbidden')) {
							throw new Error(
								'Access denied. You might not have permission to view this document based on the current policies.',
							);
						}
						throw new Error(
							`Failed to create signed URL: ${signedUrlError.message}`,
						);
					}

					if (!data?.signedUrl) {
						throw new Error('Signed URL could not be generated.');
					}

					setDocumentUrl(data.signedUrl);
				} catch (err: unknown) {
					console.error('Error in fetchUrl:', err);
					let message =
						'An unknown error occurred while fetching the document URL.';
					if (err instanceof Error) {
						message = err.message;
					}
					setError(message);
				} finally {
					setIsLoadingUrl(false);
				}
			};
			fetchUrl();
		} else if (isOpen && !document?.file_path) {
			setError(
				'Document not found. Try refreshing the page or contact support.',
			);
			setIsLoadingUrl(false);
		}
	}, [document?.file_path, document?.id, isOpen]);

	const isPdf = document?.file_name?.toLowerCase().endsWith('.pdf');
	const isImage = ['png', 'jpeg', 'jpg', 'webp', 'svg'].some((ext) =>
		document?.file_name?.toLowerCase().endsWith(`.${ext}`),
	);

	// Construct the worker URL - adjust path if needed based on your build setup
	const workerUrl = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`; // Updated version to match API

	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger asChild>{trigger}</SheetTrigger>

			<SheetContent className='sm:max-w-[80%] w-[95%] bg-white flex flex-col h-full'>
				<SheetHeader>
					<SheetTitle>
						Document Viewer: {document?.file_name ?? 'Loading...'}
					</SheetTitle>
					<SheetDescription>
						Viewing document{' '}
						<span className='font-medium'>{document?.file_name ?? 'N/A'}</span>.
						Type:{' '}
						<span className='font-medium capitalize'>
							{document?.document_type?.replace('_', ' ') ?? 'Unknown'}
						</span>
						.
						{documentUrl && (
							<a
								href={documentUrl}
								target='_blank'
								rel='noopener noreferrer'
								className='ml-2 inline-flex items-center text-blue-600 hover:underline text-sm'
							>
								Open in new tab <ExternalLink size={14} className='ml-1' />
							</a>
						)}
					</SheetDescription>
				</SheetHeader>
				<div className='py-4 flex-grow overflow-y-auto bg-gray-100'>
					{isLoadingUrl && (
						<div className='flex justify-center items-center h-full'>
							<Spinner />
							<span className='ml-2'>Loading document...</span>
						</div>
					)}
					{error && <Alert variant='destructive'>{error}</Alert>}
					{!isLoadingUrl && !error && documentUrl && (
						<div className='w-full h-full'>
							{isPdf ? (
								<Worker workerUrl={workerUrl}>
									<Viewer
										fileUrl={documentUrl}
										plugins={[defaultLayoutPluginInstance]} // Add the plugin instance here
										theme='light'
									/>
								</Worker>
							) : isImage ? (
								<div className='w-full h-full flex items-center justify-center bg-white'>
									<img
										src={documentUrl}
										alt={document?.file_name ?? 'Image Document'}
										className='max-w-full max-h-full object-contain'
									/>
								</div>
							) : (
								<Alert variant='default'>
									Cannot display preview for "
									{document?.file_name ?? 'this file'}". Unsupported file type.
									Try opening in a new tab.
								</Alert>
							)}
						</div>
					)}
					{!isLoadingUrl && !error && !documentUrl && isOpen && (
						<Alert variant='default'>
							Waiting for document URL or no document selected.
						</Alert>
					)}
				</div>
				<SheetFooter>
					<SheetClose asChild>
						<Button variant='outline'>Close</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
};

export default DocumentViewerSheet;
