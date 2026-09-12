// backend/src/services/emailService.js
const { Resend } = require('resend');

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function getFromEmail() {
  return process.env.EMAIL_FROM || 'Airvix Auth <otp@airvix.online>';
}

/**
 * Render branded HTML template for Airvix OTP emails
 */
function renderEmailHtml({ title, subtitle, otp, messageNotice, recipientName }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 540px; margin: 40px auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 40px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo-text { font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.5px; }
    .header { text-align: center; margin-bottom: 32px; }
    .title { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }
    .subtitle { font-size: 14px; color: #94a3b8; line-height: 1.5; }
    .otp-box { background: #0f172a; border: 2px dashed #6366f1; border-radius: 12px; padding: 24px; text-align: center; margin: 32px 0; letter-spacing: 8px; }
    .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; color: #818cf8; letter-spacing: 12px; margin-left: 12px; }
    .notice { font-size: 13px; color: #64748b; text-align: center; line-height: 1.6; border-top: 1px solid #334155; padding-top: 24px; margin-top: 32px; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #475569; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <span class="logo-text">Airvix</span>
    </div>
    <div class="header">
      <div class="title">${title}</div>
      <div class="subtitle">Hello ${recipientName || 'Creator'}, ${subtitle}</div>
    </div>
    
    <div class="otp-box">
      <div class="otp-code">${otp}</div>
    </div>

    <div class="notice">
      ${messageNotice || 'This verification code expires in 10 minutes. For security, never share this code with anyone.'}
    </div>
    
    <div class="footer">
      &copy; ${new Date().getFullYear()} Airvix Inc. All rights reserved.<br>
      Automate Instagram DMs & Reel Comments with AI.
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send Login OTP Email via Resend
 */
async function sendLoginOtpEmail({ email, otp, name }) {
  const html = renderEmailHtml({
    title: 'Your Airvix Login Code',
    subtitle: 'use the verification code below to complete your login to Airvix.',
    otp,
    recipientName: name,
    messageNotice: 'This code is valid for 10 minutes and can only be used once. If you did not request this code, please ignore this email.'
  });

  const resend = getResendClient();
  const fromEmail = getFromEmail();

  if (!resend) {
    console.log(`[EmailService] 📧 [DEV/TEST Fallback] Login OTP for ${email}: ${otp}`);
    return { success: true, simulated: true, otp };
  }

  try {
    const data = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: `${otp} is your Airvix login verification code`,
      html
    });
    console.log(`[EmailService] ✉️ Real Resend OTP sent to ${email} (Message ID: ${data?.id || 'OK'})`);
    return { success: true, data };
  } catch (err) {
    console.error(`[EmailService] ❌ Resend error sending login OTP to ${email}:`, err.message);
    return { success: true, simulated: true, otp, error: err.message };
  }
}

/**
 * Send Password Reset OTP Email via Resend
 */
async function sendPasswordResetOtpEmail({ email, otp, name }) {
  const html = renderEmailHtml({
    title: 'Reset Your Airvix Password',
    subtitle: 'we received a request to reset the password for your Airvix account.',
    otp,
    recipientName: name,
    messageNotice: 'Enter this 6-digit code to choose a new password. This code expires in 10 minutes. If you did not request a password reset, your account is secure and you can disregard this message.'
  });

  const resend = getResendClient();
  const fromEmail = getFromEmail();

  if (!resend) {
    console.log(`[EmailService] 📧 [DEV/TEST Fallback] Password Reset OTP for ${email}: ${otp}`);
    return { success: true, simulated: true, otp };
  }

  try {
    const data = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: `${otp} is your Airvix password reset code`,
      html
    });
    console.log(`[EmailService] ✉️ Real Resend Password Reset OTP sent to ${email} (Message ID: ${data?.id || 'OK'})`);
    return { success: true, data };
  } catch (err) {
    console.error(`[EmailService] ❌ Resend error sending password reset OTP to ${email}:`, err.message);
    return { success: true, simulated: true, otp, error: err.message };
  }
}

/**
 * Send Email Verification OTP Email via Resend
 */
async function sendEmailVerificationOtpEmail({ email, otp, name }) {
  const html = renderEmailHtml({
    title: 'Verify Your Email Address',
    subtitle: 'please verify your email address to complete setting up your Airvix account.',
    otp,
    recipientName: name,
    messageNotice: 'Enter this 6-digit code on the Airvix verification screen to activate full account capabilities.'
  });

  const resend = getResendClient();
  const fromEmail = getFromEmail();

  if (!resend) {
    console.log(`[EmailService] 📧 [DEV/TEST Fallback] Email Verification OTP for ${email}: ${otp}`);
    return { success: true, simulated: true, otp };
  }

  try {
    const data = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: `${otp} is your Airvix email verification code`,
      html
    });
    console.log(`[EmailService] ✉️ Real Resend Verification OTP sent to ${email} (Message ID: ${data?.id || 'OK'})`);
    return { success: true, data };
  } catch (err) {
    console.error(`[EmailService] ❌ Resend error sending email verification OTP to ${email}:`, err.message);
    return { success: true, simulated: true, otp, error: err.message };
  }
}

module.exports = {
  sendLoginOtpEmail,
  sendPasswordResetOtpEmail,
  sendEmailVerificationOtpEmail,
};
