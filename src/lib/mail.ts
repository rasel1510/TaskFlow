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
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
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
  const from = process.env.SMTP_FROM || `"FlowSync" <${process.env.SMTP_USER || 'noreply@flowsync.app'}>`;
  const transporter = getSmtpTransporter();

  // If no SMTP configured, provide structured dev fallback with console preview
  if (!transporter) {
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
