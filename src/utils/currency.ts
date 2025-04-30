export const formatZAR = (amount: number): string => {
	return new Intl.NumberFormat('en-ZA', {
		style: 'currency',
		currency: 'ZAR',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
};
