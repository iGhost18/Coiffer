import "./signoutmodal.css";
import { useEffect } from "react";

export default function SignOutModal({ onCancel, onConfirm }) {

  useEffect(() => {
    const handleKey = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  return (
    <div className="SignOutOverlay" onClick={onCancel}>
      <div className="SignOutModal" onClick={(e) => e.stopPropagation()}>
        <h3 className="SignOutTitle">Sign out?</h3>
        <p className="SignOutText">
          You'll need to log back in to access your account.
        </p>

        <div className="SignOutActions">
          <button className="SignOutCancelBtn" onClick={onCancel}>
            Cancel
          </button>
          <button className="SignOutConfirmBtn" onClick={onConfirm}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}