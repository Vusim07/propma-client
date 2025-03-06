import React from 'react';
// import { Link } from 'react-router-dom';

interface AuthLayoutProps {
	children: React.ReactNode;
	title: string;
	subtitle?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
	return (
		<div className='min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
			<div className='sm:mx-auto sm:w-full sm:max-w-md'>
				<div className='flex justify-center'>
					{/* <Link to='/' className='flex items-center'>
						<img
							src='/assets/amara-logo-black.svg'
							alt='Amara Logo'
							className='h-8 w-auto'
						/>
					</Link> */}
				</div>
			</div>

			<div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
				<div className='bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10'>
					{children}
				</div>
			</div>
		</div>
	);
};

export default AuthLayout;
