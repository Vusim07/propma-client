// PropertyApplicationComponents/ApplicationProgress.tsx
import { Home, User, FileText } from 'lucide-react';

interface ApplicationProgressProps {
	currentStep: string;
}

export const ApplicationProgress = ({
	currentStep,
}: ApplicationProgressProps) => (
	<div className='flex justify-between mb-6 relative px-4'>
		<div className='absolute top-4 left-0 right-0 h-1 bg-gray-200 -z-10'></div>

		<div
			className={`flex flex-col items-center relative ${
				currentStep === 'welcome' ||
				currentStep === 'auth' ||
				currentStep === 'loading'
					? 'text-blue-600'
					: 'text-gray-400'
			}`}
		>
			<div
				className={`w-8 h-8 rounded-full flex items-center justify-center ${
					currentStep === 'welcome'
						? 'bg-blue-600 text-white'
						: currentStep === 'auth' || currentStep === 'loading'
						? 'bg-blue-600 text-white'
						: 'bg-gray-200'
				}`}
			>
				<User size={16} />
			</div>
			<span className='text-xs mt-2'>
				{currentStep === 'welcome' ? 'Get Started' : 'Account'}
			</span>
		</div>

		<div
			className={`flex flex-col items-center relative ${
				currentStep === 'application' ? 'text-blue-600' : 'text-gray-400'
			}`}
		>
			<div
				className={`w-8 h-8 rounded-full flex items-center justify-center ${
					currentStep === 'application'
						? 'bg-blue-600 text-white'
						: currentStep === 'documents'
						? 'bg-green-500 text-white'
						: 'bg-gray-200'
				}`}
			>
				<Home size={16} />
			</div>
			<span className='text-xs mt-2'>Application</span>
		</div>

		<div
			className={`flex flex-col items-center relative ${
				currentStep === 'documents' ? 'text-blue-600' : 'text-gray-400'
			}`}
		>
			<div
				className={`w-8 h-8 rounded-full flex items-center justify-center ${
					currentStep === 'documents' ? 'bg-blue-600 text-white' : 'bg-gray-200'
				}`}
			>
				<FileText size={16} />
			</div>
			<span className='text-xs mt-2'>Documents</span>
		</div>
	</div>
);
