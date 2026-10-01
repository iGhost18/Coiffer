const express = require("express");
const router = express.Router();
const { z } = require("zod");
const rateLimit = require("../middleware/rateLimit");
const sendEmail = require("../utils/sendEmail");
const { authenticate, requireAdmin } = require("../middleware/auth");
const { inviteRequestEmail, inviteTokenEmail } = require("../utils/emailTemplates");


const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many requests. Please try again later.",
});

const schema = z.object({
  name: z.string().trim().max(80).optional().default(""),
  email: z.string().trim().toLowerCase().email().max(254),
  service: z.string().trim().min(2).max(100),
  message: z.string().trim().max(1000).optional().default(""),
  website: z.string().optional(), // honeypot: real users never fill this
});

// POST /api/invite-request  (public)
router.post("/", limiter, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "Please enter a valid email and the service you offer." });
  }

  const { name, email, service, message, website } = parsed.data;

  // Bots get a fake success and nothing is sent
  if (website) return res.status(200).json({ success: true });

  const companyEmail = process.env.COMPANY_EMAIL;
  if (!companyEmail) {
    console.error("COMPANY_EMAIL is not set");
    return res
      .status(500)
      .json({ message: "Couldn't send your request. Please try again later." });
  }

  try {
    const { subject, html, text } = inviteRequestEmail({ name, email, service, message });

    await sendEmail({
      to: companyEmail,
      replyTo: email,
      subject,
      html,
      text,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("POST /api/invite-request failed:", err);
    return res
      .status(500)
      .json({ message: "Couldn't send your request. Please try again later." });
  }
});

const sendSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().max(80).optional().default(""),
  token: z.string().trim().min(8).max(300).regex(/^[A-Za-z0-9._~-]+$/),
});

// POST /api/invite-request/send  (admin only)
// Emails a styled invite to an applicant.
router.post("/send", authenticate, requireAdmin, async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "A valid email and invite token are required." });
  }

  const { email, name, token } = parsed.data;

  if (!process.env.CLIENT_URL) {
    console.error("CLIENT_URL is not set");
    return res.status(500).json({ message: "Server is missing CLIENT_URL." });
  }

  try {
    const registerUrl = `${process.env.CLIENT_URL.replace(/\/+$/, "")}/staffregister/${token}`;
    const { subject, html, text } = inviteTokenEmail({ name, token, registerUrl });

    await sendEmail({ to: email, subject, html, text });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("POST /api/invite-request/send failed:", err);
    return res.status(500).json({ message: "Couldn't send the invite." });
  }
});

module.exports = router;