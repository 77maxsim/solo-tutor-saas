import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Classter Support <onboarding@resend.dev>';

function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

interface FeedbackReplyEmailParams {
  to: string;
  userName: string;
  feedbackType: string;
  originalMessage: string;
  adminResponse: string;
  adminName: string;
}

export async function sendFeedbackReplyEmail(params: FeedbackReplyEmailParams): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not configured');
    return { success: false, error: 'Email service not configured' };
  }

  const { to, userName, feedbackType, originalMessage, adminResponse, adminName } = params;

  const safeUserName = escapeHtml(userName || 'there');
  const safeOriginalMessage = escapeHtml(originalMessage);
  const safeAdminResponse = escapeHtml(adminResponse);
  const safeAdminName = escapeHtml(adminName);

  const typeLabel = feedbackType === 'help' ? 'Help Request' : 
                    feedbackType === 'feedback' ? 'Feedback' : 'Technical Support';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Response to Your ${typeLabel}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Classter</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Tutoring Management Platform</p>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="margin-top: 0;">Hi ${safeUserName},</p>
        
        <p>Thank you for reaching out. Our team has reviewed your ${typeLabel.toLowerCase()} and here's our response:</p>
        
        <div style="background: #f8fafc; border-left: 4px solid #6366f1; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0 0 5px 0; font-weight: 600; color: #6366f1; font-size: 12px; text-transform: uppercase;">Your Message</p>
          <p style="margin: 0; color: #64748b; font-style: italic;">${safeOriginalMessage}</p>
        </div>
        
        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0 0 5px 0; font-weight: 600; color: #22c55e; font-size: 12px; text-transform: uppercase;">Our Response</p>
          <p style="margin: 0; color: #333; white-space: pre-wrap;">${safeAdminResponse}</p>
        </div>
        
        <p style="color: #64748b; font-size: 14px;">Response from: <strong>${safeAdminName}</strong></p>
        
        <p>If you have any further questions or need additional assistance, please don't hesitate to reach out through the app.</p>
        
        <p style="margin-bottom: 0;">Best regards,<br><strong>The Classter Team</strong></p>
      </div>
      
      <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">This email was sent in response to your ${typeLabel.toLowerCase()} submitted through Classter.</p>
      </div>
    </body>
    </html>
  `;

  const text = `Hi ${userName || 'there'},

Thank you for reaching out. Our team has reviewed your ${typeLabel.toLowerCase()} and here's our response:

YOUR MESSAGE:
${originalMessage}

OUR RESPONSE:
${adminResponse}

Response from: ${adminName || 'Classter Support'}

If you have any further questions or need additional assistance, please don't hesitate to reach out through the app.

Best regards,
The Classter Team`;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Re: Your ${typeLabel} - Classter Support`,
      html,
      text,
    });

    if (error) {
      console.error('Resend email error:', error);
      return { success: false, error: error.message };
    }

    console.log(`📧 Email sent successfully to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
