import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAgentStore } from '../../stores/agentStore';
import { usePageTitle } from '../../context/PageTitleContext';

import {
	Card,
	CardHeader,
	CardContent,
	CardFooter,
} from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import {
	Workflow,
	Mail,
	Plus,
	Trash2,
	Edit,
	Save,
	X,
	CheckCircle,
	ToggleLeft,
	ToggleRight,
	MessageSquare,
	Search,
	Clock,
} from 'lucide-react';
import { Tables } from '../../services/database.types';

interface WorkflowEmailFilter {
	subject_contains?: string[];
	body_contains?: string[];
}

interface WorkflowActions {
	send_application_link: boolean;
	custom_message?: string;
}

interface WorkflowViewModel {
	id: string;
	agent_id: string;
	name: string;
	is_active: boolean; // mapped from 'active' in database
	email_filter: WorkflowEmailFilter;
	actions: WorkflowActions;
	created_at: string;
	updated_at: string;
}

// Function to map DB type to view model type
const mapWorkflowToViewModel = (
	workflow: Tables<'email_workflows'>,
): WorkflowViewModel => {
	return {
		id: workflow.id,
		agent_id: workflow.agent_id,
		name: workflow.name,
		is_active: workflow.active,
		email_filter: (workflow.email_filter || {}) as WorkflowEmailFilter,
		actions: (workflow.actions || {
			send_application_link: true,
		}) as WorkflowActions,
		created_at: workflow.created_at,
		updated_at: workflow.updated_at,
	};
};

const WorkflowManagement: React.FC = () => {
	const { user } = useAuthStore();
	const { setPageTitle } = usePageTitle();

	const {
		workflows,
		workflowLogs,
		fetchWorkflows,
		fetchWorkflowLogs,
		createWorkflow,
		updateWorkflow,
		deleteWorkflow,
		isLoading,
		error,
	} = useAgentStore();

	const [isCreating, setIsCreating] = useState(false);
	const [isEditing, setIsEditing] = useState<string | null>(null);
	const [success, setSuccess] = useState('');

	// Form state
	const [name, setName] = useState('');
	const [subjectFilters, setSubjectFilters] = useState('');
	const [bodyFilters, setBodyFilters] = useState('');
	const [sendApplicationLink, setSendApplicationLink] = useState(true);
	const [customMessage, setCustomMessage] = useState('');

	const [currentWorkflows, setCurrentWorkflows] = useState<WorkflowViewModel[]>(
		[],
	);

	useEffect(() => {
		setPageTitle('Workflows & Automation');
		if (user) {
			// Add try-catch to handle missing table gracefully
			const loadWorkflows = async () => {
				try {
					await fetchWorkflows(user.id);
					await fetchWorkflowLogs();
				} catch (err) {
					console.error('Error loading workflows:', err);
					// No need to do anything special, the error state will be set by the store
				}
			};

			loadWorkflows();
		}
	}, [user, fetchWorkflows, fetchWorkflowLogs, setPageTitle]);

	useEffect(() => {
		// Transform workflows to view model format
		const viewModels = workflows.map(mapWorkflowToViewModel);
		setCurrentWorkflows(viewModels);
	}, [workflows]);

	const resetForm = () => {
		setName('');
		setSubjectFilters('');
		setBodyFilters('');
		setSendApplicationLink(true);
		setCustomMessage('');
	};

	const handleCreateWorkflow = async () => {
		if (!name || (!subjectFilters && !bodyFilters)) {
			return;
		}

		try {
			await createWorkflow({
				agent_id: user?.id || '',
				name,
				trigger_event: 'email_received', // Add this field
				email_template: '', // Add this field
				active: true, // Map to is_active
				email_filter: {
					subject_contains: subjectFilters.split(',').map((s) => s.trim()),
					body_contains: bodyFilters.split(',').map((s) => s.trim()),
				},
				actions: {
					send_application_link: sendApplicationLink,
					custom_message: customMessage,
				},
			});

			setSuccess('Workflow created successfully');
			setIsCreating(false);
			resetForm();

			// Clear success message after 3 seconds
			setTimeout(() => setSuccess(''), 3000);
		} catch (err) {
			console.error('Error creating workflow:', err);
		}
	};

	const handleEditWorkflow = (workflow: WorkflowViewModel) => {
		setIsEditing(workflow.id);
		setName(workflow.name);
		setSubjectFilters(workflow.email_filter.subject_contains?.join(', ') || '');
		setBodyFilters(workflow.email_filter.body_contains?.join(', ') || '');
		setSendApplicationLink(workflow.actions.send_application_link);
		setCustomMessage(workflow.actions.custom_message || '');
	};

	const handleUpdateWorkflow = async (id: string) => {
		if (!name || (!subjectFilters && !bodyFilters)) {
			return;
		}

		try {
			await updateWorkflow(id, {
				name,
				email_filter: {
					subject_contains: subjectFilters.split(',').map((s) => s.trim()),
					body_contains: bodyFilters.split(',').map((s) => s.trim()),
				},
				actions: {
					send_application_link: sendApplicationLink,
					custom_message: customMessage,
				},
				active: currentWorkflows.find((w) => w.id === id)?.is_active,
			});

			setSuccess('Workflow updated successfully');
			setIsEditing(null);
			resetForm();

			// Clear success message after 3 seconds
			setTimeout(() => setSuccess(''), 3000);
		} catch (err) {
			console.error('Error updating workflow:', err);
		}
	};

	const handleDeleteWorkflow = async (id: string) => {
		if (window.confirm('Are you sure you want to delete this workflow?')) {
			try {
				await deleteWorkflow(id);
				setSuccess('Workflow deleted successfully');

				// Clear success message after 3 seconds
				setTimeout(() => setSuccess(''), 3000);
			} catch (err) {
				console.error('Error deleting workflow:', err);
			}
		}
	};

	const handleToggleWorkflowStatus = async (id: string, isActive: boolean) => {
		try {
			await updateWorkflow(id, { active: !isActive });
			setSuccess(
				`Workflow ${isActive ? 'deactivated' : 'activated'} successfully`,
			);

			// Clear success message after 3 seconds
			setTimeout(() => setSuccess(''), 3000);
		} catch (err) {
			console.error('Error toggling workflow status:', err);
		}
	};

	const cancelEdit = () => {
		setIsEditing(null);
		resetForm();
	};

	if (isLoading && workflows.length === 0) {
		return (
			<div className='flex justify-center items-center h-64'>
				<Spinner size='lg' />
			</div>
		);
	}

	return (
		<div>
			<div className='mb-6'>
				<p className='text-gray-600 mt-1'>
					Create and manage automated workflows for handling incoming email
					inquiries
				</p>
			</div>

			{error && (
				<Alert variant='error' className='mb-6'>
					{error.includes('relation') ? (
						<>
							<p>The required database tables haven't been set up yet.</p>
							<p className='mt-2'>
								Please contact your administrator to run the database setup.
							</p>
						</>
					) : (
						error
					)}
				</Alert>
			)}

			{success && (
				<Alert variant='success' className='mb-6'>
					{success}
				</Alert>
			)}

			{/* Create New Workflow Button */}
			{!isCreating && (
				<div className='mb-6'>
					<Button onClick={() => setIsCreating(true)}>
						<Plus size={16} className='mr-2' />
						Create New Workflow
					</Button>
				</div>
			)}

			{/* Create Workflow Form */}
			{isCreating && (
				<Card className='mb-6'>
					<CardHeader>
						<h2 className='text-lg font-semibold'>Create New Workflow</h2>
					</CardHeader>
					<CardContent>
						<div className='space-y-4'>
							<Input
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder='e.g., Property Inquiry Response'
							/>

							<div className='bg-gray-50 p-4 rounded-lg mb-4'>
								<h3 className='font-medium mb-3 flex items-center'>
									<Search className='h-5 w-5 text-blue-500 mr-2' />
									Email Filters
								</h3>
								<div className='space-y-4'>
									<Input
										value={subjectFilters}
										onChange={(e) => setSubjectFilters(e.target.value)}
										placeholder='e.g., property inquiry, available, interested in'
									/>
									<Input
										value={bodyFilters}
										onChange={(e) => setBodyFilters(e.target.value)}
										placeholder='e.g., looking for, interested in renting, availability'
									/>
								</div>
							</div>

							<div className='bg-gray-50 p-4 rounded-lg'>
								<h3 className='font-medium mb-3 flex items-center'>
									<MessageSquare className='h-5 w-5 text-blue-500 mr-2' />
									Actions
								</h3>
								<div className='space-y-4'>
									<div className='flex items-center'>
										<input
											type='checkbox'
											id='send-application-link'
											checked={sendApplicationLink}
											onChange={(e) => setSendApplicationLink(e.target.checked)}
											className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
										/>
										<label
											htmlFor='send-application-link'
											className='ml-2 block text-sm text-gray-900'
										>
											Send application link
										</label>
									</div>

									<Textarea
										label='Custom Message'
										value={customMessage}
										onChange={(e) => setCustomMessage(e.target.value)}
										placeholder='Thank you for your interest in our property. Please complete the application at the link below:'
										fullWidth
									/>
								</div>
							</div>
						</div>
					</CardContent>
					<CardFooter className='flex justify-end space-x-4'>
						<Button
							variant='secondary'
							onClick={() => {
								setIsCreating(false);
								resetForm();
							}}
						>
							Cancel
						</Button>
						<Button
							variant='primary'
							onClick={handleCreateWorkflow}
							isLoading={isLoading}
							disabled={!name || (!subjectFilters && !bodyFilters)}
						>
							Create Workflow
						</Button>
					</CardFooter>
				</Card>
			)}

			{/* Workflows List */}
			<div className='grid grid-cols-1 gap-6 mb-8'>
				{currentWorkflows.length > 0 ? (
					currentWorkflows.map((workflow) => (
						<Card key={workflow.id}>
							{isEditing === workflow.id ? (
								// Edit Workflow Form
								<>
									<CardHeader>
										<h2 className='text-lg font-semibold'>Edit Workflow</h2>
									</CardHeader>
									<CardContent>
										<div className='space-y-4'>
											<Input
												value={name}
												onChange={(e) => setName(e.target.value)}
												placeholder='e.g., Property Inquiry Response'
											/>

											<div className='bg-gray-50 p-4 rounded-lg mb-4'>
												<h3 className='font-medium mb-3 flex items-center'>
													<Search className='h-5 w-5 text-blue-500 mr-2' />
													Email Filters
												</h3>
												<div className='space-y-4'>
													<Input
														value={subjectFilters}
														onChange={(e) => setSubjectFilters(e.target.value)}
														placeholder='e.g., property inquiry, available, interested in'
													/>
													<Input
														value={bodyFilters}
														onChange={(e) => setBodyFilters(e.target.value)}
														placeholder='e.g., looking for, interested in renting, availability'
													/>
												</div>
											</div>

											<div className='bg-gray-50 p-4 rounded-lg'>
												<h3 className='font-medium mb-3 flex items-center'>
													<MessageSquare className='h-5 w-5 text-blue-500 mr-2' />
													Actions
												</h3>
												<div className='space-y-4'>
													<div className='flex items-center'>
														<input
															type='checkbox'
															id='edit-send-application-link'
															checked={sendApplicationLink}
															onChange={(e) =>
																setSendApplicationLink(e.target.checked)
															}
															className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
														/>
														<label
															htmlFor='edit-send-application-link'
															className='ml-2 block text-sm text-gray-900'
														>
															Send application link
														</label>
													</div>

													<Textarea
														label='Custom Message'
														value={customMessage}
														onChange={(e) => setCustomMessage(e.target.value)}
														placeholder='Thank you for your interest in our property. Please complete the application at the link below:'
														fullWidth
													/>
												</div>
											</div>
										</div>
									</CardContent>
									<CardFooter className='flex justify-end space-x-4'>
										<Button variant='secondary' onClick={cancelEdit}>
											Cancel
										</Button>
										<Button
											variant='primary'
											onClick={() => handleUpdateWorkflow(workflow.id)}
											isLoading={isLoading}
											disabled={!name || (!subjectFilters && !bodyFilters)}
										>
											<Save size={16} className='mr-2' />
											Save Changes
										</Button>
									</CardFooter>
								</>
							) : (
								// Workflow Display
								<>
									<CardHeader className='flex items-center justify-between'>
										<div className='flex items-center'>
											<Workflow className='h-5 w-5 text-blue-600 mr-2' />
											<h2 className='text-lg font-semibold'>{workflow.name}</h2>
										</div>
										<Badge variant={workflow.is_active ? 'success' : 'warning'}>
											{workflow.is_active ? 'Active' : 'Inactive'}
										</Badge>
									</CardHeader>
									<CardContent>
										<div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-4'>
											<div>
												<h3 className='text-sm font-medium text-gray-500 mb-2'>
													Email Filters
												</h3>
												<div className='bg-gray-50 p-3 rounded-lg'>
													{workflow.email_filter.subject_contains &&
														workflow.email_filter.subject_contains.length >
															0 && (
															<div className='mb-2'>
																<p className='text-xs text-gray-500'>
																	Subject Contains:
																</p>
																<div className='flex flex-wrap gap-1 mt-1'>
																	{workflow.email_filter.subject_contains.map(
																		(filter: string, index: number) => (
																			<span
																				key={index}
																				className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800'
																			>
																				{filter}
																			</span>
																		),
																	)}
																</div>
															</div>
														)}

													{workflow.email_filter.body_contains &&
														workflow.email_filter.body_contains.length > 0 && (
															<div>
																<p className='text-xs text-gray-500'>
																	Body Contains:
																</p>
																<div className='flex flex-wrap gap-1 mt-1'>
																	{workflow.email_filter.body_contains.map(
																		(filter: string, index: number) => (
																			<span
																				key={index}
																				className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800'
																			>
																				{filter}
																			</span>
																		),
																	)}
																</div>
															</div>
														)}
												</div>
											</div>

											<div>
												<h3 className='text-sm font-medium text-gray-500 mb-2'>
													Actions
												</h3>
												<div className='bg-gray-50 p-3 rounded-lg'>
													<div className='flex items-center mb-2'>
														{workflow.actions.send_application_link ? (
															<CheckCircle className='h-4 w-4 text-green-500 mr-2' />
														) : (
															<X className='h-4 w-4 text-red-500 mr-2' />
														)}
														<span className='text-sm'>
															{workflow.actions.send_application_link
																? 'Send application link'
																: 'Do not send application link'}
														</span>
													</div>

													{workflow.actions.custom_message && (
														<div>
															<p className='text-xs text-gray-500 mb-1'>
																Custom Message:
															</p>
															<p className='text-sm text-gray-700 bg-white p-2 rounded border border-gray-200'>
																{workflow.actions.custom_message}
															</p>
														</div>
													)}
												</div>
											</div>
										</div>

										<div className='flex items-center justify-between mt-4'>
											<div className='text-sm text-gray-500'>
												Created:{' '}
												{new Date(workflow.created_at).toLocaleDateString()}
											</div>
											<div className='flex space-x-2'>
												<Button
													variant='outline'
													size='sm'
													onClick={() =>
														handleToggleWorkflowStatus(
															workflow.id,
															workflow.is_active,
														)
													}
												>
													{workflow.is_active ? (
														<>
															<ToggleRight size={16} className='mr-1' />
															Deactivate
														</>
													) : (
														<>
															<ToggleLeft size={16} className='mr-1' />
															Activate
														</>
													)}
												</Button>
												<Button
													variant='outline'
													size='sm'
													onClick={() => handleEditWorkflow(workflow)}
												>
													<Edit size={16} className='mr-1' />
													Edit
												</Button>
												<Button
													variant='danger'
													size='sm'
													onClick={() => handleDeleteWorkflow(workflow.id)}
												>
													<Trash2 size={16} className='mr-1' />
													Delete
												</Button>
											</div>
										</div>
									</CardContent>
								</>
							)}
						</Card>
					))
				) : (
					<Card>
						<CardContent className='text-center py-8'>
							<Mail className='h-12 w-12 text-gray-300 mx-auto mb-4' />
							<p className='text-gray-500'>No workflows created yet</p>
							<p className='text-sm text-gray-400 mt-1'>
								Create a workflow to automate responses to property inquiries
							</p>
						</CardContent>
					</Card>
				)}
			</div>

			{/* Workflow Activity Logs */}
			<Card>
				<CardHeader>
					<h2 className='text-lg font-semibold'>Recent Workflow Activity</h2>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className='flex justify-center py-8'>
							<Spinner />
						</div>
					) : workflowLogs.length > 0 ? (
						<div className='overflow-x-auto'>
							<table className='min-w-full divide-y divide-gray-200'>
								<thead className='bg-gray-50'>
									<tr>
										<th
											scope='col'
											className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
										>
											Date & Time
										</th>
										<th
											scope='col'
											className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
										>
											Email
										</th>
										<th
											scope='col'
											className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
										>
											Action Taken
										</th>
										<th
											scope='col'
											className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
										>
											Status
										</th>
									</tr>
								</thead>
								<tbody className='bg-white divide-y divide-gray-200'>
									{workflowLogs.map((log) => (
										<tr key={log.id}>
											<td className='px-6 py-4 whitespace-nowrap'>
												<div className='flex items-center'>
													<Clock size={16} className='text-gray-400 mr-2' />
													<span className='text-sm text-gray-900'>
														{new Date(log.triggered_at).toLocaleString()}
													</span>
												</div>
											</td>
											<td className='px-6 py-4'>
												<div className='text-sm font-medium text-gray-900 truncate max-w-xs'>
													{log.email_subject}
												</div>
												<div className='text-sm text-gray-500'>
													From: {log.email_from}
												</div>
											</td>
											<td className='px-6 py-4 whitespace-nowrap'>
												<div className='text-sm text-gray-900'>
													{log.action_taken}
												</div>
											</td>
											<td className='px-6 py-4 whitespace-nowrap'>
												<Badge
													variant={
														log.status === 'success' ? 'success' : 'danger'
													}
												>
													{log.status}
												</Badge>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<div className='text-center py-8'>
							<Clock className='h-12 w-12 text-gray-300 mx-auto mb-4' />
							<p className='text-gray-500'>No workflow activity yet</p>
							<p className='text-sm text-gray-400 mt-1'>
								Activity will appear here once your workflows start processing
								emails
							</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
};

export default WorkflowManagement;
