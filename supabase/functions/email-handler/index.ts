/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from 'std/server';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: 'eu-north-1' });

serve(async (req) => {
	try {
		const { to, subject, htmlBody, textBody } = await req.json();

		const params = {
			Destination: {
				ToAddresses: [to],
			},
			Message: {
				Body: {
					Html: { Charset: 'UTF-8', Data: htmlBody },
					Text: { Charset: 'UTF-8', Data: textBody },
				},
				Subject: { Charset: 'UTF-8', Data: subject },
			},
			Source: 'noreply@n.agentamara.com',
		};

		const command = new SendEmailCommand(params);
		const response = await ses.send(command);

		return new Response(JSON.stringify({ messageId: response.MessageId }), {
			status: 200,
		});
	} catch (error) {
		console.error('SES Send Error:', error);
		return new Response(
			JSON.stringify({ error: 'Failed to send email', details: error.message }),
			{ status: 500 },
		);
	}
});
