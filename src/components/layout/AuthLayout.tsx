import React from 'react';
import { cn } from '../../lib/utils';
// import { Link } from 'react-router-dom';

interface AuthLayoutProps {
	children: React.ReactNode;
	title: string;
	subtitle?: string;
	className?: string;
	contentClassName?: string;
	wrapperClassName?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({
	children,
	className,
	contentClassName,
	wrapperClassName,
}) => {
	return (
		<div
			className={cn(
				'min-h-screen flex flex-col justify-center 	sm:px-6 lg:px-8',
				className,
			)}
		>
			<div className='sm:mx-auto sm:w-full sm:max-w-md'>
				<div className='flex justify-center'></div>
			</div>

			<div className={cn('sm:mx-auto sm:w-full sm:max-w-md', wrapperClassName)}>
				<div
					className={cn(
						'bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 max-h-screen ',
						contentClassName,
					)}
				>
					{children}
				</div>
			</div>
		</div>
	);
};

export default AuthLayout;
