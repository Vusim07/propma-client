// Run this using the Supabase CLI to debug the auth hooks
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
	process.env.SUPABASE_URL,
	process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function checkAuthHooks() {
	try {
		// List all triggers in the database
		const { data: triggers, error } = await supabase.rpc('list_triggers');

		if (error) {
			console.error('Error fetching triggers:', error);
			return;
		}

		console.log('Auth-related triggers:');
		const authTriggers = triggers.filter(
			(t) =>
				t.trigger_name.includes('auth') ||
				t.trigger_name.includes('user') ||
				t.event_object_table === 'auth.users',
		);

		console.table(authTriggers);

		// Check if the profiles table exists
		const { data: tables, error: tablesError } = await supabase.rpc(
			'list_tables',
		);

		if (tablesError) {
			console.error('Error fetching tables:', tablesError);
			return;
		}

		console.log('User-related tables:');
		console.table(
			tables.filter(
				(t) =>
					t.table_name.includes('user') || t.table_name.includes('profile'),
			),
		);
	} catch (error) {
		console.error('Script error:', error);
	}
}

checkAuthHooks();
