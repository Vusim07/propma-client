import React from 'react';
import { Button } from './button';

interface VerifyEmailPromptProps {
	onResend?: () => void;
	email?: string;
	disabled?: boolean;
}

const VerifyEmailPrompt: React.FC<VerifyEmailPromptProps> = ({
	onResend,
	email,
	disabled = false,
}) => {
	return (
		<div className='bg-white border border-primary/65 rounded-lg p-6 text-center max-w-md mx-auto mt-10 shadow'>
			<h2 className='text-lg font-semibold text-dark_void mb-2'>
				Please verify your email address
			</h2>
			<p className='text-yellow-800 mb-4'>
				{email ? (
					<>
						We sent a verification link to{' '}
						<span className='font-medium'>{email}</span>.<br />
						Please check your inbox and click the link to activate your account.
					</>
				) : (
					<>
						We sent a verification link to your email. Please check your inbox
						and click the link to activate your account.
					</>
				)}
			</p>
			<Button
				variant='outline'
				onClick={onResend}
				className='mt-2'
				disabled={disabled}
			>
				Resend Verification Email
			</Button>
		</div>
	);
};

export default VerifyEmailPrompt;
