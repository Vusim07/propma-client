/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useTenantProfile } from './useTenantProfile';

export const useSessionCheck = (form: any, user: any) => {
	const [session, setSession] = useState<any>(null);
	const [initialLoading, setInitialLoading] = useState(true);
	const navigate = useNavigate();
	const { fetchTenantProfile } = useTenantProfile();
	const hasInitialized = useRef(false);

	useEffect(() => {
		const checkSession = async () => {
			if (hasInitialized.current) return;

			const { data } = await supabase.auth.getSession();
			if (!data.session) {
				navigate('/login');
				return;
			}

			setSession(data.session);

			// Only initialize form if no existing values
			if (!form.formState.isDirty) {
				form.setValue('tenant_id', data.session.user?.id || '');

				// Initialize role only if not already set
				if (!form.getValues('role')) {
					const currentRole = user?.role === 'pending' ? 'tenant' : user?.role;
					const finalRole =
						currentRole ||
						data.session.user?.user_metadata?.role ||
						localStorage.getItem('userRole') ||
						'tenant';
					form.setValue('role', finalRole);
				}

				if (user) {
					form.setValue('firstName', user.first_name || '');
					form.setValue('lastName', user.last_name || '');
					form.setValue('phone', user.phone || '');
					form.setValue('companyName', user.company_name || '');

					if (user.role === 'tenant' && user.email) {
						const tenantData = await fetchTenantProfile(user.email);
						if (tenantData) {
							form.setValue('id_number', tenantData.id_number || '');
							form.setValue(
								'employment_status',
								tenantData.employment_status || '',
							);
							form.setValue(
								'monthly_income',
								tenantData.monthly_income || undefined,
							);
							form.setValue(
								'current_address',
								tenantData.current_address || '',
							);
							form.setValue('employer', tenantData.employer || '');
							form.setValue(
								'employment_duration',
								tenantData.employment_duration || undefined,
							);
						}
					}
				} else {
					const authUser = data.session.user;
					if (authUser?.user_metadata) {
						const fullName = authUser.user_metadata.full_name || '';
						const nameParts = fullName.split(' ');
						form.setValue('firstName', nameParts[0] || '');
						form.setValue('lastName', nameParts.slice(1).join(' ') || '');
						form.setValue('phone', authUser.phone || '');

						if (authUser.email && form.getValues('role') === 'tenant') {
							const tenantData = await fetchTenantProfile(authUser.email);
							if (tenantData) {
								form.setValue('id_number', tenantData.id_number || '');
								form.setValue(
									'employment_status',
									tenantData.employment_status || '',
								);
								form.setValue(
									'monthly_income',
									tenantData.monthly_income || undefined,
								);
								form.setValue(
									'current_address',
									tenantData.current_address || '',
								);
								form.setValue('employer', tenantData.employer || '');
								form.setValue(
									'employment_duration',
									tenantData.employment_duration || undefined,
								);
							}
						}
					}
				}
			}

			hasInitialized.current = true;
			setInitialLoading(false);
		};

		checkSession();
	}, [navigate, form, user, fetchTenantProfile]);

	return { session, initialLoading };
};
