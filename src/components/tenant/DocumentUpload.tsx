import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { affordabilityService } from '@/services/affordabilityService';
import { useAuthStore } from '@/stores/authStore';
import Button from '@/components/ui/Button';

interface AffordabilityError extends Error {
	message: string;
	code?: string;
}

interface DocumentUploadProps {
	applicationId: string;
	tenantId: string;
	propertyId: string;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
	applicationId,
	tenantId,
	propertyId,
}) => {
	const navigate = useNavigate();
	const authStore = useAuthStore();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const completeApplication = async () => {
		try {
			setIsSubmitting(true);
			setError(null);

			// Log initial session state
			const { data: initialSessionData } = await supabase.auth.getSession();
			console.log(
				'[DocumentUpload] Initial session state before affordability analysis:',
				{
					hasSession: !!initialSessionData.session,
					expiresAt: initialSessionData.session?.expires_at,
					userId: initialSessionData.session?.user?.id,
					accessToken: initialSessionData.session?.access_token
						? 'present'
						: 'missing',
					refreshToken: initialSessionData.session?.refresh_token
						? 'present'
						: 'missing',
				},
			);

			// Trigger affordability analysis
			console.log('[DocumentUpload] Starting affordability analysis...');
			const affordabilityResponse =
				await affordabilityService.createAffordabilityAnalysis(
					applicationId,
					tenantId,
					propertyId,
				);

			// Log session state after affordability analysis
			const { data: postAnalysisSessionData } =
				await supabase.auth.getSession();
			console.log(
				'[DocumentUpload] Session state after affordability analysis:',
				{
					hasSession: !!postAnalysisSessionData.session,
					expiresAt: postAnalysisSessionData.session?.expires_at,
					userId: postAnalysisSessionData.session?.user?.id,
					accessToken: postAnalysisSessionData.session?.access_token
						? 'present'
						: 'missing',
					refreshToken: postAnalysisSessionData.session?.refresh_token
						? 'present'
						: 'missing',
				},
			);

			// Update application status
			console.log('[DocumentUpload] Updating application status...');
			const { error: updateError } = await supabase
				.from('applications')
				.update({
					status: 'screening_completed',
					screening_completed_at: new Date().toISOString(),
					affordability_analysis: affordabilityResponse,
				})
				.eq('id', applicationId);

			if (updateError) {
				console.error(
					'[DocumentUpload] Error updating application status:',
					updateError,
				);
				throw updateError;
			}

			// Log final session state before navigation
			const { data: finalSessionData } = await supabase.auth.getSession();
			console.log('[DocumentUpload] Final session state before navigation:', {
				hasSession: !!finalSessionData.session,
				expiresAt: finalSessionData.session?.expires_at,
				userId: finalSessionData.session?.user?.id,
				accessToken: finalSessionData.session?.access_token
					? 'present'
					: 'missing',
				refreshToken: finalSessionData.session?.refresh_token
					? 'present'
					: 'missing',
			});

			// Navigate to screening results
			console.log('[DocumentUpload] Navigating to screening results...');
			navigate(`/tenant/applications/${applicationId}/screening-results`);
		} catch (error) {
			console.error('[DocumentUpload] Error completing application:', error);

			const affordabilityError = error as AffordabilityError;

			// Check if error is due to session expiry
			if (
				affordabilityError.message?.includes('JWT expired') ||
				affordabilityError.message?.includes('Invalid token')
			) {
				console.log('[DocumentUpload] Session expired, logging out...');
				await authStore.logout();
				navigate('/login');
				return;
			}

			setError(affordabilityError.message || 'Failed to complete application');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div>
			<Button
				onClick={completeApplication}
				disabled={isSubmitting}
				isLoading={isSubmitting}
			>
				Complete Application
			</Button>
			{error && <div className='text-red-500 mt-2'>{error}</div>}
		</div>
	);
};
