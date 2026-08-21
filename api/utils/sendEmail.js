const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "142.250.102.109",
  port: 465,
  secure: true,
  family: 4,

  tls: {
    servername: "smtp.gmail.com",
  },

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  return transporter.sendMail({
    from: `"GhostCutApp" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

module.exports = sendEmail;