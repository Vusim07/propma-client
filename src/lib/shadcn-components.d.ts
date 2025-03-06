// This file ensures TypeScript can resolve shadcn component imports

declare module '@/components/ui/*' {
	const Component: any;
	export default Component;
	export * from '../../components/ui/*';
}

declare module '@/lib/utils' {
	export function cn(...inputs: any[]): string;
}
