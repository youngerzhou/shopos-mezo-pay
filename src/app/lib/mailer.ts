export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000'
  );
}

export function buildWelcomeLink(token: string) {
  return `${getBaseUrl()}/customer/welcome?token=${encodeURIComponent(token)}`;
}

export async function sendMail(message: MailMessage) {
  const provider = (process.env.EMAIL_PROVIDER || 'mock').toLowerCase();
  const from = process.env.EMAIL_FROM || 'ShopOS <no-reply@shopos.local>';

  if (provider === 'mock' || !process.env.SMTP_HOST) {
    console.log('[Mailer] Mock email send', {
      provider,
      from,
      to: message.to,
      subject: message.subject,
      text: message.text
    });
    return { ok: true, provider: 'mock' };
  }

  console.log('[Mailer] SMTP configuration detected; mock transport used in this build', {
    provider,
    from,
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    to: message.to,
    subject: message.subject
  });
  return { ok: true, provider: 'smtp-mock' };
}

export async function sendWelcomeEmail(input: {
  to: string;
  username?: string | null;
  welcomeToken: string;
}) {
  const welcomeLink = buildWelcomeLink(input.welcomeToken);
  const displayName = input.username?.trim() || 'there';
  const text = [
    `Welcome to ShopOS, ${displayName}.`,
    '',
    'Your new member account has received a 5 MUSD coupon for orders over 100 MUSD.',
    `Open your exclusive welcome link: ${welcomeLink}`
  ].join('\n');

  return sendMail({
    to: input.to,
    subject: 'Welcome to ShopOS',
    text,
    html: `
      <p>Welcome to ShopOS, ${displayName}.</p>
      <p>Your new member account has received a 5 MUSD coupon for orders over 100 MUSD.</p>
      <p><a href="${welcomeLink}">Open your exclusive welcome link</a></p>
    `
  });
}
