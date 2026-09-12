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
        <div style="width: 44px; height: 52px; line-height: 52px; background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 800; color: #0f172a; text-align: center; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);">
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
  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 40px 36px; box-shadow: 0 10px 30px rgba(99, 102, 241, 0.06);">
    
    <!-- Top Header / Logo Bar -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 36px;">
      <tr>
        <td align="left">
          <table border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding-right: 10px;">
                <img src="https://airvix.online/airvix-mark.png" alt="Airvix" width="32" height="32" style="display: block; width: 32px; height: 32px; border: 0; object-fit: contain;" />
              </td>
              <td style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
                Airvix
              </td>
            </tr>
          </table>
        </td>
        <td align="right" style="font-size: 13px; color: #64748b; font-weight: 500;">
          Automate &bull; Engage &bull; Grow
        </td>
      </tr>
    </table>

    <!-- Lock Icon Badge -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 56px; height: 56px; border-radius: 16px; background-color: #f0eaff; text-align: center; line-height: 56px;">
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
    <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 12px 18px; font-size: 13px; color: #64748b; text-align: center; margin-bottom: 32px;">
      <span style="color: #6366f1; font-weight: 700;">&#9432;</span> ${messageNotice || "If you didn't request this code, you can safely ignore this email."}
    </div>

    <!-- Signature Block -->
    <div style="font-size: 13.5px; color: #64748b; line-height: 1.6; margin-bottom: 32px; border-bottom: 1px solid #f1f5f9; padding-bottom: 28px;">
      Cheers,<br>
      <strong style="color: #0f172a; font-size: 14.5px;">The Airvix Team</strong><br>
      <span style="color: #8b5cf6; font-size: 12.5px; font-weight: 600;">Automate. Engage. Grow.</span>
    </div>

    <!-- Footer -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 8px;">
      <tr>
        <td align="left" valign="top">
          <table border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding-right: 8px;">
                <img src="https://airvix.online/airvix-mark.png" alt="Airvix" width="22" height="22" style="display: block; width: 22px; height: 22px; border: 0; object-fit: contain;" />
              </td>
              <td style="font-size: 16px; font-weight: 800; color: #0f172a;">
                Airvix
              </td>
            </tr>
          </table>
          <div style="font-size: 12px; color: #64748b; margin-top: 6px; max-width: 280px; line-height: 1.4;">
            All-in-one Instagram automation for creators, brands and businesses.
          </div>
        </td>
        <td align="right" valign="top">
          <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 8px;">Follow us</div>
          <table border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding-left: 8px;">
                <a href="https://instagram.com" target="_blank" style="text-decoration: none;">
                  <div style="width: 28px; height: 28px; border-radius: 50%; background-color: #f1f5f9; text-align: center; line-height: 28px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                    </svg>
                  </div>
                </a>
              </td>
              <td style="padding-left: 8px;">
                <a href="https://youtube.com" target="_blank" style="text-decoration: none;">
                  <div style="width: 28px; height: 28px; border-radius: 50%; background-color: #f1f5f9; text-align: center; line-height: 28px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
                      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/>
                      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>
                    </svg>
                  </div>
                </a>
              </td>
              <td style="padding-left: 8px;">
                <a href="https://airvix.online" target="_blank" style="text-decoration: none;">
                  <div style="width: 28px; height: 28px; border-radius: 50%; background-color: #f1f5f9; text-align: center; line-height: 28px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="2" y1="12" x2="22" y2="12"/>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                  </div>
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding-top: 24px;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 1px solid #f1f5f9; padding-top: 16px;">
            <tr>
              <td align="left" style="font-size: 11.5px; color: #94a3b8;">
                Need help? Visit our <a href="http://localhost:5173" style="color: #4f46e5; text-decoration: underline;">Help Center</a> or reply to this email.
              </td>
              <td align="right" style="font-size: 11.5px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} Airvix. All rights reserved.
              </td>
            </tr>
          </table>
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
