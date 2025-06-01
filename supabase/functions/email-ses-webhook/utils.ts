/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';
import { SNSMessage } from './types.ts';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export function decodeContent(content: string, encoding: string): string {
	if (!encoding) return content;
	encoding = encoding.toLowerCase();

	if (encoding === 'base64') {
		try {
			return atob(content.replace(/\s/g, ''));
		} catch {
			return content;
		}
	} else if (encoding === 'quoted-printable') {
		return decodeQuotedPrintable(content);
	}
	return content;
}

function decodeQuotedPrintable(input: string): string {
	return (
		input
			// Handle soft line breaks (=\r\n or =\n)
			.replace(/=\r?\n/g, '')
			// Handle encoded characters (=XX where XX is hex)
			.replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => {
				const charCode = parseInt(hex, 16);
				return String.fromCharCode(charCode);
			})
			// Handle any remaining = at end of lines that might be malformed
			.replace(/=$/gm, '')
	);
}

export function stripHtml(html: string): string {
	// First decode any quoted-printable content
	const decoded = decodeQuotedPrintable(html);

	return (
		decoded
			// Replace common block elements with line breaks
			.replace(/<(br|div|p|h[1-6]|table|tr|td|th)[^>]*>/gi, '\n')
			.replace(/<\/(div|p|h[1-6]|table|tr|td|th)>/gi, '\n')
			// Remove all other HTML tags
			.replace(/<[^>]+>/g, '')
			// Decode HTML entities
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&amp;/g, '&')
			.replace(/&nbsp;/g, ' ')
			.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
			.replace(/&#x([a-fA-F0-9]+);/g, (_, hex) =>
				String.fromCharCode(parseInt(hex, 16)),
			)
			// Normalize whitespace
			.replace(/\n{3,}/g, '\n\n')
			.replace(/[ \t]+\n/g, '\n')
			.replace(/\s{2,}/g, ' ')
			.trim()
	);
}

export const delay = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

export async function retryOperation<T>(
	operation: () => Promise<T>,
	operationName: string,
	maxRetries: number = MAX_RETRIES,
): Promise<T> {
	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error as Error;
			console.warn(
				`Attempt ${attempt}/${maxRetries} failed for ${operationName}:`,
				error,
			);

			if (attempt < maxRetries) {
				const delayMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
				await delay(delayMs);
			}
		}
	}

	throw new Error(
		`Operation ${operationName} failed after ${maxRetries} attempts. Last error: ${lastError?.message}`,
	);
}

export async function verifySNSSignature(
	message: SNSMessage,
): Promise<boolean> {
	try {
		const certResponse = await fetch(message.SigningCertURL);
		if (!certResponse.ok) {
			throw new Error('Failed to fetch signing certificate');
		}
		const certText = await certResponse.text();

		let stringToSign = '';
		if (message.Type === 'Notification') {
			stringToSign = [
				'Message',
				'MessageId',
				'Subject',
				'Timestamp',
				'TopicArn',
				'Type',
			]
				.map((key) => `${key}\n${message[key as keyof SNSMessage]}\n`)
				.join('');
		} else if (
			message.Type === 'SubscriptionConfirmation' ||
			message.Type === 'UnsubscribeConfirmation'
		) {
			stringToSign = [
				'Message',
				'MessageId',
				'SubscribeURL',
				'Timestamp',
				'Token',
				'TopicArn',
				'Type',
			]
				.map((key) => `${key}\n${message[key as keyof SNSMessage]}\n`)
				.join('');
		}

		if (message.Type === 'SubscriptionConfirmation') {
			const certUrl = new URL(message.SigningCertURL);
			return (
				certUrl.hostname === 'sns.amazonaws.com' ||
				certUrl.hostname.endsWith('.sns.amazonaws.com')
			);
		}

		if (message.Type === 'Notification') {
			const certPem = certText
				.replace('-----BEGIN CERTIFICATE-----', '')
				.replace('-----END CERTIFICATE-----', '')
				.replace(/\s/g, '');

			const certBuffer = base64Encode(new TextEncoder().encode(certPem));

			const certKey = await crypto.subtle.importKey(
				'spki',
				certBuffer,
				{
					name: 'RSASSA-PKCS1-v1_5',
					hash: 'SHA-1',
				},
				false,
				['verify'],
			);

			const signature = base64Encode(
				await crypto.subtle.sign(
					{ name: 'RSASSA-PKCS1-v1_5' },
					certKey,
					new TextEncoder().encode(stringToSign),
				),
			);

			return signature === message.Signature;
		}

		return false;
	} catch (error) {
		console.error('Error verifying SNS signature:', error);
		return false;
	}
}
