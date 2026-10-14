const { inviteRequestEmail, disputeAlertEmail } = require("../utils/emailTemplates");

const a = inviteRequestEmail({ name: "O'Brien", email: "a@b.com", service: "Fade", message: "hi" });
console.log("invite link renders as html:", a.html.includes('<a href="mailto:a@b.com"'));
console.log("invite name escaped once:", a.html.includes("O&#39;Brien") && !a.html.includes("&amp;#39;"));

const d = disputeAlertEmail({
  reference: "ABC123", role: "customer", raisedBy: "O'Brien", category: "poor quality",
  reason: "test", customerName: "A", staffName: "B", total: 5000, dashboardUrl: "http://x",
});
console.log("dispute name escaped once:", d.html.includes("O&#39;Brien") && !d.html.includes("&amp;#39;"));