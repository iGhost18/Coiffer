import "./payout.css";
import { useEffect, useState } from "react";
import api from "../../api";

/*
Lets a staff member save (and verify) the bank account their payouts go to.
Renders nothing until it has loaded their current status.
*/
export default function PayoutSetup() {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null); // { account_name, last4 } | null
  const [editing, setEditing] = useState(false);

  const [banks, setBanks] = useState([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/payment/staff/bank-account")
      .then((res) => setAccount(res.data.bankAccount))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const startEditing = async () => {
    setEditing(true);
    setError("");
    if (banks.length === 0) {
      try {
        const res = await api.get("/api/payment/banks");
        setBanks(Array.isArray(res.data.banks) ? res.data.banks : []);
      } catch (err) {
        setError("Couldn't load the bank list. Try again.");
      }
    }
  };

  const save = async () => {
    if (saving) return;

    if (!bankCode || !/^\d{10}$/.test(accountNumber)) {
      setError("Choose your bank and enter a 10-digit account number.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await api.post("/api/payment/staff/bank-account", {
        account_bank: bankCode,
        account_number: accountNumber,
      });

      setAccount({
        account_name: res.data.account_name,
        last4: accountNumber.slice(-4),
      });
      setEditing(false);
      setAccountNumber("");
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save that account.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className={`payoutSetup ${account ? "" : "payoutSetup--missing"}`}>
      {!editing && account && (
        <div className="payoutSetupRow">
          <p className="payoutText">
            💳 Payouts go to <strong>{account.account_name}</strong> (••••{account.last4})
          </p>
          <button className="payoutBtn" onClick={startEditing}>
            Change
          </button>
        </div>
      )}

      {!editing && !account && (
        <div className="payoutSetupRow">
          <p className="payoutText">
            Add your bank account so you can get paid. Customers can't book you until this is set up.
          </p>
          <button className="payoutBtn payoutBtn--confirm" onClick={startEditing}>
            Add account
          </button>
        </div>
      )}

      {editing && (
        <div className="payoutDisputeForm">
          <select className="payoutInput" value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
            <option value="">Select your bank</option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>

          <input
            className="payoutInput"
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit account number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
          />

          {error && <p className="payoutError">{error}</p>}

          <div className="payoutActions">
            <button
              className="payoutBtn"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setError("");
              }}
            >
              Cancel
            </button>
            <button className="payoutBtn payoutBtn--confirm" disabled={saving} onClick={save}>
              {saving ? "Verifying…" : "Save account"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}