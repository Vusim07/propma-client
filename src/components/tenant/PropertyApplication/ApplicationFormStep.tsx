import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface ApplicationFormData {
	employer: string;
	employment_duration: number;
	monthly_income: number;
	notes: string;
}

interface ApplicationFormStepProps {
	formData: ApplicationFormData;
	onFormChange: (data: ApplicationFormData) => void;
	onSubmit: (e: React.FormEvent) => void;
	submitting: boolean;
}

export const ApplicationFormStep = ({
	formData,
	onFormChange,
	onSubmit,
	submitting,
}: ApplicationFormStepProps) => (
	<form onSubmit={onSubmit} className='space-y-6'>
		<div className='bg-blue-50 p-4 rounded-md mb-6'>
			<p className='text-sm text-blue-800'>
				Please provide your employment and income details to complete your
				rental application. This information helps us assess affordability and
				suitability.
			</p>
			<p className='text-sm text-blue-800 mt-2'>
				After this step, you'll need to upload supporting documents to verify
				this information.
			</p>
		</div>

		<div className='space-y-4 md:space-y-6'>
			<div>
				<label
					htmlFor='employer'
					className='block text-sm font-medium text-gray-700 mb-1'
				>
					Current Employer
				</label>
				<Input
					id='employer'
					value={formData.employer}
					onChange={(e) =>
						onFormChange({ ...formData, employer: e.target.value })
					}
					className='w-full'
					placeholder='Company name'
					required
				/>
			</div>

			<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
				<div>
					<label
						htmlFor='employment_duration'
						className='block text-sm font-medium text-gray-700 mb-1'
					>
						Employment Duration (months)
					</label>
					<Input
						id='employment_duration'
						type='number'
						min='0'
						value={formData.employment_duration}
						onChange={(e) => {
							const value =
								e.target.value === '' ? 0 : parseInt(e.target.value, 10);
							onFormChange({
								...formData,
								employment_duration: isNaN(value) ? 0 : value,
							});
						}}
						className='w-full'
						placeholder='0'
						required
					/>
				</div>

				<div>
					<label
						htmlFor='monthly_income'
						className='block text-sm font-medium text-gray-700 mb-1'
					>
						Monthly Income (ZAR)
					</label>
					<Input
						id='monthly_income'
						type='number'
						min='0'
						value={formData.monthly_income}
						onChange={(e) => {
							const value =
								e.target.value === '' ? 0 : parseInt(e.target.value, 10);
							onFormChange({
								...formData,
								monthly_income: isNaN(value) ? 0 : value,
							});
						}}
						className='w-full'
						placeholder='0'
						required
					/>
					<p className='text-xs text-gray-500 mt-1'>
						This helps us determine if the property is within your affordability
						range
					</p>
				</div>
			</div>

			<div>
				<label
					htmlFor='notes'
					className='block text-sm font-medium text-gray-700 mb-1'
				>
					Additional Notes (optional)
				</label>
				<Textarea
					id='notes'
					className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
					rows={3}
					value={formData.notes}
					onChange={(e) => onFormChange({ ...formData, notes: e.target.value })}
					placeholder='Any additional information that might help your application'
				/>
			</div>
		</div>

		<div className='pt-6 md:pt-8'>
			<Button type='submit' className='w-full' isLoading={submitting}>
				Next: Upload Documents
			</Button>
		</div>
	</form>
);
