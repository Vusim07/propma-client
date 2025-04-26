import { createClient } from '@supabase/supabase-js';
import { Database, TypedSupabaseClient } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Create the Supabase client with persistence explicitly enabled
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
	auth: {
		persistSession: true,
		storageKey: 'propma-auth-storage',
		autoRefreshToken: true,
		detectSessionInUrl: true,
	},
	global: {
		headers: {
			'X-Client-Info': 'propma-client',
		},
	},
}) as TypedSupabaseClient;

// Export a function to check if a user is authenticated
export const isAuthenticated = async () => {
	const { data } = await supabase.auth.getSession();
	return data?.session !== null;
};
