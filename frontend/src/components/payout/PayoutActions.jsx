import "./payout.css";
import { useEffect, useState } from "react";
import api from "../../api";
import { getAppointmentEndDateTime } from "../../utils/bookingtime";

/*
Shows the escrow state of a booking and lets the customer / staff member
confirm the job is done or raise a dispute.

Props:
  booking        populated booking (needs payoutStatus, customerConfirmedAt,
                 staffConfirmedAt, autoReleaseAt, appointmentDate/Time, services)
  role           "customer" | "staff"
  bookingStatus  optional: the freshest booking status (pending/confirmed/...)
*/
export default function PayoutActions({ booking, role, bookingStatus }) {
  const [state, setState] = useState({
    payoutStatus: booking?.payoutStatus,
    customerConfirmedAt: booking?.customerConfirmedAt,
    staffConfirmedAt: booking?.staffConfirmedAt,
  });
  const [busy, setBusy] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  // Re-sync if the parent hands us fresher booking data.
  useEffect(() => {
    setState({
      payoutStatus: booking?.payoutStatus,
      customerConfirmedAt: booking?.customerConfirmedAt,
      staffConfirmedAt: booking?.staffConfirmedAt,
    });
  }, [booking?.payoutStatus, booking?.customerConfirmedAt, booking?.staffConfirmedAt]);

  if (!booking?._id || !state.payoutStatus || state.payoutStatus === "none") {
    return null;
  }

  const isStaff = role === "staff";
  const status = bookingStatus || booking.status;
  const end = getAppointmentEndDateTime(booking);
  const ended = end ? Date.now() >= end.getTime() : false;

  const myConfirmed = isStaff ? state.staffConfirmedAt : state.customerConfirmedAt;
  const otherName = isStaff ? "the customer" : "the expert";

  const applyResult = (updated) => {
    if (!updated) return;
    setState({
      payoutStatus: updated.payoutStatus,
      customerConfirmedAt: updated.customerConfirmedAt,
      staffConfirmedAt: updated.staffConfirmedAt,
    });
  };

  const confirmDone = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.post(`/api/booking-payout/${booking._id}/confirm-complete`);
      applyResult(res.data.booking);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't confirm. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitDispute = async () => {
    if (busy) return;
    if (!reason.trim()) {
      setError("Please tell us what went wrong.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.post(`/api/booking-payout/${booking._id}/dispute`, {
        reason: reason.trim(),
      });
      applyResult(res.data.booking);
      setDisputing(false);
      setReason("");
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't raise the dispute. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const wrap = (children, tone = "info") => (
    <div className={`payoutBox payoutBox--${tone}`}>
      {children}
      {error && <p className="payoutError">{error}</p>}
    </div>
  );

  switch (state.payoutStatus) {
    case "held": {
      // Staff hasn't accepted yet, or the appointment hasn't happened yet.
      if (status === "pending" || !ended) {
        return wrap(
          <p className="payoutText">
            🔒{" "}
            {isStaff
              ? "Payment is held securely and is released once the job is confirmed."
              : "Your payment is held securely until the job is done."}
          </p>
        );
      }

      return wrap(
        <>
          <p className="payoutText">
            🔒 Payment is held.{" "}
            {myConfirmed
              ? `You confirmed the job. Waiting for ${otherName} to confirm.`
              : "Was the job completed?"}
          </p>

          {booking.autoReleaseAt && (
            <p className="payoutHint">
              Released automatically on{" "}
              {new Date(booking.autoReleaseAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              unless someone raises a dispute.
            </p>
          )}

          {!disputing && (
            <div className="payoutActions">
              <button className="payoutBtn payoutBtn--dispute" disabled={busy} onClick={() => setDisputing(true)}>
                Report a problem
              </button>
              {!myConfirmed && (
                <button className="payoutBtn payoutBtn--confirm" disabled={busy} onClick={confirmDone}>
                  {busy ? "Please wait…" : "Job completed"}
                </button>
              )}
            </div>
          )}

          {disputing && (
            <div className="payoutDisputeForm">
              <textarea
                className="payoutTextarea"
                placeholder="Describe what went wrong…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
              <div className="payoutActions">
                <button
                  className="payoutBtn"
                  disabled={busy}
                  onClick={() => {
                    setDisputing(false);
                    setError("");
                  }}
                >
                  Cancel
                </button>
                <button className="payoutBtn payoutBtn--dispute" disabled={busy} onClick={submitDispute}>
                  {busy ? "Sending…" : "Submit dispute"}
                </button>
              </div>
            </div>
          )}
        </>
      );
    }

    case "disputed":
      return wrap(
        <p className="payoutText">⚖️ This booking is under review. Our team will decide and settle the payment.</p>,
        "warn"
      );

    case "releasing":
    case "released":
      return wrap(
        <p className="payoutText">
          ✅ {isStaff ? "Your payout has been sent to your bank account." : "Payment has been released to the expert."}
        </p>,
        "ok"
      );

    case "payout_failed":
      return wrap(
        <p className="payoutText">
          {isStaff
            ? "⚠️ There was a problem sending your payout. Our team has been alerted and will sort it out."
            : "✅ Job confirmed. The expert's payout is being processed."}
        </p>,
        isStaff ? "warn" : "ok"
      );

    case "refunding":
      return wrap(<p className="payoutText">↩️ A refund is being processed.</p>, "warn");

    case "refunded":
      return wrap(<p className="payoutText">↩️ This payment was refunded to the customer.</p>, "warn");

    default:
      return null;
  }
}