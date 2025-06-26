import { Resend } from 'resend';

const resend = new Resend(import.meta.env.VITE_RESEND_API_KEY);

export async function sendOnboardingEmail({
	to,
	firstName,
}: {
	to: string;
	firstName?: string;
}) {
	const subject = 'Welcome to Amara!';
	const html = `
    <div style="background:#F8F5EF;padding:40px 0;width:100%;font-family:Arial,sans-serif;">
      <table style="max-width:520px;margin:0 auto;background:#fff;border-radius:18px;box-shadow:0 4px 24px rgba(30,41,59,0.08);overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(90deg,#151419 0%,#1B1B1E 100%);padding:40px 0;text-align:center;position:relative;">
            <div style="width:128px;height:48px;margin:0 auto 12px auto;background:rgba(255,255,255,0.08);border-radius:12px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);">
              <span style="color:#FFFFFF;font-weight:700;font-size:28px;letter-spacing:2px;font-family:Arial,sans-serif;">AMARA</span>
            </div>
            <div style="width:64px;height:4px;background:linear-gradient(90deg,#7F9DFF,#FC7557);margin:0 auto;border-radius:2px;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 24px 40px;">
            <h1 style="color:#222222;font-size:28px;font-weight:700;margin:0 0 16px 0;line-height:1.2;">Welcome to Amara, ${firstName ? firstName : 'there'}! 🎉</h1>
            <div style="width:48px;height:4px;background:linear-gradient(90deg,#7F9DFF,#FC7557);border-radius:2px;margin-bottom:20px;"></div>
            <p style="color:#878787;font-size:17px;line-height:1.7;margin:0 0 18px 0;">Your account has been created successfully! We're thrilled to help you streamline your property management and tenant screening process.</p>
            <div style="background:#FBFBFB;border-left:4px solid #7F9DFF;border-radius:12px;padding:24px 24px 18px 24px;margin-bottom:24px;">
              <h3 style="font-weight:600;color:#151419;margin:0 0 12px 0;font-size:16px;display:flex;align-items:center;"><span style="display:inline-block;width:8px;height:8px;background:#7F9DFF;border-radius:50%;margin-right:10px;"></span>Let's get you started:</h3>
              <ul style="margin:0 0 0 18px;padding:0;color:#262626;font-size:15px;line-height:1.7;">
                <li style="margin-bottom:10px;">Navigate to Properties to load your current vacancies.</li>
                <li style="margin-bottom:10px;">Go to Appointments to integrate your calendar.</li>
                <li style="margin-bottom:10px;">From the header or Inbox, copy your Amara email address and use it for contact forms on your website or property listings sites.</li>
                <li style="margin-bottom:10px;">If you need assistance setting up, feel free to reach out to our support team via the live chat.</li>
              </ul>
            </div>
            <div style="text-align:center;margin:32px 0;">
              <a href="https://app.agentamara.com/login" style="background:linear-gradient(90deg,#FC7557,#7F9DFF);color:#fff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:17px;font-weight:600;display:inline-block;transition:background 0.2s;">Go to Dashboard &rarr;</a>
            </div>
            <div style="background:linear-gradient(90deg,#F8F5EF,#FBFBFB);border-radius:12px;padding:18px 24px;margin-bottom:18px;border:1px solid #7F9DFF;text-align:center;">
              <p style="font-size:15px;color:#878787;margin:0;line-height:1.6;"><span style="font-weight:500;color:#151419;">Need help?</span><br/>Reply to this email or contact our support team.<br/>We're here to help you succeed! 💪</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#F8F5EF;padding:24px 40px;text-align:center;color:#878787;font-size:13px;border-top:1px solid #7F9DFF;">
            &copy; ${new Date().getFullYear()} Amara. All rights reserved.<br/>
            <a href="https://agentamara.com" style="color:#7F9DFF;text-decoration:underline;">agentamara.com</a>
          </td>
        </tr>
      </table>
    </div>
  `;
	try {
		await resend.emails.send({
			from: 'Amara <no-reply@n.agentamara.com>',
			to: [to],
			replyTo: 'Amara Support <support@agentamara.com>',
			subject,
			html,
		});
	} catch {
		// Log error to monitoring service or backend
		// Optionally, surface a user-friendly error if needed
		throw new Error('Failed to send onboarding email');
	}
}
