import { useState } from "react";
import "./deleteaccountmodal.css";

export default function DeleteAccountModal({ onCancel, onConfirm }) {
  const [confirmText, setConfirmText] = useState("");
  const canConfirm = confirmText.trim().toUpperCase() === "DELETE";

  return (
    <div className="DeleteAccOverlay" onClick={onCancel}>
      <div className="DeleteAccModal" onClick={(e) => e.stopPropagation()}>
        <h3 className="DeleteAccTitle">Delete your account?</h3>
        <p className="DeleteAccText">
          This permanently removes your profile, bookings, and saved posts.
          This can't be undone.
        </p>

        <label className="DeleteAccLabel">
          Type <strong>DELETE</strong> to confirm
        </label>
        <input
          type="text"
          className="DeleteAccInput"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoFocus
        />

        <div className="DeleteAccActions">
          <button className="DeleteAccCancelBtn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="DeleteAccConfirmBtn"
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            Delete account
          </button>
        </div>
      </div>
    </div>
  );
}