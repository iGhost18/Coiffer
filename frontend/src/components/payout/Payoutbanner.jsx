import "./payout.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";

/*
Shows a persistent reminder to experts who haven't added a payout account.
Renders nothing once an account exists (or while loading).

Props:
  settingsPath  route of the staff profile settings page, e.g. "/staff/settings"
*/
export default function PayoutBanner({ settingsPath }) {
  const [missing, setMissing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get("/api/payment/staff/bank-account")
      .then((res) => setMissing(!res.data.bankAccount))
      .catch(() => {});
  }, []);

  if (!missing) return null;

  return (
    <div className="payoutSetup payoutSetup--missing">
      <div className="payoutSetupRow">
        <p className="payoutText">
          Add your bank account to get paid. Customers can't complete a booking with you until you do.
        </p>
        <button
          className="payoutBtn payoutBtn--confirm"
          onClick={() => navigate(settingsPath, { state: { focus: "payout" } })}
        >
          Set up
        </button>
      </div>
    </div>
  );
}