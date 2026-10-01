const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  family: 4,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async ({ to, subject, html, text, replyTo }) => {
  return transporter.sendMail({
    from: `"Coiffer" <${process.env.EMAIL_USER}>`,
    replyTo: replyTo || process.env.EMAIL_USER,
    to,
    subject,
    text: text || undefined,
    html,
  });
};

module.exports = sendEmail;