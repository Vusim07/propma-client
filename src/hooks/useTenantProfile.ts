import { supabase } from '@/services/supabase';
import { TenantProfile } from '@/types';

export const useTenantProfile = () => {
	const fetchTenantProfile = async (email: string) => {
		try {
			const { data, error } = await supabase
				.from('tenant_profiles')
				.select('*')
				.eq('email', email);

			if (error) {
				console.error('Error fetching tenant profile:', error);
				return null;
			}

			if (data && data.length > 0) {
				console.log(
					`Found ${data.length} profile(s) for email: ${email}, using the first one`,
				);
				return data[0] as unknown as TenantProfile;
			}

			return null;
		} catch (error) {
			console.error('Error in fetchTenantProfile:', error);
			return null;
		}
	};

	return { fetchTenantProfile };
};
