// Transactional email templates. Each returns { subject, text, html }.
// Table layout + inline styles so the mail renders the same in Gmail, Outlook and Apple Mail.

const BRAND = 'ToolKit';
const BRAND_COLOR = '#2563eb';
const INK = '#0b1220';
const INK_SOFT = '#3d4555';

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const layout = ({ preheader, body }) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${BRAND}</title></head>
<body style="margin:0;padding:0;background:#f3f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:${INK};">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e8f0;border-radius:12px;">
        <tr><td style="padding:28px 36px 20px;border-bottom:1px solid #e4e8f0;">
          <span style="font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${INK};">Tool<span style="color:${BRAND_COLOR};">Kit</span></span>
        </td></tr>
        <tr><td style="padding:28px 36px 32px;font-size:15px;line-height:24px;color:${INK_SOFT};">
          ${body}
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding:18px 36px;font-size:12px;line-height:18px;color:#8a93a6;text-align:center;">
          This is an automated message from ${BRAND}. Please do not reply to this email.<br>
          &copy; ${new Date().getFullYear()} ${BRAND}. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// One-time code for verifying an email address (e.g. the startup's contact email)
const verificationCode = ({ name, code, ttlMinutes }) => {
  const greeting = name ? `Dear ${name},` : 'Hello,';
  const subject = `${code} is your ${BRAND} verification code`;

  const text = [
    greeting,
    '',
    `We received a request to verify this email address for an account on ${BRAND}.`,
    '',
    `Your verification code is: ${code}`,
    '',
    `This code is valid for ${ttlMinutes} minutes and can be used only once.`,
    `For your security, do not share this code with anyone. ${BRAND} will never ask you for it by phone, email or chat.`,
    '',
    'If you did not request this, no action is needed. You can safely ignore this email and the address will not be added.',
    '',
    'Regards,',
    `The ${BRAND} Team`,
  ].join('\n');

  const html = layout({
    preheader: `Your ${BRAND} verification code is ${code}. It expires in ${ttlMinutes} minutes.`,
    body: `
      <h1 style="margin:0 0 18px;font-size:22px;line-height:30px;font-weight:700;color:${INK};">Verify your email address</h1>
      <p style="margin:0 0 14px;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 22px;">We received a request to verify this email address for an account on ${BRAND}. Please enter the code below to complete the verification.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
        <tr><td align="center" style="background:#edf2fd;border-radius:10px;padding:20px 12px;">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};margin-bottom:6px;">Verification code</div>
          <div style="font-family:Consolas,Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:${INK};">${escapeHtml(code)}</div>
        </td></tr>
      </table>
      <p style="margin:0 0 14px;">This code is valid for <strong style="color:${INK};">${ttlMinutes} minutes</strong> and can be used only once.</p>
      <p style="margin:0 0 14px;">For your security, do not share this code with anyone. ${BRAND} will never ask you for it by phone, email or chat.</p>
      <p style="margin:0 0 24px;">If you did not request this, no action is needed. You can safely ignore this email and the address will not be added.</p>
      <p style="margin:0;">Regards,<br><strong style="color:${INK};">The ${BRAND} Team</strong></p>`,
  });

  return { subject, text, html };
};

module.exports = { verificationCode };
