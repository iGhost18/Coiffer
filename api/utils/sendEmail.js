const sendEmail = async ({ to, subject, html, text, replyTo }) => {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error("RESEND_API_KEY or EMAIL_FROM is not set");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
      text: text || undefined,
      reply_to: replyTo || undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(`Email send failed (${res.status}): ${await res.text()}`);
  }

  return res.json();
};

module.exports = sendEmail;