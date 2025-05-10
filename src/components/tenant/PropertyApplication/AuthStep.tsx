// PropertyApplicationComponents/AuthStep.tsx
import AuthLayout from '@/components/layout/AuthLayout';
import { Login, Register } from '@/pages/tenant/PropertyApplication';

interface AuthStepProps {
	authStep: 'login' | 'register';
	onToggleAuthStep: () => void;
}

export const AuthStep = ({ authStep, onToggleAuthStep }: AuthStepProps) => (
	<div className='px-2 md:px-4'>
		<div className='bg-blue-50 p-4 rounded-md mb-6'>
			<p className='text-sm text-blue-800'>
				Please sign in or create an account to continue with your application.
				After signing in, you'll complete your tenant profile with required
				information.
			</p>
		</div>
		<AuthLayout
			title=''
			className='py-0 min-h-0'
			wrapperClassName='mt-0'
			contentClassName='py-4'
		>
			{authStep === 'login' ? (
				<>
					<Login />
					<p className='text-center mt-4'>
						<button
							onClick={onToggleAuthStep}
							className='text-blue-600 hover:text-blue-800 underline text-sm md:text-base px-4 py-2'
						>
							Don't have an account? Register here
						</button>
					</p>
				</>
			) : (
				<>
					<Register />
					<p className='text-center mt-4'>
						<button
							onClick={onToggleAuthStep}
							className='text-blue-600 hover:text-blue-800 underline text-sm md:text-base px-4 py-2'
						>
							Already have an account? Sign in
						</button>
					</p>
				</>
			)}
		</AuthLayout>
	</div>
);
