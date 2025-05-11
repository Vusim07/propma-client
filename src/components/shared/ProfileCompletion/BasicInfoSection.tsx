import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '../@/components/ui/form';
import { Input } from '../@/components/ui/input';

export const BasicInfoSection = () => (
	<div className='grid grid-cols-2 gap-4'>
		<FormField
			name='firstName'
			render={({ field }) => (
				<FormItem>
					<FormLabel>First Name</FormLabel>
					<FormControl>
						<Input placeholder='John' {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
		<FormField
			name='lastName'
			render={({ field }) => (
				<FormItem>
					<FormLabel>Last Name</FormLabel>
					<FormControl>
						<Input placeholder='Doe' {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
	</div>
);
