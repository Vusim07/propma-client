// PropertyApplicationComponents/DocumentsStep.tsx
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import { FileText } from 'lucide-react';

interface DocumentsStepProps {
	applicationId: string;
}

export const DocumentsStep = ({ applicationId }: DocumentsStepProps) => {
	const navigate = useNavigate();

	return (
		<div className='space-y-6'>
			<div className='bg-blue-50 p-4 rounded-md mb-6'>
				<p className='text-sm text-blue-800'>
					Please upload the required documents to support your application. You
					must upload all required documents to finalize your application.
				</p>
				<ul className='text-sm text-blue-800 mt-2 pl-5 list-disc'>
					<li>Proof of Identity (ID/Passport/Driver's License)</li>
					<li>Proof of Income (Pay slips)</li>
					<li>Bank Statements (last 3 months)</li>
				</ul>
			</div>

			<div className='bg-gray-50 rounded-lg p-4 mb-6 text-left'>
				<h4 className='font-medium text-gray-800 mb-2'>
					Document Upload Process
				</h4>
				<ol className='list-decimal pl-5 text-sm text-gray-600 space-y-2'>
					<li>
						<span className='font-medium'>Upload Required Documents</span> - Add
						all needed verification documents
					</li>
					<li>
						<span className='font-medium'>Review Documents</span> - Ensure they
						are correctly labeled
					</li>
					<li>
						<span className='font-medium'>Complete Application</span> - Click
						the "Complete Application" button to finalize
					</li>
					<li>
						<span className='font-medium'>View Screening Results</span> - After
						submission, you'll see your screening results
					</li>
					<li>
						<span className='font-medium'>Schedule Appointment</span> - If you
						are pre-approved, you can go ahead and schedule a viewing
						appointment.
					</li>
				</ol>
			</div>

			<div className='text-center py-4'>
				<Button
					onClick={() =>
						navigate(`/tenant/documents?application=${applicationId}`)
					}
					className='w-full md:w-auto px-6'
				>
					<FileText size={16} className='mr-2' />
					Proceed to Document Upload
				</Button>
				<p className='mt-4 text-sm text-gray-500'>
					After you've uploaded your documents, you'll be able to complete your
					application and view your screening results.
				</p>
			</div>
		</div>
	);
};
