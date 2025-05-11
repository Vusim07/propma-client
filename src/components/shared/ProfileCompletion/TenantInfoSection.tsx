import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { employmentStatusOptions } from '@/types/profileCompletionTypes';

export const TenantInfoSection = () => (
	<div className='space-y-4 border p-4 rounded-lg bg-blue-50'>
		<h3 className='font-medium text-blue-800'>Tenant Information</h3>

		<FormField
			name='tenant_id'
			render={({ field }) => (
				<FormItem className='hidden'>
					<FormLabel>Tenant ID (System Field)</FormLabel>
					<FormControl>
						<Input readOnly {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>

		<FormField
			name='id_number'
			render={({ field }) => (
				<FormItem>
					<FormLabel>ID Number</FormLabel>
					<FormControl>
						<Input placeholder='South African ID Number' {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>

		<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
			<FormField
				name='employment_status'
				render={({ field }) => (
					<FormItem>
						<FormLabel>Employment Status</FormLabel>
						<FormControl>
							<Select value={field.value} onValueChange={field.onChange}>
								<SelectTrigger className='w-full'>
									<SelectValue placeholder='Select your employment status' />
								</SelectTrigger>
								<SelectContent>
									{employmentStatusOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>

			<FormField
				name='monthly_income'
				render={({ field }) => (
					<FormItem>
						<FormLabel>Monthly Income (ZAR)</FormLabel>
						<FormControl>
							<Input
								type='number'
								placeholder='R 0.00'
								{...field}
								onChange={(e) => field.onChange(e.target.valueAsNumber)}
							/>
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>
		</div>

		<FormField
			name='employer'
			render={({ field }) => (
				<FormItem>
					<FormLabel>Current Employer</FormLabel>
					<FormControl>
						<Input placeholder='Company name' {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>

		<FormField
			name='employment_duration'
			render={({ field }) => (
				<FormItem>
					<FormLabel>Employment Duration (months)</FormLabel>
					<FormControl>
						<Input
							type='number'
							placeholder='0'
							{...field}
							onChange={(e) => field.onChange(e.target.valueAsNumber)}
						/>
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>

		<FormField
			name='current_address'
			render={({ field }) => (
				<FormItem>
					<FormLabel>Current Address</FormLabel>
					<FormControl>
						<Input placeholder='Your current residential address' {...field} />
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
	</div>
);
