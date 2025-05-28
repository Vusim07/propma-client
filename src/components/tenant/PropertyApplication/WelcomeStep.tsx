import { Button } from '@/components/ui/button';

interface WelcomeStepProps {
	onContinue: () => void;
}

export const WelcomeStep = ({ onContinue }: WelcomeStepProps) => (
	<div className='space-y-6 text-center py-2 md:py-6'>
		<h3 className='text-xl font-semibold mb-4'>Ready to Apply?</h3>
		<p className='text-gray-600 mb-6 md:mb-8 px-2 md:px-8'>
			You're about to start your application for this property. You'll need to
			create a free account or sign in to continue.
		</p>

		<div className='bg-gray-50 rounded-lg p-4 mb-6 text-left'>
			<h4 className='font-medium text-gray-800 mb-2'>Application Process</h4>
			<ol className='list-decimal pl-5 text-sm text-gray-600 space-y-2'>
				<li>
					<span className='font-medium'>Create Account/Sign In</span> - First,
					you'll need to authenticate
				</li>
				<li>
					<span className='font-medium'>Complete Profile</span> - Fill in your
					tenant information
				</li>
				<li>
					<span className='font-medium'>Upload Documents</span> - Provide
					verification documents
				</li>
				<li>
					<span className='font-medium'>Screening</span> - We'll review your
					application
				</li>
				<li>
					<span className='font-medium'>Results</span> - You'll receive a
					notification about your application status
				</li>
			</ol>
		</div>

		<div className='flex justify-center'>
			<Button
				className='w-full md:w-auto px-6 py-2 text-base'
				onClick={onContinue}
			>
				Continue with Application
			</Button>
		</div>
	</div>
);
