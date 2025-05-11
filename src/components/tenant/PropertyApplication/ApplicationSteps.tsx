// PropertyApplicationComponents/ApplicationSteps.tsx
import { Link } from 'react-router-dom';
import Button from '@/components/ui/Button';

export const ApplicationSteps = () => (
	<div className='flex flex-col sm:flex-row gap-4'>
		<Link to='/login' className='w-full sm:w-auto'>
			<Button className='w-full'>Login to your account</Button>
		</Link>
		<Link to='/' className='w-full sm:w-auto'>
			<Button variant='outline' className='w-full'>
				Go to homepage
			</Button>
		</Link>
	</div>
);
