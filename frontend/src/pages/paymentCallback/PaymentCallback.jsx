import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../../api";
import Receipt from "../../components/receipt/Receipt";
import { useCart } from "../../components/context/CartContext";
import "./paymentcallback.css";

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [state, setState] = useState("verifying");
  const [receiptData, setReceiptData] = useState(null);

  useEffect(() => {
    const transactionId = searchParams.get("transaction_id");

    if (!transactionId) {
      setState("failed");
      return;
    }

    const verify = async () => {
      try {
        const res = await api.get(`/api/payment/verify/${transactionId}`);
        if (res.data.success) {
          setReceiptData(res.data);
          setState("success");
          clearCart();
        } else {
          setState("failed");
        }
      } catch (err) {
        console.log(err);
        setState("failed");
      }
    };

    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const txRef = searchParams.get("tx_ref");

  if (state === "verifying") {
    return (
      <div className="pc-page">
        <div className="pc-icon pc-icon--verifying">⏳</div>
        <h2 className="pc-title">Confirming your payment…</h2>
        <p className="pc-message">This should only take a moment.</p>
      </div>
    );
  }

  if (state === "success" && receiptData) {
    return (
      <Receipt
        bookings={receiptData.bookings}
        orders={receiptData.orders}
        contact={receiptData.contact}
        address={receiptData.address}
        paymentMethod={receiptData.paymentMethod}
        total={receiptData.total}
        onClose={() => navigate("/")}
        onViewSchedule={() => navigate("/schedule", { replace: true })}
      />
    );
  }

  return (
    <div className="pc-page">
      <div className="pc-icon pc-icon--failed">✕</div>
      <h2 className="pc-title">We couldn't confirm this payment</h2>
      <p className="pc-message">If money was deducted, contact support with your reference below.</p>
      {txRef && <p className="pc-ref">Ref: {txRef}</p>}
      <button className="pc-btn pc-btn--primary" onClick={() => navigate("/")}>
        Go home
      </button>
    </div>
  );
}