function currency(n) {
  return `₦${Number(n || 0).toLocaleString()}`;
}

const BRAND_COLOR = "rgb(19, 182, 82)";
const BRAND_COLOR_SOFT = "#f0e9e3";
const INK = "#1b2430";
const TEXT_DIM = "#697180";
const LINE = "#e3e6ea";

function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatDisplayTime(timeStr) {
  if (!timeStr) return "";
  const [hourStr, minute] = timeStr.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${ampm}`;
}

/*
========================================================
BASE WRAPPER

A single shared shell so every email looks consistent.
Table-based layout throughout — this isn't a stylistic
choice, it's required for reliable rendering across
Outlook, Gmail app, and older mail clients that strip
or ignore modern CSS (flexbox, grid, etc. all get
silently dropped in many clients).
========================================================
*/

function wrapEmail({ preheader = "", bodyHtml, footerNote = "" }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Coiffer</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f6f8; font-family: Arial, Helvetica, sans-serif;">

  <!-- Preheader: hidden preview text shown next to subject line in inbox -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f6f8; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background-color:#ffffff; border-radius:12px; overflow:hidden; border:1px solid ${LINE};">

          <!-- Header -->
          <tr>
            <td style="background-color:${INK}; padding: 28px 32px; text-align:center;">
              <span style="font-family: Georgia, 'Times New Roman', serif; font-size:22px; font-weight:700; color:#ffffff; letter-spacing:0.3px;">
                <span style="color:${BRAND_COLOR};">Coiffer</span>
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 8px 32px; color:${INK}; font-size:14px; line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px 28px 32px;">
              <hr style="border:none; border-top:1px solid ${LINE}; margin: 0 0 16px 0;" />
              ${footerNote ? `<p style="margin:0 0 10px 0; font-size:12px; color:${TEXT_DIM};">${footerNote}</p>` : ""}
              <p style="margin:0; font-size:11px; color:${TEXT_DIM};">
                This is an automated message from Coiffer. If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/*
========================================================
RECEIPT TABLE
Shared itemized table used by both booking confirmation
and payment receipt emails.
========================================================
*/

function receiptTable(items, total) {
  const rows = (items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid ${LINE}; font-size:13px; color:${INK};">
          ${item.name}
          <span style="color:${TEXT_DIM};"> × ${item.quantity}</span>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid ${LINE}; font-size:13px; color:${INK}; text-align:right; white-space:nowrap;">
          ${currency(item.price * item.quantity)}
        </td>
      </tr>`
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
      ${rows}
      <tr>
        <td style="padding: 14px 0 0 0; font-size:15px; font-weight:700; color:${INK};">Total</td>
        <td style="padding: 14px 0 0 0; font-size:15px; font-weight:700; color:${BRAND_COLOR}; text-align:right;">
          ${currency(total)}
        </td>
      </tr>
    </table>
  `;
}

function detailRow(label, value) {
  if (!value) return "";
  return `
    <tr>
      <td style="padding: 4px 0; font-size:13px; color:${TEXT_DIM}; width: 110px; vertical-align:top;">${label}</td>
      <td style="padding: 4px 0; font-size:13px; color:${INK}; font-weight:600;">${value}</td>
    </tr>
  `;
}

/*
========================================================
BOOKING CONFIRMATION — now a proper receipt
========================================================
*/

function bookingConfirmationEmail({
  customerName,
  staffName,
  services,
  appointmentDate,
  appointmentTime,
  total,
  reference,
}) {
  const displayDate = formatDisplayDate(appointmentDate);
  const displayTime = formatDisplayTime(appointmentTime);

  const body = `
    <p style="margin:0 0 4px 0; font-size:12px; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; color:${BRAND_COLOR};">
      Appointment requested
    </p>
    <h2 style="margin:0 0 16px 0; font-size:20px; color:${INK};">Hi ${customerName || "there"}, you've booked an appointment.</h2>
    <p style="margin:0 0 16px 0; font-size:13px; color:${TEXT_DIM};">
      ${staffName || "Your professional"} will confirm your appointment shortly. We'll email you as soon as it's confirmed.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND_COLOR_SOFT}; border-radius:8px; padding: 16px 18px; margin-bottom: 8px;">
      ${detailRow("Professional", staffName)}
      ${detailRow("Date", displayDate)}
      ${detailRow("Time", displayTime)}
      ${reference ? detailRow("Reference", `#${reference}`) : ""}
    </table>

    <p style="margin: 20px 0 0 0; font-size:13px; font-weight:700; color:${INK}; text-transform:uppercase; letter-spacing:0.4px;">
      Receipt
    </p>
    ${receiptTable(services, total)}

    <p style="margin: 24px 0 0 0; font-size:13px; color:${TEXT_DIM};">
      Keep this email as your booking receipt. If your plans change, you can manage or cancel this appointment from your Coiffer schedule.
    </p>
  `;

  return {
    subject: `Appointment booked — ${displayDate || "pending confirmation"}`,
    text:
      `Hi ${customerName || "there"},\n\n` +
      `You've booked an appointment${staffName ? ` with ${staffName}` : ""}. ${staffName || "Your professional"} will confirm it shortly.\n` +
      `Date: ${displayDate}\nTime: ${displayTime}\n` +
      (reference ? `Reference: #${reference}\n` : "") +
      `\nServices:\n` +
      (services || []).map((s) => `- ${s.name} x${s.quantity}: ${currency(s.price * s.quantity)}`).join("\n") +
      `\n\nTotal: ${currency(total)}\n\n— Coiffer`,
    html: wrapEmail({
      preheader: `You've booked an appointment${staffName ? ` with ${staffName}` : ""}. Awaiting confirmation.`,
      bodyHtml: body,
      footerNote: "Questions about this booking? Reply to this email or reach out from the app.",
    }),
  };
}

/*
========================================================
BOOKING STATUS UPDATE
========================================================
*/

function bookingStatusEmail({ customerName, status, staffName }) {
  const statusMeta =
    {
      confirmed: { text: "confirmed", color: BRAND_COLOR },
      completed: { text: "marked as completed", color: BRAND_COLOR },
      cancelled: { text: "cancelled", color: "#c4534b" },
      pending: { text: "set back to pending", color: "#d98e3b" },
    }[status] || { text: status, color: INK };

  const body = `
    <p style="margin:0 0 4px 0; font-size:12px; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; color:${statusMeta.color};">
      Booking update
    </p>
    <h2 style="margin:0 0 12px 0; font-size:20px; color:${INK};">Hi ${customerName || "there"},</h2>
    <p style="margin:0; font-size:14px; color:${INK};">
      Your appointment${staffName ? ` with <strong>${staffName}</strong>` : ""} has been
      <strong style="color:${statusMeta.color};">${statusMeta.text}</strong>.
    </p>
  `;

  return {
    subject: `Appointment ${statusMeta.text}`,
    text: `Hi ${customerName || "there"},\n\nYour appointment${staffName ? ` with ${staffName}` : ""} has been ${statusMeta.text}.\n\n— Coiffer`,
    html: wrapEmail({
      preheader: `Your appointment has been ${statusMeta.text}.`,
      bodyHtml: body,
    }),
  };
}

/*
========================================================
PAYMENT RECEIPT (store orders / Flutterwave)
========================================================
*/

function paymentReceiptEmail({ customerName, txRef, total, items }) {
  const body = `
    <p style="margin:0 0 4px 0; font-size:12px; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; color:${BRAND_COLOR};">
      Payment received
    </p>
    <h2 style="margin:0 0 16px 0; font-size:20px; color:${INK};">Thanks for your order, ${customerName || "there"}.</h2>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND_COLOR_SOFT}; border-radius:8px; padding: 16px 18px; margin-bottom: 8px;">
      ${detailRow("Reference", txRef)}
    </table>

    <p style="margin: 20px 0 0 0; font-size:13px; font-weight:700; color:${INK}; text-transform:uppercase; letter-spacing:0.4px;">
      Receipt
    </p>
    ${receiptTable(items, total)}
  `;

  return {
    subject: "Payment receipt",
    text:
      `Hi ${customerName || "there"},\n\nThanks for your payment.\nReference: ${txRef}\n\n` +
      (items || []).map((i) => `- ${i.name} x${i.quantity}: ${currency(i.price * i.quantity)}`).join("\n") +
      `\n\nTotal paid: ${currency(total)}\n\n— Coiffer`,
    html: wrapEmail({
      preheader: `Your payment of ${currency(total)} was received.`,
      bodyHtml: body,
    }),
  };
}

/*
========================================================
DELIVERY UPDATE
========================================================
*/

function deliveryUpdateEmail({ customerName, message, orderItems }) {
  const rows = (orderItems || [])
    .map(
      (i) => `<li style="margin-bottom:4px;">${i.name} <span style="color:${TEXT_DIM};">× ${i.quantity}</span></li>`
    )
    .join("");

  const body = `
    <p style="margin:0 0 4px 0; font-size:12px; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; color:${BRAND_COLOR};">
      Delivery update
    </p>
    <h2 style="margin:0 0 12px 0; font-size:20px; color:${INK};">Hi ${customerName || "there"},</h2>
    <p style="margin:0 0 12px 0; font-size:14px; color:${INK};">${message}</p>
    ${rows ? `<ul style="margin:0; padding-left:18px; font-size:13px; color:${INK};">${rows}</ul>` : ""}
  `;

  return {
    subject: "Order delivery update",
    text: `Hi ${customerName || "there"},\n\n${message}\n\n— Coiffer`,
    html: wrapEmail({
      preheader: message,
      bodyHtml: body,
    }),
  };
}

/*
========================================================
NEW BOOKING NOTIFICATION (for staff)
========================================================
*/

function newBookingNotificationEmail({ staffName, customerName, services, appointmentDate, appointmentTime, total }) {
  const displayDate = formatDisplayDate(appointmentDate);
  const displayTime = formatDisplayTime(appointmentTime);

  const body = `
    <p style="margin:0 0 4px 0; font-size:12px; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; color:${BRAND_COLOR};">
      New booking request
    </p>
    <h2 style="margin:0 0 16px 0; font-size:20px; color:${INK};">Hi ${staffName || "there"}, you have a new appointment request.</h2>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND_COLOR_SOFT}; border-radius:8px; padding: 16px 18px; margin-bottom: 8px;">
      ${detailRow("Customer", customerName)}
      ${detailRow("Date", displayDate)}
      ${detailRow("Time", displayTime)}
      ${detailRow("Total", currency(total))}
    </table>

    <p style="margin: 20px 0 0 0; font-size:13px; color:${TEXT_DIM};">
      Services: ${(services || []).map((s) => `${s.name} × ${s.quantity}`).join(", ")}
    </p>

    <p style="margin: 24px 0 0 0; font-size:13px; color:${TEXT_DIM};">
      Log in to Coiffer to confirm or decline this request.
    </p>
  `;

  return {
    subject: `New booking request from ${customerName || "a customer"}`,
    text:
      `Hi ${staffName || "there"},\n\nYou have a new appointment request from ${customerName || "a customer"}.\n` +
      `Date: ${displayDate}\nTime: ${displayTime}\nTotal: ${currency(total)}\n\n— Coiffer`,
    html: wrapEmail({
      preheader: `New booking request from ${customerName || "a customer"}.`,
      bodyHtml: body,
    }),
  };
}


function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

/*
========================================================
expert INVITE REQUEST (sent to the company inbox)
========================================================
*/

function inviteRequestEmail({ name, email, service, message }) {
  const safeMessage = message
    ? escapeHtml(message).replace(/\n/g, "<br/>")
    : `<span style="color:${TEXT_DIM};">No message</span>`;

  const body = `
    <p style="margin:0 0 4px 0; font-size:12px; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; color:${BRAND_COLOR};">
      expert invite request
    </p>
    <h2 style="margin:0 0 16px 0; font-size:20px; color:${INK};">Someone wants to join as staff.</h2>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND_COLOR_SOFT}; border-radius:8px; padding: 16px 18px; margin-bottom: 8px;">
      ${detailRow("Name", escapeHtml(name) || "-")}
      ${detailRow("Email", `<a href="mailto:${escapeHtml(email)}" style="color:${INK};">${escapeHtml(email)}</a>`)}
      ${detailRow("Service", escapeHtml(service))}
    </table>

    <p style="margin: 20px 0 8px 0; font-size:13px; font-weight:700; color:${INK}; text-transform:uppercase; letter-spacing:0.4px;">
      Message
    </p>
    <div style="background-color:#f7f8fa; border-radius:8px; padding:14px 16px; font-size:13px; line-height:1.6; color:${INK};">
      ${safeMessage}
    </div>

    <p style="margin: 24px 0 0 0; font-size:13px; color:${TEXT_DIM};">
      To approve, reply to this email with their invite token or a registration link.
    </p>
  `;

  return {
    subject: `New expert invite request: ${email} (${service})`,
    text: `Name: ${name || "-"}\nEmail: ${email}\nService: ${service}\n\nMessage:\n${message || "-"}\n\nReply to this email with their invite token.`,
    html: wrapEmail({
      preheader: `${name || email} wants to join as ${service}.`,
      bodyHtml: body,
    }),
  };
}

/*
========================================================
expert INVITE (sent to the applicant, with their token)
========================================================
*/

function inviteTokenEmail({ name, token, registerUrl }) {
  const body = `
    <p style="margin:0 0 4px 0; font-size:12px; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; color:${BRAND_COLOR};">
      You're invited
    </p>
    <h2 style="margin:0 0 16px 0; font-size:20px; color:${INK};">Hi ${escapeHtml(name) || "there"}, your invite is ready.</h2>
    <p style="margin:0 0 20px 0; font-size:14px; color:${INK};">
      Thanks for your interest in joining Coiffer as a professional. Use the button below to
      finish creating your account.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px auto;">
      <tr>
        <td style="background-color:${BRAND_COLOR}; border-radius:8px;">
          <a href="${escapeHtml(registerUrl)}"
             style="display:inline-block; padding:14px 28px; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none;">
            Complete registration
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px 0; font-size:13px; color:${TEXT_DIM};">
      Button not working? Paste this invite token on the invite page instead:
    </p>
    <div style="background-color:${BRAND_COLOR_SOFT}; border-radius:8px; padding:14px 16px; font-family:'Courier New',monospace; font-size:14px; color:${INK}; word-break:break-all;">
      ${escapeHtml(token)}
    </div>

    <p style="margin:24px 0 0 0; font-size:13px; color:${TEXT_DIM};">
      Keep this invite private. It's meant for you only.
    </p>
  `;

  return {
    subject: "Your Coiffer expert invite",
    text:
      `Hi ${name || "there"},\n\nYour invite is ready. Complete your registration here:\n${registerUrl}\n\n` +
      `Or paste this token on the invite page:\n${token}\n\nKeep this invite private.\n\n— Coiffer`,
    html: wrapEmail({
      preheader: "Your invite to join Coiffer is ready.",
      bodyHtml: body,
    }),
  };
}

module.exports = {
  bookingConfirmationEmail,
  bookingStatusEmail,
  paymentReceiptEmail,
  deliveryUpdateEmail,
  newBookingNotificationEmail,
  inviteRequestEmail,
  inviteTokenEmail,
};