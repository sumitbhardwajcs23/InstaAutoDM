const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function getFromEmail() {
  return process.env.EMAIL_FROM || 'Airvix Auth <otp@airvix.online>';
}

// Load attached Airvix Logo as Data URI for 100% reliable email client rendering
let cachedLogoBase64 = null;
function getAirvixLogoBase64() {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const logoPath = path.join(__dirname, '../../../frontend/public/airvix-logo.png');
    if (fs.existsSync(logoPath)) {
      const buf = fs.readFileSync(logoPath);
      cachedLogoBase64 = `data:image/png;base64,${buf.toString('base64')}`;
      return cachedLogoBase64;
    }
  } catch (err) {
    console.error('[EmailService] Warning reading logo file:', err.message);
  }
  return 'https://airvix.online/airvix-logo.png';
}

/**
 * Render branded HTML template for Airvix OTP emails matching user reference design (Pure White Theme)
 */
function renderEmailHtml({ title, subtitle, otp, messageNotice, recipientName }) {
  const otpDigits = String(otp || '123456').split('');
  const logoUrl = getAirvixLogoBase64();
  
  const digitBoxesHtml = otpDigits
    .map(
      (digit) => `
      <td>
        <div class="otp-box" style="width:42px; height:48px; line-height:48px; background:#ffffff !important; border:1px solid #e5e8f2 !important; border-radius:9px; text-align:center; font-size:23px; font-weight:700; color:#171d35 !important; margin:0 3px;">
          ${digit}
        </div>
      </td>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${title || 'Airvix Verification Code'}</title>
  <style>
    :root {
      color-scheme: light !important;
      supported-color-schemes: light !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background-color: #f5f7fb !important;
      font-family: -apple-system, BlinkMacSystemFont, Arial, Helvetica, sans-serif;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table {
      border-spacing: 0;
      border-collapse: collapse;
    }
    img {
      border: 0;
      display: block;
      max-width: 100%;
      height: auto;
    }
    a {
      text-decoration: none;
    }
    /* Force light mode in dark mode email clients */
    [data-ogsc] .email-card,
    [data-ogsb] .email-card {
      background-color: #ffffff !important;
      color: #121a33 !important;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        padding: 20px 10px !important;
      }
      .email-card {
        width: 100% !important;
        border-radius: 14px !important;
      }
      .header {
        padding: 22px 20px !important;
      }
      .content {
        padding: 32px 20px 28px !important;
      }
      .footer {
        padding: 22px 20px !important;
      }
      .title {
        font-size: 24px !important;
        line-height: 31px !important;
      }
      .description {
        font-size: 14px !important;
        line-height: 22px !important;
      }
      .otp-container {
        padding: 14px 6px !important;
      }
      .otp-box {
        width: 34px !important;
        height: 42px !important;
        line-height: 42px !important;
        font-size: 20px !important;
        margin: 0 2px !important;
      }
      .security-box {
        font-size: 12px !important;
        line-height: 18px !important;
        padding: 13px !important;
      }
      .brand {
        font-size: 23px !important;
      }
    }
    @media only screen and (max-width: 380px) {
      .content {
        padding-left: 15px !important;
        padding-right: 15px !important;
      }
      .otp-box {
        width: 29px !important;
        height: 38px !important;
        line-height: 38px !important;
        font-size: 18px !important;
        margin: 0 1px !important;
      }
    }
  </style>
</head>
<body style="background-color: #f5f7fb !important; margin: 0; padding: 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; background:#f5f7fb !important;">
    <tr>
      <td align="center" class="email-wrapper" style="padding:40px 15px;">
        
        <!-- CARD -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" class="email-card" style="width:100%; max-width:560px; background:#ffffff !important; border-radius:18px; overflow:hidden; box-shadow:0 8px 30px rgba(30,40,80,0.08);">
          
          <!-- HEADER -->
          <tr>
            <td class="header" style="padding:26px 32px; border-bottom:1px solid #edf0f6;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <img src="${logoUrl}" alt="Airvix" height="34" style="display:block; height:34px; width:auto; border:0; object-fit:contain;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td align="center" class="content" style="padding:42px 40px 35px;">
              
              <!-- ICON -->
              <div style="width:60px; height:60px; line-height:60px; margin:0 auto 20px; background:#eef0ff; border-radius:18px; font-size:27px; text-align:center;">
                🔐
              </div>

              <!-- TITLE -->
              <div class="title" style="font-size:28px; line-height:36px; font-weight:700; color:#121a33 !important; margin-bottom:10px;">
                ${title || 'Your Verification Code'}
              </div>

              <!-- DESCRIPTION -->
              <div class="description" style="font-size:16px; line-height:25px; color:#68728a !important; max-width:420px; margin:0 auto;">
                ${subtitle || 'Use the code below to verify your email address and continue with Airvix.'}
              </div>

              <!-- OTP CONTAINER -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" class="otp-container" style="margin:28px auto; padding:16px 8px; background:#f6f7ff !important; border:1px solid #e2e5ff !important; border-radius:14px;">
                <tr>
                  ${digitBoxesHtml}
                </tr>
              </table>

              <!-- EXPIRY -->
              <div style="font-size:15px; line-height:22px; color:#68728a !important; margin-bottom:24px;">
                This code will expire in <strong style="color:#5b5cf6 !important;">10 minutes</strong>.
              </div>

              <!-- SECURITY -->
              <div class="security-box" style="background:#f7f8fc !important; border-radius:12px; padding:14px 18px; font-size:13px; line-height:20px; color:#68728a !important; text-align:left;">
                ${messageNotice || "🛡️ If you didn't request this code, you can safely ignore this email."}
              </div>

              <!-- SIGNATURE -->
              <div style="margin-top:30px; padding-top:24px; border-top:1px solid #edf0f6; text-align:left;">
                <div style="font-size:14px; color:#68728a !important;">
                  Cheers,
                </div>
                <div style="margin-top:4px; font-size:16px; font-weight:700; color:#121a33 !important;">
                  The Airvix Team
                </div>
              </div>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td class="footer" align="center" style="background:#f7f8fc !important; padding:24px 32px;">
              <div style="text-align:center; margin-bottom:6px;">
                <img src="${logoUrl}" alt="Airvix" height="24" style="display:inline-block; height:24px; width:auto; border:0; object-fit:contain;" />
              </div>
              <div style="margin-top:7px; font-size:12px; color:#7b8499 !important;">
                Automate. Engage. Grow.
              </div>
              <div style="margin-top:14px; font-size:11px; color:#9aa2b4 !important;">
                &copy; ${new Date().getFullYear()} Airvix. All rights reserved.
              </div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
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
