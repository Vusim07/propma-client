import { useFormContext } from 'react-hook-form';
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '../../../components/ui/form';
import { Input } from '../../../components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '../../../components/ui/Select';
import { teamPlanOptions } from '@/types/profileCompletionTypes';

export const TeamSetupSection = () => {
	const { watch } = useFormContext();
	const isTeamSetup = watch('isTeamSetup');

	return (
		<div className='space-y-4 border p-4 rounded-lg bg-blue-50'>
			<h3 className='font-medium text-blue-800'>Organization Setup</h3>
			<p className='text-sm text-gray-600'>
				Choose how you want to manage properties
			</p>

			<FormField
				name='isTeamSetup'
				render={({ field }) => (
					<div className='space-y-3'>
						<div className='flex items-center space-x-2'>
							<input
								type='radio'
								id='individual'
								checked={!field.value}
								onChange={() => field.onChange(false)}
								className='h-4 w-4 text-blue-600'
							/>
							<label htmlFor='individual' className='text-sm font-medium'>
								Individual Account
							</label>
						</div>
						<div className='flex items-center space-x-2'>
							<input
								type='radio'
								id='team'
								checked={field.value}
								onChange={() => field.onChange(true)}
								className='h-4 w-4 text-blue-600'
							/>
							<label htmlFor='team' className='text-sm font-medium'>
								Team Account
							</label>
						</div>
					</div>
				)}
			/>

			{isTeamSetup && (
				<>
					<FormField
						name='teamName'
						render={({ field }) => (
							<FormItem>
								<FormLabel>Team Name</FormLabel>
								<FormControl>
									<Input placeholder='Enter team name' {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						name='teamPlanType'
						render={({ field }) => (
							<FormItem>
								<FormLabel>Plan Type</FormLabel>
								<Select
									onValueChange={field.onChange}
									value={field.value} // Changed from defaultValue
								>
									<FormControl>
										<SelectTrigger>
											<SelectValue placeholder='Select a plan' />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{teamPlanOptions.map((plan) => (
											<SelectItem key={plan.value} value={plan.value}>
												{plan.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>
				</>
			)}
		</div>
	);
};
