import { supabase } from '@/services/supabase';
import { TenantProfile } from '@/types';
import { useRef } from 'react';

export const useTenantProfile = () => {
	// Cache for storing fetched profiles
	const profileCache = useRef<Map<string, TenantProfile>>(new Map());

	const fetchTenantProfile = async (userId: string) => {
		try {
			// Return cached result if available
			if (profileCache.current.has(userId)) {
				return profileCache.current.get(userId)!;
			}

			const { data, error } = await supabase
				.from('tenant_profiles')
				.select('*')
				.eq('tenant_id', userId)
				.limit(1);

			if (error) {
				console.error('Error fetching tenant profile:', error);
				return null;
			}

			if (data?.length) {
				const profile = data[0] as TenantProfile;
				// Update cache
				profileCache.current.set(userId, profile);
				return profile;
			}

			return null;
		} catch (error) {
			console.error('Error in fetchTenantProfile:', error);
			return null;
		}
	};

	return { fetchTenantProfile };
};
