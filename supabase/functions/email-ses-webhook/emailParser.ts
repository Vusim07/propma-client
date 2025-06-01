/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { GetObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.0.0';
import { s3Client } from './s3Client.ts';
import { decodeContent, stripHtml } from './utils.ts';
import { ParsedEmailContent } from './types.ts';

export async function parseEmailContent(
	bucket: string,
	key: string,
): Promise<ParsedEmailContent> {
	try {
		const command = new GetObjectCommand({
			Bucket: bucket,
			Key: key,
		});
		const response = await s3Client.send(command);
		if (!response.Body) {
			throw new Error('No email content received from S3');
		}
		const rawMessage = await response.Body.transformToString();

		// Use regex to split headers and body (handles both CRLF and LF)
		const headerBodySplit = rawMessage.split(/\r?\n\r?\n/, 2);
		const headerSection = headerBodySplit[0];
		const bodySection = headerBodySplit[1] || '';

		const headers: Record<string, string> = {};
		const headerLines = headerSection.split(/\r?\n/);
		let currentHeader = '';

		for (const line of headerLines) {
			if (line.startsWith(' ') || line.startsWith('\t')) {
				if (currentHeader) {
					headers[currentHeader] += ' ' + line.trim();
				}
			} else {
				const colonIndex = line.indexOf(':');
				if (colonIndex > 0) {
					const name = line.substring(0, colonIndex).trim();
					const value = line.substring(colonIndex + 1).trim();
					if (name && value) {
						currentHeader = name.toLowerCase();
						headers[currentHeader] = value;
					}
				}
			}
		}

		// Parse 'from' header to extract name and address
		if (headers['from']) {
			const match = headers['from'].match(/^(.*?)\s*<([^>]+)>/);
			if (match) {
				headers['from_name'] = match[1].trim().replace(/^["']|["']$/g, '');
				headers['from_address'] = match[2].trim();
			} else {
				headers['from_name'] = headers['from'];
				headers['from_address'] = headers['from'];
			}
		}

		const references = headers['references']?.split(/\s+/) || [];
		const inReplyTo = headers['in-reply-to'];
		const boundaryMatch = headerSection.match(/boundary="?([^";\s]+)"?/i);
		const boundary = boundaryMatch ? boundaryMatch[1] : null;

		let body = '';
		let htmlBody: string | null = null;
		const attachments: Array<{
			filename: string;
			contentType: string;
			content: Uint8Array;
		}> = [];

		if (boundary) {
			// Handle multipart messages
			const parts = bodySection.split(`--${boundary}`);

			for (const part of parts) {
				if (!part.trim() || part.trim().startsWith('--')) continue;

				const partSplit = part.split(/\r?\n\r?\n/, 2);
				const partHeaders = partSplit[0] || '';
				const partContent = partSplit[1] || '';

				if (!partContent.trim()) continue;

				const contentType =
					partHeaders
						.match(/Content-Type:\s*([^;\r\n]+)/i)?.[1]
						?.toLowerCase()
						?.trim() || '';

				const contentDisposition =
					partHeaders
						.match(/Content-Disposition:\s*([^;\r\n]+)/i)?.[1]
						?.toLowerCase()
						?.trim() || '';

				const filename = partHeaders.match(
					/filename[*]?="?([^";\r\n]+)"?/i,
				)?.[1];

				const encoding =
					partHeaders
						.match(/Content-Transfer-Encoding:\s*([^;\r\n]+)/i)?.[1]
						?.toLowerCase()
						?.trim() || '';

				const decodedContent = decodeContent(partContent.trim(), encoding);

				if (contentDisposition.includes('attachment') && filename) {
					// Handle attachment
					const content = new TextEncoder().encode(decodedContent);
					attachments.push({ filename, contentType, content });
				} else if (contentType.includes('text/plain')) {
					// Accumulate plain text parts
					if (decodedContent.trim()) {
						body += (body ? '\n\n' : '') + decodedContent;
					}
				} else if (contentType.includes('text/html')) {
					// Handle HTML part
					if (decodedContent.trim()) {
						htmlBody = decodedContent;
					}
				}
			}
		} else {
			// Handle single part message
			const contentType = headers['content-type']?.toLowerCase() || '';
			const encoding =
				headers['content-transfer-encoding']?.toLowerCase() || '';
			const decodedContent = decodeContent(bodySection.trim(), encoding);

			if (contentType.includes('text/html')) {
				htmlBody = decodedContent;
				body = stripHtml(htmlBody);
			} else {
				// Assume plain text if no content type specified
				body = decodedContent;
				// If this looks like HTML content, also set htmlBody
				if (/<[^>]+>/.test(body)) {
					htmlBody = body;
					body = stripHtml(htmlBody);
				}
			}
		}

		// Final fallback: if we have HTML but no plain text, or plain text is incomplete
		if ((!body.trim() || body.split('\n').length < 2) && htmlBody?.trim()) {
			body = stripHtml(htmlBody);
		}

		// Clean up the body text
		body = body.trim();

		return {
			body,
			htmlBody,
			hasAttachments: attachments.length > 0,
			rawMessage,
			attachments,
			headers,
			references,
			inReplyTo,
		};
	} catch (error) {
		console.error('Error fetching email content from S3:', error);
		return {
			body: '',
			htmlBody: null,
			hasAttachments: false,
			rawMessage: '',
			headers: {},
		};
	}
}
