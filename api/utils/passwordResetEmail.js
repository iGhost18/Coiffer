// utils/passwordResetEmail.js
//
// Branded password-reset email. Uses table layout + inline styles because
// email clients (Gmail, Outlook, Apple Mail) ignore most <style> blocks.

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function formatExpiry(minutes) {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} minutes`;
}

/**
 * @param {Object}  opts
 * @param {string}  opts.resetUrl         Full reset link (required)
 * @param {string}  [opts.name]           Recipient's first name or username
 * @param {number}  [opts.expiresInMinutes=60]
 * @param {string}  [opts.appName]        Defaults to APP_NAME env var, then "Coiffer"
 * @param {string}  [opts.logoUrl]        Optional absolute https URL to a logo (light-on-dark)
 */
function passwordResetEmail({
  resetUrl,
  name,
  expiresInMinutes = 60,
  appName,
  logoUrl,
}) {
  const brand = escapeHtml(appName || process.env.APP_NAME || "Coiffer");
  const safeName = escapeHtml(name || "there");
  const safeUrl = escapeHtml(resetUrl);
  const expiry = formatExpiry(expiresInMinutes);
  const year = new Date().getFullYear();

  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

  const headerContent = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${brand}" height="40" style="display:block;border:0;height:40px;width:auto;margin:0 auto;" />`
    : `<span style="font-family:${font};font-size:22px;font-weight:700;letter-spacing:2px;color:rgb(19, 182, 82);text-transform:uppercase;">${brand}</span>`;

  const subject = `Reset your ${brand} password`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;">

  <!-- Inbox preview text -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Use this link to choose a new password. It expires in ${expiry}.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;">
    <tr>
      <td align="center" style="padding:32px 12px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:14px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#1b2430;padding:28px 24px;">
              ${headerContent}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 8px 32px;font-family:${font};color:#222222;">
              <h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.3;font-weight:700;color:#111111;">
                Reset your password
              </h1>
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#444444;">
                Hi ${safeName},
              </p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#444444;">
                We received a request to reset the password for your ${brand} account.
                Tap the button below to choose a new one.
              </p>
            </td>
          </tr>

          <!-- Button -->
          <tr>
            <td align="center" style="padding:28px 32px;">
              <a href="${safeUrl}"
                 target="_blank"
                 style="display:inline-block;background-color:#111111;color:#ffffff;font-family:${font};font-size:16px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;">
                Reset password
              </a>
            </td>
          </tr>

          <!-- Expiry + fallback link -->
          <tr>
            <td style="padding:0 32px 28px 32px;font-family:${font};">
              <p style="margin:0 0 14px 0;font-size:13px;line-height:1.6;color:#666666;">
                This link expires in <strong style="color:#111111;">${expiry}</strong> and can only be used once.
              </p>
              <p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:#888888;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;">
                <a href="${safeUrl}" target="_blank" style="color:#be0505;text-decoration:underline;">${safeUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Not you? -->
          <tr>
            <td style="padding:0 32px 32px 32px;font-family:${font};">
              <div style="border-top:1px solid #eeeeee;padding-top:20px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#666666;">
                  Didn't ask for this? You can safely ignore this email. Your password won't change
                  unless you open the link above and set a new one.
                </p>
              </div>
            </td>
          </tr>

        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
          <tr>
            <td align="center" style="padding:20px 12px 0 12px;font-family:${font};font-size:12px;line-height:1.6;color:#999999;">
              &copy; ${year} Ghosthebarber. All rights reserved.<br />
              This is an automated message, please don't reply.
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Hi ${name || "there"},`,
    "",
    `We received a request to reset the password for your ${appName || process.env.APP_NAME || "Coiffer"} account.`,
    "",
    "Open this link to choose a new password:",
    resetUrl,
    "",
    `This link expires in ${expiry} and can only be used once.`,
    "",
    "Didn't ask for this? You can safely ignore this email. Your password won't change unless you open the link and set a new one.",
  ].join("\n");

  return { subject, html, text };
}

module.exports = { passwordResetEmail };