import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export async function sendEmail({ to, subject, html, text, replyTo }: SendArgs): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('[DEV] Email skipped (SENDGRID_API_KEY not set):', { to, subject });
    console.log(text || html.replace(/<[^>]+>/g, ''));
    return;
  }
  const from = {
    email: process.env.SENDGRID_FROM_EMAIL!,
    name: process.env.SENDGRID_FROM_NAME || '40-Day Fast',
  };
  await sgMail.send({ to, from, subject, html, text: text || html.replace(/<[^>]+>/g, ' '), replyTo });
}

export async function sendMagicLinkEmail(email: string, url: string): Promise<void> {
  const html = baseTemplate(`
    <h1 style="font-family: Georgia, serif; font-weight: 400; color: #1A1612;">Sign in</h1>
    <p>Click the button below to sign in. This link expires in 24 hours.</p>
    <p><a href="${url}" style="display:inline-block;padding:14px 24px;background:#4A5B36;color:#FBF8F3;text-decoration:none;border-radius:4px;">Sign in</a></p>
    <p style="color:#6B5F52;font-size:13px;">If you didn't request this, you can ignore the email.</p>
  `);
  await sendEmail({
    to: email,
    subject: 'Your sign-in link',
    html,
  });
}

export function baseTemplate(inner: string): string {
  return `<!doctype html>
<html><body style="margin:0;background:#FBF8F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF8F3;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #EDE4D0;">
        <tr><td style="padding:40px 32px;color:#1A1612;line-height:1.6;font-size:16px;">
          ${inner}
        </td></tr>
      </table>
      <p style="color:#A89A8A;font-size:12px;margin-top:16px;">Sent by 40-Day Fast</p>
    </td></tr>
  </table>
</body></html>`;
}

/** Build the special reply-to address for an experience follow-up email. */
export function experienceReplyTo(token: string): string {
  const domain = process.env.INBOUND_EMAIL_DOMAIN;
  if (!domain) return process.env.SENDGRID_FROM_EMAIL!;
  return `experience+${token}@${domain}`;
}
