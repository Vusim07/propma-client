import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Create the Supabase client with persistence explicitly enabled
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
	auth: {
		persistSession: true, // Ensure session persistence is explicitly enabled
		storageKey: 'propma-auth-storage', // Use a custom storage key
		autoRefreshToken: true, // Ensure tokens are refreshed automatically
		detectSessionInUrl: true, // Detect OAuth redirects
	},
	global: {
		// Add these headers to fix CORS issues and help with session persistence
		headers: {
			'X-Client-Info': 'propma-client',
		},
	},
});

// Export a function to check if a user is authenticated
export const isAuthenticated = async () => {
	const { data } = await supabase.auth.getSession();
	return data?.session !== null;
};
