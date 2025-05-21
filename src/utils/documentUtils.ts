/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '../services/supabase';
import { Json } from '../services/database.types';
import { Transaction } from '../services/affordabilityService';

/**
 * Fetch and format transactions from bank statement documents
 */
export const getTransactionsFromDocuments = async (
	documents: Array<{ id: string; extracted_data: Json }>,
): Promise<Transaction[]> => {
	const transactions: Transaction[] = [];

	for (const doc of documents) {
		if (doc.extracted_data && typeof doc.extracted_data === 'object') {
			// Try to get transactions array directly
			const extractedData = doc.extracted_data as Record<string, unknown>;
			const transactionsArray = extractedData.transactions as any[];

			if (Array.isArray(transactionsArray)) {
				transactions.push(
					...transactionsArray.map((t) => ({
						description: String(t.description || ''),
						amount: Number(t.amount || 0),
						date: String(t.date || ''),
						type: String(t.type || 'unknown'),
					})),
				);
			}
		}
	}

	return transactions;
};

/**
 * Fetch documents by type and filters
 */
export const fetchDocuments = async (
	userId: string,
	documentType: string,
	applicationId?: string,
) => {
	let query = supabase
		.from('documents')
		.select('*')
		.eq('user_id', userId)
		.eq('document_type', documentType);

	if (applicationId) {
		query = query.eq('application_id', applicationId);
	}

	const { data: documents, error } = await query;

	if (error) throw error;

	return documents || [];
};
