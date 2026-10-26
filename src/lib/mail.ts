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

      <div class="invite-box">
        <p style="margin-bottom: 16px; font-weight: 500; color: #1E3A8A;">You can accept this invitation and begin working across projects:</p>
        <a href="${inviteUrl}" class="btn" target="_blank">Accept Invitation & Join Team</a>
        <p style="margin-top: 12px; margin-bottom: 0; font-size: 11px; color: #64748B;">This invitation link will expire in ${expiresInDays} days.</p>
      </div>

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
  projectName: string;
  projectColor?: string;
  inviteUrl: string;
  role: string;
  expiresInDays?: number;
}

export async function sendProjectInviteEmail({
  to,
  inviterName,
  projectName,
  projectColor = '#2563EB',
  inviteUrl,
  role,
  expiresInDays = 7,
}: SendProjectInviteParams): Promise<MailResult> {
  const from = getSenderAddress();
  const transporter = getSmtpTransporter();

  const formattedRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to collaborate on ${projectName} on FlowSync</title>
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
    .project-card {
      background-color: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
      text-align: center;
    }
    .project-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      color: #1E293B;
      margin-bottom: 16px;
    }
    .color-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
      background-color: ${projectColor};
    }
    .role-tag {
      display: inline-block;
      background: #EFF6FF;
      color: #2563EB;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-left: 6px;
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

      <h1>You're invited to collaborate</h1>
      <p>Hello,</p>
      <p><strong>${inviterName}</strong> (Project Manager) has invited you to join the project team for <strong>${projectName}</strong> as a <span class="role-tag">${formattedRole}</span>.</p>

      <div class="project-card">
        <div class="project-badge">
          <span class="color-dot"></span>
          <span>${projectName}</span>
        </div>
        <p style="margin-bottom: 16px; font-weight: 500; color: #1E3A8A; font-size: 13px;">
          Accept your invitation below, create your password, and enter the project workspace:
        </p>
        <a href="${inviteUrl}" class="btn" target="_blank">Accept Invitation & Set Password</a>
        <p style="margin-top: 14px; margin-bottom: 0; font-size: 11px; color: #64748B;">This secure invitation link will expire in ${expiresInDays} days.</p>
      </div>

      <p style="font-size: 12px; color: #9CA3AF; word-break: break-all;">
        Button not working? Copy and paste this URL into your browser:<br>
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
    console.log('📨 [SMTP DEV MODE] FlowSync Project Invitation Dispatch');
    console.log(`To:          ${to}`);
    console.log(`Inviter:     ${inviterName}`);
    console.log(`Project:     ${projectName} (Role: ${role})`);
    console.log(`Invite URL:  >>> [ ${inviteUrl} ] <<<`);
    console.log(`Expires:     ${expiresInDays} days`);
    console.log('======================================================\n');

    return {
      success: true,
      devMode: true,
      previewCode: inviteUrl,
    };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: `${inviterName} invited you to join ${projectName} on FlowSync`,
      text: `${inviterName} has invited you to join ${projectName} as ${role} on FlowSync. Accept your invitation and set your password here: ${inviteUrl}`,
      html,
    });

    return {
      success: true,
      messageId: info.messageId,
      devMode: false,
    };
  } catch (error) {
    console.error('[SMTP ERROR] Failed to send project invite email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send invite email',
      previewCode: process.env.NODE_ENV !== 'production' ? inviteUrl : undefined,
    };
  }
}


