import nodemailer from 'nodemailer';



interface SendOtpParams {
  to: string;
  name?: string;
  otp: string;
  expiresInMinutes?: number;
}

interface MailResult {
  success: boolean;
  messageId?: string;
  devMode?: boolean;
  previewCode?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Sender Address Resolver
// ---------------------------------------------------------------------------
export function getSenderAddress(): string {
  const configuredFrom = process.env.SMTP_FROM?.trim();
  const user = process.env.SMTP_USER?.trim() || 'noreply@flowsync.app';

  // Gmail SMTP strictly rejects or spam-flags emails where "From" claims to be an unverified
  // domain like flowsync.app. When using Gmail SMTP, default to "FlowSync <user@gmail.com>".
  if (process.env.SMTP_HOST?.toLowerCase().includes('gmail') && user.includes('@')) {
    if (!configuredFrom || configuredFrom.includes('flowsync.app') || !configuredFrom.includes(user)) {
      return `"FlowSync" <${user}>`;
    }
  }

  return configuredFrom || `"FlowSync" <${user}>`;
}

// ---------------------------------------------------------------------------
// Transporter Factory
// ---------------------------------------------------------------------------
function getSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
    // On serverless hosts like Vercel, persistent pooling freezes sockets across invocations.
    // Disabling pool ensures fresh, reliable socket connections with timeouts.
    pool: false,
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000,
  } as any);
}

// ---------------------------------------------------------------------------
// HTML Email Template Generator
// ---------------------------------------------------------------------------
function generateOtpEmailHtml({ name, otp, expiresInMinutes = 10 }: { name?: string; otp: string; expiresInMinutes?: number }): string {
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hello,';
  const spacedOtp = otp.split('').join(' ');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your FlowSync Verification Code</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #F9FAFB;
      color: #111111;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #F9FAFB;
      padding: 40px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #E5E7EB;
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 24px;
    }
    .brand-icon {
      width: 36px;
      height: 36px;
      background-color: #2563EB;
      border-radius: 10px;
      display: inline-block;
      text-align: center;
      line-height: 36px;
      color: #ffffff;
      font-weight: bold;
      font-size: 18px;
    }
    .brand-name {
      font-size: 20px;
      font-weight: 700;
      color: #111111;
      letter-spacing: -0.5px;
      display: inline-block;
      vertical-align: middle;
      margin-left: 8px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #111111;
      margin: 0 0 12px 0;
      letter-spacing: -0.4px;
    }
    p {
      font-size: 14px;
      line-height: 22px;
      color: #4B5563;
      margin: 0 0 20px 0;
    }
    .otp-card {
      background-color: #F3F4F6;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      padding: 24px 16px;
      text-align: center;
      margin: 28px 0;
    }
    .otp-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 10px;
      color: #1E3A8A;
      display: inline-block;
    }
    .otp-badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 600;
      color: #2563EB;
      background: #EFF6FF;
      border: 1px solid #DBEAFE;
      padding: 3px 10px;
      border-radius: 9999px;
      margin-top: 10px;
    }
    .footer {
      border-top: 1px solid #F3F4F6;
      padding-top: 20px;
      margin-top: 28px;
      font-size: 12px;
      line-height: 18px;
      color: #9CA3AF;
    }
    .security-note {
      font-size: 12px;
      color: #6B7280;
      line-height: 18px;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="brand">
        <div class="brand-icon">✓</div>
        <span class="brand-name">FlowSync</span>
      </div>

      <h1>Verify your email address</h1>
      <p>${greeting}</p>
      <p>Thank you for creating an account with FlowSync. Please enter the following 6-digit verification code to activate your workspace:</p>

      <div class="otp-card">
        <div class="otp-code">${spacedOtp}</div>
        <br>
        <span class="otp-badge">Valid for ${expiresInMinutes} minutes</span>
      </div>

      <p class="security-note"><strong>Security notice:</strong> If you did not create an account or request this code, you can safely ignore this email. Never share your verification code with anyone.</p>

      <div class="footer">
        © ${new Date().getFullYear()} FlowSync Technologies Inc. All rights reserved.<br>
        High-Performance Task & Project Management Infrastructure.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ---------------------------------------------------------------------------
// Public Send OTP Mailer Function
// ---------------------------------------------------------------------------
export async function sendVerificationOtpEmail({
  to,
  name,
  otp,
  expiresInMinutes = 10,
}: SendOtpParams): Promise<MailResult> {
  const from = getSenderAddress();
  const transporter = getSmtpTransporter();

  // If no SMTP configured, provide structured dev fallback in local development,
  // or return an explicit configuration error in production (e.g. Vercel).
  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SMTP ERROR] SMTP server is not configured in Vercel environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS).');
      return {
        success: false,
        error: 'SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are not configured in Vercel environment variables.',
      };
    }

    console.log('\n======================================================');
    console.log('📨 [SMTP DEV MODE] FlowSync Email Verification Dispatch');
    console.log(`To:       ${to} (${name || 'New Member'})`);
    console.log(`Subject:  ${otp} is your FlowSync verification code`);
    console.log(`OTP Code: >>> [ ${otp} ] <<< (Expires in ${expiresInMinutes} mins)`);
    console.log('Notice:   Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to send real emails.');
    console.log('======================================================\n');

    return {
      success: true,
      devMode: true,
      previewCode: otp,
    };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: `${otp} is your FlowSync verification code`,
      text: `Your FlowSync verification code is: ${otp}. It will expire in ${expiresInMinutes} minutes. If you did not request this, please ignore this email.`,
      html: generateOtpEmailHtml({ name, otp, expiresInMinutes }),
    });

    console.log(`[SMTP] Verification email sent to ${to}: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
      devMode: false,
    };
  } catch (error) {
    console.error('[SMTP ERROR] Failed to send verification email via SMTP:', error);
    // Graceful fallback: return dev preview so user is not permanently locked out during SMTP misconfiguration
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send verification email',
      previewCode: process.env.NODE_ENV !== 'production' ? otp : undefined,
    };
  }
}

// ---------------------------------------------------------------------------
// Team Invitation Email Dispatcher
// ---------------------------------------------------------------------------
export interface SendTeamInviteParams {
  to: string;
  inviterName: string;
  teamName: string;
  inviteUrl: string;
  role: string;
  password?: string;
  expiresInDays?: number;
}

export async function sendTeamInviteEmail({
  to,
  inviterName,
  teamName,
  inviteUrl,
  role,
  password,
  expiresInDays = 7,
}: SendTeamInviteParams): Promise<MailResult> {
  const from = getSenderAddress();
  const transporter = getSmtpTransporter();
  const isLocalhost = inviteUrl.includes('localhost') || inviteUrl.includes('127.0.0.1');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to join ${teamName} on FlowSync</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #F9FAFB;
      color: #111111;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #F9FAFB;
      padding: 40px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #E5E7EB;
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 24px;
    }
    .brand-icon {
      width: 36px;
      height: 36px;
      background-color: #2563EB;
      border-radius: 10px;
      display: inline-block;
      text-align: center;
      line-height: 36px;
      color: #ffffff;
      font-weight: bold;
      font-size: 18px;
    }
    .brand-name {
      font-size: 20px;
      font-weight: 700;
      color: #111111;
      letter-spacing: -0.5px;
      display: inline-block;
      vertical-align: middle;
      margin-left: 8px;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      color: #111111;
      margin: 0 0 12px 0;
      letter-spacing: -0.4px;
    }
    p {
      font-size: 14px;
      line-height: 22px;
      color: #4B5563;
      margin: 0 0 20px 0;
    }
    .credentials-box {
      background-color: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 14px;
      padding: 20px 22px;
      margin: 22px 0;
      text-align: left;
    }
    .invite-box {
      background-color: #EFF6FF;
      border: 1px solid #DBEAFE;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
      text-align: center;
    }
    .btn {
      display: inline-block;
      background-color: #2563EB;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding: 12px 28px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
    }
    .btn:hover {
      background-color: #1D4ED8;
    }
    .footer {
      border-top: 1px solid #F3F4F6;
      padding-top: 20px;
      margin-top: 28px;
      font-size: 12px;
      line-height: 18px;
      color: #9CA3AF;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="brand">
        <div class="brand-icon">✓</div>
        <span class="brand-name">FlowSync</span>
      </div>

      <h1>Join ${teamName}</h1>
      <p>Hello,</p>
      <p><strong>${inviterName}</strong> has invited you to collaborate in <strong>${teamName}</strong> as a <strong>${role}</strong> on FlowSync.</p>

      <div class="credentials-box">
        <p style="font-size: 13.5px; font-weight: 600; color: #0F172A; margin: 0 0 12px 0;">
          Please sign up using the following credentials:
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #64748B; width: 140px; font-weight: 500;">company name:</td>
            <td style="padding: 6px 0; color: #0F172A; font-weight: 700;">
              <span style="background-color: #EEF2F6; color: #0284C7; padding: 3px 8px; border-radius: 6px; font-family: monospace; font-size: 13px;">${teamName}</span>
            </td>
          </tr>
          ${
            password
              ? `
          <tr>
            <td style="padding: 6px 0; color: #64748B; width: 140px; font-weight: 500;">Password :</td>
            <td style="padding: 6px 0; color: #0F172A; font-weight: 700;">
              <span style="background-color: #EEF2F6; color: #0F172A; padding: 3px 8px; border-radius: 6px; font-family: monospace; font-size: 13px; letter-spacing: 0.5px;">${password}</span>
            </td>
          </tr>
          `
              : ''
          }
        </table>
        <p style="font-size: 11.5px; color: #64748B; margin: 12px 0 0 0; line-height: 17px;">
          You can use these details to sign up, or click the button below to accept and start working immediately.
        </p>
      </div>

      <div class="invite-box" style="background-color: #EFF6FF; border: 1px solid #DBEAFE; border-radius: 12px; padding: 22px; margin: 24px 0; text-align: center;">
        <p style="margin-bottom: 18px; font-weight: 500; color: #1E3A8A; font-size: 13.5px;">You can accept this invitation and begin working across projects:</p>
        <a href="${inviteUrl}" class="btn" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #2563EB; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 600; padding: 13px 32px; border-radius: 10px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">Accept Invitation & Join Team</a>
        <p style="margin-top: 14px; margin-bottom: 0; font-size: 11px; color: #64748B;">This invitation link will expire in ${expiresInDays} days.</p>
      </div>

      ${
        isLocalhost
          ? `
      <div style="margin: 18px 0; padding: 12px 16px; background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; text-align: left; font-size: 12px; color: #92400E; line-height: 18px;">
        <strong style="color: #B45309;">⚠️ Testing on Localhost?</strong><br>
        This invitation was dispatched from a local development server (<code>${inviteUrl.split('/invite')[0]}</code>).<br>
        • If you open this email on a <strong>phone, tablet, or another computer</strong>, the button cannot reach your local PC.<br>
        • <strong>To test:</strong> Open this link on the computer running the server, or set <code>APP_URL</code> in your <code>.env</code> file (e.g. using ngrok or your Wi-Fi LAN IP).
      </div>
      `
          : ''
      }

      <p style="font-size: 12px; color: #9CA3AF; word-break: break-all;">
        Or copy and paste this URL into your browser:<br>
        <a href="${inviteUrl}" style="color: #2563EB;">${inviteUrl}</a>
      </p>

      <div class="footer">
        © ${new Date().getFullYear()} FlowSync Technologies Inc. All rights reserved.<br>
        High-Performance Task & Project Management Infrastructure.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SMTP ERROR] SMTP server is not configured in Vercel environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS).');
      return {
        success: false,
        error: 'SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are not configured in Vercel environment variables.',
      };
    }

    console.log('\n======================================================');
    console.log('📨 [SMTP DEV MODE] FlowSync Team Invitation Dispatch');
    console.log(`To:           ${to}`);
    console.log(`Inviter:      ${inviterName}`);
    console.log(`Team/Company: ${teamName} (Role: ${role})`);
    if (password) {
      console.log(`Password:     ${password}`);
    }
    console.log(`Invite URL:   >>> [ ${inviteUrl} ] <<<`);
    console.log(`Expires:      ${expiresInDays} days`);
    console.log('======================================================\n');

    return {
      success: true,
      devMode: true,
      previewCode: inviteUrl,
    };
  }

  try {
    const plainText = `Hello,

${inviterName} has invited you to join ${teamName} as a ${role} on FlowSync.

Please sign up using:
company name: ${teamName}
Password : ${password || 'Provided by your administrator'}

You can also click the link below to accept your invitation directly:
${inviteUrl}

This invitation link will expire in ${expiresInDays} days.

© ${new Date().getFullYear()} FlowSync Technologies Inc.`;

    const info = await transporter.sendMail({
      from,
      to,
      subject: `${inviterName} invited you to join ${teamName} on FlowSync`,
      text: plainText,
      html,
    });

    return {
      success: true,
      messageId: info.messageId,
      devMode: false,
    };
  } catch (error) {
    console.error('[SMTP ERROR] Failed to send team invite email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send invite email',
      previewCode: process.env.NODE_ENV !== 'production' ? inviteUrl : undefined,
    };
  }
}

/**
 * Verify SMTP connection credentials
 */
export async function verifySmtpConnection(): Promise<{ success: boolean; message: string }> {
  const transporter = getSmtpTransporter();
  if (!transporter) {
    return {
      success: false,
      message: 'SMTP credentials not configured in environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS).',
    };
  }

  try {
    await transporter.verify();
    return {
      success: true,
      message: 'SMTP server connection established and verified successfully.',
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'SMTP verification failed',
    };
  }
}

// ---------------------------------------------------------------------------
// Project-Scoped Invitation Email Dispatcher
// ---------------------------------------------------------------------------
export interface SendProjectInviteParams {
  to: string;
  inviterName: string;
  inviterEmail?: string;
  projectName: string;
  projectColor?: string;
  organizationName?: string | null;
  /** Link that opens the invitation page (Accept) */
  inviteUrl: string;
  /** Link that opens the invitation page in "decline" mode */
  declineUrl?: string;
  role: string;
  expiresInDays?: number;
}

/** Escape user-provided text before placing it in email HTML */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Human label for a project role ("CONTRIBUTOR" → "Contributor", "Project Manager" stays) */
function formatProjectRole(role: string): string {
  if (!role) return 'Member';
  if (/[a-z]/.test(role)) return role;
  return role.charAt(0) + role.slice(1).toLowerCase();
}

/**
 * Project invitation email: who invited you, to which project/organization, with Accept and
 * Decline buttons. Table-based layout with inline styles so it renders in Gmail, Outlook and
 * Apple Mail; a plain-text alternative is included.
 */
/** Builds the invitation email (HTML + plain text) without sending it. */
export function buildProjectInviteEmail({
  to,
  inviterName,
  inviterEmail,
  projectName,
  projectColor = '#2563EB',
  organizationName,
  inviteUrl,
  declineUrl,
  role,
  expiresInDays = 7,
}: SendProjectInviteParams): { subject: string; html: string; text: string; declineUrl: string } {
  const safeInviter = escapeHtml(inviterName);
  const safeInviterEmail = inviterEmail ? escapeHtml(inviterEmail) : '';
  const safeProject = escapeHtml(projectName);
  const safeOrg = organizationName ? escapeHtml(organizationName) : '';
  const safeRole = escapeHtml(formatProjectRole(role));
  const safeColor = /^#[0-9a-f]{6}$/i.test(projectColor) ? projectColor : '#2563EB';
  const decline = declineUrl || `${inviteUrl}${inviteUrl.includes('?') ? '&' : '?'}action=decline`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>Invitation to ${safeProject} on FlowSync</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111111;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safeInviter} invited you to join ${safeProject} on FlowSync.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F5F7;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
          <!-- Brand -->
          <tr>
            <td style="padding:0 4px 18px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:30px;height:30px;background-color:#111111;border-radius:8px;text-align:center;vertical-align:middle;color:#FFFFFF;font-size:15px;font-weight:700;">F</td>
                  <td style="padding-left:10px;font-size:17px;font-weight:700;color:#111111;letter-spacing:-0.2px;">FlowSync</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:#FFFFFF;border:1px solid #E5E7EB;border-radius:16px;padding:32px 28px;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#6B7280;">You're invited to collaborate</p>
              <h1 style="margin:0 0 18px 0;font-size:22px;line-height:1.3;font-weight:700;color:#111111;">
                Join <span style="color:${safeColor};">${safeProject}</span> on FlowSync
              </h1>
              <p style="margin:0 0 22px 0;font-size:14.5px;line-height:1.6;color:#374151;">
                <strong style="color:#111111;">${safeInviter}</strong>${safeInviterEmail ? ` (<a href="mailto:${safeInviterEmail}" style="color:#2563EB;text-decoration:none;">${safeInviterEmail}</a>)` : ''}
                has invited you to join the project <strong style="color:#111111;">${safeProject}</strong>${safeOrg ? ` at <strong style="color:#111111;">${safeOrg}</strong>` : ''}.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F9FAFB;border:1px solid #F0F0F0;border-radius:12px;margin:0 0 26px 0;">
                <tr>
                  <td style="padding:14px 16px;font-size:13px;color:#6B7280;">Project</td>
                  <td style="padding:14px 16px;font-size:13px;color:#111111;font-weight:600;text-align:right;">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background-color:${safeColor};margin-right:6px;"></span>${safeProject}
                  </td>
                </tr>
                ${safeOrg ? `<tr>
                  <td style="padding:0 16px 14px 16px;font-size:13px;color:#6B7280;">Organization</td>
                  <td style="padding:0 16px 14px 16px;font-size:13px;color:#111111;font-weight:600;text-align:right;">${safeOrg}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:0 16px 14px 16px;font-size:13px;color:#6B7280;">Your role</td>
                  <td style="padding:0 16px 14px 16px;font-size:13px;color:#111111;font-weight:600;text-align:right;">${safeRole}</td>
                </tr>
                <tr>
                  <td style="padding:0 16px 14px 16px;font-size:13px;color:#6B7280;">Invited by</td>
                  <td style="padding:0 16px 14px 16px;font-size:13px;color:#111111;font-weight:600;text-align:right;">${safeInviter}</td>
                </tr>
              </table>

              <!-- Buttons -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:6px;" width="50%">
                    <a href="${inviteUrl}" style="display:block;text-align:center;background-color:#2563EB;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;padding:13px 8px;border-radius:10px;white-space:nowrap;">Accept invitation</a>
                  </td>
                  <td style="padding-left:6px;" width="50%">
                    <a href="${decline}" style="display:block;text-align:center;background-color:#FFFFFF;color:#374151;font-size:14px;font-weight:600;text-decoration:none;padding:12px 8px;border-radius:10px;border:1px solid #D1D5DB;white-space:nowrap;">Decline</a>
                  </td>
                </tr>
              </table>

              <p style="margin:22px 0 0 0;font-size:12.5px;line-height:1.6;color:#6B7280;">
                New to FlowSync? Accepting lets you choose your name and password, then takes you straight to the project.
                This invitation expires in ${expiresInDays} day${expiresInDays === 1 ? '' : 's'}.
              </p>
            </td>
          </tr>
          <!-- Fallback link + footer -->
          <tr>
            <td style="padding:18px 6px 0 6px;font-size:11.5px;line-height:1.6;color:#9CA3AF;">
              If the buttons don't work, copy this link into your browser:<br>
              <a href="${inviteUrl}" style="color:#6B7280;word-break:break-all;">${inviteUrl}</a><br><br>
              You received this email because ${safeInviter} invited ${escapeHtml(to)} to a FlowSync project.
              If you weren't expecting it, you can ignore this email or decline.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${inviterName}${inviterEmail ? ` (${inviterEmail})` : ''} invited you to join the project "${projectName}"${organizationName ? ` at ${organizationName}` : ''} on FlowSync.`,
    '',
    `Your role: ${formatProjectRole(role)}`,
    '',
    `Accept the invitation: ${inviteUrl}`,
    `Decline the invitation: ${decline}`,
    '',
    `This invitation expires in ${expiresInDays} day${expiresInDays === 1 ? '' : 's'}.`,
  ].join('\n');

  return { subject: `${inviterName} invited you to join ${projectName} on FlowSync`, html, text, declineUrl: decline };
}

export async function sendProjectInviteEmail(params: SendProjectInviteParams): Promise<MailResult> {
  const { to, inviterName, inviterEmail, projectName, inviteUrl, role } = params;
  const from = getSenderAddress();
  const transporter = getSmtpTransporter();
  const { subject, html, text, declineUrl: decline } = buildProjectInviteEmail(params);

  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      return { success: false, error: 'SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS).' };
    }
    console.log('\n======================================================');
    console.log('📨 [SMTP DEV MODE] FlowSync Project Invitation');
    console.log(`To:       ${to}`);
    console.log(`Inviter:  ${inviterName}`);
    console.log(`Project:  ${projectName} (Role: ${role})`);
    console.log(`Accept:   ${inviteUrl}`);
    console.log(`Decline:  ${decline}`);
    console.log('======================================================\n');
    return { success: true, devMode: true, previewCode: inviteUrl };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      replyTo: inviterEmail || undefined,
      subject,
      text,
      html,
    });
    return { success: true, messageId: info.messageId, devMode: false };
  } catch (error) {
    console.error('[SMTP ERROR] Failed to send project invite email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send invite email',
      previewCode: process.env.NODE_ENV !== 'production' ? inviteUrl : undefined,
    };
  }
}

// ---------------------------------------------------------------------------
// Login Security Notification Email Dispatcher
// ---------------------------------------------------------------------------
export interface SendLoginNotificationParams {
  to: string;
  name?: string;
  loginMethod?: string;
  timestamp?: Date;
}

export async function sendLoginNotificationEmail({
  to,
  name,
  loginMethod = 'FlowSync Authentication',
  timestamp = new Date(),
}: SendLoginNotificationParams): Promise<MailResult> {
  const from = getSenderAddress();
  const transporter = getSmtpTransporter();
  const formattedDate = timestamp.toUTCString();
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hello,';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Alert: New Sign-In to FlowSync</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #F9FAFB;
      color: #111111;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #F9FAFB;
      padding: 40px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #E5E7EB;
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 24px;
    }
    .brand-icon {
      width: 36px;
      height: 36px;
      background-color: #0F172A;
      border-radius: 10px;
      display: inline-block;
      text-align: center;
      line-height: 36px;
      color: #ffffff;
      font-weight: bold;
      font-size: 18px;
    }
    .brand-name {
      font-size: 20px;
      font-weight: 700;
      color: #111111;
      letter-spacing: -0.5px;
      display: inline-block;
      vertical-align: middle;
      margin-left: 8px;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      color: #111111;
      margin: 0 0 12px 0;
      letter-spacing: -0.4px;
    }
    p {
      font-size: 14px;
      line-height: 22px;
      color: #4B5563;
      margin: 0 0 16px 0;
    }
    .card {
      background-color: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .badge {
      display: inline-block;
      background: #ECFDF5;
      color: #059669;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 9999px;
      border: 1px solid #A7F3D0;
    }
    .footer {
      border-top: 1px solid #F3F4F6;
      padding-top: 20px;
      margin-top: 28px;
      font-size: 12px;
      line-height: 18px;
      color: #9CA3AF;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="brand">
        <div class="brand-icon">✓</div>
        <span class="brand-name">FlowSync</span>
      </div>

      <h1>Security Alert: New Sign-In</h1>
      <p>${greeting}</p>
      <p>We detected a new sign-in to your FlowSync account associated with <strong>${to}</strong>.</p>

      <div class="card">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="border-bottom: 1px solid #EDF2F7;">
            <td style="padding: 8px 0; color: #64748B; font-weight: 500;">Method</td>
            <td style="padding: 8px 0; color: #0F172A; font-weight: 600; text-align: right;">${loginMethod}</td>
          </tr>
          <tr style="border-bottom: 1px solid #EDF2F7;">
            <td style="padding: 8px 0; color: #64748B; font-weight: 500;">Timestamp</td>
            <td style="padding: 8px 0; color: #0F172A; font-weight: 600; text-align: right;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748B; font-weight: 500;">Status</td>
            <td style="padding: 8px 0; text-align: right;"><span class="badge">Authenticated</span></td>
          </tr>
        </table>
      </div>

      <p style="font-size: 13px; color: #64748B;">If this was you, you can safely disregard this message. If you did not sign in or suspect unauthorized access, please update your credentials immediately.</p>

      <div class="footer">
        © ${new Date().getFullYear()} FlowSync Technologies Inc. All rights reserved.<br>
        High-Performance Task & Project Management Infrastructure.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  if (!transporter) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📨 [SMTP DEV] Login notification simulated for ${to} (${loginMethod})`);
    }
    return { success: true, devMode: true };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: 'Security Alert: New Sign-In to your FlowSync Account',
      text: `We detected a new sign-in to your FlowSync account (${to}) on ${formattedDate} via ${loginMethod}. If this was not you, please secure your account immediately.`,
      html,
    });
    return { success: true, messageId: info.messageId, devMode: false };
  } catch (error) {
    console.error('[SMTP ERROR] Failed to send login notification:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send login notification' };
  }
}

// ---------------------------------------------------------------------------
// Signup Welcome Notification Email Dispatcher
// ---------------------------------------------------------------------------
export interface SendSignupNotificationParams {
  to: string;
  name?: string;
  signupMethod?: string;
}

export async function sendSignupNotificationEmail({
  to,
  name,
  signupMethod = 'FlowSync Platform',
}: SendSignupNotificationParams): Promise<MailResult> {
  const from = getSenderAddress();
  const transporter = getSmtpTransporter();
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hello,';
  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'https://flow-sync-ruby.vercel.app';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to FlowSync</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #F9FAFB;
      color: #111111;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #F9FAFB;
      padding: 40px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #E5E7EB;
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 24px;
    }
    .brand-icon {
      width: 36px;
      height: 36px;
      background-color: #0075FF;
      border-radius: 10px;
      display: inline-block;
      text-align: center;
      line-height: 36px;
      color: #ffffff;
      font-weight: bold;
      font-size: 18px;
    }
    .brand-name {
      font-size: 20px;
      font-weight: 700;
      color: #111111;
      letter-spacing: -0.5px;
      display: inline-block;
      vertical-align: middle;
      margin-left: 8px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #111111;
      margin: 0 0 12px 0;
      letter-spacing: -0.4px;
    }
    p {
      font-size: 14px;
      line-height: 22px;
      color: #4B5563;
      margin: 0 0 16px 0;
    }
    .btn-container {
      margin: 28px 0;
      text-align: center;
    }
    .btn {
      display: inline-block;
      background-color: #0075FF;
      color: #ffffff !important;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0, 117, 255, 0.25);
    }
    .feature-list {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .feature-item {
      font-size: 13px;
      color: #334155;
      padding: 6px 0;
    }
    .footer {
      border-top: 1px solid #F3F4F6;
      padding-top: 20px;
      margin-top: 28px;
      font-size: 12px;
      line-height: 18px;
      color: #9CA3AF;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="brand">
        <div class="brand-icon">✓</div>
        <span class="brand-name">FlowSync</span>
      </div>

      <h1>Welcome to FlowSync 🎉</h1>
      <p>${greeting}</p>
      <p>Thank you for creating your FlowSync account (via <strong>${signupMethod}</strong>). We're excited to help you and your team streamline project execution and task coordination.</p>

      <div class="feature-list">
        <div class="feature-item">⚡ <strong>Agile Kanban & Backlog:</strong> Real-time task orchestration.</div>
        <div class="feature-item">👥 <strong>Multi-Tenant Teams:</strong> Isolated workspace security.</div>
        <div class="feature-item">📈 <strong>Velocity Analytics:</strong> Team performance insights.</div>
      </div>

      <div class="btn-container">
        <a href="${appUrl}/app" class="btn">Launch FlowSync Workspace</a>
      </div>

      <p style="font-size: 13px; color: #64748B;">Need help getting started? Check your workspace settings or reply directly to this email.</p>

      <div class="footer">
        © ${new Date().getFullYear()} FlowSync Technologies Inc. All rights reserved.<br>
        High-Performance Task & Project Management Infrastructure.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  if (!transporter) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📨 [SMTP DEV] Welcome email simulated for ${to} (${signupMethod})`);
    }
    return { success: true, devMode: true };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: 'Welcome to FlowSync – Your Workspace is Ready',
      text: `Welcome to FlowSync! Your account (${to}) has been created via ${signupMethod}. Launch your workspace here: ${appUrl}/app`,
      html,
    });
    return { success: true, messageId: info.messageId, devMode: false };
  } catch (error) {
    console.error('[SMTP ERROR] Failed to send welcome email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send welcome email' };
  }
}


