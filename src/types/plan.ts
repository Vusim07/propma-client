export interface Plan {
	id: string;
	name: string;
	price: number;
	usage_limit: number;
	description: string;
	extra_usage: string | null;
	is_team_plan: boolean;
	is_paygo: boolean;
	max_team_size: number | null;
	popular: boolean;
	features: string[];
	price_per_screening?: string; // For paygo plans
	created_at?: string;
	updated_at?: string;
}
