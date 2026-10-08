// Replaces POST /staff/bank-account in the payment routes file.
// Assumptions to adjust: bcrypt package name, Staff password field name
// ("password"), and that sendEmail({to, subject, text}) is already imported.
const bcrypt = require("bcrypt");

const bankAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many attempts. Please try again later.",
});

async function resolveBankAccount(account_bank, account_number) {
  let response;
  let data;
  try {
    response = await fetch("https://api.flutterwave.com/v3/accounts/resolve", {
      method: "POST",
      headers: flwHeaders(),
      body: JSON.stringify({ account_number, account_bank }),
      signal: AbortSignal.timeout(15000),
    });
    data = await response.json();
  } catch (err) {
    console.error("Account resolve unreachable:", err);
    throw new Error("RESOLVE_UNAVAILABLE");
  }

  if (!response.ok || data.status !== "success" || !data.data?.account_name) {
    throw new Error("ACCOUNT_NOT_FOUND");
  }
  return {
    account_name: data.data.account_name,
    account_number: data.data.account_number || account_number,
  };
}

// flwHeaders() is not defined in this file yet: add the same helper from payouts.js.

router.post("/staff/bank-account", bankAccountLimiter, authenticate, async (req, res) => {
  try {
    if (req.auth.type !== "Staff") {
      return res.status(403).json({ message: "Only staff can set up payouts." });
    }

    const account_bank = String(req.body?.account_bank ?? "").trim();
    const account_number = String(req.body?.account_number ?? "").trim();
    const currentPassword = String(req.body?.currentPassword ?? "");

    if (!/^\d{3,6}$/.test(account_bank) || !/^\d{10}$/.test(account_number)) {
      return res.status(400).json({
        message: "Choose a bank and enter a valid 10-digit account number.",
      });
    }

    const staff = await Staff.findById(req.auth.id).select("+password email displayName username");
    if (!staff || !currentPassword || !(await bcrypt.compare(currentPassword, staff.password))) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    const resolved = await resolveBankAccount(account_bank, account_number);

    await Staff.findByIdAndUpdate(req.auth.id, {
      $set: {
        "flutterwave.bankAccount.account_bank": account_bank,
        "flutterwave.bankAccount.account_number": resolved.account_number,
        "flutterwave.bankAccount.account_name": resolved.account_name,
      },
    });

    // Best-effort alert: a swapped payout account is the classic account-takeover cash-out.
    try {
      if (staff.email) {
        await sendEmail({
          to: staff.email,
          subject: "Your payout account was changed",
          text: `Your payout account now ends in ${resolved.account_number.slice(-4)} (${resolved.account_name}). If this wasn't you, reset your password and contact support immediately.`,
        });
      }
    } catch (mailErr) {
      console.error("Bank change email failed:", mailErr);
    }

    return res.status(200).json({ success: true, account_name: resolved.account_name });
  } catch (err) {
    if (err.message === "ACCOUNT_NOT_FOUND") {
      return res.status(422).json({
        message: "We couldn't verify that account. Check the bank and account number.",
      });
    }
    if (err.message === "RESOLVE_UNAVAILABLE") {
      return res.status(503).json({ message: "Bank verification is unavailable right now. Try again shortly." });
    }
    console.error("POST /api/payment/staff/bank-account failed:", err);
    return res.status(500).json({ message: "Payout setup failed." });
  }
});