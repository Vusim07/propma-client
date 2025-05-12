import { supabase } from '../services/supabase';
import type { Plan } from '../types/plan';

class PlansService {
	async getAllPlans(): Promise<Plan[]> {
		const { data, error } = await supabase
			.from('plans')
			.select('*')
			.order('price');

		if (error) throw error;
		return data as Plan[];
	}

	async getIndividualPlans(): Promise<Plan[]> {
		const { data, error } = await supabase
			.from('plans')
			.select('*')
			.eq('is_team_plan', false)
			.eq('is_paygo', false) // filter out paygo bundles
			.order('price');

		if (error) throw error;
		return data as Plan[];
	}

	async getTeamPlans(): Promise<Plan[]> {
		const { data, error } = await supabase
			.from('plans')
			.select('*')
			.eq('is_team_plan', true)
			.eq('is_paygo', false) // filter out paygo bundles
			.order('price');

		if (error) throw error;
		return data as Plan[];
	}

	async getPlanById(planId: string): Promise<Plan | null> {
		const { data, error } = await supabase
			.from('plans')
			.select('*')
			.eq('id', planId)
			.single();

		if (error) throw error;
		return data as Plan;
	}

	async getPaygoPlans(): Promise<Plan[]> {
		const { data, error } = await supabase
			.from('plans')
			.select('*')
			.eq('is_paygo', true)
			.order('price');
		if (error) throw error;
		return data as Plan[];
	}
}

export const plansService = new PlansService();
