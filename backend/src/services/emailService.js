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
 * Render branded HTML template for Airvix OTP emails matching user reference design
 */
function renderEmailHtml({ title, subtitle, otp, messageNotice, recipientName }) {
  const otpDigits = String(otp || '123456').split('');
  const digitBoxesHtml = otpDigits
    .map(
      (digit) => `
      <td align="center" style="padding: 0 4px;">
        <div style="width: 46px; height: 56px; line-height: 56px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 26px; font-weight: 800; color: #0f172a; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
          ${digit}
        </div>
      </td>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f2ff; color: #0f172a; margin: 0; padding: 32px 16px;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; border: 1px solid #e2e8f0; padding: 40px 36px; box-shadow: 0 12px 35px rgba(99, 102, 241, 0.08);">
    
    <!-- Top Header / Logo Bar -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
      <tr>
        <td align="left">
          <table border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding-right: 10px;">
                <div style="width: 32px; height: 32px; border-radius: 10px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; font-weight: 900; font-size: 18px; text-align: center; line-height: 32px;">
                  A
                </div>
              </td>
              <td style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
                Airvix
              </td>
            </tr>
          </table>
        </td>
        <td align="right" style="font-size: 12.5px; color: #64748b; font-weight: 500;">
          Automate &bull; Engage &bull; Grow
        </td>
      </tr>
    </table>

    <!-- Lock Icon Badge -->
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="display: inline-block; width: 56px; height: 56px; border-radius: 18px; background-color: #f0eaff; text-align: center; line-height: 56px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="vertical-align: middle;">
          <rect x="5" y="11" width="14" height="10" rx="3" fill="#6366f1"/>
          <path d="M8 11V7a4 4 0 1 1 8 0v4" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>
    </div>

    <!-- Title & Subtitle -->
    <div style="text-align: center; margin-bottom: 28px;">
      <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 8px 0; letter-spacing: -0.02em;">
        ${title || 'Your Verification Code'}
      </h1>
      <p style="font-size: 14px; color: #64748b; margin: 0 auto; max-width: 380px; line-height: 1.5;">
        ${subtitle || 'Use the code below to verify your email address and continue with Airvix.'}
      </p>
    </div>

    <!-- Digit Grid -->
    <table align="center" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 24px auto;">
      <tr>
        ${digitBoxesHtml}
      </tr>
    </table>

    <!-- Expiry Notice -->
    <div style="text-align: center; font-size: 13.5px; color: #475569; margin-bottom: 24px;">
      This code will expire in <strong style="color: #4f46e5;">10 minutes</strong>.
    </div>

    <!-- Security Info Box -->
    <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 14px; padding: 12px 18px; font-size: 13px; color: #64748b; text-align: center; margin-bottom: 32px;">
      <span style="color: #6366f1; font-weight: 700;">&#9432;</span> ${messageNotice || "If you didn't request this code, you can safely ignore this email."}
    </div>

    <!-- Signature Block -->
    <div style="font-size: 13.5px; color: #64748b; line-height: 1.6; margin-bottom: 32px; border-bottom: 1px solid #f1f5f9; padding-bottom: 28px;">
      Cheers,<br>
      <strong style="color: #0f172a; font-size: 14.5px;">The Airvix Team</strong><br>
      <span style="color: #8b5cf6; font-size: 12.5px; font-weight: 600;">Automate. Engage. Grow.</span>
    </div>

    <!-- Footer -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0">
      <tr>
        <td align="left">
          <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">Airvix</div>
          <div style="font-size: 11.5px; color: #94a3b8;">All-in-one Instagram automation for creators, brands and businesses.</div>
        </td>
      </tr>
      <tr>
        <td align="left" style="padding-top: 16px; font-size: 11.5px; color: #94a3b8;">
          Need help? Reply directly to this email.<br>
          &copy; ${new Date().getFullYear()} Airvix Inc. All rights reserved.
        </td>
      </tr>
    </table>

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
