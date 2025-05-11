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

			if (!form.formState.isDirty) {
				form.setValue('tenant_id', data.session.user?.id || '');

				if (!form.getValues('role')) {
					const currentRole = user?.role === 'pending' ? 'tenant' : user?.role;
					const finalRole =
						currentRole || data.session.user?.user_metadata?.role || 'tenant';
					form.setValue('role', finalRole);
				}

				if (user) {
					form.setValue('firstName', user.first_name || '');
					form.setValue('lastName', user.last_name || '');
					form.setValue('phone', user.phone || '');
					form.setValue('companyName', user.company_name || '');

					// Only fetch tenant profile if role is tenant and we haven't already
					if (
						user.role === 'tenant' &&
						user.email &&
						!form.getValues('id_number')
					) {
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

						// Only set these values if post_profile_redirect is not present
						if (!sessionStorage.getItem('post_profile_redirect')) {
							form.setValue('firstName', nameParts[0] || '');
							form.setValue('lastName', nameParts.slice(1).join(' ') || '');
							form.setValue('phone', authUser.phone || '');
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
