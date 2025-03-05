import { createClient } from '@supabase/supabase-js';

// These would normally come from environment variables
// For this MVP, we're using placeholder values
const supabaseUrl = 'https://example.supabase.co';
const supabaseAnonKey = 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);