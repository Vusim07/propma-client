import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '../../../components/ui/form';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '../../../components/ui/select';
import { roleOptions } from '@/types/profileCompletionTypes';

export const RoleSelection = () => (
	<FormField
		name='role'
		render={({ field }) => (
			<FormItem className='border p-4 rounded-lg bg-gray-50'>
				<FormLabel className='text-lg font-medium'>I am a</FormLabel>
				<p className='text-sm text-gray-500 mb-2'>
					Choose your role in the property rental process
				</p>
				<FormControl>
					<Select value={field.value} onValueChange={field.onChange}>
						<SelectTrigger className='w-full'>
							<SelectValue placeholder='Select your role' />
						</SelectTrigger>
						<SelectContent>
							{roleOptions.map((role) => (
								<SelectItem key={role.value} value={role.value}>
									{role.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormControl>
				<FormMessage />
			</FormItem>
		)}
	/>
);
