/* eslint-disable @typescript-eslint/no-explicit-any */
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import DocumentViewerSheet from '@/components/agent/DocumentViewerSheet';
import { Button } from '@/components/ui/button';
import { FileText, Eye } from 'lucide-react';

interface DocumentAnalysisCardProps {
	documents: {
		id: string;
		file_name: string | null;
		created_at: string;
		file_size: number | null;
		document_type: string | null;
		file_path: string;
	}[];
}

const DocumentAnalysisCard = ({ documents }: DocumentAnalysisCardProps) => {
	return (
		<Card>
			<CardHeader>
				<h2 className='text-lg font-semibold flex items-center'>
					<FileText className='h-5 w-5 text-dusty_grey mr-2' />
					Document Analysis
					<span className='ml-2 text-xs text-gray-500 font-normal'>
						({documents.length} document{documents.length === 1 ? '' : 's'})
					</span>
				</h2>
			</CardHeader>
			<CardContent>
				{documents.length > 0 ? (
					<div className='space-y-4'>
						{documents.map((doc) => (
							<div
								key={doc.id}
								className='border border-gray-200 rounded-lg overflow-hidden'
							>
								<div className='bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2'>
									<div className='flex items-center flex-grow'>
										<FileText className='h-5 w-5 text-blue-500 mr-3 flex-shrink-0' />
										<div className='flex-grow'>
											<p className='font-medium text-sm'>
												{doc.file_name ?? 'Unknown File'}
											</p>
											<p className='text-xs text-gray-500'>
												{new Date(doc.created_at).toLocaleDateString()} •{' '}
												{doc.file_size
													? `${(doc.file_size / 1024).toFixed(1)} KB`
													: ''}{' '}
												•{' '}
												<span className='capitalize'>
													{doc.document_type?.replace('_', ' ') ??
														'Unknown Type'}
												</span>
											</p>
										</div>
									</div>
									<DocumentViewerSheet
										document={doc as any}
										trigger={
											<Button variant='outline' size='sm'>
												<Eye size={16} className='mr-1.5' />
												View Document
											</Button>
										}
									/>
								</div>
							</div>
						))}
					</div>
				) : (
					<Alert variant='default'>No documents found for this tenant.</Alert>
				)}
			</CardContent>
		</Card>
	);
};

export default DocumentAnalysisCard;
