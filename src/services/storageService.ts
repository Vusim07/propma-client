import { supabase } from './supabase';

/**
 * Uploads a property image file to Supabase Storage.
 *
 * @param file The image file to upload.
 * @param userId The ID of the user uploading the file.
 * @param propertyId Optional ID of the property for organization.
 * @returns The public URL of the uploaded image.
 */
export const uploadPropertyImage = async (
	file: File,
	userId: string,
	propertyId?: string,
): Promise<string> => {
	if (!userId) throw new Error('User ID is required for upload.');

	const fileExt = file.name.split('.').pop();
	// Use propertyId if available for better organization, otherwise use timestamp/random string
	const fileName = `${
		propertyId ? `prop_${propertyId}` : `temp_${Date.now()}`
	}_${Math.random().toString(36).substring(2)}.${fileExt}`;
	// Organize by user ID -> properties -> property_id (if available) -> filename
	const filePath = `${userId}/properties/${
		propertyId ? `${propertyId}/` : ''
	}${fileName}`;

	// Ensure the 'property_images' bucket exists and has appropriate policies
	const { error: uploadError } = await supabase.storage
		.from('property_images') // Bucket name
		.upload(filePath, file, {
			cacheControl: '3600', // Cache for 1 hour
			upsert: false, // Don't overwrite existing files with the same name
		});

	if (uploadError) {
		console.error('Error uploading image:', uploadError);
		// Provide more specific error feedback if possible
		if (uploadError.message.includes('Bucket not found')) {
			throw new Error(
				"Storage bucket 'property_images' not found. Please ensure it's created in Supabase.",
			);
		}
		throw new Error(`Failed to upload image: ${uploadError.message}`);
	}

	// Get public URL (ensure bucket policy allows public reads)
	const { data: urlData } = supabase.storage
		.from('property_images')
		.getPublicUrl(filePath);

	if (!urlData?.publicUrl) {
		console.error('Could not get public URL for uploaded image:', filePath);
		throw new Error('Could not get public URL for uploaded image.');
	}

	return urlData.publicUrl;
};
