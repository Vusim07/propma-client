/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { S3Client } from 'https://esm.sh/@aws-sdk/client-s3@3.0.0';

export const s3Client = new S3Client({
	region: Deno.env.get('AWS_REGION') ?? 'eu-north-1',
	credentials: {
		accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') ?? '',
		secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? '',
	},
});
